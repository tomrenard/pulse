import { expect, test } from "vitest";
import { formPct, formTarget, formVerdict, formZone, projectFitness } from "./outlook.ts";

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

test("form zones are COROS's trend bands told on form %", () => {
  // Form −31 % = trend 131 % (Optimized); −50 % = 150 % (Excessive); +20 % = 80 % (Maintaining).
  expect([60, 50, 30, 20, 5, 0, -31, -50, -60].map((p) => formZone(p).name)).toEqual([
    "Decreasing",
    "Performance",
    "Performance",
    "Maintaining",
    "Maintaining",
    "Optimized",
    "Optimized",
    "Excessive",
    "Excessive",
  ]);
});

test("race-day verdict: target edges count as on target", () => {
  const t = { low: 0, high: 10 };
  expect(formVerdict(-1, t)).toMatch(/too tired/);
  expect(formVerdict(0, t)).toBe("on target");
  expect(formVerdict(10, t)).toBe("on target");
  expect(formVerdict(11, t)).toBe("fresher than needed");
});
