import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, KeyRound, Trash2, Zap } from 'lucide-react';
import { Badge, Button, Card, Input, SectionTitle } from '@/components/ui';
import { providers } from '@/lib/catalog';
import { ipc, type ApiTestReport } from '@/services/ipc';
import { openUrl } from '@tauri-apps/plugin-opener';

const VAULT_SERVICE = 'vibehub.provider-key';

export function ModelsPage() {
  const { t, i18n } = useTranslation(['models', 'common']);
  const lang = i18n.language === 'fa' ? 'fa' : 'en';
  const [tab, setTab] = useState<'freeProviders' | 'localModels' | 'apiConnections'>('freeProviders');
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({});
  const [keyState, setKeyState] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, ApiTestReport>>({});
  const [consentFor, setConsentFor] = useState<string | null>(null);
  const [customBaseUrl, setCustomBaseUrl] = useState('https://');
  const [customModel, setCustomModel] = useState('');

  const shown =
    tab === 'localModels'
      ? providers.filter((p) => p.id === 'ollama')
      : tab === 'apiConnections'
        ? providers.filter((p) => p.id === 'custom-openai-compatible')
        : providers.filter((p) => p.id !== 'ollama' && p.id !== 'custom-openai-compatible');

  const checkKey = async (id: string) => {
    const k = await ipc.vaultGet(`${VAULT_SERVICE}.${id}`).catch(() => null);
    setKeyState((s) => ({ ...s, [id]: !!k }));
  };

  const runTest = async (id: string, baseUrl: string, modelId: string) => {
    setTesting(id);
    setConsentFor(null);
    try {
      const report = await ipc.apiTest(id, baseUrl, modelId, `${VAULT_SERVICE}.${id}`);
      setReports((r) => ({ ...r, [id]: report }));
    } catch (e) {
      setReports((r) => ({ ...r, [id]: { dnsResolved: false, httpResponse: false, authValidated: false, modelResponded: false, redactedError: String(e) } }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">{t('models:title')}</h1>

      <div className="flex gap-1 border-b border-border">
        {(['freeProviders', 'localModels', 'apiConnections'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 pb-2 text-sm ${tab === k ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text'}`}>
            {t(`models:tabs.${k}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {shown.map((p) => {
          const report = reports[p.id];
          return (
            <Card key={p.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    {p.name}
                    {p.id === 'nvidia-build' && <Badge tone="warning">{t('models:nvidiaBadge')}</Badge>}
                  </div>
                  <button className="mt-1 text-xs text-primary hover:underline" onClick={() => void openUrl(p.officialUrl)}>
                    <span className="ltr-tech">{new URL(p.officialUrl).host}</span> <ExternalLink size={11} className="inline" />
                  </button>
                </div>
                <Badge tone={p.freeAccess === 'free_forever' ? 'success' : 'primary'}>{p.freeAccess}</Badge>
              </div>
              <p className="text-sm text-muted">{p.notes[lang]}</p>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {p.requiresAccount === false && <Badge tone="success">No signup</Badge>}
                {p.requiresApiKey && <Badge tone="muted">API key</Badge>}
                <Badge tone="muted">{t('models:terms')}: <button className="text-primary hover:underline" onClick={() => void openUrl(p.usageTermsUrl)}>link</button></Badge>
                <Badge tone="muted">{t('models:countryStatus')}: {p.eligibilityStatus}</Badge>
                <Badge tone="muted">{p.lastVerified}</Badge>
              </div>

              {p.requiresApiKey && (
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <KeyRound size={14} className="text-muted" />
                    <Input
                      type="password"
                      placeholder={t('models:apiKey')}
                      value={keyDraft[p.id] ?? ''}
                      onChange={(e) => setKeyDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                    />
                    <Button size="sm" onClick={async () => { await ipc.vaultSet(`${VAULT_SERVICE}.${p.id}`, keyDraft[p.id] ?? ''); await checkKey(p.id); }}>
                      {t('models:saveKey')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={async () => { await ipc.vaultDelete(`${VAULT_SERVICE}.${p.id}`); await checkKey(p.id); }}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted">
                    {keyState[p.id] === undefined ? void checkKey(p.id) : null}
                    {keyState[p.id] ? t('models:keyStored') : t('models:noKeyStored')} — {t('models:apiKeyStoredVault')}
                  </p>

                  {p.id === 'custom-openai-compatible' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder={t('models:baseUrl')} value={customBaseUrl} onChange={(e) => setCustomBaseUrl(e.target.value)} />
                      <Input placeholder={t('models:modelId')} value={customModel} onChange={(e) => setCustomModel(e.target.value)} />
                    </div>
                  )}

                  {consentFor === p.id ? (
                    <div className="space-y-2 rounded-[10px] border border-warning/40 bg-warning/10 p-3">
                      <p className="text-xs">{t('models:testConsent')}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="primary" loading={testing === p.id}
                          onClick={() => void runTest(p.id, p.endpoint?.baseUrl ?? customBaseUrl, p.endpoint?.kind === 'ollama' ? 'llama3.2' : customModel || 'meta/llama-3.1-8b-instruct')}>
                          <Zap size={13} /> {t('common:confirm')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConsentFor(null)}>{t('common:cancel')}</Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => setConsentFor(p.id)}>{t('models:testConnection')}</Button>
                  )}

                  {report && (
                    <div className="space-y-1 rounded-[10px] border border-border bg-surface-alt p-3 text-xs">
                      {(['dnsResolved', 'httpResponse', 'authValidated', 'modelResponded'] as const).map((k) => (
                        <div key={k} className="flex items-center gap-2">
                          <span>{report[k] ? '✅' : '⛔'}</span>
                          <span className="text-muted">{t(`models:testLevels.${k}`)}</span>
                        </div>
                      ))}
                      {report.httpStatus && <p className="ltr-tech text-muted">HTTP {report.httpStatus}</p>}
                      {report.redactedError && <p className="ltr-tech text-danger">{report.redactedError}</p>}
                      <p className="text-muted">{t('models:redacted')}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <SectionTitle>{t('models:agentIntegration')}</SectionTitle>
        <p className="text-sm text-muted">{t('models:customNote')}</p>
      </Card>
    </div>
  );
}
