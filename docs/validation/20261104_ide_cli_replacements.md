# Antigravity IDE / Claude Code CLI replacement validation — 2026-11-04

## Delivered behavior

- Catalog and app IDs now use antigravity-ide and claude-code. Removed desktop entries are filtered from old feeds, with old routes redirected to their replacements.
- Bundled replacement manifests and bilingual guides remain available after older catalog/article feeds.
- IDE executable discovery requires Antigravity IDE.exe and resources/app/product.json identifying Antigravity IDE. Native/npm Claude CLI paths are distinct from Desktop.
- CLI starts in a visible terminal; project and HTTP proxy reach its process. SOCKS is rejected for Claude. Older npm JS builds use VibeHub's private Node runtime, including subsequent claude commands in that terminal.
- Persian and English guides cover Iran network/account limits, API alternatives, Radeon setup and boundaries of the manual API-reference selector. No user API key is stored in these files.

## Checks

- Node suite: 85 passed.
- TypeScript checks: all three packages passed.
- Targeted Playwright: 13 passed, including replacement cards, normal launch, repeat-terminal action, Persian guides and old-feed recovery.
- Rust library: 40 passed, 3 opt-in tests ignored.
- PowerShell discovery/proxy/CLI test: passed. Covers renamed non-IDE rejection, native CLI discovery, saved custom wrapper with an apostrophe in its folder, project with spaces, HTTP environment, absence of Chromium arguments and private-runtime npm JS launch.
- Existing app-path and native Windows suite under PowerShell 7: passed; native suite 39 assertions. The harnesses require PowerShell 7; attempting these two harnesses from Windows PowerShell 5 produced harness encoding/runtime API errors before rerunning successfully in PowerShell 7. The production adapter itself is invoked with Windows PowerShell by these tests.
- Frontend production build, content validation, 1244 bilingual keys, native IPC coverage, PowerShell parser and git diff whitespace check: passed. Existing build size/future Rust dependency warnings remain.
- One independent scoped review: no actionable findings.

## Live evidence and limits

- Existing live Claude 2.1.63 + Node 24.22.1 + Radeon Qwen3.8-Flash-Next tests returned VIBEHUB_CONNECTION_OK and VIBEHUB_TOOL_OK=12. This is limited smoke evidence, not full compatibility for all models/tools/versions.
- Started native VibeHub Development with separate com.ahmadkhanloo.vibehub.dev identifier. Its UI detected the real Antigravity IDE 2.6.0 and Claude Code CLI entries. It also displayed a generic partial-information warning and existing failed states for other tools; a clean overall app state is not claimed.
- A visible Claude/Radeon terminal demonstration was launched with a key passed through hidden stdin and then child process environment. Windows Terminal is blocked by the computer-use tool's product policy, so interactive terminal UI control/screenshot was unavailable. The key is absent from demo scripts.
- Antigravity CLI Google sign-in completed earlier, but a model request failed account location eligibility. No successful native IDE agent use from Iran is established. The Cline/IDE alternative is documented, not live-verified.
- The developer window is running from source; this task did not create or publish an installer/release, nor uninstall either desktop application from Windows.
- Work stays uncommitted on codex/antigravity-ide-claude-cli alongside preserved pre-existing workspace changes.
