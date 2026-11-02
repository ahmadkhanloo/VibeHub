# VibeHub Persian RTL and Vazirmatn Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Persian text display with correct block-level bidi and bundled Vazirmatn across requested VibeHub app adapters, while preserving code surfaces and reporting live verification honestly.

**Architecture:** Add small shared helpers for local Vazirmatn embedding, scoped prose CSS and idempotent style installation. Keep each application's observed selectors and CDP/window attachment logic in its own adapter. Wire adapter availability through the Windows host and catalog UI; keep `chatgpt` as the existing input but enable its RTL component only when package identity proves the installed product is Codex. Add `freebuff-desktop` as a distinct catalog/runtime ID so the existing Freebuff CLI remains unchanged.

**Tech Stack:** Existing Node.js ESM, CSS, CDP, PowerShell, Rust/Tauri, React/TypeScript and Playwright; no framework or runtime dependency additions.

**Spec:** `docs/superpowers/specs/2026-11-02-vibehub-persian-rtl-design.md`

## Global Constraints

- Keep the existing checkout and preserve every pre-existing staged, unstaged and untracked change; do not reset, clean, relocate, stage or commit those changes.
- Use the font family `Vazirmatn` with local regular weight `400` and bold weight `700`; no network font requests.
- Scope bidi and font rules to observed prose and composer surfaces. Code, diff, terminal, file tree, standalone paths, menus and project web previews stay under their own styles.
- Preserve the current `chatgpt` API/input and Codex account-management flow. Enable RTL only when Windows package identity resolves to Codex; ordinary ChatGPT remains unaffected.
- Keep the existing `freebuff` ID for CLI; add `freebuff-desktop` for the official desktop app.
- Add no dependencies; do not modify installed target-app files, create a terminal product, change CLI output or publish a release.
- UI availability comes from installed adapter components. Mark `verified` only after a live test of that product and surface.
- Do not use mock or fixture results as proof of target-app compatibility. Record unavailable apps and blocked live surfaces in the final evidence report.

## Review Focus

1. **Mixed Persian and English within streamed text blocks:** the leading strong character must determine each block's direction while links and inline spans retain readable order. Test in `tests/ui/rtl-rendering.spec.ts` with mixed prose, numbers, punctuation and ZWNJ, including content appended after initial render.
2. **Plan enlargement and return to chat:** detached, expanded or portal-rendered content must retain its stylesheet and loaded font after closing and reopening. Exercise the reversible surface lifecycle in the browser fixture and in every accessible real app; the Codex live visual result remains explicitly unverified in this environment.
3. **New documents and nested roots:** repeated injection, reloads, new windows, iframes, webviews and observed open Shadow DOM must not duplicate styles or observers. Test installer idempotence in `tests/ui/rtl-rendering.spec.ts` and adapter attachment boundaries in per-app Node tests.
4. **Protected content and text operations:** code, diff, terminal and file paths keep their LTR/font behavior; prose tables and links remain selectable and copyable. Test computed styles plus selection/copy in `tests/ui/rtl-rendering.spec.ts`, and verify real app code/diff surfaces where accessible.
5. **Windows identity and lifecycle collisions:** Codex must be distinguished from regular ChatGPT despite `ChatGPT.exe`, and simultaneous starts, busy ports, stop/reconnect and normal relaunch must not affect unrelated processes. Test package identity resolution in `tests/codex-discovery.ps1` and host lifecycle in `tests/native-windows.ps1`.

---

### Task 1: Shared scoped style and local font helpers

**Files:**
- Create: `apps/rtl-style.mjs`
- Create: `tests/rtl-style.test.mjs`
- Create: `tests/ui/rtl-rendering.spec.ts`
- Modify: `apps/rtl-direction.mjs`

