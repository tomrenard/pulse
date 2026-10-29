import { type BadgeActivity, badges } from "@/lib/badges";
import { today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { beatsText, ftpOf, rideBeats, rideGrade, runBeats, runGrade } from "@/lib/level";
import { orNothing } from "@/lib/nights";

/** Record windows, as intervals.icu curve ids: all time, 12 months, 6 weeks. */
export const WINDOWS = [
  ["all", "PB"],
  ["1y", "12 mo"],
  ["42d", "6 wk"],
] as const;

export const RUN_DISTANCES = [
  [5000, "5 km"],
  [10000, "10 km"],
  [21097.5, "Half"],
  [42195, "Marathon"],
] as const;
const POWER_SECS = [
  [60, "1 min"],
  [300, "5 min"],
  [1200, "20 min"],
  [3600, "60 min"],
] as const;

type PowerCurve = {
  id: string;
  secs?: number[];
  watts?: number[];
  activity_id?: string[];
  /** W/kg at the weight recorded with each effort. */
  watts_per_kg?: number[];
};
export type PaceCurve = {
  id: string;
  distance?: number[];
  values?: number[];
  activity_id?: string[];
};

export const HOUR = { next: { revalidate: 3600 } };
const curves = WINDOWS.map(([id]) => id).join(",");

export type Best = { label: string; values: (number | undefined)[]; dates: (string | undefined)[] };

/**
 * TrainingPeaks-style latest bests: each distance or duration whose 12-month best is recent,
 * as an all-time PB (star) or a 12-month best (medal), newest first.
 */
export function latestBests(rows: (Best & { kind: "run" | "ride" })[], since: string, n = 5) {
  return rows
    .flatMap((r) => {
      const [pb, year] = r.values;
      const date = r.dates[1];
      if (year === undefined || !date || date < since) return [];
      return [{ label: r.label, kind: r.kind, value: year, date, pb: year === pb }];
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

/** Best value at `x` in a curve: exact point, or undefined if the curve doesn't reach it. */
export const at = <T>(xs: number[] = [], ys: T[] = [], x: number) => {
  const i = xs.findIndex((v) => Math.abs(v - x) < 1);
  return i >= 0 ? ys[i] : undefined;
};

/** Best run times (seconds) and best power (W) per window, from intervals.icu's best-effort curves. */
export async function loadRecords() {
  const [powerCurves, paceCurves, activities] = await Promise.all([
    orNothing(
      intervals<{ list: PowerCurve[] }>(`/power-curves.json?type=Ride&curves=${curves}`, HOUR),
      { list: [] },
    ),
    orNothing(
      intervals<{ list: PaceCurve[] }>(`/pace-curves.json?type=Run&curves=${curves}`, HOUR),
      { list: [] },
    ),
    orNothing(
      intervals<BadgeActivity[]>(
        `/activities?oldest=2021-01-01&newest=${today()}&fields=id,start_date_local,type,distance,moving_time,total_elevation_gain`,
        HOUR,
      ),
      [],
    ),
  ]);
  const powerAt = (id: string) => powerCurves.list.find((c) => c.id === id);
  const paceAt = (id: string) => paceCurves.list.find((c) => c.id === id);
  // The day of each best: the activity behind that point of the curve.
  const dayOf = new Map(activities.map((a) => [a.id, a.start_date_local.slice(0, 10)]));
  const when = (id = "") => dayOf.get(id);
  const run = RUN_DISTANCES.map(([d, label]) => ({
    label,
    distance: d as number,
    values: WINDOWS.map(([id]) => at(paceAt(id)?.distance, paceAt(id)?.values, d)),
    dates: WINDOWS.map(([id]) => when(at(paceAt(id)?.distance, paceAt(id)?.activity_id, d))),
  }));
  const power = POWER_SECS.map(([s, label]) => ({
    label,
    values: WINDOWS.map(([id]) => at(powerAt(id)?.secs, powerAt(id)?.watts, s)),
    dates: WINDOWS.map(([id]) => when(at(powerAt(id)?.secs, powerAt(id)?.activity_id, s))),
  }));
  // Power curves for the chart: 5 s to 1 h, about 40 points each, for all time, 12 months, 6 weeks.
  const curve = (id: string) => {
    const c = powerAt(id);
    return (c?.secs ?? []).flatMap((x, i) =>
      x >= 5 && x <= 3600 && c?.watts?.[i] && (i % 4 === 0 || POWER_SECS.some(([s]) => s === x))
        ? [{ secs: x, watts: c.watts[i] as number }]
        : [],
    );
  };
  /** Your PB level: all-time bests graded ("now" comes from the models, on the page). */
  const pbLevel = () => {
    const runTimes = run.map((r) => ({ distance: r.distance, secs: r.values[0] }));
    const curve = powerAt("all");
    const wkg = (s: number) => at(curve?.secs, curve?.watts_per_kg, s);
    const runG = runGrade(runTimes);
    const rideG = rideGrade(ftpOf(wkg(1200), wkg(3600)));
    return {
      run: runG && {
        ...runG,
        beats: ((b) => b && beatsText(b))(
          runBeats(runG.distance, runTimes.find((t) => t.distance === runG.distance)?.secs ?? 0),
        ),
      },
      ride: rideG && { ...rideG, beats: beatsText(rideBeats(rideG.wkg)) },
    };
  };
  return {
    run,
    power,
    curves: { all: curve("all"), year: curve("1y"), weeks: curve("42d") },
    pb: pbLevel(),
    badges: badges(activities, today()),
  };
}
