import { expect, test } from '@playwright/test';
import { mockNative } from './mock';

test('the app list keeps terminal agents and the learning page links to the tool library', async ({ page }) => {
  await mockNative(page);
  await page.goto('/?view=available');
  await expect(page.getByRole('heading', { name: /Terminal tools \(/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Helper tools' })).toHaveCount(0);
  const helpers = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Helper tools', exact: true });
  await helpers.click();
  await expect(page).toHaveURL(/\/tools$/);
  await expect(helpers).toHaveAttribute('aria-current', 'page');
});

test('the library explains helpers and agent skills in their own groups', async ({ page }) => {
  await mockNative(page);
  await page.goto('/tools');
  await page.getByRole('tablist').getByRole('tab').first().click();
  const helpers = page.getByRole('tabpanel', { name: 'Helpers', exact: true });
  await expect(helpers.getByRole('heading', { name: 'Helpers', exact: true })).toBeVisible();
  await page.getByRole('tablist').getByRole('tab').nth(1).click();
  const skills = page.getByRole('tabpanel', { name: 'Skills', exact: true });
  await expect(skills.getByRole('heading', { name: 'Skills', exact: true })).toBeVisible();
  await expect(skills.getByRole('link', { name: /Spec Kit/ })).toHaveAttribute('href', '/learning/spec-kit?view=reference');
  await page.getByRole('tablist').getByRole('tab').nth(2).click();
  await expect(page.getByRole('tabpanel', { name: 'Plugins' }).getByRole('heading', { name: 'Plugins', exact: true })).toBeVisible();
  await page.getByRole('tablist').getByRole('tab').first().click();
});

test('the old helper address opens the tool library', async ({ page }) => {
  await mockNative(page);
  await page.goto('/helpers');
  await expect(page).toHaveURL(/\/tools$/);
  await expect(page.getByRole('heading', { name: 'Tools and skills' })).toBeVisible();
});
