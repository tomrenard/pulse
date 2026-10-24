/** intervals.icu API: Basic auth with the athlete's API key. Cloudflare blocks default user agents. */
function config() {
  const key = process.env.INTERVALS_ICU_API_KEY;
  const athlete = process.env.INTERVALS_ICU_ATHLETE_ID;
  if (!key || !athlete) throw new Error("INTERVALS_ICU_API_KEY / INTERVALS_ICU_ATHLETE_ID not set");
  return {
    root: "https://intervals.icu/api/v1",
    athlete,
    headers: {
      Authorization: `Basic ${Buffer.from(`API_KEY:${key}`).toString("base64")}`,
      "User-Agent": "pulse/1",
      "Content-Type": "application/json",
    },
  };
}

/** Athlete endpoints: `path` is relative to /athlete/{id}. */
export function intervals<T>(path: string, init: RequestInit = {}): Promise<T> {
  return call<T>(`/athlete/${config().athlete}${path}`, init);
}

/** Endpoints of one activity, e.g. activity("i123", "/streams.json"). */
export function activity<T>(id: string, path = "", init: RequestInit = {}): Promise<T> {
  return call<T>(`/activity/${encodeURIComponent(id)}${path}`, init);
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const { root, headers } = config();
  const res = await fetch(`${root}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`intervals.icu ${path} ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Only the given fields change; the day is the record id (YYYY-MM-DD). */
export type WellnessUpdate = { id: string } & Record<string, number | string | null | undefined>;

export function putWellness(days: WellnessUpdate[]) {
  return intervals("/wellness-bulk", { method: "PUT", body: JSON.stringify(days) });
}
