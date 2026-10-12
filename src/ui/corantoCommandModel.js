/**
 * The command palette's matching. A command is something the app can already
 * do: `{ id, title, kind, keywords?, icon?, pinned?, run }`. `kind` says what
 * running it does ("FLY TO", "WATCH LIVE", "SWITCH ON"), and is shown beside
 * every result, so two results with the same name are told apart by what
 * they do.
 */

const fold = (text) =>
  String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** How well one word of the query fits a command. 0 is no fit. */
function wordScore(word, title, extra) {
  if (title === word) return 100;
  if (title.startsWith(word)) return 80;
  if (new RegExp(`(?:^|[^a-z0-9])${escape(word)}`).test(title)) return 60;
  if (title.includes(word)) return 40;
  if (new RegExp(`(?:^|[^a-z0-9])${escape(word)}`).test(extra)) return 25;
  return extra.includes(word) ? 12 : 0;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The commands that fit a query, best first. Every word typed must fit.
 * With nothing typed, the pinned commands are returned in their own order.
 *
 * @param {object[]} commands
 * @param {string} query
 * @param {number} [limit]
 */
export function rankCommands(commands, query, limit = 40) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length)
    return (commands ?? []).filter((command) => command.pinned).slice(0, limit);
  const scored = [];
  (commands ?? []).forEach((command, index) => {
    const title = fold(command.title);
    const extra = fold(`${command.kind ?? ''} ${command.keywords ?? ''}`);
    let total = 0;
    for (const word of words) {
      const score = wordScore(word, title, extra);
      if (!score) return;
      total += score;
    }
    // A whole-title match beats everything; then a small lift for `weight`.
    if (title === words.join(' ')) total += 200;
    scored.push({ command, score: total + (command.weight ?? 0), index });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.command);
}

/**
 * True when the best results could each be what was meant: they share a name,
 * or each begins with what was typed, and they do different things. The
 * reader is then told to choose.
 */
export function isAmbiguous(results, query = '') {
  if ((results?.length ?? 0) < 2) return false;
  const typed = fold(query);
  const first = fold(results[0].title);
  const fits = (command) => {
    const title = fold(command.title);
    return title === first || (typed.length >= 3 && title.startsWith(typed));
  };
  if (!fits(results[0])) return false;
  return results
    .slice(1, 4)
    .some((command) => fits(command) && command.kind !== results[0].kind);
}
