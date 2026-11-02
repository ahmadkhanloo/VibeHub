import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, RefreshCw, Search } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { groupArticles } from '@core';
import type { LearningArticle } from '@core';
import { Badge, Button, EmptyState, ErrorNotice, Input, PageHeader } from '@/components/ui';
import { MarkdownContent } from '@/components/MarkdownContent';
import { useCatalog } from '@/lib/catalog';
import { useSettings } from '@/app/settings';
import { ipc } from '@/services/ipc';

function reviewedDate(value: string, lang: 'fa' | 'en') {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(+date) ? value : date.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-US');
}

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
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const categoryId = params.get('category') ?? 'all';
  const article = articles.find(item => item.id === articleId);
  const groups = useMemo(() => groupArticles(articles, categories, { category: categoryId, query, lang }), [articles, categories, categoryId, query, lang]);
  const count = groups.reduce((total, group) => total + group.items.length, 0);

  const refresh = async () => {
    setRefreshing(true); setError(null); setRefreshed(false);
    try { await ipc.feedSync(settings.feedBaseUrl); setRefreshed(true); }
    catch (cause) { setError(cause); }
    finally { setRefreshing(false); }
  };
  const categoryName = (id: string) => categories.find(item => item.id === id)?.title[lang] ?? id;
  const fromApp = article?.appId ? apps.find(item => item.id === article.appId) : undefined;
  const back = <Link to={article?.appId ? `/app/${article.appId}?tab=guide` : `/learning${categoryId !== 'all' ? `?category=${encodeURIComponent(categoryId)}` : ''}`} className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">{t('back')}</Link>;

  if (article) {
    const body = article.body[lang] || article.body[lang === 'fa' ? 'en' : 'fa'];
    return <div ref={readerRef} className={embeddedArticleId ? 'space-y-4' : 'mx-auto max-w-4xl space-y-5'}>
      {!embeddedArticleId && back}
      {embeddedArticleId ? <header><h2 className="text-xl font-bold">{article.title[lang]}</h2><p className="text-sm text-muted">{article.summary[lang]}</p></header> : <PageHeader title={article.title[lang]} description={article.summary[lang]} />}
      {fromApp && <p className="text-sm text-muted">{fromApp.name}</p>}
      {error != null && <ErrorNotice error={error} />}
      <article lang={lang === 'fa' ? 'fa-IR' : 'en-US'} dir={lang === 'fa' ? 'rtl' : 'ltr'} className="vh-article-reader rounded-xl border border-border bg-surface p-5 sm:p-7">
        <MarkdownContent source={body} onError={setError} />
        <footer className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted">
          <span>{t('reviewed')}: {reviewedDate(article.checkedAt, lang)}</span>
          <button type="button" className="text-primary hover:underline" onClick={() => void openUrl(article.sourceUrl).catch(setError)}>{t('source')}</button>
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
    <PageHeader title={t('title')} description={t('subtitle')} actions={<Button size="sm" variant="ghost" loading={refreshing} disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />{t('refresh')}</Button>} />
    {refreshed && <p role="status" className="text-sm text-success">{t('refreshed')}</p>}
    {error != null && <ErrorNotice error={error} onRetry={() => void refresh()} />}
    <div className="vh-learning-controls">
      <label className="vh-learning-search"><span>{t('search')}</span><div><Search size={17} aria-hidden="true" /><Input type="search" dir="auto" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('searchHint')} /></div></label>
      <nav className="vh-learning-categories" aria-label={t('categories')}>
        <button type="button" aria-pressed={categoryId === 'all'} onClick={() => setParams({})}>{t('all')}</button>
        {categories.map(item => <button type="button" key={item.id} aria-pressed={categoryId === item.id} onClick={() => setParams({ category: item.id })}>{item.title[lang]}</button>)}
      </nav>
    </div>
    <p className="text-xs text-muted" role="status">{t('count', { count })}</p>
    {groups.length ? <div className="vh-learning-results">
      {groups.map(group => <section key={group.category.id} className="vh-learning-group" aria-label={group.category.title[lang]}>
        {categoryId === 'all' && <h2>{group.category.title[lang]}</h2>}
        <div>{group.items.map((item: LearningArticle) => <Link key={item.id} to={`/learning/${item.id}${categoryId !== 'all' ? `?category=${encodeURIComponent(categoryId)}` : ''}`} className="vh-learning-row">
          <span><Badge tone="muted">{categoryName(item.category)}</Badge></span>
          <span className="vh-learning-row-copy"><h3>{item.title[lang]}</h3><p>{item.summary[lang]}</p></span>
          <BookOpen size={17} aria-hidden="true" />
        </Link>)}</div>
      </section>)}
    </div> : <EmptyState title={t('empty')} sub={t('emptyHint')} />}
  </div>;
}
