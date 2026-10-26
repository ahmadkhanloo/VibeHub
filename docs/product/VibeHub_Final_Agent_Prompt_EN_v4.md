# IMPLEMENTATION DIRECTIVE — AgentRTL → VibeHub v4 (FINAL)

**Source repository before migration:** `https://github.com/ahmadkhanloo/AgentRTL`
**Target repository after authorized rename:** `https://github.com/ahmadkhanloo/VibeHub`

**Required input files to place in the repository:**
- `docs/product/VibeHub_Final_Master_Plan_v4_FA.md` — binding product, UX, engineering, security, content, and acceptance specification.
- `themes/terminal/mak-devline.omp.json` — normalized, corrected version of the supplied Oh My Posh theme, with its content otherwise preserved.

## Mission and non-negotiable product contract

Transform the existing repo **in place** into **VibeHub**, a genuinely free and open-source desktop companion for finding, installing, configuring, and launching free-access AI coding tools, especially for people in Iran.

- **Every VibeHub feature is free and open-source**, with no paid upgrade, subscription, gated feature, ad network, mandatory account, proprietary bundled dependency, or paid infrastructure requirement. Keep `LICENSE`, third-party notices, an SBOM, and reproducible build instructions.
- Distinguish **free usage**, **open-source license**, **regional availability**, and **VibeHub's own price**. Third-party services such as NVIDIA API may be proprietary and/or geographically restricted even when they offer free developer access. Never misrepresent them.
- **ALL Persian text rendered inside VibeHub must use self-hosted/bundled Vazirmatn**—Home, Guides, modals, errors, badges, toasts, installer, changelog, offers and charts. No font CDN. Technical code/URL blocks remain LTR with a licensed monospaced font. For host terminals, use JetBrainsMono Nerd Font Mono for monospace and icons and Vazirmatn where an available fallback permits; don't promise to force fonts inside every external IDE.
- Entire UI, content, notifications, and errors must be available in **fa-IR (RTL) and en-US (LTR)**. Language switches immediately, mirroring sidebar/layout correctly. Automated translation-key parity checks are required.
- Implement appearance modes **System / Light / Dark**, theme families **Default (Graphite), Nord, Catppuccin, Solarized**, with a genuine light and dark variant for each (8 actual palettes), and accents **Auto / Indigo / Emerald / Violet / Amber**; a live gallery and persisted preferences are mandatory.
- Preserve and reuse working existing AgentRTL CDP injection logic. There are no current users to migrate, so new AppID and branding are acceptable, but preserve Git history and regression evidence. Do not make a separate Node.js installation a prerequisite for end users.

## Required tool catalog

**Apps visible from the first release:** ZCode, Qoder, DeepSeek Harness, OpenCode, Xiaomi MiMo Code, Freebuff (correct spelling; distinguish from unrelated FreeBuf security news website). For every one show verified free-access type, license/OpenSource flag, signup requirements, country constraints, installed state, source URLs, verified date, and separate install/launch/RTL/proxy capabilities.

**Providers:** NVIDIA API Catalog/NIM developer access, OpenRouter free models, Ollama local models, custom OpenAI-compatible endpoint. Test only official/public APIs with explicit user consent; API keys stay in OS credential vault. Do not assume the external model or service is open source or free indefinitely.

**OpenCode:** OpenCode 1 and 2 can conflict on the same default `opencode` command. Detect and handle version conflicts without destructive overwrites.

**MiMo Code:** open-source agent under MIT with separate Use Restrictions/service terms; do not hard-code temporary MiMo model promotions as everlasting.

**Freebuff:** Freebuff code is Apache-2.0 and free hosted model access is ad-supported. Its service terms restrict non-official client endpoints, bot access, and geographic misrepresentation. Use only official CLI/Desktop/Web entrypoints; **never** integrate against underlying private inference APIs, resell/proxy Freebuff model inference, or spoof location for expanded quota. Inform users of terms/privacy concerns.

**NVIDIA API:** guide developer sign-up, API key, optional test, quotas and geographic eligibility. If service is not available for a user, explain eligibility rather than bypassing restrictions. Avoid claims of universally free unlimited use.

## Functional areas

