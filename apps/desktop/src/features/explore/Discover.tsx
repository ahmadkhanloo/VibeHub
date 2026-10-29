import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { filterApps } from "@catalog";
import { useCatalog } from "@/lib/catalog";
import { useToolContext } from "@/app/tool-context";
import { CatalogRow } from "@/components/CatalogRow";
import {
  Button,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Tabs,
} from "@/components/ui";
export function DiscoverPage() {
  const { t } = useTranslation(["ux", "apps"]);
  const [params, setParams] = useSearchParams();
  const catalog = useCatalog();
  const ctx = useToolContext();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = Number(params.get('oss') === '1') + Number(params.get('rtl') === '1');
  const tabs = ["all", "ide", "cli", "installed"];
  const tab = tabs.includes(params.get("tab") ?? "")
    ? params.get("tab")!
    : "all";
  const query = params.get("q") ?? "";
  const results = filterApps(catalog, {
    query,
    openSourceOnly: params.get("oss") === "1",
    freeAccess: (params.get("free") ?? "all") as "all",
    rtlVerified: params.get("rtl") === "1",
    installedIds: ctx.apps.filter((a) => a.installed).map((a) => a.id),
    installedOnly: tab === "installed",
  }).filter((a) =>
    tab === "ide"
      ? a.kind !== "cli_agent"
      : tab === "cli"
        ? a.kind === "cli_agent"
        : true,
  );
  const change = (key: string, value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  return (
    <div className="space-y-6">
      <PageHeader title={t("ux:discover")} actions={<Button aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16} aria-hidden="true" />{t("ux:filters")}{activeFilters > 0 && <> <span>({activeFilters})</span></>}</Button>} />
      <Tabs
        panelId="discover-results"
        label={t("apps:filters")}
        value={tab}
        onChange={(v) => change("tab", v === "all" ? "" : v)}
        items={tabs.map((value) => ({ value, label: t("apps:tabs." + value) }))}
      />
      {filtersOpen && <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-surface p-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={params.get("oss") === "1"}
            onChange={(e) => change("oss", e.target.checked ? "1" : "")}
          />
          {t("apps:openSourceOnly")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={params.get("rtl") === "1"}
            onChange={(e) => change("rtl", e.target.checked ? "1" : "")}
          />
          {t("apps:rtlVerified")}
        </label>
      </div>}
      {tab === "installed" && ctx.errors.length > 0 && (
        <ErrorNotice
          error={ctx.errors.join("\n")}
          onRetry={() => void ctx.refresh()}
        />
      )}
      {query && <Button size="sm" onClick={() => change("q", "")}>{t("ux:clearSearch")}: {query}</Button>}
      <p role="status" className="vh-section-kicker">
        {t("ux:searchCount", {
          count: results.length,
        })}
      </p>
      <div id="discover-results" role="tabpanel" aria-labelledby={"discover-results-tab-"+tab}>
      {results.length ? (
        <div className="vh-app-grid">
          {results.map((app) => (
            <CatalogRow
              key={app.id}
              app={app}
              installed={ctx.apps.some((a) => a.id === app.id && a.installed)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("ux:noResults")}
          sub={t("ux:trySearch")}
          action={
            <Button onClick={() => setParams({})}>{t("ux:clearSearch")}</Button>
          }
        />
      )}
      </div>
    </div>
  );
}
