import { addDays } from "./date.ts";

export const SPORTS = ["ride", "run", "swim", "other"] as const;
export type Sport = (typeof SPORTS)[number];
/** One colour per sport, everywhere in the app. */
export const SPORT_COLOR: Record<Sport, string> = {
  ride: "var(--form)",
  run: "var(--go)",
  swim: "var(--hrv)",
  other: "rgba(255,255,255,.45)",
};
/** Weeks shown in the volume chart. */
export const WEEKS = 12;

export type VolumeActivity = {
  start_date_local: string;
  type?: string;
  moving_time?: number;
  distance?: number;
  icu_training_load?: number;
};

/** Total moving time in hours. */
export const hoursOf = (xs: { moving_time?: number }[]) =>
  xs.reduce((s, x) => s + (x.moving_time ?? 0), 0) / 3600;

export const sportOf = (type = ""): Sport =>
  /ride/i.test(type) ? "ride" : /run/i.test(type) ? "run" : /swim/i.test(type) ? "swim" : "other";

export type Totals = Record<Sport, { hours: number; km: number; load: number }>;
const empty = (): Totals =>
  Object.fromEntries(SPORTS.map((s) => [s, { hours: 0, km: 0, load: 0 }])) as Totals;

export const mondayOf = (date: string) => {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
};

/** First week of the plan: the plan starts tomorrow, so on a Sunday that's next week. */
export const planStart = (today: string) => mondayOf(addDays(today, 1));

/** Weekly totals per sport for the `weeks` weeks ending with the current one (Mon–Sun). */
export function weeklyVolume(activities: VolumeActivity[], today: string, weeks = WEEKS) {
  const first = addDays(mondayOf(today), -7 * (weeks - 1));
  const out = Array.from({ length: weeks }, (_, i) => ({
    monday: addDays(first, i * 7),
    sports: empty(),
  }));
  for (const a of activities) {
    const day = a.start_date_local.slice(0, 10);
    const week = out[Math.floor((Date.parse(day) - Date.parse(first)) / (7 * 864e5))];
    if (!week) continue;
    const t = week.sports[sportOf(a.type)];
    t.hours += (a.moving_time ?? 0) / 3600;
    t.km += (a.distance ?? 0) / 1000;
    t.load += a.icu_training_load ?? 0;
  }
  return out;
}
