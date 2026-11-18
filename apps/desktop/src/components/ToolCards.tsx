import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Compass, FlaskConical, Radar, Sparkles, Terminal } from 'lucide-react';
import { ipc, type ToolchainStatus } from '@/services/ipc';

const HELPER_TOOLS = [
  { id: 'playwright', Icon: FlaskConical },
  { id: 'repowise', Icon: Radar },
  { id: 'superpowers', Icon: Sparkles },
  { id: 'find-skills', key: 'findSkills', Icon: Compass },
] as const;

type HelperTool = (typeof HELPER_TOOLS)[number];

/**
 * The terminal setup card and the helper tools that belong beside an agent but are
 * not apps to launch: each helper is documented rather than launched, and only
 * machine-level facts are reported here. Launch state lives on the app tiles.
 */
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

export function HelperCards() {
  return <>{HELPER_TOOLS.map(tool => <HelperCard key={tool.id} tool={tool} />)}</>;
}

function HelperCard({ tool }: { tool: HelperTool }) {
  const { t } = useTranslation(['tools']);
  const [status, setStatus] = useState<ToolchainStatus | null>(null);
  useEffect(() => { void ipc.toolchainStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  const key = 'key' in tool ? tool.key : tool.id;

  let found: string;
  if (!status) found = t(`${key}Hint`);
  else if (tool.id === 'repowise') found = status.repowise.installed
    ? t('repoInstalled', { version: status.repowise.version ?? '?' })
    : t('repoMissing');
  else if (tool.id === 'playwright') {
    const list = [status.browsers.edge && 'Edge', status.browsers.chrome && 'Chrome'].filter(Boolean).join(', ');
    found = list ? t('browsersFound', { list }) : t('browsersMissing');
  } else if (tool.id === 'superpowers') found = status.plugins?.superpowers ? t('installed') : t('notInstalled');
  else found = status.skills?.findSkills ? t('installed') : t('notInstalled');

  return (
    <Link className="vh-tool-card" to={'/learning/' + tool.id}>
      <span className="vh-tool-icon"><tool.Icon size={20} aria-hidden="true" /></span>
      <div>
        <h3>{t(`${key}Name`)}</h3>
        <p>{t(`${key}Summary`)}</p>
        <p className="vh-tool-status" role="status">{found}</p>
        <span className="vh-link inline-flex items-center gap-1"><BookOpen size={15} aria-hidden="true" />{t('openArticle')}</span>
      </div>
    </Link>
  );
}
