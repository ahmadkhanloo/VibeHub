import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('the opaque accounts page explains the blob-swap limits for ZCode', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/zcode?tab=accounts');
  // The browser preview must say so instead of pretending a session was found.
  await expect(page.getByRole('heading', { name: /Real ZCode accounts/i })).toBeVisible();
  await expect(page.getByText(/cannot read the session file/i)).toBeVisible();
});

test('the opaque accounts page is reachable for Qoder too', async ({ page }) => {
  await mockNative(page);
  await page.goto('/app/qoder?tab=accounts');
  await expect(page.getByRole('heading', { name: /Real Qoder accounts/i })).toBeVisible();
});
