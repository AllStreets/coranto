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

/**
 * Whether the engine draws its corner brackets around aircraft, satellites
 * and other tracked objects. Coranto marks those with its own icons, so it
 * switches the brackets off for people; their name labels stay.
 */
let objectBrackets = true;

export const showsObjectBrackets = () => objectBrackets;

export function setObjectBrackets(value) {
  objectBrackets = Boolean(value);
}
