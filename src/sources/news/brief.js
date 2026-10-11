/**
 * AI-written briefs that cannot say more than their sources.
 *
 * The model is given the outlets' own headlines and summaries for one story,
 * numbered, and must return sentences that each cite those numbers. Nothing
 * the model writes is shown until it passes `validateBrief`, which runs in
 * code and removes any sentence that:
 *   - cites no source, or a source that was not supplied;
 *   - contains a figure that is in none of the sources it cites;
 *   - contains a name that is in none of the sources it cites.
 * What remains is labelled as AI-written and every sentence links to the
 * articles it rests on.
 */

export const BRIEF_MAX_SOURCES = 12;
export const BRIEF_MAX_SENTENCES = 5;
export const BRIEF_MAX_CLAIMS = 6;

export const BRIEF_INSTRUCTIONS = [
  'You summarise one news story for a reader, using ONLY the numbered sources supplied.',
  'Rules:',
  '1. Use no knowledge of your own. If the sources do not say it, do not write it.',
  '2. Every sentence must cite the source numbers it rests on.',
  '3. Copy figures, names and places exactly as a cited source gives them.',
  '4. Where sources give different figures or accounts, say that outlets differ and cite each.',
  '5. Do not speculate, predict, or characterise motives.',
  `6. Write at most ${BRIEF_MAX_SENTENCES} short sentences, then at most ${BRIEF_MAX_CLAIMS} separate factual claims the sources make.`,
  'Reply with JSON only, in this shape:',
  '{"sentences":[{"text":"...","cites":[1,2]}],"claims":[{"text":"...","cites":[1]}]}',
].join('\n');

/** Number the story's articles for the model and for citation. */
export function briefSources(articles) {
  return (articles ?? []).slice(0, BRIEF_MAX_SOURCES).map((article, index) => ({
    n: index + 1,
    id: article.id,
    publisher: article.publisher,
    title: article.title,
    summary: article.summary ?? '',
    url: article.url,
    publishedAt: article.publishedAt,
  }));
}

/** The text sent to the model: nothing but the sources. */
export function briefInput(sources) {
  return sources
    .map(
      (source) =>
        `[${source.n}] ${source.publisher}\nHeadline: ${source.title}` +
        (source.summary ? `\nSummary: ${source.summary}` : ''),
    )
    .join('\n\n');
}

const fold = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .toLowerCase();

const NUMBER_WORDS = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
};

/** Figures in a text, with separators removed and small number words as digits. */
function figures(text) {
  const out = new Set();
  const folded = fold(text);
  for (const match of folded.match(/\d+(?:[.,]\d+)*/g) ?? [])
    out.add(match.replace(/,(?=\d{3}\b)/g, '').replace(/[.,]$/, ''));
  for (const [word, digit] of Object.entries(NUMBER_WORDS))
    if (new RegExp(`\\b${word}\\b`).test(folded)) out.add(digit);
  return out;
}

/** Capitalised words that are not the first word of a sentence. */
function names(text) {
  const out = new Set();
  for (const sentence of String(text ?? '').split(/(?<=[.!?])\s+/)) {
    const words = sentence.match(/[\p{L}][\p{L}'’-]*/gu) ?? [];
    words.slice(1).forEach((word) => {
      if (/^\p{Lu}/u.test(word) && word.length >= 3)
        out.add(fold(word).replace(/'s$/, ''));
    });
  }
  return out;
}

/**
 * True when every figure and every name in `text` appears in the cited
 * sources' own headline or summary.
 */
export function isGrounded(text, cited) {
  const haystack = fold(
    cited
      .map((source) => `${source.publisher} ${source.title} ${source.summary}`)
      .join(' \n '),
  );
  const sourceFigures = figures(haystack);
  for (const figure of figures(text))
    if (!sourceFigures.has(figure)) return false;
  for (const name of names(text)) if (!haystack.includes(name)) return false;
  return true;
}

function parseModelJson(text) {
  const raw = String(text ?? '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function checkItems(items, sources, limit) {
  const byNumber = new Map(sources.map((source) => [source.n, source]));
  const kept = [];
  let removed = 0;
  for (const item of Array.isArray(items) ? items : []) {
    const text = typeof item?.text === 'string' ? item.text.trim() : '';
    const cites = [
      ...new Set(
        (Array.isArray(item?.cites) ? item.cites : []).filter((n) =>
          Number.isInteger(n),
        ),
      ),
    ];
    const cited = cites.map((n) => byNumber.get(n));
    if (
      !text ||
      text.length > 400 ||
      !cites.length ||
      cited.some((source) => !source) ||
      !isGrounded(text, cited)
    ) {
      removed++;
      continue;
    }
    if (kept.length >= limit) continue;
    kept.push({
      text,
      cites: cites.sort((a, b) => a - b),
      outlets: new Set(cited.map((source) => source.publisher)).size,
    });
  }
  return { kept, removed };
}

/**
 * Check a model reply against the sources it was given.
 * @param {string} modelText The model's raw reply.
 * @param {ReturnType<typeof briefSources>} sources
 * @returns {{sentences: object[], claims: object[], removed: number}|null}
 * null when the reply is not the requested JSON or nothing survives.
 */
export function validateBrief(modelText, sources) {
  const parsed = parseModelJson(modelText);
  if (!parsed) return null;
  const sentences = checkItems(parsed.sentences, sources, BRIEF_MAX_SENTENCES);
  const claims = checkItems(parsed.claims, sources, BRIEF_MAX_CLAIMS);
  if (!sentences.kept.length && !claims.kept.length) return null;
  return {
    sentences: sentences.kept,
    claims: claims.kept,
    removed: sentences.removed + claims.removed,
  };
}
