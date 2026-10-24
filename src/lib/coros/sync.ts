import { getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { log, night } from "@/db/schema";
import { addDays, today } from "@/lib/date";
import { putWellness } from "@/lib/intervals";
import { parseCorosFitness } from "@/lib/races";
import { accessToken } from "./auth.ts";
import { corosSession } from "./mcp.ts";
import {
  mergeNights,
  type Night,
  parseDailyHealth,
  parseRestingHr,
  parseSleepHrv,
  parseSleepOverview,
  parseStress,
} from "./parse.ts";

/** COROS data starts on 2026-10-01 (first nights with the watch). */
export const FIRST_DAY = "2026-10-01";

const compact = (date: string) => date.replaceAll("-", "");

/** Pulls COROS days from..to (wake-up days), stores them, and writes the fitting fields to intervals.icu. */
export async function syncCoros(start = addDays(today(), -2), end = today()) {
  // COROS has nothing before FIRST_DAY or after today; clamping also bounds the call loop.
  const from = start < FIRST_DAY ? FIRST_DAY : start;
  // biome-ignore lint/complexity/useMathMinMax: ISO date strings, not numbers
  const to = end > today() ? today() : end;
  try {
    const tool = await corosSession(await accessToken());
    const lists: Night[][] = [];
    // The sleep tools answer at most ~7 days per call; stress and RHR only take "last N days".
    for (let start = from; start <= to; start = addDays(start, 7)) {
      // biome-ignore lint/complexity/useMathMinMax: ISO date strings, not numbers
      const end = addDays(start, 6) < to ? addDays(start, 6) : to;
      const range = { startDate: compact(start), endDate: compact(end) };
      lists.push(parseSleepHrv(await tool("querySleepHrv", range)));
      lists.push(parseSleepOverview(await tool("querySleepOverview", range)));
    }
    const days = Math.round((Date.parse(today()) - Date.parse(from)) / 864e5) + 1;
    lists.push(parseStress(await tool("queryStressLevel", { days })));
    lists.push(parseRestingHr(await tool("queryRestingHeartRate", { days })));
    lists.push(parseDailyHealth(await tool("queryDailyHealthData", { days })));
    const nights = mergeNights(...lists).filter((n) => n.date >= from && n.date <= to);
    await save(nights);
    await putWellness(
      nights
        .filter((n) => n.hrv || n.sleepScore || n.asleepSecs || n.rhr)
        .map((n) => ({
          id: n.date,
          hrv: n.hrv,
          sleepScore: n.sleepScore,
          sleepSecs: n.asleepSecs,
          // Lowest sleeping HR: also what Wattson reads from intervals.icu.
          restingHR: n.rhr,
        })),
    );
    await db()
      .insert(log)
      .values({ kind: "coros-sync", detail: `ok ${nights.length} days ${from}..${to}` });
    await saveCorosFitness(tool);
    return nights.length;
  } catch (error) {
    const detail = `error: ${error instanceof Error ? error.message : String(error)}`;
    await db()
      .insert(log)
      .values({ kind: "coros-sync", detail: detail.slice(0, 500) });
    throw error;
  }
}

/** Upsert that keeps stored values a newer partial record doesn't have (e.g. stress before HRV). */
async function save(nights: Night[]) {
  if (nights.length === 0) return;
  const { date: _date, ...columns } = getTableColumns(night);
  const set = Object.fromEntries(
    Object.entries(columns).map(([key, column]) => [
      key,
      key === "updatedAt"
        ? sql`now()`
        : sql.raw(`coalesce(excluded."${column.name}", "night"."${column.name}")`),
    ]),
  );
  await db().insert(night).values(nights).onConflictDoUpdate({ target: night.date, set });
}

/**
 * COROS's own VO2max and race predictor, for comparison on the Races tab. Runs after the
 * nights are saved and fails on its own: a comparison extra must not break the core sync.
 */
async function saveCorosFitness(tool: (name: string) => Promise<string>) {
  try {
    const fitness = parseCorosFitness(await tool("queryFitnessAssessmentOverview"));
    // An empty reply must not hide the last good numbers.
    if (fitness.vo2max === undefined && fitness.k5 === undefined) return;
    await db()
      .insert(log)
      .values({ kind: "coros-fitness", detail: JSON.stringify(fitness) });
  } catch (error) {
    const detail = `error: ${error instanceof Error ? error.message : String(error)}`;
    await db()
      .insert(log)
      .values({ kind: "coros-fitness-error", detail: detail.slice(0, 500) });
  }
}
