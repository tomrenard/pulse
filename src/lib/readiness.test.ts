import { expect, test } from "vitest";
import {
  bedtimeWord,
  hrvStatus,
  midpointSpreadMin,
  type NightInput,
  readiness,
  rhrWord,
  sleepWord,
  tagEffects,
} from "./readiness.ts";

const day = (i: number) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
/** 30 steady nights around 80 ms, RHR 52, 8 h 40 sleep; `tail` replaces the last nights. */
function nights(tail: Partial<NightInput>[] = []): NightInput[] {
  const base = Array.from({ length: 30 }, (_, i) => ({
    date: day(i),
    hrv: 80 + ((i * 7) % 11) - 5,
    rhr: 52 + (i % 3) - 1,
    asleepSecs: 8.66 * 3600,
  }));
  for (const [j, t] of tail.entries())
    Object.assign(base[base.length - tail.length + j] as NightInput, t);
  return base;
}
const last = day(29);

test("steady nights: ready", () => {
  const r = readiness(nights(), last, -10);
  expect(r.state).toBe("go");
  expect(r.reasons.every((x) => !x.flag)).toBe(true);
});

test("too few nights: building baseline; a week without the watch: stale", () => {
  const short = readiness(nights().slice(0, 10), day(9));
  expect(short.state).toBe("building");
  expect(short.stale).toBe(false);
  const gap = readiness(nights().slice(0, 24), last);
  expect(gap.state).toBe("building");
  expect(gap.stale).toBe(true);
});

test("no data for last night says so instead of claiming it is fine", () => {
  const r = readiness(nights().slice(0, 29), last, undefined);
  expect(r.reasons.map((x) => x.label)).toEqual([
    "HRV in your normal",
    "Resting HR: no data",
    "Sleep: no data",
    "Form: no data",
  ]);
});

test("HRV down for a week: go easy; plus short sleep: rest", () => {
  const low = Array.from({ length: 7 }, () => ({ hrv: 62 }));
  expect(readiness(nights(low), last, -10).state).toBe("stop"); // also 3 days running
  const twoLow = [{ hrv: 50 }, { hrv: 50 }];
  const r = readiness(nights(twoLow), last, -10);
  expect(r.reasons.find((x) => x.key === "hrv")?.flag).toBe(true);
  expect(r.state).toBe("mid");
  expect(readiness(nights([{ hrv: 50 }, { hrv: 50, asleepSecs: 5 * 3600 }]), last, -10).state).toBe(
    "stop",
  );
});

test("HRV fine but two other flags: go easy", () => {
  const r = readiness(nights([{ rhr: 60, asleepSecs: 5 * 3600 }]), last, -10);
  expect(r.state).toBe("mid");
  expect(readiness(nights([{ asleepSecs: 5 * 3600 }]), last, -10).state).toBe("go");
});

test("sleep midpoint spread crosses midnight", () => {
  const w = (s: string, e: string) => ({
    sleepStart: `${s < "12:00" ? "2026-10-02" : "2026-10-01"} ${s}`,
    sleepEnd: `2026-10-02 ${e}`,
  });
  expect(midpointSpreadMin([w("23:00", "07:00"), w("23:00", "07:00"), w("23:00", "07:00")])).toBe(
    0,
  );
  expect(midpointSpreadMin([w("22:00", "06:00"), w("23:00", "07:00"), w("00:00", "08:00")])).toBe(
    60,
  );
});

test("tagged nights stay out of the normal", () => {
  // Ten alcohol nights at 40 ms would drag the normal down; tagged, they don't.
  const drunk = Array.from({ length: 10 }, (_, i) => ({ date: day(i), hrv: 40, tagged: true }));
  const r = readiness([...drunk, ...nights().slice(10)], last, -10);
  const untagged = readiness(
    [...drunk.map((n) => ({ ...n, tagged: false })), ...nights().slice(10)],
    last,
    -10,
  );
  expect(r.normal?.low).toBeGreaterThan(untagged.normal?.low ?? 0);
  expect(r.nights).toBe(20);
});

test("HRV status in COROS words: band, then Reduced to −1.5 SD, then Low", () => {
  const n = { lnMean: Math.log(85), lnSd: 0.12 };
  expect(hrvStatus(100, n)).toBe("Elevated");
  expect(hrvStatus(85, n)).toBe("Normal");
  expect(hrvStatus(75, n)).toBe("Reduced");
  expect(hrvStatus(52, n)).toBe("Low");
});

test("state words: sleep against the need, resting HR only high counts, bedtime spread", () => {
  expect(sleepWord(9 * 3600)).toEqual({ word: "Enough", tone: "go" });
  expect(sleepWord(7.5 * 3600)).toEqual({ word: "A bit short", tone: "go" });
  expect(sleepWord(6 * 3600)?.tone).toBe("mid");
  expect(sleepWord(null)).toBeUndefined();
  const n = { low: 45, high: 52 };
  expect(rhrWord(55, n)?.word).toBe("High");
  expect(rhrWord(43, n)).toEqual({ word: "Low", tone: "go" });
  expect(rhrWord(48, undefined)).toBeUndefined();
  expect(bedtimeWord(20)?.word).toBe("Regular");
  expect(bedtimeWord(45)?.word).toBe("Varies");
  expect(bedtimeWord(90)?.tone).toBe("stop");
});

test("tag effects: shown from 5 tagged nights, against untagged nights", () => {
  const ns = [
    ...Array.from({ length: 20 }, () => ({ hrv: 85, tags: [] as string[] })),
    ...Array.from({ length: 6 }, () => ({ hrv: 68, tags: ["alcohol"] })),
    ...Array.from({ length: 3 }, () => ({ hrv: 80, tags: ["travel"] })),
  ];
  expect(tagEffects(ns)).toEqual([{ kind: "alcohol", n: 6, pct: -20, early: true }]);
  expect(tagEffects(ns.slice(20))).toEqual([]);
});
