import { Disclosure } from '@/components/Disclosure';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, KeyRound, Plus, Save, Trash2, Zap } from 'lucide-react';
import { Badge, Button, Card, CopyButton, ErrorNotice, Input, Modal, PageHeader } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { ProviderLogo } from '@/components/ProviderLogo';
import { ipc, type ApiTestReport, type ModelList, type ProviderConnection } from '@/services/ipc';
import { openUrl } from '@tauri-apps/plugin-opener';

type Preset = Pick<ProviderConnection, 'providerId' | 'baseUrl' | 'modelId'> & { name: string; requiresKey: boolean };
const WORKERS_AI = 'cloudflare-workers-ai';
const PRESETS: Preset[] = [
  { providerId: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-4o-mini', requiresKey: true },
  { providerId: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', modelId: 'claude-sonnet-4-5-20250929', requiresKey: true },
  { providerId: 'google', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', modelId: 'gemini-2.5-flash', requiresKey: true },
  { providerId: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', modelId: 'deepseek-flash', requiresKey: true },
  { providerId: 'mistral', name: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', modelId: 'mistral-small-latest', requiresKey: true },
  { providerId: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', modelId: 'openai/gpt-oss-20b:free', requiresKey: true },
  { providerId: 'nvidia', name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1', modelId: 'meta/llama-3.3-70b-instruct', requiresKey: true },
  { providerId: 'radeon-cloud', name: 'Radeon Cloud', baseUrl: 'https://developer.amd.com.cn/radeon/api/v1', modelId: 'DeepSeek-V4-Flash', requiresKey: true },
  { providerId: 'inferx', name: 'InferX', baseUrl: 'https://model.inferx.net/v1', modelId: 'Qwen/Qwen3.6-35B-A3B', requiresKey: true },
  { providerId: 'kira-ai', name: 'Kira AI', baseUrl: 'https://kiraai.vn/api/v1', modelId: 'minimax-m3-free', requiresKey: true },
  { providerId: 'clean-apis', name: 'Clean APIs', baseUrl: 'https://www.cleanapis.com/v1', modelId: 'claude-opus-4.8', requiresKey: true },
  { providerId: 'orcarouter', name: 'OrcaRouter', baseUrl: 'https://api.orcarouter.ai/v1', modelId: 'deepseek/deepseek-v4-flash-free', requiresKey: true },
  { providerId: 'apinex', name: 'APInex', baseUrl: 'https://api.apinex.bond/v1', modelId: 'free/jev-1.13', requiresKey: true },
  { providerId: WORKERS_AI, name: 'Cloudflare Workers AI', baseUrl: 'https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1', modelId: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', requiresKey: true },
  { providerId: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', modelId: 'openai/gpt-oss-20b', requiresKey: true },
  { providerId: 'ollama', name: 'Ollama', baseUrl: 'http://127.0.0.1:11434/v1', modelId: 'qwen2.5-coder:7b', requiresKey: false },
  { providerId: 'custom', name: 'OpenAI-compatible', baseUrl: 'https://', modelId: '', requiresKey: true },
];
const catalogId = (id: string) => id === 'nvidia' ? 'nvidia-build' : id === 'custom' ? 'custom-openai-compatible' : id;
const origin = (value: string) => { try { return new URL(value).origin; } catch { return null; } };
const makeConnection = (preset: Preset): ProviderConnection => ({ id: `connection-${crypto.randomUUID()}`, providerId: preset.providerId, name: preset.name, baseUrl: preset.baseUrl, modelId: preset.modelId, hasKey: false });

const CLAUDE_PRESETS = PRESETS
  .filter(preset => ['anthropic', 'radeon-cloud', 'custom'].includes(preset.providerId))
  .map(preset => {
    if (preset.providerId === 'anthropic') return { ...preset, baseUrl: 'https://api.anthropic.com', modelId: '' };
    if (preset.providerId === 'radeon-cloud') return { ...preset, baseUrl: 'https://developer.amd.com.cn/radeon/api' };
    return preset;
  });

export const newClaudeConnection = () => makeConnection(CLAUDE_PRESETS[0]!);

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
      <p className="text-muted">{t('models:modelsChecked')} <bdi>{new Date(result.checkedAt).toLocaleString(i18n.language)}</bdi></p>
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

export function ConnectionEditor({ connection, existing, onClose, onSaved, forClaude = false }: { connection: ProviderConnection; existing: boolean; forClaude?: boolean; onClose: () => void; onSaved: (saved: ProviderConnection[], lookupChanged: boolean) => void }) {
  const { t } = useTranslation(['models', 'connectionsUx', 'common']);
  const id = useId();
  const [draft, setDraft] = useState({ ...connection });
  const [key, setKey] = useState('');
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
    if (draft.providerId !== 'custom' && preset?.requiresKey !== false && !key.trim()) validation.key = t('models:previewKeyRequired');
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
  return <Modal open title={t(existing ? 'models:editConnection' : 'models:newConnection')} onClose={close} busy={busy}>
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="space-y-5">
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm"><span className="block font-medium">{t('models:provider')}</span><select className="h-10 w-full rounded-lg border border-border bg-surface px-3" value={draft.providerId} onChange={(e) => { const selected = presets.find((p) => p.providerId === e.target.value)!; resetLookup(); setKey(''); setDraft({ ...draft, providerId: selected.providerId, baseUrl: selected.baseUrl, modelId: forClaude ? selected.modelId : '', name: forClaude && selected.providerId === 'custom' ? '' : selected.name, hasKey: false }); }}>{presets.map((p) => <option key={p.providerId} value={p.providerId}>{forClaude && p.providerId === 'custom' ? t('models:claudeCustomEndpoint') : p.name}</option>)}</select></label>
        <label className="block space-y-2 text-sm" htmlFor={`${id}-name`}><span className="block font-medium">{t('models:connectionName')}</span><Input id={`${id}-name`} data-autofocus dir="auto" value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} {...errorProps('name')} />{fieldError('name')}</label>
        <label className="block space-y-2 text-sm sm:col-span-2" htmlFor={`${id}-url`}><span className="block font-medium">{t('models:baseUrl')}</span><Input id={`${id}-url`} dir="ltr" className="ltr-tech" value={draft.baseUrl} onChange={(e) => { const baseUrl = e.target.value; resetLookup(); const changed = origin(draft.baseUrl) !== origin(baseUrl); if (changed) setKey(''); setDraft({ ...draft, baseUrl, hasKey: changed ? false : draft.hasKey }); }} {...errorProps('url')} />{fieldError('url')}</label>
        {needsWorkersAccountId && !errors.url && <p className="text-sm text-muted sm:col-span-2">{t('models:workersAccountId')}</p>}
        <label className="block space-y-2 text-sm" htmlFor={`${id}-model`}><span className="block font-medium">{t(forClaude ? 'models:modelId' : 'models:optionalModelId')}</span><Input id={`${id}-model`} dir="ltr" className="ltr-tech" value={draft.modelId} maxLength={256} onChange={(e) => { setPreviewReport(null); setDraft({ ...draft, modelId: e.target.value }); }} {...errorProps('model')} />{fieldError('model')}</label>
        {preset?.requiresKey !== false && <label className="block space-y-2 text-sm" htmlFor={`${id}-key`}><span className="flex items-center gap-2 font-medium"><KeyRound size={16} aria-hidden="true" />{t(existing ? 'models:replaceApiKey' : 'models:apiKey')}</span><Input id={`${id}-key`} type="password" dir="ltr" autoComplete="new-password" value={key} onChange={(e) => { resetLookup(); setKey(e.target.value); }} {...errorProps('key')} placeholder={existing && draft.hasKey ? t('models:leaveBlankToKeep') : ''} />{fieldError('key')}</label>}
      </fieldset>
      {!forClaude && draft.providerId !== WORKERS_AI && <ModelLookup key={lookupRevision} load={preview}
        onSelect={modelId => { setPreviewReport(null); setDraft(current => ({ ...current, modelId })); }} />}
      {!forClaude && <div className="space-y-2"><Button size="sm" disabled={!draft.modelId.trim() || busy} onClick={() => setConfirmPreview(true)}>{t('models:testConnection')}</Button>
        {confirmPreview && <div role="alert" className="space-y-2"><p>{t('models:testConsent')}</p><Button size="sm" onClick={() => setConfirmPreview(false)}>{t('common:cancel')}</Button><Button size="sm" variant="primary" loading={busy} onClick={() => void (async () => {
          const validation: Record<string, string> = {}; const url = urlError(); if (url) validation.url = url;
          if (!draft.modelId.trim()) validation.model = t('connectionsUx:modelInvalid');
          if (draft.providerId !== 'custom' && preset?.requiresKey !== false && !key.trim()) validation.key = t('models:previewKeyRequired');
          if (!validate(validation)) return;
          setBusy(true); setError(null); try { setPreviewReport(await ipc.providerConnectionPreviewTest({ ...draft, baseUrl: draft.baseUrl.trim(), modelId: draft.modelId.trim() }, key.trim() || undefined)); setConfirmPreview(false); } catch (cause) { setError(cause); } finally { setBusy(false); }
        })()}>{t('common:confirm')}</Button></div>}
        {previewReport && <ConnectionReport report={previewReport} />}</div>}
      <p className="text-sm leading-6 text-muted">{t(preset?.requiresKey === false ? 'connectionsUx:noKeyNeeded' : 'models:apiKeyStoredVault')}</p><p className="text-sm leading-6 text-muted">{t('models:keyScopeChange')}</p>
      {error != null && <ErrorNotice error={error} />}
      <div className="flex justify-end gap-2"><Button disabled={busy} onClick={close}>{t('common:cancel')}</Button><Button type="submit" variant="primary" loading={busy}><Save size={16} aria-hidden="true" />{t('models:saveConnection')}</Button></div>
    </form>
  </Modal>;
}

function ConnectionReport({ report }: { report: ApiTestReport }) {
  const { t } = useTranslation(['models', 'connectionsUx']);
  return <div className="space-y-2 rounded-lg border border-border bg-surface-alt p-4 text-sm" role="status">
    {(['dnsResolved', 'httpResponse', 'authValidated', 'modelResponded'] as const).map((level) => <div key={level} className="flex items-center gap-2"><span aria-hidden="true">{report[level] ? '✓' : '—'}</span><span>{t(`models:testLevels.${level}`)}: {t(level === 'authValidated' && report.authRequired === false ? 'models:authNotRequired' : report[level] ? 'connectionsUx:confirmed' : 'connectionsUx:notConfirmed')}</span></div>)}
    {!report.httpResponse && <p className="leading-6 text-muted">{t('models:proxyTroubleshooting')} <Link className="text-primary underline" to="/proxy">{t('models:openProxySettings')}</Link></p>}
    {report.httpStatus && <p className="ltr-tech text-muted">HTTP {report.httpStatus}</p>}{report.redactedError && <ErrorNotice error={report.redactedError} />}<p className="leading-6 text-muted">{t('models:redacted')}</p>
  </div>;
}

export function ModelsPage() {
  const { t, i18n } = useTranslation(['models', 'connectionsUx', 'common', 'apps']);
  const { apps, providers } = useCatalog();
  const [params] = useSearchParams();
  const providerParam = params.get('provider') ?? '';
  const lang = i18n.language.startsWith('fa') ? 'fa' : 'en';
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(providerParam);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteEditing, setNoteEditing] = useState(false);
  useEffect(() => { setPage(0); }, [search, filter]);
  useEffect(() => { if (providerParam) setSelected(providerParam); }, [providerParam]);
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
  useEffect(() => {
    if (!providerParam || loading) return;
    const names = new Map(providers.filter(p => p.id !== 'custom-openai-compatible').map(p => [p.id, p.name]));
    for (const preset of PRESETS.filter(p => p.providerId !== 'custom')) if (!names.has(catalogId(preset.providerId))) names.set(catalogId(preset.providerId), preset.name);
    for (const connection of connections) { const id = connection.providerId === 'custom' ? `custom:${connection.baseUrl.replace(/\/$/, '')}` : catalogId(connection.providerId); if (!names.has(id)) names.set(id, connection.name); }
    const saved = new Set(connections.map(c => c.providerId === 'custom' ? `custom:${c.baseUrl.replace(/\/$/, '')}` : catalogId(c.providerId)));
    const ordered = Array.from(names, ([id, name]) => ({id, name})).sort((a,b) => Number(saved.has(b.id)) - Number(saved.has(a.id)) || a.name.localeCompare(b.name));
    const index = ordered.findIndex(item => item.id === providerParam);
    if (index >= 0) setPage(Math.floor(index / 10));
  }, [providerParam, loading, connections, providers]);
  const startNew = (providerId?: string) => { setEditing(false); setError(null); setDraft({ ...makeConnection(PRESETS.find((p) => p.providerId === providerId) ?? PRESETS.find((p) => p.providerId === 'custom')!), modelId: '' }); };
  const act = async (fn: () => Promise<void>) => { if (operation.current) return; operation.current = true; setBusy(true); setError(null); setMessage(''); try { await fn(); } catch (cause) { setError(cause); } finally { operation.current = false; setBusy(false); } };
  return <div className="space-y-8">
    <PageHeader title={t('models:title')} actions={<Button variant="primary" onClick={() => startNew()}><Plus size={16} aria-hidden="true" />{t('models:tryCustom')}</Button>} />
    <p className="text-sm leading-7 text-muted">{t('models:connectionIntro')}</p>
    {error != null && !deleting && !testing && <ErrorNotice error={error} onRetry={() => void reload()} />}{message && <p role="status" className="text-sm text-success">{message}</p>}
    <div className="space-y-4">
      <label className="block max-w-xl space-y-1"><span>{t('models:searchProviders')}</span><Input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <div className="vh-choice-group model-filter-group" role="group" aria-label={t('models:searchProviders')}>{(['all', 'saved', 'notes'] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setSelected(''); setNoteEditing(false); }}>{t(`models:views.${value}`)}</button>)}</div>
      {loading ? <p role="status">{t('common:loading')}</p> : (() => {
        const ids = new Set(providers.filter(p => p.id !== 'custom-openai-compatible').map(p => p.id));
        const rows = providers.filter(p => p.id !== 'custom-openai-compatible').map(p => ({ id: p.id, name: p.name, provider: p, connections: connections.filter(c => c.providerId !== 'custom' && catalogId(c.providerId) === p.id) }));
        for (const preset of PRESETS.filter(item => item.providerId !== 'custom')) {
          const id = catalogId(preset.providerId);
          if (!ids.has(id)) { ids.add(id); rows.push({ id, name: preset.name, provider: undefined as any, connections: connections.filter(c => catalogId(c.providerId) === id) }); }
        }
        for (const connection of connections) {
          const id = connection.providerId === 'custom' ? `custom:${connection.baseUrl.replace(/\/$/, '')}` : catalogId(connection.providerId);
          if (!ids.has(id)) { ids.add(id); rows.push({ id, name: connection.name, provider: undefined as any, connections: [] }); }
          if (connection.providerId === 'custom' || (!providers.some(p => p.id === id) && !PRESETS.some(p => catalogId(p.providerId) === id))) rows.find(row => row.id === id)!.connections.push(connection);
        }
        for (const id of Object.keys(notes)) if (!ids.has(id)) { ids.add(id); rows.push({ id, name: id.startsWith('custom:') ? id.slice(7) : id, provider: undefined as any, connections: [] }); }
        rows.sort((a,b) => Number(b.connections.length > 0) - Number(a.connections.length > 0) || a.name.localeCompare(b.name));
        const visible = rows.filter(row => (filter === 'all' || (filter === 'saved' ? row.connections.length > 0 : !!notes[row.id])) && `${row.name} ${row.connections.map(c => c.baseUrl).join(' ')} ${notes[row.id] ?? ''}`.toLowerCase().includes(search.toLowerCase()));
        const row = rows.find(item => item.id === selected);
        const provider = row?.provider;
        const preset = row && PRESETS.find(item => catalogId(item.providerId) === row.id);
        return <div className="model-workspace" data-selected={!!row && filter !== "notes"}>
          <div className="model-workspace-list space-y-2">
            {visible.length === 0 && <p>{t('models:noResults')}</p>}
            {visible.slice(page * 10, page * 10 + 10).map(item => <div key={item.id} className="space-y-2"><button type="button" className="model-provider-row" aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setNoteEditing(false); }} data-testid={`provider-${item.id}`}><ProviderLogo id={item.provider?.logo ?? item.provider?.id ?? (item.id.startsWith("custom:") ? "custom-openai-compatible" : item.id)} name={item.name} /><span className="model-provider-name">{item.name}</span><span className="flex gap-2">{item.connections.length > 0 && <Badge tone="success">{t('models:views.saved')}</Badge>}{notes[item.id] && <Badge tone="muted">{t('models:note')}</Badge>}</span></button>{filter === 'notes' && <div className="rounded-lg border border-border bg-surface p-3 space-y-2">{noteEditing && selected === item.id ? <><textarea aria-label={t('models:note')} className="vh-input w-full" rows={3} dir="auto" value={noteDraft} onChange={event => setNoteDraft(event.target.value)} /><div className="flex gap-2"><Button size="sm" onClick={() => setNoteEditing(false)}>{t('common:cancel')}</Button><Button size="sm" variant="primary" loading={busy} onClick={() => void act(async () => { setNotes(await ipc.providerNoteSave(item.id, noteDraft)); setNoteEditing(false); })}>{t('common:save')}</Button></div></> : <><p className="whitespace-pre-wrap break-words" dir="auto">{notes[item.id]}</p><Button size="sm" onClick={() => { setSelected(item.id); setNoteDraft(notes[item.id] ?? ''); setNoteEditing(true); }}>{t('common:edit')}</Button></>}</div>}</div>)}
            {visible.length > 10 && <div className="flex gap-2"><Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('models:previous')}</Button><span>{page + 1} / {Math.ceil(visible.length / 10)}</span><Button size="sm" disabled={(page + 1) * 10 >= visible.length} onClick={() => setPage(page + 1)}>{t('models:next')}</Button></div>}
          </div>
          <div className="model-workspace-detail">{row ? <div className="space-y-5"><Button className="model-back" size="sm" onClick={() => setSelected('')}>{t('models:backToList')}</Button><h2 className="text-lg font-bold" dir="auto">{row.name}</h2>
            {provider && <div className="space-y-3"><p className="text-sm text-muted">{provider.notes[lang]}</p>{preset && <p><span>{t('models:suggestedAddress')}: </span><code dir="ltr" className="break-all">{preset.baseUrl}</code></p>}<div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void act(async () => { await openUrl(provider.keyUrl ?? provider.officialUrl); })}><ExternalLink size={15} />{t(provider.requiresApiKey ? 'models:openKeyPortal' : 'models:openProvider')}</Button>{preset && <Button size="sm" onClick={() => startNew(preset.providerId)}>{t('models:addConnection')}</Button>}<Button size="sm" onClick={() => void act(async () => { await openUrl(provider.modelsDocUrl ?? provider.officialUrl); })}>{t('models:officialUrl')}</Button><Button size="sm" onClick={() => void act(async () => { await openUrl(provider.usageTermsUrl); })}>{t('models:terms')}</Button></div><p className="text-sm text-muted">{provider.gettingStarted?.[lang]}</p><p className="text-sm text-muted">{t('models:compatibility')}: {Object.entries(provider.supportedApps).filter(([,status]) => status === 'verified').map(([id]) => apps.find(app => app.id === id)?.name ?? id).join(', ') || t('models:noVerifiedTools')}</p></div>}
            {!provider && preset && <div className="space-y-3"><p><span>{t('models:suggestedAddress')}: </span><code dir="ltr" className="break-all">{preset.baseUrl}</code></p><Button size="sm" onClick={() => startNew(preset.providerId)}>{t('models:addConnection')}</Button></div>}
            <section className="space-y-2"><h3 className="font-bold">{t('models:note')}</h3>{noteEditing ? <><textarea aria-label={t('models:note')} className="vh-input w-full" rows={4} dir="auto" value={noteDraft} onChange={event => setNoteDraft(event.target.value)} /><div className="flex gap-2"><Button size="sm" onClick={() => setNoteEditing(false)}>{t('common:cancel')}</Button><Button size="sm" variant="primary" loading={busy} onClick={() => void act(async () => { setNotes(await ipc.providerNoteSave(row.id, noteDraft)); setNoteEditing(false); })}>{t('common:save')}</Button></div></> : <><p className="whitespace-pre-wrap" dir="auto">{notes[row.id] || t('models:noNote')}</p><Button size="sm" onClick={() => { setNoteDraft(notes[row.id] ?? ''); setNoteEditing(true); }}>{t('common:edit')}</Button></>}</section>
            {row.connections.length > 0 && <section className="space-y-3"><h3 className="font-bold">{t('models:savedConnections')}</h3><div className="vh-record-list">{row.connections.map((connection) => {
        const preset = PRESETS.find((p) => p.providerId === connection.providerId); const provider = providers.find((p) => p.id === catalogId(connection.providerId));
        const officialModelList = connection.providerId === WORKERS_AI ? provider?.modelsDocUrl : undefined;
        const compatibility = provider ? apps.flatMap((app) => { const status = provider.supportedApps[app.id]; return status && status !== 'unknown' ? [{ app, status }] : []; }) : [];
        return <Card key={connection.id} className="space-y-4" data-testid={`connection-${connection.id}`}>
          <div className="flex flex-wrap items-start gap-4"><div className="min-w-0 flex-1"><h3 className="break-words text-base font-bold" dir="auto">{connection.name}</h3><div className="mt-2 flex flex-wrap gap-2"><Badge tone="muted">{preset?.name ?? connection.providerId}</Badge><Badge tone={preset?.requiresKey === false || connection.hasKey ? 'success' : 'warning'}>{t(preset?.requiresKey === false ? 'connectionsUx:noKeyNeeded' : connection.hasKey ? 'models:keyStored' : 'models:keyMissing')}</Badge></div></div><div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !connection.modelId.trim()} onClick={() => { setError(null); setTesting(connection); }}><Zap size={16} aria-hidden="true" />{t('models:testConnection')}</Button><Button size="sm" onClick={() => { setEditing(true); setDraft({ ...connection }); }}>{t('common:edit')}</Button><Button size="sm" variant="ghost" aria-label={t('connectionsUx:deleteConnectionNamed', { name: connection.name })} onClick={() => { setError(null); setDeleting(connection); }}><Trash2 size={16} aria-hidden="true" />{t('common:delete')}</Button></div></div>
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
          </div> : <p className="text-muted">{t('models:selectProvider')}</p>}</div>
        </div>;
      })()}
    </div>
    <Disclosure title={t('ux:help')}><p className="text-sm text-muted">{t('models:noAutomaticInjection')}</p></Disclosure>
    {draft && <ConnectionEditor key={draft.id} connection={draft} existing={editing} onClose={() => setDraft(null)} onSaved={(saved, lookupChanged) => {
      setConnections(saved);
      const savedConnection = saved.find(item => item.id === draft.id);
      if (savedConnection) setSelected(savedConnection.providerId === 'custom' ? `custom:${savedConnection.baseUrl.replace(/\/$/, '')}` : catalogId(savedConnection.providerId));
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
