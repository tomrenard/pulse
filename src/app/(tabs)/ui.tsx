/** Building blocks shared by the tabs. */

export { hm } from "@/lib/format";

/** A Weather-style module: small uppercase header, then content. */
export function Module({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mod ${className}`} aria-label={title}>
      <div className="mod-h">{title}</div>
      {children}
    </section>
  );
}

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
