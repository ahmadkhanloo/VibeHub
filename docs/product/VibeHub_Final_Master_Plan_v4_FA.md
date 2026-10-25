# VibeHub — برنامه نهایی محصول، طراحی رابط و دستور اجرای مرحله‌به‌مرحله (v4)

**مبنای توسعه:** https://github.com/ahmadkhanloo/AgentRTL  
**تاریخ تدوین:** ۲۶ اکتبر ۲۰۲۶  
**ورودی طراحی ترمینال:** `mak-devline.omp.json` ارسالی مالک محصول  
**وضعیت:** سند الزامات و پذیرش؛ این سند به‌تنهایی به معنی اجرای تغییرات در GitHub نیست.  
**نوع محصول:** کاملاً رایگان و متن‌باز، بدون حساب اجباری، بدون اشتراک/نسخه Pro، بدون فروش API، بدون پردازش پروژه کاربران در سرور VibeHub.  
**پلتفرم انتشار اولیه:** Windows x64، سپس Linux و macOS پس از آزمون عملی.

---

## ۰. هدف، وعده محصول و خط قرمزها

### ۰.۱ مأموریت

تبدیل درجا و کامل مخزن AgentRTL به **VibeHub**: هاب دسکتاپ برای کشف، مقایسه، نصب، راه‌اندازی و استفاده از ابزارهای رایگان AI Coding، به‌خصوص در شرایط کاربران ایرانی؛ همراه با تجربه فارسی/انگلیسی، RTL برای IDEهای سازگار، پروکسی محلی موجود کاربر، مدل‌ها و APIهای رایگان/دارای سهمیه، راهنما، آفرها و آماده‌سازی اختیاری ترمینال.

### ۰.۲ وعده‌های قابل اثبات

1. **تمام امکانات و کد خود VibeHub رایگان و متن‌باز است.** هیچ Paywall، تبلیغات VibeHub، حساب اجباری، لایسنس‌کی، محدودیت مصنوعی یا تله ارتقای پولی وجود ندارد؛ انتشار تحت MIT (یا مجوز آزاد سازگار در صورت ضرورت فنی)، با `LICENSE`، `NOTICE/THIRD_PARTY_LICENSES`، SBOM و سورس قابل Build.
2. **هزینه سرویس‌های ثالث مستقل است.** هر سرویس معرفی‌شده *حداقل یک مسیر استفاده رایگانِ واقعی و قابل بررسی* دارد؛ ممکن است سهمیه، زمان آزمایشی، تبلیغات، محدودیت جغرافیایی یا مدل‌های پولی اختیاری هم داشته باشد. «رایگان»، «متن‌باز»، «بدون ثبت‌نام» و «دردسترس از ایران» چهار ویژگی مستقل هستند؛ هیچ‌یک از دیگری نتیجه نمی‌شود.
3. **مسیرهای معرفی‌شده صادقانه‌اند.** با منبع رسمی، `lastVerified`، محدودیت، نیاز به کارت/ثبت‌نام، وضعیت ایران و شرایط استفاده. اگر داده تأیید نشده است، `Unknown` نمایش داده شود و دکمه مرتبط وعده دروغین ندهد.
4. **برنامه هرگز برای استفاده به VPN داخلی، سرور VibeHub یا سرویس مدل پولی خودمان وابسته نیست.** اتصال اختیاری به Proxy در حال اجرای کاربر فقط در حدود مجوزهای هر سرویس انجام می‌شود. VibeHub ابزار تغییر هویت یا عبور از شرایط استفاده خدمات نیست.
5. **عملکرد واقعی بر نمایشی اولویت دارد.** دکمه Install، Launch، Launch with RTL، Test Proxy، Test API، Update، Restore فقط هنگامی فعال شود که پیاده‌سازی واقعی و پشتیبانی‌شده وجود داشته باشد.
6. **همه متن‌های فارسی قابل کنترل در خود VibeHub با Vazirmatn رندر می‌شوند**؛ بدون CDN، بدون وابستگی آنلاین به فونت. تنها استثنا در گلیف‌های تخصصی کد/ترمینال است که لایه فونت مونو و Nerd Font لازم دارند. جزئیات بند ۳.

### ۰.۳ دامنه متن‌باز در کاتالوگ

- حالت فیلتر `Open-source only` باید ابزارهای دارای مخزن و مجوز متن‌باز **تأییدشده** را نشان دهد.
- `All tools with free access` می‌تواند ابزار بسته/مالکیتی با پلن رایگان را نشان دهد، ولی با برچسب صریح `Proprietary` و جدا از نرم‌افزارهای FOSS.
- **تمام قابلیت‌های نصب‌شده در خود VibeHub** از مؤلفه‌های رایگان و با مجوز قابل بازتوزیع استفاده کنند. ابزارهای خارجی با دانلود از ناشر خود نصب می‌شوند، نه اینکه فایل بسته‌شده مالکیتی بدون مجوز در بسته VibeHub قرار گیرد.
- NVIDIA API یک **خدمت بیرونی** است، نه بخش آزاد/متن‌باز خود VibeHub. فهرست مدل‌ها مجوز مدل را جدا از مجوز خدمت API نمایش دهد.

### ۰.۴ خارج از محدوده

- میزبانی LLM، فروش Credits، راه‌اندازی VPN عمومی/مدیریت سرور، ساخت حساب خودکار، حل CAPTCHA، ساخت اکانت انبوه یا چندگانه، دورزدن سیاست مکان/سهمیه سرویس‌ها، تقلب در Referral.
- ورود خودکار به حساب سرویس‌ها، خواندن Cookie/Token از برنامه‌های ثالث، مهندسی معکوس API داخلی یک Agent یا استفاده از API غیررسمی آن.
- نصب بی‌اجازه سیستم‌عامل، تغییر Proxy سراسری، تغییر دائمی فایل‌های برنامه ثالث، تغییر پروفایل شل بدون نسخه پشتیبان و امکان بازگردانی.

---

## ۱. فهرست ابزارها و سرویس‌های نسخه نهایی

### ۱.۱ شش ابزار اصلی قابل مشاهده از اولین نسخه

| شناسه | نام نمایشی | گونه | وضعیت کاتالوگ | سطح پیاده‌سازی نسخه نخست |
|---|---|---|---|---|
| `zcode` | ZCode | IDE / Harness | دارای مسیر رایگان، شرایط متغیر؛ قابلیت RTL فعلی | تشخیص، نصب هدایت‌شده، اجرای RTL و Proxy در صورت امکان |
| `qoder` | Qoder | IDE | Community/BYOK و امکانات رایگان طبق شرایط جاری؛ قابلیت RTL فعلی | تشخیص، راهنمای نصب، RTL، Proxy قابل آزمون |
| `deepseek-harness` | DeepSeek Harness | Agent/desktop harness | مخزن و شرایط نسخه باید تأیید شوند؛ RTL فعلی | تشخیص، نصب راهنما، RTL و Proxy |
| `opencode` | OpenCode | CLI + Desktop/extension | متن‌باز؛ مدل‌های رایگان منتخب؛ مسیرهای پولی مستقل | نصب و اجرای CLI، تشخیص نسخه، راهنما؛ RTL با قابلیت پشتیبانی مستقل |
| `mimocode` | MiMo Code | CLI / Agent | کد MIT با محدودیت‌های استفاده/علامت تجاری؛ امکان مدل رایگان متغیر | نصب و اجرای CLI، راهنما، Provider setup؛ RTL بدون ادعای پشتیبانی تا تست |
| `freebuff` | Freebuff (نه «Freebuf») | CLI + Desktop/Web | کد Apache-2.0؛ استفاده رایگان پشتیبانی‌شده با تبلیغات؛ قوانین دسترسی متمایز | مسیر نصب رسمی، اجرای رسمی CLI/Desktop، آموزش، شروط استفاده |

