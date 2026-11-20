# افزونه‌های DeepSeek Harness: نصب و مدیریت مشترک

همهٔ افزونه‌های Harness یک مسیر مشترک برای نصب، به‌روزرسانی و حذف دارند. اینجا آن دستورهای عمومی را یک بار می‌بینید؛ مقالهٔ هر افزونه فقط بخش‌های خاص همان افزونه را توضیح می‌دهد.

## پروفایل‌ها

افزونه‌ها روی پروفایل‌ها نصب می‌شوند: `desktop` برای برنامهٔ دسکتاپ و `web` برای نسخهٔ وب. پرچم `--profile` تعیین می‌کند کدام یک. مسیر هر پروفایل `~/.dsh/profiles/<نام>/` است.

## نصب، به‌روزرسانی و حذف

```bash
dsh plugin --profile desktop add <package>
dsh plugin --profile desktop update <package>@latest
dsh plugin --profile desktop remove <package>
```

این دستورها آرگومان‌ها را مستقیم به pnpm در پوشهٔ پروفایل می‌دهند. برای نسخهٔ وب همان دستورها با `--profile web`. منبع بسته می‌تواند نام npm باشد (`dsh-context`)، نشانی گیت‌هاب (`github:<owner>/<repo>`) یا فایل بستهٔ محلی (`file:<مسیر tgz>`).

از داخل برنامه هم می‌توانید بدون ترمینال نصب کنید: Settings → Plugin Market (یا Add plugin) را باز کنید، نام افزونه را جست‌وجو و نصب کنید.

## پس از نصب

Harness را دوباره باز کنید تا بسته‌های تازه بارگذاری شوند. افزونه‌های نصب‌شدهٔ هر پروفایل در `package.json` همان پروفایل و بخش `dsh.profile.bundles` دیده می‌شود؛ با `dsh plugin --profile desktop why <package>` هم می‌توانید علت حضور یک بسته را ببینید.

## پیش از نصب افزونهٔ غیررسمی

منبع را بخوانید، نسخهٔ سازگار با نسخهٔ Harness خود را در Releases یا README بررسی کنید و بدانید افزونه به چه داده‌ای دسترسی دارد و به کجا می‌فرستد. افزونه‌های معرفی‌شده در این برنامه هر کدام مقالهٔ جدا دارند:

- [dsh-deepseek-web-login: ورود وب دیپ‌سیک](/learning/dsh-deepseek-web-login)
- [dsh-context: دیدن زمینهٔ گفتگو](/learning/dsh-context)
- [dsh-squeeze: خواندن مطلب طولانی](/learning/dsh-squeeze)
- [dsh-playwright: مرورگر واقعی](/learning/dsh-playwright)
- [dsh-workspace-hygiene: نظم فضای کار](/learning/dsh-workspace-hygiene)
- [dsh-subagent-model-router: مدل هر کار واگذارشده](/learning/dsh-subagent-model-router)
- [dsh-our-free-model: کانال مدل رایگان](/learning/dsh-our-free-model)

سازگاری میزبان، پیش‌نیازها و حذف ایمن اسکیل‌ها را نیز در [نصب و مدیریت اسکیل‌ها](/learning/skill-basics) ببینید.
