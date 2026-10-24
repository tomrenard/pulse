import { expect, test } from "vitest";
import { beatsText, ftpOf, rideBeats, rideGrade, runBeats, runGrade } from "./level.ts";

test("age grade picks your strongest distance and band", () => {
  // 2:59:10 marathon = 7235 / 10750 = 67.3 %; 18:22 5 km = 772 / 1102 = 70.1 %
  const g = runGrade([
    { distance: 5000, secs: 1102 },
    { distance: 42195, secs: 10750 },
    { distance: 10000 },
  ]);
  expect(g?.distance).toBe(5000);
  expect(g?.pct).toBeCloseTo(70.05, 1);
  expect(g?.name).toBe("Regional Legend");
  expect(runGrade([])).toBeUndefined();
});

test("FTP from best efforts and Coggan category", () => {
  expect(ftpOf(255, 227)).toBeCloseTo(242.25);
  expect(ftpOf(undefined, undefined)).toBeUndefined();
  const g = rideGrade(242 / 67.6);
  expect(g?.wkg).toBeCloseTo(3.58, 2);
  expect(g?.name).toBe("Breakaway Artist");
  expect(g?.pct).toBeCloseTo(55.9, 0);
});

test("finisher shares: interpolated inside the data, a bound outside it", () => {
  expect(runBeats(42195, 15269)).toEqual({ pct: 50, edge: undefined }); // the median
  expect(runBeats(42195, 10750)).toEqual({ pct: 90, edge: "high" }); // faster than the top 10 %
  expect(runBeats(42195, 30000)).toEqual({ pct: 10, edge: "low" });
  expect(runBeats(1234, 100)).toBeUndefined();
  expect(rideBeats(3.3).pct).toBe(50);
  expect(beatsText(rideBeats(10))).toBe("more than 90%");
  expect(beatsText(rideBeats(2))).toBe("under 25%");
  expect(beatsText(rideBeats(3.65))).toBe("~63%");
});
