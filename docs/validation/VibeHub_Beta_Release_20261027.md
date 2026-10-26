# VibeHub v0.1.0-beta.1 release record

The first VibeHub beta packages the current desktop redesign, native adapters, selectable NSIS setup and bundled Node runtime. Historical v1.x releases belong to AgentRTL. This is a prerelease, not stable release acceptance.

## Local evidence

- Frontend: 31 browser acceptance scenarios; 23 JavaScript tests; TypeScript/build, i18n/content/native-command checks passed. See [UX validation](VibeHub_UX_Redesign_20261027.md).
- Native: 3 runtime and 23 backend tests passed serially; the isolated Windows suite passed 24 assertions. A prepared private Node runtime is bundled by the existing release workflow.
- The release-only Tauri configuration generates `v1Compatible` zipped updater artifacts, matching the release verification contract for `.nsis.zip` payloads. The ordinary unsigned development configuration remains separate.
- Rust tests run with one test thread in CI/release to avoid simultaneous access by the existing Windows credential-vault tests.

## Publication path

Commit and push the current source to `feat/vibehub-final`; update PR #1, wait for the three protected-main checks, then merge without bypassing protection. Tag the merged commit `v0.1.0-beta.1` to start the signed production workflow. Publish only after its draft installer, source, licenses, SBOM, updater signatures and SHA-256 validation succeed.

Expected release: https://github.com/ahmadkhanloo/VibeHub/releases/tag/v0.1.0-beta.1

The Actions run and public release are the authoritative publication outcome. This preparation document does not by itself establish successful publication.

## Remaining acceptance

Clean Windows 10/11 install/upgrade/uninstall, real vendor RTL runs, actual IDE proxy traffic, signed update lifecycle and Windows Authenticode publisher signing remain unverified. The Tauri updater signature is not an Authenticode signature. No Gate 18/19 item is marked PASS by publication or by the existing unit/browser checks.
