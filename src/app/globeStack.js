/**
 * Coranto's own globe layers sit directly above the base map, in a fixed
 * order, and under every data overlay. The map controller keeps the base
 * map at index 0 and swaps it on a stack change; each of these layers is
 * tagged with its role and put back in place afterwards.
 *
 * @module app/globeStack
 */

/** Bottom to top, just above the base map. */
export const OVER_BASE_ORDER = Object.freeze(['blue-marble', 'city-lights']);

/** Mark a layer with its role in OVER_BASE_ORDER. */
export function tagLayer(layer, role) {
  layer.corantoRole = role;
  return layer;
}

function moveTo(layers, layer, index) {
  const top = layers.length - 1;
  const target = Math.min(index, top);
  while (layers.indexOf(layer) > target) layers.lower(layer);
  while (layers.indexOf(layer) < target) layers.raise(layer);
}

/** Put every tagged layer in its slot, starting just above the base map. */
export function placeOverBase(layers) {
  const tagged = [];
  for (let i = 0; i < layers.length; i++) {
    const layer = layers.get(i);
    if (OVER_BASE_ORDER.includes(layer.corantoRole)) tagged.push(layer);
  }
  tagged.sort(
    (a, b) =>
      OVER_BASE_ORDER.indexOf(a.corantoRole) -
      OVER_BASE_ORDER.indexOf(b.corantoRole),
  );
  // With no base map under them, they start at the bottom.
  const hasBase = layers.length > tagged.length;
  let slot = hasBase ? 1 : 0;
  for (const layer of tagged) moveTo(layers, layer, slot++);
}
