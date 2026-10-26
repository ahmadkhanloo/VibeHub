import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  DetectedApp,
  LaunchState,
  ProxyConfig,
  ProxyProfile,
  LaunchMode,
} from "@core";
import {
  ipc,
  type DetectedEditor,
  type RtlComponentStatus,
} from "@/services/ipc";
import { useSettings } from "./settings";
import { useCatalog } from "@/lib/catalog";
import { launchBlocked } from "@core";
interface ToolContext {
  apps: DetectedApp[];
  editors: DetectedEditor[];
  components: RtlComponentStatus[];
  profiles: ProxyProfile[];
  proxyConfig: ProxyConfig | null;
  loading: boolean;
  errors: string[];
  detectionFailed: boolean;
  states: Record<string, LaunchState | undefined>;
  busy: Record<string, boolean>;
  messages: Record<string, string>;
  failures: Record<string, string>;
  refresh: () => Promise<void>;
  refreshProxy: () => Promise<void>;
  saveToolProxy: (appId: string, profileId: string) => Promise<void>;
  launch: (
    id: string,
    kind: "app" | "editor",
    mode: LaunchMode,
  ) => Promise<void>;
  checkState: (id: string) => Promise<void>;
}
const Context = createContext<ToolContext | null>(null);
export function ToolProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState<DetectedApp[]>([]),
    [editors, setEditors] = useState<DetectedEditor[]>([]),
    [components, setComponents] = useState<RtlComponentStatus[]>([]);
  const [profiles, setProfiles] = useState<ProxyProfile[]>([]),
    [proxyConfig, setProxyConfig] = useState<ProxyConfig | null>(null);
  const [loading, setLoading] = useState(true),
    [errors, setErrors] = useState<string[]>([]),
    [detectionFailed, setDetectionFailed] = useState(false);
  const [states, setStates] = useState<Record<string, LaunchState | undefined>>(
      {},
    ),
    [busy, setBusy] = useState<Record<string, boolean>>({}),
    [messages, setMessages] = useState<Record<string, string>>({}),
    [failures, setFailures] = useState<Record<string, string>>({});
  const inFlight = useRef(new Set<string>()),
    scan = useRef<Promise<void> | null>(null),
    proxyWrite = useRef<Promise<void>>(Promise.resolve());
  const { update } = useSettings();
  const catalog = useCatalog();
  const checkState = useCallback(async (id: string) => {
    try {
      const state = await ipc.launchState(id);
      setStates((old) => ({ ...old, [id]: state }));
    } catch {
      setStates((old) => ({ ...old, [id]: undefined }));
    }
  }, []);
  const refreshProxy = useCallback(async () => {
    const [p, c] = await Promise.all([ipc.proxyProfiles(), ipc.proxyConfig()]);
    setProfiles(p);
    setProxyConfig(c);
  }, []);
  const refresh = useCallback(() => {
    if (scan.current) return scan.current;
    setLoading(true);
    const task = (async () => {
      const result = await Promise.allSettled([
        ipc.detectApps(),
        ipc.detectEditors(),
        ipc.rtlComponents(),
        refreshProxy(),
      ]);
      const [a, e, c] = result;
      setErrors(
        result
          .filter((r) => r.status === "rejected")
          .map((r) => String((r as PromiseRejectedResult).reason)),
      );
      setDetectionFailed(a.status === "rejected" && e.status === "rejected");
      if (a.status === "fulfilled") {
        setApps(a.value);
        await Promise.all(
          a.value.filter((x) => x.installed).map((x) => checkState(x.id)),
        );
      } else setApps([]);
      setEditors(e.status === "fulfilled" ? e.value : []);
      setComponents(c.status === "fulfilled" ? c.value : []);
      setLoading(false);
    })().finally(() => {
      scan.current = null;
    });
    scan.current = task;
    return task;
  }, [checkState, refreshProxy]);
  useEffect(() => {
    void refresh();
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      for (const [id, state] of Object.entries(states))
        if (state?.phase === "starting" || state?.phase === "running")
          void checkState(id);
    }, 5000);
    return () => clearInterval(timer);
  }, [states, checkState]);
  const saveToolProxy = useCallback(
    (appId: string, profileId: string) => {
      const task = proxyWrite.current
        .catch(() => {})
        .then(async () => {
          const latest = await ipc.proxyConfig();
          const next = {
            ...latest,
            perApp: { ...latest.perApp, [appId]: profileId },
          };
          await ipc.proxySetConfig(next);
          await refreshProxy();
        });
      proxyWrite.current = task;
      return task;
    },
    [refreshProxy],
  );
  const launch = async (
    id: string,
    kind: "app" | "editor",
    mode: LaunchMode,
  ) => {
    const key = kind + ":" + id;
    if (inFlight.current.has(key)) return;
    const rtlAvailable =
      components.some((c) => c.id === id && c.available) &&
      catalog.apps.some(
        (a) => a.id === id && a.capabilities.rtl === "verified",
      );
    if (kind === "app" && launchBlocked(mode, states[id], rtlAvailable, false))
      return;
    inFlight.current.add(key);
    setBusy((old) => ({ ...old, [key]: true }));
    setFailures((old) => ({ ...old, [key]: "" }));
    setMessages((old) => ({ ...old, [key]: "" }));
    try {
      if (kind === "app") {
        const latest = await ipc.launchState(id);
        setStates((old) => ({ ...old, [id]: latest }));
        if (launchBlocked(mode, latest, rtlAvailable, false)) return;
      }
      const result =
        kind === "app"
          ? await ipc.launchApp({ appId: id, rtl: mode === "rtl" })
          : await ipc.launchEditor(id);
      if (result.ok) {
        setMessages((old) => ({ ...old, [key]: "accepted" }));
        if (kind === "app")
          update((current) => ({
            launchModeByApp: { ...current.launchModeByApp, [id]: mode },
          }));
      } else {
        setFailures((old) => ({
          ...old,
          [key]: result.detail || "Launch failed",
        }));
      }
      if (kind === "app") await checkState(id);
    } catch (error) {
      setFailures((old) => ({ ...old, [key]: String(error) }));
      if (kind === "app") await checkState(id);
    } finally {
      inFlight.current.delete(key);
      setBusy((old) => ({ ...old, [key]: false }));
    }
  };
  return (
    <Context.Provider
      value={{
        apps,
        editors,
        components,
        profiles,
        proxyConfig,
        loading,
        errors,
        detectionFailed,
        states,
        busy,
        messages,
        failures,
        refresh,
        refreshProxy,
        saveToolProxy,
        launch,
        checkState,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useToolContext() {
  const value = useContext(Context);
  if (!value) throw new Error("ToolProvider is required");
  return value;
}
