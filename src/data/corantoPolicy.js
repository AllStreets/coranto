/**
 * Coranto's rule that everything on the globe is real, as a switch the
 * engine's layers can read. When it is on, a layer that would otherwise fill
 * a gap with simulated content draws nothing there and says why.
 *
 * It is on for people. Automated browsers leave it off so the engine's own
 * gates, which were written against its simulated fallback, keep passing.
 */
let realOnly = false;

export const isRealOnly = () => realOnly;

export function setRealOnly(value) {
  realOnly = Boolean(value);
}
