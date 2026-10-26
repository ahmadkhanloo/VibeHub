// App shell: sidebar (mirrors in RTL), topbar with global search + proxy
// shortcut + offers bell. Ctrl+K focuses search (plan §3.4, §4.1).
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell, BookOpen, Compass, Gift, HardDriveDownload, Home, Languages, PanelLeftClose, PanelLeftOpen,
  Plug, Search, Settings as SettingsIcon, Stethoscope, Terminal as TerminalIcon,
} from 'lucide-react';
import { useSettings } from '@/app/settings';
import { apps } from '@/lib/catalog';
import { Badge } from '@/components/ui';

export function AppShell() {
  const { t } = useTranslation(['nav', 'common']);
  const { settings, update } = useSettings();
  const [collapsed, setCollapsed] = useState(false);
  const [langHover, setLangHover] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = [
    { to: '/', icon: Home, label: t('nav.home') },
    { to: '/discover', icon: Compass, label: t('nav.discover') },
    { to: '/my-apps', icon: HardDriveDownload, label: t('nav.myApps') },
    { to: '/models', icon: Plug, label: t('nav.models') },
    { to: '/terminal', icon: TerminalIcon, label: t('nav.terminal') },
    { to: '/guides', icon: BookOpen, label: t('nav.guides') },
    { to: '/offers', icon: Gift, label: t('nav.offers') },
    { to: '/doctor', icon: Stethoscope, label: t('nav.doctor') },
    { to: '/settings', icon: SettingsIcon, label: t('nav.settings') },
  ];

  return (
    <div className="flex h-full">
      <aside
        className={`flex shrink-0 flex-col border-border bg-surface transition-[width] duration-150 border-e ${
          collapsed ? 'w-[68px]' : 'w-[248px]'
        }`}
      >
        <div className="flex h-16 items-center gap-2 px-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary font-bold text-primary-foreground">V</div>
          {!collapsed && <span className="text-lg font-bold">VibeHub</span>}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-primary/15 text-primary font-medium' : 'text-text hover:bg-surface-alt'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-sm text-muted hover:bg-surface-alt"
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            {!collapsed && <span>{t('nav.collapse')}</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
          <div className="relative min-w-0 flex-1 max-w-xl">
            <Search size={15} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ltr:left-3 rtl:right-3" />
            <input
              ref={searchRef}
              placeholder={t('common.searchPlaceholder')}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                const q = (e.target as HTMLInputElement).value.trim();
                if (q) navigate(`/discover?q=${encodeURIComponent(q)}`);
              }}
              className="h-9 w-full rounded-[10px] border border-border bg-bg ps-9 pe-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1" />
          <NavLink to="/proxy" title={t('nav.proxyHint')} className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm text-muted hover:bg-surface-alt">
            <Plug size={16} />
            <span className="hidden md:inline">{t('nav.proxy')}</span>
          </NavLink>
          <NavLink to="/offers" title={t('nav.notifications')} className="relative rounded-[10px] p-2 text-muted hover:bg-surface-alt">
            <Bell size={17} />
          </NavLink>
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setLangHover(true)}
              onMouseLeave={() => setLangHover(false)}
              onClick={() => update({ language: settings.language === 'fa' ? 'en' : 'fa' })}
              className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm text-muted hover:bg-surface-alt"
              title={settings.language === 'fa' ? 'English' : 'فارسی'}
            >
              <Languages size={16} />
              {settings.language === 'fa' ? 'EN' : 'فا'}
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl vh-fade-in" key={settings.language}>
            <Outlet />
          </div>
        </main>
        <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border px-4 text-[11px] text-muted">
          <span>VibeHub — {t('common.freeOpenSource')} · MIT</span>
          <span className="flex items-center gap-1">
            <Badge tone="success">{apps.length}</Badge> {t('nav.discover')}
          </span>
        </footer>
      </div>
    </div>
  );
}
