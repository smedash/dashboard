interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  subtitle?: string;
  trend?: "up" | "down";
  format?: "number" | "percentage" | "position";
  icon?: React.ReactNode;
}

export function StatCard({ title, value, change, subtitle, trend, format = "number", icon }: StatCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === "string") return val;
    
    switch (format) {
      case "percentage":
        return `${(val * 100).toFixed(2)}%`;
      case "position":
        return val.toFixed(1);
      default:
        return val.toLocaleString("de-DE");
    }
  };

  const formatChange = (val: number) => {
    const prefix = val > 0 ? "+" : "";
    return `${prefix}${val.toFixed(1)}%`;
  };

  const isPositiveChange = (val: number) => {
    // For position, lower is better
    if (format === "position") return val < 0;
    return val > 0;
  };

  const getTrendColor = () => {
    if (trend === "up") {
      return format === "position" ? "text-red-400" : "text-emerald-400";
    }
    if (trend === "down") {
      return format === "position" ? "text-emerald-400" : "text-red-400";
    }
    return "text-slate-400";
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <div className="flex flex-col">
        <span className="text-3xl font-bold text-white mb-1">
          {formatValue(value)}
        </span>
        {subtitle && (
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {subtitle}
          </span>
        )}
        {change !== undefined && !subtitle && (
          <span
            className={`text-sm font-medium px-2 py-1 rounded-md mt-2 inline-block w-fit ${
              isPositiveChange(change)
                ? "bg-emerald-500/20 text-emerald-400"
                : change === 0
                ? "bg-slate-600/50 text-slate-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {formatChange(change)}
          </span>
        )}
      </div>
    </div>
  );
}

