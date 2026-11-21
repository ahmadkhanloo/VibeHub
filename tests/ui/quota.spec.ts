import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

// Each quota publisher lives inside its own hub tab: Qoder stacks its quota under
// its opaque accounts, MiniMax Code has a quota-only tab. The Codex accounts tab
// stays about accounts only.
test("Qoder's hub tab stacks its accounts and its daily quota", async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts?app=qoder');
  await expect(page.getByRole('tab', { name: 'Qoder' })).toHaveAttribute('aria-selected', 'true');
  const qoder = page.getByTestId('quota-qoder');
  await expect(qoder).toContainText('782 of 2,400 Credits left');
  await expect(qoder.getByRole('button', { name: 'Claim the daily credits' })).toBeEnabled();
  await expect(page.getByTestId('quota-minimax-code')).toHaveCount(0);
});

test("MiniMax Code's hub tab is quota-only", async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts?app=minimax-code');
  await expect(page.getByRole('tab', { name: 'MiniMax Code' })).toHaveAttribute('aria-selected', 'true');
  const minimax = page.getByTestId('quota-minimax-code');
  await expect(minimax).toContainText('The app is not running.');
  await expect(minimax.getByRole('button', { name: 'Open through VibeHub' })).toBeVisible();
  await expect(minimax.getByRole('button', { name: 'Claim the daily credits' })).toBeDisabled();
  await expect(page.getByTestId('quota-qoder')).toHaveCount(0);
});

test('the Codex accounts tab no longer embeds the quota panel', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts');
  await expect(page.getByRole('tab', { name: 'ChatGPT / Codex' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('quota-panel')).toHaveCount(0);
});

test('claiming the daily reward reports what was received', async ({ page }) => {
  await mockNative(page);
  await page.goto('/accounts?app=qoder');
  await page.getByTestId('quota-qoder').getByRole('button', { name: 'Claim the daily credits' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Received 100 points' })).toBeVisible();
});

test('the quota app page scopes the panel to its own app', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/minimax-code?tab=quota');
  await expect(page.getByTestId('quota-minimax-code')).toBeVisible();
  await expect(page.getByTestId('quota-qoder')).toHaveCount(0);
});
