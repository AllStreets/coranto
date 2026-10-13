# Analyst board port plan: AUSPEX to Coranto

Written 2026-10-12 from a full read of `AUSPEX/js/analyst.js` (1669 lines) and its dependencies. Paths starting `js/`, `css/`, `api/`, `sql/` and `index.html` are in `/Users/connorevans/Downloads/AUSPEX`. Paths starting `src/`, `server/`, `scripts/` are in `/Users/connorevans/Downloads/stay_informed/coranto`.

Goal: replace Coranto's board (`src/ui/corantoBoard.js`, `src/ui/corantoBoardModel.js`) with AUSPEX's whole analyst board, including every model-written tool. The only visual change is green accent to violet (`#b47cff`, gradient `#7c3aed → #e879f9`).

## 0. Read this first

**What the board is.** One full-screen overlay with a 48 px bar and three columns (ASSET BOARD, ENTITY NETWORK, INTELLIGENCE BRIEF), plus five modals it opens (adversary playbook, red team, narrative timeline, escalation matrix, saved boards). `analyst.js` also holds two briefs that are opened from outside the board (daily brief, conflict brief) and share its model helper.

**There is no wargame in AUSPEX.** `grep -i wargame` finds only dead CSS (`css/auspex.css:485`, `:677-681`). No markup, no JS. The WARGAME section of the earlier study (`auspex-feature-study.md:499`) describes the predecessor Meridian, not AUSPEX. Nothing to port.

**Saved boards are not in a database in AUSPEX.** They are in `localStorage` only (`analyst.js:1559-1567`). The note in `TODO.md:176` ("saved analyst boards go in a database, as AUSPEX did") is wrong about AUSPEX.

**Things in this request that reverse earlier decisions. Confirm with the owner before building; the plan below assumes the new request wins.**

1. Earlier rule: port only AI tools whose output cites sources and passes a code check. Consensus, playbook, red team, daily brief and conflict brief are free prose with no citations and no check. Coranto's current model file says so in its header (`src/ui/corantoBoardModel.js:5-9`).
2. Earlier rule: no text glyphs, SVG icons only. AUSPEX's board text uses `◆ ▸ ⬡ ⏱ ◎ ⊞ ◈ ⊙ ⚔ $ ◎ ⚡ ▲ ▽ ✕ ×`. "Every word, only colour changes" keeps them.
3. Earlier rule: never ship invented content. The board prints fake classification banners (`TOP SECRET / NOFORN`, `TOP SECRET // SI // NOFORN`, `TOP SECRET // HCS-P // REL TO FVEY`) on output and exports.
4. The wordmark and export text say AUSPEX (`◆ AUSPEX ANALYST`, `◆ AUSPEX RED TEAM`, `AUSPEX INTELLIGENCE SYSTEM`, `AUSPEX INTELLIGENCE NETWORK`, file names `auspex-brief-…`). This plan assumes each `AUSPEX` becomes `CORANTO` and nothing else in the wording changes.

**Coranto features the AUSPEX board does not have.** A straight replacement drops them unless kept on purpose:

| Coranto today                                                                | AUSPEX                                    | Plan default                                |
| ---------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------- |
| Live board survives reload (`coranto.board.v1`)                              | In memory only                            | Keep (no visual effect)                     |
| `contact` pins (aircraft, ship, site)                                        | None                                      | Keep, shown as a geo asset card             |
| 3D network with rotate, node drag, hover (`corantoBoard.js:66-180, 300-600`) | 2D, wheel zoom, drag pan                  | Replace with AUSPEX's 2D graph              |
| Links through any shared capitalised name (`namesOf`)                        | Links only through `SHARED_ENTITIES`      | AUSPEX rule                                 |
| Whole-word matching in entities and matrix                                   | Substring match (`"ai"` matches `"said"`) | Keep whole-word (bug fix, no visual effect) |
| "Copy as text" button                                                        | None                                      | Drop                                        |
| Brief / Timeline / Matrix tabs in column 3                                   | No tabs; timeline and matrix are modals   | AUSPEX layout                               |
| 40-pin limit                                                                 | No limit                                  | Keep 40 (bounds prompt size)                |

---

## 1. Inventory

### 1.1 Controls in on-screen order

**Bar** (`index.html:256-279`), left to right:

| #   | Control                                        | Class / id                            | Calls                                       | Model           |
| --- | ---------------------------------------------- | ------------------------------------- | ------------------------------------------- | --------------- |
| 1   | Wordmark `◆ AUSPEX ANALYST`                    | `.am-wordmark`                        | none                                        | no              |
| 2   | Status line `SYSTEM READY · <n> ASSETS PINNED` | `#am-status`, inner `#am-asset-count` | written by many functions                   | no              |
| 3   | `SAVE`                                         | `.am-save-btn`                        | `saveAnalystBoard()`                        | no              |
| 4   | `EXPORT BRIEF`                                 | `.am-export-brief-btn`                | `exportBrief()`                             | no              |
| 5   | `SYNTHESIZE`                                   | `.am-synth-btn-bar`                   | `synthesizeBrief()`                         | no              |
| 6   | `CONSENSUS`                                    | `.am-consensus-btn`                   | `runConsensusBoard()`                       | yes, 8 requests |
| 7   | `TOOLS` (opens menu)                           | `#am-tools-btn` in `#am-tools-wrap`   | `toggleToolsMenu()`                         | no              |
| 7a  | `▸ ADVERSARY PLAYBOOK`                         | menu button                           | `generatePlaybook();toggleToolsMenu()`      | yes, 1          |
| 7b  | `⬡ RED TEAM`                                   | menu button                           | `openRedTeamBrief();toggleToolsMenu()`      | on GENERATE, 1  |
| 7c  | `⏱ NARRATIVE TIMELINE`                         | menu button                           | `openNarrativeTimeline();toggleToolsMenu()` | no              |
| 7d  | `◎ DEAD RECKONING` (toggle, gets `.on`)        | `#dr-tools-btn`                       | `toggleDeadReckoning()`                     | no              |
| 7e  | `⊞ ESCALATION MATRIX`                          | menu button                           | `openEscalationMatrix();toggleToolsMenu()`  | no              |
| 7f  | `◈ SAVED BOARDS`                               | menu button                           | `openSavedBoards();toggleToolsMenu()`       | no              |
| 8   | Separator                                      | `.am-bar-sep`                         | none                                        | no              |
| 9   | `CLEAR BOARD`                                  | `.am-act.danger`                      | `clearAssets()`                             | no              |
| 10  | `EXIT ANALYST`                                 | `.am-close-btn`                       | `closeAnalystMode()`                        | no              |

**Column 1, `◆ ASSET BOARD`** (`index.html:281-301`): meta `#am-col-meta` (`PIN STORIES FROM FEED` or `<n> ASSETS`); search input `#am-hist-input` placeholder `Search history (30 days)…`; select `#am-hist-cat` with options `ALL DOMAINS` (value ``), `GEO` (`geo`), `MIL` (`military`), `FIN` (`finance`), `CLM` (`climate`), `TECH` (`tech`); results `#am-hist-results` each with a `+ PIN` / `PINNED` button; list `#am-asset-scroll`; empty text `DRAG STORIES FROM THE INTELLIGENCE FEED<br>OR CLICK THE PIN ICON ON ANY CARD` (no drag handlers exist anywhere). Each card: category line with trajectory badge, title, meta row (`src`, `time`, `region`, `⏱` timeline button), `×` remove.

**Column 2, `◆ ENTITY NETWORK`** (`index.html:302-310`): meta `#am-net-meta` (`NO CONNECTIONS`, then `<n> NODES · <m> CONNECTIONS[ · CROSS-DOMAIN]`); `<canvas id="am-canvas">`; empty text `PIN ASSETS TO REVEAL<br>ENTITY CONNECTIONS`; button `⊙ RESET` (`#am-net-reset`, title `Reset view`).

**Column 3, `◆ INTELLIGENCE BRIEF`** (`index.html:311-322`): meta `#am-brief-meta` (`—`); scroll area `#am-brief-scroll`; empty text `PIN ASSETS AND CLICK SYNTHESIZE<br>TO GENERATE INTELLIGENCE BRIEF` with button `SYNTHESIZE NOW` (`.am-synth-btn`). Synthesis, consensus and the dead-reckoning board all render here. There are no tabs.

**Modals:**

| Modal                                                                      | Bar text and controls, in order                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playbook `#playbook-modal` (`index.html:420-429`)                          | `▸ ADVERSARY PLAYBOOK`; status `#pb-status` `READY · SELECT ASSETS AND GENERATE`; `GENERATE PLAYBOOK`; `EXPORT HTML` (`#pb-export-btn`, hidden until generated); `EXIT`. Body placeholder `PIN ASSETS TO ANALYST BOARD · THEN GENERATE PLAYBOOK`                                                                                                                              |
| Red team `#redteam-modal` (`index.html:481-494`)                           | `◆ AUSPEX RED TEAM`; status `#rt-status` `READY · SELECT ASSETS AND GENERATE`; `GENERATE BRIEF`; `EXPORT HTML` (`#rt-export-btn`, hidden until generated); `EXIT` (also reopens the board). Placeholder `PIN ASSETS TO ANALYST BOARD · THEN CLICK GENERATE BRIEF`                                                                                                             |
| Timeline `#timeline-modal` + `#timeline-bd` (`index.html:464-472`)         | `⏱ NARRATIVE TIMELINE`; status `#tl-status` `—`; `EXIT`. Right-hand drawer, 460 px. Backdrop click closes                                                                                                                                                                                                                                                                     |
| Matrix `#matrix-modal` + `#matrix-bd` (`index.html:442-461`)               | `⊞ CROSS-DOMAIN ESCALATION MATRIX`; `#mx-calc-ts` (`LAST RUN: <time>`); `RECALCULATE` (`#mx-recalc-btn`, shows `CALCULATING…`); `EXIT`; grid `#mx-content`; `#mx-story-panel`; legend `■ CRITICAL` `#FF2D55`, `■ HIGH` `#FF9F0A`, `■ ELEVATED` `#B7950B`, `■ LOW` `rgba(100,100,140,.55)`, note `· diagonal = within-domain intensity · off-diagonal = cross-domain coupling` |
| Saved boards `#sb-modal` + `#sb-bd` (`index.html:432-439`)                 | `◈ SAVED ANALYST BOARDS`; `EXIT`; list `#sb-body`; each row opens on click and has `✕ DELETE`                                                                                                                                                                                                                                                                                 |
| Daily / conflict brief `#brief-modal` + `#brief-bd` (`index.html:120-135`) | eyebrow `AUSPEX INTELLIGENCE NETWORK`; title `#bm-title` `DAILY SITUATION REPORT`; date `#bm-date`; `×`; body `#bm-body` (`ASSEMBLING BRIEF…`); footer meta `#bm-meta`; `EXPORT HTML`                                                                                                                                                                                         |

### 1.2 Functions, by feature (all in `js/analyst.js` unless noted)

**Open and close**

| Function                | Line | Does                                                                                                                  | Model |
| ----------------------- | ---- | --------------------------------------------------------------------------------------------------------------------- | ----- |
| `openAnalystMode()`     | 79   | Adds `.on` to `#analyst-overlay`, `renderAnalystBoard()`, then after 60 ms `resizeAnalystCanvas(); runAnalystGraph()` | no    |
| `closeAnalystMode()`    | 86   | Removes `.on`, cancels the animation frame                                                                            | no    |
| `updateAnalystStatus()` | 218  | Writes count to `#am-asset-count`, and `#am-col-meta` to `<n> ASSETS` or `PIN STORIES FROM FEED`                      | no    |
| `toggleToolsMenu()`     | 1104 | Toggles `.on` on menu and button; when open, a document click outside `#am-tools-wrap` closes it                      | no    |

**Pinning**

| Function                               | Line           | Does                                                                                                                                                                                               | Model |
| -------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `pinStory(id)`                         | 91             | Toggle. Adds id to `analystAssets`, marks every `[data-pin-id="<id>"]` button `.saved` with colour `#4ADE80`, re-renders board, re-runs graph if open                                              | no    |
| `unpinStory(id)`                       | 111            | Removes, re-renders                                                                                                                                                                                | no    |
| `pinGeoAsset(geoType, obj)`            | 137            | Toggle for `city`, `country`, `region`. Key `${geoType}:${obj.name                                                                                                                                 |       | obj.iso2}:${(obj.lat                                                                                                                                                                                                                                                                                                                         |     | 0).toFixed(1)}`. Builds the geo asset (see 4.1) into `_analystGeoMap` | no  |
| `_updateCtryNameColor(iso2, isPinned)` | 119            | Colours globe label `#ctry-nm-<iso2>` `#FF2D55` when pinned, `#4A8CA8` otherwise                                                                                                                   | no    |
| `_updateCityPinBtn(city, isPinned)`    | 124            | City panel button text `PINNED`/`PIN`, colour `#4ADE80`, border `#4ADE8066`                                                                                                                        | no    |
| `clearAssets()`                        | 191            | Resets globe marks, empties `analystAssets` and `_analystGeoMap`, restores status line and the brief column's empty state, sets meta `—`, clears feed pin buttons                                  | no    |
| `_resolveStory(id)`                    | 225            | Geo key (string containing `:` present in `_analystGeoMap`) → geo asset; else `NEWS.find` by id; else `sbGetHistStory(id)`                                                                         | no    |
| `renderAnalystBoard()`                 | 259            | Draws cards. Badge: geo → `<TYPE> ASSET`; story → category label, ` · BREAKING` when `brk`, ` · ARCHIVE` when `_hist`                                                                              | no    |
| `_computeTrajectory(s)`                | 1126           | Words longer than 4 chars from `s.region                                                                                                                                                           |       | s.title`; counts other `NEWS`items whose title+summary contains any.`>=4`→`{dir:'up', arrow:'▲', label:'Escalating — high regional activity'}`; `>=2`→`{dir:'mid', arrow:'—', label:'Active — moderate regional activity'}`; else `{dir:'down', arrow:'▽', label:'Quiet — low regional activity'}`. Badge title is `Activity trend: <label>` | no  |
| `traceArc(arc)`                        | 1183           | From a globe arc click (`refreshArcs` `:1097`): opens the board, pins both stories, status `◈ ARC TRACE — LINKED BY: <LABEL or ENTITY LINK>` in `#FF9F0A` for 4 s                                  | no    |
| `pinStoryFromArticle()`                | `js/ui.js:219` | Popup button: toggles pin, label `PINNED ✓` / `PIN TO ANALYST`                                                                                                                                     | no    |
| `_checkWatchlistAlerts()`              | 1168           | After each news refresh (`js/news.js:238`), if the board is open and watched ids are in `NEWS`: status `⚡ WATCHLIST — <n> MONITORED STORY/STORIES IN LIVE FEED` (class `.am-flash-alert`) for 6 s | no    |

