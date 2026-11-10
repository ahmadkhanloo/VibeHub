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
    await page.getByRole('button', { name: /^(My notes|یادداشت‌های من)$/ }).click();
    await expect(page.getByTestId('provider-nvidia-build')).toBeVisible();
    const noteList = page.locator('.model-workspace-list');
    await expect(noteList).toContainText('NVIDIA note یادداشت');
    await noteList.getByRole('button', { name: /^(Edit|ویرایش)$/ }).click();
    await noteList.locator('textarea').fill('Updated note');
    await noteList.getByRole('button', { name: /^(Save|ذخیره)$/ }).click();
    await expect(noteList).toContainText('Updated note');
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

test('provider details are navigable on a narrow screen', async ({ page }) => {
  await mockNative(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/connections/api');
  await page.getByRole('searchbox', { name: 'Search providers and notes' }).fill('NVIDIA');
  await page.getByTestId('provider-nvidia-build').click();
  await expect(page.locator('.model-workspace-detail')).toBeVisible();
  await expect(page.locator('.model-workspace-list')).toBeHidden();
  await page.getByRole('button', { name: 'Back to list' }).click();
  await expect(page.locator('.model-workspace-list')).toBeVisible();
});

test('wide screens keep the two-panel workspace and the selection in the URL', async ({ page }) => {
  await mockNative(page);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/connections/api');
  const list = page.locator('.model-workspace-list');
  await expect(list).toHaveCSS('display', 'grid');
  await page.getByRole('searchbox', { name: 'Search providers and notes' }).fill('NVIDIA');
  const provider = page.getByTestId('provider-nvidia-build');
  await expect(provider.locator('img')).toBeVisible();
  await provider.click();
  await expect(page.locator('.model-workspace-detail')).toContainText('NVIDIA API Catalog');
  // The list stays visible next to the detail panel; Back to list only exists below 960px.
  await expect(list).toBeVisible();
  await expect(page.locator('.model-back')).toBeHidden();
  await expect(page).toHaveURL(/provider=nvidia-build/);
  // Browser Back undoes the selection and restores the searched list state.
  await page.goBack();
  await expect(page).toHaveURL(/connections\/api\?q=NVIDIA$/);
  await expect(provider).not.toHaveAttribute('aria-selected', 'true');
  // Reloading a deep link restores the same selection.
  await page.goto('/connections/api?provider=nvidia-build');
  await expect(provider).toHaveAttribute('aria-selected', 'true');
});

test('search covers connection names and model ids, not just provider names', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('vibehub.fixture.connections', JSON.stringify([
    {id:'nvidia-1',name:'First NVIDIA gateway',providerId:'nvidia',baseUrl:'https://integrate.api.nvidia.com/v1',modelId:'model-one',hasKey:true},
  ])));
  await mockNative(page, 'model-discovery');
  await page.goto('/connections/api');
  const search = page.getByRole('searchbox', { name: 'Search providers and notes' });
  await search.fill('First NVIDIA gateway');
  await expect(page.getByTestId('provider-nvidia-build')).toBeVisible();
  await search.fill('model-one');
  await expect(page.getByTestId('provider-nvidia-build')).toBeVisible();
  await search.fill('no-such-thing-anywhere');
  await expect(page.locator('.model-workspace-list')).toContainText('No matching providers.');
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

test('empty saved and notes views get their own guidance', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('vibehub.fixture.connections', JSON.stringify([])));
  await mockNative(page, 'model-discovery');
  await page.goto('/connections/api');
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(page.getByText('No connections saved yet.')).toBeVisible();
  await expect(page.getByText(/Add a connection to keep its endpoint/)).toBeVisible();
  await page.getByRole('button', { name: 'My notes', exact: true }).click();
  await expect(page.getByText('No notes yet.')).toBeVisible();
});

test('provider tiles form a listbox with arrow-key navigation', async ({ page }) => {
  await mockNative(page);
  await page.goto('/connections/api');
  const list = page.getByRole('listbox', { name: 'Providers' });
  await expect(list).toBeVisible();
  await page.getByTestId('provider-anthropic').focus();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('provider-ollama')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.model-workspace-detail')).toContainText('Ollama');
  await page.keyboard.press('ArrowRight');
  // Sorted order: the seeded Ollama connection first, then catalog rows alphabetically (Anthropic before APInex).
  await expect(page.getByTestId('provider-anthropic')).toHaveAttribute('aria-selected', 'true');
  // Exactly one option stays selected.
  await expect(list.locator('[aria-selected="true"]')).toHaveCount(1);
});
