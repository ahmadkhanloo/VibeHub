import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '@/components/ui';
import { LearningNav } from '@/features/guides/LearningNav';

export function LearningPage() {
  const { t } = useTranslation(['guides', 'nav']);
  return <div className="space-y-6">
    <PageHeader title={t('nav:learning')} description={t('guides:sharedIntro')} />
    <LearningNav />
    <Card className="space-y-5">
      <h2 className="text-lg font-bold">{t('guides:sharedTitle')}</h2>
      <ol className="space-y-5">
        {['install', 'connect', 'verify'].map((step, index) => <li key={step} className="flex gap-3">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-alt font-bold text-primary">{index + 1}</span>
          <div><h3 className="font-bold">{t(`guides:shared.${step}.title`)}</h3><p className="mt-1 text-sm leading-7 text-muted">{t(`guides:shared.${step}.body`)}</p></div>
        </li>)}
      </ol>
      <Link to="/guides" className="inline-flex min-h-11 items-center text-sm font-bold text-primary hover:underline">{t('guides:appSpecific')}</Link>
    </Card>
    <Card className="space-y-3" id="rtl"><h2 className="font-bold">{t('guides:sharedRtlTitle')}</h2><p className="text-sm leading-7 text-muted">{t('guides:sharedRtlBody')}</p><Link to="/doctor" className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">{t('nav:doctor')}</Link></Card>
  </div>;
}
