/**
 * Running potential, built to stay honest when recent runs are all easy:
 * - "Now": Runalyze's VO2max from heart rate vs pace on each road run (open-source
 *   LegacyEffectiveVO2max): %VO2max = e^((HR/HRmax − 1.00466) / 0.68725), speed at 100 % =
 *   speed / %VO2max, then Daniels' oxygen cost. 30-day average, scaled so your fittest stretch
 *   matches your best performance from the same years (the correction Runalyze takes from a race).
 * - "Race day": Tanda 2011 marathon pace from weekly km and training pace (SE ~4–5 min), turned
 *   into a VDOT; you move from Now towards it with a ~10-week time constant (heuristic, labelled).
 * - Times from a VDOT: Daniels & Gilbert, solved for time.
 */
import { addDays } from "./date.ts";
import { vdot } from "./races.ts";

export type Run = {
  start_date_local: string;
  distance?: number;
  moving_time?: number;
  average_heartrate?: number;
};

/** Raw HR-based VO2max for one run, or undefined if the run can't say much (short, too easy). */
export function hrVo2(run: Run, hrMax: number) {
  const { distance, moving_time: secs, average_heartrate: hr } = run;
  if (!distance || !secs || !hr || secs < 20 * 60 || hr < 0.6 * hrMax) return undefined;
  const v = distance / (secs / 60); // m/min
  const pct = Math.exp((hr / hrMax - 1.00466) / 0.68725);
  const v100 = v / pct;
  return -4.6 + 0.182258 * v100 + 0.000104 * v100 * v100;
}

/** 30-day average of HR-based VO2max at each run date (needs 5 runs in the window: one odd run can't dominate). */
export function hrVo2Series(runs: Run[], hrMax: number) {
  const points = runs
    .map((r) => ({ date: r.start_date_local.slice(0, 10), v: hrVo2(r, hrMax) }))
    .filter((p): p is { date: string; v: number } => p.v !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));
  // Sliding window over sorted points: O(n), not a re-scan per point.
  const out: { date: string; raw: number }[] = [];
  let start = 0;
  let sum = 0;
  points.forEach((p, i) => {
    sum += p.v;
    const from = addDays(p.date, -30);
    while ((points[start] as { date: string }).date <= from)
      sum -= (points[start++] as { v: number }).v;
    const n = i - start + 1;
    if (n >= 5) out.push({ date: p.date, raw: sum / n });
  });
  return out;
}

/**
 * Scale the series so its fittest stretch equals your best VDOT from the same years. The
 * stretch is the 90th percentile of the series, not its single maximum, so one odd window
 * (a treadmill over-reading, a strap glitch) can't set the scale.
 */
export function calibrate(series: { date: string; raw: number }[], bestVdot: number) {
  const sorted = series.map((s) => s.raw).sort((a, b) => a - b);
  const peak = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
  const k = peak > 0 ? bestVdot / peak : 1;
  return series.map((s) => ({ date: s.date, vdot: s.raw * k }));
}

/** Time (s) to run `metres` at a given VDOT (Daniels & Gilbert, solved by bisection). */
export function timeAt(v: number, metres: number) {
  let lo = 60;
  let hi = 60 * 60 * 12;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    // A slower time gives a lower VDOT: move towards the target.
    if (vdot(metres, mid) > v) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Tanda 2011: marathon time (s) from mean weekly km and mean training pace (s/km), 8 weeks. */
export const tandaMarathon = (weeklyKm: number, paceSecPerKm: number) =>
  (17.1 + 140 * Math.exp(-0.0053 * weeklyKm) + 0.55 * paceSecPerKm) * 42.195;

export type Anchor = { vdot: number; weeklyKm: number; pace: number };

/**
 * VDOT on race day after `weeks` of `weeklyKm`. The ceiling is anchored to you: your best VDOT,
 * scaled by how much that volume supports compared with what you ran when you were fittest
 * (Tanda's volume effect at your training pace back then). Raw Tanda alone is a marathon formula
 * and would make low volume look like lost 10 km speed. You move from now towards the ceiling with a
 * ~10-week time constant: a heuristic, no validated retraining curve exists.
 */
export function raceDayVdot(now: number, weeklyKm: number, anchor: Anchor, weeks: number) {
  const support = (km: number) => vdot(42195, tandaMarathon(km, anchor.pace));
  // Capped at your best: more volume than back then is no promise of beating it.
  const ceiling = Math.min(
    anchor.vdot,
    anchor.vdot * (support(weeklyKm) / support(anchor.weeklyKm)),
  );
  return ceiling - (ceiling - now) * Math.exp(-weeks / 10);
}

/** Weekly km and pace over the 8 weeks before `date`. */
export function volumeBefore(runs: Run[], date: string) {
  const from = addDays(date, -56);
  const inWindow = runs.filter(
    (r) => r.start_date_local.slice(0, 10) > from && r.start_date_local.slice(0, 10) <= date,
  );
  const km = inWindow.reduce((s, r) => s + (r.distance ?? 0), 0) / 1000;
  const secs = inWindow.reduce((s, r) => s + (r.moving_time ?? 0), 0);
  return { weeklyKm: km / 8, pace: km > 0 ? secs / km : 345 };
}
