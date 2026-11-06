# Claude Code CLI

## این ابزار چیست؟
Claude Code در ترمینال روی پروژه کار می‌کند؛ این ورودی، Claude Desktop نیست. می‌توانید با حساب واجد شرایط Claude وارد شوید یا کلید یک API سازگار بدهید. استفاده از مدل دیگر به معنی استفاده از مدل Claude نیست. ابزارها، کیفیت و هزینه به مدل و سرویس مقصد بستگی دارد.

## مسیر آموزش قابلیت‌ها
- [کار عملی روی پروژه](/learning/claude-workflow)
- [برنامه‌ریزی و مجوزها](/learning/claude-permissions)
- [دستورهای پروژه با CLAUDE.md](/learning/claude-memory)
- [ساخت و استفاده از Skills](/learning/claude-skills)
- [اتصال ابزار با MCP](/learning/claude-mcp)
- [واگذاری کار به Subagents](/learning/claude-agents)
- [ادامهٔ گفتگو و مدیریت زمینه](/learning/claude-sessions)
- [ارجاع به کد و بررسی تغییر در VS Code](/learning/claude-vscode)
- [نصب و مدیریت افزونه‌ها](/learning/claude-plugins)

## نصب و اجرای اول
از [راهنمای رسمی نصب](https://code.claude.com/docs/en/setup) نسخهٔ ویندوز را نصب کنید. فرمان رسمی PowerShell:

```powershell
irm https://claude.ai/install.ps1 | iex
```

ترمینال تازه باز کنید و `claude --version` را بزنید. در صورت انتخاب نصب npm، Node سازگار با نسخهٔ جاری لازم است؛ دستور `npm install -g @anthropic-ai/claude-code` هم در راهنمای رسمی آمده است. تازه‌سازی VibeHub، نصب native در `.local/bin` و wrapperهای npm و PATH را بررسی می‌کند. اگر پیدا نشد، «انتخاب فایل اجرایی» را بزنید و `claude.exe` یا `claude.cmd` را انتخاب کنید؛ `Claude.exe` برنامهٔ دسکتاپ جایگزین CLI نیست.

در تب اجرا می‌توانید پوشهٔ پروژه را انتخاب کنید. برای ورود معمول، `claude auth login` را در ترمینال اجرا کنید و مراحل مرورگر را کامل کنید. برای مسیر API زیر، حساب Claude لازم نیست؛ کلید و دسترسی معتبر همان ارائه‌دهنده لازم است.

## اتصال از ایران و پروکسی
ایران در [فهرست دسترسی Claude](https://support.claude.com/en/articles/8461763-where-can-i-access-claude) نیست. پروکسی فقط مسیر شبکه را تغییر می‌دهد و شرایط حساب را عوض نمی‌کند. دسترسی به سرویس API دیگر باید طبق شرایط همان سرویس بررسی شود.

Claude Code پروکسی HTTP/HTTPS را می‌پذیرد و SOCKS را مستقیم پشتیبانی نمی‌کند. در v2rayN یا Clash پورت **HTTP یا Mixed** را پیدا کنید. در VibeHub یک پروفایل HTTP با آن پورت بسازید و برای این ابزار انتخاب کنید. عدد 10808 در مثال فقط پورت آزموده‌شدهٔ این دستگاه است، نه مقدار همگانی:

```powershell
$env:HTTP_PROXY = 'http://127.0.0.1:10808'
$env:HTTPS_PROXY = $env:HTTP_PROXY
$env:NO_PROXY = 'localhost,127.0.0.1,::1'
```

برای ورود با مرورگر، مسیر شبکهٔ مرورگر را هم بررسی کنید. تنظیمات VibeHub هنگام اجرای بعدی به فرایند داده می‌شود؛ ترمینال باز تنظیمات تازه را دریافت نمی‌کند. نتیجهٔ آزمون پروکسی به‌تنهایی موفقیت حساب یا مدل را ثابت نمی‌کند. [منبع تنظیمات شبکه](https://code.claude.com/docs/en/network-config)

## Radeon بدون حساب Claude
Radeon رابط Anthropic Messages دارد. تفاوت نشانی مهم است: برای Claude Code از `https://developer.amd.com.cn/radeon/api` **بدون `/v1`** استفاده کنید؛ SDK خودش `/v1/messages` را اضافه می‌کند. نشانی OpenAI-compatible برای ابزارهای دیگر به `/api/v1` ختم می‌شود. [مستندات Radeon](https://amd-aim.github.io/radeon-cloud-docs/api/messages/)

در همان ترمینالی که CLI را اجرا می‌کنید، تنظیمات زیر را وارد کنید. کلید مخفیانه از خودتان گرفته می‌شود و در این مثال داخل فایل یا تاریخچهٔ فرمان قرار نمی‌گیرد:

```powershell
$secureKey = Read-Host 'Radeon API key' -AsSecureString
$env:ANTHROPIC_API_KEY = ([pscredential]::new('api', $secureKey)).GetNetworkCredential().Password
$secureKey.Dispose()
$env:ANTHROPIC_AUTH_TOKEN = $null
$env:CLAUDE_CODE_OAUTH_TOKEN = $null
$env:ANTHROPIC_BASE_URL = 'https://developer.amd.com.cn/radeon/api'
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = 'DeepSeek-V4.1-Flash'
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = 'DeepSeek-V4.1-Flash'
$env:CLAUDE_CODE_SUBAGENT_MODEL = 'DeepSeek-V4.1-Flash'
$env:MAX_THINKING_TOKENS = '0'
claude --model 'DeepSeek-V4.1-Flash'
```

کلید در محیط همین ترمینال و فرایندهای فرزند آن باقی می‌ماند؛ در پایان ترمینال را ببندید یا `$env:ANTHROPIC_API_KEY = $null` را اجرا کنید. `MAX_THINKING_TOKENS=0` برای جلوگیری از ارسال thinking مبتنی بر بودجه است که Radeon فعلاً رد می‌کند. شناسهٔ مدل را از فهرست روز سرویس بگیرید؛ موجودی مدل‌ها تغییر می‌کند. مصرف Radeon سهمیهٔ روزانه با واحد points دارد؛ تخمین دلار خود Claude Code صورتحساب Radeon نیست.

برای اجرای مستقیم، اتصال را در وایب‌هاب ذخیره و در پنل اجرای Claude انتخاب کنید؛ کلید از خزانهٔ ویندوز فقط به محیط فرایند فرزند داده می‌شود. مثال ورودی مخفی بالا، مسیر جایگزین برای تنظیم دستی CLI است.

## APIهای دیگر
نشانی و کلید درگاه سازگار با Anthropic Messages و شناسهٔ واقعی مدل را از ارائه‌دهنده بگیرید. بعضی سرویس‌ها کلید را در `ANTHROPIC_AUTH_TOKEN` با هدر Bearer می‌خواهند و بعضی در `ANTHROPIC_API_KEY` با هدر x-api-key؛ این دو را بدون نیاز هم‌زمان تنظیم نکنید. یک نشانی صرفاً OpenAI-compatible برای این مسیر کافی نیست. [راهنمای درگاه Claude Code](https://code.claude.com/docs/en/llm-gateway-connect)

[Ollama](https://docs.ollama.com/integrations/claude-code) و [Hugging Face](https://huggingface.co/docs/inference-providers/integrations/claude-code) راهنمای خود را دارند. سازگاری مدل‌های غیرClaude را باید با ارائه‌دهنده و آزمون واقعی سنجید؛ Anthropic پشتیبانی آن‌ها را تضمین نمی‌کند.

## آزمون واقعی و رفع خطا
در ۲۰۲۶/۱۱/۰۴، Claude Code native نسخهٔ **2.1.318** با افزونهٔ **rtl-terminal 1.0.7** و مدل **DeepSeek-V4.1-Flash** در Radeon، پاسخ جریانی فارسی، رفت‌وبرگشت واقعی ابزار Read و ادامهٔ همان گفتگو را پاس کرد. این آزمون فرایند و پروتکل، نمایش تعاملی فارسی را تأیید نمی‌کند. مدل Qwen3.8-Flash-Next با همین نسخه خطای `System message must be at the beginning` داد؛ موفقیت قدیمی نسخهٔ 2.1.63 برای مسیر افزونهٔ فعلی کافی نیست. دستورهای درخواست حذف یا جابه‌جا نشدند.

- خطای 401: کلید، نوع هدر و اعتبار سرویس را بررسی کنید.
- خطای مدل: شناسهٔ واقعی Radeon را بدهید، نه نام مدل Claude.
- خطای thinking: مقدار بودجهٔ thinking را صفر کنید.
- خطای اتصال: پورت HTTP، فعال بودن پروکسی و نسخهٔ runtime را بررسی کنید.
- خطای سهمیه یا 429: میزان مصرف و ظرفیت سرویس مقصد را بررسی کنید.

برای شروع یک پروژهٔ آزمایشی کوچک انتخاب کنید و اجازه‌های ابزارها را خودتان بررسی کنید. RTL اختصاصی برای این CLI تأیید نشده است.

## نوشتار فارسی و راست‌چین Claude
بخش اجرای فعلی، Claude را مستقیم در ترمینال معمولی با افزونهٔ همراه rtl-terminal باز می‌کند؛ بازکردن RtlTerminal یا کپی فرمان لازم نیست. حداقل نسخهٔ Claude برابر ۲٫۱٫۲۹۴ است.

افزونه نمایش پاسخ و پیش‌نمایش متن را تنظیم می‌کند؛ اختیار بازطراحی خود کادر تایپ Claude را ندارد. پیش‌نمایش درست به‌تنهایی پذیرش تایپ فارسی نیست. اتصال حروف، نیم‌فاصله، متن ترکیبی، نشانگر، حذف، ورودی چندخطی، انتخاب، تغییر اندازه و اسکرول باید در پنجرهٔ واقعی بررسی شوند. برای دیدن حالت فعال `/rtl mode` و برای فعال‌کردن چیدمان `/rtl on` را بزنید. حالت‌های `auto`، `claude` و `terminal` برای علت‌یابی مقایسه شوند؛ تغییر حالت لزوماً اتصال حروف را اصلاح نمی‌کند.

دستور `/copy` متن منطقی اصلی پاسخ را کپی می‌کند. انتخاب با ماوس ممکن است ترتیب نمایشی را کپی کند و باید جدا بررسی شود. نشان تأیید RTL داده نشده است. RtlTerminal فقط پس از شکست مستند ترمینال معمولی بررسی می‌شود؛ Quick Input کادر جداگانه‌ای است و پیش‌نویس موجود CLI را اصلاح نمی‌کند.

## اجرای مستقیم با مدل انتخابی در وایب‌هاب

در بخش اجرای Claude، اتصال را از فهرست انتخاب کنید. «مدیریت اتصال‌ها و تست مدل» صفحهٔ ذخیرهٔ نشانی، شناسهٔ مدل و کلید را باز می‌کند؛ کلید در خزانهٔ ویندوز نگهداری می‌شود. روش احراز هویت درگاه را بین x-api-key و Bearer انتخاب کنید. اتصال باید Anthropic Messages را پشتیبانی کند؛ آزمون موفق OpenAI-compatible به‌تنهایی سازگاری با Claude را ثابت نمی‌کند.

«اجرای فارسی» افزونهٔ همراه را فقط برای همان نشست Claude فعال می‌کند؛ نیازی به ترمینال جدا یا کپی فرمان نیست. حداقل نسخهٔ Claude برابر ۲٫۱٫۲۹۴ است. «اجرای معمولی» همان اتصال را بدون این افزونه باز می‌کند. انتخاب اتصال برای اجراهای بعدی و دکمهٔ کارت برنامه حفظ می‌شود. انتخاب «تنظیمات فعلی Claude» تنظیمات موجود خود CLI را به کار می‌گیرد.

اجرای Claude پروفایل PowerShell و تم Oh My Posh را بارگذاری نمی‌کند؛ تم خط فرمان عمومی مستقل باقی می‌ماند. پشتیبانی فارسی آزمایشی است؛ به‌ویژه مکان‌نما، حذف و کپی متن ترکیبی باید روی ترمینال واقعی بررسی شوند.


## اجازهٔ اجرای فرمان

پیش از اجرای ابزارها ممکن است Claude اجازه بخواهد. در نمونهٔ رسمی زیر فرمان npm test نمایش داده شده است؛ گزینهٔ تأیید یک‌باره با اجازهٔ اجرای بعدی تفاوت دارد. برای شناخت حالت‌ها، [درس مجوزها](/learning/claude-permissions) را بخوانید.

![درخواست مجوز npm test در CLI؛ فرمان، گزینه‌های تأیید و لغو را پیش از ادامه بررسی کنید.](../../../apps/desktop/public/tutorials/screenshots/claude-permissions.webp)
