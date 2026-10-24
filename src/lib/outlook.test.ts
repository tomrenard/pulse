import { expect, test } from "vitest";
import { addDays } from "./date.ts";
import {
  formPct,
  formTarget,
  loadPerHour,
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
  expect(formTarget(30 * 3600)).toMatchObject({ low: 0, high: 10 });
  expect(formTarget(20 * 60)).toMatchObject({ low: 5, high: 20 });
  expect(formTarget()).toMatchObject({ low: 5, high: 20 });
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
  expect(loadPerHour(acts, "ride", 40)).toBeCloseTo(360 / 6.5);
  expect(loadPerHour(acts, "run", 45)).toBe(45); // under 5 h of running: fallback
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
  expect(fit?.b).toBeGreaterThan(0);
  expect(fit?.at(1000)).toBeCloseTo(fit?.at(fit.maxCtl) ?? 0); // clamped to seen range
  expect(powerVsFitness(weeks.slice(0, 10), ctl)).toBeUndefined();
});