**History search**

| Function                   | Line | Does                                                                                                                                                                                                                                                                                                                                                                                                                                              | Model |
| -------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `debounceHistSearch(val)`  | 10   | 400 ms debounce                                                                                                                                                                                                                                                                                                                                                                                                                                   | no    |
| `runHistSearch(query)`     | 15   | Hides results when query and category are both empty. Shows `SEARCHING ARCHIVE…`. Merges `sbSearchHistory({query, cat, days: 90, limit: 20})`, then up to 15 live `NEWS` matches, then up to 15 from the localStorage cache newest first; dedupes by title. Match is case-insensitive substring on title or summary, and category equal. Empty → `NO RESULTS FOUND`. Row meta: category label in its colour, `time`, ` · ARCHIVE` for remote rows | no    |
| `pinHistoricalStory(uuid)` | 71   | Pins an archive row and re-runs the search to refresh button states                                                                                                                                                                                                                                                                                                                                                                               | no    |

**Entity network**

| Function                          | Line | Does                                                        | Model |
| --------------------------------- | ---- | ----------------------------------------------------------- | ----- |
| `resizeAnalystCanvas()`           | 285  | Canvas size = parent `offsetWidth` × `offsetHeight`         | no    |
| `resetNetworkView()`              | 293  | `_netZoom = 1; _netPanX = 0; _netPanY = 0`                  | no    |
| `_initNetworkInteraction(canvas)` | 297  | Wheel: zoom ×0.9 or ×1.1, clamped 0.3 to 4. Mouse drag pans | no    |
| `runAnalystGraph()`               | 309  | See 3.4 for the exact constants                             | no    |

**Synthesis brief and export**

| Function                        | Line | Does                                                                                                                                                                                                                                                                                                                                | Model |
| ------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `synthesizeBrief()`             | 429  | Template brief, see 1.3                                                                                                                                                                                                                                                                                                             | no    |
| `_postProcessBriefConfidence()` | 1141 | For every `.am-brief-p`: words longer than 5 chars; counts `NEWS` items containing at least 3 of them. `>=4` → `H` `#30D158`; `>=2` → `M` `#FF9F0A`; else `L` `#566573`. Prepends `<span class="am-conf">` with border `<colour>33` and title `Confidence HIGH/MEDIUM/LOW — <n> corroborating sources`                              | no    |
| `exportBrief()`                 | 483  | Downloads `auspex-brief-${Date.now()}.html`: red banner `◆ AUSPEX INTELLIGENCE SYSTEM — <now>`, wordmark `◆ AUSPEX INTELLIGENCE BRIEF`, title `INTELLIGENCE BRIEF`, the meta text, an `INTELLIGENCE ASSETS (<n>)` table (category, title, `src · time`), then `BRIEF` and the brief column's current HTML. Inline CSS at `:500-512` | no    |

**Consensus**

| Item                         | Line | Does                                      | Model |
| ---------------------------- | ---- | ----------------------------------------- | ----- |
| `ANALYST_PERSONAS`           | 568  | Five personas, see 2.3                    | n/a   |
| `_buildAssetContext(pinned)` | 230  | The asset text every prompt uses, see 2.2 | no    |
| `runConsensusBoard()`        | 576  | Three rounds, see 2.3                     | yes   |

**Red team, playbook**

| Function                 | Line | Does                                                                                                                                                 | Model |
| ------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `openRedTeamBrief()`     | 749  | Closes the board, opens the red team modal. Does not generate                                                                                        | no    |
| `generateRedTeamBrief()` | 754  | See 2.4                                                                                                                                              | yes   |
| `exportRedTeamPDF()`     | 793  | Despite the name, downloads HTML `red-team-brief-${Date.now()}.html` wrapping `#rt-content`, banners `TOP SECRET // SI // NOFORN`. CSS at `:802-811` | no    |
| `generatePlaybook()`     | 1204 | Opens the modal and generates at once, see 2.5                                                                                                       | yes   |
| `exportPlaybook()`       | 1246 | Downloads `adversary-playbook-${Date.now()}.html`, banners `TOP SECRET // HCS-P // REL TO FVEY`. CSS at `:1250`                                      | no    |

**Narrative timeline**

| Function                         | Line | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Model                                                                                                                                                                   |
| -------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openNarrativeTimeline(assetId)` | 1482 | Opens drawer and backdrop, builds                                                                                                                                                                                                                                                                                                                                                                                                                                           | no                                                                                                                                                                      |
| `_buildTimeline(assetId)`        | 1488 | Subjects = the one asset if an id is given, else all pinned. No subjects → `PIN ASSETS TO ANALYST BOARD TO VIEW TIMELINE`. Keywords = unique lower-case words longer than 4 chars from `title + ' ' + region`, split on whitespace and commas, first 20. Pool = `NEWS` plus cache entries with a new title. Related = a subject itself, or title+summary containing at least 2 keywords; sorted by `_pub` descending; first 60. Status `<n> EVENTS · <focal title, 40 chars | N ASSETS>`. None → `NO RELATED EVENTS FOUND IN ARCHIVE`. Grouped by `toLocaleDateString([], {month:'short', day:'numeric', year:'numeric'})`, upper-cased, or `UNDATED` | no  |

**Escalation matrix**

| Function                      | Line | Does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Model |
| ----------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `openEscalationMatrix()`      | 1261 | Opens modal and backdrop, builds, stamps `LAST RUN: <time>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | no    |
| `recalculateMatrix()`         | 1270 | Button `CALCULATING…` and disabled for 80 ms, rebuild, restamp                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | no    |
| `buildEscalationMatrix()`     | 1282 | Rows and columns `geo, tech, military, finance, climate`, labels `GEO TECH MIL FIN CLM`. Keyword regexes at `:1286`. No pins → `PIN ASSETS TO ANALYST BOARD TO COMPUTE MATRIX`. Cell score = (`r===c` ? pinned-in-r × 2 : both have pins ? 3 : 0) + min(matching live stories, 6). A story matches when its title+summary matches row regex and (same cell or column regex). Keeps up to 20 matches per cell in `window._mxStoryMap`. Colour by `score/max`: `>0.7` `rgba(255,45,85,.82)` `CRIT`; `>0.4` `rgba(255,159,10,.72)` `HIGH`; `>0.15` `rgba(183,149,11,.45)` `ELEV`; else `rgba(80,90,120,.22)` `LOW`. Cell shows label and score, title `Click to view <R>×<C> stories`. Diagonal cells get `.mx-diag`. Panel hint `CLICK ANY CELL TO VIEW RELEVANT STORIES` | no    |
| `showMatrixStories(row, col)` | 1334 | Header `<R> × <C> — <n> RELEVANT STORY/STORIES`; empty `NO STORIES MATCHED THIS DOMAIN PAIR`; rows: 3-letter category, title (90 chars), source. Clicking a row runs `pinStory(id); closeMatrixStoryPanel()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | no    |
| `closeMatrixStoryPanel()`     | 1358 | Restores the hint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | no    |

**Dead reckoning**

| Function                                                    | Line        | Does                                                                                                                                                                                                                                                                                                                                                                                                                                           | Model |
| ----------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `toggleDeadReckoning()`                                     | 1369        | Flips `deadReckoningOn`, toggles `.on` on `#dr-tools-btn`, closes the menu. On: compute, glow, render board. Off: clear glows, remove `.dr-board`                                                                                                                                                                                                                                                                                              | no    |
| `_computeDeadReckoning()`                                   | 1385        | For each `_WORLD_COUNTRIES` name and iso2 longer than 3 chars, counts `NEWS` items whose text contains it. Ratio to max: `>0.5` `escalating`, `>0.2` `active`, else `stable`. Stored in `_drScores[iso]`                                                                                                                                                                                                                                       | no    |
| `_applyDeadReckoningGlows()` / `_clearDeadReckoningGlows()` | 1407 / 1414 | Set or remove `data-dr` on `.ctry-marker[data-iso]` (globe DOM labels)                                                                                                                                                                                                                                                                                                                                                                         | no    |
| `_renderDeadReckoningBoard()`                               | 1418        | Top 15 countries by mention count. Bar width = % of the top count. `>65` `#FF2D55` `ESCALATING`; `>35` `#FF9F0A` `ACTIVE`; else `#2ECC71` `STABLE`. Per-country domain counts `GEO: TEC: MIL: FIN: CLM:` using the regexes at `:1425`. Header `◎ DEAD RECKONING · NEWS MENTION HEAT · <time>`; sub `Ranked by news signal density across live feed — click country to filter globe` (no click handler exists). Prepended to `#am-brief-scroll` | no    |

**Saved boards**

| Function                                     | Line        | Does                                                                                                                                                                                             | Model |
| -------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `_loadSavedBoards()` / `_writeSavedBoards()` | 1561 / 1565 | Read and write localStorage `AUSPEX_SAVED_BOARDS`                                                                                                                                                | no    |
| `_generateBoardTitle(stories)`               | 1569        | Up to 3 unique `region                                                                                                                                                                           |       | src`joined` · `; else up to 2 category labels joined ` + `plus` ANALYSIS`; else first title, 40 chars, upper case; empty → `UNTITLED BOARD` | no  |
| `saveAnalystBoard()`                         | 1578        | Empty → status `NO ASSETS PINNED — NOTHING TO SAVE` for 2.5 s. Else unshift a board (shape in 4.2), cap 50, status `BOARD SAVED · "<title>"` for 3 s                                             | no    |
| `openSavedBoards()` / `closeSavedBoards()`   | 1606 / 1612 | Modal and backdrop                                                                                                                                                                               | no    |
| `_renderSavedBoardsList()`                   | 1617        | Empty → `NO SAVED BOARDS YET<br>PIN ASSETS AND USE ⊙ SAVE BOARD`. Row: title, `<date> · <n> ASSETS`, first 3 titles (70 chars, prefixed `· `), `✕ DELETE`                                        | no    |
| `loadSavedBoard(id)`                         | 1639        | Per stored story: match live `NEWS` by first 60 title chars; else existing `_histMap[id]`; else inject as `saved_<_key>` with `_hist: true`. Replaces `analystAssets`, closes modal, opens board | no    |
| `deleteSavedBoard(id)`                       | 1665        | Removes, re-renders list                                                                                                                                                                         | no    |

**Model helper and the two outside briefs**

| Function                                 | Line | Does                                                                                                                                                               | Model |
| ---------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `callOpenAI(sys, user, maxTokens = 420)` | 533  | See 2.1                                                                                                                                                            | yes   |
| `openDailyBrief()`                       | 827  | Opened by the command panel `BRIEF` button (`index.html:98`), not the board. See 2.6                                                                               | yes   |
| `closeDailyBrief()`                      | 852  | Closes modal and backdrop                                                                                                                                          | no    |
| `exportDailyBrief()`                     | 857  | Downloads `auspex-<slug>-<YYYY-MM-DD>.html`, light serif page, masthead `AUSPEX Intelligence Network`, footer `Generated by AUSPEX · <date>`. CSS inline at `:862` | no    |
| `openConflictBrief(country)`             | 873  | Opened by a country marker's conflict triangle (`js/globe.js:403`). See 2.7                                                                                        | yes   |

**In `analyst.js` but not the board** (do not port with it): `toggleMapKey` 907, `buildMapKey` 914 (its `ANALYST TOOLS` legend rows are at `:967-977`), `refreshArcs` 1074 (only its `onArcClick → traceArc` hook matters).

### 1.3 `synthesizeBrief` output, exactly

Computed first (`:434-440`): `cats` = unique `cat`; `regions` = unique non-empty `region`; `entities` = `SHARED_ENTITIES` terms that any pin's title+summary contains (case-insensitive substring); `brkCount`; `now = new Date().toLocaleString([], {dateStyle:'medium', timeStyle:'short'})`.

