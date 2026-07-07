// Isolated in its own file so it gets a fresh createApp() (and therefore a fresh in-memory
// rate-limit store) rather than sharing one with auth.integration.test.ts's functional
// coverage — a shared limiter would make either file's request count fragile to the other's.
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';

const app = createApp();

describe('login rate limiting (API-10)', () => {
  it('returns 429 after repeated failed login attempts from the same client', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent-user', password: 'wrong' });
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});
