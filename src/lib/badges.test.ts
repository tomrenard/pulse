import { expect, test } from "vitest";
import { badges } from "./badges.ts";

const a = (date: string, type: string, km: number, h = 1, climb = 0) => ({
  start_date_local: `${date}T08:00:00`,
  type,
  distance: km * 1000,
  moving_time: h * 3600,
  total_elevation_gain: climb,
});

test("badges from activities and run bests", () => {
  const list = [
    a("2026-10-20", "Ride", 210, 7, 2000),
    a("2026-10-20", "Run", 10, 1),
    a("2026-10-21", "Run", 8),
    a("2026-10-13", "Ride", 50),
    a("2026-10-14", "Run", 5),
    a("2026-10-15", "Swim", 2),
    a("2025-06-01", "Ride", 100, 4, 9000),
  ];
  const b = Object.fromEntries(
    badges(list, "2026-10-24", [
      { distance: 42195, secs: 10750 },
      { distance: 5000, secs: 1300 },
    ]).map((x) => [x.title, x]),
  );
  expect(b["Longest ride"]).toMatchObject({ value: "210 km", earned: true });
  expect(b["Centuries"]?.value).toBe("2");
  expect(b["Brick days"]?.value).toBe("1");
  expect(b["Week streak"]?.value).toBe("2"); // this week (3) and last week (3)
  expect(b["Everest 2026"]?.value).toBe("0.2×"); // 2025's climbing doesn't count
  expect(b["Sub-3 marathon"]?.earned).toBe(true);
  expect(b["Sub-20 5 km"]?.earned).toBe(false);
});
