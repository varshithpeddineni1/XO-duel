import { describe, expect, it } from 'vitest';
import {
  friendInviteCodeParamSchema,
  friendRequestIdParamSchema,
  friendSearchQuerySchema,
  sendFriendRequestSchema,
} from './friendSchemas.js';

describe('friendSearchQuerySchema', () => {
  it('accepts a non-empty query', () => {
    expect(friendSearchQuerySchema.parse({ q: 'alice' })).toEqual({ q: 'alice' });
  });

  it('rejects an empty query', () => {
    expect(() => friendSearchQuerySchema.parse({ q: '' })).toThrow();
  });
});

describe('sendFriendRequestSchema', () => {
  it('accepts a username', () => {
    expect(sendFriendRequestSchema.parse({ username: 'bob' })).toEqual({ username: 'bob' });
  });

  it('rejects a missing username', () => {
    expect(() => sendFriendRequestSchema.parse({})).toThrow();
  });
});

describe('friendRequestIdParamSchema', () => {
  it('coerces a numeric string to a positive integer', () => {
    expect(friendRequestIdParamSchema.parse('42')).toBe(42);
  });

  it('rejects a non-positive value', () => {
    expect(() => friendRequestIdParamSchema.parse('0')).toThrow();
  });
});

describe('friendInviteCodeParamSchema', () => {
  it('accepts a well-formed FR- code', () => {
    expect(friendInviteCodeParamSchema.parse('FR-ABCDE')).toBe('FR-ABCDE');
  });

  it('rejects a game invite code format (XO- prefix)', () => {
    expect(() => friendInviteCodeParamSchema.parse('XO-ABCDE')).toThrow();
  });
});
