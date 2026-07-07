// Thin fetch wrappers against the server's friends endpoints (Phase 5). Types are
// hand-duplicated from server/src/services/friendService.ts.
export interface FriendSummary {
  playerId: number;
  displayName: string;
}

export interface PendingRequest {
  requestId: number;
  direction: 'incoming' | 'outgoing';
  playerId: number;
  displayName: string;
  createdAt: string;
}

export class FriendsApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'FriendsApiError';
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
    throw new FriendsApiError(
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? 'Something went wrong.',
    );
  }
  return body as T;
}

export async function listFriends(): Promise<FriendSummary[]> {
  const res = await fetch(`${API_URL}/api/friends`, { credentials: 'include' });
  return parseJsonResponse(res);
}

export async function listPendingRequests(): Promise<PendingRequest[]> {
  const res = await fetch(`${API_URL}/api/friends/requests`, { credentials: 'include' });
  return parseJsonResponse(res);
}

export async function searchPlayers(query: string): Promise<FriendSummary[]> {
  const url = new URL(`${API_URL}/api/friends/search`);
  url.searchParams.set('q', query);
  const res = await fetch(url, { credentials: 'include' });
  return parseJsonResponse(res);
}

export async function sendFriendRequest(username: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/friends/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username }),
  });
  if (!res.ok) await parseJsonResponse(res);
}

export async function respondToFriendRequest(requestId: number, accept: boolean): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/friends/requests/${requestId}/${accept ? 'accept' : 'decline'}`,
    { method: 'POST', credentials: 'include' },
  );
  if (!res.ok) await parseJsonResponse(res);
}

export async function acceptFriendInvite(code: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/friends/invite/${code}`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) await parseJsonResponse(res);
}
