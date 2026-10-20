import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  ANALYST_PERSONAS,
  MARKINGS,
  PROMPTS,
  articleToStory,
  boardTitleFor,
  briefBlocks,
  buildAssetContext,
  cardBadge,
  computeTrajectory,
  confidenceFor,
  conflictStories,
  consensusStats,
  deadReckoning,
  esc,
  escalationMatrix,
  geoOf,
  graphEdges,
  graphProject,
  graphRotate,
  graphUnrotate,
  isPlaybookHeader,
  isRedTeamHeader,
  matrixRisk,
  parseAnalyst,
  relativeTime,
  replyLines,
  searchStories,
  stepGraph,
  stepGraph3,
  synthesisParts,
  timelineFor,
  toStory,
} from './corantoAnalystModel.js';
import { createBoardStore } from './corantoBoardModel.js';

const NOW = Date.UTC(2026, 9, 12, 12);
const iso = (minutesAgo) => new Date(NOW - minutesAgo * 60_000).toISOString();
const article = (id, title, category, extra = {}) => ({
  id,
  title,
  summary: extra.summary ?? '',
  publisher: extra.publisher ?? 'Reuters',
  url: `https://example.org/${id}`,
  publishedAt: extra.publishedAt ?? iso(120),
  category,
  place: extra.place ?? null,
});
const storyAsset = (key, title, category, extra = {}) => ({
  key,
  kind: 'story',
  title,
  summary: extra.summary ?? '',
  publisher: 'Reuters',
  publishedAt: extra.publishedAt ?? iso(120),
  category,
  place: extra.place ?? '',
});

test('a pin reads as AUSPEX read a story: domain, breaking, archive', () => {
  const fresh = toStory(
    storyAsset('s1', 'Iran talks resume', 'geopolitics', {
      publishedAt: iso(24),
      place: 'Iran',
    }),
    NOW,
    new Set(['s1']),
  );
  assert.equal(fresh.cat, 'geo');
  assert.equal(fresh.brk, true, 'under 25 minutes old');
  assert.equal(fresh.region, 'Iran', 'the place, not the outlet');
  assert.equal(fresh._hist, false);
  const older = toStory(
    storyAsset('s2', 'Chip export rules', 'technology', {
      publishedAt: iso(26),
    }),
    NOW,
    new Set(['s1']),
  );
  assert.equal(older.brk, false);
  assert.equal(older._hist, true, 'no longer in the headlines held');
  assert.deepEqual(cardBadge(older), {
    geo: false,
    text: 'TECH',
    breaking: false,
    archive: true,
  });
  assert.equal(relativeTime(NOW - 60_000, NOW), 'just now');
  assert.equal(relativeTime(NOW - 12 * 60_000, NOW), '12 min ago');
  assert.equal(relativeTime(NOW - 3 * 3_600_000, NOW), '3 hr ago');
});

test('the asset context is AUSPEX’s, line for line', () => {
  const country = toStory(
    {
      key: 'country:Iran',
      kind: 'country',
      title: 'Iran',
      geo: geoOf('country', {
        name: 'Iran',
        iso2: 'IR',
        lat: 32,
        lng: 53,
        conflict_active: true,
        strategic_tier: 1,
      }),
    },
    NOW,
  );
  const city = toStory(
    {
      key: 'city:Tehran',
      kind: 'city',
      title: 'Tehran',
      geo: geoOf(
        'city',
        {
          name: 'Tehran',
          iso2: 'IR',
          lat: 35.6892,
          lng: 51.389,
          tier: 1,
          type: 'capital',
        },
        'Iran',
      ),
    },
    NOW,
  );
  const contact = toStory(
    {
      key: 'contact:a1',
      kind: 'contact',
      title: 'SDN01',
      summary: 'Military aircraft over Sudan',
      publisher: 'MILITARY AIRCRAFT',
    },
    NOW,
  );
  const story = toStory(
    storyAsset('s1', 'Iran talks resume', 'military', {
      summary: 'In Vienna.',
    }),
    NOW,
  );
  assert.equal(
    buildAssetContext([city, country, contact, story]),
    [
      '[GEO/CITY] Tehran, Iran — Type: CAPITAL · Coords: 35.69, 51.39 · Strategic tier: 1',
      '[GEO/COUNTRY] Iran — ACTIVE CONFLICT · GDP: — · Mil spend: — · Strategic tier: 1',
      '[GEO/CONTACT] SDN01 — Military aircraft over Sudan',
      '[MIL] Iran talks resume: In Vienna.',
    ].join('\n'),
  );
  assert.equal(country.title, 'Iran — Country Intelligence Profile');
  assert.equal(country.cat, 'military', 'a country in conflict');
  assert.equal(city.title, 'Tehran — Capital Asset');
  assert.equal(cardBadge(contact).text, 'CONTACT ASSET');
});

