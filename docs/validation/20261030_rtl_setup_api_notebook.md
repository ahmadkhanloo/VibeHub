# RTL setup from app tiles and API notebook

> **Superseded for release status; historical only.** Current release status and gate results are tracked in [VibeHub_Release_Acceptance_Matrix.md](VibeHub_Release_Acceptance_Matrix.md). This report records the source/mock run described below and does not set current acceptance.

Snapshot: 2026-10-30 23:31:36 +03:30 (Asia/Tehran). Source: branch `codex/rtl-setup-api-notebook`, base commit `3878224c28bec039b1cd3321b7d98ff23c678ff5` plus the current changes. VibeHub base version `0.2.0`; intended public package `v0.2.0-beta.6`. Host: Windows `10.0.28000.3231`, Node `v26.7.0`, pnpm `12.15.0`. These checks use source, mock IPC, and isolated temporary files, with no installed vendor app launched or changed.

## Behavior

- Returning to VibeHub after at least five seconds triggers a deduplicated inventory refresh. Check again remains available. Supported app tiles and app pages offer RTL setup even when the coding app was installed after VibeHub.
- RTL setup validates the allowlisted app and bundled runtime/adapter, creates or repairs only its owned per-user Start Menu shortcut, then saves RTL as the next-launch preference. It never closes or launches the coding app. It refuses unrelated shortcut names and offers the full official installer when payload is missing.
- Shortcut serialization uses Unicode IShellLinkW and IPersistFile rather than the WScript.Shell target setter, which rejected real Persian paths on this host. Tests cover Persian target and Start Menu directories, all four adapters, idempotence, missing payload, and unrelated-file preservation.
- Standalone Antigravity exposes its existing experimental chat adapter through the same setup flow. Antigravity IDE and live signed-in chat compatibility are not established by this work.
- Main navigation and the API page now say API notebook. The proxy page remains separate; saved API entries continue to require manual configuration in the destination tool.
- README download links target the current VibeHub beta directly. GitHub's stable Latest endpoint was inspected and returned legacy AgentRTL `v1.2.2`; prereleases are not promoted to stable acceptance.

## Local verification

| Check | Result | Evidence |
|---|---|---|
| Complete browser suite with fresh test servers | PASS — 95/95, exit 0, 8.2 minutes | `CI=1 pnpm.cmd test:ui --workers=2 --reporter=list`; includes setup success/failure/missing files, delayed app installation, Antigravity injection fixtures, account/connection regressions, keyboard/accessibility sweeps, both languages/themes and five launch controls at 1280×860 |
| Isolated native shortcut behavior | PASS — 21 assertions | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/rtl-setup.ps1`; actual temporary .lnk files in Persian paths; no real Start Menu item was touched |
| JavaScript suite | PASS — 33/33 | `pnpm.cmd test` |
| TypeScript | PASS | `pnpm.cmd check` and production build type check |
| Production web build | PASS — main chunk 673.88 kB, gzip 206.54 kB; 500 kB warning remains | `pnpm.cmd build` |
| Translation parity | PASS — 1,083 keys; two existing identical-value warnings | `pnpm.cmd i18n:check` |
| Content validation | PASS — 8 apps, 12 providers, 3 offers and bilingual guides | `pnpm.cmd content:validate` |
| IPC registration | PASS — every UI command, including rtl_setup, registered | `pnpm.cmd release:guard` |
| Serial Rust suite | PASS — final embedded-script rerun: 77 passed, 0 failed, 4 ignored | `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml -- --test-threads=1` |

The first full UI run exposed a duplicate experimental warning in a closed modal; closed RTL dialogs now mount only when opened. Later local runs reused a stale development server and were interrupted by a long system suspension. A diagnostic confirmed that the stale server served two catalog module URLs with independent stores. The final 95-case run started fresh Vite servers with CI=1 and passed completely. No production catalog workaround was added.

## Release boundary

No clean Windows 10/11 installer lifecycle, real signed-in Antigravity conversation, live account switching, or real per-app proxy routing was performed in these local checks. Installer publication and signing must be established by the separate tag workflow. The current release acceptance matrix retains those blocked or unverified gates.

The isolated RTL shortcut suite also passed under both Windows PowerShell and the current PowerShell runtime. The existing native Windows behavioral suite passed 39 assertions with the real user profile untouched. Final local checks completed at 2026-10-30 23:33:44 +03:30 (Asia/Tehran).
