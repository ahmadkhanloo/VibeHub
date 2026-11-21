import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

// The daily quota lives in its own tab of the accounts hub (and on the quota
// app's own page) — never inside the Codex accounts tab.
test('the daily quota of the coding apps is shown on its own accounts-hub tab', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts?app=quota');
  const panel = page.getByTestId('quota-panel');
  await expect(panel).toBeVisible();
  const qoder = page.getByTestId('quota-qoder');
  await expect(qoder).toContainText('782 of 2,400 Credits left');
  await expect(qoder.getByRole('button', { name: 'Claim the daily credits' })).toBeEnabled();
  await expect(page.getByRole('tab', { name: 'Daily quota' })).toHaveAttribute('aria-selected', 'true');
});

test('the Codex accounts tab no longer embeds the quota panel', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts');
  await expect(page.getByRole('tab', { name: 'ChatGPT / Codex' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('quota-panel')).toHaveCount(0);
});

test('an app that is not running says so and offers to open it through VibeHub', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts?app=quota');
  const minimax = page.getByTestId('quota-minimax-code');
  await expect(minimax).toContainText('The app is not running.');
  await expect(minimax.getByRole('button', { name: 'Open through VibeHub' })).toBeVisible();
  await expect(minimax.getByRole('button', { name: 'Claim the daily credits' })).toBeDisabled();
});

test('claiming the daily reward reports what was received', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts?app=quota');
  await page.getByTestId('quota-qoder').getByRole('button', { name: 'Claim the daily credits' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Received 100 points' })).toBeVisible();
});

test('the quota app page scopes the panel to its own app', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/minimax-code?tab=quota');
  await expect(page.getByTestId('quota-minimax-code')).toBeVisible();
  await expect(page.getByTestId('quota-qoder')).toHaveCount(0);
});
