# VibeHub

VibeHub یک همراه دسکتاپ رایگان و متن‌باز برای پیدا کردن و پیکربندی ابزارهای AI Coding است. مجوز ابزارها، نوع دسترسی رایگان، شرایط منطقه‌ای و قابلیت‌های خود VibeHub جداگانه نمایش داده می‌شوند؛ VibeHub میزبان مدل یا سرویس پروکسی نیست.

**کانال انتشار:** VibeHub در مرحلهٔ بتا است؛ برای آزمایش از [پیش‌انتشارهای GitHub](https://github.com/ahmadkhanloo/VibeHub/releases) استفاده کنید. آزمون نصب و ارتقا روی ویندوز تمیز هنوز تکمیل نشده است. نسخه‌های تاریخی AgentRTL با شمارهٔ v1.x انتشار VibeHub محسوب نمی‌شوند. شواهد و گیت‌های باقی‌مانده در [ماتریس پذیرش](docs/validation/VibeHub_Release_Acceptance_Matrix.md) ثبت می‌شوند.

## نصب در ویندوز

فایل نصب واحد در انتشار با نام `VibeHub-Setup.exe` ارائه می‌شود و دو انتخاب دارد:

- **VibeHub کامل:** هاب دسکتاپ و هر سه میانبر RTL.
- **فقط میانبرهای RTL:** انتخاب جداگانهٔ ZCode، Qoder و DeepSeek Harness.

Node.js نسخهٔ 24.22.1 LTS با کنترل SHA-256 همراه نصب‌کننده قرار می‌گیرد و PATH یا Node نصب‌شدهٔ سیستم تغییر نمی‌کند. خود ZCode، Qoder و DeepSeek Harness باید جداگانه از مسیر رسمی نصب شوند؛ اگر در مسیر سفارشی باشند، میانبر RTL هنگام اجرا مسیر فایل آن‌ها را می‌پرسد. نبود برنامهٔ اصلی مانع نصب میانبر RTL نیست. خروجی MSI غیرفعال است. به‌روزرسانی خودکار فقط برای نصب کامل VibeHub فعال است؛ برای تغییر یا به‌روزرسانی نصب RTL-only از همین Setup استفاده کنید.

پیش از انتشار عمومی، نصب، ارتقا و حذف روی ویندوز ۱۰ و ۱۱ تمیز باید آزموده شوند.

## توسعه

پیش‌نیازها: Node.js نسخهٔ ۲۰ یا جدیدتر، pnpm نسخهٔ ۱۲٫۱۵٫۰، Rust پایدار و در ویندوز WebView2.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm check
corepack pnpm build
corepack pnpm --filter @vibehub/desktop tauri dev
```

برای ساخت Setup ویندوز، ابتدا Runtime پین‌شدهٔ Node.js و فایل‌های آداپتر را آماده کنید:

```powershell
./scripts/prepare-windows-rtl-payload.ps1
corepack pnpm --filter @vibehub/desktop tauri build --bundles nsis
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
- [مخزن VibeHub](https://github.com/ahmadkhanloo/VibeHub)
