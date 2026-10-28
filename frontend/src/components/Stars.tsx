export function Stars({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={`Rated ${value.toFixed(1)} out of 5${count !== undefined ? ` from ${count} reviews` : ''}`}>
      <span className="relative inline-block leading-none" style={{ fontSize: size, letterSpacing: 2 }} aria-hidden>
        <span className="text-line">★★★★★</span>
        <span className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-brass" style={{ width: `${pct}%` }}>★★★★★</span>
      </span>
      {count !== undefined && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}
