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
import { launchBlocked, launchFailureKind } from "@core";
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
    cwd?: string,
  ) => Promise<boolean | undefined>;
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
    proxyWrite = useRef<Promise<void>>(Promise.resolve()),
    polling = useRef(false);
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
  const acceptStates = useCallback((next: Record<string, LaunchState>) => {
    setStates(old => Object.entries(next).every(([id, value]) => JSON.stringify(old[id]) === JSON.stringify(value)) ? old : { ...old, ...next });
    setFailures(old => {
      const resolved = Object.keys(next).filter(id => next[id]?.phase === 'idle' && launchFailureKind(old['app:' + id]) === 'alreadyOpen');
      return resolved.length ? { ...old, ...Object.fromEntries(resolved.map(id => ['app:' + id, ''])) } : old;
    });
  }, []);
  const checkState = useCallback(async (id: string) => {
    try {
      const state = await ipc.launchState(id);
      acceptStates({ [id]: state });
    } catch {
      setStates((old) => ({ ...old, [id]: undefined }));
    }
  }, [acceptStates]);
  const checkStates = useCallback(async (ids: string[]) => {
    if (!ids.length || polling.current) return;
    polling.current = true;
    try {
      const next = await ipc.launchStates(ids);
      acceptStates(next);
    } catch (error) {
      setFailures((old) => ({ ...old, ...Object.fromEntries(ids.map((id) => [
        "app:" + id, String(error),
      ])) }));
      setStates((old) => ({ ...old, ...Object.fromEntries(ids.map((id) => [id, undefined])) }));
    } finally { polling.current = false; }
  }, [acceptStates]);
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
        ipc.rtlComponents(),
        refreshProxy(),
      ]);
      const [a, c] = result;
      setErrors(
        result
          .filter((r) => r.status === "rejected")
          .map((r) => String((r as PromiseRejectedResult).reason)),
      );
      setDetectionFailed(a.status === "rejected");
      if (a.status === "fulfilled") {
        setApps(a.value);

      } else setApps([]);
      setEditors([]);
      setComponents(c.status === "fulfilled" ? c.value : []);
      setLoading(false);
      // Inventory is usable before potentially slow process checks complete.
      const ids = [
        ...(a.status === "fulfilled" ? a.value.filter((x) => x.installed).map((x) => x.id) : []),
      ];
      void checkStates(ids);
    })().finally(() => {
      scan.current = null;
    });
    scan.current = task;
    return task;
  }, [checkStates, refreshProxy]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== 'visible') return;
      const ids = Object.entries(states).filter(([id, state]) => !state || state.phase === 'running' || state.phase === 'starting' || launchFailureKind(failures['app:' + id]) === 'alreadyOpen').map(([id]) => id);
      if (!ids.length || polling.current) return;
      void checkStates(ids);
    };
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    return () => { window.removeEventListener('focus', onReturn); document.removeEventListener('visibilitychange', onReturn); };
  }, [states, failures, checkStates]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const ids = Object.entries(states).filter(([, state]) =>
        state?.phase === "starting" || state?.phase === "running").map(([id]) => id);
      void checkStates(ids);
    }, 15000);
    return () => clearInterval(timer);
  }, [states, checkStates]);
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
    cwd?: string,
  ) => {
    const key = kind + ":" + id;
    if (inFlight.current.has(key)) return;
    const rtlAvailable =
      components.some((c) => c.id === id && c.available) &&
      (id === "antigravity" || catalog.apps.some(
        (a) => a.id === id && a.capabilities.rtl === "verified",
      ));
    const managed = kind === "app" || id === "antigravity";
    if (managed && launchBlocked(mode, states[id], rtlAvailable, false) && !(cwd && states[id]?.phase === "running"))
      return;
    inFlight.current.add(key);
    setBusy((old) => ({ ...old, [key]: true }));
    setFailures((old) => ({ ...old, [key]: "" }));
    setMessages((old) => ({ ...old, [key]: "" }));
    try {
      if (managed) {
        const latest = await ipc.launchState(id);
        setStates((old) => ({ ...old, [id]: latest }));
        if (launchBlocked(mode, latest, rtlAvailable, false) && !(cwd && latest.phase === "running")) return false;
      }
      const result =
        kind === "app"
          ? await ipc.launchApp({ appId: id, rtl: mode === "rtl", cwd })
          : await ipc.launchEditor(id, mode === "rtl");
      if (result.ok) {
        setMessages((old) => ({ ...old, [key]: "accepted" }));
        if (managed)
          update((current) => ({
            launchModeByApp: { ...current.launchModeByApp, [id]: mode },
          }));
      } else {
        setFailures((old) => ({
          ...old,
          [key]: result.detail || "Launch failed",
        }));
      }
      if (managed) await checkState(id);
      return result.ok;
    } catch (error) {
      setFailures((old) => ({ ...old, [key]: String(error) }));
      if (managed) await checkState(id);
      return false;
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
