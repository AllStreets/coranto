/**
 * Who owns an outlet and how it is funded. This is AUSPEX's outlet table
 * (`js/blindspot.js`), carried over for the owner and the funding type only.
 * AUSPEX also labelled each outlet's political lean; those labels are
 * opinions with no source, so they are not carried over.
 *
 * An outlet that is not in the table gets nothing: no ownership is guessed.
 * Ownership changes; the strip says where the entry comes from.
 */
export const OWNERSHIP_TYPES = Object.freeze({
  state: 'STATE',
  public: 'PUBLIC',
  private: 'PRIVATE',
  nonprofit: 'NONPROFIT',
});

/** Lowercase outlet name -> [country code, owner, type]. */
const OUTLETS = Object.freeze({
  reuters: ['gb', 'Thomson Reuters', 'private'],
  'associated press': ['us', 'AP (member cooperative)', 'nonprofit'],
  ap: ['us', 'AP (member cooperative)', 'nonprofit'],
  afp: ['fr', 'Agence France-Presse', 'public'],
  bbc: ['gb', 'BBC (UK licence fee)', 'public'],
  'the guardian': ['gb', 'Scott Trust', 'nonprofit'],
  guardian: ['gb', 'Scott Trust', 'nonprofit'],
  'the new york times': ['us', 'The New York Times Co.', 'private'],
  'new york times': ['us', 'The New York Times Co.', 'private'],
  nyt: ['us', 'The New York Times Co.', 'private'],
  'washington post': ['us', 'Nash Holdings (J. Bezos)', 'private'],
  'wall street journal': ['us', 'News Corp (Murdoch)', 'private'],
  wsj: ['us', 'News Corp (Murdoch)', 'private'],
  bloomberg: ['us', 'Bloomberg L.P.', 'private'],
  'financial times': ['gb', 'Nikkei (Japan)', 'private'],
  ft: ['gb', 'Nikkei (Japan)', 'private'],
  cnn: ['us', 'Warner Bros. Discovery', 'private'],
  'fox news': ['us', 'Fox Corp (Murdoch)', 'private'],
  npr: ['us', 'NPR (member-funded)', 'nonprofit'],
  pbs: ['us', 'PBS (public)', 'public'],
  cbs: ['us', 'Paramount Global', 'private'],
  nbc: ['us', 'Comcast / NBCUniversal', 'private'],
  'abc news': ['us', 'Disney', 'private'],
  politico: ['us', 'Axel Springer (Germany)', 'private'],
  axios: ['us', 'Cox Enterprises', 'private'],
  'the hill': ['us', 'Nexstar', 'private'],
  'usa today': ['us', 'Gannett', 'private'],
  wired: ['us', 'Condé Nast', 'private'],
  'al jazeera': ['qa', 'Qatar government', 'state'],
  'al arabiya': ['sa', 'MBC / Saudi-linked', 'state'],
  'middle east eye': ['gb', 'M.E.E. Ltd', 'private'],
  trt: ['tr', 'Turkish government', 'state'],
  'trt world': ['tr', 'Turkish government', 'state'],
  xinhua: ['cn', 'Chinese government', 'state'],
  cgtn: ['cn', 'Chinese government (CCP)', 'state'],
  'global times': ['cn', "People's Daily (CCP)", 'state'],
  'china daily': ['cn', 'Chinese government', 'state'],
  scmp: ['hk', 'Alibaba Group', 'private'],
  'south china morning post': ['hk', 'Alibaba Group', 'private'],
  rt: ['ru', 'Russian government', 'state'],
  tass: ['ru', 'Russian government', 'state'],
  sputnik: ['ru', 'Russian government (Rossiya Segodnya)', 'state'],
  ria: ['ru', 'Russian government', 'state'],
  interfax: ['ru', 'Interfax (private, Moscow)', 'private'],
  dw: ['de', 'German government-funded', 'public'],
  'deutsche welle': ['de', 'German government-funded', 'public'],
  'france 24': ['fr', 'France Médias Monde (state)', 'public'],
  euronews: ['fr', 'Alpac Capital / EU-funded', 'private'],
  'the times of india': ['in', 'Bennett, Coleman & Co.', 'private'],
  'times of india': ['in', 'Bennett, Coleman & Co.', 'private'],
  'the hindu': ['in', 'The Hindu Group', 'private'],
  nikkei: ['jp', 'Nikkei Inc.', 'private'],
  kyodo: ['jp', 'Kyodo News (cooperative)', 'nonprofit'],
  africanews: ['cg', 'Euronews group', 'private'],
  cna: ['sg', 'Mediacorp (Singapore state-linked)', 'state'],
  reliefweb: ['us', 'UN OCHA', 'public'],
  'un news': ['us', 'United Nations', 'public'],
});

/**
 * Editions that are the same organisation under another name. A name is
 * matched whole, never by a fragment: "ABC News (Australia)" is not Disney's
 * ABC News.
 */
const SAME_AS = Object.freeze({
  'bbc mundo': 'bbc',
  'bbc news': 'bbc',
  'al jazeera english': 'al jazeera',
  'al jazeera arabic': 'al jazeera',
  'dw news': 'dw',
  'the associated press': 'associated press',
});

/**
 * @param {string} publisher The outlet's name as the feed gives it.
 * @returns {{owner: string, type: string, label: string, country: string}|null}
 */
export function outletOwnership(publisher) {
  const name = String(publisher ?? '')
    .trim()
    .toLowerCase();
  const row = OUTLETS[SAME_AS[name] ?? name];
  if (!row) return null;
  const [country, owner, type] = row;
  return { owner, type, label: OWNERSHIP_TYPES[type] ?? '', country };
}
