import { asc, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { log, night, tag } from "@/db/schema";
import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { readiness } from "@/lib/readiness";

/** intervals.icu being down must not take the page with it: its parts just show "–". */
const orNothing = <T>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback);

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
  const [rows, tags, wellness, events, athlete, [lastSync]] = await Promise.all([
    db()
      .select()
      .from(night)
      .where(gte(night.date, addDays(date, -70)))
      .orderBy(asc(night.date)),
    db()
      .select()
      .from(tag)
      .where(gte(tag.date, addDays(date, -70))),
    orNothing(intervals<Wellness[]>(`/wellness?oldest=${date}&newest=${date}`), []),
    orNothing(intervals<PlanEvent[]>(`/events?oldest=${date}&newest=${addDays(date, 6)}`), []),
    orNothing(intervals<Athlete>(""), {}),
    db().select().from(log).where(eq(log.kind, "coros-sync")).orderBy(desc(log.at)).limit(1),
  ]);
  const tagged = new Set(tags.map((t) => t.date));
  const nights = rows.map((n) => ({ ...n, tagged: tagged.has(n.date) }));
  const w = wellness.find((x) => x.id === date);
  const tsb = w?.ctl !== undefined && w.atl !== undefined ? w.ctl - w.atl : undefined;
  const ftp = athlete.sportSettings?.find((s) => s.types?.includes("Ride"))?.ftp ?? 0;
  const lastNight = nights.find((n) => n.date === date);
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
  };
}
