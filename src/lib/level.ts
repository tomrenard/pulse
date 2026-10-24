/**
 * Where your performances sit against other athletes.
 * Running: age grading, WMA/USATF 2025 road standards (Alan Jones); bands 60 local, 70
 * regional, 80 national, 90 world class. Cycling: Coggan power profile, men, FTP W/kg lower
 * bounds. One scale for both: % of world class (age grade, or W/kg ÷ Coggan's top 6.40);
 * Coggan's lower bounds land on the running bands (5.15 = 80 %, 4.62 = 72 %).
 * Finisher percentiles are approximate: RunRepeat (men, 35M race results, 2024) and Roadman
 * (men 25–34 who train ≥ 4 h/week, 2026).
 */

/** Age-32 male standards in seconds (open standard ÷ age factor, 2025 tables). */
// ponytail: fixed at age 32 (born 1994-10-01); the factors move < 0.5 % until 35, add the table then.
const RUN_STANDARD: Record<number, number> = { 5000: 772, 10000: 1588, 21097.5: 3452, 42195: 7235 };

export type Grade = { name: string; real: string; pct: number };

const RUN_BANDS: [number, string, string][] = [
  [90, "Iten Camp Material", "world class"],
  [80, "National Hopeful", "national class"],
  [70, "Regional Legend", "regional class"],
  [60, "Club Vest", "local class"],
  [50, "Negative-Split Believer", "above average"],
  [0, "Parkrun Tourist", "getting started"],
];

const RIDE_BANDS: [number, string, string][] = [
  [5.69, "Pogačar's Shadow", "world class"],
  [5.15, "Grand Tour Climber", "exceptional"],
  [4.62, "Pro Tour Lurker", "excellent (cat 1)"],
  [4.09, "Domestique Material", "very good (cat 2)"],
  [3.47, "Breakaway Artist", "good (cat 3)"],
  [2.93, "KOM Hunter", "moderate (cat 4)"],
  [2.4, "Sunday Club Hero", "fair (cat 5)"],
  [0, "Café Racer", "untrained"],
];
const COGGAN_TOP = 6.4;

/** Best age grade across distances (the distance you're strongest at). */
export function runGrade(
  times: { distance: number; secs?: number }[],
): (Grade & { distance: number }) | undefined {
  const graded = times.flatMap(({ distance, secs }) => {
    const std = RUN_STANDARD[distance];
    return std && secs ? [{ distance, pct: (std / secs) * 100 }] : [];
  });
  const best = graded.sort((a, b) => b.pct - a.pct)[0];
  if (!best) return undefined;
  const [, name, band] =
    RUN_BANDS.find(([min]) => best.pct >= min) ?? (RUN_BANDS.at(-1) as [number, string, string]);
  return { ...best, name, real: `age-graded ${best.pct.toFixed(1)} % · ${band}` };
}

/** FTP from best efforts: the higher of best 60 min and 95 % of best 20 min (Coggan). */
export const ftpOf = (best20?: number, best60?: number) =>
  Math.max(best60 ?? 0, (best20 ?? 0) * 0.95) || undefined;

export function rideGrade(
  ftp: number | undefined,
  kg: number,
): (Grade & { wkg: number }) | undefined {
  if (!ftp || !kg) return undefined;
  const wkg = ftp / kg;
  const [, name, band] =
    RIDE_BANDS.find(([min]) => wkg >= min) ?? (RIDE_BANDS.at(-1) as [number, string, string]);
  return {
    wkg,
    pct: (wkg / COGGAN_TOP) * 100,
    name,
    real: `${wkg.toFixed(2)} W/kg FTP · Coggan ${band}`,
  };
}

/** Linear interpolation over [value, % of field slower] points; clamped at the ends. */
function percentile(points: [number, number][], v: number) {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  const first = sorted[0] as [number, number];
  const last = sorted.at(-1) as [number, number];
  if (v <= first[0]) return first[1];
  if (v >= last[0]) return last[1];
  for (let i = 1; i < sorted.length; i++) {
    const [x1, y1] = sorted[i] as [number, number];
    const [x0, y0] = sorted[i - 1] as [number, number];
    if (v <= x1) return y0 + ((v - x0) / (x1 - x0)) * (y1 - y0);
  }
  return last[1];
}

/** RunRepeat men, all ages: finish time (s) at the fastest 10 / 20 / 50 / 80 / 90 %. */
const RUNREPEAT: Record<number, number[]> = {
  5000: [1406, 1564, 1888, 2361, 2743],
  10000: [2711, 2977, 3435, 4153, 4761],
  21097.5: [6035, 6553, 7188, 8757, 9768],
  42195: [12160, 13213, 15269, 17733, 19526],
};

/** Share of race finishers (men) slower than this time; approximate, capped at 1–99 %. */
export function runBeats(distance: number, secs: number) {
  const t = RUNREPEAT[distance];
  if (!t) return undefined;
  const slower = [90, 80, 50, 20, 10];
  const pct = percentile(
    t.map((x, i) => [x, slower[i] as number]),
    secs,
  );
  // Faster than the top-10 % time: extrapolate towards 99 % rather than claiming exactly 90.
  const fast = secs < (t[0] as number) ? 90 + (1 - secs / (t[0] as number)) * 40 : pct;
  return Math.min(99, Math.max(1, Math.round(fast)));
}

/** Roadman men 25–34 who train: FTP W/kg at the 25 / 50 / 75 / 90th percentile. */
export function rideBeats(wkg: number) {
  return Math.min(
    99,
    Math.max(
      1,
      Math.round(
        percentile(
          [
            [2.7, 25],
            [3.3, 50],
            [4.0, 75],
            [4.7, 90],
          ],
          wkg,
        ),
      ),
    ),
  );
}
