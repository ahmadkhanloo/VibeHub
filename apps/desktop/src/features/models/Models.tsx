import { Disclosure } from '@/components/Disclosure';
import { Tooltip } from '@/components/Tooltip';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, Eye, EyeOff, KeyRound, Plus, Save, Trash2, Zap } from 'lucide-react';
import { Badge, Button, Card, CopyButton, ErrorNotice, Input, Modal, PageHeader } from '@/components/ui';
import { useCatalog, providers as bundledProviders } from '@/lib/catalog';
import { ProviderLogo } from '@/components/ProviderLogo';
import { ipc, type ApiTestReport, type ModelList, type ProviderConnection } from '@/services/ipc';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { ProviderManifest } from '@core';

type Preset = Pick<ProviderConnection, 'providerId' | 'baseUrl' | 'modelId'> & { name: string; requiresKey: boolean };
const WORKERS_AI = 'cloudflare-workers-ai';
const catalogId = (id: string) => id === 'nvidia' ? 'nvidia-build' : id === 'custom' ? 'custom-openai-compatible' : id;
const origin = (value: string) => { try { return new URL(value).origin; } catch { return null; } };

// Single source of truth: the provider catalog (content/providers/*.json). This table only adds
// the default model ID and the display order, plus the manifest-less `custom` preset.
// OpenAI and Anthropic are deliberately not first-class presets: they surface only as
// ready-made fills of the `custom` endpoint (and Anthropic stays a Claude-native preset).
const PRESET_ORDER = ['openrouter', 'radeon-cloud', 'nvidia', 'google', WORKERS_AI, 'ollama', 'groq', 'cerebras'];
const DEFAULT_MODELS: Record<string, string> = {
  google: 'gemini-2.5-flash',
  openrouter: 'openai/gpt-oss-20b:free',
  nvidia: 'meta/llama-3.3-70b-instruct',
  'radeon-cloud': 'DeepSeek-V4-Flash',
  [WORKERS_AI]: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  groq: 'openai/gpt-oss-20b',
};
const CUSTOM_PRESET: Preset = { providerId: 'custom', name: 'OpenAI-compatible', baseUrl: 'https://', modelId: '', requiresKey: true };
const PRESETS: Preset[] = PRESET_ORDER.flatMap((providerId) => {
  const manifest = bundledProviders.find((p) => p.id === catalogId(providerId));
  if (!manifest) { console.error(`Provider manifest missing for ${catalogId(providerId)}`); return []; }
  return [{ providerId, name: manifest.name, baseUrl: manifest.endpoint?.baseUrl ?? manifest.officialUrl, modelId: DEFAULT_MODELS[providerId] ?? '', requiresKey: manifest.requiresApiKey !== false }];
}).concat([CUSTOM_PRESET]);

const makeConnection = (preset: Preset): ProviderConnection => ({ id: `connection-${crypto.randomUUID()}`, providerId: preset.providerId, name: preset.name, baseUrl: preset.baseUrl, modelId: preset.modelId, hasKey: false });

const costProviders = ['openrouter', 'radeon-cloud', 'nvidia-build'];
const priority = (id: string) => {
  const index = PRESET_ORDER.findIndex(providerId => catalogId(providerId) === id);
  return index < 0 ? PRESET_ORDER.length : index;
};

// Claude connections keep the native Anthropic endpoint (its protocol is what
// Claude Code speaks) alongside the generic presets; the retired providers stay
// retired for Claude too. Anthropic never returns to the general API notebook.
const ANTHROPIC_ONLY: Preset[] = bundledProviders
  .filter(manifest => manifest.id === 'anthropic')
  .map(manifest => ({ providerId: 'anthropic', name: manifest.name, baseUrl: 'https://api.anthropic.com', modelId: '', requiresKey: manifest.requiresApiKey !== false }));
const CLAUDE_PRESETS = PRESETS
  .filter(preset => ['openrouter', 'radeon-cloud', 'custom'].includes(preset.providerId))
  .concat(ANTHROPIC_ONLY);

export const newClaudeConnection = () => makeConnection(CLAUDE_PRESETS[0]!);

type ProviderRow = { id: string; name: string; provider?: ProviderManifest; connections: ProviderConnection[] };

