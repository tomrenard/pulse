import { expect, test } from "vitest";
import { addDays } from "./date.ts";
import { reviewSunday, weeklyReview } from "./review.ts";

const sunday = "2026-10-25";
/** 40 nights around 80 ms ending on Sunday; the last `low` nights at 50 ms. */
const nights = (low = 0) =>
  Array.from({ length: 40 }, (_, i) => ({
    date: addDays(sunday, i - 39),
    hrv: i >= 40 - low ? 50 : 80 + ((i * 7) % 11) - 5,
  }));
const base = { sunday, doneHours: 8, plannedHours: 8, ctlBefore: 50, ctlAfter: 53 };

test("review week: today on a Sunday, else the Sunday before", () => {
  expect(reviewSunday("2026-10-25")).toBe("2026-10-25");
  expect(reviewSunday("2026-10-26")).toBe("2026-10-25");
  expect(reviewSunday("2026-10-24")).toBe("2026-10-18");
});

test("on plan, steady HRV: keep going", () => {
  const r = weeklyReview({ ...base, nights: nights() });
  expect(r.fitness).toBe(3);
  expect(r.hrvLow).toBe(false);
  expect(r.suggestion).toMatch(/solid/);
});

test("HRV low wins over everything else", () => {
  const r = weeklyReview({ ...base, ctlAfter: 60, doneHours: 2, nights: nights(6) });
  expect(r.hrvLow).toBe(true);
  expect(r.hrvTrend).toBeLessThan(0);
  expect(r.suggestion).toMatch(/easy/);
});

test("fast ramp, then plan share, then slipping fitness", () => {
  expect(weeklyReview({ ...base, ctlAfter: 59, nights: nights() }).suggestion).toMatch(/lighter/);
  expect(weeklyReview({ ...base, doneHours: 4, nights: nights() }).suggestion).toMatch(/chase/);
  expect(weeklyReview({ ...base, doneHours: 11, nights: nights() }).suggestion).toMatch(/More/);
  const none = { ...base, plannedHours: 0, ctlAfter: 45, nights: nights() };
  expect(weeklyReview(none).suggestion).toMatch(/slipped/);
});
