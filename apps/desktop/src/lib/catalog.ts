// Bundled catalog snapshot — the offline baseline (plan §4.4). Remote refresh
// overlays this via the feed_sync IPC after schema validation on the Rust side.

import { loadCatalog, classifyOffers, type Catalog, type OfferView } from '@catalog';
import { assertNoExecutablePayload, type AppManifest, type ProviderManifest } from '@core';

const appModules = import.meta.glob('../../../content/apps/*.json', { eager: true, import: 'default' });
const providerModules = import.meta.glob('../../../content/providers/*.json', { eager: true, import: 'default' });
const offerModules = import.meta.glob('../../../content/offers/*.json', { eager: true, import: 'default' });

function values<T>(modules: Record<string, unknown>): T[] {
  return Object.values(modules) as T[];
}

// index.json is the feed index, not an offer — exclude it from the offers array.
const offerValues = Object.entries(offerModules)
  .filter(([path]) => !path.endsWith('index.json'))
  .map(([, v]) => v);

export const bundledCatalog: Catalog = loadCatalog({
  apps: values<unknown>(appModules),
  providers: values<unknown>(providerModules),
  offers: offerValues,
});

export const apps: AppManifest[] = bundledCatalog.apps;
export const providers: ProviderManifest[] = bundledCatalog.providers;

export function applyRemoteCatalog(catalog: Catalog): void {
  apps.splice(0, apps.length, ...catalog.apps);
  providers.splice(0, providers.length, ...catalog.providers);
  bundledCatalog.offers.splice(0, bundledCatalog.offers.length, ...catalog.offers);
  try { localStorage.setItem('vibehub.catalog.v1', JSON.stringify(catalog)); } catch { /* Current in-memory content remains usable. */ }
}

try {
  const cached = localStorage.getItem('vibehub.catalog.v1');
  if (cached) {
    assertNoExecutablePayload(cached);
    applyRemoteCatalog(loadCatalog(JSON.parse(cached)));
  }
} catch { /* Invalid cache or unavailable storage: use the bundled snapshot. */ }

export function appById(id: string): AppManifest | undefined {
  return apps.find((a) => a.id === id);
}

export const guideModules = import.meta.glob('../../../content/guides/**/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

export function guideText(appId: string, lang: 'fa' | 'en'): string | null {
  const hit = Object.entries(guideModules).find(([p]) => p.includes(`/${appId}/${lang}.md`));
  return hit ? hit[1] : null;
}

export function guideSections(markdown: string): { title: string; body: string }[] {
  const parts = markdown.split(/^##\s+/m).slice(1);
  return parts.map((part) => {
    const nl = part.indexOf('\n');
    return { title: part.slice(0, nl).trim(), body: part.slice(nl + 1).trim() };
  });
}

export { classifyOffers };
export type { OfferView };
