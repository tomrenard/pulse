/** Hand-drawn SVG charts: a line with an optional normal band, and bars with a target line. */

type Point = { date: string; value: number };

const W = 300;
const H = 90;

const short = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

function scale(values: number[], pad: number) {
  const lo = Math.min(...values) - pad;
  const hi = Math.max(...values) + pad;
  return (v: number) => H - ((v - lo) / (hi - lo || 1)) * H;
}

function Axis({ points }: { points: Point[] }) {
  return (
    <div className="axis">
      <span>{short((points[0] as Point).date)}</span>
      <span>{short((points.at(-1) as Point).date)}</span>
    </div>
  );
}

export function Line({
  points,
  color,
  band,
  label,
  unit,
}: {
  points: Point[];
  color: string;
  band?: { low: number; high: number };
  label: string;
  unit: string;
}) {
  if (points.length < 2) return <p className="dim">Not enough nights yet.</p>;
  const y = scale([...points.map((p) => p.value), ...(band ? [band.low, band.high] : [])], 2);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join("");
  const last = points.at(-1) as Point;
  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: last ${Math.round(last.value)} ${unit}${band ? `, normal ${Math.round(band.low)}–${Math.round(band.high)}` : ""}`}
      >
        {band && (
          <rect
            x={0}
            width={W}
            y={y(band.high)}
            height={y(band.low) - y(band.high)}
            fill="#fff"
            fillOpacity={0.1}
          />
        )}
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
      <span className="chart-dot" style={{ top: `${y(last.value)}px`, background: color }} />
      <Axis points={points} />
    </figure>
  );
}

export function Bars({
  points,
  color,
  target,
  label,
}: {
  points: Point[];
  color: string;
  target?: number;
  label: string;
}) {
  if (points.length < 2) return <p className="dim">Not enough nights yet.</p>;
  const max = Math.max(...points.map((p) => p.value), (target ?? 0) * 1.15, 1);
  const y = (v: number) => H - (v / max) * H;
  const slot = W / points.length;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={i * slot + slot * 0.15}
            width={slot * 0.7}
            y={y(p.value)}
            height={H - y(p.value)}
            rx={Math.min(3, slot * 0.3)}
            fill={color}
            fillOpacity={i === points.length - 1 ? 1 : 0.5}
          />
        ))}
        {target !== undefined && (
          <line
            x1={0}
            x2={W}
            y1={y(target)}
            y2={y(target)}
            stroke="rgba(255,255,255,.6)"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <Axis points={points} />
    </figure>
  );
}

/** Fitness (top) and form (bottom, around zero) over a projected period; optional race marker. */
export function Forecast({
  days,
  race,
}: {
  days: { date: string; ctl: number; tsb: number }[];
  race?: string;
}) {
  if (days.length < 2) return null;
  const x = (i: number) => (i / (days.length - 1)) * W;
  const ctlY = scale(
    days.map((d) => d.ctl),
    2,
  );
  const fitness = (i: number) => (ctlY(days[i]?.ctl ?? 0) / H) * 52;
  const maxTsb = Math.max(10, ...days.map((d) => Math.abs(d.tsb)));
  const form = (v: number) => 74 - (v / maxTsb) * 14;
  const path = (y: (i: number) => number) =>
    days.map((_, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(i).toFixed(1)}`).join("");
  const raceAt = race ? days.findIndex((d) => d.date === race) : -1;
  const last = days.at(-1) as (typeof days)[number];
  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Projected fitness ${Math.round(days[0]?.ctl ?? 0)} to ${Math.round(last.ctl)}, form ${Math.round(last.tsb)} at the end`}
      >
        <line
          x1={0}
          x2={W}
          y1={74}
          y2={74}
          stroke="rgba(255,255,255,.25)"
          vectorEffect="non-scaling-stroke"
        />
        {raceAt >= 0 && (
          <line
            x1={x(raceAt)}
            x2={x(raceAt)}
            y1={0}
            y2={H}
            stroke="var(--mid)"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={path(fitness)}
          fill="none"
          stroke="var(--form)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path((i) => form(days[i]?.tsb ?? 0))}
          fill="none"
          stroke="var(--go)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="axis">
        <span>{short(days[0]?.date ?? "")}</span>
        <span className="legend-inline">
          <i style={{ background: "var(--form)" }} /> fitness{" "}
          <i style={{ background: "var(--go)" }} /> form
        </span>
        <span>{short(last.date)}</span>
      </div>
    </figure>
  );
}
