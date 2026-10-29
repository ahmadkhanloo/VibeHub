# VibeHub responsiveness and standalone Antigravity — 2026-10-27

## Changes

Native file/keychain/locking commands run on background workers. Launch and stop
operations no longer retain the shared settings lock while waiting for external
processes or dialogs. A separate launch-state lock protects short file updates;
each completed launch merges into the latest state. Per-tool operation guards
prevent concurrent launch/stop operations on the same tool. Terminal profile
changes use their own lock.

Full discovery runs on startup and explicit refresh, not window focus. Installed
inventory renders before process-state checks finish. Running-state checks are
batched every 15 seconds, do not overlap, and stop while the page is hidden.
Native discovery has a 15-second deadline; process-state checks have a 5-second
deadline. Output-pipe completion also has a deadline.

The hub and standalone launchers share executable discovery without child
PowerShell discovery processes. Registry entries are read once per scan. CLI
PATH discovery uses file checks instead of PowerShell module discovery.

Standalone Antigravity has an optional, experimental chat RTL adapter, separate
from Antigravity IDE. Normal mode remains its default. Setup includes the fourth
component in full and selected RTL modes, with owned-shortcut and injector
cleanup. See `apps/Antigravity/README.md` for operation and compatibility limits.

## Discovery measurement

`node scripts/benchmark-discovery.mjs` compared the working tree to baseline
`cea083e4ec39f0622d1c1003a44e7d0c5e8bb071`, alternating three before/after runs
on this Windows machine. Installed identities, paths and versions matched.

| Run | Baseline (ms) | Changed (ms) |
| --- | ---: | ---: |
| 1 | 12942 | 2015 |
| 2 | 6332 | 3178 |
| 3 | 7344 | 1907 |
| Median | 7344 | 2015 |

Median reduction: **73%**. These are local discovery measurements, not a general
application-speed guarantee. Raw output: `output/performance/discovery.json`.

## Verification and remaining gates

- TypeScript/workspace checks, IPC registration guard and bilingual key parity passed.
- Node suite: 27 tests passed.
- Rust: 4 tests passed, including a slow launch through the shared launch path,
  responsive settings access, duplicate-operation refusal and merged state preservation.
- Native Windows suite: 28 assertions passed with an isolated test profile,
  including batch states and CMD shim discovery.
- Qoder discovery: 8 assertions passed. Empty/single/multiple editor JSON arrays passed.
- UI suite: **37 tests passed**. Verification covers scoped RTL, streaming, input, code exclusion, reload,
  duplicate prevention, normal-mode default, editor IPC, focus, batching, hidden
  windows, outstanding requests, navigation and existing bilingual/accessibility flows.
- Windows had recorded two `AppHangB1` events before these changes. The exact
  historical hangs were not reproduced; the locking defect was independently
  found and corrected. Do not claim that all possible hangs have been eliminated.
- Live Antigravity conversation rendering is **unverified**: the installed
  standalone app failed loading its local frontend with `ERR_TIMED_OUT`, and
  the user subsequently stopped Computer Use with Escape. Fixture tests are
  not live compatibility evidence.
- Clean full installation, selective installation and upgrade on a disposable
  Windows profile are **not run**. NSIS compilation and source-mode checks do
  not establish those installation gates.

## Installer artifact

The optimized Rust application and the NSIS installer compiled successfully.
The generated NSIS script was compiled again after the final launcher change;
the resulting installer was copied and its SHA-256 verified.

- Archived artifact: `release-artifacts/VibeHub-Setup-before-network-20261027.exe` (27,501,419 bytes).
- SHA-256: `3235065152508FD4A559ABCDCDA76C7D0484339F8E7752195C8B1EBA9BEF19FF`.
- Previous installer preserved as `release-artifacts/VibeHub-Setup-before-20261027.exe`.
- NSIS reported its existing unused `Skip` function and missing
  `choowHowToInstall` language-string warnings; compilation exited successfully.
