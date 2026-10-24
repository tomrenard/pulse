import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { authorizeUrl } from "@/lib/coros/auth";

/** Starts the COROS login. State, PKCE verifier and client id wait in a short-lived cookie. */
export async function GET(request: NextRequest) {
  await requireSession();
  const { url, verifier, state, clientId } = await authorizeUrl(
    new URL("/api/coros/callback", request.url).toString(),
  );
  (await cookies()).set("coros_pkce", `${state}.${verifier}.${clientId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/coros",
    maxAge: 600,
  });
  return NextResponse.redirect(url);
}
