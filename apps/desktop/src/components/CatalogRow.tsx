import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AppManifest } from "@core";
import { AppLogo } from "./AppLogo";
import { Badge } from "./ui";
export function CatalogRow({
  app,
  installed = false,
}: {
  app: AppManifest;
  installed?: boolean;
}) {
  const { t, i18n } = useTranslation("ux");
  return (
    <Link className="vh-tool-row hover:bg-surface-alt" to={"/app/" + app.id}>
      <AppLogo appId={app.id} name={app.name} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-bold">
            <bdi>{app.name}</bdi>
          </h2>
          {installed && <Badge tone="success">{t("installed")}</Badge>}
        </div>
        <p className="vh-row-description">
          {app.summary[i18n.language.startsWith("fa") ? "fa" : "en"]}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="muted">{t(app.kind)}</Badge>
          <Badge>
            {t(app.freeAccess === "unknown" ? "unknownAccess" : app.freeAccess)}
          </Badge>
          {app.capabilities.rtl === "verified" && (
            <Badge tone="primary">{t("common:rtl")}</Badge>
          )}
        </div>
      </div>
      <span className="vh-link shrink-0">{t("prepare")}</span>
    </Link>
  );
}
