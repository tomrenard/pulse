/**
 * Training load in COROS's words.
 * Intensity Trend: 7-day load (ATL) as % of 42-day load (CTL). COROS bands: ≥150 Excessive,
 * 100–149 Optimized, 80–99 Maintaining, 50–79 Performance (load falling, a taper) or Resuming
 * (load rising after a break), under 50 Decreasing. Train in Optimized, race in Performance.
 * Week band: a usual week is 7 × CTL. Under 0.8× loses fitness, 0.8–1× keeps it, 1–1.5× builds it
 * safely, 1.5× and up overreaches (the same cut-offs as the trend, on the week's total).
 */

export type Trend = {
  pct: number;
  zone: "Excessive" | "Optimized" | "Maintaining" | "Performance" | "Resuming" | "Decreasing";
  state: "go" | "mid" | "stop";
};

export function intensityTrend(ctl?: number, atl?: number, atlBefore?: number): Trend | undefined {
  if (!ctl || atl === undefined) return undefined;
  const pct = Math.round((atl / ctl) * 100);
  const rising = atlBefore !== undefined && atl > atlBefore;
  const zone: Trend["zone"] =
    pct >= 150
      ? "Excessive"
      : pct >= 100
        ? "Optimized"
        : pct >= 80
          ? "Maintaining"
          : pct >= 50
            ? rising
              ? "Resuming"
              : "Performance"
            : "Decreasing";
  return { pct, zone, state: pct >= 150 ? "stop" : pct < 50 ? "mid" : "go" };
}

export const WEEK_ZONES = [
  { upTo: 0.8, label: "Losing fitness" },
  { upTo: 1, label: "Maintaining fitness" },
  { upTo: 1.5, label: "Safely building fitness" },
  { upTo: Infinity, label: "Overreaching" },
] as const;

/** Where a week's total load sits against a usual week (7 × CTL). */
export function weekZone(load: number, ctl: number) {
  const ratio = load / (7 * ctl);
  return WEEK_ZONES.find((z) => ratio < z.upTo) ?? WEEK_ZONES[3];
}
