import { expect, test } from "vitest";
import { morningMessage } from "./push.ts";

type T = Parameters<typeof morningMessage>[0];
const normal = { low: 80, high: 95, lnMean: Math.log(87), lnSd: 0.12 };
const base = {
  ready: {
    state: "go",
    stale: false,
    provisional: false,
    normal,
    reasons: [{ key: "hrv", label: "HRV in your normal", flag: false }],
  },
  lastNight: { asleepSecs: 8 * 3600 + 23 * 60, hrv: 88 },
  week: { done: 81, planned: 203 },
  workout: { name: "Sweet spot 3×10", moving_time: 5400, icu_training_load: 70 },
} as unknown as T;

test("morning report: state and action, last night, week load, workout", () => {
  expect(morningMessage(base)).toEqual({
    title: "Ready · Train as planned",
    body: "HRV 88 ms, normal · slept 8h 23m · load 81 of 203\nSweet spot 3×10 · 1h 30m",
  });
});

test("a flagged day adapts the session; a lone low night is named", () => {
  const flagged = {
    ...base,
    ready: {
      ...base.ready,
      state: "mid",
      reasons: [{ key: "rhr", label: "Resting HR up", flag: true }],
    },
  } as unknown as T;
  expect(morningMessage(flagged)).toMatchObject({
    title: "Go easy · Keep it easy today",
    body: expect.stringMatching(
      /^Resting HR up\.\n.*\nSweet spot 3×10 · 1h 30m → Easy only, up to 42 load \(Z1–2\)$/,
    ),
  });
  const lowNight = { ...base, lastNight: { hrv: 52 }, workout: undefined } as unknown as T;
  expect(morningMessage(lowNight)).toEqual({
    title: "Ready · Train as planned",
    body: "Last night's HRV dipped, check tomorrow.\nHRV 52 ms, low · load 81 of 203\nNo workout planned",
  });
});
