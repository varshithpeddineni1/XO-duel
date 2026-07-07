import { expect, test, type Page } from '@playwright/test';

async function registerNewAccount(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/');
  await page.getByText('Account', { exact: true }).click();
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password', { exact: true }).fill(password);
  await page.getByPlaceholder('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Signed in')).toBeVisible();
}

// Plays one game to completion (X always wins the top row) from a board already showing 9
// empty cells on both pages, then — unless this is the last game — requests and accepts a
// rematch so the next game starts immediately, without re-creating a room from scratch.
async function playOneGame(pageA: Page, pageB: Page, isLastGame: boolean): Promise<void> {
  await pageA.getByRole('button', { name: 'Cell 1, empty' }).click();
  await expect(pageB.getByRole('button', { name: 'Cell 1, X' })).toBeVisible();
  await pageB.getByRole('button', { name: 'Cell 4, empty' }).click();
  await expect(pageA.getByRole('button', { name: 'Cell 4, O' })).toBeVisible();
  await pageA.getByRole('button', { name: 'Cell 2, empty' }).click();
  await expect(pageB.getByRole('button', { name: 'Cell 2, X' })).toBeVisible();
  await pageB.getByRole('button', { name: 'Cell 5, empty' }).click();
  await expect(pageA.getByRole('button', { name: 'Cell 5, O' })).toBeVisible();
  await pageA.getByRole('button', { name: 'Cell 3, empty' }).click(); // completes the top row

  await expect(pageA.getByText('You Win!')).toBeVisible();
  await expect(pageB.getByText('You Lose')).toBeVisible();

  if (!isLastGame) {
    await pageA.getByRole('button', { name: 'Request Rematch' }).click();
    await pageB.getByRole('button', { name: 'Accept Rematch' }).click();
    await expect(pageA.getByRole('button', { name: /Cell \d, empty/ })).toHaveCount(9);
    await expect(pageB.getByRole('button', { name: /Cell \d, empty/ })).toHaveCount(9);
  }
}

// The ranking formula (a resolved open spec decision) requires >= 5 online games before a
// player is ranked, so this test plays 5 rather than the single game a literal reading of
// the spec's own verify line suggests — the point being verified (a completed online game
// between two registered accounts shows up on the leaderboard) is the same either way.
test('two registered accounts play online games to the ranking threshold and both appear on the global leaderboard', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const stamp = Date.now();
  const usernameA = `lbe2eA_${stamp}`;
  const usernameB = `lbe2eB_${stamp}`;
  await registerNewAccount(pageA, usernameA, 'longenoughpass');
  await registerNewAccount(pageB, usernameB, 'longenoughpass');

  await pageA.getByText('Home', { exact: true }).click();
  await pageA.getByRole('button', { name: 'Online Multiplayer' }).click();
  await expect(pageA.getByText('Waiting for opponent…')).toBeVisible();
  const inviteCode = await pageA.getByTestId('invite-code').innerText();

  await pageB.goto(`/?join=${inviteCode}`);
  await expect(pageA.getByRole('button', { name: 'Cell 1, empty' })).toBeVisible();
  await expect(pageB.getByRole('button', { name: 'Cell 1, empty' })).toBeVisible();

  for (let i = 0; i < 5; i++) {
    await playOneGame(pageA, pageB, i === 4);
  }

  await pageA.getByRole('button', { name: 'Back to Home' }).click();
  await pageA.getByText('Ranks', { exact: true }).click();
  await pageA.getByText('Global', { exact: true }).click();

  const winnerRow = pageA.getByText(usernameA, { exact: true }).locator('..');
  await expect(winnerRow).toContainText('5-0-0');
  const loserRow = pageA.getByText(usernameB, { exact: true }).locator('..');
  await expect(loserRow).toContainText('0-5-0');

  await contextA.close();
  await contextB.close();
});
