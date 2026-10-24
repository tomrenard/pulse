import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { orNothing } from "@/lib/nights";
import { type Activity, loadPerHour, powerVsFitness, rideCtlByDay } from "@/lib/outlook";
import type { PlanEvent } from "@/lib/today";

type Wellness = { id: string; ctl?: number; atl?: number };
type Curve = { start_date_local: string; secs?: number[]; watts?: number[] };

const DAY = 24 * 3600;
/** Power history starts in 2025; ride fitness needs ~150 days of loads before that. */
const POWER_FROM = "2025-01-06";
const LOADS_FROM = "2024-08-01";

const mondayOf = (date: string) => {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
};

/** Weekly best 20-min power (Mon–Sun) since POWER_FROM, 13 weeks per call, cached a day. */
async function weeklyBest20(until: string) {
  const weeks: string[] = [];
  for (let m = POWER_FROM; m <= until; m = addDays(m, 7)) weeks.push(m);
  const batches = Array.from({ length: Math.ceil(weeks.length / 13) }, (_, i) =>
    weeks.slice(i * 13, i * 13 + 13),
  );
  const replies = await Promise.all(
    batches.map((b) =>
      orNothing(
        intervals<{ list: Curve[] }>(
          `/power-curves.json?type=Ride&curves=${b.map((m) => `r.${m}.${addDays(m, 6)}`).join(",")}`,
          { next: { revalidate: DAY } },
        ),
        { list: [] },
      ),
    ),
  );
  const best = new Map<string, number>();
  for (const c of replies.flatMap((r) => r.list)) {
    const i = c.secs?.indexOf(1200) ?? -1;
    const w = i >= 0 ? c.watts?.[i] : undefined;
    if (w) best.set(c.start_date_local.slice(0, 10), w);
  }
  return weeks.map((monday) => ({ monday, best20: best.get(monday) }));
}

export async function loadOutlook() {
  const date = today();
  const [wellness, events, activities, weeks] = await Promise.all([
    orNothing(intervals<Wellness[]>(`/wellness?oldest=${date}&newest=${date}`), []),
    orNothing(
      intervals<PlanEvent[]>(`/events?oldest=${addDays(date, 1)}&newest=${addDays(date, 120)}`),
      [],
    ),
    orNothing(
      intervals<Activity[]>(
        `/activities?oldest=${LOADS_FROM}&newest=${date}&fields=start_date_local,type,icu_training_load,moving_time`,
        { next: { revalidate: 3600 } },
      ),
      [],
    ),
    weeklyBest20(mondayOf(addDays(date, -7))),
  ]);
  const w = wellness[0];
  const recent = activities.filter((a) => a.start_date_local >= addDays(date, -84));
  const rideCtl = rideCtlByDay(activities, date);
  const race = events
    .filter((e) => e.category.startsWith("RACE"))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        a.start_date_local.localeCompare(b.start_date_local),
    )[0];
  return {
    date,
    ctl: w?.ctl ?? 0,
    atl: w?.atl ?? 0,
    rideCtl: rideCtl.get(date) ?? 0,
    // Back-tested fallbacks if there's too little recent data: typical endurance training.
    rideRate: loadPerHour(recent, "ride", 50),
    runRate: loadPerHour(recent, "run", 60),
    workouts: events.filter((e) => e.category === "WORKOUT"),
    race,
    power: powerVsFitness(weeks, rideCtl),
    recentBest20: Math.max(0, ...weeks.slice(-6).map((x) => x.best20 ?? 0)),
  };
}
