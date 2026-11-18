# RepoWise: repository intelligence for your agent

Compress noisy command output, score change risk, and check code health.

## What it gives you

Three uses: help understanding code and architecture, shrink tool output before an agent reads it, and assess change risk and code health. None of it replaces reading the code or running the tests.

## Install and first step

```bash
repowise --version
repowise status
```

`status` reports the index state. If the page count is zero, everything index-backed (`context`, `search`, `ask`) returns nothing until `repowise init` runs — and `init` spends model tokens. Do not run it casually.

These work without an index: `health`, `risk`, `dead-code`, `distill`, `expand`.

## Compressing output

```bash
repowise distill npm test
repowise distill git diff
repowise expand <ref>
```

`distill` runs the command and prints a compact, reversible rendering; `expand` brings back an omitted block. For test runs it keeps the failures and the summary.

Keep raw output wherever the output itself is the evidence — the exact failure list, a final number, non-reproducible behaviour. A tool summary is not the primary evidence.

## Risk and health

```bash
repowise health
repowise risk
repowise impacted-tests main...HEAD
```

- `health` runs without a model or network and scores per-file health.
- `risk` estimates the risk of uncommitted changes.
- `impacted-tests` needs ingested coverage data and never replaces the full suite before a release.

These are diagnostics, not proof of correctness.

## Keeping the index fresh

```bash
repowise hook install
```

The hook re-syncs after every commit. Version 0.45 has no `update` and no `doc-drift` command; check `repowise --help` for the real surface. `repowise reindex` only rebuilds the search index from existing pages; it does not improve the code.

## Making it part of the agent loop

The tool pays off as part of a routine rather than a one-off run: check state and context before changing code, `distill` noisy output while working, then `health`/`risk` and the real test run afterwards. Those rules belong in the project instruction file (for example `AGENTS.md`) so the agent reads them every time.

## Next step

[Review code with an agent](/learning/code-review) and [Debugging with an assistant](/learning/debugging-with-agent) are where this helps most.