test('the store keeps a pin’s country facts and nothing else', () => {
  const storage = new Map();
  const options = {
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  };
  const store = createBoardStore(options);
  store.toggle({
    key: 'country:Iran',
    kind: 'country',
    title: 'Iran',
    geo: {
      name: 'Iran',
      iso2: 'IR',
      nuclear_armed: false,
      un_p5: true,
      evil: '<script>',
    },
  });
  const [kept] = createBoardStore(options).list();
  assert.deepEqual(kept.geo, { name: 'Iran', iso2: 'IR', un_p5: true });
  assert.equal(store.save('IRAN · TEST').title, 'IRAN · TEST');
});

test('trajectory counts other headlines sharing the place words', () => {
  const s = { id: 'x', title: 'Strike reported', region: 'Ukraine' };
  const others = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: `n${i}`,
      title: `Ukraine update ${i}`,
      summary: '',
    }));
  assert.equal(computeTrajectory(s, others(1)).dir, 'down');
  assert.equal(computeTrajectory(s, others(2)).dir, 'mid');
  assert.equal(computeTrajectory(s, others(4)).dir, 'up');
  assert.equal(
    computeTrajectory(s, [{ id: 'x', title: 'Ukraine', summary: '' }]).dir,
    'down',
    'the pin itself is not counted',
  );
});

test('pins link through a shared entity; the layout pulls them together', () => {
  const pinned = [
    { title: 'Iran enrichment', summary: '', cat: 'geo' },
    { title: 'Sanctions on Iran oil', summary: '', cat: 'finance' },
    { title: 'Flooding in Spain', summary: '', cat: 'climate' },
  ];
  const edges = graphEdges(pinned);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].label, 'Iran');
  assert.equal(edges[0].cross, true, 'two domains');
  const nodes = [
    { x: 100, y: 200, vx: 0, vy: 0 },
    { x: 700, y: 200, vx: 0, vy: 0 },
  ];
  for (let i = 0; i < 400; i += 1)
    stepGraph(nodes, [{ i: 0, j: 1, strength: 1 }], 800, 400);
  const apart = Math.hypot(nodes[1].x - nodes[0].x, nodes[1].y - nodes[0].y);
  assert.ok(apart > 100 && apart < 220, `settled ${Math.round(apart)} apart`);
});

test('synthesis is counts from the pins; confidence counts live headlines', () => {
  const one = synthesisParts([
    {
      title: 'Iran talks',
      summary: '',
      cat: 'geo',
      region: 'Iran',
      brk: false,
    },
  ]);
  assert.equal(
    one.before + one.breaking + one.breakingTail + one.after,
    'Analysis of 1 intelligence asset spanning 1 domain and 1 operational region.  Cross-domain analysis indicates moderate global activity.',
  );
  const many = synthesisParts([
    {
      title: 'Iran and Israel',
      summary: 'NATO, Russia, China, Ukraine',
      cat: 'geo',
      region: 'Iran',
      brk: true,
    },
    { title: 'Oil market', summary: '', cat: 'finance', region: '', brk: true },
  ]);
  assert.equal(many.breaking, '2 BREAKING');
  assert.match(many.after, /elevated/);
  assert.deepEqual(many.cats, ['geo', 'finance']);
  const news = Array.from({ length: 4 }, (_, i) => ({
    title: `Tehran enrichment inspectors report ${i}`,
    summary: '',
  }));
  const text = 'Inspectors report Tehran enrichment continues.';
  assert.equal(confidenceFor(text, news).level, 'H');
  assert.equal(confidenceFor(text, news.slice(0, 2)).level, 'M');
  assert.equal(confidenceFor(text, []).level, 'L');
});

