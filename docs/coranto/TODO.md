# Coranto to-do list

Built on 2026-10-11 from the owner's overhaul message, plus the four items
already ordered. AUSPEX reference: `docs/coranto/auspex-feature-study.md`.
Status: `[x]` done, `[~]` partly done, `[ ]` open.

## Already ordered (first)

- [~] **P1 INSTRUMENTS in the news frame.** Done: shared header and ticker,
  the same panel chrome, brand-coloured readouts kept below the ticker,
  icons in the layer list, headlines on in both views. The panels still
  float where the engine puts them rather than sitting in fixed columns;
  its layout solver is left alone on purpose. Open: panels dragged under the
  header.
- [x] **P2 Government (non-military) aircraft in Watch Power.** From the
  public plane-alert database (ODbL) joined to live ADS-B. Open: selecting
  one by clicking its marker on the globe (rows work).
- [x] **P3 Stories wrongly chained together.** A headline must match a third
  of a story's headlines to join it.
- [ ] **P4 Vercel deployment and public site.** After the overhaul. The AIS
  websocket and on-disk caches need a hosting answer.

## Quick fixes

- [x] **T1 Rail button gap.** Filled by the MAP KEY button.
- [x] **T3 Briefing rows use their topic colour** and show the topic code.
- [x] **T19 Fires.** Works without a key from NASA's public 24-hour files;
  heat cells are now visible at whole-Earth zoom.
- [x] **T20 Launches.** Works. It needs the satellites layer, switches it on
  while it is on and restores it afterwards; the button now says so.

## Design foundation

- [~] **T12 One cohesive UI** for NEWS and INSTRUMENTS. The owner approved
  the sample (`docs/media/coranto/ui-sample.png`) on 2026-10-11: bracket
  panels, mono label strips, icons on every row, crisp icons on the globe,
  text on the globe only where the lens calls for it. Applied so far: icons
  on topics and layer chips, bracket panels in the rail, the globe frame,
  lens-aware labels. Open: label strips with counts, the one-row lens bar
  with BOARD, the story pop-up, restyling INSTRUMENTS panels to match.
- [ ] **T14 Carry the military HUD styling the owner likes** into the news
  side (part of T12).
- [x] **T13 No emojis or text glyphs.** One SVG icon set of 62 icons. Done:
  the news view, the layer list, visual presets, display toggles, share and
  search buttons, collapse buttons, location line, key tiers, radio and
  replay transport, key-setup links, panel disclosure arrows, the HUD's
  corners and live mark. A scan of the rendered INSTRUMENTS view finds no
  emoji, arrow or box character left on screen. Open: the coloured bullet in
  the radio category menu (a menu option cannot hold an icon), and emoji
  inside spoken or written directions text.

## Globe and map language

- [~] **T16 Map icon overhaul.** Done: topic icons for stories, event icons
  for hazards, a shared icon module (`src/data/corantoIcons.js`). Open:
  city-type icons, country status marks, elections, quakes, launches.
- [x] **T18 Ship icons.** Top-down hulls by class, rotated to heading.
- [x] **T22 Satellite icons** on the named catalogue (about a thousand); the
  Starlink shell stays as dots. No frame-rate cost measured.
- [ ] **T17 Stories located on the globe** and clickable, alongside the
  instruments tools.
- [~] **T4 Map key** generated from what is actually drawn. Done for
  stories, hazards, elections, fires and government aircraft. Open: the
  engine's own layers (flights, ships, satellites, quakes, launches).

## In-app, not out of app

- [x] **T7 Story pop-ups** for feed cards, briefing rows and single-story
  places. Tools so far: AI brief, who covered, figures, fly to, listen.
- [x] **T6 Broadcasts in-app**: embedded player and newsroom pins on the
  globe. Open: dragging and resizing the panel; picking the channel that
  fits the open story, as AUSPEX did.
- [ ] **T5 Audit every link that leaves the app**; the publisher link stays
  as attribution inside an in-app surface.
- [ ] **T8 AUSPEX story-popup tools**: pin to analyst, mirrors, blindspot,
  verify, translate, listen, provenance.
- [x] **T2 Analyst board**, opened from the header in both views. Pins,
  connections, computed brief and timeline, saved boards in the browser.
  Also done: the 3D connections graph, the topic matrix. Aircraft, ships and
  sites pin from their cards and are kept as they were at that moment. Open:
  history search over a database archive.
- [~] **T15 Category colours and related stories in INSTRUMENTS.** Done:
  story markers with topic icons and a stories card; stories near a
  selected aircraft, ship or site in the news view.

## Atlas (copied from AUSPEX, 2026-10-11)

- [x] **T25 Borders, front lines, countries and cities overlays**, as AUSPEX
  drew them (`src/ui/corantoAtlas.js`, data in `public/coranto-atlas/`).
  Also done: live conflict marks and headline activity from current
  headlines, pinning countries and cities to the board. Open: the AUSPEX
  city panel's two briefs, the regions/threat overlay.

## More data

- [x] **T23 A week of stories.** 7-day retention with merged feed reads and a
  time-range control. Open: a database archive for history beyond a week and
  search across it, as AUSPEX had with Supabase.
- [x] **T24 Relief lens on official data** (owner said yes 2026-10-11).
  Done: RELIEF lens with UNHCR displacement by country of origin and WHO
  outbreak notices (listed, marked on the globe, in the map key), beside
  humanitarian news. Not AUSPEX's model-written version. Open: ReliefWeb
  reports (its API needs an approved app name) and IPC famine classification
  (needs a key); the lens says the second is missing.

## Verify and explain

- [x] **T10 Test every instruments layer** in a real browser. All 30 were
  switched on and read back on 2026-10-11: see `docs/coranto/INSTRUMENTS.md`.
  Open: the tools that are not layers (voice, cockpit view, scenes, share
  links, visual presets) have not been exercised one by one.
- [x] **T11 Key audit** (table in `docs/coranto/INSTRUMENTS.md`). In `.env`: NewsAPI, OpenAI, OpenSky, AISStream,
  FEC. Not set: Google Maps, Cesium ion, Mapillary, TomTom, TfL, Launch
  Library, NASA FIRMS (no longer required).
- [x] **T9 Plain inventory of INSTRUMENTS**: `docs/coranto/INSTRUMENTS.md`.
- [ ] **T21 Quality bar.** Default view is globe, feed and rail; every
  advanced tool within two clicks; nothing outside the shared tokens.

## Decisions (answered 2026-10-11)

1. Port only the AUSPEX AI tools that can cite their sources and be checked
   in code.
2. Relief: do not port AUSPEX's model-written module; rebuild it as a lens
   on official humanitarian data (T24).
3. Ships: one "passenger" class for ferries and cruise ships.
4. Country marks: conflict as a derived, labelled mark; the nuclear-armed
   states mark is in. Sanctions and P5 flags stay out until sourced. All
   icons must be crisp at their on-screen size.
5. Climate stays green; good news is a different green (lime `#a8e05f`).
6. Saved analyst boards go in a database, as AUSPEX did.
7. Uniform UI: build one sample screen for sign-off before restyling.