1. Loading: `<div class="am-classify">TOP SECRET / NOFORN · ${now}</div>` and `FETCHING HISTORICAL CONTEXT…`.
2. `histStories = sbFetchRelatedHistory(pinned, 8)` raced against a 5 s timeout that yields `[]`.
3. Sections, each `.am-brief-sec` with header `.am-brief-sh`:
   - `EXECUTIVE SUMMARY`: `Analysis of ${n} intelligence asset(s) spanning ${cats} domain(s) and ${regions} operational region(s). [<strong style="color:#FF2D55">${brk} BREAKING</strong> development(s) flagged for immediate attention.] Cross-domain analysis indicates ${entities.length > 4 ? 'elevated' : 'moderate'} global activity.[ <span style="color:#8A93C8;font-size:.9em">${hist} related historical developments found.</span>]`
   - `KEY ENTITIES`: `.am-ent.hi` chip per entity, then `.am-ent` chip per region.
   - `ASSET SUMMARIES`: per pin, a `.am-brief-p` with a mono line `${label} · ${src}[ · ARCHIVE]` in the pin's colour, then `summary || title`.
   - `HISTORICAL CONTEXT <span>(LAST 30 DAYS)</span>`: only when history came back; per row `${label} · ${src} · ${time}` then title, opacity .75.
   - `DOMAINS`: `.am-ent.hi` chip per category, border `<colour>44`, text in the category colour.
4. Meta `#am-brief-meta` = `${n} ASSETS · ${now}`. Then `_postProcessBriefConfidence()`.

### 1.4 AUSPEX quirks to know before copying

- `region` on a live story is the outlet name, not a place (`js/news.js:172`: `region: srcName || 'Global'`). So "operational regions", trajectory, timeline keywords and board titles all run on outlet names. See 5.
- Search placeholder says 30 days; the query asks for 90.
- `runAnalystGraph()` resets zoom and pan on every pin change. `analystGraph` (`config.js:145`) is never used.
- Edge label colour for same-category links is cyan `rgba(0,160,200,.75)` while the line is green.
- The trajectory badge `▲` is red (`css:1007`), but the map key calls it green (`analyst.js:970`).
- Playbook header test `/^[A-Z][A-Z\s\-\/]+:/` does not match `PREDICTED MOVES (30/60/90 DAY):` (digits and brackets), so that header renders as a paragraph.
- Running SYNTHESIZE or CONSENSUS overwrites the column and removes the dead-reckoning board while `deadReckoningOn` stays true.
- A saved board stores geo assets as plain story rows; on load they come back as `ARCHIVE` cards, not geo assets. `loadSavedBoard` does not clear `_analystGeoMap`.
- Everything is injected with `innerHTML` and no escaping: feed titles, model text, and in the daily and conflict briefs raw model HTML. Coranto must not copy that (see to-do 6 and 15).
- Consensus round 1 parses with `text.match(/\{[\s\S]*?\}/)` (first `{` to first `}`), which works only because the object is flat.

---

## 2. AI calls

`analyst.js` has **8 call sites**. Six are on the board (consensus ×4 templates, red team, playbook); two are outside it (daily brief, conflict brief). One CONSENSUS run sends **8 requests** (5 in parallel, then 3 in sequence).

### 2.1 How AUSPEX reaches the model

`callOpenAI(sys, user, maxTokens = 420)`, `analyst.js:533-564`. Model: `AI_MODEL = 'gpt-5.4-mini'` (`config.js:44`). Client timeout: 55 000 ms when `maxTokens > 800`, else 30 000 ms. Returns a plain string.

Path A, local dev with a browser key (`OPENAI_KEY` from `js/keys.local.js`):

```
POST https://api.openai.com/v1/chat/completions
Content-Type: application/json
Authorization: Bearer <OPENAI_KEY>

{"model":"gpt-5.4-mini","max_completion_tokens":<maxTokens>,"temperature":0.7,
 "messages":[{"role":"system","content":<sys>},{"role":"user","content":<user>}]}
```

Result: `d.choices?.[0]?.message?.content || ''`. `d.error` → throws `d.error.message`.

Path B, production (`aiEnabled()` true, no browser key): `AI_PROXY_URL = ${WORKER_BASE||''}/api/ai` (`config.js:45`).

```
POST /api/ai
Content-Type: application/json

{"system":<sys>,"user":<user>,"maxTokens":<n>,"model":"gpt-5.4-mini"}
```

Result: `d.content || ''`. `!res.ok || d.error` → throws `d.error || 'AI proxy error'`. When AI is off the helper throws `API_KEY_MISSING`.

The proxy, `api/ai.mjs` (153 lines, Vercel function):

- CORS: `Access-Control-Allow-Origin: ${ALLOWED_ORIGIN || '*'}`, methods `POST, OPTIONS`, header `Content-Type`, exposes `X-AI-Tokens-Used, X-AI-Tokens-Limit`. `OPTIONS` → 204. Non-POST → 405 `{error:'Method not allowed'}`.
- Key: `process.env.AUSPEX_LLM_KEY || process.env.OPENAI_KEY`. Missing → 503 `{error:'AI not configured'}`.
- Cost guard: visitor key = first 40 hex of `sha256(ip + ':' + (IP_HASH_SALT || 'auspex'))`, ip from `x-real-ip` or first `x-forwarded-for`. Calls Supabase RPC `ai_usage_add {p_ip_hash, p_tokens}` (0 = read). Limit `AI_DAILY_TOKEN_LIMIT`, default 1 000 000 per UTC day. Over → 429 with `Retry-After: 86400` and `{error, tokensUsed, tokensLimit}`. If the RPC fails the proxy serves the request anyway.
- Body: accepts object, string or Buffer. Bad JSON → 400 `{error:'Invalid JSON body'}`. Defaults: `model` `gpt-5.4-mini`, `maxTokens` 420.
- Upstream: the same chat-completions body as path A, `AbortSignal.timeout(55000)`.
- Upstream error → 502 `{error: <message>}`. Success → 200 `{content}`, then adds `usage.total_tokens` (or an estimate) to the visitor's total.

### 2.2 The asset context string

`_buildAssetContext(pinned)` (`:230-257`), one line per pin, joined with `\n`:

- City: `[GEO/CITY] ${name}, ${country} — Type: ${ICON_TYPE} · Coords: ${lat.toFixed(2)}, ${lng.toFixed(2)} · Strategic tier: ${tier||'—'}[ · ${notes}]`
- Country: `[GEO/COUNTRY] ${name} — ${attrs||'Standard nation-state'} · GDP: ${'$'+gdp+'B' or '—'} · Mil spend: ${'$'+mil+'B' or '—'} · Strategic tier: ${tier||'—'}` where `attrs` is a comma list from `NUCLEAR ARMED`, `UN P5`, `ACTIVE CONFLICT`, `SANCTIONED`, `NATO`.
- Story: `[${LABEL}] ${title}: ${summary||''}` with `LABEL` = `GEO`, `MIL`, `FIN`, `CLM`, `TECH`.

Used by consensus and red team. The playbook builds its own (2.5).

### 2.3 Consensus (`runConsensusBoard`, `:576-745`)

Personas (`:568-574`), in this order:

| id         | name               | colour    | icon | spec                                                                                                                |
| ---------- | ------------------ | --------- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| military   | MILITARY ANALYST   | `#FF9F0A` | `⚔`  | military strategy, force deployment, escalation ladders, weapons systems, order-of-battle analysis                  |
| economic   | ECONOMIC ANALYST   | `#FFD60A` | `$`  | financial markets, trade flows, sanctions impact, currency dynamics, commodity markets, economic coercion           |
| cyber      | CYBER ANALYST      | `#0A84FF` | `⬡`  | information warfare, critical infrastructure vulnerabilities, state-actor TTPs, SIGINT, disinformation operations   |
| diplomatic | DIPLOMATIC ANALYST | `#30D158` | `◎`  | geopolitical relationships, treaty obligations, diplomatic signaling, multilateral institutions, coalition dynamics |
| energy     | ENERGY ANALYST     | `#FF2D55` | `⚡` | energy security, pipeline dependencies, oil and gas supply disruption, resource competition, commodity flows        |

No pins → column shows `PIN AT LEAST ONE STORY TO THE ASSET BOARD<br>THEN CLICK ◆ CONSENSUS`.

**Round 1: five calls in parallel, `maxTokens` 220.** Status `ROUND 1 · 5 SPECIALIST ANALYSTS ASSESSING IN PARALLEL…`.

System:

```
You are a ${a.spec} analyst at a top-tier intelligence organization. Be direct, specific, analytical. Respond ONLY in JSON.
```

User:

```
Review these intelligence assets from your domain perspective:

${context}

Based ONLY on the content above, respond with ONLY valid JSON (no extra text, no markdown):
{"assessment":"2-3 sentence domain-specific analysis of these specific assets","escalation":INTEGER_0_TO_100,"keyFactor":"the single most critical variable you track in this situation","blindspot":"what the other analysts are likely missing that you can see","confidence":INTEGER_0_TO_100}

Escalation scoring guide: 0-20=de-escalating, 21-40=stable, 41-60=moderate tension, 61-80=elevated risk, 81-100=crisis imminent. Base your score strictly on the evidence in the assets, not on persona defaults.
```

Expected JSON: `{assessment: string, escalation: 0-100, keyFactor: string, blindspot: string, confidence: 0-100}`. `confidence` is never shown. Parse: `JSON.parse(text.match(/\{[\s\S]*?\}/)?.[0] || '{}')`, merged over the persona with `ok: true`. Parse failure → `{assessment:'Parse error.', escalation:50, ok:false}`. Call failure → `{assessment:'API unavailable.', escalation:50, ok:false}`.

Rendering. Before the calls the column gets:

- `<div class="am-classify" style="margin-bottom:0">◆ AGENTIC CONSENSUS BOARD · ${new Date().toLocaleString()}</div>`
- `.cb-stats` with three `.cb-stat` tiles (`—%` ESCALATION, `—%` AGREEMENT, `—pt` DIVERGENCE, value colour `#3C4470`)
- `<div class="cb-round-hdr"><em>ROUND 1</em> — INDEPENDENT SPECIALIST ANALYSIS</div>`
- `#cb-bar-wrap` with five `.cb-analyst.cb-anim` cards (`--ac` = persona colour): `.cb-name` (icon in `.cb-icon`, name) and `.cb-loading.rt-loading-anim` `ANALYZING…`
- empty `#cb-round2-zone`, `#cb-round3-zone`

As each call returns its card becomes: name row; `.cb-track` with `.cb-fill` (width `esc%`) and `.cb-pct` (`esc%`); `.cb-text` assessment; `<span class="cb-tag">KEY: ${keyFactor}</span>`; `<span class="cb-tag cb-blind">BLIND SPOT: ${blindspot}</span>`. `esc = +escalation || 50`. Colour: `>65` `#FF2D55`, `>40` `#FF9F0A`, else `#30D158`.

Stats after all five: `mean` = rounded mean; `spread` = max − min; `stdDev` population; `agr = max(0, round(100 − stdDev × 2.5))`. Tiles: `${mean}%` (same three-colour rule), `${agr}%` (`#FF9F0A` below 40, else `#30D158`), `${spread}pt`.

**Round 2: two calls in sequence, `maxTokens` 120 each.** `hawk` = highest escalation, `dove` = lowest (stable sort ascending; last and first). Status `ROUND 2 · CROSS-EXAMINATION: ${hawk.name} vs ${dove.name}`.

Hawk system:

```
You are ${hawk.name}, a ${hawk.spec} analyst. You just read another analyst's assessment and strongly disagree with their low threat estimation. Be direct, specific, and pointed. 1-2 sentences maximum.
```

Hawk user:

```
Your assessment: "${hawk.assessment}" (escalation: ${hawk.escalation}%)

The ${dove.name} says: "${dove.assessment}" (escalation: ${dove.escalation}%)

Write your pointed challenge to their analysis — what critical threat factor are they ignoring?
```

Dove system:

```
You are ${dove.name}, a ${dove.spec} analyst. Respond to a pointed challenge from a more hawkish colleague. Defend your assessment with specific evidence they may be discounting. 1-2 sentences maximum.
```

Dove user:

```
Your assessment: "${dove.assessment}" (escalation: ${dove.escalation}%)

The ${hawk.name} challenges: "${hawkChallenge}"

Write your rebuttal — what stabilizing factors or alternative interpretation justifies your lower threat assessment?
```

Both return plain text. On failure the text is `[API error]`.

Rendering in `#cb-round2-zone`: header `<em>ROUND 2</em> — CROSS-EXAMINATION · <hawk icon and name in its colour> vs <dove icon and name in its colour>` (the `vs` at opacity .4); `#cb-debate-msgs.cb-debate-section` with `.cb-debate-msg.attacker` (`--ac-a` = hawk colour; `.cb-debate-who` `${icon} ${name} · CHALLENGING`; body placeholder `Formulating challenge…`), then `.cb-debate-msg.defender` (`--ac-d` = dove colour; who `${icon} ${name} · REBUTTAL`; body `#cb-dove-rebuttal`, placeholder `Formulating rebuttal…`). Replies are set with `textContent`.

**Round 3: one call, `maxTokens` 700.** Status `ROUND 3 · SENIOR ANALYST SYNTHESIZING ALL PERSPECTIVES…`.

System:

```
You are the Senior Intelligence Analyst synthesizing a panel of 5 specialist analysts who reviewed the same situation independently and then cross-examined each other. Write a consolidated brief in IC style — direct, unhedged, actionable. 3-4 short paragraphs.
```

