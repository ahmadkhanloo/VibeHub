import playwrightLogo from '@/assets/playwright-logo.svg';
import ponytailLogo from '@/assets/ponytail-logo.png';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, ClipboardList, Drama, FlaskConical, Palette, PenLine, Radar, Ribbon, Sparkles, Terminal, Wrench, PlugZap } from 'lucide-react';
import { ipc, type ToolchainStatus } from '@/services/ipc';
import { PageHeader, Tabs } from './ui';

const HELPER_TOOLS = [
  { id: 'playwright', key: 'playwright', Icon: FlaskConical },
  { id: 'repowise', key: 'repowise', Icon: Radar },
  { id: 'hindsight', key: 'hindsight', Icon: Brain },
  { id: 'dsh-workspace-hygiene', key: 'dsh', Icon: Wrench },
] as const;

const SKILL_TOOLS = [
  { id: 'ponytail', key: 'ponytail', Icon: Ribbon },
  { id: 'ui-ux-pro-max', key: 'uiux', Icon: Palette },
  { id: 'unslop', key: 'unslop', Icon: PenLine },
  { id: 'stageshow', key: 'stageshow', Icon: Drama },
] as const;
const PLUGIN_TOOLS = [
  { id: 'superpowers', key: 'superpowers', Icon: Sparkles },
] as const;

type HelperTool = (typeof HELPER_TOOLS)[number] | (typeof SKILL_TOOLS)[number] | (typeof PLUGIN_TOOLS)[number];

function useToolchainStatus(): ToolchainStatus | null {
  const [status, setStatus] = useState<ToolchainStatus | null>(null);
  useEffect(() => { void ipc.toolchainStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  return status;
}

function chipOk(tool: HelperTool, status: ToolchainStatus | null): boolean | null {
  if (!status) return null;
  switch (tool.key) {
    case 'repowise':
      return status.repowise.installed;
    case 'playwright':
      return Boolean(status.browsers.edge || status.browsers.chrome);
    case 'superpowers':
      return status.plugins.superpowers;
    // The skill entry key ('uiux') is its i18n prefix; the status field is longer.
    case 'uiux':
      return status.skills.uiuxProMax;
    default:
      return status.skills[tool.key as keyof ToolchainStatus['skills']];
  }
}

function chipStatus(tool: HelperTool, status: ToolchainStatus | null, t: (key: string, vars?: Record<string, unknown>) => string): { ok: boolean | null; label: string } {
  const ok = chipOk(tool, status);
  if (ok === null) return { ok: null, label: '' };
  switch (tool.key) {
    case 'repowise':
      return ok
        ? { ok: true, label: t('repoInstalled', { version: status!.repowise.version ?? '?' }) }
        : { ok: false, label: t('repoMissing') };
    case 'playwright': {
      const list = [status!.browsers.edge && 'Edge', status!.browsers.chrome && 'Chrome'].filter(Boolean).join(', ');
      return list ? { ok: true, label: t('browsersFound', { list }) } : { ok: false, label: t('browsersMissing') };
    }
    default:
      return { ok, label: t(ok ? 'installed' : 'notInstalled') };
  }
}

function ToolRow({ tool, status }: { tool: HelperTool; status: ToolchainStatus | null }) {
  const { t } = useTranslation(['tools']);
  const found = chipStatus(tool, status, t);
  const logo = tool.key === 'playwright' ? playwrightLogo : tool.key === 'ponytail' ? ponytailLogo : null;
  return (
    <Link className="vh-tool-row" to={'/learning/' + tool.id} aria-label={t(`${tool.key}Name`)} aria-describedby={`tool-copy-${tool.id}`}>
      {logo ? <img className="vh-helper-logo" src={logo} alt="" width={24} height={24} /> : <tool.Icon size={24} aria-hidden="true" />}
      <div className="min-w-0">
        <h3 className="font-semibold"><bdi>{t(`${tool.key}Name`)}</bdi></h3>
        <p id={`tool-copy-${tool.id}`} className="text-sm text-muted">{t(`${tool.key}Summary`)}</p>
        {found.label && <p className="mt-1 text-xs text-muted">{found.label}</p>}
      </div>
    </Link>
  );
}

export function ToolLibraryPage() {
  const { t } = useTranslation(['tools', 'ux', 'nav']);
  const status = useToolchainStatus();
  const [tab, setTab] = useState<'helpers' | 'skills' | 'plugins'>('skills');
  const rows = tab === 'helpers' ? HELPER_TOOLS : tab === 'skills' ? SKILL_TOOLS : PLUGIN_TOOLS;
  return <div className="space-y-5">
    <PageHeader title={t('libraryTitle')} description={t('libraryHint')} actions={<Link to="/learning" className="vh-link">{t('nav:learning')}</Link>} />
    <Tabs panelId="tool-library-panel" label={t('libraryTitle')} value={tab} onChange={setTab} items={[
      { value: 'helpers', label: t('helpersTab'), icon: <Wrench size={16} aria-hidden="true" /> },
      { value: 'skills', label: t('skillsTab'), icon: <Palette size={16} aria-hidden="true" /> },
      { value: 'plugins', label: t('pluginsTab'), icon: <PlugZap size={16} aria-hidden="true" /> },
    ]} />
    <div className="vh-tool-library">
      <section className="vh-tool-group" id="tool-library-panel" role="tabpanel" aria-labelledby={'tool-library-panel-tab-' + tab}>
        <h2 className="sr-only">{t(tab === 'helpers' ? 'helpersTab' : tab === 'skills' ? 'skillsTab' : 'pluginsTab')}</h2>
        <div className="vh-card vh-tool-list">
          {rows.map(tool => <ToolRow key={tool.id} tool={tool} status={status} />)}
          {tab === 'skills' && <Link className="vh-tool-row" to="/learning/spec-kit?view=reference">
            <ClipboardList size={24} aria-hidden="true" />
            <div><h3 className="font-semibold">Spec Kit</h3><p className="text-sm text-muted">{t('specKitSummary')}</p></div>
          </Link>}
          {tab === 'helpers' && <Link className="vh-tool-row" to="/terminal" aria-label={t('terminalHeading')} aria-describedby="tool-copy-terminal">
            <Terminal size={24} aria-hidden="true" />
            <div><h3 className="font-semibold">{t('terminalHeading')}</h3><p id="tool-copy-terminal" className="text-sm text-muted">{t('terminalHint')}</p></div>
          </Link>}
        </div>
        {tab === 'plugins' && <p className="text-sm text-muted">{t('pluginsHint')}</p>}
      </section>
    </div>
  </div>;
}
