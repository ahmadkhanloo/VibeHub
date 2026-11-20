import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, FlaskConical, Palette, PenLine, Radar, Ribbon, Sparkles, Terminal, Wrench } from 'lucide-react';
import { ipc, type ToolchainStatus } from '@/services/ipc';

/**
 * Helper tools and personal skills are documented, not launched: each entry is a
 * small, low-key chip in the workspace that links to its own learning article,
 * where the full explanation lives. Machine-level facts only — launch state
 * stays on the app tiles.
 */
const HELPER_TOOLS = [
  { id: 'playwright', key: 'playwright', Icon: FlaskConical },
  { id: 'repowise', key: 'repowise', Icon: Radar },
  { id: 'superpowers', key: 'superpowers', Icon: Sparkles },
  { id: 'hindsight', key: 'hindsight', Icon: Brain },
  { id: 'dsh-workspace-hygiene', key: 'dsh', Icon: Wrench },
] as const;

const SKILL_TOOLS = [
  { id: 'ponytail', key: 'ponytail', Icon: Ribbon },
  { id: 'ui-ux-pro-max', key: 'uiux', Icon: Palette },
  { id: 'unslop', key: 'unslop', Icon: PenLine },
] as const;

type HelperTool = (typeof HELPER_TOOLS)[number] | (typeof SKILL_TOOLS)[number];
export const HELPER_COUNT = HELPER_TOOLS.length;
export const SKILL_COUNT = SKILL_TOOLS.length;

function useToolchain(): ToolchainStatus | null {
  const [status, setStatus] = useState<ToolchainStatus | null>(null);
  useEffect(() => { void ipc.toolchainStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  return status;
}

export function TerminalCard() {
  const { t } = useTranslation(['tools']);

  return (
    <Link className="vh-tool-card" to="/terminal">
      <span className="vh-tool-icon"><Terminal size={20} aria-hidden="true" /></span>
      <div>
        <h3>{t('terminalHeading')}</h3>
        <p>{t('terminalHint')}</p>
      </div>
    </Link>
  );
}

function chipStatus(tool: HelperTool, status: ToolchainStatus | null, t: (key: string, vars?: Record<string, unknown>) => string): { ok: boolean | null; label: string } {
  if (!status) return { ok: null, label: '' };
  switch (tool.key) {
    case 'repowise':
      return status.repowise.installed
        ? { ok: true, label: t('repoInstalled', { version: status.repowise.version ?? '?' }) }
        : { ok: false, label: t('repoMissing') };
    case 'playwright': {
      const list = [status.browsers.edge && 'Edge', status.browsers.chrome && 'Chrome'].filter(Boolean).join(', ');
      return list ? { ok: true, label: t('browsersFound', { list }) } : { ok: false, label: t('browsersMissing') };
    }
    case 'superpowers':
      return { ok: status.plugins.superpowers, label: t(status.plugins.superpowers ? 'installed' : 'notInstalled') };
    default:
      return { ok: status.skills[tool.key as keyof ToolchainStatus['skills']], label: t(status.skills[tool.key as keyof ToolchainStatus['skills']] ? 'installed' : 'notInstalled') };
  }
}

function ToolChip({ tool, status }: { tool: HelperTool; status: ToolchainStatus | null }) {
  const { t } = useTranslation(['tools']);
  const found = chipStatus(tool, status, t);
  const title = `${t(`${tool.key}Summary`)}${found.label ? ' — ' + found.label : ''}`;
  return (
    <Link className="vh-tool-chip" to={'/learning/' + tool.id} title={title} aria-label={t(`${tool.key}Name`)}>
      <tool.Icon size={14} aria-hidden="true" />
      <span>{t(`${tool.key}Name`)}</span>
      {found.ok !== null && <i className={'vh-chip-dot' + (found.ok ? ' is-ok' : ' is-missing')} aria-hidden="true" />}
    </Link>
  );
}

export function HelperChips() {
  const status = useToolchain();
  return <div className="vh-chip-row">{HELPER_TOOLS.map(tool => <ToolChip key={tool.id} tool={tool} status={status} />)}</div>;
}

export function SkillChips() {
  const status = useToolchain();
  return <div className="vh-chip-row">{SKILL_TOOLS.map(tool => <ToolChip key={tool.id} tool={tool} status={status} />)}</div>;
}
