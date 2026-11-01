import { useTranslation } from 'react-i18next';

const descriptions: Record<string, [string, string]> = {
  qoder: ['پروژه را باز کنید، مدل را انتخاب کنید، سؤال یا تغییر بخواهید و تفاوت فایل‌ها را بررسی کنید.', 'Open a workspace, choose a model, ask or edit, then review the diff.'],
  zcode: ['پروژه و محدودهٔ کار را مشخص کنید، تغییر را انجام دهید و نتیجه را بسنجید.', 'Choose a project and scope, make a change and verify the result.'],
  'deepseek-harness': ['پوشهٔ پروژه، اتصال مدل، درخواست و بررسی نتیجه چهار گام اصلی‌اند.', 'Project folder, model connection, request and validation are the main steps.'],
  opencode: ['از پوشهٔ مخزن وارد ترمینال شوید، ارائه‌دهنده را انتخاب و تغییرها را بررسی کنید.', 'Start in the repository, choose a provider and inspect changes.'],
  mimocode: ['محدودهٔ مخزن و اتصال مدل را مشخص کنید و خروجی محلی را بررسی کنید.', 'Set repository scope and model access, then check the local result.'],
  freebuff: ['پوشه و هدف را مشخص کنید؛ تغییر پیشنهادی و اجرای برنامه را بررسی کنید.', 'Choose a folder and goal; inspect the proposed edit and run checks.'],
  chatgpt: ['پرسش و زمینهٔ مرتبط را بدهید؛ با گفت‌وگو نتیجه را روشن و راستی‌آزمایی کنید.', 'Provide a question and relevant context; refine and verify the result.'],
  antigravity: ['پروژه، برنامهٔ کار، فعالیت ایجنت و خروجی قابل بررسی را دنبال کنید.', 'Follow the workspace, plan, agent activity and verifiable artifacts.'],
  'claude-code': ['ترمینال درخواست را به درگاه و ارائه‌دهنده می‌فرستد؛ مسیر مدل و کار ابزارها را جدا بررسی کنید.', 'Trace the terminal request through the gateway and provider; check tool actions separately.'],
  ui: ['چیدمان، حالت‌های تعامل و دسترس‌پذیری را قبل از تحویل رابط بررسی کنید.', 'Check layout, interaction states and accessibility before delivery.'],
  documents: ['PDF، ورد، اکسل و پاورپوینت را بخوانید؛ ساختار را بررسی، ویرایش و خروجی نهایی را بازبینی کنید.', 'Read PDF, Word, Excel and PowerPoint; inspect, edit, render and verify.'],
  testing: ['خطا را بازتولید کنید، تغییر کوچک بدهید و همان سناریو را دوباره بسنجید.', 'Reproduce the failure, make a small change and check the original scenario.'],
  extensions: ['منبع و سازگاری را بررسی کنید؛ نصب، فعال‌سازی و نتیجهٔ واقعی را بسنجید.', 'Check source and compatibility; install, enable and verify actual behavior.'],
  models: ['میزبان، ارائه‌دهنده، حساب و سهمیه را جدا بررسی کنید.', 'Check host, provider, account and allowance separately.'],
  'code-review': ['تغییر و هدف، آزمون‌ها، بازبینی مستقل و تصمیم نهایی چهار بخش بررسی‌اند.', 'Change and intent, checks, independent review and a final decision form the review.'],
  'long-running': ['کار را به گام کوچک تقسیم کنید؛ بررسی و ثبت پیشرفت، ادامهٔ کار را ممکن می‌کند.', 'Use small steps, verification and progress notes to continue across sessions.'],
  rtl: ['نثر فارسی راست‌چین است؛ کد، مسیر و فرمان را چپ‌به‌راست نگه دارید.', 'Keep Persian prose right-to-left and code, paths and commands left-to-right.'],
};

export function GuideIllustration({ topic, compact = false }: { topic: string; compact?: boolean }) {
  const { i18n } = useTranslation();
  const fa = i18n.resolvedLanguage?.startsWith('fa');
  const key = Object.hasOwn(descriptions, topic) ? topic : 'extensions';
  const description = descriptions[key]![fa ? 0 : 1];
  const caption = description + (fa ? ' تصویر شماتیک است، نه اسکرین‌شات برنامه.' : ' This is a schematic, not an app screenshot.');
  return <figure className={`vh-guide-figure${compact ? ' is-compact' : ''}`}>
    <img src={`${import.meta.env.BASE_URL}tutorials/${key}.svg`} width="960" height="420" alt={description} loading="lazy" decoding="async" />
    {!compact && <figcaption>{caption}</figcaption>}
  </figure>;
}
