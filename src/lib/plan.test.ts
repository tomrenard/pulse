import { expect, test } from "vitest";
import { splitPlan } from "./plan.ts";

test("note and steps come apart, repeats kept", () => {
  const p = splitPlan("Easy, HR <=150.\nStop if sore.\n- 15m 140W\n\n5x\n- 3m 280W\n- 3m 130W\n");
  expect(p.note).toBe("Easy, HR <=150.\nStop if sore.");
  expect(p.steps).toEqual(["15m 140W", "5x", "3m 280W", "3m 130W"]);
  expect(splitPlan(undefined)).toEqual({ note: "", steps: [] });
});
