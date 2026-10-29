import { Disclosure } from '@/components/Disclosure';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, ClipboardCopy, ExternalLink } from 'lucide-react';
import { Button, ErrorNotice, PageHeader, SectionTitle } from '@/components/ui';
import { openUrl } from '@tauri-apps/plugin-opener';

const SOURCE = 'https://github.com/anthropics/cwc-long-running-agents';

export function LongRunningPage() {
  const { t } = useTranslation(['learning', 'journeyUx', 'common']);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const prompt = t('learning:prompt');

  const copyPrompt = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (e) { setCopied(false); setError(e); }
  };

  return <div className="mx-auto max-w-3xl space-y-6">
    <Link to="/guides" className="text-sm text-primary hover:underline">{t('journeyUx:learning.back')}</Link>
    <PageHeader title={t('journeyUx:learning.title')} actions={<Button variant="ghost" size="sm" onClick={() => void openUrl(SOURCE).catch(setError)}><ExternalLink size={14} aria-hidden="true" />{t('learning:source')}</Button>} />
    {error != null && <ErrorNotice error={error} />}
    <ol className="space-y-3">
      {[1, 2, 3, 4].map(step => <li key={step}><Disclosure title={<h2 className="inline">{step}. {t(`learning:steps.${step}.title`)}</h2>} defaultOpen={step === 1}><p className="text-sm leading-7 text-muted">{t(`learning:steps.${step}.body`)}</p></Disclosure></li>)}
    </ol>
    <Disclosure title={t('journeyUx:learning.sourceContext')}><p className="text-sm leading-7 text-muted">{t('learning:sourceContext')}</p></Disclosure>
    <Disclosure title={t('learning:recommendations.title')}>{[1, 2, 3].map((item) => <p key={item} className="text-sm leading-7 text-muted">{t(`learning:recommendations.items.${item}`)}</p>)}</Disclosure>
    <Disclosure title={t('learning:templateTitle')}>
      <SectionTitle action={<Button size="sm" variant="primary" onClick={() => void copyPrompt()}>{copied ? <Check size={14} aria-hidden="true" /> : <ClipboardCopy size={14} aria-hidden="true" />}{copied ? t('learning:copied') : t('learning:copy')}</Button>}>{t('learning:templateTitle')}</SectionTitle>
      <p role="status" className="sr-only">{copied ? t('learning:copied') : ''}</p>
      <pre className="whitespace-pre-wrap rounded-lg border border-border bg-surface-alt p-4 font-sans text-sm leading-8 text-text">{prompt}</pre>
    </Disclosure>
  </div>;
}
