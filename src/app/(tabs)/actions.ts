"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { log, night } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { syncCoros } from "@/lib/coros/sync";
import { today } from "@/lib/date";

/** At most one on-open pull per 20 minutes. */
const PULL_AFTER_MS = 20 * 60 * 1000;

/**
 * Called by the app when it opens or comes back: pulls last night from COROS if the 09:00 UTC
 * cron hasn't brought it yet. In an action (not a page render), so tab prefetches never sync.
 * Returns true when new data arrived.
 */
export async function pullIfStale() {
  await requireSession();
  const [[have], [last]] = await Promise.all([
    db()
      .select({ hrv: night.hrv })
      .from(night)
      .where(and(eq(night.date, today()))),
    db().select().from(log).where(eq(log.kind, "coros-sync")).orderBy(desc(log.at)).limit(1),
  ]);
  if (have?.hrv || (last && Date.now() - last.at.getTime() < PULL_AFTER_MS)) return false;
  return syncCoros()
    .then(() => true)
    .catch(() => false); // logged by syncCoros and shown on the COROS card
}
