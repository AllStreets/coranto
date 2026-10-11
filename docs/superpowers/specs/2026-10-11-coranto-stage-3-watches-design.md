# Coranto stage 3: watches, My Briefing, Watch Power and Elections

Date: 2026-10-11
Status: built

## 1. Why

The full feed is hundreds of headlines and must stay available. A reader also
needs a way to see only what they follow. This part adds that without adding
anything that rewrites or ranks the news.

## 2. Watches

`src/ui/watches.js`.

A watch is a saved filter: search words, a place, a topic, a publisher, a
language, good news only, or any mix. **SAVE THIS VIEW** saves whatever the
feed is currently narrowed to; it is disabled while nothing narrows the feed.
A watch is named from its filter, for example `"grain" · Odesa · finance`.

- Watches are stored in the browser under `coranto.watches.v1`. There is no
  account and nothing is sent to a server.
- At most 20 watches. Saving the same filter twice does nothing.
- Each watch records when it was last opened. Stories whose newest headline is
  later than that are counted as new.
- Opening a watch applies its filter to the feed and the globe and marks it
  seen.

## 3. My Briefing

For each watch, the six most recent matching stories: the newest matching
headline in the publisher's own words, the publisher, its age, the outlet
count, and a note when the outlets' figures differ. Each links to the
article. "Mark all as read" resets every watch's new count.

The briefing is selection only. Order is newest first. No model is involved.

## 4. Tests

`src/ui/watches.test.mjs`: matching on each criterion, the language default,
saving, reloading, duplicates, the limit, damaged storage, new-story counts
and marking seen.

## 5. Watch Power lens

`src/ui/corantoPower.js`. A switch at the top of the left rail changes the
rail from topics and watches to the lens.

- Entering switches on the engine's military aircraft and military
  installations layers, and sets the feed to the military topic. Plate-reader
  cameras are offered as a third switch because they load one city at a time.
- AIRBORNE NOW lists up to 60 military aircraft that have a position, named
  callsigns first, with class, altitude and speed as broadcast. A blank or
  junk callsign is replaced by the transponder address.
- Clicking one flies to it and opens a card with those facts and a link to
  its live track at adsb.lol, the source of the data.
- Leaving switches off only the layers the lens switched on, clears its card
  and returns the feed to all coverage.

Scope: the lens shows aircraft that broadcast their own position and sites
and cameras already mapped in OpenStreetMap. It does not identify or follow
individuals.

## 6. Elections lens

`src/sources/elections/`, `src/layers/elections/`, `src/ui/corantoElections.js`.

- `/api/elections` asks the Wikidata Query Service for elections dated in the
  next 120 days and groups them by country and day. A country often has many
  contests on one day; the group leads with one that has an English Wikipedia
  article and counts the rest.
- Dropped: entries with no English name or country, dates stored only to the
  year, and contests titled "next ... election".
- The layer draws one marker per country at the country's point, labelled
  with the date when the poll is within 45 days.
- The lens lists the polling days, narrows the feed to headlines carrying an
  election word (whole words, so "polls" does not match "pollution"), and on
  selecting a polling day flies to the country, opens a card linking to the
  source, and adds the country's name to the feed search.
- With Wikidata unreachable and nothing cached, the lens says so and lists
  nothing. A cached calendar is served as stale.

An official source was the aim. No keyless official calendar covers the
world, so the lens uses Wikidata and says on every entry that it does.

## 7. Left for the rest of stage 3



- Official results and candidate filings where an authority publishes them
  (for the United States, the FEC with an API key).
- Government (non-military) aircraft in Watch Power.
- Markets and live broadcasts from AUSPEX.
- Exporting or sharing a set of watches.
