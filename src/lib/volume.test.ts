import { expect, test } from "vitest";
import { mondayOf, planStart, sportOf, weeklyVolume } from "./volume.ts";

test("monday of a date", () => {
  expect(mondayOf("2026-10-24")).toBe("2026-10-19"); // Saturday
  expect(mondayOf("2026-10-19")).toBe("2026-10-19");
  expect(mondayOf("2026-10-25")).toBe("2026-10-19"); // Sunday belongs to the same week
});

test("sports group by type", () => {
  expect(sportOf("VirtualRide")).toBe("ride");
  expect(sportOf("TrailRun")).toBe("run");
  expect(sportOf("OpenWaterSwim")).toBe("swim");
  expect(sportOf("WeightTraining")).toBe("other");
});

test("weekly totals land in the right week and sport", () => {
  const weeks = weeklyVolume(
    [
      {
        start_date_local: "2026-10-24T08:00:00",
        type: "Ride",
        moving_time: 7200,
        distance: 60000,
        icu_training_load: 100,
      },
      {
        start_date_local: "2026-10-19T07:00:00",
        type: "Run",
        moving_time: 3600,
        distance: 12000,
        icu_training_load: 60,
      },
      { start_date_local: "2026-10-18T07:00:00", type: "Run", moving_time: 1800, distance: 6000 },
      { start_date_local: "2026-01-01T07:00:00", type: "Run", moving_time: 1800 }, // too old
    ],
    "2026-10-24",
    2,
  );
  expect(weeks.map((w) => w.monday)).toEqual(["2026-10-12", "2026-10-19"]);
  expect(weeks[1]?.sports.ride).toEqual({ hours: 2, km: 60, load: 100 });
  expect(weeks[1]?.sports.run.hours).toBe(1);
  expect(weeks[0]?.sports.run).toEqual({ hours: 0.5, km: 6, load: 0 });
});

test("plan starts with tomorrow's week: next week on a Sunday, this week otherwise", () => {
  expect(planStart("2026-10-25")).toBe("2026-10-26"); // Sunday
  expect(planStart("2026-10-26")).toBe("2026-10-26"); // Monday
  expect(planStart("2026-10-31")).toBe("2026-10-26"); // Saturday
});
