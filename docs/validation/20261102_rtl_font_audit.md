# گزارش بازبینی RTL و فونت فارسی VibeHub

این گزارش شواهد اجرا را برای هر برنامه و سطح نمایش ثبت می‌کند. «قابل‌استفاده» از «آزمون‌شده» جداست؛ نبودن سطح در پنجرهٔ زنده به معنی تأیید آن سطح نیست.

## ماتریس جمع‌بندی برنامه‌ها و سطوح

| برنامه | موجود/قابل‌دسترسی در این دستگاه | component RTL | تأیید واقعی محتوا | پلن بزرگ‌شده/بازگشت و محدودیت اصلی |
|---|---|---|---|---|
| Qoder Desktop | بله، نصب و زنده در دسترس | آمادهٔ RTL؛ مقدار کاتالوگ `verified` | renderer، پیام‌های واقعی فارسی، composer و Vazirmatn وزن ۴۰۰/۷۰۰ بررسی شدند؛ ۱۲۸ بلوک فارسی بدون خطای bidi/font بودند. | سطح جدا یا پلن بزرگ‌شده در وضعیت زنده حاضر نبود؛ reload واقعی برای حفظ کار جاری کاربر انجام نشد. |
| ZCode Desktop | بله، نصب و زنده در دسترس | آمادهٔ RTL؛ مقدار کاتالوگ `verified` | renderer و composer واقعی؛ probeهای محلی فارسی/انگلیسی و هر دو وزن روی renderer تأیید شدند. پاسخ واقعی مدل در آن نشست حاضر نبود. | پلن جدا/تمام‌صفحه و چرخهٔ بازگشت زنده حاضر نبود؛ چرخهٔ fixture جای آزمون محصول را نمی‌گیرد. |
| DeepSeek Harness Desktop | بله، نصب و زنده در دسترس | آمادهٔ RTL؛ مقدار کاتالوگ `verified` | renderer و composer واقعی بررسی شدند؛ آزمون‌های fixture برای محتوا، فونت و scope پاس شدند. | پاسخ/پلن واقعی و پنجرهٔ جدا حاضر نبودند؛ نتیجهٔ محتوای اصلی زنده تأییدنشده است. |
| OpenCode Desktop | بله، نصب و زنده در دسترس | آماده/بسته‌بندی‌شده؛ مقدار کاتالوگ `unknown` | renderer واقعی و injector دیده شدند؛ composer خالی بود. بارگذاری font faceها تأیید شد، اما glyph فارسی زنده برای اندازه‌گیری حاضر نبود. | نشست خالی بود؛ پاسخ، پلن بزرگ‌شده و بازگشت واقعی، کد/diff/ترمینال و glyph فارسی تأییدنشده‌اند. |
| Antigravity Desktop | بله، نصب و renderer زنده؛ چت پشت ورود | component آماده؛ مقدار کاتالوگ `reported` | فقط onboarding پشت ورود مشاهده شد؛ selectors از bundle رسمی به دست آمدند، نه از DOM یک چت زنده. | پلن، composer، reload چت و فونت واقعاً استفاده‌شده تأییدنشده‌اند؛ وارد حساب نشدیم. |
| Codex Desktop (`chatgpt`) | بله، هویت بستهٔ Codex نصب‌شده | unavailable؛ مقدار کاتالوگ `unsupported` چون component renderer قابل‌راه‌اندازی در payload نیست | بررسی ایستای بسته مجاز بود؛ UI زنده در این محیط قابل اتوماسیون نیست و تزریق انجام نشد. | پلن Codex بزرگ‌شده و بازگشت به چت صریحاً تأییدنشده است؛ بدون مسیر CDP اثبات‌شده، قابلیت بسته‌بندی نمی‌شود. ChatGPT عادی نیز بدون RTL می‌ماند. |
| Freebuff Desktop (`freebuff-desktop`) | فقط بسته در پروفایل موقت ممیزی؛ نشست محتوا در دسترس نشد | unavailable؛ مقدار کاتالوگ `unsupported` | بستهٔ رسمی در پروفایل موقت به صفحهٔ خطا رسید و `/api/auth/status` برابر 401 بود؛ چت mount نشد. | پلن، فونت، کد و پنجره‌های محتوا غیرقابل‌آزمون ماندند؛ قابلیت RTL unavailable است. |
| Freebuff CLI (`freebuff`) | خیر، CLI روی دستگاه نصب نبود | آداپتور UI ندارد؛ مقدار کاتالوگ `unknown` | خروجی terminal عمداً تغییر نمی‌کند. | سطح پیام/پلن دسکتاپی ندارد؛ پشتیبانی RTL برای terminal میزبان از این ممیزی نتیجه نمی‌شود. |
| MiMo Code CLI (`mimocode`) | خیر، CLI روی دستگاه نصب نبود | آداپتور UI ندارد؛ مقدار کاتالوگ `unknown` | خروجی terminal دست‌کاری نشد. | UI CLI یا پلن دسکتاپی در این رکورد آزمون نشد. |
| Claude Code CLI (`claude-code`) | بله، نصب؛ نشست اجرا نشد | آداپتور UI ندارد؛ مقدار کاتالوگ `unsupported` | CLI شناسایی شد، اما نشست اجرا نشد. | جهت و فونت terminal میزبان آزمون نشده است؛ خروجی CLI تغییر نمی‌کند. |
| Claude Desktop (`claude-desktop`) | خیر، executable یا renderer پیدا نشد | آداپتور ندارد؛ مقدار کاتالوگ `unsupported` | پیام، پلن، پنجره‌های فرعی و فونت زنده قابل‌آزمون نبودند. | سطوح محتوایی زنده قابل‌آزمون نبودند. |

وضعیت `verified` در کاتالوگ از آزمون واقعی محصول می‌آید؛ آزمون fixture، bundle یا صرفِ وجود فایل آداپتور آن را ایجاد نمی‌کند. جزئیات هر سطح و selector مشاهده‌شده در بخش همان برنامه آمده است. نتیجهٔ آزمون‌های خودکار و هر شکست suite در جمع‌بندی نهایی Task 12 ثبت می‌شود.

