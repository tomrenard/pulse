import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { log } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { corosConnected } from "@/lib/coros/auth";
import { syncCoros } from "@/lib/coros/sync";

async function syncNow() {
  "use server";
  await requireSession();
  await syncCoros().catch(() => {}); // the failure is logged and shown below
  revalidatePath("/");
}

const when = (d: Date) =>
  d.toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });

/** COROS connection state, the last sync, and the buttons to connect or sync now. */
export async function CorosCard() {
  const [connected, [last]] = await Promise.all([
    corosConnected(),
    db().select().from(log).where(eq(log.kind, "coros-sync")).orderBy(desc(log.at)).limit(1),
  ]);
  const failed = last?.detail?.startsWith("error");
  return (
    <section className="mod">
      <div className="mod-h">COROS</div>
      <div className="hair" />
      <div className="mod-b" style={{ display: "grid", gap: 10 }}>
        {!connected ? (
          <>
            <span>Not connected. Sleep, HRV and stress come from COROS.</span>
            <a
              className="btn"
              href="/api/coros/connect"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              Connect COROS
            </a>
          </>
        ) : (
          <>
            <span className={failed ? "err" : undefined}>
              {last
                ? `${failed ? "Sync broken" : "Synced"} · ${when(last.at)}${failed ? ` · ${last.detail}` : ""}`
                : "Connected · first sync running"}
            </span>
            <form action={syncNow}>
              <button type="submit" className="btn">
                Sync now
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
