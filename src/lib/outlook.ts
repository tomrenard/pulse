/**
 * Outlook models. Each one was back-tested on the athlete's own 2023–2026 data
 * (rolling weekly origins, compared with "no change"); only what holds up is shown, and
 * ranges are the 80th percentile of past errors, not the average.
 */
import { addDays } from "./date.ts";
import { linearFit } from "./readiness.ts";

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

/** Form as % of fitness, intervals.icu's zones (fresh +5…+20 %, optimal −10…−30 %). */
export const formPct = (d: { ctl: number; tsb: number }) => (d.ctl > 0 ? (d.tsb / d.ctl) * 100 : 0);

/** intervals.icu's form zones, on form as a % of fitness, top down. */
export const FORM_ZONES = [
  { name: "Transition", min: 20, color: "var(--mid)" },
  { name: "Fresh", min: 5, color: "var(--form)" },
  { name: "Grey zone", min: -10, color: "rgba(255,255,255,.5)" },
  { name: "Optimal", min: -30, color: "var(--go)" },
  { name: "High risk", min: Number.NEGATIVE_INFINITY, color: "var(--stop)" },
] as const;

export const formZone = (pct: number) => FORM_ZONES.find((z) => pct >= z.min) ?? FORM_ZONES[4];

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

export type Activity = {
  start_date_local: string;
  type?: string;
  icu_training_load?: number;
  moving_time?: number;
};

const isRide = (type = "") => /ride/i.test(type);
const isRun = (type = "") => /run/i.test(type);

/** Load per hour by sport: total load ÷ total hours over the window (not a per-session median). */
export function loadPerHour(
  activities: Activity[],
  sport: "ride" | "run",
  fallback: number,
): { rate: number; typical: boolean } {
  const pick = sport === "ride" ? isRide : isRun;
  let load = 0;
  let secs = 0;
  for (const a of activities) {
    if (!pick(a.type) || !a.icu_training_load || !a.moving_time) continue;
    load += a.icu_training_load;
    secs += a.moving_time;
  }
  return secs >= 5 * 3600
    ? { rate: load / (secs / 3600), typical: false }
    : { rate: fallback, typical: true };
}

/** Ride-only fitness per day from ride loads, built from the first activity. */
export function rideCtlByDay(activities: Activity[], until: string) {
  const loads = new Map<string, number>();
  for (const a of activities) {
    if (!isRide(a.type) || !a.icu_training_load) continue;
    const day = a.start_date_local.slice(0, 10);
    loads.set(day, (loads.get(day) ?? 0) + a.icu_training_load);
  }
  const first = [...loads.keys()].sort()[0];
  const out = new Map<string, number>();
  if (!first) return out;
  let ctl = 0;
  for (let d = first; d <= until; d = addDays(d, 1)) {
    ctl += ((loads.get(d) ?? 0) - ctl) * K_CTL;
    out.set(d, ctl);
  }
  return out;
}

/**
 * Your 20-min power against ride fitness, from your own history: best 20 min in the 6 weeks
 * before each Monday (window counted when ≥ 2 of those weeks have rides) vs ride CTL that day.
 * Descriptive, not a forecast: fed with a projected CTL it did not beat "no change".
 */
export function powerVsFitness(
  weeks: { monday: string; best20?: number }[],
  rideCtl: Map<string, number>,
) {
  const points: { ctl: number; power: number }[] = [];
  weeks.forEach((w, i) => {
    if (i < 6) return;
    const window = weeks.slice(i - 6, i).filter((x) => x.best20);
    if (window.length < 2) return;
    const ctl = rideCtl.get(addDays(w.monday, -1));
    if (ctl === undefined) return;
    points.push({ ctl, power: Math.max(...window.map((x) => x.best20 as number)) });
  });
  if (points.length < 8) return undefined;
  const { a, b } = linearFit(
    points.map((p) => p.ctl),
    points.map((p) => p.power),
  );
  if (b <= 0) return undefined;
  const errors = points
    .map((p) => Math.abs(a + b * p.ctl - p.power) / p.power)
    .sort((x, y) => x - y);
  return {
    a,
    b,
    points,
    p80: errors[Math.ceil(errors.length * 0.8) - 1] ?? 0, // nearest-rank 80th percentile
    minCtl: Math.min(...points.map((p) => p.ctl)),
    maxCtl: Math.max(...points.map((p) => p.ctl)),
  };
}

export type PowerFit = NonNullable<ReturnType<typeof powerVsFitness>>;

/** Ride fitness clamped to the range you have actually been in. */
const clampCtl = (fit: PowerFit, ctl: number) => Math.min(fit.maxCtl, Math.max(fit.minCtl, ctl));

/** Typical 20-min best at a ride fitness, from your history. */
export const powerAt = (fit: PowerFit, ctl: number) => fit.a + fit.b * clampCtl(fit, ctl);
