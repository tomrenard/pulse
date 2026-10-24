import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { log } from "@/db/schema";
import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { orNothing } from "@/lib/nights";
import type { parseCorosFitness } from "@/lib/races";
import { at, HOUR, type PaceCurve } from "@/lib/records";
import type { PlanEvent } from "@/lib/today";

type Curve = PaceCurve & { activity_id?: string[] };

/** Swim curve, the last 12 weeks of gradient-adjusted run efforts, races ahead, COROS predictor. */
export async function loadRaceExtras() {
  const date = today();
  const [swim, gap, events, [coros]] = await Promise.all([
    orNothing(intervals<{ list: Curve[] }>("/pace-curves.json?type=Swim&curves=all", HOUR), {
      list: [],
    }),
    orNothing(
      intervals<{ list: Curve[] }>("/pace-curves.json?type=Run&gap=true&curves=84d", HOUR),
      { list: [] },
    ),
    orNothing(
      intervals<PlanEvent[]>(`/events?oldest=${date}&newest=${addDays(date, 365)}`, HOUR),
      [],
    ),
    db().select().from(log).where(eq(log.kind, "coros-fitness")).orderBy(desc(log.at)).limit(1),
  ]);
  const swimAll = swim.list.find((c) => c.id === "all");
  const run = gap.list[0];
  return {
    date,
    swim200: at(swimAll?.distance, swimAll?.values, 200),
    swim400: at(swimAll?.distance, swimAll?.values, 400),
    runPoints: (run?.distance ?? []).map((distance, i) => ({
      distance,
      secs: run?.values?.[i] ?? 0,
      activity: run?.activity_id?.[i] ?? "",
    })),
    races: events
      .filter((e) => e.category.startsWith("RACE"))
      .sort((a, b) => a.start_date_local.localeCompare(b.start_date_local)),
    coros: coros?.detail
      ? (JSON.parse(coros.detail) as ReturnType<typeof parseCorosFitness>)
      : undefined,
    corosAt: coros?.at,
  };
}