User (`analystSummaries` is one line per analyst: `${icon} ${name} (${escalation}% escalation): ${assessment} | KEY: ${keyFactor||'—'} | BLIND SPOT: ${blindspot||'—'}`):

```
INTELLIGENCE ASSETS REVIEWED:
${context}

SPECIALIST ASSESSMENTS:
${analystSummaries}

CROSS-EXAMINATION:
${hawk.name} challenged: "${hawkChallenge}"
${dove.name} rebutted: "${doveRebuttal}"

Write the consolidated brief covering: (1) key findings where analysts agree, (2) the most significant divergence and what it means for decision-makers, (3) the single highest-priority action indicator to watch, (4) overall threat trajectory.
```

Plain text. Failure text: `Synthesis unavailable — check API key.`

Rendering in `#cb-round3-zone`: header `<em>ROUND 3</em> — SENIOR ANALYST SYNTHESIS`; `.cb-synthesis-section > .cb-synthesis-card` with `.cb-synthesis-hdr` `◆ CONSOLIDATED INTELLIGENCE BRIEF` and `#cb-synthesis-body` (placeholder `Synthesizing 5 specialist assessments and cross-examination findings…`). The reply is split on newlines; each non-empty line becomes `<p style="margin-bottom:10px">`.

Finish: status `◆ CONSENSUS COMPLETE · 3 ROUNDS · ${ok}/5 ANALYSTS · ${new Date().toLocaleString()}`; meta `5 ANALYSTS + CROSS-EXAM + SYNTHESIS · ${new Date().toLocaleString()}`.

### 2.4 Red team (`generateRedTeamBrief`, `:754-791`)

One call, `maxTokens` 2200 (55 s client timeout). No pins → status `PIN ASSETS TO ANALYST BOARD FIRST`. While running: status `GENERATING ADVERSARIAL ASSESSMENT…`, body `ADVERSARY PERSPECTIVE LOADING…` (`.rt-loading.rt-loading-anim`), export hidden.

System:

```
You are generating an adversarial intelligence assessment from a rival state actor perspective, analyzing Western/US vulnerabilities and opportunities. Use intelligence community style writing. Be credible and specific.
```

User:

```
Generate a structured intelligence assessment from an adversarial perspective for these developments:

${context}

Format your response with these labeled sections (write 3-5 specific points under each section):
SITUATION ASSESSMENT:
IDENTIFIED VULNERABILITIES:
EXPLOITATION VECTORS:
STRATEGIC OPPORTUNITY WINDOW:
COUNTERMEASURE GAPS:
RECOMMENDED ACTIONS:
```

Plain text with six labelled sections. Stored in `window._rtBriefText`. Status `ADVERSARIAL BRIEF GENERATED`; export button shown.

Rendering in `#rt-content`:

- `<div class="rt-classify">TOP SECRET // SI // NOFORN</div>`
- `<div class="rt-heading">ADVERSARIAL OPPORTUNITY ASSESSMENT</div>`
- `<div class="rt-date">PREPARED: ${now} · AUSPEX INTELLIGENCE SYSTEM · NOT FOR DISTRIBUTION</div>`
- each non-empty line: if it matches `/^[A-Z\s]+:$/` a header `div` with inline style `font-family:var(--f-mono);font-size:8.5px;letter-spacing:.2em;color:rgba(255,100,100,.8);margin:16px 24px 4px;padding-top:12px;border-top:1px solid rgba(255,23,68,.2)`; otherwise `<p class="rt-para">`
- closing `.rt-classify` with `margin-top:20px`

Failure: status `GENERATION FAILED — CHECK API KEY`; body `ERROR: ${message}` in `rgba(255,45,85,.5)`.

### 2.5 Adversary playbook (`generatePlaybook`, `:1204-1244`)

One call, `maxTokens` 1600. No pins → status `PIN ASSETS TO ANALYST BOARD FIRST`, body `NO ASSETS PINNED`. While running: status `GENERATING ADVERSARY PLAYBOOK…`, body `ANALYZING ADVERSARY PATTERNS…` (`.pb-loading.pb-loading-anim`).

Inputs: `actors` = unique non-empty `s._geoObj?.name || s.region || ''`; `context` = one line per pin `[${(cat||'geo').toUpperCase()}] ${title}${summary ? ' — ' + summary : ''}` (raw category id, not the label).

System:

```
You are a senior intelligence officer writing a classified Adversary Playbook — an actor-centric strategic assessment. Write in terse, authoritative intelligence prose. Use ALL-CAPS section headers followed by colons. No disclaimers. No hedging. Write as if for cleared decision-makers.
```

User:

```
Generate an ADVERSARY PLAYBOOK for these pinned intelligence assets.

ACTORS: ${actors.length ? actors.join(', ') : 'Unknown'}

CURRENT INTELLIGENCE:
${context}

Sections:
BEHAVIORAL PATTERNS:
STRATEGIC INTERESTS:
PREDICTED MOVES (30/60/90 DAY):
PRESSURE POINTS:
COUNTER-STRATEGY:
RED FLAGS:
```

Plain text. Stored in `window._pbBriefText`. Status `PLAYBOOK GENERATED`.

Rendering in `#pb-content`: `.pb-classify` `TOP SECRET // HCS-P // REL TO FVEY`; `.pb-heading` `ADVERSARY PLAYBOOK`; `.pb-date` `PREPARED: ${now} · AUSPEX INTELLIGENCE SYSTEM · NOT FOR DISTRIBUTION`; each non-empty line: `/^[A-Z][A-Z\s\-\/]+:/` → `<div class="pb-sec-hdr">`, else `<p class="pb-para">`; closing `.pb-classify` with `margin-top:20px`. Failure: status `GENERATION FAILED — CHECK API KEY`; body `ERROR: ${message}` in `rgba(48,209,88,.4)`.

### 2.6 Daily brief (`openDailyBrief`, `:827-850`), outside the board

One call, `maxTokens` 2500. Input: `NEWS.slice(0, 14)`. Title `DAILY SITUATION REPORT`; date `now.toUTCString().toUpperCase()` with `GMT` → `UTC`; loading `ASSEMBLING BRIEF…`.

System:

```
You are a senior intelligence analyst writing a daily situation report. Write in clear, authoritative analytical prose. Format with HTML: use <h3> for exactly three section headers (EXECUTIVE SUMMARY, KEY DEVELOPMENTS, STRATEGIC IMPLICATIONS), use <p> for paragraphs. Do not use classification markings, "TOP SECRET", or document stamps. Be direct and substantive.
```

User (one line per story: `[${CAT}] ${title} (${src})${summary ? ' — ' + summary : ''}`):

```
Today is ${now.toDateString()}. Write a daily situation report covering the most significant geopolitical, military, economic, and technology developments based on these current stories:

${lines}
```

Returns HTML (`<h3>`, `<p>`), written straight into `#bm-body`. Meta `${n} SOURCES · GENERATED ${time}`. Failure: `<p class="bm-error">ERROR: ${message}</p>`. Not cached.

### 2.7 Conflict brief (`openConflictBrief`, `:873-906`), outside the board

One call, `maxTokens` 1500. Input: up to 14 `NEWS` items that are `military`, `geo` or breaking and whose title+region+summary contains the country name. Title `${NAME} — CONFLICT BRIEF`; loading `ASSESSING CONFLICT…`.

System:

```
You are a senior conflict-intelligence analyst. Write an authoritative, current situation brief on the active conflict involving or affecting the named country. Format as HTML: use <h3> for exactly three section headers (SITUATION, ACTORS & DRIVERS, OUTLOOK), and <p> for paragraphs. No classification markings or document stamps. Ground every claim in the supplied headlines; where coverage is thin, say so plainly rather than inventing detail. Be concise, specific, and analytically sharp.
```

User (line format `[${CAT}${brk ? '/BREAKING' : ''}] ${title} (${src})${summary ? ' — ' + summary : ''}`; when no lines, the text `No direct current coverage in the feed — assess from general standing and note the coverage gap.`):

```
Country in focus: ${name}. Today is ${now.toDateString()}. Write a live conflict brief grounded in these current headlines:

${lines}
```

Returns HTML. Meta `${n} LIVE SOURCE(S) · ${NAME} · GENERATED ${time}`. Failure: `BRIEF UNAVAILABLE — ADD OPENAI KEY` when the error is `API_KEY_MISSING`, else `BRIEF UNAVAILABLE — ${message}`.

### 2.8 Summary table

| Call                     | Line | maxTokens | Returns          | Requests   |
| ------------------------ | ---- | --------- | ---------------- | ---------- |
| Consensus round 1        | 609  | 220       | JSON object      | 5 parallel |
| Consensus hawk challenge | 679  | 120       | text             | 1          |
| Consensus dove rebuttal  | 702  | 120       | text             | 1          |
| Consensus synthesis      | 730  | 700       | text             | 1          |
| Red team                 | 767  | 2200      | text, 6 sections | 1          |
| Playbook                 | 1226 | 1600      | text, 6 sections | 1          |
| Daily brief              | 843  | 2500      | HTML             | 1          |
| Conflict brief           | 899  | 1500      | HTML             | 1          |

All use model `gpt-5.4-mini`, temperature 0.7, one system and one user message. No streaming, no tools, no JSON mode, no caching, no retry.

### 2.9 What Coranto's server can reuse (`server/providers/news.js`)

| Existing piece                                                                                                                 | Where                                                     | Reuse                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `briefKey = () => process.env.OPENAI_API_KEY ?? ''`                                                                            | `:79`                                                     | Yes: same key and the same injectable option for tests                                                                                                                                                          |
| `briefFetch` option                                                                                                            | `:78`                                                     | Yes: inject a fake fetch in tests                                                                                                                                                                               |
| `gateBrief` option and `sameSiteGated(handler)`                                                                                | `:80`, `:402-405`, `server/providers/common/same-site.js` | Yes: refuses cross-site callers. AUSPEX's `Access-Control-Allow-Origin: *` must not be copied                                                                                                                   |
| `enforceRateLimit(openAiRateLimiter(), req, res)`                                                                              | `:168`, `server/providers/openai/rate-limit.js`           | Yes. Default 30 requests per minute per IP (`GEV_RATELIMIT_OPENAI_PER_MIN`). One consensus run is 8 requests, so about 3 runs a minute. It replaces AUSPEX's Supabase daily token cap, so no database is needed |
| `readRequestBody(req, cap)`                                                                                                    | `server/providers/common/request.js`                      | Yes, with a larger cap (prompts hold up to 40 pins: use 64 KB)                                                                                                                                                  |
| `json(status, value)` helper pattern, `Cache-Control: no-store`                                                                | `:156-162`                                                | Yes                                                                                                                                                                                                             |
| Registration in `configureServer` and `configurePreviewServer`                                                                 | `:411-420`; plugin list `server/providers/local.js:71`    | Yes                                                                                                                                                                                                             |
| Route test harness `callRoute`                                                                                                 | `src/layers/news/news.test.mjs:397`                       | Yes, copy the pattern                                                                                                                                                                                           |
| `openAiText(data)`                                                                                                             | `:37-45`                                                  | Only if the route uses the Responses API. It reads `output_text`; chat-completions replies are `choices[0].message.content`                                                                                     |
| `briefHandler` body: `instructions`, `input`, `reasoning: {effort:'minimal'}`, `max_output_tokens: 2000`, strict `json_schema` | `:224-250`                                                | No. Different API shape; AUSPEX's prompts are free text with their own token limits                                                                                                                             |
| `BRIEF_SCHEMA`, `checkBrief`, `briefSources`, brief cache                                                                      | `src/sources/news/brief.js`, `:205-213`                   | No. These exist to check claims against sources; AUSPEX's tools have no sources to check and no cache                                                                                                           |
| Model `CORANTO_BRIEF_MODEL                                                                                                     |                                                           | OPENAI_HUD_SUMMARY_MODEL                                                                                                                                                                                        |     | 'gpt-5-nano'` | `:214-217` | No. Add `CORANTO_ANALYST_MODEL`, default `gpt-5.4-mini` as in AUSPEX |

**Route to add: `POST /api/ai`**, same contract as AUSPEX: body `{system, user, maxTokens, model}`, reply `200 {content}` or `{error}` with 400, 405, 429, 502, 503. Send upstream exactly what `api/ai.mjs:125-133` sends (chat completions, `max_completion_tokens`, `temperature: 0.7`).