## آزمون‌های پذیرش و بستهٔ محلی

| بررسی | نتیجهٔ نهایی |
|---|---|
| Playwright متمرکز RTL (`antigravity`, `rtl-rendering`, `opencode-rtl`, `rtl-capability`) | ۱۰ از ۱۰ پاس؛ متن ترکیبی و تدریجی، regular/bold، idempotence، scope کد/diff/path/terminal/preview، بازوبسته‌شدن محتوای بزرگ‌شده و gate تشخیص Codex بررسی شدند. |
| کل Playwright | `pnpm exec playwright test --reporter=list` — ۱۱۱ از ۱۱۱ پاس در ۹٫۳ دقیقه؛ شامل آزمون دسترس‌پذیری چهار حالت فارسی/انگلیسی و روشن/تیره. |
| آزمون‌های Node | `pnpm test` — ۸۶ از ۸۶ پاس. |
| TypeScript و build رابط | `pnpm check` و `pnpm build` پاس؛ فایل‌های محلی Vazirmatn Regular و Bold در build حاضرند. Vite فقط هشدار اندازهٔ یک chunk بزرگ‌تر از ۵۰۰ kB را داد. |
| محتوا و IPC | `pnpm content:validate` همهٔ ۱۱ app manifest، feedها و راهنماهای دوزبانه را پذیرفت؛ `pnpm release:guard` پوشش IPC را کامل گزارش کرد. |
| آزمون‌های Windows | `tests/native-windows.ps1`: ۵۵ assertion؛ `tests/rtl-setup.ps1`: ۳۱ assertion؛ `tests/rtl-paths.ps1`: مسیر runtime خصوصی و ذخیرهٔ مسیر Unicode پاس شدند. |
| بسته‌بندی محلی | `pnpm --filter @vibehub/desktop tauri build --bundles nsis` موفق؛ installer محلی ۲۷٫۲۲ MiB، SHA-256 برابر `B8D949A75BEA7C310CECE9C4C19102D1DEC308306184CCF8CC126C7E66AE39D9`. اسکریپت NSIS شامل پوشهٔ OpenCode، helper مشترک، CDP guardهای آداپتورها و فونت‌های معمولی/ضخیم است. |

آزمون کامل نخست ۹۷/۱۱۱ پاس داشت و traceها انتظارهای قدیمی در مسیرهای یادگیری/نام‌های رابط و یک باگ واقعی در حفظ feed قدیمی هنگام ذخیرهٔ cache را نشان دادند. انتظارها با routeها، کاتالوگ ۱۰‌کاشی و نام‌های فعلی هماهنگ شدند؛ cache اکنون مقاله‌ها و خبرهای فعلی را هنگام دریافت پاسخ قدیمی حفظ می‌کند. پس از اصلاح، کل suite دوباره اجرا شد و ۱۱۱/۱۱۱ پاس شد. آزمون‌ها رفتار رابط و fixture را می‌سنجند؛ جایگزین تأیید زندهٔ اپ مقصد نیستند.

ساخت تاریخی Inno Setup (`installer.iss`) با آزمون ایستا پوشش دارد، اما `iscc.exe` در محیط موجود نبود و آن installer کامپایل نشد. هیچ installer روی پروفایل واقعی اجرا و هیچ نسخه‌ای منتشر نشد.

## Qoder Desktop

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| پیام‌ها و پاسخ Markdown در renderer اصلی | تأیید زنده | Qoder `0.5.1`، Electron/Chromium `Chrome/150.0.7871.114`؛ مسیر renderer از نوع `qoder-app://renderer/...#/chat/<id>?surface=conversation` است. بلوک‌های واقعی `.markdown-presentation :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,...)` و پیام‌های `[class~="whitespace-pre-wrap"]` مشاهده شدند. |
| ورودی معمول چت | تأیید زنده | `.loop-rich-editor[contenteditable="true"][role="textbox"]`؛ در snapshot نهایی یک نمونه فعال بود. رشتهٔ selector در bundle نصب‌شده نیز وجود دارد. |
| ورودی inline سؤال پیگیری | مشاهده‌شده در وضعیت زندهٔ دیگر | `input[placeholder="Enter another answer"]` هنگام انتظار برای پاسخ نمایش داده شد؛ در snapshot نهایی صفر نمونه داشت. |
| پلن جداگانه/پنجرهٔ جدید/دیالوگ | آزمون‌نشده | در حالت زندهٔ بررسی‌شده سطح جداگانهٔ پلن یا پنجرهٔ جدیدی باز نبود. |
| iframe و Shadow DOM | بررسی زنده | در renderer اصلی صفر iframe و صفر open ShadowRoot دیده شد. |
| کد، مسیر و خروجی ابزار | تا حد مشاهده تأیید | در snapshot نهایی ۷۰ عنصر `code` دیده شد. `pre` در snapshot نهایی صفر بود؛ نمونهٔ کد مصنوعی doctor با `direction:ltr`، `unicode-bidi:isolate` و `ui-monospace` ماند. محافظ‌های `.monaco-editor`، `xterm` و `tree-view` فقط بر اساس کتابخانه‌های حاضر در bundle نگه داشته شدند؛ در همین snapshot mount نبودند. Diff مستقل در این حالت دیده نشد. |

### نتیجهٔ آزمون زنده

