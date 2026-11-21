import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader, Tabs } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { AccountsPage } from './Accounts';
import { ClaudeAccountsPage } from './ClaudeAccounts';
import { OpaqueAccountsPage } from './OpaqueAccounts';
import { QuotaPanel } from './QuotaPanel';

// One shell-level place for accounts: a slim tab strip per account-capable app,
// each tab reusing the exact embedded page the app details view shows, so the
// data and behaviour stay identical whichever entry point the user takes. The
// daily quota publishers (Qoder, MiniMax Code) get their own tab — they are
// app quotas, not Codex accounts, and must not sit inside the Codex tab.
const HUB_APPS = ['chatgpt', 'claude-code', 'zcode', 'qoder'] as const;
type HubApp = (typeof HUB_APPS)[number];

export function AccountsHubPage() {
  const { t } = useTranslation(['ux', 'accounts', 'common']);
  const catalog = useCatalog();
  const [params, setParams] = useSearchParams();
  const requested = params.get('app');
  const app: HubApp | 'quota' = requested === 'quota' || HUB_APPS.includes(requested as HubApp) ? (requested as HubApp | 'quota') : 'chatgpt';
  const name = (id: string) => catalog.apps.find(a => a.id === id)?.name ?? id;
  const tabs = [...HUB_APPS.map(id => ({ value: id, label: name(id) })), { value: 'quota', label: t('accounts:quota.title') }];
  const opaque = app === 'zcode' || app === 'qoder';
  return <div className="space-y-5">
    <PageHeader title={t('ux:accountsHub')} />
    <Tabs panelId="accounts-hub" label={t('ux:accountsHub')} value={app} onChange={value => setParams(value === 'chatgpt' ? {} : { app: value })} items={tabs} />
    <div id="accounts-hub" role="tabpanel" aria-labelledby={'accounts-hub-tab-' + app}>
      {app === 'quota'
        ? <QuotaPanel />
        : app === 'claude-code'
          ? <ClaudeAccountsPage />
          : opaque
            ? <OpaqueAccountsPage appId={app as 'zcode' | 'qoder'} appName={name(app)} />
            : <AccountsPage embedded />}
    </div>
  </div>;
}
