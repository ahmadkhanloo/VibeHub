import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('priority providers and workspace tabs', async ({page}) => {
  await mockNative(page);
  await page.goto('/connections/api?view=providers');
  await expect(page.locator('.model-provider-row').first()).toContainText('OpenRouter');
  await expect(page.locator('.model-provider-row').nth(1)).toContainText('Radeon');
  await expect(page.locator('.model-provider-row').nth(2)).toContainText('NVIDIA');
  await page.goto('/?view=available');
  await expect(page.getByRole('link', {name:'GitHub Copilot CLI'})).toBeVisible();
  await page.getByRole('link', {name:'GitHub Copilot CLI'}).click();
  await expect(page.getByRole('heading', {name:'GitHub Copilot CLI'}).first()).toBeVisible();
});

for (const language of ['en', 'fa']) {
  test('workspace views keep their own history entry in ' + language, async ({page}) => {
    await mockNative(page, 'ready', language);
    await page.goto('/');
    const nav = page.locator('nav.vh-choice-group');
    await expect(nav.locator('button').first()).toHaveAttribute('aria-pressed', 'true');
    await nav.locator('button').nth(1).click();
    await expect(page).toHaveURL(/view=available/);
    await expect(nav.locator('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(nav.locator('button').first()).toHaveAttribute('aria-pressed', 'true');
  });
}

for (const provider of ['openrouter', 'radeon-cloud', 'nvidia-build']) {
  test('provider direct link opens ' + provider, async ({page}) => {
    await mockNative(page);
    await page.goto('/connections/api?provider=' + provider);
    await expect(page.getByTestId('provider-' + provider)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.model-workspace-detail')).toContainText(provider === 'radeon-cloud' ? 'Radeon' : provider === 'openrouter' ? 'OpenRouter' : 'NVIDIA');
  });
}
