# Replace desktop agents with Antigravity IDE and Claude Code CLI

Date: 2026-11-04. Status: approved by user in chat.

## Requested result
Show Radeon-backed Claude Code in a visible terminal. Replace standalone Antigravity and Claude Desktop in VibeHub with Antigravity IDE and Claude Code CLI. Include Persian and English setup guides covering Iran network/account limitations and alternative API access.

## Approach
Use the existing app catalog, detail pages, discovery and launcher for both replacements. New supported app IDs: antigravity-ide and claude-code. Removed catalog IDs: antigravity and claude-desktop. Prevent old feeds/caches from restoring removed entries. Preserve other workspace changes and adapter source files. Do not uninstall desktop programs from Windows.

Antigravity IDE: product-specific executable detection (not the standalone App), project launch and existing proxy selection; no unverified RTL. Explain that native account eligibility cannot be changed by supplying a different API key. Separately configured editor extensions may use other providers, without replacing the native service.

Claude Code: discover PATH/native/npm installations; launch in a visible terminal at the selected project with inherited HTTP proxy settings; reject SOCKS-only profiles. Never pass Chromium proxy flags to the CLI. No API keys embedded in files and no token extraction from other apps. Teach session-scoped API settings and secure key entry. Document the observed Node 24 workaround and the tested older Claude Code 2.1.63 without globally pinning users to it.

## Guides
Official installation/login, Iran eligibility limits, HTTP/Mixed versus SOCKS, browser versus application routing. Claude Radeon example: Anthropic base https://developer.amd.com.cn/radeon/api, model Qwen3.8-Flash-Next, disable budget-based thinking. Antigravity IDE: correct official download, account eligibility and the observed location error after Google sign-in; distinguish native agent from third-party extensions. API selections that only act as references must be described accurately.

## Verification
Catalog/cache regressions, native discovery and launch tests for the replacement IDs and product separation, PowerShell parsing, TypeScript/content/i18n checks, Rust checks for changed backend paths, and browser checks of cards and guides. Existing successful Radeon text/Read tests do not establish full-agent, current-version or installer acceptance.
