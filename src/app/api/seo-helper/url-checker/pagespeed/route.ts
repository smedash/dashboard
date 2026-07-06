import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRateLimiter } from "@/lib/rate-limit";

interface CWVMetrics {
  lcp: { value: number; score: string };
  fid: { value: number; score: string };
  cls: { value: number; score: string };
  inp: { value: number; score: string };
  fcp: { value: number; score: string };
  ttfb: { value: number; score: string };
  performanceScore: number;
  strategy: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success, resetIn } = apiRateLimiter.check(session.user.id);
    if (!success) {
      return NextResponse.json(
        { error: `Rate limit erreicht. Bitte warte ${resetIn} Sekunden.` },
        { status: 429 }
      );
    }

    const { url, strategy = "mobile" } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL ist erforderlich" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "PageSpeed Insights API Key nicht konfiguriert. Setze GOOGLE_PAGESPEED_API_KEY in .env" },
        { status: 500 }
      );
    }

    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${apiKey}&category=performance`;

    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[pagespeed] API error:", errText);
      return NextResponse.json(
        { error: `PageSpeed API Fehler: ${response.status}` },
        { status: 400 }
      );
    }

    const data = await response.json();

    const lighthouse = data.lighthouseResult;
    const audits = lighthouse?.audits || {};
    const performanceScore = Math.round((lighthouse?.categories?.performance?.score || 0) * 100);

    const metrics: CWVMetrics = {
      lcp: {
        value: audits['largest-contentful-paint']?.numericValue || 0,
        score: getMetricScore('lcp', audits['largest-contentful-paint']?.numericValue || 0),
      },
      fid: {
        value: audits['max-potential-fid']?.numericValue || 0,
        score: getMetricScore('fid', audits['max-potential-fid']?.numericValue || 0),
      },
      cls: {
        value: audits['cumulative-layout-shift']?.numericValue || 0,
        score: getMetricScore('cls', audits['cumulative-layout-shift']?.numericValue || 0),
      },
      inp: {
        value: audits['interaction-to-next-paint']?.numericValue || 0,
        score: getMetricScore('inp', audits['interaction-to-next-paint']?.numericValue || 0),
      },
      fcp: {
        value: audits['first-contentful-paint']?.numericValue || 0,
        score: getMetricScore('fcp', audits['first-contentful-paint']?.numericValue || 0),
      },
      ttfb: {
        value: audits['server-response-time']?.numericValue || 0,
        score: getMetricScore('ttfb', audits['server-response-time']?.numericValue || 0),
      },
      performanceScore,
      strategy,
    };

    // Also get CrUX field data if available
    const cruxData = data.loadingExperience?.metrics || null;
    const fieldData = cruxData ? {
      lcpMs: cruxData.LARGEST_CONTENTFUL_PAINT_MS?.percentile || null,
      fidMs: cruxData.FIRST_INPUT_DELAY_MS?.percentile || null,
      cls: cruxData.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile || null,
      inpMs: cruxData.INTERACTION_TO_NEXT_PAINT?.percentile || null,
    } : null;

    return NextResponse.json({ metrics, fieldData });
  } catch (error) {
    console.error("[pagespeed] Error:", error);
    return NextResponse.json(
      { error: "Fehler bei der PageSpeed-Analyse." },
      { status: 500 }
    );
  }
}

function getMetricScore(metric: string, value: number): string {
  const thresholds: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    fid: [100, 300],
    cls: [0.1, 0.25],
    inp: [200, 500],
    fcp: [1800, 3000],
    ttfb: [800, 1800],
  };

  const [good, poor] = thresholds[metric] || [0, 0];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}
