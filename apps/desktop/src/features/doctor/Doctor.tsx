import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, ErrorNotice } from '@/components/ui';
import { ipc } from '@/services/ipc';
import type { DoctorCheck } from '@core';

export function WindowsChecks() {
  const { t, i18n } = useTranslation(['doctor', 'common', 'journeyUx']);
  const [checks, setChecks] = useState<DoctorCheck[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [copyStatus, setCopyStatus] = useState<'success' | 'error'>();
  const lang = i18n.language.startsWith('fa') ? 'fa' : 'en';
  const run = async () => {
    setRunning(true);
    setError(null);
    setCopyStatus(undefined);
    setChecks([]);
    try {
      setChecks((await ipc.doctorRun()).filter(check => check.id === 'node' || check.id === 'winget'));
    } catch (cause) {
      // Native errors can include local paths. Use a localized message.
      setError(t('doctor:nativeUnavailable'));
    } finally {
      setRunning(false);
    }
  };
  const status = (check: DoctorCheck) => t('common:' + (check.status === 'skipped' ? 'skipStatus' : check.status));
  const copy = async () => {
    try {
      const summary = checks.map(check => check.id + ' — ' + status(check)).join('\n');
      await navigator.clipboard.writeText('VibeHub — Windows\n' + summary);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }
  };
  return <Card as="section" className="space-y-4">
    <h2 className="text-lg font-bold">{t('doctor:windowsPrereqs')}</h2>
    <p className="text-sm text-muted">{t('doctor:windowsPrereqsHint')}</p>
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" loading={running} onClick={() => void run()}>{t('doctor:runChecks')}</Button>
      <Button disabled={running || !checks.length} onClick={() => void copy()}>{t('doctor:copyReport')}</Button>
    </div>
    {error != null && <ErrorNotice error={error} message={String(error)} onRetry={() => void run()} />}
    {copyStatus && <p role="status">{t(copyStatus === 'success' ? 'journeyUx:doctor.copySuccess' : 'journeyUx:doctor.copyFailure')}</p>}
    <ul>{checks.map(check => <li key={check.id} className="flex items-center gap-3 py-2">
      <bdi>{check.label[lang]}</bdi><Badge tone={check.status === 'pass' ? 'success' : check.status === 'fail' ? 'danger' : 'muted'}>{status(check)}</Badge>
    </li>)}</ul>
  </Card>;
}
