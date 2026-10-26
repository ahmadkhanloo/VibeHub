# Qoder — English guide

## Introduction
Qoder is an agentic IDE. Its Community plan with BYOK is the free path (under the vendor's current terms).

## Free access
- Free Community/BYOK plan; see [the official site](https://qoder.com/) for details and caps.
- The software is not open source; "free" and "open source" are different things.

## Install
1. Get the official installer from the vendor.
2. VibeHub detects standard installs (`Programs\Qoder IDE`, `Programs\Qoder`, `.qoder-versions` folders) and custom locations (previously resolved paths or a running process).

## First run
1. Click **Launch with RTL**; VibeHub waits for a real Qoder window on the debug port before declaring the injection ready.
2. Run Doctor to verify.

## Proxy & Iran access
- **Community report (unverified, 2026-10-26):** signup sometimes needed a proxy, and direct connection worked afterwards. This is one dated local experience, not a general rule.
- Read the official terms before signing up.

## RTL
- Status: **verified** (live test 2026-10-18, version 0.4.4). Injection covers every frame and window and survives reloads.

## Troubleshooting
- **Port 9225 busy:** VibeHub shows the remediation path (close the occupier or change the port).
- **Qoder already open without the debug port:** fully quit (window + tray) and relaunch via VibeHub.
- **Injector died later:** the RTL shortcut revives it automatically.

## Model options
BYOK is supported in Qoder (reported); configure keys through Qoder's own official settings. The "verified" label arrives after the adapter test.
