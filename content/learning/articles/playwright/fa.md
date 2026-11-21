# Playwright: آزمون مرورگری پروژه

رفتار واقعی رابط کاربری را در مرورگر تست کنید، نه فقط منطق کد.

## چه می‌دهد

Playwright مرورگر را برنامه‌ریزی می‌کند: کلیک، تایپ، ناوبری و بررسی متن یا استایل. برای آزمون‌هایی لازم است که فقط با تست واحد دیده نمی‌شوند، مثل وقتی می‌خواهید مطمئن شوید متن فارسی راست‌چین است یا دکمه در حالت درست غیرفعال می‌شود.

## نصب

```bash
npm i -D @playwright/test
npx playwright install
```

اگر Microsoft Edge یا Chrome روی سیستم نصب است، نیازی به دانلود مرورگر نیست؛ در `playwright.config` بنویسید:

```js
export default defineConfig({
  use: { channel: 'msedge' },
});
```

## اولین تست

```js
import { test, expect } from '@playwright/test';

test('صفحهٔ اصلی بارگذاری می‌شود', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'شروع' })).toBeVisible();
});
```

```bash
npx playwright test
```

## آزمون فارسی و RTL

وقتی رابط فارسی است، جهت را هم بررسی کنید؛ درستی متن تضمین نمی‌کند که چیدمان درست است:

```js
await expect(page.locator('.prompt')).toHaveAttribute('dir', 'rtl');
await expect(page.locator('pre')).toHaveCSS('direction', 'ltr');
```

به `dir="auto"` برای محتوای تولیدشده تکیه نکنید: اگر یکی از فرزندان `unicode-bidi: plaintext` داشته باشد، مرورگر دیگر جهت را resolve نمی‌کند و متن فارسی سمت چپ می‌ماند. مقدار صریح (`rtl`/`ltr`) بدهید.

## مرزها

- آزمون مرورگری کند است؛ آن را به هر تغییر کوچک گره نزنید.
- برای دیباگ شکست، trace بگیرید: `trace: 'retain-on-failure'` و سپس `npx playwright show-trace`.
- سبز بودن آزمون را فقط با اجرای واقعی گزارش کنید؛ آزمون اجرانشده شاهد نیست.

## گام بعدی

[آزمون اپ وب با ایجنت](/learning/webapp-testing) نشان می‌دهد چطور همین کار را به دستیار کدنویسی بسپارید.
