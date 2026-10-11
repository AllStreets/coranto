# Coranto stage 1: foundation and truth feed

Date: 2026-10-10
Status: approved 2026-10-10; built, with the changes listed in section 13
Branch: `stage-1-truth-feed`

## 1. What Coranto is

Coranto is an open-source tool for staying informed with real, sourced news on
a live photoreal globe. It is named after the corantos, the first printed
newspapers of the 1620s, in which each item was headed with its place and date.

It combines two existing projects:

- **God's Eye View** (MIT, Bilawal Sidhu) supplies the engine: the CesiumJS
  globe, the live tracking layers, the layer lifecycle, the panels and the
  local server. Coranto is a full-history fork of it, with the original repo
  kept as the `upstream` remote.
- **AUSPEX** (Apache-2.0, Connor Evans) supplies the purpose: a news pipeline,
  a junk filter, and the principle that nothing is shown without a source.

The whole project is five stages. This document specifies stage 1 only.

| Stage | Scope                                                             |
| ----- | ----------------------------------------------------------------- |
| 1     | Fork, rebrand, news provider, news layer, feed panel (this spec)  |
| 2     | Cross-outlet grouping, claim verification, cited-only AI briefs   |
| 3     | Lenses: Good News, Elections, Watch Power, then Analyst/Relief    |
| 4     | Beauty pass and new first-run experience                          |
| 5     | Hosted public site                                                |

## 2. Stage 1 outcome

Someone clones the repo, runs `npm ci && npm run dev`, and sees:

1. The app branded Coranto, with every God's Eye View layer still working.
2. A **News** layer on the globe: one marker per place that current stories
   mention, sized by how many stories.
3. A **News** panel listing current headlines from named publishers, each with
   its publish time, its place (if any) and a link to the original article.
4. A source-health line that says which feeds are live, which are down, and
   when the data was fetched.

No text in stage 1 is written by an AI model. Every word of news shown is the
publisher's own headline or summary.

## 3. The honesty rules

These rules apply to every stage. Stage 1 implements and tests rules 1 to 4;
rule 5 is recorded here so stage 2 inherits it.

1. **Source and time.** Every item shown has a publisher name, an `http(s)`
   link to the original, a publish time taken from the feed, and the time
   Coranto fetched it. An item missing any of these is dropped, never patched.
2. **No seeded content.** The runtime contains no sample, fallback or demo
   stories. When feeds are down the interface says so.
3. **No randomness in data.** Nothing presented as data is derived from a
   random number. A story is placed at a real named place with its precision
   shown, or it is not placed.
4. **Measured or labelled.** Anything inferred by Coranto (a story's location,
   its category) is labelled as inferred, with the text it was inferred from.
5. **AI text (stage 2 onward).** AI-written text is labelled and every
   sentence cites specific feed items; uncited sentences are removed in code.

### Defects in AUSPEX that these rules exist to prevent

Found by reading the AUSPEX source. None of this code is ported.

| Defect                                                                              | Where in AUSPEX                              |
| ----------------------------------------------------------------------------------- | -------------------------------------------- |
| 20 invented stories attributed to Reuters, AP, FT, BBC, shown when the worker fails | `js/data.js` `FALLBACK_NEWS`                 |
| Story pins moved by a random offset of up to about 0.3 degrees                      | `js/news.js:166`, `api/refresh.mjs:53`       |
| Vessel counts multiplied by a random factor                                         | `js/overlay.js:1012`                         |
| Missing publish date replaced with the current time                                 | `worker/news.js` (`fetchRssFeed`, NewsAPI)   |
| Places matched by substring ("us" inside "business"; "amazon"; "san jose")          | `src/geolocate.js` `extractCoords`           |
| GDELT's publisher country used as the story's location                              | `js/news.js:149`                             |
| A failed source returns an empty list with no record of the failure                 | `worker/news.js` (every `catch { return [] }`) |

## 4. Out of scope for stage 1

