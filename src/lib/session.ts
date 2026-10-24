import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** One user, one password: the session is a signed expiry date, nothing stored server-side. */
export const COOKIE = "pulse_session";
export const MAX_AGE = 365 * 24 * 3600;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return s;
}

const sign = (exp: string) => createHmac("sha256", secret()).update(exp).digest("base64url");

const same = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

export function newSession(now = Date.now()) {
  const exp = String(Math.floor(now / 1000) + MAX_AGE);
  return `${exp}.${sign(exp)}`;
}

export function validSession(value: string | undefined, now = Date.now()) {
  const [exp, mac] = value?.split(".") ?? [];
  if (!exp || !mac || !same(mac, sign(exp))) return false;
  return Number(exp) * 1000 > now;
}

export function passwordMatches(input: string) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set");
  return same(input, expected);
}
