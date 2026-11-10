import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

test('free API presets are listed and Workers AI requires an account ID', async ({ page }) => {
  await mockNative(page);
  await page.goto('/models');
  await page.locator('main input[type=search]').first().fill('groq');
  await expect(page.getByTestId('provider-groq')).toBeVisible();
  await page.locator('main input[type=search]').first().fill('cloudflare');
  await expect(page.getByTestId('provider-cloudflare-workers-ai')).toBeVisible();
  await page.locator('main input[type=search]').first().fill('');

  await page.getByRole('button', { name: 'Try a custom URL', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const provider = dialog.getByRole('combobox');
  const baseUrl = dialog.getByLabel('Base URL');
  await provider.selectOption('groq');
  await expect(baseUrl).toHaveValue('https://api.groq.com/openai/v1');
  await provider.selectOption('cloudflare-workers-ai');
  await expect(baseUrl).toHaveValue('https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1');
  await dialog.getByRole('button', { name: 'Save connection' }).click();
  await expect(baseUrl).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('alert')).toContainText('Cloudflare account ID');

  await baseUrl.fill('https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1');
  await dialog.getByRole('button', { name: 'Save connection' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-testid^="connection-"]').filter({ hasText: 'Cloudflare Workers AI' })).toBeVisible();
});

test('API test requires confirmation and unauthenticated local models do not claim a key was authenticated', async ({ page }) => {
  await mockNative(page);
  await page.addInitScript(() => {
    const original = (window as any).__TAURI_INTERNALS__.invoke;
    (window as any).__TAURI_INTERNALS__.invoke = (cmd: string, args: any) => {
      if (cmd === 'provider_connection_test') {
        (window as any).__mock.calls.push({cmd,args});
        return Promise.resolve({dnsResolved:true,httpResponse:true,authRequired:false,authValidated:false,modelResponded:true,httpStatus:200});
      }
      return original(cmd,args);
    };
  });
  await page.goto('/models');
  await page.getByTestId('provider-ollama').click();
  await page.getByRole('button',{name:'Test connection',exact:true}).click();
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'provider_connection_test').length)).toBe(0);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'provider_connection_test').length)).toBe(0);
  await page.getByRole('button',{name:'Test connection',exact:true}).click();
  await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(page.getByText('Key authenticated: Not required for this connection')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__mock.calls.filter((c: any) => c.cmd === 'provider_connection_test')))
    .toEqual([{cmd:'provider_connection_test',args:{id:'connection-local'}}]);
});


for (const lang of ['en', 'fa']) {
  test(`model discovery previews, saves and filters live results in ${lang}`, async ({ page }) => {
    await mockNative(page, 'model-discovery', lang);
    await page.goto('/models');
    await page.getByRole('button', { name: /^(Try a custom URL|آزمایش آدرس دلخواه)$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('combobox')).toHaveValue('custom');
    const url = dialog.locator('input[id$="-url"]');
    const key = dialog.locator('input[type=password]');
    await url.fill('https://old.example.invalid/v1');
    await key.fill('old-fixture-key');
    await url.fill('https://models.example.invalid/v1');
    await expect(key).toHaveValue('');
    await key.fill('fixture-key');

    const get = /Get models|\u062f\u0631\u06cc\u0627\u0641\u062a \u0645\u062f\u0644/;
    const refresh = /Refresh models|\u062a\u0627\u0632\u0647.\u0633\u0627\u0632\u06cc \u0645\u062f\u0644/;
    await dialog.getByRole('button', { name: get }).click();
    await expect(dialog.getByText('fixture-0', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__mock.calls
      .filter((call: any) => ['provider_connection_preview_models', 'provider_connection_save', 'provider_connection_models'].includes(call.cmd)))).toEqual([
      { cmd: 'provider_connection_preview_models', args: {
        providerId: 'custom', baseUrl: 'https://models.example.invalid/v1', key: 'fixture-key',
      } },
    ]);
    await dialog.getByRole('combobox').last().selectOption('free');
    await dialog.getByRole('searchbox').fill('FIXTURE-19');
    await expect(dialog.getByRole('listitem')).toHaveCount(3);
    await expect(dialog.getByText(/3.*200/)).toBeVisible();
    await dialog.locator('button[type=submit]').click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await page.locator('main input[type=search]').first().fill('models.example.invalid');
    await page.locator('[data-testid^="provider-custom:"]').click();

    const card = page.locator('[data-testid^=connection-]').filter({ hasText: 'OpenAI-compatible' });
    await expect(card.getByRole('button', { name: /Test connection|\u062a\u0633\u062a \u0627\u062a\u0635\u0627\u0644/ })).toBeDisabled();
    await card.getByRole('button', { name: get }).click();
    await expect(card.getByText('fixture-0', { exact: true })).toBeVisible();
    await card.getByRole('combobox').selectOption('free');
    await card.getByRole('searchbox').fill('fixture-new');
    await expect(card.getByRole('listitem')).toHaveCount(0);
    await page.evaluate(() => { (window as any).__mock.updatedModels = true; });
    await card.getByRole('button', { name: refresh }).click();
    await expect(card.getByText('fixture-new', { exact: true })).toBeVisible();

    await page.evaluate(() => { (window as any).__mock.failModelList = true; });
    await card.getByRole('button', { name: refresh }).click();
    await expect(card.getByRole('alert')).toBeVisible();
    await expect(card.getByText('fixture-new', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__mock.calls
      .filter((call: any) => call.cmd === 'provider_connection_models')
      .map((call: any) => Object.keys(call.args)))).toEqual([['id'], ['id'], ['id']]);
    const savedTime = await card.locator('bdi').first().textContent();
    await page.reload();
    await page.locator('main input[type=search]').first().fill('models.example.invalid');
    await page.locator('[data-testid^="provider-custom:"]').click();
    await expect(card.getByText('fixture-new', { exact: true })).toBeVisible();
    await expect(card.locator('bdi').first()).toHaveText(savedTime ?? '');
    await expect(card.getByRole('button', { name: refresh })).toBeVisible();
  });
}
