import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/ui';
import { ToolChipSection, TerminalCard, useToolchainStatus } from '@/components/ToolCards';
import { useCatalog } from '@/lib/catalog';

// Curated next steps: documented skills and workflows from the library that the
// chips above do not cover yet. Grounded in bundled articles only — no invented
// marketplace entries.
const SUGGESTED_IDS = ['skill-creator', 'document-formats', 'dsh-deepseek-web-login', 'code-review', 'debugging-with-agent'] as const;

export function HelpersPage() {
  const { t } = useTranslation(['ux', 'tools']);
  const catalog = useCatalog();
  const toolchain = useToolchainStatus();
  const suggested = SUGGESTED_IDS.map(id => catalog.articles.find(article => article.id === id)).filter(Boolean);
  return <div className="space-y-6">
    <PageHeader title={t('ux:groupHelpers')} description={t('ux:helpersIntro')} />
    <ToolChipSection status={toolchain} />
    <section aria-label={t('ux:suggested')} className="space-y-3">
      <h2 className="vh-section-title mb-1">{t('ux:suggested')}</h2>
      <div className="vh-tools-grid">
        {suggested.map(article => <Link key={article!.id} className="vh-tool-card" to={'/learning/' + article!.id}>
          <div>
            <h3><bdi>{article!.title.fa}</bdi></h3>
            <p><bdi>{article!.summary.fa}</bdi></p>
            <span className="vh-link">{t('tools:openArticle')}</span>
          </div>
        </Link>)}
        <TerminalCard />
      </div>
    </section>
  </div>;
}