- Any AI-generated text, summaries or briefs.
- Grouping the same story across outlets, corroboration counts, VERIFY,
  Divergence, Silence.
- Good News, Elections, Watch Power, Analyst, Relief and Sectors lenses.
- Article images. Hot-linking publisher images exposes the reader's IP address
  to each publisher and raises rights questions; deferred to stage 4.
- Scraping article bodies. Only what the feed itself publishes is used.
- A voice or MCP tool for news. The news layer is listed in
  `VOICE_OFF_LAYERS`; a `get_news` tool comes with stage 2.
- A NewsAPI key field in the Provider Settings panel. The key is read from
  `.env` only.
- A hosted deployment. There is still no production server; `vite preview`
  remains a local check only.
- A full visual identity. Stage 1 replaces the name and logo; stage 4 does the
  design work.
- Changes to any existing God's Eye View layer, including the camera,
  plate-reader and military layers, which stay as they are.

## 5. Fork and rebrand

### Repository

- Location: `stay_informed/coranto`, cloned with full history. Remote
  `upstream` points at `bilawalsidhu/gods-eye-view`. A Coranto `origin` is
  added when the GitHub repo is created; creating it is not part of stage 1.
- Node 24.14.0 through `nvm`. An `.nvmrc` containing `24.14.0` is added.
- To keep upstream merges cheap, new behaviour goes in new files, and edits to
  upstream files are limited to the registration points listed in section 9.

### Licence

- `LICENSE` becomes Apache-2.0, copyright Connor Evans, covering Coranto's
  additions.
- Upstream's MIT text, including its note on third-party data, moves unchanged
  to `LICENSE-gods-eye-view`.
- A `NOTICE` file states that Coranto is derived from God's Eye View
  (copyright 2026 Bilawal Sidhu, MIT) and incorporates code from AUSPEX
  (copyright Connor Evans, Apache-2.0).
- The bundled TeleGeography cable data stays non-commercial. The README says
  so, as upstream's does.

### User-visible rebrand

Changed:

| Surface                    | File                                             | New value                                     |
| -------------------------- | ------------------------------------------------ | --------------------------------------------- |
| Page title, favicon        | `index.html`                                     | `Coranto`                                     |
| Title bar and subtitle     | `src/ui/templates/scene-chrome.html`             | `CORANTO` / `EVERY STORY HAS A PLACE AND A DATE` |
| Loading screen             | `src/ui/templates/hud-loading.html`              | Coranto name and logo                         |
| First-run launcher copy    | `src/ui/templates/welcome.html`                  | Coranto wording                               |
| Logo                       | `public/logo.svg`                                | A plain Coranto wordmark, placeholder for stage 4 |
| Console and model strings  | `src/main.js`, `server/providers/openai/instructions.js`, `toolDescriptions.js` | "Coranto"          |
| Outbound User-Agent        | new news provider only                           | `Coranto/<version> (+repo URL)`               |
| README                     | `README.md`                                      | Rewritten for Coranto, crediting both parents |

Deliberately not changed, because renaming them breaks stored preferences,
share links, QA harnesses and the package-boundary configuration for no
visible gain: the `gods-eye-view` package name and export specifiers, `GEV_*`
environment variables, `godsEyeView.*` and `gev:` storage keys,
`window.__godsEyeView`, the `gev:template` markers and `.gev-cache/`.

Tests that assert branded copy (`firstRunExperience.test.mjs`,
`cockpitMarkup.test.mjs`, `creditAttribution.test.mjs` and any others the test
run reveals) are updated to the new copy.

## 6. News provider (server)

### Files

```
server/providers/news.js              Vite plugin factory, route, cache
server/providers/news/sources.js      The source registry
server/providers/news/rss.js          RSS, Atom and RDF parsing
server/providers/news/gdelt.js        GDELT DOC API client
server/providers/news/newsapi.js      Optional NewsAPI client
src/sources/news/records.js           Validation and normalisation (portable)
src/sources/news/junk.js              Junk and low-quality-source filter (portable)
src/sources/news/gazetteer.js         Place matching (portable)
src/sources/news/categories.js        Keyword categories (portable)
src/sources/news/cities.json          1,000-city table from AUSPEX (GeoNames)
```

