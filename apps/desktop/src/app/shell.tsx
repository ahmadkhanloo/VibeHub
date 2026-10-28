import { FeedActivity } from './FeedActivity';
import { ipc } from '@/services/ipc';
import { Tooltip } from '@/components/Tooltip';
import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Compass,
  House,
  Languages,
  PanelLeftClose,
  PanelLeftOpen,
  Network,
  Search,
  Settings,
  Stethoscope,
  Boxes,
  Bell,
  Users,
} from "lucide-react";
import { useSettings } from "./settings";
import { AccountsNotice } from '@/features/accounts/AccountsNotice';
import { Button, Spinner } from "@/components/ui";
import vibeHubMark from "@/assets/vibehub-mark.svg";
export function AppShell() {
  const { t } = useTranslation(["ux", "nav", "common"]);
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(true);
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
    const mq = matchMedia("(max-width:1199px)");
    const resize = () => { if (mq.matches) setCollapsed(true); };
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
  useEffect(() => { void (async () => { for (const id of ['qoder', 'zcode']) { try { await ipc.appAccounts(id, 'list'); } catch { /* The accounts page supplies actionable diagnostics. */ } } })(); }, []);
  const items = [
    { to: "/", icon: House, label: t("ux:workspace") },
    { to: "/discover", icon: Compass, label: t("ux:discover") },
    { to: "/models", icon: Boxes, label: t("ux:models") },
    { to: "/accounts", icon: Users, label: t("accounts:title") },
    { to: "/proxy", icon: Network, label: t("ux:proxy") },
    { to: "/guides", icon: BookOpen, label: t("ux:guides") },
    { to: "/doctor", icon: Stethoscope, label: t("ux:doctor") },
  ];
  const link = (item: (typeof items)[number]) => (
    <Tooltip key={item.to} text={item.label}><NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/"}
      aria-label={item.label}
      className="vh-nav-link"
    >
      <item.icon aria-hidden="true" size={20} />
      <span className="vh-nav-label">{item.label}</span>
    </NavLink></Tooltip>
  );
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
        <div className="mb-8 flex items-center gap-3 px-2 pt-1">
          <img
            src={vibeHubMark}
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
          />
          {!collapsed && (
            <span className="text-lg font-bold" dir={settings.language === 'fa' ? 'rtl' : 'ltr'}>
              {t('common:appName')}
            </span>
          )}
        </div>
        <nav aria-label={t("ux:mainNav")} className="flex-1 space-y-1">
          {items.map(link)}
        </nav>
        <div className="mt-6 space-y-1 border-t border-border pt-4">
          {link({ to: "/offers", icon: Bell, label: t("ux:offers") })}
          {link({ to: "/settings", icon: Settings, label: t("ux:settings") })}
          <Button
            variant="ghost"
            className="w-full vh-sidebar-toggle"
            aria-expanded={!collapsed}
            aria-label={t(collapsed ? "nav:expand" : "nav:collapse")}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" size={18} />
            ) : (
              <PanelLeftClose aria-hidden="true" size={18} />
            )}
            <span className="vh-nav-label">{t("nav:collapse")}</span>
          </Button>
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
        <AccountsNotice />
        <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
