# VibeHub Migration Audit — Gate 0

**Date:** 2026-10-26 · **Branch:** `feat/vibehub-final` (from `main` @ `eda65ab`) · **Scope:** Phase 0 of the VibeHub master plan (`docs/product/VibeHub_Final_Master_Plan_v4_FA.md`)

> **خلاصهٔ فارسی:** مخزن AgentRTL در وضعیت پایدار است: سه Adapter واقعی RTL (ZCode، Qoder، DeepSeek Harness) با شواهد آزمون زندهٔ ۱۸ اکتبر ۲۰۲۶، CI سبک، و بدون تست رفتاری در CI. سه نقص ثبت شد: (۱) خرابی مسیرهای غیر ASCII هنگام عبور خروجی فرایند فرزند با codepage قدیمی، (۲) ناهمگونی نسل Adapterها (ZCode قدیمی‌ترین و بدون فونت)، (۳) اجرا نشدن تست‌های رفتاری در CI. تم `mak-devline.omp.json` پذیرفته و فقط با یک اصلاح مجاز به `themes/terminal/` منتقل شد؛ رندر واقعی Oh My Posh 29.21.0 هر دو نسخه را مقایسه و اصلاح را اثبات کرد.

---

## 1. Repository map (as found, `main` @ `eda65ab`)

```text
AgentRTL/
├─ apps/
│  ├─ ZCode/             start.ps1, injector.mjs (165 L), launch.vbs, launch.sh, README{,.fa}.md   ← no assets/, no style module
│  ├─ Qoder/             start.ps1, injector.mjs (245 L), style.mjs, doctor.mjs (286 L), launch.vbs,
│  │                     qoder-path.txt mechanism, README{,.fa}.md, LICENSE, assets/ (Vazirmatn 400/700 + OFL)
│  └─ DeepSeekHarness/   start.ps1, injector.mjs (142 L), launch.vbs, README{,.fa}.md, assets/ (Vazirmatn 400/700 + OFL)
├─ install.ps1           source-checkout shortcut installer (zcode|qoder|deepseek), -Uninstall/-WhatIf
├─ install.sh            Linux/macOS ZCode installer
├─ cleanup.ps1           stops injectors owned by a checkout root
├─ installer.iss         Inno Setup 6, per-user ({localappdata}\AgentRTL), AppId A7E3F1B2-…
├─ tests/qoder-discovery.ps1   7-assertion behavioral suite (Qoder path detection only)
├─ docs/                 fonts/, validation/ (live-test report + PNGs), hero/demo assets, capture scripts
├─ .github/workflows/    ci.yml (static checks only), release.yml (Inno build + zip + SHA256 via tag v*)
├─ LICENSE (MIT) · README{,.fa}.md · .github/release-body.md
```

No `package.json`, no Node dependencies (stdlib-only `.mjs`), no Tauri, no SBOM, no code signing.

## 2. RTL adapter inventory — three generations

All three share one mechanism: launch the Electron app with `--remote-debugging-port`, then a Node daemon injects CSS through CDP. A second "lock port" (`port+1`) guarantees a single injector instance.

| | ZCode | DeepSeek Harness | Qoder |
|---|---|---|---|
| Ports (app / lock) | 9222 / 9223 | 9228 / 9229 | 9225 / 9226 (env-overridable) |
| Injection | inline CSS string, 2 s poll sweep | style w/ base64 Vazirmatn, poll | **`style.mjs` shared module**, browser-level `Target.setAutoAttach{flatten}`, per-session `Page.addScriptToEvaluateOnNewDocument`, 5 s safety sweep, CSP bypass, re-inject on `frameNavigated` |
| Vazirmatn bundled | ✗ (system fallbacks only) | ✓ woff2 400/700 + OFL | ✓ woff2 400/700 + OFL |
| Bidi strategy | `unicode-bidi: plaintext` on prose; pre/code excluded | same + app-specific selectors (`_markdown_`, `bubble`, composer) | same + composer-upgrade override, editor/terminal/tree guard with `!important`, font fallback chain |
| Verification (`doctor`) | ✗ | ✗ | ✓ `doctor.mjs --targets/--probe/--check/--shot` |
| Discovery | fixed 3 candidate paths | fixed 1 path | env override → saved `qoder-path.txt` → running process → versioned `.qoder-versions` (newest with real `app.asar`) → legacy flat |
| Already-running handling | error prompts full quit | error prompts full quit | revives dead injector; distinguishes foreign port owners |
| Linux/macOS | ✓ (`launch.sh`, `install.sh`) | ✗ | ✗ |

