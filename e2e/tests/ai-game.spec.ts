import { expect, test } from '@playwright/test';

// Complements the exhaustive unit test (server/src/domain/minimax.test.ts) with one real
// playthrough over the actual HTTP + UI path: pick the impossible tier, always play the
// first available cell (an intentionally naive human strategy), and confirm X never wins
// (TEST-4). The AI plays O, so "the AI never loses" means X draws at best — the AI winning
// outright is a valid, expected outcome here, not a failure.
test('vs AI (impossible): X never wins, at best a draw', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'vs AI' }).click();
  await page.getByRole('button', { name: 'Impossible' }).click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  // Wait for the board to actually render (the create-game request can be momentarily
  // slow, e.g. a cold connection pool) — .count() below doesn't auto-wait the way
  // .click()/expect(...).toBeVisible() do, so without this the loop could see 0 empty
  // cells on its very first check and bail out having never played a move.
  await expect(page.getByRole('button', { name: 'Cell 1, empty' })).toBeVisible();

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
  expect(lastWinner).not.toBe('X');

  await expect(page.getByText(/Wins!|Draw/)).toBeVisible();
  await expect(page.getByText('You Win!')).toHaveCount(0);
});
