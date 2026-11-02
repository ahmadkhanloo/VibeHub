درس ۱ از ۳ · زمان پیشنهادی: ۲۰ تا ۳۰ دقیقه، همراه تمرین

در پایان می‌توانی دو نسخهٔ فایل را ثبت کنی و تفاوتشان را ببینی.

## آماده شو

Git تاریخچهٔ تغییر فایل‌ها را روی رایانه نگه می‌دارد؛ GitHub میزبان آنلاین مخزن است. برای این درس حساب GitHub لازم نیست.

[Git برای ویندوز؛ بازکردن در مرورگر](https://git-scm.com/install/windows) را نصب کن، PowerShell را دوباره باز کن و نسخه را بررسی کن:

```powershell
git --version
```

نام و ایمیل نویسنده را تنظیم کن؛ عبارت‌های نمونه را عوض کن. این اطلاعات در کامیت دیده می‌شوند و تنظیم global روی مخزن‌های دیگر هم اثر دارد؛ این کار ورود به GitHub نیست.

```powershell
git config --global user.name "Your Name"
```

```powershell
git config --global user.email "you@example.com"
```

## پوشهٔ تمرینی بساز

در محل دلخواه، خارج از پروژه‌های واقعی، پوشهٔ تازه بساز:

```powershell
mkdir git-practice
```

وارد همان پوشه شو:

```powershell
cd git-practice
```

مخزن را با شاخهٔ main آغاز کن:

```powershell
git init -b main
```

فایل را در Notepad باز کن، بنویس First note، ذخیره کن و ببند:

```powershell
notepad notes.txt
```

## اولین نسخه را ثبت کن

تغییر فایل، آماده‌کردن برای ثبت و کامیت سه مرحلهٔ جدا هستند. staging یعنی انتخاب نسخه‌ای از تغییرات برای کامیت بعدی.

وضعیت را بخوان؛ notes.txt باید untracked باشد:

```powershell
git status
```

همان فایل را برای ثبت انتخاب کن:

```powershell
git add notes.txt
```

اولین نسخه را ثبت کن؛ کامیت محلی است و چیزی آپلود نمی‌کند:

```powershell
git commit -m "Add first note"
```

## نسخهٔ دوم را مقایسه کن

فایل را دوباره باز کن، خط Second note را اضافه و ذخیره کن:

```powershell
notepad notes.txt
```

خط افزوده را ببین؛ اگر نمایشگر باز شد با q خارج شو:

```powershell
git diff
```

تغییر دوم را آماده کن:

```powershell
git add notes.txt
```

نسخهٔ دوم را ثبت کن:

```powershell
git commit -m "Add second note"
```

اکنون باید دو کامیت ببینی:

```powershell
git log --oneline
```

تفاوت دو نسخهٔ ثبت‌شده را ببین:

```powershell
git diff HEAD~1 HEAD -- notes.txt
```

## خودت امتحان کن

یک خط سوم اضافه کن و status و diff را بخوان، اما هنوز کامیت نکن. آیا خط سوم در آخرین کامیت هست؟ نه؛ فقط در فایل محلی است. پیش از درس بعد، آن را بررسی و مثل مراحل بالا ثبت کن. Git جای پشتیبان‌گیری فایل‌های ثبت‌نشده را نمی‌گیرد.

**[قدم بعدی: درس ۲؛ تغییرات ایجنت و GitHub](/learning/git-agent-github?category=git)**
