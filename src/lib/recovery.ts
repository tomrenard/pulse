import { addDays } from "./date.ts";
import { mean, type NightInput, sd } from "./readiness.ts";

/**
 * How your HRV answers a big day, learnt from your own history.
 *
 * Big day: training load at or above your 90th percentile of training days, with no other big
 * day within 3 days either side (so the dip and the baseline have one cause). Baseline: mean
 * ln(rMSSD) of the 7 untagged nights up to and including the night before. Each of the next 4 nights is its % change from
 * that baseline; "recovered" is the first night back within 0.5 SD of your 60-day ln(rMSSD)
 * spread. Shown from MIN_EVENTS big days, provisional until SOLID_NIGHTS of HRV.
 * ponytail: plain averages over few events, no model of load size or sleep; a regression on
 * load would say more once there are 20+ events.
 */

export const MIN_EVENTS = 5;
export const SOLID_NIGHTS = 56;
const AFTER = 4;

type DayLoad = { date: string; load: number };

export function recoveryResponse(loads: DayLoad[], nights: NightInput[]) {
  const ln = new Map(
    nights.filter((n) => n.hrv && !n.tagged).map((n) => [n.date, Math.log(n.hrv as number)]),
  );
  const trained = loads.filter((d) => d.load > 0).map((d) => d.load);
  const sorted = [...trained].sort((a, b) => a - b);
  const bigLoad = sorted[Math.floor(sorted.length * 0.9)] ?? Number.POSITIVE_INFINITY;
  const big = new Set(loads.filter((d) => d.load >= bigLoad).map((d) => d.date));

  const events = [...big].flatMap((day) => {
    if ([-3, -2, -1, 1, 2, 3].some((k) => big.has(addDays(day, k)))) return [];
    // Night dates are mornings: the night after `day` is dated day + 1.
    const before = Array.from({ length: 7 }, (_, k) => ln.get(addDays(day, -k))).filter(
      (x) => x !== undefined,
    );
    const after = Array.from({ length: AFTER }, (_, k) => ln.get(addDays(day, k + 1)));
    if (before.length < 4 || after[0] === undefined) return [];
    const spread = Array.from({ length: 60 }, (_, k) => ln.get(addDays(day, -k))).filter(
      (x) => x !== undefined,
    );
    const base = mean(before);
    const band = 0.5 * sd(spread);
    const back = after.findIndex((x) => x !== undefined && x >= base - band);
    return [
      {
        day,
        change: after.map((x) => (x === undefined ? undefined : Math.expm1(x - base) * 100)),
        nightsToRecover: back < 0 ? AFTER + 1 : back + 1,
      },
    ];
  });

  // Mean % change per night after, over the events that have that night.
  const profile = Array.from({ length: AFTER }, (_, k) => {
    const xs = events.flatMap((e) => (e.change[k] === undefined ? [] : [e.change[k] as number]));
    return xs.length ? mean(xs) : undefined;
  });
  const recover = events.map((e) => e.nightsToRecover).sort((a, b) => a - b);
  return {
    events: events.length,
    bigLoad: Number.isFinite(bigLoad) ? bigLoad : undefined,
    profile,
    /** Median nights until HRV is back in your band; AFTER + 1 means "longer than shown". */
    nights: recover.length ? recover[Math.floor(recover.length / 2)] : undefined,
    hrvNights: ln.size,
  };
}
