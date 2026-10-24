import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { log } from "@/db/schema";
import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { loadNights, orNothing, tsbOf } from "@/lib/nights";
import { readiness } from "@/lib/readiness";
import { mondayOf, type VolumeActivity, WEEKS, weeklyVolume } from "@/lib/volume";

type Wellness = { id: string; ctl?: number; atl?: number };
type Step = {
  duration?: number;
  reps?: number;
  steps?: Step[];
  power?: { value?: number; start?: number; end?: number; units?: string };
};
export type PlanEvent = {
  id: number;
  start_date_local: string;
  category: string;
  type?: string;
  name?: string;
  description?: string;
  moving_time?: number;
  time_target?: number;
  distance?: number;
  distance_target?: number;
  icu_training_load?: number;
  workout_doc?: { steps?: Step[] };
};
type Athlete = { sportSettings?: { types?: string[]; ftp?: number }[] };

/** Workout steps flattened to [seconds, fraction of FTP]. */
export function profile(steps: Step[] = [], ftp = 0): [number, number][] {
  return steps.flatMap((step) => {
    if (step.steps) {
      const inner = profile(step.steps, ftp);
      return Array.from({ length: step.reps ?? 1 }, () => inner).flat();
    }
    const p = step.power;
    const raw = p?.value ?? ((p?.start ?? 0) + (p?.end ?? p?.start ?? 0)) / 2;
    const pct = p?.units === "w" ? (ftp ? raw / ftp : 0) : raw / 100;
    return step.duration ? [[step.duration, pct] as [number, number]] : [];
  });
}

/** Everything the Today screen shows, fetched in parallel. */
export async function loadToday() {
  const date = today();
  const [{ nights, lastNight }, wellness, events, athlete, [lastSync], activities] =
    await Promise.all([
      loadNights(date, 70),
      orNothing(intervals<Wellness[]>(`/wellness?oldest=${date}&newest=${date}`), []),
      orNothing(intervals<PlanEvent[]>(`/events?oldest=${date}&newest=${addDays(date, 6)}`), []),
      orNothing(intervals<Athlete>(""), {}),
      db().select().from(log).where(eq(log.kind, "coros-sync")).orderBy(desc(log.at)).limit(1),
      orNothing(
        intervals<VolumeActivity[]>(
          `/activities?oldest=${addDays(mondayOf(date), -7 * (WEEKS - 1))}&newest=${date}&fields=start_date_local,type,moving_time,distance,icu_training_load`,
        ),
        [],
      ),
    ]);
  const w = wellness.find((x) => x.id === date);
  const tsb = tsbOf(w);
  const ftp = athlete.sportSettings?.find((s) => s.types?.includes("Ride"))?.ftp ?? 0;
  return {
    date,
    nights,
    lastNight,
    ready: readiness(nights, date, tsb),
    ctl: w?.ctl,
    atl: w?.atl,
    tsb,
    ftp,
    plan: events.filter((e) => e.category === "WORKOUT" || e.category.startsWith("RACE")),
    notes: events.filter((e) => e.category === "NOTE" && e.start_date_local.startsWith(date)),
    lastSync,
    volume: weeklyVolume(activities, date),
  };
}
