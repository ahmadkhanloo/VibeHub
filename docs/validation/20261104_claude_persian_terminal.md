# Claude Persian terminal workflow — 2026-11-04

## Implemented

- Claude's Launch tab includes a bilingual experimental Persian-writing panel with project selection, host detection, a copyable PowerShell command, and a separate open-host action.
- Normal Claude launch and Persian-host launch share the same literal-safe command builder. Older npm JS installations use VibeHub's private Node runtime. Commands contain no API key.
- The host receives the selected project directory and Claude HTTP proxy. SOCKS-only profiles are rejected. No user PowerShell profile or global environment setting is changed.
- Host launch explicitly returns `claudeStarted=false` and `proxyRoutingVerified=false`. It does not count as a running Claude session.
- Quick Input is advertised only for a detected version >=1.1.6. Older versions receive a direct official manual-update button; missing hosts link to the Terminal setup page.
- The backend installer pin targets upstream 1.1.6; the user-facing installer action has now been replaced with a latest-release browser link. Its SHA256 is `BF5B21D82CD4F74B60760472E41BED69257AE1C708D804E6FB254A2655104661`.

## Verification

- Native preparation/launch function tests passed: absent/old/current host, quoted paths, command without credentials, project/proxy handoff, and no false application/network acceptance.
- Existing native CLI discovery/private-runtime launch tests passed after sharing command construction.
- UI tests: four new workflow tests passed; the four previous replacement regressions also passed. The old-version update button test was observed failing before implementation and passed after the fix.
- Node suite: 85 passed after updating an obsolete source-pattern assertion for the previously changed GUI-focus/CLI-repeat behavior.
- Rust library: 40 passed, 3 opt-in tests ignored. TypeScript, native command coverage, content validation, PowerShell syntax and whitespace checks passed.
- Translation parity: 1260 keys. The production frontend build passed. A final label-only Persian refresh correction was checked through translation parity and rendered preview.
- Persian panel visual QA performed on `output/claude-persian-panel-fa.png`; it uses the test host fixture and is not evidence of terminal glyph rendering.
- Independent review found the older-host upgrade dead end; explicit official update access was added and the reviewer confirmed the finding resolved.

## Live rendering remains pending

RtlTerminal was not installed at the standard locations. The official 1.1.6 installer was downloaded to the task's TEMP directory and matched GitHub's release digest. Automatic elevated execution was rejected by automatic approval review with `blocked by policy`; no detailed reason was supplied. The user was asked to install it manually, and no alternative elevated execution was attempted.

Therefore actual Claude input, glyph joining, cursor movement, selection, deletion and mixed-direction output inside RtlTerminal have **not** been accepted. The UI remains experimental and the Claude manifest does not gain a verified RTL badge. The upstream Quick Input and Smart RTL documentation motivates this workflow but does not prove compatibility on this machine.

No installer/release of VibeHub was published. Existing workspace changes are preserved.

## Manual download correction

After the user reported another native installation timeout, the Terminal page was changed to open https://github.com/mirbehnam/RtlTerminal/releases/latest directly. It no longer invokes the elevated native installer or its confirmation flow. The old-host update button uses the same latest page. Native installer code remains for compatibility but is not invoked by this UI. A source regression test checks the absence of that call; the four Persian workflow UI tests, TypeScript check, translation parity and frontend build passed after the change. Live manual installation and terminal rendering remain pending.

## Codex Desktop boundary

Vazir and Vazirmatn font files are currently present in Windows font locations. Official Appearance documentation supports UI/code font selection, but no RTL direction setting for Markdown/plans was found there. No Codex RTL adapter or font modification was delivered. The Computer Use skill explicitly forbids automation of the ChatGPT desktop UI, so automation of the merged app was stopped. Manual path: Settings > Appearance > Font / UI font; select Vazirmatn for the active theme if offered. Font selection alone does not establish paragraph direction or Markdown rendering behavior.

## Superseding implementation: usual terminal, direct launch (2026-11-04)

The user subsequently requested keeping the usual terminal and choosing a gateway/model inside VibeHub. This supersedes the RtlTerminal fork proposal. No managed terminal fork is shipped.

Implemented:
- Bundled MIT rtl-terminal 1.0.7, pinned at c0572309deeec3695c0d82e5eae0d54459422373. Claude >=2.1.294 is checked before Persian launch. The system npm installation was updated to 2.1.318 and its version verified.
- Direct Persian and ordinary launch actions, project selection, persisted connection/authentication selection, and shared card launch integration. No manual command-copy step.
- Rust resolves connection metadata and reads the selected credential from Windows Credential Manager. It passes the native request on stdin; only the child process environment receives credentials. PowerShell encoded commands contain executable/plugin paths, not secrets.
- Selected model maps to the main model and Opus/Sonnet/Haiku defaults. API-key and Bearer variables are mutually exclusive. Proxy behavior remains separate. Both ordinary and Persian Claude launches suppress PowerShell profiles, keeping Oh My Posh initialization out of Claude sessions.
- Plugin source, manifest, vendored license notices and provenance are packaged through Tauri resources. The manifest keeps RTL unverified; the UI calls the feature experimental.

