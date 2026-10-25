import { expect, test } from "vitest";
import {
  bestVdot,
  cyclingVo2,
  raceInfo,
  rideTime,
  stretches,
  swimCss,
  swimPace,
  triSplit,
  vdot,
} from "./races.ts";

test("VDOT matches Daniels' tables", () => {
  expect(vdot(5000, 19 * 60 + 57)).toBeCloseTo(50, 0); // 19:57 5 km ≈ VDOT 50
  expect(vdot(42195, 3 * 3600 + 10 * 60 + 49)).toBeCloseTo(50, 0); // 3:10:49 marathon ≈ 50
  expect(
    bestVdot([
      { distance: 42195, secs: 10750 },
      { distance: 5000, secs: 1102 },
    ]),
  ).toBeCloseTo(vdot(5000, 1102));
});

test("cycling VO2max, Hawley & Noakes", () => {
  // 346 W at 5.12 W/kg → 67.6 kg; (0.01141 × 346 + 0.435) L/min ÷ 67.6 kg
  expect(cyclingVo2(346, 346 / 67.6)).toBeCloseTo(((0.01141 * 346 + 0.435) * 1000) / 67.6, 5);
  expect(cyclingVo2(undefined, 4)).toBeUndefined();
});

test("swim CSS refuses impossible times", () => {
  expect(swimCss(3, 15)).toHaveProperty("problem");
  expect(swimCss(200, 420)).toEqual({ per100: 110 });
  expect(swimCss(150, 290)).toHaveProperty("problem"); // CSS faster than the 200 m pace
  expect(swimCss(undefined, 420)).toHaveProperty("problem");
});

test("ride time: flat road at 200 W is about 32 km/h; climbs slow you down", () => {
  const flat = Array.from({ length: 100 }, () => ({ metres: 100, grade: 0 }));
  const setup = { watts: 200, kg: 78, cda: 0.3, crr: 0.005 };
  const speed = (r: ReturnType<typeof rideTime>) => (r.metres / r.secs) * 3.6;
  expect(speed(rideTime(flat, setup))).toBeGreaterThan(30);
  expect(speed(rideTime(flat, setup))).toBeLessThan(35);
  const hilly = flat.map((x, i) => ({ ...x, grade: i % 2 ? 0.06 : -0.06 }));
  const r = rideTime(hilly, setup);
  expect(speed(r)).toBeLessThan(speed(rideTime(flat, setup)));
  expect(r.climb).toBeCloseTo(300);
});

test("GPX points become ~100 m stretches", () => {
  // ~111 m per 0.001° latitude, 10 m up over the first stretch
  const pts: [number, number, number][] = [
    [52, 13, 0],
    [52.0005, 13, 5],
    [52.001, 13, 10],
    [52.002, 13, 10],
  ];
  const s = stretches(pts);
  expect(s[0]?.metres).toBeCloseTo(111, 0);
  expect(s[0]?.grade).toBeCloseTo(10 / 111, 2);
});

test("race info from names when intervals.icu has no distance", () => {
  expect(raceInfo({ name: "S25 Berlin 10k", type: "Run" })).toMatchObject({
    sport: "run",
    metres: 10000,
    label: "10 km",
  });
  expect(raceInfo({ name: "Hamburg Open Standard Triathlon", type: "Ride" })).toMatchObject({
    sport: "tri",
    label: "Olympic triathlon",
  });
  expect(raceInfo({ name: "Sudety Tour Granfondo (Broumov CZ)", type: "Ride" })).toMatchObject({
    sport: "ride",
    label: "Gran fondo",
  });
  expect(raceInfo({ name: "City Half Marathon" })).toMatchObject({
    sport: "run",
    metres: 21097.5,
    label: "Half",
  });
  // The type wins over the name.
  expect(raceInfo({ name: "Cyclassics Hamburg 160 km", type: "Ride" })).toMatchObject({
    sport: "ride",
  });
  expect(raceInfo({ name: "MTB Marathon Harz", type: "MountainBikeRide" })).toMatchObject({
    sport: "ride",
  });
  expect(raceInfo({ name: "Swim 3.8 km", type: "Swim" })).toMatchObject({ sport: "other" });
  expect(raceInfo({ name: "Trail 50k", type: "Run" })).toMatchObject({
    metres: 50000,
    label: "50 km",
  });
  expect(raceInfo({ name: "T100 Lake Las Vegas" })).toMatchObject({ sport: "tri", label: "T100" });
  expect(raceInfo({ name: "Marathon relay", type: "Run" })).toMatchObject({
    sport: "run",
    metres: undefined,
  });
});

test("Olympic tri split: legs in sane ranges", () => {
  const t = triSplit("Olympic triathlon", {
    swim: { per100: 104, spread: 0.08 },
    ftp: 250,
    kg: 70,
    runSecs: 2400,
  });
  expect(t.distances).toEqual([1500, 40000, 10000]);
  const leg = (l: typeof t.swim) => ("low" in l ? l : { low: 0, high: 0 });
  expect(leg(t.swim).low).toBeCloseTo(1560 * 0.92);
  // 200–225 W on the flat in race kit: 36–40 km/h.
  expect(40000 / leg(t.bike).low).toBeGreaterThan(10);
  expect(40000 / leg(t.bike).high).toBeGreaterThan(9.5);
  expect(leg(t.run).low).toBeCloseTo(2400 * 1.06);
  expect(t.total).toMatchObject({ swim: true });
  expect(t.total?.low).toBeLessThan(t.total?.high ?? 0);
});

test("tri without swim data: total of the rest, marked", () => {
  const t = triSplit("Olympic triathlon", { ftp: 250, runSecs: 2400 });
  expect(t.swim).toHaveProperty("problem");
  expect(t.total).toMatchObject({ swim: false });
  expect(triSplit("Olympic triathlon", { runSecs: 2400 }).total).toBeUndefined(); // no FTP
});

test("longer tri: easier bike, bigger run fade", () => {
  const x = { ftp: 250, kg: 70, runSecs: 3 * 3600 };
  const full = triSplit("Full distance", x);
  const half = triSplit("Half distance", x);
  const low = (l: typeof full.run) => ("low" in l ? l.low : 0);
  expect(low(full.run)).toBeCloseTo(3 * 3600 * 1.25);
  expect(low(full.run) / (3 * 3600)).toBeGreaterThan(low(half.run) / (3 * 3600));
  // Ironman bike at 60–70 % FTP: 180 km in roughly 5–6 h on the flat.
  expect(low(full.bike)).toBeGreaterThan(5 * 3600);
  expect(low(full.bike)).toBeLessThan(6.5 * 3600);
  expect(triSplit("T100", x).distances).toEqual([2000, 80000, 18000]);
});

test("swim pace: CSS first, then recent training pace, never an impossible one", () => {
  const recent = { metres: 6000, secs: 6000 * 1.1 }; // 1:50/100 m
  expect(swimPace({ per100: 100 }, recent)).toEqual({ per100: 104, spread: 0.08 });
  expect(swimPace({ problem: "x" }, recent)?.per100).toBeCloseTo(110);
  expect(swimPace({ problem: "x" }, { metres: 6000, secs: 3000 })).toBeUndefined(); // 0:50/100 m
  expect(swimPace({ problem: "x" }, { metres: 1000, secs: 1100 })).toBeUndefined(); // too little
});
