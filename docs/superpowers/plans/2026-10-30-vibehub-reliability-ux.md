# VibeHub reliability and daily-use UX implementation plan

## Scope and decisions

Implement the supplied four-package plan in its stated order: account status, connection semantics, workspace density, then current release evidence. Keep React/Tauri and existing tests. Preserve old IPC fields and user preferences; retain the existing local compact-density edits. Do not perform real-account switching, close running apps, edit third-party app settings, publish, or claim clean Windows 10/11 acceptance without evidence.

## Files and responsibilities

- `apps/desktop/src-tauri/src/accounts.rs` and `app_accounts.rs`: emit structured account/quota error codes while preserving last successful identity and quota data.
- `apps/desktop/src/services/ipc.ts`: type the optional native error-code fields.
- `apps/desktop/src/app/tool-context.tsx` and `components/AppSummary.tsx`: provide one shared, deduplicated, visibility-aware summary read per account source, retain successful snapshots, and render independent account/quota states and actions.
- `apps/desktop/src/components/AppConnection.tsx`, `features/explore/AppDetails.tsx`, `features/proxy/Proxy.tsx`, and `components/AppSummary.tsx`: name launch proxy and manual API reference separately, surface unresolved config/profile states, and scope test results to the profile revision.
- `apps/desktop/src/features/home/Home.tsx`, `components/Projects.tsx`, and `styles/workbench.css`: keep app launch actions visible at the requested desktop viewport, preserve recent projects, and explain the empty-project state. Existing local compact-default CSS/settings changes are included and preserved.
- `apps/desktop/src/i18n/{fa,en}`: keep all added states and actions bilingual.
- `tests/ui/desktop-account-races.spec.ts`, `tests/ui/network.spec.ts`, and focused new Playwright specs: cover account races/statuses, proxy semantics and test invalidation, and workspace viewport/empty state.
- `docs/validation/VibeHub_Release_Acceptance_Matrix.md`, `README.md`, and `README.fa.md`: make the matrix the sole current evidence source and keep unavailable Windows scenarios explicitly blocked or unverified.

## Execution tasks

1. **Account summary status:** Add failing UI/native regressions first. Implement the shared status model (`loading`, `ready`, `empty`, `unsupported`, `reauthRequired`, `error`), independent quota state, explicit native `errorCode`, five-minute staleness, last-good-data retention, shared in-flight reads, background polling pause, post-account-change refresh, and capability-based recovery actions. Verify account and quota failures independently, including a delayed response during an account change.
2. **Connection meaning:** Add failing UI regressions first. Display effective per-app/global/direct/system proxy state as “Proxy for next launch” and the API choice as “API reference; configure manually.” Treat missing config/deleted profiles as unresolved; call handshake outcomes connection tests only; show the next-launch notice for a running app; invalidate profile test evidence when its configuration changes; preserve rollback and explain missing rollback targets.
3. **Workspace layout:** Add failing UI regressions first. Use existing compact preference/default, hide introductory descriptions from compact cards, keep status/recovery text at least 12px, preserve flexible card height for errors and zoom, and test five launch buttons at 1280×860 plus empty/recent-project behavior. Keep the three-section navigation.
4. **Acceptance evidence:** Update the existing matrix as the authoritative current source. Restrict statuses to `PASS`, `FAIL`, `UNVERIFIED`, and `BLOCKED`; include revision, OS, install type, timestamp, installer filename/SHA-256, and evidence per scenario. Keep historical reports intact, update README links, and leave unavailable clean-machine, signing, account, or live-traffic checks unverified/blocked.

## Verification

Run focused Playwright and Rust regressions in each package, then the requested repository checks: JavaScript tests, Rust tests, TypeScript checks, production build, translation parity, content validation, and native command coverage. Record only checks actually run and keep clean Windows 10/11 install, signed upgrade, and real per-app traffic claims unverified unless their exact evidence is produced.

## Review focus

- A quota error never removes a valid account name or overwrites last successful quota data.
- Only explicit native authentication codes produce `reauthRequired`.
- A delayed response cannot restore the previous account after switching.
- Direct/system/inherited proxy choices and deleted profiles remain distinguishable.
- Connection-test evidence is tied to the exact current profile contents.
- Increased text size and error recovery can grow cards without clipping or horizontal overflow.
- Browser mocks and local builds never count as native Windows installation or traffic evidence.
