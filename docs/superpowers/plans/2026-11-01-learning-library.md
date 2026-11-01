# Topic learning library

User authorized implementation, content additions, regional notes and suitable images for every tutorial. Reuse the current checkout and existing feed/cache.

Design: a searchable library with topic and difficulty filters, visible summaries, a single documents collection containing Word/Excel/PowerPoint/PDF, and inline lesson readers. Keep existing routes. Guide pages get a compact course navigator and educational diagrams. Use existing theme colors, Vazirmatn, logical RTL spacing and native disclosure controls; no new dependencies. Diagrams are labeled schematics rather than real screenshots.

- [x] Add backwards-compatible topic/difficulty/order metadata and tested grouping/filtering.
- [x] Build topic collections, navigation between learning surfaces, and lesson illustrations.
- [x] Add Claude Code + documented gateway content and register in the feed; expose its guide without claiming a tested local adapter.
- [x] Add source-bounded Iran access notes to affected tutorials, with unknown state for unverified services.
- [x] Verify schema, publication, content, languages, browser interactions/RTL/mobile, and production build.

Independent scopes: content agent owns new Claude guide/manifest and regional research note; illustration agent owns SVG assets. Main owns store/schema/UI/integration. Global risk: cached older feeds lack new metadata; use defaults. No real authentication, proxy traffic, installation or publishing is implied by documentation checks.

Verification: Node suite 48/48; TypeScript, content and i18n validation passed. Focused UI: topic/difficulty collection, Persian Claude guide, feed refresh/offline/error retention (4/4); existing guide search/language fallback (2/2); catalog with nine apps and local icons (1/1). Edge screenshots show no horizontal overflow at 1440 and 390 pixels. Axe found no WCAG A/AA violations in the Persian topic library in light/dark mode. All 17 SVGs were rendered and checked for text overflow; app, review and long-running surfaces load local images. Independent review reported no actionable findings. No publish or installation performed.

Assets: educational schematics are bundled, with Persian/English alt text and explanations; source Markdown references the same files for repository readers. Existing content entries keep provenance and raw skill names; formats are grouped into one documents collection. Anthropic's observed regions page has a future effective date relative to the review, explicitly recorded rather than treated as current-policy proof.
