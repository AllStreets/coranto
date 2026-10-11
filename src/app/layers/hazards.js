import { createHazardsLayer } from '../../layers/hazards/index.js';
import { isPointerFree } from '../../data/inputOwnership.js';
import { overlayHost } from './overlayHost.js';

/** Wire the natural-hazards layer to the application overlay host. */
export function createApplicationHazards(options) {
  return createHazardsLayer({ overlayHost, isPointerFree, ...options });
}
