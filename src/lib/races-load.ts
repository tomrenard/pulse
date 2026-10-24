import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { log } from "@/db/schema";
import { intervals } from "@/lib/intervals";
import { orNothing } from "@/lib/nights";
import type { parseCorosFitness } from "@/lib/races";
import { at, HOUR, type PaceCurve } from "@/lib/records";

/** Best 200 m and 400 m swims (all time), for critical swim speed. */
export async function loadSwim() {
  const swim = await orNothing(
    intervals<{ list: PaceCurve[] }>("/pace-curves.json?type=Swim&curves=all", HOUR),
    {
      list: [],
    },
  );
  const all = swim.list.find((c) => c.id === "all");
  return {
    swim200: at(all?.distance, all?.values, 200),
    swim400: at(all?.distance, all?.values, 400),
  };
}

/** COROS's own VO2max and race predictor, as saved by the last sync. */
export async function loadCoros() {
  const [row] = await orNothing(
    db().select().from(log).where(eq(log.kind, "coros-fitness")).orderBy(desc(log.at)).limit(1),
    [],
  );
  return row?.detail ? (JSON.parse(row.detail) as ReturnType<typeof parseCorosFitness>) : undefined;
}
