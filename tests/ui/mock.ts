import type { Page } from "@playwright/test";
export async function mockNative(
  page: Page,
  scenario = "ready",
  language = "en",
  onboardingDone = true,
) {
  await page.addInitScript(
    ({ scenario, language, onboardingDone }) => {
      if (!sessionStorage.getItem("vibehub.fixture.seeded") && !localStorage.getItem("vibehub.settings.v1"))
        localStorage.setItem(
          "vibehub.settings.v1",
          JSON.stringify({
            language,
            themeFamily: "graphite",
            themeMode: "light",
            accent: "auto",
            onboardingDone,
            launchModeByApp: {},
          }),
        );
      sessionStorage.setItem("vibehub.fixture.seeded", "1");
      const initialProfiles = [
        {
          id: "local",
          name: "Local route",
          mode: "http",
          host: "127.0.0.1",
          port: 10808,
        },
      ];
      const state: any = {
        scenario,
        calls: [],
        profiles: initialProfiles,
        config: {
          globalProfileId: "",
          requireProxy: scenario === "required",
          perApp: {},
        },
        connections: [
          {
            id: "connection-local",
            name: "Local Ollama",
            providerId: "ollama",
            baseUrl: "http://127.0.0.1:11434/v1",
            modelId: "qwen2.5-coder:7b",
            hasKey: false,
          },
        ],
        legacy: ["openrouter"],
        launchStates: {
          zcode: {
            phase: scenario === "running" ? "running" : "idle",
            rtl: false,
          },
        },
        clearAttempts: 0,
      };
      (window as any).__mock = state;
      (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args: any = {}) => {
          state.calls.push({ cmd, args });
          if (
            (state.scenario === "failed" &&
              ["detect_apps", "detect_editors", "rtl_components"].includes(
                cmd,
              )) ||
            (state.scenario === "partial" && cmd === "detect_editors") ||
            (state.scenario === "stateError" && cmd === "launch_state")
          )
            throw Error("Simulated native failure");
          switch (cmd) {
            case "app_version":
              return "0.1.0";
            case "detect_apps":
              return state.scenario === "empty"
                ? []
                : [
                    {
                      id: "zcode",
                      installed: true,
                      path: "C:/Fixtures/ZCode.exe",
                      version: "1.0",
                      via: "fixture",
                    },
                    { id: "qoder", installed: false, via: "fixture" },
                  ];
            case "detect_editors":
              return state.scenario === "empty"
                ? []
                : [
                    {
                      id: "vscode",
                      name: "Visual Studio Code",
                      installed: true,
                      path: "C:/Fixtures/Code.exe",
                      via: "standard-path",
                    },
                  ];
            case "rtl_components":
              return [
                { id: "zcode", available: state.scenario !== "missing" },
                { id: "qoder", available: true },
              ];
            case "launch_state":
              return state.launchStates[args.appId] ?? { phase: "idle" };
            case "launch_app":
              if (state.scenario === "launchFailed")
                throw Error("Launch failed");
              if (state.config.requireProxy && !state.config.globalProfileId)
                throw Error("Required proxy missing");
              state.launchStates[args.req.appId] = {
                phase: "running",
                rtl: args.req.rtl,
                since: "2026-10-27T00:00:00Z",
              };
              return {
                ok: true,
                rtl: args.req.rtl,
                detail: "Accepted fixture launch",
              };
            case "launch_editor":
              if (state.config.requireProxy)
                throw Error("Editor proxy not verified");
              return {
                ok: true,
                id: args.editorId,
                pid: 1,
                detail: "Accepted",
              };
            case "proxy_list":
              return structuredClone(state.profiles);
            case "proxy_config":
              return structuredClone(state.config);
            case "proxy_set_config":
              state.config = structuredClone(args.cfg);
              return;
            case "proxy_save":
              state.profiles = state.profiles
                .filter((p: any) => p.id !== args.profile.id)
                .concat(args.profile);
              return structuredClone(state.profiles);
            case "proxy_delete":
              state.profiles = state.profiles.filter(
                (p: any) => p.id !== args.id,
              );
              return structuredClone(state.profiles);
            case "provider_connections":
              return structuredClone(state.connections);
            case "provider_connection_save":
              state.connections = state.connections
                .filter((c: any) => c.id !== args.connection.id)
                .concat(args.connection);
              return structuredClone(state.connections);
            case "provider_connection_delete":
              state.connections = state.connections.filter(
                (c: any) => c.id !== args.id,
              );
              return structuredClone(state.connections);
            case "provider_credentials_inventory":
              return {
                connections: structuredClone(state.connections),
                legacyProviderIds: [...state.legacy],
              };
            case "provider_credentials_clear": {
              state.clearAttempts++;
              if (state.scenario === "bulkPartial" && state.clearAttempts === 1)
                return {
                  deletedConnectionIds: [],
                  deletedLegacyProviderIds: [],
                  failures: [
                    ...args.legacyProviderIds.map((id: string) => ({
                      kind: "legacy",
                      id,
                      errorKey: "vaultDeleteFailed",
                    })),
                    ...args.connectionIds.map((id: string) => ({
                      kind: "connection",
                      id,
                      errorKey: "legacyDeleteBlocked",
                    })),
                  ],
                };
              state.legacy = state.legacy.filter(
                (x: string) => !args.legacyProviderIds.includes(x),
              );
              state.connections = state.connections.filter(
                (c: any) => !args.connectionIds.includes(c.id),
              );
              return {
                deletedConnectionIds: args.connectionIds,
                deletedLegacyProviderIds: args.legacyProviderIds,
                failures: [],
              };
            }
            case "doctor_run":
              return [
                {
                  id: "git",
                  label: { en: "Git", fa: "گیت" },
                  status: "pass",
                  detail: "fixture",
                },
              ];
            case "plugin:notification|is_permission_granted":
              return false;
            default:
              throw Error("Unexpected mock command " + cmd);
          }
        },
      };
    },
    { scenario, language, onboardingDone },
  );
}