**قاعده اجرایی:** حضور در Explore به معنی `RTL Supported` یا `One-click Installer` بودن نیست. `Discoverable / Installable / Launchable / RTL Verified / Proxy Verified / Configurable` شش Capability جداگانه‌اند؛ UI باید از Manifest و آزمون واقعی تولید شود. فقط Adapter دارای آزمون می‌تواند ادعای Launch with RTL کند.

**OpenCode:** طبق مستندات رسمی، OpenCode 1 و OpenCode 2 هر دو فرمان `opencode` دارند و نباید در محل پیش‌فرض کنار هم نصب شوند. Adapter باید تشخیص نسخه و Conflict Resolution داشته باشد؛ نصب V2 پیش‌فرض مشروط به سازگاری و تأیید آخرین دستور رسمی است. 

**MiMo Code:** مجوز مخزن MIT است، ولی Use Restrictions و شرایط سرویس میزبانی‌شده Xiaomi جداگانه‌اند. سهمیه MiMo-V2.5 که در زمان عرضه «موقت» معرفی شد، نباید به شکل سهمیه دائمی کپی شود.

**Freebuff:** شرایط سرویس رسمی اجازه استفاده رایگان در کلاینت‌های رسمی را با محدودیت‌های خاص می‌دهند؛ از بازپخش درخواست‌ها، اتصال مستقیم به Endpointهای خصوصی و استفاده از VPN برای جا زدن مکان جغرافیایی در راستای گرفتن مزایای نامجاز اجتناب شود. نمایش *فنی* امکان Proxy در لانچر نباید جانشین بررسی شرایط حقوقی/سرویس شود. وضعیت و قوانین با نسخه و تاریخ منتشرشده بررسی شوند.

### ۱.۲ Providerها و منابع مدل

| شناسه | دسته | انتظار از UX | ملاحظات |
|---|---|---|---|
| `nvidia-build` | NVIDIA API Catalog / NIM hosted endpoints | صفحه توضیح، راهنمای ایجاد حساب/کلید، تست مجاز مدل از API رسمی با تأیید کاربر | Developer Program دسترسی توسعه/آزمایش می‌دهد؛ میزان سهمیه، مجوز تجاری، دسترسی منطقه‌ای و در دسترس‌بودن هر مدل باید زمان استفاده کنترل شود. خود API متن‌باز نیست. |
| `openrouter` | Model aggregator | فهرست مدل‌های واقعاً رایگان، محدودیت روزانه، راهنمای BYOK | لیست و سقف رایگان پویا؛ فقط مدل‌های `free` معتبر معرفی شوند. |
| `ollama` | Local inference runtime | نصب رسمی/آموزش مدل محلی و بررسی RAM/VRAM | خود اجرای محلی هزینه اشتراک ندارد؛ مصرف منابع و لایسنس وزن مدل جداست. |
| `custom-openai-compatible` | Generic endpoint | فرم Base URL، Model ID، API Key، تست اختیاری | هزینه/قانون سرویس را VibeHub تضمین نمی‌کند. |

**قانون ورود به «Free-first catalog»:** هر گزینه‌ای که رایگان بودنش قابل تأیید نباشد یا فقط با روش نامجاز/پرداخت قابل استفاده باشد از لیست توصیه‌شده حذف، یا با `Unverified / Not currently free` به اطلاعات آرشیوی منتقل شود. تعداد Credits ثابت در کد ثبت نشود.

### ۱.۳ وضعیت دسترسی از ایران

دو بُعد مستقل در کارت و راهنما نشان داده شوند:
- `Network access`: Direct tested / Proxy may be needed / Blocked or unavailable / Not tested.
- `Account & policy eligibility`: Supported / Restricted / Unknown / Review terms.

برای هر نتیجه `testedOn`, `region`, `networkType`, `appVersion`, `verifiedBy`, `sourceUrl`, `confidence` ذخیره شود. «VPN لازم است» نتیجه تجربی در یک شبکه است، نه دستور قطعی یا تضمین مجاز بودن استفاده. برای Qoder، تجربه کاربر مبنی بر نیاز احتمالی هنگام ثبت‌نام و عدم نیاز بعدی به‌عنوان **گزارش جامعه با تاریخ و شبکه** نمایش داده شود، نه حقیقت تأییدشده دائمی.

---

## ۲. معماری فنی پیشنهادی

- **Desktop:** Tauri 2 + Rust برای قابلیت‌های Native دارای مجوز مشخص؛ React، TypeScript، Vite.
- **UI:** Tailwind CSS + shadcn/ui primitives با wrapper دوزبانه، Lucide، React Router، TanStack Query برای داده پویا.
- **Persistence:** Tauri Store برای تنظیمات، SQLite برای کاتالوگ و اعلان خوانده‌شده (یا ذخیره معادل ساده با Migration رسمی)؛ Secrets فقط در OS Credential Manager/Vault.
- **i18n:** `i18next` + `react-i18next` و اعتبارسنجی کامل کلیدهای `fa/en` در CI.
- **Data safety:** Zod/JSON Schema با نسخه schema و allowlist URL؛ داده از GitHub فقط **اطلاعات** است، نه اسکریپت، فرمان نصب یا CSS/HTML دلخواه.
- **RTL engine:** منطق فعلی CDP را تبدیل به ماژول/Sidecar محافظت‌شده کن؛ Runtime Node.js برای کاربر نهایی **نباید پیش‌نیاز جدا** باشد. مسیر انتخابی Rust یا Sidecar بسته‌بندی‌شده با آزمون رگرسیون.
- **Installer/Launcher Adapter:** تعامل Native با منابع رسمی؛ فایل اجرایی ناشر با اعتبارسنجی امضا و Hash در صورت وجود؛ کنترل مالکیت پردازه، نسخه، Path، Debug Port، مدیریت Exit.
- **Proxy profiles:** HTTP/SOCKS5/System/Direct، Config در هر App، test و سیاست `Require Proxy`; بدون Proxy سراسری اجباری یا واسط HTTP مبتنی بر سرور VibeHub.
- **Online feeds:** GitHub Pages + GitHub Actions در همان مخزن؛ برنامه دارای snapshot آفلاین/کش است؛ Feed جدا از Updater امضاشده اپ.
- **Automated update:** Signed Tauri updater با metadata در مسیر اختصاصی VibeHub، Buildهای Windows در GitHub Releases. GitHub Action مدیریت نسخه و Release Notes.

### ۲.۱ ساختار مطلوب مخزن

```text
AgentRTL/                         # repository URL may remain unchanged
├─ apps/
│  └─ desktop/
│     ├─ src/
│     │  ├─ app/                  # shell, routes, providers
│     │  ├─ components/           # design-system primitives
│     │  ├─ features/
│     │  │  ├─ home/ explore/ my-apps/ app-details/
│     │  │  ├─ models/ proxy/ terminal/ guides/
│     │  │  ├─ offers/ doctor/ settings/ onboarding/
│     │  ├─ i18n/{fa,en}/
│     │  ├─ styles/themes/
│     │  ├─ assets/fonts/         # bundled Vazirmatn from official OFL
│     │  └─ services/             # typed Native IPC, caching, guards
│     └─ src-tauri/
│        ├─ src/                  # Rust application services
│        ├─ capabilities/         # least-privilege permissions
│        └─ sidecars/             # if used, tracked as build artifacts
├─ packages/
│  ├─ core/                       # DTO, schemas, domain policy
│  ├─ catalog/                    # providers and app manifest adapters
│  ├─ launcher/                   # detection/install/launch contracts
│  ├─ rtl/                        # migrated AgentRTL logic
│  ├─ proxy/                      # per-app proxy policies and tests
│  └─ terminal/                   # Oh My Posh config, backup/rollback
├─ content/
│  ├─ apps/*.json                 # six tools; localized labels
│  ├─ providers/*.json            # Nvidia etc.
│  ├─ guides/{appId}/{fa,en}/*.md
│  ├─ offers/*.json
│  ├─ schemas/
│  └─ snapshots/                  # offline baseline content
├─ themes/
│  └─ terminal/mak-devline.omp.json
├─ docs/
│  ├─ product/                    # this plan, roadmap, decision log
│  ├─ legal/THIRD_PARTY_LICENSES.md
│  ├─ contributing/
│  └─ screenshots/
├─ .github/workflows/
│  ├─ ci.yml
│  ├─ build-release.yml
│  ├─ publish-content.yml
│  ├─ validate-content.yml
│  └─ verify-license-sbom.yml
├─ README.md
├─ README.fa.md
├─ CONTRIBUTING.md
└─ LICENSE
```

