import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader, Tabs } from '@/components/ui';
import { Tooltip } from '@/components/Tooltip';
import { useCatalog } from '@/lib/catalog';
import { AccountsPage } from './Accounts';
import { ClaudeAccountsPage } from './ClaudeAccounts';
import { OpaqueAccountsPage } from './OpaqueAccounts';
import { QuotaPanel } from './QuotaPanel';

// One shell-level place for accounts: a slim tab strip per account-capable app,
// each tab reusing the exact embedded page the app details view shows, so the
// data and behaviour stay identical whichever entry point the user takes.
// Each quota publisher keeps its quota inside its own tab — Qoder stacks its
// quota under its accounts, MiniMax Code has a quota-only tab.
const HUB_APPS = ['chatgpt', 'claude-code', 'zcode', 'qoder', 'minimax-code'] as const;
type HubApp = (typeof HUB_APPS)[number];

export function AccountsHubPage() {
  const { t } = useTranslation(['ux', 'accounts', 'common']);
  const catalog = useCatalog();
  const [params, setParams] = useSearchParams();
  const requested = params.get('app');
  const app: HubApp = HUB_APPS.includes(requested as HubApp) ? (requested as HubApp) : 'chatgpt';
  const name = (id: string) => catalog.apps.find(a => a.id === id)?.name ?? id;
  const tabs = HUB_APPS.map(id => ({ value: id, label: name(id) }));
  return <div className="space-y-5">
    {/* The first-read note belongs to the ChatGPT tab, so its tooltip only sits beside
        the title while that tab is active. */}
    <PageHeader title={t('ux:accountsHub')} titleAside={app === 'chatgpt' && <Tooltip text={t('accounts:initialRead')} />} />
    <Tabs panelId="accounts-hub" label={t('ux:accountsHub')} value={app} onChange={value => setParams(value === 'chatgpt' ? {} : { app: value })} items={tabs} />
    <div id="accounts-hub" role="tabpanel" aria-labelledby={'accounts-hub-tab-' + app}>
      {app === 'chatgpt' && <AccountsPage embedded />}
      {app === 'claude-code' && <ClaudeAccountsPage />}
      {app === 'zcode' && <OpaqueAccountsPage appId="zcode" appName={name('zcode')} />}
      {app === 'qoder' && <>
        <OpaqueAccountsPage appId="qoder" appName={name('qoder')} />
        <div className="mt-6"><QuotaPanel apps={['qoder']} /></div>
      </>}
      {app === 'minimax-code' && <QuotaPanel apps={['minimax-code']} />}
    </div>
  </div>;
}
