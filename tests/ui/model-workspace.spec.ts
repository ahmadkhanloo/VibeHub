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

test('providers show logos in a grid and open a dedicated detail view', async ({ page }) => {
  await mockNative(page);
  await page.goto('/connections/api');
  const list = page.locator('.model-workspace-list');
  await expect(list).toHaveCSS('display', 'grid');
  await page.getByRole('searchbox', { name: 'Search providers and notes' }).fill('NVIDIA');
  const provider = page.getByTestId('provider-nvidia-build');
  await expect(provider.locator('img')).toBeVisible();
  await provider.click();
  await expect(list).toBeHidden();
  await expect(page.locator('.model-workspace-detail')).toContainText('NVIDIA');
  await page.getByRole('button', { name: 'Back to list' }).click();
  await expect(list).toBeVisible();
});
