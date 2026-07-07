// Supertest against the real Express app + a real Postgres (API-4). Needs DATABASE_URL and
// a migrated database — run via `npm run test:integration`. Admin credentials come from
// ADMIN_USERNAME/ADMIN_PASSWORD_HASH (SEC-1) — vitest.integration.config.ts sets these to a
// known test value so this suite can exercise real login, not a mock.
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';

const app = createApp();

describe('admin auth gating (SEC-2, SEC-10)', () => {
  it('401s on every admin route without a session', async () => {
    const stats = await request(app).get('/api/admin/stats');
    expect(stats.status).toBe(401);
    expect(stats.body.error.code).toBe('ADMIN_AUTH_REQUIRED');

    const players = await request(app).get('/api/admin/players');
    expect(players.status).toBe(401);
    expect(players.body.error.code).toBe('ADMIN_AUTH_REQUIRED');
  });

  it('rejects incorrect admin credentials', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in with the correct credentials and can then read stats/players', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'test-admin-password' });
    expect(login.status).toBe(200);

    const stats = await agent.get('/api/admin/stats');
    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({
      activePlayers: expect.any(Number),
      gamesInProgress: expect.any(Number),
      gamesOverTime: expect.any(Array),
      outcomeDistribution: {
        xWins: expect.any(Number),
        oWins: expect.any(Number),
        draws: expect.any(Number),
      },
    });

    const players = await agent.get('/api/admin/players');
    expect(players.status).toBe(200);
    expect(Array.isArray(players.body)).toBe(true);
  });

  it('logging out revokes access to admin routes again', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'test-admin-password' });
    const logoutRes = await agent.post('/api/admin/logout');
    expect(logoutRes.status).toBe(204);

    const stats = await agent.get('/api/admin/stats');
    expect(stats.status).toBe(401);
  });

  it("a regular player session doesn't grant admin access", async () => {
    const agent = request.agent(app);
    await agent.post('/api/session').send({});
    const res = await agent.get('/api/admin/stats');
    expect(res.status).toBe(401);
  });
});
