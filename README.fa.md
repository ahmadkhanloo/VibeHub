# VibeHub

VibeHub یک همراه دسکتاپ رایگان و متن‌باز برای پیدا کردن و پیکربندی ابزارهای AI Coding است. مجوز ابزارها، نوع دسترسی رایگان، شرایط منطقه‌ای و قابلیت‌های خود VibeHub جداگانه نمایش داده می‌شوند؛ VibeHub میزبان مدل یا سرویس پروکسی نیست.

**وضعیت انتشار:** VibeHub هنوز به‌صورت عمومی منتشر نشده است. Build محلی یا نصب‌کنندهٔ تاریخی AgentRTL را انتشار Production و نهایی VibeHub در نظر نگیرید. وضعیت شواهد و گیت‌های باقی‌مانده در [ماتریس پذیرش](docs/validation/VibeHub_Release_Acceptance_Matrix.md) ثبت می‌شود. مقصد عمومی برنامه [github.com/ahmadkhanloo/VibeHub](https://github.com/ahmadkhanloo/VibeHub) است و تغییر نام مخزن تا دریافت مجوز صریح و تکمیل گیت‌های ۱۶ تا ۱۹ انجام نمی‌شود.

## توسعه

پیش‌نیازها: Node.js نسخهٔ ۲۰ یا جدیدتر، pnpm نسخهٔ ۱۲٫۱۵٫۰، Rust پایدار و در ویندوز WebView2.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm check
corepack pnpm build
corepack pnpm --filter @vibehub/desktop tauri dev
```

Build وب فقط رابط را بررسی می‌کند. اجرای Tauri، adapterهای بومی، updater امضاشده، نصب‌کنندهٔ Production و رفتار پس از انتشار گیت‌های جداگانه دارند و از موفقیت Build وب نتیجه نمی‌شوند.

## حریم خصوصی و ایمنی

- حساب VibeHub، اشتراک، telemetry، API مدل میزبانی‌شده یا VPN داخلی جزو طرح محصول نیست.
- دسترسی رایگان، مجوز متن‌باز و دسترسی منطقه‌ای سرویس‌های ثالث ویژگی‌های جداگانه‌اند و ممکن است تغییر کنند.
- فید کاتالوگ و راهنما داده است و نمی‌تواند فرمان یا کد اجرایی ارائه کند.
- ثبت‌نام referral و دانلود رسمی هر ابزار دو کار اختیاری و جدا هستند. مسیر بدون referral برای ZCode در [zcode.z.ai](https://zcode.z.ai/) قرار دارد.

## اسناد پروژه

- [پلن جامع فارسی](docs/product/VibeHub_Final_Master_Plan_v4_FA.md)
- [دستور اجرای انگلیسی](docs/product/VibeHub_Final_Agent_Prompt_EN_v4.md)
- [ماتریس پذیرش Release](docs/validation/VibeHub_Release_Acceptance_Matrix.md)
- [مجوز MIT](LICENSE)
