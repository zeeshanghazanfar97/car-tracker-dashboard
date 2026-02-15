import { Pool } from "pg";
import { assertServerEnv, env } from "@/lib/env";

declare global {
  var __dbPool: Pool | undefined;
}

export function getPool(): Pool {
  assertServerEnv();

  if (!global.__dbPool) {
    global.__dbPool = new Pool({
      connectionString: env.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
  }

  return global.__dbPool;
}
