# Coranto handoff

For the next Claude Code session. Read this first, then `docs/coranto/TODO.md`
and the memory file the harness loads
(`~/.claude/projects/-Users-connorevans-Downloads-stay-informed/memory/coranto-working-agreements.md`).

Last updated 2026-10-14.

## What Coranto is

A fork of God's Eye View (CesiumJS engine, now the INSTRUMENTS tool) merged
with Connor's AUSPEX news product. An open-source, portfolio-grade tool to
stay informed with real, sourced news on a 3D globe. Slogan "Watch the world
back". Violet brand (`#b47cff`, gradient `#7c3aed → #e879f9`).

- Repo: `https://github.com/AllStreets/coranto`, branch `main`, local
  `/Users/connorevans/Downloads/stay_informed/coranto`.
- Live site: **https://coranto-production.up.railway.app** (Railway project
  `airy-healing`, environment `production`, service `coranto`).
- Database: Supabase project `coranto` (ref `tklsjoibqcwkgqthkcqr`, us-east-2,
  org AllStreets'). Tables `articles` (90-day headline archive, full-text
  search) and `ai_usage` (daily tokens per hashed visitor); RLS on, no
  policies; server-only via the service role key.

## How Connor wants work done (standing rules)

- Work autonomously; ask only questions of real importance. Commit and push
  to `main` after every major task.
- **Every status report ends with the same lists**: "Keys, only you can do",
  "Decisions", "Not built yet", "Known wobbles", and "For you to look at"
  when there is something to look at. He calls this important.
- **Everything is real.** No invented, sample, simulated or hardcoded content.
  Estimates are labelled ESTIMATED (launch ascent paths, partial replays).
- **Icons, never emojis or text glyphs.** Each icon relevant and unique; the
  shared set is `src/data/corantoIcons.js`.
- UI uniformity matters most; nothing should feel "vibe coded". Shared button
  language: mono capitals, cut top-right corner
  (`clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)`),
  a short violet bottom rule that runs full width on hover or when active;
  bracket-corner panels; violet focus rings and borders, never white; square
  corners. Green only where it means something (good news `#a8e05f`, climate
  `#34d17a`, ok `#3ddc84`); military red `#e23b3f`; INSTRUMENTS button blue
  `#4da3ff`; SAVE on the analyst board green `#30d158`.
- He hates empty space and wants symmetry; the default view must be the one
  that looks best.
- Every panel fits any window and scrolls inside itself; lists have visible
  scrollbars. Check new surfaces at about 780 px tall and at a narrow width.
- For a large multi-part request, have a subagent turn it into a to-do list
  first.
- Keys live only in the gitignored `coranto/.env`. Never print a key value
  (tool output included). `railway variables --json`: print names only.

## How to run and verify

Node 24.14.0: `source ~/.nvm/nvm.sh && nvm use 24.14.0`.

Servers:

- `:4173` — my dev server: `nohup npm run dev > /tmp/coranto-4173.log 2>&1 &`.
  If `qa:news` times out, Vite's "Outdated Optimize Dep" is usually the
  cause: restart it.
- `:4174` — **Connor's tab**:
  `nohup npx vite --port 4174 --strictPort > /tmp/coranto-4174.log 2>&1 &`.
  Restart it after every push.

Gates, reading each exit code directly (`; echo $?`), never by grepping the
output for "fail":

```
npm test                                    # look for lines starting ✖
npm run -s format:check >/dev/null 2>&1; echo $?
npm run -s check:boundaries >/dev/null 2>&1; echo $?
MAPILLARY_CLIENT_TOKEN='MLY|0|qa-fixture' npm run -s build >/dev/null 2>&1; echo $?
npm run -s qa:news; echo $?                 # against :4173
npm run -s qa:panel-resize; echo $?         # against :4173
MAPILLARY_CLIENT_TOKEN='MLY|0|qa-fixture' npx vite preview --port 4183 --strictPort &
npm run -s qa:street-level:fixtures -- --strict --url http://localhost:4183; echo $?
```

The street-level gate is flaky locally (about 1 in 3); retry up to three
times. It passes on CI.

Rules that bit before:

- Run prettier only on files you touched. Running it over all of `src/`
  reformats about 200 engine files and breaks pinned tests.
- A new Coranto module must be listed in `scripts/package-boundaries.json`
  wherever its neighbour is (for example next to `"src/ui/corantoAnalyst.js"`,
  twice).
- Unit tests run only under `src/`; server route tests live in
  `src/corantoServerRoutes.test.mjs`.
- `src/materialSymbolsSubset.test.mjs` flags lowercase string literals
  assigned to `textContent`; build such strings in a variable.
- New CSS for the shell goes before the final
  `@supports selector(::-webkit-scrollbar)` block in
  `src/ui/styles/coranto.css`; analyst board CSS is
  `src/ui/styles/corantoAnalyst.css` (classes `ca-`).
- After editing `corantoShell.js`, load the page before moving on (a
  use-before-declaration has broken startup twice).
- Browser checks: the shared Playwright MCP browser hangs; use the repo's
  puppeteer from a temporary `.probe.mjs` in the repo root (delete it after),
  launched with `--no-sandbox --use-gl=angle --use-angle=swiftshader
--ignore-gpu-blocklist`, `navigator.webdriver` overridden to false (the
  human frame), `coranto.welcomed.v1` set, and
  `browser.createBrowserContext()` per page. The viewer and layer manager are
  found by a deep search of `window.__gevVoiceCommands`.
- Commit with `git add -A . ':!docs/media/coranto/logo-option*.png'
':!docs/media/coranto/logo-purple-options.png'
':!docs/media/coranto/logo-options.png'` and end the message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Deploying (Railway)

