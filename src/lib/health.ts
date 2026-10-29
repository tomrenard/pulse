import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { intensityTrend } from "@/lib/load";
import { loadNights, orNothing, tsbOf } from "@/lib/nights";
import { readiness, rhrNormal } from "@/lib/readiness";
import { dailyLoads, recoveryResponse } from "@/lib/recovery";

/** All four lower overnight HRV for a night or two, so all stay out of the normal. */
export const TAGS = ["alcohol", "illness", "late meal", "travel"] as const;

type Wellness = { id: string; weight?: number | null; ctl?: number; atl?: number };
type Athlete = { icu_weight?: number };

/**
 * Everything the Health tab shows: 90 nights, last night's tags, weight and form from intervals.icu,
 * and how HRV answers big days (400 days of nights and loads).
 */
export async function loadHealth() {
  const date = today();
  const [{ nights: year, lastNight, lastTags }, wellness, athlete, activities] = await Promise.all([
    loadNights(date, 400),
    orNothing(intervals<Wellness[]>(`/wellness?oldest=${addDays(date, -180)}&newest=${date}`), []),
    // Weight set in intervals.icu settings, until weights are logged day by day.
    orNothing(intervals<Athlete>(""), {}),
    orNothing(
      intervals<{ start_date_local: string; icu_training_load?: number }[]>(
        `/activities?oldest=${addDays(date, -400)}&newest=${date}&fields=start_date_local,icu_training_load`,
        { next: { revalidate: 3600 } },
      ),
      [],
    ),
  ]);
  const nights = year.filter((n) => n.date > addDays(date, -90));
  const w = wellness.find((x) => x.id === date);
  const weights = wellness.flatMap((w) => (w.weight ? [{ date: w.id, value: w.weight }] : []));
  return {
    date,
    nights,
    lastNight,
    lastTags,
    ready: readiness(nights, date, tsbOf(w)),
    trend: intensityTrend(w?.ctl, w?.atl, wellness.find((x) => x.id === addDays(date, -1))?.atl),
    rhr: rhrNormal(nights, date),
    weights,
    weight: weights.at(-1)?.value ?? athlete.icu_weight,
    recovery: recoveryResponse(dailyLoads(activities, addDays(date, -400)), year),
  };
}
