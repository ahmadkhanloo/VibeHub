# Git learning validation — 2026-11-02

## Delivered

- Three bilingual Markdown lessons in category `git`, immediately after `start`; order 10/20/30. No new schema, dependency, course dashboard or tracking storage.
- Local first-commit exercise, agent review and GitHub workflow, then seven curated resources. Primary next links preserve `category=git`; no duplicate related-article navigation.
- Existing reader now uses clear section headings, muted emphasis, and LTR code blocks with internal overflow. Filtered article links preserve the chosen category; article changes reset the `.vh-main` scroll container. Embedded guides retain their scroll position.
- Installation/authentication links checked against official Git and GitHub pages. Git Flight Rules conflict fragment corrected against its current README (`there-were-conflicts`).

## Verification

- `pnpm.cmd content:validate`: passed, 19 articles / 10 categories.
- `node --test tests/git-learning.test.mjs tests/content-site.test.mjs packages/core/tests/learning.test.mjs`: 10 passed.
- `pnpm.cmd --filter @vibehub/desktop check`: passed.
- `pnpm.cmd --filter @vibehub/desktop build`: passed (Vite reports a large-chunk size warning; no build error).
- `pnpm.cmd exec playwright test tests/ui/git-learning.spec.ts tests/ui/learning-library.spec.ts`: initial 16 passed. After heading/code presentation polish, all 13 Git navigation/render cases passed again; the additional downloaded-feed/offline/reload case passed separately.
- Local Git commands exercised in an isolated temporary repository using test-only author settings; two commits, diff, feature branch and staged review verified. Global user Git configuration untouched.
- Screenshots under `output/git-learning/`: fa/en × light/dark × 390/768/1280. Layout overflow assertions passed. Persian category, resources and final dark narrow reader inspected visually. External URL opening verified through the mocked Tauri opener; category navigation, reader scroll reset and keyboard focus verified.
- Existing generic learning tests cover article reading, remotely added categories and offline cache behavior; the new offline case specifically supplies the real Git lessons through the mock feed and reloads after a failed refresh.

## Limits and publication

- Browser UI tests use mocked native IPC. No native Windows acceptance run, live GitHub authentication, remote push or PR creation was performed; these are not claimed as verified.
- GitByBit installation and full video viewing remain untested and are described accordingly in the resources lesson.
- Content and UI changes are local. No commit, push, feed deployment or installer release performed. Publish content through the existing content-feed pipeline; reader/navigation updates ship in a normal application release.
- The checkout already contained substantial modified and untracked work. Existing changes were retained; no broad staging or reset was used.
