/** A small circular progress ring with a centered percentage. Pure SVG. */
export function ProgressRing({ pct, size = 58 }: { pct: number; size?: number }) {
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const done = (c * clamped) / 100;
  const color = clamped >= 100 ? "var(--green)" : clamped > 0 ? "var(--amber)" : "#cbd5e1";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8efeb" strokeWidth="7" />
      {clamped > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${done} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.27}
        fontWeight="800"
        fill="var(--green-deep)"
        fontFamily="var(--font-display)"
      >
        {clamped}%
      </text>
    </svg>
  );
}
