import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BRIEF_INSTRUCTIONS,
  briefInput,
  briefSources,
  isGrounded,
  validateBrief,
} from './brief.js';

const sources = briefSources([
  {
    id: 'a',
    publisher: 'BBC',
    title: 'Twelve killed and 300 injured in attack on airport in Saudi capital Riyadh',
    summary: 'Saudi authorities blamed the Houthis for the strike.',
    url: 'https://bbc.example/a',
    publishedAt: '2026-10-10T10:00:00.000Z',
  },
  {
    id: 'b',
    publisher: 'NPR',
    title: 'Attack on Riyadh airport killed 12 people and wounded over 300 more, Saudi authorities say',
    summary: '',
    url: 'https://npr.example/b',
    publishedAt: '2026-10-10T10:05:00.000Z',
  },
  {
    id: 'c',
    publisher: 'France 24',
    title: "Saudi Arabia vows 'decisive response' after deadly Houthi strike on Riyadh airport",
    summary: 'Flights were suspended, the aviation authority said.',
    url: 'https://f24.example/c',
    publishedAt: '2026-10-10T11:00:00.000Z',
  },
]);
const reply = (value) => JSON.stringify(value);

test('the model sees only numbered sources and is told to cite them', () => {
  const input = briefInput(sources);
  assert.match(input, /^\[1\] BBC\nHeadline: Twelve killed/);
  assert.match(input, /\[2\] NPR\nHeadline: Attack on Riyadh/);
  assert.doesNotMatch(input, /https?:/);
  assert.match(BRIEF_INSTRUCTIONS, /ONLY the numbered sources/);
});

test('a cited, supported sentence is kept with its outlet count', () => {
  const brief = validateBrief(
    reply({
      sentences: [
        { text: 'An attack on Riyadh airport killed 12 people and injured about 300.', cites: [1, 2] },
      ],
      claims: [{ text: 'Saudi authorities blamed the Houthis.', cites: [1] }],
    }),
    sources,
  );
  assert.deepEqual(brief.sentences, [
    { text: 'An attack on Riyadh airport killed 12 people and injured about 300.', cites: [1, 2], outlets: 2 },
  ]);
  assert.equal(brief.claims[0].outlets, 1);
  assert.equal(brief.removed, 0);
});

test('a sentence with no citation, or citing a source never supplied, is removed', () => {
  const brief = validateBrief(
    reply({
      sentences: [
        { text: 'Flights were suspended.', cites: [] },
        { text: 'Flights were suspended.', cites: [9] },
        { text: 'Flights were suspended.', cites: [3] },
      ],
    }),
    sources,
  );
  assert.deepEqual(brief.sentences.map((s) => s.cites), [[3]]);
  assert.equal(brief.removed, 2);
});

test('a figure the cited sources do not give is removed', () => {
  const brief = validateBrief(
    reply({
      sentences: [
        { text: 'The attack killed 45 people.', cites: [1, 2] },
        { text: 'The attack killed twelve people.', cites: [2] },
      ],
    }),
    sources,
  );
  // "twelve" is the same figure as the "12" source 2 gives.
  assert.deepEqual(brief.sentences.map((s) => s.text), ['The attack killed twelve people.']);
  assert.equal(brief.removed, 1);
});

test('a name the cited sources do not contain is removed', () => {
  const brief = validateBrief(
    reply({
      sentences: [
        { text: 'The strike was ordered by General Hassan.', cites: [1] },
        { text: 'The claim rests on Iran, which source 2 never mentions.', cites: [2] },
        { text: 'Saudi Arabia vowed a decisive response.', cites: [3] },
      ],
    }),
    sources,
  );
  assert.deepEqual(brief.sentences.map((s) => s.cites), [[3]]);
  assert.equal(brief.removed, 2);
});

test('support must come from the sources actually cited, not any source', () => {
  // Source 3 mentions flights; source 2 does not mention the Houthis.
  assert.equal(isGrounded('The Houthis were blamed.', [sources[1]]), false);
  assert.equal(isGrounded('The Houthis were blamed.', [sources[0]]), true);
});

test('a reply that is not the requested JSON, or where nothing survives, yields no brief', () => {
  assert.equal(validateBrief('I think this story is about an attack.', sources), null);
  assert.equal(validateBrief('{"sentences": [', sources), null);
  assert.equal(
    validateBrief(reply({ sentences: [{ text: 'Oil hit $140 a barrel.', cites: [1] }] }), sources),
    null,
  );
  assert.equal(validateBrief('', sources), null);
});

test('JSON wrapped in other text is still read, and limits are enforced', () => {
  const many = Array.from({ length: 9 }, () => ({ text: 'Flights were suspended.', cites: [3] }));
  const brief = validateBrief('```json\n' + reply({ sentences: many, claims: many }) + '\n```', sources);
  assert.equal(brief.sentences.length, 5);
  assert.equal(brief.claims.length, 6);
});
