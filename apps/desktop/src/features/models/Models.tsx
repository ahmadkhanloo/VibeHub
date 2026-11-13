import { Disclosure } from '@/components/Disclosure';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, Eye, EyeOff, KeyRound, Plus, Save, Search, StickyNote, Trash2, Zap } from 'lucide-react';
import { Badge, Button, Card, CopyButton, EmptyState, ErrorNotice, Input, Modal, PageHeader } from '@/components/ui';
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
const PRESET_ORDER = ['openai', 'anthropic', 'google', 'deepseek', 'mistral', 'openrouter', 'nvidia', 'radeon-cloud', 'apinex', WORKERS_AI, 'groq', 'ollama'];
const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-5-20250929',
  google: 'gemini-2.5-flash',
  deepseek: 'deepseek-flash',
  mistral: 'mistral-small-latest',
  openrouter: 'openai/gpt-oss-20b:free',
  nvidia: 'meta/llama-3.3-70b-instruct',
  'radeon-cloud': 'DeepSeek-V4-Flash',
  apinex: 'free/jev-1.13',
  [WORKERS_AI]: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  groq: 'openai/gpt-oss-20b',
  ollama: 'qwen2.5-coder:7b',
};
const CUSTOM_PRESET: Preset = { providerId: 'custom', name: 'OpenAI-compatible', baseUrl: 'https://', modelId: '', requiresKey: true };
const PRESETS: Preset[] = PRESET_ORDER.flatMap((providerId) => {
  const manifest = bundledProviders.find((p) => p.id === catalogId(providerId));
  if (!manifest) { console.error(`Provider manifest missing for ${catalogId(providerId)}`); return []; }
  return [{ providerId, name: manifest.name, baseUrl: manifest.endpoint?.baseUrl ?? manifest.officialUrl, modelId: DEFAULT_MODELS[providerId] ?? '', requiresKey: manifest.requiresApiKey !== false }];
}).concat([CUSTOM_PRESET]);

const makeConnection = (preset: Preset): ProviderConnection => ({ id: `connection-${crypto.randomUUID()}`, providerId: preset.providerId, name: preset.name, baseUrl: preset.baseUrl, modelId: preset.modelId, hasKey: false });

const costProviders = ['openrouter', 'radeon-cloud', 'nvidia-build', 'anthropic'];
const priority = (id: string) => { const index = ['openrouter', 'radeon-cloud', 'nvidia-build'].indexOf(id); return index < 0 ? 3 : index; };
PRESETS.sort((a, b) => priority(catalogId(a.providerId)) - priority(catalogId(b.providerId)));

