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
  type ProviderConnection,
  type RtlComponentStatus,
} from "@/services/ipc";
import { useSettings } from "./settings";
import { launchBlocked, launchFailureKind, rtlAdapterConfigured } from "@core";
interface ToolContext {
  apps: DetectedApp[];
  editors: DetectedEditor[];
  components: RtlComponentStatus[];
  profiles: ProxyProfile[];
  proxyConfig: ProxyConfig | null;
  connections: ProviderConnection[] | null;
  connectionsError: boolean;
  loading: boolean;
  errors: string[];
  detectionFailed: boolean;
  states: Record<string, LaunchState | undefined>;
  busy: Record<string, boolean>;
  messages: Record<string, string>;
  failures: Record<string, string>;
  refresh: () => Promise<void>;
  refreshProxy: () => Promise<void>;
  refreshConnections: () => Promise<void>;
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
  const [connections, setConnections] = useState<ProviderConnection[] | null>(null),
    [connectionsError, setConnectionsError] = useState(false);
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
    polling = useRef(false),
    connectionFlight = useRef<Promise<void> | null>(null);
  const { settings, update } = useSettings();
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
    } catch {
      // A failed status read is unknown state, not a failed launch. Recovery must not leave a stale launch alert.
      setStates((old) => ({ ...old, ...Object.fromEntries(ids.map((id) => [id, undefined])) }));
    } finally { polling.current = false; }
  }, [acceptStates]);
  const refreshConnections = useCallback(() => {
    if (connectionFlight.current) return connectionFlight.current;
    const pending = ipc.providerConnections().then(value => {
      setConnections(value); setConnectionsError(false);
    }).catch(() => {
      setConnections(null); setConnectionsError(true);
    }).finally(() => { if (connectionFlight.current === pending) connectionFlight.current = null; });
    connectionFlight.current = pending;
    return pending;
  }, []);
  const refreshProxy = useCallback(async () => {
    const [profilesResult, configResult] = await Promise.allSettled([ipc.proxyProfiles(), ipc.proxyConfig()]);
    setProfiles(profilesResult.status === 'fulfilled' ? profilesResult.value : []);
    setProxyConfig(configResult.status === 'fulfilled' ? configResult.value : null);
    await refreshConnections();
  }, [refreshConnections]);
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
      setDetectionFailed(a.status === "rejected");
      if (a.status === "fulfilled") setApps(a.value);
      else setApps([]);
      setEditors(e.status === "fulfilled" ? e.value : []);
      setComponents(c.status === "fulfilled" ? c.value : []);
      setLoading(false);
      // Inventory is usable before potentially slow process checks complete.
      const ids = [
        ...(a.status === "fulfilled" ? a.value.filter((x) => x.installed).map((x) => x.id) : []),
        ...(e.status === "fulfilled" ? e.value.filter((x) => x.installed).map((x) => x.id) : []),
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
    let lastScan = Date.now();
    const scanOnReturn = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastScan < 5000) return;
      lastScan = Date.now();
      void refresh();
    };
    window.addEventListener('focus', scanOnReturn);
    document.addEventListener('visibilitychange', scanOnReturn);
    return () => {
      window.removeEventListener('focus', scanOnReturn);
      document.removeEventListener('visibilitychange', scanOnReturn);
    };
  }, [refresh]);
  useEffect(() => {
    const onConnectionsChange = () => { void refreshConnections(); };
    window.addEventListener('vibehub:connections-changed', onConnectionsChange);
    return () => {
      window.removeEventListener('vibehub:connections-changed', onConnectionsChange);
    };
  }, [refreshConnections]);
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
    const rtlAvailable = kind === 'app' && rtlAdapterConfigured(id, components);
    const managed = kind === "app" || id === "antigravity";
    if (managed && mode === 'rtl' && !rtlAvailable)
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
        connections,
        connectionsError,
        loading,
        errors,
        detectionFailed,
        states,
        busy,
        messages,
        failures,
        refresh,
        refreshProxy,
        refreshConnections,
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
