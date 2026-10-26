import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ExternalLink, RefreshCw, BookOpen, CheckCircle2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCatalog } from "@/lib/catalog";
import { useToolContext } from "@/app/tool-context";
import { AppLogo } from "@/components/AppLogo";
import { LaunchControls } from "@/components/LaunchControls";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  SectionTitle,
  VerificationBadge,
} from "@/components/ui";
import { ToolProxy } from "@/features/proxy/ToolProxy";
export function AppDetailsPage() {
  const { appId = "" } = useParams();
  const { t, i18n } = useTranslation(["ux", "apps", "common"]);
  const catalog = useCatalog();
  const ctx = useToolContext();
  const [error, setError] = useState<unknown>(null);
  const app = catalog.apps.find((a) => a.id === appId);
  if (!app)
    return (
      <EmptyState
        title={t("ux:notFound")}
        action={
          <Link className="vh-link" to="/discover">
            {t("ux:backDiscover")}
          </Link>
        }
      />
    );
  const installed = ctx.apps.find((a) => a.id === appId && a.installed);
  const lang = i18n.language.startsWith("fa") ? "fa" : "en";
  const ready =
    app.capabilities.rtl === "verified" &&
    ctx.components.some((c) => c.id === appId && c.available);
  const source = async (url: string) => {
    try {
      await openUrl(url);
      setError(null);
    } catch (e) {
      setError(e);
    }
  };
  const compatible = catalog.providers.filter(
    (p) =>
      p.supportedApps[appId] &&
      p.supportedApps[appId] !== "unknown" &&
      p.supportedApps[appId] !== "unsupported",
  );
  const truth = (v: boolean | null) =>
    t(v === true ? "ux:yes" : v === false ? "ux:no" : "ux:unknown");
  return (
    <div className="space-y-6">
      <Link className="vh-link" to="/discover">
        {t("ux:backDiscover")}
      </Link>
      <div className="sticky -top-4 z-10 border-b border-border bg-bg pb-4 pt-3">
        <PageHeader
          title={app.name}
          description={app.summary[lang]}
          actions={
            installed ? (
              <LaunchControls
                id={appId}
                name={app.name}
                supportsRtl={app.capabilities.rtl === "verified"}
              />
            ) : (
              <Button
                variant="primary"
                onClick={() =>
                  void source(
                    app.installMethods?.find(
                      (m) => m.method === "official-installer",
                    )?.idOrUrl ?? app.websiteUrl,
                  )
                }
              >
                <ExternalLink size={16} aria-hidden="true" />
                {t("apps:officialDownload")}
              </Button>
            )
          }
        />
      </div>
      {error != null && <ErrorNotice error={error} />}
      <div className="vh-setup-grid">
        <div className="space-y-6">
          <Card as="section">
            <SectionTitle>{t("ux:install")}</SectionTitle>
            <div className="flex flex-wrap items-center gap-3">
              <AppLogo appId={appId} name={app.name} size={40} />
              <Badge tone={installed ? "success" : "muted"}>
                {ctx.loading
                  ? t("ux:checking")
                  : t(installed ? "ux:installed" : "ux:notInstalled")}
              </Badge>
              {installed?.version && (
                <bdi className="text-xs text-muted">{installed.version}</bdi>
              )}
              <Button loading={ctx.loading} onClick={() => void ctx.refresh()}>
                <RefreshCw size={16} aria-hidden="true" />
                {t("apps:refreshInstalled")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void source(app.websiteUrl)}
              >
                <ExternalLink size={16} aria-hidden="true" />
                {t("ux:external")}
              </Button>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted">
              {t("ux:installNote")}
            </p>
            {ctx.errors.length > 0 && (
              <div className="mt-4">
                <ErrorNotice
                  error={ctx.errors.join("\n")}
                  onRetry={() => void ctx.refresh()}
                />
              </div>
            )}
          </Card>
          <Card as="section">
            <SectionTitle>{t("ux:launchSetup")}</SectionTitle>
            <div className="flex items-center gap-2">
              <CheckCircle2
                aria-hidden="true"
                size={18}
                className={ready ? "text-success" : "text-muted"}
              />
              <VerificationBadge status={app.capabilities.rtl} />
              {ready && <Badge tone="success">{t("ux:rtlReady")}</Badge>}
            </div>
            <p className="mt-3 text-sm leading-7 text-muted">
              {t(
                app.capabilities.rtl === "verified"
                  ? ready
                    ? "apps:rtlBundled"
                    : "ux:rtlMissing"
                  : "apps:rtlUnavailable",
              )}
            </p>
            <p className="mt-3 text-xs leading-6 text-muted">
              {t("ux:launchNote")}
            </p>
          </Card>
          <Card as="section">
            <SectionTitle>
              {t("ux:proxy")} <Badge tone="muted">{t("ux:optional")}</Badge>
            </SectionTitle>
            <ToolProxy appId={appId} />
          </Card>
          <Card as="section">
            <SectionTitle>
              {t("ux:modelSetup")}{" "}
              <Badge tone="muted">{t("ux:optional")}</Badge>
            </SectionTitle>
            <p className="text-sm leading-7 text-muted">
              {t("ux:modelManual")}
            </p>
            <h3 className="mt-5 text-sm font-bold">{t("ux:compatible")}</h3>
            <div className="mt-3 space-y-3">
              {compatible.length ? (
                compatible.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"
                  >
                    <Link className="vh-link" to={"/models?provider=" + p.id}>
                      {p.name}
                    </Link>
                    <VerificationBadge
                      status={p.supportedApps[appId] ?? "unknown"}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">{t("ux:noCompatibility")}</p>
              )}
            </div>
            <Link
              className="vh-button vh-button-secondary mt-5"
              to={"/guides/" + appId}
            >
              <BookOpen size={16} aria-hidden="true" />
              {t("ux:guideFor", { name: app.name })}
            </Link>
          </Card>
        </div>
        <aside className="space-y-6">
          <Card as="section">
            <SectionTitle>{t("ux:aboutTool")}</SectionTitle>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-muted">{t("ux:type")}</dt>
                <dd className="mt-1">{t("ux:" + app.kind)}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("ux:freeAccess")}</dt>
                <dd className="mt-1">
                  {t(
                    "ux:" +
                      (app.freeAccess === "unknown"
                        ? "unknownAccess"
                        : app.freeAccess),
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t("ux:signup")}</dt>
                <dd>{truth(app.requiresSignup)}</dd>
              </div>
              <div>
                <dt className="text-muted">{t("ux:card")}</dt>
                <dd>{truth(app.requiresPaymentCard)}</dd>
              </div>
            </dl>
            <p className="mt-5 text-sm leading-7">
              {app.freeAccessDetails[lang]}
            </p>
            <p className="mt-4 text-xs text-muted">
              {t("ux:verifiedOn")}: <bdi>{app.lastVerified}</bdi>
            </p>
            <Button
              className="mt-3"
              size="sm"
              onClick={() => void source(app.sourceOfFreeAccess)}
            >
              {t("ux:source")}
              <ExternalLink size={14} aria-hidden="true" />
            </Button>
          </Card>
          {app.eligibility?.map((e, i) => (
            <Card as="section" key={i}>
              <SectionTitle>
                {t("ux:eligibility")}{" "}
                <bdi className="text-xs">{e.countryCode}</bdi>
              </SectionTitle>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-muted">{t("ux:network")}</dt>
                  <dd>{t("apps:networkAccess." + e.networkAccess)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t("ux:account")}</dt>
                  <dd>{t("apps:accountPolicy." + e.accountPolicy)}</dd>
                </div>
              </dl>
              {e.regionNotes && (
                <p className="mt-4 text-xs leading-6 text-muted">
                  {e.regionNotes[lang]}
                </p>
              )}
              {e.testedAt && (
                <p className="mt-3 text-xs">
                  <bdi>{e.testedAt}</bdi>
                </p>
              )}
              {e.sourceUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => void source(e.sourceUrl!)}
                >
                  {t("ux:source")}
                </Button>
              )}
            </Card>
          ))}
        </aside>
      </div>
    </div>
  );
}
