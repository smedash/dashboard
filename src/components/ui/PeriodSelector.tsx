"use client";

import { useMessages } from "@/i18n/I18nProvider";
import { uiMessages } from "@/i18n/messages/ui";

interface PeriodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const periods = ["7d", "28d", "3m", "6m", "8m"] as const;

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const t = useMessages(uiMessages);

  return (
    <div className="flex gap-1 p-1 bg-slate-700/50 rounded-lg">
      {periods.map((period) => (
        <button
          key={period}
          onClick={() => onChange(period)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
            value === period
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-600"
          }`}
        >
          {t.periods[period]}
        </button>
      ))}
    </div>
  );
}

