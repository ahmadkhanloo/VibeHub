# Claude Persian terminal Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution.

**Goal:** Add a truthful Persian-writing workflow for Claude CLI through RtlTerminal 1.1.6+.
**Architecture:** Reuse terminal installation/detection and existing Claude command construction. One native command prepares or opens the host; a dedicated card provides a project picker, copyable command, Quick Input instructions and API-guide link.
**Tech Stack:** PowerShell, Rust, React/TypeScript, existing native dialog/clipboard.
**Spec:** docs/superpowers/specs/2026-11-04-claude-cli-persian-writing.md; approved in chat.

## Constraints and review focus
- Host launch is not a Claude/model success; use distinct labels and status.
- No key in copied commands/files, no PowerShell profile or global environment changes.
- Preserve literal paths, project folders and selected HTTP proxy; reject SOCKS.
- Retain normal CLI launch and unverified RTL capability metadata.
- Quick Input requires 1.1.6; older installs must get upgrade guidance.

## Tasks
- [x] Add native/UI failing tests for dependency state and safe handoff.
- [x] Share Claude launch command; add native prepare/open operation and IPC.
- [x] Add bilingual Claude Persian-writing card, installation/version guidance and guide sections.
- [x] Run focused native/UI/type/content/Rust checks and production build.
- [x] Attempt live terminal rendering/input; document limits and request independent review.

## Ledger
- Reusing current codex/antigravity-ide-claude-cli branch and preserving prior changes.
- Upstream v1.1.6 source accepts a startup directory, not a custom command. No keyboard injection or profile hack will be used for auto-start.
- Native/UI tests, Node85, Rust40 (+3 ignored), build and static checks passed. Persian card preview inspected.
- Reviewer P2 about older-host upgrade was verified and resolved with an explicit official manual-update action; its regression passed.
- Live acceptance is pending manual installation. The official installer digest was verified; automatic elevated execution was rejected with `blocked by policy`, so the user was asked to install it. Experimental status remains.
- Evidence: docs/validation/20261104_claude_persian_terminal.md.
