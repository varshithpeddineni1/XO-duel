import { expect, test } from '@playwright/test';

// Guest -> registered account, driven through the real client + server + Postgres. A fresh
// username per run (not hardcoded) avoids colliding with itself across CI retries or
// repeated local runs against a database that isn't wiped between them.
test('guest play, register mid-session, stats retained, log out, log back in', async ({ page }) => {
  const username = `e2e_${Date.now()}`;
  const password = 'correcthorsebattery';

  await page.goto('/');

  // Play one local game to a clean win as X (Player 1) while still a guest.
  await page.getByRole('button', { name: 'Local 2-Player' }).click();
  await page.getByRole('button', { name: 'Cell 1, empty' }).click();
  await expect(page.getByRole('button', { name: 'Cell 1, X' })).toBeVisible();
  await page.getByRole('button', { name: 'Cell 4, empty' }).click();
  await expect(page.getByRole('button', { name: 'Cell 4, O' })).toBeVisible();
  await page.getByRole('button', { name: 'Cell 2, empty' }).click();
  await expect(page.getByRole('button', { name: 'Cell 2, X' })).toBeVisible();
  await page.getByRole('button', { name: 'Cell 5, empty' }).click();
  await expect(page.getByRole('button', { name: 'Cell 5, O' })).toBeVisible();
  await page.getByRole('button', { name: 'Cell 3, empty' }).click(); // completes the top row
  await expect(page.getByText('Player 1 Wins!')).toBeVisible();

  await page.getByRole('button', { name: 'Back to Home' }).click();

  // Go to Account (still a guest) and register.
  await page.getByText('Account', { exact: true }).click();
  await expect(page.getByText('Playing as guest')).toBeVisible();
  await page.getByRole('button', { name: 'Create Account' }).click();

  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  await page.getByPlaceholder('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();

  // The same session's game (played before registering) is retained under the account:
  // the Wins stat tile shows 1, not 0. ScoreTile renders [value div, label div] as
  // siblings, so the label's parent's first child is the value.
  await expect(page.getByText('Signed in')).toBeVisible();
  await expect(page.getByText(username)).toBeVisible();
  const winsValue = page.getByText('Wins', { exact: true }).locator('..').locator('div').first();
  await expect(winsValue).toHaveText('1');

  await page.getByRole('button', { name: 'Log Out' }).click();
  await expect(page.getByText('Playing as guest')).toBeVisible();

  // Log back in with the same credentials — the account (and its stats) is still there.
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();

  await expect(page.getByText('Signed in')).toBeVisible();
  await expect(page.getByText(username)).toBeVisible();
});
