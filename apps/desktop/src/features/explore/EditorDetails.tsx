import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '@/components/AppLogo';
import { LaunchControls } from '@/components/LaunchControls';
import { ToolProxy } from '@/features/proxy/ToolProxy';
import { useToolContext } from '@/app/tool-context';
import { Badge, Button, EmptyState, PageHeader } from '@/components/ui';

export function EditorDetailsPage() {
  const { editorId = '' } = useParams();
  const { t } = useTranslation(['ux', 'common', 'connectionsUx']);
  const ctx = useToolContext();
  if (editorId !== 'antigravity-ide') return <Navigate to="/" replace />;
  const editor = ctx.editors.find(item => item.id === editorId && item.installed);
  if (!editor && !ctx.loading) return <EmptyState title={t('ux:notFound')} action={<Link className="vh-link" to="/">{t('ux:workspace')}</Link>} />;
  const name = editor?.name ?? 'Antigravity IDE';
  return <div className="space-y-6">
    <Link className="vh-link" to="/">{t('ux:workspace')}</Link>
    <div className="vh-details-heading">
      <AppLogo appId={editorId} name={name} size={48} />
      <PageHeader title={name} actions={<LaunchControls id={editorId} name={name} kind="editor" compact />} />
    </div>
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Badge tone={editor ? 'success' : 'muted'}>{ctx.loading ? t('ux:checking') : t(editor ? 'ux:installed' : 'ux:notInstalled')}</Badge>
      {editor?.version && <bdi className="text-muted">{editor.version}</bdi>}
      <Button variant="ghost" loading={ctx.loading} onClick={() => void ctx.refresh()} aria-label={t('refresh')} title={t('refresh')}>{t('refresh')}</Button>
    </div>
    <section className="vh-card space-y-4" aria-labelledby="editor-proxy-title">
      <h2 id="editor-proxy-title" className="font-semibold">{t('connectionsUx:nextLaunchProxy')}</h2>
      <ToolProxy appId={editorId} />
    </section>
  </div>;
}
