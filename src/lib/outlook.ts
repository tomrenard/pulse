/**
 * Outlook models: fitness projection, form zones and race-day form targets.
 */
import { addDays } from "./date.ts";

const K_CTL = 1 - Math.exp(-1 / 42);
const K_ATL = 1 - Math.exp(-1 / 7);

export type Day = { date: string; ctl: number; atl: number; tsb: number };

/**
 * Banister fitness/fatigue, the same constants as intervals.icu (back-test parity: 0.00).
 * Form on a day is yesterday's fitness minus yesterday's fatigue, as intervals.icu shows it.
 */
export function projectFitness(start: string, ctl0: number, atl0: number, loads: number[]): Day[] {
  let ctl = ctl0;
  let atl = atl0;
  return loads.map((load, i) => {
    const tsb = ctl - atl;
    ctl += (load - ctl) * K_CTL;
    atl += (load - atl) * K_ATL;
    return { date: addDays(start, i + 1), ctl, atl, tsb };
  });
}

/** Form as % of fitness, see FORM_ZONES. */
export const formPct = (d: { ctl: number; tsb: number }) => (d.ctl > 0 ? (d.tsb / d.ctl) * 100 : 0);

/**
 * COROS's Intensity Trend bands (see lib/load.ts) told on form % of fitness, top down: form % is
 * 100 − trend %, so one scale and one set of words across the app. A zone holds form above `min`.
 */
export const FORM_ZONES = [
  { name: "Decreasing", min: 50, color: "var(--mid)" },
  { name: "Performance", min: 20, color: "var(--form)" },
  { name: "Maintaining", min: 0, color: "rgba(255,255,255,.5)" },
  { name: "Optimized", min: -50, color: "var(--go)" },
  { name: "Excessive", min: Number.NEGATIVE_INFINITY, color: "var(--stop)" },
] as const;

/** Rounded first, like the trend %, so a band edge reads the same on the chart and in the hero. */
export const formZone = (pct: number) =>
  FORM_ZONES.find((z) => Math.round(pct) > z.min) ?? FORM_ZONES[4];

/**
 * Race-day form target: long events (≥ 4 h) want about neutral to slightly fresh, so fitness
 * isn't lost; short ones tolerate a sharper taper.
 */
export function formTarget(race: {
  type?: string;
  moving_time?: number | null;
  time_target?: number | null;
  distance?: number | null;
  distance_target?: number | null;
}) {
  const secs = race.moving_time ?? race.time_target;
  const metres = race.distance ?? race.distance_target;
  const long = secs
    ? secs >= 4 * 3600
    : metres
      ? metres >= (/run/i.test(race.type ?? "") ? 30_000 : 120_000)
      : undefined;
  if (long === undefined) return undefined; // length unknown: no target rather than a wrong one
  return long
    ? { low: 0, high: 10, why: "long event: arrive neutral to slightly fresh" }
    : { low: 5, high: 20, why: "arrive fresh" };
}

/** Race-day form against its target, in words (low and high count as on target). */
export const formVerdict = (pct: number, target: { low: number; high: number }) =>
  pct < target.low
    ? "too tired, ease off before the race"
    : pct > target.high
      ? "fresher than needed"
      : "on target";
