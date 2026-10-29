# Tooltip cleanup and real ZCode launch validation — 2026-10-28

All source changes were made in `D:/Github/VibeHub`; previous working changes were preserved. No commit, push, installer, or release was produced.

## Interface

42 general explanations in Settings, Terminal, app launch/connections, model/proxy editors, account help, onboarding, diagnostics and guides now use the existing accessible Tooltip. Related terminal hints share a single heading control. Essential warnings, eligibility/offer conditions, field labels, confirmation text and instructional content remain visible. No dependency was added.

The terminal mock now supplies explicit synthetic detection data; it does not invoke installation or modify a real PowerShell profile.

## Real ZCode evidence

A live launch initially rejected the already-open application. Closing its window left background processes, so only ZCode processes were terminated for this authorized test. An existing installed ZCode injector occupied port 9223; after verifying its node process and exact installed ZCode injector path, that injector alone was stopped. Qoder was never targeted by a close, stop, or restart command.

The repository injector then ran from `D:/Github/VibeHub/apps/ZCode/injector.mjs`. A real CDP check confirmed the `zcode-rtl-fix-v2` style in the application DOM. A subsequent complete lifecycle passed: running -> externally closed -> idle (while the injector persisted) -> RTL relaunch -> running. ZCode was left open with RTL.

Evidence: `output/zcode-live-lifecycle.json`, `output/zcode-live-rtl-dom.json`. No account tokens, personal content, or credentials were recorded.

The launch probe also exposed inherited output handles: a descendant may retain the native pipe after the adapter exits. Rust now reads through the structured result line instead of waiting for EOF; a held-pipe regression test verifies this behavior. The real adapter lifecycle was tested directly; the final Rust reader fix passed its compiled unit test. This is not a claim that every installed vendor application or every real provider account was exercised.

## Verification

- Type checks and production frontend build passed (existing large-chunk warning).
- JavaScript/content/schema tests: 33 passed.
- Translation parity: 978 keys, with two existing proper-name warnings.
- Content/feed validation passed.
- Rust final library: 37 passed, 3 opt-in live tests ignored. Backend compiled suite: 37 passed, 1 opt-in live test ignored in serial execution.
- Initial concurrent Rust execution had a transient credential-vault assertion failure; its focused rerun and the complete serial backend suite passed. A later cargo-wide retry could not replace the running development executable; the already compiled backend test executable was run directly. The final changed library was rebuilt with `cargo test --lib -- --test-threads=1` and passed.
- Native Windows: 36 assertions plus 3 lifecycle assertions passed using isolated fixtures.
- Full UI run: 66/68 passed initially. The logo test timed out during navigation; its isolated repeat passed. The English/light matrix completed but teardown failed because a simultaneous test invocation cleaned shared trace output; its isolated repeat passed. Thus all 68 cases passed across the run and focused reruns, not in one clean batch.
- Two additional tooltip cases passed in fa/en, including keyboard focus, Escape, touch and 320px bounds. Final terminal/mock refinement rerun: 4/4 passed.
- Existing full UI matrix covers fa/en, light/dark, 320/768/960/1280/1440 widths, accessibility, launch protection, account operations and cancellation. UI mock tests do not establish real vendor-account switching.
- Scoped whitespace validation passed.

## Old directory cleanup remains blocked

`output/consolidation-20261027/finish-cleanup.ps1` was attempted again; Windows reported `D:/Github/ZCodeRTL` still in use. The script preserves a final snapshot before attempting to recycle the directory. A subsequent grouped child-item recycle command was rejected by automatic approval review with only `blocked by policy`; it did not execute. The directory still exists. Close the old Codex project/windows, reopen `D:/Github/VibeHub`, then run the existing cleanup script from the new checkout. No claim of successful deletion is made.

## Follow-up UX correction

The earlier tooltip sweep hid several decision-critical explanations. These are visible again: cache/reset/credential deletion scope, unavailable automatic updates, notification behavior, required proxy behavior and when proxy changes apply, model key deletion on provider/origin change, manual model setup, experimental account switching, automation timing, onboarding tool selection, and terminal preview limitations/apply/undo/verification steps. Supplementary technical/background help remains in Tooltip. Terminal copy now describes the user-visible effect without implementation jargon.

Added fa/en regression coverage asserting essential instructions are visible without interacting with help. Six focused UI cases passed, including touch/Escape, terminal deep link, cancellation and 320px settings. Type checks and translation parity passed. Screenshots: output/explanatory-tooltips/data-reviewed-fa.png and data-reviewed-en.png.
