interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  format?: "number" | "percentage" | "position";
  icon?: React.ReactNode;
}

export function StatCard({ title, value, change, format = "number", icon }: StatCardProps) {
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

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold text-white">
          {formatValue(value)}
        </span>
        {change !== undefined && (
          <span
            className={`text-sm font-medium px-2 py-1 rounded-md ${
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

