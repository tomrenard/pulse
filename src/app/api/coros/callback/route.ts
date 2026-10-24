import { cookies } from "next/headers";
import { after, type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { exchangeCode } from "@/lib/coros/auth";
import { FIRST_DAY, syncCoros } from "@/lib/coros/sync";

export const maxDuration = 60;

/** COROS sends the user back here. Checks state, stores tokens, then loads all history. */
export async function GET(request: NextRequest) {
  await requireSession();
  const jar = await cookies();
  const [state, verifier] = jar.get("coros_pkce")?.value.split(".") ?? [];
  jar.delete({ name: "coros_pkce", path: "/api/coros" });
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  if (!state || !verifier || !code || params.get("state") !== state) {
    return NextResponse.redirect(new URL("/?coros=failed", request.url));
  }
  await exchangeCode(code, verifier);
  after(() => syncCoros(FIRST_DAY));
  return NextResponse.redirect(new URL("/?coros=connected", request.url));
}