The `src/sources/news/` modules import nothing from Node, the browser or
Cesium, so the same code can run in a hosted function in stage 5.

`newsProxy({ fetchImpl, now, timeoutMs })` follows the shape of
`server/providers/cyclones.js`: an injectable fetch and clock, state in the
factory closure, both `configureServer` and `configurePreviewServer`. It is
added to the array in `server/providers/local.js`.

### Sources

| ID            | Publisher     | Kind    | Checked 2026-10-10                    |
| ------------- | ------------- | ------- | ------------------------------------- |
| `bbc`         | BBC           | RSS     | 200, 32 items                         |
| `guardian`    | The Guardian  | RSS     | 200, 45 items                         |
| `aljazeera`   | Al Jazeera    | RSS     | 200, 25 items                         |
| `npr`         | NPR           | RSS     | 200, 10 items                         |
| `dw`          | DW            | RDF     | 200, 139 items                        |
| `france24`    | France 24     | RSS     | 200, 24 items                         |
| `un`          | UN News       | RSS     | 200, 30 items                         |
| `reliefweb`   | ReliefWeb     | RSS     | 202 with an empty body                |
| `sciencedaily`| ScienceDaily  | RSS     | 200, 60 items                         |
| `ars`         | Ars Technica  | Atom    | 200, 20 items                         |
| `gdelt`       | GDELT         | JSON    | 429 (rate limited) on a single request |
| `newsapi`     | NewsAPI       | JSON    | Not checked; used only when `NEWS_API_KEY` is set |

ReliefWeb and GDELT stay in the registry. Their failures on the day of writing
are exactly what the source-health display exists to show. If ReliefWeb's RSS
endpoint proves permanently closed during implementation, it is replaced with
ReliefWeb's public API and the change is noted in `DATA_SOURCES.md`.

Each registry entry holds `id`, `name`, `kind`, `url` and `homepage`. URLs are
constants in the source file. The route never fetches a URL supplied by a
client.

GDELT items carry the article's own domain as the publisher. GDELT's
`sourcecountry` field is discarded.

### Fetch rules

- One refresh fetches every source in parallel, each with an 8-second deadline
  that covers the body, a 2 MB body cap, and `https` only. Redirects are
  followed because feeds use them, but a redirect to a non-`https` URL fails
  the source.
- GDELT is tried at most twice, 3 seconds apart, as in AUSPEX.
- Concurrent requests share one refresh through `coalesceProxyRequest`.
- The result is cached in memory for 10 minutes and written to
  `.gev-cache/news.json`.

### Record rules

`normalizeArticle(raw, { sourceId, fetchedAt })` returns a record or a drop
reason. It never fills a gap.

| Field         | Rule                                                                                    |
| ------------- | --------------------------------------------------------------------------------------- |
| `id`          | SHA-256 of the canonical URL, first 16 hex characters                                   |
| `title`       | Publisher's headline, tags stripped, entities decoded; required                          |
| `summary`     | Publisher's own description, at most 400 characters; may be empty                        |
| `url`         | Must parse as `http:` or `https:`; required                                              |
| `publisher`   | Registry name for RSS; article domain for GDELT; source name for NewsAPI; required       |
| `sourceId`    | Registry ID                                                                              |
| `publishedAt` | Parsed from the feed's own date field; required. No date, or an unparseable date: dropped |
| `fetchedAt`   | Time of the refresh                                                                      |
| `place`       | From the gazetteer, or `null`                                                            |
| `category`    | From keyword matching, or `null`                                                         |

