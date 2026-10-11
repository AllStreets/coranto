/**
 * Groups articles that report the same event, so the feed can show one story
 * with the outlets that carried it. Grouping is by shared headline words
 * only; no model is involved. It is an inference and the interface says so.
 */

const STOPWORDS = new Set(
  (
    'about after again against amid among also been before being between both ' +
    'could does down during each from have having here into just like more ' +
    'most much must near need over said says same should since some such than ' +
    'that their them then there these they this those through under until very ' +
    'want were what when where which while will with would your first last ' +
    'year years week weeks today live news latest update updates report reports ' +
    'watch video analysis explained takes take make makes made gets back calls ' +
    'call tells told warns plan plans seen sets ' +
    // Dates are shared by unrelated headlines ("October 11, 2026").
    'january february march april june july august september october ' +
    'november december monday tuesday wednesday thursday friday saturday sunday'
  ).split(' '),
);

const stem = (word) =>
  word.length > 5 && word.endsWith('ies')
    ? `${word.slice(0, -3)}y`
    : word.length > 4 && word.endsWith('s') && !word.endsWith('ss')
      ? word.slice(0, -1)
      : word;

/** Significant words of a headline: lower-case, four letters or more, or a number. */
export function headlineTerms(title) {
  const terms = new Set();
  for (const raw of String(title ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[a-z]+(?:[-'][a-z]+)*|\d+(?:[.,]\d+)?/g) ?? []) {
    const word = raw.replace(/'s$/, '').replace(/'/g, '');
    if (/^\d/.test(word)) {
      // Keep figures ("300", "7.7"); skip years, which date a headline.
      if (word.length >= 2 && !/^(?:19|20)\d\d$/.test(word)) terms.add(word);
    } else if (word.length >= 4 && !STOPWORDS.has(word)) terms.add(stem(word));
  }
  return terms;
}

/** Two headlines are the same story when they share enough of their words. */
export function sameStory(a, b) {
  let shared = 0;
  for (const term of a) if (b.has(term)) shared++;
  if (shared < 3) return false;
  const smaller = Math.min(a.size, b.size);
  const union = a.size + b.size - shared;
  // Three shared words that are half of the shorter headline, four that are
  // most of it, or a clear overall overlap.
  return (
    shared / smaller >= 0.5 ||
    (shared >= 4 && shared / smaller >= 0.4) ||
    shared / union >= 0.34
  );
}

/**
 * @param {Array<{id: string, title: string, publisher: string, publishedAt: string}>} articles
 * @returns {Array<{id: string, articleIds: string[], outlets: number}>}
 * Stories in the order of their newest article. Every article is in exactly
 * one story; a story with one outlet is an article nobody else carried.
 */
export function clusterArticles(articles) {
  const items = (articles ?? []).map((article) => ({
    article,
    terms: headlineTerms(article.title),
  }));
  // Stories pinned to two different cities or regions are different events,
  // however alike their wording ("shooting", "pregnant woman").
  const elsewhere = (a, b) => {
    const pa = a.article.place;
    const pb = b.article.place;
    return Boolean(
      pa &&
      pb &&
      pa.precision !== 'country' &&
      pb.precision !== 'country' &&
      pa.name !== pb.name,
    );
  };
  const stories = [];
  for (const item of items) {
    let home = null;
    for (const story of stories) {
      if (
        story.members.some(
          (member) =>
            !elsewhere(member, item) && sameStory(member.terms, item.terms),
        )
      ) {
        home = story;
        break;
      }
    }
    if (home) home.members.push(item);
    else stories.push({ members: [item] });
  }
  return stories.map(({ members }) => {
    const ids = members.map((member) => member.article.id);
    return {
      // Stable while the same earliest-listed article leads the story.
      id: `s-${[...ids].sort()[0]}`,
      articleIds: ids,
      outlets: new Set(members.map((member) => member.article.publisher)).size,
    };
  });
}
