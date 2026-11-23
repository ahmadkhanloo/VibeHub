import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeSearch } from '@core';
import { articleBody, useCatalog } from '@/lib/catalog';
import { Input, PageHeader } from '@/components/ui';
import { SearchScope } from './SearchScope';
import { isReference } from '@/features/learning/sections';

type Text = { fa: string; en: string };
type Entry = { group: string; id: string; title: Text; category?: Text; summary?: Text; body?: Text; to: string };
const both = (value: string): Text => ({ fa: value, en: value });
const words = (value: string) => normalizeSearch(value)
  .normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[\u200c\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const flatten = (value?: Text) => value ? words(value.fa + ' ' + value.en) : '';
type Articles = ReturnType<typeof useCatalog>['articles'];
type BodyIndex = { values: Map<string, { text: Text; normalized: string }>; incomplete: boolean };
const bodies = new WeakMap<Articles, Promise<BodyIndex>>();

function loadBodies(articles: Articles) {
  const cached = bodies.get(articles);
  if (cached) return cached;
  const items: { id: string; text: Text; incomplete: boolean }[] = [];
  let next = 0;
  const load = async () => {
    for (let article = articles[next++]; article; article = articles[next++]) {
      const [fa, en] = await Promise.allSettled([articleBody(article, 'fa'), articleBody(article, 'en')]);
      items.push({
        id: article.id,
        text: { fa: fa.status === 'fulfilled' ? fa.value : '', en: en.status === 'fulfilled' ? en.value : '' },
        incomplete: fa.status === 'rejected' || en.status === 'rejected',
      });
    }
  };
  const pending = Promise.all(Array.from({ length: Math.min(6, articles.length) }, load)).then(() => {
    const incomplete = items.some(item => item.incomplete);
    if (incomplete) bodies.delete(articles);
    return { values: new Map(items.map(item => [item.id, { text: item.text, normalized: flatten(item.text) }])), incomplete };
  });
  bodies.set(articles, pending);
  return pending;
}

export function SearchResults({ query, learning = false, onSelect }: { query: string; learning?: boolean; onSelect?: () => void }) {
  const { t, i18n } = useTranslation(['ux', 'nav', 'learning', 'common', 'workshop']);
  const catalog = useCatalog();
  const lang = i18n.language.startsWith('fa') ? 'fa' : 'en';
  const [loaded, setLoaded] = useState<BodyIndex & { articles: Articles }>();
  const needle = words(query);
  const querying = !!needle;
  useEffect(() => {
    if (!querying) return;
    let current = true;
    void loadBodies(catalog.articles).then(index => {
      if (current) setLoaded({ articles: catalog.articles, ...index });
    });
    return () => { current = false; };
  }, [catalog.articles, querying]);
  const indexed = useMemo(() => {
    const entries: Entry[] = [
      ...catalog.articles.map(item => ({
        group: isReference(item) ? 'learning:referenceView' : 'searchLessons',
        id: item.id, title: item.title, summary: item.summary, category: catalog.categories.find(category => category.id === item.category)?.title,
        to: '/learning/' + encodeURIComponent(item.id),
      })),
      ...catalog.news.map(item => ({
        group: 'searchNews', id: item.id, title: item.title, summary: item.summary, body: item.body,
        to: '/learning?view=news&news=' + encodeURIComponent(item.id),
      })),
      ...catalog.offers.map(item => ({
        group: 'searchOffers', id: item.offerId, title: item.title, summary: item.summary,
        to: '/learning?view=news&offer=' + encodeURIComponent(item.offerId),
      })),
    ];
    if (!learning) {
      entries.push(
        ...catalog.apps.map(app => ({ group: 'searchApps', id: app.id, title: both(app.name), summary: app.summary, to: '/app/' + app.id })),
        ...catalog.providers.map(provider => ({ group: 'services', id: provider.id, title: both(provider.name), summary: provider.notes, to: '/connections/api?provider=' + provider.id })),
        ...([
          ['workspace', 'ux:workspace', '/'], ['learning', 'nav:learning', '/learning'],
          ['accounts', 'nav:accounts', '/accounts'], ['proxy', 'nav:proxy', '/connections/proxy'],
          ['models', 'ux:apiNotebook', '/connections/api'], ['terminal', 'nav:terminal', '/terminal'],
          ['settings', 'nav:settings', '/settings'], ['updates', 'ux:updatesTab', '/settings?section=updates'],
          ['support', 'ux:supportTab', '/settings?section=support'], ['workshop', 'workshop:title', '/workshop'],
        ] as const).map(([id, key, to]) => ({
          group: 'searchPages', id, title: { fa: t(key, { lng: 'fa' }), en: t(key, { lng: 'en' }) }, to,
        })),
      );
    }
    return entries.map(entry => ({ ...entry, name: words(entry.id) + ' ' + flatten(entry.title), summaryText: flatten(entry.summary) + ' ' + flatten(entry.category), bodyText: flatten(entry.body) }));
  }, [catalog, learning, t]);
  const articleBodies = loaded?.articles === catalog.articles ? loaded.values : undefined;
  if (!needle) return <p className="text-sm text-muted">{t('searchHint')}</p>;
  const terms = [...new Set(needle.split(/\s+/))];
  const matches = indexed.flatMap(entry => {
    const article = entry.to.startsWith('/learning/') ? articleBodies?.get(entry.id) : undefined;
    const bodyText = article?.normalized ?? entry.bodyText;
    const score = terms.map(term => entry.name.includes(term) ? 10 : entry.summaryText.includes(term) ? 4 : bodyText.includes(term) ? 1 : 0);
    if (score.includes(0)) return [];
    return [{ entry, body: article?.text ?? entry.body, score: score.reduce<number>((a, b) => a + b, 0) + (entry.name.includes(needle) ? 20 : 0) }];
  }).sort((a, b) => b.score - a.score);
  const groups = new Map<string, typeof matches>();
  for (const match of matches) {
    const group = groups.get(match.entry.group) ?? [];
    group.push(match);
    groups.set(match.entry.group, group);
  }
  const waiting = loaded?.articles !== catalog.articles;
  return <div className="vh-search-results">
    {waiting && <p role="status" className="text-sm text-muted">{t('common:loading')}</p>}
    {!waiting && loaded?.incomplete && <p role="status" className="text-sm text-warning">{t('searchBodyUnavailable')}</p>}
    {!waiting && !matches.length && <p role="status">{t('noResults')}</p>}
    {[...groups].map(([group, results]) => <section key={group} aria-label={t(group)}>
      <h3 className="vh-section-title">{t(group)}</h3>
      <ul>{results.map(({ entry, body }) => {
        const matchingLine = body?.[lang].split(/\n+/).find(line => terms.some(term => words(line).includes(term)));
        const excerpt = matchingLine?.trim().replace(/^[#>\s-]+/, '')
          .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').slice(0, 180);
        return <li key={entry.id}><Link className="vh-search-result" to={entry.to} onClick={onSelect}>
          <strong><bdi>{entry.title[lang]}</bdi></strong>
          {entry.category && <small>{entry.category[lang]}</small>}
          {(excerpt || entry.summary?.[lang]) && <span><bdi>{excerpt || entry.summary?.[lang]}</bdi></span>}
        </Link></li>;
      })}</ul>
    </section>)}
  </div>;
}

export function SearchPage() {
  const { t } = useTranslation('ux');
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const scope = params.get('scope') === 'learning' ? 'learning' : 'all';
  return <div className="vh-search-page space-y-4">
    <PageHeader title={t('searchResults')} />
    <div className="vh-search-form max-w-xl">
      <Input
        type="search"
        aria-label={t('searchLabel')}
        placeholder={t('searchLabel')}
        value={query}
        onChange={event => {
          const next = new URLSearchParams(params);
          if (event.target.value) next.set('q', event.target.value);
          else next.delete('q');
          setParams(next, { replace: true });
        }}
      />
      <SearchScope value={scope} onChange={value => {
        const next = new URLSearchParams(params);
        if (value === 'learning') next.set('scope', value);
        else next.delete('scope');
        setParams(next, { replace: true });
      }} />
    </div>
    <SearchResults query={query} learning={scope === 'learning'} />
  </div>;
}