function ModelLookup({ load, onSelect, initial }: {
  load: () => Promise<ModelList | undefined>;
  onSelect?: (model: string) => void;
  initial?: ModelList;
}) {
  const { t, i18n } = useTranslation(['models', 'common']);
  const [result, setResult] = useState<ModelList | undefined>(initial);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [cost, setCost] = useState('all');
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [query, cost, result]);
  const status = (free: boolean | null) => free === true ? 'free' : free === false ? 'paid' : 'unknown';
  const visible = result?.models.filter(model =>
    (cost === 'all' || status(model.free) === cost) &&
    model.id.toLowerCase().includes(query.trim().toLowerCase())) ?? [];

  const refresh = async () => {
    setError(null);
    setBusy(true);
    try {
      const next = await load();
      if (next) setResult(next);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };

  return <div className="min-w-0 space-y-3">
    <Button size="sm" loading={busy} onClick={() => void refresh()}>
      {t(result ? 'models:refreshModels' : 'models:listModels')}
    </Button>
    {error != null && <ErrorNotice error={error} onRetry={() => void refresh()} />}
    {result && <div className="space-y-3 text-sm">
      <p className="text-muted">{t('models:modelsChecked')} <bdi>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(result.checkedAt))}</bdi></p>
      {result.models.length === 0 ? <p role="status">{t('models:noModels')}</p> : <>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block min-w-0 space-y-1">
            <span>{t('models:searchModels')}</span>
            <Input type="search" dir="ltr" value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          <label className="block min-w-0 space-y-1">
            <span>{t('models:filterModelCost')}</span>
            <select className="vh-input w-full" value={cost} onChange={event => setCost(event.target.value)}>
              {(['all', 'free', 'paid', 'unknown'] as const).map(value =>
                <option key={value} value={value}>{t(`models:modelCosts.${value}`)}</option>)}
            </select>
          </label>
        </div>
        <p role="status" className="text-muted">{t('models:modelCount', { shown: visible.length, total: result.models.length })}</p>
        {visible.length ? <ul className="max-h-64 space-y-1 overflow-auto">
          {visible.slice(page * 25, page * 25 + 25).map(model => <li key={model.id} className="flex flex-wrap items-center gap-2">
            <code dir="ltr" className="min-w-0 break-all">{model.id}</code>
            <Badge tone="muted">{t(`models:modelCosts.${status(model.free)}`)}</Badge>
            {onSelect
              ? <Button size="sm" variant="ghost" aria-label={t('models:chooseNamedModel', { model: model.id })} onClick={() => onSelect(model.id)}>{t('models:chooseModel')}</Button>
              : <CopyButton text={model.id} label={t('common:copy')} />}
          </li>)}
        </ul> : <p>{t('models:noMatchingModels')}</p>}
        {visible.length > 25 && <div className="flex gap-2"><Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t("models:previous")}</Button><span>{page + 1} / {Math.ceil(visible.length / 25)}</span><Button size="sm" disabled={(page + 1) * 25 >= visible.length} onClick={() => setPage(page + 1)}>{t("models:next")}</Button></div>}
      </>}
    </div>}
  </div>;
}