Further drops: a publish time more than 10 minutes in the future; a publish
time more than 48 hours old; a low-quality source domain; a junk match not
rescued by the priority list; a duplicate of an earlier item by canonical URL
or by the first 80 characters of the lower-cased title.

The junk filter and the low-quality-source list are ported from AUSPEX's
`src/newsjunk.js` with their tests. They are an editorial choice, so the
choice is visible: the payload counts what was dropped and why, the panel
shows the total, and `DATA_SOURCES.md` documents the lists.

### Place matching

`matchPlace(title, summary)` returns
`{ name, lat, lon, precision, matched, field }` or `null`.

- The gazetteer is AUSPEX's 1,000-city table (derived from GeoNames, CC BY)
  plus a country and region table.
- Matching is on whole words against the original-case text, never substring.
- The title is searched before the summary. A city match beats a country
  match. Among cities, the earliest match in the text wins.
- `precision` is `city`, `country` or `region`. Demonyms ("Ukrainian")
  resolve to the country at `country` precision.
- Ambiguous names are handled explicitly:
  - `US`, `U.S.` and `UK` match in upper case only.
  - Every place name requires its capital letter, so "turkey" and "china"
    in lower case match nothing.
  - Names that are ordinary English words or common personal names even when
    capitalised are removed from the tables: `Nice`, `Reading`, `Mobile`,
    `Bath`, `Jordan`, `Chad`, `Georgia`, `America`, `Amazon`, `Pacific` and
    `San Jose`. Stories about those places stay unplaced in stage 1. The
    removal list lives beside the gazetteer and grows as misplacements are
    found.
- `matched` is the exact text that matched and `field` is `title` or
  `summary`, so the interface can show why a story was placed where it was.
- No coordinate is ever altered. Stories at the same place share one marker.

A story that matches nothing has `place: null` and appears in the panel only.

### Categories

`detectCategory` is AUSPEX's keyword scorer with whole-word matching, returning
one of `geopolitics`, `military`, `finance`, `climate`, `technology`, or `null`
when nothing scores. AUSPEX defaulted unmatched stories to geopolitics; Coranto
does not. The interface labels categories as automatic tags.

### Response

`GET /api/news` returns:

```json
{
  "fetchedAt": "2026-10-10T20:41:07Z",
  "stale": false,
  "articles": [],
  "sources": [
    { "id": "bbc", "name": "BBC", "ok": true, "count": 31, "lastSuccessAt": "..." },
    { "id": "gdelt", "name": "GDELT", "ok": false, "count": 0, "lastSuccessAt": null, "reason": "rate-limited" }
  ],
  "dropped": { "noDate": 2, "badUrl": 0, "tooOld": 14, "future": 0, "junk": 9, "lowQualitySource": 3, "duplicate": 21 }
}
```

`reason` is one of a fixed set (`timeout`, `http-error`, `rate-limited`,
`parse-error`, `empty`, `not-configured`). Upstream error text is never passed
through.

| Situation                                        | Response                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| At least one source succeeded                    | 200, `stale: false`, failed sources listed with `ok: false`       |
| Every source failed, a cache exists              | 200, the cached articles, `stale: true`, original `fetchedAt`     |
| Every source failed, no cache                    | 503, `{ error, sources }`, no articles                            |
| Method other than GET                            | 405                                                               |

A source that returns zero items counts as failed with reason `empty`. A
partial refresh replaces only the articles of sources that succeeded; a failed
source's previous articles are kept until they pass the 48-hour limit, and
that source is marked `ok: false` with its real `lastSuccessAt`.

Errors are JSON with `Cache-Control: no-store`, matching the other providers.

## 7. News layer (globe)

### Files

```
src/layers/news/source.js        createNewsSource({ fetchImpl }) -> getSnapshot({ signal })
src/layers/news/records.js       Validates the payload; null on a malformed one
src/layers/news/model.js         Groups articles by place; builds overlay entries
src/layers/news/index.js         createNewsLayer({ source, overlayHost, ... })
src/layers/news/selection.js     Click handling
src/app/layers/news.js           App wrapper that injects scene services
```

