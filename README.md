# VibeHub

VibeHub is a free, open-source desktop companion for discovering and configuring AI coding tools. It separates each tool's license, free-access terms, regional eligibility, and VibeHub capabilities; it does not provide model hosting or a proxy service.

**Release channel:** VibeHub is a beta product; use the [GitHub prereleases](https://github.com/ahmadkhanloo/VibeHub/releases) for testing. Clean Windows installation and upgrade acceptance remain pending. The historical AgentRTL v1.x installers are not VibeHub releases. Track evidence and remaining gates in the [acceptance matrix](docs/validation/VibeHub_Release_Acceptance_Matrix.md).

## Windows setup

The release download will be a single NSIS installer named `VibeHub-Setup.exe`, with two choices:

- **Full VibeHub:** the desktop hub and all three RTL launchers.
- **RTL launchers only:** choose ZCode, Qoder, and/or DeepSeek Harness independently.

The setup includes a private, checksum-verified Node.js 24.22.1 LTS runtime and does not change the system Node installation or PATH. ZCode, Qoder, and DeepSeek Harness remain separate applications: install them from their official sources first, or choose their executable from the RTL shortcut if they are installed in a custom location. Missing applications do not block installing the launchers. MSI output is disabled. Automatic updates are available only in the full VibeHub mode; use the same Setup to update or change RTL-only selections.

These installer paths still need clean Windows 10 and 11 installation, upgrade, and removal evidence before public release.

## Development

Requirements: Node.js 20 or newer, pnpm 12.15.0, a stable Rust toolchain, and WebView2 on Windows.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm check
corepack pnpm build
corepack pnpm --filter @vibehub/desktop tauri dev
```

To build the Windows installer on Windows, prepare the pinned Node.js runtime and adapter payload before bundling:

```powershell
./scripts/prepare-windows-rtl-payload.ps1
corepack pnpm --filter @vibehub/desktop tauri build --bundles nsis
```

The web build verifies the frontend only. The Tauri runtime, native adapters, signed updater, production installer, and post-release behavior require their own gates and must not be inferred from a successful web build.

## Privacy and safety

- No VibeHub account, subscription, telemetry, hosted model API, or internal VPN is part of the product plan.
- Third-party free access, open-source licensing, and regional availability are separate properties and can change.
- Catalog and guide feeds are data; they cannot provide commands or executable code.
- Referral signup and a tool's official download route are separate, optional actions. For ZCode, the non-referral route is [zcode.z.ai](https://zcode.z.ai/).

## Project documents

- [Persian master plan](docs/product/VibeHub_Final_Master_Plan_v4_FA.md)
- [English implementation directive](docs/product/VibeHub_Final_Agent_Prompt_EN_v4.md)
- [Release acceptance matrix](docs/validation/VibeHub_Release_Acceptance_Matrix.md)
- [MIT license](LICENSE)
- [VibeHub repository](https://github.com/ahmadkhanloo/VibeHub)
