#!/usr/bin/env node
// Hashes the single admin passcode with argon2 so it can be stored as
// ADMIN_PASSWORD_HASH in .env — the admin account is never stored in plaintext,
// and there is no admin self-registration (SEC-2, SEC-3, spec §3).
import argon2 from 'argon2';

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run hash-admin -- <passcode>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Error: choose a passcode of at least 8 characters.');
  process.exit(1);
}

const hash = await argon2.hash(password);

console.log('Paste this line into your .env:');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
