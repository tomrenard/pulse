"use client";

import { useState } from "react";
import { clock } from "@/lib/format";
import { type Anchor, raceDayVdot, timeAt } from "@/lib/potential";

const DISTANCES = [
  [5000, "5 km"],
  [10000, "10 km"],
  [21097.5, "Half"],
  [42195, "Marathon"],
] as const;

/**
 * Running potential per distance on one time axis: PB (white tick), now (teal band, ±5 %: from
 * easy-run heart rate), race day (green band, ±6 %) for the chosen weekly km, COROS (grey dot).
 */
export function Potential({
  now,
  pbTimes,
  coros,
  anchor,
  weeklyKm,
  weeks,
  race,
}: {
  now?: number;
  pbTimes: (number | undefined)[];
  coros?: (number | undefined)[];
  anchor?: Anchor;
  weeklyKm: number;
  weeks: number;
  race?: { label: string; metres?: number };
}) {
  const [km, setKm] = useState(Math.max(20, Math.round(weeklyKm / 5) * 5));
  if (!now || !anchor)
    return <p className="caption">Needs a few runs with heart rate in the last 30 days.</p>;
  const day = raceDayVdot(now, km, anchor, weeks);
  const target = race?.metres ? timeAt(day, race.metres) : undefined;
  return (
    <>
      {target && race && (
        <div className="potential-hero num">
          <b>
            {clock(target * 0.94)}–{clock(target * 1.06)}
          </b>
          <span>
            {race.label} on race day at {km} km/week
          </span>
        </div>
      )}
      <label className="slider">
        <span>
          Running <b className="num">{km} km/week</b> until race day
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={km}
          onChange={(e) => setKm(Number(e.target.value))}
        />
      </label>
      <ul className="ladder">
        {DISTANCES.map(([d, label], i) => {
          const pb = pbTimes[i];
          const n = timeAt(now, d);
          const r = timeAt(day, d);
          const c = coros?.[i];
          const values = [
            n * 0.95,
            n * 1.05,
            r * 0.94,
            r * 1.06,
            ...(pb ? [pb] : []),
            ...(c ? [c] : []),
          ];
          const lo = Math.min(...values) * 0.98;
          const hi = Math.max(...values) * 1.02;
          // Faster = further right: the bar reads like a speed scale.
          const x = (t: number) => `${(((hi - t) / (hi - lo)) * 100).toFixed(1)}%`;
          const band = (t: number, pct: number) => ({
            left: x(t * (1 + pct)),
            width: `calc(${x(t * (1 - pct))} - ${x(t * (1 + pct))})`,
          });
          return (
            <li key={label}>
              <span className="lad-l">{label}</span>
              <span className="lad-track" aria-hidden="true">
                <i className="lad-band now" style={band(n, 0.05)} />
                <i className="lad-band day" style={band(r, 0.06)} />
                {pb && <i className="lad-pb" style={{ left: x(pb) }} />}
                {c && <i className="lad-coros" style={{ left: x(c) }} />}
              </span>
              <span className="lad-v num">{clock(r)}</span>
              <span className="sr">
                {label}: now about {clock(n)}, race day about {clock(r)}
                {pb ? `, PB ${clock(pb)}` : ""}
                {c ? `, COROS ${clock(c)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="lad-legend" aria-hidden="true">
        <span>
          <i className="lad-band now" /> now
        </span>
        <span>
          <i className="lad-band day" /> race day
        </span>
        <span>
          <i className="lad-pb" /> PB
        </span>
        <span>
          <i className="lad-coros" /> COROS
        </span>
      </div>
    </>
  );
}
