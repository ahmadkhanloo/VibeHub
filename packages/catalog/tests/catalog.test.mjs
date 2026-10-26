import assert from 'node:assert/strict';
import test from 'node:test';
import { filterApps, loadCatalog } from '../src/index.ts';

const unknownAccessApp = {
  schemaVersion: 1,
  id: 'limited-tool',
  name: 'Limited Tool',
  summary: { fa: 'ابزار', en: 'Tool' },
  kind: 'cli_agent',
  platforms: ['windows'],
  websiteUrl: 'https://example.com',
  isOpenSource: false,
  freeAccess: 'unknown',
  freeAccessDetails: { fa: 'نامشخص', en: 'Unknown' },
  requiresSignup: null,
  requiresPaymentCard: null,
  sourceOfFreeAccess: 'https://example.com/terms',
  lastVerified: '2026-10-26',
  capabilities: {
    install: 'unknown', launch: 'unknown', rtl: 'unknown', proxy: 'unknown', terminal: 'unknown', byok: 'unknown',
  },
};

test('unknown free-access status is filterable and never included by the open-source-only filter', () => {
  const catalog = loadCatalog({ apps: [unknownAccessApp], providers: [], offers: [] });

  assert.deepEqual(filterApps(catalog, { freeAccess: 'unknown' }).map((app) => app.id), ['limited-tool']);
  assert.deepEqual(filterApps(catalog, { openSourceOnly: true }).map((app) => app.id), []);
});
