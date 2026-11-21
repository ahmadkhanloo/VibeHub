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

export function useToolchainStatus(): ToolchainStatus | null {
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

/**
 * The chip rows follow the workspace's installed/available split: installed-view
 * shows the detected ones, available-view the missing ones. With a null status
 * (detection failed) nothing is hidden, so the facts stay visible.
 */
export function ToolChipSection({ status, filter }: { status: ToolchainStatus | null; filter?: 'installed' | 'missing' }) {
  const { t } = useTranslation(['tools', 'ux']);
  const pick = (tools: readonly HelperTool[]) => tools.filter(tool => {
    if (!filter) return true;
    const ok = chipOk(tool, status);
    return ok !== null && (filter === 'installed' ? ok : !ok);
  });
  const helpers = pick(HELPER_TOOLS);
  const skills = pick(SKILL_TOOLS);
  if (!helpers.length && !skills.length) return null;
  const row = (title: string, tools: readonly HelperTool[]) => tools.length > 0 && <div className="space-y-2">
    <h2 className="vh-section-title mb-1">{title} <span className="vh-section-count">({tools.length})</span></h2>
    <div className="vh-chip-row">{tools.map(tool => <ToolChip key={tool.id} tool={tool} status={status} />)}</div>
  </div>;
  return <section aria-label={t('ux:groupHelpers')} className="space-y-3">
    {row(t('ux:groupHelpers'), helpers)}
    {row(t('ux:groupSkills'), skills)}
  </section>;
}
