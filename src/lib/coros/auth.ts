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

/**
 * The OAuth client for this redirect URI: the stored one, or a new registration (dynamic client
 * registration). Nothing is stored until the login completes, so starting a login from another
 * host (a preview URL) never disconnects the working one.
 */
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
  return { url: url.toString(), verifier, state, clientId };
}

// Tokens are stored in plain text: single-user app, and the database is only reachable with
// its own credentials. Encrypting them would add a key to manage for little gain.
type Tokens = { access_token: string; refresh_token: string; expires_in: number };

const tokenColumns = (t: Tokens) => ({
  accessToken: t.access_token,
  refreshToken: t.refresh_token,
  expiresAt: new Date(Date.now() + t.expires_in * 1000),
});

export async function exchangeCode(
  code: string,
  verifier: string,
  clientId: string,
  redirectUri: string,
) {
  const tokens: Tokens = await post("/oauth2/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
    resource: RESOURCE,
  });
  const row = { clientId, redirectUri, ...tokenColumns(tokens) };
  await db()
    .insert(corosAuth)
    .values({ id: 1, ...row })
    .onConflictDoUpdate({ target: corosAuth.id, set: row });
}

/**
 * COROS access tokens last 30 days (expires_in 2591999, seen 2026-10-24). Refreshing a day
 * early means the daily cron always finds a valid token, and rotation happens about monthly.
 */
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
