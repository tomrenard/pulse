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
}: {
  title: string;
  value?: React.ReactNode;
  info?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mod" aria-label={title}>
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
      <span aria-hidden="true">{r > 0 ? "▲" : "▼"}</span>
      {Math.abs(r)}
      {unit}
      <span className="sr">
        {" "}
        {r > 0 ? "above" : "below"} normal, {better ? "better" : "worse"}
      </span>
    </span>
  );
}

/** A state dot: go / mid / stop. */
export const Dot = ({ state }: { state: "go" | "mid" | "stop" }) => (
  <span className={`state-dot ${state}`}>
    <span className="sr">{state === "go" ? "in range" : state === "mid" ? "watch" : "off"}</span>
  </span>
);

/** A 24 × 24 line icon in the current colour (tab bar, signals, activities, badges). */
export const Glyph = ({ children, width = 1.8 }: { children: React.ReactNode; width?: number }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);