**Interfaces:**
- Produce `embedVazirmatnFonts(assetDirectory: URL | string): string`, returning regular 400 and bold 700 `@font-face` rules from the supplied adapter assets.
- Produce `buildScopedTextCss({ prose, composers, guards, family? }): string`, applying plaintext bidi and start alignment only to supplied prose/composer selectors and protecting guarded code surfaces without replacing their app-defined font families.
- Produce `buildIdempotentStyleSource({ styleId, css, observerKey, autoHeadingSelector?, shadowHostSelectors? }): string`, installing one style per supplied document/open-shadow root and at most one managed observer per document. App-specific host selectors and CDP/window target attachment remain outside this helper.
- Keep `DIRECTION_ALIGNMENT_CSS` and `buildAutoHeadingDirectionScript` behavior available to existing importers.

- [ ] **Step 1: Write failing unit tests** named `embeds both local Vazirmatn weights`, `scopes plaintext bidi to supplied content selectors`, and `generated style installer uses stable IDs and an observer key`. Assert font weights 400/700 and data URLs; assert prose selectors receive `unicode-bidi:plaintext` and `font-family:'Vazirmatn'`; assert protected selectors get LTR/isolation/alignment safeguards without a font override; assert the generated source contains its stable style ID and observer key. Runtime idempotence is exercised by the browser test in Step 5.
- [ ] **Step 2: Run the focused test to verify RED.** Run `node --test tests/rtl-style.test.mjs`. Expected: the three named tests fail because the module and exports do not exist.
- [ ] **Step 3: Implement the three exports in `apps/rtl-style.mjs`.** Read only the two supplied local font files; keep selectors caller-supplied and do not add a page-wide selector.
- [ ] **Step 4: Run the focused Node test to verify GREEN.** Run `node --test tests/rtl-style.test.mjs`. Expected: all three tests pass.
- [ ] **Step 5: Add the browser fixture test** `scoped RTL styles load Vazirmatn and survive repeated installation and appended content` in `tests/ui/rtl-rendering.spec.ts`. Use `page.setContent` and the shared generated source; assert computed direction/bidi/font, `document.fonts.check`, one style in the document and each supplied open ShadowRoot, one observer marker after repeated evaluation, dynamically appended prose/new matching shadow host and isolated `pre/code`; save a fixture screenshot under `output/rtl-audit/` for visual review.
- [ ] **Step 6: Run the browser fixture to verify behavior.** Run `pnpm exec playwright test tests/ui/rtl-rendering.spec.ts --reporter=list`. Expected: the fixture test passes and the computed family is Vazirmatn after `document.fonts.load`.

### Task 2: Qoder adapter audit and repair

**Files:**
- Modify: `apps/Qoder/style.mjs`, `apps/Qoder/injector.mjs`, `apps/Qoder/doctor.mjs`
- Modify: `tests/rtl-behavior.test.mjs`
- Evidence: `docs/validation/20261102_rtl_font_audit.md`

**Interfaces:**
- Continue exporting `CSS_TEXT`, `STYLE_ID`, `buildCss` and `INJECT_JS` from `apps/Qoder/style.mjs` for the existing doctor and tests.
- Preserve Qoder's multi-target CDP attachment; share only font/CSS/lifecycle mechanics.

- [ ] **Step 1: Record real Qoder surfaces** using `node apps/Qoder/doctor.mjs --targets` and `node apps/Qoder/doctor.mjs --probe --verbose`. Record observed message, composer, expanded-plan and frame/webview selectors in the evidence report; do not add selectors from class-name guesses.
- [ ] **Step 2: Write the failing regression test** `Qoder scopes both weights to observed prose and composer surfaces while protecting editor and terminal` in `tests/rtl-behavior.test.mjs`. Assert the observed selectors, local 400/700 font rules, plaintext prose, composer coverage, and LTR/font guards for code, Monaco, xterm, tree and toolbar.
- [ ] **Step 3: Run the focused test to verify RED.** Run `node --test tests/rtl-behavior.test.mjs`. Expected: the new assertion fails for any observed surface or shared-helper integration still missing.
- [ ] **Step 4: Refactor Qoder style generation to the shared helper** without widening selectors. Keep CDP frame attachment, CSP fallback and current style IDs/reload behavior intact.
- [ ] **Step 5: Run Qoder Node tests to verify GREEN.** Run `node --test tests/rtl-behavior.test.mjs tests/rtl-style.test.mjs`. Expected: all focused tests pass.
- [ ] **Step 6: Run live Qoder doctor checks** with the app opened through the RTL launcher: `node apps/Qoder/doctor.mjs --targets`, `--probe`, `--check` and `--shot`. Expected: every observed text-bearing frame reports the style, plaintext bidi and Vazirmatn loaded; the screenshot pair is saved as evidence. If an app surface is not present, record it as untested.

