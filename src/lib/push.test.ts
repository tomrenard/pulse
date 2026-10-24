import { expect, test } from "vitest";
import { morningMessage } from "./push.ts";

type T = Parameters<typeof morningMessage>[0];
const base = {
  ready: { state: "go", reasons: [{ key: "hrv", label: "HRV in your normal", flag: false }] },
  lastNight: { asleepSecs: 8 * 3600 + 23 * 60 },
  workout: { name: "Sweet spot 3×10", moving_time: 5400 },
} as unknown as T;

test("morning message: word, what matters, sleep and workout", () => {
  expect(morningMessage(base)).toEqual({
    title: "Ready · all signals in range",
    body: "Slept 8h 23m · Sweet spot 3×10 · 1h 30m",
    url: "/",
  });
  const flagged = {
    ...base,
    ready: { state: "mid", reasons: [{ key: "rhr", label: "Resting HR up", flag: true }] },
    workout: undefined,
  } as unknown as T;
  expect(morningMessage(flagged)).toMatchObject({
    title: "Go easy · Resting HR up",
    body: "Slept 8h 23m · No workout planned",
  });
});
