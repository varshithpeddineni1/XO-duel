import { describe, expect, it } from 'vitest';
import { shouldTrustProxy } from './index.js';

describe('shouldTrustProxy', () => {
  it('trusts the proxy in production (Nginx terminates TLS in front of Node)', () => {
    expect(shouldTrustProxy('production')).toBe(true);
  });

  it('does not trust a proxy in development (nothing sits in front of the dev server)', () => {
    expect(shouldTrustProxy('development')).toBe(false);
  });

  it('does not trust a proxy for any other value (e.g. test)', () => {
    expect(shouldTrustProxy('test')).toBe(false);
  });
});