test('search, timeline and the matrix read only the headlines held', () => {
  const news = [
    article('a1', 'Missile strike on port', 'military'),
    article('a2', 'Sanctions hit oil market', 'finance'),
    article('a3', 'He said the trade talks continue', 'geopolitics'),
    article('a4', 'Missile strike on port', 'military'),
  ].map((a) => articleToStory(a, NOW));
  assert.equal(searchStories('missile', '', news).length, 1, 'no duplicates');
  assert.equal(searchStories('', 'finance', news)[0].id, 'a2');
  assert.deepEqual(searchStories('', '', news), []);

  const subject = toStory(
    storyAsset('a1', 'Missile strike on port', 'military'),
    NOW,
  );
  const timeline = timelineFor([subject], news);
  assert.equal(timeline.count, 1);
  assert.equal(timeline.days.length, 1);

  const { cells, max } = escalationMatrix([subject], news);
  assert.equal(cells.military.military.score, 2 + 2, 'pins × 2 plus matches');
  assert.equal(
    cells.tech.tech.score,
    0,
    '"said" is not "ai": whole-word for two-letter keywords',
  );
  assert.equal(
    cells.geo.finance.stories[0].id,
    'a2',
    'sanction is in both lists',
  );
  assert.equal(matrixRisk(max, max).label, 'CRIT');
  assert.equal(matrixRisk(max * 0.5, max).label, 'HIGH');
  assert.equal(matrixRisk(max * 0.2, max).label, 'ELEV');
  assert.equal(matrixRisk(0, max).label, 'LOW');
});

test('dead reckoning counts whole country names', () => {
  const news = [
    { title: 'Nigeria votes', summary: '' },
    { title: 'Nigerian army exercise', summary: '' },
    { title: 'Niger coup talks', summary: '' },
    { title: 'Chad border', summary: '' },
  ];
  const { rows, tiers } = deadReckoning(news, [
    { name: 'Niger', iso2: 'NE' },
    { name: 'Nigeria', iso2: 'NG' },
    { name: 'Chad', iso2: 'TD' },
    { name: 'Oman', iso2: 'OM' },
  ]);
  assert.deepEqual(rows.map((row) => `${row.name}:${row.n}`).sort(), [
    'Chad:1',
    'Niger:1',
    'Nigeria:1',
  ]);
  assert.equal(tiers.NE, 'escalating');
  assert.equal(tiers.OM, undefined, 'not named, no tier');
});

test('consensus: five personas, AUSPEX’s prompts, and its arithmetic', () => {
  assert.deepEqual(
    ANALYST_PERSONAS.map((a) => a.id),
    ['military', 'economic', 'cyber', 'diplomatic', 'energy'],
  );
  const r1 = PROMPTS.round1(ANALYST_PERSONAS[0], '[GEO] A: B');
  assert.equal(r1.maxTokens, 220);
  assert.equal(
    r1.system,
    'You are a military strategy, force deployment, escalation ladders, weapons systems, order-of-battle analysis analyst at a top-tier intelligence organization. Be direct, specific, analytical. Respond ONLY in JSON.',
  );
  assert.match(
    r1.user,
    /^Review these intelligence assets from your domain perspective:\n\n\[GEO\] A: B\n\nBased ONLY on the content above/,
  );
  assert.match(
    r1.user,
    /Escalation scoring guide: 0-20=de-escalating, 21-40=stable/,
  );
  assert.equal(
    PROMPTS.hawk(ANALYST_PERSONAS[0], ANALYST_PERSONAS[3]).maxTokens,
    120,
  );
  assert.equal(PROMPTS.redTeam('x').maxTokens, 2200);
  assert.match(
    PROMPTS.redTeam('x').user,
    /COUNTERMEASURE GAPS:\nRECOMMENDED ACTIONS:$/,
  );
  const playbook = PROMPTS.playbook([
    { cat: 'geo', title: 'T', summary: 'S', region: 'Iran' },
    { cat: 'military', title: 'U', summary: '', _geoObj: { name: 'Israel' } },
  ]);
  assert.equal(playbook.maxTokens, 1600);
  assert.match(
    playbook.user,
    /ACTORS: Iran, Israel\n\nCURRENT INTELLIGENCE:\n\[GEO\] T — S\n\[MILITARY\] U\n\nSections:/,
  );
  assert.match(playbook.user, /PREDICTED MOVES \(30\/60\/90 DAY\):/);
  assert.equal(PROMPTS.daily([], new Date(NOW)).maxTokens, 2500);
  assert.match(
    PROMPTS.conflict('Sudan', [], new Date(NOW)).user,
    /No direct current coverage in the feed — assess from general standing and note the coverage gap\.$/,
  );

  const ok = parseAnalyst(
    ANALYST_PERSONAS[0],
    'Here: {"assessment":"A","escalation":72}',
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.escalation, 72);
  const bad = parseAnalyst(ANALYST_PERSONAS[0], '{not json}');
  assert.deepEqual(
    [bad.ok, bad.assessment, bad.escalation],
    [false, 'Parse error.', 50],
  );

  const at = (values) =>
    consensusStats(
      values.map((escalation, i) => ({ ...ANALYST_PERSONAS[i], escalation })),
    );
  assert.equal(at([50, 50, 50, 50, 50]).agr, 100);
  const spread = at([20, 35, 50, 65, 80]);
  assert.deepEqual([spread.mean, spread.spread, spread.agr], [50, 60, 47]);
  assert.equal(spread.hawk.id, 'energy');
  assert.equal(spread.dove.id, 'military');
});

