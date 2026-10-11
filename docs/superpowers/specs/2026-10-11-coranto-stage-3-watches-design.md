# Coranto stage 3, part 1: watches and My Briefing

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

## 5. Left for the rest of stage 3

- Good News, Elections and Watch Power lenses.
- Markets and live broadcasts from AUSPEX.
- Exporting or sharing a set of watches.
