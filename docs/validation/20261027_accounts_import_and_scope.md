# Account detection, JSON import and one-percent threshold

## Implemented

- New Codex profiles default to 1% remaining quota. One-time migration changes the previous 10% value to 1%; other custom values are preserved. Automation remains opt-in.
- First account-list read imports the current local Codex identity without changing its credentials. Subsequent reads do not reimport deleted profiles. Unknown or invalid local credentials produce a localized notice; no credential material enters the webview.
- JSON import uses a native Windows file picker. Rust bounds reads to 256 KiB plus one sentinel byte, accepts UTF-8 with optional BOM, validates the existing Codex OAuth credential shape, and stores it using the encrypted profile store. Import does not activate the imported account. Arbitrary JSON, other apps' credentials and API-key-only files are rejected.
- App selector lists the catalog. Only Codex has a connected account broker; other apps explicitly show integration pending and expose no ineffective switching/import actions.

## Switching mechanism

The broker reads the selected encrypted profile, checks that external credentials have not changed, and transactionally replaces Codex's configured file/keyring credential store. It verifies the account via `codex app-server` over stdio and restores the previous credential state on a failed transaction. Desktop restart requires confirmation. Automatic selection checks every five minutes, uses fresh known quota windows, selects the account with the highest minimum remaining quota above the threshold, and enforces a ten-minute cooldown. It does not transfer conversations or running tasks.

## Remaining catalog integrations

The user's requested order is all catalog apps. A shared account screen is not proof of shared authentication support. No universal credential overwrite or profile-directory copying is implemented.

| App | Evidence reviewed on 2026-10-27 | Remaining requirement |
| --- | --- | --- |
| Antigravity | https://antigravity.google/docs/install documents unified local authentication; https://antigravity.google/docs/cli/reference/ documents CLI commands | Validate installed desktop credential format, quota API and transaction/restart behavior before enabling an adapter. |
| ChatGPT / Codex | https://learn.chatgpt.com/docs/app-server documents account/read, login and rateLimits endpoints | Live Windows desktop switch acceptance remains unverified. Ordinary ChatGPT chat-account switching is separate. |
| DeepSeek Harness | https://www.deepseek.com/ is the catalog source | Identify a documented desktop account/usage interface; none established in this review. |
| Freebuff | https://github.com/CodebuffAI/freebuff reviewed | Establish account storage, machine-readable quota and safe activation; repository landing page alone does not establish these. |
| MiMoCode | https://github.com/XiaomiMiMo/MiMo-Code documents several different OAuth/API-key providers | Define adapter per selected provider and verify desktop/CLI sharing; cannot apply the Codex credential layout globally. |
| OpenCode | https://dev.opencode.ai/v2/docs/providers/ documents provider-specific connections | Account quota/rotation must follow each provider; do not equate model/provider selection with account switching. |
| Qoder | https://docs.qoder.com/cli/authentication documents proprietary sign-in, PAT and interactive status | Confirm how CLI credentials map to desktop and obtain structured quota; CLI login commands alone do not establish desktop support. |
| ZCode | https://zcode.z.ai/en reviewed | Establish official account storage/activation and usage API; marketing page does not establish them. |

These seven adapters remain incomplete. Their pending UI is a limitation disclosure, not a completed implementation of all-app switching.

## Validation

- TypeScript, production frontend build, 29 Node tests, 917-key bilingual parity and IPC coverage passed.
- Eleven relevant browser tests passed, including both languages' account accessibility, native-only JSON import request, one-percent display and disabled actions for other apps.
- Native Windows suite: 36 assertions passed. Rust: 24 tests passed with two opt-in checks ignored; the added one-percent boundary regression passed separately (25 passing cases across both runs).
- JSON validation tests cover malformed input, wrong schema, BOM and over-size rejection with sanitized errors. Isolated synthetic-credential testing verifies initial discovery preserves the local credential file and does not duplicate the profile. The native file picker has not been exercised with a real user credential file. Real desktop switching remains unverified.
