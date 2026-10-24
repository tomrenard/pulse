import { getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { log, night } from "@/db/schema";
import { putWellness } from "@/lib/intervals";
import { accessToken } from "./auth.ts";
import { corosSession } from "./mcp.ts";
import {
  mergeNights,
  type Night,
  parseRestingHr,
  parseSleepHrv,
  parseSleepOverview,
  parseStress,
} from "./parse.ts";

/** COROS data starts on 2026-10-01 (first nights with the watch). */
export const FIRST_DAY = "2026-10-01";

export const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const compact = (date: string) => date.replaceAll("-", "");

/** Pulls COROS days from..to (wake-up days), stores them, and writes the fitting fields to intervals.icu. */
export async function syncCoros(from = addDays(today(), -2), to = today()) {
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
    const nights = mergeNights(...lists).filter((n) => n.date >= from && n.date <= to);
    await save(nights);
    await putWellness(
      nights
        .filter((n) => n.hrv || n.sleepScore || n.asleepSecs)
        .map((n) => ({
          id: n.date,
          hrv: n.hrv,
          sleepScore: n.sleepScore,
          sleepSecs: n.asleepSecs,
        })),
    );
    await db()
      .insert(log)
      .values({ kind: "coros-sync", detail: `ok ${nights.length} days ${from}..${to}` });
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