### Task 3: ZCode adapter audit and repair

**Files:**
- Modify: `apps/ZCode/injector.mjs`
- Modify: `tests/rtl-behavior.test.mjs`
- Create: `tests/zcode-rtl.test.mjs`
- Evidence: `docs/validation/20261102_rtl_font_audit.md`

- [ ] **Step 1: Inspect available ZCode DOM/CDP targets** before writing selector assertions. If no installed/live target is available, use only selectors already evidenced by repository diagnostics and explicitly mark surface verification unavailable.
- [ ] **Step 2: Write the failing test** `ZCode applies shared font and bidi rules only to observed chat surfaces and keeps code surfaces LTR`. Assert both bundled weights are read, the real prose/composer selectors are scoped, `pre/code` and terminal/editor surfaces are excluded, and repeated page injection keeps one style ID.
- [ ] **Step 3: Run `node --test tests/zcode-rtl.test.mjs` to verify RED.** Expected: fail on at least one missing target, font, guard or idempotence behavior.
- [ ] **Step 4: Refactor the injector to shared font/CSS helpers** and extend target/frame/window handling only for observed ZCode surfaces. Preserve port and launcher contracts.
- [ ] **Step 5: Run `node --test tests/zcode-rtl.test.mjs tests/rtl-behavior.test.mjs tests/rtl-style.test.mjs`.** Expected: all pass; no duplicate stylesheet is produced by repeated evaluation.
- [ ] **Step 6: If ZCode is installed, run the real app with the RTL shortcut** and record target inventory, computed font/bidi, reload and new-window results. Otherwise record the missing executable/window and do not mark verified.

### Task 4: DeepSeek Harness adapter audit and repair

**Files:**
- Modify: `apps/DeepSeekHarness/injector.mjs`
- Modify: `tests/rtl-behavior.test.mjs`
- Create: `tests/deepseek-harness-rtl.test.mjs`
- Evidence: `docs/validation/20261102_rtl_font_audit.md`

- [ ] **Step 1: Inspect available DeepSeek Harness renderer/frame surfaces** before writing selector assertions; record when the app is not installed or cannot expose a target.
- [ ] **Step 2: Write the failing test** `DeepSeek Harness scopes bidi and local fonts to observed app prose and composer surfaces`. Assert the real app URL/target filter, content selectors, both font weights, code/editor/terminal exclusions and reload-safe style ID.
- [ ] **Step 3: Run `node --test tests/deepseek-harness-rtl.test.mjs` to verify RED.** Expected: fail on each unimplemented behavior captured by the test.
- [ ] **Step 4: Refactor to shared helpers** while preserving the existing `dsh-app://app/` target boundary and CDP port protocol.
- [ ] **Step 5: Run the focused Node regression tests.** Run `node --test tests/deepseek-harness-rtl.test.mjs tests/rtl-behavior.test.mjs tests/rtl-style.test.mjs`. Expected: all pass.
- [ ] **Step 6: Run a live app check if the actual executable is available.** Verify existing/streamed message text, composer, code and reload; otherwise record unavailable and leave RTL unverified.

### Task 5: Antigravity adapter audit and repair

**Files:**
- Modify: `apps/Antigravity/style.mjs`, `apps/Antigravity/injector.mjs`
- Modify: `tests/rtl-behavior.test.mjs`
- Create: `tests/antigravity-rtl.test.mjs`
- Evidence: `docs/validation/20261102_rtl_font_audit.md`