The layer implements the existing lifecycle contract (`init`, `enable`,
`disable`, `update`, `destroy`, `getStats`) with `id: 'news'` and a 10-minute
`updateInterval`. The earthquakes layer is the template for structure and for
the abort-and-epoch pattern; the firms layer is the template for selection.

### Behaviour

- Articles are grouped by `place.name` and precision. Each group is one
  marker at the gazetteer coordinate.
- Marker size steps with story count (1, 2 to 4, 5 to 9, 10 or more).
- City-precision markers are solid. Country and region markers are hollow
  rings, so approximate placement is visible at a glance.
- Labels (place name and count) go through the world-overlay host. Cesium
  text labels are not used.
- Clicking a marker selects that place: it registers an entity context, asks
  for camera focus through `requestWorldFocus`, and filters the panel to that
  place. Clicking empty globe clears the filter.
- A malformed payload never replaces a good snapshot.

### Feed state

`getStats()` maps the payload onto the existing feed-state classifier, so the
layer row shows the standard chips without new display code:

| Payload                              | Stats                                   | Chip          |
| ------------------------------------ | --------------------------------------- | ------------- |
| All sources ok                       | `count`, `lastUpdate: fetchedAt`        | nominal       |
| Some sources failed                  | plus `partial: true`                    | PARTIAL       |
| `stale: true`                        | plus `stale: true`                      | STALE         |
| 503, or fetch failed, no prior data  | `error`, `count: 0`                     | UNAVAILABLE   |
| Fetch failed, prior data held        | `error`, prior `count` and `lastUpdate` | DEGRADED      |

`source` reads, for example, `9 of 11 sources`.

### Share links

The layer is `enabled-only`. Its token is allocated with
`npm run layer-token:next -- news` and added to both `LAYER_STATE_REGISTRY`
and `layerStateTokenReservations.json`. Coranto's token ledger is its own. If
a later upstream merge assigns the same token to an upstream layer, Coranto's
allocation stands and the upstream layer is given the next free token in
Coranto's ledger.

## 8. News panel

### Files

```
src/ui/newsPanel.js               Adapter over createRailCards
src/ui/newsPanelModel.js          Pure view-model: filtering, sorting, text
src/ui/templates/context.html     Adds #news-panel to the right rail
```

The panel follows the "Adding a right-rail readout panel" recipe in
`docs/CODE-BOUNDARIES.md` and uses the panel-surface skin. Its ID is
registered in `panelChrome.js`, `panelLayoutController.js` and
`shellElements.js`. It is hidden while the news layer is off.

### Contents

Header, always visible while the layer is on:

- `9 of 11 sources live · fetched 3 min ago` with the absolute time as a
  tooltip. Expanding it lists every source with its state, its item count and,
  if down, the reason and the time of its last success.
- `47 items filtered out`, expanding to the per-reason counts.
- When `stale` is true: `Showing saved results from 14:02. No source is
  reachable right now.`

Filters: place (set by clicking the globe, cleared with a chip), category,
and publisher.

List: articles sorted newest first. Each card shows:

- the publisher's headline, unedited;
- the publisher name;
- the publish time, relative and absolute;
- the place with its precision and the reason, for example
  `Kyiv · city · matched "Kyiv" in headline`, or `No location`;
- the category as `auto-tag: military`, or nothing;
- the publisher's summary, when the feed provided one;
- one action: `Open at bbc.co.uk`, a new-tab link to `url` with
  `rel="noopener noreferrer"`.

Selecting a card whose story has a place focuses the globe on that place.

Empty states, each a single plain sentence:

| Situation                              | Text                                                                 |
| -------------------------------------- | -------------------------------------------------------------------- |
| First load in progress                 | `Fetching headlines from 11 sources.`                                |
| 503, nothing cached                    | `No news source is reachable. Nothing to show. Retrying in 60 s.`    |
| Filters match nothing                  | `No current stories match these filters.`                            |

