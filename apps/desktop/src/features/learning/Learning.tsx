import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Circle, RefreshCw, Search } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { groupArticles } from '@core';
import type { LearningArticle } from '@core';
import { articleBody } from '@/lib/catalog';
import { Button, EmptyState, ErrorNotice, Input, PageHeader } from '@/components/ui';
import { MarkdownContent } from '@/components/MarkdownContent';
import { NewsAndOffers } from '@/features/offers/Offers';
import { useCatalog } from '@/lib/catalog';
import { useLessonProgress } from '@/lib/progress';
import { useSettings } from '@/app/settings';
import { ipc } from '@/services/ipc';

function reviewedDate(value: string, lang: 'fa' | 'en') {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(+date) ? value : date.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US');
}

// Every catalog app still gets its guide article — readable from the app page's
// guide tab and by direct URL — but the Learning list stays curated: only tools
// people actually work with are surfaced here. claude-code is covered by the
// richer handbook; the rest are niche builds whose guides live on their app page.
const LIST_HIDDEN = new Set(['claude-code', 'freebuff', 'freebuff-desktop', 'mimocode', 'pi']);

export function LearningPage({ embeddedArticleId }: { embeddedArticleId?: string }) {
  const { articleId: routeArticleId } = useParams();
  const articleId = embeddedArticleId ?? routeArticleId;
  const readerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (embeddedArticleId || !articleId) return;
    readerRef.current?.closest('.vh-main')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [articleId, embeddedArticleId]);
  const { t, i18n } = useTranslation(['learning', 'common']);
  const lang = i18n.resolvedLanguage?.startsWith('fa') ? 'fa' : 'en';
  const { articles, categories, apps } = useCatalog();
  const { settings } = useSettings();
  const { done, mark } = useLessonProgress();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const categoryId = params.get('category') ?? 'all';
  // Guides and news share one destination: the second view is the offers/announcement feed.
  const view: 'guides' | 'news' = params.get('view') === 'news' ? 'news' : 'guides';
  const article = articles.find(item => item.id === articleId);
  // Bundled bodies stream on demand (they are not in the entry chunk); remote-feed
  // bodies arrive inline. One load per article + language.
  const [body, setBody] = useState<string | null>(null);
  useEffect(() => {
    if (!article) { setBody(null); return; }
    let live = true;
    setBody(null); setError(null);
    void articleBody(article, lang)
      .then(text => { if (live) setBody(text || null); })
      .catch(cause => { if (live) setError(cause); });
    return () => { live = false; };
    // The article object identity changes on every catalog revision; the id is the stable key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id, lang]);
  const listed = useMemo(() => articles.filter(item => item.category !== 'applications' || !LIST_HIDDEN.has(item.id)), [articles]);
  const groups = useMemo(() => groupArticles(listed, categories, { category: categoryId, query, lang }), [listed, categories, categoryId, query, lang]);
  const count = groups.reduce((total, group) => total + group.items.length, 0);

  const refresh = async () => {
    setRefreshing(true); setError(null); setRefreshed(false);
    try { await ipc.feedSync(settings.feedBaseUrl); setRefreshed(true); }
    catch (cause) { setError(cause); }
    finally { setRefreshing(false); }
  };
  const fromApp = article?.appId ? apps.find(item => item.id === article.appId) : undefined;
  const back = <Link to={article?.appId ? `/app/${article.appId}?tab=guide` : `/learning${categoryId !== 'all' ? `?category=${encodeURIComponent(categoryId)}` : ''}`} className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">{t('back')}</Link>;

  if (article) {
    return <div ref={readerRef} className={embeddedArticleId ? 'space-y-4' : 'mx-auto max-w-4xl space-y-5'}>
      {!embeddedArticleId && back}
      {embeddedArticleId ? <header><h2 className="text-xl font-bold">{article.title[lang]}</h2><p className="text-sm text-muted">{article.summary[lang]}</p></header> : <PageHeader title={article.title[lang]} description={article.summary[lang]} />}
      {fromApp && <p className="text-sm text-muted">{fromApp.name}</p>}
      {error != null && <ErrorNotice error={error} />}
      <article lang={lang === 'fa' ? 'fa-IR' : 'en-US'} dir={lang === 'fa' ? 'rtl' : 'ltr'} className="vh-article-reader rounded-xl border border-border bg-surface p-5 sm:p-7">
        {body ? <MarkdownContent source={body} onError={setError} /> : <p role="status" className="text-sm text-muted">{t('common:loading')}</p>}
        <footer className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted">
          <span>{t('reviewed')}: {reviewedDate(article.checkedAt, lang)}</span>
          <button type="button" className="text-primary hover:underline" onClick={() => void openUrl(article.sourceUrl).catch(setError)}>{t('source')}</button>
          <button type="button" aria-pressed={!!done[article.id]} data-testid="lesson-done-toggle" className="inline-flex items-center gap-1.5 text-primary hover:underline" onClick={() => mark(article.id, !done[article.id])}>
            {done[article.id] ? <CheckCircle2 size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
            {t(done[article.id] ? 'markedDone' : 'markDone')}
          </button>
        </footer>
      </article>
      {!!article.relatedIds?.length && <section className="space-y-2" aria-label={t('related')}>
        <h2 className="font-bold">{t('related')}</h2>
        <div className="flex flex-wrap gap-2">{article.relatedIds.map(id => {
          const related = articles.find(item => item.id === id);
          return related ? <Link key={id} to={`/learning/${id}`} className="vh-learning-filter">{related.title[lang]}</Link> : null;
        })}</div>
      </section>}
    </div>;
  }

  return <div className="vh-learning-home space-y-5">
    <PageHeader title={t('title')} description={t('subtitle')} actions={view === 'guides' ? <><span className="text-xs text-muted" role="status">{t('count', { count })}</span><Button size="sm" variant="ghost" loading={refreshing} disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />{t('refresh')}</Button></> : undefined} />
    <nav className="vh-choice-group" aria-label={t('title')}>
      {(['guides', 'news'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => {
        const next = new URLSearchParams(params);
        if (value === 'news') next.set('view', 'news'); else next.delete('view');
        setParams(next);
      }}>{t(value === 'guides' ? 'guidesView' : 'newsView')}</button>)}
    </nav>
    {view === 'news' ? <NewsAndOffers embedded /> : <>
    {refreshed && <p role="status" className="text-sm text-success">{t('refreshed')}</p>}
    {error != null && <ErrorNotice error={error} onRetry={() => void refresh()} />}
    <div className="vh-learning-controls">
      <label className="vh-learning-search"><span>{t('search')}</span><div><Search size={17} aria-hidden="true" /><Input type="search" dir="auto" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchHint')} /></div></label>
      <label className="vh-learning-level"><span>{t('categories')}</span>
        <select value={categoryId} onChange={event => setParams(event.target.value === 'all' ? {} : { category: event.target.value })}>
          <option value="all">{t('all')}</option>
          {categories.map(item => <option key={item.id} value={item.id}>{item.title[lang]}</option>)}
        </select>
      </label>
    </div>
      {groups.length ? <div className="vh-learning-results">
      {groups.map(group => <section key={group.category.id} className="vh-learning-group" aria-label={group.category.title[lang]}>
        {categoryId === 'all' && <h2>{group.category.title[lang]}</h2>}
        <div>{group.items.map((item: LearningArticle) => <div key={item.id} className="vh-learning-row" data-testid="learning-row" data-article={item.id}>
          <button type="button" className="vh-learning-done" aria-pressed={!!done[item.id]} data-testid="lesson-done-toggle" aria-label={t(done[item.id] ? 'markNotDoneAria' : 'markDoneAria', { title: item.title[lang] })} onClick={() => mark(item.id, !done[item.id])}>
            {done[item.id] ? <CheckCircle2 size={19} aria-hidden="true" /> : <Circle size={19} aria-hidden="true" />}
          </button>
          <Link to={`/learning/${item.id}${categoryId !== 'all' ? `?category=${encodeURIComponent(categoryId)}` : ''}`} className="vh-learning-row-copy">
            <h3>{item.title[lang]}</h3><p>{item.summary[lang]}</p>
          </Link>
          <BookOpen size={17} aria-hidden="true" />
        </div>)}</div>
      </section>)}
    </div> : <EmptyState title={t('empty')} sub={t('emptyHint')} />}
    </>}
  </div>;
}
