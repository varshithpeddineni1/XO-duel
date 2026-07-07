import { describe, expect, it } from 'vitest';
import { adminLoginSchema, adminPlayersQuerySchema } from './adminSchemas.js';

describe('adminLoginSchema', () => {
  it('accepts a username and password', () => {
    expect(adminLoginSchema.parse({ username: 'admin', password: 'secretpass' })).toEqual({
      username: 'admin',
      password: 'secretpass',
    });
  });

  it('rejects an empty password', () => {
    expect(() => adminLoginSchema.parse({ username: 'admin', password: '' })).toThrow();
  });
});

describe('adminPlayersQuerySchema', () => {
  it('applies defaults when limit/offset are omitted', () => {
    expect(adminPlayersQuerySchema.parse({})).toEqual({ limit: 50, offset: 0 });
  });

  it('coerces string query params to numbers', () => {
    expect(adminPlayersQuerySchema.parse({ limit: '10', offset: '20' })).toEqual({
      limit: 10,
      offset: 20,
    });
  });

  it('rejects a limit above 100', () => {
    expect(() => adminPlayersQuerySchema.parse({ limit: '101' })).toThrow();
  });
});
