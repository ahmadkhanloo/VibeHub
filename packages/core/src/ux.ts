import type { LaunchState } from "./index.ts";
export type LaunchMode = "normal" | "rtl";
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
