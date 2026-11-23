import { expect, test } from '@playwright/test';
import { mockNative } from './mock';

test('global search groups exact app, lesson and navigation matches and returns focus', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const trigger = page.getByRole('button', { name: 'Search…', exact: true });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  expect((await trigger.boundingBox())!.width).toBeLessThanOrEqual(44);
  await trigger.focus();
  await page.keyboard.press('Control+k');
  const search = page.getByRole('searchbox');
  await expect(search).toBeFocused();
  await search.fill('QODER');
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('a[href="/app/qoder"]')).toBeVisible();
  await expect(dialog.locator('a[href="/learning/qoder"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await search.fill('support');
  await dialog.locator('a[href="/settings?section=support"]').click();
  await expect(page).toHaveURL(/settings\?section=support$/);
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeFocused();
});

test('a shared search URL stays editable and reflects the current query', async ({ page }) => {
  await mockNative(page);
  await page.goto('/search?q=Qoder');
  const search = page.getByRole('searchbox');
  await expect(search).toHaveValue('Qoder');
  await search.fill('OpenCode');
  await expect(page).toHaveURL(/search\?q=OpenCode$/);
  await expect(page.getByRole('main').locator('a[href="/app/opencode"]')).toBeVisible();
  await expect(search).toBeFocused();
});

test('learning finds Persian text in a lesson outside the selected category', async ({ page }) => {
  await mockNative(page, 'ready', 'fa');
  await page.goto('/learning?category=applications');
  await expect(page.locator('.vh-page-title-row button[aria-haspopup="dialog"]')).toHaveCount(0);
  await page.locator('.vh-search-trigger').click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('learning');
  const search = page.getByRole('searchbox');
  await search.fill('كتابخانه استاندارد');
  const result = page.getByRole('dialog').locator('a[href="/learning/ponytail"]');
  await expect(result).toBeVisible();
  await expect(result).toContainText('کتابخانهٔ استاندارد');
  await search.clear();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/category=applications$/);
});

test('warm search responds within the budget and opens an exact offer', async ({ page }) => {
  await mockNative(page);
  await page.goto('/learning');
  await page.getByRole('button', { name: 'Search…', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search scope' }).selectOption('learning');
  await page.getByRole('searchbox').fill('Playwright');
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('a[href="/learning/playwright"]')).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveCount(0);
  const responseMs = await page.getByRole('searchbox').evaluate(input => new Promise<number>((resolve, reject) => {
    const start = performance.now();
    const target = 'a[href="/learning?view=news&offer=qoder-qwen-flash"]';
    const observer = new MutationObserver(() => {
      if (document.querySelector(target)) {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(performance.now() - start);
      }
    });
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error('Offer result did not render')); }, 2000);
    observer.observe(input.closest('dialog')!, { childList: true, subtree: true });
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Qwen Flash Qoder');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }));
  expect(responseMs).toBeLessThan(150);
  await dialog.locator('a[href="/learning?view=news&offer=qoder-qwen-flash"]').click();
  await expect(page.locator('details#offer-qoder-qwen-flash')).toHaveAttribute('open', '');
});
