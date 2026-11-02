import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Bug, CheckCircle2, Circle, Download, GitBranch, GraduationCap, ListChecks, Network, RefreshCw, SearchCheck, Settings } from 'lucide-react';
import type { ComponentType } from 'react';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { useToolContext } from '@/app/tool-context';
import { useSettings } from '@/app/settings';
import { useLessonProgress } from '@/lib/progress';

type StepAction =
  | { kind: 'route'; to: string; labelKey: string }
  | { kind: 'lesson'; to: string }
  | { kind: 'refresh' }
  | { kind: 'settings' };

type Step = {
  id: string;
  icon: ComponentType<{ size?: number | string; className?: string }>;
  titleKey: string;
  bodyKey: string;
  action?: StepAction;
};

const STEPS: Step[] = [
  { id: 'install-hub', icon: Download, titleKey: 'install.title', bodyKey: 'install.body', action: { kind: 'settings' } },
  { id: 'detect-app', icon: RefreshCw, titleKey: 'detect.title', bodyKey: 'detect.body', action: { kind: 'refresh' } },
  { id: 'connect-model', icon: Network, titleKey: 'connect.title', bodyKey: 'connect.body', action: { kind: 'route', to: '/connections/api', labelKey: 'openConnections' } },
  { id: 'first-project', icon: ListChecks, titleKey: 'firstProject.title', bodyKey: 'firstProject.body', action: { kind: 'lesson', to: '/learning/first-project?category=start' } },
  { id: 'git-first-commit', icon: GitBranch, titleKey: 'git.title', bodyKey: 'git.body', action: { kind: 'lesson', to: '/learning/git-first-commit?category=git' } },
  { id: 'debugging-with-agent', icon: Bug, titleKey: 'debug.title', bodyKey: 'debug.body', action: { kind: 'lesson', to: '/learning/debugging-with-agent?category=workflows' } },
  { id: 'code-review', icon: SearchCheck, titleKey: 'review.title', bodyKey: 'review.body', action: { kind: 'lesson', to: '/learning/code-review?category=workflows' } },
  { id: 'final-project', icon: GraduationCap, titleKey: 'final.title', bodyKey: 'final.body', action: { kind: 'lesson', to: '/learning/git-practice-resources?category=git' } },
];

export function WorkshopPage() {
  const { t } = useTranslation(['workshop', 'common']);
  const { settings } = useSettings();
  const { apps, loading, refresh } = useToolContext();
  const { done, mark } = useLessonProgress();
  const installedCount = apps.filter((app) => app.installed).length;
  const completed = STEPS.filter((step) => done[step.id]).length;

  const action = (step: Step) => {
    if (!step.action) return null;
    if (step.action.kind === 'refresh') {
      return <Button size="sm" loading={loading} disabled={loading} onClick={() => void refresh()}>
        <RefreshCw size={15} aria-hidden="true" />{t('detect.action')}
      </Button>;
    }
    if (step.action.kind === 'settings') {
      return <Link to="/settings" className="vh-learning-filter">{t('install.action')}</Link>;
    }
    if (step.action.kind === 'route') {
      return <Link to={step.action.to} className="vh-learning-filter">{t(step.action.labelKey)}</Link>;
    }
    return <Link to={step.action.to} className="vh-learning-filter">{t('openLesson')}</Link>;
  };

  return <div className="mx-auto max-w-4xl space-y-5">
    <PageHeader title={t('title')} description={t('subtitle')} />
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm">
        <Badge tone={completed === STEPS.length ? 'success' : 'primary'}>{t('progressCount', { completed, total: STEPS.length })}</Badge>
        <span className="ms-3 text-muted">{t('progressHint')}</span>
      </p>
      <p className="text-sm">
        <Link to="/settings?section=appearance" className="vh-link">{t('modeCta')}</Link>
        {settings.workshopMode && <Badge tone="success">{t('modeOn')}</Badge>}
      </p>
    </Card>
    <ol className="space-y-3">
      {STEPS.map((step, index) => {
        const isDone = !!done[step.id];
        return <li key={step.id}>
          <Card className={'p-5 ' + (isDone ? 'border-success/50' : '')} data-testid="workshop-step" data-step={step.id}>
            <div className="flex items-start gap-4">
              <button type="button" aria-pressed={isDone} aria-label={t(isDone ? 'markNotDone' : 'markDone', { title: t(step.titleKey) })}
                data-testid="workshop-step-toggle"
                onClick={() => mark(step.id, !isDone)}
                className="mt-0.5 shrink-0 text-primary">
                {isDone ? <CheckCircle2 size={24} aria-hidden="true" /> : <Circle size={24} aria-hidden="true" />}
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <h2 className={'font-semibold' + (isDone ? ' line-through opacity-60' : '')}>
                  <span className="text-muted">{index + 1}. </span>{t(step.titleKey)}
                </h2>
                <p className="text-sm leading-7 text-muted">{t(step.bodyKey)}</p>
                {step.id === 'detect-app' && installedCount > 0 && <p className="text-sm">{t('detect.found', { count: installedCount })}</p>}
                <div className="pt-1">{action(step)}</div>
              </div>
              <step.icon size={22} aria-hidden="true" className="shrink-0 text-muted" />
            </div>
          </Card>
        </li>;
      })}
    </ol>
    <Card className="p-5">
      <h2 className="font-semibold">{t('facilitator.title')}</h2>
      <p className="mt-1 text-sm leading-7 text-muted">{t('facilitator.body')}</p>
    </Card>
  </div>;
}