در زمان مهاجرت، فایل‌های فعلی `apps/ZCode`, `apps/Qoder`, `apps/DeepSeekHarness` تا زمانی که جایگزین و تست نشده‌اند حذف نشوند. شناسه Installer جدید می‌تواند مستقل از قبلی باشد، چون کاربر فعالی وجود ندارد. Git history حفظ شود.

---

## ۳. زبان، تایپوگرافی و تم‌ها — الزامات غیرقابل‌مذاکره

### ۳.۱ قانون Vazirmatn در سراسر محصول

- **Vazirmatn Variable** باید Font پیش‌فرض **تمام رشته‌های فارسی** در VibeHub باشد: Sidebar، Home، Explore، Modal، Tooltip، Toast، Search، Guide Markdown، Announcement، Forms، Tooltip، Chart Labels، Dialog، Empty State، پنجره Update و Installer UI داخلی.
- Font محلی و Offline در بسته نصب؛ `@font-face` با وزن 100–900 و `font-display: swap`، بدنه `font-family: Vazirmatn, sans-serif` و `lang="fa"` / `dir="rtl"` روی Root فارسی. هیچ `Tahoma` یا `Inter` به‌عنوان جایگزین معمول فارسی انتخاب نشود مگر خرابی فونت؛ تست Runtime باید `computedFontFamily` نمونه متن فارسی را تأیید کند.
- انگلیسی می‌تواند همان Vazirmatn را برای یکنواختی UI استفاده کند؛ در اجزای Code/URL/Log از یک Font مونو مجاز استفاده شود. رشته‌های دوزبانه باید از `bdi`, `unicode-bidi: isolate` و LTR isolation بهره ببرند، بدون تحمیل جهت به کد.
- **ترمینال استثنای تکنیکی دارد:** Windows Terminal و ترمینال داخل IDE اغلب یک فونت مونو برای سلول‌ها می‌خواهند. JetBrainsMono Nerd Font برای آیکن‌ها و مونو، و Vazirmatn نصب‌شده برای fallback فارسی به کار رود؛ تا زمان اثبات عملی نباید ادعا شود می‌توان فونت فارسی را در تمام ترمینال‌های خارجی اجبار کرد. در پنل ترمینالِ *درون خود VibeHub* اگر ساخته شد، glyph font fallback اختصاصی با Persian Vazirmatn اعمال شود.
- فونت‌های خارج از برنامه فقط با رضایت کاربر و در حد پشتیبانی سیستم نصب شوند. شرایط OFL و Notice ضمیمه شوند؛ هیچ وابستگی به Font CDN در حالت آفلاین.

### ۳.۲ زبان‌ها و جهت

- `fa-IR` و `en-US` هر دو کامل؛ زبان اولیه از OS Locale پیشنهاد شود، با امکان انتخاب روی Welcome و قابل تغییر فوری در Settings.
- فارسی: Sidebar راست، Breadcrumb و فرم‌ها راست‌چین، CTA و Chevronهای جهت‌دار متناسب با RTL. انگلیسی: عکس آن.
- تاریخ و عدد، طبق Locale انتخابی قابل تنظیم؛ مقدارهای کپی‌شونده (API Key، URL، Ports، Hash، Path، Git Command) **تغییر نویسه نمی‌دهند** و LTR باقی می‌مانند.
- حدود ۱۲ Namespace: `common`, `nav`, `home`, `apps`, `install`, `proxy`, `terminal`, `guides`, `offers`, `models`, `doctor`, `settings`, `errors`.
- چک کردن parity تمام کلیدهای ترجمه در CI؛ محتوای آموزشی fa/en با وضعیت `translated/untranslated` کنترل شود؛ نبود ترجمه با نشان روشن و Fallback انگلیسی، بدون صفحه شکسته.
- آزمایش متون ترکیبی فارسی/انگلیسی، اعداد، مسیرهای Windows، نشانه‌گذاری، URL، Command، نمایش Overflow و Window Scaling.

### ۳.۳ تم‌ها (Theme Family × Mode × Accent)

- **Mode:** `system / light / dark` (System واقعاً به تغییر سیستم‌عامل واکنش نشان بدهد).
- **Theme Family:** `Default (Graphite)`, `Nord`, `Catppuccin`, `Solarized`.
- **Variant:** چهار خانواده × دو روشن/تاریک = **۸ پالت واقعی**؛ برای Catppuccin از Latte/Mocha، برای Nord و Solarized از نسخه روشن و تاریک اصولی استفاده شود.
- **Accent:** Auto / Indigo / Emerald / Violet / Amber؛ باید با هر پالت از نظر contrast سازگار شود.
- CSS Semantic tokens: `--bg, --surface, --surface-alt, --text, --muted, --border, --primary, --primary-foreground, --success, --warning, --danger, --focus-ring`.
- از Hardcode رنگ Tailwind در Components جلوگیری شود. `Theme Gallery` پیش‌نمایش زنده داشته باشد؛ تنظیمات پس از Restart محفوظ بمانند و کاهش حرکت (reduced motion) محترم شمرده شود.

### ۳.۴ طراحی بصری و اندازه‌ها

- فرم کلی Developer Utility مدرن، کم‌نویز، بدون Cyberpunk glow اغراق‌شده، بدون طرح پولی/تبلیغاتی.
- Target Window: `1280×800`؛ Minimum: `1024×700`؛ DPI: 100/125/150%. Sidebar: 248px و حالت collapse 68px؛ Topbar حدود 64px.
- فضای بین بلوک‌ها 8/12/16/24px، Radius 12–16px، Border یک‌پیکسلی ظریف، انیمیشن 120–180ms، Skeleton برای loading.
- کارت برنامه: لوگو، عنوان، یک‌خط توضیح، نوع رایگان، برچسب متن‌باز، سازگاری RTL، نصب/اجرا؛ در حداکثر ۳ ستون و در عرض کمتر ۲ یا ۱ ستون.
- همه دکمه‌ها loading/disabled/success/error واقعی دارند؛ Ghost action برای کارکرد اجرا نشده مجاز نیست. جست‌وجوی سراسری `Ctrl+K`، پیمایش کیبورد و Screen Reader Labels.

---

## ۴. معماری اطلاعات، صفحه‌ها و قرارداد UX

### ۴.۱ ساختار Sidebar

ترتیب: **Home · Discover · My Apps · Models & APIs · Terminal Setup · Guides · Offers · Doctor · Settings**. پروکسی در Topbar میانبر ثابت و صفحه مستقل `Proxy Center` دارد. در فارسی ترتیب دیداری و لبه چسبیده Sidebar آینه شود. Badge اعلان فقط برای اطلاعات جدید تأییدشده.

### ۴.۲ Onboarding در ۴ مرحله قابل Skip

1. Welcome: زبان و توضیح صریح «Free & Open Source» و اینکه Providerها ثالث‌اند.
2. Appearance: System/Light/Dark، خانواده تم، Accent، نمونه Vazirmatn.
3. Environment: تشخیص OS، ابزارهای نصب‌شده، Git، پروکسی محلی با رضایت کاربر (بدون اسکن وسیع پورت)، Oh My Posh، Nerd Font.
4. Ready: انتخاب ابزار، راهنمای شروع، Skip هر بخش؛ حساب VibeHub لازم نیست.

