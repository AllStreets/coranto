/**
 * The analyst board's rules, ported from AUSPEX's `js/analyst.js` (Apache-2,
 * Connor Evans): how a pin reads as an asset, what the tools compute from the
 * pins and the live headlines, and the exact prompts the model-written tools
 * send. Nothing here touches the page.
 *
 * Two kinds of output come off the board. SYNTHESIZE, the timeline, the
 * matrix, dead reckoning and the network are worked out here in code from
 * headlines. CONSENSUS, the playbook, the red team brief and the two written
 * briefs are prose from a model, checked against nothing; the panel labels
 * them as written by a model.
 */
import { TOPIC_COLOURS } from '../data/corantoIcons.js';
import { entitiesOf } from './corantoBoardModel.js';

/** Coranto topic -> AUSPEX domain id. */
export const DOMAIN_OF = Object.freeze({
  geopolitics: 'geo',
  technology: 'tech',
  military: 'military',
  finance: 'finance',
  climate: 'climate',
});
/** AUSPEX domain id -> Coranto topic. */
export const TOPIC_OF = Object.freeze({
  geo: 'geopolitics',
  tech: 'technology',
  military: 'military',
  finance: 'finance',
  climate: 'climate',
});
export const DOMAIN_LABEL = Object.freeze({
  geo: 'GEO',
  tech: 'TECH',
  military: 'MIL',
  finance: 'FIN',
  climate: 'CLM',
});

/** The label a domain shows: AUSPEX's five, else the topic's own name. */
export function domainLabel(cat) {
  return DOMAIN_LABEL[cat] ?? (cat ? String(cat).toUpperCase() : 'NEWS');
}
export function domainColour(cat) {
  return TOPIC_COLOURS[TOPIC_OF[cat] ?? cat] ?? TOPIC_COLOURS.news;
}

/**
 * The stamps on the board's output, as AUSPEX had them. They are styling:
 * nothing here is classified, and everything is from public sources.
 * Settings says so, under About.
 */
export const MARKINGS = Object.freeze({
  synthesis: 'TOP SECRET / NOFORN',
  redTeam: 'TOP SECRET // SI // NOFORN',
  playbook: 'TOP SECRET // HCS-P // REL TO FVEY',
  system: 'CORANTO INTELLIGENCE SYSTEM',
});

const BREAKING_MS = 25 * 60 * 1000;

