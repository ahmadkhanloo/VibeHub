# Claude gateway and Persian acceptance — 2026-11-04

Status: **DeepSeek process/protocol acceptance passed; interactive Persian OPEN**.

## Baseline

- The working tree already contained 86 changed/untracked entries. Existing changes were retained; the complete diff is not attributable to this follow-up.
- Claude 2.1.318: `%APPDATA%/npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe`.
- Bundled rtl-terminal 1.0.7 loads through `--plugin-dir`. Synthetic CLI initialization confirms `rtl-terminal@inline` is loaded. No persistently installed plugins were listed.
- User settings selected Qwen3.8-Flash-Next and Radeon Anthropic. Diagnostics never print keys or private conversation content.
- Windows Terminal declares UbuntuMono Nerd Font as its default face; this does not identify the font or host used by the failed window.
- RtlTerminal 1.1.6 is installed. It was not selected without a documented failure of the usual terminal.

## Findings and implementation

- Real Claude sends `[user, system]` initially. Radeon Qwen3.8-Flash-Next reproduced `400: System message must be at the beginning`. A streaming HTTP 200 can precede failure; status alone is insufficient.
- Radeon **DeepSeek-V4.1-Flash** passed streaming Persian output, actual Read execution on a temporary marker file, the returned tool result and continuation of the same conversation. No system instructions were removed or reordered. Tools remained enabled.
- A repeat with explicit plugin-initialization assertions also passed both turns. One upstream transport failure was retried before success; this establishes a working path, not an availability guarantee.
- GLM-5.3-Flash did not complete within deadlines; it is not accepted. A timeout does not prove the same system-role failure.
- Native launch now supplies the selected model as a literal-safe `--model` argument, clears stale OAuth/subagent overrides, sets the subagent model consistently and disables budget thinking only for the Radeon Anthropic endpoint.
- No compatibility adapter was added to VibeHub. The opt-in diagnostic uses a temporary loopback relay to forward unchanged requests; it is not shipped as a runtime service.
- The synthetic integration now checks loaded-plugin initialization, both authentication modes, SSE and Read/result round trips. Configuration and projects are isolated temporary directories. UTF-8 is decoded across output chunk boundaries.
- The live integration is opt-in, uses the existing Radeon credential in Claude settings, rejects other endpoints and redirects, prints protocol structure only and removes its temporary session/project.
- Persian/English guides replace the obsolete copy-command workflow. Provider notes distinguish current DeepSeek acceptance, Qwen failure and historical older-Claude success.

## Reproduction

```powershell
node tests/claude-gateway.integration.mjs
$env:CLAUDE_TEST_AUTH = 'bearer'
node tests/claude-gateway.integration.mjs
Remove-Item Env:CLAUDE_TEST_AUTH
$env:CLAUDE_TEST_MODEL = 'DeepSeek-V4.1-Flash'
node tests/claude-provider.live.mjs --live
```

Live testing consumes the existing daily allowance. Without `--live` it skips. `--live --models` lists IDs without model generation.

## Verification

- Node: 86 passed. Rust library: 40 passed, 3 existing opt-in checks ignored.
- Plugin validation and 42 plugin tests passed.
- Native Windows: 39 assertions passed; connection isolation/model quoting and Persian host preparation checks passed.
- Mock UI launch/replacement tests: 9 passed, covering both languages, ordinary launch, saved selection and shared-card launch.
- TypeScript, translation parity (1266 keys), content validation, native command coverage and whitespace checks passed.
- Production frontend build passed; its existing large-chunk advisory remains. No installer was built.
- Synthetic real-CLI integration passed for x-api-key and Bearer, SSE, plugin initialization and Read round trip.

## Human-assisted window and open gates

At the user's request, the source native adapter opened a real terminal with the plugin and DeepSeek-V4.1-Flash, using its JSON stdin contract. This was not a click in the installed app. Saved Qwen configuration was retained. A real installed-app launch remains a separate gate from mock UI coverage.

The user was asked to run `/rtl mode` and report whether the draft, response or both fail. No result has yet been observed. The plugin can render a preview and messages but cannot redraw the input box. No speculative font, shaping or bidi patch was applied without evidence of the responsible layer.

Remaining live checks: joined letters and ZWNJ in the input box and response; mixed English, numbers, punctuation, code and paths; arrows/Home/End; deletion; selection; multiline paste; logical prompt preservation; `/copy` versus mouse clipboard order; resize; scroll; Ctrl+C. Compare isolated and real user settings and the three RTL modes. A correct preview is insufficient. Only after documented failure should RtlTerminal be tested under the same input-box requirement.

Computer Use guidance explicitly forbids terminal-app automation, so interactive checks require human observation. No RTL verified badge, complete-fix claim, new installer, public release or installer-lifecycle acceptance is recorded.

Sources: [Radeon Messages](https://amd-aim.github.io/radeon-cloud-docs/api/messages/), [related upstream report](https://github.com/anthropics/claude-code/issues/77698). The local Qwen failure was independently reproduced.
