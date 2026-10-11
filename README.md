<div align="center">

# CORANTO

**EVERY STORY HAS A PLACE AND A DATE**

<img alt="news" src="https://img.shields.io/badge/news-real_headlines_·_real_links-34E08A?style=for-the-badge&labelColor=04070b"/>
<img alt="sources" src="https://img.shields.io/badge/news_sources-28_named_·_health_shown-34E08A?style=for-the-badge&labelColor=04070b"/>
<img alt="live layers" src="https://img.shields.io/badge/live_layers-32-34E08A?style=for-the-badge&labelColor=04070b"/>
<img alt="AI text" src="https://img.shields.io/badge/AI--written_text-none-A3E635?style=for-the-badge&labelColor=04070b"/>
<img alt="keys" src="https://img.shields.io/badge/API_keys-none_required-34E08A?style=for-the-badge&labelColor=04070b"/>
<a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-34E08A?style=for-the-badge&labelColor=04070b"/></a>
<br/>
<img alt="globe" src="https://img.shields.io/badge/globe-CesiumJS_·_photoreal_3D-6b7382?style=flat-square&labelColor=04070b"/>
<img alt="feeds" src="https://img.shields.io/badge/feeds-RSS_·_GDELT_·_GDACS_·_NASA_·_USGS_·_ADS--B_·_AIS_·_NOAA-6b7382?style=flat-square&labelColor=04070b"/>
<img alt="built on" src="https://img.shields.io/badge/built_on-God's_Eye_View_+_AUSPEX-6b7382?style=flat-square&labelColor=04070b"/>
<img alt="tests" src="https://img.shields.io/badge/tests-node:test_·_browser_gates-6b7382?style=flat-square&labelColor=04070b"/>

</div>

---

<p align="center">
  <img src="docs/media/coranto/world-news.png" alt="Coranto: current headlines pinned to the places they name, with the feed on the right" width="100%"/>
</p>

<p align="center"><em>569 current stories from 25 live sources, pinned to the places they name, with an erupting volcano selected from the hazards layer. Every card is the publisher's own headline and opens the original.</em></p>

<p align="center">
<a href="#what-this-is">What this is</a> ·
<a href="#why-it-exists">Why it exists</a> ·
<a href="#the-honesty-rules">The honesty rules</a> ·
<a href="#how-to-use-it">How to use it</a> ·
<a href="#quickstart">Quickstart</a> ·
<a href="#sources">Sources</a> ·
<a href="#how-it-is-built">How it is built</a> ·
<a href="#roadmap">Roadmap</a> ·
<a href="#credits">Credits</a>
</p>

---

## What this is

**Coranto is an open-source instrument for staying informed with real, sourced news on a live globe.**

The corantos were the first printed newspapers, in the 1620s. Each item was
headed with the place it came from and the date. Coranto does the same thing
four centuries on: it reads public news feeds, pins each story to the place its
own text names, and shows you the publisher, the time and the link. Nothing
else is added.

It is built from two projects:

