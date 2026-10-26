import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, ClipboardCopy, ExternalLink } from 'lucide-react';
import { Button, Card, ErrorNotice, PageHeader, SectionTitle } from '@/components/ui';
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
    <PageHeader title={t('journeyUx:learning.title')} description={t('learning:subtitle')} actions={<Button variant="ghost" size="sm" onClick={() => void openUrl(SOURCE).catch(setError)}><ExternalLink size={14} aria-hidden="true" />{t('learning:source')}</Button>} />
    {error != null && <ErrorNotice error={error} />}
    <ol className="space-y-3">
      {[1, 2, 3, 4].map((step) => <li key={step} className="flex items-start gap-4 rounded-xl border border-border bg-surface p-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary text-sm font-bold text-primary" aria-hidden="true">{step}</span>
        <div><h2 className="font-bold">{t(`learning:steps.${step}.title`)}</h2><p className="mt-1 text-sm leading-7 text-muted">{t(`learning:steps.${step}.body`)}</p></div>
      </li>)}
    </ol>
    <Card className="space-y-3"><SectionTitle>{t('journeyUx:learning.sourceContext')}</SectionTitle><p className="text-sm leading-7 text-muted">{t('learning:sourceContext')}</p></Card>
    <Card className="space-y-3"><SectionTitle>{t('learning:recommendations.title')}</SectionTitle>{[1, 2, 3].map((item) => <p key={item} className="text-sm leading-7 text-muted">{t(`learning:recommendations.items.${item}`)}</p>)}</Card>
    <Card className="space-y-4">
      <SectionTitle action={<Button size="sm" variant="primary" onClick={() => void copyPrompt()}>{copied ? <Check size={14} aria-hidden="true" /> : <ClipboardCopy size={14} aria-hidden="true" />}{copied ? t('learning:copied') : t('learning:copy')}</Button>}>{t('learning:templateTitle')}</SectionTitle>
      <p role="status" className="sr-only">{copied ? t('learning:copied') : ''}</p>
      <pre className="whitespace-pre-wrap rounded-lg border border-border bg-surface-alt p-4 font-sans text-sm leading-8 text-text">{prompt}</pre>
    </Card>
  </div>;
}
