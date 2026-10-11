import * as Cesium from 'cesium';
import {
  HAZARD_OVERLAY_COHORT_LIMIT,
  HAZARD_OVERLAY_SOURCE_ID,
  createHazardOverlayEntry,
  hazardColor,
  hazardHasLabel,
  hazardMarkerSize,
  hazardStats,
} from './model.js';
export * from './model.js';
export { createHazardSource } from './source.js';

const ENTITY_PREFIX = 'hazard:';

/**
 * Natural hazards from GDACS and NASA EONET: cyclones, floods, volcanoes,
 * earthquakes, wildfires, storms and sea ice. Each marker is one tracked
 * event at the tracker's own coordinate.
 */
export function createHazardsLayer({
  source,
  overlayHost,
  isPointerFree = () => true,
  screenSpaceEventHandlerFactory = (viewer) =>
    new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas),
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('Hazards require a snapshot source');
  if (!overlayHost) throw new TypeError('Hazards require an overlay host');
  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _clickHandler = null;
  let _enabled = false;
  let _snapshot = null;
  let _error = null;
  let _selectedId = null;
  const _listeners = new Set();

  function emit() {
    for (const listener of [..._listeners]) {
      try {
        listener(layer.getView());
      } catch (error) {
        console.warn('[Data:Hazards] listener failed', error);
      }
    }
  }

  function render() {
    if (!_dataSource) return;
    _dataSource.entities.removeAll();
    const entries = [];
    for (const item of _snapshot?.events ?? []) {
      const position = Cesium.Cartesian3.fromDegrees(item.lon, item.lat);
      const selected = item.id === _selectedId;
      const color = Cesium.Color.fromCssColorString(hazardColor(item));
      _dataSource.entities.add({
        id: ENTITY_PREFIX + item.id,
        position,
        point: {
          pixelSize: hazardMarkerSize(item) + (selected ? 4 : 0),
          color: color.withAlpha(0.9),
          outlineColor: selected
            ? Cesium.Color.WHITE
            : Cesium.Color.BLACK.withAlpha(0.7),
          outlineWidth: selected ? 2 : 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 50_000,
        },
      });
      if (hazardHasLabel(item) || selected)
        entries.push(createHazardOverlayEntry({ item, position, selected }));
    }
    if (_enabled)
      overlayHost.setEntries(
        HAZARD_OVERLAY_SOURCE_ID,
        entries
          .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
          .slice(0, HAZARD_OVERLAY_COHORT_LIMIT),
        {
          cohortLimit: HAZARD_OVERLAY_COHORT_LIMIT,
          collisionCapacity: 24,
          moving: false,
        },
      );
    _viewer?.scene?.requestRender?.();
  }

  function installClickHandler() {
    if (_clickHandler || !_viewer) return;
    _clickHandler = screenSpaceEventHandlerFactory(_viewer);
    _clickHandler.setInputAction((click) => {
      if (!isPointerFree()) return;
      const picked = _viewer.scene.pick(click.position);
      const id = picked?.id?.id ?? picked?.id;
      if (typeof id === 'string' && id.startsWith(ENTITY_PREFIX))
        layer.select(id.slice(ENTITY_PREFIX.length));
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  const layer = {
    id: 'hazards',
    name: 'Natural Hazards',
    icon: '◈',
    source: 'GDACS · NASA EONET',
    updateInterval: 15 * 60 * 1000,

    init(viewer) {
      if (_viewer) throw new Error('Hazards layer is already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('hazards');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      overlayHost.setVisible(HAZARD_OVERLAY_SOURCE_ID, false);
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost.setVisible(HAZARD_OVERLAY_SOURCE_ID, true);
      installClickHandler();
      render();
      emit();
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      _selectedId = null;
      _clickHandler?.destroy();
      _clickHandler = null;
      if (_dataSource) _dataSource.show = false;
      overlayHost.clearSource(HAZARD_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(HAZARD_OVERLAY_SOURCE_ID, false);
      emit();
    },

    async update() {
      if (!_enabled || !_dataSource) return false;
      _request?.abort();
      const request = new AbortController();
      _request = request;
      const current = () =>
        !request.signal.aborted && _request === request && _enabled;
      try {
        const snapshot = await source.getSnapshot({ signal: request.signal });
        if (!current()) return false;
        _snapshot = snapshot;
        _error = null;
        if (!snapshot.events.some((item) => item.id === _selectedId))
          _selectedId = null;
        render();
        emit();
        return true;
      } catch (error) {
        if (!current()) return false;
        _error = error?.message || 'Hazard trackers unavailable';
        if (error?.unavailable) {
          _snapshot = null;
          _selectedId = null;
          render();
        }
        emit();
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      _clickHandler?.destroy();
      _clickHandler = null;
      _enabled = false;
      overlayHost.clearSource(HAZARD_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(HAZARD_OVERLAY_SOURCE_ID, false);
      if (_dataSource) {
        viewer?.dataSources.remove(_dataSource, true);
        _dataSource = null;
      }
      _viewer = null;
      _snapshot = null;
      _selectedId = null;
      _error = null;
      emit();
      _listeners.clear();
    },

    getStats() {
      return hazardStats({ snapshot: _snapshot, error: _error });
    },

    getView() {
      return {
        enabled: _enabled,
        snapshot: _snapshot,
        error: _error,
        selected:
          _snapshot?.events.find((item) => item.id === _selectedId) ?? null,
      };
    },

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      _listeners.add(listener);
      return () => _listeners.delete(listener);
    },

    /** Select an event by id, or null to clear. */
    select(id) {
      _selectedId = _snapshot?.events.some((item) => item.id === id)
        ? id
        : null;
      render();
      emit();
    },
  };
  return layer;
}
