# Coranto stage 3, part 1: watches, My Briefing and Watch Power

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

## 6. Left for the rest of stage 3


- An Elections lens from official sources.
- Government (non-military) aircraft in Watch Power.
- Markets and live broadcasts from AUSPEX.
- Exporting or sharing a set of watches.
