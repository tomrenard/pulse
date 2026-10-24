import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { loadNights, orNothing, tsbOf } from "@/lib/nights";
import { readiness, rhrNormal } from "@/lib/readiness";

/** All four lower overnight HRV for a night or two, so all stay out of the normal. */
export const TAGS = ["alcohol", "illness", "late meal", "travel"] as const;

type Wellness = { id: string; weight?: number | null; ctl?: number; atl?: number };
type Athlete = { icu_weight?: number };

/** Everything the Health tab shows: 90 nights, last night's tags, weight and form from intervals.icu. */
export async function loadHealth() {
  const date = today();
  const [{ nights, lastNight, lastTags }, wellness, athlete] = await Promise.all([
    loadNights(date, 90),
    orNothing(intervals<Wellness[]>(`/wellness?oldest=${addDays(date, -180)}&newest=${date}`), []),
    // Weight set in intervals.icu settings, until weights are logged day by day.
    orNothing(intervals<Athlete>(""), {}),
  ]);
  const weights = wellness.flatMap((w) => (w.weight ? [{ date: w.id, value: w.weight }] : []));
  return {
    date,
    nights,
    lastNight,
    lastTags,
    ready: readiness(nights, date, tsbOf(wellness.find((w) => w.id === date))),
    rhr: rhrNormal(nights, date),
    weights,
    weight: weights.at(-1)?.value ?? athlete.icu_weight,
  };
}
