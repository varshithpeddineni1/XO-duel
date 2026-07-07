import { expect, test } from '@playwright/test';

// Phase 2's local 2-player flow, driven through the real client + server + Postgres
// (needs the e2e job's Postgres service — see ci.yml). Each assertion after a click waits
// for that move's server round trip to land before the next click, avoiding a race with
// the client's own in-flight-request guard.
test('local 2-player: play to a win, see the result, and rematch', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Local 2-Player' }).click();

  await page.getByRole('button', { name: 'Cell 1, empty' }).click();
  await expect(page.getByRole('button', { name: 'Cell 1, X' })).toBeVisible();

  await page.getByRole('button', { name: 'Cell 4, empty' }).click();
  await expect(page.getByRole('button', { name: 'Cell 4, O' })).toBeVisible();

  await page.getByRole('button', { name: 'Cell 2, empty' }).click();
  await expect(page.getByRole('button', { name: 'Cell 2, X' })).toBeVisible();

  await page.getByRole('button', { name: 'Cell 5, empty' }).click();
  await expect(page.getByRole('button', { name: 'Cell 5, O' })).toBeVisible();

  await page.getByRole('button', { name: 'Cell 3, empty' }).click(); // X completes the top row

  await expect(page.getByText('Player 1 Wins!')).toBeVisible();

  await page.getByRole('button', { name: 'Rematch' }).click();
  await expect(page.getByRole('button', { name: /Cell \d, empty/ })).toHaveCount(9);
});
