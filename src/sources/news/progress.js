/**
 * Good-news tagging, ported from AUSPEX's breakthroughs sense (Apache-2.0,
 * Connor Evans). The word "auspicious" comes from "auspex": the watcher
 * announced favourable signs too.
 *
 * A headline is tagged only when it matches a progress pattern and carries
 * no peril word. The tag is an inference from the headline alone and the
 * interface labels it as automatic.
 */

// First match wins.
const BUCKETS = [
  [
    'medical',
    /\b(cure[sd]?|vaccine (approved|rollout|success|breakthrough)|new vaccine|breakthrough treatment|clinical trial success|fda approv\w+|drug approv\w+|remission|gene therapy|first transplant|transplant first|eradicat\w+|(polio|malaria|measles)-free)\b/i,
  ],
  [
    'science',
    /\b(fusion|quantum|breakthrough|discover(y|ies|ed|s)|first[- ]ever|telescope reveals|new species|rediscovered|milestone)\b/i,
  ],
  [
    'space',
    /\b(successful(ly)? (launch\w*|land\w*|dock\w*)|lands on (the )?(moon|mars)|orbit achieved|docking|launch success|rover|spacewalk)\b/i,
  ],
  [
    'humanity',
    /\b((wins|awarded|receives?) (the )?nobel|peace (deal|agreement|accord) (signed|reached)|ceasefire (agreed|holds|reached)|hostages? (freed|released)|rescued|reunited|saved from extinction|species (recover\w+|returns?)|record low (poverty|unemployment|emissions)|poverty falls|literacy rises|reforest\w+)\b/i,
  ],
];

// A headline that also reads as a peril is never tagged as good news.
const PERIL_RE =
  /\b(war|death|deaths|dead|attack|attacks|crisis|killed|kills|crash|collapse|scandal|dies|deadly|massacre|bomb|bombing|shooting|outbreak|famine|fraud|arrested|lawsuit|recall|warns?|fears?|threat|threatens|sanctions?|snub|fumes|criticiz\w+|criticis\w+|condemn\w+|unacceptable|bans?|banned|crackdown|protests?)\b/i;

export const NEWS_PROGRESS_KINDS = Object.freeze(BUCKETS.map(([kind]) => kind));

/**
 * @param {string} title The publisher's headline.
 * @returns {string|null} A progress kind, or null.
 */
export function detectProgress(title) {
  if (typeof title !== 'string' || !title) return null;
  if (PERIL_RE.test(title)) return null;
  for (const [kind, pattern] of BUCKETS) if (pattern.test(title)) return kind;
  return null;
}
