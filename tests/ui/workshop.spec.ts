import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('the workshop path lists the beginner steps and marks progress on the device', async ({ page }) => {
  await mockNative(page);
  await page.goto('/workshop');
  await expect(page.getByRole('heading', { name: 'Two-day workshop path' })).toBeVisible();
  const steps = page.getByTestId('workshop-step');
  await expect(steps).toHaveCount(8);
  await expect(page.getByText('0 of 8 steps done')).toBeVisible();

  const first = steps.first();
  await first.getByTestId('workshop-step-toggle').click();
  await expect(first).toHaveClass(/border-success\/50/);
  await expect(page.getByText('1 of 8 steps done')).toBeVisible();

  await page.reload();
  await expect(page.getByText('1 of 8 steps done')).toBeVisible();
  await expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('vibehub.progress.v1') ?? '{}')).length)).toBe(1);

  await first.getByTestId('workshop-step-toggle').click();
  await expect(page.getByText('0 of 8 steps done')).toBeVisible();
});

test('workshop mode narrows the sidebar and survives reload', async ({ page }) => {
  await mockNative(page);
  await page.goto('/settings');
  const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(sidebar.getByRole('link', { name: 'Proxy', exact: true })).toBeVisible();

  await page.getByRole('switch', { name: 'Workshop mode' }).click();
  await expect(sidebar.getByRole('link', { name: 'Two-day workshop path' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Learn', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'AI connections', exact: true })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Proxy', exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Diagnostics', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(sidebar.getByRole('link', { name: 'Two-day workshop path' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Diagnostics', exact: true })).toHaveCount(0);

  await page.getByRole('switch', { name: 'Workshop mode' }).click();
  await expect(sidebar.getByRole('link', { name: 'Diagnostics', exact: true })).toBeVisible();
});

test('lesson progress marks from the learning list persist in local storage', async ({ page }) => {
  await mockNative(page);
  await page.goto('/learning');
  const row = page.getByTestId('learning-row').first();
  await expect(row).toBeVisible();
  const articleId = await row.getAttribute('data-article');
  expect(articleId).toBeTruthy();

  await row.getByTestId('lesson-done-toggle').click();
  await expect(row.locator('.vh-learning-done')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.progress.v1') ?? '{}'))).toEqual({ [articleId as string]: true });

  await page.goto(`/learning/${articleId}`);
  await expect(page.getByTestId('lesson-done-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Lesson done' })).toBeVisible();
});
