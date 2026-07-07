import { describe, expect, it } from 'vitest';
import { generateFriendInviteCode, generateInviteCode } from './inviteCode.js';

describe('generateInviteCode', () => {
  it('matches the XO-XXXXX format using only the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^XO-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    }
  });

  it('excludes ambiguous characters (I, O, 0, 1)', () => {
    const code = generateInviteCode();
    const suffix = code.slice(3);
    expect(suffix).not.toMatch(/[IO01]/);
  });

  it('is deterministic given a fixed random source', () => {
    const fixedRandom = () => 0;
    expect(generateInviteCode(fixedRandom)).toBe('XO-AAAAA');
  });

  it('uses the full random range', () => {
    const fixedRandom = () => 0.999999;
    const code = generateInviteCode(fixedRandom);
    expect(code).toBe('XO-99999');
  });
});

describe('generateFriendInviteCode', () => {
  it('uses an FR- prefix so it cannot be confused with a game invite code', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateFriendInviteCode();
      expect(code).toMatch(/^FR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    }
  });
});
