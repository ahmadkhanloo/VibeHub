import { Tooltip } from '@/components/Tooltip';
import { Disclosure } from '@/components/Disclosure';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, KeyRound, Plus, Save, Trash2, Zap } from 'lucide-react';
import { Badge, Button, Card, CopyButton, EmptyState, ErrorNotice, Input, Modal, PageHeader, SectionTitle, Tabs } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { ipc, type ApiTestReport, type ProviderConnection } from '@/services/ipc';
import { openUrl } from '@tauri-apps/plugin-opener';

type Preset = Pick<ProviderConnection, 'providerId' | 'baseUrl' | 'modelId'> & { name: string; requiresKey: boolean };
const PRESETS: Preset[] = [
  { providerId: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', modelId: 'gpt-4o-mini', requiresKey: true },
  { providerId: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1', modelId: 'claude-sonnet-4-5-20250929', requiresKey: true },
  { providerId: 'google', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', modelId: 'gemini-3.8-flash', requiresKey: true },
  { providerId: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', modelId: 'deepseek-flash', requiresKey: true },
  { providerId: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', modelId: 'openai/gpt-oss-20b:free', requiresKey: true },
  { providerId: 'nvidia', name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1', modelId: 'meta/llama-3.3-70b-instruct', requiresKey: true },
  { providerId: 'ollama', name: 'Ollama', baseUrl: 'http://127.0.0.1:11434/v1', modelId: 'qwen2.5-coder:7b', requiresKey: false },
  { providerId: 'custom', name: 'OpenAI-compatible', baseUrl: 'https://', modelId: '', requiresKey: true },
];
const presetId = (id: string) => id === 'nvidia-build' ? 'nvidia' : id === 'custom-openai-compatible' ? 'custom' : id;
const catalogId = (id: string) => id === 'nvidia' ? 'nvidia-build' : id === 'custom' ? 'custom-openai-compatible' : id;
const origin = (value: string) => { try { return new URL(value).origin; } catch { return null; } };
const makeConnection = (preset: Preset): ProviderConnection => ({ id: `connection-${crypto.randomUUID()}`, providerId: preset.providerId, name: preset.name, baseUrl: preset.baseUrl, modelId: preset.modelId, hasKey: false });

function ConnectionEditor({ connection, existing, onClose, onSaved }: { connection: ProviderConnection; existing: boolean; onClose: () => void; onSaved: (saved: ProviderConnection[]) => void }) {
  const { t } = useTranslation(['models', 'connectionsUx', 'common']);
  const id = useId();
  const [draft, setDraft] = useState({ ...connection });
  const [key, setKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const preset = PRESETS.find((p) => p.providerId === draft.providerId);
  const save = async () => {
    if (saving.current) return;
    const validation: Record<string, string> = {};
    if (!draft.name.trim()) validation.name = t('connectionsUx:required');
    if (!draft.modelId.trim() || /[\u0000-\u001f\u007f]/.test(draft.modelId)) validation.model = t('connectionsUx:modelInvalid');
    try { const url = new URL(draft.baseUrl.trim()); const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname); if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) throw new Error(); }
    catch { validation.url = t('connectionsUx:urlInvalid'); }
    setErrors(validation);
    if (Object.keys(validation).length) { requestAnimationFrame(() => document.getElementById(`${id}-${Object.keys(validation)[0]}`)?.focus()); return; }
    saving.current = true; setBusy(true); setError(null);
    try {
      const saved = await ipc.providerConnectionSave({ ...draft, name: draft.name.trim(), baseUrl: draft.baseUrl.trim(), modelId: draft.modelId.trim(), hasKey: preset?.requiresKey === false ? false : draft.hasKey || !!key.trim() }, preset?.requiresKey === false ? undefined : key.trim() || undefined);
      setKey(''); onSaved(saved); onClose();
    } catch (cause) { setError(cause); } finally { setBusy(false); saving.current = false; }
  };
  const close = () => { setKey(''); onClose(); };
  const errorProps = (field: string) => ({ 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined });
  const fieldError = (field: string) => errors[field] && <span role="alert" className="block text-sm text-danger" id={`${id}-${field}-error`}>{errors[field]}</span>;
  return <Modal open title={t(existing ? 'models:editConnection' : 'models:newConnection')} onClose={close} busy={busy}>
    <form onSubmit={(e) => { e.preventDefault(); void save(); }} noValidate className="space-y-5">
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm"><span className="block font-medium">{t('models:provider')}</span><select className="h-10 w-full rounded-lg border border-border bg-surface px-3" value={draft.providerId} onChange={(e) => { const selected = PRESETS.find((p) => p.providerId === e.target.value)!; setKey(''); setDraft({ ...draft, providerId: selected.providerId, baseUrl: selected.baseUrl, modelId: selected.modelId, name: selected.name, hasKey: false }); }}>{PRESETS.map((p) => <option key={p.providerId} value={p.providerId}>{p.name}</option>)}</select></label>
        <label className="block space-y-2 text-sm" htmlFor={`${id}-name`}><span className="block font-medium">{t('models:connectionName')}</span><Input id={`${id}-name`} data-autofocus dir="auto" value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} {...errorProps('name')} />{fieldError('name')}</label>
        <label className="block space-y-2 text-sm sm:col-span-2" htmlFor={`${id}-url`}><span className="block font-medium">{t('models:baseUrl')}</span><Input id={`${id}-url`} dir="ltr" className="ltr-tech" value={draft.baseUrl} onChange={(e) => { const baseUrl = e.target.value; const changed = origin(draft.baseUrl) !== origin(baseUrl); if (changed) setKey(''); setDraft({ ...draft, baseUrl, hasKey: changed ? false : draft.hasKey }); }} {...errorProps('url')} />{fieldError('url')}</label>
        <label className="block space-y-2 text-sm" htmlFor={`${id}-model`}><span className="block font-medium">{t('models:modelId')}</span><Input id={`${id}-model`} dir="ltr" className="ltr-tech" value={draft.modelId} maxLength={256} onChange={(e) => setDraft({ ...draft, modelId: e.target.value })} {...errorProps('model')} />{fieldError('model')}</label>
        {preset?.requiresKey !== false && <label className="block space-y-2 text-sm" htmlFor={`${id}-key`}><span className="flex items-center gap-2 font-medium"><KeyRound size={16} aria-hidden="true" />{t(existing ? 'models:replaceApiKey' : 'models:apiKey')}</span><Input id={`${id}-key`} type="password" dir="ltr" autoComplete="new-password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={existing && draft.hasKey ? t('models:leaveBlankToKeep') : ''} /></label>}
      </fieldset>
      <Tooltip text={t(preset?.requiresKey === false ? 'connectionsUx:noKeyNeeded' : 'models:apiKeyStoredVault')} /><p className="text-sm leading-7 text-muted">{t('models:keyScopeChange')}</p>
      {error != null && <ErrorNotice error={error} />}
      <div className="flex justify-end gap-2"><Button disabled={busy} onClick={close}>{t('common:cancel')}</Button><Button type="submit" variant="primary" loading={busy}><Save size={16} aria-hidden="true" />{t('models:saveConnection')}</Button></div>
    </form>
  </Modal>;
}

function ConnectionReport({ report }: { report: ApiTestReport }) {
  const { t } = useTranslation(['models', 'connectionsUx']);
  return <div className="space-y-2 rounded-lg border border-border bg-surface-alt p-4 text-sm" role="status">
    {(['dnsResolved', 'httpResponse', 'authValidated', 'modelResponded'] as const).map((level) => <div key={level} className="flex items-center gap-2"><span aria-hidden="true">{report[level] ? '✓' : '—'}</span><span>{t(`models:testLevels.${level}`)}: {t(level === 'authValidated' && report.authRequired === false ? 'models:authNotRequired' : report[level] ? 'connectionsUx:confirmed' : 'connectionsUx:notConfirmed')}</span></div>)}
    {report.httpStatus && <p className="ltr-tech text-muted">HTTP {report.httpStatus}</p>}{report.redactedError && <ErrorNotice error={report.redactedError} />}<Tooltip text={t('models:redacted')} />
  </div>;
}

export function ModelsPage() {
  const { t, i18n } = useTranslation(['models', 'connectionsUx', 'common', 'apps']);
  const { apps, providers } = useCatalog();
  const [params, setParams] = useSearchParams();
  const providerParam = params.get('provider') ?? '';
  const requestedTab = params.get('tab');
  const tab = requestedTab === 'localModels' || requestedTab === 'apiConnections' || requestedTab === 'freeProviders' ? requestedTab : providerParam === 'ollama' ? 'localModels' : providerParam === 'custom-openai-compatible' ? 'apiConnections' : 'freeProviders';
  const lang = i18n.language.startsWith('fa') ? 'fa' : 'en';
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ProviderConnection | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<ProviderConnection | null>(null);
  const [testing, setTesting] = useState<ProviderConnection | null>(null);
  const [reports, setReports] = useState<Record<string, ApiTestReport>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const operation = useRef(false);
  const providerOpened = useRef('');
  const reload = async () => { setLoading(true); setError(null); try { setConnections(await ipc.providerConnections()); } catch (cause) { setError(cause); } finally { setLoading(false); } };
  useEffect(() => { void reload(); }, []);
  useEffect(() => { if (providerParam === providerOpened.current) return; providerOpened.current = providerParam; const preset = PRESETS.find((p) => p.providerId === presetId(providerParam)); if (preset) { setEditing(false); setDraft(makeConnection(preset)); } }, [providerParam]);
  const startNew = (providerId?: string) => { setEditing(false); setError(null); setDraft(makeConnection(PRESETS.find((p) => p.providerId === providerId) ?? PRESETS[0]!)); };
  const act = async (fn: () => Promise<void>) => { if (operation.current) return; operation.current = true; setBusy(true); setError(null); setMessage(''); try { await fn(); } catch (cause) { setError(cause); } finally { operation.current = false; setBusy(false); } };
  const shown = providers.filter((p) => tab === 'localModels' ? p.id === 'ollama' : tab === 'apiConnections' ? p.id === 'custom-openai-compatible' : !['ollama', 'custom-openai-compatible'].includes(p.id));
  return <div className="space-y-8">
    <PageHeader title={t('models:title')} actions={<Button variant="primary" onClick={() => startNew()}><Plus size={16} aria-hidden="true" />{t('models:addConnection')}</Button>} />
    {error != null && !deleting && !testing && <ErrorNotice error={error} onRetry={() => void reload()} />}{message && <p role="status" className="text-sm text-success">{message}</p>}
    <section aria-labelledby="saved-model-connections"><SectionTitle><span id="saved-model-connections">{t('models:savedConnections')}</span></SectionTitle>
      {loading ? <p role="status" className="text-muted">{t('common:loading')}</p> : connections.length === 0 ? <EmptyState title={t('models:noConnections')} sub={t('connectionsUx:connectionEmptyHint')} /> : <div className="vh-record-list">{connections.map((connection) => {
        const preset = PRESETS.find((p) => p.providerId === connection.providerId); const provider = providers.find((p) => p.id === catalogId(connection.providerId));
        const compatibility = provider ? apps.flatMap((app) => { const status = provider.supportedApps[app.id]; return status && status !== 'unknown' ? [{ app, status }] : []; }) : [];
        return <Card key={connection.id} className="space-y-4" data-testid={`connection-${connection.id}`}>
          <div className="flex flex-wrap items-start gap-4"><div className="min-w-0 flex-1"><h3 className="break-words text-base font-bold" dir="auto">{connection.name}</h3><div className="mt-2 flex flex-wrap gap-2"><Badge tone="muted">{preset?.name ?? connection.providerId}</Badge><Badge tone={preset?.requiresKey === false || connection.hasKey ? 'success' : 'warning'}>{t(preset?.requiresKey === false ? 'connectionsUx:noKeyNeeded' : connection.hasKey ? 'models:keyStored' : 'models:keyMissing')}</Badge></div></div><div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => { setError(null); setTesting(connection); }}><Zap size={16} aria-hidden="true" />{t('models:testConnection')}</Button><Button size="sm" onClick={() => { setEditing(true); setDraft({ ...connection }); }}>{t('common:edit')}</Button><Button size="sm" variant="ghost" aria-label={t('connectionsUx:deleteConnectionNamed', { name: connection.name })} onClick={() => { setError(null); setDeleting(connection); }}><Trash2 size={16} aria-hidden="true" />{t('common:delete')}</Button></div></div>
          <Disclosure title={t('ux:details')} className="vh-inline-disclosure">
          <div className="grid gap-3 sm:grid-cols-2"><div className="min-w-0"><div className="text-sm text-muted">{t('models:baseUrl')}</div><div className="mt-1 flex items-start gap-2"><code dir="ltr" className="min-w-0 flex-1 break-all text-sm">{connection.baseUrl}</code><CopyButton text={connection.baseUrl} label={t('common:copy')} /></div></div><div className="min-w-0"><div className="text-sm text-muted">{t('models:modelId')}</div><div className="mt-1 flex items-start gap-2"><code dir="ltr" className="min-w-0 flex-1 break-all text-sm">{connection.modelId}</code><CopyButton text={connection.modelId} label={t('common:copy')} /></div></div></div>
          <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">{t('models:whereToUse')}</summary><p className="mt-3 text-sm leading-7 text-muted">{t('models:manualSetup', { provider: preset?.name ?? connection.providerId, model: connection.modelId })}</p><ul className="mt-3 space-y-2 text-sm">{compatibility.length ? compatibility.map(({ app, status }) => <li key={app.id}><Link className="text-primary underline underline-offset-4" to={`/app/${app.id}`}>{app.name}</Link> — {t(`models:compatibilityStatus.${status}`)}</li>) : <li className="text-muted">{t('models:noVerifiedTools')}</li>}</ul></details>
          </Disclosure>
          {reports[connection.id] && <ConnectionReport report={reports[connection.id]!} />}
        </Card>;
      })}</div>}
    </section>
    <section aria-labelledby="model-provider-catalog"><SectionTitle><span id="model-provider-catalog">{t('models:providerCatalog')}</span></SectionTitle><Tabs panelId="provider-results" value={tab} onChange={(value) => setParams((current) => { const next = new URLSearchParams(current); next.set('tab', value); return next; })} label={t('models:providerCatalog')} items={(['freeProviders', 'localModels', 'apiConnections'] as const).map((value) => ({ value, label: t(`models:tabs.${value}`) }))} />
      <div id="provider-results" role="tabpanel" aria-labelledby={"provider-results-tab-"+tab} className="mt-4 vh-record-list">{shown.map((provider) => <Card key={provider.id} className={`space-y-3 ${provider.id === providerParam ? 'border-primary' : ''}`} data-testid={`provider-${provider.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-base font-bold">{provider.name}</h3><Badge tone="muted">{t(`connectionsUx:freeAccess.${provider.freeAccess}`)}</Badge></div><Button size="sm" variant="primary" onClick={() => startNew(presetId(provider.id))}><Plus size={16} aria-hidden="true" />{t('models:useProvider')}</Button><Disclosure title={t('ux:details')} className="vh-inline-disclosure"><p className="max-w-3xl text-sm leading-7 text-muted">{provider.notes[lang]}</p><div className="flex flex-wrap gap-3 text-sm text-muted"><span>{t('models:countryStatus')}: {t(`common:${provider.eligibilityStatus}`)}</span><span>{t('connectionsUx:catalogVerified')}: <bdi>{provider.lastVerified}</bdi></span></div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void act(async () => { await openUrl(provider.officialUrl); })}><ExternalLink size={16} aria-hidden="true" />{t('models:officialUrl')}</Button><Button size="sm" variant="ghost" onClick={() => void act(async () => { await openUrl(provider.usageTermsUrl); })}>{t('models:terms')}</Button></div></Disclosure></Card>)}</div>
    </section>
    <p className="text-sm leading-7 text-muted">{t('models:noAutomaticInjection')}</p>
    {draft && <ConnectionEditor key={draft.id} connection={draft} existing={editing} onClose={() => setDraft(null)} onSaved={(saved) => { setConnections(saved); setMessage(t('connectionsUx:connectionSaved')); }} />}
    <Modal open={!!deleting} title={t('connectionsUx:deleteConnection')} onClose={() => setDeleting(null)} busy={busy}><p className="text-sm leading-7">{t('connectionsUx:deleteConnectionHint', { name: deleting?.name })}</p>{error != null && <ErrorNotice error={error} />}<div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={() => setDeleting(null)}>{t('common:cancel')}</Button><Button variant="danger" loading={busy} onClick={() => void act(async () => { if (!deleting) return; setConnections(await ipc.providerConnectionDelete(deleting.id)); setReports((current) => { const next = { ...current }; delete next[deleting.id]; return next; }); setDeleting(null); setMessage(t('connectionsUx:connectionDeleted')); })}>{t('common:delete')}</Button></div></Modal>
    <Modal open={!!testing} title={t('models:testConnection')} onClose={() => setTesting(null)} busy={busy}><p className="text-sm leading-7">{t('models:testConsent')}</p>{error != null && <ErrorNotice error={error} />}<div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={() => setTesting(null)}>{t('common:cancel')}</Button><Button variant="primary" loading={busy} onClick={() => void act(async () => { if (!testing) return; const report = await ipc.providerConnectionTest(testing.id); setReports((current) => ({ ...current, [testing.id]: report })); setTesting(null); })}>{t('common:confirm')}</Button></div></Modal>
  </div>;
}
