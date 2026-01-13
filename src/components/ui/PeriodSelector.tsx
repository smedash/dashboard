"use client";

interface PeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const periods = [
  { value: "7d", label: "7 Tage" },
  { value: "28d", label: "28 Tage" },
  { value: "3m", label: "3 Monate" },
  { value: "6m", label: "6 Monate" },
  { value: "12m", label: "12 Monate" },
];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex gap-1 p-1 bg-slate-700/50 rounded-lg">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
            value === period.value
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-600"
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}


