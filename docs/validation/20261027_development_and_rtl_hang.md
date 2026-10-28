# Browser development and reported RTL launch hang — 2026-10-27

## Observed evidence

The installed VibeHub process initially used `C:\Users\Mak\AppData\Local\VibeHub\vibehub.exe`, dated 2026-10-26. Its SHA-256 was `E0DEB416D17ABA2834C795B34B9A15BB6138EC18D8FE749C69E44996DE15B95F`. The newer repository release executable had SHA-256 `DC05F9FDAF81F675C6B12E8EDEDE65D614E831F229F4A3F2D64DD6A46E44160F`. They are different builds despite the shared 0.1.0 version label.

Windows recorded VibeHub AppHangB1/AppHangTransient events. These establish an actual application hang, not its root cause. The current launch implementation runs native launch work on a blocking worker, outside the window event loop, and does not retain the settings lock while waiting for the launcher. No new causal claim about the historical hang is made from mock tests alone.

## Implemented workflow

- `pnpm dev` / `pnpm dev:browser` serves `http://127.0.0.1:1422/`, with a visible simulated-native-actions banner and hot reload.
- Preview and browser tests share one native fixture implementation; production builds exclude it. A preview cannot override an existing Tauri native transport.
- `pnpm dev:desktop` runs the actual source application, titled **VibeHub — Development**, with identifier `com.ahmadkhanloo.vibehub.dev`. It uses port 1420 and does not require an installer. Native/Rust changes rebuild the development process; frontend changes use Vite hot reload.
- No native HTTP command bridge was added to the browser. Browser RTL operations are explicitly simulated; real Windows/RTL acceptance uses the desktop development window.

## Verification

- The original 48 browser tests passed, including preview boot without test injection, simulated Qoder RTL, navigation responsiveness, existing-native-transport protection, accessibility and existing UI regressions. Two additional localized port-conflict tests passed, including retry, diagnostics navigation, absence of a modal, and error/title layout separation.
- The expanded full run completed with 49 passes and one Playwright artifact-file `ENOENT` during context cleanup, caused by overlapping test runs sharing an output directory. The affected Persian accessibility test passed when rerun with a separate output directory. The two localized error/layout tests also passed separately after the layout correction. All 50 cases therefore passed across the full run and targeted reruns; this was not a single uninterrupted 50-pass run.
- The normal 21 Rust tests passed. Both opt-in Rust checks also passed: real local-proxy routing and installed Codex CLI interoperability with isolated synthetic credentials. Network results: `output/development/network.json`.
- 36 native Windows assertions and 8 Qoder discovery assertions passed. All 29 Node tests, TypeScript, bilingual parity (909 keys), content validation and IPC coverage passed.
- Production frontend build passed. Its JavaScript assets were checked for preview-banner and native-fixture markers; none were found.
- The desktop development application was launched from source and its real accessibility tree was observed. Its process reported responsive. The window-control tool could not reliably click this window: it reported unavailable input geometry and returned a capture inconsistent with the target. No click was attempted from that inconsistent capture. The user was asked to perform the live Qoder RTL click.

## Live Qoder diagnostic limitation and correction

The existing `doctor.mjs --check` could wait indefinitely for a CDP response. WebSocket connection and command deadlines were added, rejected/closed connections now reject pending work, and per-frame failures or absent frames cannot report an all-pass result. `Target.setAutoAttach` now uses `waitForDebuggerOnStart`.

A synthetic silent-peer regression check verifies a bounded nonzero exit. The corrected live check exits with **`DevTools request timed out: Page.enable`** on the currently running Qoder. Therefore live RTL compatibility is **not verified**. This is a diagnostic result, not proof that this timeout caused the VibeHub hang. The user's Qoder application and existing injector were not force-closed.

The user confirmed that the source-built desktop window works when clicking Qoder RTL. A second launch encountered a port conflict. The hub now captures launcher errors without enabling the launcher's native popup mode, translates busy-port/already-open failures into localized design-system notices, and provides retry and diagnostics. It never force-closes the running app. This confirms the user's development-window interaction; it does not establish the historical installed build's hang cause or override the live CDP diagnostic limitation above.
