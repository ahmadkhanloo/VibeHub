# Restored tools and desktop workbench — 2026-10-29

The user requested all removed features back, organized under **More tools**, and a more modern interface.

## Behavior

- Main navigation: Apps, Connections, More tools; Settings remains in the sidebar footer.
- More tools restores accounts, offers, terminal customization, diagnostics, guides, plugin/skill tutorials, long-running agent lessons, optional setup and appearance.
- Four theme families, eight theme previews, accent colors, notification preferences and quiet hours are available again.
- First launch still opens Apps directly. Setup can be reopened voluntarily.
- Shared desktop styling updates the sidebar, typography, search, project picker, app status, account/quota summary and connection summary in Persian and English.
- Current launch errors expand their recovery actions immediately. Historical errors retain a compact disclosure with the same retry, executable path and diagnostics actions.
- Existing project opening, focus, connection undo, account rollback and unsupported-switch gates remain.
- Terminal changes still require explicit confirmation and retain undo. Restoring the interface does not install fonts or modify a shell profile automatically.

## Validation

- TypeScript, production frontend build, translation parity (1,044 keys), native command coverage and 33 JavaScript tests passed.
- `cargo check` passed; Rust unit suite: 38 passed, 3 opt-in live checks ignored.
- Parallel Rust account tests exposed temporary-directory collisions on the Windows clock; a process-local atomic suffix now guarantees distinct fixtures.
- All 80 browser scenarios passed across the full run and the 14-scenario recheck (73 + 14); native Windows behavior passed 39 assertions with the real profile untouched. Browser acceptance covers restored destinations, theme persistence, optional setup, terminal confirmation/undo, existing account and launch behavior, and Persian/English accessibility and overflow across light/dark modes and 320–1440px widths.
- Local visual evidence: `output/modern-workbench/home-fa-light.png`, `home-fa-dark.png`, `tools-fa-light.png`, `settings-fa-dark.png`.

Browser screenshots use a clearly labeled simulated native transport. They do not establish authenticated vendor switching, real provider quotas, per-app proxy traffic or clean Windows installation acceptance.

