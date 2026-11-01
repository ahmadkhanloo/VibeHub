# Learning content updates implementation plan

**Goal:** Publish new extension tutorials by editing content, without a new installer after this client update.

**Architecture:** Extend the existing Pages feed, native downloader, validated catalog store and offline cache. Reuse startup/focus refresh (15-minute throttle) and add a manual refresh in the extensions page. Older feeds without learning content retain current tutorials.

**Tech stack:** React, TypeScript/Zod, Tauri/Rust, GitHub Pages.

## Tasks

- [x] Add shared tutorial validation with no fixed entry count; test additions, duplicates, invalid links, translations and executable payloads.
- [x] Download optional learning content, validate before atomic application, persist in the existing cache, and expose through the reactive store.
- [x] Connect the extensions page and manual refresh; test visible updates, offline reload, invalid-feed retention, cache reset and older feeds.
- [x] Document the GitHub editing/publishing workflow and verify content assembly, Node suite, TypeScript, Rust and focused browser tests.

## Constraints and review focus

No new dependencies or admin panel. Preserve cached content on errors. Only a missing learning file (HTTP 404) counts as an older feed. Reject malformed or unsafe content before changing any catalog state. Keep bundled tutorials as the offline baseline; accept an explicit empty list to remove all entries.

## Execution record

User authorized execution of the proposal in chat. Reuse the current clean checkout. Existing publication workflow already watches content/** and copies learning/ into the feed; existing FeedActivity handles background refresh.

Verification: pnpm test (47 passed), pnpm check, content:validate, i18n:check, release:guard and production build passed. Focused Playwright suite (learning-feed and feed-activity): 2 passed. Rust library suite: 40 passed, 3 opt-in tests ignored. Existing warnings: identical terminal translation values, large Vite chunk, proc-macro-error2 future incompatibility. Independent review reported no actionable findings. No commit, push, installer release or live deployment performed.
