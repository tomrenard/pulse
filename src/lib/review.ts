import { addDays } from "./date.ts";
import { hrvNormal, ln7, type NightInput } from "./readiness.ts";
import { mondayOf } from "./volume.ts";

/**
 * The week in review: what was done against the plan, how fitness moved, where HRV went, and
 * one plain suggestion. Rules, checked in order, first match wins:
 *   HRV 7-night mean below normal at week's end → ease off
 *   fitness up more than 7 in the week (above the usual 3–7 ramp) → keep next week lighter
 *   under 70 % of planned hours → don't chase the missed sessions
 *   over 120 % of planned hours → more than planned, watch sleep
 *   fitness down more than 3 with nothing planned → a steady week gets it back
 *   otherwise → keep going
 */

/** The Sunday that ends the week to review: today on a Sunday, else last Sunday. */
export const reviewSunday = (date: string) => addDays(mondayOf(addDays(date, 1)), -1);

type ReviewInput = {
  sunday: string;
  doneHours: number;
  plannedHours: number;
  /** Fitness (CTL) the Sunday before and on this Sunday. */
  ctlBefore?: number;
  ctlAfter?: number;
  nights: NightInput[];
};

export function weeklyReview(r: ReviewInput) {
  const fitness =
    r.ctlBefore !== undefined && r.ctlAfter !== undefined ? r.ctlAfter - r.ctlBefore : undefined;
  const now = ln7(r.nights, r.sunday);
  const before = ln7(r.nights, addDays(r.sunday, -7));
  const normal = hrvNormal(r.nights, r.sunday);
  const hrvLow = now !== undefined && normal.lnLow !== undefined && now < normal.lnLow;
  // Change of the 7-night HRV mean (geometric, from ln means), in %.
  const hrvTrend =
    now !== undefined && before !== undefined ? Math.expm1(now - before) * 100 : undefined;
  const share = r.plannedHours > 0 ? r.doneHours / r.plannedHours : undefined;

  const suggestion = hrvLow
    ? "HRV ended the week below your normal. Start next week easy."
    : fitness !== undefined && fitness > 7
      ? `Fitness rose ${Math.round(fitness)} in a week, faster than it sticks. Keep next week lighter.`
      : share !== undefined && share < 0.7
        ? "Less than planned. Don't chase the missed sessions, pick up from here."
        : share !== undefined && share > 1.2
          ? "More than planned. Keep an eye on sleep and HRV."
          : fitness !== undefined && fitness < -3 && share === undefined
            ? "Fitness slipped. A steady week gets it back."
            : "A solid week. Keep it going.";

  return { ...r, fitness, hrvTrend, hrvLow, share, suggestion };
}