- **Every push to `main` deploys to Railway automatically.** Build
  `npm run build`, start `npm run start`
  (`vite preview --host 0.0.0.0 --port $PORT`), health check
  `/api/coranto/health`; see `railway.json`.
- The Railway CLI in `coranto/` is logged in and linked. After a push:
  `RAILWAY_NO_TELEMETRY=1 railway deployment list` until the newest row says
  SUCCESS; `railway logs --build <id>` or `railway logs --deployment <id>`
  when it does not. Then check
  `curl -s https://coranto-production.up.railway.app/api/coranto/health`.
- CI: `gh run list -R AllStreets/coranto` (pass `-R`; without it `gh` reads
  the upstream repo).
- Public mode switches on from `RAILWAY_PUBLIC_DOMAIN` (or
  `CORANTO_PUBLIC_ORIGIN` for a custom domain). It: admits key-spending
  routes only from the site's own origin; counts visitors by `X-Real-IP` /
  last `X-Forwarded-For`; shares the 250,000-token daily AI allowance across
  the analyst tools, briefs and translation (`createAiBudget` in
  `server/providers/archive.js`); switches voice off (routes 404, no voice UI
  via `/coranto-env.js`); keeps key setup and `/mcp` unreachable.
- Railway variables set by Connor: `NEWS_API_KEY`, `FEC_API_KEY`,
  `AISSTREAM_API_KEY`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`,
  `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `CORANTO_VISITOR_SALT`. Do not add Google Maps or Cesium keys there: they
  are built into the page.
- Lessons: a deploy that started before the domain existed answers "Blocked
  request. This host is not allowed" (redeploy); a stray character in a
  variable name failed the build as "secret … not found".
- OpenSky refuses connections from Railway. The flights route then pauses
  OpenSky for 10 minutes and serves adsb.lol's whole world (one shared
  request, 15 s cache), falling back to 250 nm around the view from adsb.lol
  then adsb.fi (`server/providers/aircraft/opensky.js`).

## Where things stand (2026-10-14)

Recently shipped, newest first:

- **Flights no longer switch themselves on.** Cause: the engine saves layer
  choices in `localStorage['gev:layer-state:v2']` and restores them at load,
  but it saves only changes marked `origin: 'user' | 'voice' | 'tool'`.
  Coranto's header buttons, LAYERS list, search and AROUND HERE switched
  layers without an origin, so turning flights off there was never saved,
  while an earlier "on" from the control room or voice was, and it came back
  at every load as the aircraft data arrived. Coranto's switches now pass
  `{ origin: 'user' }`. Lens switches (Power, Votes) stay unsaved on purpose.
- Nuclear marks sit inside their countries (the atlas's label point), not
  beside a story marker; Headline activity is folded into Countries.
- Opening shot over Lake Michigan looking at Chicago, then out to the whole
  Earth once drawn; the keyhole shading lifts below 6,000 km in the news
  view; LIVE/LAYERS/SEARCH centred in the LAYERS-list header; Settings header
  cards aligned; LAYER BUTTONS is the default header.
- Worldwide aircraft on the live site via adsb.lol.
- Analyst exports are PDFs (`src/ui/corantoPdf.js`, a small writer of our own:
  dark pages, banners, cards, selectable text); EXPORT BRIEF holds the pins,
  the synthesis with historical context, and the consensus when it was run on
  the same pins.
- Public mode for Railway; voice off publicly; synthesis column in the
  shared look; Supabase archive and the daily AI cap.

Things Connor has confirmed he likes: the AUSPEX-style analyst board (TOP
SECRET stamps kept as decoration, noted in Settings, About), the layer-button
header, the Settings page look, the fixes listed above ("I love everything
else").

## Still open

### Keys, only Connor can do

- **Rotate the OpenAI key** (it was once printed in tool output) and confirm
  the one in Railway is the new one; set a monthly spending limit with
  OpenAI. Remind him until he confirms.
- Mapillary token (street-level photographs; public by design, safe on
  Railway).
- TomTom key (live road traffic).
- Optional: ReliefWeb app name and IPC key (official food-security data for
  the Relief lens).

### Decisions

- None waiting.

### Not built yet

- Restyling the insides of the Instruments (God's Eye View) panels to match
  Coranto's look.
- ReliefWeb and IPC data in the Relief lens (waits on the keys above).
- Synced analyst boards (they save in the browser today) and the regions
  overlay (a `regions` table is planned; see TODO.md).
- SILENCE (internet outages from IODA) is built but parked off the header.

### Known wobbles

- On the live site, one aircraft request every 10 minutes waits about 30 s
  while the server retries OpenSky; adsb.lol covers fewer aircraft than
  OpenSky in some regions.
- The street-level gate is flaky locally (about 1 in 3) and passes on CI.
- A stale dev-server cache can time out the browser gates until :4173 is
  restarted.
- Exported PDFs use the standard PDF fonts, so headlines in non-European
  scripts show as `?`.
- Headless browsers load map imagery slowly, so the opening shot cannot be
  judged there; check it in a real window.

### For Connor to look at

- The live site in a fresh private window: the Chicago opening.
- Switch FLIGHTS off from the header, reload: it should stay off.

## How to proceed

1. Read this file, `TODO.md`, and the memory file. Check `git log` and
   `railway deployment list` to confirm nothing changed since.
2. Ask nothing that is answered here. Take the next request, and for a large
   one make a to-do list with a subagent first.
3. After each piece of work: run the gates (exit codes), update `CHANGELOG.md`
   (and README/TODO when features change), commit, push, restart :4174, wait
   for Railway SUCCESS and CI, check the live site when the change touches it.
4. End the report with the lists above, updated.
