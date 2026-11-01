import { Disclosure } from '@/components/Disclosure';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardCopy, Play, LoaderCircle, Circle, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge, Button, Card, ErrorNotice, PageHeader } from '@/components/ui';
import { ipc } from '@/services/ipc';
import type { DoctorCheck } from '@core';

function sanitizeReportText(value: string) {
  return value
    .replace(/(?:\b[A-Z]:\\|\\\\)[^\r\n,;]*/gi, '[path]')
    .replace(/https?:\/\/[^/@\s]+:[^/@\s]+@/gi, 'https://[redacted]@')
    .replace(/\b((?:api[-_]?key|token|password|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/([?&](?:key|token|password|api_key)=)[^&\s]+/gi, '$1[redacted]');
}

type Check = DoctorCheck & { detailKey?: string; detailValues?: Record<string, string | number> };
const groupIds = ['native', 'apps', 'rtlAdapters', 'proxyConfig', 'modelConnections'] as const;
type GroupId = typeof groupIds[number];
type Group = { phase: 'ready' | 'running' | 'done'; checks: Check[] };
const freshGroups = (phase: Group['phase']): Record<GroupId, Group> => ({
  native: { phase, checks: [] }, apps: { phase, checks: [] }, rtlAdapters: { phase, checks: [] },
  proxyConfig: { phase, checks: [] }, modelConnections: { phase, checks: [] },
});
const appNames: Record<string, string> = { zcode: 'ZCode', qoder: 'Qoder', 'deepseek-harness': 'DeepSeek Harness', opencode: 'OpenCode', mimocode: 'MiMo Code', freebuff: 'Freebuff' };

export function DoctorPage() {
  const { t, i18n } = useTranslation(['doctor', 'common', 'nav', 'journeyUx', 'ux']);
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = useState(() => freshGroups('ready'));
  const checks = groupIds.flatMap(id => groups[id].checks);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [copyStatus, setCopyStatus] = useState<'success' | 'error' | null>(null);
  const busy = useRef(false);
  const language = i18n.language.startsWith('fa') ? 'fa' : 'en';

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true); setError(null); setCopyStatus(null);
    setGroups(freshGroups('running'));
    const finish = (id: GroupId, results: Check[]) => setGroups(previous => ({ ...previous, [id]: { phase: 'done', checks: results } }));
    const failed = (id: GroupId, reason: unknown): Check[] => [{ id: id === 'native' ? 'crash' : id, label: { fa: t(`doctor:groups.${id}`), en: t(`doctor:groups.${id}`) }, status: 'fail', detail: sanitizeReportText(String(reason)) }];
    const detectedApps = ipc.detectApps();
    // Start all independent reads together; publish each group as soon as its dependencies settle.
    try {
      await Promise.allSettled([
        ipc.doctorRun().then(result => finish('native', result.length ? result : [{ id: 'native', label: { fa: t('doctor:groups.native'), en: t('doctor:groups.native') }, status: 'unknown' }]), reason => { finish('native', failed('native', reason)); setError(reason); }),
        detectedApps.then(items => {
          const installed = items.filter(item => item.installed);
          const results: Check[] = [{ id: 'apps', label: { fa: '', en: '' }, status: 'pass', detailKey: 'appsCount', detailValues: { installed: installed.length, total: items.length } }];
          for (const item of installed) results.push({ id: `app-${item.id}`, label: { fa: appNames[item.id] ?? item.id, en: appNames[item.id] ?? item.id }, status: 'pass', ...(item.version ? { detail: `v${item.version}` } : { detailKey: 'pathFound' }) });
          const focusId = searchParams.get('tool');
          if (focusId && searchParams.get('kind') === 'app') {
            const found = installed.some(item => item.id === focusId), name = appNames[focusId] ?? focusId;
            results.push({ id: 'focusedTool', label: { fa: `برنامهٔ انتخاب‌شده: ${name}`, en: `Selected tool: ${name}` }, status: found ? 'pass' : 'fail', detailKey: found ? 'pathFound' : 'pathMissing' });
          }
          finish('apps', results);
        }).catch(reason => finish('apps', failed('apps', reason))),
        Promise.all([ipc.rtlComponents(), detectedApps]).then(([components, items]) => {
          const ready = components.filter(item => item.available && items.some(app => app.installed && app.id === item.id));
          finish('rtlAdapters', [{ id: 'rtlAdapters', label: { fa: '', en: '' }, status: 'pass', detailKey: 'rtlCount', detailValues: { count: ready.length } }]);
        }).catch(reason => finish('rtlAdapters', failed('rtlAdapters', reason))),
        Promise.all([ipc.proxyProfiles(), ipc.proxyConfig()]).then(([profiles, config]) => {
          const selected = profiles.find(profile => profile.id === config.globalProfileId);
          finish('proxyConfig', [{ id: 'proxyConfig', label: { fa: '', en: '' }, status: selected ? 'pass' : 'unknown', detailKey: selected ? 'proxyConfigured' : 'proxyMissing', detailValues: selected ? { name: selected.name } : undefined }]);
        }).catch(reason => finish('proxyConfig', failed('proxyConfig', reason))),
        ipc.providerConnections().then(connections => finish('modelConnections', [{ id: 'modelConnections', label: { fa: '', en: '' }, status: 'pass', detailKey: 'modelsCount', detailValues: { count: connections.length } }])).catch(reason => finish('modelConnections', failed('modelConnections', reason))),
      ]);
    } catch (e) { setError(e); }
    finally { busy.current = false; setRunning(false); }
  };
  const tone = { pass: 'success', fail: 'danger', unknown: 'muted', skipped: 'neutral' } as const;
  const detailFor = (check: Check) => check.detailKey ? t(`journeyUx:doctor.${check.detailKey}`, check.detailValues ?? {}) : sanitizeReportText(check.detail ?? '');
  const labelFor = (check: Check) => check.id === 'focusedTool' ? check.label[language] : t(`doctor:checks.${check.id}`, { defaultValue: check.label[language] ?? check.id });
  const relatedLink = (id: string) => id === 'focusedTool' && searchParams.get('kind') === 'app' ? `/app/${encodeURIComponent(searchParams.get('tool') ?? '')}` : id.startsWith('app-') ? `/app/${id.slice(4)}` : id === 'proxyConfig' || id === 'proxy' ? '/proxy' : id === 'modelConnections' ? '/models' : id === 'apps' || id === 'rtlAdapters' ? '/discover' : id === 'editors' ? '/' : '/settings';
  const copyReport = async () => {
    if (!checks.length || running) return;
    try {
      const text = checks.map((check) => `${check.status.toUpperCase()} ${labelFor(check)} — ${detailFor(check)}`).join('\n');
      await navigator.clipboard.writeText(`VibeHub Doctor ${new Date().toISOString()}\n${sanitizeReportText(text)}`);
      setCopyStatus('success');
    } catch { setCopyStatus('error'); }
  };

  return <div className="space-y-6">
    <PageHeader title={t('doctor:title')} actions={<div className="flex flex-wrap gap-2"><Button variant="primary" loading={running} onClick={() => void run()}><Play size={14} aria-hidden="true" />{t('doctor:runChecks')}</Button><Button disabled={!checks.length || running} onClick={() => void copyReport()}><ClipboardCopy size={14} aria-hidden="true" />{t('doctor:copyReport')}</Button></div>} />
    <Disclosure title={t('ux:help')}><p>{t('doctor:purpose')}</p><p className="text-sm leading-7 text-muted">{t('doctor:networkNote')}</p></Disclosure>
    {error != null && <ErrorNotice error={error} onRetry={() => void run()} />}
    {copyStatus && <p role={copyStatus === 'error' ? 'alert' : 'status'} className="text-sm">{t(copyStatus === 'success' ? 'journeyUx:doctor.copySuccess' : 'journeyUx:doctor.copyFailure')}</p>}
    <p role="status" className="text-sm text-muted">{running ? t('doctor:progress', { done: groupIds.filter(id => groups[id].phase === 'done').length, total: groupIds.length }) : checks.length ? t('journeyUx:doctor.summary', { count: checks.length }) : t('journeyUx:doctor.notRun')}</p>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groupIds.map(id => {
        const group = groups[id];
        const status = group.phase !== 'done' ? group.phase : group.checks.some(check => check.status === 'fail') ? 'fail' : group.checks.some(check => check.status !== 'pass') ? 'unknown' : 'pass';
        const Icon = status === 'running' ? LoaderCircle : status === 'ready' ? Circle : status === 'pass' ? CheckCircle2 : AlertCircle;
        return <Card key={id} data-check-group={id} className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">{t(`doctor:groups.${id}`)}</h2>
            <span className="inline-flex items-center gap-2 text-sm" role="status"><Icon size={16} aria-hidden="true" className={status === 'running' ? 'animate-spin text-primary' : status === 'pass' ? 'text-success' : status === 'fail' ? 'text-danger' : 'text-muted'} />{status === 'ready' ? t('doctor:ready') : status === 'running' ? t('doctor:running') : t(`common:${status}`)}</span>
          </div>
          <p className="text-sm leading-7 text-muted">{t(`doctor:groupHints.${id}`)}</p>
          <ul className="divide-y divide-border">{group.checks.map(check => <li key={check.id} className="space-y-3 py-3">
            <div className="flex flex-wrap items-center gap-2"><Badge tone={tone[check.status]}>{t(`common:${check.status === 'skipped' ? 'skipStatus' : check.status}`)}</Badge><h3 className="text-sm font-bold">{labelFor(check)}</h3></div>
            {detailFor(check) && <p dir="auto" className="break-words text-sm leading-7 text-muted">{detailFor(check)}</p>}
            {check.status !== 'pass' && <>
              <p className="text-sm leading-7 text-muted">{t(check.id === 'focusedTool' ? 'doctor:nextActions.focusedTool' : check.status === 'fail' ? `doctor:nextActions.${check.id}` : 'doctor:nextActions.review', { defaultValue: t('doctor:nextActions.default') })}</p>
              <Link to={relatedLink(check.id)} className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">{t('journeyUx:doctor.openSetting')}</Link>
            </>}
          </li>)}</ul>
        </Card>;
      })}
    </div>
    <p className="text-xs text-muted">{t('doctor:noSecrets')}</p>
  </div>;
}
