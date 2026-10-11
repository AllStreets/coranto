# Coranto stage 4: polish (in progress)

Date: 2026-10-11
Status: first part built

## Built

- **Shareable views** (`src/ui/corantoLink.js`). SHARE VIEW copies the page
  address with a `c` query value holding the lens, search words, topic, place,
  publisher, language and good-news switch. The engine's camera fragment is
  kept beside it. Opening such a link switches to the news view, turns the
  news layer on and applies the view once the first headlines arrive. The link
  holds a filter only. A malformed value is ignored.
- **Tracking cards** (`src/ui/corantoContact.js`). In the news view, whatever
  the engine has selected (an aircraft, a ship, a mapped site) opens a card of
  the record's own fields. Aircraft link to their live track at adsb.lol by
  transponder address; vessels link to marinetraffic.com by MMSI.
- **Paged feed.** 60 cards are drawn at a time with a button for the next 60.
- **Keyboard.** `/` focuses the search; Esc clears it.
- **First visit.** The guide opens once, with a short welcome. Automated
  browsers are left alone.
- **Election calendar reliability.** The Wikidata query reads English names
  from `rdfs:label` directly; the label service made it time out. One retry,
  and the last good read is saved to `.gev-cache/elections-v1.json` and served
  as stale when Wikidata is down.

- **Place names in four more languages** (`src/sources/news/placeNames.js`).
  Country and major city names as written in French, Spanish, German and
  Portuguese map to places already in the gazetteer. Names that are ambiguous
  as a capitalised word are left out. On a live run the share of placed
  headlines rose from 29 to 38 of 41 in German, 24 to 65 of 70 in Portuguese,
  10 to 25 of 33 in Spanish and 11 to 17 of 20 in French.
- **Narrow windows and phones.** Below 1100 px a MENU button opens the rail
  as a panel. Below 760 px the globe sits above the feed and the INSTRUMENTS
  switch is hidden, since the control room needs a large screen.
- **Ticker language.** The ticker shows the same language as the feed.

- **Arabic place names.** Arabic has no capitals and joins short particles
  onto the next word, so these names have their own pattern that allows one
  leading particle. On a live run 13 of 25 Arabic headlines were placed.
- **Copy My Briefing as text**, with each headline's publisher, time and link.

## Next

- The INSTRUMENTS view still looks like God's Eye View apart from colour and
  type. It needs its own pass.
- A real logo and wordmark.
