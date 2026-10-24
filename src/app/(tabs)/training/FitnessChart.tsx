"use client";

import { useState } from "react";
import { shortDate } from "@/lib/date";
import { FORM_ZONES, formPct, formZone } from "@/lib/outlook";

type Day = { date: string; ctl: number; atl: number; tsb: number };

// Form panel range, in % of fitness.
const FORM_TOP = 40;
const FORM_BOTTOM = -50;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A round step giving 3–4 gridlines up to `max`. */
const stepFor = (max: number) => [5, 10, 20, 25, 50, 100].find((s) => max / s <= 4) ?? 100;

/**
 * intervals.icu-style fitness chart: fitness (filled) and fatigue on a labelled scale, form
 * underneath over its zones, months along the bottom. Touch or hover to read any day.
 */
export function FitnessChart({ days }: { days: Day[] }) {
  const [at, setAt] = useState<number>();
  if (days.length < 2) return null;
  const n = days.length;
  const x = (i: number) => (i / (n - 1)) * 300;
  // Scaled to fitness: one huge day (an ultra) would flatten everything else, so fatigue
  // above 1.8× the fitness peak runs off the top.
  const peak = Math.min(
    Math.max(...days.map((d) => Math.max(d.ctl, d.atl))),
    1.8 * Math.max(...days.map((d) => d.ctl)),
  );
  const step = stepFor(peak);
  const top = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, k) => k * step);
  const y = (v: number) => 100 - (v / top) * 100;
  const fy = (pct: number) =>
    ((FORM_TOP - Math.max(FORM_BOTTOM, Math.min(FORM_TOP, pct))) / (FORM_TOP - FORM_BOTTOM)) * 100;
  // Each zone's band in the form panel, top and bottom in %.
  const bands = FORM_ZONES.map((z, k) => ({
    ...z,
    top: fy(FORM_ZONES[k - 1]?.min ?? FORM_TOP),
    bottom: fy(z.min),
  }));
  const line = (f: (d: Day) => number) =>
    days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${f(d).toFixed(1)}`).join("");
  const fitness = line((d) => y(d.ctl));
  const months = days.flatMap((d, i) =>
    d.date.endsWith("-01") ? [{ i, label: MONTHS[Number(d.date.slice(5, 7)) - 1] }] : [],
  );
  const d = days[at ?? n - 1] as Day;
  const pct = formPct(d);
  const zone = formZone(pct);
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAt(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (n - 1)));
  };
  const cursor = at !== undefined && (
    <i className="fit-cursor" style={{ left: `${(at / (n - 1)) * 100}%` }} />
  );

  return (
    <figure className="fit">
      <div className="fit-read num" aria-live="polite">
        <span className="fit-date">{at === undefined ? "Today" : shortDate(d.date)}</span>
        <span>
          <i style={{ background: "var(--form)" }} />
          Fitness <b>{Math.round(d.ctl)}</b>
        </span>
        <span>
          <i style={{ background: "var(--rhr)" }} />
          Fatigue <b>{Math.round(d.atl)}</b>
        </span>
        <span>
          <i style={{ background: zone.color }} />
          Form{" "}
          <b>
            {Math.round(d.tsb)} · {Math.round(pct)}%
          </b>{" "}
          {zone.name}
        </span>
      </div>
      <div
        className="fit-plot"
        onPointerDown={pick}
        onPointerMove={pick}
        onPointerLeave={() => setAt(undefined)}
        role="img"
        aria-label={`Fitness ${Math.round(days[0]?.ctl ?? 0)} to ${Math.round(d.ctl)} over ${n} days, form ${zone.name.toLowerCase()} today`}
      >
        <div className="fit-panel">
          <svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true" className="clip">
            {ticks.map((t) => (
              <line key={t} x1={0} x2={300} y1={y(t)} y2={y(t)} className="fit-grid" />
            ))}
            <path d={`${fitness}L300 100L0 100Z`} fill="var(--form)" fillOpacity={0.18} />
            <path d={fitness} className="fit-line" stroke="var(--form)" strokeWidth={2.2} />
            <path
              d={line((d) => y(d.atl))}
              className="fit-line"
              stroke="var(--rhr)"
              strokeOpacity={0.8}
              strokeWidth={1.2}
            />
          </svg>
          {ticks.slice(1).map((t) => (
            <span key={t} className="fit-tick num" style={{ top: `${y(t)}%` }}>
              {t}
            </span>
          ))}
          {cursor}
        </div>
        <div className="fit-panel form">
          <svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
            {bands.map((b) => (
              <rect
                key={b.name}
                x={0}
                width={300}
                y={b.top}
                height={b.bottom - b.top}
                fill={b.color}
                fillOpacity={0.14}
              />
            ))}
            <line x1={0} x2={300} y1={fy(0)} y2={fy(0)} className="fit-grid" />
            <path
              d={line((d) => fy(formPct(d)))}
              className="fit-line"
              stroke="#fff"
              strokeOpacity={0.85}
              strokeWidth={1.2}
            />
          </svg>
          {bands.map((b) => (
            <span
              key={b.name}
              className="fit-zone"
              style={{ top: `${(b.top + b.bottom) / 2}%`, color: b.color }}
            >
              {b.name}
            </span>
          ))}
          {cursor}
        </div>
      </div>
      <div className="fit-months" aria-hidden="true">
        {months.map((m) => (
          <span key={m.i} style={{ left: `${(m.i / (n - 1)) * 100}%` }}>
            {m.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
