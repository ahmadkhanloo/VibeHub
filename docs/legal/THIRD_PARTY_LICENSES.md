# VibeHub third-party license inventory

**State:** development inventory; production release is blocked until the version-specific SBOM and complete transitive license review are attached.

VibeHub's own source is MIT licensed (see the root `LICENSE`). Runtime and build dependency versions are pinned by `pnpm-lock.yaml` and `apps/desktop/src-tauri/Cargo.toml`; the production SBOM must be regenerated from the exact release commit. This summary is not a substitute for checking the license of every resolved direct and transitive component before publishing.

## Bundled font

| Component | Use | License / notice |
|---|---|---|
| Vazirmatn | Bundled Persian UI font files | SIL Open Font License 1.1; notice is included beside the font files under `apps/desktop/src/assets/fonts/OFL.txt` |

## Private Windows runtime

The Windows Setup includes the Node.js 24.22.1 x64 executable for the RTL injectors. The build downloads the official Node.js archive, verifies its SHA-256, and includes the upstream `LICENSE` file as `NODE-LICENSE.md`. The runtime is installed privately under VibeHub and does not modify the system PATH. Confirm the exact release artifact and its complete upstream notices as part of the release SBOM review.

## Direct application dependencies

The following direct dependencies are used by the desktop frontend. The release SBOM must include their resolved versions and transitive dependencies; license metadata must be checked from the exact locked packages.

| Component | Use | License metadata |
|---|---|---|
| Tauri 2 APIs and plugins | Native IPC, opening official URLs, notifications, process relaunch, signed updates | MIT and/or Apache-2.0; verify each locked crate/package |
| React and React DOM | UI | MIT |
| React Router | Navigation | MIT |
| i18next and react-i18next | fa/en localization | MIT |
| Zod | Catalog/feed schema validation | MIT |
| Lucide React | UI icons | ISC |
| React Markdown | Bundled guides | MIT |
| Vite, Tailwind CSS, TypeScript | Frontend build | MIT; verify exact transitive packages in the SBOM |

## Explicitly not bundled

VibeHub does not bundle third-party AI coding tools, model weights, API credentials, or proprietary inference clients. Users reach a vendor's official installation route. JetBrainsMono Nerd Font is a separately licensed optional host-font recommendation and is not bundled with this desktop build.

## Release verification

For each release, generate a CycloneDX or SPDX SBOM from the exact source revision and build lockfiles, inspect all detected licenses and notices, and attach both the SBOM and this file to the public GitHub Release. An unknown or incompatible license blocks release until resolved and recorded.
