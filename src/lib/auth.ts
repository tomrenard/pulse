import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, validSession } from "./session.ts";

/**
 * First line of every server action and route handler except login. The proxy only redirects
 * page visits; paths it skips would otherwise run without a session check.
 */
export async function requireSession() {
  if (!validSession((await cookies()).get(COOKIE)?.value)) redirect("/login");
}
