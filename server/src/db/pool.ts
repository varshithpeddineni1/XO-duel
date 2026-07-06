// Single shared pg Pool, built from DATABASE_URL (CODE-3: config from env, never hard-coded).
// Postgres is the single store for application state (DB-1). No query logic lives here yet —
// that belongs in src/services once Phase 2 introduces it (ARC-2).
import { Pool } from 'pg';
import { requireDatabaseUrl } from '../config/env.js';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: requireDatabaseUrl() });
  }
  return pool;
}
