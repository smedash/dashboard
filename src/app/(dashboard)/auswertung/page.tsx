"use client";

import { useState, useEffect, useMemo } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { BarChart } from "@/components/charts/BarChart";
import { StatCard } from "@/components/ui/StatCard";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useProperty } from "@/contexts/PropertyContext";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { analysisMessages } from "@/i18n/messages/analysis";

const TIMEOUT_ERROR = "TIMEOUT";

type ErrorState =
  | { kind: "message"; message: string }
  | { kind: "timeout" | "loadFailed" | "unknown" };

interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface DirectoryStats {
  path: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pageCount: number;
  pages: Array<{
    url: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  keywords: Array<{
    keyword: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export default function AuswertungPage() {
  const { selectedProperty } = useProperty();
  const t = useMessages(analysisMessages);
  const { intlLocale } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState("28d");
  const [pagesData, setPagesData] = useState<GSCRow[]>([]);
  const [queryPageData, setQueryPageData] = useState<GSCRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [needsGoogleConnection, setNeedsGoogleConnection] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
  const [directoryDepth, setDirectoryDepth] = useState(4);
  const [viewMode, setViewMode] = useState<"directories" | "keywords">("directories");
  const [brandFilter, setBrandFilter] = useState("ubs");
  const [excludeBrand, setExcludeBrand] = useState(true);
  const [totals, setTotals] = useState({
    clicks: 0,
    impressions: 0,
    position: 0,
  });

  // Set mounted to true after component mounts to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch GSC data when property or period changes
  useEffect(() => {
    async function fetchData() {
      if (!selectedProperty) {
        setIsLoading(false);
        return;
      }

      setIsLoadingData(true);
      setError(null);
      setNeedsGoogleConnection(false);
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(TIMEOUT_ERROR)), 60000); // 60 seconds timeout
        });

        // Fetch data with timeout protection
        // Reduce limits to improve performance - can be increased if needed
        const pagesPromise = fetch(`/api/gsc/pages?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=10000`);
        const queryPagePromise = fetch(`/api/gsc/query-page?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=10000`);
        
        const [pagesRes, queryPageRes] = await Promise.race([
          Promise.all([pagesPromise, queryPagePromise]),
          timeoutPromise,
        ]) as [Response, Response];

        // Check HTTP status codes
        if (!pagesRes.ok || !queryPageRes.ok) {
          const errorResponse = !pagesRes.ok 
            ? await pagesRes.json() 
            : await queryPageRes.json();
          
          // Check if Google account needs to be connected
          if (errorResponse.needsConnection || pagesRes.status === 403 || queryPageRes.status === 403) {
            setNeedsGoogleConnection(true);
            return;
          }
          
          const errorText = errorResponse.error || JSON.stringify(errorResponse);
          throw new Error(`API Error: ${pagesRes.status} ${queryPageRes.status} - ${errorText}`);
        }

        const pagesResult = await pagesRes.json();
        const queryPageResult = await queryPageRes.json();

        if (pagesResult.error || queryPageResult.error) {
          // Check if error indicates missing Google connection
          if (pagesResult.needsConnection || queryPageResult.needsConnection) {
            setNeedsGoogleConnection(true);
            return;
          }
          
          const errorMsg = pagesResult.error || queryPageResult.error;
          console.error("Error fetching data:", errorMsg);
          setError(errorMsg ? { kind: "message", message: errorMsg } : { kind: "loadFailed" });
          return;
        }
        
        // Reset needsGoogleConnection if data loads successfully
        setNeedsGoogleConnection(false);

        setPagesData(pagesResult.data || []);
        setQueryPageData(queryPageResult.data || []);

        // Calculate totals
        const totalClicks = pagesResult.data?.reduce((sum: number, row: GSCRow) => sum + row.clicks, 0) || 0;
        const totalImpressions = pagesResult.data?.reduce((sum: number, row: GSCRow) => sum + row.impressions, 0) || 0;
        const totalPosition = pagesResult.data?.reduce((sum: number, row: GSCRow) => sum + row.position, 0) || 0;
        const avgPosition = pagesResult.data?.length > 0 ? totalPosition / pagesResult.data.length : 0;

        setTotals({
          clicks: totalClicks,
          impressions: totalImpressions,
          position: avgPosition,
        });

        setSelectedDirectory(null);
      } catch (error) {
        console.error("Error fetching GSC data:", error);
        if (error instanceof Error && error.message === TIMEOUT_ERROR) {
          setError({ kind: "timeout" });
        } else if (error instanceof Error) {
          setError({ kind: "message", message: error.message });
        } else {
          setError({ kind: "unknown" });
        }
      } finally {
        setIsLoadingData(false);
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedProperty, period]);

  // Parse URL and extract directory path
  const extractDirectoryPath = (url: string, depth: number): string => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      const dirParts = pathParts.slice(0, depth);
      return "/" + dirParts.join("/");
    } catch {
      return "/";
    }
  };

  // Calculate directory statistics
  const directoryStats = useMemo(() => {
    const dirMap = new Map<string, DirectoryStats>();

    // Group pages by directory
    pagesData.forEach((page) => {
      const pageUrl = page.keys[0];
      const dirPath = extractDirectoryPath(pageUrl, directoryDepth);

      if (!dirMap.has(dirPath)) {
        dirMap.set(dirPath, {
          path: dirPath,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          pageCount: 0,
          pages: [],
          keywords: [],
        });
      }

      const dir = dirMap.get(dirPath)!;
      dir.clicks += page.clicks;
      dir.impressions += page.impressions;
      dir.pageCount += 1;
      dir.position += page.position;
      dir.pages.push({
        url: pageUrl,
        clicks: page.clicks,
        impressions: page.impressions,
        ctr: page.ctr,
        position: page.position,
      });
    });

    // Calculate averages and CTR
    dirMap.forEach((dir) => {
      dir.ctr = dir.impressions > 0 ? dir.clicks / dir.impressions : 0;
      dir.position = dir.pageCount > 0 ? dir.position / dir.pageCount : 0;
      dir.pages.sort((a, b) => b.clicks - a.clicks);
    });

    const stats = Array.from(dirMap.values()).sort((a, b) => b.clicks - a.clicks);

    return { directories: stats, queryPageData };
  }, [pagesData, queryPageData, directoryDepth]);

  // Get keywords for selected directory based on actual URL data
  const directoryKeywords = useMemo(() => {
    if (!selectedDirectory) return [];

    // Get all page URLs in this directory
    const selectedDir = directoryStats.directories.find((d) => d.path === selectedDirectory);
    if (!selectedDir) return [];

    const pageUrlsInDirectory = new Set(selectedDir.pages.map((p) => p.url));

    // Filter keywords based on brand filter
    const brandTerms = brandFilter
      .toLowerCase()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Get keywords that belong to pages in this directory
    const keywordMap = new Map<string, {
      keyword: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
      pageCount: number;
    }>();

    // Use query_page data to get keywords per URL
    // For query_page: keys[0] = query, keys[1] = page
    directoryStats.queryPageData.forEach((qp) => {
      const query = qp.keys[0];
      const pageUrl = qp.keys[1];
      
      // Check if this keyword's page is in our directory
      if (pageUrl && pageUrlsInDirectory.has(pageUrl)) {
        const existing = keywordMap.get(query);
        if (existing) {
          existing.clicks += qp.clicks;
          existing.impressions += qp.impressions;
          existing.position += qp.position;
          existing.pageCount += 1;
        } else {
          keywordMap.set(query, {
            keyword: query,
            clicks: qp.clicks,
            impressions: qp.impressions,
            ctr: qp.ctr,
            position: qp.position,
            pageCount: 1,
          });
        }
      }
    });

    // Convert to array and calculate averages
    const keywords = Array.from(keywordMap.values())
      .map((kw) => ({
        keyword: kw.keyword,
        clicks: kw.clicks,
        impressions: kw.impressions,
        ctr: kw.impressions > 0 ? kw.clicks / kw.impressions : 0,
        position: kw.pageCount > 0 ? kw.position / kw.pageCount : 0,
        relevanceScore: 1, // All are relevant since they come from actual page data
      }))
      .filter((kw) => {
        // Brand filter
        if (excludeBrand && brandTerms.length > 0) {
          const kwLower = kw.keyword.toLowerCase();
          if (brandTerms.some((term) => kwLower.includes(term))) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.clicks - a.clicks);

    return keywords;
  }, [selectedDirectory, directoryStats.directories, directoryStats.queryPageData, brandFilter, excludeBrand]);

  const selectedDir = directoryStats.directories.find((d) => d.path === selectedDirectory);

  const chartData = directoryStats.directories.slice(0, 10).map((dir) => ({
    directory: dir.path.length > 20 ? "..." + dir.path.slice(-20) : dir.path,
    clicks: dir.clicks,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>

        <div className="flex flex-wrap items-center gap-4">
          <PeriodSelector value={period} onChange={setPeriod} />

          {/* Directory Depth */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">{t.depth}</span>
            <select
              value={directoryDepth}
              onChange={(e) => setDirectoryDepth(parseInt(e.target.value))}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4, 5].map((depth) => (
                <option key={depth} value={depth}>
                  {t.levels(depth)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {needsGoogleConnection ? (
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-blue-400 font-semibold mb-2">{t.googleNotConnected.title}</h3>
              <p className="text-blue-300 mb-4">
                {t.googleNotConnected.text}
              </p>
              <a
                href="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t.googleNotConnected.goToSettings}
              </a>
            </div>
          </div>
        </div>
      ) : error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-400 font-medium">{t.errors.title}</span>
          </div>
          <p className="text-red-300 mt-2">{error.kind === "message" ? error.message : t.errors[error.kind]}</p>
        </div>
      )}

      {isLoadingData ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-center">
            <p className="text-lg font-medium text-white mb-2">
              {t.loadingTitle}
            </p>
            <p className="text-sm text-slate-400">
              {t.loadingHint}
            </p>
          </div>
        </div>
      ) : !mounted || !selectedProperty ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{t.selectProperty}</h2>
          <p className="text-slate-400">
            {t.selectPropertyHint}
          </p>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title={t.stats.directories}
              value={directoryStats.directories.length}
            />
            <StatCard
              title={t.stats.totalClicks}
              value={totals.clicks}
            />
            <StatCard
              title={t.stats.totalImpressions}
              value={totals.impressions}
            />
            <StatCard
              title={t.stats.avgPosition}
              value={totals.position}
              format="position"
            />
          </div>

          {/* Chart */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">{t.topDirectories}</h3>
            {chartData.length > 0 ? (
              <BarChart data={chartData} xKey="directory" yKey="clicks" height={400} horizontal />
            ) : (
              <div className="h-[400px] flex items-center justify-center text-slate-500">
                {t.noData}
              </div>
            )}
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Directory List */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white">{t.directories}</h3>
                <p className="text-sm text-slate-400">{t.clickDirectoryHint}</p>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {directoryStats.directories.map((dir) => (
                  <button
                    key={dir.path}
                    onClick={() => {
                      setSelectedDirectory(dir.path);
                      setViewMode("directories");
                    }}
                    className={`w-full px-4 py-3 text-left border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors ${
                      selectedDirectory === dir.path ? "bg-blue-600/20 border-l-4 border-l-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white truncate max-w-[70%]" title={dir.path}>
                        {dir.path}
                      </span>
                      <span className="text-blue-400 font-medium">
                        {dir.clicks.toLocaleString(intlLocale)}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-slate-400">
                      <span>{t.impressionsShort(dir.impressions.toLocaleString(intlLocale))}</span>
                      <span>{t.ctrValue((dir.ctr * 100).toFixed(1))}</span>
                      <span>{t.positionShort(dir.position.toFixed(1))}</span>
                      <span>{t.pagesCount(dir.pageCount)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail View */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              {selectedDir ? (
                <>
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white truncate" title={selectedDir.path}>
                      {selectedDir.path}
                    </h3>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="text-blue-400">{t.clicksCount(selectedDir.clicks.toLocaleString(intlLocale))}</span>
                      <span className="text-slate-400">{t.impressionsShort(selectedDir.impressions.toLocaleString(intlLocale))}</span>
                      <span className="text-slate-400">{t.ctrValue((selectedDir.ctr * 100).toFixed(2))}</span>
                    </div>

                    {/* View Toggle */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => setViewMode("directories")}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          viewMode === "directories"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:text-white"
                        }`}
                      >
                        {t.pagesTab(selectedDir.pageCount)}
                      </button>
                      <button
                        onClick={() => setViewMode("keywords")}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          viewMode === "keywords"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:text-white"
                        }`}
                      >
                        {t.keywordsTab(directoryKeywords.length)}
                      </button>
                    </div>

                    {/* Keyword Filters - only show in keywords mode */}
                    {viewMode === "keywords" && (
                      <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                        {/* Brand Filter */}
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={excludeBrand}
                              onChange={(e) => setExcludeBrand(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <span className="text-sm text-slate-300">{t.excludeBrand}</span>
                          </label>
                          <input
                            type="text"
                            value={brandFilter}
                            onChange={(e) => setBrandFilter(e.target.value)}
                            placeholder={t.brandPlaceholder}
                            disabled={!excludeBrand}
                            className="flex-1 px-3 py-1.5 text-sm bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          {t.keywordFilterHint}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {viewMode === "directories" ? (
                      // Pages in this directory
                      <table className="w-full">
                        <thead className="bg-slate-700/50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">{t.columns.page}</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">{t.columns.clicks}</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">{t.columns.positionShort}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDir.pages.map((page, index) => (
                            <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="px-4 py-2">
                                <a
                                  href={page.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-400 hover:text-blue-300 truncate block max-w-[250px]"
                                  title={page.url}
                                >
                                  {new URL(page.url).pathname}
                                </a>
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-white">
                                {page.clicks.toLocaleString(intlLocale)}
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-slate-400">
                                {page.position.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      // Keywords
                      directoryKeywords.length === 0 ? (
                        <div className="p-6 text-center text-slate-400">
                          <p>{t.noKeywords}</p>
                        </div>
                      ) : (
                        <table className="w-full">
                          <thead className="bg-slate-700/50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">{t.columns.keyword}</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">{t.columns.clicks}</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">{t.columns.impressionsShort}</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">{t.columns.positionShort}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {directoryKeywords.slice(0, 100).map((kw, index) => (
                              <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                                <td className="px-4 py-2">
                                  <span className="text-sm text-white">{kw.keyword}</span>
                                </td>
                                <td className="px-4 py-2 text-right text-sm text-blue-400">
                                  {kw.clicks.toLocaleString(intlLocale)}
                                </td>
                                <td className="px-4 py-2 text-right text-sm text-slate-400">
                                  {kw.impressions.toLocaleString(intlLocale)}
                                </td>
                                <td className="px-4 py-2 text-right text-sm text-slate-400">
                                  {kw.position.toFixed(1)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[500px] text-slate-500">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <p>{t.selectDirectory}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full Directory Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">{t.allDirectories}</h3>
            </div>
            <DataTable
              data={directoryStats.directories.map((dir, index) => ({
                id: index,
                path: dir.path,
                clicks: dir.clicks,
                impressions: dir.impressions,
                ctr: dir.ctr,
                position: dir.position,
                pageCount: dir.pageCount,
              }))}
              keyField="id"
              columns={[
                {
                  key: "path",
                  header: t.columns.directory,
                  sortable: true,
                  render: (value) => (
                    <span className="font-medium text-white">{String(value)}</span>
                  ),
                },
                {
                  key: "clicks",
                  header: t.columns.clicks,
                  sortable: true,
                  render: (value) => (
                    <span className="text-blue-400">{Number(value).toLocaleString(intlLocale)}</span>
                  ),
                },
                {
                  key: "impressions",
                  header: t.columns.impressions,
                  sortable: true,
                  render: (value) => Number(value).toLocaleString(intlLocale),
                },
                {
                  key: "ctr",
                  header: t.columns.ctr,
                  sortable: true,
                  render: (value) => `${(Number(value) * 100).toFixed(2)}%`,
                },
                {
                  key: "position",
                  header: t.columns.avgPosition,
                  sortable: true,
                  render: (value) => Number(value).toFixed(1),
                },
                {
                  key: "pageCount",
                  header: t.columns.pages,
                  sortable: true,
                  render: (value) => Number(value).toLocaleString(intlLocale),
                },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