### ۴.۳ Home

- Header فارسی «با ابزارهای رایگان، راحت‌تر کد بزن» / انگلیسی `Build more. Spend less.`؛ زیرعنوان بدون ادعای استفاده نامحدود از سرویس‌های ثالث.
- Quick Launch برای Installed Apps؛ Shortcut پروژه اخیر در نسخه بعدی.
- Featured Free Tools (حداکثر ۴ کارت)، Recommended Setup، `Proxy: Direct / Connected / Needs attention`، ۲ آفر تأییدشده فعال، Getting Started Guide.
- هیچ Carousel متحرک/بنر تبلیغی؛ Referral تنها در جزئیات اپ مرتبط و اختیاری.

### ۴.۴ Discover

- نوار جست‌وجو و فیلترهای: `Open-source only`, `Free forever / Free tier / Time-limited`, `Windows/macOS/Linux`, `GUI / CLI`, `RTL verified`, `VPN/Network status`, `No API Key required`.
- کارت‌ها دارای دو بخش ثابت `Free access` و `License`; مثال: Freebuff: `Ad-supported free access / Open-source code`; NVIDIA در لیست Provider است نه Desktop Harness.
- Tab های `All`, `IDE`, `CLI agents`, `Providers`, `Installed`.
- فیلتر همه ابزارها باید حتی بدون اینترنت روی snapshot کار کند.

### ۴.۵ App Details

- Header: لوگو، Version detected، type، FOSS license (در صورت تأیید)، Free access، Official Website.
- Primary Action وابسته به state: Install / Open Official Download / Launch / Launch with RTL (verified only).
- Secondary: `Read guide`, `Configure proxy`, `Terminal setup` (برای CLI), `Supported providers`.
- Sections: Overview، Free access conditions، Setup steps، Iran availability evidence، Supported features، Known issues، Release changes.
- Referral ZCode: توضیح کوتاه و آشکار «لینک دعوت پشتیبانی از نگهدارنده»، CTA اختیاری، `Skip / Official download` واضح؛ لینک ثبت‌نام از لینک نصب Executable جدا باشد.

### ۴.۶ Install Wizard

- ۴ state: `Checking prerequisites → Choosing trusted source → Download/Install → Detect & Verify`.
- نمایش Vendor، Domain، نسخه، نوع Permission، Hash/Signature (اگر قابل بازیابی)، Size، Destination، Recovery instruction.
- Abort، Retry، Open logs، Guide دستی؛ Force elevation ممنوع مگر لازم و با اعلان؛ Installerهای ناشناخته هرگز بی‌اجازه اجرا نشوند.
- `winget` و Installer رسمی در صورت موجود بودن، `npm` فقط با بسته رسمی/نسخه معتبر و تأیید کاربر؛ اجرای `curl | bash` از داده پویا ممنوع.
- در صورت نصب قبلی، `Launch` جایگزین نصب شود. Uninstall برنامه ثالث فقط از Uninstaller رسمی و با تأیید جداگانه.

### ۴.۷ My Apps

- ردیف ابزار با آیکن و نسخه، آخرین Launch، RTL Status، Proxy Profile، Troubleshoot، Open official site.
- برای CLI: `Open in Terminal` با پوشه کار و پروفایل منتخب؛ TUI داخل پنجره VibeHub فقط پس از اثبات کنترل PTY/resize/encoding؛ MVP از Windows Terminal یا ترمینال نصب‌شده استفاده کند.
- برای GUI: Launch عادی و Launch with RTL. اگر RTL عملی نشده، اقدام غیرفعال همراه علت و لینک درخواست پشتیبانی.
- وضعیت‌های Running، Needs exit/relaunch، Port conflict و Launch failed تعریف شوند.

### ۴.۸ Proxy Center

- انتخاب‌های `Direct`, `System`, `Local HTTP`, `Local SOCKS5`; فیلد Host default `127.0.0.1`، Port **بدون فرض ثابت** (نمونه متداول `10808/10809` فقط placeholder)، Credentials optional در Vault.
- پروفایل سراسری + override هر برنامه. گزینه `Require proxy`; اگر unavailable است launch متوقف و Dialog شفاف نشان داده شود (fail closed در سطح launch). این سیاست **تضمین جلوگیری از خروج همه ترافیک پس از اجرا نیست**.
- Health Test در سه سطح: `TCP local port`, `protocol handshake`, `optional actual request through selected route` با نمایش مسیر و IP فقط با اجازه؛ Proxy healthy ≠ همه درخواست‌های IDE تونل شده.
- Adapter-specific: CLI ها ممکن است `HTTP_PROXY / HTTPS_PROXY / ALL_PROXY` یا config رسمی را بپذیرند؛ برای Electron پارامترهای استاندارد و بررسی نسخه. هر Tool نتیجه `verified/unverified/unsupported` جدا دارد.
- تغییر تنظیمات پروکسی برنامه سوم دائمی نباشد مگر روش مستند/قابل بازگردانی؛ هیچ ابزار فریب موقعیت یا نقض Terms نصب نشود.

### ۴.۹ Terminal Setup — صفحه جدید و مهم

هدف: برای CLI Agentهای OpenCode، MiMo Code و Freebuff محیط ترمینال خوانا، مدرن و دارای آیکن ایجاد شود؛ هم با پروفایل PowerShell و هم ترمینال GUI در صورت پشتیبانی.

**ورودی قطعی:** فایل ارسالی `mak-devline.omp.json` متعلق به مالک محصول. باید به `themes/terminal/mak-devline.omp.json` منتقل شود (تغییرات صرفاً اصلاح نحوی/سازگاری با توضیح Diff). تم شامل دو سطر prompt، Segmentهای Python، Git، Path، Status و Execution Time با رنگ‌های نزدیک Catppuccin است. طرح باید **انتخاب‌پذیر و اختیاری** باشد؛ شل کاربر بدون موافقت تغییر نکند.

**فونت:** `JetBrainsMono Nerd Font Mono` (انتخاب پیش‌فرض پیشنهادی برای سلول و Icon)، با مجوز خانواده JetBrains Mono بر مبنای SIL OFL 1.1. نصب از منبع رسمی Nerd Fonts یا فرمان رسمی `oh-my-posh font install JetBrainsMono` پس از تأیید نام/نسخه موجود؛ اگر فرمان نام فونت پشتیبانی‌نشده بود، لینک رسمی را پیشنهاد بده. **Vazirmatn** جداگانه برای تمام فارسی‌های UI و در صورت پشتیبانی برای fallback فارسی ترمینال نصب می‌شود. فونت رسمی، مجوز و نسخه را ثبت کن؛ فایل فونت غیرمجاز به مخزن یا بسته اضافه نکن.

**جریان اصلی ۵ مرحله‌ای**:
1. Detect: Windows Terminal/PowerShell 7 یا Windows PowerShell، `oh-my-posh`, Font نصب‌شده، Profile Path و وجود Theme قبلی.
2. Preview: نمای تم واقعی (یک Preview ثابت در MVP؛ بعداً PTY آزمایشی اختیاری) همراه با تفاوت قبل/بعد. توضیح آیکن Nerd Font.
3. Install: پیشنهاد نصب Oh My Posh از `winget install JanDeDobbeleer.OhMyPosh --source winget` پس از تأیید؛ نصب یا راهنمای فونت از مبدا رسمی.
4. Apply: Backup فایل `$PROFILE` و تنظیمات Terminal؛ اضافه‌کردن یک بلوک idempotent با begin/end marker، سازگار با مسیر مطلق Theme محلی؛ اضافه نکردن خط تکراری؛ تغییر font.face فقط روی پروفایل انتخاب‌شده یا Settings app به انتخاب کاربر.
5. Verify & Restore: گشودن PowerShell آزمایشی یا دستور validation، کنترل نمایش صحیح Glyph و Git/Python، دکمه Undo کامل که فقط تغییرات متعلق به VibeHub را برگرداند و سفارشی‌سازی سایر بخش‌ها را دست نزند.

