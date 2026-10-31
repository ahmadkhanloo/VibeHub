import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ErrorNotice, PageHeader } from '@/components/ui';
import { guideText, useCatalog } from '@/lib/catalog';

export function CodeReviewPage() {
  const { i18n } = useTranslation();
  const [error, setError] = useState<unknown>(null);
  useCatalog(); // Subscribe to content feed updates.
  const lang = i18n.resolvedLanguage?.startsWith('fa') ? 'fa' : 'en';
  const title = lang === 'fa' ? 'بازبینی کد با کمک ایجنت' : 'Review code with an agent';
  const github = `https://github.com/ahmadkhanloo/VibeHub/blob/main/docs/tutorials/code-review/${lang}.md`;
  return <div className="mx-auto max-w-3xl space-y-6">
    <Link to="/tools" className="text-sm text-primary hover:underline">{lang === 'fa' ? 'بازگشت به ابزارها' : 'Back to tools'}</Link>
    <PageHeader title={title} />
    {error != null && <ErrorNotice error={error} />}
    <article className="guide break-words rounded-xl border border-border p-5 text-base leading-8" lang={lang} dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <Markdown skipHtml components={{ h1: () => null, a: ({ href, children }) => <button type="button" className="inline text-primary underline underline-offset-4" onClick={() => { if (href && /^https?:\/\//i.test(href)) void openUrl(href).catch(setError); }}>{children}</button> }}>{guideText('code-review', lang) ?? ''}</Markdown>
    </article>
    <button type="button" className="text-sm text-primary underline underline-offset-4" onClick={() => void openUrl(github).catch(setError)}>{lang === 'fa' ? 'متن آموزش در گیت‌هاب' : 'Tutorial on GitHub'} ↗</button>
  </div>;
}
