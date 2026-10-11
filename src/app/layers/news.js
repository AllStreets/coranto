import { createNewsLayer } from '../../layers/news/index.js';
import { isPointerFree } from '../../data/inputOwnership.js';
import { createCorantoShell } from '../../ui/corantoShell.js';
import { overlayHost } from './overlayHost.js';

/** Wire the news layer to the overlay host and mount Coranto's shell. */
export function createApplicationNews(options) {
  const layer = createNewsLayer({ overlayHost, isPointerFree, ...options });
  const { destroy } = layer;
  // The shell exists from catalog construction so its mode is set before the
  // engine's own first-run surfaces decide whether to appear.
  let shell = createCorantoShell({ document: globalThis.document, layer });
  layer.attachDataManager = (dataManager) =>
    shell?.attachDataManager(dataManager);
  layer.destroy = (viewer) => {
    shell?.destroy();
    shell = null;
    destroy.call(layer, viewer);
  };
  return layer;
}
