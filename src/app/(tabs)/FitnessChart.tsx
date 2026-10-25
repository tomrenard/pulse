"use client";

import { useId, useState } from "react";
import { shortDate } from "@/lib/date";
import { type Day, FORM_ZONES, formPct, formZone } from "@/lib/outlook";

// Form panel range, in % of fitness.
const FORM_TOP = 40;
const FORM_BOTTOM = -50;

/** A round step giving 3–4 gridlines up to `max` (up to 5 with the headroom). */
const stepFor = (max: number) => [5, 10, 20, 25, 50, 100].find((s) => max / s <= 4) ?? 100;

/**
 * intervals.icu-style fitness chart: fitness (filled) and fatigue on a labelled scale, form
 * underneath over its zones, months along the bottom. Touch or hover to read any day.
 */
export function FitnessChart({
  days,
  endLabel = "Today",
  race,
}: {
  days: Day[];
  /** What the last day is called before you touch the chart ("Today", "In 8 weeks"). */
  endLabel?: string;
  /** A race day to mark, with its form target band in % when known. */
  race?: { date: string; target?: { low: number; high: number } };
}) {
  const [at, setAt] = useState<number>();
  const gradId = useId();
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
  // 10% headroom, so the peak never touches the top edge.
  const top = Math.max(step, Math.ceil((peak * 1.1) / step) * step);
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
  // Form split in two paths: solid where it is on the scale, dashed where it runs off it (a
  // flat edge would otherwise read as a real value). A step touching the scale stays solid.
  const off = days.map((d) => {
    const p = formPct(d);
    return p > FORM_TOP || p < FORM_BOTTOM;
  });
  const pt = (i: number) => `${x(i).toFixed(1)} ${fy(formPct(days[i] as Day)).toFixed(1)}`;
  const isOff = (i: number) => Boolean(off[i - 1] && off[i]);
  // One sub-path per run, since a dash pattern restarts at every M.
  const formPath = (dashed: boolean) =>
    days
      .map((_, i) => {
        if (!i || isOff(i) !== dashed) return "";
        const start = i === 1 || isOff(i - 1) !== dashed ? `M${pt(i - 1)}` : "";
        return `${start}L${pt(i)}`;
      })
      .join("");
  const raceAt = race ? days.findIndex((d) => d.date === race.date) : -1;
  const months = days.flatMap((d, i) =>
    d.date.endsWith("-01")
      ? [
          {
            i,
            label: new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", {
              month: "short",
              timeZone: "UTC",
            }),
          },
        ]
      : [],
  );
  const last = days[n - 1] as Day;
  const sel = days[at ?? n - 1] ?? last;
  const pct = formPct(sel);
  const zone = formZone(pct);
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    // The panel, not the plot: the tick labels sit in a gutter to its right.
    const r = (e.currentTarget.firstElementChild as HTMLElement).getBoundingClientRect();
    setAt(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (n - 1)));
  };
  const cursor = at !== undefined && (
    <i className="fit-cursor" style={{ left: `${(at / (n - 1)) * 100}%` }} />
  );

  return (
    <figure className="fit">
      {/* Fixed grid: values changing width never reflow it, so the plot below stays put. */}
      <div className="fit-read num">
        <span className="fit-date">
          {at === undefined ? endLabel : shortDate(sel.date)}
          <span style={{ color: zone.color }}>{zone.name}</span>
        </span>
        <span>
          <i style={{ background: "var(--form)" }} />
          Fitness
          <b>{Math.round(sel.ctl)}</b>
        </span>
        <span>
          <i style={{ background: "var(--rhr)" }} />
          Fatigue
          <b>{Math.round(sel.atl)}</b>
        </span>
        <span>
          <i style={{ background: zone.color }} />
          Form
          <b>
            {Math.round(sel.tsb)} · {Math.round(pct)}%
          </b>
        </span>
      </div>
      <div
        className="fit-plot"
        onPointerDown={pick}
        onPointerMove={pick}
        // Back to the last day when the mouse leaves or the finger lifts (touch fires leave after up).
        onPointerLeave={() => setAt(undefined)}
        role="img"
        aria-label={`Fitness ${Math.round(days[0]?.ctl ?? 0)} to ${Math.round(last.ctl)} over ${n} days, form ${formZone(formPct(last)).name.toLowerCase()} at the end`}
      >
        <div className="fit-panel">
          <svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
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
          {raceAt >= 0 && (
            <span
              // Near the right edge the label sits left of the marker, clear of the ticks.
              className={`fit-race${raceAt / (n - 1) > 0.85 ? " flip" : ""}`}
              style={{ left: `${(raceAt / (n - 1)) * 100}%` }}
            >
              Race
            </span>
          )}
          {cursor}
        </div>
        <div className="fit-panel form">
          <svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
            {/* Hard stops at the zone edges, so the form line takes its zone's colour. */}
            <defs>
              <linearGradient
                id={gradId}
                gradientUnits="userSpaceOnUse"
                x1={0}
                y1={0}
                x2={0}
                y2={100}
              >
                {bands.flatMap((b) => [
                  <stop key={`${b.name}t`} offset={`${b.top}%`} style={{ stopColor: b.color }} />,
                  <stop
                    key={`${b.name}b`}
                    offset={`${b.bottom}%`}
                    style={{ stopColor: b.color }}
                  />,
                ])}
              </linearGradient>
            </defs>
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
            {raceAt >= 0 && (
              <line
                x1={x(raceAt)}
                x2={x(raceAt)}
                y1={0}
                y2={100}
                className="fit-grid"
                strokeDasharray="3 3"
              />
            )}
            {raceAt >= 0 && race?.target && (
              <rect
                x={x(raceAt) - 4}
                width={8}
                y={fy(race.target.high)}
                height={fy(race.target.low) - fy(race.target.high)}
                fill="#fff"
                fillOpacity={0.35}
              />
            )}
            <path
              d={formPath(false)}
              className="fit-line"
              stroke={`url(#${gradId})`}
              strokeWidth={1.5}
            />
            <path
              d={formPath(true)}
              className="fit-line"
              stroke={`url(#${gradId})`}
              strokeWidth={1.5}
              strokeDasharray="2 3"
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
