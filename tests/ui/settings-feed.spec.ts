import { test, expect } from '@playwright/test';
import { mockNative } from './mock';
import { version } from '../../apps/desktop/package.json';

test('content feed edits are saved only after explicit confirmation', async ({ page }) => {
  await mockNative(page);
  await page.goto('/settings?section=updates');
  await expect(page.getByRole('tab', { name: 'Updates', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Updates', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: `Current version ${version}`, exact: true })).toBeVisible();
  await page.getByText('Advanced', { exact: true }).click();
  const field = page.getByLabel('Content feed address');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1')!).feedBaseUrl);
  await field.fill('https://example.org/feed');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1')!).feedBaseUrl)).toBe(before);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1')!).feedBaseUrl)).toBe('https://example.org/feed');
});
