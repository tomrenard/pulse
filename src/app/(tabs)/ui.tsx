/** Building blocks shared by the tabs. */
import { Info } from "./Info";

export { hm } from "@/lib/format";

/**
 * A Weather-style module: small uppercase header (optional value on the right, optional ⓘ with
 * the explanation), then content. No paragraphs inside: they go in `info`.
 */
export function Module({
  title,
  value,
  info,
  children,
  className = "",
}: {
  title: string;
  value?: React.ReactNode;
  info?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mod ${className}`} aria-label={title}>
      <div className="mod-h">
        <span>{title}</span>
        {value !== undefined && <span className="mod-v num">{value}</span>}
        {info && <Info title={title}>{info}</Info>}
      </div>
      {children}
    </section>
  );
}

/** ▲3 / ▼3 against a reference, tinted by whether that direction is good for this metric. */
export function Delta({ v, good, unit = "" }: { v?: number; good: "up" | "down"; unit?: string }) {
  if (v === undefined || !Number.isFinite(v)) return null;
  const r = Math.round(v);
  if (r === 0) return <span className="delta">—</span>;
  const better = good === "up" ? r > 0 : r < 0;
  return (
    <span className={`delta ${better ? "better" : "worse"}`}>
      {r > 0 ? "▲" : "▼"}
      {Math.abs(r)}
      {unit}
    </span>
  );
}

/** A state dot: go / mid / stop. */
export const Dot = ({ state }: { state: "go" | "mid" | "stop" }) => (
  <span className={`state-dot ${state}`}>
    <span className="sr">{state === "go" ? "in range" : state === "mid" ? "watch" : "off"}</span>
  </span>
);

/** A thin bar with a dot at `value` between min and max. */
export function Gauge({
  value,
  min,
  max,
  color,
}: {
  value: number;
  min: number;
  max: number;
  color: string;
}) {
  const pos = `${(((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100).toFixed(1)}%`;
  return (
    <div className="gbar" style={{ background: color }}>
      <span className="dot" style={{ left: pos }} />
    </div>
  );
}
