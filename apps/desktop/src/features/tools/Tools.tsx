import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpLeft, BookOpen, GraduationCap, Palette, Puzzle, Sparkles, Stethoscope, Terminal, Users, WandSparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui';

const tools = [
  { to: '/accounts', icon: Users, title: 'accountsTool', description: 'accountsToolHint', group: 'manage' },
  { to: '/offers', icon: Sparkles, title: 'offersTool', description: 'offersToolHint', group: 'manage' },
  { to: '/terminal', icon: Terminal, title: 'terminalTool', description: 'terminalToolHint', group: 'manage' },
  { to: '/doctor', icon: Stethoscope, title: 'doctorTool', description: 'doctorToolHint', group: 'manage' },
  { to: '/guides', icon: BookOpen, title: 'guidesTool', description: 'guidesToolHint', group: 'learn' },
  { to: '/guides/extensions', icon: Puzzle, title: 'extensionsTool', description: 'extensionsToolHint', group: 'learn' },
  { to: '/learning', icon: GraduationCap, title: 'learningTool', description: 'learningToolHint', group: 'learn' },
  { to: '/onboarding', icon: WandSparkles, title: 'onboardingTool', description: 'onboardingToolHint', group: 'personalize' },
  { to: '/settings?section=appearance', icon: Palette, title: 'appearanceTool', description: 'appearanceToolHint', group: 'personalize' },
] as const;

export function ToolsPage() {
  const { t } = useTranslation('workbench');
  return <div className="vh-tools-page space-y-8">
    <PageHeader title={t('moreTools')} description={t('toolsIntro')} />
    {(['manage', 'learn', 'personalize'] as const).map(group => <section key={group} className="space-y-4" aria-label={t(group)}>
      <h2 className="vh-section-title">{t(group)}</h2>
      <div className="vh-tools-grid">{tools.filter(tool => tool.group === group).map(tool => <Link className="vh-tool-card" key={tool.to} to={tool.to}>
        <span className="vh-tool-icon"><tool.icon size={22} aria-hidden="true" /></span>
        <div><h3>{t(tool.title)}</h3><p>{t(tool.description)}</p></div>
        <ArrowUpLeft className="vh-tool-arrow" size={17} aria-hidden="true" />
      </Link>)}</div>
    </section>)}
  </div>;
}
