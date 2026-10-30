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
import { useCatalog } from "@/lib/catalog";
import { launchBlocked, launchFailureKind } from "@core";
import { accountSummaryError, accountSummaryFromSnapshot, type AccountSummary } from "@/features/accounts/account-summary";
interface ToolContext {
  apps: DetectedApp[];
  editors: DetectedEditor[];
  components: RtlComponentStatus[];
  profiles: ProxyProfile[];
  proxyConfig: ProxyConfig | null;
  connections: ProviderConnection[] | null;
  connectionsError: boolean;
  accountSummaries: Record<string, AccountSummary | undefined>;
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
  refreshAccountSummary: (appId: string) => Promise<void>;
  retryAccountSummary: (appId: string) => Promise<void>;
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
  const [accountSummaries, setAccountSummaries] = useState<Record<string, AccountSummary | undefined>>({});
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
    connectionFlight = useRef<Promise<void> | null>(null),
    accountFlights = useRef(new Map<string, Promise<void>>()),
    accountQueued = useRef(new Set<string>());
  const { settings, update } = useSettings();
  const catalog = useCatalog();
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
  const refreshAccountSummary = useCallback((appId: string) => {
    const current = accountFlights.current.get(appId);
    if (current) {
      accountQueued.current.add(appId);
      return current;
    }
    const pending = (async () => {
      do {
        accountQueued.current.delete(appId);
        setAccountSummaries(old => old[appId] ? old : {
          ...old,
          [appId]: {
            appId, accountId: null, status: 'loading', quotaStatus: 'loading', accountName: '', quotaItems: [], checkedAt: null,
            stale: false, showingPrevious: false, errorCode: null, quotaErrorCode: null, canRefresh: false, canAdd: false,
          },
        });
        try {
          const snapshot = appId === 'chatgpt'
            ? await ipc.codexAccounts('list', { language: settings.language.startsWith('fa') ? 'fa' : 'en' })
            : await ipc.appAccounts(appId, 'list');
          const summary = accountSummaryFromSnapshot(appId, snapshot);
          setAccountSummaries(old => ({ ...old, [appId]: summary }));
        } catch {
          setAccountSummaries(old => ({ ...old, [appId]: accountSummaryError(appId, old[appId]) }));
        }
      } while (accountQueued.current.has(appId));
    })().finally(() => { accountFlights.current.delete(appId); });
    accountFlights.current.set(appId, pending);
    return pending;
  }, [settings.language]);
  const retryAccountSummary = useCallback(async (appId: string) => {
    const accountId = accountSummaries[appId]?.accountId;
    try {
      if (appId === 'chatgpt') await ipc.codexAccounts('refresh', { ...(accountId ? { id: accountId } : {}), language: settings.language.startsWith('fa') ? 'fa' : 'en' });
      else if (accountId) await ipc.appAccounts(appId, 'refresh', { id: accountId });
    } catch { /* The subsequent shared read presents the native structured status. */ }
    await refreshAccountSummary(appId);
  }, [accountSummaries, refreshAccountSummary, settings.language]);
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
        for (const app of a.value) {
          if (app.installed && ['chatgpt', 'qoder', 'zcode'].includes(app.id)) void refreshAccountSummary(app.id);
        }

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
  }, [checkStates, refreshAccountSummary, refreshProxy]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const ids = apps.filter(app => app.installed && ['chatgpt', 'qoder', 'zcode'].includes(app.id)).map(app => app.id);
    const refreshVisible = () => {
      if (document.visibilityState !== 'visible') return;
      for (const id of ids) void refreshAccountSummary(id);
    };
    const onAccountChange = (event: Event) => {
      const appId = (event as CustomEvent<{ appId?: string }>).detail?.appId;
      if (appId && ids.includes(appId)) void refreshAccountSummary(appId);
    };
    const onConnectionsChange = () => { void refreshConnections(); };
    const timer = setInterval(refreshVisible, 30000);
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    window.addEventListener('vibehub:account-summary-changed', onAccountChange);
    window.addEventListener('vibehub:connections-changed', onConnectionsChange);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.removeEventListener('vibehub:account-summary-changed', onAccountChange);
      window.removeEventListener('vibehub:connections-changed', onConnectionsChange);
    };
  }, [apps, refreshAccountSummary, refreshConnections]);
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
        accountSummaries,
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
        refreshAccountSummary,
        retryAccountSummary,
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
