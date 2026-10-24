import { expect, test } from "vitest";
import { addDays } from "./date.ts";
import { MIN_EVENTS, recoveryResponse } from "./recovery.ts";

const start = "2026-06-01";
const days = 90;
/** Every 10th day is big (load 200), others 50; HRV 80 ms, dipping to 60 then 72 after a big day. */
function history() {
  const loads = Array.from({ length: days }, (_, i) => ({
    date: addDays(start, i),
    load: i % 10 === 9 ? 200 : 50,
  }));
  const nights = Array.from({ length: days }, (_, i) => {
    const sinceBig = i % 10;
    return {
      date: addDays(start, i),
      hrv: sinceBig === 0 && i > 0 ? 60 : sinceBig === 1 && i > 1 ? 72 : 80 + (i % 3) - 1,
    };
  });
  return { loads, nights };
}

test("finds big days and the dip after them", () => {
  const { loads, nights } = history();
  const r = recoveryResponse(loads, nights);
  expect(r.events).toBeGreaterThanOrEqual(MIN_EVENTS);
  expect(r.bigLoad).toBe(200);
  expect(r.profile[0]).toBeLessThan(-20);
  expect(r.profile[2]).toBeGreaterThan(-3);
  expect(r.nights).toBe(3);
});

test("back-to-back big days are left out, tagged nights don't count", () => {
  const { loads, nights } = history();
  const r = recoveryResponse(
    loads.map((d) => ({ ...d, load: 200 })),
    nights.map((n) => ({ ...n, tagged: true })),
  );
  expect(r.events).toBe(0);
  expect(r.hrvNights).toBe(0);
  expect(r.nights).toBeUndefined();
});
