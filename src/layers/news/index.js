import * as Cesium from 'cesium';
import {
  NEWS_ACCENT,
  NEWS_FOCUS_HEIGHT_M,
  NEWS_GOOD_ACCENT,
  NEWS_OVERLAY_COHORT_LIMIT,
  NEWS_OVERLAY_COLLISION_CAPACITY,
  NEWS_OVERLAY_SOURCE_ID,
  createNewsOverlayEntry,
  groupNewsByPlace,
  newsMarkerSize,
  newsStats,
} from './model.js';
export * from './model.js';
export { createNewsSource, NewsFeedUnavailableError } from './source.js';

const ENTITY_PREFIX = 'news:';

/**
 * Headlines on the globe: one marker per place that current stories name.
 * City matches are solid; country and region matches are hollow rings, so an
 * approximate placement is visible as approximate.
 */
export function createNewsLayer({
  source,
  overlayHost,
  isPointerFree = () => true,
  screenSpaceEventHandlerFactory = (viewer) =>
    new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas),
} = {}) {
  if (typeof source?.getSnapshot !== 'function')
    throw new TypeError('News requires a snapshot source');
  if (!overlayHost) throw new TypeError('News requires an overlay host');
  let _viewer = null;
  let _request = null;
  let _dataSource = null;
  let _clickHandler = null;
  let _enabled = false;
  let _snapshot = null;
  let _error = null;
  let _unavailable = null;
  let _groups = [];
  let _selectedKey = null;
  let _goodNewsOnly = false;
  // English by default; other languages are one choice away in the feed.
  let _language = 'en';
  const _listeners = new Set();

  const newsColor = Cesium.Color.fromCssColorString(NEWS_ACCENT);
  const goodColor = Cesium.Color.fromCssColorString(NEWS_GOOD_ACCENT);

  function regroup() {
    const articles = (_snapshot?.articles ?? []).filter(
      (a) => !_language || (a.lang ?? 'en') === _language,
    );
    _groups = groupNewsByPlace(
      _goodNewsOnly ? articles.filter((a) => a.progress) : articles,
    );
    if (_selectedKey && !_groups.some((g) => g.key === _selectedKey))
      _selectedKey = null;
  }

  function emit() {
    for (const listener of [..._listeners]) {
      try {
        listener(layer.getView());
      } catch (error) {
        console.warn('[Data:News] listener failed', error);
      }
    }
  }

  function render() {
    if (!_dataSource) return;
    _dataSource.entities.removeAll();
    const accent = _goodNewsOnly ? goodColor : newsColor;
    const accentCss = _goodNewsOnly ? NEWS_GOOD_ACCENT : NEWS_ACCENT;
    const entries = [];
    for (const group of _groups) {
      const position = Cesium.Cartesian3.fromDegrees(group.lon, group.lat);
      const selected = group.key === _selectedKey;
      const exact = group.precision === 'city';
      const size = newsMarkerSize(group.articles.length) + (selected ? 4 : 0);
      _dataSource.entities.add({
        id: ENTITY_PREFIX + group.key,
        position,
        point: {
          pixelSize: size,
          color: exact ? accent.withAlpha(0.95) : accent.withAlpha(0.12),
          outlineColor: selected ? Cesium.Color.WHITE : accent,
          outlineWidth: exact ? (selected ? 2 : 1) : 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 50_000,
        },
      });
      entries.push(
        createNewsOverlayEntry({
          group,
          position,
          selected,
          accent: accentCss,
        }),
      );
    }
    if (_enabled) {
      overlayHost.setEntries(
        NEWS_OVERLAY_SOURCE_ID,
        entries
          .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
          .slice(0, NEWS_OVERLAY_COHORT_LIMIT),
        {
          cohortLimit: NEWS_OVERLAY_COHORT_LIMIT,
          collisionCapacity: NEWS_OVERLAY_COLLISION_CAPACITY,
          moving: false,
        },
      );
    }
    _viewer?.scene?.requestRender?.();
  }

  function pickedGroupKey(picked) {
    const id = picked?.id?.id ?? picked?.id;
    return typeof id === 'string' && id.startsWith(ENTITY_PREFIX)
      ? id.slice(ENTITY_PREFIX.length)
      : null;
  }

  function installClickHandler() {
    if (_clickHandler || !_viewer) return;
    _clickHandler = screenSpaceEventHandlerFactory(_viewer);
    _clickHandler.setInputAction((click) => {
      if (!isPointerFree()) return;
      const picked = _viewer.scene.pick(click.position);
      const key = pickedGroupKey(picked);
      if (key) layer.selectPlace(key, { focus: true });
      // A click on another layer's object, or on empty globe, leaves the
      // place filter alone; it is cleared from the panel.
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  function removeClickHandler() {
    _clickHandler?.destroy();
    _clickHandler = null;
  }

  const layer = {
    id: 'news',
    name: 'World News',
    icon: '◆',
    source: 'News sources',
    updateInterval: 10 * 60 * 1000,

    init(viewer) {
      if (_viewer) throw new Error('News layer is already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('news');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      overlayHost.setVisible(NEWS_OVERLAY_SOURCE_ID, false);
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost.setVisible(NEWS_OVERLAY_SOURCE_ID, true);
      installClickHandler();
      render();
      emit();
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      removeClickHandler();
      if (_dataSource) _dataSource.show = false;
      overlayHost.clearSource(NEWS_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(NEWS_OVERLAY_SOURCE_ID, false);
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
        _unavailable = null;
        regroup();
        render();
        emit();
        return true;
      } catch (error) {
        if (!current()) return false;
        _error = error?.message || 'News source unavailable';
        if (error?.unavailable) {
          // The server has nothing, saved or live. Show nothing.
          _unavailable = {
            sources: error.sources ?? [],
            retryAfter: error.retryAfter ?? 60,
          };
          _snapshot = null;
          _groups = [];
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
      removeClickHandler();
      _enabled = false;
      overlayHost.clearSource(NEWS_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(NEWS_OVERLAY_SOURCE_ID, false);
      if (_dataSource) {
        viewer?.dataSources.remove(_dataSource, true);
        _dataSource = null;
      }
      _viewer = null;
      _snapshot = null;
      _groups = [];
      _selectedKey = null;
      _error = null;
      _unavailable = null;
      emit();
      _listeners.clear();
    },

    getStats() {
      return newsStats({
        snapshot: _snapshot,
        error: _error,
        unavailableSources: _unavailable?.sources,
      });
    },

    /** Everything the panel needs, as one immutable-by-convention object. */
    getView() {
      return {
        enabled: _enabled,
        snapshot: _snapshot,
        error: _error,
        unavailable: _unavailable,
        places: _groups,
        selectedPlaceKey: _selectedKey,
        goodNewsOnly: _goodNewsOnly,
        language: _language,
      };
    },

    /** Subscribe to view changes. Returns an unsubscribe function. */
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      _listeners.add(listener);
      return () => _listeners.delete(listener);
    },

    /** Show one language's headlines, or every language with null. */
    setLanguage(code) {
      _language = code || null;
      regroup();
      render();
      emit();
    },

    /** Narrow the globe and panel to stories tagged as good news. */
    setGoodNewsOnly(value) {
      _goodNewsOnly = Boolean(value);
      regroup();
      render();
      emit();
    },

    /** Select a place (or null to clear), optionally flying the camera to it. */
    selectPlace(key, { focus = false } = {}) {
      const group = key ? _groups.find((g) => g.key === key) : null;
      _selectedKey = group ? group.key : null;
      render();
      emit();
      if (group && focus && _viewer?.camera) {
        _viewer.camera.cancelFlight?.();
        _viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            group.lon,
            group.lat,
            NEWS_FOCUS_HEIGHT_M[group.precision] ?? NEWS_FOCUS_HEIGHT_M.country,
          ),
          duration: 1.8,
        });
      }
      return Boolean(group);
    },
  };
  return layer;
}
