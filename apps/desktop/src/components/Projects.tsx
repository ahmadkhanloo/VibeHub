import { preferredLaunchMode, rtlAdapterAvailable, rtlAdapterConfigured, type LaunchMode } from '@core';
import { useCatalog } from '@/lib/catalog';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettings } from '@/app/settings';
import { useToolContext } from '@/app/tool-context';
import { Button, ErrorNotice, Select } from './ui';
import { Disclosure } from './Disclosure';

export function Projects({ appId }: { appId: string }) {
  const { t } = useTranslation('ux');
  const { settings, update } = useSettings();
  const ctx = useToolContext();
  const catalog = useCatalog();
  const [choice, setChoice] = useState<{ id: string; mode: LaunchMode } | null>(null);
  const [error, setError] = useState<unknown>(null);
  if (['chatgpt', 'claude-desktop', 'minimax-code'].includes(appId) || !ctx.apps.some(app => app.installed && app.id === appId)) return null;
  const selected = appId;
  const state = ctx.states[selected];
  const supportsRtl = rtlAdapterAvailable(selected, ctx.components);
  const rtlReady = rtlAdapterConfigured(selected, ctx.components);
  const verified = catalog.apps.some(app => app.id === selected && app.capabilities.rtl === 'verified');
  const mode = state?.phase === 'running' ? state.rtl ? 'rtl' : 'normal' : choice?.id === selected ? choice.mode : preferredLaunchMode(settings.launchModeByApp[selected], verified, rtlReady);
  const blocked = !state || state.phase === 'starting' || !!ctx.busy['app:' + selected] || (mode === 'rtl' && !rtlReady);
  const launch = async (path: string) => {
    setError(null);
    if (await ctx.launch(selected, 'app', mode, path)) update(current => ({ recentProjects: [path, ...current.recentProjects.filter(item => item !== path)].slice(0, 6) }));
  };
  return <Disclosure title={t('projects')} id="app-projects">
    <div className="flex flex-wrap gap-3 items-end">
      {supportsRtl && <label className="space-y-2"><span className="block text-sm">{t('common:mode')}</span><Select<LaunchMode> value={mode} disabled={state?.phase === 'running'} onChange={mode => setChoice({ id: selected, mode })} options={[{ value: 'normal', label: t('normal') }, { value: 'rtl', label: t('runRtl') }]} /></label>}
      <Button disabled={blocked} onClick={async () => { try { setError(null); const path = await open({ directory: true, multiple: false, title: t('chooseProject') }); if (typeof path === 'string') await launch(path); } catch (cause) { setError(cause); } }}>{t('chooseProject')}</Button>
    </div>
    {error != null && <ErrorNotice error={error} />}
    <ul className="space-y-2">{settings.recentProjects.map(path => <li key={path} className="flex items-center gap-3">
      <Button className="min-w-0 flex-1 justify-start" disabled={blocked} onClick={() => void launch(path)}><bdi className="truncate">{path}</bdi></Button>
      <Button variant="ghost" aria-label={t('forgetProject', { path })} onClick={() => update({ recentProjects: settings.recentProjects.filter(item => item !== path) })}>{t('common:delete')}</Button>
    </li>)}</ul>
  </Disclosure>;
}