**خطاهای لازم:** no winget، no admin، execution policy محدود، Oh My Posh قبلاً نصب، conflicting oh-my-posh init، profile read-only، missing glyph، خطای render، Windows Terminal ناموجود، ANSI ناقص، WSL با host font نامناسب. هیچ تغییر خودسرانه Execution Policy به `Unrestricted`.

**محدودیت IDE:** تغییر فایل تنظیمات shell در IDE فقط بر ترمینال‌هایی اثر می‌گذارد که Shell Profile را واقعاً بارگذاری می‌کنند. اگر IDE مستقل از PowerShell است، نتیجه را `May not apply` بزن و راهنمای جدا بده؛ هرگز وعده همه terminalها نده.

### ۴.۱۰ Guides / Learning Center

- کارت‌های آموزشی دو‌زبانه برای هر ۶ ابزار؛ برای هر ابزار حداقل `Introduction`, `Free access`, `Install`, `First project`, `Proxy/access`, `Terminal (if CLI)`, `RTL (if supported)`, `Troubleshooting`, `Model options` با متن متناسب.
- چک‌لیست قابل Tick، تصویر نسخه‌دار/Alt text، FAQ، زمان مطالعه، آخرین بررسی، منبع رسمی، نسخه OS و اپ، برچسب تجربه جامعه.
- تفکیک `Verified documentation`, `User report`, `Unverified`; برای قید «ثبت‌نام در Qoder گاهی با VPN، سپس بی‌نیاز» تنها بعد از تست محدوده شبکه و ملاحظه Terms از عنوان گزارش تجربه استفاده شود.
- محتوای Markdown فقط با Renderer امن/بدون HTML و بدون اجرای فرمان؛ `Copy command` فعال، `Run command` تنها از allowlist native و با تأیید جدا.
- محتوای اصلی نصب آفلاین کار کند؛ remote guide با cache و rollback در خطای schema.

### ۴.۱۱ Offers & News

- Feed ثابت `offers.json` از GitHub Pages؛‌ فقط آفر **دارای منبع قابل‌اعتماد** منتشر شود: `offerId, appId, title.fa/en, summary.fa/en, sourceUrl, publishedAt, verifiedAt, startAt, endAt, eligibility, regionNotes, freeAccessChange, status`.
- دو دسته `Verified offer` و `Reported/Needs verification`؛ فقط اولی اجازه نمایش Native Notification داشته باشد.
- Bell در Topbar، صفحه همه اعلان‌ها با `Active / Upcoming / Expired / Read`, local Seen/Unread و تنظیم Quiet hours.
- اعلان سیستمی `opt-in`; از ارسال چندباره با ID و Version جلوگیری شود؛ آفر منقضی Native Notification ندارد.
- ثبت آفر با PR و تأیید نگهدارنده؛ وابستگی به Backend/Push پولی نداریم. بررسی در زمان بازبودن برنامه یا Tray اختیاری؛ آفر خودکار در پس‌زمینه با کاربر خارج‌شده از برنامه تضمین نیست.

### ۴.۱۲ Models & APIs

- Tabs: `Free providers`, `Local models`, `API connections`; فیلتر `No signup`, `BYOK`, `Local`, `Free quota`, `Compatible with [tool]`.
- هر Provider: URL رسمی، گام دریافت کلید، آیا کارت لازم است، برنامه رایگان، سطح سازگاری، وضعیت کشور، مجوز نرم‌افزار/مدل، زمان آخرین تأیید.
- NVIDIA API: نشان `Free development access (subject to eligibility/limits)`، فهرست مدل از منبع رسمی یا manifest بازبینی‌شده؛ فرم `API Key` محلی، `Test Connection` فقط پس از رضایت و با پیام هشدار احتمال مصرف Quota. در صورت منطقه/حساب غیرمجاز: راهنمای وضعیت، **نه دور زدن ثبت‌نام یا Spoofing**.
- اتصال به OpenCode/MiMo/Qoder/ZCode تنها از مسیر رسمی Config API یا user-guided steps. UI وضعیت `configuration prepared` را با `tested inside agent` قاطی نکند.
- Secret هرگز در Log/Clipboard بلندمدت/Telemetry/Markdown/URL query/Manifest قرار نگیرد؛ پاک‌کردن/تعویض Key ممکن باشد.

### ۴.۱۳ Doctor

- Checks: Node/CDP sidecar status، installed apps/path/version، Node-free packaging، RTL computed style، Debug port conflict، proxy port/protocol، Font/Vazirmatn/Nerd glyph، OhMyPosh، profile safe edits، Catalog validity، Network/update signature.
- گزارش `Pass / Fail / Unknown / Skipped` با علت؛ دو دکمه `Copy sanitized report` و `Repair with consent` در صورت repair رسمی؛ پروژه‌ها/کلیدها/توکن‌ها در گزارش نباشد.

### ۴.۱۴ Settings

- `Appearance`: Language, Mode, Family, Accent, Density, Text size, Motion.
- `Network`: Proxy global, per-app profiles, Require proxy, Test permissions.
- `Terminal`: Font preference, OhMyPosh, Theme, Backup, Restore.
- `Updates`: App updates, Catalog updates, Download policy.
- `Notifications`: In-app/system, frequency, quiet hours, offers categories.
- `Privacy`: Diagnostics opt-in (off by default), wipe local cache, clear credentials.
- `About`: MIT license, source link, contributors, third-party licenses, funding/referral disclosure, `Everything in VibeHub is free & open-source` با توضیح جدا بودن سرویس‌های ثالث.

---
## ۵. قرارداد داده و Adapterها

### ۵.۱ قرارداد پیشنهادی ابزارها (Typescript، برای جهت‌دهی، نه API منجمد)

```ts
type Verification = 'verified' | 'reported' | 'unknown' | 'unsupported';
type Capability = 'install' | 'launch' | 'rtl' | 'proxy' | 'terminal' | 'byok';
type FreeAccess = 'free_forever' | 'free_tier' | 'trial' | 'ad_supported' | 'unknown';

interface AppManifest {
  id: string;
  name: string;
  summary: { fa: string; en: string };
  kind: 'desktop_ide' | 'desktop_agent' | 'cli_agent';
  platforms: ('windows' | 'linux' | 'macos')[];
  websiteUrl: string;
  docsUrl?: string;
  sourceRepoUrl?: string;
  licenseSpdx?: string;
  isOpenSource: boolean | null;
  freeAccess: FreeAccess;
  freeAccessDetails: { fa: string; en: string };
  requiresSignup: boolean | null;
  requiresPaymentCard: boolean | null;
  sourceOfFreeAccess: string;
  lastVerified: string; // UTC ISO 8601
  capabilities: Record<Capability, Verification>;
  eligibility?: {
    countryCode: string;
    result: 'supported' | 'restricted' | 'unknown';
    sourceUrl?: string;
    testedAt?: string;
  }[];
  referral?: { url: string; disclosureFa: string; disclosureEn: string };
}

interface AppAdapter {
  id: string;
  detect(): Promise<{ installed: boolean; version?: string; path?: string }>;
  prerequisites(): Promise<CheckResult[]>;
  installPlan(): Promise<InstallPlan | null>; // immutable, allowlisted native steps
  launch(params: { cwd?: string; rtl: boolean; proxyProfileId?: string }): Promise<LaunchResult>;
  doctor(): Promise<CheckResult[]>;
  uninstallHints(): Promise<string[]>;
}
```

**قواعد:** Manifest اینترنتی **اجازه تعیین Command/Executable/PowerShell برای اجرا ندارد**. روش نصب/اجرا از Adapter مورد اعتماد که همراه نسخه امضاشده برنامه ارائه شده می‌آید. `installPlan` فقط از Registry داخلی/Allowlist ساخته می‌شود؛ URL خارجی، version string یا path از feed قبل از استفاده validate می‌شود.

