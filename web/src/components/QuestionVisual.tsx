export interface Visual {
  type: string;
  params: Record<string, number | string>;
}

const GREEN = "#1d9e75";
const GREEN_DEEP = "#0e7a57";
const LINE = "#cbd5e1";
const EMPTY = "#eef2f0";

/**
 * Renders a parametric question visual as crisp, theme-matched SVG. Supported:
 *  - count        {n, shape?}            counting objects
 *  - number_line  {min, max, step, mark} a labelled number line with a marker
 *  - fraction_bar {parts, shaded}        a bar split into equal parts
 *  - array        {rows, cols}           a dot array (multiplication)
 * Returns null for an unknown/empty spec so it degrades to a text question.
 */
export function QuestionVisual({ visual }: { visual: Visual | null }) {
  if (!visual || !visual.type) return null;
  const p = visual.params ?? {};
  const num = (k: string, d = 0) => {
    const v = p[k];
    return typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || d : d;
  };

  let svg: React.ReactNode = null;

  if (visual.type === "count") {
    const n = Math.max(0, Math.min(20, Math.round(num("n"))));
    const perRow = Math.min(5, Math.max(1, n));
    const rows = Math.ceil(n / perRow);
    const gap = 54;
    const r = 18;
    const w = perRow * gap;
    const h = rows * gap;
    const dots = Array.from({ length: n }, (_, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      return (
        <circle key={i} cx={col * gap + gap / 2} cy={row * gap + gap / 2} r={r} fill={GREEN} />
      );
    });
    svg = (
      <svg viewBox={`0 0 ${w} ${h}`} width={Math.min(w, 280)} role="img" aria-label={`${n} objects`}>
        {dots}
      </svg>
    );
  } else if (visual.type === "number_line") {
    const min = num("min");
    const max = num("max", 10);
    const step = num("step", 1) || 1;
    const mark = num("mark");
    const W = 320;
    const padX = 18;
    const span = Math.max(1, max - min);
    const x = (v: number) => padX + ((v - min) / span) * (W - 2 * padX);
    const ticks: React.ReactNode[] = [];
    for (let v = min; v <= max + 1e-9; v += step) {
      ticks.push(
        <g key={v}>
          <line x1={x(v)} y1={28} x2={x(v)} y2={40} stroke={LINE} strokeWidth={2} />
          <text x={x(v)} y={58} textAnchor="middle" fontSize={12} fill="#6b7280" fontWeight={600}>
            {Number.isInteger(v) ? v : v.toFixed(1)}
          </text>
        </g>,
      );
    }
    svg = (
      <svg viewBox={`0 0 ${W} 72`} width="100%" style={{ maxWidth: W }} role="img" aria-label="number line">
        <line x1={padX} y1={34} x2={W - padX} y2={34} stroke="#9ca3af" strokeWidth={3} />
        {ticks}
        <g transform={`translate(${x(mark)}, 16)`}>
          <circle cx={0} cy={6} r={8} fill={GREEN} />
          <path d="M0 14 L-6 22 L6 22 Z" fill={GREEN} />
        </g>
      </svg>
    );
  } else if (visual.type === "fraction_bar") {
    const parts = Math.max(1, Math.min(12, Math.round(num("parts", 4))));
    const shaded = Math.max(0, Math.min(parts, Math.round(num("shaded"))));
    const W = 300;
    const H = 56;
    const seg = W / parts;
    const cells = Array.from({ length: parts }, (_, i) => (
      <rect
        key={i}
        x={i * seg}
        y={0}
        width={seg}
        height={H}
        fill={i < shaded ? GREEN : EMPTY}
        stroke={GREEN_DEEP}
        strokeWidth={2}
      />
    ));
    svg = (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }} role="img" aria-label={`${shaded} of ${parts} shaded`}>
        {cells}
      </svg>
    );
  } else if (visual.type === "array") {
    const rows = Math.max(1, Math.min(10, Math.round(num("rows", 3))));
    const cols = Math.max(1, Math.min(10, Math.round(num("cols", 4))));
    const gap = 30;
    const r = 9;
    const w = cols * gap;
    const h = rows * gap;
    const dots: React.ReactNode[] = [];
    for (let rI = 0; rI < rows; rI++)
      for (let c = 0; c < cols; c++)
        dots.push(
          <circle key={`${rI}-${c}`} cx={c * gap + gap / 2} cy={rI * gap + gap / 2} r={r} fill="#3b82f6" />,
        );
    svg = (
      <svg viewBox={`0 0 ${w} ${h}`} width={Math.min(w, 240)} role="img" aria-label={`${rows} by ${cols} array`}>
        {dots}
      </svg>
    );
  } else {
    return null;
  }

  return <div className="q-visual">{svg}</div>;
}
