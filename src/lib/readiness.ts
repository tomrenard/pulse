import { addDays } from "./date.ts";

/**
 * Readiness as a traffic light, never a 0–100 score.
 *
 * HRV: mean of ln(rMSSD) over the last 7 nights against your normal, the 60-day mean
 * ± 0.5 SD of ln(rMSSD) (Plews et al. 2013; Javaloyes et al. 2019). The 60 days include the
 * last 7, as in HRV4Training's rolling baseline. Other signals only flag: resting HR above its
 * 60-day mean + 1 SD (at least 3 bpm), sleep under 85 % of need, form (TSB) under −30.
 *   red   = HRV below normal plus another flag, or HRV below normal 3 days running
 *   amber = HRV below normal, or two other flags
 *   green = otherwise
 * Shown from 14 nights of HRV, marked provisional until 30. Needs 4 of the last 7 nights.
 * Nights tagged by hand (alcohol, illness, late meal, travel) stay out of the normal.
 */

export type NightInput = {
  date: string;
  hrv?: number | null;
  rhr?: number | null;
  asleepSecs?: number | null;
  /** Tagged by hand (alcohol, illness, …): counts this week, but not in your normal. */
  tagged?: boolean;
};
export type State = "go" | "mid" | "stop" | "building";
export type Reason = { key: "hrv" | "rhr" | "sleep" | "form"; label: string; flag: boolean };

export const MIN_NIGHTS = 14;
const SOLID_NIGHTS = 30;
const RECENT_NIGHTS = 4;
export const SLEEP_NEED_SECS = 8.5 * 3600;

export const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
export const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
};

const within = (n: NightInput, date: string, days: number) =>
  n.date > addDays(date, -days) && n.date <= date;

/** Your HRV normal band in ms (back-transformed from ln), from the 60 days up to `date`. */
export function hrvNormal(nights: NightInput[], date: string) {
  const lns = nights
    .filter((n) => n.hrv && !n.tagged && within(n, date, 60))
    .map((n) => Math.log(n.hrv as number));
  if (lns.length < MIN_NIGHTS) return { nights: lns.length };
  const m = mean(lns);
  const s = sd(lns);
  return {
    nights: lns.length,
    lnMean: m,
    lnSd: s,
    lnLow: m - 0.5 * s,
    low: Math.exp(m - 0.5 * s),
    high: Math.exp(m + 0.5 * s),
  };
}

/** 7-night ln mean ending on `date`, or undefined with fewer than 4 nights. */
export function ln7(nights: NightInput[], date: string) {
  const lns = nights
    .filter((n) => n.hrv && within(n, date, 7))
    .map((n) => Math.log(n.hrv as number));
  return lns.length >= RECENT_NIGHTS ? mean(lns) : undefined;
}

function hrvLowOn(nights: NightInput[], date: string) {
  const { lnLow } = hrvNormal(nights, date);
  const week = ln7(nights, date);
  return lnLow !== undefined && week !== undefined && week < lnLow;
}

/** Resting HR normal: 60-day mean − 1 SD to mean + 1 SD (at least 3 bpm above). */
export function rhrNormal(nights: NightInput[], date: string) {
  const rhrs = nights.filter((n) => n.rhr && within(n, date, 60)).map((n) => n.rhr as number);
  if (rhrs.length < MIN_NIGHTS) return undefined;
  const m = mean(rhrs);
  return { low: Math.round(m - sd(rhrs)), high: Math.round(m + Math.max(sd(rhrs), 3)) };
}

