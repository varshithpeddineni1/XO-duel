import { describe, expect, it } from 'vitest';
import {
  createGameSchema,
  gameIdParamSchema,
  inviteCodeSchema,
  joinGameSchema,
  makeMoveSchema,
  socketMoveSchema,
} from './gameSchemas.js';

describe('createGameSchema', () => {
  it('accepts a local game', () => {
    expect(createGameSchema.parse({ mode: 'local' })).toEqual({ mode: 'local' });
  });

  it('accepts an ai game with a valid difficulty', () => {
    expect(createGameSchema.parse({ mode: 'ai', aiDifficulty: 'hard' })).toEqual({
      mode: 'ai',
      aiDifficulty: 'hard',
    });
  });

  it('rejects an ai game with a missing difficulty', () => {
    expect(() => createGameSchema.parse({ mode: 'ai' })).toThrow();
  });

  it('rejects an ai game with an invalid difficulty', () => {
    expect(() => createGameSchema.parse({ mode: 'ai', aiDifficulty: 'nightmare' })).toThrow();
  });

  it('accepts an online game', () => {
    expect(createGameSchema.parse({ mode: 'online' })).toEqual({ mode: 'online' });
  });

  it('rejects an unknown mode', () => {
    expect(() => createGameSchema.parse({ mode: 'tournament' })).toThrow();
  });
});

describe('makeMoveSchema', () => {
  it('accepts a valid cell/mark pair', () => {
    expect(makeMoveSchema.parse({ cell: 4, mark: 'X' })).toEqual({ cell: 4, mark: 'X' });
  });

  it('rejects a cell below 0', () => {
    expect(() => makeMoveSchema.parse({ cell: -1, mark: 'X' })).toThrow();
  });

  it('rejects a cell above 8', () => {
    expect(() => makeMoveSchema.parse({ cell: 9, mark: 'X' })).toThrow();
  });

  it('rejects a non-integer cell', () => {
    expect(() => makeMoveSchema.parse({ cell: 1.5, mark: 'X' })).toThrow();
  });

  it('rejects an invalid mark', () => {
    expect(() => makeMoveSchema.parse({ cell: 0, mark: 'Z' })).toThrow();
  });
});

describe('gameIdParamSchema', () => {
  it('coerces a numeric string id', () => {
    expect(gameIdParamSchema.parse('42')).toBe(42);
  });

  it('rejects a non-numeric id', () => {
    expect(() => gameIdParamSchema.parse('abc')).toThrow();
  });

  it('rejects a negative id', () => {
    expect(() => gameIdParamSchema.parse('-1')).toThrow();
  });
});

describe('inviteCodeSchema', () => {
  it('accepts a well-formed code', () => {
    expect(inviteCodeSchema.parse('XO-AB2C3')).toBe('XO-AB2C3');
  });

  it('rejects a code with ambiguous characters', () => {
    expect(() => inviteCodeSchema.parse('XO-AB0I1')).toThrow();
  });

  it('rejects the wrong length', () => {
    expect(() => inviteCodeSchema.parse('XO-AB2')).toThrow();
  });

  it('rejects a missing prefix', () => {
    expect(() => inviteCodeSchema.parse('AB2C3')).toThrow();
  });
});

describe('joinGameSchema', () => {
  it('accepts an invite code with no reconnect token', () => {
    expect(joinGameSchema.parse({ inviteCode: 'XO-AB2C3' })).toEqual({
      inviteCode: 'XO-AB2C3',
    });
  });

  it('accepts an invite code with a reconnect token', () => {
    expect(joinGameSchema.parse({ inviteCode: 'XO-AB2C3', reconnectToken: 'abc' })).toEqual({
      inviteCode: 'XO-AB2C3',
      reconnectToken: 'abc',
    });
  });

  it('rejects a malformed invite code', () => {
    expect(() => joinGameSchema.parse({ inviteCode: 'nope' })).toThrow();
  });
});

describe('socketMoveSchema', () => {
  it('accepts a valid cell', () => {
    expect(socketMoveSchema.parse({ cell: 8 })).toEqual({ cell: 8 });
  });

  it('rejects an out-of-range cell', () => {
    expect(() => socketMoveSchema.parse({ cell: 9 })).toThrow();
  });
});
