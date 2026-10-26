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
} from "lucide-react";
import { useSettings } from "./settings";
import { Button, Spinner } from "@/components/ui";
import vibeHubMark from "@/assets/vibehub-mark.svg";
export function AppShell() {
  const { t } = useTranslation(["ux", "nav", "common"]);
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => matchMedia("(max-width:1199px)").matches,
  );
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
    const resize = () => setCollapsed(mq.matches);
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
  const items = [
    { to: "/", icon: House, label: t("ux:workspace") },
    { to: "/discover", icon: Compass, label: t("ux:discover") },
    { to: "/models", icon: Boxes, label: t("ux:models") },
    { to: "/proxy", icon: Network, label: t("ux:proxy") },
    { to: "/guides", icon: BookOpen, label: t("ux:guides") },
    { to: "/doctor", icon: Stethoscope, label: t("ux:doctor") },
  ];
  const link = (item: (typeof items)[number]) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === "/"}
      aria-label={item.label}
      title={collapsed ? item.label : undefined}
      className="vh-nav-link"
    >
      <item.icon aria-hidden="true" size={20} />
      <span className="vh-nav-label">{item.label}</span>
    </NavLink>
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
            <span className="text-lg font-bold" dir="ltr">
              VibeHub
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
            className="w-full"
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
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-6">
          <form
            role="search"
            className="relative max-w-2xl flex-1"
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
            aria-label={t(
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
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
