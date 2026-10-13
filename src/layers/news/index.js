import * as Cesium from 'cesium';
import { cullEntitiesBeyondHorizon } from '../../data/corantoHorizonCull.js';
import { TOPIC_COLOURS, markerImage } from '../../data/corantoIcons.js';
import {
  NEWS_ACCENT,
  NEWS_FOCUS_HEIGHT_M,
  NEWS_GOOD_ACCENT,
  NEWS_OVERLAY_COHORT_LIMIT,
  NEWS_OVERLAY_COLLISION_CAPACITY,
  NEWS_OVERLAY_SOURCE_ID,
  NEWS_RANGES_H,
  createNewsOverlayEntry,
  dominantTopic,
  groupNewsByPlace,
  newsMarkerSize,
  newsStats,
  windowSnapshot,
} from './model.js';
export * from './model.js';
export { createNewsSource, NewsFeedUnavailableError } from './source.js';

const ENTITY_PREFIX = 'news:';

/**
 * Headlines on the globe: one marker per place that current stories name,
 * showing the icon and colour of the topic most of its stories carry. City
 * matches have a solid ring; country and region matches a dashed one, so an
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
  // Everything the server holds (a week); `_snapshot` is the range in view.
  let _full = null;
  let _rangeHours = NEWS_RANGES_H[0];
  // When replaying, the moment the range ends at; null means now.
  let _asOf = null;
  // How many place names to draw; the selected place is always named.
  let _labelLimit = NEWS_OVERLAY_COHORT_LIMIT;
  // The feed can run with its markers and names off the globe.
  let _markersShown = true;
  let _error = null;
  let _unavailable = null;
  let _groups = [];
  let _selectedKey = null;
  let _goodNewsOnly = false;
  // English by default; other languages are one choice away in the feed.
  let _language = 'en';
  const _listeners = new Set();

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
    const accentCss = _goodNewsOnly ? NEWS_GOOD_ACCENT : NEWS_ACCENT;
    const entries = [];
    for (const group of _groups) {
      const position = Cesium.Cartesian3.fromDegrees(group.lon, group.lat);
      const selected = group.key === _selectedKey;
      const exact = group.precision === 'city';
      const size = newsMarkerSize(group.articles.length) + (selected ? 6 : 0);
      const topic = _goodNewsOnly ? 'good' : dominantTopic(group.articles);
      _dataSource.entities.add({
        id: ENTITY_PREFIX + group.key,
        position,
        billboard: {
          image: markerImage({
            icon: topic,
            colour: TOPIC_COLOURS[topic] ?? TOPIC_COLOURS.news,
            approximate: !exact,
            selected,
          }),
          width: size,
          height: size,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: 50_000,
        },
      });
      entries.push(
        createNewsOverlayEntry({
          group,
          position,
          selected,
          accent: _goodNewsOnly
            ? accentCss
            : (TOPIC_COLOURS[dominantTopic(group.articles)] ?? accentCss),
        }),
      );
    }
    if (_enabled) {
      overlayHost.setEntries(
        NEWS_OVERLAY_SOURCE_ID,
        entries
          .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
          // The selected place sorts first, so a limit of zero still names it.
          .slice(0, Math.max(_labelLimit, _selectedKey ? 1 : 0)),
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
      // A marker on the far side of the Earth must not show through it.
      cullEntitiesBeyondHorizon(viewer, () =>
        _dataSource?.show ? _dataSource.entities.values : null,
      );
      overlayHost.setVisible(NEWS_OVERLAY_SOURCE_ID, false);
    },

    enable() {
      _enabled = true;
      if (_dataSource) _dataSource.show = _markersShown;
      overlayHost.setVisible(NEWS_OVERLAY_SOURCE_ID, _markersShown);
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
        _full = snapshot;
        _snapshot = windowSnapshot(_full, _rangeHours, _asOf);
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
          _full = null;
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
      _full = null;
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
        rangeHours: _rangeHours,
        asOf: _asOf,
        // The oldest headline held, for the replay's starting point.
        heldSince: (_full?.articles ?? []).reduce((oldest, article) => {
          const at = Date.parse(article.publishedAt);
          return Number.isFinite(at) && at < oldest ? at : oldest;
        }, Infinity),
        // How many headlines the server holds across the whole week.
        heldTotal: _full?.articles?.length ?? 0,
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

    /**
     * How many place names to draw beside the markers. The icons always
     * show; this only quiets the text, for views about something else.
     */
    setLabelLimit(limit) {
      _labelLimit = Math.max(
        0,
        Math.min(NEWS_OVERLAY_COHORT_LIMIT, Math.floor(limit) || 0),
      );
      render();
    },

    /**
     * Show or hide the story markers and their names. The feed, the ticker
     * and everything else the layer feeds carry on either way.
     */
    setMarkersShown(shown) {
      _markersShown = Boolean(shown);
      if (!_enabled) return;
      if (_dataSource) _dataSource.show = _markersShown;
      overlayHost.setVisible(NEWS_OVERLAY_SOURCE_ID, _markersShown);
      _viewer?.scene.requestRender?.();
    },
    markersShown: () => _markersShown,

    /** Show the last day, three days or week of stories. */
    setRangeHours(hours) {
      _rangeHours = NEWS_RANGES_H.includes(hours) ? hours : NEWS_RANGES_H[0];
      _snapshot = windowSnapshot(_full, _rangeHours, _asOf);
      regroup();
      render();
      emit();
    },

    /**
     * Replay: end the range at an earlier moment, or pass null for now. The
     * stories shown are the ones published in the range before that moment.
     */
    setAsOf(ms) {
      _asOf = Number.isFinite(ms) ? ms : null;
      _snapshot = windowSnapshot(_full, _rangeHours, _asOf);
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
