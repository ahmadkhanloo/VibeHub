import { test, expect } from '@playwright/test';
import { mockNative } from './mock';

// The tools destination folded into the workspace: three plain groups — apps, the
// terminal tools the CLI agents share, and the helper tools documented beside them.
// The fixture reports no installed CLI agents, so the terminal card is checked in the
// available view where the terminal group exists.
test('the workspace groups terminal tools and helper tools', async ({ page }) => {
  await mockNative(page);
  await page.goto('/?view=available');
  await expect(page.getByRole('heading', { name: /Terminal tools \(/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Terminal and Persian text/ })).toHaveAttribute('href', '/terminal');
  const helpers = page.getByRole('region', { name: 'Helper tools' });
  await expect(helpers).toBeVisible();
  // Helper chips stay low-key: slim links to their learning articles, status as a dot.
  for (const [label, href] of [
    ['Playwright', '/learning/playwright'],
    ['RepoWise', '/learning/repowise'],
    ['Superpowers', '/learning/superpowers'],
    ['Hindsight', '/learning/hindsight'],
    ['DSH Workspace Hygiene', '/learning/dsh-workspace-hygiene'],
  ] as const) {
    await expect(helpers.getByRole('link', { name: label })).toHaveAttribute('href', href);
  }
  await expect(helpers.getByRole('link', { name: /find-skills/ })).toHaveCount(0);
  await expect(helpers.getByRole('link', { name: 'Ponytail' })).toHaveAttribute('href', '/learning/ponytail');
  await expect(helpers.getByRole('link', { name: 'UI/UX Pro Max' })).toHaveAttribute('href', '/learning/ui-ux-pro-max');
  await expect(helpers.getByRole('link', { name: 'Unslop' })).toHaveAttribute('href', '/learning/unslop');
  // Machine-level status stays a fact, not a claim: dots only, wording lives in the tooltip.
  const dots = helpers.locator('.vh-chip-dot');
  await expect(dots.first()).toBeVisible();
  expect(await dots.count()).toBeGreaterThanOrEqual(6);
});

test('a developer tool card opens its learning article', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await page.getByRole('link', { name: /Playwright/ }).first().click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/learning/playwright');
  // The article is bundled with the app, so it must render without a published feed.
  await expect(page.getByRole('heading', { name: /browser testing for your project/i })).toBeVisible();
});

test('the old tools route redirects to the workspace and the rail no longer lists it', async ({ page }) => {
  await mockNative(page);
  await page.goto('/tools');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/');
  await expect(page.getByRole('complementary').getByRole('link', { name: 'Tools', exact: true })).toHaveCount(0);
});
