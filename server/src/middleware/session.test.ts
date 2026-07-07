import { describe, expect, it } from 'vitest';
import { cookieOptionsFor } from './session.js';

describe('cookieOptionsFor', () => {
  it('uses SameSite=None + Secure in production (the deployed frontend and backend are cross-site — Vercel vs. DuckDNS)', () => {
    expect(cookieOptionsFor('production')).toEqual({ secure: true, sameSite: 'none' });
  });

  it('uses SameSite=Lax + non-secure in development (localhost is same-site, and dev runs over plain HTTP)', () => {
    expect(cookieOptionsFor('development')).toEqual({ secure: false, sameSite: 'lax' });
  });

  it('falls back to the development-safe settings for any other value (e.g. test)', () => {
    expect(cookieOptionsFor('test')).toEqual({ secure: false, sameSite: 'lax' });
  });
});
