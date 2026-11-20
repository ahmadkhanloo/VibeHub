# dsh-workspace-hygiene: keep the agent workspace tidy

Long agent tasks pile up intermediate files; a cluttered workspace means more searching, more tokens and noisier reasoning. This plugin assesses file value and makes recommendations; the final call is yours.

## Install

Shared commands live in [DeepSeek Harness plugins](/learning/dsh-plugins-basics). For this plugin:

```bash
dsh plugin --profile desktop add github:taoshi1999/dsh-workspace-hygiene
```

## Commands and use

- Plugin panel — batch assessment of files and directories with the current session's model; the Refresh button re-runs it.
- Recommendations — per file: keep (with a suggested name and folder), remove, or undecided for your review; you accept, revise or reject.
- Automatic mode — suggestions arrive at the end of each conversation turn; `autoScan: false` turns off periodic monitoring.
- Agent tool `workspace_hygiene_review` — the only tool registered for the main agent.
- Separate review — before applying, a standalone headless session reviews the evidence with only the `hygiene_verdict` tool; a negative review means rollback.

## Notes

- Model-based assessment spends tokens and quota and runs in batches for large workspaces; model errors or incomplete coverage stop organization.
- The plugin's conversation history is AES-256-GCM encrypted under `~/.dsh-workspace-hygiene/private` and the password is never stored; a lost password means the history is unrecoverable.
- Value assessment is deliberately separated from action: clearly worthless files are flagged for removal and unclear cases stay with you. Read a removal recommendation before accepting it.
- For the long-task pattern, see [Long-running agent tasks](/learning/long-running).