- [ ] **Step 1: Inspect Antigravity's available CDP documents, webviews and expanded content** before writing selector assertions; record what is not observable.
- [ ] **Step 2: Write the failing test** `Antigravity renders observed chat text in Vazirmatn and leaves code/editor/terminal surfaces unchanged`. Assert local regular/bold assets, actual prose/composer selectors and app-config target guard.
- [ ] **Step 3: Run `node --test tests/antigravity-rtl.test.mjs` to verify RED.** Expected: fail on missing font or selector/lifecycle behavior.
- [ ] **Step 4: Switch style construction to shared helpers** while preserving the existing app identity check and one-style install lifecycle.
- [ ] **Step 5: Run `node --test tests/antigravity-rtl.test.mjs tests/rtl-behavior.test.mjs tests/rtl-style.test.mjs`.** Expected: all pass.
- [ ] **Step 6: If the real application is installed, inspect regular and expanded chat after reload** and record computed font and code guards. Do not infer a visual pass from the fixture test.

### Task 6: OpenCode desktop adapter audit and completion

**Files:**
- Modify: `apps/OpenCode/style.mjs`, `apps/OpenCode/injector.mjs`, `apps/OpenCode/start.ps1`, `apps/OpenCode/launch.vbs`
- Modify: `tests/opencode-rtl.test.mjs`, `tests/opencode-discovery.ps1`, `tests/ui/opencode-rtl.spec.ts`
- Evidence: `docs/validation/20261102_rtl_font_audit.md`

- [ ] **Step 1: Inspect the running OpenCode 2.2.5 desktop renderer** and record real chat, composer, expanded-plan, secondary-window and frame selectors. Check current `oc://renderer/index.html` target and every nested target that actually exists.
- [ ] **Step 2: Write failing OpenCode tests** for observed prose/composer selection, streaming/reload/fullscreen lifecycle, local regular/bold fonts, protected code/diff/terminal, and one style after reinjection. Extend `tests/opencode-rtl.test.mjs`; name the browser case `OpenCode retains Persian direction and font after expanded content is closed and reopened`.
- [ ] **Step 3: Run `node --test tests/opencode-rtl.test.mjs` to verify RED.** Expected: fail for any missing selector, lifecycle or font assertion.
- [ ] **Step 4: Refactor the existing adapter to shared helpers** and add only the observed secondary-root/target behavior; preserve the current app-target guard and 9234 port contract.
- [ ] **Step 5: Run `node --test tests/opencode-rtl.test.mjs tests/rtl-style.test.mjs` and `pnpm exec playwright test tests/ui/opencode-rtl.spec.ts tests/ui/rtl-rendering.spec.ts --reporter=list`.** Expected: focused tests pass.
- [ ] **Step 6: Run OpenCode through its real RTL shortcut** and inspect standard/expanded chat, new content, switch chat, reload, code, diff, table, link and selection/copy. Record screenshot and computed font results; fixture tests alone do not satisfy this step.

### Task 7: Codex-only RTL adapter on the existing ChatGPT input

**Files:**
- Create: `apps/CodexDesktop/start.ps1`, `apps/CodexDesktop/launch.vbs`, `apps/CodexDesktop/injector.mjs`, `apps/CodexDesktop/style.mjs`, and local font assets
- Modify: `apps/desktop/src-tauri/src/windows.ps1`, `apps/rtl-paths.ps1`, `content/apps/chatgpt.json`
- Create: `tests/codex-rtl.test.mjs`, `tests/codex-discovery.ps1`
- Modify: `tests/native-windows.ps1`

**Interfaces:**
- Keep the public/runtime `appId` equal to `chatgpt`; add a pure resolver `Resolve-OpenAIProduct(packageName, executablePath)` that returns `codex`, `chatgpt` or `unknown` based on package identity and exact executable location.
- `Get-RtlComponents` may report `id=chatgpt, available=true` only when the Codex adapter files/runtime exist and the resolved product is Codex.
- `rtl-setup` and `launch` must fail closed for ordinary ChatGPT when `rtl=true`; preserve existing Codex account operations and their IDs.

