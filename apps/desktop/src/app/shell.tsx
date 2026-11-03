
import { FeedActivity } from './FeedActivity';
import { Tooltip } from '@/components/Tooltip';
import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  House,
  Languages,
  GraduationCap,
  Hammer,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Shield,
  Sparkles,
  Stethoscope,
  Terminal,
} from "lucide-react";
import { useSettings } from "./settings";
import { Button, Spinner } from "@/components/ui";
import vibeHubMark from "@/assets/vibehub-mark.svg";
export function AppShell() {
  const { t } = useTranslation(["ux", "nav", "common", "workshop"]);
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => matchMedia("(max-width:1099px)").matches);
  const sidebarChosen = useRef(false);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    setQuery(new URLSearchParams(location.search).get("q") ?? "");
  }, [location.pathname, location.search]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    const mq = matchMedia("(max-width:1099px)");
    const resize = () => { if (mq.matches || !sidebarChosen.current) setCollapsed(mq.matches); };
    mq.addEventListener("change", resize);
    return () => {
      window.removeEventListener("keydown", key);
      mq.removeEventListener("change", resize);
    };
  }, []);
  useEffect(() => {
    main.current?.scrollTo(0, 0);
    const heading = main.current?.querySelector<HTMLElement>("h1");
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }, [location.pathname]);
  // Workshop mode narrows the sidebar to the beginner path: the five primary
  // destinations replace the full tool surface, and Settings stays in the
  // footer so the mode can be turned off from the same place it was enabled.
  const items = settings.workshopMode ? [
    { to: "/", icon: House, label: t("nav:home") },
    { to: "/workshop", icon: Hammer, label: t("workshop:title") },
    { to: "/learning", icon: GraduationCap, label: t("nav:learning") },
    { to: "/connections/api", icon: Network, label: t("nav:models") },
  ] : [
    { to: "/", icon: House, label: t("ux:workspace") },
    { to: "/connections/api", icon: Network, label: t("ux:apiNotebook") },
    { to: "/connections/proxy", icon: Shield, label: t("nav:proxy") },
    { to: "/offers", icon: Sparkles, label: t("nav:offers") },
    { to: "/terminal", icon: Terminal, label: t("nav:terminal") },
    { to: "/doctor", icon: Stethoscope, label: t("nav:doctor") },
    { to: "/learning", icon: GraduationCap, label: t("nav:learning") },
  ];
  const link = (item: (typeof items)[number]) => {
    const content = <NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/"}
      aria-label={item.label}
      className={({isActive}) => 'vh-nav-link' + ((isActive || (item.to === '/learning' && (location.pathname.startsWith('/learning/') || location.pathname.startsWith('/guides')))) ? ' is-active' : '')}
    >
      <item.icon aria-hidden="true" size={20} />
      <span className="vh-nav-label">{item.label}</span>
    </NavLink>;
    return collapsed ? <Tooltip key={item.to} text={item.label}>{content}</Tooltip> : content;
  };
  return (
    <div className="flex h-full overflow-hidden">
      <a
        className="vh-skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        {t("ux:skipMain")}
      </a>
      <aside className={"vh-sidebar " + (collapsed ? "collapsed" : "")}>
        <div className="vh-sidebar-brand">
          <button type="button" className="vh-sidebar-logo" aria-label={t(collapsed ? "nav:expand" : "common:appName")} title={collapsed ? t("nav:expand") : undefined} aria-expanded={!collapsed} onClick={() => { if (collapsed) { sidebarChosen.current = true; setCollapsed(false); } else navigate('/'); }}>
            <img src={vibeHubMark} alt="" aria-hidden="true" width={32} height={32} />
            {collapsed && <PanelLeftOpen className="vh-sidebar-logo-expand" aria-hidden="true" size={18} />}
          </button>
          {!collapsed && (
            <div className="vh-brand-copy"><span dir={settings.language === 'fa' ? 'rtl' : 'ltr'}>{t('common:appName')}</span><small>{t('workbench:brandCaption')}</small></div>
          )}
          {!collapsed && <Button variant="ghost" className="vh-sidebar-toggle" aria-expanded="true" aria-label={t("nav:collapse")} title={t("nav:collapse")} onClick={() => { sidebarChosen.current = true; setCollapsed(true); }}><PanelLeftClose aria-hidden="true" size={18} /></Button>}
        </div>
        <nav aria-label={t("ux:mainNav")} className="flex-1 space-y-1">
          {items.map(link)}
        </nav>
        <div className="mt-6 space-y-1 border-t border-border pt-4">
          {link({ to: "/settings", icon: Settings, label: t("ux:settings") })}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="vh-topbar">
          <form
            role="search"
            className="relative vh-search-form"
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/search?q=" + encodeURIComponent(query.trim()));
            }}
          >
            <label className="sr-only" htmlFor="global-search">
              {t("ux:searchLabel")}
            </label>
            <Search
              aria-hidden="true"
              size={18}
              className="pointer-events-none absolute start-3 top-3 text-muted"
            />
            <input
              id="global-search"
              ref={search}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ux:searchLabel")}
              className="vh-input vh-global-search"
            />
            <kbd
              aria-hidden="true"
              className="absolute end-3 top-3 text-xs text-muted"
            >
              <bdi>Ctrl K</bdi>
            </kbd>
          </form>
          <Button
            variant="ghost"
            className="vh-language-toggle"
            aria-label={t(settings.language === 'fa' ? 'common:switchLanguageToEnglish' : 'common:switchLanguageToPersian')}
            title={t(
              settings.language === "fa"
                ? "common:switchLanguageToEnglish"
                : "common:switchLanguageToPersian",
            )}
            onClick={() =>
              update({ language: settings.language === "fa" ? "en" : "fa" })
            }
          >
            <Languages aria-hidden="true" size={18} />
            {settings.language === "fa" ? "English" : "فارسی"}
          </Button>
        </header>
        <main id="main-content" ref={main} tabIndex={-1} className="vh-main">
          <div className="vh-content">
            <Suspense fallback={<Spinner />}>

        <FeedActivity />
        <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
