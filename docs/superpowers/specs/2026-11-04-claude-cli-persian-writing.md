# Claude CLI Persian writing support

Date: 2026-11-04. Status: approved in chat.

## Goal
Make the existing Claude Code CLI usable with shaped Persian text, mixed RTL/LTR output and a native Persian input editor through VibeHub.

## Proposed minimal approach
Reuse RtlTerminal, already offered on VibeHub's Terminal page. Add a Claude-specific Persian writing panel with dependency detection, an open-RTL-terminal action, a copyable session launch command and explicit instructions for its Quick Input editor. Pass project directory and selected HTTP proxy to the host process. Keep keys in the terminal/session only; do not persist them in commands or files.

Upstream v1.1.6 accepts a starting directory but has no documented or implemented arbitrary startup-command option. Opening the host must therefore be labelled as opening a Persian terminal, not falsely reported as a running Claude session. The user runs the prepared command in that terminal. Do not modify the user's PowerShell profile, terminal settings or global environment to force auto-start.

Keep ordinary Claude CLI launch available. Do not advertise verified Claude RTL until a live rendering/input test succeeds. Document sample Persian with joined letters, English, numbers, punctuation and code. RtlTerminal Quick Input is a native editor; full-screen Claude cursor behavior needs independent acceptance.

## Alternative
A custom browser-based Claude UI or a fork of RtlTerminal can automate more, but introduces a new frontend/protocol or maintained terminal fork. It is outside this minimal proposal.

## Checks
Native host missing/installed behavior; safe directory/command handoff; HTTP proxy inheritance and SOCKS rejection; UI setup links and copy text in Persian/English; existing launch regressions. Attempt a live test with RtlTerminal and record any install/UAC or app-control limits rather than promoting untested support.

