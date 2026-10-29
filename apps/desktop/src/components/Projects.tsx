import { preferredLaunchMode } from '@core';
import { useCatalog } from '@/lib/catalog';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettings } from '@/app/settings';
import { useToolContext } from '@/app/tool-context';
import { Button, ErrorNotice, Select } from './ui';

export function Projects({ appId }: { appId?: string }) {
  const { t } = useTranslation('ux');
  const { settings, update } = useSettings();
  const ctx = useToolContext();
  const catalog = useCatalog();
  const [target, setTarget] = useState(appId ?? '');
  const [error, setError] = useState<unknown>(null);
  const installed = ctx.apps.filter(app => app.installed && app.id !== 'chatgpt');
  const selected = appId ?? (installed.some(app => app.id === target) ? target : installed[0]?.id ?? '');
  const launch = async (path: string) => {
    setError(null);
    const state = ctx.states[selected];
    const mode = state?.phase === 'running'
      ? state.rtl ? 'rtl' : 'normal'
      : preferredLaunchMode(settings.launchModeByApp[selected], catalog.apps.some(app => app.id === selected && app.capabilities.rtl === 'verified'), ctx.components.some(item => item.id === selected && item.available));
    if (await ctx.launch(selected, 'app', mode, path)) update(current => ({ recentProjects: [path, ...current.recentProjects.filter(item => item !== path)].slice(0, 6) }));
  };
  if (appId === 'chatgpt') return null;
  return <section className="vh-card space-y-4" aria-label={t('projects')}>
    <h2 className="font-bold">{t('projects')}</h2>
    <div className="flex flex-wrap gap-3 items-end">
      {!appId && <label className="space-y-2"><span className="block text-sm">{t('openWith')}</span><Select value={selected} onChange={setTarget} options={installed.map(app => ({ value: app.id, label: catalog.apps.find(item => item.id === app.id)?.name ?? app.id }))} /></label>}
      <Button disabled={!installed.some(app => app.id === selected) || !!ctx.busy['app:' + selected]} onClick={async () => { try { setError(null); const path = await open({ directory: true, multiple: false, title: t('chooseProject') }); if (typeof path === 'string') await launch(path); } catch (cause) { setError(cause); } }}>{t('chooseProject')}</Button>
    </div>
    {error != null && <ErrorNotice error={error} />}
    <ul className="space-y-2">{settings.recentProjects.map(path => <li key={path} className="flex items-center gap-3">
      <Button className="min-w-0 flex-1 justify-start" disabled={!selected || !!ctx.busy['app:' + selected]} onClick={() => void launch(path)}><bdi className="truncate">{path}</bdi></Button>
      <Button variant="ghost" aria-label={t('forgetProject', { path })} onClick={() => update({ recentProjects: settings.recentProjects.filter(item => item !== path) })}>{t('common:delete')}</Button>
    </li>)}</ul>
    {ctx.failures['app:' + selected] && <><ErrorNotice error={ctx.failures['app:' + selected]} /><Link className="vh-link" to={'/doctor?tool=' + selected + '&kind=app'}>{t('doctor')}</Link></>}
  </section>;
}
