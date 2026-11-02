import type { LaunchState } from "./index.ts";
export type LaunchMode = "normal" | "rtl";

export interface RtlAdapterState {
  id: string;
  available: boolean;
  configured: boolean;
  setupSupported?: boolean;
  product?: 'codex' | 'chatgpt' | 'unknown';
}

/** Catalog verification is evidence; these helpers describe local adapter state. */
export function rtlAdapterAvailable(appId: string, components: readonly RtlAdapterState[]): boolean {
  const component = components.find(item => item.id === appId);
  if (!component?.available) return false;
  return appId !== 'chatgpt' || component.product === 'codex';
}

export function rtlAdapterConfigured(appId: string, components: readonly RtlAdapterState[]): boolean {
  return rtlAdapterAvailable(appId, components) && components.some(item => item.id === appId && item.configured);
}

/** The repair action may restore a missing adapter; it never enables an RTL launch by itself. */
export function rtlAdapterSetupSupported(appId: string, components: readonly RtlAdapterState[]): boolean {
  const component = components.find(item => item.id === appId);
  if (!component) return false;
  if (appId === 'chatgpt') return component.product === 'codex' && component.setupSupported === true;
  return component.setupSupported === true || component.available;
}

export function preferredLaunchMode(
  saved: LaunchMode | undefined,
  verified: boolean,
  available: boolean,
): LaunchMode {
  return saved ?? (verified && available ? "rtl" : "normal");
}
export function launchBlocked(
  mode: LaunchMode,
  state: LaunchState | undefined,
  rtlAvailable: boolean,
  busy: boolean,
): boolean {
  return (
    busy ||
    !state ||
    state.phase === "starting" ||
    state.phase === "running" ||
    (mode === "rtl" && !rtlAvailable)
  );
}
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .trim()
    .toLowerCase();
}
