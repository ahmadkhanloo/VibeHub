# RTL setup from app tiles and API notebook

User intent: VibeHub is a workspace for coding tools. Apps installed after VibeHub must be detectable and offer RTL setup directly on their tiles. Expose existing standalone Antigravity chat RTL without upgrading its experimental compatibility claim. Call the manual API store a notebook.

1. Add browser regressions for newly detected Qoder, Antigravity setup failure, and API notebook navigation; observe failures before implementation.
2. Add a shared RTL setup control to LaunchControls (home and app detail). Confirm what setup does, create a per-user Start Menu shortcut through a fixed native command, and save RTL as the next-launch preference only after success. Bundled runtime files remain the source; missing payload offers the official VibeHub releases page. Never close or launch a vendor app during setup.
3. Add allowlisted `rtl_setup` IPC and PowerShell shortcut helper. Validate required payload, installed app, and shortcut ownership. Test actual shortcut serialization in temporary directories, including all four adapters, missing files, idempotence, and unrelated-shortcut rejection. Register the tests in CI and release preflight.
4. Add bounded inventory refresh on returning to the hub. Rename global navigation and API page titles to API notebook while keeping app connection/proxy labels accurate. Make the current beta download prominent in both READMEs; document that GitHub Latest still selects the legacy stable AgentRTL release.
5. Run focused browser, full UI, native fixture, TypeScript, content/i18n/IPC checks, JS regressions and production build. Record evidence and release limitations.

No runtime download or third-party patching is needed for a full VibeHub install: all four adapters and the private Node runtime are bundled. Start Menu setup is reversible by removing the owned shortcut; the native operation is idempotent. Antigravity remains experimental and requires a separate live conversation check to establish compatibility.
