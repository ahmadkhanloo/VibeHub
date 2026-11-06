# Inline tutorial screenshots — 2026-11-05

## Delivered

- Shared Markdown reader: registered local WebP images, dimensions reserved before loading, localized captions with source and retrieval date, keyboard-accessible native dialog, Escape/close handling, focus restoration and image-error fallback.
- Twenty-eight images (1,656,226 bytes, about 1.58 MiB), packaged in the application. No remote image requests or CSP relaxation. Original source URLs, source type, dimensions and known example versions are recorded in `apps/desktop/src/lib/tutorial-screenshots.json`.
- Official Claude screenshots: CLI command approval, VS Code selected-code context and proposed-edit diff. The context/diff screenshots stay in the explicitly named IDE lesson. Other editor views illustrate the actual Markdown files in the memory and skills lessons; no editor view is presented as a CLI capture.
- Official Claude Academy images now cover all nine feature lessons: Plan mode and plan review, project memory, skill files and discovery, MCP setup/status/details, running a code-review subagent, compaction and its summary, and plugin discovery. Editor screenshots of Markdown files are identified as editor views. Examples are not presented as the current model catalog or the user's account.
- Updated the agent creation lesson against current documentation: the `/agents` wizard was removed in v2.1.198. The lesson now creates a Markdown agent file and restricts tools, instead of teaching the removed wizard. Added `/reload-skills` recovery for skill directories first created during a session.
- Official Qoder custom-agent picker and three ZCode views (new task, model picker, editing history) accompany feature-specific steps. Added two official Harness model-configuration images. The latter come from the shared Web UI guide and are labeled accordingly.
- A real Windows Antigravity IDE 2.6.0 screenshot shows a disposable folder and its trust prompt. The original personal workspace was left intact; a separate window and `.qa/tutorial-demo` folder were used. No trust or permission choice was approved. The new window remains at the trust prompt. The agent panel failed to initialize, so this is not agent acceptance evidence.
- An official Codex desktop video poster demonstrates attaching a CSV, explicitly identified as an older macOS Codex interface rather than Chat. Removed stale instructions for VibeHub's account panel, which no longer exists on the active route, and its old pinned CLI install command.
- General code-review and long-running guides now include clearly named Claude examples rather than schematics.
- Official OpenCode TUI and MiMo Code startup screenshots, explicitly identified as macOS examples.
- Two screenshots published by the DeepSeek web-login plugin maintainer: login settings and usage. These are attributed to the plugin maintainer, not DeepSeek. Existing account information was already masked in the published source.
- Generic workflow schematic embeds removed from tutorial Markdown. Old routed pages redirect to the shared learning reader; dormant legacy components and schematic assets were not redesigned or deleted.
- Nine bilingual Claude lessons: workflow, permissions, CLAUDE.md, Skills, MCP, agents, sessions/context, plugins, and VS Code. Each has at least one relevant image in both languages; a content test enforces visual parity. The existing Claude guide links to each lesson. Skills, CLAUDE.md, agents and MCP include concrete configuration examples. Inline commands and paths use isolated LTR direction inside Persian prose.

## Source verification

Claude content was checked against the official pages at `https://code.claude.com/docs/en/`: quickstart, common-workflows, permissions, memory, skills, mcp, sub-agents, interactive-mode, plugins and vs-code, plus the relevant `https://academy.claude.com/` lessons. Academy's public read-only search endpoint helped locate these lessons; no connector was installed in the user's Claude configuration. Sources appear in each lesson and image caption. Retrieval dates are not claimed to be original capture dates. Example versions are recorded only when identified by the screenshot or official source.

The browser/UI tests verify VibeHub's reader, not successful use of an authenticated Claude account, MCP service or paid model. No course command was executed against user projects or external accounts.

## Validation

- `pnpm.cmd build`: passed (TypeScript and production Vite build).
- `pnpm.cmd content:validate`: passed.
- `node --test tests/tutorial-screenshots.test.mjs tests/content-site.test.mjs packages/core/tests/learning.test.mjs`: 10 passed.
- `pnpm.cmd exec playwright test tests/ui/learning-library.spec.ts`: 8 passed.
- Visual inspection: all added source assets, English VS Code lesson in light/dark mode, Persian permission lesson at narrow width, Persian MCP/agent lessons and ZCode. QA captures are under `output/tutorials/`; they use the test native bridge and are not published as real application screenshots in lessons. The Antigravity capture is from the actual installed native app.
- UI coverage includes local image decoding, source captions, click/keyboard opening, Escape and close button, focus restoration, opening an already-loaded asset offline, and no document-width overflow at 390px. It does not demonstrate an offline first browser load; native offline availability comes from packaged assets.

## Still incomplete against the full plan

All nine Claude feature lessons and eight of ten active app guides have inline screenshots. This is still not full screenshot coverage for every training article or every step within an app guide.

| Material | Remaining image work |
| --- | --- |
| Freebuff CLI and Freebuff Desktop | No suitable feature screenshots were found on the official product pages, launch posts or repository tree. The desktop program folder is empty and the CLI command is absent. Marketing graphics were excluded. Real clean application captures remain necessary. |
| Antigravity IDE | The folder-opening/trust step has a real capture. Agent operations remain unillustrated because the local agent panel failed to initialize and official Google Codelab assets returned HTTP 403. |
| General Git, RTL and individual skills/document/testing lessons | Some still need feature-specific screenshots; code review and long-running tasks now have relevant Claude examples. |

The existing Qoder window contained private project content, so an official screenshot was used instead. No user authentication or security settings were automated. Sources without suitable accessible images require clean, real application captures before those lessons can meet the full visual acceptance criteria.

## Freebuff capture preparation

The official Windows installer was downloaded, but not executed, through `https://freebuff.com/api/desktop/download/windows` (resolved download host: `release-assets.githubusercontent.com`). Local file: `.qa/Freebuff-windows-x64-tutorial.exe`.

- Product version: 0.0.200; length: 270,661,968 bytes.
- Windows Authenticode status: Valid; signer subject: `CN=James Grugett, O=James Grugett, L=Austin, S=tx, C=US`.
- Locally computed SHA-256: `E767263C33F8E43AE068167CCE9E0EEEE1EB3A23736F4173CD71B23A56706BFB`. This records downloaded bytes; it was not compared with a separately published upstream checksum.
- Installing/running newly acquired software through Windows UI requires action-time confirmation under the computer-use skill's confirmations policy. No installer or Freebuff account flow was run. Authentication, if needed, must be completed by the user.

## Delivery boundary

Changes are local; no commit, push, release, installer or feed publication was performed. New image assets require an updated application bundle. Publishing new image references into the feed before the target app bundle contains them can leave older clients without those images; coordinate those releases rather than treating a feed refresh as an image update.


## App-guide coverage follow-up

All ten catalog apps now have feature or setup screenshots in Persian and English. Added four captures: the official Freebuff CLI installation step, Freebuff Desktop installation and new-chat composer on Windows, and the real OpenCode Desktop composer. The Freebuff 0.0.200 installer was executed and the app opened. The CLI capture shows the official web installation instructions. An authenticated CLI session was not exercised. Desktop composer captures exclude account information and private paths. The earlier eight-of-ten count describes the previous checkpoint.
