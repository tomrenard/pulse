import {
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Things that happened: failed logins, sync runs. One table, read by kind. */
export const log = pgTable(
  "log",
  {
    id: serial("id").primaryKey(),
    kind: text("kind").notNull(),
    detail: text("detail"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("log_kind_at").on(t.kind, t.at)],
);

/**
 * The COROS connection: one row (id 1). COROS rotates the refresh token on every use, so
 * updates compare-and-swap on it (see lib/coros/auth.ts).
 */
export const corosAuth = pgTable("coros_auth", {
  id: integer("id").primaryKey().default(1),
  clientId: text("client_id").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

/** COROS night and day values by wake-up day. intervals.icu gets the fields it has a place for. */
export const night = pgTable("night", {
  date: text("date").primaryKey(),
  hrv: real("hrv"),
  hrvLow: real("hrv_low"),
  hrvHigh: real("hrv_high"),
  corosBase: real("coros_base"),
  corosLow: real("coros_low"),
  corosHigh: real("coros_high"),
  sleepScore: real("sleep_score"),
  asleepSecs: integer("asleep_secs"),
  deepPct: real("deep_pct"),
  lightPct: real("light_pct"),
  remPct: real("rem_pct"),
  awakeMin: integer("awake_min"),
  sleepStart: text("sleep_start"),
  sleepEnd: text("sleep_end"),
  /** Resting HR as pulse defines it: the lowest heart rate of the night's sleep. */
  rhr: integer("rhr"),
  /** COROS's own daily resting HR, kept for comparison. */
  corosRhr: integer("coros_rhr"),
  sleepHrAvg: integer("sleep_hr_avg"),
  stress: integer("stress"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Nights tagged by hand (alcohol, illness, …). Tagged nights stay out of the HRV baseline. */
export const tag = pgTable(
  "tag",
  { date: text("date").notNull(), kind: text("kind").notNull() },
  (t) => [primaryKey({ columns: [t.date, t.kind] })],
);

/** Web push subscriptions (one per installed device). */
export const pushSub = pgTable("push_sub", {
  endpoint: text("endpoint").primaryKey(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