- `node apps/Qoder/doctor.mjs --targets`: از ۳ هدف CDP، یک صفحهٔ واقعی قابل‌اتصال بود. صفحهٔ خالیِ بدون URL و worker بدون URL نادیده گرفته شدند؛ اتصال به صفحهٔ خالی در Qoder پاسخ `Page.enable` نمی‌داد.
- `--probe`: selectorهای بالا را در renderer واقعی پیدا کرد؛ یک composer معمول، صفر inline answer در snapshot نهایی، صفر iframe و ShadowRoot.
- `--check`: ۱۲۸ بلوک فارسی واقعی بررسی شد؛ `wrongBidi=0` و `wrongFont=0`. `document.fonts.check` برای وزن‌های ۴۰۰ و ۷۰۰ درست بود؛ آزمون وزن ضخیم `Vazirmatn/700` را محاسبه کرد. `CSS.getPlatformFontsForNode` روی یک node فارسی واقعی، فونت سفارشی `Vazirmatn` با glyphهای رسم‌شده را گزارش کرد. نخستین glyph در آزمون راست‌چین ۰ پیکسل از لبهٔ محتوایی راست فاصله داشت. CSS زنده با خروجی فعلی آداپتور تطبیق داشت و پس از probeهای DOM هم تغییر نکرد.
- محافظ سطح کد، LTR و `isolate` را حفظ کرد؛ قواعد عمومی فونت/جهت به نوارها، منوها و پنل تغییراندازهٔ terminal اعمال نمی‌شوند. selector کلی `[class*="terminal"]` پس از آن‌که به دستگیرهٔ تغییراندازه برخورد کرد حذف شد.
- `--shot`: جفت تصویر تمام viewport در `.qa/before.png` و `.qa/after.png` ساخته و بازبینی شد. این مسیر محلی و نادیده‌گرفته‌شدهٔ Git است؛ تصویر پنجره شامل دادهٔ گفت‌وگوی کاربر است و به مخزن افزوده نشده است.
- `node --test tests/rtl-behavior.test.mjs tests/rtl-style.test.mjs`: ۱۱ آزمون پاس. `pnpm exec playwright test tests/ui/rtl-rendering.spec.ts --reporter=list`: آزمون مشترک helper پاس؛ تغییر CSS با همان observer key، observer قدیمی را قطع کرد و style تازه را در سند و ShadowRoot پس از افزودن محتوا حفظ کرد.

### محدودیت تأیید Qoder

هنگام بازبینی زنده، خود Qoder یک کاربرگ/فرمان طولانی را اجرا می‌کرد. برای حفظ وضعیت کاربر، reload واقعی Qoder انجام نشد؛ پایداری reload در این برنامه همچنان تأییدنشده است. آزمون lifecycle مرورگر، reload واقعی Qoder را جایگزین نمی‌کند.

## ZCode Desktop

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| renderer اصلی و محتوای چت | تأیید زندهٔ تزریق | نسخهٔ نصب‌شده `3.17.1`؛ مسیر رسمی `C:\Users\Mak\AppData\Local\Programs\ZCode\ZCode.exe`. renderer واقعی `file:///.../resources/app.asar/out/renderer/index.html` بود. scope مشاهده‌شده `[data-testid="v4-timeline"]` است؛ در زمان بررسی صفحهٔ خوشامد و composer خالی بود، نه پاسخ واقعی مدل. |
| composer | تأیید زنده | `[data-testid="v4-composer-input"][contenteditable="true"][role="textbox"]` و پاراگراف واقعی داخل آن دیده شد. متن فارسی آزمایشی را هم‌زمان در همان عنصر محاسبه و بلافاصله بازگرداندم: `dir=auto`, `direction=rtl`, `unicode-bidi=plaintext`, فونت محاسبه‌شده `Vazirmatn`. پیامی ارسال نشد. |
| پاسخ فارسی/انگلیسی پویا و ضخامت فونت | تأیید زندهٔ renderer | بلوک‌های موقتی فارسی و انگلیسی را به `v4-timeline` افزودم و پس از observer جهت RTL/LTR را دیدم؛ `document.fonts.check` برای ۴۰۰ و ۷۰۰ درست بود. `CSS.getPlatformFontsForNode` روی glyphهای واقعی probe، فونت سفارشی Vazirmatn را برای متن عادی و `<strong>` گزارش کرد؛ وزن ضخیم محاسبه‌شده ۷۰۰ بود. همهٔ probeها سپس حذف شدند. |
| تیتر، نقل‌قول، جدول، لینک و کد | بازبینی تصویری موقت | در renderer واقعی یک نمونهٔ مات و موقت نشان داده شد: فارسی راست‌چین، انگلیسی چپ‌چین، mixed text و نیم‌فاصله خوانا، تیتر راست‌چین، جدول و لینک سالم، `<pre><code>` چپ‌به‌راست با monospace سیستم و متن ضخیم ۷۰۰ Vazirmatn بود. overlay پس از بازبینی حذف شد و screenshot به مخزن افزوده نشد. |
| iframe / پیش‌نمایش داخلی | بررسی زنده، بدون تزریق | یک target از نوع `iframe` با عنوان `Weekend Banner` و viewport کوچک SVG دیده شد؛ injector فقط targetهای `page` را می‌گیرد، بنابراین frame و استایل پیش‌نمایش دست‌نخورده ماندند. صفحهٔ plan یا web preview متنی در این snapshot دیده نشد. |
| terminal / editor / diff | تأییدنشده در UI زنده | در زمان بررسی terminal، editor و diff mount نبودند. `pre/code` با نمونهٔ موقت LTR و `isolate` ماند؛ هیچ selector حدسی برای terminal/editor به CSS عمومی افزوده نشد. |
| plan، بزرگ‌نمایی و پنجرهٔ محتوای جدا | تأییدنشده | صفحهٔ plan یا حالت بزرگ‌نمایی در این نشست نمایش داده نشد. `window.open('about:blank')` مقدار `false` برگرداند، target صفحهٔ تازه‌ای ظاهر نشد و `Target.createTarget` در CDP این نسخه `Not supported` بود؛ پس ساخت پنجرهٔ جدا در UI و بازگشت از آن قابل‌آزمون نبود. |

### نتیجهٔ آزمون زندهٔ ZCode

