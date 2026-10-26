# OpenCode — English guide

## Introduction
OpenCode is an open-source CLI coding agent. Model costs are separate from the tool; with free providers (OpenRouter free models or local Ollama) it is usable at no cost.

## Free access
- The tool is free and open source; models come from providers. Fully free path = OpenRouter free tier or Ollama.
- No mandatory account for the tool itself (provider accounts are separate).

## Install
1. Install per the [official docs](https://dev.opencode.ai/v2/docs).
2. **Conflict warning:** OpenCode 1 and 2 both install the `opencode` command; do not install both side by side. VibeHub detects the installed version and asks for an explicit decision on conflict — it never auto-overwrites.

## First run
From **My Apps** → **Open in Terminal** with your selected proxy profile. VibeHub launches the CLI directly (no RTL claims).

## Proxy & Iran access
Not tested. CLIs usually honor `HTTP_PROXY/HTTPS_PROXY`; VibeHub injects these from your proxy profile at launch and reports each tool's test result separately.

## RTL
Unknown — the RTL action stays disabled for this tool until a real test passes.

## Terminal
For a readable experience see VibeHub's **Terminal Setup** (mak-devline theme + JetBrainsMono Nerd Font); optional and fully reversible.

## Troubleshooting
- Command not found: reopen your shell/PATH or set the install path manually in settings.
- v1/v2 conflict: uninstall the unwanted one with its own official tool, then reinstall.

## Model options
OpenRouter (free models only), local Ollama, or an OpenAI-compatible endpoint — store and test keys in **Models & APIs**.
