import { createNewsLayer } from '../../layers/news/index.js';
import { isPointerFree } from '../../data/inputOwnership.js';
import { createNewsPanel } from '../../ui/newsPanel.js';
import { overlayHost } from './overlayHost.js';

/** Wire the news layer to the overlay host and mount its panel. */
export function createApplicationNews(options) {
  const layer = createNewsLayer({ overlayHost, isPointerFree, ...options });
  const { init, destroy } = layer;
  let panel = null;
  layer.init = (viewer) => {
    init.call(layer, viewer);
    panel = createNewsPanel({ document: globalThis.document, layer });
  };
  layer.destroy = (viewer) => {
    panel?.destroy();
    panel = null;
    destroy.call(layer, viewer);
  };
  return layer;
}