### ۵.۲ قرارداد Provider

```ts
interface ProviderManifest {
  id: string;
  name: string;
  officialUrl: string;
  modelsDocUrl?: string;
  freeAccess: FreeAccess;
  requiresAccount: boolean | null;
  requiresApiKey: boolean | null;
  usageTermsUrl: string;
  supportedAdapters: Record<string, Verification>;
  eligibilityStatus: 'verified' | 'reported' | 'unknown';
  lastVerified: string;
  notes: { fa: string; en: string };
}
```

Provider TestResult باید **ثابت کند چه چیزی تست شده**: `dnsResolved`, `proxyHandshake`, `httpResponse`, `authValidated`, `modelResponded`, `agentToolUseVerified`. نتیجه یک سطح به معنی سطح بعدی نیست. برای NVIDIA و Providerهای مشابه در صورت مشخص نبودن Endpoint/مجوز هیچ تستی انجام نشود.

### ۵.۳ محتوا و اعتماد

- Schema version برای app/provider/guide/offer; schemaهای پشتیبانی‌نشده رد و Snapshot سالم قبلی حفظ شود.
- ETag، Last-Modified یا update version؛ جلوگیری از Replay Feed قدیمی با checks و تاریخ مورد انتظار، اما بدون ارسال اطلاعات کاربر.
- Render Markdown امن بدون HTML فعال، script، iframe، remote code یا event handlers.
- Content Update باید سازگار با نسخه کلاینت و rollback پذیر باشد.
- همه تغییرات حساس catalog (قانون استفاده، سهمیه رایگان، لینک دانلود، اقلام امنیتی) با Pull Request و Review نگهدارنده وارد شوند.

---

## ۶. راهبرد انتشار و به‌روزرسانی

### ۶.۱ GitHub Release و آپدیت برنامه

- Product identifier جدید: `dev.vibehub.app` یا شناسه نهایی پایدار و یکتا؛ نمایش نام `VibeHub` در Installer، Start Menu، Uninstaller، Window title و Log.
- یک فایل Setup قابل دانلود در صفحه Releases؛ در صورت امکان Portable جداگانه که Updater خودکار آن غیرفعال یا مطابق قابلیت واقعی باشد.
- Tauri 2 Signed Updater: تولید جفت کلید، قرارگیری **Public key** در Client و **Private key** صرفاً در GitHub Secrets، مانع اجرا/نصب بسته بدون امضای معتبر.
- Manifest مسیر ثابت VibeHub (مثلاً GitHub Pages `/updates/stable/latest.json`)، جدا از releases نسخه‌های تاریخی AgentRTL و جدا از content feed؛ `stable` و `beta` جدا (beta opt-in).
- در startup با فاصله زمانی و براساس تنظیمات بررسی کن؛ UI نسخه فعلی، نسخه جدید، Changelog، Size، Platform و دکمه `Update / Later` را نشان دهد؛ نصب خودکار بی‌اجازه ممنوع؛ نمایش پیشرفت و اطلاع از Restart.
- در خطای DNS/Proxy/offline/Checksum/Signature، نسخه قبلی کار کند؛ Update ساختگی/غیرقابل‌بررسی ممنوع.

### ۶.۲ Catalog، Guides و Offers بدون انتشار برنامه

- GitHub Actions روی merge به content، CI راستی‌آزمایی schema، ترجمه، تاریخ، دامنه و لینک‌های Source را اجرا کند، سپس خروجی استاتیک به GitHub Pages بفرستد.
- App fetch از HTTPS و Cache/ETag؛ هر feed مقدار minClientVersion و schemaVersion دارد.
- دکمه `Check for content updates` و `Last synced` مستقل از App Updater.
- Privacy: اگر درخواست HTTP برای content feed ارسال می‌شود، تنها اطلاعات حداقلی HTTP معمول به GitHub می‌رود؛ به کاربر امکان غیرفعال‌سازی و کار با داده Bundled داده شود.

### ۶.۳ فرایند آفرها

- راه عملیاتی اولیه: Maintainer از وب‌سایت رسمی آفر را می‌بیند، رکورد پیشنهاد را با منبع وارد می‌کند، CI تاریخ و ساختار را کنترل می‌کند، Review انسانی و انتشار.
- در نسخه اول از Web Scraper یا Telegram Bot بدون بررسی Terms استفاده نکن. اعلان فوری بدون کارکرد پس‌زمینه تضمین نیست؛ Popup نوتیفیکیشن فقط در اجرای VibeHub یا Tray فعال نمایش داده می‌شود.

---

## ۷. امنیت، حریم خصوصی، مجوزها

1. تمام سورس VibeHub عمومی، Build قابل تکرار تا حد معقول، مجوزها و SBOM مستند؛ اسامی و علائم تجاری سرویس‌های ثالث به معنی تأیید رسمی آن‌ها نیست.
2. نصب فقط با تأیید، مسیر رسمی و اعتبارسنجی ناشر؛ هیچ اجرای دستوری که از JSON remote آمده انجام نشود.
3. مجوزهای Tauri کمینه: File Dialog فقط روی مسیر منتخب، Process launch فقط برای مسیرهای Adapter مورد اعتماد، شبکه فقط برای دامنه‌های لازم.
4. کلید API در Windows Credential Manager یا Keyring سیستم؛ redaction روی logs و crash reports؛ هیچ Usage Telemetry اجباری و هیچ Tracking Referral درون برنامه.
5. پروکسی و CDP: پورت debug فقط localhost، هشدار کنترل کامل پنجره توسط فرآیندهای محلی، avoid exposed remote debugging و محافظت از Port Conflicts؛ پروکسی محلی به‌خودی‌خود محرمانگی کامل را تضمین نمی‌کند.
6. Freebuff طبق Terms استفاده رسمی و انسانی و شروط location؛ هیچ واسطه‌گری یا استفاده غیرمجاز از endpointهای آن نداشته باشیم. خدمات دیگری که Terms محدودکننده دارند نیز ابتدا Eligibility Check شوند.
7. اجرای Agentهای ثالث می‌تواند فایل، Git، Terminal و دستورات را تغییر دهد؛ قبل از اولین استفاده، هشدار محدوده دسترسی + پیشنهاد Git commit/Backup نشان داده شود.
8. فایل Shell Profile و Terminal Settings همیشه قبل از تغییر Backup و بعد از تغییر diff ثبت شود؛ تنها قطعه‌های متعلق به VibeHub را پاک/Undo کن.
9. همه Fontها، آیکن‌ها و Assets باید امکان توزیع مجدد با مجوز قابل قبول داشته باشند؛ Vazirmatn و JetBrainsMono تحت OFL-1.1، Oh My Posh MIT، سایر وابستگی‌ها در Inventory.
10. **هیچ فونت اختصاصی/پولی یا فایل دانلودشده از وب‌سایت مشکوک** به‌عنوان Asset در برنامه/مخزن اضافه نشود.

---

## ۸. برنامه اجرایی Coding Agent — ۱۶ مرحله با Gate واقعی

### مرحله ۰ — Audit و Baseline

**اقدام‌ها:** Clone/inspect repo، شاخه `feat/vibehub-final`، inventory فایل‌ها و وابستگی‌ها، بررسی RTL فعلی در ZCode/Qoder/DeepSeek، CI و Release فعلی، Risk Register، test baseline، ثبت سه مشکل اول. فایل `mak-devline.omp.json` را با تست JSON و بررسی template بپذیر.  
**خروجی:** `docs/migration-audit.md`, test baseline, repository map, migration decisions.  
**Done:** نوع هر مسیر نصب/اجرا روشن و حذف بی‌دلیل کد قبلی ممنوع.

### مرحله ۱ — Rename/Bootstrap

