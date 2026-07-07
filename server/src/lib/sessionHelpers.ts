// Promisified wrappers around express-session's callback-style regenerate/destroy, shared
// by both player auth (routes/auth.ts) and admin auth (routes/admin.ts) — both regenerate
// the session id on login (session-fixation defense) and destroy it on logout.
import type { Request } from 'express';

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}
