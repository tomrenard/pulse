"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pushSub } from "@/db/schema";
import { requireSession } from "@/lib/auth";

type Sub = { endpoint: string; keys?: { p256dh?: string; auth?: string } };

export async function savePush(sub: Sub) {
  await requireSession();
  const { endpoint, keys } = sub;
  if (!/^https:\/\//.test(endpoint) || !keys?.p256dh || !keys.auth) return;
  const row = { endpoint, p256dh: keys.p256dh, auth: keys.auth };
  await db().insert(pushSub).values(row).onConflictDoUpdate({ target: pushSub.endpoint, set: row });
}

export async function removePush(endpoint: string) {
  await requireSession();
  await db().delete(pushSub).where(eq(pushSub.endpoint, endpoint));
}
