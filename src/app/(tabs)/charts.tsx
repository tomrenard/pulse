import { shortDate } from "@/lib/date";
import { hmm } from "@/lib/format";
import { Scrub } from "./Scrub";

/** Hand-drawn SVG charts: a line with an optional normal band, and bars with a target line. */

type Point = { date: string; value: number };

const W = 300;
const H = 90;

function scale(values: number[], pad: number) {
  const lo = Math.min(...values) - pad;
  const hi = Math.max(...values) + pad;
  return (v: number) => H - ((v - lo) / (hi - lo || 1)) * H;
}

/**
 * Values in a gutter right of the plot, each with a faint line across, so you can read the
 * chart's scale. Labels closer than a line height to one already shown are dropped.
 */
function Ticks({ ticks }: { ticks: { y: number; text: string; color?: string }[] }) {
  const shown: typeof ticks = [];
  for (const t of ticks) if (shown.every((s) => Math.abs(s.y - t.y) >= 12)) shown.push(t);
  return shown.map((t) => (
    <span key={t.y} className="chart-tick num" style={{ top: `${t.y}px`, color: t.color }}>
      {t.text}
    </span>
  ));
}

function Axis({ points, note }: { points: Point[]; note?: string }) {
  return (
    <div className="axis">
      <span>{shortDate((points[0] as Point).date)}</span>
      {note && <span>{note}</span>}
      <span>{shortDate((points.at(-1) as Point).date)}</span>
    </div>
  );
}

export function Line({
  points,
  color,
  band,
  label,
  unit,
  format = (v) => `${Math.round(v)}`,
}: {
  points: Point[];
  color: string;
  band?: { low: number; high: number };
  label: string;
  unit: string;
  /** How a value reads in the gutter (weight keeps its decimal). */
  format?: (v: number) => string;
}) {
  if (points.length < 2) return <p className="dim">Not enough nights yet.</p>;
  const y = scale([...points.map((p) => p.value), ...(band ? [band.low, band.high] : [])], 2);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join("");
  const last = points.at(-1) as Point;
  const values = points.map((p) => p.value);
  const ticks = [...new Set([Math.max(...values), Math.min(...values)])].map((v) => ({
    y: y(v),
    text: format(v),
  }));
  return (
    <figure className="chart">
      <Scrub
        dates={points.map((p) => p.date)}
        labels={points.map((p) => `${format(p.value)} ${unit}`)}
      >
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
          {ticks.map((t) => (
            <line key={t.y} x1={0} x2={W} y1={t.y} y2={t.y} className="chart-grid" />
          ))}
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
        {/* Today's value first, in the line's colour, so it wins a clash with max or min. */}
        <Ticks ticks={[{ y: y(last.value), text: format(last.value), color }, ...ticks]} />
      </Scrub>
      <Axis points={points} />
    </figure>
  );
}

export function Bars({
  points,
  color,
  target,
  label,
  unit = "",
  format = (v) => `${Math.round(v)}`,
}: {
  points: Point[];
  color: string;
  target?: number;
  label: string;
  unit?: string;
  /** How a value reads in the gutter (sleep seconds as h:mm). */
  format?: (v: number) => string;
}) {
  if (points.length < 2) return <p className="dim">Not enough nights yet.</p>;
  const max = Math.max(...points.map((p) => p.value), (target ?? 0) * 1.15, 1);
  const y = (v: number) => H - (v / max) * H;
  const slot = W / points.length;
  const top = Math.max(...points.map((p) => p.value));
  // The target first, so it wins when the best bar sits right on it.
  const ticks = [...(target !== undefined ? [target] : []), top].map((v) => ({
    y: y(v),
    text: format(v),
  }));
  const hit = target === undefined ? 0 : points.filter((p) => p.value >= target).length;
  return (
    <figure className="chart">
      <Scrub
        bars
        dates={points.map((p) => p.date)}
        labels={points.map((p) => `${format(p.value)}${unit && ` ${unit}`}`)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
          <line x1={0} x2={W} y1={y(top)} y2={y(top)} className="chart-grid" />
          {points.map((p, i) => (
            <rect
              key={p.date}
              x={i * slot + slot * 0.15}
              width={slot * 0.7}
              y={y(p.value)}
              height={H - y(p.value)}
              rx={Math.min(3, slot * 0.3)}
              fill={color}
              // Nights short of the target fade, so the hits stand out; the last bar stays full.
              fillOpacity={
                i === points.length - 1 ? 1 : target !== undefined && p.value < target ? 0.35 : 0.75
              }
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
        <Ticks ticks={ticks} />
      </Scrub>
      <Axis
        points={points}
        note={target === undefined ? undefined : `${hit}/${points.length} on target`}
      />
    </figure>
  );
}

export const ZONE_COLORS = [
  "#7f8c9a",
  "#5be3a0",
  "#c8e35b",
  "#f7c55a",
  "#ff9a5a",
  "#ff6a6a",
  "#c06aff",
];

/** Share of time per zone as one stacked bar with a legend. */
export function Zones({ secs, label }: { secs: number[]; label: string }) {
  const total = secs.reduce((s, x) => s + x, 0);
  if (!total) return null;
  const pct = secs.map((x) => Math.round((x / total) * 100));
  return (
    <div className="zones">
      <span className="dim">{label}</span>
      <div
        className="zone-bar"
        role="img"
        aria-label={`${label}: ${pct.map((p, i) => `Z${i + 1} ${p}%`).join(", ")}`}
      >
        {secs.map((x, i) =>
          x > 0 ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: zones are fixed positions
            <i key={i} style={{ flex: x, background: ZONE_COLORS[i] }}>
              {(pct[i] ?? 0) >= 18 ? `Z${i + 1} ${pct[i]}%` : (pct[i] ?? 0) >= 8 ? `Z${i + 1}` : ""}
            </i>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Power (smoothed) and heart rate over the activity, each on its own scale. */
export function StreamChart({
  secs,
  power,
  hr,
}: {
  secs: number[];
  power?: number[];
  hr?: number[];
}) {
  const end = secs.at(-1) ?? 0;
  if (end <= 0 || (!power?.length && !hr?.length)) return null;
  const x = (t: number) => (t / end) * W;
  const line = (values: number[], lo: number, hi: number) =>
    values
      .map(
        (v, i) =>
          `${i ? "L" : "M"}${x(secs[i] ?? 0).toFixed(1)} ${(H - ((v - lo) / (hi - lo || 1)) * (H - 6) - 3).toFixed(1)}`,
      )
      .join("");
  const range = (v: number[]) => [Math.min(...v), Math.max(...v)] as const;
  const avg = (v: number[]) => Math.round(v.reduce((s, n) => s + n, 0) / v.length);
  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Power${power?.length ? ` averaging ${avg(power)} W` : ""} and heart rate${hr?.length ? ` averaging ${avg(hr)} bpm` : ""} over the activity`}
      >
        {power?.length ? (
          <path
            d={line(power, 0, range(power)[1])}
            fill="none"
            stroke="var(--form)"
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {hr?.length ? (
          <path
            d={line(hr, range(hr)[0] - 5, range(hr)[1] + 5)}
            fill="none"
            stroke="var(--rhr)"
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <div className="axis">
        <span>0</span>
        <span className="legend-inline">
          {power?.length ? (
            <>
              <i style={{ background: "var(--form)" }} /> power
            </>
          ) : null}
          {hr?.length ? (
            <>
              <i style={{ background: "var(--rhr)" }} /> heart rate
            </>
          ) : null}
        </span>
        <span>{hmm(end)}</span>
      </div>
    </figure>
  );
}
