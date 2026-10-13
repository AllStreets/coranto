/*
 * Runs before anything is drawn. It tells the page which view it is opening
 * in, so the control room's panels are never shown for a moment on the way
 * to the news view. Coranto's shell sets the same values again when it
 * starts; this only gets there first.
 */
(function () {
  try {
    // Automated browsers keep the engine's own start, which their gates expect.
    if (navigator.webdriver) return;
    var view = 'news';
    try {
      var settings = JSON.parse(
        localStorage.getItem('coranto.settings.v1') || '{}',
      );
      var start = settings && settings.startView;
      if (start === 'instruments') view = 'instruments';
      else if (start !== 'news') {
        if (localStorage.getItem('coranto.mode.v1') === 'instruments')
          view = 'instruments';
      }
      if (settings && settings.ticker === false)
        document.body.dataset.corantoTicker = 'off';
    } catch (error) {
      view = 'news';
    }
    document.body.dataset.corantoMode = view;
    document.body.dataset.corantoFrame = 'one';
    if (view !== 'news') return;
    // The frame of the news view, drawn at once: the header with the mark,
    // the banner, and the two side panels as outlines. It is replaced by
    // the real thing the moment that is ready, so the page is never a
    // black screen.
    var make = function (className, children) {
      var node = document.createElement('div');
      node.className = className;
      (children || []).forEach(function (child) {
        node.appendChild(child);
      });
      return node;
    };
    var bars = function (count) {
      var out = [];
      for (var i = 0; i < count; i += 1) out.push(make('coranto-skel-bar'));
      return out;
    };
    var logo = document.createElement('img');
    logo.src = '/logo.svg';
    logo.alt = '';
    var word = document.createElement('em');
    word.textContent = 'CORANTO';
    var skeleton = make('coranto-skel', [
      make('coranto-skel-header', [
        make('coranto-brand', [logo, make('coranto-wordmark', [word])]),
      ]),
      make('coranto-skel-ticker'),
      make('coranto-skel-rail', bars(9)),
      make('coranto-skel-feed', bars(7)),
    ]);
    skeleton.id = 'coranto-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    document.body.appendChild(skeleton);
    var done = function () {
      if (!document.getElementById('coranto-header')) return false;
      skeleton.remove();
      return true;
    };
    if (!done() && window.MutationObserver) {
      var watcher = new MutationObserver(function () {
        if (done()) watcher.disconnect();
      });
      watcher.observe(document.body, { childList: true });
      // Never left behind, whatever happens to the start-up.
      setTimeout(function () {
        watcher.disconnect();
        skeleton.remove();
      }, 30000);
    }
  } catch (error) {
    // Without this the page still opens; the shell sets the view itself.
  }
})();