const CLAUDE_PRESETS = PRESETS
  .filter(preset => ['openrouter', 'anthropic', 'radeon-cloud', 'custom'].includes(preset.providerId))
  .map(preset => {
    if (preset.providerId === 'anthropic') return { ...preset, baseUrl: 'https://api.anthropic.com', modelId: '' };

    return preset;
  });

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
  // View state lives in the URL so browser Back keeps working and deep links stay honest.
  const filterParam = params.get('filter');
  const filter = filterParam === 'saved' || filterParam === 'notes' ? filterParam : 'all';
  const search = params.get('q') ?? '';
  const pageParam = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam - 1 : 0;
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
  const updateParams = (mutate: (next: URLSearchParams) => void, replace = true) => {
    const next = new URLSearchParams(params);
    mutate(next);
    setParams(next, { replace });
  };
  const selectProvider = (id: string) => {
    setNoteEditing(false);
    setMessage('');
    setReports({});
    updateParams(next => { if (id) next.set('provider', id); else next.delete('provider'); }, false);
  };
  const changeFilter = (value: 'all' | 'saved' | 'notes') => {
    setNoteEditing(false);
    setMessage('');
    setReports({});
    updateParams(next => { next.set('filter', value); next.delete('provider'); next.delete('page'); });
  };
  const changeSearch = (value: string) => updateParams(next => { if (value) next.set('q', value); else next.delete('q'); next.delete('page'); });
  const changePage = (value: number) => updateParams(next => { if (value > 0) next.set('page', String(value + 1)); else next.delete('page'); });
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
      if (provider.id === 'custom-openai-compatible') continue;
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
  const visible = useMemo(() => rows.filter(row =>
    (filter === 'all' || (filter === 'saved' ? row.connections.length > 0 : !!notes[row.id])) &&
    [row.name, ...row.connections.flatMap(c => [c.name, c.baseUrl, c.modelId]), notes[row.id] ?? ''].join(' ').toLowerCase().includes(search.trim().toLowerCase())
  ), [rows, filter, search, notes]);
  const row = rows.find(item => item.id === selected);
  const provider = row?.provider;
  const preset = row ? PRESETS.find(item => catalogId(item.providerId) === row.id) : undefined;
  // Landing on ?provider=x should show the page that contains that provider.
  useEffect(() => {
    if (!selected || loading || page !== 0) return;
    const index = visible.findIndex(item => item.id === selected);
    if (index >= 10) changePage(Math.floor(index / 10));
    // `page` is read but not depended on: an explicit page in the URL wins over the deep link.
  }, [selected, visible, loading]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  const scrollMemory = useRef(0);
  const lastSelected = useRef('');
  const mounted = useRef(false);
  const skipHeadingFocus = useRef(false);
  // Move focus and scroll along with panel switches instead of dropping both on BODY.
  useEffect(() => {
    const previous = lastSelected.current;
    lastSelected.current = selected;
    const firstRun = !mounted.current;
    mounted.current = true;
    if (previous === selected) return;
    const keepTileFocus = skipHeadingFocus.current;
    skipHeadingFocus.current = false;
    const main = document.querySelector('.vh-main');
    if (!selected) {
      const tile = tileRefs.current.get(previous);
      if (previous && tile) tile.focus({ preventScroll: true });
      if (main && scrollMemory.current) { main.scrollTop = scrollMemory.current; scrollMemory.current = 0; }
      return;
    }
    if (previous === '') {
      if (main) { scrollMemory.current = main.scrollTop; if (window.matchMedia('(max-width: 960px)').matches) main.scrollTo({ top: 0 }); }
      if (!firstRun && !keepTileFocus) headingRef.current?.focus({ preventScroll: true });
    } else if (!keepTileFocus) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);
  const startNew = (providerId?: string) => { setEditing(false); setError(null); setDraft({ ...makeConnection(PRESETS.find((p) => p.providerId === providerId) ?? PRESETS.find((p) => p.providerId === 'custom')!), modelId: '' }); };
  const act = async (fn: () => Promise<void>) => { if (operation.current) return; operation.current = true; setBusy(true); setError(null); setMessage(''); try { await fn(); } catch (cause) { setError(cause); } finally { operation.current = false; setBusy(false); } };
  const paged = visible.slice(page * 10, page * 10 + 10);
  const detailId = useId();
  const listKeyDown = (event: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const rtl = document.documentElement.dir === 'rtl';
    const current = paged.findIndex(item => item.id === selected);
    let next = current;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = paged.length - 1;
    else if (event.key === 'ArrowDown') next = Math.min(current + 1, paged.length - 1);
    else if (event.key === 'ArrowUp') next = Math.max(current - 1, 0);
    else if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next = Math.min(current + 1, paged.length - 1);
    else if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) next = Math.max(current - 1, 0);
    event.preventDefault();
    const target = paged[Math.max(next, 0)];
    if (!target || target.id === selected) return;
    // Selection follows focus inside the listbox: keep the focus on the option row.
    skipHeadingFocus.current = true;
    selectProvider(target.id);
    tileRefs.current.get(target.id)?.focus({ preventScroll: true });
  };
  return <div className="mx-auto w-full max-w-[1200px] space-y-8">
    <PageHeader title={t('models:title')} actions={<Button variant="primary" onClick={() => startNew()}><Plus size={16} aria-hidden="true" />{t('models:tryCustom')}</Button>} />
    <p className="max-w-[70ch] text-sm leading-7 text-muted">{t('models:connectionIntro')}</p>
    {error != null && !deleting && !testing && <ErrorNotice error={error} onRetry={() => void reload()} />}{message && <p role="status" className="text-sm text-success">{message}</p>}
    <div className="space-y-4">
      <div className="model-toolbar">
        <div className="model-search">
          <Search size={16} aria-hidden="true" />
          <Input type="search" aria-label={t('models:searchProviders')} placeholder={t('models:searchProviders')} value={search} onChange={event => changeSearch(event.target.value)} />
        </div>
        <div className="vh-choice-group model-filter-group" role="group" aria-label={t('models:filterLabel')}>{(['all', 'saved', 'notes'] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => changeFilter(value)}>{t(`models:views.${value}`)}</button>)}</div>
      </div>
      {!loading && <p role="status" className="text-sm text-muted">{t('models:resultsCount', { count: visible.length })}</p>}
      {loading ? <p role="status">{t('common:loading')}</p> : <div className="model-workspace" data-selected={!!row}>
          <div className="model-workspace-side min-w-0">
          <ul className="model-workspace-list" role="listbox" aria-label={t('models:providerCatalog')} aria-orientation="vertical" onKeyDown={listKeyDown} data-testid="provider-list">
            {visible.length === 0 && (() => {
              if (filter === 'saved' && connections.length === 0) return <li role="presentation" className="col-span-full"><EmptyState icon={<KeyRound size={22} aria-hidden="true" />} title={t('models:noConnections')} sub={t('connectionsUx:connectionEmptyHint')} action={<Button variant="primary" onClick={() => startNew()}>{t('models:addConnection')}</Button>} /></li>;
              if (filter === 'notes' && Object.keys(notes).length === 0) return <li role="presentation" className="col-span-full"><EmptyState icon={<StickyNote size={22} aria-hidden="true" />} title={t('models:noNotesYet')} sub={t('models:noNotesHint')} /></li>;
              return <li role="presentation" className="col-span-full"><p role="status">{t('models:noResults')}</p></li>;
            })()}
            {paged.map(item => <li key={item.id} role="presentation" className="space-y-2"><button type="button" ref={element => { if (element) tileRefs.current.set(item.id, element); else tileRefs.current.delete(item.id); }} role="option" aria-selected={selected === item.id} tabIndex={selected === item.id || (!selected && paged[0]?.id === item.id) ? 0 : -1} className="model-provider-row" onClick={() => selectProvider(item.id)} data-testid={`provider-${item.id}`}><ProviderLogo id={item.provider?.logo ?? item.provider?.id ?? (item.id.startsWith("custom:") ? "custom-openai-compatible" : item.id)} name={item.name} /><span className="model-provider-body"><span className="model-provider-name">{item.name}</span><span className="model-provider-meta">{costProviders.includes(item.id) && <span>{t(`models:providerCost.${item.id}`)}</span>}{item.connections.length > 0 && <Badge tone="success">{t('models:connectionsCount', { count: item.connections.length })}</Badge>}{notes[item.id] && <Badge tone="muted">{t('models:note')}</Badge>}</span></span></button>{filter === 'notes' && <div className="rounded-lg border border-border bg-surface p-3 space-y-2">{noteEditing && selected === item.id ? <><textarea aria-label={t('models:note')} className="vh-input w-full" rows={3} dir="auto" value={noteDraft} onChange={event => setNoteDraft(event.target.value)} /><div className="flex gap-2"><Button size="sm" onClick={() => setNoteEditing(false)}>{t('common:cancel')}</Button><Button size="sm" variant="primary" loading={busy} onClick={() => void act(async () => { setNotes(await ipc.providerNoteSave(item.id, noteDraft)); setNoteEditing(false); })}>{t('common:save')}</Button></div></> : <><p className="whitespace-pre-wrap break-words" dir="auto">{notes[item.id]}</p><Button size="sm" onClick={() => { selectProvider(item.id); setNoteDraft(notes[item.id] ?? ''); setNoteEditing(true); }}>{t('common:edit')}</Button></>}</div>}</li>)}
          </ul>
          {visible.length > 10 && <nav className="mt-3 flex items-center gap-2" aria-label={t('models:paginationLabel')}><Button size="sm" disabled={page === 0} onClick={() => changePage(page - 1)}>{t('models:previous')}</Button><span>{page + 1} / {Math.ceil(visible.length / 10)}</span><Button size="sm" disabled={(page + 1) * 10 >= visible.length} onClick={() => changePage(page + 1)}>{t('models:next')}</Button></nav>}
          </div>
          <div className="model-workspace-detail" role="region" aria-labelledby={detailId}>{row ? <div className="space-y-5"><Button className="model-back" size="sm" onClick={() => selectProvider('')}>{t('models:backToList')}</Button><div className="model-detail-head"><ProviderLogo id={provider?.logo ?? provider?.id ?? (row.id.startsWith("custom:") ? "custom-openai-compatible" : row.id)} name={row.name} /><h2 id={detailId} ref={headingRef} tabIndex={-1} className="text-lg font-bold" dir="auto">{row.name}</h2></div>
            {provider && <div className="space-y-3"><p className="text-sm text-muted">{provider.notes[lang]}</p>{preset && <p><span>{t('models:suggestedAddress')}: </span><code dir="ltr" className="break-all">{preset.baseUrl}</code></p>}<div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void act(async () => { await openUrl(provider.keyUrl ?? provider.officialUrl); })}><ExternalLink size={15} />{t(provider.requiresApiKey ? 'models:openKeyPortal' : 'models:openProvider')}</Button>{preset && <Button size="sm" onClick={() => startNew(preset.providerId)}>{t('models:addConnection')}</Button>}<Button size="sm" onClick={() => void act(async () => { await openUrl(provider.modelsDocUrl ?? provider.officialUrl); })}>{t('models:officialUrl')}</Button><Button size="sm" onClick={() => void act(async () => { await openUrl(provider.usageTermsUrl); })}>{t('models:terms')}</Button></div><p className="text-sm text-muted">{provider.gettingStarted?.[lang]}</p><p className="text-sm text-muted">{t('models:compatibility')}: {Object.entries(provider.supportedApps).filter(([,status]) => status === 'verified').map(([id]) => apps.find(app => app.id === id)?.name ?? id).join(', ') || t('models:noVerifiedTools')}</p></div>}
            {!provider && preset && <div className="space-y-3"><p><span>{t('models:suggestedAddress')}: </span><code dir="ltr" className="break-all">{preset.baseUrl}</code></p><Button size="sm" onClick={() => startNew(preset.providerId)}>{t('models:addConnection')}</Button></div>}
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
          </div> : visible.length > 0 ? <p className="text-muted">{t('models:selectProvider')}</p> : null}</div>
        </div>}
    </div>
    <Disclosure title={t('ux:help')}><p className="text-sm text-muted">{t('models:noAutomaticInjection')}</p></Disclosure>
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
