import { expect, test } from "vitest";
import { addDays } from "./date.ts";
import {
  formPct,
  formTarget,
  formZone,
  loadPerHour,
  powerAt,
  powerVsFitness,
  projectFitness,
  rideCtlByDay,
} from "./outlook.ts";

test("fitness projection: steady load converges, rest makes you fresh", () => {
  const steady = projectFitness("2026-01-01", 50, 50, Array(10).fill(50));
  expect(steady.at(-1)?.ctl).toBeCloseTo(50);
  expect(steady.at(-1)?.tsb).toBeCloseTo(0);
  const rest = projectFitness("2026-01-01", 60, 70, Array(14).fill(0));
  expect(rest[0]?.tsb).toBeCloseTo(-10); // first day's form uses yesterday's numbers
  expect(rest.at(-1)?.tsb).toBeGreaterThan(10);
  expect(rest.at(-1)?.date).toBe("2026-01-15");
});

test("form % and race-length target", () => {
  expect(formPct({ ctl: 50, tsb: 5 })).toBe(10);
  expect(formTarget({ moving_time: 30 * 3600 })).toMatchObject({ low: 0, high: 10 });
  expect(formTarget({ moving_time: 20 * 60 })).toMatchObject({ low: 5, high: 20 });
  // intervals.icu race events often have no duration: distance decides, by sport.
  expect(formTarget({ type: "Ride", distance: 735_000 })).toMatchObject({ low: 0 });
  expect(formTarget({ type: "Run", distance: 10_000 })).toMatchObject({ low: 5 });
  expect(formTarget({ type: "Ride" })).toBeUndefined();
});

test("load per hour weights by time, not by session", () => {
  const acts = [
    { start_date_local: "2026-10-01", type: "Ride", icu_training_load: 300, moving_time: 6 * 3600 },
    {
      start_date_local: "2026-10-02",
      type: "VirtualRide",
      icu_training_load: 60,
      moving_time: 1800,
    },
    { start_date_local: "2026-10-02", type: "Run", icu_training_load: 50, moving_time: 3600 },
  ];
  expect(loadPerHour(acts, "ride", 40).rate).toBeCloseTo(360 / 6.5);
  expect(loadPerHour(acts, "run", 45)).toEqual({ rate: 45, typical: true }); // under 5 h
});

test("power vs ride fitness: fit, clamp, and refuse too little data", () => {
  // 30 weeks: ride 50 load every day from week 0, 20-min best = 150 + 2 × CTL.
  const acts = Array.from({ length: 210 }, (_, i) => ({
    start_date_local: addDays("2025-01-06", i),
    type: "Ride",
    icu_training_load: 50,
  }));
  const ctl = rideCtlByDay(acts, "2025-08-04");
  const weeks = Array.from({ length: 30 }, (_, i) => {
    const monday = addDays("2025-01-06", i * 7);
    return { monday, best20: 150 + 2 * (ctl.get(addDays(monday, 6)) ?? 0) };
  });
  const fit = powerVsFitness(weeks, ctl);
  if (!fit) throw new Error("expected a fit");
  expect(fit.b).toBeCloseTo(2, 1); // window and CTL dates line up
  expect(powerAt(fit, 1000)).toBeCloseTo(powerAt(fit, fit.maxCtl)); // clamped to seen range
  expect(powerVsFitness(weeks.slice(0, 10), ctl)).toBeUndefined();
});

test("form zones match intervals.icu's bands", () => {
  expect([25, 20, 10, 0, -10, -20, -30, -45].map((p) => formZone(p).name)).toEqual([
    "Transition",
    "Transition",
    "Fresh",
    "Grey zone",
    "Grey zone",
    "Optimal",
    "Optimal",
    "High risk",
  ]);
});
