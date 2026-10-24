import { expect, test } from "vitest";
import {
  mergeNights,
  parseDailyHealth,
  parseRestingHr,
  parseSleepHrv,
  parseSleepOverview,
  parseStress,
} from "./parse.ts";

// Made-up values in the exact layout the COROS MCP returned on 2026-10-24.
const HRV = `Sleep HRV — 2026-10-01 to 2026-10-02
========================
Note: dates are wake-up days (each value comes from the night that ended that morning).

HRV Assessment — Last 2 days
========================

2026-10-02:
  HRV Avg: 60 ms — Normal
  Normal Range: 50 - 70 ms
  Baseline: 61 ms
2026-10-01:
  HRV Avg: 44 ms — Below normal
  Normal Range: 50 - 70 ms
  Baseline: 60 ms

Sleep HRV Time Series — Last 2 days
========================

2026-10-02:
${[30, 50, 55, 58, 60, 62, 64, 66, 70, 120]
  .map(
    (v, i) =>
      `  timestamp=${1790000000 + i * 300}, timezone=8, hrv=${v} ms, status=4, confidence=100000`,
  )
  .join("\n")}
`;

const SLEEP = `Sleep Overview
========================
Note: each record below is dated by its wake-up day.

2026-10-02
Sleep Score: 85
Daily Sleep: 8h 15min (incl. naps)
Main Sleep (asleep): 7h 50min
Main Sleep Period (incl. awake): 8h 10min
Sleep metrics scope: daily
Deep Sleep Ratio: 18%
Light Sleep Ratio: 55%
REM Ratio: 23%
Awake Ratio: 4%
Awake Time: 20 min
Awake Count (>5 min): 1
Main Sleep Window: 2026-10-01 23:30 - 2026-10-02 07:40
Naps Total: 0 min
`;

const STRESS = `Stress Level — Last 2 days
========================

2026-10-02:
Average Stress: 31
Relaxed: No data

2026-10-01:
Average Stress: 22
`;

const RHR = `Resting Heart Rate — Last 2 days
========================

2026-10-02: 51 bpm
2026-10-01: 53 bpm`;

test("HRV: average, COROS range, sample low/high without outliers", () => {
  const [night] = parseSleepHrv(HRV);
  expect(night).toEqual({
    date: "2026-10-02",
    hrv: 60,
    corosLow: 50,
    corosHigh: 70,
    corosBase: 61,
    hrvLow: 50,
    hrvHigh: 70,
  });
  expect(parseSleepHrv(HRV)).toHaveLength(2);
});

test("sleep overview", () => {
  expect(parseSleepOverview(SLEEP)).toEqual([
    {
      date: "2026-10-02",
      sleepScore: 85,
      asleepSecs: 470 * 60,
      deepPct: 18,
      lightPct: 55,
      remPct: 23,
      awakeMin: 20,
      sleepStart: "2026-10-01 23:30",
      sleepEnd: "2026-10-02 07:40",
    },
  ]);
});

test("stress and COROS resting HR, merged per day", () => {
  const merged = mergeNights(parseStress(STRESS), parseRestingHr(RHR));
  expect(merged).toEqual([
    { date: "2026-10-01", stress: 22, corosRhr: 53 },
    { date: "2026-10-02", stress: 31, corosRhr: 51 },
  ]);
});

test("resting HR = lowest sleeping HR from the daily summary", () => {
  const text = `Daily Health Data — Last 2 days | Resting HR: 45 bpm | HRV Baseline: 42 ms
Note: sleep entries are dated by their wake-up day.

--- 20261001 ---
Steps: 3,408 | Calories: 757 kcal | Exercise: 31 min
Stress: Avg 28

--- 20261002 ---
Steps: 4,243 | Calories: 697 kcal | Exercise: 4 min
Sleep Summary:
  Total: 8h 34min | Deep: 1h 29min | Light: 4h 39min | REM: 2h 15min | Awake: 11 min
  Sleep HR: Avg 57 bpm | Min 44 bpm | Max 90 bpm`;
  expect(parseDailyHealth(text)).toEqual([{ date: "2026-10-02", sleepHrAvg: 57, rhr: 44 }]);
  expect(() => parseDailyHealth("--- 20261002 ---\nSleep heart rate 57/44")).toThrow(
    /format changed/,
  );
});

test("no data is fine, a changed format throws", () => {
  expect(parseSleepOverview("No sleep overview data found.")).toEqual([]);
  expect(() => parseStress("2026-10-02:\nMean stress level = 31")).toThrow(/format changed/);
});
