"use client";

import Link from "next/link";
import { useState } from "react";
import { hmm } from "@/lib/format";
import { SPORT_COLOR, SPORTS, type Totals } from "@/lib/volume";

const MEASURES = [
  ["hours", "Time"],
  ["km", "Distance"],
  ["load", "Load"],
] as const;
type Measure = (typeof MEASURES)[number][0];

const fmt = (m: Measure, v: number) =>
  m === "hours"
    ? hmm(v * 3600)
    : m === "km"
      ? `${v < 10 ? v.toFixed(1) : Math.round(v)} km`
      : `${Math.round(v)}`;

/** Strava-style weekly bars, stacked by sport, with this week's split underneath. */
export function Volume({
  weeks,
  title = "This week",
  href,
  compact = false,
}: {
  weeks: { monday: string; sports: Totals }[];
  title?: string;
  /** Where tapping the chart goes (Today → Training); none on Training itself. */
  href?: string;
  /** Year view: no this-week number or split (the page hero has them). */
  compact?: boolean;
}) {
  const [measure, setMeasure] = useState<Measure>("hours");
  const total = (s: Totals, m: Measure) => SPORTS.reduce((sum, sp) => sum + s[sp][m], 0);
  const max = Math.max(1e-9, ...weeks.map((w) => total(w.sports, measure)));
  const now = weeks.at(-1)?.sports;
  const H = 70;
  const slot = 300 / weeks.length;
  const chart = (
    <>
      <svg
        viewBox={`0 0 300 ${H}`}
        preserveAspectRatio="none"
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
                fill={SPORT_COLOR[sp]}
                fillOpacity={i === weeks.length - 1 ? 1 : 0.55}
              />
            );
          });
        })}
      </svg>
      <div className="axis">
        <span>{weeks.length} weeks ago</span>
        <span>max {fmt(measure, max)}</span>
        <span>this week</span>
      </div>
    </>
  );
  return (
    <section className="mod" aria-label="Weekly volume">
      <div className="mod-h">
        {title}
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
        {!compact && (
          <div className="big-num num">
            {now ? fmt("hours", total(now, "hours")) : "–"}
            <small> · {now ? fmt("km", total(now, "km")) : ""}</small>
          </div>
        )}
        {href ? (
          <Link
            href={href}
            className="chart"
            aria-label={`Weekly volume, last ${weeks.length} weeks`}
          >
            {chart}
          </Link>
        ) : (
          <div className="chart">{chart}</div>
        )}
        {!compact && (
          <div className="split num">
            {SPORTS.filter((sp) => now && now[sp].hours > 0).map((sp) => (
              <span key={sp}>
                <i style={{ background: SPORT_COLOR[sp] }} />
                <b>{sp}</b> {fmt("hours", now?.[sp].hours ?? 0)}
                {sp !== "other" && now ? ` · ${fmt("km", now[sp].km)}` : ""}
              </span>
            ))}
            {now && total(now, "hours") === 0 && (
              <span className="dim">Nothing yet this week.</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
