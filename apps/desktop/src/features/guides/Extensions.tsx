import { Disclosure } from '@/components/Disclosure';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Badge, EmptyState, ErrorNotice, Input, PageHeader } from '@/components/ui';
import entries from '../../../../../content/learning/extensions.json';

export function ExtensionsPage() {
  const { t, i18n } = useTranslation('extensions');
  const lang = i18n.language.startsWith('fa') ? 'fa' : 'en';
  const [query, setQuery] = useState(''), [error, setError] = useState<unknown>(null);
  const items = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return entries.filter(item => [item.name, item.kind, item.summary[lang], item.compatibility[lang], item.install[lang]].join(' ').toLocaleLowerCase().includes(needle));
  }, [query, lang]);
  const external = (url: string) => { void openUrl(url).catch(setError); };
  return <div className="space-y-6">
    <Link className="vh-link" to="/guides">{t('title')}</Link>
    <PageHeader title={t('title')} />
    {error != null && <ErrorNotice error={error} />}
    <Disclosure title={t('official')}><p className="text-sm leading-8">{t('terms')}</p>
      <button className="vh-link text-sm" onClick={() => external('https://learn.chatgpt.com/docs/plugins')}>{t('official')}</button>
    </Disclosure>
    <label className="block space-y-2 text-sm"><span>{t('search')}</span><Input type="search" dir="auto" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <div className="space-y-4">{items.map(item => <Disclosure key={item.id} title={<h2 className="inline"><bdi>{item.name}</bdi></h2>}>
      <Badge tone="muted">{t(item.kind)}</Badge>
      <p className="text-sm leading-7">{item.summary[lang]}</p>
      <p className="text-sm leading-7 text-muted"><strong>{t('compatibility')}: </strong>{item.compatibility[lang]}</p>
      <details className="text-sm leading-8"><summary className="cursor-pointer font-bold">{t('open')}</summary>
        <dl className="mt-4 space-y-4">{(['prerequisites', 'install', 'use', 'remove', 'troubleshoot'] as const).map(key => <div key={key}><dt className="font-bold">{t(key)}</dt><dd className="whitespace-pre-wrap break-words">{item[key][lang]}</dd></div>)}</dl>
        {item.kind === 'skill' && <button className="vh-link mt-4" onClick={() => external('https://learn.chatgpt.com/docs/build-skills')}>{t('official')}</button>}
      </details>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted"><button className="vh-link" onClick={() => external(item.source)}>{t('source')}</button><span>{t('checked', { date: item.checked })}</span></div>
    </Disclosure>)}</div>
    {!items.length && <EmptyState title={t('empty')} sub={t('emptyHint')} />}
  </div>;
}
