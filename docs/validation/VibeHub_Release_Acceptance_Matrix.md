# VibeHub Release Acceptance Matrix

**Snapshot:** 2026-10-26 (Asia/Tehran)
**Branch:** `feat/vibehub-final`
**Release state:** Not published. A local build or installer is not final acceptance.

## Status meanings

- `PASS` — the exact scenario ran against the stated build/environment and its evidence is linked.
- `FAIL` — the scenario ran and did not meet its acceptance criterion.
- `SKIPPED` — execution is intentionally waiting on an explicit authorization, a public release, or an unavailable test environment.
- `UNVERIFIED` — no current evidence is available; do not infer success.

## Gate status

| Gate / scenario | Status | CI link | GitHub Release URL | Artifact / SHA-256 | Screenshot | Log / notes |
|---|---|---|---|---|---|---|
| Gate 0 — migration audit and legacy Windows evidence | PASS | — (historical local baseline; no new CI run) | — | — | [validation screenshots](windows-live-test.md) | [migration audit](../migration-audit.md); D1 UTF-8 handoff repair is in commit `cf3abc5` |
| Gate 16 — local rename preparation, reference audit, and local origin URL | PASS | — | — | — | — | Repository scan and local `origin` update recorded in [migration audit](../migration-audit.md#10-gate-16-local-repository-migration-preparation--2026-10-26); live GitHub settings remain separate |
| Gate 16 — live Actions/Pages settings, branch protections, secrets, and variables | PASS | [migration CI](https://github.com/ahmadkhanloo/VibeHub/actions/runs/40274475105) | — | — | — | Direct authenticated GitHub API verified settings; main protection and v* tag-only production environment configured; signing secret names and public-key variable configured. CI execution outcome is separate |
| Gate 16 — actual GitHub repository rename | PASS | — | — | — | — | Authorized rename completed; repository ID `1408902399`, now [ahmadkhanloo/VibeHub](https://github.com/ahmadkhanloo/VibeHub). Pages enabled with workflow builds; deployment is separate |
| Gate 17 — protected-branch merge and official tag | SKIPPED | — | — | — | — | Authorized; waiting for current CI before merge and tag |
| Gate 17 — public production release and artifact validation | SKIPPED | — | Not published | No public artifacts | — | No public Release or signature/checksum evidence exists |
| Gate 18 — public installer on clean Windows 10 | SKIPPED | — | Not published | No public installer | — | Requires Gate 17 and a clean Windows 10 environment |
| Gate 18 — public installer on clean Windows 11 | SKIPPED | — | Not published | No public installer | — | Requires Gate 17 and a clean Windows 11 environment |
| Gate 18 — Persian usernames/paths, locale, themes, proxy, terminal, feeds, uninstall | UNVERIFIED | — | Not published | No public installer | — | Must be run from the public Release on clean machines; local evidence is not a substitute |
| Gate 19 — signed follow-up update from installed public version | SKIPPED | — | No initial or follow-up Release | No updater artifacts | — | Authorized; waiting for Gate 17/18 |
| Gate 19 — invalid signature, offline endpoint, interrupted/failed update, data preservation | UNVERIFIED | — | No initial or follow-up Release | No updater artifacts | — | No real updater run has occurred |
| Gate 19 — independent catalog/guide/offer refresh | UNVERIFIED | — | Not published | No public content feed | — | Must be tested separately from the binary updater |

## Current local evidence

| Check | Result | Evidence |
|---|---|---|
| Workspace tests | PASS, 16/16 | `corepack pnpm test`; includes core/catalog, Gate 16 metadata, updater-key guard, native-coverage guard unit test, and Pages-artifact tests |
| Locked dependency install | PASS | `corepack pnpm install --frozen-lockfile` with pnpm 12.15.0 |
| Workspace TypeScript checks | PASS | `corepack pnpm check`; desktop, core, and catalog checks |
| Desktop frontend build | PASS, Vite output produced; one 617.29 kB JS chunk warning remains | `corepack pnpm build`; this is frontend evidence only |
| Translation key parity | PASS, 419 keys; seven identical-value warnings | `corepack pnpm i18n:check` |
| Bundled content validation | PASS, six apps, four providers, zero current offers, twelve bilingual guide files | `corepack pnpm content:validate` |
| Legacy Qoder discovery/Persian path regression | PASS, 8/8 assertions | `./tests/qoder-discovery.ps1` on this Windows checkout |
| Workflow YAML parsing and local policy tests | PASS, all three workflow YAML files parse; Gate 16 tests pass | `python -c "import yaml; ..."` and included `corepack pnpm test`; not a GitHub Actions run |
| Release workflow PowerShell syntax | PASS, all seven inline `pwsh` blocks parse | `System.Management.Automation.Language.Parser::ParseFile` against temporary extracted workflow blocks |
| Minisign verifier bootstrap | PASS, Minisign 0.12 archive SHA-256 and upstream release signature both verified | SHA-256 `37b600344e20c19314b2e82813db2bfdcc408b77b876f7727889dbd46d539479`; local Windows run, not a GitHub Actions run |
| Legacy shell syntax and ShellCheck | PASS (`bash -n`); ShellCheck UNVERIFIED locally because ShellCheck is absent | `C:\Program Files\Git\bin\bash.exe -n apps/ZCode/launch.sh install.sh`; CI is configured to run ShellCheck but no CI run exists |
| Native Rust validation | PASS, `cargo check --locked` | `apps/desktop/src-tauri`; compilation check only, not product feature validation |
| Native Tauri executable build | PASS, Windows x64 `vibehub.exe` produced by `pnpm --filter @vibehub/desktop tauri build --no-bundle` | `apps/desktop/src-tauri/target/release/vibehub.exe`; no installer bundle was produced or tested |
| Native command coverage | PASS — all 24 UI IPC commands have registered Rust handlers | `corepack pnpm release:guard`; [behavioral evidence and unsupported combinations](native-backend.md). Registration does not establish full feature acceptance |
| Native behavior tests | PASS, 10 Rust tests and 14 isolated Windows assertions | `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml`; `./tests/native-windows.ps1`; [scope and limitations](native-backend.md) |
| Local app window/screenshot smoke | UNVERIFIED — executable launch was observed and a VibeHub window was enumerated, but activation/screenshot capture did not return usable evidence | Computer-use output was truncated after retry; not counted as a UI acceptance test |
| Repository whitespace validation | PASS, no diff whitespace errors | `git diff --check` |
| GitHub CI / Pages workflow runs | UNVERIFIED | No remote push or live GitHub run URL exists |
| Signing key / production GitHub variables and secrets | PASS | User-authorized new encrypted signing key stored in Windows Credential Manager and production Secrets; public key embedded and configured as production variable. Local valid/tampered payload signature tests passed; private values not printed |

## Required evidence before final acceptance

For every `PASS`, attach the exact CI run URL, public Release URL, artifact filename and SHA-256, signature verification result, OS/version/build, and relevant screenshot/log. Keep secrets redacted. List all limitations and all `FAIL`, `SKIPPED`, and `UNVERIFIED` cases in the release report. No row becomes `PASS` merely because a workflow is configured or a local build succeeds.

Critical failures in installation, updater-signature verification, launching, proxy safety, rollback, and user-data preservation block acceptance. Native registration coverage now passes; live feature acceptance and the remaining Windows/update gates still block production acceptance. The user authorized release work on 2026-10-26; missing prerequisites must not be described as missing authorization.
