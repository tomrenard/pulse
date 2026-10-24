import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { corosAuth } from "@/db/schema";

/** COROS official MCP, EU region (where the account resolved). OAuth: auth code + PKCE. */
export const COROS = "https://mcpeu.coros.com";
const SCOPE = "openid mcp.tools offline_access";
const RESOURCE = `${COROS}/mcp`;

async function post(path: string, body: Record<string, string> | object, json = false) {
  const res = await fetch(`${COROS}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": json ? "application/json" : "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: json
      ? JSON.stringify(body)
      : new URLSearchParams(body as Record<string, string>).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`COROS ${path} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/** Registers pulse as an OAuth client once per redirect URI (dynamic client registration). */
async function clientFor(redirectUri: string) {
  const [row] = await db().select().from(corosAuth).where(eq(corosAuth.id, 1));
  if (row?.redirectUri === redirectUri) return row.clientId;
  const client = await post(
    "/connect/register",
    {
      client_name: "pulse",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    },
    true,
  );
  await db()
    .insert(corosAuth)
    .values({ id: 1, clientId: client.client_id, redirectUri })
    .onConflictDoUpdate({
      target: corosAuth.id,
      set: { clientId: client.client_id, redirectUri, accessToken: null, refreshToken: null },
    });
  return client.client_id as string;
}

export async function authorizeUrl(redirectUri: string) {
  const clientId = await clientFor(redirectUri);
  const verifier = randomBytes(48).toString("base64url");
  const state = randomBytes(16).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(`${COROS}/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    resource: RESOURCE,
  }).toString();
  return { url: url.toString(), verifier, state };
}

type Tokens = { access_token: string; refresh_token: string; expires_in: number };

const tokenColumns = (t: Tokens) => ({
  accessToken: t.access_token,
  refreshToken: t.refresh_token,
  expiresAt: new Date(Date.now() + t.expires_in * 1000),
});

export async function exchangeCode(code: string, verifier: string) {
  const [row] = await db().select().from(corosAuth).where(eq(corosAuth.id, 1));
  if (!row) throw new Error("COROS client not registered");
  const tokens: Tokens = await post("/oauth2/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: row.redirectUri,
    client_id: row.clientId,
    code_verifier: verifier,
    resource: RESOURCE,
  });
  await db().update(corosAuth).set(tokenColumns(tokens)).where(eq(corosAuth.id, 1));
}

/** A day's margin: the cron runs daily, so a token never expires between two runs. */
const REFRESH_BEFORE_MS = 24 * 3600 * 1000;

/**
 * A valid access token, refreshing when close to expiry. The update only lands if the refresh
 * token is still the one we used: when the cron and an app open refresh at the same moment,
 * the loser reads the winner's tokens instead of overwriting them with a dead one.
 */
export async function accessToken(): Promise<string> {
  const [row] = await db().select().from(corosAuth).where(eq(corosAuth.id, 1));
  if (!row?.accessToken || !row.refreshToken || !row.expiresAt) {
    throw new Error("COROS not connected");
  }
  if (row.expiresAt.getTime() - Date.now() > REFRESH_BEFORE_MS) return row.accessToken;
  const used = row.refreshToken;
  let tokens: Tokens;
  try {
    tokens = await post("/oauth2/token", {
      grant_type: "refresh_token",
      refresh_token: used,
      client_id: row.clientId,
    });
  } catch (error) {
    // A parallel refresh may have used this refresh token first: its reply can land after
    // our rejection, so wait a little for its tokens.
    for (let i = 0; i < 10; i++) {
      const [now] = await db().select().from(corosAuth).where(eq(corosAuth.id, 1));
      if (now?.refreshToken !== used && now?.accessToken) return now.accessToken;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw error;
  }
  const saved = await db()
    .update(corosAuth)
    .set(tokenColumns(tokens))
    .where(and(eq(corosAuth.id, 1), eq(corosAuth.refreshToken, used)))
    .returning({ accessToken: corosAuth.accessToken });
  if (saved[0]?.accessToken) return saved[0].accessToken;
  const [winner] = await db().select().from(corosAuth).where(eq(corosAuth.id, 1));
  if (!winner?.accessToken) throw new Error("COROS token lost during refresh");
  return winner.accessToken;
}

export async function corosConnected() {
  const [row] = await db()
    .select({ refreshToken: corosAuth.refreshToken })
    .from(corosAuth)
    .where(eq(corosAuth.id, 1));
  return Boolean(row?.refreshToken);
}