export function ConnectionEditor({ connection, existing, otherNames = [], onClose, onSaved, forClaude = false }: { connection: ProviderConnection; existing: boolean; otherNames?: string[]; forClaude?: boolean; onClose: () => void; onSaved: (saved: ProviderConnection[], lookupChanged: boolean) => void }) {
  const { t } = useTranslation(['models', 'connectionsUx', 'common']);
  const id = useId();
  const [draft, setDraft] = useState({ ...connection });
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [lookupRevision, setLookupRevision] = useState(0);
  const [previewReport, setPreviewReport] = useState<ApiTestReport | null>(null);
  const [confirmPreview, setConfirmPreview] = useState(false);
  const resetLookup = () => { setPreviewReport(null); setLookupRevision(revision => revision + 1); };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const presets = forClaude ? CLAUDE_PRESETS : PRESETS;
  const preset = presets.find((p) => p.providerId === draft.providerId);
  const needsWorkersAccountId = draft.providerId === WORKERS_AI && draft.baseUrl.includes('/accounts/ACCOUNT_ID/');
  // The saved vault key still applies while the provider and its host are untouched,
  // so previews and tests can reuse it instead of demanding the key again.
  const hostChanged = draft.providerId !== connection.providerId || origin(draft.baseUrl) !== origin(connection.baseUrl);
  const usingSavedKey = existing && !!connection.hasKey && !hostChanged && !key.trim();
  const duplicateName = draft.name.trim() !== '' && otherNames.includes(draft.name.trim());
  const urlError = () => {
    if (needsWorkersAccountId) return t('models:workersAccountId');
    try {
      const url = new URL(draft.baseUrl.trim());
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) throw new Error();
    } catch {
      return t('connectionsUx:urlInvalid');
    }
  };
  const validate = (validation: Record<string, string>) => {
    setErrors(validation);
    const [first] = Object.keys(validation);
    if (first) requestAnimationFrame(() => document.getElementById(`${id}-${first}`)?.focus());
    return !first;
  };
  const preview = async () => {
    const validation: Record<string, string> = {};
    const url = urlError();
    if (url) validation.url = url;
    if (!usingSavedKey && draft.providerId !== 'custom' && preset?.requiresKey !== false && !key.trim()) validation.key = t('models:previewKeyRequired');
    if (!validate(validation)) return;
    return ipc.providerConnectionPreviewModels(draft.providerId, draft.baseUrl.trim(), key.trim() || undefined);
  };
  const save = async () => {
    if (saving.current) return;
    const validation: Record<string, string> = {};
    if (!draft.name.trim()) validation.name = t('connectionsUx:required');
    if ((forClaude && !draft.modelId.trim()) || /[\u0000-\u001f\u007f]/.test(draft.modelId)) validation.model = t('connectionsUx:modelInvalid');
    const url = urlError();
    if (url) validation.url = url;
    if (!validate(validation)) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      const saved = await ipc.providerConnectionSave({ ...draft, name: draft.name.trim(), baseUrl: draft.baseUrl.trim(), modelId: draft.modelId.trim(), hasKey: preset?.requiresKey === false ? false : draft.hasKey || !!key.trim() }, preset?.requiresKey === false ? undefined : key.trim() || undefined);
      const lookupChanged = draft.providerId !== connection.providerId ||
        draft.baseUrl.trim() !== connection.baseUrl || !!key.trim();
      setKey(''); onSaved(saved, lookupChanged); onClose();
    } catch (cause) { setError(cause); } finally { setBusy(false); saving.current = false; }
  };
  const close = () => { setKey(''); onClose(); };
  const errorProps = (field: string) => ({ 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined });
  const fieldError = (field: string) => errors[field] && <span role="alert" className="block text-sm text-danger" id={`${id}-${field}-error`}>{errors[field]}</span>;
  return <Modal open title={t(existing ? 'models:editConnection' : 'models:newConnection')} onClose={close} busy={busy} footer={<div className="flex justify-end gap-2"><Button disabled={busy} onClick={close}>{t('common:cancel')}</Button><Button type="submit" form={`${id}-form`} variant="primary" loading={busy}><Save size={16} aria-hidden="true" />{t('models:saveConnection')}</Button></div>}>
    <form id={`${id}-form`} onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="space-y-5">
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm"><span className="block font-medium">{t('models:provider')}</span><select className="h-10 w-full rounded-lg border border-border bg-surface px-3" value={draft.providerId} onChange={(e) => { const selected = presets.find((p) => p.providerId === e.target.value)!; resetLookup(); setKey(''); setDraft({ ...draft, providerId: selected.providerId, baseUrl: selected.baseUrl, modelId: forClaude ? selected.modelId : '', name: forClaude && selected.providerId === 'custom' ? '' : selected.name, hasKey: false }); }}>{presets.map((p) => <option key={p.providerId} value={p.providerId}>{forClaude && p.providerId === 'custom' ? t('models:claudeCustomEndpoint') : p.name}{costProviders.includes(catalogId(p.providerId)) ? ` — ${t(`models:providerCost.${catalogId(p.providerId)}`)}` : ''}</option>)}{forClaude && <option disabled value="nvidia">NVIDIA NIM</option>}</select></label>
        {forClaude && <p className="text-sm text-muted sm:col-span-2">{t('models:nvidiaClaudeUnavailable')} <Link className="vh-link" to="/connections/api?provider=nvidia-build">NVIDIA NIM</Link></p>}
        <label className="block space-y-2 text-sm" htmlFor={`${id}-name`}><span className="block font-medium">{t('models:connectionName')}</span><Input id={`${id}-name`} data-autofocus dir="auto" value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} {...errorProps('name')} />{fieldError('name')}{duplicateName && <p role="status" className="text-sm text-warning">{t('models:duplicateNameWarning')}</p>}</label>
        <label className="block space-y-2 text-sm sm:col-span-2" htmlFor={`${id}-url`}><span className="block font-medium">{t('models:baseUrl')}</span><Input id={`${id}-url`} dir="ltr" className="ltr-tech" value={draft.baseUrl} onChange={(e) => { const baseUrl = e.target.value; resetLookup(); const changed = origin(draft.baseUrl) !== origin(baseUrl); if (changed) setKey(''); setDraft({ ...draft, baseUrl, hasKey: changed ? false : draft.hasKey }); }} {...errorProps('url')} />{fieldError('url')}</label>
        {draft.providerId === 'custom' && <div className="flex flex-wrap items-center gap-2 sm:col-span-2 text-sm"><span className="text-muted">{t('models:customPresetsHint')}</span>
          {[{ id: 'anthropic', baseUrl: 'https://api.anthropic.com' }, { id: 'openai', baseUrl: 'https://api.openai.com/v1' }].map(fill => <Button key={fill.id} size="sm" variant="ghost" type="button" onClick={() => setDraft(current => ({ ...current, baseUrl: fill.baseUrl }))}>{fill.id === 'anthropic' ? 'Anthropic' : 'OpenAI'}</Button>)}
        </div>}
        {needsWorkersAccountId && !errors.url && <p className="text-sm text-muted sm:col-span-2">{t('models:workersAccountId')}</p>}
        <label className="block space-y-2 text-sm" htmlFor={`${id}-model`}><span className="block font-medium">{t(forClaude ? 'models:modelId' : 'models:optionalModelId')}</span><Input id={`${id}-model`} dir="ltr" className="ltr-tech" value={draft.modelId} maxLength={256} onChange={(e) => { setPreviewReport(null); setDraft({ ...draft, modelId: e.target.value }); }} {...errorProps('model')} />{fieldError('model')}</label>
        {preset?.requiresKey !== false && <div className="space-y-2 text-sm"><span className="flex items-center gap-2 font-medium" id={`${id}-key-label`}><KeyRound size={16} aria-hidden="true" />{t(existing ? 'models:replaceApiKey' : 'models:apiKey')}</span><span className="relative block"><Input id={`${id}-key`} aria-labelledby={`${id}-key-label`} type={showKey ? 'text' : 'password'} dir="ltr" className="ltr-tech pe-20" autoComplete="new-password" value={key} onChange={(e) => { resetLookup(); setKey(e.target.value); }} {...errorProps('key')} placeholder={existing && draft.hasKey ? t('models:leaveBlankToKeep') : ''} /><Button size="sm" variant="ghost" type="button" className="absolute top-1/2 -translate-y-1/2" style={{ insetInlineEnd: 6 }} aria-label={t(showKey ? 'models:hideKey' : 'models:showKey')} aria-pressed={showKey} onClick={() => setShowKey(value => !value)}>{showKey ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</Button></span>{fieldError('key')}</div>}
      </fieldset>
      {!forClaude && draft.providerId !== WORKERS_AI && <ModelLookup key={lookupRevision} load={usingSavedKey ? () => ipc.providerConnectionModels(connection.id) : preview}
        onSelect={modelId => { setPreviewReport(null); setDraft(current => ({ ...current, modelId })); }} />}
      {!forClaude && usingSavedKey && <p role="status" className="text-sm text-muted">{t('models:savedKeyInUse')}</p>}
      {!forClaude && <div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={!draft.modelId.trim() || busy} title={!draft.modelId.trim() ? t('models:testNeedsModel') : undefined} aria-describedby={!draft.modelId.trim() ? `${id}-test-hint` : undefined} onClick={() => setConfirmPreview(true)}>{t('models:testConnection')}</Button>
        {!draft.modelId.trim() && <span id={`${id}-test-hint`} className="text-sm text-muted">{t('models:testNeedsModel')}</span>}</div>
        {confirmPreview && <div role="alert" className="space-y-2"><p>{t('models:testConsent')}</p><Button size="sm" onClick={() => setConfirmPreview(false)}>{t('common:cancel')}</Button><Button size="sm" variant="primary" loading={busy} onClick={() => void (async () => {
          const validation: Record<string, string> = {}; const url = urlError(); if (url) validation.url = url;
          if (!draft.modelId.trim()) validation.model = t('connectionsUx:modelInvalid');
          if (!usingSavedKey && draft.providerId !== 'custom' && preset?.requiresKey !== false && !key.trim()) validation.key = t('models:previewKeyRequired');
          if (!validate(validation)) return;
          setBusy(true); setError(null); try { setPreviewReport(usingSavedKey ? await ipc.providerConnectionTest(connection.id) : await ipc.providerConnectionPreviewTest({ ...draft, baseUrl: draft.baseUrl.trim(), modelId: draft.modelId.trim() }, key.trim() || undefined)); setConfirmPreview(false); } catch (cause) { setError(cause); } finally { setBusy(false); }
        })()}>{t('common:confirm')}</Button></div>}
        {previewReport && <ConnectionReport report={previewReport} />}</div>}
      <p className="text-sm leading-6 text-muted">{t(preset?.requiresKey === false ? 'connectionsUx:noKeyNeeded' : 'models:apiKeyStoredVault')}</p><p className="text-sm leading-6 text-muted">{t('models:keyScopeChange')}</p>
      {error != null && <ErrorNotice error={error} />}
    </form>
  </Modal>;
}

