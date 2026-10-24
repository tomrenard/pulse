import { linearFit } from "./readiness.ts";

/**
 * Race-tab estimates. Each says where it comes from; none is shown when its data is too thin.
 * - Running VO2max: Daniels & Gilbert VDOT from a best effort (5 km to half marathon).
 * - Cycling VO2max: Hawley & Noakes 1992, VO2max (L/min) = 0.01141 × W(5 min) + 0.435.
 * - Swim CSS: (400 − 200) / (t400 − t200), only if both times are humanly possible.
 * - 5 km / 10 km from critical speed: d = CS·t + D′ on 3–15 min best efforts of the last
 *   12 weeks (≥ 3 points, longest ≥ 2× shortest, from ≥ 2 runs, D′ 100–400 m so the efforts
 *   were near all-out); shown ±6 % (back-test on own races, widened after review).
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

type Point = { distance: number; secs: number; activity: string };

/** Critical speed (m/s) and D′ (m) from best efforts, or why there's no valid fit. */
export function criticalSpeed(
  points: Point[],
): { cs: number; dPrime: number } | { problem: string } {
  const pts = points.filter((p) => p.secs >= 180 && p.secs <= 900);
  if (pts.length < 3) return { problem: "Needs best efforts between 3 and 15 min." };
  const shortest = Math.min(...pts.map((p) => p.secs));
  const longest = Math.max(...pts.map((p) => p.secs));
  if (longest < 2 * shortest) return { problem: "Needs efforts of more different lengths." };
  // One run's pace fade alone gives absurd speeds (back-test): the points must span 2 runs.
  if (new Set(pts.map((p) => p.activity)).size < 2) {
    return { problem: "Needs hard efforts from at least 2 different runs in 12 weeks." };
  }
  const { a: dPrime, b: cs } = linearFit(
    pts.map((p) => p.secs),
    pts.map((p) => p.distance),
  );
  if (!(cs > 0)) return { problem: "The efforts don't fit the model." };
  // A D′ under ~100 m means the efforts weren't all-out (review of the back-test: median 73 m).
  if (dPrime < 100 || dPrime > 400) {
    return { problem: "Recent efforts look easier than all-out, so a race estimate would be off." };
  }
  return { cs, dPrime };
}

export const predictTime = (fit: { cs: number; dPrime: number }, metres: number) =>
  (metres - fit.dPrime) / fit.cs;

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
 * ("S25 Berlin 10k", "Hamburg Open Standard Triathlon").
 */
export function raceInfo(e: {
  name?: string;
  type?: string;
  distance?: number;
  distance_target?: number;
}) {
  const name = (e.name ?? "").toLowerCase();
  const metres = e.distance ?? e.distance_target;
  if (/tri(athlon)?\b|ironman|70\.3/.test(name)) {
    const sprint = /sprint/.test(name);
    return {
      sport: "tri" as const,
      metres: undefined,
      label: sprint
        ? "Sprint triathlon"
        : /half|70\.3/.test(name)
          ? "Half distance"
          : /ironman|full/.test(name)
            ? "Full distance"
            : "Olympic triathlon",
    };
  }
  if (/run/i.test(e.type ?? "") || /\b(\d+(?:\.\d+)?)\s?k(m)?\b|marathon|half/.test(name)) {
    const km = name.match(/\b(\d+(?:\.\d+)?)\s?k(m)?\b/)?.[1];
    const d =
      metres ??
      (km
        ? Number(km) * 1000
        : /half/.test(name)
          ? 21097.5
          : /marathon/.test(name)
            ? 42195
            : undefined);
    if (/run/i.test(e.type ?? "") || d)
      return {
        sport: "run" as const,
        metres: d,
        label: d ? `${d >= 42000 ? "Marathon" : d >= 21000 ? "Half" : `${d / 1000} km`}` : "Run",
      };
  }
  return {
    sport: /ride|bike|fondo|gravel|tour/i.test(`${e.type} ${name}`)
      ? ("ride" as const)
      : ("other" as const),
    metres,
    label: /fondo/.test(name) ? "Gran fondo" : (e.type ?? "Race"),
  };
}
