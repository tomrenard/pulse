/**
 * Race-tab estimates. Each says where it comes from; none is shown when its data is too thin.
 * - Running VO2max: Daniels & Gilbert VDOT from a best effort (5 km to half marathon).
 * - Cycling VO2max: Hawley & Noakes 1992, VO2max (L/min) = 0.01141 × W(5 min) + 0.435.
 * - Swim CSS: (400 − 200) / (t400 − t200), only if both times are humanly possible.
 */

/** Daniels VDOT from a performance: distance (m) and time (s). */
export function vdot(metres: number, secs: number) {
  const t = secs / 60;
  const v = metres / t; // m/min
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const fraction = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / fraction;
}

/** Best VDOT over the given efforts (the one that says the most about you). */
export const bestVdot = (efforts: { distance: number; secs?: number }[]) =>
  Math.max(
    0,
    ...efforts.flatMap((e) =>
      e.secs && e.distance >= 1500 && e.distance <= 21100 ? [vdot(e.distance, e.secs)] : [],
    ),
  ) || undefined;

/** Hawley & Noakes, ml/kg/min, from best 5-min power and its W/kg. */
export function cyclingVo2(watts?: number, wkg?: number) {
  if (!watts || !wkg) return undefined;
  const kg = watts / wkg;
  return ((0.01141 * watts + 0.435) * 1000) / kg;
}

/** Critical swim speed in s/100 m, or a reason when the times can't be real (wrong pool length). */
export function swimCss(t200?: number, t400?: number): { per100: number } | { problem: string } {
  if (!t200 || !t400) return { problem: "Needs a best 200 m and 400 m swim." };
  // World records: ~1:41 for 200 m, ~3:40 for 400 m. Anything faster is a recording error.
  // A 400 m can't be swum at a faster pace than a 200 m: t400 must exceed twice t200.
  if (t200 < 95 || t400 < 210 || t400 <= 2 * t200) {
    return {
      problem: `Swim bests look off (200 m in ${t200} s): check the pool length on your swims.`,
    };
  }
  return { per100: (t400 - t200) / 2 };
}

/** A route as ~100 m stretches: length (m) and gradient (rise/run). */
export type Stretch = { metres: number; grade: number };

const toRad = (d: number) => (d * Math.PI) / 180;
const haversine = (a: [number, number], b: [number, number]) => {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

/** GPX track points [lat, lon, ele] → ~100 m stretches (smooths GPS elevation noise). */
const STRETCH_M = 100;

export function stretches(points: [number, number, number][]): Stretch[] {
  const out: Stretch[] = [];
  let start = points[0];
  let metres = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1] as [number, number, number];
    const p = points[i] as [number, number, number];
    metres += haversine([prev[0], prev[1]], [p[0], p[1]]);
    if (metres >= STRETCH_M || i === points.length - 1) {
      if (start && metres > 0) out.push({ metres, grade: (p[2] - start[2]) / metres });
      start = p;
      metres = 0;
    }
  }
  return out;
}

type RideSetup = { watts: number; kg: number; cda: number; crr: number };

/**
 * Steady-power physics: P·η = ½ρ·CdA·v³ + m·g·(Crr·cosθ + sinθ)·v, solved per stretch.
 * Descents are capped at 55 km/h (braking, corners, gravel), and no stretch below 4 km/h.
 */
export function rideTime(route: Stretch[], s: RideSetup) {
  const g = 9.81;
  const rho = 1.2;
  const eta = 0.97;
  const vMax = 55 / 3.6;
  let secs = 0;
  let climb = 0;
  for (const { metres, grade } of route) {
    const theta = Math.atan(grade);
    const resist = s.kg * g * (s.crr * Math.cos(theta) + Math.sin(theta));
    const power = (v: number) => 0.5 * rho * s.cda * v ** 3 + resist * v;
    let lo = 0;
    let hi = vMax;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (power(mid) < s.watts * eta) lo = mid;
      else hi = mid;
    }
    secs += metres / Math.max(lo, 4 / 3.6);
    if (grade > 0) climb += grade * metres;
  }
  const metres = route.reduce((sum, r) => sum + r.metres, 0);
  return { secs, metres, climb };
}

/**
 * Sport and distance of a planned race, from intervals.icu's fields or its name when they're empty
 * ("S25 Berlin 10k", "Hamburg Open Standard Triathlon"). The event type wins over the name, so
 * a "Radmarathon" ride stays a ride.
 */
export function raceInfo(e: {
  name?: string;
  type?: string;
  distance?: number;
  distance_target?: number;
}) {
  const name = (e.name ?? "").toLowerCase();
  const type = (e.type ?? "").toLowerCase();
  const metres = e.distance ?? e.distance_target;
  if (/\btri(athlon)?\b|ironman|70\.3|\bt100\b/.test(name)) {
    const label = /\bt100\b/.test(name)
      ? "T100"
      : /sprint/.test(name)
        ? "Sprint triathlon"
        : /half|70\.3/.test(name)
          ? "Half distance"
          : /ironman|full/.test(name)
            ? "Full distance"
            : "Olympic triathlon";
    return { sport: "tri" as const, metres: undefined, label };
  }
  if (/ride|bike|cycl/.test(type) || (!type && /fondo|gravel|rad|tour/.test(name))) {
    return { sport: "ride" as const, metres, label: /fondo/.test(name) ? "Gran fondo" : "Ride" };
  }
  if (/swim/.test(type)) return { sport: "other" as const, metres, label: "Swim" };
  if (!type || /run/.test(type)) {
    const km = name.match(/\b(\d+(?:\.\d+)?)\s?k(m)?\b/)?.[1];
    const d =
      metres ??
      (km
        ? Number(km) * 1000
        : /half/.test(name)
          ? 21097.5
          : /marathon/.test(name) && !/relay|staffel/.test(name)
            ? 42195
            : undefined);
    if (/run/.test(type) || d) {
      const label = !d
        ? "Run"
        : Math.abs(d - 42195) < 200
          ? "Marathon"
          : Math.abs(d - 21097.5) < 100
            ? "Half"
            : `${d / 1000} km`;
      return { sport: "run" as const, metres: d, label };
    }
  }
  return { sport: "other" as const, metres, label: e.type ?? "Race" };
}

