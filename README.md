# VibeHub

> **Current VibeHub download:** [v0.2.1 for Windows](https://github.com/ahmadkhanloo/VibeHub/releases/download/v0.2.1/VibeHub-Setup.exe) · [Release notes](https://github.com/ahmadkhanloo/VibeHub/releases/tag/v0.2.1).

A workspace for vibe-coding apps, with Persian RTL, accounts, and an API notebook.

The main navigation is **Apps**, **API notebook** (saved APIs, with a separate proxy page), and **More tools**, with **Settings** in the sidebar footer. Open a project folder or a recent project with an installed app, focus its existing window, and configure accounts, connections and guides from that app’s page. Account quotas are shown when available; unavailable values remain explicit. API selections are manual setup references and do not rewrite third-party settings. Connection selections can be undone, and Codex can return to the previous saved account. Qoder/ZCode account viewing is available in their pages; unverified switching is not offered.

## Development without reinstalling

- `pnpm dev` or `pnpm dev:browser`: open `http://127.0.0.1:1422/`. Vite updates the UI immediately. The visible preview banner means Windows launch/install/proxy operations are simulated; no real account credentials are available.
- `pnpm dev:desktop`: run the actual native application from source with hot reload, titled **VibeHub — Development**. It uses a separate development app identifier and settings directory. Use this window for real RTL/Windows tests; UI changes need no installer, while Rust changes rebuild/restart the development process.
- The existing installed executable is not updated by building the repository. Check the executable path and build date when comparing installed and source behavior.
- `pnpm test:ui` starts both development servers as needed. Production builds exclude the preview adapter and its fixtures.

### Apps and Codex accounts

The app catalog includes standalone Antigravity and one ChatGPT/legacy Codex entry alongside the existing apps. General IDE discovery is retired. Proxy profiles are requested on the next launch; a healthy proxy check does not establish that every app request uses it.

Open **ChatGPT / Codex → Accounts** to sign in, import your local Codex account, inspect quotas, rename/remove saved accounts, or switch accounts without VS Code. This integration currently supports **Codex CLI 0.148.0**. It manages Codex authentication, including Codex in the desktop app; it does not switch ordinary ChatGPT chat accounts. Saved profiles use Codex's encrypted auth format with the encryption key in Windows Credential Manager. The local Codex credential store continues to use its configured file/keyring mode.

Automatic switching is off by default. When enabled it checks every five minutes while VibeHub is running, uses a 1% remaining-quota threshold by default, and waits at least ten minutes between switches. Open desktop apps require explicit restart confirmation. **Live Windows desktop account switching remains experimental and unverified.**

More tools groups accounts, offers, terminal customization, diagnostics, app guides, plugin/skill tutorials, long-running agent lessons, optional setup and appearance. All four theme families and accent choices are available again. Terminal changes retain explicit confirmation and undo. First launch opens the workspace directly; the setup guide remains optional.

VibeHub is a free, open-source desktop companion for discovering and configuring AI coding tools. It separates each tool's license, free-access terms, regional eligibility, and VibeHub capabilities; it does not provide model hosting or a proxy service.

**Release channel:** The stable line is **v0.2.1**; see [GitHub releases](https://github.com/ahmadkhanloo/VibeHub/releases/tag/v0.2.1) for the current build. The [acceptance matrix](docs/validation/VibeHub_Release_Acceptance_Matrix.md) is the single source for current scenario status; historical reports provide context only. Clean Windows installation and upgrade acceptance remain open. Historical AgentRTL v1.x installers are not VibeHub releases.

## Windows setup

The release download is a single NSIS installer named `VibeHub-Setup.exe`, with two choices:

- **Full VibeHub:** the desktop hub and all four RTL adapters. Setup does not create standalone RTL shortcuts in this mode.
- **RTL launchers only:** choose ZCode, Qoder, DeepSeek Harness, and/or Antigravity independently. Setup creates RTL-labeled shortcuts for the selected apps.

The setup includes a private, checksum-verified Node.js 24.22.1 LTS runtime and does not change the system Node installation or PATH. ZCode, Qoder, DeepSeek Harness, and Antigravity remain separate applications: install them from their official sources first, or choose their executable from the RTL shortcut if they are installed in a custom location. Missing applications do not block installing the launchers. MSI output is disabled.

In full VibeHub mode, **Settings → Updates** checks the signed update feed manually; there is no background download and no update installs without your confirmation. RTL-only installs are updated by running the same Setup. `VibeHub-Setup.exe` does not carry a Windows publisher Authenticode signature; the updater archive is separately signed and verified by the app.

Clean Windows 10 and 11 installation, upgrade, and removal acceptance remains open. The [acceptance matrix](docs/validation/VibeHub_Release_Acceptance_Matrix.md) records the evidence collected so far, including the repaired updater manifests.

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


[All tutorials / همهٔ آموزش‌ها](docs/tutorials/README.md)

Install a coding app after VibeHub, then return to the workspace or use Check again. Supported app tiles offer Set up RTL: this creates a per-user Start Menu shortcut and selects RTL for the next launch using bundled files. Antigravity chat RTL remains experimental; see [RTL setup](docs/tutorials/rtl-setup.en.md).
