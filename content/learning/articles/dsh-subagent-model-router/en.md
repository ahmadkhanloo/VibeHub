# dsh-subagent-model-router: the right model per delegated task

Define your fast, affordable, specialized and strong models once with aliases; the agent routes each delegated task to the right one, sets a reasoning effort per task, and the chosen model stays visible in the UI. Routine work gets faster, hard problems get stronger results, and cost stays under control.

## Install

Shared commands live in [DeepSeek Harness plugins](/learning/dsh-plugins-basics). For this plugin:

```bash
dsh plugin --profile web add github:pumbleblock/dsh-subagent-model-router
```

Compatible with Harness 0.1.7-rc.2 through 0.2.x; see the repository's compatibility table. On this machine it is installed on the web profile.

## Configuration and basic commands

- In the plugin settings define an alias per route: `provider`, `model`, optional `reasoningEffort` and a one-line note ("mechanical edits and test runs", "stubborn bugs"). One model can appear at two efforts under two aliases — say `luna-quick` and `luna-deep`.
- The agent calls the `subagent_model` tool; effort precedence is the call itself, then the alias, then the model's default, and it is validated before the child is created — an unsupported level fails immediately listing that model's allowed levels.
- `wait-for-subagents` joins outstanding background work so the parent can synthesize the results; it is useful even with no routes configured.
- Subagents run in parallel and the friendly model name shows in the subagent header and the Sub-agents tab.
- Settings-form configuration persists into the profile's `cordis.patch.yml`.

## Notes

- A legacy `subagent-model-router` section in `settings.yaml` is not imported after the 0.1.7 upgrade; move it into a Cordis patch by hand.
- A forked subagent does not inherit its ancestor's model; the route is recorded in its own descriptor.
- For configuration, use the repository README's examples as the reference; provider names depend on your install.
