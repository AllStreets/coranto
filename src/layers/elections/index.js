import * as Cesium from 'cesium';
import {
  ELECTION_COLOR,
  ELECTION_OVERLAY_SOURCE_ID,
  createElectionOverlayEntry,
  electionHasLabel,
  electionMarkerSize,
  electionStats,
} from './model.js';
export * from './model.js';
export { createElectionSource } from './source.js';

const ENTITY_PREFIX = 'election:';

/**
 * Upcoming elections as Wikidata records them: one marker per country and
 * polling day, at the country's point. A country with elections on two days
 * has two entries at the same point; the nearer one is drawn.
 */
export function createElectionsLayer({
  source,
  overlayHost,
  isPointerFree = () => true,
  screenSpaceEventHandlerFactory = (viewer) =>
    new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas),
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('Elections require a snapshot source');
  if (!overlayHost) throw new TypeError('Elections require an overlay host');
  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _clickHandler = null;
  let _enabled = false;
  let _snapshot = null;
  let _error = null;
  let _selectedKey = null;
  const _listeners = new Set();
  const color = Cesium.Color.fromCssColorString(ELECTION_COLOR);

  function emit() {
    for (const listener of [..._listeners]) {
      try {
        listener(layer.getView());
      } catch (error) {
        console.warn('[Data:Elections] listener failed', error);
      }
    }
  }

  function render() {
    if (!_dataSource) return;
    _dataSource.entities.removeAll();
    const entries = [];
    const drawn = new Set();
    for (const group of _snapshot?.groups ?? []) {
      const selected = group.key === _selectedKey;
      // Groups arrive nearest first, so the first per country is the nearest.
      if (drawn.has(group.iso2) && !selected) continue;
      drawn.add(group.iso2);
      const position = Cesium.Cartesian3.fromDegrees(group.lon, group.lat);
      _dataSource.entities.add({
        id: ENTITY_PREFIX + group.key,
        position,
        point: {
          pixelSize: electionMarkerSize(group) + (selected ? 4 : 0),
          color: color.withAlpha(0.2),
          outlineColor: selected ? Cesium.Color.WHITE : color,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 50_000,
        },
      });
      if (electionHasLabel(group) || selected)
        entries.push(createElectionOverlayEntry({ group, position, selected }));
    }
    if (_enabled)
      overlayHost.setEntries(
        ELECTION_OVERLAY_SOURCE_ID,
        entries.sort(
          (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
        ),
        { cohortLimit: 64, collisionCapacity: 32, moving: false },
      );
    _viewer?.scene?.requestRender?.();
  }

  const layer = {
    id: 'elections',
    name: 'Upcoming Elections',
    icon: '◇',
    source: 'Wikidata',
    updateInterval: 6 * 60 * 60 * 1000,

    init(viewer) {
      if (_viewer) throw new Error('Elections layer is already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('elections');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      overlayHost.setVisible(ELECTION_OVERLAY_SOURCE_ID, false);
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost.setVisible(ELECTION_OVERLAY_SOURCE_ID, true);
      if (!_clickHandler && _viewer) {
        _clickHandler = screenSpaceEventHandlerFactory(_viewer);
        _clickHandler.setInputAction((click) => {
          if (!isPointerFree()) return;
          const picked = _viewer.scene.pick(click.position);
          const id = picked?.id?.id ?? picked?.id;
          if (typeof id === 'string' && id.startsWith(ENTITY_PREFIX))
            layer.select(id.slice(ENTITY_PREFIX.length));
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      }
      render();
      emit();
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      _selectedKey = null;
      _clickHandler?.destroy();
      _clickHandler = null;
      if (_dataSource) _dataSource.show = false;
      overlayHost.clearSource(ELECTION_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(ELECTION_OVERLAY_SOURCE_ID, false);
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
        if (!snapshot.groups.some((group) => group.key === _selectedKey))
          _selectedKey = null;
        render();
        emit();
        return true;
      } catch (error) {
        if (!current()) return false;
        _error = error?.message || 'Election calendar unavailable';
        if (error?.unavailable) {
          _snapshot = null;
          _selectedKey = null;
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
      overlayHost.clearSource(ELECTION_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(ELECTION_OVERLAY_SOURCE_ID, false);
      if (_dataSource) {
        viewer?.dataSources.remove(_dataSource, true);
        _dataSource = null;
      }
      _viewer = null;
      _snapshot = null;
      _selectedKey = null;
      _error = null;
      emit();
      _listeners.clear();
    },

    getStats() {
      return electionStats({ snapshot: _snapshot, error: _error });
    },

    getView() {
      return {
        enabled: _enabled,
        snapshot: _snapshot,
        error: _error,
        selected:
          _snapshot?.groups.find((group) => group.key === _selectedKey) ?? null,
      };
    },

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      _listeners.add(listener);
      return () => _listeners.delete(listener);
    },

    /** Select a country-and-day group by key, optionally flying to it. */
    select(key, { focus = false } = {}) {
      const group = _snapshot?.groups.find((entry) => entry.key === key);
      _selectedKey = group ? group.key : null;
      render();
      emit();
      if (group && focus && _viewer?.camera) {
        _viewer.camera.cancelFlight?.();
        _viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            group.lon,
            group.lat,
            4_500_000,
          ),
          duration: 1.6,
        });
      }
    },
  };
  return layer;
}
