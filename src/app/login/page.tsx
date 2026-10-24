import { and, count, eq, gte, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { log } from "@/db/schema";
import { COOKIE, MAX_AGE, newSession, passwordMatches } from "@/lib/session";

/** After this many wrong passwords in 15 minutes (from anywhere), logging in waits. */
const MAX_FAILS = 10;

async function login(form: FormData) {
  "use server";
  // Record the try before checking, so a burst of parallel guesses all count against the limit.
  const [attempt] = await db().insert(log).values({ kind: "login-fail" }).returning({ id: log.id });
  const [recent] = await db()
    .select({ fails: count() })
    .from(log)
    .where(and(eq(log.kind, "login-fail"), gte(log.at, sql`now() - interval '15 minutes'`)));
  if ((recent?.fails ?? 0) > MAX_FAILS) redirect("/login?error=wait");
  if (!passwordMatches(String(form.get("password") ?? ""))) {
    // A pause that slows guessing.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    redirect("/login?error=1");
  }
  if (attempt) await db().delete(log).where(eq(log.id, attempt.id));
  (await cookies()).set(COOKIE, newSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="screen">
      <div className="sky" aria-hidden="true" />
      <div className="statusbar" aria-hidden="true" />
      <main className="app">
        <section className="hero">
          <div className="big">pulse</div>
          <div className="cond">Training, sleep and recovery.</div>
        </section>
        <form action={login} className="mod mod-b" style={{ display: "grid", gap: 12 }}>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            aria-label="Password"
            placeholder="Password"
            required
            className="field"
          />
          {error && (
            <p className="err" role="alert">
              {error === "wait" ? "Too many tries. Wait 15 minutes." : "Wrong password."}
            </p>
          )}
          <button type="submit" className="btn">
            Log in
          </button>
        </form>
      </main>
    </div>
  );
}
