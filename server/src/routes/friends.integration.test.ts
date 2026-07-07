// Supertest against the real Express app + a real Postgres (API-4). Needs DATABASE_URL and
// a migrated database — run via `npm run test:integration`. request.agent(app), not
// request(app), so each simulated player's session cookie persists across calls.
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';

const app = createApp();

async function registerAgent(label: string) {
  const agent = request.agent(app);
  const guest = await agent.post('/api/session').send({});
  const username = `${label}_${guest.body.id}`;
  const registered = await agent
    .post('/api/auth/register')
    .send({ username, password: 'longenough' });
  return { agent, playerId: registered.body.id as number, username };
}

describe('friends: search', () => {
  it('finds a registered player by username prefix, excluding self', async () => {
    const a = await registerAgent('searchtestA');
    const b = await registerAgent('searchtestB');

    const res = await a.agent.get('/api/friends/search').query({ q: b.username.slice(0, 8) });
    expect(res.status).toBe(200);
    expect(res.body.some((p: { playerId: number }) => p.playerId === b.playerId)).toBe(true);
    expect(res.body.some((p: { playerId: number }) => p.playerId === a.playerId)).toBe(false);
  });

  it('requires a registered account', async () => {
    const guestAgent = request.agent(app);
    await guestAgent.post('/api/session').send({});
    const res = await guestAgent.get('/api/friends/search').query({ q: 'anyone' });
    expect(res.status).toBe(403);
  });
});

describe('friends: request -> accept', () => {
  it('sends a request, the target sees it pending, accepts, and both see each other', async () => {
    const a = await registerAgent('reqacceptA');
    const b = await registerAgent('reqacceptB');

    const sendRes = await a.agent.post('/api/friends/requests').send({ username: b.username });
    expect(sendRes.status).toBe(204);

    const bPending = await b.agent.get('/api/friends/requests');
    const incoming = bPending.body.find((r: { playerId: number }) => r.playerId === a.playerId);
    expect(incoming).toMatchObject({ direction: 'incoming' });

    const aPending = await a.agent.get('/api/friends/requests');
    const outgoing = aPending.body.find((r: { playerId: number }) => r.playerId === b.playerId);
    expect(outgoing).toMatchObject({ direction: 'outgoing' });

    const acceptRes = await b.agent.post(`/api/friends/requests/${incoming.requestId}/accept`);
    expect(acceptRes.status).toBe(204);

    const aFriends = await a.agent.get('/api/friends');
    expect(aFriends.body.some((f: { playerId: number }) => f.playerId === b.playerId)).toBe(true);
    const bFriends = await b.agent.get('/api/friends');
    expect(bFriends.body.some((f: { playerId: number }) => f.playerId === a.playerId)).toBe(true);
  });
});

describe('friends: request -> decline', () => {
  it('removes the request, leaving the pair free to request again', async () => {
    const a = await registerAgent('reqdeclineA');
    const b = await registerAgent('reqdeclineB');

    await a.agent.post('/api/friends/requests').send({ username: b.username });
    const pending = await b.agent.get('/api/friends/requests');
    const incoming = pending.body.find((r: { playerId: number }) => r.playerId === a.playerId);

    const declineRes = await b.agent.post(`/api/friends/requests/${incoming.requestId}/decline`);
    expect(declineRes.status).toBe(204);

    const bFriendsAfter = await b.agent.get('/api/friends');
    expect(bFriendsAfter.body.some((f: { playerId: number }) => f.playerId === a.playerId)).toBe(
      false,
    );

    // Re-requesting after a decline succeeds (the row was deleted, not left dangling).
    const again = await a.agent.post('/api/friends/requests').send({ username: b.username });
    expect(again.status).toBe(204);
  });
});

describe('friends: mutual request is an instant match', () => {
  it('auto-accepts when both sides request each other', async () => {
    const a = await registerAgent('mutualA');
    const b = await registerAgent('mutualB');

    await a.agent.post('/api/friends/requests').send({ username: b.username });
    const mutual = await b.agent.post('/api/friends/requests').send({ username: a.username });
    expect(mutual.status).toBe(204);

    const aFriends = await a.agent.get('/api/friends');
    expect(aFriends.body.some((f: { playerId: number }) => f.playerId === b.playerId)).toBe(true);

    const bPendingAfter = await b.agent.get('/api/friends/requests');
    expect(bPendingAfter.body).toHaveLength(0);
  });
});

describe('friends: guard rails', () => {
  it('rejects requesting yourself', async () => {
    const a = await registerAgent('selfreqA');
    const res = await a.agent.post('/api/friends/requests').send({ username: a.username });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_FRIEND_SELF');
  });

  it('rejects requesting someone already an accepted friend', async () => {
    const a = await registerAgent('alreadyfriendsA');
    const b = await registerAgent('alreadyfriendsB');
    await a.agent.post('/api/friends/requests').send({ username: b.username });
    const pending = await b.agent.get('/api/friends/requests');
    const incoming = pending.body.find((r: { playerId: number }) => r.playerId === a.playerId);
    await b.agent.post(`/api/friends/requests/${incoming.requestId}/accept`);

    const res = await a.agent.post('/api/friends/requests').send({ username: b.username });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_FRIENDS');
  });

  it('404s on a request to a non-existent username', async () => {
    const a = await registerAgent('nosuchtargetA');
    const res = await a.agent.post('/api/friends/requests').send({ username: 'no-such-user-xyz' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAYER_NOT_FOUND');
  });
});

describe('friends: invite link', () => {
  it('accepting a personal invite link is an instant, one-step friendship', async () => {
    const a = await registerAgent('inviteA');
    const b = await registerAgent('inviteB');
    expect(a.agent).toBeTruthy();

    // registerAgent's response already carries the new account's permanent invite_code.
    const bSession = await b.agent.get('/api/me');
    const bInviteCode = bSession.body.inviteCode as string;
    expect(bInviteCode).toMatch(/^FR-/);

    const res = await a.agent.post(`/api/friends/invite/${bInviteCode}`);
    expect(res.status).toBe(204);

    const aFriends = await a.agent.get('/api/friends');
    expect(aFriends.body.some((f: { playerId: number }) => f.playerId === b.playerId)).toBe(true);
  });

  it('rejects accepting your own invite link', async () => {
    const a = await registerAgent('selfinviteA');
    const aSession = await a.agent.get('/api/me');
    const res = await a.agent.post(`/api/friends/invite/${aSession.body.inviteCode}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_FRIEND_SELF');
  });

  it('rejects an invalid invite code', async () => {
    const a = await registerAgent('badinviteA');
    const res = await a.agent.post('/api/friends/invite/FR-ZZZZZ');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVALID_INVITE_CODE');
  });
});
