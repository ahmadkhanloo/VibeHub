# Remaining live checks — 2026-11-01

**Environment:** Windows 11 Pro 10.0.28000, x64; VibeHub development build 0.2.2 from source commit `8feee42` plus the current uncommitted worktree. These results do not apply to an installed VibeHub release.

## Live results

| Check | Result | Evidence and limits |
|---|---|---|
| Custom VibeHub title bar | PASS on the development window | Windows UI Automation invoked minimize, maximize, and restore; window state changed to `Minimized`, `Maximized`, and `Normal`. A pointer drag changed the window bounds from `136,60,1754,1145` to `176,120,1794,1205`; a title-bar double-click maximized it; the restore button returned it to `Normal`; close exited the window process. Tested 2026-11-01 on this Windows 11 host. No installed-release binary was tested. |
| Antigravity IDE proxy launch | PASS for observed IDE traffic | VibeHub launched the detected IDE as PID `30696` with `--proxy-server=http://127.0.0.1:56323`. The temporary local HTTP CONNECT proxy recorded TLS tunnels from the IDE to `cloudcode-pa.googleapis.com` (1,217 client bytes / 4,750 server bytes) and `storage.googleapis.com` (890 client bytes / 213,327,934 server bytes), plus other Google service hosts. No TLS content or conversation prompt was captured or sent. This confirms traffic reached the selected proxy; it does not prove every request or every app uses it. The temporary profile was reset and deleted after the test, and the proxy listener was stopped. |
| Antigravity IDE RTL rendering | UNVERIFIED | The IDE was discovered as a separate product. Its app tile currently offers normal launch only because no IDE-specific RTL adapter has passed live compatibility checks. No user prompt was sent and no existing conversation was inspected. The installed IDE self-updated during this test from the earlier observed 2.5.5 build to 2.6.0, so the requested 2.5.5 rendering scenario is no longer available on this host without a separate 2.5.5 installation. |

The IDE's vendor updater downloaded data during the proxy launch and installed version 2.6.0. That changed the user's installed IDE version; it was not downgraded afterward. The IDE test window and temporary VibeHub development proxy profile were closed/removed after the checks.

## Repository verification on this worktree

- `pnpm.cmd check` — PASS.
- `pnpm.cmd test` — 48 passed.
- `pnpm.cmd test:ui` — 96 passed, including Persian/English, light/dark, narrow viewport, RTL setup gating, proxy UI, navigation, and settings states.
- `pnpm.cmd build` — PASS; Vite reports the main JavaScript chunk at 767.71 kB, above its 500 kB advisory threshold.
- `pnpm.cmd i18n:check` — parity PASS for 1,142 keys; two identical English/Persian terminal strings remain warnings.
- `pnpm.cmd content:validate` and `pnpm.cmd release:guard` — PASS.
- `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml -- --test-threads=1` — 80 passed, 4 ignored, 0 failed.
- `tests/native-windows.ps1` — 39 assertions passed; `tests/rtl-setup.ps1` — 25 isolated assertions passed; `tests/qoder-discovery.ps1` — 8 assertions passed; `tests/rtl-paths.ps1` — PASS.
- Windows PowerShell parse and `git diff --check` — PASS (Git reports CRLF normalization warnings for edited files).

## Release gate

The stable release workflow requires every current Gate 18 row in `VibeHub_Release_Acceptance_Matrix.md` to be `PASS` for a new stable tag. Clean Windows 10 and Windows 11 install/upgrade/removal scenarios and live RTL rendering remain unverified, among other scenarios in the matrix. The release workflow therefore blocks a new stable release. No Gate 18 result was changed based on these development-build checks, and no stable artifact was published or installed.

