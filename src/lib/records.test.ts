import { expect, test } from "vitest";
import { latestBests } from "./records.ts";

test("latest bests: recent 12-month bests, newest first, star when it's also the PB", () => {
  const rows = [
    {
      kind: "run" as const,
      label: "5 km",
      values: [1102, 1210, 1650],
      dates: ["2023-04-01", "2026-05-02", "2026-10-01"],
    },
    {
      kind: "ride" as const,
      label: "20 min",
      values: [255, 255, 223],
      dates: ["2026-07-10", "2026-07-10", "2026-10-20"],
    },
    {
      kind: "ride" as const,
      label: "60 min",
      values: [227, 200, 173],
      dates: ["2025-06-01", "2025-09-01", "2026-10-20"],
    },
  ];
  expect(latestBests(rows, "2025-10-29")).toEqual([
    { label: "20 min", kind: "ride", value: 255, date: "2026-07-10", pb: true },
    { label: "5 km", kind: "run", value: 1210, date: "2026-05-02", pb: false },
  ]);
});
