import { describe, expect, it } from 'vitest';
import { createGameSchema, gameIdParamSchema, makeMoveSchema } from './gameSchemas.js';

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

  it('rejects an unknown mode', () => {
    expect(() => createGameSchema.parse({ mode: 'online' })).toThrow();
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
