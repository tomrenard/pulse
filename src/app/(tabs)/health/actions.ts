"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { tag } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { today } from "@/lib/date";
import { TAGS } from "@/lib/health";
import { putWellness } from "@/lib/intervals";

/** Adds or removes a tag on a night (wake-up day). */
export async function toggleTag(form: FormData) {
  await requireSession();
  const date = String(form.get("date") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(TAGS as readonly string[]).includes(kind)) return;
  const where = and(eq(tag.date, date), eq(tag.kind, kind));
  const [existing] = await db().select().from(tag).where(where);
  if (existing) await db().delete(tag).where(where);
  else await db().insert(tag).values({ date, kind });
  revalidatePath("/", "layout");
}

/** Today's weight goes to intervals.icu, where VO2max and W/kg read it. */
export async function saveWeight(form: FormData) {
  await requireSession();
  const kg = Number(String(form.get("kg") ?? "").replace(",", "."));
  if (!(kg >= 30 && kg <= 200)) return;
  await putWellness([{ id: today(), weight: Math.round(kg * 10) / 10 }]);
  revalidatePath("/health");
}
