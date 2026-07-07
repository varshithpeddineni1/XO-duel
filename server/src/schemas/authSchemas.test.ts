import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './authSchemas.js';

describe('registerSchema', () => {
  it('accepts a valid username and password', () => {
    expect(registerSchema.parse({ username: 'player_one', password: 'longenough' })).toEqual({
      username: 'player_one',
      password: 'longenough',
    });
  });

  it('rejects a username shorter than 3 characters', () => {
    expect(() => registerSchema.parse({ username: 'ab', password: 'longenough' })).toThrow();
  });

  it('rejects a username longer than 20 characters', () => {
    expect(() =>
      registerSchema.parse({ username: 'a'.repeat(21), password: 'longenough' }),
    ).toThrow();
  });

  it('rejects a username with non-alphanumeric characters', () => {
    expect(() => registerSchema.parse({ username: 'has space', password: 'longenough' })).toThrow();
    expect(() => registerSchema.parse({ username: 'has-dash', password: 'longenough' })).toThrow();
  });

  it('accepts underscores in a username', () => {
    expect(registerSchema.parse({ username: 'has_underscore', password: 'longenough' })).toEqual({
      username: 'has_underscore',
      password: 'longenough',
    });
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(() => registerSchema.parse({ username: 'validname', password: 'short1' })).toThrow();
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty username and password', () => {
    expect(loginSchema.parse({ username: 'x', password: 'y' })).toEqual({
      username: 'x',
      password: 'y',
    });
  });

  it('rejects an empty username', () => {
    expect(() => loginSchema.parse({ username: '', password: 'y' })).toThrow();
  });

  it('rejects an empty password', () => {
    expect(() => loginSchema.parse({ username: 'x', password: '' })).toThrow();
  });
});
