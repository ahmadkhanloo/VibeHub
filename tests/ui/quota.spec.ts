import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('the daily quota of the coding apps is shown on the accounts page', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/chatgpt?tab=accounts');
  const panel = page.getByTestId('quota-panel');
  await expect(panel).toBeVisible();
  const qoder = page.getByTestId('quota-qoder');
  await expect(qoder).toContainText('782 of 2,400 Credits left');
  await expect(qoder.getByRole('button', { name: 'Claim the daily credits' })).toBeEnabled();
});

test('an app that is not running says so and offers to open it through VibeHub', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/chatgpt?tab=accounts');
  const minimax = page.getByTestId('quota-minimax-code');
  await expect(minimax).toContainText('The app is not running.');
  await expect(minimax.getByRole('button', { name: 'Open through VibeHub' })).toBeVisible();
  await expect(minimax.getByRole('button', { name: 'Claim the daily credits' })).toBeDisabled();
});

test('claiming the daily reward reports what was received', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/chatgpt?tab=accounts');
  await page.getByTestId('quota-qoder').getByRole('button', { name: 'Claim the daily credits' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Received 100 points' })).toBeVisible();
});
