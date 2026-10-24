import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db/client";
import { pushSub } from "@/db/schema";
import { hm } from "@/lib/format";
import { WORD } from "@/lib/readiness";
import { loadToday } from "@/lib/today";

function configured() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const key = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !key) return false;
  webpush.setVapidDetails("mailto:pulse@localhost", pub, key);
  return true;
}

/** The morning message: readiness word, the one thing that matters, today's workout. */
export function morningMessage(t: Awaited<ReturnType<typeof loadToday>>) {
  const flagged = t.ready.reasons.find((r) => r.flag)?.label;
  const workout = t.workout
    ? `${t.workout.name ?? t.workout.type}${t.workout.moving_time ? ` · ${hm(t.workout.moving_time)}` : ""}`
    : "No workout planned";
  return {
    title: `${WORD[t.ready.state]} · ${flagged ?? "all signals in range"}`,
    body: `${t.lastNight?.asleepSecs ? `Slept ${hm(t.lastNight.asleepSecs)} · ` : ""}${workout}`,
    url: "/",
  };
}

/** Sends the morning message to every subscribed device; drops subscriptions the push service rejects. */
export async function sendMorning() {
  if (!configured()) return 0;
  const subs = await db().select().from(pushSub);
  if (subs.length === 0) return 0;
  const message = JSON.stringify(morningMessage(await loadToday()));
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        message,
      );
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410)
        await db().delete(pushSub).where(eq(pushSub.endpoint, s.endpoint));
    }
  }
  return sent;
}
