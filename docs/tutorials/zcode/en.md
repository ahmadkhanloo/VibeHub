# ZCode — English guide

## Introduction
ZCode is an AI coding agent/IDE used with a user account. VibeHub discovers it, launches it, and injects RTL so Persian text renders correctly.

## Free access
- The free path comes with provider-defined terms and quotas; check the [official site](https://zcode.z.ai/) for the current status.
- "Free" does not mean "open source"; the ZCode application is not open source.
- Quotas change — VibeHub never hard-codes quota numbers.

## Install
1. Get the official installer from the vendor (the "Official download" button on the details page; it is separate from the optional invite link).
2. After installing, VibeHub auto-detects standard install locations.
3. No Node.js requirement for you — the RTL engine ships inside VibeHub.

## First run
1. In **My Apps**, click **Launch with RTL**.
2. VibeHub starts the app with a local debugging port and activates the RTL injector.
3. Run **Doctor** to verify the RTL state end-to-end.

## Proxy & Iran access
- Direct access status: **not tested**. If the connection fails, configure your local proxy profile in the Proxy Center.
- Launching through a proxy does not guarantee all app traffic is tunneled; respect the provider's policies.

## RTL
- Status: **verified** (live test 2026-10-18, version 3.15.3). Persian text right-aligns; code/terminal stay LTR.
- If the app is already running, fully quit it (including the system tray) and relaunch from VibeHub.

## Troubleshooting
- **RTL not applied:** Doctor → check port 9222 and injector status.
- **Port busy:** pick another port in settings or close the occupying app.
- **App launched without RTL:** fully quit, then launch again via VibeHub.

## Model options
Models and quotas come from the provider; BYOK status is "unknown" until tested in a later release.

## Set up RTL from VibeHub

After installing the app, return to VibeHub or choose Check again. Choose Set up RTL on its tile to create a Start Menu shortcut and select RTL for the next launch. Setup uses bundled files and does not start or close the app. [Full setup and recovery instructions](https://github.com/ahmadkhanloo/VibeHub/blob/main/docs/tutorials/rtl-setup.en.md).
