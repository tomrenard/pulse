"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pushSub } from "@/db/schema";
import { requireSession } from "@/lib/auth";

type Sub = { endpoint: string; keys?: { p256dh?: string; auth?: string } };

// The cron POSTs to whatever is stored: only the browsers' own push services.
const PUSH_HOSTS =
  /^(fcm\.googleapis\.com|web\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[\w-]+\.notify\.windows\.com)$/;
const short = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;

export async function savePush(sub: Sub) {
  await requireSession();
  const { endpoint, keys } = sub;
  const url = short(endpoint, 1024) ? URL.parse(endpoint) : null;
  if (
    url?.protocol !== "https:" ||
    !PUSH_HOSTS.test(url.hostname) ||
    !short(keys?.p256dh, 200) ||
    !short(keys?.auth, 200)
  )
    throw new Error("Not a browser push subscription");
  const row = { endpoint, p256dh: keys.p256dh, auth: keys.auth };
  await db().insert(pushSub).values(row).onConflictDoUpdate({ target: pushSub.endpoint, set: row });
}

export async function removePush(endpoint: string) {
  await requireSession();
  await db().delete(pushSub).where(eq(pushSub.endpoint, endpoint));
}
