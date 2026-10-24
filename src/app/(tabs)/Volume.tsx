"use client";

import Link from "next/link";
import { useState } from "react";
import { SPORTS, type Sport, type Totals } from "@/lib/volume";

const COLOR: Record<Sport, string> = {
  ride: "var(--form)",
  run: "var(--go)",
  swim: "var(--hrv)",
  other: "rgba(255,255,255,.45)",
};
const MEASURES = [
  ["hours", "Time"],
  ["km", "Distance"],
  ["load", "Load"],
] as const;
type Measure = (typeof MEASURES)[number][0];

const fmt = (m: Measure, v: number) =>
  m === "hours"
    ? `${Math.floor(v)}h${String(Math.round((v % 1) * 60)).padStart(2, "0")}`
    : m === "km"
      ? `${v < 10 ? v.toFixed(1) : Math.round(v)} km`
      : `${Math.round(v)}`;

/** Strava-style weekly bars, stacked by sport, with this week's split underneath. */
export function Volume({ weeks }: { weeks: { monday: string; sports: Totals }[] }) {
  const [measure, setMeasure] = useState<Measure>("hours");
  const total = (s: Totals, m: Measure) => SPORTS.reduce((sum, sp) => sum + s[sp][m], 0);
  const max = Math.max(1e-9, ...weeks.map((w) => total(w.sports, measure)));
  const now = weeks.at(-1)?.sports;
  const H = 70;
  const slot = 300 / weeks.length;
  return (
    <section className="mod" aria-label="Weekly volume">
      <div className="mod-h">
        This week
        <fieldset className="seg-ctl" aria-label="Measure">
          {MEASURES.map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={measure === m}
              onClick={() => setMeasure(m)}
            >
              {label}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="mod-b">
        <div className="big-num num">
          {now ? fmt("hours", total(now, "hours")) : "–"}
          <small> · {now ? fmt("km", total(now, "km")) : ""}</small>
        </div>
        <Link
          href="/training"
          className="chart"
          aria-label="Weekly volume, last 12 weeks; open Training"
        >
          <svg
            viewBox={`0 0 300 ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-hidden="true"
            style={{ height: H }}
          >
            {weeks.map((w, i) => {
              let y = H;
              return SPORTS.map((sp) => {
                const h = (w.sports[sp][measure] / max) * (H - 4);
                if (h <= 0) return null;
                y -= h;
                return (
                  <rect
                    key={`${w.monday}-${sp}`}
                    x={i * slot + slot * 0.18}
                    width={slot * 0.64}
                    y={y}
                    height={h}
                    fill={COLOR[sp]}
                    fillOpacity={i === weeks.length - 1 ? 1 : 0.55}
                  />
                );
              });
            })}
          </svg>
          <div className="axis">
            <span>12 weeks ago</span>
            <span>max {fmt(measure, max)}</span>
            <span>this week</span>
          </div>
        </Link>
        <div className="split num">
          {SPORTS.filter((sp) => now && now[sp].hours > 0).map((sp) => (
            <span key={sp}>
              <i style={{ background: COLOR[sp] }} />
              <b>{sp}</b> {fmt("hours", now?.[sp].hours ?? 0)}
              {sp !== "other" && now ? ` · ${fmt("km", now[sp].km)}` : ""}
            </span>
          ))}
          {now && total(now, "hours") === 0 && <span className="dim">Nothing yet this week.</span>}
        </div>
      </div>
    </section>
  );
}
