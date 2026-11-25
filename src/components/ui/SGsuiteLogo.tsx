const ACCENT = "#2563EB";

export function SGsuiteMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="6" y="14" width="22" height="22" rx="5" fill="currentColor" />
      <rect x="34" y="4" width="22" height="22" rx="5" fill={ACCENT} />
      <rect x="6" y="42" width="22" height="22" rx="5" fill="currentColor" />
      <rect x="34" y="42" width="22" height="22" rx="5" fill="currentColor" />
    </svg>
  );
}

export function SGsuiteWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-brand tracking-[-0.03em] leading-none ${className}`}>
      <span className="font-bold">SG</span>
      <span className="font-normal">suite</span>
    </span>
  );
}
