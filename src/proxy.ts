import { type NextRequest, NextResponse } from "next/server";
import { COOKIE, validSession } from "@/lib/session";

export const config = {
  matcher: ["/((?!(?:login|manifest\\.webmanifest|icon\\.svg|apple-icon)$|_next/static/).*)"],
};

/** Everything except the login page needs the signed session cookie. */
export function proxy(request: NextRequest) {
  if (validSession(request.cookies.get(COOKIE)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}
