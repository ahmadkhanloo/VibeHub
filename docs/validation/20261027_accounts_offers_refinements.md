# Accounts, public offers and UI refinements — 2026-10-27

This records the current implementation, independently of earlier same-day scope reports. Existing working-tree changes are preserved. No release, installer, push or Pages deployment was performed.

## Account evidence and activation gate

| Adapter | Installed version examined | Credential source | Authenticated read | Activation |
| --- | --- | --- | --- | --- |
| Qoder | 0.4.2 | `%APPDATA%/com.qoder.app.stable/auth.v1.dat`; Chromium v10 AES-GCM, DPAPI-wrapped key in `Local State` | `/api/v1/userinfo` identity matches local user; `/api/v2/quota/usage?outerProviders=cmcc` provides percentage usage | Disabled pending real two-account acceptance |
| ZCode | 3.16.3 | `%USERPROFILE%/.zcode/v2/credentials.json`; app-specific `enc:v1` AES-GCM | JWT identity bound to local user, server-authenticated `/api/v1/zcode-plan/billing/current` | Disabled pending real two-account acceptance |

The opt-in Rust `app_accounts::tests::live_read_only_accounts` test successfully queried both current signed-in accounts. It prints no token, email or account ID. Browser fixtures and browser-preview data do not establish native access.

The user confirmed that only the current account of each app is available. A real switch and return cannot be exercised. `switch_verified` therefore explicitly returns false: supported-version matching alone does not enable credential replacement. The implementation is **not certified as complete account switching**. Exact-version vendor locks, guarded compare-and-swap, metadata recovery and post-restart credential identity/vendor requests are implemented. Real two-account activation, app-side identity acceptance and end-to-end recovery remain prerequisites for opening that gate.

ZCode billing/current exposes granted entitlements, not remaining tokens. The installed host calls `/billing/balance?app_version=3.16.3` with its ZCode JWT. This exact read was attempted on the current account: the live server returned HTTP 400, code 3001, `parameter error`. The known response decoder (`remaining_units`, `total_units`, `used_units`, `expires_at`, `unit_type`) is implemented and tested with synthetic data, but no real remaining balance is claimed. The app falls back to independently authenticated current grants and shows a quota-verification warning. Expired plans/balances are excluded. Numeric token units, including zero, never render as percentages. Local plan cache is not used as live evidence. Qoder's percentage stays a percentage.

Qoder's installed source defines POST `/api/v1/deviceToken/refresh` with only `refresh_token`. Expired **inactive saved** Qoder sessions can renew during manual quota refresh, with encrypted retention of rotated credentials and subsequent identity checks. Active sessions are reread from the original app, whose own renewal remains authoritative; the manager does not rotate its active token behind it. The renewal HTTP contract, response validation and rejection path passed isolated loopback tests. Actual token rotation was deliberately not triggered on the sole real signed-in account, so live renewal remains unaccepted.

The installed ZAI provider class has no `refreshToken` method; the host explicitly requests sign-in again when a provider lacks that method. ZCode's supported account scope is therefore ZAI sign-in, with official reauthentication on expiry. BigModel credentials and project credential locations remain outside the ZAI snapshot/replacement allowlist; an active unsupported provider is reported explicitly.

Saved credentials stay in Rust and DPAPI-protected per-account files. The UI receives identity, plan, usage and check time. Listing/import deduplicates by stable vendor user identity. Removing a saved profile does not touch the signed-in app. Original-app sign-in followed by Refresh captures another profile. Qoder/ZCode have no automatic switching.

## Shared offers

Known public source contracts:

- <https://docs.qoder.com/events/100credits> — 100 Credits, manual desktop claim, daily window at 10:00 Asia/Singapore, 30-day reward validity, individual international accounts.
- <https://docs.qoder.com/events/flashoffer> — Qwen3.8-Flash promotion, end not announced.
- <https://docs.qoder.com/events/deepseek-flash-free> — daily free allowance, subsequent usage billed, end 2026-10-31 24:00 UTC+8 = 2026-10-31T16:00:00Z.
- <https://zcode.z.ai/en/rewards> — no recognised public fixture obtained; no current 300M-token claim is published as verified.

The hourly/manual workflow reuses the existing Pages deployment path. Each ephemeral CI checkout attempts to recover its last published known offers. On unrecognised format/network failure, prior content is retained as stale/reported without advancing verification time. Source diagnostics are emitted under snapshots. The app refreshes on startup/focus if its last successful fetch is at least 15 minutes old; manual refresh is unconditional and concurrent calls coalesce.

Notifications require an explicitly enabled system-notification setting. Quiet hours, stable revision keys, expiry, source freshness and daily source-timezone windows are checked. Claim reminders tell users to check the original app; they do not assert an unclaimed reward. No credential or account information enters the public collector.

## UI evidence

The header is 56px; search is 240×36px and expands to 320px on focus. Ctrl+K remains active. Settings use URL tabs with legacy `?panel=terminal` support. App details use Launch/Connections/About tabs. Eight theme previews depict navigation/content/text/action surfaces, persist only on click, and mark the active selection. Persian display branding uses the shared وایب‌هاب translation.

