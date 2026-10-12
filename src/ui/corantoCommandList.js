/**
 * Every command the palette offers, built from what the app can do right
 * now. Nothing here acts by itself: each command's `run` calls an action the
 * shell passed in, the same one its button calls.
 *
 * @param {object} app The shell's actions and current state.
 * @param {string} query The text typed, for searching stories.
 * @returns {object[]} Commands for `rankCommands`.
 */
export function buildCommands(app, query = '') {
  const out = [];
  const add = (command) => out.push(command);

  // Views and lenses.
  for (const [mode, title, detail] of [
    ['news', 'News view', 'The headline feed on the globe'],
    [
      'instruments',
      'Instruments view',
      'The full control room: tracking, cameras, weather, scenes',
    ],
  ])
    add({
      id: `mode:${mode}`,
      title,
      detail,
      kind: app.mode === mode ? 'YOU ARE HERE' : 'GO TO',
      icon: mode === 'news' ? 'news' : 'grid',
      keywords: 'mode page switch',
      pinned: app.mode !== mode,
      run: () => app.setMode(mode),
    });
  for (const lens of app.lenses ?? [])
    add({
      id: `lens:${lens.id}`,
      title: lens.title,
      detail: lens.detail,
      kind: 'LENS',
      icon: lens.icon,
      keywords: `lens ${lens.keywords ?? ''}`,
      pinned: true,
      run: () => app.setLens(lens.id),
    });

  // Things that open.
  for (const panel of app.panels ?? [])
    add({ ...panel, id: `panel:${panel.title}`, kind: panel.kind ?? 'OPEN' });

  // Layers and map overlays: the command says which way it will switch.
  for (const layer of app.layers ?? [])
    add({
      id: `layer:${layer.id}`,
      title: layer.name,
      detail: layer.detail,
      kind: layer.on ? 'SWITCH OFF' : 'SWITCH ON',
      icon: layer.icon ?? 'grid',
      keywords: `layer feed data ${layer.keywords ?? ''}`,
      run: layer.toggle,
    });
  for (const overlay of app.overlays ?? [])
    add({
      id: `overlay:${overlay.id}`,
      title: overlay.label,
      kind: overlay.on ? 'SWITCH OFF' : 'SWITCH ON',
      icon: 'geopolitics',
      keywords: 'map overlay atlas',
      run: overlay.toggle,
    });

  // Reading: topics and how far back.
  for (const topic of app.topics ?? [])
    add({
      id: `topic:${topic.id}`,
      title: topic.label,
      detail: 'Show only this topic in the feed and on the globe',
      kind: 'TOPIC',
      icon: topic.icon ?? 'news',
      keywords: 'topic category filter stories',
      run: topic.run,
    });
  for (const range of app.ranges ?? [])
    add({
      id: `range:${range.hours}`,
      title: range.label,
      detail: 'How far back the feed and the globe show',
      kind: 'TIME RANGE',
      icon: 'news',
      keywords: 'time range hours days week history',
      run: range.run,
    });

  // Looking: visual presets and live television.
  for (const preset of app.presets ?? [])
    add({
      id: `preset:${preset.id}`,
      title: preset.label,
      detail: preset.detail,
      kind: 'VISUAL PRESET',
      icon: 'contrast',
      keywords: `style look filter preset ${preset.keywords ?? ''}`,
      run: preset.run,
    });
  for (const channel of app.channels ?? [])
    add({
      id: `tv:${channel.name}`,
      title: channel.name,
      detail: `${channel.city} · ${channel.covers}`,
      kind: 'WATCH LIVE',
      icon: 'broadcast',
      keywords: `tv television live channel broadcast ${channel.city}`,
      run: channel.run,
    });

  // Places. One with stories is listed twice on purpose: once to read its
  // stories, once to fly there. The kind on the right says which.
  for (const place of app.storyPlaces ?? [])
    add({
      id: `stories:${place.key}`,
      title: place.name,
      detail: 'Show its stories in the feed and fly there',
      kind: `${place.count} ${place.count === 1 ? 'STORY' : 'STORIES'}`,
      icon: 'news',
      keywords: 'stories news place',
      weight: 6,
      run: place.run,
    });
  for (const place of app.places ?? [])
    add({
      id: `place:${place.kind}:${place.name}:${place.detail ?? ''}`,
      title: place.name,
      detail: place.detail,
      kind: 'FLY TO',
      icon: place.kind === 'country' ? 'geopolitics' : 'pin',
      keywords: `go fly place ${place.kind} ${place.keywords ?? ''}`,
      weight: place.kind === 'country' ? 3 : 0,
      run: place.run,
    });

  // Stories, once there is enough typed to search with.
  const words = String(query)
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 3);
  if (words.length) {
    let found = 0;
    for (const article of app.articles ?? []) {
      const title = String(article.title ?? '');
      const lower = title.toLowerCase();
      if (!words.every((word) => lower.includes(word))) continue;
      add({
        id: `story:${article.id}`,
        title,
        detail: article.publisher,
        kind: 'STORY',
        icon: 'outlets',
        run: () => app.openStory(article.id),
      });
      if (++found >= 8) break;
    }
    add({
      id: 'feed-search',
      title: `Search the feed for “${String(query).trim()}”`,
      detail: 'Every headline held, filtered to those words',
      kind: 'SEARCH',
      icon: 'search',
      // It fits whatever was typed, and sits below real matches.
      keywords: String(query),
      weight: -400,
      run: () => app.searchFeed(String(query).trim()),
    });
  }
  return out;
}
