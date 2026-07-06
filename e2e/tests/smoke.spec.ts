import { test, expect } from '@playwright/test';

// This is a placeholder-page smoke test, not one of the 11 real screens (Phase 2+ owns
// those). It exists so the CI/e2e gate is real from the first PR (CI-2, CI-6) and so the
// design tokens + theme system (ARC-3, ARC-3a) are verified end to end, not just by reading
// the CSS.

test('renders the placeholder home content', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('XO Duel');
  await expect(page.getByText('Challenge anyone. Anywhere. Anytime.')).toBeVisible();
});

test('defaults to the OS color-scheme preference and screenshots both themes', async ({ page }) => {
  const backgrounds: Record<string, string> = {};

  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);

    backgrounds[scheme] = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    await page.screenshot({ path: `screenshots/${scheme}.png`, fullPage: true });
  }

  expect(backgrounds.dark).not.toBe(backgrounds.light);
});

test('toggling the theme flips [data-theme] and persists across reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: /switch to light mode/i }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
});
