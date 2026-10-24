import { asc, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { night, tag } from "@/db/schema";
import { addDays } from "@/lib/date";

/** intervals.icu being down must not take a page with it: its parts just show "–". */
export const orNothing = <T>(promise: Promise<T>, fallback: T) => promise.catch(() => fallback);

/** COROS nights since `days` before `date`, each marked when tagged, plus last night's tags. */
export async function loadNights(date: string, days: number) {
  const since = addDays(date, -days);
  const [rows, tags] = await Promise.all([
    db().select().from(night).where(gte(night.date, since)).orderBy(asc(night.date)),
    db().select().from(tag).where(gte(tag.date, since)),
  ]);
  const tagged = new Set(tags.map((t) => t.date));
  const nights = rows.map((n) => ({ ...n, tagged: tagged.has(n.date) }));
  return {
    nights,
    // Last night = the night that ended this morning; missing until COROS syncs it.
    lastNight: nights.find((n) => n.date === date),
    lastTags: tags.filter((t) => t.date === date).map((t) => t.kind),
  };
}

export const tsbOf = (w?: { ctl?: number | null; atl?: number | null }) =>
  w?.ctl != null && w.atl != null ? w.ctl - w.atl : undefined;
