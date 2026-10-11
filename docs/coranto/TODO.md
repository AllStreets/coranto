# Coranto to-do list

Built on 2026-10-11 from the owner's overhaul message, plus the four items
already ordered. AUSPEX reference: `docs/coranto/auspex-feature-study.md`.
Status: `[x]` done, `[~]` partly done, `[ ]` open.

## Already ordered (first)

- [~] **P1 Dock INSTRUMENTS into the news frame.** Same header, ticker and
  columns in both views. Done so far: shared header and ticker. Open: the
  engine's floating panels in the shared columns. Automated browsers keep the
  classic layout the CI gates measure.
- [x] **P2 Government (non-military) aircraft in Watch Power.** From the
  public plane-alert database (ODbL) joined to live ADS-B. Open: selecting
  one by clicking its marker on the globe (rows work).
- [x] **P3 Stories wrongly chained together.** A headline must match a third
  of a story's headlines to join it.
- [ ] **P4 Vercel deployment and public site.** After the overhaul. The AIS
  websocket and on-disk caches need a hosting answer.

## Quick fixes

- [x] **T1 Rail button gap.** SHARE VIEW spans the row. Becomes a MAP KEY
  button when T4 lands.
- [x] **T3 Briefing rows use their topic colour** and show the topic code.
- [x] **T19 Fires.** Works without a key from NASA's public 24-hour files;
  heat cells are now visible at whole-Earth zoom.
- [ ] **T20 Launches.** Works, but turning it on also turns on SATELLITES and
  leaves it on. Decouple or say so.

## Design foundation

- [ ] **T12 One cohesive UI** for NEWS and INSTRUMENTS: one token set, one
  panel chrome, one button style. Show a sample for sign-off first.
- [ ] **T14 Carry the military HUD styling the owner likes** into the news
  side (part of T12).
- [ ] **T13 No emojis or text glyphs.** One SVG icon set. Known offenders:
  the close and plus glyphs in the shell, emoji in the key-setup panel, the
  triangle used as the fires layer icon. Sweep the whole app.

## Globe and map language

- [ ] **T16 Map icon overhaul.** Replace dots with AUSPEX's icon vocabulary:
  category icons for stories, event icons for hazards, city-type icons,
  country status marks.
- [ ] **T18 Ship icons.** Top-down hulls by class (cargo/container, military,
  passenger/cruise), rotated to heading.
- [ ] **T22 Satellite icons**, unless they cost too much to draw.
- [ ] **T17 Stories located on the globe** and clickable, alongside the
  instruments tools.
- [ ] **T4 Map key** generated from what is actually drawn.

## In-app, not out of app

- [ ] **T7 Story pop-ups** for feed cards, briefing rows and globe markers.
- [ ] **T6 Broadcasts in-app**: embedded player and broadcaster markers on
  the globe.
- [ ] **T5 Audit every link that leaves the app**; the publisher link stays
  as attribution inside an in-app surface.
- [ ] **T8 AUSPEX story-popup tools**: pin to analyst, mirrors, blindspot,
  verify, translate, listen, provenance.
- [ ] **T2 Analyst board**, housed in INSTRUMENTS.
- [ ] **T15 Category colours and related stories in INSTRUMENTS.**

## Verify and explain

- [ ] **T10 Test every instruments layer** in a real browser; fix or state
  why it cannot work.
- [ ] **T11 Key audit.** In `.env`: NewsAPI, OpenAI, OpenSky, AISStream,
  FEC. Not set: Google Maps, Cesium ion, Mapillary, TomTom, TfL, Launch
  Library, NASA FIRMS (no longer required).
- [ ] **T9 Plain inventory of INSTRUMENTS** for the owner, and in the guide.
- [ ] **T21 Quality bar.** Default view is globe, feed and rail; every
  advanced tool within two clicks; nothing outside the shared tokens.

## Decisions the owner needs to make

1. Which AUSPEX AI tools to port. Several write text with a model (synthesized
   brief, red-team brief, verify, translate). Coranto's rule is that AI text
   is optional, cited and checked in code; anything that cannot meet that is
   left out.
2. Whether "pin to relief" brings AUSPEX's whole Relief module.
3. Ships: AIS type codes say "passenger", which covers ferries as well as
   cruise ships. Label the class passenger, or find a sourced cruise list.
4. Country conflict and status marks need a sourced, dated basis. AUSPEX
   derived the conflict mark from live headlines; its nuclear, sanctions and
   P5 flags were a hand-kept list.
5. The climate topic is green, and green is otherwise reserved for good news
   and live status. Keep or change.
6. A database for saved boards (AUSPEX used Supabase) or browser-only.
