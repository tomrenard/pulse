import { type BadgeActivity, badges } from "@/lib/badges";
import { today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { ftpOf, rideBeats, rideGrade, runBeats, runGrade } from "@/lib/level";
import { orNothing } from "@/lib/nights";

/** Record windows, as intervals.icu curve ids: all time, 1 year, 6 months, 6 weeks. */
export const WINDOWS = [
  ["all", "PB"],
  ["1y", "12 mo"],
  ["182d", "6 mo"],
  ["42d", "6 wk"],
] as const;

export const RUN_DISTANCES = [
  [5000, "5 km"],
  [10000, "10 km"],
  [21097.5, "Half"],
  [42195, "Marathon"],
] as const;
export const POWER_SECS = [
  [60, "1 min"],
  [300, "5 min"],
  [1200, "20 min"],
  [3600, "60 min"],
] as const;

type PowerCurve = {
  id: string;
  secs?: number[];
  watts?: number[];
  powerModels?: { ftp?: number }[];
};
type PaceCurve = { id: string; distance?: number[]; values?: number[] };
type Athlete = { icu_weight?: number; sportSettings?: { types?: string[]; ftp?: number }[] };

const HOUR = { next: { revalidate: 3600 } };
const curves = WINDOWS.map(([id]) => id).join(",");

/** Best value at `x` in a curve: exact point, or undefined if the curve doesn't reach it. */
const at = (xs: number[] = [], ys: number[] = [], x: number) => {
  const i = xs.findIndex((v) => Math.abs(v - x) < 1);
  return i >= 0 ? ys[i] : undefined;
};

/** Best run times (seconds) and best power (W) per window, from intervals.icu's best-effort curves. */
export async function loadRecords() {
  const [powerCurves, paceCurves, athlete, activities] = await Promise.all([
    orNothing(
      intervals<{ list: PowerCurve[] }>(`/power-curves.json?type=Ride&curves=${curves}`, HOUR),
      { list: [] },
    ),
    orNothing(
      intervals<{ list: PaceCurve[] }>(`/pace-curves.json?type=Run&curves=${curves}`, HOUR),
      { list: [] },
    ),
    orNothing(intervals<Athlete>(""), {}),
    orNothing(
      intervals<BadgeActivity[]>(
        `/activities?oldest=2021-01-01&newest=${today()}&fields=start_date_local,type,distance,moving_time,total_elevation_gain`,
        HOUR,
      ),
      [],
    ),
  ]);
  const byId =
    <T extends { id: string }>(list: T[]) =>
    (id: string) =>
      list.find((c) => c.id === id);
  const powerAt = byId(powerCurves.list);
  const paceAt = byId(paceCurves.list);
  const run = RUN_DISTANCES.map(([d, label]) => ({
    label,
    distance: d as number,
    values: WINDOWS.map(([id]) => at(paceAt(id)?.distance, paceAt(id)?.values, d)),
  }));
  const power = POWER_SECS.map(([s, label]) => ({
    label,
    values: WINDOWS.map(([id]) => at(powerAt(id)?.secs, powerAt(id)?.watts, s)),
  }));
  const kg = athlete.icu_weight ?? 0;
  /** Level for one window: 0 = PB (all time), 3 = last 6 weeks. */
  const level = (w: number) => {
    const runTimes = run.map((r) => ({ distance: r.distance, secs: r.values[w] }));
    const ftp = ftpOf(power[2]?.values[w], power[3]?.values[w]);
    const runG = runGrade(runTimes);
    const rideG = rideGrade(ftp, kg);
    return {
      run: runG && {
        ...runG,
        beats: runBeats(
          runG.distance,
          runTimes.find((t) => t.distance === runG.distance)?.secs ?? 0,
        ),
      },
      ride: rideG && { ...rideG, ftp, beats: rideBeats(rideG.wkg) },
    };
  };
  return {
    run,
    power,
    ftpSet: athlete.sportSettings?.find((x) => x.types?.includes("Ride"))?.ftp,
    /** intervals.icu's power-model FTP from the last 6 weeks of riding. */
    ftpModel: powerAt("42d")?.powerModels?.[0]?.ftp,
    kg,
    pb: level(0),
    now: level(3),
    badges: badges(
      activities,
      today(),
      run.map((r) => ({ distance: r.distance, secs: r.values[0] })),
    ),
  };
}
