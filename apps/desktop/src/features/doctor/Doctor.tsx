import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardCopy, Play } from 'lucide-react';
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
const appNames: Record<string, string> = { zcode: 'ZCode', qoder: 'Qoder', 'deepseek-harness': 'DeepSeek Harness', opencode: 'OpenCode', mimocode: 'MiMo Code', freebuff: 'Freebuff' };

export function DoctorPage() {
  const { t, i18n } = useTranslation(['doctor', 'common', 'nav', 'journeyUx']);
  const [searchParams] = useSearchParams();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [copyStatus, setCopyStatus] = useState<'success' | 'error' | null>(null);
  const busy = useRef(false);
  const language = i18n.language.startsWith('fa') ? 'fa' : 'en';

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true); setError(null); setCopyStatus(null);
    try {
      const [native, detectedApps, detectedEditors, components, profiles, proxyConfig, connections] = await Promise.allSettled([
        ipc.doctorRun(), ipc.detectApps(), ipc.detectEditors(), ipc.rtlComponents(), ipc.proxyProfiles(), ipc.proxyConfig(), ipc.providerConnections(),
      ]);
      const results: Check[] = native.status === 'fulfilled' ? [...native.value] : [{ id: 'crash', label: { fa: 'بررسی پیش‌نیازها', en: 'Prerequisite checks' }, status: 'fail', detail: sanitizeReportText(String(native.reason)) }];
      if (native.status === 'rejected') setError(native.reason);
      if (detectedApps.status === 'fulfilled') {
        const installed = detectedApps.value.filter((item) => item.installed);
        results.push({ id: 'apps', label: { fa: 'برنامه‌های کدنویسی', en: 'Coding apps' }, status: 'pass', detailKey: 'appsCount', detailValues: { installed: installed.length, total: detectedApps.value.length } });
        for (const item of installed) results.push({ id: `app-${item.id}`, label: { fa: appNames[item.id] ?? item.id, en: appNames[item.id] ?? item.id }, status: 'pass', ...(item.version ? { detail: `v${item.version}` } : { detailKey: 'pathFound' }) });
      } else results.push({ id: 'apps', label: { fa: 'شناسایی برنامه‌ها', en: 'App detection' }, status: 'fail', detailKey: 'appsFailed' });
      results.push({ id: 'editors', label: { fa: 'ویرایشگرهای دیگر', en: 'Other editors' }, status: detectedEditors.status === 'fulfilled' ? 'pass' : 'fail', ...(detectedEditors.status === 'fulfilled' ? { detailKey: 'editorsCount', detailValues: { count: detectedEditors.value.length } } : {}) });
      const focusId = searchParams.get('tool');
      const focusKind = searchParams.get('kind');
      if (focusId && (focusKind === 'app' || focusKind === 'editor')) {
        const detected = focusKind === 'app' && detectedApps.status === 'fulfilled' ? detectedApps.value.find((item) => item.id === focusId && item.installed) : focusKind === 'editor' && detectedEditors.status === 'fulfilled' ? detectedEditors.value.find((item) => item.id === focusId) : undefined;
        const name = appNames[focusId] ?? (detectedEditors.status === 'fulfilled' ? detectedEditors.value.find((item) => item.id === focusId)?.name : undefined) ?? focusId;
        results.push({ id: 'focusedTool', label: { fa: `برنامهٔ انتخاب‌شده: ${name}`, en: `Selected tool: ${name}` }, status: detected ? 'pass' : 'fail', detailKey: detected ? 'pathFound' : 'pathMissing' });
      }
      if (components.status === 'fulfilled' && detectedApps.status === 'fulfilled') {
        const installedIds = detectedApps.value.filter((item) => item.installed).map((item) => item.id);
        const ready = components.value.filter((item) => item.available && installedIds.includes(item.id));
        results.push({ id: 'rtlAdapters', label: { fa: 'آداپترهای راست‌چین', en: 'RTL adapters' }, status: 'pass', detailKey: 'rtlCount', detailValues: { count: ready.length } });
      } else results.push({ id: 'rtlAdapters', label: { fa: 'آداپترهای راست‌چین', en: 'RTL adapters' }, status: components.status === 'rejected' ? 'fail' : 'unknown', detailKey: components.status === 'rejected' ? 'rtlFailed' : 'rtlUnknown' });
      if (profiles.status === 'fulfilled' && proxyConfig.status === 'fulfilled') {
        const selected = profiles.value.find((profile) => profile.id === proxyConfig.value.globalProfileId);
        results.push({ id: 'proxyConfig', label: { fa: 'تنظیم پروکسی', en: 'Proxy setup' }, status: selected ? 'pass' : 'unknown', detailKey: selected ? 'proxyConfigured' : 'proxyMissing', detailValues: selected ? { name: selected.name } : undefined });
      } else results.push({ id: 'proxyConfig', label: { fa: 'خواندن تنظیم پروکسی', en: 'Proxy setup' }, status: 'fail' });
      results.push({ id: 'modelConnections', label: { fa: 'اتصال‌های مدل', en: 'Model connections' }, status: connections.status === 'fulfilled' ? 'pass' : 'fail', ...(connections.status === 'fulfilled' ? { detailKey: 'modelsCount', detailValues: { count: connections.value.length } } : {}) });
      setChecks(results);
    } catch (e) { setError(e); }
    finally { busy.current = false; setRunning(false); }
  };
  const tone = { pass: 'success', fail: 'danger', unknown: 'muted', skipped: 'neutral' } as const;
  const detailFor = (check: Check) => check.detailKey ? t(`journeyUx:doctor.${check.detailKey}`, check.detailValues ?? {}) : sanitizeReportText(check.detail ?? '');
  const labelFor = (check: Check) => check.id === 'focusedTool' ? check.label[language] : t(`doctor:checks.${check.id}`, { defaultValue: check.label[language] ?? check.id });
  const relatedLink = (id: string) => id === 'focusedTool' && searchParams.get('kind') === 'app' ? `/app/${encodeURIComponent(searchParams.get('tool') ?? '')}` : id.startsWith('app-') ? `/app/${id.slice(4)}` : id === 'proxyConfig' || id === 'proxy' ? '/proxy' : id === 'modelConnections' ? '/models' : id === 'apps' || id === 'rtlAdapters' ? '/discover' : id === 'editors' ? '/' : '/settings';
  const copyReport = async () => {
    if (!checks) return;
    try {
      const text = checks.map((check) => `${check.status.toUpperCase()} ${labelFor(check)} — ${detailFor(check)}`).join('\n');
      await navigator.clipboard.writeText(`VibeHub Doctor ${new Date().toISOString()}\n${sanitizeReportText(text)}`);
      setCopyStatus('success');
    } catch { setCopyStatus('error'); }
  };

  return <div className="space-y-6">
    <PageHeader title={t('doctor:title')} description={t('doctor:subtitle')} actions={<div className="flex flex-wrap gap-2"><Button variant="primary" loading={running} onClick={() => void run()}><Play size={14} aria-hidden="true" />{t('doctor:runChecks')}</Button><Button disabled={!checks || running} onClick={() => void copyReport()}><ClipboardCopy size={14} aria-hidden="true" />{t('doctor:copyReport')}</Button></div>} />
    <Card className="space-y-3"><p>{t('doctor:purpose')}</p><p className="text-sm leading-7 text-muted">{t('doctor:networkNote')}</p></Card>
    {error != null && <ErrorNotice error={error} onRetry={() => void run()} />}
    {copyStatus && <p role={copyStatus === 'error' ? 'alert' : 'status'} className="text-sm">{t(copyStatus === 'success' ? 'journeyUx:doctor.copySuccess' : 'journeyUx:doctor.copyFailure')}</p>}
    {!checks ? <p role="status" className="text-sm text-muted">{running ? t('doctor:running') : t('journeyUx:doctor.notRun')}</p> : <>
      <p role="status" className="text-sm text-muted">{t('journeyUx:doctor.summary', { count: checks.length })}</p>
      <Card><ul className="divide-y divide-border">{checks.map((check) => <li key={check.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
        <div className="flex flex-wrap items-center gap-3"><Badge tone={tone[check.status]}>{t(`common:${check.status === 'pass' ? 'pass' : check.status === 'fail' ? 'fail' : check.status === 'unknown' ? 'unknown' : 'skipStatus'}`)}</Badge><h2 className="font-bold">{labelFor(check)}</h2></div>
        {detailFor(check) && <p dir="auto" className="break-words text-sm leading-7 text-muted">{detailFor(check)}</p>}
        <p className="text-sm leading-7 text-muted">{t(check.id === 'focusedTool' ? 'doctor:nextActions.focusedTool' : check.status === 'pass' ? 'doctor:nextActions.pass' : check.status === 'fail' ? `doctor:nextActions.${check.id}` : 'doctor:nextActions.review', { defaultValue: t('doctor:nextActions.default') })}</p>
        {check.status !== 'pass' && <Link to={relatedLink(check.id)} className="inline-block text-sm text-primary hover:underline">{t('journeyUx:doctor.openSetting')}</Link>}
      </li>)}</ul><p className="mt-5 border-t border-border pt-4 text-xs text-muted">{t('doctor:noSecrets')}</p></Card>
    </>}
  </div>;
}
