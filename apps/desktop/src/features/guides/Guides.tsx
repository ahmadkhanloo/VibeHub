import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { BookOpen, ExternalLink } from 'lucide-react';
import { Card, EmptyState, ErrorNotice, Input, PageHeader } from '@/components/ui';
import { useCatalog, guideSections, guideText } from '@/lib/catalog';
import { useSettings } from '@/app/settings';
import { openUrl } from '@tauri-apps/plugin-opener';

export function GuidesPage() {
  const { appId } = useParams();
  const { apps } = useCatalog();
  const { t } = useTranslation(['journeyUx', 'guides', 'common']);
  const { settings } = useSettings();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<unknown>(null);
  const selected = appId ?? apps[0]?.id ?? '';
  const app = apps.find((item) => item.id === selected);
  const preferred = guideText(selected, settings.language);
  const alternateLanguage = settings.language === 'fa' ? 'en' : 'fa';
  const markdown = preferred ?? guideText(selected, alternateLanguage);
  const sections = useMemo(() => markdown ? guideSections(markdown) : [], [markdown]);
  const needle = query.trim().toLocaleLowerCase();
  const filtered = needle ? sections.filter((section) => `${section.title} ${section.body}`.toLocaleLowerCase().includes(needle)) : sections;

  return <div className="space-y-6">
    <PageHeader title={t('guides.title')} description={t('guides.description')} />
    {error != null && <ErrorNotice error={error} />}
    <Link to="/learning" className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-4 text-sm hover:border-primary">
      <BookOpen size={20} aria-hidden="true" className="text-primary" />
      <div><span className="block font-bold">{t('guides.longRunning')}</span><span className="text-muted">{t('guides.longRunningDescription')}</span></div>
    </Link>
    <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label={t('guides:pickApp')} className="space-y-1">
        {apps.map((item) => <Link key={item.id} to={`/guides/${item.id}`} aria-current={item.id === selected ? 'page' : undefined} className={`flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm ${item.id === selected ? 'border-primary bg-primary/5 font-bold text-primary' : 'border-transparent hover:bg-surface-alt'}`}>{item.name}</Link>)}
      </nav>
      <Card className="min-w-0 space-y-6">
        {markdown && app ? <>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div><h2 className="text-xl font-bold">{app.name}</h2><p className="mt-2 text-xs text-muted">{t('guides.unknownRevision')}</p></div>
            <button type="button" className="inline-flex items-center gap-2 text-sm text-primary hover:underline" onClick={() => void openUrl(app.docsUrl ?? app.websiteUrl).catch(setError)}><ExternalLink size={14} aria-hidden="true" />{t('guides:officialSource')}</button>
          </div>
          {!preferred && <p role="status" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">{t('guides.fallback', { language: t(alternateLanguage === 'fa' ? 'common:languagePersian' : 'common:languageEnglish') })}</p>}
          <label className="block space-y-2 text-sm font-medium"><span>{t('guides:searchGuides')}</span><Input type="search" dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('guides.searchPlaceholder')} /></label>
          <div className="space-y-8" lang={(preferred ? settings.language : alternateLanguage) === 'fa' ? 'fa-IR' : 'en-US'} dir={(preferred ? settings.language : alternateLanguage) === 'fa' ? 'rtl' : 'ltr'}>
            {filtered.map((section, index) => <section key={section.title} id={`guide-section-${index}`}>
              <h3 className="mb-3 text-lg font-bold">{section.title}</h3>
              <div className="guide break-words text-base leading-8">
                <Markdown skipHtml components={{ a: ({ href, children }) => <button type="button" className="inline text-primary underline underline-offset-4" onClick={() => { if (href && /^https?:\/\//i.test(href)) void openUrl(href).catch(setError); }}>{children}</button> }}>{section.body}</Markdown>
              </div>
            </section>)}
            {!filtered.length && <EmptyState title={t('guides.noSections')} sub={t('guides.tryAnotherSearch')} />}
          </div>
          <p className="border-t border-border pt-4 text-xs leading-6 text-muted">{t('guides:runCommandNote')}</p>
        </> : <EmptyState title={t('guides.missing')} sub={t('guides.pickAnother')} />}
      </Card>
    </div>
  </div>;
}
