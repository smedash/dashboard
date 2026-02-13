import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface ParsedCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  subject: string;
  type: string;
  typeLabel: string;
  scope: string | null;
  message: string;
}

function parseCommitMessage(subject: string) {
  const conventionalMatch = subject.match(/^(\w+)(?:\(([^)]+)\))?\s*:\s*(.+)$/);
  if (conventionalMatch) {
    return {
      type: conventionalMatch[1].toLowerCase(),
      scope: conventionalMatch[2] || null,
      message: conventionalMatch[3].trim(),
    };
  }
  return { type: "other", scope: null, message: subject };
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    feat: "Feature",
    fix: "Bugfix",
    refactor: "Refactoring",
    chore: "Wartung",
    docs: "Dokumentation",
    style: "Styling",
    perf: "Performance",
    test: "Tests",
    ci: "CI/CD",
    build: "Build",
    other: "Sonstiges",
  };
  return labels[type] || "Sonstiges";
}

// Versuche Commits per git log zu laden (funktioniert lokal)
async function getCommitsFromGit(): Promise<ParsedCommit[] | null> {
  try {
    const { execSync } = await import("child_process");
    const gitLog = execSync(
      `git log --pretty=format:'%H|%h|%an|%ai|%s' -500`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, timeout: 5000 }
    );

    return gitLog
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.split("|");
        const hash = parts[0];
        const shortHash = parts[1];
        const author = parts[2];
        const date = parts[3];
        const subject = parts.slice(4).join("|");
        const parsed = parseCommitMessage(subject);

        return {
          hash,
          shortHash,
          author,
          date: date.trim(),
          subject,
          type: parsed.type,
          typeLabel: getTypeLabel(parsed.type),
          scope: parsed.scope,
          message: parsed.message,
        };
      });
  } catch {
    return null;
  }
}

// Fallback: Commits per GitHub API laden (funktioniert auf Vercel)
async function getCommitsFromGitHub(): Promise<ParsedCommit[]> {
  const GITHUB_REPO = "smedash/dashboard";
  const commits: ParsedCommit[] = [];
  let page = 1;
  const perPage = 100;

  // GitHub API: bis zu 5 Seiten (500 Commits)
  while (page <= 5) {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/commits?per_page=${perPage}&page=${page}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "SME-Dashboard",
    };

    // Optional: GitHub Token für höhere Rate Limits
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) break;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const item of data) {
      const subject = item.commit?.message?.split("\n")[0] || "";
      const parsed = parseCommitMessage(subject);

      commits.push({
        hash: item.sha || "",
        shortHash: (item.sha || "").substring(0, 7),
        author: item.commit?.author?.name || "Unknown",
        date: item.commit?.author?.date || "",
        subject,
        type: parsed.type,
        typeLabel: getTypeLabel(parsed.type),
        scope: parsed.scope,
        message: parsed.message,
      });
    }

    if (data.length < perPage) break;
    page++;
  }

  return commits;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  try {
    // Zuerst git log versuchen (Dev), dann GitHub API (Vercel)
    let commits = await getCommitsFromGit();
    let source = "git";

    if (!commits || commits.length === 0) {
      commits = await getCommitsFromGitHub();
      source = "github";
    }

    // Nach Datum gruppieren
    const grouped: Record<string, ParsedCommit[]> = {};
    commits.forEach((commit) => {
      const dateKey = commit.date.substring(0, 10);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(commit);
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totalCommits: commits.length,
      commits,
      groupedByDate: grouped,
      source,
    });
  } catch (error) {
    console.error("Fehler beim Laden der Commits:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Commits" }, { status: 500 });
  }
}
