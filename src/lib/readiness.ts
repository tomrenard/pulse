/**
 * Readiness as a traffic light, never a 0–100 score.
 *
 * HRV: mean of ln(rMSSD) over the last 7 nights against your normal, the 60-day mean
 * ± 0.5 SD of ln(rMSSD) (Plews et al. 2013; Javaloyes et al. 2019). Other signals only flag:
 * resting HR above its 60-day mean + 1 SD (at least 3 bpm), sleep under 85 % of need, form (TSB) under −30.
 *   red   = HRV below normal plus another flag, or HRV below normal 3 days running
 *   amber = HRV below normal, or two other flags
 *   green = otherwise
 * Shown from 14 nights of HRV, marked provisional until 30.
 */

export type NightInput = {
  date: string;
  hrv?: number | null;
  rhr?: number | null;
  asleepSecs?: number | null;
};
export type State = "go" | "mid" | "stop" | "building";
export type Reason = { key: "hrv" | "rhr" | "sleep" | "form"; label: string; flag: boolean };

export const MIN_NIGHTS = 14;
export const SOLID_NIGHTS = 30;
export const SLEEP_NEED_SECS = 8.5 * 3600;

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, xs.length - 1));
};
const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Your HRV normal band in ms (back-transformed from ln), from the 60 days up to `date`. */
export function hrvNormal(nights: NightInput[], date: string) {
  const lns = nights
    .filter((n) => n.hrv && n.date > addDays(date, -60) && n.date <= date)
    .map((n) => Math.log(n.hrv as number));
  if (lns.length < MIN_NIGHTS) return undefined;
  const m = mean(lns);
  const s = sd(lns);
  return {
    lnMean: m,
    lnSd: s,
    low: Math.exp(m - 0.5 * s),
    high: Math.exp(m + 0.5 * s),
    nights: lns.length,
  };
}

/** 7-night ln mean ending on `date`; needs 4 valid nights. */
function ln7(nights: NightInput[], date: string) {
  const lns = nights
    .filter((n) => n.hrv && n.date > addDays(date, -7) && n.date <= date)
    .map((n) => Math.log(n.hrv as number));
  return lns.length >= 4 ? mean(lns) : undefined;
}

function hrvLowOn(nights: NightInput[], date: string) {
  const normal = hrvNormal(nights, date);
  const week = ln7(nights, date);
  if (!normal || week === undefined) return undefined;
  return week < normal.lnMean - 0.5 * normal.lnSd;
}

export function readiness(nights: NightInput[], date: string, tsb?: number) {
  const normal = hrvNormal(nights, date);
  const week = ln7(nights, date);
  const last = nights.find((n) => n.date === date);
  if (!normal || week === undefined) {
    return {
      state: "building" as State,
      reasons: [] as Reason[],
      nights: normal?.nights ?? nights.filter((n) => n.hrv).length,
    };
  }
  const hrvLow = week < normal.lnMean - 0.5 * normal.lnSd;
  const lowStreak = [0, 1, 2].every((d) => hrvLowOn(nights, addDays(date, -d)));

  const rhrs = nights
    .filter((n) => n.rhr && n.date > addDays(date, -60) && n.date <= date)
    .map((n) => n.rhr as number);
  const rhrHigh = Boolean(
    last?.rhr && rhrs.length >= MIN_NIGHTS && last.rhr > mean(rhrs) + Math.max(sd(rhrs), 3),
  );
  const sleepShort = Boolean(last?.asleepSecs && last.asleepSecs < 0.85 * SLEEP_NEED_SECS);
  const formDeep = tsb !== undefined && tsb < -30;
  const others = [rhrHigh, sleepShort, formDeep].filter(Boolean).length;

  const state: State =
    (hrvLow && others >= 1) || lowStreak ? "stop" : hrvLow || others >= 2 ? "mid" : "go";
  const reasons: Reason[] = [
    { key: "hrv", label: hrvLow ? "HRV below your normal" : "HRV in your normal", flag: hrvLow },
    { key: "rhr", label: rhrHigh ? "Resting HR up" : "Resting HR normal", flag: rhrHigh },
    { key: "sleep", label: sleepShort ? "Short sleep" : "Enough sleep", flag: sleepShort },
    { key: "form", label: formDeep ? "Very fatigued" : "Fatigue OK", flag: formDeep },
  ];
  return {
    state,
    reasons,
    nights: normal.nights,
    provisional: normal.nights < SOLID_NIGHTS,
    hrv7: Math.exp(week),
    normal: { low: normal.low, high: normal.high },
  };
}

export const WORD: Record<State, string> = {
  go: "Ready",
  mid: "Go easy",
  stop: "Rest",
  building: "Building",
};

/** Spread of sleep midpoints over the given nights, in minutes (SD). Lower = more regular. */
export function midpointSpreadMin(windows: { start: string; end: string }[]) {
  if (windows.length < 3) return undefined;
  const mins = windows.map(({ start, end }) => {
    const a = Date.parse(`${start.replace(" ", "T")}Z`);
    const b = Date.parse(`${end.replace(" ", "T")}Z`);
    // Minutes after 18:00, so midnight-crossing midpoints stay continuous.
    const mid = new Date((a + b) / 2);
    return ((mid.getUTCHours() + 6) % 24) * 60 + mid.getUTCMinutes();
  });
  return Math.round(sd(mins));
}
