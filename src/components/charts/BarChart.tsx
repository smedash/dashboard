"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BarChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  horizontal?: boolean;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

export function BarChart({
  data,
  xKey,
  yKey,
  color,
  height = 300,
  horizontal = false,
}: BarChartProps) {
  if (horizontal) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickLine={{ stroke: "#475569" }}
          />
          <YAxis
            type="category"
            dataKey={xKey}
            stroke="#94a3b8"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickLine={{ stroke: "#475569" }}
            width={90}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length > 0) {
                const value = payload[0].value as number;
                return (
                  <div
                    style={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      padding: "8px 12px",
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 500, color: "#f1f5f9" }}>{label}</p>
                    <p style={{ margin: "4px 0 0 0", color: "#ffffff" }}>
                      Anzahl: {value.toLocaleString("de-DE")}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey={yKey} radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={color || COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke="#94a3b8"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          tickLine={{ stroke: "#475569" }}
        />
        <YAxis
          stroke="#94a3b8"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          tickLine={{ stroke: "#475569" }}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length > 0) {
              const value = payload[0].value as number;
              return (
                <div
                  style={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "8px 12px",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 500, color: "#f1f5f9" }}>{label}</p>
                  <p style={{ margin: "4px 0 0 0", color: "#ffffff" }}>
                    Anzahl: {value.toLocaleString("de-DE")}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={color || COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

