import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ChevronDown, RefreshCw, Search, BookOpen } from 'lucide-react';
import { groupTutorials, LEARNING_TOPICS, type LearningTopic, type LearningTutorial } from '@core';
import { Badge, Button, EmptyState, ErrorNotice, Input, PageHeader } from '@/components/ui';
import { GuideIllustration } from '@/components/GuideIllustration';
import { LearningNav } from './LearningNav';
import { useCatalog } from '@/lib/catalog';
import { useSettings } from '@/app/settings';
import { ipc } from '@/services/ipc';

export function ExtensionsPage() {
  const { t, i18n } = useTranslation('extensions');
  const lang = i18n.resolvedLanguage?.startsWith('fa') ? 'fa' : 'en';
  const [query, setQuery] = useState(''), [error, setError] = useState<unknown>(null);
  const [topic, setTopic] = useState<LearningTopic | 'all'>('all');
  const [level, setLevel] = useState<NonNullable<LearningTutorial['level']> | 'all'>('all');
  const { learning: entries } = useCatalog();
  const { settings } = useSettings();
  const [updating, setUpdating] = useState(false), [updated, setUpdated] = useState(false);
  const refresh = async () => {
    setUpdating(true); setError(null); setUpdated(false);
    try { await ipc.feedSync(settings.feedBaseUrl); setUpdated(true); }
    catch (error) { setError(error); }
    finally { setUpdating(false); }
  };
  const groups = useMemo(() => groupTutorials(entries, { query, topic, level, lang }), [entries, query, topic, level, lang]);
  const count = groups.reduce((sum, group) => sum + group.items.length, 0);
  const external = (url: string) => { void openUrl(url).catch(setError); };
  return <div className="vh-learning-library space-y-6">
    <PageHeader title={t('libraryTitle')} description={t('intro')} actions={<Button loading={updating} disabled={updating} onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" />{t('update')}</Button>} />
    <LearningNav />
    <div className="vh-learning-intro">
      <div><BookOpen size={28} aria-hidden="true" /><h2>{t('startWithGoal')}</h2><p>{t('libraryHint')}</p></div>
      <p>{t('updateHint')}</p>
    </div>
    {updated && <p role="status" className="text-sm">{t('updated')}</p>}
    {error != null && <ErrorNotice error={error} />}
    <div className="vh-learning-filters">
      <label className="vh-learning-search"><span>{t('search')}</span><div><Search size={18} aria-hidden="true" /><Input type="search" dir="auto" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('searchHint')} /></div></label>
      <label className="vh-learning-level"><span>{t('difficulty')}</span><select aria-label={t('difficulty')} value={level} onChange={e => setLevel(e.target.value as typeof level)}>{['all', 'beginner', 'intermediate', 'advanced'].map(key => <option key={key} value={key}>{t(`levels.${key}`)}</option>)}</select></label>
      <div className="vh-topic-pills" aria-label={t('topicsLabel')}>
        {(['all', ...LEARNING_TOPICS] as const).map(key => <button type="button" key={key} aria-pressed={topic === key} onClick={() => setTopic(key)}>{t(`topics.${key}`)}</button>)}
      </div>
    </div>
    <p className="text-sm text-muted" role="status">{t('resultCount', { count })}</p>
    <div className="vh-learning-collections">{groups.map(group => <section key={group.topic} className="vh-learning-collection" aria-label={t(`topics.${group.topic}`)}>
      <header className="vh-collection-header">
        <div><h2>{t(`topics.${group.topic}`)}</h2><p>{t(`topicHints.${group.topic}`)}</p><span>{t('lessonCount', { count: group.items.length })}</span></div>
        <GuideIllustration topic={group.topic} compact />
      </header>
      <div className="vh-collection-lessons">{group.items.map(item => <details className="vh-learning-lesson" key={item.id} open={query.trim() ? true : undefined}>
        <summary><div><div className="vh-lesson-meta"><Badge tone="muted">{t(item.kind)}</Badge><span>{t(`levels.${item.level ?? 'beginner'}`)}</span></div><h3><bdi>{item.name}</bdi></h3><p>{item.summary[lang]}</p></div><ChevronDown size={19} aria-hidden="true" /></summary>
        <div className="vh-lesson-reader">
          <GuideIllustration topic={group.topic} />
          <p className="text-sm leading-7 text-muted"><strong>{t('compatibility')}: </strong>{item.compatibility[lang]}</p>
          <dl>{(['prerequisites', 'install', 'use', 'remove', 'troubleshoot'] as const).map((key, index) => <div key={key}><dt><span aria-hidden="true">{index + 1}</span>{t(key)}</dt><dd dir="auto">{item[key][lang]}</dd></div>)}</dl>
          <div className="vh-lesson-sources"><button className="vh-link" onClick={() => external(item.source)}>{t('source')}</button><span>{t('checked', { date: item.checked })}</span></div>
          {item.kind === 'skill' && <button className="vh-link text-sm" onClick={() => external('https://learn.chatgpt.com/docs/build-skills')}>{t('official')}</button>}
        </div>
      </details>)}</div>
    </section>)}</div>
    {!count && <EmptyState title={t('empty')} sub={t('emptyHint')} />}
    <details className="vh-learning-terms"><summary>{t('official')}</summary><p>{t('terms')}</p><button className="vh-link" onClick={() => external('https://learn.chatgpt.com/docs/plugins')}>{t('source')}</button></details>
  </div>;
}
