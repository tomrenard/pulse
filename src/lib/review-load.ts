import { addDays } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { loadNights, orNothing } from "@/lib/nights";
import { reviewSunday, weeklyReview } from "@/lib/review";
import type { PlanEvent } from "@/lib/today";

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
  const hours = (xs: { moving_time?: number }[]) =>
    xs.reduce((s, x) => s + (x.moving_time ?? 0), 0) / 3600;
  return weeklyReview({
    sunday,
    doneHours: hours(done),
    plannedHours: hours(events.filter((e) => e.category === "WORKOUT")),
    ctlBefore: wellness.find((w) => w.id === before)?.ctl,
    ctlAfter: wellness.find((w) => w.id === sunday)?.ctl,
    nights,
  });
}
