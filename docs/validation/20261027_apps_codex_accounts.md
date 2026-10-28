# Apps, Codex accounts and learning — 2026-10-27

## Implemented behavior

- Eight bundled apps, including standalone Antigravity and a single ChatGPT/legacy Codex record. General IDE inventory is no longer requested from the home, onboarding or doctor flows. The legacy inventory adapter returns an empty list.
- Standalone Antigravity uses the shared app launch/state/proxy path, keeps normal mode as its default and labels chat RTL experimental.
- A bilingual Codex account page supports official browser login/cancellation, explicit local import, naming, removal, quota refresh, manual selection and optional automatic switching. It requires installed Codex CLI 0.148.0; there is no VS Code dependency.
- Native JSON-RPC uses bounded stdio messages, response deadlines, redacted error codes and child-process cleanup. No credentials or raw auth responses are returned to the webview.
- Account helpers remove inherited API-key/access-token environment overrides so shell configuration cannot silently select a different account.
- VibeHub-owned profiles use Codex's encrypted `secrets/codex_auth.age` format. The encryption passphrase is held in Windows Credential Manager. The configured local file/direct-keyring/encrypted-keyring/auto store is respected when applying a selection. Other Codex history, projects, configuration and skills are not copied.
- Writes compare the current credential fingerprint before publication and restore the previous credential if verification or account-index persistence fails. A third party's newly selected account is never deliberately overwritten during rollback. A native broker lock serializes operations across VibeHub instances.
- Automatic selection requires fresh, known, future-reset quota windows. It chooses the highest minimum remaining quota above the configured threshold, retains insertion order for ties and observes a ten-minute cooldown. Automatic pending selections are rechecked before applying. An open desktop app waits for confirmation; closing it allows the queued selection to apply. Closing uses normal window-close requests, never forced termination.
- Seven skill and three plugin tutorials include compatibility, prerequisites, install/use/remove/troubleshooting steps, sources and review dates. The content feed includes the learning JSON alongside app guides.

## Verification

- TypeScript workspace checks, bilingual key parity, content validation, native command registration and JavaScript regression checks were run.
- Native Windows checks use a temporary profile and compiled synthetic executables. They check all eight records, retired IDE inventory, ChatGPT/Codex deduplication and requested child-process proxy settings. Qoder discovery checks preserve its custom path and versioned-install behavior.
- Rust account checks cover quota eligibility/cooldown, unavailable/reset/invalid quotas, distinct account identities, encrypted credential round trips, failed-switch recovery, outside credential changes, stdio login notifications and secret-free webview projection. Network protocol regression checks remain in the normal Rust suite.
- An opt-in compatibility check was executed successfully against the installed **Codex CLI 0.148.0**. It read an isolated encrypted profile containing only synthetic credentials, with service endpoints set to loopback. This checks real CLI/credential-format interoperability, not real account authentication.
- Browser coverage includes pending restart confirmation and cancellation, login cancellation, naming, visible sanitized failures, automation settings, missing CLI guidance, tutorial search/source links and English/Persian keyboard and accessibility checks. Persian account-page screenshot: `output/playwright/accounts-fa.png`.
- Recorded results: **45 browser tests**, **27 JavaScript tests**, **21 normal Rust tests**, **34 native Windows assertions**, **8 Qoder discovery assertions**, and the separately selected installed-CLI compatibility test passed. A focused follow-up also passed the app-discovery retry regression after removal of the IDE fallback. The installed-CLI check also passed with synthetic inherited API-key/access-token overrides. The external live-network check remains opt-in and was not rerun for this change.

## Acceptance still open

Real OAuth completion and authenticated production quota requests with the user's accounts have not been exercised. Switching a real account and confirming which account the Windows desktop app uses after restart is **not verified**. The UI and metadata explicitly retain the experimental/unverified label. Ordinary ChatGPT chat-account switching is not claimed.

Live Antigravity chat rendering, per-app full traffic routing, and clean/selective/upgrade installation on a disposable Windows profile remain unverified. Successful protocol tests and installer compilation do not close those gates.

## Delivered installer

The final Tauri release build and NSIS packaging succeeded. The generated installer was copied to `release-artifacts/VibeHub-Setup.exe` and its SHA-256 matched the source artifact. The prior installer is preserved as `release-artifacts/VibeHub-Setup-before-accounts-20261027.exe`.

- Size: **27,832,208 bytes**.
- SHA-256: `0E53ACAC870BB2D2EA76A72B3F0C07225BD32A7FEEF75B6DACB8ED1738872105`.
- Checksum sidecar: `release-artifacts/VibeHub-Setup.sha256`.

## Reproduce

```powershell
pnpm check
pnpm test
pnpm i18n:check
pnpm content:validate
pnpm release:guard
pnpm exec playwright test
./tests/native-windows.ps1
./tests/qoder-discovery.ps1
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib accounts::tests::installed_cli_reads_official_encrypted_profile -- --ignored
pnpm --filter @vibehub/desktop tauri build --bundles nsis
```

Run the native PowerShell harness from PowerShell 7; it drives the production adapter under Windows PowerShell internally.

## Primary references

- [Codex account and auth RPC](https://learn.chatgpt.com/docs/app-server#auth-endpoints)
- [Codex authentication storage](https://learn.chatgpt.com/docs/auth)
- [Pinned Codex auth implementation](https://github.com/openai/codex/blob/rust-v0.148.0/codex-rs/login/src/auth/storage.rs)
- [Pinned encrypted storage format](https://github.com/openai/codex/blob/rust-v0.148.0/codex-rs/secrets/src/local.rs)
- [Plugin installation](https://learn.chatgpt.com/docs/plugins)
- [Local skill installation](https://learn.chatgpt.com/docs/build-skills)
- [Starter skill source](https://github.com/anthropics/skills)