- [ ] **Step 1: Write failing tests** `Codex package identity enables chatgpt RTL only for OpenAI.Codex`, `ordinary ChatGPT remains non-RTL`, and `Codex account-management operations keep their existing IDs`. In PowerShell tests, call the pure resolver with synthetic `OpenAI.Codex` and `OpenAI.ChatGPT` package fixtures; assert the same `ChatGPT.exe` basename does not decide identity.
- [ ] **Step 2: Run `node --test tests/codex-rtl.test.mjs` and `pwsh -NoProfile -File tests/codex-discovery.ps1` to verify RED.** Expected: missing resolver/adapter and feature-gating assertions fail.
- [ ] **Step 3: Inspect Codex package resources and supported launch parameters without automating the Codex UI.** Confirm the exact package identity, app activation path and whether a reversible CDP port can be passed without modifying the target installation. Record any blocked point before claiming the adapter available.
- [ ] **Step 4: Implement the Codex adapter and package resolver.** Keep the `chatgpt` input and account-management functions; constrain the adapter to the Codex package and app surfaces only. If supported CDP startup cannot be proved, return adapter unavailable with a direct reason instead of launching broadly.
- [ ] **Step 5: Run the focused Node and Windows tests to verify GREEN.** Expected: Codex fixture is eligible, ordinary ChatGPT is rejected, and account tests remain unchanged.
- [ ] **Step 6: Record live acceptance as unverified in this environment.** Do not claim plan/fullscreen visual acceptance because UI automation of Codex Desktop is unavailable here.

### Task 8: Freebuff Desktop adapter separate from Freebuff CLI

**Files:**
- Create: `apps/FreebuffDesktop/start.ps1`, `apps/FreebuffDesktop/launch.vbs`, `apps/FreebuffDesktop/injector.mjs`, `apps/FreebuffDesktop/style.mjs`, local font assets and `content/apps/freebuff-desktop.json`
- Modify: `apps/desktop/src-tauri/src/windows.ps1`, `apps/rtl-paths.ps1`
- Create: `tests/freebuff-desktop-rtl.test.mjs`, `tests/freebuff-desktop-discovery.ps1`
- Modify: `tests/native-windows.ps1`

- [ ] **Step 1: Write failing tests** `Freebuff Desktop has a distinct ID from the Freebuff CLI`, `desktop launcher targets only the official app renderer`, and `desktop selector/font rules preserve terminal/code surfaces`. Assert the existing `freebuff` CLI mapping remains unchanged.
- [ ] **Step 2: Run `node --test tests/freebuff-desktop-rtl.test.mjs` and `pwsh -NoProfile -File tests/freebuff-desktop-discovery.ps1` to verify RED.** Expected: the desktop manifest, detection and adapter assertions fail.
- [ ] **Step 3: Identify official install metadata and executable conventions** from official package/site metadata and any installed files. Do not treat a guessed path or an unrelated CLI shim as the desktop executable.
- [ ] **Step 4: Implement the separate desktop adapter and detection.** Reuse shared fonts and style mechanics; require a verified official desktop product path and actual renderer URL before marking the component available.
- [ ] **Step 5: Run focused Node/PowerShell tests.** Expected: `freebuff` CLI detection and launch remain as before; `freebuff-desktop` is independently discoverable and fail-closed.
- [ ] **Step 6: Record the live test as unavailable if no actual Freebuff Desktop executable/window is present.** The official site lists Windows desktop builds, but fixture tests do not establish app compatibility.

### Task 9: Windows host lifecycle, supported IDs and runtime availability

**Files:**
- Modify: `apps/desktop/src-tauri/src/windows.ps1`, `apps/desktop/src-tauri/src/domain.rs`, `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/rtl-paths.ps1`
- Modify: `tests/native-windows.ps1`, `tests/app-discovery.ps1`, `tests/opencode-discovery.ps1`, `tests/rtl-paths.ps1`, `tests/rtl-setup.ps1`

