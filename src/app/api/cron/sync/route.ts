import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { syncCoros } from "@/lib/coros/sync";

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
  return Response.json({ days });
}
