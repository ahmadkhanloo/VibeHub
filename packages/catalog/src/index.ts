// Catalog loading + filtering over validated manifests. The bundled snapshot
// is the baseline; a remote feed may refresh it, but everything passes the
// same zod validation first (plan §5.3).
import {
  appManifestSchema,
  providerManifestSchema,
  offerSchema,
  type AppManifest,
  type Offer,
  type ProviderManifest,
} from '@vibehub/core';

export interface Catalog {
  apps: AppManifest[];
  providers: ProviderManifest[];
  offers: Offer[];
}

export class CatalogError extends Error {}

export function loadCatalog(raw: {
  apps: unknown[];
  providers: unknown[];
  offers: unknown[];
}): Catalog {
  const apps = raw.apps.map((a, i) => {
    const parsed = appManifestSchema.safeParse(a);
    if (!parsed.success) throw new CatalogError(`app[${i}]: ${parsed.error.message}`);
    return parsed.data as AppManifest;
  });
  const providers = raw.providers.map((p, i) => {
    const parsed = providerManifestSchema.safeParse(p);
    if (!parsed.success) throw new CatalogError(`provider[${i}]: ${parsed.error.message}`);
    return parsed.data as ProviderManifest;
  });
  const offers = raw.offers.map((o, i) => {
    const parsed = offerSchema.safeParse(o);
    if (!parsed.success) throw new CatalogError(`offer[${i}]: ${parsed.error.message}`);
    return parsed.data as Offer;
  });
  return { apps, providers, offers };
}

export interface DiscoverFilters {
  query?: string;
  openSourceOnly?: boolean;
  freeAccess?: 'all' | AppManifest['freeAccess'];
  platform?: 'windows' | 'linux' | 'macos';
  guiCli?: 'all' | 'gui' | 'cli';
  rtlVerified?: boolean;
  installedIds?: string[];
  installedOnly?: boolean;
}

function matchesQuery(app: AppManifest, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    app.name.toLowerCase().includes(needle) ||
    app.id.includes(needle) ||
    app.summary.fa.includes(q.trim()) ||
    app.summary.en.toLowerCase().includes(needle)
  );
}

export function filterApps(catalog: Catalog, f: DiscoverFilters): AppManifest[] {
  return catalog.apps.filter((app) => {
    if (!matchesQuery(app, f.query ?? '')) return false;
    if (f.openSourceOnly && app.isOpenSource !== true) return false;
    if (f.freeAccess && f.freeAccess !== 'all' && app.freeAccess !== f.freeAccess) return false;
    if (f.platform && !app.platforms.includes(f.platform)) return false;
    if (f.guiCli === 'gui' && app.kind === 'cli_agent') return false;
    if (f.guiCli === 'cli' && app.kind !== 'cli_agent') return false;
    if (f.rtlVerified && app.capabilities.rtl !== 'verified') return false;
    if (f.installedOnly && !(f.installedIds ?? []).includes(app.id)) return false;
    return true;
  });
}

export type OfferView = Offer & { state: 'active' | 'upcoming' | 'expired' };

export function classifyOffers(offers: Offer[], now = new Date()): OfferView[] {
  return offers
    .map((offer) => {
      let state: OfferView['state'] = 'active';
      if (offer.startAt && new Date(offer.startAt) > now) state = 'upcoming';
      if (offer.endAt && new Date(offer.endAt) < now) state = 'expired';
      return { ...offer, state };
    })
    .sort((a, b) => (b.verifiedAt > a.verifiedAt ? 1 : -1));
}