There is no other content the panel can show. It has no built-in stories.

### First run and layer panel

- A `NEWS` group is added at the top of `PANEL_GROUPS` in
  `src/ui/layerPanel.js`, containing the news layer.
- A `World News` tile is added first in `FIRST_RUN_MISSIONS`. It enables the
  news layer and opens the panel at the whole-Earth view.
- `DATA_CREDITS` gains an entry naming the publishers and GDELT, and noting
  that headlines and summaries belong to their publishers.

## 9. Edits to upstream files

Kept to registration points. Each is a few lines.

- `server/providers/local.js`
- `src/app/constructCatalog.js`, `src/app/sourceComposition.js`
- `src/standalone/layerSources.js`
- `src/data/layerState.js`, `src/data/layerStateTokenReservations.json`
- `src/ui/layerPanel.js`
- `src/voice/layerManifest.js` (`VOICE_OFF_LAYERS`)
- `src/data/dataCredits.js`
- `src/firstRunExperience.js`
- `src/ui/templates/context.html`, `welcome.html`, `scene-chrome.html`,
  `hud-loading.html`
- `src/ui/panelChrome.js`, `src/ui/panelLayoutController.js`,
  `src/ui/shellElements.js`
- `index.html` (title; `icon_names` if a new glyph is used)
- `scripts/package-boundaries.json`, `scripts/format-scope.json`
- `package.json` (description; a `qa:news` script). The `name` field stays.
- Pinned-count tests: `constructCatalog.test.mjs`,
  `sourceComposition.test.mjs`, `layerState.test.mjs`,
  `layerStateTokenLedger.test.mjs`
- `DATA_SOURCES.md`, `docs/CURRENT-STATE.md`, `CHANGELOG.md`, `README.md`,
  `LICENSE`, `.env.example` (`NEWS_API_KEY`)

No query tool is added, so the pinned tool-count and tool-schema tests are
untouched.

## 10. Testing

Tests are `node:test` files named `*.test.mjs` under `src/`, with upstreams
replaced through the injected `fetchImpl` and clock. AUSPEX's Vitest tests for
the junk filter, geolocation and categories are ported to `node:test`.

### Unit tests

- **Records:** each drop rule, one test per reason; a valid item passes
  unchanged; a missing date is dropped and never replaced with the clock time.
- **RSS parsing:** RSS 2.0, Atom and RDF samples; CDATA; entity decoding;
  Atom `href` links.
- **Gazetteer:** city beats country; title beats summary; and regression cases
  for every AUSPEX mis-placement: "business" does not match US, "Russia" does
  not match US, "Amazon shares" matches nothing, "San Jose" matches nothing,
  lower-case "turkey" matches nothing, "U.S." matches United States.
- **Provider:** all sources ok; one source fails (others returned, failure
  listed with a fixed reason); all fail with a cache (200, `stale`, old
  `fetchedAt`); all fail with no cache (503, no articles); a zero-item source
  is reported as `empty`; non-GET is 405; concurrent requests make one
  upstream round.
- **Layer:** stats for each row of the feed-state table; a malformed payload
  keeps the previous snapshot; articles at one place produce one marker at the
  exact gazetteer coordinate.
- **Panel model:** every card carries the record's `url`, publisher and
  publish time; each empty-state text; filters.

### Honesty gates

Source-scanning tests that fail the build if the rules are broken later:

- No `Math.random` in `server/providers/news*`, `src/sources/news/`,
  `src/layers/news/` or `src/ui/newsPanel*`.
- No article-shaped object literal (an object with both `title` and `url`
  string literals) in any non-test file under those paths.
- The panel model has no code path that returns a card when given zero
  articles.

### Browser gate

