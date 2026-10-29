import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { normalizeSearch } from "@core";
import { useCatalog } from "@/lib/catalog";
import { CatalogRow } from "@/components/CatalogRow";
import { EmptyState, PageHeader, SectionTitle } from "@/components/ui";
export function SearchPage() {
  const { t, i18n } = useTranslation("ux");
  const [params] = useSearchParams();
  const query = params.get("q") ?? "";
  const needle = normalizeSearch(query);
  const catalog = useCatalog();
  const apps = catalog.apps.filter((a) =>
    normalizeSearch(
      [a.id, a.name, a.summary.fa, a.summary.en].join(" "),
    ).includes(needle),
  );
  const providers = catalog.providers.filter((p) =>
    normalizeSearch([p.id, p.name, p.notes.fa, p.notes.en].join(" ")).includes(
      needle,
    ),
  );
  return (
    <div className="space-y-8">
      <PageHeader
        title={t("searchResults")}
        description={query ? "«" + query + "»" : t("searchHint")}
      />
      {!apps.length && !providers.length ? (
        <EmptyState title={t("noResults")} sub={t("trySearch")} />
      ) : (
        <>
          <section aria-label={t("tools")}>
            <SectionTitle>
              {t("tools")} ({apps.length})
            </SectionTitle>
            {apps.length ? (
              <div className="vh-app-grid">
                {apps.map((app) => (
                  <CatalogRow key={app.id} app={app} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{t("noResults")}</p>
            )}
          </section>
          <section aria-label={t("services")}>
            <SectionTitle>
              {t("services")} ({providers.length})
            </SectionTitle>
            {providers.length ? (
              <div className="vh-tool-list">
                {providers.map((p) => (
                  <Link
                    key={p.id}
                    to={"/models?provider=" + p.id}
                    className="vh-tool-row hover:bg-surface-alt"
                  >
                    <div>
                      <h2 className="font-bold">{p.name}</h2>
                      <p className="vh-row-description">
                        {p.notes[i18n.language.startsWith("fa") ? "fa" : "en"]}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{t("noResults")}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