Hardening that does not change behaviour for the board: ignore the client's `model` (use the env value); clamp `maxTokens` to 1..2500 (the largest AUSPEX uses); cap `system` + `user` length; never relay the provider's error text (Coranto's rule at `:253`, so return `{error:'ai_failed'}`); return 503 `{error:'AI not configured'}` when the key is missing so the client's `!res.ok` check fires.

Two things to verify with the real key before building the UI on top (I have not run them): (a) that the configured model accepts `temperature: 0.7` on chat completions; (b) that 120 and 220 `max_completion_tokens` still leave visible text, since on reasoning models that budget also covers reasoning. If either fails, the fix belongs in the server route, not in the prompts.

---

## 3. Markup and styling

### 3.1 DOM tree of the overlay (`index.html:254-324`)

```
#analyst-overlay                      (.on = visible)
  .am-bar
    span.am-wordmark
    span.am-status-line#am-status  >  span#am-asset-count
    .am-bar-acts
      button.am-save-btn
      button.am-export-brief-btn
      button.am-synth-btn-bar
      button.am-consensus-btn
      .am-tools-wrap#am-tools-wrap
        button.am-tools-btn#am-tools-btn
        .am-tools-menu#am-tools-menu  >  6 buttons (4th is #dr-tools-btn)
      .am-bar-sep
      button.am-act.danger
      button.am-close-btn
  .am-body                            (grid 310px 1fr 340px)
    .am-col
      .am-col-hdr > span.am-col-title, span.am-col-meta#am-col-meta
      .am-hist-bar > input#am-hist-input.am-hist-inp, select#am-hist-cat.am-hist-sel
      #am-hist-results.am-hist-results
         .am-hist-loading | .am-hist-item[.pinned] > .am-hist-meta, .am-hist-title, button.am-hist-pin[.on]
      .am-asset-scroll#am-asset-scroll
         .am-asset-empty#am-asset-empty
         | .am-card (style --ac) > .am-card-cat (+ span.am-traj.am-traj-up|mid|down),
                                   .am-card-title,
                                   .am-card-meta (3 spans + button.am-card-tl),
                                   button.am-card-rm
    .am-col (position:relative)
      .am-col-hdr > .am-col-title, .am-col-meta#am-net-meta
      canvas#am-canvas
      .am-net-empty#am-net-empty
      button#am-net-reset
    .am-col
      .am-col-hdr > .am-col-title, .am-col-meta#am-brief-meta
      .am-brief-scroll#am-brief-scroll
         .am-brief-empty#am-brief-empty > button.am-synth-btn
         | .am-classify, .am-brief-sec > .am-brief-sh, p.am-brief-p (> span.am-conf), .am-entities > span.am-ent[.hi]
         | consensus: .cb-stats > .cb-stat > .cb-stat-v, .cb-stat-l
                      .cb-round-hdr > em
                      .cb-bar-wrap#cb-bar-wrap > .cb-analyst.cb-anim > .cb-name > .cb-icon ; .cb-loading | .cb-track > .cb-fill, .cb-pct ; .cb-text ; .cb-tag[.cb-blind]
                      #cb-round2-zone > .cb-round-hdr, .cb-debate-section#cb-debate-msgs > .cb-debate-msg.attacker|.defender > .cb-debate-who, .cb-debate-body[#cb-dove-rebuttal]
                      #cb-round3-zone > .cb-round-hdr, .cb-synthesis-section > .cb-synthesis-card > .cb-synthesis-hdr, .cb-synthesis-body#cb-synthesis-body
         | dead reckoning: .dr-board > .dr-hdr, .dr-sub, .dr-rows > .dr-row > .dr-country, .dr-bar-wrap > .dr-bar, .dr-stats > .dr-tier, .dr-n ; .dr-domains > .dr-domain
```

Modals: `#playbook-modal > .pb-bar (.pb-wordmark, #pb-status, .pb-act ×2 [#pb-export-btn], .pb-close-btn), .pb-body > #pb-content (.pb-loading[.pb-loading-anim] | .pb-classify, .pb-heading, .pb-date, .pb-sec-hdr, .pb-para)`. `#redteam-modal > .rt-bar (.rt-wordmark, #rt-status, .rt-act ×2 [#rt-export-btn], .rt-close-btn), .rt-body > #rt-content (.rt-loading[.rt-loading-anim] | .rt-classify, .rt-heading, .rt-date, .rt-para)`. `#timeline-bd`, `#timeline-modal > .tl-bar (.tl-wordmark, #tl-status, .tl-close-btn), .tl-body > #tl-content (.tl-empty | .tl-day > .tl-day-lbl, .tl-item > .tl-dot, .tl-item-body > .tl-item-cat, .tl-item-title, .tl-item-meta)`. `#matrix-bd`, `#matrix-modal > .mx-bar (.mx-wordmark, #mx-calc-ts, .mx-act#mx-recalc-btn, .mx-close-btn), .mx-body > #mx-content (.mx-grid > .mx-cell.mx-corner | .mx-cell.mx-hdr | .mx-cell.mx-data[.mx-diag] > .mx-risk, .mx-score), #mx-story-panel (.mx-sp-hdr, .mx-sp-empty | .mx-sp-list > .mx-sp-item > .mx-sp-cat, .mx-sp-title, .mx-sp-src), .mx-legend > spans, .mx-leg-note`. `#sb-bd`, `#sb-modal > .sb-bar (.sb-wordmark, .sb-close-btn), .sb-body#sb-body (.sb-empty | .sb-item > .sb-item-info (.sb-item-title, .sb-item-meta, .sb-item-stories > .sb-story-preview), button.sb-item-del)`. `#brief-bd`, `#brief-modal > .bm-hdr (.bm-title-block > .bm-eyebrow, .bm-title#bm-title, .bm-date#bm-date ; button.bm-close), .bm-body#bm-body (.bm-loading | h3, p | p.bm-error), .bm-footer (.bm-meta#bm-meta, button.bm-export-btn)`.

Name clash: AUSPEX's feed sidebar also uses `.sb-*` (`css:128-132`: `.sb-hdr`, `.sb-title`, `.sb-count`, `.sb-x`). Only the saved-boards rules at `css:1047-1065` belong to the board. In Coranto prefix every class (see to-do 5) so nothing collides with `coranto-*` or upstream styles.

### 3.2 CSS rule blocks (`css/auspex.css`)

| Lines     | Block                                                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3-48      | `:root` variables the board reads: `--t1 #e9f1ec`, `--t2 #9fb3a8`, `--t3 #5e7268`, `--b1`, `--brk #FF4D5E`, `--geo #6E8AFF`, `--f-brand`, `--f-head`, `--f-ui`, `--f-mono` |
| 544-554   | Overlay, bar, wordmark, status line, `.am-bar-acts`, `.am-act` (+hover, `.danger:hover`), `.am-close-btn`                                                                  |
| 556-561   | `.am-body` grid, `.am-col`, `.am-col-hdr`, `.am-col-title`, `.am-col-meta`                                                                                                 |
| 564-578   | History search: `.am-hist-bar` … `.am-hist-pin.on`                                                                                                                         |
| 580-589   | `.am-asset-scroll`, `.am-asset-empty`, `.am-card` (+`::before` accent bar, hover), `.am-card-cat/title/meta/rm`                                                            |
| 591-595   | `#am-canvas` (+`:active`), `.am-net-empty`, `#am-net-reset` (+hover)                                                                                                       |
| 597-609   | `.am-brief-scroll`, `.am-classify` (+`::before/::after` rules), `.am-brief-sec/sh/p`, `.am-entities`, `.am-ent` (+`.hi`), `.am-brief-empty`, `.am-synth-btn` (+hover)      |
| 612-620   | Bar buttons: `.am-synth-btn-bar`, `.am-export-brief-btn`, `.am-consensus-btn` (each with hover and active)                                                                 |
| 623-654   | Consensus `.cb-*`, with `@keyframes cb-in` at 640                                                                                                                          |
| 657-675   | Red team `#redteam-modal`, `.rt-*`, with `@keyframes rt-blink` at 675                                                                                                      |
| 885-905   | Daily brief modal `#brief-bd`, `#brief-modal`, `.bm-*`, with `@keyframes blink-fade` at 900                                                                                |
| 981-985   | `.am-act.danger` always-on tint (uses `!important`), `.am-bar-sep`                                                                                                         |
| 988-990   | `.am-save-btn`                                                                                                                                                             |
| 993-1003  | Tools: `.am-tools-wrap`, `.am-tools-btn`, `.am-tools-menu` (+`.on`, buttons, hover, `.on`), `#dr-tools-btn.on`                                                             |
| 1006-1009 | `.am-traj`, `.am-traj-up/mid/down`                                                                                                                                         |
| 1012      | `.am-conf`                                                                                                                                                                 |
| 1015-1016 | `.am-flash-alert`, `@keyframes blink-alert`                                                                                                                                |
| 1019-1020 | `.am-card-tl`                                                                                                                                                              |
| 1025-1042 | Playbook `#playbook-modal`, `.pb-*`                                                                                                                                        |
| 1047-1065 | Saved boards `#sb-bd`, `#sb-modal`, `.sb-bar` … `.sb-item-del`                                                                                                             |
| 1070-1102 | Matrix `#matrix-bd`, `#matrix-modal`, `.mx-*`, story panel `.mx-sp-*`                                                                                                      |
| 1107-1126 | Timeline `#timeline-bd`, `#timeline-modal`, `.tl-*`                                                                                                                        |
| 1131-1133 | Dead-reckoning globe glows `.ctry-marker[data-dr=…] .ctry-name`                                                                                                            |
| 1135-1148 | Dead-reckoning board `.dr-*`                                                                                                                                               |
| 1244-1276 | `@media (prefers-reduced-motion: reduce)`: turns off `.am-flash-alert`, `.bm-loading`, `.pb-loading-anim`, `.rt-loading-anim`                                              |

Canvas colours are in JS, not CSS (`analyst.js:389-419`).

### 3.3 Fonts, sizes, animation, layering

- Fonts: `Syne` 400/700/800 (`--f-brand`), `Fraunces` 400/600 + italic (`--f-head`), `Manrope` 300-600 (`--f-ui`), `IBM Plex Mono` 400-600 (`--f-mono`), loaded at `index.html:10`. Coranto already defines the same four as `--font-brand`, `--font-head`, `--font-sans`, `--font-mono` (`src/ui/styles/coranto.css:16-20`). Canvas text uses `7px "IBM Plex Mono"` (edge labels) and `8px "IBM Plex Mono"` (node labels).
- Variable mapping: `--f-mono → --font-mono`, `--f-ui → --font-sans`, `--f-brand → --font-brand`, `--f-head → --font-head`, `--t1 → --text-primary`, `--t2 → --text-secondary`, `--t3 → --text-dim`, `--geo → --cat-geopolitics`. `--brk` has no Coranto twin: define it on the overlay root as `#FF4D5E`.
- Type is small on purpose: 7 to 9 px mono labels with letter-spacing .1em to .32em; body 10 to 12.5 px. Keep the sizes.
- Animations: overlay and full-screen modals fade `opacity .35s`; centred modals `all .28s cubic-bezier(.34,1.2,.64,1)` from `scale(.95)`; timeline drawer slides 20 px with `cubic-bezier(.2,.9,.4,1)`; backdrops `opacity .22s` (.25s for the brief) with `backdrop-filter: blur(5px)`; `cb-in` .4s (fade up 6 px); `.cb-fill` width `1.2s cubic-bezier(.4,0,.2,1)`; `rt-blink` 1.5s (opacity .25 ↔ .9); `blink-fade` 1.4s (.25 ↔ 1); `blink-alert` .7s `step-start`; `.dr-bar` width .4s; canvas edge pulse `0.25 + sin(frame × 0.025 + i) × 0.12`.
- z-index: overlay 600; tools menu 500 (inside the bar); backdrops 700 and centred modals 701; playbook and red team 800. Coranto's current board sits at 610 and its highest layer is 900 (`coranto.css`). Check the board and its modals against Coranto's story popup and header before fixing numbers.
- Fit: AUSPEX's grid is fixed `310px 1fr 340px` with no narrow layout. The owner requires every panel to fit any window and scroll inside itself. Keep AUSPEX's layout at desktop width and add one narrow-width rule (stack columns, scroll) as Coranto's board has now (`coranto.css:3249-3261`).

### 3.4 Entity network constants (`analyst.js:309-427`)

- Nodes: `label = title.slice(0, 22)`, start at centre ± `(Math.random() − .5) × W × .55` (same for H).
- Edge between two pins when they share at least one `SHARED_ENTITIES` term (case-insensitive substring on title+summary); `strength` = number shared, `label` = first shared.
- Per frame: velocity × 0.86; pull to centre × 0.003; repulsion `f = min(5000 / d², 10)`; spring on edges, target 140, `f = (d − 140) × 0.055`; clamp positions to a 40 px margin.
- Draw: transform `translate(W/2 + panX, H/2 + panY) scale(zoom) translate(−W/2, −H/2)`; grid every 40 px, stroke `rgba(10,16,32,.9)`, width .5; edge width `0.5 + strength × 0.35`; cross-category edge `rgba(255,159,10, pulse + 0.1)` with label `rgba(255,159,10,.85)`; same-category edge `rgba(74,222,128, pulse)` with label `rgba(0,160,200,.75)`; label upper-cased, 5 px above the midpoint; node glow radial 22 px from `colour + '55'` to transparent; node disc 9 px in the pin's colour, stroke `rgba(255,255,255,.25)` 1.2; node label `rgba(160,180,220,.9)` 22 px below.

### 3.5 Every colour literal, and what to do with it

**Green accent: swap to violet.**

| AUSPEX                                                                                             | Where                                                                                                                                                                                          | Coranto                                                      |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `#4ADE80`                                                                                          | wordmark, column titles, brief section headers, hover states, `.cb-round-hdr em`, `.cb-synthesis-hdr`, `.am-card-tl:hover`, pin-button colour in JS (`:104`, `:131`), export wordmark (`:504`) | `#b47cff`                                                    |
| `rgba(74,222,128,a)` for a in .03 .04 .05 .06 .07 .08 .1 .12 .14 .18 .2 .22 .25 .3 .4 .45 .5 .6 .7 | borders, fills, glows, `.am-ent.hi` border, `.cb-tag` border, `.sb-item:hover`, canvas same-category edge (`:400`)                                                                             | `rgba(180,124,255,a)`, same alpha                            |
| `#4ADE8066`                                                                                        | city pin button border (`:132`)                                                                                                                                                                | `#b47cff66`                                                  |
| `#2ECC71`, `rgba(46,204,113,a)` for .07 .18 .3 .35 .65                                             | `.am-save-btn`                                                                                                                                                                                 | `#b47cff`, `rgba(180,124,255,a)`                             |
| `#30D158`, `rgba(48,209,88,a)` for .06 .1 .12 .15 .2 .25 .35 .4 .55 .6 .8 **as chrome**            | playbook bar, wordmark, status, buttons, scrollbar, loading text, error text (`:1242`); dead-reckoning board border and header                                                                 | `#b47cff`, `rgba(180,124,255,a)`                             |
| `#020703`                                                                                          | `#pb-content` background (green-black)                                                                                                                                                         | `#06030b` (suggested violet-black)                           |
| `rgba(10,25,10,.5)`                                                                                | `.dr-board` background                                                                                                                                                                         | `rgba(18,10,28,.5)` (suggested)                              |
| `rgba(218,228,210,.88)`                                                                            | `.pb-para` text (green-tinted white)                                                                                                                                                           | `rgba(226,218,238,.88)` (suggested)                          |
| `--t1 #e9f1ec`, `--t2 #9fb3a8`, `--t3 #5e7268`                                                     | green-tinted greys used everywhere via variables                                                                                                                                               | Coranto's `--text-primary`, `--text-secondary`, `--text-dim` |

The gradient `#7c3aed → #e879f9` has no direct target: AUSPEX's board uses no gradient (its `--sig` is used elsewhere). Available as `--coranto-sig` if the wordmark should match Coranto's header; that would be a second visual change, so the default is not to use it.

**Green that carries meaning: keep.** (The owner's rule: green stays where it means something.)

| Literal                     | Meaning                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `#30D158`                   | Consensus escalation ≤ 40, agreement ≥ 40, confidence `H`, diplomatic persona, matrix and dead-reckoning `climate` domain |
| `#2ECC71`                   | Dead-reckoning `STABLE` tier                                                                                              |
| `rgba(48,209,88,.55)`, `.4` | Dead-reckoning stable glow                                                                                                |

**Not green: copy unchanged.**

- Navy-black surfaces and lines: `#06070f #080a14 #111830 #0a0c18 #060811 #0d1020 #0e1020 #1a2240 #1a2840 #060810 #07090f #04050a #03040a #03050a #3a1820`, `rgba(6,9,22,.97)`, `rgba(4,6,18,.98)`, `rgba(5,6,14,.98)`, `rgba(2,3,8,.97)`, `rgba(2,4,8,.97)`, `rgba(10,16,32,.9)`.
- Blue-grey text: `#5A7898 #6A8898 #1a2030 #607090 #1e2840 #1e3050 #3a5870 #A8BAD0 #8CA0C3 #7a8ea8 #BCC5E8 #8A93C8 #3C4470 #566573 #804050`, `rgba(160,180,220,.9)`, `rgba(180,185,215,.65)`, `rgba(220,230,240,.9)`, `rgba(180,190,210,.6)`, `rgba(80,90,120,.22)`, `rgba(100,100,140,.55)`.
- Red: `#FF1744`, `rgba(255,23,68,a)`, `#FF2D55`, `rgba(255,45,85,a)`, `#FF3B30`, `rgba(255,59,48,a)`, `rgba(255,80,80,a)`, `rgba(255,70,70,.55)`, `rgba(255,90,90,.75)`, `rgba(255,100,100,a)`, `rgba(255,150,150,1)`, `rgba(230,175,175,.88)`, `rgba(193,18,31,.88)`, `rgba(61,10,10,.9)`, `#C1121F` / `#c1121f` (export banners), `#ff1744`, `#3d0a0a`.
- Amber and gold: `#FF9F0A`, `rgba(255,159,10,a)`, `#FFD60A`, `#B7950B`, `rgba(183,149,11,.45)`.
- Blue and cyan: `#0A84FF`, `rgba(10,132,255,.03)`, `#00A0C0` (`.am-ent.hi` and `.cb-tag` text), `rgba(0,160,200,.75)` (edge label). These are cyan leftovers, not green. Default: keep.
- Brown (TOOLS button): `rgba(140,100,70,a)`, `rgba(150,110,80,.65)`, `#9C7A5E`, `#B8917A`.
- White overlays: `rgba(255,255,255,a)` and `#fff`.
- Export pages: `#030409 #c8d0f0 #1a1f35 #5a6480 #f0f2ff #0d1020` (brief); `#0a0a0a #e8e8e8` (red team); `#0a0303` (playbook); `#fafaf8 #1c1c2e #666 #888 #555 #e0e0d8 #aaa` (daily brief).
- Geo asset type colours (`:150-153`): city `#8FA0E8`, capital `#E8D5A3`, financial `#FFD60A`, tech `#9D8CFF`, tourism `#FF8FA3`, megacity `#9FB3C8`, military and base `#FF6D00`, naval `#2979FF`, port `#2DD4BF`, conflict `#FF2D55`, energy `#FFB02E`, diplomatic `#30D158`, country `#B163E0`, fallback `#8A93C8`. Coranto's atlas has its own city colours in `src/data/corantoAtlasStyle.js`; use those so a pinned city matches its globe icon.
- Category colours: AUSPEX `CATS` (`config.js:9-16`) are geo `#6E8AFF`, military `#C084FC`, finance `#E8B84B`, climate `#34D17A`, tech `#22D3EE`. Use Coranto's `TOPIC_COLOURS` (`src/data/corantoIcons.js:234`): the same except military `#e23b3f`. AUSPEX's violet military would read as the accent after the swap.
- The matrix and dead reckoning use an older fixed palette (`:1285`, `:1451`): geo `#FF2D55`, tech `#0A84FF`, military `#FF9F0A`, finance `#FFD60A`, climate `#30D158`, fallback `#7B61FF`. Copy as is.

---

## 4. State and storage

### 4.1 Globals

| Name                                           | Declared               | Holds                                                                                                         |
| ---------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `analystAssets`                                | `config.js:138`        | Array of pinned ids: integer (live story), UUID string (archive), `saved_<key>` (from a saved board), geo key |
| `_analystGeoMap`                               | `config.js:139`        | key → `{id, _geoType, _geoObj, title, summary, cat, color, src, time, region}`                                |
| `analystGraph`                                 | `config.js:145`        | Unused                                                                                                        |
| `analystAnimId`                                | `config.js:146`        | Animation frame id                                                                                            |
| `_netZoom`, `_netPanX`, `_netPanY`, `_netDrag` | `config.js:147-148`    | Network view                                                                                                  |
| `_briefContent`                                | `config.js:151`        | Last daily or conflict brief HTML                                                                             |
| `_briefTitle`                                  | `analyst.js:872`       | Title for the brief export                                                                                    |
| `_histDebounceTimer`                           | `analyst.js:9`         | Search debounce                                                                                               |
| `_toolsMenuOpen`                               | `analyst.js:1103`      | Menu state                                                                                                    |
| `deadReckoningOn`, `_drScores`                 | `analyst.js:1366-1367` | Toggle and iso → tier                                                                                         |
| `window._rtBriefText`, `window._pbBriefText`   | `:773`, `:1227`        | Last red team and playbook text (written, never read)                                                         |
| `window._mxStoryMap`                           | `:1313`                | Matrix cell → stories                                                                                         |
| `window._cipCurrentCity`                       | read at `:126`         | City panel's current city                                                                                     |
| `_histMap`                                     | `js/supabase.js:24`    | id → archive story, also where saved-board stories are re-injected                                            |

Read from elsewhere: `NEWS` (live stories), `CATS`, `SHARED_ENTITIES` (`js/globe.js:1329-1335`, 36 terms; Coranto already has the same list at `corantoBoardModel.js:13-50`), `_WORLD_COUNTRIES` (`js/globe.js:77`), `watchlist` (`config.js:129`), `OPENAI_KEY`, `AI_MODEL`, `AI_PROXY_URL`, `NEWS_CACHE_KEY`, `aiEnabled()`.

Geo asset built by `pinGeoAsset` (`:176-182`):

- `title`: country → `${name} — Country Intelligence Profile`; otherwise `${name} — ${Icon_type} Asset` (first letter upper-cased, default `City`).
- `summary`: city → `${typeLabel||'Strategic location'} in ${country||'unknown'}. Coordinates: ${lat.toFixed(2)}°N ${lng.toFixed(2)}°E. Strategic tier: ${tier||'—'}.[ ${notes}]` with type labels at `:162`; country → `${flags.join(' · ') || 'No special designations'}. GDP: … Military spend: … Strategic tier: ….` with flags `☢ Nuclear armed`, `★ UN Security Council P5`, `▲ Active conflict`, `⊘ Under sanctions`, `◆ NATO member`; region → empty.
- `cat`: `military` for a nuclear or in-conflict country and for `military` / `naval` icon types; else `geo`.
- `src`: `iso2 || 'CTRY'` for a country, else `CITY`. `time`: `CURRENT`. `region`: `obj.country || obj.name`.

### 4.2 localStorage

| Key                                       | Used by                                                                       | Shape                                                                                                                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUSPEX_SAVED_BOARDS`                     | `:1559-1667`, read and write                                                  | Array, newest first, max 50: `{id: Date.now(), title, savedAt: ISO string, assetIds: [...], stories: [{id, title, summary, body, url, src, cat, region, lat, lng, brk, color, time, _pub, _hist: true, _key}]}` |
| `auspex_news_cache_v2` (`NEWS_CACHE_KEY`) | read by `runHistSearch` `:38` and `_buildTimeline` `:1513`                    | `{ts, map: {<title 60 chars>: story}}`, written by `js/news.js`. The fallback literal `'auspex_news_v1'` in those two lines is never reached                                                                    |
| `auspex_wl`                               | read once into `watchlist` (`config.js:129`), used by `_checkWatchlistAlerts` | Array of story ids                                                                                                                                                                                              |

The live board is not stored: pins are lost on reload unless saved.

### 4.3 Supabase

The browser client is `js/supabase.js` (anon key in source; do not copy it). Tables are in `sql/schema.sql`.

| Table / RPC                                           | Used by the board through                                                                                    | Purpose                                                                             | Without it, in AUSPEX                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `stories` (`schema.sql:8-24`)                         | `sbSearchHistory` (`supabase.js:85`), called by `runHistSearch`                                              | 90-day title search, `ilike '%q%'`, optional `cat`, newest 20                       | Returns `[]`; search still covers live `NEWS` and the localStorage cache                                                          |
| `stories`                                             | `sbFetchRelatedHistory` (`supabase.js:112`), called by `synthesizeBrief`                                     | Up to 8 stories 7 to 30 days old in the pinned categories, for `HISTORICAL CONTEXT` | Returns `[]`; the section is left out                                                                                             |
| `stories`                                             | `sbArchiveStories` (`supabase.js:35`, after each fetch), `sbFetchRecentStories` (`supabase.js:144`, at boot) | Fills the archive and reloads a week of it                                          | Archive never grows; live feed only                                                                                               |
| `cities`, `countries`, `regions` (`schema.sql:31-83`) | `sbFetchCities/Countries/Regions`                                                                            | The objects handed to `pinGeoAsset`                                                 | No geo pins from those layers                                                                                                     |
| RPC `ai_usage_add`                                    | `api/ai.mjs:43` (server only)                                                                                | Daily token cap per visitor                                                         | Proxy serves the request anyway. The function is not in `sql/schema.sql` or the migration; it exists only in the deployed project |

Saved boards do not touch Supabase.

### 4.4 What needs a database in Coranto, and what does not

Coranto has no database and the owner said to hold Supabase until needed.

| Feature                                                                                                                                                                                     | Database needed?                            | Coranto without one                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pins, cards, trajectory, network, SYNTHESIZE (except one section), confidence badges, CONSENSUS, playbook, red team, timeline, matrix, dead reckoning, exports, daily brief, conflict brief | No                                          | Full                                                                                                                                                                |
| Saved boards                                                                                                                                                                                | No                                          | localStorage, as AUSPEX. Coranto already has `coranto.boards.v1`                                                                                                    |
| AI cost guard                                                                                                                                                                               | No                                          | Per-IP per-minute limiter (`enforceRateLimit`) replaces the daily token counter                                                                                     |
| History search                                                                                                                                                                              | Only for anything older than the feed holds | Searches the current snapshot (`/api/news` keeps a week, saved on disk in `.gev-cache/news-v1.json`). The `ARCHIVE` label and the 90-day reach need a story archive |
| `HISTORICAL CONTEXT (LAST 30 DAYS)` in SYNTHESIZE                                                                                                                                           | **Yes**                                     | Cannot work: it asks for stories 7 to 30 days old, and Coranto holds 7 days. Leave the section out, as AUSPEX does when the query returns nothing                   |
| `ARCHIVE` badge on a card                                                                                                                                                                   | Partly                                      | AUSPEX shows it for Supabase rows and reloaded saved-board rows. In Coranto show it when a pinned story is no longer in the current snapshot                        |
| Country `GDP`, `Mil spend`, `SANCTIONED`; city `notes`                                                                                                                                      | Data, not a database                        | Coranto's atlas JSON lacks them (see 5.3); the text prints `—` as AUSPEX does for a missing value                                                                   |
| Region pins                                                                                                                                                                                 | Data                                        | Coranto has no regions overlay; `pinGeoAsset('region', …)` has no caller yet                                                                                        |

---

## 5. Data mapping

### 5.1 Story fields

AUSPEX story (built at `js/news.js:164-183`, coloured at `js/data.js:128`, archive rows at `js/supabase.js:179-201`). Coranto article `{id, title, summary, publisher, url, publishedAt, category, place: {name, lat, lon, precision}}`, story `{id, articleIds, outlets}`, pinned asset `{key, kind, title, summary, publisher, url, publishedAt, category, place, lat, lon, pinnedAt}`. Note: in the store `place` is the place **name as a string** (`corantoBoardModel.js:353`), not the object.

| AUSPEX field          | Meaning in AUSPEX                                                                                                                      | From Coranto asset                                                                       | From Coranto article (search, timeline, matrix)                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `id`                  | int (live), UUID (archive), `saved_…`, geo key                                                                                         | `key` (`story.id` or `article.id`; `country:Name`; `city:Name`; `contact:<id>`)          | `id`, or the story id that holds it                                                  |
| `title`               | headline, 120 chars                                                                                                                    | `title`                                                                                  | `title`                                                                              |
| `summary`             | dek                                                                                                                                    | `summary`                                                                                | `summary`                                                                            |
| `body`                | always `''` live                                                                                                                       | none: use `''`                                                                           | none                                                                                 |
| `url`                 | link                                                                                                                                   | `url`                                                                                    | `url`                                                                                |
| `urlToImage`          | not used by the board                                                                                                                  | none                                                                                     | none                                                                                 |
| `src`                 | outlet, 22 chars                                                                                                                       | `publisher`                                                                              | `publisher`                                                                          |
| `cat`                 | `geo`, `tech`, `military`, `finance`, `climate`                                                                                        | `category` through the map in 5.2                                                        | `category` through the map                                                           |
| `region`              | **outlet name** live (`news.js:172`); real region on archive rows and geo assets                                                       | `place` (the name). Empty when the story has no place. Do not copy the outlet-name quirk | `place?.name ?? ''`                                                                  |
| `lat`, `lng`          | jittered coords                                                                                                                        | `lat`, `lon`                                                                             | `place?.lat`, `place?.lon`                                                           |
| `brk`                 | published under 25 minutes before fetch                                                                                                | compute `Date.now() − Date.parse(publishedAt) < 25 × 60 000`                             | same                                                                                 |
| `color`               | `CATS[cat].color`                                                                                                                      | `TOPIC_COLOURS[category] ?? TOPIC_COLOURS.news`                                          | same                                                                                 |
| `time`                | `just now` (under 2 min), `N min ago`, `1 hr ago`, `N hr ago` (`news.js:159-162`); archive `Nm ago`, `Nh ago`, `Nd ago`; geo `CURRENT` | format from `publishedAt`                                                                | same                                                                                 |
| `_pub`                | epoch ms                                                                                                                               | `Date.parse(publishedAt)`                                                                | same                                                                                 |
| `_key`                | `title.slice(0, 60)`                                                                                                                   | derive                                                                                   | derive                                                                               |
| `_hist`               | from Supabase or a saved board                                                                                                         | true when the pinned story is not in the current snapshot                                | false                                                                                |
| `_geoType`, `_geoObj` | geo assets only                                                                                                                        | `kind` when not `story`; object per 5.3 (new stored field, see to-do 3)                  | n/a                                                                                  |
| none                  | n/a                                                                                                                                    | `pinnedAt` (Coranto only; keep)                                                          | `place.precision`, story `outlets`, `articleIds` (Coranto only; unused by the board) |

AUSPEX tells geo assets from stories with `typeof id === 'string' && id.includes(':')`. In Coranto test `kind !== 'story'` instead; do not rely on the colon.

`NEWS` in every rule becomes `getArticles()` (`layer.getView().snapshot?.articles ?? []`, already passed to the board at `corantoShell.js:1548`).

### 5.2 Category map

| Coranto `category`     | AUSPEX `cat`            | Label                                | Matrix label      | Search option              |
| ---------------------- | ----------------------- | ------------------------------------ | ----------------- | -------------------------- |
| `geopolitics`          | `geo`                   | `GEO`                                | `GEO`             | `GEO`                      |
| `technology`           | `tech`                  | `TECH`                               | `TECH`            | `TECH`                     |
| `military`             | `military`              | `MIL`                                | `MIL`             | `MIL`                      |
| `finance`              | `finance`               | `FIN`                                | `FIN`             | `FIN`                      |
| `climate`              | `climate`               | `CLM`                                | `CLM`             | `CLM`                      |
| empty or anything else | AUSPEX has no such case | upper-cased id, or `NEWS` when empty | not on the matrix | matches only `ALL DOMAINS` |

Dead reckoning's per-country labels are `GEO TEC MIL FIN CLM` (note `TEC`).

### 5.3 Geo objects

| AUSPEX `_geoObj` field                  | Coranto `public/coranto-atlas/countries.json` (197 rows)                                                       | Coranto `cities.json` (1000 rows)                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `name`                                  | `name`                                                                                                         | `name`                                                        |
| `iso2`                                  | `iso2`                                                                                                         | `iso2`                                                        |
| `lat`, `lng`                            | `lat`, `lng`                                                                                                   | `lat`, `lng`                                                  |
| `nuclear_armed`, `un_p5`, `nato_member` | present                                                                                                        | n/a                                                           |
| `conflict_active`                       | not in the file; computed in `corantoAtlas.js:278-280` (`conflict_listed`, `conflict_live`, `conflict_active`) | n/a                                                           |
| `sanctions_subject`                     | **missing**                                                                                                    | n/a                                                           |
| `gdp_billions`, `mil_spend_billions`    | **missing** (prints `—`)                                                                                       | n/a                                                           |
| `strategic_tier`                        | `strategic_tier`                                                                                               | `tier`                                                        |
| `icon_type`                             | n/a                                                                                                            | `type`                                                        |
| `country`                               | n/a                                                                                                            | **missing**: look the name up from `iso2` in `countries.json` |
| `notes`                                 | n/a                                                                                                            | **missing**                                                   |
| `population`                            | n/a                                                                                                            | `population` (not used by the board)                          |

`contact` pins (aircraft, ship, site) have no AUSPEX form. Treat as a geo asset: badge `CONTACT ASSET`, `src` = the layer name already stored in `publisher`, `time` `CURRENT`, `region` empty, `cat` `geo`, context line `[GEO/CONTACT] ${title} — ${summary}`.

`_WORLD_COUNTRIES` for dead reckoning → the rows of `countries.json` (`name`, `iso2`).

---

## 6. Integration points in Coranto

The store's interface (`has`, `toggle`, `remove`, `clear`, `list`, `full`, `subscribe`, `save`, `saved`, `load`, `deleteSaved`) should stay, so most callers do not change. What changes is the panel object and what gets passed into `toggle`.

`src/ui/corantoShell.js` was being edited while this plan was written (it grew from 3187 to 3347 lines during the read). The line numbers below are from the 3347-line version; find each place by the quoted code, not the number.

| #   | Where (`corantoShell.js` unless named)                                                                                                                                                  | Today                                                                                                                                                          | After the port                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `:13-14` `import { createBoard }`, `import { createBoardStore }`                                                                                                                        | imports the old panel and the store                                                                                                                            | import `createAnalyst` from the new file; keep `createBoardStore`                                                                                                                                                                                                                                                                                                                                                                  |
| 2   | `:1284` `createBoardStore({ storage: localStorageRef })`                                                                                                                                | the store                                                                                                                                                      | unchanged (same keys, so existing pins survive)                                                                                                                                                                                                                                                                                                                                                                                    |
| 3   | `:1285-1300` `id: 'coranto-board-btn'`, `syncBoardButton`; `:350` `boardLabel`                                                                                                          | header button, label `BOARD` / `BOARD · n`                                                                                                                     | unchanged, or relabel `ANALYST` to match AUSPEX's command button (`index.html:94-97`). Opens the overlay                                                                                                                                                                                                                                                                                                                           |
| 4   | `:1545-1571` `const board = createBoard({`                                                                                                                                              | `createBoard({document, store, getArticles, onOpen, onChange})`                                                                                                | `createAnalyst({document, store, getArticles, getStories, getCountries, callModel, onOpen, onChange, onMomentum})`. Must return the same `{element, isOpen, open, close, render, destroy}`. Add `getStories: () => layer.getView().snapshot?.stories ?? []` and `getCountries: () => atlasCountries` (`:645`). AUSPEX cards have no "open" action; keep `onOpen` on the card title so a pin still leads back to its story or place |
| 5   | `:1572` `boardBtn.addEventListener('click', () => board.open())`                                                                                                                        | opens the board                                                                                                                                                | unchanged                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6   | `:847-852` command entry `title: 'Analyst board'` → `board.open()`                                                                                                                      | command palette                                                                                                                                                | unchanged; add entries for CONSENSUS, RED TEAM, PLAYBOOK, TIMELINE, MATRIX, DEAD RECKONING, SAVED BOARDS, DAILY BRIEF if wanted                                                                                                                                                                                                                                                                                                    |
| 7   | `:2464` `board.element` in the page's element list                                                                                                                                      | mounts the panel                                                                                                                                               | unchanged; the five modal elements must be mounted too (have `createAnalyst` own them inside one root)                                                                                                                                                                                                                                                                                                                             |
| 8   | `:3138` `board.close()` at the end of the close-everything function before `document.addEventListener('keydown', onKey)`; Escape handling at `:3102-3126`                               | closes the board                                                                                                                                               | close the top-most analyst modal first, then the overlay                                                                                                                                                                                                                                                                                                                                                                           |
| 9   | `:3326` `board.destroy()`                                                                                                                                                               | teardown                                                                                                                                                       | unchanged                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 10  | `:3081-3084` settings row `label: 'Analyst board'`, `clearAndReload(['coranto.board.v1', 'coranto.boards.v1'])`                                                                         | clears stored pins and saved boards                                                                                                                            | unchanged if the keys stay; add any new key the port introduces                                                                                                                                                                                                                                                                                                                                                                    |
| 11  | `:3195` `board: boardStore` → `src/ui/newsPanel.js:91, 918-946` (inside `renderStory`, `:776`)                                                                                          | story popup button `PIN TO BOARD` / `PINNED` calls `board.toggle({key, kind:'story', title, summary, publisher, url, publishedAt, category, place, lat, lon})` | same call. Label per AUSPEX: `PIN TO ANALYST` / `PINNED ✓` (`js/ui.js:225`). This is `pinStory`                                                                                                                                                                                                                                                                                                                                    |
| 12  | `src/ui/newsPanel.js:372` `renderCard`                                                                                                                                                  | feed cards have no pin control                                                                                                                                 | AUSPEX has a pin icon on every feed card (`js/ui.js:21, 56-57`, `[data-pin-id]`). Add one with the same `board.toggle` payload, active colour violet                                                                                                                                                                                                                                                                               |
| 13  | `:1158-1166` `const countryPin = (model) =>`; `:1191-1197` dossier `pin: { has, toggle }` → `src/ui/corantoDossier.js:20, 89-100`                                                       | country sheet `PIN TO BOARD`; payload `{key:'country:<title>', kind:'country', title, lat, lon}`                                                               | add the country row so the asset matches `pinGeoAsset('country', obj)`: `geo: {name, iso2, nuclear_armed, un_p5, nato_member, conflict_active, strategic_tier}`                                                                                                                                                                                                                                                                    |
| 14  | `src/ui/corantoAtlas.js:231-238` `pin: {` → `:1715-1745` `const atlas = createAtlas({ showCard`                                                                                         | globe click on a country or city builds `pin {key:'<kind>:<name>', kind, iso2, title, lat, lon}`; card button uses `pinLabel`                                  | add `geo: record.item` (plus the country name for a city). This is `pinGeoAsset('city'                                                                                                                                                                                                                                                                                                                                             | 'country', obj)`. Button text per AUSPEX city panel: `PIN`/`PINNED` |
| 15  | `:2326-2348` `const pinKey = \`contact:${id}\``…`contactPin(record, at, Date.now())`; `:1591-1606` `cardPin(detail, subject.id, subject, Date.now())`→`src/ui/corantoContact.js:98-131` | aircraft, ship, site cards pin as `kind:'contact'`                                                                                                             | unchanged payload; rendered as a contact asset (5.3)                                                                                                                                                                                                                                                                                                                                                                               |
| 16  | `:1567-1570` `onChange: () => { syncBoardButton(); feed?.render(); }`                                                                                                                   | refreshes header count and feed                                                                                                                                | unchanged; also refresh open atlas and contact cards so their pin labels follow `CLEAR BOARD` (AUSPEX resets them in `clearAssets`)                                                                                                                                                                                                                                                                                                |
| 17  | `:355-358` `pinLabel(pinned, full)`                                                                                                                                                     | card button text                                                                                                                                               | keep the "board is full" wording (no AUSPEX equivalent)                                                                                                                                                                                                                                                                                                                                                                            |
| 18  | `:200` guide string starting `PIN TO BOARD keeps`                                                                                                                                       | describes the old board                                                                                                                                        | rewrite for the new tools                                                                                                                                                                                                                                                                                                                                                                                                          |
| 19  | none                                                                                                                                                                                    | AUSPEX arc click → `traceArc`                                                                                                                                  | only if Coranto draws story-to-story arcs; if not, skip                                                                                                                                                                                                                                                                                                                                                                            |
| 20  | none                                                                                                                                                                                    | AUSPEX `_checkWatchlistAlerts` after each refresh                                                                                                              | Coranto has saved searches (`createWatchStore`, `:2475`), not a list of watched story ids. Flash when a refresh brings a new match for a saved search while the board is open, or skip                                                                                                                                                                                                                                             |
| 21  | none                                                                                                                                                                                    | AUSPEX `BRIEF` command button → `openDailyBrief()`                                                                                                             | add a header or palette entry if the daily brief is in scope                                                                                                                                                                                                                                                                                                                                                                       |
| 22  | none                                                                                                                                                                                    | AUSPEX conflict triangle → `openConflictBrief(country)`                                                                                                        | add a `CONFLICT BRIEF` action on the country card or sheet when `conflict_active`                                                                                                                                                                                                                                                                                                                                                  |
| 23  | none                                                                                                                                                                                    | AUSPEX `.ctry-marker[data-dr]` glows                                                                                                                           | Coranto draws countries as Cesium billboards. `onMomentum(map)` must be implemented in `corantoAtlas.js` (tint or halo per tier) or dead reckoning shows its board only                                                                                                                                                                                                                                                            |
| 24  | `scripts/package-boundaries.json:2261-2262` and `:2846-2847`                                                                                                                            | list `corantoBoard.js`, `corantoBoardModel.js` (two places)                                                                                                    | add every new file in both places, remove deleted ones, or `npm run check:boundaries` fails                                                                                                                                                                                                                                                                                                                                        |
| 25  | `src/ui/styles/coranto.css:3042-3261`, `:3477-3513`                                                                                                                                     | `#coranto-board`, `.coranto-board-*` (through the `max-width: 980px` block), `.coranto-matrix*`                                                                | delete with the old panel. Keep `#coranto-board-btn` (`:3019-3041`)                                                                                                                                                                                                                                                                                                                                                                |
| 26  | `server/providers/local.js:71` `newsProxy(),`                                                                                                                                           | plugin list                                                                                                                                                    | add the new AI route plugin beside it                                                                                                                                                                                                                                                                                                                                                                                              |
| 27  | `src/ui/corantoBoard.test.mjs`, `src/ui/corantoContact.test.mjs`                                                                                                                        | tests of the old model and panel                                                                                                                               | rewrite the first; the second stays                                                                                                                                                                                                                                                                                                                                                                                                |

---

## 7. To-do list, in build order

Tests must live under `src/` and end `.test.mjs`: `scripts/run-unit-tests.mjs` only walks `src/`. After any edit to `corantoShell.js`, load the page before moving on. Check each new surface at a 780 px tall window and a narrow one.

1. **Confirm the four points in section 0 with the owner** (uncited AI tools, text glyphs, fake classification banners, AUSPEX → CORANTO wording) and the "plan default" column of the second table. Nothing to build.

2. **AI route.** Create `server/providers/analystAi.js` exporting `analystAiProxy({aiFetch, aiKey, gate})`: `POST /api/ai`, contract in 2.9, upstream body from `api/ai.mjs:125-133`, `sameSiteGated`, `enforceRateLimit(openAiRateLimiter(), …)`, `readRequestBody(req, 64 * 1024)`, model from `CORANTO_ANALYST_MODEL` (default `gpt-5.4-mini`), `maxTokens` clamped 1..2500, 55 s timeout. Register at `server/providers/local.js:71`. Add `CORANTO_ANALYST_MODEL` to `.env.example`.
   Test `src/ui/corantoAnalystAi.test.mjs` (route part): 405 on GET; 503 with no key; 400 on bad JSON; the upstream body has the model, `max_completion_tokens`, `temperature 0.7` and both messages; `maxTokens` 99999 is clamped; a client `model` is ignored; upstream error text is not relayed; 200 `{content}`.
   Then, by hand with the real key: one 120-token call and one 2200-token call return text (see the two checks in 2.9).

3. **Store.** Edit `src/ui/corantoBoardModel.js` `validAsset` (`:333-358`) to keep an optional `geo` object (whitelisted keys from 5.3, values string, number or boolean only). Keep keys `coranto.board.v1` and `coranto.boards.v1`.
   Test: a country pin with `geo` survives save, reload and load; unknown keys are dropped; old stored assets without `geo` still load.

4. **Model, part 1 (adapter).** Create `src/ui/corantoAnalystModel.js` with `toAnalystStory(asset, {now, articles, countries})` returning the AUSPEX shape in 5.1 (including geo title, summary, cat, src, time, region per 4.1), `articleToStory(article, now)`, the category map of 5.2, `relativeTime`, and `buildAssetContext(pinned)` exactly as 2.2.
   Test `src/ui/corantoAnalystModel.test.mjs`: one story, one country, one city, one contact; expected context lines character for character; `brk` at 24 and 26 minutes; `_hist` when the article has left the snapshot.

5. **Styles.** Create `src/ui/styles/corantoAnalyst.css` from the rule blocks in 3.2, prefixing ids and classes (suggest `ca-`: `#ca-overlay`, `.ca-am-bar`, `.ca-cb-analyst`, `.ca-sb-item`, …), applying the swap table in 3.5 and the variable map in 3.3, and adding the reduced-motion rules and one narrow-width rule. Link it in `index.html` after `coranto.css`.
   Check: `grep -i "4ADE80\|74,222,128\|2ECC71\|46,204,113"` finds nothing in the new file; `30D158` appears only on the meaning rows of 3.5.

6. **Panel shell.** Create `src/ui/corantoAnalyst.js` exporting `createAnalyst(options)` (interface in section 6 row 4). Build the bar and three columns of 3.1 with DOM nodes and `textContent`, never `innerHTML` with feed or model text. All text from 1.1. Buttons present but inert except EXIT. Swap it in at `corantoShell.js:13` and at the `createBoard({` call (`:1545`). Delete `src/ui/corantoBoard.js`.
   Test `src/ui/corantoAnalyst.test.mjs` (follow the fake-document pattern of the existing board test): bar buttons exist in the order of 1.1; tools menu has six entries in order; open and close set `isOpen`.
   Check in the browser: header button opens it; Escape and EXIT ANALYST close it; fits a 780 px window.

7. **Cards and status.** `renderAnalystBoard`, `updateAnalystStatus`, `_computeTrajectory` (model), remove button, empty text, `ARCHIVE` and `BREAKING` marks. Subscribe to the store.
   Test: trajectory thresholds 1, 2, 4 related headlines; card badge text for each kind; status count.

8. **Pin callers.** Section 6 rows 11 to 17: popup label, feed-card pin button, `geo` on country and city pins, card refresh after CLEAR BOARD.
   Check: pin a story, a country, a city and an aircraft; each shows the right card; unpin from both sides.

9. **Entity network.** `runAnalystGraph`, `resizeAnalystCanvas`, `resetNetworkView`, wheel and drag, using the constants in 3.4 with violet for same-category edges. Put the edge rule and one simulation step in the model so they are testable (seed the random start through an injected `random`).
   Test: two pins sharing `Iran` get one edge labelled `Iran`; cross-category flag; a step moves linked nodes toward 140 px apart; zoom clamps at 0.3 and 4.
   Delete the 3D helpers and `namesOf` if nothing else imports them.

10. **SYNTHESIZE.** `buildSynthesis` in the model returning the pieces of 1.3 (no `HISTORICAL CONTEXT`); render in the panel; `confidenceFor(text, articles)` per `_postProcessBriefConfidence`; both SYNTHESIZE buttons.
    Test: summary sentence for 1 and 3 pins, with and without breaking; `elevated` only above 4 entities; confidence H, M, L at 4, 2, 0 corroborating headlines.

11. **History search.** `searchStories(query, cat, articles)` in the model (substring on title or summary, category filter, 15 results, dedupe by title); input, select, 400 ms debounce, `+ PIN` / `PINNED`, `NO RESULTS FOUND`. No remote arm.
    Test: query and category filters; already-pinned rows marked.

12. **Narrative timeline.** Port `_buildTimeline` into the model (keywords longer than 4 chars, at least 2 hits, 60 max, grouped by day) and the drawer; `⏱` on each card passes the asset, the tools entry passes none.
    Test: focal versus all-pins subjects; grouping; the two empty messages.

13. **Escalation matrix.** Port `buildEscalationMatrix` scoring into the model (Coranto's whole-word matcher from `corantoBoardModel.js:196-205` with AUSPEX's keyword lists at `:1286`), modal, RECALCULATE, cell click list, row click pins and closes the list.
    Test: diagonal `pinned × 2`, off-diagonal `+3`, live matches capped at 6, the four colour bands at their thresholds.

14. **Saved boards.** SAVE, modal, load, delete, AUSPEX's status messages and title rule (`_generateBoardTitle`). Storage stays `coranto.boards.v1` through the store. On load keep geo assets as geo assets (Coranto stores the whole asset, so AUSPEX's loss does not apply).
    Test: title from places, then categories, then first title; cap 50; load replaces the board.

15. **Model client and prompts.** Create `src/ui/corantoAnalystPrompts.js` holding `ANALYST_PERSONAS` and one function per call returning `{system, user, maxTokens}` with the text of 2.3 to 2.7 verbatim. Add `callModel(system, user, maxTokens)` in `src/ui/corantoAnalystAi.js`: `POST /api/ai`, timeout 55 s above 800 tokens else 30 s, returns `content`, throws on `!ok` or `error`.
    Test: snapshot each prompt against the text in this file for a fixed input (this is the guard against drift); timeout choice; error mapping.

16. **CONSENSUS.** `runConsensusBoard` with the rendering of 2.3. Put the JSON parse, stats (`mean`, `spread`, `agr`), colour rule and hawk/dove pick in the model. Model text goes in with `textContent`; the round 3 paragraphs are built as `<p>` nodes.
    Test with a fake `callModel`: 8 calls in the right order with the right token limits; a card whose reply is not JSON shows `Parse error.` and counts as not ok; `agr` for scores `[50,50,50,50,50]` is 100 and for `[0,25,50,75,100]` is 12; final status counts ok analysts.
    Check with the real key on three pins.

17. **Adversary playbook.** Modal, `generatePlaybook`, header test regex, `exportPlaybook` (file `adversary-playbook-<ms>.html`, built with escaped text).
    Test: `actors` list; header lines versus paragraphs; no-pins messages; the export contains the banner and the text.

18. **Red team.** Modal, `openRedTeamBrief` (closes the board; EXIT reopens it), `generateRedTeamBrief`, `exportRedTeamPDF` (file `red-team-brief-<ms>.html`).
    Test: as 17, with the `/^[A-Z\s]+:$/` rule.

19. **EXPORT BRIEF.** `exportBrief`: page from `:498-522` with violet wordmark, asset table, and the brief column's content re-serialised from the panel's own nodes. File `coranto-brief-<ms>.html`.
    Test: table has one row per pin; the output escapes a title containing `<script>`.

20. **Dead reckoning.** `computeDeadReckoning(articles, countries)` in the model (both the tier map and the top-15 board data, thresholds in 1.2); toggle in the tools menu; board prepended to column 3. Then section 6 row 23: add `setMomentum(map | null)` to `src/ui/corantoAtlas.js` and wire `onMomentum`.
    Test: ratio thresholds 0.5 and 0.2; board thresholds 65 and 35; names of 3 characters or fewer ignored.
    Check: glows appear with the Countries overlay on and clear when toggled off.

21. **CLEAR BOARD.** `clearAssets`: store clear, column 3 back to its empty state, meta `—`, dead reckoning off.
    Test: after clear, the empty texts of 1.1 are back.

22. **Daily brief and conflict brief** (if in scope; they are in `analyst.js` but not on the board). Modal `#brief-modal`, `openDailyBrief` on the first 14 articles, `openConflictBrief(country)` from the country card, `exportDailyBrief`. The model returns HTML: parse it and rebuild only `h3` and `p` text nodes; drop everything else.
    Test: a reply containing `<img onerror>` renders no image; meta strings; the no-coverage sentence is sent when nothing matches.

23. **Watchlist flash and arc trace** (section 6 rows 19 and 20), only where Coranto has the trigger.

24. **Remove the old board.** Delete the dead exports from `corantoBoardModel.js` (`namesOf`, `boardText`, old `buildSynthesis`, `buildTimeline`, `buildMatrix`, `matrixShade` if replaced), the CSS at `coranto.css:3042-3261` and `:3477-3513`, and rewrite `src/ui/corantoBoard.test.mjs`. Update `scripts/package-boundaries.json`.

25. **Words around the board.** Guide text (`corantoShell.js:200`, the string starting `PIN TO BOARD keeps`), command palette entries, README section, `docs/coranto/TODO.md` (fix the line about saved boards and Supabase).

26. **Gates.** `npm test`, `npm run format:check`, `npm run check:boundaries`, then the browser: pin four kinds of item, run every bar button and every tools entry once, export each of the three files and open them, reload and confirm pins persist, repeat at 780 px tall and at a narrow width.

**Left for when a database arrives:** the 90-day archive arm of history search, `HISTORICAL CONTEXT (LAST 30 DAYS)` in SYNTHESIZE, a daily token cap per visitor, synced saved boards. The Supabase table these need is `stories` (`sql/schema.sql:8-29`); the RPC `ai_usage_add` would have to be written, since AUSPEX's repo does not contain it.