Tooltip descriptions support focus, hover, information-button click, Escape and viewport placement. Important action errors and offer conditions remain in normal content.

Visual artifacts (ignored local output):

- `output/account-offer-refinements/themes-en.png`
- `output/account-offer-refinements/accounts-en.png`
- `output/minimal-redesign/verified/{fa,en}-{light,dark}-*.png`
- Earlier redesign baselines remain under `output/minimal-redesign`.

Acceptance covers Persian/RTL, English/LTR, both modes, 320/768/960/1280/1440px, theme contrast, keyboard tabs, tooltip dismissal and cancellation. Final command results are appended after the last verification run.

## Earlier verification

- `pnpm check`, `pnpm build`: passed on the final UI source. Build retains a non-blocking bundle-size warning (main JS about 598 kB uncompressed).
- `pnpm i18n:check`: 967 keys aligned. Two existing proper-name warnings (Windows Terminal/Oh My Posh).
- `pnpm test`: 33 passed, including known-format parsing, timezone boundaries, stable notification keys, stale/expired suppression and recovery of previous published content during source failure.
- `pnpm content:validate`: eight apps, four providers, three generated Qoder offers and bilingual guides valid.
- `pnpm release:guard`: every UI IPC command has a native handler.
- `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib --tests -- --test-threads=1`: 31 library and 37 backend cases passed; four opt-in cases ignored across both binaries. Some network cases intentionally occur in both binaries. Parallel Windows-vault tests interfered with one another, so final native validation was serial.
- Opt-in `app_accounts::tests::live_read_only_accounts`: passed for both installed accounts. Hashes of the original Qoder and ZCode credential files were compared before/after: unchanged.
- Full browser suite: 61/62 passed initially. The remaining case revealed a real tooltip regression: repeated hover/focus positioning near the bottom used a fallback height and could cover the Settings link. This was corrected using measured bubble bounds on every show. The final focused run passed all six feed/performance/refinement cases, including the formerly failing click path. Across full and focused runs, all 63 distinct browser cases were exercised successfully; the complete suite was not rerun after that isolated fix.
- Earlier parallel browser invocations collided in their shared output directory. Those artifact failures were rerun successfully in serial; they are not counted as product passes without a rerun.

The saved baseline explanatory-word counts were Home 19 → 0, Discover 122 → 30 and App details 142 → 0 for always-visible explanatory paragraphs in the earlier minimal redesign. Current detail tabs make full content available on request. These counts exclude titles, control labels, errors and offer conditions, and do not imply a reduction in every kind of text.

## Remaining delivery limits

Actual two-account switching and live Qoder token renewal are not accepted. ZCode remaining-token balance is not established because the live endpoint rejected its installed client's request contract. Its public rewards source has no verified parser. A GitHub workflow file is ready, but hourly collection only becomes operational after the separate main-branch/Pages deployment. No installer or release was built.

## Continuation: account correctness

- Local credential locks follow Qoder's exclusive `auth.v1.lock` and ZCode's owner-stamped `credentials.json.lock` directory. On Windows the Qoder handle denies sharing/deletion and uses delete-on-close, so stale-lock cleanup cannot steal a live lease. The lock test reproduces and prevents this race.
- Compare-and-swap refuses credentials edited outside the manager. Recovery also compares the attempted credential before restoring; it does not overwrite a new external login. ZCode's unrelated credential keys are preserved in synthetic round-trip tests.
- The transaction includes metadata persistence and restart checks. If a post-close read fails, the original app is reopened before returning the conflict. Verification still needs real two-account acceptance.
- A 48 KiB synthetic DPAPI round trip reproduced a Windows pipe-buffer timeout. Concurrent bounded stdin/stdout processing fixes it without exposing values in process arguments or logs.
- Startup and mounted-page account reads coalesce per app, including React StrictMode repeats. Native operations lock per app, so a slow Qoder request does not block ZCode. App selection remains keyed, preventing an old request from populating a different app's account list.
- UI tests cover delayed app selection, deduplicated reads, token units, zero balance and visible quota failure. The final command outcomes below supersede the earlier counts above.

## Continuation validation results

| Check | Final result |
| --- | --- |
| TypeScript checks and production frontend build | Passed; main JS size warning remains about 599 kB uncompressed |
| Translation parity | Passed, 975 keys; existing proper-name warnings only |
| Node tests | 33 passed |
| Entire browser suite | **65 passed**, one worker, including both languages/modes and all five viewport widths |
| Rust library + backend, serial | **36 + 37 passed**, four opt-in test instances ignored |
| Final live read-only account test | Passed: Qoder identity/live percentage; ZCode identity/current grants; remaining ZCode balance explicitly unavailable |
| Original Qoder/ZCode credential-file hashes before/after live test | Unchanged |
| Content validation and IPC command coverage | Passed |

The renewal tests use synthetic credentials and a loopback HTTP server; they verify the exact request body, absence of an access-token Authorization header, complete token/expiry parsing, rejected refreshes and preserved identity. They do **not** establish successful real refresh-token rotation. No real account was switched, signed out, restarted or rewarded by these checks.
