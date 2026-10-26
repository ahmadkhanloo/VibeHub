import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { Badge, Card, EmptyState, Input, SectionTitle } from '@/components/ui';
import { apps, guideSections, guideText } from '@/lib/catalog';
import { useSettings } from '@/app/settings';

export function GuidesPage() {
  const { appId } = useParams();
  const { t } = useTranslation(['guides', 'common']);
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const selected = appId ?? apps[0]?.id ?? '';
  const markdown = useMemo(() => guideText(selected, settings.language) ?? guideText(selected, settings.language === 'fa' ? 'en' : 'fa'), [selected, settings.language]);
  const sections = useMemo(() => (markdown ? guideSections(markdown) : []), [markdown]);
  const filteredSections = query
    ? sections.filter((s) => (s.title + s.body).toLowerCase().includes(query.toLowerCase()))
    : sections;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">{t('guides:title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('guides:subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          <SectionTitle>{t('guides:pickApp')}</SectionTitle>
          {apps.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate(`/guides/${a.id}`)}
              className={`flex w-full items-center justify-between rounded-[10px] border px-3 py-2 text-sm transition-colors ${
                a.id === selected ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-surface-alt'
              }`}
            >
              <span>{a.name}</span>
              {a.isOpenSource === true && <Badge tone="success">OSS</Badge>}
            </button>
          ))}
        </div>

        <Card className="min-w-0">
          {markdown ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('guides:searchGuides')} className="max-w-xs" />
                <Badge tone="muted">{t('guides:updatedAt')}: {new Date().toISOString().slice(0, 10)}</Badge>
              </div>
              <div className="space-y-6">
                {filteredSections.map((s) => (
                  <section key={s.title} id={s.title.replace(/\s+/g, '-')}>
                    <h2 className="mb-2 text-base font-semibold">{s.title}</h2>
                    <div className="guide prose-sm max-w-none text-sm leading-7 text-text">
                      <Markdown>{s.body}</Markdown>
                    </div>
                  </section>
                ))}
                {filteredSections.length === 0 && <EmptyState title={t('common:loading')} />}
              </div>
              <p className="mt-6 border-t border-border pt-3 text-[11px] text-muted">{t('guides:runCommandNote')}</p>
            </>
          ) : (
            <EmptyState title={t('common:notFound')} />
          )}
        </Card>
      </div>
    </div>
  );
}
