/** intervals.icu API: Basic auth with the athlete's API key. Cloudflare blocks default user agents. */
function config() {
  const key = process.env.INTERVALS_ICU_API_KEY;
  const athlete = process.env.INTERVALS_ICU_ATHLETE_ID;
  if (!key || !athlete) throw new Error("INTERVALS_ICU_API_KEY / INTERVALS_ICU_ATHLETE_ID not set");
  return {
    base: `https://intervals.icu/api/v1/athlete/${athlete}`,
    headers: {
      Authorization: `Basic ${Buffer.from(`API_KEY:${key}`).toString("base64")}`,
      "User-Agent": "pulse/1",
      "Content-Type": "application/json",
    },
  };
}

export async function intervals<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { base, headers } = config();
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`intervals.icu ${path} ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Only the given fields change; the day is the record id (YYYY-MM-DD). */
export type WellnessUpdate = { id: string } & Record<string, number | string | undefined>;

export function putWellness(days: WellnessUpdate[]) {
  return intervals("/wellness-bulk", { method: "PUT", body: JSON.stringify(days) });
}