- [ ] **Step 1: Add failing host tests** for Codex-versus-ChatGPT detection, Freebuff Desktop discovery, adapter component availability/configuration, complete supported-ID allowlists, shortcut target validation, normal launch stopping the matching injector, simultaneous launch, occupied ports, reconnect, stop ownership, and normal relaunch.
- [ ] **Step 2: Run each focused Windows test to verify RED:** `pwsh -NoProfile -File tests/codex-discovery.ps1`; `pwsh -NoProfile -File tests/freebuff-desktop-discovery.ps1`; `pwsh -NoProfile -File tests/app-discovery.ps1`; `pwsh -NoProfile -File tests/opencode-discovery.ps1`; `pwsh -NoProfile -File tests/rtl-setup.ps1`; `pwsh -NoProfile -File tests/rtl-paths.ps1`. Expected: new adapter IDs and lifecycle behaviors are missing.
- [ ] **Step 3: Extend exact ID allowlists and path/component maps** in Rust and PowerShell. Preserve all existing generic command shapes; avoid accepting unknown IDs based on partial name matches.
- [ ] **Step 4: Implement fail-closed launch/setup/stop behavior**. Normal launch must stop only the tracked app's matching injector; port, PID and command-line ownership must be checked before stopping. Keep account functions and CLI launch handling intact.
- [ ] **Step 5: Run the focused host tests to verify GREEN.** Expected: all listed scripts pass and no unrelated process can be stopped by a synthetic state.
- [ ] **Step 6: Run `pwsh -NoProfile -File tests/native-windows.ps1`.** Expected: all host assertions pass, including app record count of 11, with the real user profile untouched.

### Task 10: Catalog capability gate, translations, guides and CLI audit

**Files:**
- Modify: `apps/desktop/src/features/explore/AppDetails.tsx`, `apps/desktop/src/components/LaunchControls.tsx`, `apps/desktop/src/components/Projects.tsx`, `apps/desktop/src/components/AppSummary.tsx`
- Modify: `apps/desktop/src/lib/catalog.ts`, `packages/core/src/index.ts`, `packages/core/src/schemas.ts`, `packages/catalog/src/index.ts`
- Modify: `content/apps/chatgpt.json`; create `content/apps/freebuff-desktop.json`
- Modify: `apps/desktop/src/i18n/fa/*`, `apps/desktop/src/i18n/en/*`, `docs/tutorials/opencode/{fa,en}.md`, `docs/tutorials/chatgpt/{fa,en}.md`; add Freebuff Desktop guide/README files
- Create: `tests/rtl-catalog.test.mjs`, `tests/ui/rtl-capability.spec.ts`, `docs/validation/20261102_rtl_font_audit.md`

- [ ] **Step 1: Write failing catalog and UI tests** `RTL controls follow available adapter components rather than app IDs`, `verified status stays separate from adapter availability`, `ordinary ChatGPT receives no RTL control`, and `Freebuff CLI and Desktop render as distinct catalog items`. Assert no `antigravity`/`opencode` hard-coded capability exceptions remain.
- [ ] **Step 2: Run `node --test tests/rtl-catalog.test.mjs` and `pnpm exec playwright test tests/ui/rtl-capability.spec.ts --reporter=list` to verify RED.** Expected: ID-based support and missing desktop record make tests fail.
- [ ] **Step 3: Implement availability from installed component state** while leaving the verification badge driven by catalog evidence. Gate Codex on its runtime product variant; leave ChatGPT ordinary unavailable.
- [ ] **Step 4: Add Freebuff Desktop content and update supported ID/schema handling.** Keep current Freebuff CLI and MiMo Code CLI entries; add translated guidance and explicit status limits for CLI and uninstalled desktop apps.
- [ ] **Step 5: Run focused catalog, schema and UI tests to verify GREEN.** Run `node --test tests/rtl-catalog.test.mjs packages/core/tests/*.mjs packages/catalog/tests/*.mjs` and `pnpm exec playwright test tests/ui/rtl-capability.spec.ts tests/ui/rtl-setup.spec.ts --reporter=list`.
- [ ] **Step 6: Run `pnpm i18n:check` and `pnpm content:validate`.** Expected: all locales have matching keys and every app manifest/guide validates.
- [ ] **Step 7: Audit all remaining catalog entries.** Check `freebuff`, `mimocode` and `claude-code` from installed-version/help output or official docs without adding a terminal renderer or rewriting output. Check `claude-desktop` for an installed executable and accessible message surface; do not guess selectors or claim support if unavailable. Record source/version, Persian-text limit, surface and test status per entry in `docs/validation/20261102_rtl_font_audit.md`.

