import { useState } from 'react';
import { ToolProxy } from '@/features/proxy/ToolProxy';
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, ArrowUpRight } from "lucide-react";
import { useToolContext } from "@/app/tool-context";
import { useCatalog } from "@/lib/catalog";
import { AppLogo } from "@/components/AppLogo";
import { LaunchControls } from "@/components/LaunchControls";
import {
  Badge,
  Button,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Spinner,
  Modal,
} from "@/components/ui";
export function HomePage() {
  const { t } = useTranslation("ux");
  const ctx = useToolContext();
  const [editor, setEditor] = useState<{id:string;name:string}|null>(null);
  const catalog = useCatalog();
  const tools = [
    ...ctx.apps
      .filter((a) => a.installed)
      .map((a) => ({
        ...a,
        name: catalog.apps.find((c) => c.id === a.id)?.name ?? a.id,
        kind: "app" as const,
      })),
    ...ctx.editors.map((e) => ({ ...e, kind: "editor" as const })),
  ];
  return (
    <div className="space-y-6">
      <Modal open={!!editor} title={editor?.name??t('prepare')} onClose={()=>setEditor(null)}>
       {editor&&<><p className="text-sm text-muted">{t('editorUnknown')}</p><ToolProxy appId={editor.id}/><Link className="vh-link" to={'/doctor?tool='+editor.id+'&kind=editor'} onClick={()=>setEditor(null)}>{t('doctor')}</Link></>}
      </Modal>
      <PageHeader
        title={t("workspace")}
        description={t("workspaceSub")}
        actions={
          <>
            <Button loading={ctx.loading} onClick={() => void ctx.refresh()}>
              <RefreshCw size={16} aria-hidden="true" />
              {t("refresh")}
            </Button>
            <Link to="/discover" className="vh-button vh-button-primary">
              <Plus size={16} aria-hidden="true" />
              {t("discover")}
            </Link>
          </>
        }
      />
      {ctx.errors.length > 0 &&
        (ctx.detectionFailed ? (
          <ErrorNotice
            error={ctx.errors.join("\n")}
            onRetry={() => void ctx.refresh()}
          />
        ) : (
          <div className="space-y-2">
            <p role="status" className="text-sm text-warning">
              {t("partial")}
            </p>
            <ErrorNotice
              error={ctx.errors.join("\n")}
              onRetry={() => void ctx.refresh()}
            />
          </div>
        ))}
      {ctx.loading && !tools.length ? (
        <Spinner />
      ) : tools.length === 0 && !ctx.detectionFailed ? (
        <EmptyState
          title={t("noInstalled")}
          sub={t("noInstalledSub")}
          action={
            <Link to="/discover" className="vh-button vh-button-primary">
              {t("discover")}
            </Link>
          }
        />
      ) : (
        tools.length > 0 && (
          <>
            <p className="vh-section-kicker">
              {t("count", { count: tools.length })}
            </p>
            <div className="vh-tool-list">
              {tools.map((tool) => {
                const app =
                  tool.kind === "app"
                    ? catalog.apps.find((a) => a.id === tool.id)
                    : undefined;
                return (
                  <article key={tool.kind + tool.id} className="vh-tool-row">
                    <AppLogo appId={tool.id} name={tool.name} size={48} />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-bold">
                        <bdi>{tool.name}</bdi>
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {tool.version && <bdi>{tool.version}</bdi>}
                        <span>
                          {ctx.states[tool.id]?.phase === "running"
                            ? t("running")
                            : t("installed")}
                        </span>
                        {app?.capabilities.rtl === "verified" &&
                          ctx.components.some(
                            (c) => c.id === tool.id && c.available,
                          ) && <Badge tone="primary">{t("rtlReady")}</Badge>}
                      </div>
                    </div>
                    <div className="vh-row-actions">
                      <LaunchControls
                        id={tool.id}
                        name={tool.name}
                        kind={tool.kind}
                        supportsRtl={app?.capabilities.rtl === "verified"}
                      />
                      {tool.kind === "app" ? (
                        <Link
                          className="vh-button vh-button-ghost"
                          to={"/app/" + tool.id}
                          aria-label={t("prepare") + " " + tool.name}
                        >
                          {t("prepare")}
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </Link>
                      ) : (
                        <Button variant="ghost" onClick={()=>setEditor(tool)} aria-label={t('prepare')+' '+tool.name}>{t('prepare')}</Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="max-w-3xl text-xs leading-6 text-muted">
              {t("launchNote")}
            </p>
          </>
        )
      )}
    </div>
  );
}
