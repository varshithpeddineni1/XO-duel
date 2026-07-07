import { expect, test } from '@playwright/test';

// Real admin auth (SEC-2, SEC-10) — credentials come from ADMIN_USERNAME/ADMIN_PASSWORD_HASH,
// set in playwright.config.ts's server env to match vitest.integration.config.ts's fixed
// test-only value.
test('admin logs in and sees live player/game counts', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Account', { exact: true }).click();
  await page.getByText('Admin Dashboard', { exact: true }).click();

  await expect(page.getByText('Admin Access')).toBeVisible();
  await page.getByPlaceholder('Admin ID').fill('admin');
  await page.getByPlaceholder('Passcode').fill('test-admin-password');
  await page.getByRole('button', { name: 'Enter Dashboard' }).click();

  await expect(page.getByText('Active Players')).toBeVisible();
  await expect(page.getByText('Games In Progress')).toBeVisible();
  await expect(page.getByText('Games Over Time (Last 7 Days)')).toBeVisible();
  await expect(page.getByText('Outcome Distribution')).toBeVisible();
  await expect(page.getByText(/^Players \(\d+\)$/)).toBeVisible();
});

test('rejects incorrect admin credentials', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Account', { exact: true }).click();
  await page.getByText('Admin Dashboard', { exact: true }).click();

  await page.getByPlaceholder('Admin ID').fill('admin');
  await page.getByPlaceholder('Passcode').fill('wrong-password');
  await page.getByRole('button', { name: 'Enter Dashboard' }).click();

  await expect(page.getByText('Incorrect username or password.')).toBeVisible();
});