### Task 11: Full and independent RTL payload lifecycle

**Files:**
- Modify: `scripts/prepare-windows-rtl-payload.ps1`, `apps/desktop/src-tauri/tauri.conf.json`, `installer.iss`, `apps/desktop/src-tauri/windows/installer.nsi`, `cleanup.ps1`
- Modify: `apps/desktop/src-tauri/src/windows.ps1`, `tests/rtl-setup.ps1`, `tests/rtl-paths.ps1`, `tests/native-windows.ps1`

- [ ] **Step 1: Write failing packaging tests** for every app adapter's launcher, injector, style module and regular/bold assets in both full and independent RTL payloads; assert upgrade preserves existing shortcut targets and removal deletes only VibeHub-owned launchers.
- [ ] **Step 2: Run the new payload/install tests to verify RED.** Expected: Codex/Freebuff Desktop assets and lifecycle records are absent from at least one package mode.
- [ ] **Step 3: Add the new adapters to payload preparation, resource declarations and owned-shortcut upgrade/removal logic.** Do not change installed target-app files and do not overwrite unrelated shortcuts.
- [ ] **Step 4: Run `pwsh -NoProfile -File tests/rtl-setup.ps1`, `tests/rtl-paths.ps1` and the targeted packaging tests.** Expected: full and standalone RTL payload checks pass; a second setup/upgrade is idempotent; removal leaves unrelated shortcuts intact.
- [ ] **Step 5: Build the local VibeHub package** with `pnpm build` and inspect its resource manifest/output for every required adapter/font. Do not create or publish a public release.

### Task 12: Real-app acceptance and evidence closeout

**Files:**
- Modify: `tests/ui/rtl-rendering.spec.ts` and per-app tests only for observed failures
- Complete: `docs/validation/20261102_rtl_font_audit.md`

- [ ] **Step 1: Run the focused browser acceptance** with `pnpm exec playwright test tests/ui/rtl-rendering.spec.ts tests/ui/opencode-rtl.spec.ts tests/ui/rtl-capability.spec.ts --reporter=list`. Verify mixed-language direction, font availability/computed family, streaming, switch/reload, reversible expansion, selection/copy, table/link, code/diff/path/terminal protection.
- [ ] **Step 2: Run live checks for every installed and automatable target** using each real app and its RTL launcher. Record version, actual surfaces, observed selectors, computed font, direction, screenshot and tested transitions. Do not mark absent apps as passing.
- [ ] **Step 3: Record Codex plan/fullscreen as unverified** because this environment forbids Codex Desktop UI automation. Record Freebuff Desktop as unverified if no official executable/window is installed. Do not substitute fixtures for either product result.
- [ ] **Step 4: Run full repository verification:** `pnpm test`, `pnpm check`, `pnpm content:validate`, `pnpm release:guard`, `pwsh -NoProfile -File tests/native-windows.ps1`, `pwsh -NoProfile -File tests/rtl-setup.ps1`, `pwsh -NoProfile -File tests/rtl-paths.ps1`, and `pnpm exec playwright test --reporter=list`.
- [ ] **Step 5: Finish the evidence matrix** for every manifest and requested surface with `available`, `configured`, `verified`, test result and limitation. Keep all changes in the working tree and confirm pre-existing staged/unstaged changes remain present.

## Execution Handoff

This is one sequential plan because adapter source, Windows host scripts, catalog UI and packaging share interfaces, and the checkout already contains related uncommitted work. **Native execution is recommended:** one implementer can preserve the in-progress changes and avoid conflicts in `windows.ps1`, catalog and packaging files; a fresh reviewer can inspect the complete result at the end. Subagent-driven execution remains possible, but independent agents should not edit the shared Windows/catalog/package files concurrently. Leave the resulting work uncommitted for review; do not stage any pre-existing changes.