1. Onboarding: locale, theme, environment/installed apps scan with consent, optional proxy/terminal setup.
2. Home: quick launch, featured verified free tools, recent offers, proxy status, guides.
3. Explore: searchable and filterable cards including Open-source only, free access type, OS/GUI/CLI/verified RTL/network.
4. App Details: official source, actual free quota terms, install, launch, proxy, RTL, guides, referral disclosure.
5. My Apps: real installed/running state, launch/RTL/proxy per app, no fake status.
6. Proxy Center: Direct/System/HTTP/SOCKS5 local proxy with global/per-app profile, connection tests, optional Require Proxy. Support v2rayN/v2rayA/etc **only by consuming their local proxy**, no internal VPN or circumvention automation. Recognize that app process networking may not all honor proxy flags.
7. Terminal Setup: integrate the provided `mak-devline.omp.json` as an optional Oh My Posh preset; install official Oh My Posh and free/open-source **JetBrainsMono Nerd Font Mono** on demand, install/use Vazirmatn for Persian, configure Windows Terminal/PowerShell only with consent. Backup shell profiles/settings, add an idempotent owned block, validate, and provide complete non-destructive Undo. Distinguish Windows Terminal from embedded IDE terminals.
8. Guides: detailed fa/en instructions for all six apps: install, free model access, signup, Iran/network observations (dated, evidenced, not universal claims), first run, terminals, troubleshooting.
9. Offers & News: manually curated, source-cited, time-bounded verified promotions; GitHub static feed, offline cache, in-app unread notifications and optional OS notifications. No made-up weekend offers.
10. Models/API: guide/free model selector, optional real connection test, tool compatibility statuses, clear separation between testing API and testing actual coding-agent tool execution.
11. Doctor: real diagnostics for Node-free runtime, CDP ports, proxy, IDE versions, fonts/glyphs, Oh My Posh shell profile, updater signature.
12. Settings: language, family/mode/accent, network, terminal, updates, notifications and privacy (telemetry off).
13. GitHub auto-updates: signed Tauri 2 updater with private signing key stored only in GitHub Actions Secrets, stable version manifest, user approval and rollback/error handling. Catalog/guide/offer updates independent of binary releases.
14. ZCode referral: `https://zcode.z.ai/invite/CF3ZEFJR`; optional, labeled transparently, with `Skip` and official download path. Signup referral and executable installer are separate actions.

## Engineering architecture

Use Tauri 2 + Rust for native operations, React + TypeScript + Vite, Tailwind + shadcn/ui, Lucide, i18next. Native capabilities must be least-privilege. Use versioned JSON Schema/Zod for tool/offer/provider metadata and refuse remote code or executable commands in catalog data. Keep installer executable paths and launch logic in trusted native adapters, not user-downloadable manifests.

Recommended feature folders: `home, explore, my-apps, app-details, proxy, terminal, guides, offers, models, doctor, settings, onboarding`. Shared packages: `core, catalog, launcher, rtl, proxy, terminal`. Versioned static GitHub Pages feed, bundled snapshot for offline operation.

## Execution order / phase gates

Do not attempt the whole product as one giant code-generation pass. Work sequentially and require a runnable, tested vertical slice at every gate. The full scope, acceptance criteria, schemas, sample UX flows, and test matrix are in the Persian master plan.

