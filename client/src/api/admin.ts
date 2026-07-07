// Thin fetch wrappers against the server's admin endpoints (Phase 5). Types are
// hand-duplicated from server/src/services/adminService.ts.
export interface AdminStats {
  activePlayers: number;
  gamesInProgress: number;
  gamesOverTime: Array<{ date: string; count: number }>;
  outcomeDistribution: { xWins: number; oWins: number; draws: number };
}

export interface AdminPlayerRow {
  id: number;
  displayName: string;
  isRegistered: boolean;
  lastSeenAt: string;
}

export class AdminApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.code = code;
  }
}

// Same-origin by default in production so requests hit the Vercel rewrite (vercel.json)
// instead of the cross-site duckdns origin directly.
const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const body: unknown = await res.json();
  if (!res.ok) {
    const errorBody = body as { error?: { code?: string; message?: string } };
    throw new AdminApiError(
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? 'Something went wrong.',
    );
  }
  return body as T;
}

export async function adminLogin(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) await parseJsonResponse(res);
}

export async function adminLogout(): Promise<void> {
  await fetch(`${API_URL}/api/admin/logout`, { method: 'POST', credentials: 'include' });
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await fetch(`${API_URL}/api/admin/stats`, { credentials: 'include' });
  return parseJsonResponse(res);
}

export async function listAdminPlayers(): Promise<AdminPlayerRow[]> {
  const res = await fetch(`${API_URL}/api/admin/players`, { credentials: 'include' });
  return parseJsonResponse(res);
}
