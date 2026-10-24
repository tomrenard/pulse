import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { loadNights, orNothing } from "@/lib/nights";
import { type Activity, loadPerHour, powerVsFitness, rideCtlByDay } from "@/lib/outlook";
import { calibrate, hrVo2Series, type Run, volumeBefore } from "@/lib/potential";
import { bestVdot, raceInfo } from "@/lib/races";
import { at, HOUR, type PaceCurve, RUN_DISTANCES } from "@/lib/records";
import { recoveryResponse } from "@/lib/recovery";
import type { PlanEvent } from "@/lib/today";

type Wellness = {
  id: string;
  ctl?: number;
  atl?: number;
  sportInfo?: { type: string; eftp?: number }[];
};
type Curve = { start_date_local: string; secs?: number[]; watts?: number[] };

const DAY = 24 * 3600;
/** Power history starts in 2025; ride fitness needs ~150 days of loads before that. */
const POWER_FROM = "2025-01-06";
/** Loads and runs since 2023: heart rate on runs starts then (the potential model's history). */
const LOADS_FROM = "2023-01-01";

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

/** Training load per training day since `from`. */
function dailyLoads(activities: Activity[], from: string) {
  const byDay = new Map<string, number>();
  for (const a of activities) {
    const d = a.start_date_local.slice(0, 10);
    if (d >= from) byDay.set(d, (byDay.get(d) ?? 0) + (a.icu_training_load ?? 0));
  }
  return [...byDay].map(([date, load]) => ({ date, load }));
}

export async function loadOutlook() {
  const date = today();
  const [wellness, events, activities, weeks, athlete, pace, { nights }] = await Promise.all([
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
      intervals<(Activity & Run)[]>(
        `/activities?oldest=${LOADS_FROM}&newest=${date}&fields=start_date_local,type,icu_training_load,moving_time,distance,average_heartrate`,
        { next: { revalidate: 3600 } },
      ),
      [],
    ),
    // Weeks are Mondays from POWER_FROM: up to a week ago means only finished weeks.
    weeklyBest20(addDays(date, -7)),
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
    loadNights(date, 400),
  ]);
  const w = wellness.find((x) => x.id === date);
  // intervals.icu's eFTP from the newest day that has one, else the FTP you set.
  const eftp = [...wellness]
    .reverse()
    .flatMap((x) => x.sportInfo ?? [])
    .find((x) => x.type === "Ride" && x.eftp)?.eftp;
  const ftp = eftp ?? athlete.sportSettings?.find((x) => x.types?.includes("Ride"))?.ftp;
  const recent = activities.filter((a) => a.start_date_local >= addDays(date, -84));
  const rideCtl = rideCtlByDay(activities, date);
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
  // Your fittest stretch: the volume and pace you were running then anchor race-day potential.
  const peak = series.reduce<(typeof series)[number] | undefined>(
    (b, p) => (!b || p.vdot > b.vdot ? p : b),
    undefined,
  );
  const runNow = volumeBefore(runs, date);
  return {
    date,
    // Undefined when intervals.icu didn't answer: shown as "no data", never projected from 0.
    ctl: w?.ctl,
    atl: w?.atl,
    rideCtl: rideCtl.get(date) ?? 0,
    // Typical endurance values when there's under 5 h of recent riding or running.
    rideRate: loadPerHour(recent, "ride", 50),
    runRate: loadPerHour(recent, "run", 60),
    workouts: events.filter((e) => e.category === "WORKOUT"),
    races,
    ftp,
    kg: athlete.icu_weight,
    recovery: recoveryResponse(dailyLoads(activities, addDays(date, -400)), nights),
    potential: {
      // Stale after 30 days without a qualifying run: then there's no "now".
      now: last && last.date >= addDays(date, -30) ? last.vdot : undefined,
      pbVdot,
      /** All-time bests: the white ticks. */
      pbTimes,
      weeklyKm: runNow.weeklyKm,
      anchor: peak && pbVdot ? { vdot: pbVdot, ...volumeBefore(runs, peak.date) } : undefined,
    },
    power: powerVsFitness(weeks, rideCtl),
    recentBest20: Math.max(0, ...weeks.slice(-6).map((x) => x.best20 ?? 0)),
  };
}
