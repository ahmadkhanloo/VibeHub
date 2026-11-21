# IA restructure and API notebook (2026-11-16, second pass)

Follow-up to `20261116_quiet_workbench_redesign.md`, implementing the review decisions
from the browser-preview session: fewer destinations, discovery inside the workspace,
news inside learning, and an API notebook that opens on what the user already noted.

## Navigation after the change

| Before | After |
| --- | --- |
| Apps · AI connections · Proxy · News and offers · Tools · Terminal · Diagnostics · Learn (8) | Apps · API notebook · Proxy · Learn · Terminal · Diagnostics (6), grouped as one primary row plus *Connections* and *Learn and tools* |

## 1. Workspace: installed and not-installed in one page

- The segmented control is now a **view switch on the same page** (`/?view=available`)
  instead of a link to `/discover`. The grid, the header action and the counts stay put.
- `/discover` redirects to `/?view=available`; `/tools` redirects to `/`.
- "Add app" stays in both views. With the manual-exe flow explicitly deferred by the
  owner, it currently takes you to the not-installed view — that is the only action it
  can perform until the native registration command exists.
- Catalog tiles wrap their summary over two lines instead of clipping mid-word.

## 2. Tools folded into the workspace

- `ToolStrip` renders under the app grid: the terminal setup card plus the two
  documented developer tools (Playwright, RepoWise) with their machine-level status.
- `features/tools/Toolchain.tsx` and `features/explore/Discover.tsx` are deleted; the
  CLI agents were already catalog apps and now appear in the grid itself.

## 3. News and offers inside Learning

- Learning has two views: **Guides** and **News and offers** (`/learning?view=news`).
- `Offers.tsx` exports `NewsAndOffers({ embedded })`; embedded mode drops its own page
  header and keeps the sync action beside the feed meta row. `/offers` redirects there.
- The guides count and "Refresh content" are hidden in the news view (they belong to the
  feed that view already syncs).
- New content: `content/offers/minimax-daily-free-quota.json`, linked to the official
  page `https://code.minimax.io/`. **No figure is recorded**: `status: "reported"`, so
  the UI shows "Reported / needs verification" until someone confirms the amount, reset
  time and regional limits. `pnpm content:validate` accepts it (feed now lists 4 offers).

## 4. API notebook

- `AI connections` is renamed **API notebook / دفترچهٔ API** in the rail, the page title
  and the workshop rail.
- The page opens on **saved connections as tiles** (provider mark, name, model id, key
  state). Clicking a tile opens that provider's detail panel; until one is opened the
  grid uses the full width instead of leaving an empty detail column.
- A second view (`?view=providers`) keeps the existing provider catalogue untouched:
  search, All/Saved/My notes filters, pagination, notes, arrow-key listbox.
- "Add connection" opens a **provider picker** (grid of provider tiles); picking one
  starts the existing editor. "Try a custom URL" stays as the secondary action.
- The view is sticky: selecting a tile or filtering from the catalogue records the view
  in the URL, so neither jumps to the other. A `?provider=` deep link still opens the
  catalogue with that provider selected.

## Tests touched

`appearance`, `workbench`, `workbench-redesign`, `tools` (rewritten for the workspace
strip), `accounts`, `provider-priority`, `journey`, `news-offers` (tab queries scoped to
`.vh-news-tabs`), `rtl-setup`, `workshop`, `model-workspace`, `network`, `redesign`.
Provider-list specs now navigate with `?view=providers`, because the catalogue is the
second view of the notebook. No assertions were loosened: every one still checks the
same behaviour through the new surface.

## Verification

| Check | Result |
| --- | --- |
| `pnpm check` | passed |
| `pnpm test` | 91 passed |
| `pnpm i18n:check` | parity OK (1339 keys) |
| `pnpm content:validate` | OK (4 offers, feed index consistent) |
| `pnpm test:ui` (full suite) | **175 passed** (17.0 m) |

Review screenshots of every state (20 files) live in `output/review/`, produced by
`output/review-shots.mjs` against the browser preview on `127.0.0.1:1423`.

## Still open

- Manual "add an app from an .exe" — deferred by the owner; it needs a native command
  that registers a custom app (path, name, icon), merges it into detection, and launches
  it. Nothing in the current IPC surface can do that.
- The MiniMax quota figure, reset time and regional conditions.
- Frameless-window behaviour of the command bar still needs `pnpm dev:desktop`.
