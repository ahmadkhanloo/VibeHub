import type { LearningTutorial } from './schemas.ts';
import { normalizeSearch } from './ux.ts';

export const LEARNING_TOPICS = ['ui', 'documents', 'testing', 'models', 'integrations', 'extensions'] as const;
export type LearningTopic = typeof LEARNING_TOPICS[number];

export function tutorialTopic(item: LearningTutorial): LearningTopic {
  if (item.topic) return item.topic;
  if (['pdf', 'docx', 'xlsx', 'pptx'].includes(item.id)) return 'documents';
  if (item.id === 'frontend-design') return 'ui';
  if (item.id === 'webapp-testing') return 'testing';
  if (item.id === 'dsh-deepseek-web-login') return 'models';
  if (item.kind === 'plugin') return 'integrations';
  return 'extensions';
}

export function groupTutorials(entries: LearningTutorial[], filter: {
  topic: LearningTopic | 'all'; level: NonNullable<LearningTutorial['level']> | 'all'; query: string; lang: 'fa' | 'en';
}) {
  const needle = normalizeSearch(filter.query);
  const items = entries.filter(item =>
    (filter.topic === 'all' || tutorialTopic(item) === filter.topic) &&
    (filter.level === 'all' || (item.level ?? 'beginner') === filter.level) &&
    normalizeSearch([item.name, item.id, item.kind, item.summary[filter.lang], item.compatibility[filter.lang], item.install[filter.lang], item.use[filter.lang]].join(' ')).includes(needle)
  ).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  return LEARNING_TOPICS.map(topic => ({ topic, items: items.filter(item => tutorialTopic(item) === topic) })).filter(group => group.items.length);
}
