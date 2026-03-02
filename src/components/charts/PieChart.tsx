"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface PieChartProps {
  data: Array<{ name: string; value: number }>;
  height?: number;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const COMPACT_BREAKPOINT = 380;

export function PieChart({ data, height = 300 }: PieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  const checkSize = useCallback(() => {
    if (containerRef.current) {
      setCompact(containerRef.current.clientWidth < COMPACT_BREAKPOINT);
    }
  }, []);

  useEffect(() => {
    checkSize();
    const ro = new ResizeObserver(checkSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [checkSize]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const dataWithPercent = data.map((item) => ({
    ...item,
    percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0",
  }));

  const innerRadius = compact ? 40 : 60;
  const outerRadius = compact ? 70 : 100;
  const chartHeight = compact ? height + 80 : height;

  return (
    <div ref={containerRef}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <RechartsPieChart>
          <Pie
            data={dataWithPercent}
            cx="50%"
            cy={compact ? "40%" : "50%"}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {dataWithPercent.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0].payload as { name: string; value: number; percent: string };
                return (
                  <div
                    style={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      color: "#f1f5f9",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 500 }}>{data.name}</p>
                    <p style={{ margin: "4px 0 0 0", color: "#ffffff" }}>
                      {data.value.toLocaleString("de-DE")} ({data.percent}%)
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            formatter={(value, entry) => {
              const payload = entry.payload as { percent?: string; value?: number } | undefined;
              const percent = payload?.percent || "0";
              const val = payload?.value || 0;
              return (
                <span style={{ color: "#f1f5f9", fontSize: compact ? 12 : 14 }}>
                  {value}: {val.toLocaleString("de-DE")} ({percent}%)
                </span>
              );
            }}
            layout={compact ? "horizontal" : "vertical"}
            align={compact ? "center" : "right"}
            verticalAlign={compact ? "bottom" : "middle"}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

