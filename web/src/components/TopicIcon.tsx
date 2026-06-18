const GLYPH: Record<string, string> = {
  hash: "12",
  plusminus: "+−",
  timesdiv: "×÷",
  pie: "½",
  decimal: "·5",
  percent: "%",
  dollar: "$",
  ruler: "cm",
  ratio: "a:b",
  algebra: "x",
  bulb: "?",
};

/** Small monochrome topic glyph. Text for most; a couple of simple SVGs. */
export function TopicIcon({ name }: { name: string | null }) {
  const stroke = "var(--green-deep)";
  if (name === "clock")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" strokeLinecap="round" />
      </svg>
    );
  if (name === "shapes")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden="true">
        <path d="M12 3l9 16H3z" strokeLinejoin="round" />
      </svg>
    );
  if (name === "chart")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden="true">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
      </svg>
    );
  return (
    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1rem", color: stroke }}>
      {GLYPH[name ?? ""] ?? "•"}
    </span>
  );
}
