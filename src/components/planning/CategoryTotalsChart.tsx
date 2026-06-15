"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

interface CategoryData {
  category: string;
  count: number;
  total: number;
  [key: string]: string | number;
}

interface ExtraMetric {
  key: string;
  label: string;
  color: string;
}

interface CategoryTotalsChartProps {
  data: CategoryData[];
  countLabel: string;
  totalLabel: string;
  extraMetrics?: ExtraMetric[];
  emptyMessage?: string;
}

export default function CategoryTotalsChart({
  data,
  countLabel,
  totalLabel,
  extraMetrics,
  emptyMessage = "Noch keine Kategorie-Daten vorhanden",
}: CategoryTotalsChartProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b.total - a.total),
    [data]
  );

  if (sorted.length === 0) {
    return null;
  }

  const [expanded, setExpanded] = useState(false);

  const grandTotal = sorted.reduce((s, d) => s + d.total, 0);
  const grandCount = sorted.reduce((s, d) => s + d.count, 0);
  const hasExtras = extraMetrics && extraMetrics.length > 0;
  const barHeight = Math.max(200, sorted.length * (hasExtras ? 52 : 44));

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-700/20 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-300">
            Totals nach Kategorie
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>
            {grandCount.toLocaleString("de-DE")} {countLabel}
          </span>
          <span className="text-slate-600">|</span>
          <span>
            {grandTotal.toLocaleString("de-DE")} {totalLabel}
          </span>
          {hasExtras &&
            extraMetrics.map((m) => {
              const sum = sorted.reduce((s, d) => s + ((d[m.key] as number) || 0), 0);
              return (
                <span key={m.key}>
                  <span className="text-slate-600 mr-4">|</span>
                  <span style={{ color: m.color }}>
                    {sum.toLocaleString("de-DE")} {m.label}
                  </span>
                </span>
              );
            })}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {sorted.map((item, i) => (
              <div
                key={item.category}
                className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-xs font-medium text-slate-400 truncate">
                    {item.category}
                  </span>
                </div>
                <p className="text-lg font-bold text-white">
                  {item.total.toLocaleString("de-DE")}
                </p>
                <p className="text-[10px] text-slate-500">
                  {item.count} {countLabel}
                </p>
                {hasExtras && (
                  <div className="flex items-center gap-2 mt-1.5">
                    {extraMetrics.map((m) => (
                      <span
                        key={m.key}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          color: m.color,
                          backgroundColor: m.color + "18",
                        }}
                      >
                        {((item[m.key] as number) || 0).toLocaleString("de-DE")} {m.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {sorted.length > 0 ? (
            <ResponsiveContainer width="100%" height={barHeight}>
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ left: 20, right: 20, top: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={140}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const d = payload[0].payload as CategoryData;
                      return (
                        <div
                          style={{
                            backgroundColor: "#1e293b",
                            border: "1px solid #334155",
                            borderRadius: "8px",
                            padding: "8px 12px",
                          }}
                        >
                          <p
                            style={{
                              margin: 0,
                              fontWeight: 600,
                              color: "#f1f5f9",
                            }}
                          >
                            {d.category}
                          </p>
                          <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: 12 }}>
                            {d.count} {countLabel} &middot;{" "}
                            {d.total.toLocaleString("de-DE")} {totalLabel}
                          </p>
                          {hasExtras &&
                            extraMetrics.map((m) => (
                              <p
                                key={m.key}
                                style={{ margin: "2px 0 0 0", fontSize: 12, color: m.color }}
                              >
                                {((d[m.key] as number) || 0).toLocaleString("de-DE")} {m.label}
                              </p>
                            ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {hasExtras ? (
                  <>
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
                      formatter={(value: string) => (
                        <span style={{ color: "#cbd5e1", fontSize: 11 }}>{value}</span>
                      )}
                    />
                    {extraMetrics.map((m) => (
                      <Bar
                        key={m.key}
                        dataKey={m.key}
                        name={m.label}
                        fill={m.color}
                        radius={[0, 6, 6, 0]}
                        stackId="gsc"
                      />
                    ))}
                  </>
                ) : (
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {sorted.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">
              {emptyMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
