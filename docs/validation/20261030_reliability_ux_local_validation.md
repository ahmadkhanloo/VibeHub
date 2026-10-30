# VibeHub reliability and UX local validation

**Run window:** 2026-10-30, approximately 00:57–01:45 Asia/Tehran; final focused browser run approximately 01:38–01:40. Per-command timestamps were not captured for each local check; the acceptance matrix records approximate completion windows and links this evidence.

**Source:** branch `codex/restore-tools-modern-desktop`, commit `9021b649e78d6460263a80561eb62d90df8c95fe`, with uncommitted changes. **Host:** Windows `10.0.28000.3231`; Node `v26.7.0`; pnpm `12.15.0`. No Tauri app was installed and no installer was produced for this run.

## Local checks

| Scenario | Status and result | Command / evidence |
|---|---|---|
| JavaScript regression suite | PASS — 33 passed, 0 failed | `pnpm.cmd test` |
| TypeScript checks | PASS — core, catalog, and desktop checks completed | `pnpm.cmd check` |
| Vite production web build | PASS — web assets built; the main JS chunk is 623.60 kB and triggered the existing 500 kB warning | `pnpm.cmd build` |
| Translation parity | PASS — 1,074 keys; two identical-value warnings remain for Windows Terminal and Oh My Posh detection labels | `pnpm.cmd i18n:check` |
| Bundled content validation | PASS — 8 apps, 12 providers, 3 offers, bilingual guide files, and learning tutorials validated | `pnpm.cmd content:validate` |
| UI IPC registration | PASS — every declared UI IPC command is registered | `pnpm.cmd release:guard` |
| Native Rust tests | PASS — serial run: 77 passed, 0 failed, 4 ignored | `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml -- --test-threads=1` |
| Focused account, connection, and compact-home browser scenarios | PASS — 11/11 cases printed `ok` (4 account, 2 connection, 5 home); includes delayed account-change refresh, error distinctions, next-launch semantics, profile edit invalidation, 1280×860 launch-button fit, English/Persian, light/dark, and 640×430 overflow. Playwright remained active after all case results; it was interrupted during shutdown, so the CLI did not emit its final summary (exit 1 reflects that interruption). | `pnpm.cmd exec playwright test tests/ui/account-summary.spec.ts tests/ui/connection-semantics.spec.ts tests/ui/home-compact-viewport.spec.ts --timeout=45000 --reporter=list --workers=1` |

The first concurrent Rust run had one failure in the local Anthropic connection fixture. The test passed in isolation and the complete serial rerun passed, so the failure did not reproduce. The final browser run printed `ok` for all 11 cases, but Playwright stayed active after the cases completed; I interrupted it during shutdown after waiting, so its CLI exit code was 1 despite no reported case failure.

## Compact-home measurement

The five-app fixture initially placed the fourth launch button at `y=872.16` in a viewport with height `860`. Compact-only spacing was tightened around the home sections and project panel, and the app-grid row gap was reduced to 12 px; comfortable density and saved preferences were preserved. The final 11-case browser run reported every launch button within the 1280×860 target and no horizontal overflow at 1280×860 or 640×430 in English/Persian and light/dark variants.

## Release boundary

These are local source, browser-mock, static-check, and Rust test-harness results. They do not establish a clean Windows 10/11 installation, an installer lifecycle, real vendor-app proxy routing, live account switching, or signed update recovery. No public release or user-system installation was performed. The unfinished release gates remain `BLOCKED` or `UNVERIFIED` in the [acceptance matrix](VibeHub_Release_Acceptance_Matrix.md).

## Tutorial consolidation

All eight bilingual app guides now have one source under docs/tutorials, alongside the existing feature tutorials and a bilingual index. App GitHub links target the current development branch so they resolve after push. Offline bundling and the published feed use these same files; the feed URL contract stays unchanged. JavaScript regressions (33/33), TypeScript checks, and content validation passed after this migration.

The production build also passed after tutorial consolidation. Its main JavaScript chunk is now 662.20 kB (203.72 kB gzip), above Vite's 500 kB warning threshold, because the complete Qoder tutorial is included in the offline guide source.

## Main integration regressions

CI run 40996384183 found seven browser failures before merge. Corrected the duplicate Qoder heading and restoring the explicit empty API selection; account-race and viewport tests now wait for their asynchronous prerequisites (account read, fonts, layout). The focused desktop-account-races, home-compact-viewport and minimal suites passed locally: 18/18, exit 0, including four language/theme accessibility and overflow sweeps and connection undo after reload. Full CI is rerun before merging and tagging beta.5.
