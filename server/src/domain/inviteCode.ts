// Invite code generation — pure, no I/O (ARC-1's spirit; uniqueness-checking against the
// DB is the service layer's job, not this function's). Format and alphabet match the
// design prototype's makeSeedForRoom(): prefix + 5 chars, ambiguous characters (I, O, 0, 1)
// excluded so a spoken/handwritten code round-trips cleanly (API-6: sufficient entropy —
// 32^5 ≈ 33.5M combinations per code).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

export function generateInviteCode(random: () => number = Math.random, prefix = 'XO-'): string {
  let code = prefix;
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return code;
}

// A friend invite code (players.invite_code) is reusable/permanent (SEC-4), unlike a
// single-use game invite code — a distinct prefix keeps the two from being confused with
// each other (pasting one into the wrong "join" flow should look obviously wrong).
export function generateFriendInviteCode(random: () => number = Math.random): string {
  return generateInviteCode(random, 'FR-');
}
