// Invite code generation — pure, no I/O (ARC-1's spirit; uniqueness-checking against the
// DB is the service layer's job, not this function's). Format and alphabet match the
// design prototype's makeSeedForRoom(): 'XO-' + 5 chars, ambiguous characters (I, O, 0, 1)
// excluded so a spoken/handwritten code round-trips cleanly (API-6: sufficient entropy —
// 32^5 ≈ 33.5M combinations per code).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

export function generateInviteCode(random: () => number = Math.random): string {
  let code = 'XO-';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return code;
}