**اقدام‌ها:** Tauri 2، React، Router، Rust commands، AppID/Icons/README، Window management، Local storage migrations، Browser/Webview CSP؛ در Git history تغییری مخرب نده.  
**خروجی:** Dev build، Windows runnable skeleton.  
**Done:** `pnpm dev`, `pnpm build`, `cargo check` یا معادل موفق؛ محصول به‌عنوان VibeHub اجرا شود.

### مرحله ۲ — Design System + Vazirmatn + Theme Engine

**اقدام‌ها:** نصب فونت local assets با مجوز، سراسری کردن Vazirmatn، ۸ Palette، ۵ Accent، System mode، Semantic tokens، Typography components، focus states، Theme Gallery، compact/collapsed sidebar.  
**Done:** نمونه Persian computed CSS با Vazirmatn رندر شود؛ ۸ حالت بر همه صفحات و کامپوننت‌های اصلی آزمون بصری داشته باشند؛ فونت از CDN لود نشود.

### مرحله ۳ — i18n/RTL کامل

**اقدام‌ها:** فارسی/انگلیسی، changing `<html lang dir>`, mirroring Sidebar، isolation کد، دوزبانه بودن منو/خطا/دکمه‌ها و Page placeholders، چک parity automated.  
**Done:** تغییر زبان بدون Reload/Restart؛ string غیرترجمه‌شده صفر در مسیرهای اصلی.

### مرحله ۴ — Catalog & Manifest

**اقدام‌ها:** شش اپ ZCode/Qoder/DeepSeek/OpenCode/MiMo Code/Freebuff؛ چهار Provider NVIDIA/OpenRouter/Ollama/Custom؛ برچسب مستقل OpenSource/Free/Geo/RTL؛ سرچ و فیلتر؛ verified timestamps؛ offline snapshot.  
**Done:** کاربر تفاوت رایگان و متن‌باز را در همه کارت‌ها بفهمد و منبع/تاریخ دیده شود.

### مرحله ۵ — Detection & Guided Install

**اقدام‌ها:** Adapter قرارداد Native، check نصب موجود، official vendor source، `winget`/Verified package یا fallback، Download Progress، Permissions، Conflict OpenCode1/2، نسخه MiMo Code، مسیر رسمی Freebuff Desktop و CLI.  
**Done:** دو یا چند مسیر واقعی Windows End-to-End نصب و شناسایی شوند؛ باقی ابزارها Guided Install صادقانه؛ نصب مجدد بدون علت انجام نشود.

### مرحله ۶ — RTL & Launch Manager

**اقدام‌ها:** استخراج Injectorهای فعلی به package، حذف پیش‌نیاز Node بیرونی با bundling/refactor، مدیریت CDP و Sidecar، Restart/Reinject، App already running، RTL state verification؛ OpenCode/MiMo/Freebuff RTL `Unknown/Unsupported` تا تحقق واقعی.  
**Done:** ۳ ابزار سابق RTL واقعی روی Windows طبق ماتریس قابل بررسی باشند؛ GUI/CLI Launch موفق و failure handling کامل.

### مرحله ۷ — Proxy Manager

**اقدام‌ها:** Direct/System/HTTP/SOCKS، Config global/per-tool، Profiles، live connection test، Require Proxy، launcher flags/env، توضیح محدودیت تمام‌ترافیک، Terms restriction.  
**Done:** HTTP و SOCKS تست شوند؛ سناریوی پروکسی بسته، conflict و fail-closed رفتار درست داشته باشند.

### مرحله ۸ — Terminal Setup Center + Theme ارسالی

**اقدام‌ها:** واردکردن Theme `mak-devline`, اصلاح قالب malformed Git در صورت نیاز با Diff؛ نصب اختیاری Oh My Posh از source رسمی؛ پیشنهاد JetBrainsMono Nerd Font Mono + نصب Vazirmatn سیستم؛ Profile backup، apply idempotent، font setting optional، validate icons/git/path/exec time، restore.  
**Done:** با یک کلیک آگاهانه اعمال شود و به‌طور کامل/بدون آسیب به سایر تنظیمات Undo شود؛ تم روی PowerShell Windows Terminal تست واقعی داشته باشد.

### مرحله ۹ — Guides & Onboarding

**اقدام‌ها:** صفحات راهنما برای شش ابزار؛ راهنمای ثبت‌نام/ایران در حد شواهد؛ تصاویری که نسخه را مشخص کنند؛ Terminal Setup tutorial؛ Setup checklist; four-step onboarding.  
**Done:** هر ابزار دست‌کم راهنمای نصب + سهمیه + اولین استفاده + اشکال‌یابی دوزبانه داشته باشد؛ Snapshot بدون اینترنت نیز کار کند.

### مرحله ۱۰ — Models & Free APIs

**اقدام‌ها:** NVIDIA API Catalog/Developer Program، OpenRouter، Ollama، endpoint سفارشی؛ Provider Cards، Terms/Eligibility، OS Vault، optional live API test with user consent، specific integration walkthroughs for OpenCode/MiMo/Qoder.  
**Done:** تست API با وضعیت‌های واقعی و redacted error؛ هیچ credit هزینه‌دار بی‌اجازه مصرف نشود؛ API free/unfree بدون شاهد نشان داده نشود.

### مرحله ۱۱ — Offers & Notifications

**اقدام‌ها:** فید استاتیک GitHub، Offer schema، verified vs unverified، دسته‌بندی، expiry، In-App Bell، opt-in native notifications، dedup/quiet hours و نمایش منبع؛ نمونه آفرهای Test Fixture جدا از Catalog واقعی.  
**Done:** تغییر آفر بدون Build جدید در کلاینت ثبت شود؛ آفر منقضی اعلان فعال ندهد؛ اعلان جعلی در Release وجود نداشته باشد.

### مرحله ۱۲ — Referral و جریان تجربه شروع

**اقدام‌ها:** لینک ZCode `https://zcode.z.ai/invite/CF3ZEFJR`، اعلام شفاف، account/signup vs installer separation، Skip/Official route، storage minimal و بدون Tracking فردی.  
**Done:** کاربر با/بدون Referral به مقصد رسمی معتبر برسد؛ نصب وابسته به Referral نباشد.

### مرحله ۱۳ — Signed Update & Content Pipeline

**اقدام‌ها:** GitHub Actions build/release، signature/secret، metadata feed stable، content publish/validate، offline fallback، UI update progress، negative tests، release notes bilingual.  
**Done:** آپدیت امضاشده از نسخه قبلی موفق باشد و بسته جعلی/معیوب رد شود؛ اطلاعات جدید Catalog/Offer بدون App binary منتشر شود.

### مرحله ۱۴ — QA، مجوزها، دسترس‌پذیری، پایداری

**اقدام‌ها:** Windows DPI و clean install، E2E کاربر جدید، RTL ریگرشن، HTTP/SOCKS proxy، font glyph، theme screenshot matrix، i18n parity، keyboard accessibility، license inventory/SBOM و عدم telemetry.  
**Done:** ماتریس بند ۹ Pass باشد؛ هر تست خارج از دسترس صریحاً `Unverified` درج شود نه `Passed`.

### مرحله ۱۵ — Release Candidate و اسناد مشارکت

**اقدام‌ها:** Git tag فقط با تأیید مالک، README فارسی/انگلیسی، CONTRIBUTING، build/test instructions، screenshots واقعی، supported versions، CHANGELOG، release artifact signing، contributor template برای Adapter/Guide/Offer.  
**Done:** کاربر Windows x64 به‌صورت رایگان از Release، VibeHub را نصب و راه‌اندازی کند، یک CLI یا IDE را پیدا کند، با یک مسیر پشتیبانی‌شده اجرا کند و بداند چگونه راهنما/آفر اضافه کند.

### گیت‌های بین مراحل

