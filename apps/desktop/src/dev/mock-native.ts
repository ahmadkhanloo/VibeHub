export function installMockNative({ scenario, language, onboardingDone }: { scenario: string; language: string; onboardingDone: boolean }) {
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
            (state.scenario === "partial" && cmd === "rtl_components") ||
            (state.scenario === "stateError" && ["launch_state", "launch_states"].includes(cmd))
          )
            throw Error("Simulated native failure");
          switch (cmd) {
            case "app_accounts": {
              const id = args.appId;
              const snapshots = state as any;
              snapshots.desktopAccounts ??= {};
              const accountId = 'account-' + 'a'.repeat(24);
              const data = snapshots.desktopAccounts[id] ??= { appId: id, accounts: [{ id: accountId, name: 'Local fixture', email: 'fixture@example.invalid', plan: 'Fixture plan', usage: [{ label: 'Credits', remaining: 75, unit: 'percent' }], checkedAt: Math.floor(Date.now()/1000), error: null }], activeId: accountId, notice: null, version: id === 'qoder' ? '0.4.2' : '3.16.3', supportedVersion: id === 'qoder' ? '0.4.2' : '3.16.3', desktopRunning: true, liveSwitchVerified: false, capabilities: { canImport: true, canLogin: true, canRefresh: true, canSwitch: true } };
              if (args.action === 'rename') data.accounts.find((a: any) => a.id === args.payload.id).name = args.payload.name;
              if (args.action === 'delete') data.accounts = data.accounts.filter((a: any) => a.id !== args.payload.id);
              if (args.action === 'switch') data.activeId = args.payload.id;
              return structuredClone(data);
            }
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
                    ...(state.scenario === "antigravity" ? [{id:"antigravity",installed:true,path:"C:/Fixtures/Antigravity.exe",via:"fixture"}] : []),
                  ];
            case "detect_editors":
              if (state.scenario === "antigravity") return [{id:"antigravity",name:"Antigravity",installed:true,path:"C:/Fixtures/Antigravity.exe",via:"standard-path"}];
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
                { id: "antigravity", available: true },
              ];
            case "launch_states":
              return Object.fromEntries(args.appIds.map((id: string) => [id, state.launchStates[id] ?? { phase: "idle" }]));
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
              state.launchStates[args.editorId] = {phase:"running",rtl:args.rtl,since:"fixture"};
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
            case "terminal_detect":
              return {
                hasOhMyPosh: true,
                ohMyPoshVersion: "fixture",
                hasNerdFont: true,
                nerdFontName: "JetBrainsMono Nerd Font Mono",
                profilePath: "C:/fixture/profile.ps1",
                themeApplied: false,
              };
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
}
