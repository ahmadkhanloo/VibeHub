# Learning, diagnostics and Persian terminal implementation plan

> **For agentic workers:** Execute inline with superpowers:executing-plans, using the existing checkout.

**Goal:** Remove redundant navigation help, unify learning, show diagnostic progress, and offer connected Persian letters in PowerShell.
**Architecture:** Reuse existing React components and routes. Install the pinned upstream RtlTerminal release after SHA-256 verification. Persian shaping belongs to a compatible terminal host, not an encoding-only profile patch.
**Tech Stack:** React, TypeScript, Tauri/Rust, Windows PowerShell, existing Playwright checks.
**Spec:** User-approved design in this chat, amended to require joined Persian letters without requiring RTL layout.

## Global constraints
- Preserve old guide URLs and app-specific instructions and sources.
- Keep a single learning entry; visible navigation labels do not need repeated tooltips.
- Show diagnostics before execution and update completed groups independently; never fabricate successful network checks.
- Terminal installation is optional, confirmed in the product, and must not change the user's default terminal or PowerShell profile.

## Review focus
- Expanded and collapsed sidebar labels, active states and keyboard access.
- Shared guide content must not hide app-specific setup, pricing or gateway instructions.
- Partial diagnostic failures and reruns must not leave stale successful results.
- Failed downloads, checksum mismatches, denied elevation and failed installation must remain errors with an official recovery link.
- Installing a terminal is distinct from a visual verification of Persian shaping.

## Tasks
- [x] Add focused checks for unified navigation, shared learning content, diagnostic pending/running/partial/failure states, and confirmed terminal installation.
- [x] Consolidate navigation under learning and add common workflow guidance alongside app-specific guides.
- [x] Render diagnostic groups before running and publish results as each group settles.
- [x] Add RtlTerminal detection and a checksum-verified installer, installation UI and a Persian verification sample.
- [x] Run targeted UI checks, type/i18n/native checks and build; inspect rendered Persian and English layouts.

## Execution notes
- Ruling: reuse the current non-main checkout and execute directly, following the user's approval; no additional approval gate.
- Ruling: retain old tutorial routes and source texts; group common workflow instruction in the learning hub rather than heuristically deleting sourced paragraphs.
- Ruling: WinGet has no published package for this host in the current source. Use upstream v1.1.4 with its pinned GitHub asset digest instead; keep download errors and Windows elevation explicit.
- Validation: see `docs/validation/20261101_learning_diagnostics_terminal.md`. No commit, push, release, system installation or default-terminal change was performed.
