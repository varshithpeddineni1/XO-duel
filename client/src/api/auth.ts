// Thin fetch wrappers against the server's session/auth surface (Phase 4). Types are
// hand-duplicated from server/src/services/playerService.ts's PlayerState — no shared-types
// package exists yet (that's more than this phase needs).
export interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
}

export interface PlayerState {
  id: number;
  nickname: string;
  username: string | null;
  isRegistered: boolean;
  stats: PlayerStats | null;
}

export class AuthApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthApiError';
    this.code = code;
  }
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

async function parsePlayerResponse(res: Response): Promise<PlayerState> {
  const body: unknown = await res.json();
  if (!res.ok) {
    const errorBody = body as { error?: { code?: string; message?: string } };
    throw new AuthApiError(
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? 'Something went wrong.',
    );
  }
  return body as PlayerState;
}

// Silently creates (or resumes) a guest session — no login required for any mode (API-7).
export async function createOrResumeSession(): Promise<PlayerState> {
  const res = await fetch(`${API_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({}),
  });
  return parsePlayerResponse(res);
}

export async function getCurrentPlayer(): Promise<PlayerState | null> {
  const res = await fetch(`${API_URL}/api/me`, { credentials: 'include' });
  const body: unknown = await res.json();
  return body as PlayerState | null;
}

export async function register(username: string, password: string): Promise<PlayerState> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  return parsePlayerResponse(res);
}

export async function login(username: string, password: string): Promise<PlayerState> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  return parsePlayerResponse(res);
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
}
