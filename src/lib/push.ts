import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db/client";
import { pushSub } from "@/db/schema";
import { hm } from "@/lib/format";
import { ACTION, dayTarget, hrvStatus, reasonOf, verdict, WORD } from "@/lib/readiness";
import { loadToday } from "@/lib/today";

function configured() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const key = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !key) return false;
  webpush.setVapidDetails("https://pulse-eight-green.vercel.app", pub, key);
  return true;
}

/**
 * The morning message, Garmin morning-report style: state and what to do, then last night's HRV,
 * the week's load so far, and today's session (adapted when the state says so).
 */
export function morningMessage(t: Awaited<ReturnType<typeof loadToday>>) {
  const workout = t.workout
    ? `${t.workout.name ?? t.workout.type}${t.workout.moving_time ? ` · ${hm(t.workout.moving_time)}` : ""}`
    : "No workout planned";
  const target = dayTarget(t.ready.state, t.workout?.icu_training_load);
  const hrv = t.lastNight?.hrv;
  // iOS shows the title on one line: state and action there, the why leads the body.
  const building = t.ready.state === "building" || t.ready.stale;
  const why = building ? verdict(t.ready, hrv) : reasonOf(t.ready, hrv);
  // A lone low night is already the why: its number would only repeat it.
  const nightIsWhy = why?.startsWith("last night's HRV");
  const facts = [
    hrv && t.ready.normal && !nightIsWhy
      ? `HRV ${Math.round(hrv)} ms, ${hrvStatus(hrv, t.ready.normal).toLowerCase()}`
      : undefined,
    t.lastNight?.asleepSecs ? `slept ${hm(t.lastNight.asleepSecs)}` : undefined,
    t.week.planned ? `load ${t.week.done} of ${t.week.planned}` : undefined,
  ].filter(Boolean);
  return {
    title: building ? WORD[t.ready.state] : `${WORD[t.ready.state]} · ${ACTION[t.ready.state]}`,
    body: [
      why && `${why[0]?.toUpperCase()}${why.slice(1)}.`,
      facts.join(" · "),
      target ? `${workout} → ${target}` : workout,
    ]
      .filter(Boolean)
      .join("\n"),
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
      else console.error("push rejected", status, (error as { body?: string }).body);
    }
  }
  return sent;
}
