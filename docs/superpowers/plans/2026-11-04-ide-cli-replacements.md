# IDE and CLI replacements Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the two desktop-agent entries with Antigravity IDE and Claude Code CLI and teach setup with honest Iran/API limits.
**Architecture:** Reuse the app catalog/detail/proxy paths and Windows launcher; keep removed entries out of remote caches. Product-specific detection and normal CLI terminal launch, with no new native API key transport.
**Tech Stack:** TypeScript, React, PowerShell, Rust, Markdown.
**Spec:** docs/superpowers/specs/2026-11-04-ide-cli-replacements.md (approved in chat).

## Global constraints
- Preserve pre-existing dirty changes and installed desktop programs.
- Never embed keys or migrate desktop paths to a different product.
- Antigravity IDE and Claude CLI have no verified RTL adapter.
- Claude CLI HTTP proxies only; selected API reference metadata does not configure the target app.

## Review focus
- Old caches must not resurrect removed products or hide replacement entries.
- IDE discovery must reject the standalone executable, including manually selected paths.
- CLI launcher must handle npm wrappers, spaces and apostrophes without evaluating user text as code.
- Project folder and proxy settings must reach the actual child terminal; SOCKS fails clearly for Claude.
- Iran guides must distinguish network, account eligibility and third-party API capabilities.

### Task 1: Catalog, routes and guides
- [x] Add failing behavioral catalog regression for replacement products and stale feeds.
- [x] Replace manifests, shared IDs, protected feed entries, UI routes/logo/path controls and guides.
- [x] Update affected tests; run Node catalog/content/i18n/TypeScript checks.

### Task 2: Windows detection and launch
- [x] Add failing native regression for IDE/CLI distinction, saved path fallback and proxy rejection.
- [x] Extend discovery, manual path validation, allowlists and visible terminal launch; add native backend IDs.
- [x] Verify PowerShell/native and Rust behavior; no secret in test fixtures.

### Task 3: User-facing verification and review
- [x] Verify replacement cards, guide copy and launch IPC in browser.
- [x] Run meaningful regression checks and build; record limitations and live CLI demonstration.
- [x] Request one fresh review of this change; address important findings.

## Execution ledger
- Ruling: reuse the current checkout on a new codex branch. Existing uncommitted work is required context; a clean worktree would lose it.
- Demo terminal: passed the API key through stdin to a local launcher and then child environment, avoiding key-bearing command arguments/files. Interactive UI visibility still needs confirmation.
- User approved design and routine implementation choices in chat.
- Completed: Node 85, UI 13, Rust 40 (+3 ignored), native Windows 39 assertions and extended IDE/CLI discovery/proxy/private-runtime tests; build/content/i18n/IPC/parser passed.
- Independent review: no actionable findings. Radeon metadata now describes limited Claude CLI evidence as reported, not universal verified compatibility.
- Native VibeHub Development is running with its separate app identifier and detected both real replacement installations. Generic partial-information warning and existing failed states for other tools remain documented.
- Windows Terminal UI automation was blocked by product policy. No attempt was made to bypass that restriction. API key handoff for the launched demo used hidden stdin and child environment; no key was saved in the repository.
- Evidence: docs/validation/20261104_ide_cli_replacements.md. No commit, installer publication, or Windows desktop-app uninstall.
