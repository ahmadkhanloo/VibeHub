# Agent guide — VibeHub

Persian-first Windows tool that manages coding apps, their RTL layers and their
accounts. pnpm workspace: `apps/desktop` (Tauri 2 + React 19), `packages/core`,
`packages/catalog`, per-app RTL adapters under `apps/<App>/`, content under
`content/`, tests under `tests/`.

## Commands (repo root)

| Task | Command |
|---|---|
| Typecheck app | `pnpm check` (`tsc --noEmit` per package) |
| Unit tests (Node) | `pnpm test` |
| UI tests (Playwright) | `pnpm test:ui` |
| i18n key parity | `pnpm i18n:check` |
| Rust backend tests | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --lib` |
| Dev (browser preview) | `pnpm dev:browser` |
| Dev (real desktop) | `pnpm dev:desktop` |

Playwright is a devDependency, not an install step: `playwright.config.mjs` pins
`channel: msedge` on Windows, so it drives the installed Edge and needs no browser
download. `pnpm test:ui` starts its own dev servers on ports 1425 and 1422 and takes
~16 minutes — do not run it as a quick check, and never report it as passed unless it
actually ran.

## RepoWise (codebase intelligence)

RepoWise may be installed on the developer's machine (`repowise --version`). It is a
per-machine tool: `.repowise/` is gitignored, so never assume a shared or up-to-date
index, and never treat its absence as a repository defect.

**Check before relying on it.** `repowise status` reports the wiki index state. In this
repository the wiki index is empty (0 pages), so `context`, `search`, `ask` and
`generate` return nothing until someone runs `repowise init` — that needs a logged-in
provider and LLM tokens, so do not run it unless the user asks. Report "no RepoWise
data" instead of inventing a finding.

**Available without an index** (verified on v0.45.0): `health`, `distill`, `expand`,
`risk`, `dead-code`, `symbol`, `security`. Prefer these.

### Before implementation
- Use `repowise status` for index freshness only; it is not a code review.
- Read the relevant code yourself. RepoWise context never replaces reading a file
  before editing it.

### During implementation
- Wrap noisy output so the turn stays readable: `repowise distill <command>` for test,
  build, lint, `git log`, `git status` and `git diff`. Recover anything omitted with
  `repowise expand <ref>`.
- Keep raw output when accuracy matters: exact failure lists, numeric results,
  flaky-test evidence and anything that is the actual proof of a claim.

### After implementation
- Run the checks in the table above that cover what you changed.
- `repowise health` and `repowise risk` are diagnostics, not proof of correctness.
- `repowise impacted-tests` needs ingested coverage data; it never replaces the full
  suite before a release-critical change.
- Summarize what was verified, what was inferred, and what remains unverified.

### Maintenance
- Auto-sync after commit is `repowise hook install` (post-commit). There is no
  `update` subcommand in v0.45.0, and no `doc-drift` command.
- `repowise reindex` only rebuilds the vector index from existing pages; it does not
  improve the code.
- Refactoring suggestions (`health --refactoring-targets`) and dead-code findings are
  only for a task that asked for them. Do not refactor unrelated code.
- Do not run `init`, `generate`, `restyle` or `health --generate-code` — they spend
  LLM tokens — without explicit approval.

## Invariants worth respecting

- Account tokens never cross the webview boundary. Codex, Claude Code, ZCode and Qoder
  tokens are read and written only by the Rust backend, stored age-encrypted with a key
  in the Windows Credential Manager.
- App-owned credential files are opaque blobs. Never decrypt, parse or log them; treat
  a session file as bytes, back it up before every replacement, and restore atomically.
- RTL adapters must not rely on `dir="auto"`: a descendant with
  `unicode-bidi: plaintext` stops the browser resolving it, which silently leaves
  Persian prompts left-aligned. Write an explicit `dir` value.
- Code, terminal, diff and editor surfaces stay LTR with `unicode-bidi: isolate`.
- Both locales must stay in sync: every new key needs `fa` and `en` (`pnpm i18n:check`).
- Report a check as passed only if it ran in this session.
