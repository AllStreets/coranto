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

## Next

- The INSTRUMENTS view still looks like God's Eye View apart from colour and
  type. It needs its own pass.
- A real logo and wordmark.
- Phone layout: the feed and globe stack below 760 px but have not been
  tuned.
