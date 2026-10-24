import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export function connect(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  // Neon's pooled endpoint is a transaction pooler: no prepared statements.
  // DB_POOL_MAX=1 for a single-connection local database (pglite-server).
  const max = Number(process.env.DB_POOL_MAX) || 4;
  return drizzle(postgres(url, { prepare: false, max }), { schema });
}

const shared = globalThis as { pulseDb?: ReturnType<typeof connect> };

export function db() {
  shared.pulseDb ??= connect();
  return shared.pulseDb;
}
