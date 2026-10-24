import type { night } from "@/db/schema";

/**
 * COROS MCP tools answer in formatted text, not JSON. These parsers read that text into one
 * record per wake-up day. When the text has data but nothing parses, they throw: a changed
 * format must stop the sync, never store wrong values.
 */

/** A day's COROS values; same fields as the `night` table. */
export type Night = Omit<typeof night.$inferInsert, "updatedAt">;

const num = (s: string | undefined) => (s === undefined ? undefined : Number(s));

/** Splits text into blocks that start with a date line ("2026-10-24" or "2026-10-24:"). */
function byDay(text: string) {
  const days = new Map<string, string>();
  for (const block of text.split(/\n(?=\d{4}-\d{2}-\d{2}:?\s*\n)/)) {
    const date = block.match(/^(\d{4}-\d{2}-\d{2}):?\s*\n/)?.[1];
    if (date) days.set(date, (days.get(date) ?? "") + block);
  }
  return days;
}

function ensureParsed(tool: string, text: string, count: number) {
  if (count === 0 && /\d{4}-\d{2}-\d{2}/.test(text) && !/No .*data found/i.test(text)) {
    throw new Error(`COROS ${tool}: text has dates but nothing parsed; format changed?`);
  }
}

/** Overnight HRV: COROS's average and normal range, plus the low/high of the 5-minute samples. */
export function parseSleepHrv(text: string): Night[] {
  const [assessment = "", series = ""] = text.split(/Sleep HRV Time Series/);
  const nights = new Map<string, Night>();
  for (const [date, block] of byDay(assessment)) {
    const avg = block.match(/HRV Avg: (\d+) ms/)?.[1];
    if (!avg) continue;
    const range = block.match(/Normal Range: (\d+) - (\d+) ms/);
    nights.set(date, {
      date,
      hrv: Number(avg),
      corosLow: num(range?.[1]),
      corosHigh: num(range?.[2]),
      corosBase: num(block.match(/Baseline: (\d+) ms/)?.[1]),
    });
  }
  for (const [date, block] of byDay(series)) {
    const samples = [...block.matchAll(/hrv=(\d+) ms/g)].map((m) => Number(m[1]));
    const night = nights.get(date);
    if (!night || samples.length < 5) continue;
    samples.sort((a, b) => a - b);
    // 10th and 90th percentile: single 5-minute spikes would stretch the bar for nothing.
    night.hrvLow = samples[Math.floor(samples.length * 0.1)];
    night.hrvHigh = samples[Math.ceil(samples.length * 0.9) - 1];
  }
  ensureParsed("querySleepHrv", assessment, nights.size);
  return [...nights.values()];
}

const minutes = (h?: string, m?: string) => Number(h ?? 0) * 60 + Number(m ?? 0);

export function parseSleepOverview(text: string): Night[] {
  const nights: Night[] = [];
  for (const [date, block] of byDay(text)) {
    const asleep = block.match(/Main Sleep \(asleep\): (?:(\d+)h )?(\d+)min/);
    const score = block.match(/Sleep Score: (\d+)/)?.[1];
    if (!asleep && !score) continue;
    const pct = (label: string) => num(block.match(new RegExp(`${label} Ratio: (\\d+)%`))?.[1]);
    const window = block.match(/Main Sleep Window: (\S+ \S+) - (\S+ \S+)/);
    nights.push({
      date,
      sleepScore: num(score),
      asleepSecs: asleep ? minutes(asleep[1], asleep[2]) * 60 : undefined,
      deepPct: pct("Deep Sleep"),
      lightPct: pct("Light Sleep"),
      remPct: pct("REM"),
      awakeMin: num(block.match(/Awake Time: (\d+) min/)?.[1]),
      sleepStart: window?.[1],
      sleepEnd: window?.[2],
    });
  }
  ensureParsed("querySleepOverview", text, nights.length);
  return nights;
}

export function parseStress(text: string): Night[] {
  const nights: Night[] = [];
  for (const [date, block] of byDay(text)) {
    const avg = block.match(/Average Stress: (\d+)/)?.[1];
    if (avg) nights.push({ date, stress: Number(avg) });
  }
  ensureParsed("queryStressLevel", text, nights.length);
  return nights;
}

export function parseRestingHr(text: string): Night[] {
  const nights = [...text.matchAll(/^(\d{4}-\d{2}-\d{2}): (\d+) bpm/gm)].map((m) => ({
    date: m[1] as string,
    rhr: Number(m[2]),
  }));
  ensureParsed("queryRestingHeartRate", text, nights.length);
  return nights;
}

/** Joins per-tool records into one record per day. */
export function mergeNights(...lists: Night[][]): Night[] {
  const byDate = new Map<string, Night>();
  for (const night of lists.flat()) {
    byDate.set(night.date, { ...byDate.get(night.date), ...night });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
