import { expect, test } from "vitest";
import {
  calibrate,
  freshTime,
  hrVo2,
  hrVo2Series,
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

test("fresh time: VDOT up to the half, marathon no faster than volume allows", () => {
  const volume = { weeklyKm: 20, pace: 330 };
  expect(freshTime(50, 10000, volume)).toBeCloseTo(timeAt(50, 10000));
  // VDOT 50 says ~3:10 for the marathon; 20 km/week at 5:30 says ~3:50.
  expect(freshTime(50, 42195, volume)).toBeCloseTo(tandaMarathon(20, 330));
  expect(freshTime(50, 42195, { weeklyKm: 120, pace: 240 })).toBeCloseTo(timeAt(50, 42195));
});

test("volume before a date", () => {
  const runs = [
    { start_date_local: "2026-09-01T08:00", distance: 10000, moving_time: 3000 },
    { start_date_local: "2026-07-01T08:00", distance: 10000, moving_time: 3000 },
  ];
  expect(volumeBefore(runs, "2026-09-10")).toEqual({ weeklyKm: 10 / 8, pace: 300 });
});