/** AUSPEX's relative time: "just now", "12 min ago", "3 hr ago". */
export function relativeTime(pub, now) {
  if (!Number.isFinite(pub)) return '';
  const minutes = Math.max(0, Math.floor((now - pub) / 60_000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** A live article in the shape AUSPEX's tools read. */
export function articleToStory(article, now, storyId = null) {
  const pub = Date.parse(article.publishedAt ?? '');
  const cat = DOMAIN_OF[article.category] ?? article.category ?? '';
  return {
    id: storyId ?? article.id,
    articleId: article.id,
    title: article.title ?? '',
    summary: article.summary ?? '',
    url: article.url ?? '',
    src: article.publisher ?? '',
    cat,
    category: article.category ?? '',
    region: article.place?.name ?? '',
    lat: article.place?.lat ?? null,
    lon: article.place?.lon ?? null,
    brk: Number.isFinite(pub) && now - pub < BREAKING_MS && now >= pub,
    color: domainColour(cat),
    time: relativeTime(pub, now),
    _pub: Number.isFinite(pub) ? pub : 0,
    _hist: false,
  };
}

const GEO_COLOURS = Object.freeze({
  city: '#8FA0E8',
  capital: '#E8D5A3',
  financial: '#FFD60A',
  tech: '#9D8CFF',
  tourism: '#FF8FA3',
  megacity: '#9FB3C8',
  military: '#FF6D00',
  naval: '#2979FF',
  port: '#2DD4BF',
  conflict: '#FF2D55',
  energy: '#FFB02E',
  diplomatic: '#30D158',
  country: '#B163E0',
  base: '#FF6D00',
  contact: '#8A93C8',
});
const CITY_TYPE = Object.freeze({
  capital: 'Capital city',
  financial: 'Financial hub',
  tech: 'Technology hub',
  tourism: 'Tourism destination',
  megacity: 'Megacity',
  military: 'Military installation',
  naval: 'Naval base',
  port: 'Port/maritime hub',
  conflict: 'Active conflict zone',
  energy: 'Energy infrastructure',
  diplomatic: 'Diplomatic capital',
  city: 'Major city',
});

/** The fields of a country or city that the board keeps with a pin. */
export const GEO_FIELDS = Object.freeze([
  'name',
  'iso2',
  'lat',
  'lng',
  'country',
  'icon_type',
  'strategic_tier',
  'nuclear_armed',
  'un_p5',
  'nato_member',
  'conflict_active',
]);

/** What a pin keeps of a country or city row, from Coranto's atlas data. */
export function geoOf(kind, item, countryName = '') {
  if (!item) return null;
  const out = {
    name: item.name,
    iso2: item.iso2,
    lat: item.lat,
    lng: item.lng,
    strategic_tier: item.strategic_tier ?? item.tier,
  };
  if (kind === 'city') {
    out.icon_type = item.icon_type ?? item.type ?? 'city';
    out.country = item.country ?? countryName;
  } else {
    for (const flag of [
      'nuclear_armed',
      'un_p5',
      'nato_member',
      'conflict_active',
    ])
      if (item[flag]) out[flag] = true;
  }
  return Object.fromEntries(
    Object.entries(out).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

/** A pinned country, city or contact as AUSPEX's `pinGeoAsset` built it. */
function geoStory(asset) {
  const o = asset.geo ?? {
    name: asset.title,
    lat: asset.lat ?? 0,
    lng: asset.lon ?? 0,
  };
  const base = {
    id: asset.key,
    _geoType: asset.kind,
    _geoObj: o,
    url: '',
    time: 'CURRENT',
    brk: false,
    _pub: 0,
    _hist: false,
    lat: asset.lat,
    lon: asset.lon,
  };
  if (asset.kind === 'contact')
    return {
      ...base,
      title: asset.title,
      summary: asset.summary ?? '',
      cat: 'geo',
      color: GEO_COLOURS.contact,
      src: asset.publisher || 'CONTACT',
      region: '',
    };
  if (asset.kind === 'country') {
    const flags = [
      o.nuclear_armed ? 'Nuclear armed' : '',
      o.un_p5 ? 'UN Security Council P5' : '',
      o.conflict_active ? 'Active conflict' : '',
      o.sanctions_subject ? 'Under sanctions' : '',
      o.nato_member ? 'NATO member' : '',
    ].filter(Boolean);
    return {
      ...base,
      title: `${o.name} — Country Intelligence Profile`,
      summary: `${flags.join(' · ') || 'No special designations'}. GDP: ${o.gdp_billions ? `$${o.gdp_billions}B` : '—'}. Military spend: ${o.mil_spend_billions ? `$${o.mil_spend_billions}B` : '—'}. Strategic tier: ${o.strategic_tier || '—'}.`,
      cat: o.nuclear_armed || o.conflict_active ? 'military' : 'geo',
      color: GEO_COLOURS.country,
      src: o.iso2 || 'CTRY',
      region: o.name,
    };
  }
  const type = o.icon_type || 'city';
  let summary = `${CITY_TYPE[type] || 'Strategic location'} in ${o.country || 'unknown'}. Coordinates: ${(o.lat || 0).toFixed(2)}°N ${(o.lng || 0).toFixed(2)}°E. Strategic tier: ${o.strategic_tier || '—'}.`;
  if (o.notes) summary += ` ${o.notes}`;
  return {
    ...base,
    title: `${o.name} — ${type.replace(/^\w/, (c) => c.toUpperCase())} Asset`,
    summary,
    cat: type === 'military' || type === 'naval' ? 'military' : 'geo',
    color: GEO_COLOURS[type] || GEO_COLOURS.city,
    src: 'CITY',
    region: o.country || o.name,
  };
}

/**
 * A pin in the shape AUSPEX's tools read. `liveKeys` holds the ids of the
 * stories and articles in the feed now; a pinned story that has left the feed
 * is marked as archive.
 */
export function toStory(asset, now, liveKeys = null) {
  if (asset.kind !== 'story') return geoStory(asset);
  const pub = Date.parse(asset.publishedAt ?? '');
  const cat = DOMAIN_OF[asset.category] ?? asset.category ?? '';
  return {
    id: asset.key,
    title: asset.title,
    summary: asset.summary ?? '',
    url: asset.url ?? '',
    src: asset.publisher ?? '',
    cat,
    category: asset.category ?? '',
    region: asset.place ?? '',
    lat: asset.lat,
    lon: asset.lon,
    brk: Number.isFinite(pub) && now - pub < BREAKING_MS && now >= pub,
    color: domainColour(cat),
    time: relativeTime(pub, now),
    _pub: Number.isFinite(pub) ? pub : 0,
    _hist: liveKeys ? !liveKeys.has(asset.key) : false,
  };
}

/** The pin a live story makes when it is pinned from inside the board. */
export function storyPin(story) {
  return {
    key: story.id,
    kind: 'story',
    title: story.title,
    summary: story.summary,
    publisher: story.src,
    url: story.url,
    publishedAt: story._pub ? new Date(story._pub).toISOString() : '',
    category: story.category,
    place: story.region,
    lat: story.lat ?? undefined,
    lon: story.lon ?? undefined,
  };
}

/** The line on a card above its title. */
export function cardBadge(s) {
  if (s._geoType)
    return { geo: true, text: `${s._geoType.toUpperCase()} ASSET` };
  return {
    geo: false,
    text: domainLabel(s.cat).toUpperCase(),
    breaking: s.brk,
    archive: s._hist,
  };
}

/** The asset text every model prompt is given (`_buildAssetContext`). */
export function buildAssetContext(pinned) {
  return pinned
    .map((s) => {
      const o = s._geoObj || {};
      if (s._geoType === 'city')
        return (
          `[GEO/CITY] ${o.name || s.title}, ${o.country || ''}` +
          ` — Type: ${(o.icon_type || 'city').toUpperCase()}` +
          ` · Coords: ${(o.lat || 0).toFixed(2)}, ${(o.lng || 0).toFixed(2)}` +
          ` · Strategic tier: ${o.strategic_tier || '—'}` +
          (o.notes ? ` · ${o.notes}` : '')
        );
      if (s._geoType === 'country') {
        const attrs = [
          o.nuclear_armed ? 'NUCLEAR ARMED' : '',
          o.un_p5 ? 'UN P5' : '',
          o.conflict_active ? 'ACTIVE CONFLICT' : '',
          o.sanctions_subject ? 'SANCTIONED' : '',
          o.nato_member ? 'NATO' : '',
        ]
          .filter(Boolean)
          .join(', ');
        return (
          `[GEO/COUNTRY] ${o.name || s.title}` +
          ` — ${attrs || 'Standard nation-state'}` +
          ` · GDP: ${o.gdp_billions ? `$${o.gdp_billions}B` : '—'}` +
          ` · Mil spend: ${o.mil_spend_billions ? `$${o.mil_spend_billions}B` : '—'}` +
          ` · Strategic tier: ${o.strategic_tier || '—'}`
        );
      }
      if (s._geoType === 'contact')
        return `[GEO/CONTACT] ${s.title} — ${s.summary || ''}`;
      return `[${domainLabel(s.cat).toUpperCase()}] ${s.title}: ${s.summary || ''}`;
    })
    .join('\n');
}

const lower = (s) => `${s.title} ${s.summary || ''}`.toLowerCase();

/** The trend mark on a card: how many other headlines share its place words. */
export function computeTrajectory(s, news) {
  const words = (s.region || s.title || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((w) => w.length > 4);
  let related = 0;
  if (words.length)
    for (const n of news) {
      if (n.id === s.id) continue;
      const text = lower(n);
      if (words.some((w) => text.includes(w))) related += 1;
      if (related >= 4) break;
    }
  if (related >= 4)
    return { dir: 'up', label: 'Escalating — high regional activity' };
  if (related >= 2)
    return { dir: 'mid', label: 'Active — moderate regional activity' };
  return { dir: 'down', label: 'Quiet — low regional activity' };
}

/** Links between pins that name the same listed entity. */
export function graphEdges(pinned) {
  const named = pinned.map((s) => entitiesOf(s));
  const edges = [];
  for (let i = 0; i < pinned.length; i += 1)
    for (let j = i + 1; j < pinned.length; j += 1) {
      const shared = named[i].filter((e) => named[j].includes(e));
      if (shared.length)
        edges.push({
          i,
          j,
          strength: shared.length,
          label: shared[0],
          cross: pinned[i].cat !== pinned[j].cat,
        });
    }
  return edges;
}

/** One step of the network's force layout, on `nodes` in place. */
export function stepGraph(nodes, edges, W, H) {
  for (const n of nodes) {
    n.vx *= 0.86;
    n.vy *= 0.86;
    n.vx += (W / 2 - n.x) * 0.003;
    n.vy += (H / 2 - n.y) * 0.003;
  }
  for (let a = 0; a < nodes.length; a += 1)
    for (let b = a + 1; b < nodes.length; b += 1) {
      const dx = nodes[b].x - nodes[a].x;
      const dy = nodes[b].y - nodes[a].y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.1;
      const f = Math.min(5000 / (d * d), 10);
      nodes[a].vx -= (dx / d) * f;
      nodes[a].vy -= (dy / d) * f;
      nodes[b].vx += (dx / d) * f;
      nodes[b].vy += (dy / d) * f;
    }
  for (const e of edges) {
    const dx = nodes[e.j].x - nodes[e.i].x;
    const dy = nodes[e.j].y - nodes[e.i].y;
    const d = Math.sqrt(dx * dx + dy * dy) + 0.1;
    const f = (d - 140) * 0.055;
    nodes[e.i].vx += (dx / d) * f;
    nodes[e.i].vy += (dy / d) * f;
    nodes[e.j].vx -= (dx / d) * f;
    nodes[e.j].vy -= (dy / d) * f;
  }
  for (const n of nodes) {
    n.x = Math.max(40, Math.min(W - 40, n.x + n.vx));
    n.y = Math.max(40, Math.min(H - 40, n.y + n.vy));
  }
}

/** How far the network reaches front to back, against its width. */
export const GRAPH_DEPTH = 0.45;
const GRAPH_FOCAL = 900;

/**
 * One step of the network's layout in three dimensions: AUSPEX's forces and
 * constants with a depth axis added. A node being held (`fixed`) stays where
 * it was put while the others settle around it.
 */
export function stepGraph3(nodes, edges, W, H) {
  const depth = Math.min(W, H) * GRAPH_DEPTH;
  for (const n of nodes) {
    n.vx *= 0.86;
    n.vy *= 0.86;
    n.vz *= 0.86;
    n.vx += (W / 2 - n.x) * 0.003;
    n.vy += (H / 2 - n.y) * 0.003;
    n.vz += -n.z * 0.003;
  }
  for (let a = 0; a < nodes.length; a += 1)
    for (let b = a + 1; b < nodes.length; b += 1) {
      const dx = nodes[b].x - nodes[a].x;
      const dy = nodes[b].y - nodes[a].y;
      const dz = nodes[b].z - nodes[a].z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
      const f = Math.min(5000 / (d * d), 10);
      nodes[a].vx -= (dx / d) * f;
      nodes[a].vy -= (dy / d) * f;
      nodes[a].vz -= (dz / d) * f;
      nodes[b].vx += (dx / d) * f;
      nodes[b].vy += (dy / d) * f;
      nodes[b].vz += (dz / d) * f;
    }
  for (const e of edges) {
    const dx = nodes[e.j].x - nodes[e.i].x;
    const dy = nodes[e.j].y - nodes[e.i].y;
    const dz = nodes[e.j].z - nodes[e.i].z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
    const f = (d - 140) * 0.055;
    nodes[e.i].vx += (dx / d) * f;
    nodes[e.i].vy += (dy / d) * f;
    nodes[e.i].vz += (dz / d) * f;
    nodes[e.j].vx -= (dx / d) * f;
    nodes[e.j].vy -= (dy / d) * f;
    nodes[e.j].vz -= (dz / d) * f;
  }
  for (const n of nodes) {
    if (n.fixed) {
      n.vx = 0;
      n.vy = 0;
      n.vz = 0;
      continue;
    }
    n.x = Math.max(40, Math.min(W - 40, n.x + n.vx));
    n.y = Math.max(40, Math.min(H - 40, n.y + n.vy));
    n.z = Math.max(-depth, Math.min(depth, n.z + n.vz));
  }
}

/** A point turned about the centre of the network: yaw, then pitch. */
export function graphRotate(x, y, z, yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
}

/** The reverse of `graphRotate`. */
export function graphUnrotate(x, y, z, yaw, pitch) {
  const cp = Math.cos(-pitch);
  const sp = Math.sin(-pitch);
  const y1 = y * cp - z * sp;
  const z1 = y * sp + z * cp;
  const cy = Math.cos(-yaw);
  const sy = Math.sin(-yaw);
  return [x * cy + z1 * sy, y1, -x * sy + z1 * cy];
}

/**
 * Where a node is drawn: its place on the canvas and how large, nearer
 * being a little larger. With no turn the network looks as it did flat.
 */
export function graphProject(node, W, H, yaw, pitch) {
  const [x, y, z] = graphRotate(
    node.x - W / 2,
    node.y - H / 2,
    node.z,
    yaw,
    pitch,
  );
  const scale = GRAPH_FOCAL / (GRAPH_FOCAL + z);
  return { x: W / 2 + x * scale, y: H / 2 + y * scale, scale, depth: z };
}

/** What SYNTHESIZE reports, worked out from the pins. No model is asked. */
export function synthesisParts(pinned) {
  const cats = [...new Set(pinned.map((s) => s.cat))];
  const regions = [...new Set(pinned.map((s) => s.region).filter(Boolean))];
  const entities = [...new Set(pinned.flatMap((s) => entitiesOf(s)))];
  const brk = pinned.filter((s) => s.brk).length;
  const n = pinned.length;
  return {
    cats,
    regions,
    entities,
    brk,
    before: `Analysis of ${n} intelligence asset${n > 1 ? 's' : ''} spanning ${cats.length} domain${cats.length > 1 ? 's' : ''} and ${regions.length} operational region${regions.length > 1 ? 's' : ''}. `,
    breaking: brk > 0 ? `${brk} BREAKING` : '',
    breakingTail:
      brk > 0
        ? ` development${brk > 1 ? 's' : ''} flagged for immediate attention.`
        : '',
    after: ` Cross-domain analysis indicates ${entities.length > 4 ? 'elevated' : 'moderate'} global activity.`,
  };
}

/** The H / M / L mark on a brief paragraph: live headlines sharing its words. */
export function confidenceFor(text, news) {
  const words = [
    ...new Set(
      text
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 5),
    ),
  ];
  let corroborating = 0;
  for (const s of news) {
    const st = lower(s);
    let hits = 0;
    for (const w of words) {
      if (st.includes(w)) hits += 1;
      if (hits >= 3) break;
    }
    if (hits >= 3) corroborating += 1;
  }
  const level = corroborating >= 4 ? 'H' : corroborating >= 2 ? 'M' : 'L';
  return {
    level,
    corroborating,
    colour: level === 'H' ? '#30D158' : level === 'M' ? '#FF9F0A' : '#566573',
    title: `Confidence ${level === 'H' ? 'HIGH' : level === 'M' ? 'MEDIUM' : 'LOW'} — ${corroborating} corroborating sources`,
  };
}

/** The board's search over the headlines held: title or summary, and domain. */
export function searchStories(query, cat, news, limit = 30) {
  const q = query.trim().toLowerCase();
  if (!q && !cat) return [];
  const seen = new Set();
  const out = [];
  for (const s of news) {
    if (cat && s.cat !== cat) continue;
    if (q && !lower(s).includes(q)) continue;
    if (seen.has(s.title)) continue;
    seen.add(s.title);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Headlines related to the subjects, newest first, grouped by day. */
export function timelineFor(subjects, news) {
  const keywords = [
    ...new Set(
      subjects.flatMap((s) =>
        `${s.title} ${s.region || ''}`
          .toLowerCase()
          .split(/[\s,]+/)
          .filter((w) => w.length > 4),
      ),
    ),
  ].slice(0, 20);
  const ids = new Set(subjects.map((s) => s.id));
  const seen = new Set();
  const related = [];
  for (const s of [...subjects.filter((x) => !x._geoType), ...news]) {
    if (seen.has(s.title)) continue;
    const text = lower(s);
    if (ids.has(s.id) || keywords.filter((k) => text.includes(k)).length >= 2) {
      seen.add(s.title);
      related.push(s);
    }
  }
  related.sort((a, b) => (b._pub || 0) - (a._pub || 0));
  const events = related.slice(0, 60);
  const days = [];
  for (const s of events) {
    const day = s._pub
      ? new Date(s._pub)
          .toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          .toUpperCase()
      : 'UNDATED';
    const last = days[days.length - 1];
    if (last && last.day === day) last.stories.push(s);
    else days.push({ day, stories: [s] });
  }
  return { count: events.length, days };
}

export const MATRIX_DOMAINS = Object.freeze([
  'geo',
  'tech',
  'military',
  'finance',
  'climate',
]);
/** The matrix and dead reckoning use AUSPEX's older fixed palette. */
export const MATRIX_COLOURS = Object.freeze({
  geo: '#FF2D55',
  tech: '#0A84FF',
  military: '#FF9F0A',
  finance: '#FFD60A',
  climate: '#30D158',
});
const MATRIX_KEYWORDS = Object.freeze({
  geo: 'war|conflict|diplomacy|election|sanction|geopolit',
  tech: 'cyber|tech|ai|chip|hack|data',
  military: 'military|troops|missile|weapon|navy|army',
  finance: 'bank|market|economy|trade|dollar|sanction|oil',
  climate: 'climate|carbon|flood|drought|wildfire|emission',
});
const RECKONING_KEYWORDS = Object.freeze({
  geo: 'war|conflict|diplomacy|election|sanction|geopolit|nato',
  tech: 'cyber|tech|ai|chip|hack|data|semiconductor',
  military: 'military|troops|missile|weapon|navy|army|combat|airstrike|drone',
  finance: 'market|stock|economy|trade|dollar|sanction|oil|tariff|bank',
  climate: 'climate|carbon|flood|drought|wildfire|emission|arctic',
});
/**
 * A keyword starts a word ("sanction" finds "sanctions"); the two-letter
 * "ai" must be the whole word, so "said" and "Ukraine" do not count as
 * technology. AUSPEX matched anywhere in the text.
 */
const keywordTest = (list) =>
  new RegExp(
    `(?<![a-z])(?:${list
      .split('|')
      .map((k) => (k.length <= 2 ? `${k}(?![a-z])` : k))
      .join('|')})`,
    'i',
  );

/** The cross-domain escalation matrix: a score and matching stories per cell. */
export function escalationMatrix(pinned, news) {
  const tests = Object.fromEntries(
    MATRIX_DOMAINS.map((d) => [d, keywordTest(MATRIX_KEYWORDS[d])]),
  );
  const hits = news.map((s) => {
    const text = `${s.title} ${s.summary || ''}`;
    return MATRIX_DOMAINS.filter((d) => tests[d].test(text));
  });
  const pins = Object.fromEntries(
    MATRIX_DOMAINS.map((d) => [d, pinned.filter((s) => s.cat === d).length]),
  );
  const cells = {};
  let max = 1;
  for (const r of MATRIX_DOMAINS) {
    cells[r] = {};
    for (const c of MATRIX_DOMAINS) {
      const matching = news.filter(
        (_, index) =>
          hits[index].includes(r) && (r === c || hits[index].includes(c)),
      );
      const score =
        (r === c ? pins[r] * 2 : pins[r] > 0 && pins[c] > 0 ? 3 : 0) +
        Math.min(matching.length, 6);
      cells[r][c] = { score, stories: matching.slice(0, 20) };
      max = Math.max(max, score);
    }
  }
  return { cells, max };
}

/** A cell's band: its score against the largest on the grid. */
export function matrixRisk(score, max) {
  const r = score / max;
  if (r > 0.7) return { label: 'CRIT', colour: 'rgba(255,45,85,.82)' };
  if (r > 0.4) return { label: 'HIGH', colour: 'rgba(255,159,10,.72)' };
  if (r > 0.15) return { label: 'ELEV', colour: 'rgba(183,149,11,.45)' };
  return { label: 'LOW', colour: 'rgba(80,90,120,.22)' };
}

/**
 * Dead reckoning: how often each country is named in the headlines held.
 * `tiers` is iso2 -> 'escalating' | 'active' | 'stable' for the globe;
 * `rows` is the top fifteen for the board.
 */
export function deadReckoning(news, countries) {
  const texts = news.map(lower);
  const counted = [];
  for (const c of countries) {
    const name = (c.name || '').toLowerCase();
    if (name.length <= 3) continue;
    // The whole name: "Niger" is not counted in "Nigeria" or "Nigerian".
    const named = new RegExp(
      `(?<![a-z])${name.replace(/[^a-z0-9 ]/g, '.')}(?![a-z])`,
    );
    let n = 0;
    const mentions = [];
    texts.forEach((text, index) => {
      if (text.includes(name) && named.test(text)) {
        n += 1;
        mentions.push(index);
      }
    });
    if (n) counted.push({ name: c.name, iso2: c.iso2, n, mentions });
  }
  counted.sort((a, b) => b.n - a.n);
  const maxN = counted[0]?.n || 1;
  const tiers = {};
  for (const c of counted) {
    const ratio = c.n / maxN;
    tiers[c.iso2] =
      ratio > 0.5 ? 'escalating' : ratio > 0.2 ? 'active' : 'stable';
  }
  const tests = Object.fromEntries(
    MATRIX_DOMAINS.map((d) => [d, keywordTest(RECKONING_KEYWORDS[d])]),
  );
  const labels = {
    geo: 'GEO',
    tech: 'TEC',
    military: 'MIL',
    finance: 'FIN',
    climate: 'CLM',
  };
  const rows = counted.slice(0, 15).map((c) => {
    const pct = Math.round((c.n / maxN) * 100);
    return {
      name: c.name,
      iso2: c.iso2,
      n: c.n,
      pct,
      colour: pct > 65 ? '#FF2D55' : pct > 35 ? '#FF9F0A' : '#2ECC71',
      tier: pct > 65 ? 'ESCALATING' : pct > 35 ? 'ACTIVE' : 'STABLE',
      domains: MATRIX_DOMAINS.map((d) => ({
        label: labels[d],
        colour: MATRIX_COLOURS[d],
        n: c.mentions.filter((index) =>
          tests[d].test(`${news[index].title} ${news[index].summary || ''}`),
        ).length,
      })).filter((entry) => entry.n > 0),
    };
  });
  return { tiers, rows };
}

/** A saved board's name, by AUSPEX's rule. */
export function boardTitleFor(stories) {
  if (!stories.length) return 'UNTITLED BOARD';
  const regions = [
    ...new Set(stories.map((s) => s.region || s.src).filter(Boolean)),
  ].slice(0, 3);
  if (regions.length) return regions.join(' · ');
  const cats = [
    ...new Set(stories.map((s) => domainLabel(s.cat)).filter(Boolean)),
  ].slice(0, 2);
  if (cats.length) return `${cats.join(' + ')} ANALYSIS`;
  return stories[0].title.slice(0, 40).toUpperCase();
}

// ── The model-written tools ─────────────────────────────────────────

/** The five specialists of the consensus board, as AUSPEX wrote them. */
export const ANALYST_PERSONAS = Object.freeze([
  {
    id: 'military',
    name: 'MILITARY ANALYST',
    color: '#FF9F0A',
    icon: '⚔',
    glyph: 'swords',
    spec: 'military strategy, force deployment, escalation ladders, weapons systems, order-of-battle analysis',
  },
  {
    id: 'economic',
    name: 'ECONOMIC ANALYST',
    color: '#FFD60A',
    icon: '$',
    glyph: 'dollar',
    spec: 'financial markets, trade flows, sanctions impact, currency dynamics, commodity markets, economic coercion',
  },
  {
    id: 'cyber',
    name: 'CYBER ANALYST',
    color: '#0A84FF',
    icon: '⬡',
    glyph: 'technology',
    spec: 'information warfare, critical infrastructure vulnerabilities, state-actor TTPs, SIGINT, disinformation operations',
  },
  {
    id: 'diplomatic',
    name: 'DIPLOMATIC ANALYST',
    color: '#30D158',
    icon: '◎',
    glyph: 'geopolitics',
    spec: 'geopolitical relationships, treaty obligations, diplomatic signaling, multilateral institutions, coalition dynamics',
  },
  {
    id: 'energy',
    name: 'ENERGY ANALYST',
    color: '#FF2D55',
    icon: '⚡',
    glyph: 'bolt',
    spec: 'energy security, pipeline dependencies, oil and gas supply disruption, resource competition, commodity flows',
  },
]);

/** Every prompt the board sends, word for word from AUSPEX. */
export const PROMPTS = Object.freeze({
  round1: (a, context) => ({
    system: `You are a ${a.spec} analyst at a top-tier intelligence organization. Be direct, specific, analytical. Respond ONLY in JSON.`,
    user: `Review these intelligence assets from your domain perspective:\n\n${context}\n\nBased ONLY on the content above, respond with ONLY valid JSON (no extra text, no markdown):\n{"assessment":"2-3 sentence domain-specific analysis of these specific assets","escalation":INTEGER_0_TO_100,"keyFactor":"the single most critical variable you track in this situation","blindspot":"what the other analysts are likely missing that you can see","confidence":INTEGER_0_TO_100}\n\nEscalation scoring guide: 0-20=de-escalating, 21-40=stable, 41-60=moderate tension, 61-80=elevated risk, 81-100=crisis imminent. Base your score strictly on the evidence in the assets, not on persona defaults.`,
    maxTokens: 220,
  }),
  hawk: (hawk, dove) => ({
    system: `You are ${hawk.name}, a ${hawk.spec} analyst. You just read another analyst's assessment and strongly disagree with their low threat estimation. Be direct, specific, and pointed. 1-2 sentences maximum.`,
    user: `Your assessment: "${hawk.assessment}" (escalation: ${hawk.escalation}%)\n\nThe ${dove.name} says: "${dove.assessment}" (escalation: ${dove.escalation}%)\n\nWrite your pointed challenge to their analysis — what critical threat factor are they ignoring?`,
    maxTokens: 120,
  }),
  dove: (hawk, dove, hawkChallenge) => ({
    system: `You are ${dove.name}, a ${dove.spec} analyst. Respond to a pointed challenge from a more hawkish colleague. Defend your assessment with specific evidence they may be discounting. 1-2 sentences maximum.`,
    user: `Your assessment: "${dove.assessment}" (escalation: ${dove.escalation}%)\n\nThe ${hawk.name} challenges: "${hawkChallenge}"\n\nWrite your rebuttal — what stabilizing factors or alternative interpretation justifies your lower threat assessment?`,
    maxTokens: 120,
  }),
  synthesis: (context, analysts, hawk, dove, hawkChallenge, doveRebuttal) => ({
    system: `You are the Senior Intelligence Analyst synthesizing a panel of 5 specialist analysts who reviewed the same situation independently and then cross-examined each other. Write a consolidated brief in IC style — direct, unhedged, actionable. 3-4 short paragraphs.`,
    user: `INTELLIGENCE ASSETS REVIEWED:\n${context}\n\nSPECIALIST ASSESSMENTS:\n${analysts
      .map(
        (a) =>
          `${a.icon} ${a.name} (${a.escalation}% escalation): ${a.assessment} | KEY: ${a.keyFactor || '—'} | BLIND SPOT: ${a.blindspot || '—'}`,
      )
      .join(
        '\n',
      )}\n\nCROSS-EXAMINATION:\n${hawk.name} challenged: "${hawkChallenge}"\n${dove.name} rebutted: "${doveRebuttal}"\n\nWrite the consolidated brief covering: (1) key findings where analysts agree, (2) the most significant divergence and what it means for decision-makers, (3) the single highest-priority action indicator to watch, (4) overall threat trajectory.`,
    maxTokens: 700,
  }),
  redTeam: (context) => ({
    system:
      'You are generating an adversarial intelligence assessment from a rival state actor perspective, analyzing Western/US vulnerabilities and opportunities. Use intelligence community style writing. Be credible and specific.',
    user: `Generate a structured intelligence assessment from an adversarial perspective for these developments:\n\n${context}\n\nFormat your response with these labeled sections (write 3-5 specific points under each section):\nSITUATION ASSESSMENT:\nIDENTIFIED VULNERABILITIES:\nEXPLOITATION VECTORS:\nSTRATEGIC OPPORTUNITY WINDOW:\nCOUNTERMEASURE GAPS:\nRECOMMENDED ACTIONS:`,
    maxTokens: 2200,
  }),
  playbook: (pinned) => {
    const actors = [
      ...new Set(
        pinned.map((s) => s._geoObj?.name || s.region || '').filter(Boolean),
      ),
    ];
    const context = pinned
      .map(
        (s) =>
          `[${(s.cat || 'geo').toUpperCase()}] ${s.title}${s.summary ? ` — ${s.summary}` : ''}`,
      )
      .join('\n');
    return {
      system: `You are a senior intelligence officer writing a classified Adversary Playbook — an actor-centric strategic assessment. Write in terse, authoritative intelligence prose. Use ALL-CAPS section headers followed by colons. No disclaimers. No hedging. Write as if for cleared decision-makers.`,
      user: `Generate an ADVERSARY PLAYBOOK for these pinned intelligence assets.\n\nACTORS: ${actors.length ? actors.join(', ') : 'Unknown'}\n\nCURRENT INTELLIGENCE:\n${context}\n\nSections:\nBEHAVIORAL PATTERNS:\nSTRATEGIC INTERESTS:\nPREDICTED MOVES (30/60/90 DAY):\nPRESSURE POINTS:\nCOUNTER-STRATEGY:\nRED FLAGS:`,
      maxTokens: 1600,
    };
  },
  daily: (top, now) => ({
    system: `You are a senior intelligence analyst writing a daily situation report. Write in clear, authoritative analytical prose. Format with HTML: use <h3> for exactly three section headers (EXECUTIVE SUMMARY, KEY DEVELOPMENTS, STRATEGIC IMPLICATIONS), use <p> for paragraphs. Do not use classification markings, "TOP SECRET", or document stamps. Be direct and substantive.`,
    user: `Today is ${now.toDateString()}. Write a daily situation report covering the most significant geopolitical, military, economic, and technology developments based on these current stories:\n\n${top
      .map(
        (s) =>
          `[${(s.cat || '').toUpperCase()}] ${s.title} (${s.src})${s.summary ? ` — ${s.summary}` : ''}`,
      )
      .join('\n')}`,
    maxTokens: 2500,
  }),
  conflict: (name, ctx, now) => ({
    system: `You are a senior conflict-intelligence analyst. Write an authoritative, current situation brief on the active conflict involving or affecting the named country. Format as HTML: use <h3> for exactly three section headers (SITUATION, ACTORS & DRIVERS, OUTLOOK), and <p> for paragraphs. No classification markings or document stamps. Ground every claim in the supplied headlines; where coverage is thin, say so plainly rather than inventing detail. Be concise, specific, and analytically sharp.`,
    user: `Country in focus: ${name}. Today is ${now.toDateString()}. Write a live conflict brief grounded in these current headlines:\n\n${
      ctx
        .map(
          (s) =>
            `[${(s.cat || '').toUpperCase()}${s.brk ? '/BREAKING' : ''}] ${s.title} (${s.src || ''})${s.summary ? ` — ${s.summary}` : ''}`,
        )
        .join('\n') ||
      'No direct current coverage in the feed — assess from general standing and note the coverage gap.'
    }`,
    maxTokens: 1500,
  }),
});

/** The stories a conflict brief is grounded in: up to 14 naming the country. */
export function conflictStories(name, news) {
  const nm = name.toLowerCase();
  return news
    .filter((s) => {
      if (s.cat !== 'military' && s.cat !== 'geo' && !s.brk) return false;
      return `${s.title} ${s.region || ''} ${s.summary || ''}`
        .toLowerCase()
        .includes(nm);
    })
    .slice(0, 14);
}

/** One specialist's reply, read as AUSPEX read it. */
export function parseAnalyst(persona, text) {
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*?\}/)?.[0] || '{}');
    return { ...persona, ...parsed, ok: true };
  } catch {
    return {
      ...persona,
      assessment: 'Parse error.',
      escalation: 50,
      ok: false,
    };
  }
}

export const escalationOf = (analyst) => +analyst.escalation || 50;
export const escalationColour = (value) =>
  value > 65 ? '#FF2D55' : value > 40 ? '#FF9F0A' : '#30D158';

/** The three tiles above the consensus cards, and who cross-examines whom. */
export function consensusStats(analysts) {
  const scores = analysts.map(escalationOf);
  const mean = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const spread = Math.max(...scores) - Math.min(...scores);
  const stdDev = Math.sqrt(
    scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length,
  );
  const agr = Math.max(0, Math.round(100 - stdDev * 2.5));
  const sorted = [...analysts].sort((a, b) => +a.escalation - +b.escalation);
  return {
    mean,
    spread,
    agr,
    meanColour: escalationColour(mean),
    agrColour: agr < 40 ? '#FF9F0A' : '#30D158',
    hawk: sorted[sorted.length - 1],
    dove: sorted[0],
  };
}

/**
 * A model's plain-text reply as lines to show: section headers and
 * paragraphs. Models often add Markdown the prompt did not ask for (`##`,
 * `**bold**`); it is removed so a header is still read as a header.
 */
export function replyLines(text, isHeader) {
  return String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const plain = line
        .replace(/^#+\s*/, '')
        .replace(/\*\*/g, '')
        .trim();
      return { header: isHeader(plain), text: plain };
    })
    .filter((line) => line.text);
}
/** A playbook header: capitals to a colon, digits and brackets allowed. */
export const isPlaybookHeader = (line) =>
  /^[A-Z][A-Z0-9\s\-/()&]+:/.test(line.trim());
/** A red team header: a line of capitals ending in a colon. */
export const isRedTeamHeader = (line) => /^[A-Z][A-Z\s&]+:$/.test(line.trim());

/**
 * The parts of a model's HTML brief that are shown: `h3` and `p`, as text.
 * Anything else the model wrote (scripts, images, attributes) is dropped.
 */
export function briefBlocks(html) {
  const blocks = [];
  const pattern = /<(h3|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = pattern.exec(html)))
    blocks.push({
      tag: match[1].toLowerCase(),
      text: match[2]
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim(),
    });
  const shown = blocks.filter((block) => block.text);
  if (shown.length) return shown;
  // A reply with no tags at all is shown as plain paragraphs.
  return html
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ tag: 'p', text }));
}

/** Text made safe to place inside markup. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
