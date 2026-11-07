# Model workspace redesign: local validation

Date: 2026-11-07, Asia/Tehran. Source: base `3d61caa69f55c8a9bef1ad1e9cc7550e1ac51690` plus the existing and current uncommitted changes. Host: Windows 10.0.28000, Node 26.7.0, pnpm 12.15.0, Rust cargo 1.99.1.

## Results

- Full Playwright suite: 149 passed, two workers. Browser tests use mock native IPC unless a test explicitly describes another fixture; they are not installed-app acceptance.
- JavaScript suite: 89 passed.
- TypeScript checks, production frontend build, translation parity, content validation, native command registration and `git diff --check`: passed. The frontend build retains a warning for a chunk larger than 500 kB.
- Rust suite after the model-identifier validation fix passed with opt-in live tests ignored. The new custom endpoint and legacy-key origin tests also passed against local fixtures.
- Windows fixtures: native behavior 39 assertions, RTL setup 25 assertions, Qoder discovery 8 assertions; native array results, updater signature tampering, updater response parsing, Persian terminal adapter and Unicode RTL paths passed.
- Browser acceptance covers English and Persian, provider grouping, two NVIDIA connections, note persistence through reload, inline note editing, custom preview without saving, narrow view, 320px overflow, themes and keyboard/accessibility checks. The browser native layer was mocked.
- A full browser run initially found narrow-screen overflow and outdated selectors; these were fixed before the 149-pass run. A Rust backend test found that a newline-only model identifier was accepted; it was fixed and retested.

## Unverified

Clean Windows 10/11 install, upgrade, removal and updater lifecycle were not run: no disposable clean Windows machine was available. An installed native build and real signed-in vendor applications were not exercised. At the time of the initial run, live external provider accounts and real quota-consuming requests had not been used; see the live follow-up below. These results do not establish that all software paths work in production or that a release is ready. The no-bundle executable is a locally built development artifact, not a tested installer.

## Live follow-up — 2026-11-07

The existing Radeon credential in Claude settings was used without printing or persisting it. `node tests/claude-provider.live.mjs --live --models` returned HTTP 200 and 14 model IDs. With `CLAUDE_TEST_MODEL=DeepSeek-V4.1-Flash`, `node tests/claude-provider.live.mjs --live` passed the initial and continuation turns, Persian output, bundled plugin loading and the temporary-file Read tool check. One upstream request received HTTP 429 for concurrency; the retry returned HTTP 200. This verifies that specific Radeon/Claude path at the test time, not the installed VibeHub window or other providers.

A batch check using every saved provider key was rejected by automatic approval review because it would read multiple credentials and send model-listing and inference requests to multiple services with potential quota impact. No workaround was attempted. The clean-Windows lifecycle remains unverified: no disposable Windows VM or active Docker engine was found; the installer fixture explicitly requires a disposable CI runner.

The current source also built `VibeHub_0.2.6_x64-setup.exe` at 2026-11-07 15:20 +03:30, size 30,477,432 bytes, SHA-256 `DDE052817A38F30E1928FAE7289829D35A007C62280CEA7F294B03039AAAD6AE`. Windows Authenticode status: `NotSigned`. Building the installer does not establish installation, upgrade, removal or updater acceptance; those still require a disposable Windows environment.

## Explicitly authorized saved-provider checks — 2026-11-07

Following explicit approval to use the saved NVIDIA, Kira AI and InferX credentials, the native connection functions ran using the selected proxy. Only provider, model, counts and status were printed; credentials were not printed or changed. Each saved connection had no selected model, so the inference check used the corresponding VibeHub suggested model in memory only. The following are HTTP observations, not claims about the cause of each failure:

| Provider | Model listing | Suggested model used for one response request | Response |
|---|---|---|---|
| NVIDIA | HTTP success, 84 models | `meta/llama-3.3-70b-instruct` | HTTP 410; no model response confirmed |
| Kira AI | HTTP success, 105 models | `minimax-m3-free` | HTTP 404; no model response confirmed |
| InferX | HTTP 401; listing failed | `Qwen/Qwen3.6-35B-A3B` | HTTP 401; no model response confirmed |

The ignored opt-in tests `live_selected_saved_providers` and `live_selected_provider_inference` printed these observations; their harness exit status does not indicate that the providers passed. NVIDIA and Kira listing success confirms the request succeeded, not that the suggested inference models remain supported. InferX 401 indicates authentication was not confirmed; it does not identify the cause. No connection model selection or credentials were saved or changed. Clean Windows install, upgrade and uninstall remain unverified because a disposable Windows machine is unavailable.

## Existing Windows installation follow-up — 2026-11-07

At the user's explicit request, the lifecycle was tested on the existing Windows account, not a clean Windows VM. The installed starting version was 0.2.2 under `%LOCALAPPDATA%\VibeHub`. A restorable local backup was made at `%LOCALAPPDATA%\VibeHub-QA-Backup-20261107`: prior installation, app data, install registry and uninstall registry. The original executable and 11 original app-data files were checked against the backup. Existing credential vault entries were not exported.

- The locally built 0.2.6 installer was run with `/S /UPDATE`; it returned zero and the installed version registered as 0.2.6. All 11 original app-data files matched the backup immediately after upgrade. The installed binary differed from the build output by exactly three bytes in the Tauri bundle-type marker (`UNK` to `NSS`).
- The installed 0.2.6 process started, stayed responsive, and exposed its real VibeHub home window. That window showed a partial-information error and a previously recorded Qoder launch error; their causes were not determined. The AI-connections page was not exercised in the installed window because it was hidden and the UI automation tool reported unavailable input geometry.
- Launching the app changed `launch.json` and `codex-accounts/accounts.json`; a second app-data backup was taken after launch and all 2,609 files were hash-verified before uninstall.
- First silent uninstall returned exit code 0 and removed the uninstall registry key but the executable was still present at the immediate check. Reinstallation returned 0, registered 0.2.6, and all 2,609 post-launch backed-up files matched. This first observation remains a failed removal check; its cause was not established.
- Silent uninstall was repeated with a wait of up to 30 seconds. It returned 0 and the executable and uninstall registration were both absent at the first check. The same installer was run again; it returned 0 and registered version 0.2.6. All 2,609 files in the post-launch backup matched immediately after the second reinstall. The reinstalled executable then started, exposed a window and closed normally. That subsequent normal launch can update runtime state.

This is local acceptance on an existing user profile, not evidence for a clean Windows 10 or 11 installation, signed-updater upgrade, or every application function. The prior installation and data backups remain available for recovery.

## Installed-app follow-up — 2026-11-07

The installed 0.2.6 app was launched again. The previous partial-information notice did not appear on this observation, and Qoder was displayed as installed rather than in launch-error state; neither observation establishes the cause of the earlier transient state or verifies a new Qoder launch. The read-only native adapter operations `detect`, `detect-editors` and `rtl-components` returned structured responses on this host. In the actual installed window, the AI connections route opened, displayed saved provider rows including a single NVIDIA catalog row, and showed cached model results for a selected saved connection. No credentials were revealed, provider requests sent, or connection records edited during this UI check. Model listing and inference are covered separately by the live provider follow-up; note editing and persistence in the installed native window were not exercised.
