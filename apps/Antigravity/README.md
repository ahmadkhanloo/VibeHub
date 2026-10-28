# Standalone Antigravity chat RTL (experimental)

Targets **Antigravity 2.24**, not Antigravity IDE. This is an optional VibeHub
component. The normal launch mode remains the default until explicitly changed.

Fully quit Antigravity, including its tray process, then use **Antigravity RTL**
or select RTL in VibeHub. A running instance without the configured debugging
port is left running and produces a restart instruction. The launcher does not
patch the installed application.

The default DevTools port is `9231`; the injector owns a loopback lock on `9232`.
`ANTIGRAVITY_RTL_PORT` overrides the first port, with the lock on the next port.
`ANTIGRAVITY_RTL_EXE` overrides executable discovery. Both launchers must share
the same port override. The launcher verifies the executable owning the port
and refuses unrelated listeners or injector processes.

Only chat prose and the message composer receive automatic direction. Code and
editor/terminal surfaces remain LTR. Selectors were inspected in the installed
2.24 frontend. Tests cover mixed-language paragraphs, new/streaming content,
idempotent injection, cleanup, and exclusion of unrelated pages.

**Live compatibility remains unverified.** During this change, the installed app
failed to load its local frontend with `ERR_TIMED_OUT`; desktop testing was then
stopped by the user. Fixture tests do not establish compatibility with an actual
conversation or a future application version. No account/authentication changes
are part of this adapter.

Launcher/injector errors appear in VibeHub and in
`%TEMP%\antigravity-rtl.out.log` / `%TEMP%\antigravity-rtl.err.log`; launcher
errors are also saved to `%TEMP%\antigravity-rtl.launch.log`.
