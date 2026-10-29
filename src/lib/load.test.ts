import { expect, test } from "vitest";
import { intensityTrend, weekZone } from "./load.ts";

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