test('a model’s reply is shown as text, whatever it contains', () => {
  assert.deepEqual(
    replyLines('## SITUATION ASSESSMENT:\n\n- **Risk:** high', isRedTeamHeader),
    [
      { header: true, text: 'SITUATION ASSESSMENT:' },
      { header: false, text: '- Risk: high' },
    ],
  );
  assert.equal(isPlaybookHeader('PREDICTED MOVES (30/60/90 DAY):'), true);
  assert.equal(isPlaybookHeader('Predicted moves:'), false);
  assert.deepEqual(
    briefBlocks(
      '<h3>SITUATION</h3><p>Calm &amp; quiet <b>now</b>.</p><img src=x onerror=alert(1)><script>alert(1)</script>',
    ),
    [
      { tag: 'h3', text: 'SITUATION' },
      { tag: 'p', text: 'Calm & quiet now.' },
    ],
  );
  assert.deepEqual(briefBlocks('Plain line.\n\nAnother.'), [
    { tag: 'p', text: 'Plain line.' },
    { tag: 'p', text: 'Another.' },
  ]);
  assert.equal(esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});

test('a conflict brief is grounded in headlines naming the country', () => {
  const news = [
    articleToStory(article('a1', 'Sudan army advances', 'military'), NOW),
    articleToStory(article('a2', 'Sudan harvest outlook', 'climate'), NOW),
    articleToStory(article('a3', 'Chad talks', 'geopolitics'), NOW),
  ];
  assert.deepEqual(
    conflictStories('Sudan', news).map((s) => s.id),
    ['a1'],
  );
});

test('a saved board is named by place, then domain, then headline', () => {
  assert.equal(
    boardTitleFor([
      { region: 'Iran' },
      { region: 'Israel' },
      { region: 'Iran' },
    ]),
    'Iran · Israel',
  );
  assert.equal(boardTitleFor([{ cat: 'geo', title: 'x' }]), 'GEO ANALYSIS');
  assert.equal(boardTitleFor([]), 'UNTITLED BOARD');
});

test('the board labels its output as model-written, with no classification stamps', () => {
  for (const key of ['synthesis', 'redTeam', 'playbook']) {
    assert.match(MARKINGS[key], /^MODEL-WRITTEN /);
    assert.doesNotMatch(MARKINGS[key], /SECRET|NOFORN|FVEY|HCS|\bSI\b/);
  }
  const board = fs.readFileSync(new URL('./corantoAnalyst.js', import.meta.url), 'utf8');
  assert.doesNotMatch(board, /NOT FOR DISTRIBUTION/);
});

test('the network has depth: turning and turning back is the same point', () => {
  const [x, y, z] = graphRotate(30, -20, 15, 0.7, -0.4);
  const back = graphUnrotate(x, y, z, 0.7, -0.4);
  for (const [got, want] of [
    [back[0], 30],
    [back[1], -20],
    [back[2], 15],
  ])
    assert.ok(Math.abs(got - want) < 1e-9);
  const flat = graphProject({ x: 500, y: 300, z: 0 }, 800, 400, 0, 0);
  assert.deepEqual([flat.x, flat.y, flat.scale], [500, 300, 1]);
  const nodes = [
    { x: 100, y: 200, z: -80, vx: 0, vy: 0, vz: 0 },
    { x: 700, y: 200, z: 80, vx: 0, vy: 0, vz: 0 },
    { x: 400, y: 60, z: 0, vx: 0, vy: 0, vz: 0, fixed: true },
  ];
  for (let i = 0; i < 400; i += 1)
    stepGraph3(nodes, [{ i: 0, j: 1, strength: 1 }], 800, 400);
  const apart = Math.hypot(
    nodes[1].x - nodes[0].x,
    nodes[1].y - nodes[0].y,
    nodes[1].z - nodes[0].z,
  );
  assert.ok(apart > 100 && apart < 240, `settled ${Math.round(apart)} apart`);
  assert.deepEqual([nodes[2].x, nodes[2].y, nodes[2].z], [400, 60, 0]);
});

test('the stylesheet carries no AUSPEX green as an accent', () => {
  const css = fs.readFileSync(
    new URL('./styles/corantoAnalyst.css', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    css,
    /#4ade80|74,\s*222,\s*128|#2ecc71|46,\s*204,\s*113/i,
  );
  assert.match(css, /#b47cff/);
});
