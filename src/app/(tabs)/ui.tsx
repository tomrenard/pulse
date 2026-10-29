/** Building blocks shared by the tabs. */
import { SPORT_COLOR, type Sport } from "@/lib/volume";
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

const SPORT_GLYPH: Record<Sport, React.ReactNode> = {
  ride: (
    <>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16 9.5 9h5.5L18 16M9.5 9l3 7" />
    </>
  ),
  run: (
    <>
      <circle cx="14" cy="4.5" r="1.8" />
      <path d="M6 21l3.5-5 3 2 1-6 3 3h3M8 11l3-3h3" />
    </>
  ),
  swim: (
    <path d="M3 17c2 0 2-1.5 4.5-1.5S9.5 17 12 17s2-1.5 4.5-1.5S18.5 17 21 17M6 13l4-5 3 3 3-2" />
  ),
  other: <circle cx="12" cy="12" r="5" />,
};

/** The round sport icon in lists: activities, the plan. */
export const SportChip = ({ sport }: { sport: Sport }) => (
  <span className="sport-chip" style={{ background: SPORT_COLOR[sport] }} aria-hidden="true">
    <Glyph width={2}>{SPORT_GLYPH[sport]}</Glyph>
  </span>
);