- هدف‌های CDP شامل یک `page` renderer، یک `iframe` و چهار worker بودند. فقط صفحهٔ renderer هدف آداپتور است؛ iframe محلی جدا ماند.
- CSS تزریق‌شده ۱۳۷٬۰۴۷ بایت بود و با CSS فعلی آداپتور دقیقاً تطبیق داشت. اجرای دوباره همان source یک observer و یک style با شناسهٔ `zcode-rtl-fix-v2` نگه داشت؛ observer قدیمی heading قطع شده بود.
- پس از reload واقعی renderer، یک style با همان CSS و composer فعال دوباره حاضر بود.
- `node --test tests/zcode-rtl.test.mjs tests/rtl-behavior.test.mjs tests/rtl-style.test.mjs`: هر ۱۳ آزمون پاس. `pnpm exec playwright test tests/ui/rtl-rendering.spec.ts --reporter=list`: آزمون lifecycle و جهت بلوک‌های helper پاس.

### محدودیت تأیید ZCode

ZCode پس از بازبینی با injector RTL باز ماند. تزریق، composer، DOM افزوده‌شده، font platform و reload واقعی renderer آزموده شدند؛ پاسخ واقعی مدل، نمایش plan، تغییر اندازهٔ plan و پنجرهٔ جدا در این نشست قابل‌دسترسی نبودند. نمونهٔ تصویری موقت صرفاً رفتار CSS در renderer واقعی را نشان می‌دهد و جای پاسخ زندهٔ برنامه را نمی‌گیرد.

## DeepSeek Harness Desktop

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| renderer اصلی | بررسی زنده | DeepSeek Harness `0.2.1-rc.5` از نصب ویندوز، با URL واقعی `dsh-app://app/` و Chrome `152.0.7977.130` اجرا شد. مرز injector فقط pageهای همین scheme است؛ هدف زنده یک `page` بود. |
| composer | تأیید زنده | `[data-composer-input="true"][contenteditable="true"][role="textbox"]` در DOM واقعی پیدا شد. با ورود متن آزمایشی فارسی از رابط برنامه، Lexical یک `p[dir="auto"]` ساخت؛ جهت همان بلوک `rtl`، bidi برابر `plaintext`، چیدمان `start` و فونت محاسبه‌شده Vazirmatn بود. `CSS.getPlatformFontsForNode` روی پاراگراف واقعی `Vazirmatn-Regular` سفارشی با ۲۱ glyph گزارش کرد. متن بدون ارسال پاک شد. |
| پیام Markdown، جدول، نقل‌قول، لینک و متن ضخیم | بازبینی renderer با fixture موقت | bundle نصب‌شده کلاس Markdown با پیشوند دقیق `_markdown_` داشت، اما صفحهٔ زنده هیچ پیام یا planای نداشت. یک fixture موقت در renderer واقعی نشان داد بلوک فارسی `rtl` و راست‌چین، انگلیسی `ltr`، جدول مرکزی، نقل‌قول و لینک سالم هستند. Font platform روی متن عادی `Vazirmatn-Regular` سفارشی با ۴۸ glyph و روی `<strong>`، `Vazirmatn-Bold` سفارشی با ۲۲ glyph گزارش کرد. وزن‌های ۴۰۰ و ۷۰۰ هر دو `loaded` بودند. fixture تصویری بازبینی و سپس حذف شد؛ این نتیجه جای پیام واقعی برنامه را نمی‌گیرد. |
| code و diff | probe محدود | `<pre><code>` در fixture به LTR/isolate و Consolas ماند؛ بلوک نشانگر `[data-diff]` نیز LTR/isolate بود. بلوک واقعی diff در صفحه موجود نبود، بنابراین رفتار diff زنده تأییدنشده است. |
| terminal و editor | تأییدنشده | editor یا terminal واقعی mount نبود. probe سادهٔ `[data-terminal]` فقط LTR/isolate را نشان داد و چون terminal واقعی نبود، فونت Segoe UI آن را نمی‌توان شاهد حفظ فونت ترمینال دانست. selector کلی editor/terminal در CSS وجود ندارد. |
| iframe و Shadow DOM | بررسی زنده | صفر iframe و یک open ShadowRoot فقط برای منوی `menubar` دیده شد؛ به ShadowRoot منو CSS تزریق نمی‌شود و متن فارسی هدفی در آن نبود. |
| تزریق و reload | تأیید زنده | اجرای مکرر source یک style با ID `deepseek-harness-rtl-fix-v2` و یک observer نگه داشت. پس از reload واقعی renderer، CSS دقیق آداپتور دوباره با یک style و یک observer فعال بود. |

### نتیجه و محدودیت آزمون DeepSeek Harness

- آزمون روی executable نصب‌شده انجام شد. composer با CUA تایپ شد، تصویر زنده از نظر دیداری بازبینی شد و سپس متن پاک شد؛ هیچ پیام یا promptی ارسال نشد.
- تست‌ها: `node --test tests/deepseek-harness-rtl.test.mjs tests/rtl-behavior.test.mjs tests/rtl-style.test.mjs`؛ هر ۱۳ آزمون پاس شدند. fixture مرورگر reinjection، محتوای پویا، جهت فارسی/انگلیسی، فونت‌های محلی، code guards و نصب پس از reload را پوشش می‌دهد.
- renderer پس از reload به صفحهٔ New Session خالی برگشت؛ پاسخ واقعی، پاسخ تدریجی، جابه‌جایی chat، plan بزرگ‌شده، پنجرهٔ جدا، diff و ترمینال در نشست بررسی‌شده موجود نبودند. این سطح‌ها تأییدنشده باقی می‌مانند.

