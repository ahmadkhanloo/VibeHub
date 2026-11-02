# Managing VibeHub content

The app downloads validated catalog, guide, learning, and offer data from the repository’s GitHub Pages feed. Editing supported content fields and publishing the workflow does not require a new installer; new UI behavior or a new content field needs a client release that understands it.

## Where content lives

- `content/apps/<id>.json`: app description, publisher website, free access summary, compatibility and official sources.
- `content/providers/<id>.json`: provider name, official site, API key link, logo key, free access summary, supported-app status and bilingual setup notes.
- `content/offers/<offer-id>.json` and `content/offers/index.json`: curated offer records and the list included in the feed.
- `scripts/collect-offers.mjs`: allowlisted official pages and narrow parsers for automatically checked offers. A new source needs an explicit parser; an unrecognized page is kept as stale/reported data instead of being published as verified.
- `content/learning/index.json` and its Markdown files: bilingual lesson index, categories, summaries and full articles. See [the learning content guide](../../content/learning/README.md).
- `content/news/index.json`: standalone bilingual news records, separate from offer records and their expiry fields.
- `docs/tutorials/<app-id>/{fa,en}.md`: app-specific guides.
- `apps/desktop/src/assets/providers/`: bundled provider favicons and their `sources.json` provenance. A missing or unknown logo uses the initials fallback. Adding a new bundled logo requires a client build.

Keep stable IDs, bilingual text, official HTTPS sources, and real review dates. Do not change a verification date without checking the official source.

## Publish a suggestion, offer, or news item

1. For an offer, copy an offer JSON record, choose a unique ASCII ID, add both Persian and English text, and update `content/offers/index.json`. Keep `sourceUrl`, review dates, status, eligibility, and start/end dates accurate. For news, add a separate record to the `news` array in `content/news/index.json`; include bilingual title, summary and Markdown body, `publishedAt`, `checkedAt`, `sourceUrl`, and an optional `appId`. Do not give general news an offer expiry.
2. Run `pnpm.cmd content:validate` and `node --test tests/content-site.test.mjs` locally.
3. Commit to `main`, or merge a reviewed pull request into `main`. The workflow watches `content/**`, validates the data and builds the static site. It also checks known official offer sources hourly.
4. In GitHub Actions, confirm the **Publish VibeHub content feed** run completed successfully and the **Deploy to GitHub Pages** job succeeded. A commit alone does not publish the new feed.

Users’ apps check on startup, when returning to the window, every 15 minutes, or when they press **Check now** on Offers and news. A valid update is cached locally. During a network or validation failure, the cached feed remains available and the page reports its offline state. No binary update is needed for content fields supported by the installed client.

## Local checks

```powershell
pnpm.cmd content:validate
node --test tests/content-site.test.mjs
pnpm.cmd i18n:check
```

