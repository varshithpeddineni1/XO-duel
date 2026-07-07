// Session identity for every visitor — guest or registered (SEC-2, SEC-3). Backed by
// connect-pg-simple against the `session` table migrated in Phase 1 specifically for this.
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { env, requireSessionSecret } from '../config/env.js';
import { getPool } from '../db/pool.js';

declare module 'express-session' {
  interface SessionData {
    playerId?: number;
  }
}

export function createSessionMiddleware(): ReturnType<typeof session> {
  const PgStore = connectPgSimple(session);

  return session({
    store: new PgStore({ pool: getPool(), tableName: 'session' }),
    secret: requireSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  });
}
