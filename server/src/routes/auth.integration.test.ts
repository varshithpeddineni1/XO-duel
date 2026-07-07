// Supertest against the real Express app + a real Postgres (API-4). Needs DATABASE_URL and
// a migrated database — run via `npm run test:integration`, not the default `npm test`.
// Uses request.agent(app), not request(app), so the session cookie persists across calls
// within a test the way a real browser tab would — request(app) alone doesn't carry cookies
// between separate calls.
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';

const app = createApp();

describe('POST /api/session + GET /api/me', () => {
  it('has no session before any request', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('creates a guest session and persists it across requests via the cookie', async () => {
    const agent = request.agent(app);
    const created = await agent.post('/api/session').send({});
    expect(created.status).toBe(200);
    expect(created.body.isRegistered).toBe(false);
    expect(created.body.nickname).toMatch(/^Guest-\d{4}$/);

    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(created.body.id);
    expect(me.body.stats).toBeNull();

    // Calling POST /api/session again with the same cookie returns the same player, not a
    // second one.
    const again = await agent.post('/api/session').send({});
    expect(again.body.id).toBe(created.body.id);
  });
});

describe('POST /api/auth/register', () => {
  it('upgrades the current guest session in place', async () => {
    const agent = request.agent(app);
    const guest = await agent.post('/api/session').send({});

    const registered = await agent
      .post('/api/auth/register')
      .send({ username: `regtest_${guest.body.id}`, password: 'longenough' });
    expect(registered.status).toBe(200);
    expect(registered.body.id).toBe(guest.body.id); // same row, upgraded in place
    expect(registered.body.isRegistered).toBe(true);

    const me = await agent.get('/api/me');
    expect(me.body.isRegistered).toBe(true);
    expect(me.body.stats).toEqual({ wins: 0, losses: 0, draws: 0 });
  });

  it('rejects registering the same session twice', async () => {
    const agent = request.agent(app);
    const guest = await agent.post('/api/session').send({});
    await agent
      .post('/api/auth/register')
      .send({ username: `once_${guest.body.id}`, password: 'longenough' });

    const second = await agent
      .post('/api/auth/register')
      .send({ username: `twice_${guest.body.id}`, password: 'longenough' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_REGISTERED');
  });

  it('rejects a duplicate username', async () => {
    const first = request.agent(app);
    const firstGuest = await first.post('/api/session').send({});
    await first
      .post('/api/auth/register')
      .send({ username: `dupe_${firstGuest.body.id}`, password: 'longenough' });

    const second = request.agent(app);
    await second.post('/api/session').send({});
    const res = await second
      .post('/api/auth/register')
      .send({ username: `dupe_${firstGuest.body.id}`, password: 'differentpass' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('rejects an invalid payload', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login + logout', () => {
  it('logs in with correct credentials and rejects incorrect ones', async () => {
    const setup = request.agent(app);
    const guest = await setup.post('/api/session').send({});
    const username = `logintest_${guest.body.id}`;
    await setup.post('/api/auth/register').send({ username, password: 'correcthorse' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'wrongpassword' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');

    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ username: 'no-such-user', password: 'whatever' });
    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body.error.code).toBe('INVALID_CREDENTIALS');

    const agent = request.agent(app);
    const loggedIn = await agent
      .post('/api/auth/login')
      .send({ username, password: 'correcthorse' });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.id).toBe(guest.body.id);
    expect(loggedIn.body.isRegistered).toBe(true);

    const me = await agent.get('/api/me');
    expect(me.body.id).toBe(guest.body.id);
  });

  it('clears the session on logout and allows logging back in', async () => {
    const setup = request.agent(app);
    const guest = await setup.post('/api/session').send({});
    const username = `logouttest_${guest.body.id}`;
    await setup.post('/api/auth/register').send({ username, password: 'correcthorse' });

    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ username, password: 'correcthorse' });
    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(204);

    const afterLogout = await agent.get('/api/me');
    expect(afterLogout.body).toBeNull();

    const loggedInAgain = await agent
      .post('/api/auth/login')
      .send({ username, password: 'correcthorse' });
    expect(loggedInAgain.status).toBe(200);
    expect(loggedInAgain.body.id).toBe(guest.body.id);
  });
});

describe('guest-to-registered retention', () => {
  it('keeps a game played as a guest attributed to the account after registering', async () => {
    const agent = request.agent(app);
    const guest = await agent.post('/api/session').send({});

    // Play one local game to a clean win as X.
    const game = await agent.post('/api/games').send({ mode: 'local' });
    const moves: Array<{ cell: number; mark: 'X' | 'O' }> = [
      { cell: 0, mark: 'X' },
      { cell: 3, mark: 'O' },
      { cell: 1, mark: 'X' },
      { cell: 4, mark: 'O' },
      { cell: 2, mark: 'X' }, // completes the top row
    ];
    for (const move of moves) {
      await agent.post(`/api/games/${game.body.id}/moves`).send(move);
    }

    const username = `retaintest_${guest.body.id}`;
    await agent.post('/api/auth/register').send({ username, password: 'longenough' });

    const me = await agent.get('/api/me');
    expect(me.body.isRegistered).toBe(true);
    expect(me.body.stats).toEqual({ wins: 1, losses: 0, draws: 0 });
  });
});
