"use client";

import { useState } from "react";
import { clock } from "@/lib/format";

/** Windows after the PB: values[1] = 12 months, [2] = 6 months, [3] = 6 weeks. */
const WINDOWS = [
  [3, "6 wk"],
  [2, "6 mo"],
  [1, "12 mo"],
] as const;

type Row = { label: string; values: (number | undefined)[] };

/**
 * PB as a ghost bar, the chosen window as a filled bar, scaled so the PB is 100 %
 * (speed for runs, watts for rides). Right: PB → now.
 */
export function RecordBars({
  rows,
  kind,
  color,
}: {
  rows: Row[];
  kind: "time" | "watts";
  color: string;
}) {
  const [w, setW] = useState<1 | 2 | 3>(3);
  const show = (v?: number) => (v === undefined ? "—" : kind === "time" ? clock(v) : `${v}`);
  return (
    <>
      <fieldset className="seg-ctl" style={{ margin: "0 0 10px" }} aria-label="Compare PB with">
        {WINDOWS.map(([i, label]) => (
          <button key={label} type="button" aria-pressed={w === i} onClick={() => setW(i)}>
            {label}
          </button>
        ))}
      </fieldset>
      <ul className="recs">
        {rows.map((r) => {
          const pb = r.values[0];
          const now = r.values[w];
          // Share of PB level: speed for times (pb / now), power for watts (now / pb).
          const share = pb && now ? (kind === "time" ? pb / now : now / pb) : 0;
          return (
            <li key={r.label}>
              <span className="rec-l">{r.label}</span>
              <span className="rec-bar" aria-hidden="true">
                <i className="ghost" />
                {share > 0 && (
                  <i style={{ width: `${Math.min(100, share * 100)}%`, background: color }} />
                )}
              </span>
              <span className="rec-v num">
                {show(pb)}
                {pb && <small> → {show(now)}</small>}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
