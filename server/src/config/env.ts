// All configuration comes from environment variables, never hard-coded (CODE-3).
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: Number(optional('PORT', '3000')),
  databaseUrl: optional('DATABASE_URL', ''),
  sessionSecret: optional('SESSION_SECRET', ''),
  adminUsername: optional('ADMIN_USERNAME', ''),
  adminPasswordHash: optional('ADMIN_PASSWORD_HASH', ''),
  clientOrigin: optional('CLIENT_ORIGIN', 'http://localhost:5173'),
  disconnectGracePeriodMs: Number(optional('DISCONNECT_GRACE_PERIOD_MS', '30000')),
  // A pre-join "waiting" invite has no live opponent to notify on disconnect, unlike a
  // mid-game drop — the whole point of a shareable invite link/QR code is surviving the
  // creator's tab closing while they actually go send it. 30s (disconnectGracePeriodMs)
  // isn't realistic time for that; this is deliberately much longer.
  waitingGameGracePeriodMs: Number(optional('WAITING_GAME_GRACE_PERIOD_MS', '300000')),
} as const;

export function requireDatabaseUrl(): string {
  return required('DATABASE_URL');
}

export function requireSessionSecret(): string {
  return required('SESSION_SECRET');
}
