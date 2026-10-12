/**
 * Machine translation of one headline and its summary, shown beside the
 * original and labelled as a machine translation.
 *
 * Code cannot tell whether a translation is faithful. It can tell whether the
 * figures survived, and it does: every number in the original must be in the
 * translation and no number may be added. A translation that fails is not
 * shown. The original is always still there to read.
 */

/** Target languages: English, then AUSPEX's ten. */
export const TRANSLATE_LANGUAGES = Object.freeze([
  ['en', 'English'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['ar', 'Arabic'],
  ['zh-CN', 'Chinese (Simplified)'],
  ['ru', 'Russian'],
  ['hi', 'Hindi'],
  ['pt', 'Portuguese'],
  ['ja', 'Japanese'],
  ['sw', 'Swahili'],
]);

export const translateLanguageName = (code) =>
  TRANSLATE_LANGUAGES.find(([id]) => id === code)?.[1] ?? null;

export const TRANSLATE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary'],
  properties: { title: { type: 'string' }, summary: { type: 'string' } },
});

export function translateInstructions(language) {
  return [
    `Translate the news headline and summary into ${language}.`,
    'Rules:',
    '1. Translate only. Add nothing, leave nothing out, explain nothing.',
    '2. Keep every number exactly as written, in the same digits. Do not turn digits into words or words into digits, and do not convert units or currencies.',
    '3. Keep names of people, organisations and places as that language normally writes them.',
    '4. If the summary is empty, return an empty summary.',
    'Reply with JSON only: {"title":"...","summary":"..."}',
  ].join('\n');
}

/** What the model is sent: the outlet's own words and nothing else. */
export function translateInput(article) {
  return `Headline: ${article.title}\nSummary: ${article.summary ?? ''}`;
}

/**
 * The numbers in a text, as digit strings with separators removed, sorted.
 * "1,200", "1.200" and "1 200" all read as 1200, since languages punctuate
 * numbers differently.
 */
export function numbersIn(text) {
  return (
    String(text ?? '')
      .normalize('NFKC')
      .match(/\d(?:[\d.,'\u00a0\u202f ]*\d)?/g) ?? []
  )
    .flatMap((run) =>
      // A space separates thousands only when three digits follow it.
      run.split(/[\u00a0\u202f ](?!\d{3}(?!\d))/),
    )
    .map((run) => run.replace(/\D/g, ''))
    .filter(Boolean)
    .sort();
}

function parse(text) {
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

/**
 * Check a model reply against the article it translated.
 * @returns {{ok: true, title: string, summary: string}|{ok: false, reason: 'unreadable'|'empty'|'figures'|'length'}}
 */
export function checkTranslation(modelText, article) {
  const reply = parse(modelText);
  if (!reply || typeof reply.title !== 'string')
    return { ok: false, reason: 'unreadable' };
  const title = reply.title.trim();
  const summary = typeof reply.summary === 'string' ? reply.summary.trim() : '';
  const original = `${article.title} ${article.summary ?? ''}`;
  if (!title || (article.summary?.trim() && !summary))
    return { ok: false, reason: 'empty' };
  // A translation several times the length of its source has added something.
  if (`${title} ${summary}`.length > original.length * 3 + 80)
    return { ok: false, reason: 'length' };
  if (
    numbersIn(original).join('|') !== numbersIn(`${title} ${summary}`).join('|')
  )
    return { ok: false, reason: 'figures' };
  return { ok: true, title, summary };
}