## OpenCode Desktop

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| renderer اصلی | تزریق زنده تأیید شد | OpenCode `2.2.5` از مسیر رسمی `C:\Users\Mak\AppData\Local\Programs\ai.opencode.desktop\OpenCode.exe` با میانبر RTL اجرا شد. renderer واقعی `oc://renderer/index.html` با `Chrome/152.0.7977.167` بود؛ فقط یک page target دیده شد. |
| composer | selector، scope CSS و بارگذاری font زنده تأیید شد؛ glyph فارسی در UI تأییدنشده | DOM واقعی `[data-component="composer-editor"][role="textbox"][contenteditable="true"]` با `aria-label="Prompt"` و `dir="auto"` بود. style یکتای `vibehub-opencode-rtl-v1` با CSS فعلی تطبیق داشت؛ observer manager یک نمونه بود. computed font برابر Vazirmatn و `unicode-bidi:plaintext` بود؛ چون ورودی خالی ماند، direction محاسبه‌شده LTR بود و فونت واقعی روی glyph فارسی قابل‌اندازه‌گیری نبود. `document.fonts.load` هر دو وزن ۴۰۰ و ۷۰۰ را بارگذاری کرد و سپس `document.fonts.check` برای هر دو true بود. |
| پاسخ دستیار و متن کاربر | selector از باندل نصب‌شده تأیید شد؛ محتوای واقعی حاضر نبود | در `app.asar` نسخهٔ نصب‌شده، `route-emZvCiva.js` ریشهٔ `[data-slot="session-turn-assistant-content"]` و `data-component="markdown"`، و `data-slot="user-message-text" dir="auto"` را می‌سازد؛ `panel-BGi1fjhv.js` user text را زیر `data-component="user-message"` قرار می‌دهد. در نشست زنده هیچ پیام Markdown یا user-message وجود نداشت. |
| TODO/plan و نمایش بزرگ | TODO selector از باندل؛ سطح بزرگ‌شدهٔ واقعی تأییدنشده | bundle شامل `[data-slot="session-todo-text"]` و container `session-todo-list` است. نشست زنده blank بود و هیچ plan یا نمایش بزرگ‌شده‌ای mount نبود؛ پنجرهٔ جدا هم در target inventory ظاهر نشد. آزمون portal در fixture باز/بسته‌شدن و حفظ CSS را می‌سنجد، نه نمایش plan واقعی OpenCode را. |
| کد، diff، فایل و terminal | selectorهای guard از bundle؛ surface واقعی تأییدنشده | باندل `session-turn-diffs`، `[data-component="file"][dir="ltr"]` و `[data-component="terminal"][dir="ltr"]` را می‌سازد؛ همه در صفحهٔ خالی زنده absent بودند. |
| iframe، Shadow DOM و preview | بررسی زنده | صفر iframe و صفر open ShadowRoot در renderer خالی دیده شد. قواعد prose به assistant Markdown و پیام محدودند و `[data-slot="artifact-markdown-content"]` برای preview وب پروژه وارد scope نیست. |
| suite رفتاری | تأیید fixture، جدا از app زنده | `node --test tests/opencode-rtl.test.mjs tests/rtl-style.test.mjs`: ۷ آزمون پاس. `pnpm exec playwright test tests/ui/opencode-rtl.spec.ts tests/ui/rtl-rendering.spec.ts --reporter=list`: ۳ آزمون پاس؛ fixture فارسی/انگلیسی، regular/bold platform font، لینک، table، quote، کد، diff، file path، terminal، selection/copy، محتوای تدریجی، انتقال به portal و reload را بررسی کرد. تصویر fixture: `output/ux-redesign/test-results/opencode-rtl-OpenCode-uses-71c92-terminal-and-preview-styles/opencode-rtl-fixture.png`. |

### محدودیت تأیید OpenCode

- `apps/OpenCode/start.ps1 -Discover` executable همین نصب را یافت؛ `start.ps1` برنامه را با CDP روی ۹۲۳۴ و injector را روی ۹۲۳۵ راه‌اندازی کرد. مالک پورت‌ها و command line پیش از تعویض injector بررسی شد؛ OpenCode باز ماند.
- صفحهٔ زنده New Session خالی بود. CUA screenshot نشان داد پنجرهٔ نصب ZCode در پیش‌زمینه روی رابط OpenCode قرار گرفته است؛ بنابراین تایپ بومی، ارسال یا مشاهدهٔ خروجی واقعی انجام نشد تا نصب دیگر برنامه دست‌نخورده بماند.
- پاسخ تدریجی واقعی، تعویض chat، plan بزرگ‌شده، reload واقعی، کد/diff/terminal واقعی و visual RTL در OpenCode تأییدنشده‌اند. شواهد fixture تنها رفتار آداپتور در DOM نمونه را اثبات می‌کنند.

## Antigravity Desktop

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| صفحهٔ زنده | موجود، اما مسدود پشت ورود | نسخهٔ مستقل ویندوز Antigravity `2.27.0` با Chrome `152.0.7977.130` اجرا شد. تنها page زنده مسیر `https://127.0.0.1:<port>/onboarding?login=true` و صفحهٔ Welcome بود؛ هیچ گفت‌وگو یا سطح متن چت mount نبود. برای ادامه به حساب کاربری وارد نشدم. |
| برنامه‌ریز و متن کاربر | selector تأییدشده از باندل نصب‌شده؛ رفتار زنده تأییدنشده | فایل رسمی `main.js` در bundle شامل `data-testid="planner-response-text"` برای محتوای گام برنامه‌ریز، `data-testid="user-input-step"` برای گام کاربر و بلوک‌های `div.whitespace-pre-wrap` است. این نام‌ها از bundle خود برنامه استخراج شده‌اند؛ DOM واقعی آن‌ها در صفحهٔ ورود حاضر نبود. |
| composer | selector تأییدشده از باندل نصب‌شده؛ رفتار زنده تأییدنشده | bundle ویژگی‌های `data-lexical-editor="true"` و `aria-label="Message input"` را روی ورودی Lexical ایجاد می‌کند. تایپ فارسی، جهت محاسبه‌شده و Vazirmatn در برنامهٔ زنده قابل‌آزمون نبود. |
| کد، diff، editor و terminal | سطح زنده تأییدنشده | bundle شامل `.monaco-editor` و `.xterm` است؛ صفحهٔ ورود هیچ‌یک را mount نکرد. CSS این آداپتور به بلوک‌های متن مشاهده‌شده محدود و descendantهای کد/ترمینال را guard می‌کند؛ رفتار واقعی این سطوح اثبات نشده است. |
| iframe و Shadow DOM | فقط در صفحهٔ ورود بررسی شد | صفحهٔ onboarding سطح چت نداشت؛ وجود iframe یا ShadowRoot در حالت چت و پنجره‌های جدا قابل نتیجه‌گیری نیست. |
| تزریق و بارگذاری مجدد | فقط آزمون خودکار fixture | unitها app-config guard، target filter، نصب idempotent، محتوای پویا و وزن‌های local 400/700 را می‌سنجند. این آزمون‌ها سازگاری renderer واقعی Antigravity را تأیید نمی‌کنند. |