export function readiness(nights: NightInput[], date: string, tsb?: number) {
  const normal = hrvNormal(nights, date);
  const week = ln7(nights, date);
  const base = {
    nights: normal.nights,
    provisional: normal.nights < SOLID_NIGHTS,
    normal:
      normal.low && normal.high
        ? { low: normal.low, high: normal.high, lnMean: normal.lnMean, lnSd: normal.lnSd }
        : undefined,
    hrv7: week === undefined ? undefined : Math.exp(week),
  };
  if (normal.lnLow === undefined || week === undefined) {
    // Building: under 14 nights in 60 days. Stale: a baseline exists but this week has too few.
    return {
      ...base,
      state: "building" as State,
      stale: normal.lnLow !== undefined,
      reasons: [] as Reason[],
    };
  }
  const last = nights.find((n) => n.date === date);
  const hrvLow = week < normal.lnLow;
  const lowStreak = [0, 1, 2].every((d) => hrvLowOn(nights, addDays(date, -d)));
  const rhr = rhrNormal(nights, date);
  const rhrHigh = Boolean(last?.rhr && rhr && last.rhr > rhr.high);
  const sleepShort = Boolean(last?.asleepSecs && last.asleepSecs < 0.85 * SLEEP_NEED_SECS);
  const formDeep = tsb !== undefined && tsb < -30;
  const others = [rhrHigh, sleepShort, formDeep].filter(Boolean).length;

  const state: State =
    (hrvLow && others >= 1) || lowStreak ? "stop" : hrvLow || others >= 2 ? "mid" : "go";
  const reasons: Reason[] = [
    { key: "hrv", label: hrvLow ? "HRV below your normal" : "HRV in your normal", flag: hrvLow },
    {
      key: "rhr",
      label: !last?.rhr ? "Resting HR: no data" : rhrHigh ? "Resting HR up" : "Resting HR normal",
      flag: rhrHigh,
    },
    {
      key: "sleep",
      label: !last?.asleepSecs ? "Sleep: no data" : sleepShort ? "Short sleep" : "Enough sleep",
      flag: sleepShort,
    },
    {
      key: "form",
      label: tsb === undefined ? "Form: no data" : formDeep ? "Very fatigued" : "Fatigue OK",
      flag: formDeep,
    },
  ];
  return { ...base, state, stale: false, reasons };
}

/** What to do today, Garmin-style: a few words under the state. */
export const ACTION: Record<State, string> = {
  go: "Train as planned",
  mid: "Keep it easy today",
  stop: "Rest or go very easy",
  building: "Train by feel",
};

export type HrvStatus = "Elevated" | "Normal" | "Reduced" | "Low";
export const HRV_TONE: Record<HrvStatus, "go" | "mid" | "stop"> = {
  Elevated: "go",
  Normal: "go",
  Reduced: "mid",
  Low: "stop",
};

/**
 * One HRV value (a night, or the 7-night mean) against your normal, in COROS's words.
 * Normal = the band (mean ± 0.5 SD of ln HRV); Reduced down to mean − 1.5 SD; Low below that.
 */
export function hrvStatus(ms: number, n: { lnMean: number; lnSd: number }): HrvStatus {
  const z = (Math.log(ms) - n.lnMean) / n.lnSd;
  return z > 0.5 ? "Elevated" : z >= -0.5 ? "Normal" : z >= -1.5 ? "Reduced" : "Low";
}

type Word = { word: string; tone: "go" | "mid" | "stop" };

/** Last night's sleep against the 8 h 30 need. */
export function sleepWord(secs?: number | null): Word | undefined {
  if (!secs) return undefined;
  if (secs >= SLEEP_NEED_SECS) return { word: "Enough", tone: "go" };
  return secs >= 0.85 * SLEEP_NEED_SECS
    ? { word: "A bit short", tone: "go" }
    : { word: "Short", tone: "mid" };
}

/** Resting HR against your normal; only high counts against you. */
export function rhrWord(
  rhr?: number | null,
  normal?: { low: number; high: number },
): Word | undefined {
  if (!rhr || !normal) return undefined;
  if (rhr > normal.high) return { word: "High", tone: "stop" };
  return { word: rhr < normal.low ? "Low" : "Normal", tone: "go" };
}

/** Spread of the sleep midpoint over 7 nights: regular under 30 min, irregular over an hour. */
export function bedtimeWord(spreadMin?: number): Word | undefined {
  if (spreadMin === undefined) return undefined;
  if (spreadMin <= 30) return { word: "Regular", tone: "go" };
  return spreadMin <= 60 ? { word: "Varies", tone: "mid" } : { word: "Irregular", tone: "stop" };
}

export const WORD: Record<State, string> = {
  go: "Ready",
  mid: "Go easy",
  stop: "Rest",
  building: "Building",
};

/** Spread of sleep midpoints over the given nights, in minutes (SD). Lower = more regular. */
export function midpointSpreadMin(
  nights: { sleepStart?: string | null; sleepEnd?: string | null }[],
) {
  const mins = nights.flatMap(({ sleepStart, sleepEnd }) => {
    if (!sleepStart || !sleepEnd) return [];
    // Local clock times read as UTC: only the time of day matters here.
    const a = Date.parse(`${sleepStart.replace(" ", "T")}Z`);
    const b = Date.parse(`${sleepEnd.replace(" ", "T")}Z`);
    const mid = new Date((a + b) / 2);
    // Minutes after 18:00, so midnight-crossing midpoints stay continuous.
    return [((mid.getUTCHours() + 6) % 24) * 60 + mid.getUTCMinutes()];
  });
  return mins.length < 3 ? undefined : Math.round(sd(mins));
}
