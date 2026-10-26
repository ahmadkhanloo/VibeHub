import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCopy, Play } from 'lucide-react';
import { Badge, Button, Card, SectionTitle } from '@/components/ui';
import { ipc } from '@/services/ipc';
import type { DoctorCheck } from '@core';

export function DoctorPage() {
  const { t } = useTranslation(['doctor', 'common']);
  const [checks, setChecks] = useState<DoctorCheck[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      setChecks(await ipc.doctorRun());
    } catch (e) {
      setChecks([{ id: 'crash', label: { fa: 'خطای اجرا', en: 'run failed' }, status: 'fail', detail: String(e) }]);
    } finally {
      setRunning(false);
    }
  };

  const tone = { pass: 'success', fail: 'danger', unknown: 'muted', skipped: 'neutral' } as const;

  const copyReport = async () => {
    if (!checks) return;
    const text = checks.map((c) => `${c.status.toUpperCase()} ${c.id}${c.detail ? ` — ${c.detail}` : ''}`).join('\n');
    await navigator.clipboard.writeText(`VibeHub Doctor ${new Date().toISOString()}\n${text}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t('doctor:title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('doctor:subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" loading={running} onClick={() => void run()}><Play size={14} /> {t('doctor:runChecks')}</Button>
          <Button disabled={!checks} onClick={() => void copyReport()}><ClipboardCopy size={14} /> {t('doctor:copyReport')}</Button>
        </div>
      </div>

      {checks === null ? (
        <p className="text-sm text-muted">{running ? t('doctor:running') : '—'}</p>
      ) : (
        <Card>
          <div className="space-y-2">
            {checks.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 text-sm">
                <Badge tone={tone[c.status]}>{t(`common:${c.status === 'pass' ? 'pass' : c.status === 'fail' ? 'fail' : c.status === 'unknown' ? 'unknown' : 'skipStatus'}`)}</Badge>
                <span className="min-w-40">{t(`doctor:checks.${c.id}`, { defaultValue: c.id })}</span>
                {c.detail && <span className="ltr-tech min-w-0 flex-1 truncate text-xs text-muted" title={c.detail}>{c.detail}</span>}
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted">{t('doctor:noSecrets')}</p>
        </Card>
      )}
    </div>
  );
}
