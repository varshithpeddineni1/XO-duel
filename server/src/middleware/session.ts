// Session identity for every visitor — guest or registered (SEC-2, SEC-3). Backed by
// connect-pg-simple against the `session` table migrated in Phase 1 specifically for this.
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { env, requireSessionSecret } from '../config/env.js';
import { getPool } from '../db/pool.js';

declare module 'express-session' {
  interface SessionData {
    playerId?: number;
    // Same session infrastructure as player identity, not a second parallel system (SEC-2:
    // three roles enforced at the API layer — this is that enforcement point for admin).
    isAdmin?: boolean;
  }
}

// The deployed frontend (xoduel.vercel.app) and backend (xoduel.duckdns.org) are different
// registrable domains — a genuinely cross-SITE relationship, not just cross-origin.
// SameSite=Lax cookies are withheld from cross-site fetch/XHR (only sent on same-site
// requests or a top-level navigation), so login would appear to succeed (the response
// itself is fine) while the session cookie never came back on the next request — exactly
// "logged in, then immediately looks like a guest again". SameSite=None is required for
// that, and browsers reject SameSite=None without Secure, so both flip together. Local dev
// stays Lax/non-secure — localhost:5173 and localhost:3000 are same-site (same registrable
// domain, different ports), and dev runs over plain HTTP where a Secure cookie wouldn't be
// set at all. Exported standalone (rather than inlined below) so this environment-driven
// logic is unit-testable without spinning up the whole session middleware.
export function cookieOptionsFor(nodeEnv: string): { secure: boolean; sameSite: 'none' | 'lax' } {
  const isProduction = nodeEnv === 'production';
  return {
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  };
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
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      ...cookieOptionsFor(env.nodeEnv),
    },
  });
}
