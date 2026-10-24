import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { syncCoros } from "@/lib/coros/sync";
import { sendMorning } from "@/lib/push";

export const maxDuration = 60;

const hash = (s: string) => createHash("sha256").update(s).digest();

/** Daily Vercel cron (vercel.json). Vercel sends "Bearer CRON_SECRET". ?from=YYYY-MM-DD re-pulls history. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const sent = request.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(hash(sent), hash(`Bearer ${secret}`))) {
    return new Response("unauthorized", { status: 401 });
  }
  const from = request.nextUrl.searchParams.get("from");
  const days = await syncCoros(from?.match(/^\d{4}-\d{2}-\d{2}$/) ? from : undefined);
  // The daily run (not a history re-pull) sends the morning notification once last night is in.
  const pushed = from
    ? 0
    : await sendMorning().catch((error) => {
        console.error("morning push failed", error);
        return 0;
      });
  return Response.json({ days, pushed });
}
