# Quiet Workbench — interface refresh (2026-11-16)

A minimal-modern pass over the desktop shell. The goal was to remove noise, not to
change the product: fewer competing surfaces, one primary action per card, flat
content with floating overlays, and a text-size preference that actually works.

## What changed

| Area | Before | After |
| --- | --- | --- |
| Window chrome | 44px custom titlebar stacked on a 66px topbar (110px) | one 56px command bar spanning the window; drag region in the middle, window buttons still physical top-right |
| Navigation | eight flat rows, two of them wrapping to a second line | three groups (میزکار / اتصال‌ها / یادگیری و ابزار) with 40px single-line rows and a tooltip carrying the longer wording |
| Theme switch | 92px animated day/night scene (99 lines JSX + a 237-line stylesheet: layered clouds, craters, shooting star) | 36px sun/moon button, 120ms crossfade; the scene stylesheet is deleted |
| App tile | status pill + two-line proxy sentence + API sentence + version + two same-weight buttons | logo + name + quiet status dot; one metadata strip (proxy · mode · API reference) with the full sentence on hover; primary Run plus a secondary RTL launch |
| Learning | twelve category chips in two rows plus a per-row category badge repeating the group heading | one category select, rows show title and summary only |
| Appearance | `textSize` was persisted, applied as `data-text-size`, and read by no CSS and no control | three-step control in Settings; measures are in rem so every component (including Tailwind utilities) scales |
| Surfaces | 4px/18px shadows on every card, ~15 distinct border radii, weights 650–800 | three radius tokens, one overlay shadow, content flat with a 1px hairline, single 600 heading weight |

Colour families and accents are untouched on purpose: the existing axe pass and the
40-combination contrast test are tied to them. Only the `graphite` neutrals moved
from a blue tint to a true grey, keeping `--muted` on `--surface` above 4.5:1.

## Design tokens

`apps/desktop/src/styles/tokens.css` is the single source of truth: a 4px spacing
scale, three radii (`--r-control` 8, `--r-surface` 12, `--r-overlay` 16) plus
`--r-pill`, one overlay shadow, a six-step rem type scale, two motion durations, and
the `[data-text-size]` rules (`93.75%` / `100%` / `109.375%`, so the user's own
browser font size is still the base).

## Files

- `styles/tokens.css` (new), `styles/theme.css`, `styles/main.css`, `styles/workbench.css`,
  `styles/day-night.css` (removed)
- `app/shell.tsx` (command bar + grouped rail), `app/WindowTitlebar.tsx`
  (`WindowControls`, `WindowDragStrip`), `app/settings.tsx` (unchanged contract)
- `components/ThemeToggle.tsx`, `components/AppSummary.tsx`, `components/LaunchControls.tsx`
- `features/home/Home.tsx`, `features/learning/Learning.tsx`,
  `features/settings/Settings.tsx`, `features/onboarding/Onboarding.tsx`
- `main.tsx` (titlebar import removed)
- i18n: `nav.json` (shortened labels + group captions), `ux.json` (text-size labels) in **both** locales

## Test-contract decisions

- `role="switch"`, `aria-checked` and the accessible name of the theme control are
  unchanged, so `theme-toggle.spec.ts` passes without edits.
- `.vh-app-tile`, `.vh-launch-actions`, `.vh-button-primary`, `.vh-theme-preview`,
  `.vh-sidebar-logo-expand`, the `data-testid` hooks and every launch `aria-label`
  are preserved.
- Two specs changed because the UI they described changed: the sidebar labels
  (`News`, `Terminal`) in `workbench.spec.ts` and `workbench-redesign.spec.ts`, and
  category selection by select instead of by chip in `git-learning.spec.ts` and
  `learning-library.spec.ts`.
- New `tests/ui/appearance.spec.ts` locks the invariants: a single ≤56px bar, three
  group captions, no wrapped rail label, exactly one primary button per tile, no
  clipped metadata at 1280 and 960, a status surface with no fill, a working
  text-size preference across reload, and Data + About sharing one tab.

## Verification

| Check | Result |
| --- | --- |
| `pnpm check` (`tsc --noEmit`, 3 packages) | passed |
| `pnpm test` (Node) | 91 tests passed |
| `pnpm i18n:check` | parity OK (1334 keys, fa + en) |
| `pnpm test:ui` (full Playwright suite) | **175 passed** (final run after the last polish: 17.3 m) |

Two defects were found and fixed by that run rather than by inspection:

- the quiet status removed the old `max-width:48%` cap, so a long state message
  ("Launch state could not be checked…") stole the width from the app name and
  rendered it one character per line. The name now has `flex:1 1 auto;min-width:0`
  and the status shrinks with ellipsis instead.
- at 320px the three-button text-size control overflowed the settings panel. Below
  575px the segmented control now shrinks (`min-width:0;flex:1`) instead of keeping
  its 88px minimum.

Browser screenshots at 960×640, 1280×860 and 1440×900 for seven routes are written
to `output/ux-redesign/screens/`; the pre-change set is preserved in
`output/ux-redesign/baseline/` for comparison.

## Deliberate deviations from the plan

- **No dashed "add app" tile.** The workspace already offers *Installed / Discover
  tools* immediately above the grid, so a second entry point would duplicate it; the
  single primary button in the page header stays.
- **"About" was not split into its own tab.** The tab key is `dataTab` — literally
  "Data and about" — so the two sections were intentional. They are now one section
  with a divider instead of two siblings sharing a condition.
- **CSS consolidation stayed bounded.** Scattered literals were replaced by tokens and
  provably dead rules removed (the unused `--radius`/`--radius-sm`, the `vh-summary-*`
  and `vh-account-*` blocks the old tile used, the second `--vh-shadow` layer), but the
  three-layer cascade was not rewritten: a 175-scenario suite is not a safe place to
  prove a wholesale re-order.
- **Text size scales through rem**, not `zoom`, so portalled overlays (tooltips) keep
  coordinate parity with their anchors. The default root stays 100%, so nothing moves
  for users who never touch the setting.
- **Phase 4 (command palette) was not built** — it was listed as out of scope.

## Not verified here

- The frameless-window behaviour of the merged bar (drag, double-click maximise,
  the 138px reserve for the window buttons) only exists in the Tauri window. Browser
  screenshots cannot show it; it needs `pnpm dev:desktop` on Windows.
- `pnpm test:ui` drives installed Edge through fixtures; it is not evidence about a
  real installed IDE, proxy traffic or RTL injection in a third-party app.
- Contrast and axe results are scoped to the checked Persian and English screens; they
  are not an accessibility certification.
