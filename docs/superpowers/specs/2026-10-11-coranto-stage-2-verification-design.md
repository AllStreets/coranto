# Coranto stage 2: stories, outlet counts and checked AI briefs

Date: 2026-10-11
Status: built (first part)

## 1. Outcome

The feed shows one card per story, with the outlets that carried it. A story
covered by several outlets can be summarised by a model, and nothing the
model writes reaches the screen unless code can tie it to the outlets' own
words.

This is the first part of stage 2. Section 6 lists what is left.

## 2. Story grouping

`src/sources/news/cluster.js`, run server-side on every refresh.

- A headline is reduced to its significant words: lower-case, four letters or
  more, plural endings folded, filler words, month and weekday names and years
  removed. Figures such as "300" and "7.7" are kept.
- Two headlines are the same story when they share at least three of those
  words and either half of the shorter headline, four words that are 40% of
  it, or a third of the two combined.
- Two headlines pinned to different cities or regions are never the same
  story.
- An article joins the first story with any matching member. Every article is
  in exactly one story.
- `outlets` is the number of distinct publishers in the story.

No model is involved. Grouping is an inference: the outlets chip says
"grouped automatically by shared headline words" and expands to every
headline with its own link. EVERY HEADLINE in the feed header turns grouping
off.

Known limits: a chain of loosely related headlines can pull two stories
together, and one story told in very different words can stay split.

## 3. Checked AI briefs

`src/sources/news/brief.js` and `POST /api/news/brief`.

1. The server numbers the story's articles (at most 12) and sends the model
   only each one's publisher, headline and summary. No links, no other text.
2. The model must reply with JSON: sentences and separate factual claims, each
   with the source numbers it rests on.
3. `validateBrief` removes any sentence or claim that
   - cites no source, or a number that was not supplied;
   - contains a figure found in none of the sources it cites
     ("twelve" and "12" count as the same figure);
   - contains a capitalised name found in none of the sources it cites.
4. What survives is returned with, for each item, its citations and the number
   of distinct outlets among them. The count of removed items is returned too.
5. If the reply is not the requested JSON, or nothing survives, no text is
   shown.

The interface labels the result "AI-written, checked against the sources",
shows each citation as a numbered link to the article, marks each claim with
"N outlets" or "1 outlet", and states how many statements were removed and
which model wrote it.

The route is a cost endpoint: same-site gated and rate limited like the
engine's other model routes. The key stays server-side and travels in a
header. Results are cached per story for 30 minutes. Provider error text is
never relayed. Without `OPENAI_API_KEY` the route answers "not configured" and
the interface says briefs are optional.

The model defaults to the engine's small summary model and can be set with
`CORANTO_BRIEF_MODEL`.

### What the check does and does not prove

It proves that every figure and name in a shown sentence appears in an article
that sentence cites. It does not prove the sentence states the relationship
between them correctly, and it does not check the outlets themselves. The
citations are there so a reader can.

## 4. Honesty rules

Rule 5 from stage 1 is now implemented: AI-written text is labelled, every
sentence cites specific feed items, and code removes sentences without
support. Rules 1 to 4 are unchanged.

## 5. Tests

- `cluster.test.mjs`: grouping, distinct-publisher counting, the
  different-places guard, stable ids.
- `brief.test.mjs`: uncited, wrongly cited, unsupported-figure and
  unsupported-name sentences are removed; support must come from the cited
  sources specifically; malformed replies yield nothing.
- `news.test.mjs`: the brief route end to end with an injected model, the
  cache, failure and keyless responses, and that the model is sent no links
  and no key.

## 6. Left for the rest of stage 2

- Coverage comparison across regions for one story (AUSPEX's Divergence).
- Noting when a region's outlets are silent on a story (AUSPEX's Silence).
- Flagging when outlets give different figures for the same thing.
- Non-English sources.
