import { expect, test } from "vitest";
import { smooth, thin, zoneOf, zoneSegments } from "./streams.ts";

test("rolling mean flattens spikes and keeps length", () => {
  const s = smooth([100, 100, 400, 100, 100], 3);
  expect(s).toHaveLength(5);
  expect(s[2]).toBeCloseTo(200);
  expect(s[0]).toBeCloseTo(100);
});

test("power zones from FTP and zone tops", () => {
  const tops = [55, 75, 90, 105, 120, 150, 999];
  expect(zoneOf(150, 280, tops)).toBe(1); // 54 %
  expect(zoneOf(200, 280, tops)).toBe(2); // 71 %
  expect(zoneOf(280, 280, tops)).toBe(4); // 100 %
  expect(zoneOf(500, 280, tops)).toBe(7);
});

test("thin keeps the last point", () => {
  expect(thin([1, 2, 3, 4, 5], 2)).toEqual([1, 3, 5]);
  expect(thin([1, 2, 3, 4], 3)).toEqual([1, 4]);
});

test("zone segments join without gaps", () => {
  const pts: [number, number][] = [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ];
  const segs = zoneSegments(pts, [2, 2, 4, 4]);
  expect(segs).toEqual([
    {
      zone: 2,
      coords: [
        [0, 0],
        [1, 0],
      ],
    },
    {
      zone: 4,
      coords: [
        [1, 0],
        [2, 0],
        [3, 0],
      ],
    },
  ]);
});
