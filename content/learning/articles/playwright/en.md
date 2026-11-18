# Playwright: browser testing for your project

Test what the interface really does in a browser, not only what the code computes.

## What it gives you

Playwright drives a browser: clicks, typing, navigation, and assertions on text or computed style. You need it for behaviour that unit tests cannot see — for example, that Persian text is right-aligned or that a button is disabled in the right state.

## Install

```bash
npm i -D @playwright/test
npx playwright install
```

If Microsoft Edge or Chrome is already installed, skip the browser download and point the config at it:

```js
export default defineConfig({
  use: { channel: 'msedge' },
});
```

## Your first test

```js
import { test, expect } from '@playwright/test';

test('the home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Start' })).toBeVisible();
});
```

```bash
npx playwright test
```

## Testing Persian and RTL

Correct text does not prove correct layout, so assert direction as well:

```js
await expect(page.locator('.prompt')).toHaveAttribute('dir', 'rtl');
await expect(page.locator('pre')).toHaveCSS('direction', 'ltr');
```

Do not rely on `dir="auto"` for generated content: if any descendant uses `unicode-bidi: plaintext`, the browser stops resolving it and Persian drifts to the left. Write an explicit value.

## Limits

- Browser tests are slow; do not tie them to every small change.
- Capture a trace when a test fails: `trace: 'retain-on-failure'`, then `npx playwright show-trace`.
- Report a test as passing only when it actually ran.

## Next step

[Test a web app with an agent](/learning/webapp-testing) shows how to hand this work to a coding assistant.
