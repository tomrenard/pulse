import { expect, test } from "vitest";
import {
  calibrate,
  hrVo2,
  hrVo2Series,
  raceDayVdot,
  tandaMarathon,
  timeAt,
  volumeBefore,
} from "./potential.ts";
import { vdot } from "./races.ts";

test("time at a VDOT inverts Daniels", () => {
  expect(timeAt(vdot(10000, 2400), 10000)).toBeCloseTo(2400, 0);
  expect(timeAt(50, 5000)).toBeCloseTo(19 * 60 + 57, -1); // VDOT 50 ≈ 19:57 5 km
});

test("Tanda: 60 km/week at 5:00/km ≈ 3:20; 90 km at 4:30 ≈ 2:58", () => {
  const t = tandaMarathon(60, 300);
  expect(t).toBeCloseTo(3 * 3600 + 19 * 60 + 42, -1);
  expect(tandaMarathon(90, 270)).toBeCloseTo(2 * 3600 + 57 * 60 + 34, -1);
  expect(tandaMarathon(40, 300)).toBeGreaterThan(t); // less volume, slower
});

test("HR-based VO2max: harder effort at the same pace reads lower fitness", () => {
  const run = (hr: number) => ({
    start_date_local: "2026-10-01",
    distance: 10000,
    moving_time: 3000,
    average_heartrate: hr,
  });
  const easy = hrVo2(run(140), 196) as number;
  const hard = hrVo2(run(170), 196) as number;
  expect(easy).toBeGreaterThan(hard);
  expect(hrVo2({ ...run(140), moving_time: 600 }, 196)).toBeUndefined(); // too short to say
});

test("series needs 5 runs in 30 days; calibration maps the fittest stretch to the best VDOT", () => {
  const runs = [1, 4, 7, 10, 13, 16].map((d) => ({
    start_date_local: `2026-10-${String(d).padStart(2, "0")}`,
    distance: 10000,
    moving_time: 3000,
    average_heartrate: 145,
  }));
  const series = hrVo2Series(runs, 196);
  expect(series).toHaveLength(2);
  expect(hrVo2Series(runs.slice(0, 4), 196)).toHaveLength(0);
  const cal = calibrate(series, 57);
  expect(Math.max(...cal.map((c) => c.vdot))).toBeCloseTo(57);
  // An odd window can't set the scale: the 90th percentile does.
  const odd = calibrate(
    [...Array.from({ length: 19 }, (_, i) => ({ date: `d${i}`, raw: 50 })), { date: "x", raw: 80 }],
    57,
  );
  expect(odd[0]?.vdot).toBeCloseTo(57);
});

test("race day: back to PB level at PB-era volume, less with less, never below now by default", () => {
  const anchor = { vdot: 57, weeklyKm: 50, pace: 300 };
  expect(raceDayVdot(47, 50, anchor, 1000)).toBeCloseTo(57); // long enough at the old volume: PB level
  expect(raceDayVdot(47, 100, anchor, 1000)).toBeCloseTo(57); // more volume: capped at the PB
  const less = raceDayVdot(47, 25, anchor, 1000);
  expect(less).toBeLessThan(57);
  expect(less).toBeGreaterThan(47); // half the volume still beats a 47 now
  const r = raceDayVdot(47, 50, anchor, 25);
  expect(r).toBeGreaterThan(47);
  expect(r).toBeLessThan(57);
});

test("volume before a date", () => {
  const runs = [
    { start_date_local: "2026-09-01T08:00", distance: 10000, moving_time: 3000 },
    { start_date_local: "2026-07-01T08:00", distance: 10000, moving_time: 3000 },
  ];
  expect(volumeBefore(runs, "2026-09-10")).toEqual({ weeklyKm: 10 / 8, pace: 300 });
});