### نتیجه و محدودیت آزمون Antigravity

- آداپتور فقط صفحهٔ محلی HTTPS با مسیر `/` را می‌گیرد و تزریق DOM را تا وقتی `window.__APP_CONFIG__.productName === 'antigravity'` نباشد انجام نمی‌دهد؛ route ورود از این مرز خارج است.
- `node --test tests/antigravity-rtl.test.mjs tests/rtl-behavior.test.mjs tests/rtl-style.test.mjs`: هر ۱۳ آزمون پاس شدند؛ این‌ها آزمون کد آداپتور و fixture هستند، نه آزمون زندهٔ برنامه.
- فونت استفاده‌شده، تایپ composer، پاسخ واقعی، plan بزرگ‌شده و بازگشت از آن، reload صفحهٔ چت، code/diff/terminal واقعی و پنجرهٔ جدا تأییدنشده‌اند؛ صفحهٔ onboarding و شواهد bundle جای آن‌ها را نمی‌گیرند.

## Codex Desktop (شناسهٔ کاتالوگ `chatgpt`)

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| هویت محصول و فایل اجرایی | هویت Codex از بسته تأیید شد | `Get-AppxPackage -Name OpenAI.Codex` گزارش کرد package family برابر `OpenAI.Codex_2p2nqsd0c76g0` و محل نصب `C:\Program Files\WindowsApps\OpenAI.Codex_26.1027.3384.0_x64__2p2nqsd0c76g0` است. ورودی Start Apps همچنان `ChatGPT` نام دارد و به `OpenAI.Codex_...!App` اشاره می‌کند؛ فایل اصلی `app\ChatGPT.exe` امضای معتبر و `ProductName=Codex` دارد. بنابراین نام نمایشی و basename به‌تنهایی معیار نیستند. resolver جدید هم‌زمان نام بسته و مسیر دقیق AppX را می‌سنجد؛ alias به نام `Codex.exe` را renderer تأییدشده تلقی نمی‌کند. |
| ساختار برنامه | بررسی ایستای بسته | `app\resources\app.asar\package.json` محصول را `Codex` و بسته را `openai-codex-electron` معرفی می‌کند. باندل شامل صفحهٔ گفت‌وگوی محلی، renderer محتوای نوبت و اجزای plan/side-panel است؛ رویداد `turn/plan/updated` در مدل محلی به مورد `todo-list` تبدیل می‌شود. این شواهد برای انتخاب selector نهایی سطح plan کافی نیستند. |
| پلن، بزرگ‌نمایی و بازگشت به چت | تأییدنشده؛ selector نهایی عمداً اضافه نشد | رابط زنده باز یا خودکار نشد؛ DOM واقعی plan، پنجره/portal بزرگ‌شده و مسیر بازگشت از آن مشاهده نشد. بنابراین علت ازبین‌رفتن فونت یا جهت پس از جابه‌جایی هنوز به یک node واقعی نسبت داده نشده و CSS حدسی یا آداپتور بی‌مرز ساخته نشده است. این مورد، اولویت پذیرش کاربر، باز است. |
| composer، پاسخ، code/diff، مسیر فایل، terminal، iframe و Shadow DOM | تأییدنشده در renderer زنده | از bundle به‌تنهایی نمی‌توان حضور و مرزهای زندهٔ این سطح‌ها را ثابت کرد. Vazirmatn عادی/ضخیم، انتخاب و کپی، ورودی فارسی، و حفظ ساختار کد در Codex اندازه‌گیری یا بازبینی تصویری نشدند. |
| راه‌اندازی CDP و قابلیت RTL | آداپتور در دسترس اعلام نمی‌شود | فرایند اصلی جاری آرگومان `--remote-debugging-port` نداشت و پورت‌های رزروشدهٔ ۹۲۳۶/۹۲۳۷ گوش نمی‌دادند. Electron به‌طور عمومی switch مذکور را می‌شناسد ([مستند Electron](https://www.electronjs.org/docs/latest/api/command-line-switches))، ولی راه‌اندازی Codex نصب‌شده با آن در این وضعیت اثبات نشد. Chrome برای نسخهٔ ۱۳۶ به بعد، remote debugging روی پروفایل پیش‌فرض Chrome را رد می‌کند مگر مسیر دادهٔ غیراستاندارد باشد ([یادداشت امنیتی Chrome](https://developer.chrome.com/blog/remote-debugging-port?hl=en))؛ اعمال دقیق این محدودیت به بستهٔ Electron خود Codex نیازمند آزمون جداگانه است. آزمون با پروفایل جدا در این نشست انجام نشد چون حساب فعال را حفظ نمی‌کرد و Codex UI نباید خودکارسازی یا restart شود. |
| تشخیص و کنترل | آزمون ویندوزی pass؛ رابط برنامه تأییدنشده | `Resolve-OpenAIProduct` فقط مسیر AppX دقیق و package name را می‌پذیرد. `Get-RtlComponents` برای `chatgpt` وضعیت `available=false` می‌دهد تا مسیر CDP، runtime و فایل‌های adapter اثبات و نصب شوند. فرمان‌های RTL برای `chatgpt` پیش از ایجاد میانبر یا اجرای فرایند fail-closed هستند؛ launch عادی و شناسه‌های عملیات مدیریت حساب Codex حفظ شده‌اند. |
| suite رفتاری | تأیید fixture و Windows host، جدا از renderer | `node --test tests/codex-rtl.test.mjs`: سه آزمون پاس. `pwsh -NoProfile -File tests/codex-discovery.ps1`: fixtureهای `OpenAI.Codex`، `OpenAI.ChatGPT`، مسیر نادرست و alias پاس؛ بستهٔ Codex حاضر نیز resolve شد. `pwsh -NoProfile -File tests/native-windows.ps1`: ۴۳ assertion پاس، شامل رد کردن launch/setup RTL، حفظ status حساب Codex و عدم دست‌کاری پروفایل واقعی. این آزمون‌ها سازگاری DOM یا فونت استفاده‌شدهٔ Codex را تأیید نمی‌کنند. |

### محدودیت Codex Desktop

- شناسهٔ عمومی کاتالوگ `chatgpt` باقی مانده، ولی صرفاً package دقیق `OpenAI.Codex` واجد شرایط آیندهٔ RTL است؛ اپ معمولی ChatGPT و مسیرهای نامطمئن اجازهٔ RTL ندارند. قابلیت کاتالوگ همچنان `unsupported` است چون adapter قابل‌اجرا هنوز وجود ندارد.
- هیچ میانبر RTL نصب نشد، Codex راه‌اندازی/بسته نشد و UI آن تغییر نکرد. live plan/fullscreen، بازگشت به chat، reload، متن فارسی واقعی، فونت ۴۰۰/۷۰۰ و نمایش code/diff/terminal تأییدنشده‌اند.
- Electron switch عمومی، اثبات نمی‌کند که آرگومان از launcher AppX به main process Codex می‌رسد یا همراه پروفایل امن و حساب فعلی قابل‌استفاده است. تا آزمون state-preserving و مشاهدهٔ DOM واقعی، وضعیت Codex RTL باید unavailable بماند.

## Freebuff Desktop (جدا از Freebuff CLI)

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| محصول و بستهٔ رسمی | نسخهٔ ۰٫۰٫۱۹۶ بررسی ایستا شد | [مخزن رسمی](https://github.com/CodebuffAI/freebuff) و [صفحهٔ رسمی Desktop](https://freebuff.com/desktop) Desktop را از CLI جدا می‌کنند. مسیر رسمی دانلود به `Freebuff-0.0.196-win-x64.exe` با اندازهٔ ۲۷۰٬۶۰۸٬۶۰۰ بایت رسید؛ Authenticode برابر `Valid` و امضاکننده `James Grugett` بود؛ SHA-256 برابر `BCAD6F3BDBACB87FB71407B256A310517367DCD34D51337398528645EFC80694` است. |
| معماری پنجره‌ها | بستهٔ واقعی بررسی شد | نصب‌کنندهٔ NSIS به پوشهٔ موقت مشخص‌شده نصب شد. `resources/app.asar/package.json` محصول `@codebuff/freebuff-desktop` نسخهٔ `0.0.196` و main برابر `electron/main.cjs` را نشان می‌دهد. main window و پنجره‌های thread با `BrowserWindow` ساخته می‌شوند؛ پنجرهٔ hosted workspace نشست و preload جدا دارد؛ preview از `<webview>` بدون preload و محدود به سرورهای loopback استفاده می‌کند. سند اصلی از orchestrator محلی Bun بارگذاری می‌شود. این یافته‌ها static package inspection هستند، نه مشاهدهٔ گفت‌وگوی احراز‌شده. |
| پروفایل بررسی | جدا از پروفایل واقعی | آرگومان `--user-data-dir`، `APPDATA`، `LOCALAPPDATA`، `USERPROFILE` و `FREEBUFF_DESKTOP_STATE_PATH` همگی زیر پوشهٔ موقت ممیزی قرار گرفتند؛ هیچ حسابی وارد نشد. |
| renderer زنده | فقط پوستهٔ بدون نشست قابل مشاهده بود | loopback renderer با عنوان `Freebuff Desktop` باز شد. صفحهٔ واقعی برنامه متن `Couldn’t open Freebuff` و دکمه‌های `Try again` و `Sign out` را نمایش داد؛ `/api/auth/status` پاسخ `401` داد و favicon پاسخ `404`. screenshot از همین صفحه گرفته و بازبینی شد. هیچ پیام، plan، composer یا صفحهٔ احراز‌شده‌ای mount نشد. |
| پلن عادی/تمام‌صفحه، بازگشت، composer و پنجرهٔ thread | تأییدنشده | این سطوح پشت حالت بدون نشست در دسترس نبودند؛ نه selector حدس زده شد و نه برای ادامه وارد حساب شدیم. |
| webview / iframe / Shadow DOM | فقط مرزهای ایستا معلوم است | bundle وجود preview `<webview>` را نشان می‌دهد؛ renderer احراز‌شده‌ای برای شمردن frameها یا ShadowRootهای محتوا در دسترس نبود. نبودشان نتیجه‌گیری نشده است. |
| code، diff، مسیر فایل، ترمینال و فونت واقعی | تأییدنشده | صفحهٔ بدون نشست این سطوح را نداشت؛ Vazirmatn 400/700، انتخاب/کپی، تایپ فارسی یا حفظ کد بررسی نشد. هیچ CSS یا فونتی تزریق نشد. |
| آداپتور و قابلیت کاتالوگ | عمداً unavailable | شناسهٔ جداگانهٔ `freebuff-desktop` و manifest آن موجود است، اما `capabilities.rtl=unsupported` می‌ماند تا renderer احراز‌شده و مرز محتوا واقعاً بررسی شود. `freebuff` همچنان CLI است. |
| آزمون | بسته و صفحهٔ اولیه تأیید؛ سطح محتوای اصلی تأییدنشده | installer با امضای معتبر استخراج شد، package metadata و معماری windowها بررسی شدند، loopback صفحهٔ واقعی را تحویل داد و پاسخ 401 ثبت شد. Playwright صفحه را snapshot و screenshot کرد. ابزار Windows screenshot به‌علت `no screenshot targets found for process:...` شکست خورد؛ بازیابی window آن را minimized گزارش کرد. مرورگر loopback همان صفحهٔ برنامه را برای بررسی اولیه نشان داد، اما آزمون UI داخلی Electron، حساب‌دار یا RTL محسوب نمی‌شود. |

### محدودیت Freebuff Desktop

- امکان آزمون زندهٔ صفحهٔ پیام و plan فراهم نشد؛ برنامه در پروفایل موقت به صفحهٔ «Couldn’t open Freebuff» رسید و وضعیت `/api/auth/status` برابر 401 بود. ورود به حساب انجام نشد.
- جهت متن فارسی/انگلیسی، Vazirmatn، plan بزرگ‌شده، بازگشت به chat، reload احراز‌شده، code/diff/path/terminal و رفتار copy/type تأییدنشده‌اند.
- تا مشاهدهٔ renderer دارای محتوا، RTL باید unavailable بماند. بررسی installer، DOM صفحهٔ خطا و آزمون fixture سازگاری چت واقعی را اثبات نمی‌کند.

## Freebuff CLI

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| محصول و اجرا | CLI جدا از Desktop؛ روی دستگاه نصب نیست | [صفحهٔ رسمی CLI](https://freebuff.com/cli) نصب `npm install -g freebuff` و اجرای terminal را مستند می‌کند؛ [مخزن رسمی](https://github.com/CodebuffAI/freebuff) نیز Desktop و CLI را محصولات جدا می‌داند. `Get-Command freebuff` روی این دستگاه command قابل‌استفاده‌ای پیدا نکرد. |
| RTL، فونت و پنجره‌های محتوا | این محدوده UI ندارد | ترمینال ساختاری متنی دارد؛ terminal جدید یا بازنویسی خروجی CLI در این کار اضافه نشد. وضعیت Vazirmatn/RTL برای UI مستقل از CLI از این بررسی نتیجه نمی‌شود. |
| آزمون | منبع رسمی بررسی شد؛ CLI زنده اجرا نشد | نصب/اجرای CLI روی دستگاه انجام نشد. manifest و راهنمای CLI آن را از `freebuff-desktop` جدا نگه می‌دارند. |

## MiMo Code CLI (`mimocode`)

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| محصول و اجرا | CLI در این دستگاه نصب نیست | [راهنمای رسمی MiMo Code برای npm](https://github.com/XiaomiMiMo/MiMo-Code/blob/main/README_npm.md) محصول را terminal-native CLI معرفی می‌کند. `Get-Command mimo` command نصب‌شده‌ای برنگرداند. |
| RTL، فونت و renderer | سطح UI وب/دسکتاپ در این رکورد وجود ندارد | خروجی ترمینال دست‌کاری نمی‌شود و ترمینال تازه‌ای برای آن ساخته نشد. مخزن upstream به MiMo Desktop هم اشاره می‌کند، اما این ردیف کاتالوگ `mimocode` CLI را پوشش می‌دهد و برای آن adapter دسکتاپ جدا اضافه نشده است. |
| آزمون | منبع رسمی بررسی شد؛ CLI زنده اجرا نشد | اجرای تعاملی یا بررسی خروجی ترمینال انجام نشد؛ از آن نمی‌توان پشتیبانی فارسی UI را نتیجه گرفت. |

## Claude Code CLI (`claude-code`)

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| محصول و اجرا | CLI محلی شناسایی شد | [راهنمای رسمی شروع Claude Code](https://code.claude.com/docs/en/getting-started) مسیر terminal را مستند می‌کند. روی دستگاه shim `claude.cmd` و بستهٔ npm نسخهٔ `2.1.273` وجود دارد؛ نسخه از metadata بسته خوانده شد، نه اجرای help یا شروع نشست. |
| RTL و فونت | خارج از rendererهای برنامه‌های کاتالوگ | این CLI نشست تعاملی terminal دارد. VibeHub خروجی CLI را تبدیل نمی‌کند، فونت یا terminal تازه‌ای نمی‌سازد؛ جهت و فونت ترمینال میزبان از این ممیزی اثبات نشد. |
| آزمون | نصب محلی شناسایی شد؛ نشست زنده باز نشد | برای جلوگیری از تغییر وضعیت حساب، اجرای CLI/ورود انجام نشد. منبع رسمی و metadata محلی سطح محصول را مشخص می‌کنند، نه فارسی‌نمایی در هر terminal. |

## Claude Desktop (`claude-desktop`)

| سطح | وضعیت | مشاهده و شواهد |
|---|---|---|
| محصول و نصب محلی | renderer نصب‌شده پیدا نشد | [راهنمای رسمی Claude Desktop](https://code.claude.com/docs/en/desktop) رابط برنامه و Code tab را توصیف می‌کند. در این دستگاه executable مسیرهای متعارف و بستهٔ AppX/Desktop نصب‌شده پیدا نشد؛ سطح پیام زنده‌ای برای مشاهده نبود. |
| پیام، ورودی، code، diff و پنجره‌های فرعی | تأییدنشده | DOM، iframe، Shadow DOM، plan، پنجرهٔ بزرگ‌شده یا فونت مورد استفاده مشاهده نشد. selector یا CSS برای برنامه‌ای که renderer آن در دسترس نیست ساخته نشد. |
| آداپتور و آزمون | unavailable | ورودی محتوایی و راهنمای کاتالوگ وضعیت نبودِ آزمون زنده را حفظ می‌کنند. آزمون فایل manifest، به‌تنهایی اثبات سازگاری برنامه نیست. |
