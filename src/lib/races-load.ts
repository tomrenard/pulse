import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { log } from "@/db/schema";
import { addDays, today } from "@/lib/date";
import { intervals } from "@/lib/intervals";
import { orNothing } from "@/lib/nights";
import type { parseCorosFitness } from "@/lib/races";
import type { PlanEvent } from "@/lib/today";

type Curve = { id: string; distance?: number[]; values?: number[]; activity_id?: string[] };
const HOUR = { next: { revalidate: 3600 } };

/** Swim curve, the last 12 weeks of gradient-adjusted run efforts, races ahead, COROS predictor. */
export async function loadRaceExtras() {
  const date = today();
  const [swim, gap, events, [coros]] = await Promise.all([
    orNothing(intervals<{ list: Curve[] }>("/pace-curves.json?type=Swim&curves=all,84d", HOUR), {
      list: [],
    }),
    orNothing(
      intervals<{ list: Curve[] }>("/pace-curves.json?type=Run&gap=true&curves=84d", HOUR),
      { list: [] },
    ),
    orNothing(intervals<PlanEvent[]>(`/events?oldest=${date}&newest=${addDays(date, 365)}`), []),
    db().select().from(log).where(eq(log.kind, "coros-fitness")).orderBy(desc(log.at)).limit(1),
  ]);
  const at = (c: Curve | undefined, d: number) => {
    const i = c?.distance?.findIndex((x) => Math.abs(x - d) < 1) ?? -1;
    return i >= 0 ? c?.values?.[i] : undefined;
  };
  const swimAll = swim.list.find((c) => c.id === "all");
  const run = gap.list[0];
  return {
    date,
    swim200: at(swimAll, 200),
    swim400: at(swimAll, 400),
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
