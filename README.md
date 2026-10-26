# VibeHub

VibeHub is a free, open-source desktop companion for discovering and configuring AI coding tools. It separates each tool's license, free-access terms, regional eligibility, and VibeHub capabilities; it does not provide model hosting or a proxy service.

**Release status:** VibeHub has not been publicly released. Do not treat a local build or the historical AgentRTL installer as the VibeHub production release. Release evidence and remaining gates are tracked in the [acceptance matrix](docs/validation/VibeHub_Release_Acceptance_Matrix.md). The planned public home is [github.com/ahmadkhanloo/VibeHub](https://github.com/ahmadkhanloo/VibeHub), pending the repository migration authorization and completion of Gates 16–19.

## Development

Requirements: Node.js 20 or newer, pnpm 12.15.0, a stable Rust toolchain, and WebView2 on Windows.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm check
corepack pnpm build
corepack pnpm --filter @vibehub/desktop tauri dev
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
