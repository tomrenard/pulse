import { expect, test } from "vitest";
import { intensityMix, intensityTrend, weekLoads, weekZone } from "./load.ts";

test("intensity trend: COROS bands, Performance vs Resuming by direction", () => {
  expect(intensityTrend(24, 31.5)).toEqual({ pct: 131, zone: "Optimized", state: "go" });
  expect(intensityTrend(20, 30)?.zone).toBe("Excessive");
  expect(intensityTrend(20, 16)?.zone).toBe("Maintaining");
  expect(intensityTrend(20, 12, 14)?.zone).toBe("Performance");
  expect(intensityTrend(20, 12, 10)?.zone).toBe("Resuming");
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
