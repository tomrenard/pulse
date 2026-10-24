import { expect, test } from "vitest";
import { clock, hm, hmm } from "./format.ts";

test("no 60 carried into the display", () => {
  expect(hmm(3599)).toBe("1h00");
  expect(hmm(1.995 * 3600)).toBe("2h00");
  expect(hm(3599)).toBe("1h 00m");
  expect(clock(1199.6)).toBe("20:00");
  expect(clock(4915)).toBe("1:21:55");
  expect(clock(undefined)).toBe("–");
});
