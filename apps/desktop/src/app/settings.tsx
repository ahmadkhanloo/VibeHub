// Settings + theme engine. Preferences persist in the webview's localStorage
// (kept under the app's own data dir by WebView2) and apply instantly — no
// restart needed (plan §3.2/§3.3).

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { changeLanguage, type AppLanguage } from "@/i18n";

export type ThemeFamily = "graphite" | "nord" | "catppuccin" | "solarized";
export type ThemeModeSetting = "system" | "light" | "dark";
export type Accent = "auto" | "indigo" | "emerald" | "violet" | "amber";
export type ResolvedMode = "light" | "dark";

export interface AppSettings {
  launchModeByApp: Record<string, "normal" | "rtl">;
  language: AppLanguage;
  themeFamily: ThemeFamily;
  themeMode: ThemeModeSetting;
  accent: Accent;
  density: "comfortable" | "compact";
  textSize: "sm" | "md" | "lg";
  onboardingDone: boolean;
  nativeNotifications: boolean;
  quietHours: { enabled: boolean; from: string; to: string };
  autoUpdateCheck: boolean;
  feedBaseUrl: string;
}

const DEFAULTS: AppSettings = {
  launchModeByApp: {},
  language: "en",
  themeFamily: "graphite",
  themeMode: "system",
  accent: "auto",
  density: "comfortable",
  textSize: "md",
  onboardingDone: false,
  nativeNotifications: false,
  quietHours: { enabled: false, from: "22:00", to: "08:00" },
  autoUpdateCheck: true,
  feedBaseUrl: "https://ahmadkhanloo.github.io/VibeHub/feed",
};

const STORAGE_KEY = "vibehub.settings.v1";

function detectDefaultLanguage(): AppLanguage {
  return navigator.language?.toLowerCase().startsWith("fa") ? "fa" : "en";
}

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, language: detectDefaultLanguage() };
    const parsed = JSON.parse(raw);
    const launchModeByApp = Object.fromEntries(
      Object.entries(parsed.launchModeByApp ?? {}).filter(
        ([id, mode]) =>
          /^[a-z0-9-]+$/.test(id) && (mode === "normal" || mode === "rtl"),
      ),
    );
    return {
      ...DEFAULTS,
      ...parsed,
      launchModeByApp,
      language: ["fa", "en"].includes(parsed.language)
        ? parsed.language
        : detectDefaultLanguage(),
      themeFamily: ["graphite", "nord", "catppuccin", "solarized"].includes(
        parsed.themeFamily,
      )
        ? parsed.themeFamily
        : DEFAULTS.themeFamily,
      themeMode: ["system", "light", "dark"].includes(parsed.themeMode)
        ? parsed.themeMode
        : DEFAULTS.themeMode,
      accent: ["auto", "indigo", "emerald", "violet", "amber"].includes(
        parsed.accent,
      )
        ? parsed.accent
        : DEFAULTS.accent,
      quietHours: {
        ...DEFAULTS.quietHours,
        ...(parsed.quietHours && typeof parsed.quietHours === "object"
          ? parsed.quietHours
          : {}),
      },
    } as AppSettings;
  } catch {
    return { ...DEFAULTS, language: detectDefaultLanguage() };
  }
}

interface SettingsCtx {
  settings: AppSettings;
  update: (
    patch:
      | Partial<AppSettings>
      | ((current: AppSettings) => Partial<AppSettings>),
  ) => void;
  resolvedMode: ResolvedMode;
}

const Ctx = createContext<SettingsCtx | null>(null);

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(load);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedMode: ResolvedMode =
    settings.themeMode === "system"
      ? systemDark
        ? "dark"
        : "light"
      : settings.themeMode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.themeFamily;
    root.dataset.mode = resolvedMode;
    root.dataset.accent = settings.accent;
    root.dataset.density = settings.density;
    root.dataset.textSize = settings.textSize;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* Session preferences still work when persistence is unavailable. */
    }
    changeLanguage(settings.language);
  }, [settings, resolvedMode]);

  const value = useMemo<SettingsCtx>(
    () => ({
      settings,
      update: (patch) =>
        setSettings((s) => ({
          ...s,
          ...(typeof patch === "function" ? patch(s) : patch),
        })),
      resolvedMode,
    }),
    [settings, resolvedMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings outside SettingsProvider");
  return ctx;
}
