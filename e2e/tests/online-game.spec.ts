import { expect, test } from '@playwright/test';

// Two browser contexts simulate two real players. Context A creates the game and reads the
// invite code off the waiting screen; context B "scans" it by navigating straight to the
// join URL (no real QR-scanning hardware in CI) — this exercises the actual invite-link
// join path end to end, not just the socket contract (already covered by
// server/src/sockets/gameSocket.integration.test.ts).
test('online multiplayer: create, join, play to completion, and mutual-accept rematch', async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto('/');
  await pageA.getByRole('button', { name: 'Online Multiplayer' }).click();
  await expect(pageA.getByText('Waiting for opponent…')).toBeVisible();
  const inviteCode = await pageA.getByTestId('invite-code').innerText();

  await pageB.goto(`/?join=${inviteCode}`);
  await expect(pageA.getByRole('button', { name: 'Cell 1, empty' })).toBeVisible();
  await expect(pageB.getByRole('button', { name: 'Cell 1, empty' })).toBeVisible();

  // The creator (A) binds X, the joiner (B) binds O, per the join_game contract.
  await pageA.getByRole('button', { name: 'Cell 1, empty' }).click();
  await expect(pageB.getByRole('button', { name: 'Cell 1, X' })).toBeVisible();

  await pageB.getByRole('button', { name: 'Cell 4, empty' }).click();
  await expect(pageA.getByRole('button', { name: 'Cell 4, O' })).toBeVisible();

  await pageA.getByRole('button', { name: 'Cell 2, empty' }).click();
  await expect(pageB.getByRole('button', { name: 'Cell 2, X' })).toBeVisible();

  await pageB.getByRole('button', { name: 'Cell 5, empty' }).click();
  await expect(pageA.getByRole('button', { name: 'Cell 5, O' })).toBeVisible();

  await pageA.getByRole('button', { name: 'Cell 3, empty' }).click(); // X completes the top row

  await expect(pageA.getByText('You Win!')).toBeVisible();
  await expect(pageB.getByText('You Lose')).toBeVisible();

  // Mutual accept required (spec §4.3.6): A requests, B must confirm before a new board.
  await pageA.getByRole('button', { name: 'Request Rematch' }).click();
  await expect(pageA.getByText('Waiting for opponent to accept…')).toBeVisible();
  await expect(pageB.getByText('Your opponent wants a rematch')).toBeVisible();

  await pageB.getByRole('button', { name: 'Accept Rematch' }).click();
  await expect(pageA.getByRole('button', { name: /Cell \d, empty/ })).toHaveCount(9);
  await expect(pageB.getByRole('button', { name: /Cell \d, empty/ })).toHaveCount(9);

  await contextA.close();
  await contextB.close();
});

test('online multiplayer: opponent disconnect auto-forfeits after the grace period', async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto('/');
  await pageA.getByRole('button', { name: 'Online Multiplayer' }).click();
  const inviteCode = await pageA.getByTestId('invite-code').innerText();
  await pageB.goto(`/?join=${inviteCode}`);
  await expect(pageA.getByRole('button', { name: 'Cell 1, empty' })).toBeVisible();

  await contextB.close(); // simulates B's connection dropping

  await expect(pageA.getByText('Opponent disconnected')).toBeVisible();
  await expect(pageA.getByText('You Win!')).toBeVisible({ timeout: 10_000 });

  await contextA.close();
});
