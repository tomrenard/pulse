import { addDays } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { loadNights, orNothing } from "@/lib/nights";
import { reviewSunday, weeklyReview } from "@/lib/review";
import type { PlanEvent } from "@/lib/today";
import { hoursOf, weekPlan } from "@/lib/volume";

type Wellness = { id: string; ctl?: number };
type Done = { moving_time?: number };

/** The week in review for the week ending on the latest Sunday up to `date`. */
export async function loadReview(date: string) {
  const sunday = reviewSunday(date);
  const monday = addDays(sunday, -6);
  const before = addDays(sunday, -7);
  const [{ nights }, done, events, wellness] = await Promise.all([
    loadNights(sunday, 70),
    orNothing(
      intervals<Done[]>(`/activities?oldest=${monday}&newest=${sunday}&fields=moving_time`),
      [],
    ),
    orNothing(intervals<PlanEvent[]>(`/events?oldest=${monday}&newest=${sunday}`), []),
    orNothing(
      intervals<Wellness[]>(`/wellness?oldest=${before}&newest=${sunday}&fields=id,ctl`),
      [],
    ),
  ]);
  return weeklyReview({
    sunday,
    doneHours: hoursOf(done),
    plannedHours: hoursOf(weekPlan(events, monday)),
    ctlBefore: wellness.find((w) => w.id === before)?.ctl,
    ctlAfter: wellness.find((w) => w.id === sunday)?.ctl,
    nights,
  });
}