**Migration implication:** Qoder's adapter is the reference implementation to generalize into `packages/rtl`; ZCode's is the debt (no font, no doctor, poll-only). Live evidence (`docs/validation/windows-live-test.md`, 2026-10-18): ZCode 3.15.3.8237, Qoder 0.4.4.0, DeepSeek Harness 0.2.1-rc.2 all PASS, incl. reload survival, simultaneous run, duplicate-injector lock, and missing-Node messaging.

## 3. Test baseline (exact commands and results, 2026-10-26, Node 24.20.0, Win 10 x64)

| Check | Command | Result |
|---|---|---|
| JS syntax | `node --check` × 5 `.mjs` | **PASS** (all 5) |
| PowerShell parse | `[Parser]::ParseFile` × 5 (install, cleanup, 3× start) | **PASS** |
| Bash syntax | `bash -n apps/ZCode/launch.sh install.sh` | **PASS** |
| Workflow YAML | `python yaml.safe_load` × 2 | **PASS** |
| Behavioral suite | `tests/qoder-discovery.ps1` | **4/7 PASS** on default console (codepage IBM437); **7/7 PASS** with `chcp 65001` |

The 3 "failures" are not product-logic failures — see Defect D1. CI runs the four static checks only; the behavioral suite is **not** wired into `ci.yml`.

## 4. First three defects found (required by Gate 0)

