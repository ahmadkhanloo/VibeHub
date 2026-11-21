# Claude Code: راهنمای کامل کار با CLI

Claude Code یک ابزار خط فرمان است، نه یک اپ با پنجرهٔ جدا: در پوشهٔ پروژه اجرا می‌شوید، با همان زمینهٔ پروژه کار می‌کند و همهٔ امکاناتش با فرمان و فایل تنظیم می‌شود. این صفحه همهٔ بخش‌ها را یکجا دارد؛ هر بخش مستقل است و می‌توانید فقط به همان نیاز بپرید.

## ۱. شروع کار عملی روی پروژه

در پوشهٔ یک پروژهٔ آزمایشی `claude` را اجرا کنید. ابتدا بخواهید ساختار پروژه و فرمان تست را توضیح دهد، بعد یک خطای مشخص را با برنامهٔ اصلاح بگیرید و پس از بررسی اجازهٔ تغییر بدهید:

> خطای ورودی خالی را پیدا کن. ابتدا علت و برنامه را توضیح بده؛ پس از تأیید، اصلاح کن و تست مرتبط را اجرا کن.

![حالت Plan در پایین ترمینالِ نمونهٔ رسمی روشن است؛ برای چرخش حالت‌ها Shift+Tab نمایش داده شده است.](../../../../apps/desktop/public/tutorials/screenshots/claude-plan-mode.webp)


![نمونهٔ رسمیِ بازبینی برنامه پیش از اجرا: فهرست بررسی‌ها بالا و انتخاب تأیید یا درخواست اصلاح پایین قرار دارد.](../../../../apps/desktop/public/tutorials/screenshots/claude-plan-review.webp)

## ۲. مجوزها و حالت Plan

با `/permissions` مجوزها را بررسی کنید و برای شناخت پروژه و طراحی تغییر از حالت Plan استفاده کنید. پیش از تأیید یک فرمان، مسیر و اثر آن را بخوانید؛ مجوز گسترده را جایگزین بررسیِ درخواست نکنید.

> فقط فایل‌های مرتبط را بخوان و برنامهٔ تغییر را پیشنهاد بده. هنوز هیچ فایلی را ویرایش نکن.

![درخواست مجوز اجرای npm test؛ قبل از انتخاب Yes، فرمان و دامنهٔ مجوز را بررسی کنید.](../../../../apps/desktop/public/tutorials/screenshots/claude-permissions.webp)

## ۳. حافظهٔ پروژه: CLAUDE.md

در ریشهٔ پروژه یک CLAUDE.md کوتاه بنویسید: فرمان تست، قواعد ضروری و مسیرهای مهم. `/init` پیش‌نویس می‌سازد اما بازبینی لازم دارد. با `/memory` دستورهای بارگذاری‌شده را ببینید. Auto memory یادداشت‌های خودکار Claude است و با قواعد صریح CLAUDE.md یکسان نیست؛ فرایندهای طولانی را به اسکیل منتقل کنید.

```markdown
# Project instructions
- Run npm test after changing application logic.
- Keep UI strings in the existing translation files.
- Ask before adding a new dependency.
```

![نمونهٔ CLAUDE.md در VS Code: معرفی پروژه، فرمان‌ها و قواعد کدنویسی در یک فایل.](../../../../apps/desktop/public/tutorials/screenshots/claude-project-memory.webp)


![در نمونهٔ رسمی، کاربر از Claude می‌خواهد یک تصمیم پروژه را در CLAUDE.md ثبت کند؛ بعد از ثبت باید خود فایل را بازبینی کنید.](../../../../apps/desktop/public/tutorials/screenshots/claude-save-memory.webp)

## ۴. اسکیل‌ها

یک فایل `.claude/skills/review-checklist/SKILL.md` با frontmatter نام و توضیح بسازید؛ در بدنه، مراحل کار را بنویسید. این اسکیل فقط با فراخوانی صریح شما اجرا می‌شود:

```markdown
---
name: review-checklist
description: Review changes against the requested behavior.
disable-model-invocation: true
---
Read the current diff. Compare it with the requested behavior.
List concrete logic errors with file references.
State which checks ran and which did not. Do not edit files.
```

با `/review-checklist` فراخوانی کنید و گزارش را با هدف بسنجید. اگر پوشهٔ skills بعد از شروع نشست ساخته شده، `/reload-skills` را اجرا کنید. اسکیل روی مدل و ابزارهای میزبان اجرا می‌شود؛ خودش حساب یا مدل رایگان فراهم نمی‌کند.

![فایل SKILL.md اسکیل در ویرایشگر؛ پوشهٔ هر اسکیل و متن مراحل آن جداست.](../../../../apps/desktop/public/tutorials/screenshots/claude-skill-file.webp)


![فهرست نمونهٔ اسکیل‌های در دسترس در Claude Code؛ نام و توضیح اسکیل باید با فایل ساخته‌شده تطبیق داشته باشد.](../../../../apps/desktop/public/tutorials/screenshots/claude-skills-list.webp)

## ۵. اتصال ابزارها با MCP

سرور موردنیاز را از منبع معتبر انتخاب و دستور نصب را با مستندات Claude تطبیق دهید؛ سپس با `/mcp` وضعیت اتصال را ببینید و برای تمرین اول فقط درخواست فقط‌خواندنی بدهید. کلید یا توکن را داخل درخواست ننویسید.

```powershell
claude mcp add --transport http linear-server https://mcp.linear.app/mcp
claude mcp list
```

![افزودن یک سرور HTTP در PowerShell؛ نشانی هر سرویس را از منبع خودش بگیرید.](../../../../apps/desktop/public/tutorials/screenshots/claude-mcp-add.webp)

