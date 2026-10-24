import { expect, test } from "vitest";
import {
  bestVdot,
  criticalSpeed,
  cyclingVo2,
  parseCorosFitness,
  predictTime,
  rideTime,
  stretches,
  swimCss,
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

test("critical speed needs real hard efforts from 2 runs", () => {
  const pts = (activity: string, list: [number, number][]) =>
    list.map(([distance, secs]) => ({ distance, secs, activity }));
  // CS 4 m/s, D' 200 m
  const good = [
    ...pts("a", [
      [920, 180],
      [1400, 300],
    ]),
    ...pts("b", [
      [2600, 600],
      [3800, 900],
    ]),
  ];
  const fit = criticalSpeed(good);
  expect(fit).toMatchObject({ cs: expect.closeTo(4, 5), dPrime: expect.closeTo(200, 3) });
  if ("cs" in fit) expect(predictTime(fit, 5000)).toBeCloseTo(1200);
  expect(
    criticalSpeed(
      pts("a", [
        [920, 180],
        [1400, 300],
        [2600, 600],
      ]),
    ),
  ).toHaveProperty("problem"); // one run
  expect(criticalSpeed(pts("a", [[920, 180]]))).toHaveProperty("problem");
});

test("COROS fitness overview parses, and fails loud on a new format", () => {
  const text = `Fitness Assessment Overview
========================

VO2max: 50
Running Level: 80
Threshold Pace: 4:30 /km
5 km Prediction: 21:00
10 km Prediction: 43:30
Half Marathon Prediction: 1:36:00
Marathon Prediction: 3:20:00`;
  expect(parseCorosFitness(text)).toEqual({
    vo2max: 50,
    k5: 1260,
    k10: 2610,
    half: 5760,
    marathon: 12000,
  });
  expect(() => parseCorosFitness("VO2max = 50; 5 km Prediction = 21 min")).toThrow(
    /format changed/,
  );
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
