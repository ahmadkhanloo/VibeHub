# dsh-playwright: a real browser at the agent's hands

Every agent on the profile can drive a real browser: navigation, clicking, typing, snapshots and screenshots through the official Microsoft Playwright MCP, using accessibility snapshots — no vision model.

## Install

Shared commands live in [DeepSeek Harness plugins](/learning/dsh-plugins-basics). For this plugin:

```bash
dsh plugin --profile desktop add github:akash-digitavision/dsh-playwright
```

Requirements: Node.js 18+ with `npx` and an installed Chrome or Chromium. The first start downloads `@playwright/mcp` via npx (30-60s); later starts take about a second.

## Basic commands (tools)

Tools are registered as `mcp__playwright__*`; the most used:

- `browser_navigate` — open an address.
- `browser_snapshot` — the page's accessibility snapshot; the basis of every click.
- `browser_click` and `browser_type` — click and type on that snapshot's elements.
- `browser_take_screenshot` — a page screenshot.
- Tab management and network request inspection.

Verify the install: ask the agent to `browser_navigate` to a page and `browser_snapshot` it; the plugin list also shows the live `include:mcp-playwright` entry.

## Configuration

The default browser is your installed Chrome (headed, persistent profile). Optional flags in settings:

- `--headless` — no visible window.
- `--isolated` — in-memory profile; no persisted cookies or storage.
- `--browser chromium` — Playwright's bundled Chromium instead of system Chrome.
- `--caps=vision,pdf` — extra capability tools.

## Notes

- Clicks and typing run with your user privileges; read the target before approving destructive actions.
- It coexists with dsh-chrome-devtools; tool namespace and browser instance are separate.
- For automated tests of your own project with Playwright, see [Playwright: browser testing for your project](/learning/playwright) — independent of this plugin.