Validation observed:
- Plugin strict validation succeeded; 42 plugin tests passed; Unicode 17 BidiCharacterTest passed 91,707/91,707.
- Real Claude 2.1.318 sent the selected model and synthetic x-api-key to a loopback gateway and returned a Persian/English response. The initial fixture inherited normal user configuration and failed; an isolated CLAUDE_CONFIG_DIR and project resolved it. No real provider credential or paid model was used. Reproduce: node tests/claude-gateway.integration.mjs.
- Native connection environment/literal-path check passed. Native Windows suite passed 39 assertions under pwsh. Its first invocation under Windows PowerShell 5 failed because the existing test harness uses StandardInputEncoding; the harness runs under pwsh.
- Rust library: 40 passed, 3 opt-in tests ignored. Node suite, TypeScript, i18n parity (1266 keys), content validation and native command registration checks passed.
- UI direct-launch tests in English/Persian, ordinary launch, persisted selection, and replacement regressions passed. Screenshot: output/claude-direct-launch-en.png; fixture only, not proof of terminal glyph rendering.

Acceptance limits:
- Interactive terminal input, caret movement, selection, deletion, clipboard round-trip and screen resize are not accepted. Computer Use's bundled docs/guidance.md explicitly forbids automating terminal applications. Plugin render/unit tests do not replace this gate.
- No live third-party provider compatibility claim: the selected provider must expose Anthropic Messages, including the tool/stream features required by Claude. Existing OpenAI-compatible model tests alone are insufficient.
- No clean-Windows installer lifecycle acceptance and no uninstall of the user's existing VibeHub installation were performed. Existing installation and independent RtlTerminal are preserved.
- No public release or commit was created. Prior workspace changes are preserved.

### Final local build
- Final NSIS build completed successfully: D:\Github\VibeHub\apps\desktop\src-tauri\target\release\bundle\nsis\VibeHub_0.2.5_x64-setup.exe
- SHA256: 09C87F22C07B172E1E91645D3B8542B6BEDD571673C30C369CC55EC249C02835
- Bundled hook source hash comparison: 19 files matched.
- Final UI workflow suite: 5 passed; separate IDE/CLI replacement suite: 4 passed. Persian screenshot: output/claude-direct-launch-fa.png.
- Installer lifecycle and interactive terminal editing remain unaccepted as stated above.

### Full acceptance follow-up (2026-11-04)

Read-only environment inspection found Windows 11 Pro, with vmcompute running, but no WindowsSandbox.exe, vmms service, Get-VM command, or VMware/VirtualBox command-line tools in the checked standard locations. No disposable Windows test environment was established. Running the same-identity installer against another directory would still share HKCU installation/uninstall state with the user's existing VibeHub; it was not treated as an isolated lifecycle test.

Remaining acceptance must observe the actual installed app: joined Persian letters and ZWNJ; mixed API v2, numbers, punctuation and code; caret left/right and Home/End; Backspace/Delete; selection and clipboard text in logical order; multiline input; resize and scroll; Ctrl+C. Plugin unit/render conformance and loopback model checks are supporting evidence only. No interactive pass is recorded without observation. Full acceptance remains OPEN.

### Additional launch acceptance (2026-11-04)

Extended the real installed Claude loopback integration to include --plugin-dir pointing at VibeHub's bundled plugin, and to cover both mutually exclusive authentication modes. The selected custom model, x-api-key-only request, Bearer-only request and Persian/English response were accepted in the CLI process. These are headless process/protocol checks; they do not accept interactive terminal rendering or installer lifecycle.

### Human-assisted live test: FAILED / unresolved (2026-11-04)

The user observed Claude 2.1.318 running Qwen3.8-Flash-Next and reported API Error 400: System message must be at the beginning. The current user settings select the Radeon Anthropic endpoint. This is a real gateway compatibility failure; successful loopback tests did not establish Radeon acceptance. The pasted transcript contained visually reordered Persian. A pasted transcript alone cannot establish whether on-screen joining/order or clipboard logical order is correct. Input/render/clipboard acceptance remains unresolved pending visual evidence and /rtl mode output. No verified badge is granted.

Related upstream report: https://github.com/anthropics/claude-code/issues/77698 describes non-leading system messages and error-text-dependent fallback. It is diagnostic evidence, not proof that this exact request has the same cause. Do not silently delete, move or weaken system instructions to make the backend accept a request.
