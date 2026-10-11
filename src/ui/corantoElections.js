import { electionCountdown, electionDay } from '../layers/elections/model.js';
import { createCampaignMoney } from './corantoCampaignMoney.js';

/**
 * The Elections lens: polling days in the next 120 days as Wikidata records
 * them, beside the election news from the feed. Wikidata is a public,
 * volunteer-edited database, not an election authority, and the lens says so.
 * Below the calendar it shows US campaign money from FEC filings.
 */

/** Words that mark a headline as election news. */
export const ELECTION_TERMS = Object.freeze([
  'election',
  'elections',
  'electoral',
  'vote',
  'votes',
  'voters',
  'voting',
  'ballot',
  'ballots',
  'referendum',
  'candidate',
  'candidates',
  'polls',
  'runoff',
  'campaign',
]);

/** The card shown for one country-and-day group. */
export function electionCard(group) {
  const more = group.count - 1;
  const link = group.lead.wikipedia ?? group.lead.wikidata;
  return {
    kind: `ELECTION · ${electionCountdown(group.daysUntil).toUpperCase()}`,
    title: group.lead.title,
    meta: [
      group.country,
      electionDay(group.date),
      more > 0
        ? `${more} more ${more === 1 ? 'contest' : 'contests'} that day`
        : '',
      'as recorded by Wikidata',
    ]
      .filter(Boolean)
      .join(' · '),
    url: link,
    linkText: group.lead.wikipedia
      ? 'Open at en.wikipedia.org'
      : 'Open at wikidata.org',
  };
}

function el(document, tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}

/**
 * @param {object} options
 * @param {Document} options.document
 * @param {() => object|null} options.getDataManager
 * @param {(detail: object|null) => void} options.showCard
 * @param {(country: string|null) => void} options.onCountry Narrow the feed.
 */
export function createElectionsLens({
  document,
  getDataManager,
  showCard,
  onCountry,
}) {
  let active = false;
  let turnedOn = false;
  let unsubscribe = null;
  let shownKey = null;

  const heading = el(document, 'div', {
    class: 'coranto-rail-heading',
    text: 'POLLING DAYS',
  });
  const list = el(document, 'div', { class: 'coranto-elections-list' });
  const money = createCampaignMoney({ document });
  const calendar = el(document, 'div', { class: 'coranto-elections-pane' });
  // Two short lists, one at a time, instead of one long column.
  const tabCalendar = el(document, 'button', {
    type: 'button',
    class: 'coranto-money-tab',
    text: 'Polling days',
  });
  const tabMoney = el(document, 'button', {
    type: 'button',
    class: 'coranto-money-tab',
    text: 'US campaign money',
  });
  function showPane(name) {
    calendar.hidden = name !== 'calendar';
    money.element.hidden = name !== 'money';
    tabCalendar.setAttribute('aria-pressed', String(name === 'calendar'));
    tabMoney.setAttribute('aria-pressed', String(name === 'money'));
  }
  tabCalendar.addEventListener('click', () => showPane('calendar'));
  tabMoney.addEventListener('click', () => showPane('money'));
  const element = el(
    document,
    'div',
    { class: 'coranto-power coranto-elections' },
    el(
      document,
      'div',
      { class: 'coranto-money-tabs', role: 'group', 'aria-label': 'Show' },
      tabCalendar,
      tabMoney,
    ),
    calendar,
    money.element,
  );
  calendar.append(
    el(document, 'p', {
      class: 'coranto-power-intro',
      text: 'Elections in the next 120 days, as recorded by Wikidata, with election news beside them. Wikidata is edited by volunteers and is not an election authority: check dates with the official body before relying on them.',
    }),
    heading,
    list,
  );
  showPane('calendar');
  element.hidden = true;

  const layer = () => getDataManager()?.layers?.get('elections')?.module;

  function render(view) {
    if (!active) return;
    const groups = view?.snapshot?.groups ?? [];
    heading.textContent = groups.length
      ? `POLLING DAYS · ${groups.length}`
      : 'POLLING DAYS';
    list.replaceChildren(
      ...groups.map((group) => {
        const row = el(
          document,
          'button',
          {
            type: 'button',
            class: 'coranto-election',
            title: group.lead.title,
            ...(view.selected?.key === group.key
              ? { 'aria-current': 'true' }
              : {}),
          },
          el(document, 'span', {
            class: 'coranto-election-date',
            text: electionDay(group.date),
          }),
          el(
            document,
            'span',
            { class: 'coranto-election-body' },
            el(document, 'span', {
              class: 'coranto-election-country',
              text: group.country,
            }),
            el(document, 'span', {
              class: 'coranto-election-title',
              text:
                group.count > 1
                  ? `${group.lead.title} + ${group.count - 1} more`
                  : group.lead.title,
            }),
          ),
          el(document, 'span', {
            class: 'coranto-election-days',
            text: electionCountdown(group.daysUntil),
          }),
        );
        row.addEventListener('click', () =>
          layer()?.select(group.key, { focus: true }),
        );
        return row;
      }),
    );
    if (!groups.length)
      list.append(
        el(document, 'p', {
          class: 'coranto-power-none',
          text: view?.error
            ? 'The election calendar is not reachable. Nothing to show.'
            : 'Reading the election calendar…',
        }),
      );
    // Act only when the selection changes, so a routine refresh does not
    // overwrite a search the reader typed.
    const key = view?.selected?.key ?? null;
    if (key === shownKey) return;
    shownKey = key;
    if (view?.selected) {
      showCard({
        ...electionCard(view.selected),
        onClose: () => layer()?.select(null),
      });
      onCountry(view.selected.country);
    } else {
      showCard(null);
      onCountry(null);
    }
  }

  return {
    element,
    enter() {
      active = true;
      element.hidden = false;
      money.enter();
      const manager = getDataManager();
      const module = layer();
      if (manager && module) {
        if (!manager.isEnabled('elections')) {
          turnedOn = true;
          Promise.resolve(manager.setEnabled('elections', true)).catch(
            () => {},
          );
        }
        unsubscribe = module.subscribe(render);
        render(module.getView());
      }
    },
    leave() {
      active = false;
      shownKey = null;
      element.hidden = true;
      money.leave();
      unsubscribe?.();
      unsubscribe = null;
      const manager = getDataManager();
      if (turnedOn && manager?.isEnabled('elections'))
        Promise.resolve(manager.setEnabled('elections', false)).catch(() => {});
      turnedOn = false;
    },
  };
}
