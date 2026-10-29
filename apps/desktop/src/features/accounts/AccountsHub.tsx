import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '@/lib/catalog';
import { PageHeader, Select } from '@/components/ui';
import { AccountsPage } from './Accounts';
import { DesktopAccounts } from './DesktopAccounts';

export function AccountsHub() {
  const { t } = useTranslation(['accounts', 'workbench']);
  const { apps } = useCatalog();
  const [params, setParams] = useSearchParams();
  const requested = params.get('app') ?? 'chatgpt';
  const selected = ['chatgpt', 'qoder', 'zcode'].includes(requested) ? requested : 'chatgpt';
  return <div className="space-y-6">
    <PageHeader title={t('workbench:accountsTool')} description={t('workbench:accountsToolHint')} />
    <label className="block max-w-sm space-y-2 text-sm"><span>{t('accounts:selectApp')}</span>
      <Select value={selected} onChange={app => setParams({ app })} options={apps.filter(app => ['chatgpt', 'qoder', 'zcode'].includes(app.id)).map(app => ({ value: app.id, label: app.name }))} />
    </label>
    <section className="vh-card">{selected === 'chatgpt' ? <AccountsPage embedded /> : <DesktopAccounts key={selected} appId={selected} />}</section>
  </div>;
}
