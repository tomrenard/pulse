import { expect, test } from "vitest";
import { zoneTotals } from "./training.ts";

test("zone totals add up per zone and skip sweet spot", () => {
  const z = zoneTotals([
    {
      id: "a",
      start_date_local: "2026-10-24",
      icu_zone_times: [
        { id: "Z1", secs: 100 },
        { id: "Z2", secs: 50 },
        { id: "SS", secs: 999 },
      ],
      icu_hr_zone_times: [60, 30],
    },
    { id: "b", start_date_local: "2026-10-23", icu_zone_times: [{ id: "Z2", secs: 25 }] },
  ]);
  expect(z.power).toEqual([100, 75, 0, 0, 0, 0, 0]);
  expect(z.hr).toEqual([60, 30, 0, 0, 0, 0, 0]);
});