function ConnectionReport({ report }: { report: ApiTestReport }) {
  const { t } = useTranslation(['models', 'connectionsUx']);
  return <div className="space-y-2 rounded-lg border border-border bg-surface-alt p-4 text-sm" role="status">
    {(['dnsResolved', 'httpResponse', 'authValidated', 'modelResponded'] as const).map((level) => <div key={level} className="flex items-center gap-2"><span aria-hidden="true">{report[level] ? '✓' : '—'}</span><span>{t(`models:testLevels.${level}`)}: {t(level === 'authValidated' && report.authRequired === false ? 'models:authNotRequired' : report[level] ? 'connectionsUx:confirmed' : 'connectionsUx:notConfirmed')}</span></div>)}
    {!report.httpResponse && <p className="leading-6 text-muted">{t('models:proxyTroubleshooting')} <Link className="text-primary underline" to="/connections/proxy">{t('models:openProxySettings')}</Link></p>}
    {report.httpStatus && <p className="ltr-tech text-muted">HTTP {report.httpStatus}</p>}{report.redactedError && <ErrorNotice error={report.redactedError} role="status" />}<p className="leading-6 text-muted">{t('models:redacted')}</p>
  </div>;
}

export function ModelsPage() {
  const { t, i18n } = useTranslation(['models', 'connectionsUx', 'common', 'apps']);
  const { apps, providers } = useCatalog();
  const [params, setParams] = useSearchParams();
  const lang = i18n.language.startsWith('fa') ? 'fa' : 'en';
  const selected = params.get('provider') ?? '';
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState('');
  const [noteEditing, setNoteEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ProviderConnection | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<ProviderConnection | null>(null);
  const [testing, setTesting] = useState<ProviderConnection | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, ModelList>>({});
  const [lookupRevisions, setLookupRevisions] = useState<Record<string, number>>({});
  const [reports, setReports] = useState<Record<string, ApiTestReport>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const operation = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selectProvider = (id: string, button?: HTMLButtonElement) => {
    if (button) trigger.current = button;
    setNoteEditing(false);
    setMessage('');
    setReports({});
    setParams(id ? { provider: id } : {}, { replace: !id });
  };
  const reload = async () => {
    setLoading(true);
    setError(null);
    const [saved, cached, storedNotes] = await Promise.allSettled([ipc.providerConnections(), ipc.providerConnectionCachedModels(), ipc.providerNotes()]);
    if (storedNotes.status === 'fulfilled') setNotes(storedNotes.value); else setError(storedNotes.reason);
    if (saved.status === 'fulfilled') setConnections(saved.value);
    else setError(saved.reason);
    if (cached.status === 'fulfilled') setSnapshots(cached.value);
    else if (saved.status === 'fulfilled') setError(cached.reason);
    setLoading(false);
  };
  useEffect(() => { void reload(); }, []);
  // One place builds the provider rows: catalog providers first, then rows that only
  // exist because of a saved connection or a note.
  const rows = useMemo(() => {
    const map = new Map<string, ProviderRow>();
    for (const provider of providers) {
      // Anthropic and OpenAI manifests back the custom fills and the Claude presets;
      // they are not catalogue rows of their own any more.
      if (provider.id === 'custom-openai-compatible' || provider.id === 'anthropic' || provider.id === 'openai') continue;
      map.set(provider.id, { id: provider.id, name: provider.name, provider, connections: [] });
    }
    for (const connection of connections) {
      const id = connection.providerId === 'custom' ? `custom:${connection.baseUrl.replace(/\/$/, '')}` : catalogId(connection.providerId);
      let row = map.get(id);
      if (!row) { row = { id, name: id.startsWith('custom:') ? id.slice(7) : connection.name, connections: [] }; map.set(id, row); }
      row.connections.push(connection);
    }
    for (const id of Object.keys(notes)) if (!map.has(id)) map.set(id, { id, name: id.startsWith('custom:') ? id.slice(7) : id, connections: [] });
    return Array.from(map.values()).sort((a, b) =>
      priority(a.id) - priority(b.id) ||
      Number(b.connections.length > 0) - Number(a.connections.length > 0) ||
      a.name.localeCompare(b.name));
  }, [providers, connections, notes]);
  const row = rows.find(item => item.id === selected);
  const provider = row?.provider;
  const preset = row ? PRESETS.find(item => catalogId(item.providerId) === row.id) : undefined;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const detailId = useId();
  useEffect(() => {
    if (!row || loading) return;
    const frame = requestAnimationFrame(() => headingRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [row?.id, loading]);

  const startNew = (providerId?: string) => { setEditing(false); setError(null); setDraft({ ...makeConnection(PRESETS.find((p) => p.providerId === providerId) ?? PRESETS.find((p) => p.providerId === 'custom')!), modelId: '' }); };
  const act = async (fn: () => Promise<void>) => { if (operation.current) return; operation.current = true; setBusy(true); setError(null); setMessage(''); try { await fn(); } catch (cause) { setError(cause); } finally { operation.current = false; setBusy(false); } };
  const savedRows = rows.filter(item => item.connections.length > 0 || Boolean(notes[item.id]));
  const suggested = rows.filter(item => item.provider && PRESETS.some(preset => catalogId(preset.providerId) === item.id));
  return <div className="mx-auto w-full max-w-[1200px] space-y-8">
    <PageHeader title={t('models:title')} titleAside={<Tooltip text={t('models:noAutomaticInjection')} />}
      actions={<Button onClick={() => startNew()}><Plus size={16} aria-hidden="true" />{t('models:tryCustom')}</Button>} />
    {error != null && !deleting && !testing && <ErrorNotice error={error} onRetry={() => void reload()} />}
    {message && <p role="status" className="text-sm text-success">{message}</p>}
    {loading ? <p role="status">{t('common:loading')}</p> : <>
      <section className="space-y-3" aria-labelledby="saved-connections-title" data-testid="saved-connections">
        <h2 id="saved-connections-title" className="font-bold">{t('models:savedConnections')}</h2>
        {savedRows.length ? <ul className="model-notebook-grid">
          {savedRows.flatMap(item => {
            const entries = item.connections.length ? item.connections : [null];
            return entries.map(connection => <li key={connection?.id ?? item.id}>
              <button type="button" className="model-notebook-tile" data-testid={connection ? `connection-tile-${connection.id}` : undefined}
                onClick={event => selectProvider(item.id, event.currentTarget)}>
                <ProviderLogo id={item.provider?.logo ?? item.id} name={item.name} />
                <span className="model-notebook-copy">
                  <span className="model-notebook-name" dir="auto">{connection?.name ?? item.name}</span>
                  {connection?.modelId
                    ? <code dir="ltr" className="model-notebook-model">{connection.modelId}</code>
                    : <span className="text-xs text-muted">{t(connection ? 'models:noModelSelected' : 'models:note')}</span>}
                </span>
              </button>
            </li>);
          })}
        </ul> : <p className="text-sm text-muted">{t('models:noConnections')}</p>}
      </section>
      <section className="space-y-3" aria-labelledby="suggested-providers-title">
        <h2 id="suggested-providers-title" className="font-bold">{t('models:suggestedProviders')}</h2>
        <ul className="model-workspace-list" data-testid="provider-list">
          {suggested.map(item => <li key={item.id}>
            <button type="button" className="model-provider-row" aria-pressed={item.id === selected}
              data-testid={`provider-${item.id}`} onClick={event => selectProvider(item.id, event.currentTarget)}>
              <ProviderLogo id={item.provider?.logo ?? item.id} name={item.name} />
              <span className="model-provider-body">
                <bdi className="model-provider-name">{item.name}</bdi>
                <span className="model-provider-meta">{costProviders.includes(item.id)
                  ? t(`models:providerCost.${item.id}`)
                  : t(item.id === 'ollama' ? 'models:filters.local' : item.id === 'cerebras' ? 'models:startingCredit' : `ux:${item.provider!.freeAccess}`)}</span>
              </span>
            </button>
          </li>)}
        </ul>
      </section>
      {row && <section className="model-workspace-detail space-y-5" aria-labelledby={detailId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="model-detail-head">
            <ProviderLogo id={provider?.logo ?? row.id} name={row.name} />
            <h2 id={detailId} ref={headingRef} tabIndex={-1} className="text-lg font-bold" dir="auto">{row.name}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { selectProvider(''); trigger.current?.focus(); }}>{t('common:close')}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {preset && <Button variant="primary" size="sm" onClick={() => startNew(preset.providerId)}><Plus size={16} aria-hidden="true" />{t('models:addConnection')}</Button>}
          {provider && <>
            <Button size="sm" onClick={() => void act(async () => { await openUrl(provider.keyUrl ?? provider.officialUrl); })}>
              <ExternalLink size={15} aria-hidden="true" />{t(provider.requiresApiKey ? 'models:openKeyPortal' : 'models:openProvider')}
            </Button>
            <Tooltip text={provider.notes[lang]} />
          </>}
        </div>
            <section className="space-y-2"><h3 className="font-bold">{t('models:note')}</h3>{noteEditing ? <><textarea aria-label={t('models:note')} className="vh-input w-full" rows={4} dir="auto" value={noteDraft} onChange={event => setNoteDraft(event.target.value)} /><div className="flex gap-2"><Button size="sm" onClick={() => setNoteEditing(false)}>{t('common:cancel')}</Button><Button size="sm" variant="primary" loading={busy} onClick={() => void act(async () => { setNotes(await ipc.providerNoteSave(row.id, noteDraft)); setNoteEditing(false); })}>{t('common:save')}</Button></div></> : <><p className="whitespace-pre-wrap" dir="auto">{notes[row.id] || t('models:noNote')}</p><Button size="sm" onClick={() => { setNoteDraft(notes[row.id] ?? ''); setNoteEditing(true); }}>{t('common:edit')}</Button></>}</section>
            {row.connections.length > 0 && <section className="space-y-3"><h3 className="font-bold">{t('models:savedConnections')}</h3><div className="vh-record-list">{row.connections.map((connection) => {
        const preset = PRESETS.find((p) => p.providerId === connection.providerId); const provider = providers.find((p) => p.id === catalogId(connection.providerId));
        const officialModelList = connection.providerId === WORKERS_AI ? provider?.modelsDocUrl : undefined;
        const compatibility = provider ? apps.flatMap((app) => { const status = provider.supportedApps[app.id]; return status && status !== 'unknown' ? [{ app, status }] : []; }) : [];
        return <Card key={connection.id} className="space-y-4" data-testid={`connection-${connection.id}`}>
          <div className="flex flex-wrap items-start gap-4"><div className="min-w-0 flex-1"><h3 className="break-words text-base font-bold" dir="auto">{connection.name}</h3><p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">{connection.modelId && <code dir="ltr" className="break-all">{connection.modelId}</code>}<span aria-hidden="true">·</span><span dir="ltr">{origin(connection.baseUrl)}</span></p><div className="mt-2 flex flex-wrap gap-2"><Badge tone="muted">{preset?.name ?? connection.providerId}</Badge><Badge tone={preset?.requiresKey === false || connection.hasKey ? 'success' : 'warning'}>{t(preset?.requiresKey === false ? 'connectionsUx:noKeyNeeded' : connection.hasKey ? 'models:keyStored' : 'models:keyMissing')}</Badge></div></div><div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !connection.modelId.trim()} title={!connection.modelId.trim() ? t('models:testNeedsModel') : undefined} onClick={() => { setError(null); setTesting(connection); }}><Zap size={16} aria-hidden="true" />{t('models:testConnection')}</Button><Button size="sm" onClick={() => { setEditing(true); setDraft({ ...connection }); }}>{t('common:edit')}</Button><Button size="sm" variant="danger" aria-label={t('connectionsUx:deleteConnectionNamed', { name: connection.name })} onClick={() => { setError(null); setDeleting(connection); }}><Trash2 size={16} aria-hidden="true" />{t('common:delete')}</Button></div></div>
          {officialModelList ? (
            <Button size="sm" disabled={busy} onClick={() => void act(async () => { await openUrl(officialModelList); })}>
              <ExternalLink size={15} aria-hidden="true" />{t('models:openOfficialModels')}
            </Button>
          ) : connection.providerId !== WORKERS_AI && (
            <ModelLookup key={lookupRevisions[connection.id] ?? 0} initial={snapshots[connection.id]} load={() => ipc.providerConnectionModels(connection.id)} />
          )}
          <Disclosure title={t('ux:details')} className="vh-inline-disclosure">
          <div className="grid gap-3 sm:grid-cols-2"><div className="min-w-0"><div className="text-sm text-muted">{t('models:baseUrl')}</div><div className="mt-1 flex items-start gap-2"><code dir="ltr" className="min-w-0 flex-1 break-all text-sm">{connection.baseUrl}</code><CopyButton text={connection.baseUrl} label={t('common:copy')} /></div></div><div className="min-w-0"><div className="text-sm text-muted">{t('models:modelId')}</div><div className="mt-1 flex items-start gap-2">{connection.modelId ? <><code dir="ltr" className="min-w-0 flex-1 break-all text-sm">{connection.modelId}</code><CopyButton text={connection.modelId} label={t('common:copy')} /></> : <span className="text-sm text-muted">{t('models:noModelSelected')}</span>}</div></div></div>
          {connection.modelId && <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">{t('models:whereToUse')}</summary><p className="mt-3 text-sm leading-7 text-muted">{t('models:manualSetup', { provider: preset?.name ?? connection.providerId, model: connection.modelId })}</p><ul className="mt-3 space-y-2 text-sm">{compatibility.length ? compatibility.map(({ app, status }) => <li key={app.id}><Link className="text-primary underline underline-offset-4" to={`/app/${app.id}`}>{app.name}</Link> — {t(`models:compatibilityStatus.${status}`)}</li>) : <li className="text-muted">{t('models:noVerifiedTools')}</li>}</ul></details>}
          </Disclosure>
          {reports[connection.id] && <ConnectionReport report={reports[connection.id]!} />}
        </Card>;
      })}</div></section>}
      </section>}
    </>}
    {draft && <ConnectionEditor key={draft.id} connection={draft} existing={editing} otherNames={connections.filter(item => item.id !== draft.id).map(item => item.name.trim())} onClose={() => setDraft(null)} onSaved={(saved, lookupChanged) => {
      setConnections(saved);
      const savedConnection = saved.find(item => item.id === draft.id);
      if (savedConnection) selectProvider(savedConnection.providerId === 'custom' ? `custom:${savedConnection.baseUrl.replace(/\/$/, '')}` : catalogId(savedConnection.providerId));
      if (lookupChanged) {
        setSnapshots(({ [draft.id]: _, ...remaining }) => remaining);
        setLookupRevisions(current => ({ ...current, [draft.id]: (current[draft.id] ?? 0) + 1 }));
      }
      setReports({});
      setMessage(t('connectionsUx:connectionSaved'));
    }} />}
    <Modal open={!!deleting} title={t('connectionsUx:deleteConnection')} onClose={() => setDeleting(null)} busy={busy}><p className="text-sm leading-7">{t('connectionsUx:deleteConnectionHint', { name: deleting?.name })}</p>{error != null && <ErrorNotice error={error} />}<div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={() => setDeleting(null)}>{t('common:cancel')}</Button><Button variant="danger" loading={busy} onClick={() => void act(async () => { if (!deleting) return; setConnections(await ipc.providerConnectionDelete(deleting.id)); setReports((current) => { const next = { ...current }; delete next[deleting.id]; return next; }); setDeleting(null); setMessage(t('connectionsUx:connectionDeleted')); })}>{t('common:delete')}</Button></div></Modal>
    <Modal open={!!testing} title={t('models:testConnection')} onClose={() => setTesting(null)} busy={busy}><p className="text-sm leading-7">{t('models:testConsent')}</p>{error != null && <ErrorNotice error={error} />}<div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={() => setTesting(null)}>{t('common:cancel')}</Button><Button variant="primary" loading={busy} onClick={() => void act(async () => { if (!testing) return; const report = await ipc.providerConnectionTest(testing.id); setReports((current) => ({ ...current, [testing.id]: report })); setTesting(null); })}>{t('common:confirm')}</Button></div></Modal>
  </div>;
}
