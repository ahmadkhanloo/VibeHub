import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

for (const lang of ['en', 'fa']) {
  test(`provider notes and draft tests stay separate from saved connections: ${lang}`, async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('vibehub.fixture.connections', JSON.stringify([
      {id:'nvidia-1',name:'First NVIDIA',providerId:'nvidia',baseUrl:'https://integrate.api.nvidia.com/v1',modelId:'model-one',hasKey:true},
      {id:'nvidia-2',name:'Second NVIDIA',providerId:'nvidia',baseUrl:'https://integrate.api.nvidia.com/v1',modelId:'model-two',hasKey:true},
    ])));
    await mockNative(page, 'model-discovery', lang);
    await page.goto('/models?provider=nvidia-build');
    await expect(page.getByTestId('provider-nvidia-build')).toHaveCount(1);
    await expect(page.getByTestId('connection-nvidia-1')).toBeVisible();
    await expect(page.getByTestId('connection-nvidia-2')).toBeVisible();
    const detail = page.locator('.model-workspace-detail');
    await detail.getByRole('button', { name: /^(Edit|ویرایش)$/ }).first().click();
    await detail.locator('textarea').fill('NVIDIA note یادداشت');
    await detail.getByRole('button', { name: /^(Save|ذخیره)$/ }).click();
    await page.reload();
    await expect(detail).toContainText('NVIDIA note یادداشت');
    await expect(page.getByTestId('connection-tile-nvidia-1')).toBeVisible();
    await expect(page.getByTestId('connection-tile-nvidia-2')).toBeVisible();
    await detail.getByRole('button', { name: /^(Edit|ویرایش)$/ }).first().click();
    await detail.locator('textarea').fill('Updated note');
    await detail.getByRole('button', { name: /^(Save|ذخیره)$/ }).click();
    await expect(detail).toContainText('Updated note');
    await page.getByRole('button', { name: /^(Try a custom URL|آزمایش آدرس دلخواه)$/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[id$="-url"]').fill('https://fixture.invalid/v1');
    await dialog.locator('input[id$="-model"]').fill('fixture-model');
    await dialog.getByRole('button', {name: /^(Test connection|تست اتصال)$/}).click();
    await dialog.getByRole('button', {name: /^(Confirm|تأیید)$/}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'provider_connection_preview_test').length)).toBe(1);
    expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'provider_connection_save').length)).toBe(0);
  });
}

test('saved connections and suggested providers stay on the same page, including on narrow screens', async ({ page }) => {
  await mockNative(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/connections/api');
  await expect(page.getByTestId('saved-connections')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Suggested providers' })).toBeVisible();
  const provider = page.getByTestId('provider-nvidia-build');
  await provider.focus();
  await page.keyboard.press('Enter');
  const detail = page.locator('.model-workspace-detail');
  await expect(detail.getByRole('heading', { name: 'NVIDIA API Catalog' })).toBeFocused();
  await expect(page.getByTestId('provider-list')).toBeVisible();
  await detail.getByRole('button', { name: 'Close' }).click();
  await expect(provider).toBeFocused();
  await expect(detail).toHaveCount(0);
});

test('provider links and browser Back preserve the one-page notebook', async ({ page }) => {
  await mockNative(page);
  await page.goto('/connections/api');
  const provider = page.getByTestId('provider-nvidia-build');
  await provider.click();
  await expect(page).toHaveURL(/provider=nvidia-build/);
  await expect(provider).toHaveAttribute('aria-pressed', 'true');
  await page.goBack();
  await expect(page).toHaveURL(/connections\/api$/);
  await expect(provider).toHaveAttribute('aria-pressed', 'false');
  await page.goto('/connections/api?provider=nvidia-build');
  await expect(provider).toHaveAttribute('aria-pressed', 'true');
});

test('editing a saved keyed connection reuses the vault key for its model list', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('vibehub.fixture.connections', JSON.stringify([
    {id:'nvidia-1',name:'First NVIDIA',providerId:'nvidia',baseUrl:'https://integrate.api.nvidia.com/v1',modelId:'model-one',hasKey:true},
  ])));
  await mockNative(page, 'model-discovery');
  await page.goto('/connections/api?provider=nvidia-build');
  const detail = page.locator('.model-workspace-detail');
  // The card's Edit button opens the connection editor (the first Edit in the panel belongs to the note section).
  const card = page.getByTestId('connection-nvidia-1');
  await card.getByRole('button', { name: /^(Edit|ویرایش)$/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: /^(Get models|دریافت مدل‌ها)$/ })).toBeVisible();
  await dialog.getByRole('button', { name: /^(Get models|دریافت مدل‌ها)$/ }).click();
  await expect(dialog.getByText('fixture-0', { exact: true })).toBeVisible();
  const calls = await page.evaluate(() => (window as any).__mock.calls
    .filter((c: any) => ['provider_connection_models', 'provider_connection_preview_models'].includes(c.cmd))
    .map((c: any) => c.cmd));
  expect(calls).toEqual(['provider_connection_models']);
});

test('an empty notebook still suggests providers and does not add catalogue filters', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('vibehub.fixture.connections', JSON.stringify([])));
  await mockNative(page, 'model-discovery');
  await page.goto('/connections/api');
  await expect(page.getByTestId('saved-connections')).toContainText('No connections saved yet.');
  await expect(page.getByTestId('provider-cerebras')).toBeVisible();
  await expect(page.getByTestId('provider-ollama')).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
});

test('adding two connections to the same provider creates distinct records', async ({ page }) => {
  await mockNative(page);
  await page.goto('/connections/api?provider=groq');
  for (const name of ['Groq work', 'Groq personal']) {
    await page.getByRole('button', { name: 'Add connection', exact: true }).click();
    const editor = page.getByRole('dialog');
    await editor.locator('input[id$="-name"]').fill(name);
    await editor.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(editor).toHaveCount(0);
  }
  const saved = page.getByTestId('saved-connections');
  await expect(saved.getByRole('button', { name: /Groq work/ })).toBeVisible();
  await expect(saved.getByRole('button', { name: /Groq personal/ })).toBeVisible();
});