/**
 * Each triathlon: swim, bike and run distances (m), bike effort as a share of FTP and how much
 * slower you run off the bike than fresh.
 *   Bike: age-group intensity, Friel (Olympic 80–90 %, 70.3 70–80 %, Ironman 60–70 %); T100's
 *         80 km in between.
 *   Run fade: Tri-Alliance's race-pacing guide (sprint ~6 %, Olympic ~10 %, 70.3 ~18 %,
 *         Ironman 30 %+), a coaching rule, not a study: hence the wide ranges.
 */
const TRI = {
  "Sprint triathlon": { legs: [750, 20000, 5000], bike: [0.85, 0.95], fade: [1.03, 1.09] },
  "Olympic triathlon": { legs: [1500, 40000, 10000], bike: [0.8, 0.9], fade: [1.06, 1.14] },
  T100: { legs: [2000, 80000, 18000], bike: [0.72, 0.82], fade: [1.1, 1.2] },
  "Half distance": { legs: [1900, 90000, 21097.5], bike: [0.7, 0.8], fade: [1.12, 1.24] },
  "Full distance": { legs: [3800, 180000, 42195], bike: [0.6, 0.7], fade: [1.25, 1.4] },
} as const satisfies Record<
  string,
  { legs: readonly number[]; bike: readonly number[]; fade: readonly number[] }
>;
export type TriLabel = keyof typeof TRI;
const triOf = (label: string) => TRI[label as TriLabel] ?? TRI["Olympic triathlon"];
export const triLegs = (label: string) => triOf(label).legs;

type Leg = { low: number; high: number } | { problem: string };

/**
 * A flat-course triathlon finish, each leg as a range (s).
 *   Swim: your race pace per 100 m with its spread (CSS + 4 s, ±8 %; or recent training pace,
 *         ±12 %). Without one: left out, and the total says "+ swim".
 *   Bike: steady-power physics on the flat at the distance's share of FTP, race kit
 *         (CdA 0.28, Crr 0.004), weight + 9 kg.
 *   Run:  your fresh time for the run distance (runSecs) times the distance's run fade.
 *   T1 + T2: 3–6 min.
 * ponytail: flat course and no drafting; a GPX of the bike course would sharpen the bike leg.
 */
export function triSplit(
  label: string,
  x: { swim?: { per100: number; spread: number }; ftp?: number; kg?: number; runSecs?: number },
) {
  const t = triOf(label);
  const [swimM, bikeM] = t.legs;
  const swim: Leg = x.swim
    ? ((s, k) => ({ low: s * (1 - k), high: s * (1 + k) }))(
        (x.swim.per100 * swimM) / 100,
        x.swim.spread,
      )
    : { problem: "No usable swim data" };
  const ride = (frac: number) =>
    rideTime([{ metres: bikeM, grade: 0 }], {
      watts: (x.ftp as number) * frac,
      kg: (x.kg ?? 70) + 9,
      cda: 0.28,
      crr: 0.004,
    }).secs;
  const bike: Leg = x.ftp
    ? { low: ride(t.bike[1]), high: ride(t.bike[0]) }
    : { problem: "Needs an FTP" };
  const run: Leg = x.runSecs
    ? { low: x.runSecs * t.fade[0], high: x.runSecs * t.fade[1] }
    : { problem: "Needs recent runs with heart rate" };
  const transitions = { low: 180, high: 360 };
  // Without a swim the total is bike + run + transitions, shown as "+ swim".
  const counted = "low" in swim ? [swim, bike, run, transitions] : [bike, run, transitions];
  const total = counted.every((l) => "low" in l)
    ? {
        low: counted.reduce((s, l) => s + (l as { low: number }).low, 0),
        high: counted.reduce((s, l) => s + (l as { high: number }).high, 0),
        swim: "low" in swim,
      }
    : undefined;
  return { distances: t.legs, swim, bike, run, transitions, total };
}

/**
 * Your race pace for a triathlon swim (s/100 m): CSS + 4 s when the pool bests are real, else
 * your recent training pace (rougher, and only as good as the pool length on those swims).
 */
export function swimPace(
  css: ReturnType<typeof swimCss>,
  recent: { metres: number; secs: number },
): { per100: number; spread: number } | undefined {
  if ("per100" in css) return { per100: css.per100 + 4, spread: 0.08 };
  if (recent.metres < 1500) return undefined;
  const per100 = recent.secs / (recent.metres / 100);
  // Faster than ~1:10/100 m over training is a world-class pace: the distance is wrong.
  return per100 >= 70 && per100 <= 240 ? { per100, spread: 0.12 } : undefined;
}