اتصالِ فعال به معنی مجوز تغییر همهٔ داده‌ها نیست؛ وضعیت `connected` را با `needs authentication` اشتباه نگیرید.


![فهرست /mcp در ویندوز: وضعیت connected با needs authentication متفاوت است؛ سرور نمونه در این تصویر هنوز به ورود نیاز دارد.](../../../../apps/desktop/public/tutorials/screenshots/claude-mcp-status.webp)


![جزئیات سرور نمونه: وضعیت اتصال، تعداد ابزارها و گزینه‌های View tools، Reconnect و Disable را می‌بینید.](../../../../apps/desktop/public/tutorials/screenshots/claude-mcp-detail.webp)

## ۶. واگذاری کار به ساب‌ایجنت

برای بازبینی یک کار محدود، ایجنتی با دسترسی فقط‌خواندنی بسازید. پوشهٔ `.claude/agents/` دامنهٔ پروژه دارد و `~/.claude/agents/` استفادهٔ شخصی در چند پروژه:

```markdown
---
name: code-quality-reviewer
description: Review project code for concrete logic errors without editing files.
tools: Read, Grep, Glob
model: inherit
---
Inspect the requested files. Report concrete logic errors with file references.
Explain the failure scenario and any uncertainty. Do not modify files.
```

پنجرهٔ ساخت تعاملی `/agents` از نسخهٔ ۲٫۱٫۱۹۸ حذف شده و در نسخه‌های جدید فقط راهنمای ساخت فایل می‌دهد. محدودهٔ فایل‌ها یا diff را همراه درخواست بدهید — ایجنتِ فقط‌خواندنی فرمان shell برای گرفتن diff اجرا نمی‌کند. مدل ایجنت هم مصرف دارد و گزارشش به‌تنهایی اثبات درستی تغییر نیست.

![نمونهٔ رسمی CLI: واگذاری به بازبین و خواندن فایل‌ها زیر نام ایجنت.](../../../../apps/desktop/public/tutorials/screenshots/claude-review-agent.webp)

## ۷. ادامهٔ نشست و کنترل زمینه

`claude --continue` آخرین گفتگو را ادامه می‌دهد، `claude --resume` انتخاب‌گر گفتگو را باز می‌کند و داخل نشست هم `/resume` همین کار را می‌کند. با `/context` مصرف زمینه را ببینید و با `/compact` فشرده کنید؛ در درخواست فشرده‌سازی، تصمیم‌ها و موارد ناتمام را مشخص کنید. `/clear` گفتگوی فعال را خالی می‌کند و جایگزین ثبت تصمیم‌های پروژه نیست.


![ورود /compact در CLI؛ این فرمان گفتگو را فشرده می‌کند و با پاک‌کردن گفتگو توسط /clear تفاوت دارد.](../../../../apps/desktop/public/tutorials/screenshots/claude-compact-command.webp)

![خلاصهٔ Compact در Claude Code: هدف، زمینهٔ فنی و ارجاع فایل‌ها برای ادامهٔ کار.](../../../../apps/desktop/public/tutorials/screenshots/claude-compact-summary.webp)

## ۸. کار در VS Code

افزونهٔ رسمی Claude Code برای VS Code رابط گرافیکی همان موتور است: با انتخاب چند خط در فایل باز، فقط همان محدوده را به Claude ارجاع دهید و پیش از پذیرش هر ویرایش، diff را بخوانید — بخش سبز متن اضافه‌شده است.

![ارجاع utils.py و خطوط ۲ تا ۳ در پنل VS Code؛ پاسخ دربارهٔ ورودی خالی است.](../../../../apps/desktop/public/tutorials/screenshots/claude-vscode-context.webp)

![پیشنهاد افزودن docstring در diff سمت چپ و درخواست تأیید ویرایش در پنل راست.](../../../../apps/desktop/public/tutorials/screenshots/claude-vscode-diff.webp)

## ۹. افزونه‌ها

افزونه اسکیل‌ها، ایجنت‌ها، hooks و اتصال‌های MCP را یکجا بسته‌بندی می‌کند؛ برای یک دستور شخصی ساده، اسکیل مستقل کافی است. با `/plugin` فهرست را ببینید، منبع و محتوا را بررسی کنید (مخزن شخص ثالث را رسمی فرض نکنید)، دامنهٔ نصب را انتخاب کنید و پس از نصب فرمان‌ها را با پیشوند نام افزونه اجرا کنید. حذف و غیرفعال‌سازی هم از همان `/plugin` انجام می‌شود.

![تب Discover افزونه‌ها؛ نام مخزن کنار هر افزونه دیده می‌شود.](../../../../apps/desktop/public/tutorials/screenshots/claude-plugin-discover.webp)

## منابع رسمی

- [Claude Code — common-workflows](https://code.claude.com/docs/en/common-workflows) · [permissions](https://code.claude.com/docs/en/permissions) · [memory](https://code.claude.com/docs/en/memory) · [skills](https://code.claude.com/docs/en/skills) · [mcp](https://code.claude.com/docs/en/mcp) · [sub-agents](https://code.claude.com/docs/en/sub-agents) · [vs-code](https://code.claude.com/docs/en/vs-code) · [plugins](https://code.claude.com/docs/en/plugins)
- [Claude Academy — Claude Code 101](https://academy.claude.com/courses/claude-code-101/your-first-prompt) · [Agent Skills](https://academy.claude.com/courses/introduction-to-agent-skills/creating-your-first-skill) · [Subagents](https://academy.claude.com/courses/introduction-to-subagents/creating-a-subagent)
