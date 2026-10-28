import { useMemo, useSyncExternalStore } from 'react';
// Bundled catalog snapshot — the offline baseline (plan §4.4). Remote refresh
// overlays this via the feed_sync IPC after schema validation on the Rust side.

import { loadCatalog, classifyOffers, type Catalog, type OfferView } from '@catalog';
import { assertNoExecutablePayload, type AppManifest, type ProviderManifest } from '@core';

const appModules = import.meta.glob('../../../../content/apps/*.json', { eager: true, import: 'default' });
const providerModules = import.meta.glob('../../../../content/providers/*.json', { eager: true, import: 'default' });
const offerModules = import.meta.glob('../../../../content/offers/*.json', { eager: true, import: 'default' });

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

const remoteGuides: Record<string, string> = {};
let revision = 0;
const listeners = new Set<() => void>();
export function useCatalog() {
 const version = useSyncExternalStore((listener) => {listeners.add(listener);return () => {listeners.delete(listener);};}, () => revision);
 return useMemo(() => ({apps: [...apps], providers: [...providers], offers: [...bundledCatalog.offers]}), [version]);
}
export function clearContentCache() {
 localStorage.removeItem('vibehub.content.v1');
 apps.splice(0,apps.length,...initialCatalog.apps);
 providers.splice(0,providers.length,...initialCatalog.providers);
 bundledCatalog.offers.splice(0,bundledCatalog.offers.length,...initialCatalog.offers);
 for (const key of Object.keys(remoteGuides)) delete remoteGuides[key];
 revision++;listeners.forEach(listener=>listener());
}
const initialCatalog = {apps: [...apps], providers: [...providers], offers: [...bundledCatalog.offers]};

export function validateRemoteGuides(raw: unknown, catalog: Catalog): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Incomplete guide feed');
  const guides: Record<string, string> = {};
  for (const app of catalog.apps) for (const lang of ['fa', 'en']) {
    const key = `${app.id}/${lang}`;
    const text = (raw as Record<string, unknown>)[key];
    if (typeof text !== 'string' || !text.trim() || text.length > 128 * 1024) throw new Error(`Invalid guide: ${key}`);
    assertNoExecutablePayload(text);
    guides[key] = text;
  }
  return guides;
}

export function applyRemoteCatalog(catalog: Catalog, guides: Record<string, string>): void {
  apps.splice(0, apps.length, ...catalog.apps);
  providers.splice(0, providers.length, ...catalog.providers);
  bundledCatalog.offers.splice(0, bundledCatalog.offers.length, ...catalog.offers);
  for (const key of Object.keys(remoteGuides)) delete remoteGuides[key];
  Object.assign(remoteGuides, guides);
  revision++; listeners.forEach(listener=>listener());
  window.dispatchEvent(new Event('vibehub:catalog-updated'));
  try { localStorage.setItem('vibehub.content.v1', JSON.stringify({ catalog, guides })); } catch { /* Current in-memory content remains usable. */ }
}

try {
  const cached = localStorage.getItem('vibehub.content.v1');
  if (cached) {
    assertNoExecutablePayload(cached);
    const raw = JSON.parse(cached);
    const catalog = loadCatalog(raw.catalog);
    applyRemoteCatalog(catalog, validateRemoteGuides(raw.guides, catalog));
  }
} catch { /* Invalid cache or unavailable storage: use the bundled snapshot. */ }

export function appById(id: string): AppManifest | undefined {
  return apps.find((a) => a.id === id);
}

export const guideModules = import.meta.glob('../../../../content/guides/**/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

export function guideText(appId: string, lang: 'fa' | 'en'): string | null {
  const remote = remoteGuides[`${appId}/${lang}`];
  if (remote) return remote;
  const hit = Object.entries(guideModules).find(([p]) => p.includes(`/${appId}/${lang}.md`));
  return hit?.[1]?.trim() ? hit[1] : null;
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
