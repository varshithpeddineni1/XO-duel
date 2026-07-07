import { expect, test } from '@playwright/test';

// Complements the exhaustive unit test (server/src/domain/minimax.test.ts) with one real
// playthrough over the actual HTTP + UI path: pick the impossible tier, always play the
// first available cell, and confirm the game never ends in a loss (TEST-4).
test('vs AI (impossible): plays a full game and never loses', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'vs AI' }).click();
  await page.getByRole('button', { name: 'Impossible' }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();

  let lastStatus: string | undefined;
  let lastWinner: string | null | undefined;

  for (let i = 0; i < 5; i++) {
    const emptyCell = page.getByRole('button', { name: /Cell \d, empty/ }).first();
    if ((await emptyCell.count()) === 0) break;

    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/moves') && res.request().method() === 'POST',
    );
    await emptyCell.click();
    const response = await responsePromise;
    const body = (await response.json()) as { status: string; winner: string | null };
    lastStatus = body.status;
    lastWinner = body.winner;
    if (body.status === 'complete') break;
  }

  expect(lastStatus).toBe('complete');
  expect(lastWinner === 'draw' || lastWinner === 'X').toBe(true);

  await expect(page.getByText(/Wins!|Draw/)).toBeVisible();
  await expect(page.getByText('AI Wins')).toHaveCount(0);
});
