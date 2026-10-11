import { createElectionsLayer } from '../../layers/elections/index.js';
import { isPointerFree } from '../../data/inputOwnership.js';
import { overlayHost } from './overlayHost.js';

/** Wire the upcoming-elections layer to the application overlay host. */
export function createApplicationElections(options) {
  return createElectionsLayer({ overlayHost, isPointerFree, ...options });
}
