import { SearchButton } from '@/features/explore/SearchButton';
import { FeedActivity } from './FeedActivity';
import { Tooltip } from '@/components/Tooltip';
import { Suspense, useEffect, useRef, useState, type RefObject } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  House,
  BookOpen,
  Newspaper,
  Wrench,
  Languages,
  GraduationCap,
  Hammer,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { useSettings } from './settings';
import { useCatalog } from '@/lib/catalog';
import { learningView } from '@/features/learning/sections';
import { Button, Spinner } from '@/components/ui';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WindowControls, useNativeWindow } from './WindowTitlebar';
import vibeHubMark from '@/assets/vibehub-mark.svg';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  /** Longer wording for the collapsed rail, where the label is an icon only. */
  hint?: string;
}

interface NavGroup {
  id: string;
  caption?: string;
  items: NavItem[];
}

function RouteView({ main }: { main: RefObject<HTMLElement | null> }) {
  const { pathname, hash } = useLocation();
  const hasAnchor = Boolean(hash);
  useEffect(() => {
    if (hasAnchor) return;
    // Wait for the lazy page and for any closing dialog to restore its focus.
    const frame = requestAnimationFrame(() => {
      const content = main.current;
      // A user can reach the newly mounted controls before the next frame.
      if (content?.contains(document.activeElement)) return;
      content?.scrollTo(0, 0);
      const target = content?.querySelector<HTMLElement>('h1') ?? content;
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [main, pathname, hasAnchor]);
  return <Outlet />;
}

export function AppShell() {
  const { t } = useTranslation(['ux', 'nav', 'common', 'workshop', 'learning']);
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const native = useNativeWindow();
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width:1099px)').matches);
  const [railOnly, setRailOnly] = useState(() => matchMedia('(max-width:700px)').matches);
  const [sidebarChoice, setSidebarChoice] = useState<boolean>();
  const collapsed = railOnly || (sidebarChoice ?? narrow);
  const logo = useRef<HTMLButtonElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const compact = matchMedia('(max-width:1099px)');
    const iconsOnly = matchMedia('(max-width:700px)');
    const resize = () => { setNarrow(compact.matches); setRailOnly(iconsOnly.matches); };
    compact.addEventListener('change', resize);
    iconsOnly.addEventListener('change', resize);
    return () => {
      compact.removeEventListener('change', resize);
      iconsOnly.removeEventListener('change', resize);
    };
  }, []);

  const changeSidebar = (close: boolean) => {
    setSidebarChoice(close);
    requestAnimationFrame(() => (close ? logo.current : toggle.current)?.focus());
  };

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const scroll = () => {
      const target = document.getElementById(id);
      if (!target) return false;
      target.scrollIntoView({ block: 'start' });
      return true;
    };
    if (scroll() || !main.current) return;
    const observer = new MutationObserver(() => { if (scroll()) observer.disconnect(); });
    observer.observe(main.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname, location.search, location.hash]);

  const { articles } = useCatalog();
  const article = articles.find(article => location.pathname === `/learning/${article.id}`);
  const currentLearningView = learningView(new URLSearchParams(location.search), article);

  // Workshop mode narrows the sidebar to the beginner path: the four primary
  // destinations replace the full tool surface, and Settings stays in the
  // footer so the mode can be turned off from the same place it was enabled.
  const groups: NavGroup[] = settings.workshopMode
    ? [
        {
          id: 'workshop',
          items: [
            { to: '/', icon: House, label: t('nav:home') },
            { to: '/workshop', icon: Hammer, label: t('workshop:title') },
            { to: '/learning', icon: GraduationCap, label: t('learning:guidesView') },
            { to: '/connections/api', icon: Network, label: t('ux:apiNotebook') },
          ],
        },
      ]
    : [
        {
          id: 'workspace',
          items: [
            { to: '/', icon: House, label: t('ux:workspace'), hint: t('ux:workspace') },
            { to: '/tools', icon: Wrench, label: t('nav:helpers') },
          ],
        },
        {
          id: 'connections',
          caption: t('nav:groups.connections'),
          items: [
            { to: '/accounts', icon: UsersRound, label: t('nav:accounts'), hint: t('nav:accountsHint') },
            { to: '/connections/api', icon: Network, label: t('ux:apiNotebook'), hint: t('ux:apiNotebook') },
            { to: '/connections/proxy', icon: Shield, label: t('nav:proxy') },
          ],
        },
        {
          id: 'learn',
          caption: t('nav:groups.learn'),
          items: [
            { to: '/learning', icon: GraduationCap, label: t('learning:guidesView') },
            { to: '/learning?view=reference', icon: BookOpen, label: t('learning:referenceView') },
            { to: '/learning?view=news', icon: Newspaper, label: t('learning:newsView') },
          ],
        },
      ];

  const link = (item: NavItem) => {
    const learningTarget = item.to === '/learning' ? 'guides'
      : item.to === '/learning?view=reference' ? 'reference'
      : item.to === '/learning?view=news' ? 'news' : null;
    const currentView = learningTarget !== null && currentLearningView === learningTarget;
    const exact = learningTarget ? location.pathname === '/learning' && currentView : location.pathname === item.to;
    const section = (item.to === '/' && location.pathname.startsWith('/app/')) ||
      (currentView && location.pathname.startsWith('/learning/'));
    const content = (
      <Link
        key={item.to}
        to={item.to}
        aria-current={exact ? 'page' : section ? 'location' : undefined}
        aria-label={item.label}
        title={!collapsed && item.hint ? item.hint : undefined}
        className={'vh-nav-link' + (section ? ' is-active' : '')}
      >
        <item.icon aria-hidden="true" size={18} />
        <span className="vh-nav-label">{item.label}</span>
      </Link>
    );
    return collapsed
      ? <Tooltip key={item.to} text={item.hint ?? item.label} placement="side">{content}</Tooltip>
      : content;
  };

  return (
    <div className="vh-shell">
      <a
        className="vh-skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        {t('ux:skipMain')}
      </a>
      <header className="vh-topbar" data-native={native || undefined}>
        <SearchButton />
        <span className="vh-topbar-drag" data-tauri-drag-region aria-hidden="true" />
        <Button
          variant="ghost"
          className="vh-language-toggle"
          aria-label={t(settings.language === 'fa' ? 'common:switchLanguageToEnglish' : 'common:switchLanguageToPersian')}
          title={t(settings.language === 'fa' ? 'common:switchLanguageToEnglish' : 'common:switchLanguageToPersian')}
          onClick={() => update({ language: settings.language === 'fa' ? 'en' : 'fa' })}
        >
          <Languages aria-hidden="true" size={16} />
          {settings.language === 'fa' ? 'English' : 'فارسی'}
        </Button>
        <ThemeToggle />
        <WindowControls />
      </header>
      <div className="vh-shell-body">
        <aside className={'vh-sidebar ' + (collapsed ? 'collapsed' : '')}>
          <div className="vh-sidebar-brand">
            <button
              ref={logo}
              type="button"
              className="vh-sidebar-logo"
              aria-label={t(collapsed && !railOnly ? 'nav:expand' : 'common:appName')}
              title={t(collapsed && !railOnly ? 'nav:expand' : 'nav:home')}
              aria-expanded={collapsed && !railOnly ? false : undefined}
              onClick={() => {
                if (collapsed && !railOnly) changeSidebar(false);
                else navigate('/');
              }}
            >
              <img src={vibeHubMark} alt="" aria-hidden="true" width={28} height={28} />
              {collapsed && !railOnly && <PanelLeftOpen className="vh-sidebar-logo-expand" aria-hidden="true" size={18} />}
            </button>
            {!collapsed && (
              <div className="vh-brand-copy">
                <span dir={settings.language === 'fa' ? 'rtl' : 'ltr'}>{t('common:appName')}</span>
              </div>
            )}
            {!collapsed && (
              <Button
                ref={toggle}
                variant="ghost"
                className="vh-sidebar-toggle"
                aria-expanded="true"
                aria-label={t('nav:collapse')}
                title={t('nav:collapse')}
                onClick={() => changeSidebar(true)}
              >
                <PanelLeftClose aria-hidden="true" size={18} />
              </Button>
            )}
          </div>
          <nav aria-label={t('ux:mainNav')} className="vh-nav">
            {groups.map((group) => (
              <div key={group.id} className="vh-nav-group">
                {group.caption && !collapsed && (
                  <>
                    <span className="sr-only">{group.caption}</span>
                    <hr className="vh-nav-sep" aria-hidden="true" />
                  </>
                )}
                {group.items.map(link)}
              </div>
            ))}
          </nav>
          <div className="vh-nav-footer">
            {link({ to: '/settings', icon: Settings, label: t('ux:settings') })}
          </div>
        </aside>
        <div className="vh-shell-main">
          <main id="main-content" ref={main} tabIndex={-1} className="vh-main">
            <div className="vh-content">
              <FeedActivity />
              <Suspense fallback={<Spinner />}>
                <RouteView main={main} />
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
