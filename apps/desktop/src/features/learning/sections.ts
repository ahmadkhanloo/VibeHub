import type { LearningArticle } from '@core';
import { curriculum } from '@/lib/learning-curriculum';

const toolReferences = new Set(['playwright', 'dsh-deepseek-web-login', 'rtl-setup']);
const referenceCategories = new Set(['applications', 'skills', 'integrations']);

export function isReference(article: LearningArticle) {
  return !curriculum.includes(article.id) &&
    (referenceCategories.has(article.category) || toolReferences.has(article.id) || article.kind === 'skill');
}

export function isReferenceCategory(category: string) {
  return referenceCategories.has(category);
}

export function learningView(params: URLSearchParams, article?: LearningArticle) {
  const view = params.get('view');
  if (view === 'news') return 'news';
  if (article) return isReference(article) ? 'reference' : 'guides';
  if (view === 'reference' || view === 'guides') return view;
  return isReferenceCategory(params.get('category') ?? '') ? 'reference' : 'guides';
}

export function articleLink(article: LearningArticle) {
  return '/learning/' + encodeURIComponent(article.id) + (isReference(article) ? '?view=reference' : '');
}
