import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { orNothing } from "@/lib/nights";
import { calibrate, hrVo2Series, type Run, volumeBefore } from "@/lib/potential";
import { bestVdot, cyclingVo2, raceInfo } from "@/lib/races";
import { at, HOUR, type PaceCurve, RUN_DISTANCES } from "@/lib/records";
import type { PlanEvent } from "@/lib/today";

type Wellness = {
  id: string;
  ctl?: number;
  atl?: number;
  sportInfo?: { type: string; eftp?: number }[];
};
type PowerCurve = { secs?: number[]; watts?: number[]; watts_per_kg?: number[] };

/** Loads and runs since 2023: heart rate on runs starts then (the potential model's history). */
const LOADS_FROM = "2023-01-01";

export async function loadOutlook() {
  const date = today();
  const [wellness, events, activities, power, athlete, pace] = await Promise.all([
    orNothing(intervals<Wellness[]>(`/wellness?oldest=${addDays(date, -7)}&newest=${date}`), []),
    orNothing(
      intervals<PlanEvent[]>(
        `/events?oldest=${addDays(date, 1)}&newest=${addDays(date, 365)}`,
        // Short: Wattson edits the plan, and it should show up within minutes.
        { next: { revalidate: 300 } },
      ),
      [],
    ),
    orNothing(
      intervals<(Run & { type?: string })[]>(
        `/activities?oldest=${LOADS_FROM}&newest=${date}&fields=start_date_local,type,icu_training_load,moving_time,distance,average_heartrate`,
        { next: { revalidate: 3600 } },
      ),
      [],
    ),
    // Last 6 weeks: the 5-min best behind ride VO2max.
    orNothing(intervals<{ list: PowerCurve[] }>("/power-curves.json?type=Ride&curves=42d", HOUR), {
      list: [],
    }),
    orNothing(
      intervals<{
        icu_weight?: number;
        sportSettings?: { types?: string[]; max_hr?: number; ftp?: number }[];
      }>(""),
      {},
    ),
    // Bests from the same years as the heart-rate data: an older PB would inflate "now".
    orNothing(
      intervals<{ list: PaceCurve[] }>(
        `/pace-curves.json?type=Run&curves=all,r.${LOADS_FROM}.${date}`,
        HOUR,
      ),
      { list: [] },
    ),
  ]);
  const w = wellness.find((x) => x.id === date);
  // intervals.icu's eFTP from the newest day that has one, else the FTP you set.
  const eftp = [...wellness]
    .reverse()
    .flatMap((x) => x.sportInfo ?? [])
    .find((x) => x.type === "Ride" && x.eftp)?.eftp;
  const ftp = eftp ?? athlete.sportSettings?.find((x) => x.types?.includes("Ride"))?.ftp;
  const p5 = power.list[0];
  // Swims in the last 8 weeks: the fallback race pace when the pool bests can't be real.
  const swims = activities.filter(
    (a) => /swim/i.test(a.type ?? "") && a.start_date_local >= addDays(date, -56),
  );
  const races = events
    .filter((e) => e.category.startsWith("RACE"))
    .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local))
    .map((e) => ({ ...e, info: raceInfo(e) }));

  // Running potential: HR-based fitness now, calibrated so your fittest stretch = your best VDOT.
  // Road runs only: trail and treadmill pace says little about fitness.
  const runs = activities.filter((a) => a.type === "Run");
  const hrMax = athlete.sportSettings?.find((x) => x.types?.includes("Run"))?.max_hr ?? 0;
  const [all, era] = pace.list;
  const pbTimes = RUN_DISTANCES.map(([d]) => at(all?.distance, all?.values, d));
  const eraTimes = RUN_DISTANCES.map(([d]) => at(era?.distance, era?.values, d));
  const pbVdot = bestVdot(RUN_DISTANCES.map(([d], i) => ({ distance: d, secs: eraTimes[i] })));
  const series = hrMax && pbVdot ? calibrate(hrVo2Series(runs, hrMax), pbVdot) : [];
  const last = series.at(-1);
  return {
    date,
    // Undefined when intervals.icu didn't answer: shown as "no data", never projected from 0.
    ctl: w?.ctl,
    atl: w?.atl,
    workouts: events.filter((e) => e.category === "WORKOUT"),
    races,
    ftp,
    kg: athlete.icu_weight,
    rideVo2: cyclingVo2(at(p5?.secs, p5?.watts, 300), at(p5?.secs, p5?.watts_per_kg, 300)),
    recentSwim: {
      metres: swims.reduce((s, a) => s + (a.distance ?? 0), 0),
      secs: swims.reduce((s, a) => s + (a.moving_time ?? 0), 0),
    },
    potential: {
      // Stale after 30 days without a qualifying run: then there's no "now".
      now: last && last.date >= addDays(date, -30) ? last.vdot : undefined,
      pbVdot,
      /** All-time bests. */
      pbTimes,
      volume: volumeBefore(runs, date),
    },
  };
}
