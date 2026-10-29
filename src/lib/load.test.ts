import { expect, test } from "vitest";
import { intensityMix, intensityTrend, projectedLoad, weekLoads, weekZone } from "./load.ts";

test("intensity trend: COROS bands", () => {
  expect(intensityTrend(24, 31.5)).toEqual({ pct: 131, zone: "Optimized", state: "go" });
  expect(intensityTrend(20, 30)?.zone).toBe("Excessive");
  expect(intensityTrend(20, 16)?.zone).toBe("Maintaining");
  expect(intensityTrend(20, 12)?.zone).toBe("Performance");
  expect(intensityTrend(20, 9)).toMatchObject({ zone: "Decreasing", state: "mid" });
  expect(intensityTrend(0, 9)).toBeUndefined();
});

test("week zone against 7 × CTL", () => {
  // CTL 24 → usual week 168.
  expect(weekZone(120, 24).label).toBe("Losing fitness");
  expect(weekZone(150, 24).label).toBe("Maintaining fitness");
  expect(weekZone(203, 24).label).toBe("Safely building fitness");
  expect(weekZone(252, 24).label).toBe("Overreaching");
});

test("intensity mix names what's off", () => {
  const h = 3600;
  expect(intensityMix([h, h])).toBeUndefined();
  expect(intensityMix([4 * h, 4 * h, 0.5 * h, 0.5 * h])).toMatchObject({ tone: "go" });
  expect(intensityMix([3 * h, 3 * h, 2 * h, 0.5 * h])?.text).toMatch(/middle/);
  expect(intensityMix([2 * h, 2 * h, 0.5 * h, 1.5 * h])?.text).toMatch(/Too little easy/);
  expect(intensityMix([5 * h, 5 * h, 0.2 * h, 0])?.text).toMatch(/Almost all easy/);
});

test("week loads against the fitness each week started from", () => {
  const w = weekLoads(
    [
      { monday: "2026-10-19", load: 269 },
      { monday: "2026-10-26", load: 81 },
    ],
    (d) => (d === "2026-10-19" ? 21 : undefined),
  );
  expect(w[0]).toMatchObject({ usual: 147, zone: { label: "Overreaching" } });
  expect(w[1]?.zone).toBeUndefined();
});

test("projected load: today's plan minus what's already done today, later days in full", () => {
  const plan = [
    { day: "2026-10-28", load: 31 },
    { day: "2026-10-29", load: 18 },
    { day: "2026-10-29", load: 40 },
    { day: "2026-10-31", load: 82 },
  ];
  expect(projectedLoad(81, 0, plan, "2026-10-29")).toBe(81 + 58 + 82);
  expect(projectedLoad(101, 20, plan, "2026-10-29")).toBe(101 + 38 + 82);
  expect(projectedLoad(181, 100, plan, "2026-10-29")).toBe(181 + 82);
});