- **D1 — Non-ASCII paths corrupt on child-process handoff (real product bug).** `start.ps1 -Discover` prints an exe path; `install.ps1` captures it via `& powershell.exe … 2>&1`. On a console with a legacy codepage (this machine: IBM437), characters outside it (e.g. Persian `ک`, common in Iranian Windows user folders) are silently replaced with `?` **before** `Test-Path`/shortcut creation — corrupting `qoder-path.txt`-style flows for exactly the target audience. Proof: suite passes 7/7 under `chcp 65001`, 4/7 under IBM437, deterministic repro. Fix direction: set `[Console]::OutputEncoding = UTF8` inside the child before output, or hand off via temp file/base64; add a regression assertion that round-trips a Persian path (the suite already constructs `custom-ک`). Must be fixed before the VibeHub installer reuses this handoff.
- **D2 — Adapter generation drift; ZCode ships no font.** ZCode (the app the referral flow targets!) runs the oldest injector: no bundled Vazirmatn (violates the product's own "Persian renders in Vazirmatn" promise at §0.2-6 for that app), no doctor, poll-only coverage, three hardcoded paths. Unifying on the Qoder generation (style module + auto-attach + doctor) inside `packages/rtl` is a Gate 6 prerequisite; the ZCode injector must not be deleted until its replacement passes the same live checks.
- **D3 — Behavioral tests are not enforced.** `ci.yml` never runs `tests/qoder-discovery.ps1`, which is precisely why D1 could land unnoticed (the suite catches it). CI must run the suite (Windows runner, with UTF-8 console) and VibeHub CI must grow per-package test wiring from Gate 1 onward.

## 5. Supplied Oh My Posh theme — acceptance record

- **Source (owner-supplied):** `C:\Users\Mak\.local\mak-devline.omp.json` → normalized copy at `themes/terminal/mak-devline.omp.json`.
- **Schema:** v4, 2 prompt blocks, segments `python+git+path+status+executiontime` / second-line `status` — matches the directive's description.
- **Single sanctioned fix** (git diff = exactly 1 line, L27 git segment): `<#<#F9E2AF>` → `<#F9E2AF>`. Nothing else touched.
- **Validation:** `JSON.parse` OK; real render with Oh My Posh 29.21.0 in this repo shows the original leaking a literal `<#` artifact into the prompt while the fix renders cleanly with the working-tree marker colored `#F9E2AF` (RGB 249,226,175 verified in ANSI output). All segments render (Python 3.14.7 + venv, git branch/branch-status/working/staging, full path, status, exec time, `❯` second line).
- Fonts: theme assumes Nerd Font glyphs (branch icon, python icon, stash icon) — Gate 8 must pair it with JetBrainsMono Nerd Font Mono per plan §4.9.

## 6. Risk register

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Node.js ≥ 21 hard prerequisite for end users (installers hard-fail without it) | Plan Gate 6: bundle as Tauri sidecar or port to Rust; no external Node at ship time |
| R2 | Inno Setup → Tauri 2 migration; old AppId `A7E3F1B2-…` kept "so existing installs upgrade in place" conflicts with new AppID decision | Plan §6.1 allows new AppID (`dev.vibehub.app`) since no user base needs migration; record decision, keep old installer artifacts untouched in history |
| R3 | Unsigned releases today; VibeHub requires signed updater | Gate 13: Tauri updater keys (public in client, private in GitHub Secrets) |
| R4 | Fixed CDP ports (9222/9225/9228) can conflict; env override exists but no auto-selection | Keep explicit-port policy in `packages/launcher`, detect and report conflicts (NET-02) |
| R5 | CDP opens full window control to any local process while running | Document in-app (plan §7.5); ports bound to localhost only |
| R6 | No THIRD_PARTY_LICENSES/SBOM consolidation (Vazirmatn OFL exists per-folder) | Gate 14: `docs/legal/THIRD_PARTY_LICENSES.md` + SBOM workflow |
| R7 | Freebuff/OpenCode/MiMo capabilities are claims until adapters exist | Catalog `capabilities` must come from adapter tests (plan §1.1 rule); ship `Unknown/Unsupported` honestly |
| R8 | D1 affects Persian-username machines = primary audience | Fix in Gate 5 (installer work) with regression test; until then source-checkout install on such machines may mis-resolve Qoder path |

## 7. Migration decisions (binding for later gates)

1. **History & branch:** all VibeHub work on `feat/vibehub-final`; no force-push, no history rewrite; existing `apps/*` stay functional until their `packages/*` replacements pass the same regression evidence (live-test doc + suite).
2. **Target tree:** adopt `apps/desktop` + `packages/{core,catalog,launcher,rtl,proxy,terminal}` + `content/` per plan §2.1; additive first, delete legacy only after parity.
3. **RTL core:** generalize Qoder's generation (style module, auto-attach, doctor) as `packages/rtl`; ZCode and DeepSeek adapters become configs + selectors on top of it.
4. **Identity:** product id `dev.vibehub.app`, display name VibeHub, MIT stays; old AgentRTL AppId not reused.
5. **Theme:** `themes/terminal/mak-devline.omp.json` is the single accepted source; any further change needs a documented diff + render proof like §5.
6. **Content is data, never code:** no command/URL execution from future `content/` feeds (plan §5.3) — enforce with schema validation from Gate 4.
7. **Test wiring:** every gate adds its tests to CI; behavioral suites run on Windows runners with UTF-8 console (D1/D3).

## 8. Baseline acceptance-matrix status

Of the §9 matrix (28 cases): 3 partially evidenced today via `docs/validation/` (APP-01 detect/launch for the three existing apps; APP-04 RTL self-heal after reload; NET-02 duplicate/port-conflict messaging — all dated 2026-10-18, app versions listed in §2). Everything else: **UNKNOWN / not started**. No claim of PASS is inherited without a current run.

## 9. Gate 1 prerequisites (next stage)

- Toolchain: Node (have 24.20.0), pnpm, Rust toolchain + Tauri 2 CLI (to be installed with owner consent if missing).
- Scaffold `apps/desktop` (Tauri 2 + React + TS + Vite + Tailwind) inside this branch; brand assets; safe IPC skeleton; runnable Windows dev build = Gate 1 exit.
- Carry D1 fix into any new discovery code from day one; port the qoder-discovery suite to run under the new CI matrix.