- هر مرحله باید Native/Frontend tests و screenshots واقعی (وقتی ابزار UI در دسترس است) داشته باشد؛ عدم دسترسی Windows VM مجوز ادعای آزمون Windows نیست.
- از تولید Mock API، Dummy Install، Static fake statuses به‌عنوان Feature نهایی جلوگیری شود؛ Mock در Storybook/fixtures مجاز و برچسب‌دار است.
- مراحل ۰ تا ۴ پایه UX است، ۵ تا ۸ عملکرد اصلی، ۹ تا ۱۲ محتوا/آموزش، ۱۳ تا ۱۵ انتشار.
- فاز تکمیلی Linux/macOS با جدول قابلیت/Adapter جداگانه پس از RC Windows شروع شود؛ نباید با ادعای Unsupported OS منتشر شود.

---

## ۹. آزمون پذیرش نهایی — ماتریس الزام‌آور

| ID | سناریو | نتیجه مطلوب |
|---|---|---|
| UI-01 | تغییر فارسی به انگلیسی در Home/Explore/Settings | جهت، Alignment، Sidebar و محتوای منو لحظه‌ای و صحیح تغییر کند |
| UI-02 | بررسی UI فارسی در ۱۰ صفحه | Vazirmatn در متن فارسی همه صفحه‌ها/Toast/Dialog/Guide؛ no CDN |
| UI-03 | چرخش ۴ تم × Light/Dark و System | هشت پالت خوانا، ذخیره تنظیم و واکنش واقعی به OS |
| UI-04 | Accent پنج‌حالت، 125%/150% scale | Contrast، overflow و navigation سالم |
| CAT-01 | فیلتر Open-source only | هیچ ابزار فاقد مجوز متن‌باز تأییدشده داخل نتایج نباشد |
| CAT-02 | فیلتر Free forever، trial، ad-supported | طبقه‌بندی درست و بدون وعده سهمیه دائمی |
| APP-01 | نصب موجود ZCode/Qoder/DeepSeek | Detect و Launch بدون نصب مجدد |
| APP-02 | OpenCode V1/V2 conflict | Conflict روشن و بدون overwrite خودکار |
| APP-03 | MiMo Code و Freebuff CLI | Install رسمی یا fallback guide؛ Launch واقعاً کار کند |
| APP-04 | RTL enabled در IDE سابق | فارسی RTL، code/terminal LTR و self-heal بعد reload |
| APP-05 | RTL unsupported در Freebuff/OpenCode/MiMo | برچسب Unsupported/Unknown و دکمه ادعایی نداشته باشد |
| NET-01 | SOCKS local active/inactive | State دقیق، Test واقعی و `Require Proxy` درست |
| NET-02 | IDE از قبل بدون CDP باز است | اخطار و درخواست Relaunch نه موفقیت صوری |
| NET-03 | Terms محدودکننده Freebuff | اطلاع و عدم اجرای واسط/فرایند خلاف شرایط |
| TERM-01 | oh-my-posh missing، NerdFont missing | flow نصب/guide کار کند، بدون اجبار، نمایش نقص دقیق |
| TERM-02 | Apply theme دوبار | پروفایل Shell فقط یک بلوک مالکیتی داشته باشد |
| TERM-03 | Restore پس از Apply | محتوای قبلی Shell/Terminal دقیق و سالم بازگردد |
| TERM-04 | نمایش icons Python/Git/Path/Status | آیکن‌ها با JetBrainsMono NF رندر شوند؛ PowerShell prompt بدون خطای Template |
| HELP-01 | راهنمای Qoder فارسی/انگلیسی | منبع، تاریخ، بخش دسترسی ایران با وضعیت شواهد روشن |
| HELP-02 | آفلاین و محتوای نسخه قدیمی | Snapshot معتبر بدون crash قابل مشاهده |
| API-01 | NVIDIA API test denied/no quota/region | گزارش واقعی/محترمانه بدون تلاش برای عبور از محدودیت |
| API-02 | API Key در Doctor Logs | Secret redacted، نبود credential در Plaintext |
| OFR-01 | آفر واقعی معتبر منتشر می‌شود | Feed refresh و local notification طبق opt-in |
| OFR-02 | آفر منقضی یا منبع نامعتبر | active notification تولید نشود |
| UPD-01 | GitHub signed update | نسخه سالم نصب و نسخه جعلی رد شود |
| UPD-02 | Offline / GitHub inaccessible | VibeHub و snapshot قابل استفاده باقی بمانند |
| SEC-01 | JSON remote شامل command/HTML خطرناک | اجرای فرمان/HTML ممنوع و schema رد شود |
| SEC-02 | حذف VibeHub | ابزارهای ثالث/فایل‌های کاربر/شل دست‌نخورده؛ تغییر owned قابل Restore |
| OSS-01 | اسکن Licenses/SBOM | تمام اجزای bundled مجاز برای بازتوزیع و مستند باشند |

**معیار حداقلی نسخه پایدار:** هیچ خطای Critical در Installer، Launcher، Updater، Proxy، Restore و امنیت وجود نداشته باشد. نقص سازگاری RTL یا Proxy در یک ابزار ثالث باید به‌جای دروغ، Capability صحیح و راهنمای محدودیت داشته باشد.

---

## ۱۰. گزارش مرحله‌ای اجباری ایجنت

در پایان هر مرحله باید گزارش به این قالب تحویل شود:

1. `Implemented`: فایل‌ها و رفتار واقعی؛ با path و commit محلی در صورت ایجاد.
2. `Validated`: دستورات build/test و خروجی خلاصه؛ تست عملی Platform/Version.
3. `Screenshots`: اسکرین‌شات واقعی مربوط به UI stage (نه نمونه ساختگی).
4. `Known limitations`: موارد Unknown/Unsupported/نیازمند Windows VM.
5. `Security/license changes`: چه Permission/Installer/Font/Dependency اضافه شده.
6. `Next stage`: پیش‌نیازهای گیت بعدی.

**قاعده:** هیچ Push، Merge، Tag، Release، تغییر تنظیمات دائمی سیستم میزبان یا نصب ابزار ناخواسته بدون رضایت صریح مالک مخزن مجاز نیست. برای خروجی Repository فقط تغییرات داخل branch انجام شود؛ artefactهای build باید در مسیر شناخته‌شده قابل بررسی باشند.

---

## ۱۱. منابع مرجع و لینک‌های لازم برای صحت داده‌ها

- AgentRTL: https://github.com/ahmadkhanloo/AgentRTL
- ZCode referral: https://zcode.z.ai/invite/CF3ZEFJR
- OpenCode: https://opencode.ai/ ; V2 docs: https://dev.opencode.ai/v2/docs
- MiMo Code: https://github.com/XiaomiMiMo/MiMo-Code ; Docs: https://mimo.xiaomi.com/mimocode/start
- Freebuff code & licensing: https://github.com/CodebuffAI/freebuff ; Terms: https://freebuff.com/terms-of-service ; Privacy: https://freebuff.com/privacy-policy
- NVIDIA API/NIM: https://build.nvidia.com/ ; FAQ: https://docs.api.nvidia.com/nim/docs/product
- Oh My Posh: https://ohmyposh.dev/docs/installation/windows ; Font: https://ohmyposh.dev/docs/installation/fonts ; Profile config: https://ohmyposh.dev/docs/installation/customize
- Vazirmatn: https://github.com/rastikerdar/vazirmatn (SIL OFL 1.1)
- JetBrains Mono: https://github.com/JetBrains/JetBrainsMono (SIL OFL 1.1)
- JetBrainsMono Nerd Font: https://github.com/ryanoasis/nerd-fonts/tree/master/patched-fonts/JetBrainsMono

**برچسب راستی‌آزمایی:** محتوای رسمی و مستندات با گذر زمان تغییر می‌کنند. قبل از هر Release باید ثبت تاریخ صحت، مجوز/قیمت/مدل و متن شروط هر سرویس دوباره بررسی شود. فرمول `Free = OSS = Iran-accessible` در هیچ قسمت کد/UI فرض نشود.
