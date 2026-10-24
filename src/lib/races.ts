import { linearFit } from "./readiness.ts";

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

/** COROS fitness overview text → numbers (seconds for times and pace per km). */
export function parseCorosFitness(text: string) {
  const time = (label: string) => {
    const m = text.match(new RegExp(`^${label}: (?:(\\d+):)?(\\d+):(\\d+)`, "m"));
    return m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined;
  };
  const num = (label: string) => {
    const m = text.match(new RegExp(`^${label}: (\\d+(?:\\.\\d+)?)`, "m"));
    return m ? Number(m[1]) : undefined;
  };
  const out = {
    vo2max: num("VO2max"),
    k5: time("5 km Prediction"),
    k10: time("10 km Prediction"),
    half: time("Half Marathon Prediction"),
    marathon: time("Marathon Prediction"),
  };
  if (/VO2max|Prediction/.test(text) && out.vo2max === undefined && out.k5 === undefined) {
    throw new Error("COROS fitness overview: format changed?");
  }
  return out;
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
  if (/\btri(athlon)?\b|ironman|70\.3/.test(name)) {
    const label = /sprint/.test(name)
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

/** Swim, bike and run distances (m) by triathlon label. */
const OLYMPIC: [number, number, number] = [1500, 40000, 10000];
const TRI_LEGS: Record<string, [number, number, number]> = {
  "Sprint triathlon": [750, 20000, 5000],
  "Olympic triathlon": OLYMPIC,
  "Half distance": [1900, 90000, 21097.5],
  "Full distance": [3800, 180000, 42195],
};
export const triLegs = (label: string) => TRI_LEGS[label] ?? OLYMPIC;

type Leg = { low: number; high: number } | { problem: string };

/**
 * A flat-course triathlon split, each leg as a range (s).
 *   Swim: CSS + 4 s/100 m (open water: wetsuit gains roughly offset sighting and the start),
 *         ±8 %. Without a usable CSS: "Needs pool data".
 *   Bike: steady-power physics on the flat at 80–88 % of FTP (Olympic) or 70–78 % (longer),
 *         race kit (CdA 0.28, Crr 0.004), weight + 9 kg.
 *   Run:  your race-day open time for the run distance (runSecs), 3–8 % slower off the bike (Bonacci 2011; Hausswirth 1997).
 *   T1 + T2: 3–6 min.
 * ponytail: flat course and no drafting; a GPX of the bike course would sharpen the bike leg.
 */
export function triSplit(
  label: string,
  x: { swimPer100?: number; ftp?: number; kg?: number; runSecs?: number },
) {
  const distances = triLegs(label);
  const [swimM, bikeM, runM] = distances;
  const swim: Leg = x.swimPer100
    ? ((s) => ({ low: s * 0.92, high: s * 1.08 }))(((x.swimPer100 + 4) * swimM) / 100)
    : { problem: "Needs pool data" };
  const [lo, hi] = bikeM > 40000 ? [0.7, 0.78] : [0.8, 0.88];
  const ride = (frac: number) =>
    rideTime([{ metres: bikeM, grade: 0 }], {
      watts: (x.ftp as number) * frac,
      kg: (x.kg ?? 70) + 9,
      cda: 0.28,
      crr: 0.004,
    }).secs;
  const bike: Leg = x.ftp ? { low: ride(hi), high: ride(lo) } : { problem: "Needs an FTP" };
  const run: Leg = x.runSecs
    ? { low: x.runSecs * 1.03, high: x.runSecs * 1.08 }
    : { problem: "Needs recent runs with heart rate" };
  const transitions = { low: 180, high: 360 };
  const legs = [swim, bike, run, transitions];
  const total = legs.every((l) => "low" in l)
    ? {
        low: legs.reduce((s, l) => s + (l as { low: number }).low, 0),
        high: legs.reduce((s, l) => s + (l as { high: number }).high, 0),
      }
    : undefined;
  return { distances, swim, bike, run, transitions, total };
}
