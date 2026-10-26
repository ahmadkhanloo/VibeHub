import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appManifestSchema, offerSchema, assertNoExecutablePayload } from '../src/schemas.ts';

const validApp = {
  schemaVersion: 1,
  id: 'zcode',
  name: 'ZCode',
  summary: { fa: 'محیط کدنویسی', en: 'Coding IDE' },
  kind: 'desktop_ide',
  platforms: ['windows'],
  websiteUrl: 'https://zcode.z.ai/',
  isOpenSource: null,
  freeAccess: 'free_tier',
  freeAccessDetails: { fa: 'رایگان با سهمیه', en: 'Free with quota' },
  requiresSignup: true,
  requiresPaymentCard: false,
  sourceOfFreeAccess: 'https://zcode.z.ai/',
  lastVerified: '2026-10-26',
  capabilities: { install: 'reported', launch: 'verified', rtl: 'verified', proxy: 'unknown', terminal: 'unsupported', byok: 'unknown' },
};

test('valid app manifest parses', () => {
  assert.equal(appManifestSchema.safeParse(validApp).success, true);
});

test('unknown schema version is rejected', () => {
  const bad = { ...validApp, schemaVersion: 2 };
  assert.equal(appManifestSchema.safeParse(bad).success, false);
});

test('exec command fields are rejected by strict schema', () => {
  const bad = { ...validApp, installCommand: 'powershell -c evil' };
  assert.equal(appManifestSchema.safeParse(bad).success, false);
});

test('executable payloads in markdown are rejected', () => {
  assert.throws(() => assertNoExecutablePayload('run <script>alert(1)</script>'));
  assert.throws(() => assertNoExecutablePayload('powershell -EncodedFile x'));
  assert.doesNotThrow(() => assertNoExecutablePayload('# Guide\n\nnormal text ```code block```'));
});

const validOffer = {
  schemaVersion: 1,
  offerId: 'test',
  title: { fa: 'آفر', en: 'Offer' },
  summary: { fa: 'خلاصه', en: 'Summary' },
  sourceUrl: 'https://example.com/',
  publishedAt: '2026-10-01',
  verifiedAt: '2026-10-01',
  status: 'verified',
};

test('valid offer parses; bad status rejected', () => {
  assert.equal(offerSchema.safeParse(validOffer).success, true);
  assert.equal(offerSchema.safeParse({ ...validOffer, status: 'fake' }).success, false);
});
