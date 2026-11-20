# RepoWise: repository intelligence for your agent

Compress noisy command output, score change risk, and check code health.

## What it gives you

Three uses: help understanding code and architecture, shrink tool output before an agent reads it, and assess change risk and code health. None of it replaces reading the code or running the tests.

## Setup

```bash
repowise --version
repowise status
repowise login
repowise init
repowise doctor
```

- `status` reports each repository's index state (page count, last indexed, sync status).
- If the page count is zero, everything index-backed (`context`, `search`, `ask`) returns nothing until `repowise init` runs.
- `init` and the other generating commands use the model: sign in with `repowise login` and know it spends tokens. Do not run it casually.
- `doctor` checks the wiki setup's health.

These work without an index: `health`, `risk`, `dead-code`, `distill`, `expand`, `security`.

## Keeping the index fresh

```bash
repowise update
repowise watch
repowise hook install
repowise reindex
```

- `update` incrementally refreshes the pages of files that changed.
- `watch` monitors file changes and updates automatically.
- `hook install` sets up the git hook so a commit auto-syncs — the recommended routine.
- `reindex` only rebuilds the search index from existing pages; it does not improve the code.

Check `repowise --help` for the full, version-accurate command list; the surface changes between releases.

## Detail: compress, expand, ask

```bash
repowise distill npm test
repowise distill git diff
repowise expand <ref>
repowise symbol <name>
repowise context src/lib
repowise saved
```

- `distill` runs the command and prints a compact, reversible rendering; for test runs it keeps the failures and the summary.
- `expand <ref>` prints the full content behind a `[repowise#<ref>]` omission marker — what the compression dropped.
- `symbol` reads one symbol's body with live-verified line bounds; `context` prints a triage card for a file, module or symbol.
- `saved` shows the tokens you have saved.
- `search` and `ask` need an index; `ask` answers with citations.

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

## Making it part of the agent loop

The tool pays off as part of a routine rather than a one-off run: `status` and context before changing code, `distill` for noisy output while working, then `health`/`risk` and the real test run afterwards. Those rules belong in the project instruction file (for example `AGENTS.md`) so the agent reads them every time.

## Next step

[Review code with an agent](/learning/code-review) and [Debugging with an assistant](/learning/debugging-with-agent) are where this helps most.
