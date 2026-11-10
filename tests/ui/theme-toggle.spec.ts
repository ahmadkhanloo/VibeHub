import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

/** The switch lives in the top bar, flips the resolved appearance and remembers the choice. */
test('the day/night switch flips the theme and remembers the choice', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  const toggle = page.locator('.vh-topbar').getByRole('switch', { name: 'Day and night' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('vibehub.settings.v1') ?? '{}').themeMode)).toBe('dark');

  // The explicit choice outlives a reload instead of falling back to the system preference.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('the switch is keyboard operable and labeled in Persian', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  await page.goto('/');
  const toggle = page.locator('.vh-topbar').getByRole('switch', { name: 'شب و روز' });
  await expect(toggle).toBeVisible();
  // The shell moves focus to the page heading on navigation; wait for that first,
  // then drive the switch purely from the keyboard.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await toggle.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
});

test('the switch keeps its compact size on a narrow screen without overflowing', async ({ page }) => {
  await mockNative(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('.vh-topbar').getByRole('switch');
  const box = await toggle.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(92);
  expect(box?.height ?? 0).toBeLessThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
