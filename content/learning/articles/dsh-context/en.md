# dsh-context: see the conversation context

Context insight: a token/cost usage dashboard, context composition and evolution, and live agent cards. It reads local Harness stats only — no model calls, nothing added to your context.

## Install

Shared install and removal commands live in [DeepSeek Harness plugins](/learning/dsh-plugins-basics). For this plugin:

```bash
dsh plugin --profile desktop add dsh-context
```

Update:

```bash
dsh plugin --profile desktop update dsh-context@latest
```

Inside the app, install it from Plugin Market by searching `dsh-context`.

## Basic commands

- `/context` — the slash command in a chat: shows the current context composition and recent evolution.
- Context panel in the sidebar — session stats, composition, trends, events, messages and command executions.
- Fleet tab — live cards for the current agent, its parent and every subagent.
- Sessions overview — a 7-day token/cost chart, an activity heatmap and session cards with direct jumps.

## Use

After install and a Harness restart, run a short chat and type `/context`. Then open the Context panel from the sidebar to see the composition; for delegated work, open the Fleet tab to watch subagents live.

## Notes

- Read-only; no token or network usage of its own.
- Sessions that predate the install have incomplete stats.
- If `/context` is missing: enable the plugin in Plugins and restart Harness.
