import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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
