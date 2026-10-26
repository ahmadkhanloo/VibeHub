# VibeHub UX redesign — 2026-10-27

## Implemented behavior

The redesign uses the existing React/Tauri application and preserves the existing checkout's unrelated changes. Models and Proxy remain separate destinations. Persian and English share a restrained desktop layout, bundled Vazirmatn, semantic palettes, accessible controls, and adaptive navigation.

| Audit finding | Implementation |
| --- | --- |
| UX-01 destructive actions | Content-cache clearing removes only `vibehub.content.v1`; preference reset is separate. Model deletion confirms named inventory, includes legacy model keys, preserves proxy passwords, and reports partial failure. |
| UX-02 search scope | `/search?q=` searches tools and model services offline. Provider results open the matching, unsaved connection editor. |
| UX-03 tab history | Discovery and provider tabs derive their state from URL parameters; browser history restores selection. |
| UX-04 insufficient catalog information | Tool rows show summaries, tool kind, access category and RTL evidence; details expose access conditions, account requirements and regional evidence. |
| UX-05 fragmented preparation | Tool details provide installation recheck, launch controls, contextual proxy create/edit and compatible-provider/manual-guide links. |
| UX-06 daily launch/focus | Installed tools use separate named launch buttons and preparation actions. RTL defaults only when supported and available; explicit successful choices persist. Shared launch guards prevent duplicate or unsafe launches. |
| UX-07 onboarding | Three skippable steps: language, explicit environment check, selected-tool preparation. Scan idle/loading/empty/error/partial/ready states are separate. No native scan happens on the initial welcome screen. |
| UX-08 form layout | Shared full-width inputs and selects, labels above fields, inline validation, automatic name direction and isolated technical values. |
| UX-09 contrast | Reworked four families × two modes × five accents; button/secondary-text contrast is checked in browser tests. |
| UX-10 accessibility | Native dialogs with explicit Tab boundaries and focus return, disabled switches, named icon controls, related tab panels, keyboard navigation, live outcomes and descriptive errors. |
| UX-11 recovery | Localized error categories, retriable scans, redacted expandable diagnostics and separate feed success/failure. Catalog refresh updates mounted consumers. |
| UX-12 content/navigation | Guides and Offers are independent destinations; provider access enums are translated, Ollama states that no key is needed, guide dates are not fabricated. |

## Native credential contracts

- `provider_credentials_inventory` returns connection metadata and allowlisted legacy-provider identifiers, never secret values. The read path no longer deletes stale Ollama credentials.
- `provider_credentials_clear` accepts confirmed connection and legacy-provider IDs and returns successful removals plus per-item failures. Legacy keys are removed first; failure blocks dependent connection removals to prevent key resurrection.
- Individual deletion removes the key before removing connection metadata. Vault failures retain a retriable connection. Metadata-write failure is reported and a subsequent read reconciles key presence with the vault.
- Changing a saved connection's provider/origin cannot silently repopulate its key from legacy storage.

## Verification and reproducibility

Run the repository acceptance commands:

```powershell
pnpm test
pnpm check
pnpm build
pnpm i18n:check
pnpm content:validate
pnpm release:guard
pnpm test:ui
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml -- --test-threads=1
pwsh -NoProfile -File tests/native-windows.ps1
```

On Windows, browser acceptance uses installed Microsoft Edge by default. Override with `PLAYWRIGHT_CHANNEL` if needed. Linux CI installs Playwright Chromium. The browser download attempted locally returned a regional 403; the local suite uses the already-installed Edge browser.

Browser fixtures emulate the IPC boundary; they do not install real tools, send paid API requests or delete user credentials. Coverage includes launch decisions, failures and duplicate prevention; URL history; search/provider targeting; contextual proxies; deletion/cancellation/partial retry; cache/reset isolation; reactive feed updates; language/direction; keyboard dialogs/tabs; automated accessibility; forty palette combinations; and desktop screenshots.

Screenshots and the HTML browser report are generated under `output/ux-redesign/`. These are evidence for the current fixture-backed frontend, not evidence that a third-party IDE's traffic is proxied or that its RTL injection works on a particular installed version.

The Windows adapter suite uses a temporary editor probe and an isolated PowerShell profile. Its subprocess-environment assertion does not establish real IDE proxy-traffic behavior. Successful frontend builds and native tests do not imply clean-install acceptance or public-release readiness. This task does not publish a release or modify installer behavior.

Observed native verification: Cargo passed 3 runtime tests and 23 backend tests with one test thread; the Windows behavioral suite passed 24 assertions and left the real PowerShell profile unchanged. The one-thread setting avoids concurrent access by the pre-existing Windows credential-vault tests.

Final results: all 31 browser scenarios passed in 4.1 minutes; all 23 JavaScript tests passed. TypeScript, the production frontend build, translation parity (821 keys), content validation, Native command registration and whitespace checks passed. The browser suite reported no WCAG A/AA violations on the checked Persian/English screens. These automated checks are scoped evidence, not a complete accessibility certification.

The build now emits separate page chunks. Its shared entry chunk remains 556.52 kB (174.06 kB gzip), so Vite still reports its chunk-size advisory; this is not a failed build. Screenshots cover 960×640, 1280×860, 1440×900 and a dark Persian 1.5× DPI case with reduced motion. The HTML test report is `output/ux-redesign/playwright-report/index.html`.
