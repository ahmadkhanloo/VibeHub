import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, Circle, RefreshCw } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { groupArticles } from '@core';
import type { LearningArticle } from '@core';
import { articleBody } from '@/lib/catalog';
import { curriculum, curriculumLevels } from '@/lib/learning-curriculum';
import { Button, EmptyState, ErrorNotice, PageHeader } from '@/components/ui';
import { MarkdownContent } from '@/components/MarkdownContent';
import { NewsAndOffers } from '@/features/offers/Offers';
import { useCatalog } from '@/lib/catalog';
import { useLessonProgress } from '@/lib/progress';
import { useSettings } from '@/app/settings';
import { ipc } from '@/services/ipc';
import { articleLink, isReference, isReferenceCategory, learningView } from './sections';

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
  const { done, mark } = useLessonProgress();
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const categoryId = params.get('category') ?? 'all';
  const article = articles.find(item => item.id === articleId);
  const view = learningView(params, article);
  const referenceArticle = !!article && isReference(article);
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
  const listed = useMemo(() => articles.filter(item => isReference(item) === (view === 'reference') &&
    !(view === 'reference' && item.id === 'skill-creator')), [articles, view]);
  const groups = useMemo(() => groupArticles(listed, categories, { category: categoryId, query: '', lang }), [listed, categories, categoryId, lang]);
  const levels = curriculumLevels.map(level => ({
    ...level, items: level.lessons.flatMap(id => articles.find(item => item.id === id) ?? []),
  }));
  const path = levels.flatMap(level => level.items);
  const step = path.findIndex(item => item.id === articleId);
  const formatNumber = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US');
  const showPath = view === 'guides' && categoryId === 'all';
  const shelves = showPath ? groups.map(group => ({
    ...group, items: group.items.filter(item => !curriculum.includes(item.id)),
  })).filter(group => group.items.length) : groups;

  const refresh = async () => {
    setRefreshing(true); setError(null); setRefreshed(false);
    try { await ipc.feedSync(settings.feedBaseUrl); setRefreshed(true); }
    catch (cause) { setError(cause); }
    finally { setRefreshing(false); }
  };
  const fromApp = article?.appId ? apps.find(item => item.id === article.appId) : undefined;
  const categoryLink = (category: string) => {
    const query = new URLSearchParams();
    if (view === 'reference' || (category !== 'all' && isReferenceCategory(category))) query.set('view', view);
    if (category !== 'all') query.set('category', category);
    return query;
  };
  const back = <Link to={categoryId === 'all' && !referenceArticle ? '/learning' : `/learning?${categoryLink(categoryId)}`} className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">{t(referenceArticle ? 'backReference' : 'back')}</Link>;

  if (article) {
    return <div ref={readerRef} className={embeddedArticleId ? 'space-y-4' : 'mx-auto max-w-4xl space-y-5'}>
      {!embeddedArticleId && back}
      {!embeddedArticleId && step >= 0 && <p className="text-sm text-muted">{t('stepPosition', {
        step: formatNumber.format(step + 1), total: formatNumber.format(path.length),
      })}</p>}
      {embeddedArticleId ? <header><h2 className="text-xl font-bold">{article.title[lang]}</h2><p className="text-sm text-muted">{article.summary[lang]}</p></header> : <PageHeader title={article.title[lang]} description={article.summary[lang]} />}
      {!embeddedArticleId && fromApp && <Link className="vh-link" to={`/app/${fromApp.id}?tab=guide`}>{t('appGuide', { name: fromApp.name })}</Link>}
      {embeddedArticleId && <Link className="vh-link" to={articleLink(article)}>{t('openReference')}</Link>}
      {embeddedArticleId === 'claude-code' && <div><Link className="vh-link" to="/learning/claude-code-handbook">{t('claudeHandbook')}</Link></div>}
      {error != null && <ErrorNotice error={error} />}
      <article lang={lang === 'fa' ? 'fa-IR' : 'en-US'} dir={lang === 'fa' ? 'rtl' : 'ltr'} className="vh-article-reader rounded-xl border border-border bg-surface p-5 sm:p-7">
        {body ? <MarkdownContent source={body} onError={setError} /> : <p role="status" className="text-sm text-muted">{t('common:loading')}</p>}
        <footer className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted">
          <span>{t('reviewed')}: {reviewedDate(article.checkedAt, lang)}</span>
          <button type="button" className="text-primary hover:underline" onClick={() => void openUrl(article.sourceUrl).catch(setError)}>{t('source')}</button>
          {!referenceArticle && <button type="button" aria-pressed={!!done[article.id]} data-testid="lesson-done-toggle" className="inline-flex items-center gap-1.5 text-primary hover:underline" onClick={() => mark(article.id, !done[article.id])}>
            {done[article.id] ? <CheckCircle2 size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
            {t(done[article.id] ? 'markedDone' : 'markDone')}
          </button>}
        </footer>
      </article>
      {!embeddedArticleId && step >= 0 && <nav aria-label={t('guidesView')} className="vh-learning-step-nav">
        {[
          { item: path[step - 1], label: 'previousLesson' },
          { item: path[step + 1], label: 'nextLesson' },
        ].map(({ item, label }) => item && <Link key={label} to={articleLink(item)} className="vh-learning-step-link">
          <span>{t(label)}</span>
          <strong>{item.title[lang]}</strong>
        </Link>)}
      </nav>}
      {!!article.relatedIds?.length && <section className="space-y-2" aria-label={t('related')}>
        <h2 className="font-bold">{t('related')}</h2>
        <div className="flex flex-wrap gap-2">{article.relatedIds.map(id => {
          const related = articles.find(item => item.id === id);
          return related ? <Link key={id} to={articleLink(related)} className="vh-learning-filter">{related.title[lang]}</Link> : null;
        })}</div>
      </section>}
    </div>;
  }

  const row = (item: LearningArticle, stepNumber?: number) => {
    const doneButton = view === 'guides' && <button type="button" className="vh-learning-done" aria-pressed={!!done[item.id]} data-testid="lesson-done-toggle" aria-label={t(done[item.id] ? 'markNotDoneAria' : 'markDoneAria', { title: item.title[lang] })} onClick={() => mark(item.id, !done[item.id])}>
      {done[item.id] ? <CheckCircle2 size={19} aria-hidden="true" /> : <Circle size={19} aria-hidden="true" />}
    </button>;
    return <div key={item.id} className={view === 'reference' ? 'vh-learning-row vh-learning-reference-row' : 'vh-learning-row'} data-testid="learning-row" data-article={item.id}>
      {stepNumber === undefined ? doneButton :
        <span className="vh-learning-step-number" aria-hidden="true">{formatNumber.format(stepNumber)}</span>}
      <Link to={categoryId === 'all' ? articleLink(item) : `/learning/${item.id}?${categoryLink(categoryId)}`} className="vh-learning-row-copy">
        <h3>{item.title[lang]}</h3><p>{item.summary[lang]}</p>
      </Link>
      {stepNumber === undefined ? <BookOpen size={17} aria-hidden="true" /> : doneButton}
    </div>;
  };

  return <div className="vh-learning-home space-y-5">
    <PageHeader title={t(view === 'guides' ? 'guidesView' : view === 'reference' ? 'referenceView' : 'newsView')} actions={view !== 'news' ?
      <Button size="sm" variant="ghost" loading={refreshing} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />{t('refresh')}</Button>
    : undefined} />
    {view === 'news' ? <NewsAndOffers embedded /> : <>
    {refreshed && <p role="status" className="text-sm text-success">{t('refreshed')}</p>}
    {error != null && <ErrorNotice error={error} onRetry={() => void refresh()} />}
    <div className="vh-learning-controls">
      <label className="vh-learning-level"><span>{t('categories')}</span>
        <select value={categoryId} onChange={event => setParams(categoryLink(event.target.value))}>
          <option value="all">{t('all')}</option>
          {categories.filter(item => listed.some(article => article.category === item.id)).map(item => <option key={item.id} value={item.id}>{item.title[lang]}</option>)}
        </select>
      </label>
    </div>
      {showPath && path.length ? <section className="vh-learning-results" aria-label={t('guidesView')}>
        {levels.filter(level => level.items.length).map(level => <section key={level.id} className="vh-learning-group" aria-labelledby={`learning-${level.id}`}>
          <header className="vh-learning-level-heading">
            <h2 id={`learning-${level.id}`}>{t(`levels.${level.id}.title`)}</h2>
            <p>{t(`levels.${level.id}.description`)}</p>
          </header>
          <ol start={path.findIndex(item => item.id === level.items[0]?.id) + 1}>
            {level.items.map(item => <li key={item.id}>{row(item, path.indexOf(item) + 1)}</li>)}
          </ol>
        </section>)}
      </section> : null}
      {shelves.length ? <div className="vh-learning-results">
      {showPath && <h2 className="vh-learning-supplementary">{t('supplementary')}</h2>}
      {shelves.map(group => <section key={group.category.id} className="vh-learning-group" aria-label={group.category.title[lang]}>
        {categoryId === 'all' && <h2>{group.category.title[lang]}</h2>}
        <div>{group.items.map(item => row(item))}</div>
      </section>)}
    </div> : (!showPath || !path.length) && <EmptyState title={t('empty')} sub={t('emptyHint')} />}
    </>}
  </div>;
}