- **Gate 0 — Audit:** repository map, tests baseline, licenses, six-app support matrix, risks, record source layout and the supplied Oh My Posh theme.
- **Gate 1 — Bootstrap:** Tauri/React app, brand, navigation and safe IPC; runnable Windows dev build.
- **Gate 2 — Design:** enforce Vazirmatn everywhere Persian, eight theme variants, accents, theme gallery, accessibility.
- **Gate 3 — Localization:** complete fa/en parity, RTL mirroring and LTR code isolation, instant switch.
- **Gate 4 — Catalog:** six apps and four provider listings with sources, separate OSS and free tier statuses, offline snapshot.
- **Gate 5 — Install:** verified Windows adapters, official installer methods, progress/errors, OpenCode v1/v2 conflict behavior.
- **Gate 6 — Launch & RTL:** migrate and test the three existing RTL adapters, eliminate external Node prereq; CLI launch without pretending GUI RTL support.
- **Gate 7 — Proxy:** local HTTP/SOCKS5, per-app policy, Require Proxy, verified network tests, terms warning.
- **Gate 8 — Terminal:** Oh My Posh + supplied theme + JetBrainsMono Nerd Font + Vazirmatn, profile backup, idempotent Apply and Undo; real rendering check.
- **Gate 9 — Guides & Onboarding:** bilingual, verified dated information for all six tools, offline fallback.
- **Gate 10 — Models:** Nvidia/OpenRouter/Ollama/Custom, secure credentials, opt-in real API connection test.
- **Gate 11 — Offers:** verified-only feed/notifications, expiry and duplicate suppression.
- **Gate 12 — Referral:** ZCode invite opt-in and non-referral alternative.
- **Gate 13 — Updater:** signed binary GitHub updates and separate cached content feed.
- **Gate 14 — QA:** all acceptance cases, app license audit, security, font and shell Undo tests, Windows scaling and E2E.
- **Gate 15 — Release:** clear README.fa/README.en, screenshots from actual app, build instructions, source/release assets, `CONTRIBUTING`, SBOM.
- **Gate 16 — Repository Migration:** prepare the `ahmadkhanloo/AgentRTL` → `ahmadkhanloo/VibeHub` rename; update repository URLs, remotes, documentation, badges, installer identity, updater and Pages/feed URLs, referral-independent downloads, and release workflows. Audit Actions permissions/secrets, branch protection, and Pages configuration. **Perform the GitHub repository rename only after explicit owner authorization.**
- **Gate 17 — Production Release:** after explicit authorization, merge the validated change into the protected branch, create the official version tag, and publish through GitHub Actions. Attach the Windows installer, only genuinely supported portable artifacts, SHA-256 checksums, signed Tauri updater artifacts and signatures, bilingual release notes, source, license notices, and SBOM. Verify every public download, checksum, and updater signature.
- **Gate 18 — Post-Release QA:** download the installer from the public GitHub Release and test clean Windows 10 and 11 environments, including Persian user names and paths. Cover installation/startup/uninstall, fa/en and bundled Vazirmatn, all eight light/dark theme palettes, harness discovery/install, RTL launch, HTTP/SOCKS5 proxy, terminal-theme apply/rollback, offline behavior, guides, offers, and notifications. Never mark a third-party service or regional access condition PASS unless it was actually tested.
- **Gate 19 — Real Update Verification:** after explicit authorization, publish a controlled follow-up release and verify the already-installed public version discovers, downloads, validates, and installs it. Verify preservation of settings, language, themes, saved proxy profiles, and other local data. Exercise invalid signatures, inaccessible GitHub endpoints, interrupted downloads, failed updates/rollback, and independent catalog/guide/offer refreshes.

**Release completion rule:** a successful build or locally generated installer does not complete the project. Completion requires a public release, passing post-release QA, and a verified real update as specified in Gates 17–19.

## Specific terminal theme audit

The original uploaded file is `mak-devline.omp.json`, Oh My Posh schema v4. Its structure contains Python, Git, Path, Status and Execution Time segments with a second-line prompt. There is one identified malformed text-color marker in the Git segment: `<#<#F9E2AF>` must be changed to `<#F9E2AF>`. Preserve the original user's colors, layout and templates in every other respect unless compatibility testing demonstrates a further necessary change, then document a diff.

Do not modify arbitrary PowerShell `$PROFILE` content or install fonts system-wide by default. Use official source, a user-scoped font installation when possible, backups, ownership markers and exact rollback.

## Testing and reporting obligations

For each gate, report: changed files, commands/tests and exact results, real screenshots where UI is testable, license/security changes, limitations or unverified external features, and next-stage prerequisites. Keep `docs/validation/VibeHub_Release_Acceptance_Matrix.md` with PASS/FAIL/SKIPPED/UNVERIFIED results, actual CI links, GitHub Release URLs, artifact checksums, screenshots, and logs. Never mark inaccessible live services or unrun scenarios as passed. Do not ship fake install progress or pretend a provider connection has been verified. Critical failures in installation, updater security, launching, proxy safety, rollback, or data preservation block final release acceptance.

Do not push, merge protected branches, tag, publish, rename the remote repository, or change the owner's machine in a destructive/irreversible way without explicit permission. Routine local implementation and reversible preparation should continue without pausing for approval. Preserve functional AgentRTL capabilities until their VibeHub replacements pass regression tests.

**Definition of done:** A first-time Windows user can install an entirely free/open-source VibeHub from its public GitHub Release, choose Persian/English and 8 themes, browse six honestly described tools, install/launch supported ones through official flows, use verified RTL and optional lawful local proxy where supported, safely apply/revert the supplied terminal prompt with a licensed Nerd Font, find bilingual dated guides and verified promotions, and receive signed updates without buying anything from VibeHub. The public installer must pass clean Windows 10/11 post-release QA, and an already-installed public version must pass a real signed follow-up update with user data preserved. A locally built app or installer alone is never complete.