- **[God's Eye View](https://github.com/bilawalsidhu/gods-eye-view)** supplies
  the engine: a photoreal CesiumJS globe with live aircraft, ships, satellites,
  earthquakes, weather and cameras, all from public sources.
- **[AUSPEX](https://github.com/AllStreets/AUSPEX)** supplies the purpose and
  the look: a calm news instrument that carries good news beside bad and never
  dresses a guess as a fact.

```
  the instrument
  ├─ the feed ......... publisher headlines, newest first, each linked to its source
  ├─ search ........... keep only the stories that mention your words
  ├─ the globe ........ one marker per place the stories name; rings where approximate
  ├─ source health .... which feeds answered, which did not, and when
  ├─ good news ........ headlines tagged as progress: medical, science, space, humanity
  ├─ hazards .......... cyclones, floods, volcanoes, quakes, fires from GDACS and NASA
  ├─ live layers ...... aircraft, military flights, ships, satellites, storms, launches
  └─ instruments ...... the full control room: tracking, cameras, weather, voice
```

---

## Why it exists

Knowing what is happening in the world, early and across domains, has mostly
belonged to governments and to people who can pay for terminals. The raw
material is public: publisher feeds, aircraft transponders, ship beacons,
orbital elements, seismographs, disaster alerts. What has been missing is one
instrument that gathers it, shows it honestly, and belongs to anyone.

Coranto aims at two things at once:

- **The whole picture stays available.** Every source, every layer, undigested,
  for anyone who wants to look for themselves.
- **You can narrow it to what you care about.** Search, topics, places and
  filters cut the stream down without anything rewriting it for you. Saved
  searches and personal briefings are on the roadmap.

---

## The honesty rules

These are enforced in code and by tests that fail the build if they are broken.

| Rule | What it means |
|---|---|
| **Source and time** | Every item has a publisher, a working link, the feed's own publish time and the time Coranto fetched it. An item missing any of these is dropped, never patched. |
| **No seeded content** | The code contains no sample or fallback stories. When feeds are down the screen says so and shows nothing in their place. |
| **No randomness in data** | A story sits on a real coordinate with its precision shown, or it is not placed. No position is ever nudged. |
| **Inference is labelled** | A story's location and topic are worked out from its text. The card shows the exact words that were matched, and topics are marked as automatic tags. |
| **No AI-written text** | Every word of news on screen is the publisher's own headline or summary. |

<table>
<tr>
<td width="50%"><img src="docs/media/coranto/place-and-sources.png" alt="A place selected, with the per-source health list open" width="100%"/></td>
<td width="50%"><img src="docs/media/coranto/good-news.png" alt="The Good news filter" width="100%"/></td>
</tr>
<tr>
<td><em>Click a marker and the feed narrows to that place. The source list shows what answered: here two feeds are down and named as down.</em></td>
<td><em>Good news narrows the feed to headlines tagged as progress. The tag is automatic and cautious; it says so on the card.</em></td>
</tr>
</table>

---

## How to use it

Coranto has two views, switched at the top right.

### NEWS

| To do this | Do this |
|---|---|
| Read a story | Click its headline. It opens the original article in a new tab. |
| See where stories are | Look at the gold markers. A solid dot is a city. A hollow ring is a country or region, so the position is approximate. |
| See one place's stories | Click its marker. Clear the filter with the chip at the top of the feed. |
| Check why a story is where it is | Read the line under the summary, for example `Kyiv · city · matched "Kyiv" in headline`. Click it to fly there. |
| Search | Type in the box above the feed. Stories must contain every word, in the headline, summary, publisher or place. |
| Narrow by topic | Use the list on the left. |
| See only good news | Click **GOOD NEWS**. |
| Check the sources | Click the **LIVE** badge. It lists every source and whether it answered. |
| Add live layers | Use the buttons along the top: hazards, flights, military, ships, satellites, quakes, fires, storms, launches, cables. |
| Read a hazard | Click its marker. A card shows what it is, the tracker's alert level and a link to the tracker's report. Red means the tracker issued a Red alert, nothing else. |
| Get back to the whole globe | Click **WHOLE EARTH**. |
| Move the globe | Drag to spin, scroll to zoom, hold Ctrl or the right button and drag to tilt. |

The **GUIDE** button in the app shows the same instructions.

### INSTRUMENTS

The full God's Eye View control room, for when you want to go past the
headlines: click any aircraft or ship to track it, ride in a cockpit view,
open public cameras, replay weather, change the visual style, talk to the map,
and copy a share link. Its own guide is in
[docs/GODS-EYE-VIEW-README.md](docs/GODS-EYE-VIEW-README.md).

<table>
<tr>
<td width="50%"><img src="docs/media/coranto/live-layers.png" alt="News with live flights, military aircraft and earthquakes" width="100%"/></td>
<td width="50%"><img src="docs/media/coranto/instruments.png" alt="The Instruments view" width="100%"/></td>
</tr>
<tr>
<td><em>Europe with flights, ships, military aircraft, quakes and hazards on: 5,962 aircraft and 8,143 vessels at the moment of capture. The source list shows 25 of 28 news sources answering.</em></td>
<td><em>Instruments: the same globe with the full control room around it.</em></td>
</tr>
</table>

---

## Quickstart

You need Node.js 24.14 or later. No account and no API key.

```bash
git clone https://github.com/AllStreets/coranto.git
cd coranto
nvm install 24.14.0 && nvm use 24.14.0
npm ci
npm run dev
```

Open **http://localhost:4173**. The news view loads with headlines on.

### Keys that switch more on

Nothing needs a key. Each of these adds a feed. Put them in a `.env` file in
the project folder (it is gitignored; see `.env.example`), or paste them into
**POWER UP** in the Instruments view.

| Key | What it adds |
|---|---|
| `AISSTREAM_API_KEY` | Live ships worldwide (AIS) |
| `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | Fuller live aircraft coverage (ADS-B); works without, at a lower rate |
| `NEWS_API_KEY` | One more news source |
| `FIRMS_MAP_KEY` | NASA active-fire detections |
| `CESIUM_ION_TOKEN` or `GOOGLE_MAPS_API_KEY` | Photoreal 3D cities |
| `OPENAI_API_KEY` | Voice control |

---

## Sources

| Region or beat | Sources | Needs a key |
|---|---|---|
| Europe | BBC, The Guardian, DW, France 24, Euronews | No |
| Middle East | Al Jazeera | No |
| Asia and Pacific | South China Morning Post, The Straits Times, CNA, The Japan Times, The Hindu, The Times of India, ABC News (Australia) | No |
| Africa | Africanews, AllAfrica, Premium Times | No |
| Americas | NPR, ProPublica, Buenos Aires Times | No |
| International bodies | UN News, ReliefWeb, WHO | No |
| Science and space | Nature, ScienceDaily, Ars Technica, NASA | No |
| Indexes | GDELT | No |
| Indexes | NewsAPI | Yes, optional |

Natural hazards come from **GDACS** (the UN and European Commission's disaster
alert system) and **NASA EONET**. Both are keyless.

Coranto shows the headline, the publisher's own summary and a link. It does not
copy article bodies or images.

Two things to know:

- **The list is English-language.** It now spans every inhabited continent,
  but non-English outlets are not read yet.
- **Some sources will be down.** GDELT rate-limits, and ReliefWeb and UN News
  sometimes refuse or time out. Coranto reports them as down; the feed works
  on the rest.

Stories are filtered before display: adverts, PR copy, entertainment and
anything older than 48 hours are left out. The feed shows how many items were
left out and why. The filter lists are in `src/sources/news/junk.js`.

Every other feed (aircraft, ships, satellites, earthquakes, weather, cameras)
is documented in [DATA_SOURCES.md](DATA_SOURCES.md).

---

## How it is built

```
   browser                                        local server (Vite)
┌───────────────────────────────────┐          ┌───────────────────────────────────┐
│ Coranto shell                     │          │ /api/news                         │
│  header · ticker · topics · feed  │  ◄─────  │  reads each source, 8 s deadline  │
│                                   │   JSON   │  drops items with no source/date  │
│ news layer on the Cesium globe    │          │  matches places, tags topics      │
│  one marker per matched place     │          │  reports which sources answered   │
│                                   │          │                                   │
│ God's Eye View engine             │  ◄─────  │ flights · ships · space · weather │
│  layers · tracking · instruments  │          │  (the engine's own providers)     │
└───────────────────────────────────┘          └───────────────────────────────────┘
```

| Part | Where |
|---|---|
| Record rules, place matching, topic and good-news tags | `src/sources/news/` |
| News route | `server/providers/news.js` |
| News globe layer | `src/layers/news/` |
| Hazard records, route and layer | `src/sources/hazards/`, `server/providers/hazards.js`, `src/layers/hazards/` |
| Shell and feed | `src/ui/corantoShell.js`, `src/ui/newsPanel.js` |
| Look | `src/ui/styles/coranto.css`, `build/corantoTheme.js` |
| Design spec | `docs/superpowers/specs/` |

```bash
npm test                 # unit tests, including the honesty gates
npm run format:check
npm run check:boundaries
npm run build
```

---

## Roadmap

| Stage | Status |
|---|---|
| **1. Foundation and truth feed** | Built: sourced feed from 28 sources, search, globe layer, source health, good-news tag, natural hazards, AUSPEX-style shell |
| **2. Verification** | Next: the same story across outlets, a count of independent sources, claim-by-claim checks, AI briefs where every sentence cites its source |
| **3. Lenses and your own feed** | Saved searches and a personal briefing built from them; Good News, Elections (from official sources) and Watch Power (government aircraft, plate-reader locations, public cameras); markets and live broadcasts from AUSPEX |
| **4. Beauty pass** | Full visual identity and a guided first run |
| **5. Public site** | A hosted version anyone can open |

Coranto currently runs on your own machine. There is no hosted version yet.

---

## Credits

Coranto is a fork of **[God's Eye View](https://github.com/bilawalsidhu/gods-eye-view)**
by Bilawal Sidhu (MIT), and carries the news pipeline, palette and principles
of **[AUSPEX](https://github.com/AllStreets/AUSPEX)** by Connor Evans
(Apache-2.0).

Coranto's own code is Apache-2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE).
God's Eye View's licence and its note on third-party data are kept in
[LICENSE-gods-eye-view](LICENSE-gods-eye-view). Some bundled datasets, notably
the TeleGeography submarine cable map, are licensed for non-commercial use
only.

Headlines and summaries belong to their publishers.
