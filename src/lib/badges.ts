import { addDays } from "./date.ts";
import { hmm } from "./format.ts";
import { mondayOf, sportOf } from "./volume.ts";

export type BadgeActivity = {
  id?: string;
  start_date_local: string;
  type?: string;
  distance?: number;
  moving_time?: number;
  total_elevation_gain?: number;
};

export type Badge = {
  title: string;
  value: string;
  detail: string;
  earned: boolean;
  progress?: number;
  /** When it was set, for one-off records. */
  date?: string;
};

const km = (m: number) => Math.round(m / 1000).toLocaleString("en-GB");

/**
 * Fun milestones from the activity list (records live on their own bars). `goalKm`: the ultra
 * the longest ride is measured against (BER–CPH).
 */
export function badges(activities: BadgeActivity[], today: string, goalKm = 735): Badge[] {
  const rides = activities.filter((a) => sportOf(a.type) === "ride");
  const longestRide = rides.reduce<BadgeActivity | undefined>(
    (best, a) => ((a.distance ?? 0) > (best?.distance ?? 0) ? a : best),
    undefined,
  );
  const longest = longestRide?.distance ?? 0;
  const weeks = new Map<string, { secs: number; count: number }>();
  const days = new Map<string, Set<string>>();
  for (const a of activities) {
    const day = a.start_date_local.slice(0, 10);
    const w = weeks.get(mondayOf(day)) ?? { secs: 0, count: 0 };
    weeks.set(mondayOf(day), { secs: w.secs + (a.moving_time ?? 0), count: w.count + 1 });
    days.set(day, (days.get(day) ?? new Set()).add(sportOf(a.type)));
  }
  const [bigMonday, big] = [...weeks.entries()].sort((a, b) => b[1].secs - a[1].secs)[0] ?? [
    "",
    { secs: 0 },
  ];
  let streak = 0;
  // The current week counts once it has 3; until then the streak runs up to last week.
  let week =
    (weeks.get(mondayOf(today))?.count ?? 0) >= 3 ? mondayOf(today) : addDays(mondayOf(today), -7);
  while ((weeks.get(week)?.count ?? 0) >= 3) {
    streak++;
    week = addDays(week, -7);
  }
  const year = today.slice(0, 4);
  const climbed = activities
    .filter((a) => a.start_date_local.startsWith(year))
    .reduce((s, a) => s + (a.total_elevation_gain ?? 0), 0);
  const total = activities.reduce((s, a) => s + (a.distance ?? 0), 0);
  const bricks = [...days.values()].filter((s) => s.has("ride") && s.has("run")).length;
  const centuries = rides.filter((a) => (a.distance ?? 0) >= 100_000).length;
  return [
    {
      title: "Longest ride",
      value: `${km(longest)} km`,
      detail: `${Math.round((longest / 1000 / goalKm) * 100)} % of ${goalKm} km`,
      earned: longest >= 200_000,
      progress: Math.min(1, longest / 1000 / goalKm),
      date: longestRide?.start_date_local.slice(0, 10),
    },
    {
      title: "Biggest week",
      value: hmm(big.secs),
      detail: bigMonday ? `week of ${bigMonday}` : "",
      earned: big.secs >= 15 * 3600,
      date: bigMonday || undefined,
    },
    {
      title: "Centuries",
      value: `${centuries}`,
      detail: "rides of 100 km or more",
      earned: centuries > 0,
    },
    {
      title: `Everest ${year}`,
      value: `${(climbed / 8848).toFixed(1)}×`,
      detail: `${Math.round(climbed).toLocaleString("en-GB")} m climbed this year`,
      earned: climbed >= 8848,
      progress: Math.min(1, (climbed % 8848) / 8848),
    },
    {
      title: "Around the world",
      value: `${Math.round((total / 40_075_000) * 100)} %`,
      detail: `${km(total)} km since 2021`,
      earned: total >= 40_075_000,
      progress: Math.min(1, total / 40_075_000),
    },
    {
      title: "Week streak",
      value: `${streak}`,
      detail: "weeks in a row with 3+ sessions",
      earned: streak >= 4,
    },
    {
      title: "Brick days",
      value: `${bricks}`,
      detail: "ride and run the same day",
      earned: bricks > 0,
    },
  ];
}
