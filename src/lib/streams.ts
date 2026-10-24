/** Helpers for one activity's per-second streams: smoothing, power zones, route segments. */

/** Centred rolling mean over `window` samples (power is spiky second to second). */
export function smooth(values: (number | null | undefined)[], window: number) {
  const half = Math.floor(window / 2);
  const out: number[] = [];
  let sum = 0;
  let n = 0;
  const at = (i: number) => values[i] ?? 0;
  for (let i = 0; i < Math.min(values.length, half); i++) {
    sum += at(i);
    n++;
  }
  for (let i = 0; i < values.length; i++) {
    if (i + half < values.length) {
      sum += at(i + half);
      n++;
    }
    if (i - half - 1 >= 0) {
      sum -= at(i - half - 1);
      n--;
    }
    out.push(sum / n);
  }
  return out;
}

/** Power zone (1–7) for watts, from the activity's FTP and its zone tops in % of FTP. */
export function zoneOf(watts: number, ftp: number, tops: number[]) {
  const pct = (watts / ftp) * 100;
  const i = tops.findIndex((t) => pct <= t);
  return i < 0 ? tops.length : i + 1;
}

/** Every `step`-th sample plus the last one: enough for a phone-sized chart or map. */
export const thin = <T>(xs: T[], step: number) =>
  xs.filter((_, i) => i % step === 0 || i === xs.length - 1);

/**
 * The route as runs of the same power zone, ready for a map: [[lon, lat], …] per run. Each run
 * starts at the previous one's last point, so the line has no gaps.
 */
export function zoneSegments(points: [number, number][], zones: number[]) {
  const out: { zone: number; coords: [number, number][] }[] = [];
  points.forEach((p, i) => {
    const z = zones[i] ?? 1;
    const last = out.at(-1);
    if (last && last.zone === z) last.coords.push(p);
    else out.push({ zone: z, coords: last ? [last.coords.at(-1) as [number, number], p] : [p] });
  });
  return out.filter((s) => s.coords.length > 1);
}
