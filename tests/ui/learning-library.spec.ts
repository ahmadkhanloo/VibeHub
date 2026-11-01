import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('topic library unifies document skills and supports search and difficulty', async ({ page }) => {
  await mockNative(page);
  await page.goto('/guides/extensions');
  await page.getByRole('button', { name: 'Read and create documents', exact: true }).click();
  const collection = page.getByRole('region', { name: 'Read and create documents', exact: true });
  await expect(collection.getByRole('heading', { name: 'pdf', exact: true })).toBeVisible();
  await expect(collection.getByRole('heading', { name: 'docx', exact: true })).toBeVisible();
  await expect(collection.getByRole('heading', { name: 'xlsx', exact: true })).toBeVisible();
  await expect(collection.getByRole('heading', { name: 'pptx', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'frontend-design', exact: true })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search guides', exact: true }).fill('xlsx');
  await expect(collection.getByRole('heading', { name: 'xlsx', exact: true })).toBeVisible();
  await expect(collection.getByRole('heading', { name: 'pdf', exact: true })).toHaveCount(0);
  await page.getByLabel('Difficulty', { exact: true }).selectOption('advanced');
  await expect(page.getByText('No matching guides', { exact: true })).toBeVisible();
});

test('app guides show the Claude Code path and local educational illustrations in Persian', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  await page.goto('/guides/claude-code');
  await expect(page.getByRole('heading', { name: 'Claude Code', exact: true })).toBeVisible();
  await expect(page.locator('figure img').first()).toBeVisible();
  await expect.poll(() => page.locator('figure img').first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('link', { name: 'بازبینی کد با Claude', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
