import { asc, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { night, tag } from "@/db/schema";
import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { readiness, rhrNormal } from "@/lib/readiness";

export const TAGS = ["alcohol", "illness", "late meal", "travel"] as const;

type Wellness = { id: string; weight?: number | null };
type Athlete = { icu_weight?: number };

/** Everything the Health tab shows: 90 nights, tags, and weight from intervals.icu. */
export async function loadHealth() {
  const date = today();
  const [rows, tags, wellness, athlete] = await Promise.all([
    db()
      .select()
      .from(night)
      .where(gte(night.date, addDays(date, -90)))
      .orderBy(asc(night.date)),
    db()
      .select()
      .from(tag)
      .where(gte(tag.date, addDays(date, -90))),
    intervals<Wellness[]>(`/wellness?oldest=${addDays(date, -180)}&newest=${date}`).catch(
      () => [] as Wellness[],
    ),
    intervals<Athlete>("").catch(() => ({}) as Athlete),
  ]);
  const tagsByDate = new Map<string, string[]>();
  for (const t of tags) tagsByDate.set(t.date, [...(tagsByDate.get(t.date) ?? []), t.kind]);
  const nights = rows.map((n) => ({ ...n, tagged: tagsByDate.has(n.date) }));
  const weights = wellness
    .filter((w) => w.weight)
    .map((w) => ({ date: w.id, value: w.weight as number }));
  return {
    date,
    nights,
    tagsByDate,
    ready: readiness(nights, date),
    rhr: rhrNormal(nights, date),
    weights,
    weight: weights.at(-1)?.value ?? athlete.icu_weight,
  };
}
