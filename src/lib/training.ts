import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { orNothing, tsbOf } from "@/lib/nights";
import type { PlanEvent } from "@/lib/today";
import { type VolumeActivity, weeklyVolume } from "@/lib/volume";

export type Activity = VolumeActivity & {
  id: string;
  name?: string;
  icu_weighted_avg_watts?: number;
  average_heartrate?: number;
  total_elevation_gain?: number;
  icu_zone_times?: { id: string; secs: number }[];
  icu_hr_zone_times?: number[];
  icu_ftp?: number;
  /** Zone tops in % of FTP. */
  icu_power_zones?: number[];
};
type Wellness = { id: string; ctl?: number; atl?: number; rampRate?: number };

const FIELDS =
  "id,name,type,start_date_local,moving_time,distance,icu_training_load,icu_weighted_avg_watts,average_heartrate,total_elevation_gain,icu_zone_times,icu_hr_zone_times";

/** Time in power zones (Z1–Z7) and HR zones (1–7) over the given activities, in seconds. */
export function zoneTotals(activities: Activity[]) {
  const power = Array(7).fill(0) as number[];
  const hr = Array(7).fill(0) as number[];
  for (const a of activities) {
    for (const z of a.icu_zone_times ?? []) {
      const i = Number(z.id.replace("Z", "")) - 1; // "SS" (sweet spot) overlaps Z3–Z4: skipped
      if (i >= 0 && i < 7) power[i] = (power[i] ?? 0) + z.secs;
    }
    (a.icu_hr_zone_times ?? []).forEach((secs, i) => {
      if (i < 7) hr[i] = (hr[i] ?? 0) + secs;
    });
  }
  return { power, hr };
}

/** Everything the Training tab shows: a year of activities, 6 months of fitness, the plan. */
export async function loadTraining() {
  const date = today();
  const [activities, wellness, events] = await Promise.all([
    orNothing(
      intervals<Activity[]>(
        `/activities?oldest=${addDays(date, -364)}&newest=${date}&fields=${FIELDS}`,
        // A year of activities: cached 5 min, so tab prefetches don't refetch it on every open.
        { next: { revalidate: 300 } },
      ),
      [],
    ),
    orNothing(
      intervals<Wellness[]>(
        `/wellness?oldest=${addDays(date, -180)}&newest=${date}&cols=ctl,atl,rampRate`,
      ),
      [],
    ),
    orNothing(intervals<PlanEvent[]>(`/events?oldest=${date}&newest=${addDays(date, 13)}`), []),
  ]);
  const recent = activities.filter((a) => a.start_date_local >= addDays(date, -27));
  const known = wellness.filter((w) => w.ctl != null && w.atl != null);
  const fitness = known.map((w) => ({
    date: w.id,
    ctl: w.ctl as number,
    atl: w.atl as number,
    tsb: tsbOf(w) as number,
  }));
  const now = known.at(-1);
  return {
    date,
    feed: [...activities]
      .sort((a, b) => b.start_date_local.localeCompare(a.start_date_local))
      .slice(0, 30),
    year: weeklyVolume(activities, date, 52),
    zones: zoneTotals(recent),
    fitness,
    ctl: now?.ctl,
    atl: now?.atl,
    atlBefore: known.at(-2)?.atl,
    tsb: tsbOf(now),
    ramp: now?.rampRate,
    plan: events.filter(
      (e) => ["WORKOUT", "NOTE"].includes(e.category) || e.category.startsWith("RACE"),
    ),
  };
}