`npm run qa:news` (`scripts/qa-news.mjs`, Puppeteer, dev server running)
intercepts `/api/news` in the browser and checks three cases: a healthy
payload renders markers and cards whose links equal the payload URLs; a
partial payload shows the down source by name; a 503 shows the unreachable
message and zero cards. Interception happens in the test browser only. The
runtime has no fixture mode.

### Existing gates

`npm run doctor`, `format:check`, `check:boundaries`, `npm test`,
`npm run build` and `npm run test:track` must all pass.

## 11. Acceptance criteria

1. `npm ci && npm run dev` on Node 24.14.0 opens an app titled Coranto with
   no key configured.
2. With the network up, the News panel lists real current headlines; opening
   any card's link reaches that article on the publisher's site.
3. Every card shows a publisher, a publish time and a link. No card exists
   without all three.
4. Every news marker sits on a gazetteer coordinate; two reloads place the
   same story at the same position.
5. With the network disconnected and `.gev-cache/news.json` removed, the panel
   shows the unreachable message and zero stories.
6. With one feed blocked, the header names that feed as down and the rest of
   the feed still shows.
7. All gates in section 10 pass.
8. Every God's Eye View layer present before the fork still enables and
   renders.

## 12. Risks

- **Feed terms.** RSS feeds are published for syndication and Coranto shows
  only headline, summary and link. Each source's terms are recorded in
  `DATA_SOURCES.md`; a source whose terms forbid this use is removed.
- **GDELT rate limits.** GDELT refused a single request on 2026-10-10. It is
  treated as a bonus source; the feed must be useful on RSS alone.
- **Source balance.** The ten RSS publishers are mostly Western and
  English-language. Stage 1 states this in the README. Stage 2's Divergence
  work adds a wider spread.
- **Place matching is inference.** Whole-word matching against 1,000 cities
  will still misplace some stories and miss many places. The match reason is
  shown on every card so a reader can see when it is wrong, and misplacements
  found in use become gazetteer tests.
- **Upstream drift.** God's Eye View changes quickly (its pull request
  numbers have passed 980). The registration-point edits in section 9 are the conflict surface
  on each merge.

## 13. Changes made during the build

- **Shell, not a rail panel.** The news panel was first built in the engine's
  right rail as section 8 describes. It was replaced by Coranto's own frame,
  modelled on AUSPEX: a header with a live badge and layer switches, a
  headline ticker, a topic list and a full-height feed
  (`src/ui/corantoShell.js`). The engine's panels are the INSTRUMENTS mode.
  Automated browsers default to INSTRUMENTS so the engine's browser gates run
  unchanged.
- **Good news tagging** from AUSPEX's breakthroughs sense was brought forward
  from stage 3 as an automatic tag and a filter.
- **Palette and type** from AUSPEX were brought forward from stage 4. Upstream
  cyan literals are retinted at build time by `build/corantoTheme.js`.
- **HUD readouts.** The engine's invented classification, mission, sensor,
  orbit and pass values were removed.
- **Share links.** The news layer is `local-only`, not `enabled-only`. A token
  from upstream's ledger would collide with the next upstream layer.
- **Voice.** The news layer can be switched by voice; the voice tool
  descriptions name the app Coranto.
- **Camera focus** uses a direct flight sized by match precision. The shared
  focus service frames only close-up targets.
- **Article ids** use a small built-in hash, so the record code has no Node
  dependency.
- **Feed parsing** lives in `src/sources/news/feeds.js` and the refresh logic
  in `src/sources/news/service.js`, both portable, not under `server/`.
- **US states** were added to place matching from the bundled Natural Earth
  data, at region precision.
- **More sources.** Sixteen feeds were added across Asia, Africa, the
  Americas, science and international bodies, each checked for dated items.
- **Feed search** narrows the feed to stories containing every word typed.
- **Natural hazards** from AUSPEX's GDACS and NASA EONET senses were added as
  a layer with the same rules: tracker link, start time, per-tracker health.
- **Not built:** the `qa:news` browser gate in section 10. The server route,
  layer, panel model and honesty rules are covered by unit tests.
