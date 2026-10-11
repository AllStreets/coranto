# AUSPEX feature study (read-only) — code-level report

Root: `/Users/connorevans/Downloads/AUSPEX`. Static HTML + plain browser-global JS (no bundler), globe.gl from unpkg, Supabase JS, topojson-client. Script load order is in `index.html:570-592`.

Everything below was read from the code. Not read in full: `js/relief.js` (2187 lines), `js/sectors.js` (1116) and the `worker/` internals; those are covered only where relevant. No key values are reproduced: `keys.js` and `keys.local.js` were not opened. Note that `js/supabase.js:7-8` and `api/ai.mjs:26-28` hardcode a Supabase URL and anon key in source (README calls it publishable and RLS-protected).

---

## 1. MAP KEY and MARKER ICON SYSTEM

### 1.1 How markers are drawn
- All globe markers are **DOM elements via globe.gl `htmlElementsData`**. Glyphs are inline SVG strings injected with `innerHTML` and tinted through `currentColor`.
- No icon library, no image files, no canvas for map icons. `assets/` contains only `assets/guide/*.jpg` (tour screenshots).
- Exceptions:
  - Country status uses Unicode text glyphs (☢ ▲ ⊘ ★) with a text-presentation variation selector.
  - Relief markers are pure CSS shapes.
  - Vessels are THREE sprites built from an SVG texture (`js/vessels.js:88-122`).
  - Flag images come from `https://flagcdn.com/{iso}.svg`.
- One dispatcher builds everything: `_updateAllGlobeElementsNow()` at `js/globe.js:817-993`. It builds a `visual[]` array, tags each item with `_type`, and switches on `_type` in `G.htmlElement(...)` (`globe.js:907-956`). It is debounced 50 ms by `updateAllGlobeElements()` (`globe.js:812`).

### 1.2 Licence
- Repo licence is Apache-2.0, "Copyright 2026 Connor Evans" (`LICENSE:178`).
- No third-party icon set is declared anywhere; `js/icons.js:1-8` describes the glyphs as its own inline SVG system.
- A few UI-chrome icons (search, reset arrow, star, external link in `index.html`) use the Feather/Lucide 24×24 stroke idiom, but there is no attribution in the repo. Treat their provenance as unverified.

### 1.3 Every marker kind

| `_type` | Builder (file:line) | Glyph source | Colour | Size | Click |
|---|---|---|---|---|---|
| `story` | `makeMarker` `globe.js:306` | `AUSPEX_CAT_ICONS[cat]` `icons.js:55-68` | `CATS[cat].color`, glyph lifted 45% to white | 17×17 px (`.gm-ico`, `css/auspex.css:362`), hover scale 1.42 | `handleLocationClick` |
| `auspex_event` | `makeAuspexEventMarker` `globe.js:330` | `auspexEventGlyph(event)` `icons.js:75` | `auspexEventColor(event)` `icons.js:130`, glyph lifted 60% | glyph box = `(8 + severity*14) + 10` px; glow `round(sev*5)+2` px; unconfirmed opacity 0.7 | `openAuspexEventCard` |
| `city` | `makeCityMarker` `globe.js:282` | `_CITY_ICONS[icon_type]` `globe.js:247-269` | `_CITY_COLORS` `globe.js:270-281` | tier 1 = 18 px, tier 2 = 15, tier 3 = 13; label 6.5 / 5.5 px; scaled by `--gz-scale` | `openCityPanel` |
| `country` | `makeCountryMarker` `globe.js:364` | text ☢ ▲ ⊘ ★ + name label | see 1.6 | 14 px glyphs, nuclear 22 px (`css:397-398`) | `openCountryPanel`; ▲ alone opens `openConflictBrief` |
| `region_label` | `makeRegionLabel` `globe.js:456` | text only | critical `#FF2D55`, high `#FF9F0A`, elevated `#B7950B` | 6 px mono | `openRegionPanel` |
| `threat` | inline `globe.js:942-954` | one `.gm-ring` pulse + invisible 30 px hit target | story colour | 18 px ring | `openThreatPanel` |
| `broadcaster` | inline `globe.js:909-925` | CSS box, blinking dot, stem, tip | `b.color` | see section 4 | `openBroadcasterPanel` |
| `blackout` | inline `globe.js:926-934` | CSS: 50 px red ring + 18 px black core (`css:811-814`) | `rgba(255,45,85,.35)` | fixed | `openSilencePanel` |
| `flight` | `makeFlightMarker` `overlay.js:211` | `PLANE_SVG` `overlay.js:23`, rotated to heading | passenger `#0A84FF`, cargo `#A78BFA`, military `#30D158` | 26 px in a 28 px box | `showFlightInfo` |
| vessel | `makeVesselSprite` `vessels.js:112` | `SHIP_SVG` `vessels.js:16` as sprite texture | `VS_COLOR` `vessels.js:20` | `VS_SCALE = 3.2` | `showVesselInfo` |
| `relief_famine` | `makeReliefFamineMarker` `globe.js:477` | CSS hexagon with phase number | IPC ramp: 1 `#34D399`, 2 `#FACC15`, 3 `#FB923C`, 4 `#FF4D5E`, 5 `#7F1D1D` | 18 px hex, 30 px glow | opens RELIEF famine tool |
| `relief_access` | `makeReliefAccessMarker` `globe.js:496` | CSS ring + dot (constrained), X bars (sealed), small dot (open) | open `#34D399`, constrained `#FB923C`, sealed `#FF4D5E` | 22 px ring | RELIEF access tool |
| `relief_health` | `makeReliefHealthMarker` `globe.js:517` | CSS rounded badge with a cross | 1 `#34D399`, 2 `#FACC15`, 3 `#FB923C`, 4 `#FF4D5E` | 18 px | RELIEF health tool |

Non-marker layers:
- Arcs are merged in `refreshArcs` (`analyst.js:1074`): story-entity arcs, divergence, cascade, event links, relief displacement, flight trails.
- Paths: subsea cables, country borders, DMZ lines.
- Rings: only conflict regions, when THREATS is on.

**Total distinct glyphs:** 15 event + 6 category + 12 city + 4 country + plane + ship + 3 relief + broadcaster + blackout + threat ring + region label ≈ 46.

There is **no dedicated "battle" icon**. Conflict is expressed by:
- the country ▲ triangle;
- red borders and front-line paths;
- THREATS region labels and rings;
- the military story icon (shield with star);
- a legacy `conflict` city icon that the bundled dataset never uses (see 1.5).

### 1.4 Icon SVG data (verbatim, reusable)

**Event icons** — `js/icons.js:9-45`, const `AUSPEX_EVENT_ICONS`, viewBox 24:
```
earthquake: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><path d="M7 12a5 5 0 0 1 10 0"/><path d="M4 12a8 8 0 0 1 16 0"/></svg>
volcano:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18l-5.5-9h-5L3 20Z"/><path d="M10.5 11l1.5-3 1.5 3"/><path d="M12 5V3M9.5 5.5 8 4M14.5 5.5 16 4"/></svg>
flood:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2 0 2.5 1.5 5 1.5S14 8 14 8s2 1.5 4.5 1.5S22 8 22 8"/><path d="M2 13c2 0 2.5 1.5 5 1.5S14 13 14 13s2 1.5 4.5 1.5S22 13 22 13"/><path d="M2 18c2 0 2.5 1.5 5 1.5S14 18 14 18s2 1.5 4.5 1.5S22 18 22 18"/></svg>
cyclone:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><g stroke-opacity="0.4"><path d="M4 5A8 2.4 0 0 1 20 5"/><path d="M6.2 9A5.8 1.9 0 0 1 17.8 9"/><path d="M8.2 12.5A3.8 1.5 0 0 1 15.8 12.5"/><path d="M10 15.5A2 1 0 0 1 14 15.5"/></g><path d="M4 5A8 2.4 0 0 0 20 5"/><path d="M6.2 9A5.8 1.9 0 0 0 17.8 9"/><path d="M8.2 12.5A3.8 1.5 0 0 0 15.8 12.5"/><path d="M10 15.5A2 1 0 0 0 14 15.5"/><path d="M4 5Q7.5 13 11 16.5"/><path d="M20 5Q16.5 13 13 16.5"/><path d="M11.5 16.5c0 2.4 1.7 3.7 3.5 3"/></svg>
fire:       <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2c.6 2.8-1.2 4.3-2.4 5.7C8.2 9.3 7 10.7 7 13a5 5 0 0 0 10 0c0-1.7-.8-3-1.6-4-.3.9-1 1.6-1.9 1.6 1-2.3-.2-5.6-1.5-8.6Z"/></svg>
drought:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="2.5"/><path d="M12 2.5V1M16 6h1.5M6.5 6H8M15 3l1-1M9 3 8 2"/><path d="M3 16h18M8 13l-1 3 2 4M14 13l1 3-1.5 4M11.5 13v3l1 4"/></svg>
disaster:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 22 20H2L12 3Z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.8" fill="currentColor" stroke="none"/></svg>
launch:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c3 1.5 5 5 5 9 0 2.2-.7 3.8-1.5 5h-7C7.7 14.8 7 13.2 7 11c0-4 2-7.5 5-9Z"/><circle cx="12" cy="10" r="1.6"/><path d="M9.5 16 7 19m7.5-3 2.5 3M12 16v4"/></svg>
space:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-25 12 12)"/></svg>
medical:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2-5 3 10 2.5-7 1.5 2H22"/></svg>
physics:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/></svg>
science:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.4 2h11.2A1.5 1.5 0 0 0 19 19l-5-10V3"/><path d="M7.5 15h9"/></svg>
financial:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg>
tech:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/></svg>
default:    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 4 20 12 12 20 4 12Z"/></svg>
```

**Event colours** — `icons.js:106-125`, `AUSPEX_EVENT_COLORS`:
- Perils: earthquake `#E0903A`, volcano `#FF5A36`, flood `#3B9EFF`, cyclone `#5EEAD4`, fire `#FF7A1A`, drought `#D6B24A`, disaster `#FF8C66`.
- Breakthroughs: launch `#8BA0FF`, space `#8BA0FF`, medical `#FF74A8`, physics `#A78BFA`, science `#67E8F9`, financial `#FACC4D`, tech `#93A4FF`, generic breakthrough `#5AC8FA`.
- Override: any peril with `severity >= 0.7` renders `#FF4D5E` (`icons.js:132`).

**Event helpers:**
- `auspexEventGlyph` (`icons.js:75`) resolves `icon` → `type` → `sense`, then falls back by polarity: peril → `disaster`, breakthrough → `science`, else `default`.
- `auspexLiftColor(hex, t)` (`icons.js:90`) lerps each channel toward 255 by `t`.
- Glyph backing disc: `radial-gradient(circle, rgba(5,9,18,0.7) 0%, rgba(5,9,18,0.42) 50%, ${color}22 70%, transparent 82%)` (`globe.js:355`).

**Story-category icons** — `icons.js:55-68`, `AUSPEX_CAT_ICONS`:
```
geo:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 4l9 5.5"/><path d="M5.5 10v8M9.5 10v8M14.5 10v8M18.5 10v8"/><path d="M3.5 18.5h17M4.5 21h15"/></svg>
military: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 4.5 5.2v5.6c0 4.7 3.2 8 7.5 10.2 4.3-2.2 7.5-5.5 7.5-10.2V5.2L12 2.5Z"/><path d="M12 8.3l1.15 2.4 2.6.3-1.95 1.8.5 2.6L12 16.4l-2.3 1.2.5-2.6L8.25 11l2.6-.3L12 8.3Z"/></svg>
finance:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 20.5h17"/><path d="M6.5 20.5v-5M11 20.5V11M15.5 20.5v-7M20 20.5V6.5"/></svg>
climate:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18C5 9.5 11 5 19.5 5 19.5 13.5 13.5 19 5 19c-.4 0-.8 0-1.1-.1Z"/><path d="M5 18.5c2.4-4.2 5.6-7 9.8-8.6"/></svg>
tech:     (identical to the event `tech` chip above)
all:      <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="4.5"/></svg>
```

**City icons** — `js/globe.js:247-269`, `_CITY_ICONS`, viewBox 12:
```
capital:   <svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="6,0.6 7.36,4.18 11.2,4.3 8.15,6.66 9.25,10.4 6,8.2 2.75,10.4 3.85,6.66 0.8,4.3 4.64,4.18" fill="currentColor"/></svg>
financial: <svg viewBox="0 0 12 12" width="100%" height="100%"><line x1="1" y1="10.4" x2="11" y2="10.4" stroke="currentColor" stroke-width="0.9" opacity=".55"/><rect x="1.7" y="6.6" width="1.7" height="3.6" rx="0.4" fill="currentColor"/><rect x="4.4" y="4.4" width="1.7" height="5.8" rx="0.4" fill="currentColor"/><rect x="7.1" y="2.2" width="1.7" height="8" rx="0.4" fill="currentColor"/><path d="M2.4 6 L5 4 L7.8 5 L10.4 1.8" stroke="currentColor" stroke-width="0.85" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/></svg>
tech:      <svg viewBox="0 0 12 12" width="100%" height="100%"><rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1" fill="none"/><rect x="4.9" y="4.9" width="2.2" height="2.2" rx="0.4" fill="currentColor"/><g stroke="currentColor" stroke-width="0.95" stroke-linecap="round"><line x1="4.5" y1="3" x2="4.5" y2="1.4"/><line x1="6" y1="3" x2="6" y2="1.4"/><line x1="7.5" y1="3" x2="7.5" y2="1.4"/><line x1="4.5" y1="9" x2="4.5" y2="10.6"/><line x1="6" y1="9" x2="6" y2="10.6"/><line x1="7.5" y1="9" x2="7.5" y2="10.6"/><line x1="3" y1="4.5" x2="1.4" y2="4.5"/><line x1="3" y1="6" x2="1.4" y2="6"/><line x1="3" y1="7.5" x2="1.4" y2="7.5"/><line x1="9" y1="4.5" x2="10.6" y2="4.5"/><line x1="9" y1="6" x2="10.6" y2="6"/><line x1="9" y1="7.5" x2="10.6" y2="7.5"/></g></svg>
tourism:   <svg viewBox="0 0 12 12" width="100%" height="100%"><path d="M6 0.8 L10.3 3.6 H1.7 Z" fill="currentColor"/><rect x="2.2" y="3.9" width="7.6" height="0.9" rx="0.3" fill="currentColor"/><g fill="currentColor"><rect x="2.9" y="5" width="1.1" height="4.2"/><rect x="5.45" y="5" width="1.1" height="4.2"/><rect x="8" y="5" width="1.1" height="4.2"/></g><rect x="1.7" y="9.4" width="8.6" height="1" rx="0.3" fill="currentColor"/></svg>
port:      <svg viewBox="0 0 12 12" width="100%" height="100%"><circle cx="6" cy="2.4" r="1.3" stroke="currentColor" stroke-width="1.05" fill="none"/><line x1="6" y1="3.7" x2="6" y2="10.1" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/><line x1="3.7" y1="5.2" x2="8.3" y2="5.2" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/><path d="M2.3 7.3 c0.5 2.2 2.1 3.1 3.7 3.1 s3.2-0.9 3.7-3.1" stroke="currentColor" stroke-width="1.15" fill="none" stroke-linecap="round"/><line x1="1.9" y1="7.3" x2="3" y2="6.9" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/><line x1="10.1" y1="7.3" x2="9" y2="6.9" stroke="currentColor" stroke-width="1.05" stroke-linecap="round"/></svg>
energy:    <svg viewBox="0 0 12 12" width="100%" height="100%"><polygon points="6.9,0.8 2.8,6.7 5.7,6.7 4.7,11.2 9.3,4.9 6.2,4.9" fill="currentColor"/></svg>
megacity:  <svg viewBox="0 0 12 12" width="100%" height="100%"><g fill="currentColor"><rect x="1.2" y="6.2" width="2" height="4.6" rx="0.3"/><rect x="3.6" y="3.6" width="2.1" height="7.2" rx="0.3"/><rect x="6.2" y="1.6" width="2.2" height="9.2" rx="0.3"/><rect x="8.9" y="4.8" width="1.9" height="6" rx="0.3"/></g><path d="M7.3 1.6 V0.6" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"/><g fill="#0a0c1e" opacity=".55"><rect x="6.8" y="3" width="0.6" height="0.8"/><rect x="7.7" y="3" width="0.6" height="0.8"/><rect x="6.8" y="4.6" width="0.6" height="0.8"/><rect x="7.7" y="4.6" width="0.6" height="0.8"/></g></svg>
city:      <svg viewBox="0 0 12 12" width="100%" height="100%"><circle cx="6" cy="6" r="4.4" stroke="currentColor" stroke-width="1.1" fill="none" opacity=".7"/><circle cx="6" cy="6" r="1.9" fill="currentColor"/></svg>
```
- Legacy city types still defined at `globe.js:265-268`: `military` (shield with tick), `naval` (ship outline), `conflict` (filled triangle with "!"), `diplomatic` (globe grid).
- City colours (`globe.js:270-281`): capital `#E8D5A3`, financial `#FFD60A`, tech `#9D8CFF`, tourism `#FF8FA3`, port `#2DD4BF`, energy `#FFB02E`, megacity `#9FB3C8`, city `#8FA0E8`, military `#FF6D00`, naval `#2979FF`, conflict `#FF2D55`, diplomatic `#30D158`.
- A second, simpler icon set for the city panel header is at `js/features.js:282-294` (`_CITY_TYPE_SVG`, `_CITY_COL`, `_CITY_TYPE_LBL`). It has no `tech`, `tourism` or `megacity` glyph; those fall back to `city`.

**Plane** (`js/overlay.js:23`):
```
<svg class="fl-plane" viewBox="0 0 56 56" fill="currentColor"><ellipse cx="28" cy="28" rx="3.6" ry="19"/><path d="M28 19 L7 34 L9 38 L28 30 L47 38 L49 34 Z"/><path d="M28 42 L18 51 L20 53 L28 46 L36 53 L38 51 Z"/></svg>
```
**Ship** (`js/vessels.js:16`):
```
<svg class="vs-ship" viewBox="0 0 32 48" fill="currentColor"><path d="M16 3 C21.5 11 23.5 22 22 32 L20 44 L12 44 L10 32 C8.5 22 10.5 11 16 3 Z"/><line x1="16" y1="9" x2="16" y2="40" stroke="rgba(255,255,255,.55)" stroke-width="1.4"/><rect x="12.5" y="25" width="7" height="7" fill="rgba(255,255,255,.28)"/></svg>
```
- Vessel colours: tanker `#f97316`, cargo `#00d4ff`, passenger `#0A84FF`, hsc `#5ac8fa`, tug `#a78bfa`, fishing `#a78bfa`, other `#22D3EE`.
- Flight classification is `classifyFlight` (`overlay.js:13`), using callsign and ICAO-hex prefix lists (`overlay.js:8-11`).

### 1.5 How an item gets its icon

**Stories — category only.** There is no per-keyword icon.
- `detectCat(text)` (`js/data.js:199-215`) counts substring hits over `title + description + source`. Highest count wins; zero hits → `geo`.
  - geo: diplomat, sanction, treaty, election, president, minister, summit, parliament, nato, cease, nuclear agreement, bilateral, un security, peace talk
  - military: military, troops, missile, drone strike, airstrike, navy, army, combat, weapon, explosio, attack, warship, soldier, artillery, bombing
  - finance: market, stock, gdp, inflation, rate cut, rate hike, central bank, "fed ", ecb, bonds, yield, equity, earnings, tariff, trade war, crypto, bitcoin, ipo
  - climate: climate, carbon, deforestation, wildfire, flood, drought, emission, renewable, solar, arctic, glacier, temperature, hurricane, typhoon, net.zero
  - tech: artificial intelligence, ai model, chip, semiconductor, robot, autonomous, cyber, software, quantum, satellite, space, launch, tech company, startup, data breach
- Colour is applied by `applyColors` (`data.js:128`): `s.color = CATS[s.cat].color`.
- Placement is `extractCoords` (`data.js:187`): first substring match in `CITY_COORDS` (`data.js:134-160`, about 75 cities), then `COUNTRY_COORDS` (`data.js:161-185`), then GDELT `sourcecountry`. Unlocatable stories are dropped (`news.js:154`).
- Each story gets a random jitter of ±0.3° on lat and lng (`news.js:166-167`).
- `brk = minsAgo < 25` (`news.js:171`).

**Events — typed server-side** in `src/normalize.js`.
- Event shape: `{id, sense, type, polarity, title, lat, lng, metric{label,value,band}, severity 0..1, confidence, occurredAt, brief, sources[{name,url}], links[], icon}`.
- USGS → `earthquake` (`normalize.js:3`).
- GDACS type map: `EQ` earthquake, `TC` cyclone, `FL` flood, `VO` volcano, `DR` drought, `WF` fire, else `disaster` (`normalize.js:27`). Severity: Red 0.85, Orange 0.6, Green 0.3.
- Launch Library 2 → sense `space`, type `launch`, severity 0.6 (`normalize.js:45`).
- NASA EONET map at `normalize.js:73-86`; wildfires are skipped.
- NASA FIRMS fires are clustered into 3° cells, max 7 per continent (`worker/senses/firms.js:13-15`).
- Breakthroughs are bucketed from news by regex into `medical | physics | space | financial | tech` (`worker/senses/breakthroughs.js:12-16`).
- The current `snapshot.json` holds 95 events: fire 24, flood 19, earthquake 18, launch 15, drought 13, cyclone 6.

**Cities — `icon_type` precomputed** in `data/cities-1000.json`.
- Fields: `name, country, iso2, lat, lng, population, is_capital, is_financial, is_port, strategic_tier, icon_type`.
- Classifier: `scripts/reclassify-cities.mjs:75-83`. Priority is capital (`is_capital`) → curated name sets FINANCIAL / TECH / TOURISM / PORT / ENERGY (lines 18-61) → megacity if population ≥ 8,000,000 → city.
- Actual distribution: city 631, capital 240, financial 29, port 27, tech 26, energy 25, tourism 20, megacity 2. Tiers: tier 1 = 279, tier 2 = 423, tier 3 = 298.
- The file is lazy-loaded on the first CITIES toggle (`overlay.js:907-919`).
- `sbFetchCities` exists (`supabase.js:225`) but nothing calls it.
- The `military`, `naval`, `conflict` and `diplomatic` city types appear only in the Supabase seed comment (`sql/schema.sql:105`), not in the bundled dataset.

**Countries.**
- Base list is `_WORLD_COUNTRIES` (`globe.js:77-242`), with inline flags `nuclear_armed`, `conflict_active`, `sanctions_subject`, `un_p5`, `strategic_tier`.
- Supabase `countries` rows override the attributes (`globe.js:864-879`).
- Nuclear-armed countries always show; all others show only with COUNTRIES on.
- The live conflict triangle is `_computeConflictSet` (`globe.js:784-797`). A country qualifies when at least 3 stories satisfy all of: category is military, text contains a `_CONFLICT_KW` term (`globe.js:741-744`), and the title matches the country name on a word boundary. The code comment says ">=4" but the code uses `>= 3`.

**Regions.**
- Rows come from the Supabase `regions` table: `name, type, lat, lng, radius_km, description, threat_level, active`.
- Level is recomputed live by `_liveRegionThreat` (`globe.js:750-769`) using the `_REGION_KW` keyword map (`globe.js:721-737`).
- `score = brk*3 + mil*2 + geo`. Critical if `brk>=3 || mil>=10 || score>=32`. High if `mil>=4 || score>=12 || total>=10`. Else elevated.
- Only critical and high regions render, and only with THREATS on.

### 1.6 Sizing, zoom and clustering rules
- Story markers are capped at `GLOBE_STORY_LIMIT = 200`, most recent first (`globe.js:710, 825`).
- **There is no visual clustering of stories.** Co-location is handled on click: `handleLocationClick` (`ui.js:172`) collects stories within 0.5° lat and lng. One story opens the article; more than one opens the `#picker` list (`openPicker`, `ui.js:184`).
- An invisible `pointsData` hit layer (radius 0.55, altitude 0.025) backs the DOM markers (`globe.js:961-968`).
- Zoom scaling (`globe.js:575-581`): `--gz-scale = clamp(2.5/altitude, 0.55, 3.5)` and `--gz-lbl-boost = clamp(scale*0.43, 1.0, 1.5)`. Applied to city and country markers only.
- Threat pulses are deduped to 0.1° cells. Dominance rank is breaking > military > geo. Capped at 40 (`globe.js:836-853`).
- Region rings: `ringMaxRadius = min(radius_km/55, 18)`, speed 0.35, period 4000 ms, colour = level colour + `30` alpha (`globe.js:982-987`).
- Per-story and per-event pulse rings were deliberately removed for performance (comments at `globe.js:74, 113, 977`).
- Country glyph colours (`css/auspex.css:399-405`): nuclear `#FF9F0A`, conflict `#FF2D55`, sanction `#2979FF`, P5 `#B7950B`. Name label is `#4A8CA8`, or `#FF2D55` when pinned.

### 1.7 Legend UI
- Markup: `index.html:112-117` (`#mapkey-drop` containing `#mk-list`). It is opened by the MAP KEY button (`index.html:102`).
- Functions: `toggleMapKey()` at `js/analyst.js:907` and `buildMapKey()` at `analyst.js:914-1072`. The legend is rebuilt on every open.
- CSS: `css/auspex.css:908-931`. A 228 px dropdown, max-height 58vh.
- Row model. Each row is one of:
  - `{s}` section header
  - `{dot}`
  - `{dash}`
  - `{shape,color}`
  - `{ico,color}`
  - `{ring}` animated demo
  - `{plane}`
  - `{cityType,color}`
  - `{icon,color}`
  - `{ctry,color}`
  - `{ctrl}`
- Live sections are prepended and derived from what is on the globe:
  - DISASTER EVENTS (LIVE): distinct `icon||type` among peril events, coloured through `auspexEventColor`, plus two explanatory rows.
  - BREAKTHROUGHS (LIVE).
  - CITY ICONS (LIVE): only when CITIES is on; distinct `icon_type` values ordered by prevalence.
  - INFORMATION BLACKOUT (LIVE): only when SILENCE is on.
  - BROADCASTERS (LIVE): only when the broadcast panel is open.
- Static sections, in order:
  - STORY MARKERS — ICON + COLOUR BY CATEGORY (5 rows using `auspexCatIcon`)
  - ANIMATED EFFECTS
  - STORY ARC COLOURS
  - COUNTRY BORDER LAYER (ice blue `rgba(100,180,255,0.6)`, red `#FF2D55`, red dash, amber `#FF9F0A`)
  - COUNTRY LAYER (☢ ▲ ⊘ ★)
  - REGION THREAT OVERLAY
  - FLIGHT ICONS
  - CONNECTION & RELIEF ARCS
  - ANALYST TOOLS
  - GLOBE CONTROLS
- **Two legend rows are stale against the rendering code.** "Breaking news — double pulse ring" and "Dashed ring — unconfirmed" describe effects `makeMarker` and `makeAuspexEventMarker` no longer draw. Unconfirmed is now just opacity 0.7.
- The `_STORY_CATS` shape fields and the `.cat-core-*` clip-paths (`css:369-392`) are leftovers from the predecessor's shape markers.
- The category rail (`index.html:138-145`) reuses the same category icons: `ui.js:141-144` injects `auspexCatIcon` into each `.cat-pip`.

---

## 2. ANALYST BOARD

**What it is.** A full-screen overlay, `#analyst-overlay` (`index.html:255-324`, CSS from `css:544`), titled "AUSPEX ANALYST". It has three columns: ASSET BOARD, ENTITY NETWORK (canvas) and INTELLIGENCE BRIEF. Code is `js/analyst.js`.

**How it opens.**
- ANALYST button in the command panel (`index.html:94`) → `openAnalystMode()` (`analyst.js:79`).
- Clicking a story arc on the globe → `traceArc` (`analyst.js:1183`), which pins both stories and opens the board.
- Loading a saved board.
- The AgentZeus command bus (`main.js:154`).

**Pinning.**
- Stories: `pinStory(id)` (`analyst.js:91`), a toggle. Entry points:
  - the layers icon on every feed card (`ui.js:21`);
  - the PIN TO ANALYST button in the popup (`pinStoryFromArticle`, `ui.js:219`);
  - event cards and threat panels;
  - history search results.
- Geo assets: `pinGeoAsset(geoType, obj)` (`analyst.js:137`) for `city`, `country`, `region`. Key format is `${geoType}:${name||iso2}:${lat.toFixed(1)}`. Reached from the city panel PIN button and from the country, region and silence info panels.
- Archive search: input `#am-hist-input` → `debounceHistSearch` (400 ms) → `runHistSearch` (`analyst.js:15`). It merges Supabase `sbSearchHistory({query, cat, days:90, limit:20})`, live `NEWS`, and the localStorage news cache.

**What a user can do.**
- Remove a card (×) or CLEAR BOARD (`clearAssets`, `analyst.js:191`).
- Read a per-card trajectory badge ▲ / — / ▽ (`_computeTrajectory`, `analyst.js:1126`: related-story count ≥4, ≥2, or fewer).
- Open a per-card ⏱ narrative timeline.
- Zoom (wheel, 0.3–4×), pan (drag) and reset the network graph.
- Run the tools below.

**Not present:** free-text notes, user-drawn links between items, drag-and-drop. The empty state says "DRAG STORIES FROM THE INTELLIGENCE FEED", but no `dragstart` or `drop` handlers exist anywhere. Links are computed, not authored.

**Entity network** — `runAnalystGraph` (`analyst.js:309-427`).
- Canvas 2D force layout: centre gravity 0.003, repulsion `min(5000/d², 10)`, spring target 140 px at 0.055, damping 0.86.
- An edge exists when two assets both mention a term from `SHARED_ENTITIES` (`globe.js:1329-1335`, 36 terms such as US, China, NATO, Fed, OPEC, Oil, AI, Chip, Nuclear, Election).
- Edge colour: green `rgba(74,222,128,…)` for same category, amber `rgba(255,159,10,…)` for cross-category.
- Node: 9 px disc in category colour with a 22 px glow.

**Tools on the bar** (all use `callOpenAI` unless noted):

| Tool | Function | Behaviour |
|---|---|---|
| SYNTHESIZE | `synthesizeBrief` `analyst.js:429` | **Not an LLM call.** Template brief: executive summary counts, key entities, asset summaries, historical context from `sbFetchRelatedHistory(pinned, 8)` (5 s timeout), domains. Then `_postProcessBriefConfidence` (`:1141`) adds H/M/L badges by corroborating-story count (≥4 H, ≥2 M). |
| CONSENSUS | `runConsensusBoard` `:576` | Round 1: 5 personas in parallel (`ANALYST_PERSONAS` `:568` — military, economic, cyber, diplomatic, energy), JSON `{assessment, escalation 0-100, keyFactor, blindspot, confidence}`, 220 tokens each. Round 2: the most hawkish challenges the most dovish, then a rebuttal (120 tokens each). Round 3: senior synthesis (700 tokens). |
| ADVERSARY PLAYBOOK | `generatePlaybook` `:1204` | 1600 tokens. Sections: BEHAVIORAL PATTERNS, STRATEGIC INTERESTS, PREDICTED MOVES (30/60/90 DAY), PRESSURE POINTS, COUNTER-STRATEGY, RED FLAGS. Export via `exportPlaybook` `:1246`. |
| RED TEAM | `openRedTeamBrief` / `generateRedTeamBrief` `:749/:754` | 2200 tokens, six labelled sections. `exportRedTeamPDF` `:793` actually downloads HTML. |
| NARRATIVE TIMELINE | `openNarrativeTimeline` / `_buildTimeline` `:1482/:1488` | No AI. Takes keywords (>4 chars) from pinned titles and regions, matches `NEWS` + localStorage cache with ≥2 keyword hits, max 60, grouped by day. |
| DEAD RECKONING | `toggleDeadReckoning` `:1369` | No AI. Counts country-name mentions in `NEWS`. Ratio to max >0.5 escalating, >0.2 active, else stable. Sets `data-dr` on `.ctry-marker` for a text-shadow glow (`css:1131-1133`). |
| ESCALATION MATRIX | `openEscalationMatrix` / `buildEscalationMatrix` `:1261/:1282` | No AI. 5×5 domain coupling grid from keyword regexes over pinned assets and `NEWS`. Clicking a cell lists its stories (`showMatrixStories` `:1334`). |
| SAVED BOARDS | `openSavedBoards` `:1606` | See below. |
| EXPORT BRIEF | `exportBrief` `:483` | Downloads standalone HTML (asset table + brief) as `auspex-brief-${Date.now()}.html`. |

**Data model and storage.**
- Live board, in memory only (lost on reload unless saved):
  - `analystAssets` — array of story ids (integer for live, UUID string for archive) and geo keys (`config.js:138`).
  - `_analystGeoMap` — key → `{id, _geoType, _geoObj, title, summary, cat, color, src, time, region}` (`config.js:139`).
  - `_resolveStory(id)` (`analyst.js:225`) looks in `_analystGeoMap`, then `NEWS`, then `sbGetHistStory`.
- Saved boards: localStorage key **`AUSPEX_SAVED_BOARDS`** (`analyst.js:1559`), an array capped at 50, newest first.
  - Shape: `{id: Date.now(), title, savedAt: ISO, assetIds: [...], stories: [{id,title,summary,body,url,src,cat,region,lat,lng,brk,color,time,_pub,_hist:true,_key}]}`.
  - `saveAnalystBoard` (`:1578`) auto-titles from regions or categories (`_generateBoardTitle` `:1569`).
  - `loadSavedBoard` (`:1639`) rematches stories to live `NEWS` by the first 60 characters of the title, else re-injects them into `_histMap`.
  - `deleteSavedBoard` (`:1665`).
  - Geo assets are not restorable from a saved board; only the story snapshot is re-resolved.
- A parallel **RELIEF** pin pool exists: `reliefAssets` and `_reliefGeoMap` (`config.js:143-144`), with `pinToRelief` and `pinStoryToRelief` (`relief.js:74, 120`). It is in memory only and sets the "operational focus" for 10 humanitarian tools.

---

## 3. STORY POP-UPS

**Trigger.**
- Feed card click (`ui.js:53`) → `openArticle(story)` (`ui.js:361`).
- Globe marker or hit point → `handleLocationClick` → `openArticle`, or the picker if several stories are within 0.5°.
- `openArticle` is monkey-patched at `features.js:401-411` to also retune the live broadcast if that panel is open.

**Container.**
- `#art-panel` plus backdrop `#art-bd` (`index.html:170-225`; CSS `css:302-305`).
- Centred modal: `min(800px, 94vw)`, max-height 80vh, blur backdrop, scale-in animation.
- Opening it stops auto-rotate and flies the camera to `{lat, lng, altitude 1.55}` over 1400 ms. Closing (× / backdrop / Esc) resumes rotation after 700 ms.
- The same panel is reused for:
  - event cards — `openAuspexEventCard` (`globe.js:998`);
  - generic info — `openInfoPanel` (`globe.js:1092`), used by region, threat, silence, country and broadcaster panels.

**Fields shown, top to bottom:**
1. `#ap-cat` — category chip, text in category colour on that colour at `18` alpha.
2. `#ap-brk` — BREAKING badge.
3. `#ap-title`.
4. Byline — `#ap-src` · `#ap-time` (relative) · `#ap-region`.
5. `#ap-prov` — provenance strip, `renderProvenance` (`blindspot.js:87`): flag image, owner, a STATE / PUBLIC / PRIVATE / NONPROFIT tag, and a lean label. Looked up from the `OUTLET_META` table (`blindspot.js:16-74`), keyed by lowercase outlet name with substring fallback (`outletMeta`, `:77`).
6. `#ap-lead` — the dek (`story.summary`, HTML-stripped by `_apStripHtml`, `ui.js:231`).
7. `#ap-text` — the full body if the story has a genuinely distinct one; otherwise the AI brief (see tools).
8. `#ap-enrich` — the "dossier", `_apEnrichBlock` (`ui.js:287`). Rows:
   - SOURCE — owner · type · lean.
   - FILED — category · BREAKING · region.
   - COVERAGE — how many media spheres carry the story, `_apCoverage` (`ui.js:268`).
9. Action row — READ FULL ARTICLE, PIN TO ANALYST, PIN TO RELIEF.
10. LENSES row — MIRRORS, BLINDSPOT, VERIFY; then REACH — TRANSLATE, LISTEN.
11. `#ap-reach` — language chips or translated-state strip.
12. Footer — colour dot + coordinates to 4 decimals + region.

**Event-card variant.** Category chip is the event glyph plus type. The badge reads CONFIRMED (`#30D158`) or UNCONFIRMED (`#FF9F0A`). Byline shows source names, local time and `metric label: value (band)`. Lead is `event.brief`. Body is a clickable "Nearby in space & time" list built from `event.links`. The link reads "SOURCES ›".

**Tools inside the popup:**

| Tool | Function | What it does | Backend |
|---|---|---|---|
| AI brief (automatic) | `_apFillBrief` `ui.js:312`, from `_apRenderBody` `:332` | For thin stories, writes exactly 3 sentences: context, why it matters, what to watch. Told not to restate the headline or dek. Cached per story in `_apBriefCache`. A sequence token `_apRenderSeq` discards stale responses. | `callOpenAI(sys, user, 340)` |
| MIRRORS (bias x-ray) | `openMirrors` `mirrors.js:88`, render `_mirRender` `:124` | Own modal `#mir-panel` (`css:159`). Takes top-8 keywords, finds up to 4 live-feed headlines per sphere, asks the model for JSON `{poles[2], agreed[], spheres{western,chinese,russian,arab:{framing,tone,lean 0-100}}, omitted[], note}`. Renders CONSENSUS, a FRAMING SPECTRUM (dots at `left: lean%`, clamped 7–93), per-sphere rows with real headline citations, and THE BLIND SPOT. Cached in `_mirCache`. | `callOpenAI(…, 900)` |
| BLINDSPOT | `openBlindspot` `blindspot.js:147` | **No AI.** Source ownership card, then a bar per sphere counting live-feed stories that match the top-7 keywords. Zero is flagged BLIND SPOT. Ends with a verdict sentence. Uses the shared lens modal `lpOpen` / `lpSetBody` / `lpClose` (`blindspot.js:98-117`, `#lp-panel` `css:241`). | none |
| VERIFY (claim ledger) | `openVerify` `verify.js:46`, render `_vfRender` `:74` | Extracts 3–6 claims as JSON `{claims:[{claim,status,basis}], summary}`. Status colours: confirmed `#34E08A`, disputed `#FF4D5E`, unverified `#FFB454`. Per claim, `_vfCorroborate` (`:31`) counts distinct outlets whose text contains ≥2 of the claim's key terms. Shows tally pills and a ledger. | `callOpenAI(…, 950)` |
| TRANSLATE | `reachTranslateFromArticle` / `reachDoTranslate` `reach.js:30/42` | Chip picker for 10 languages (`REACH_LANGS` `:11`: es, fr, de, ar, zh-CN, ru, hi, pt, ja, sw). Translates lead and body in place. Cached by `storyId:code`. "↺ SHOW ORIGINAL" reverts (`reachRevert` `:66`). | two `callOpenAI` calls (520 and 1500 tokens) |
| LISTEN | `reachListenFromArticle` `reach.js:74` | Reads title + content aloud (4000-char cap). Sets `utterance.lang` to the translated language. Button toggles LISTEN / STOP. | browser `speechSynthesis`, no server |
| PIN TO ANALYST | `pinStoryFromArticle` `ui.js:219` | Toggles into `analystAssets`; label becomes "PINNED ✓". | — |
| PIN TO RELIEF | `reliefPinFromPanel` `globe.js:1179`, button state `_setReliefPanelButton` `:1162` | Toggles into the RELIEF pool. | — |
| READ FULL ARTICLE | `#ap-link` | The only exit to the publisher; `target=_blank`. | — |
| Map zoom | inside `openArticle` | Automatic camera fly-to. | — |
| Live broadcast retune | patch at `features.js:401` | If the broadcast panel is open, switches to the best channel for the story's region and category. | — |

**Sphere definitions** (`MIR_SPHERES`, `mirrors.js:11-20`):
- WESTERN `#0A84FF`
- CHINESE `#FF2D55`
- RUSSIAN `#FF9F0A`
- ARAB · MENA `#34D399`
- Outlet name lists come from `DIV_SOURCES` (`overlay.js:585-589`) plus the Arab list.

**Absent from the popup:** share, copy link, related-stories list, entity extraction, an "ask" chat, per-story sentiment, images (`urlToImage` is stored but never rendered), and an in-app full-text reader. Sentiment exists only as a per-category arrow on the rail (`computeSentiment` / `renderSentiment`, `ui.js:538/553`, lexicon `SENT_LEX` `:515`). An "Ask" chat exists only in SECTORS (`scAIRun(id,'qa')`, `sectors.js:1063`).

**AI plumbing** — `callOpenAI(sys, user, maxTokens=420)` at `js/analyst.js:533-564`.
- If a client key is present (local dev): POST `https://api.openai.com/v1/chat/completions` with `{model: AI_MODEL, max_completion_tokens, temperature: 0.7, messages: [system, user]}`.
- Otherwise: POST `AI_PROXY_URL = ${WORKER_BASE}/api/ai` with `{system, user, maxTokens, model}`; response is `{content}`.
- `AI_MODEL = 'gpt-5.4-mini'` (`config.js:44`).
- Timeout is 30 s, or 55 s when `maxTokens > 800`.
- `aiEnabled()` (`config.js:46`) gates the UI.
- The proxy `api/ai.mjs` reads `process.env.AUSPEX_LLM_KEY || OPENAI_KEY`. It enforces a per-hashed-IP daily token cap (default 1,000,000) through the Supabase RPC `ai_usage_add`, returns 429 over the cap, and fails open if the store is unreachable.

---

## 4. BROADCASTS / LIVE TV

**Mechanism.** One floating window with a YouTube iframe, plus a pin on the globe for each broadcaster. There is no true picture-in-picture API call; the iframe merely carries `allow="autoplay; encrypted-media; picture-in-picture"`.

**Toggle.** The BROADCASTS button `#lc-livenews` (`index.html:43`) → `toggleLiveNews()` (`features.js:115`) → `openLiveNews(story)` (`:79`) or `closeLiveNews()` (`:103`).

**Panel.**
- Markup: `#live-news-panel` at `index.html:598-621`.
- CSS: `css/auspex.css:939-962`. Fixed at top 110 px, right 390 px, width 420 px, z-index 300. Video area min-height 180 px.
- Parts:
  - Header (drag handle): blinking red dot, "◉ LIVE BROADCAST", location label `#lnp-loc`, close button.
  - Tab strip `#lnp-tabs`: one tab per channel, active underline in the channel colour (`_buildBroadcasterTabs`, `features.js:22`).
  - `<iframe id="lnp-iframe">`.
  - Error overlay with a "▶ OPEN ON YOUTUBE" link.
  - Footer: station name · description, plus a YouTube link.
- Draggable through `_makePanelDraggable` (`features.js:192`). Resizable from the bottom, left and right edges through `makeResizable` (`features.js:124`, 7 px edge zone, min 280×180).

**Embed method** — `switchBroadcaster(id)` at `features.js:31-77`:
```
https://www.youtube-nocookie.com/embed/live_stream?channel=${b.channelId}&autoplay=1&mute=0&playsinline=1&rel=0&modestbranding=1
```
- It uses channel IDs, not video IDs, so it always resolves to whatever the channel is currently streaming.
- The `src` is set synchronously inside the click handler to keep the user gesture, so autoplay with sound can work.
- Fallback and external link: `https://www.youtube.com/@${b.handle}/live`.
- Error handling: a `window` `message` listener parses the YouTube postMessage `info` code. Codes 2, 100, 101, 150 and 153 show the error overlay.
- Closing sets the iframe to `about:blank`.

**Channels** — `BROADCASTERS` at `js/config.js:74-85`; `BROADCASTER_DEFAULT = 'aljazeera'`.

| id | name | handle | channelId | colour | lat, lng | city |
|---|---|---|---|---|---|---|
| aljazeera | AL JAZEERA | AlJazeeraEnglish | UCNye-wNBqNL5ZzHSJj3l8Bg | #E8A020 | 25.2854, 51.5310 | DOHA |
| france24 | FRANCE 24 | France24_en | UCQfwfsi5VrQ8yKZ-UWmAEFg | #0066CC | 48.8738, 2.2950 | PARIS |
| dw | DW NEWS | DWNews | UCknLrEdhRCp1aegoMqRaCZg | #C00000 | 52.5200, 13.4050 | BERLIN |
| cbs | CBS NEWS | CBSNews | UC8p1vwvWtl6T73JiExfWs1g | #1C3F7A | 40.7614, -73.9776 | NEW YORK |
| nbcnews | NBC NEWS NOW | NBCNews | UCeY0bbntWzzVIaj2z3QigXg | #6E55DC | 40.7589, -73.9851 | NEW YORK |
| yahoofinance | YAHOO FINANCE | YahooFinance | UCEAZeUIeJs0IjQiqTCdVSIg | #2980b9 | 37.4419, -122.1430 | SILICON VALLEY |
| africanews | AFRICANEWS | africanews | UC1_E8NeF5QHY2dtdLRBCCLA | #E05C00 | 4.3612, 18.5550 | POINTE-NOIRE |
| cna | CNA | channelnewsasia | UC83jt4dlz1Gjl58fzQrrKZg | #00B4D8 | 1.3521, 103.8198 | SINGAPORE |
| dwespanol | DW ESPAÑOL | dwespanol | UCT4Jg8h03dD0iN3Pb5L0PMA | #D9006E | -23.5505, -46.6333 | SÃO PAULO |
| 9newsaus | 9 NEWS AUSTRALIA | 9NewsAUS | UCIYLOcEUX6TbBo7HQVF2PKA | #FFB000 | -33.8688, 151.2093 | SYDNEY |

- Each entry also carries `cover`, `desc`, `regions[]` (lowercase keywords) and `cats[]`.
- The africanews coordinates (4.36, 18.56) do not match Pointe-Noire, Congo; they are near Bangui. Check before reusing.
- The comment at `config.js:69-73` says channels that block embedding (Bloomberg TV, ABC Australia, teleSUR) were dropped.

**Auto-selection** — `_selectBroadcaster(story)` at `features.js:8-20`. Per channel: +2 if `b.cats` includes the story category, +4 for each `b.regions` keyword that is a substring of the story region or vice versa. Highest score wins.

**Globe markers.**
- Pushed only while `_lnpActive` is true (`globe.js:890`).
- Rendered at `globe.js:909-925`; CSS `css:965-973`.
- Anchored at the bottom (`translate(-50%,-100%)`): a bordered black box with a 5 px blinking dot, name (6 px mono) and city (5 px), then a 1×7 px stem and a 4 px tip dot. All coloured by `--bc`.
- The active channel gets a glow and an animated dot; others are static at 0.5 opacity.
- Clicking a marker opens `openBroadcasterPanel(b)` (`globe.js:1293`): an info card with coverage, focus regions and categories, plus an "OPEN LIVE STREAM" button that calls `switchBroadcaster`.
- In scrubber (past) mode the markers call `switchBroadcaster` directly (`ui.js:832`).

---

## 5. CATEGORY SYSTEM

**Source of truth:** `CATS` at `js/config.js:9-16`, mirrored by CSS variables at `css/auspex.css:28`.

| key | short label | rail label | colour | CSS var | icon |
|---|---|---|---|---|---|
| all | ALL | ALL COVERAGE | #B7C2CC | --all | filled dot |
| geo | GEO | GEOPOLITICAL | #6E8AFF | --geo | columned building |
| military | MIL | MILITARY | #C084FC | --mil | shield + star |
| finance | FIN | FINANCE | #E8B84B | --fin | rising bars |
| climate | CLM | CLIMATE | #34D17A | --cli | leaf |
| tech | TECH | TECHNOLOGY | #22D3EE | --tec | microchip |

- Breaking colour is `--brk: #FF4D5E`.
- There is no POL category. The internal keys are the long forms (`military`, `finance`, `climate`, `tech`). Broadcaster `cats` use short forms (`mil`, `fin`, `tec`), which `_selectBroadcaster` compares against the long keys, so only `geo` ever matches there.

**Where category colour is applied:**
- Feed cards: `--nc` on `.ncard` (`ui.js:10`). It drives the 2 px left bar, the category label, and the location pip (`css:138-153`).
- Globe story markers: `story.color`, glyph lifted 45%, plus drop-shadow (`globe.js:306`).
- Story arcs: `c1 = color+'45'`, `c2 = color+'00'` (`globe.js:1364`).
- Category rail: `--cc` drives the left bar, icon tint, count, and a pip-glow animation when active (`index.html:139-144`, `css:106-123`).
- Globe atmosphere tint on filter (`setCategory`, `ui.js:129`): geo `#300010`, military `#1a0c00`, finance `#1a1500`, climate `#001a0c`, tech `#000d1a`.
- Popup chip and footer dot (`ui.js:382, 399`).
- Picker rows (`ui.js:192-194`).
- Ticker pip and source name (`ui.js:476-477`).
- Analyst cards (`--ac`), network nodes, brief domain chips, timeline dots.
- Map key rows.
- The daily brief does **not** colour by category; it only prefixes `[CAT]` in the prompt.
- The escalation matrix uses its own older palette (`analyst.js:1285`): geo `#FF2D55`, tech `#0A84FF`, military `#FF9F0A`, finance `#FFD60A`, climate `#30D158`.

---

## 6. Other stickiness features

| Feature | File / function | Notes |
|---|---|---|
| Watchlist (saved stories) | `toggleWatchlist` `ui.js:716`, `toggleWatchlistFilter` `:729`, star on each card `ui.js:18` | localStorage **`auspex_wl`** (array of story ids). The ★ button in the feed header filters to saved. Ids are per-fetch integers starting at 100, so saved ids do not survive a refetch reliably. |
| Watchlist alert | `_checkWatchlistAlerts` `analyst.js:1168` | Flashes the analyst status line for 6 s when watched stories are in the live feed. Fires only while the analyst overlay is open. No push or browser notifications exist. |
| Daily brief | `openDailyBrief` `analyst.js:827`, `exportDailyBrief` `:857` | Modal `#brief-modal`. Sends the top 14 stories to the model (2500 tokens) and gets an HTML report with EXECUTIVE SUMMARY / KEY DEVELOPMENTS / STRATEGIC IMPLICATIONS. EXPORT HTML downloads a styled standalone file. Not cached or persisted. |
| Conflict brief | `openConflictBrief` `analyst.js:873` | Clicking a country's ▲ generates SITUATION / ACTORS & DRIVERS / OUTLOOK from up to 14 matching stories (1500 tokens). Reuses the brief modal. |
| City intel panel | `openCityPanel` / `_fetchCityBrief` `features.js:307/365` | Draggable side panel with two AI briefs (city 320 tokens, nation 420) grounded in matching headlines. PIN and RELIEF buttons. |
| Timeline scrubber | `initScrubber` `ui.js:755`, `archiveCurrentStories` `:744`, `applyScrubSnapshot` `:822`, `scrubToLive` `:848` | Bottom bar with a 0–100 range covering 24 h (0.24 h per step). In-memory `STORY_ARCHIVE` (max 50 snapshots, 24 h). Swaps feed and globe to the nearest snapshot and shifts the day/night texture. Not persisted. |
| Accumulating local archive | `news.js:69-86, 191-203` | localStorage **`auspex_news_cache_v2`** = `{ts, map}`, keyed by the first 60 title chars, capped at 8000. 20-minute TTL with a countdown in the header (`scheduleRefresh` `:303`). Seeded from Supabase (`bootstrapFromSupabase` `:255`, 4000 stories over 7 days). |
| Breaking ticker | `initTicker` `ui.js:463` | Top strip of 25 stories, breaking first, pausing on hover. Clicking an item opens the publisher URL in a new tab, so it leaks users out. |
| Market bar | `fetchMarketData` / `renderMarketBar` `ui.js:569/662` | Toggled by clicking the BREAKING or MARKETS label. Yahoo chart API for 10 tickers (top 3 by weighted move), CoinGecko BTC/ETH, open.er-api FX. 5-minute cache. |
| Category sentiment arrows | `renderSentiment` `ui.js:553` | ↑ / ↓ / → per category from the lexicon. |
| Search | `handleSearch` `ui.js:157`; `filterNavButtons` `overlay.js:1107` | Story search over title, summary, region, source; plus a layer-button search. |
| Guided tour | `js/tutorial.js` (IIFE), `window.openAuspexTour` | 7 screenshot scenes. First open only, tracked by localStorage **`auspex.tour.seen.v1`**. Replay from the GUIDE button or a `?tour` URL. Keys: → / Enter next, ← previous, Esc close. |
| Keyboard shortcuts | `globe.js:584-607`; `ui.js:435` | ← → rotate 8°, ↑ ↓ zoom 12% (ignored while typing in an input). Esc closes the article and picker. There are no other shortcuts. |
| Live layers | header buttons `index.html:43-56` | BROADCASTS, CABLES, CASCADE, CITIES, COUNTRIES, DIVERGE, EVENTS, FLIGHTS, SANCTIONS, SHIPPING, SILENCE, STORIES, THREATS, VESSELS. EVENTS and STORIES are on by default. |
| Divergence radar | `toggleDivergence` / `computeAndRenderDivergence` `overlay.js:608/616` | Cosine similarity of term frequencies between Western, Chinese and Russian outlets. Draws arcs and a panel. |
| Cascade predictor | `runCascadeAnalysis` `overlay.js:711`, templates `:665` | Keyword-matches the feed to historical patterns, shows a confidence figure, draws spread arcs. |
| Silence monitor | `toggleSilence` `overlay.js:792`, `detectSilenceAnomalies` `:761` | localStorage **`auspex_silence_v1`** (7-day per-region counts). Flags regions under 25% of baseline, plus 5 known blackout regions. |
| Threats panel | `renderThreatsPanel` `overlay.js:848` | Top-5 scored stories. |
| Shipping / sanctions | `overlay.js:932, 1036` | Chokepoint monitor (simulated: `simulateShipping` `:997`) and an entity-match list. |
| RELIEF board | `js/relief.js`, `openRelief` | 10 humanitarian tools (`index.html:341-369`) with a focus chip and exports. Not read in full. |
| SECTORS board | `js/sectors.js`, `openSectors` `:751` | 8 industry pages with KPIs and sparklines. Four AI tabs per sector: Ask, Brief, Forecast, Scenario (`scAITab` `:1020`, `scAIRun` `:1063`). Not read in full. |
| Breathing aura | `js/aura.js` (`computeAuraState` `:28`, `updateAura` `:66`) | Sets `--aura` and the globe atmosphere to calm `#1FB85C`, active `#4ADE80`, or alert `#FF4D5E` from 24 h of event severity. |
| Ambient polish | `initStars`, `initMoon` `globe.js:629`, `checkDayNight` `:691`, loading cycler `main.js:8` | Starfield, textured orbiting moon, day/dusk/night textures by local hour, auto-rotate with reset and spin buttons. |
| Voice / agent bus | `main.js:80-188` | Polls an external AgentZeus bridge every 2 s for commands (`set_cat`, `toggle_overlay`, `toggle_tool`, `open_page`, `reset_view`, `set_spin`). **On by default**; disabled with `localStorage.auspex_bridge = '0'`. The block's header comment says "OFF by default", which the code contradicts. |
| Draggable panels | `makeDraggable` / `initDraggablePanels` `features.js:224/252` | Shipping, sanctions, divergence, cascade, threats, silence, city, broadcast. |

**Absent:** sound effects (only LISTEN text-to-speech), push or browser notifications, user accounts, share or copy-link, a full in-app article reader (the feed carries only the dek, and `body` is `''` at `news.js:179`), and saved-search alerts.

**All localStorage keys:** `auspex_wl`, `AUSPEX_SAVED_BOARDS`, `auspex_news_cache_v2`, `auspex_silence_v1`, `auspex.tour.seen.v1`, `auspex_bridge`.

---

## 7. Predecessor: `/Users/connorevans/Desktop/Portfolio/meridian copy`

Same architecture and file names (`css/meridian.css`, `js/*.js`). Only what it has that AUSPEX lacks or changed:

**1. Shape-based story markers with pulse rings** — `js/globe.js:287-301`.
- Each story is a 9 px `.gm-core` clipped to a per-category shape, plus an animated `.gm-ring`. Breaking stories get a second ring.
- Shapes: geo = diamond, military = triangle, finance = square, tech = hexagon, climate = star.
- The clip-paths still exist in AUSPEX at `css/auspex.css:369-392`, so the shape system can be revived as-is.
- Markers call `openArticle` directly; there is no co-location picker on the DOM marker.

**2. Older category palette** — `js/config.js:6-13`.
- all `#7B61FF`, geo `#FF2D55`, military `#FF9F0A`, finance `#FFD60A`, climate `#30D158`, tech `#0A84FF`.

**3. Static, fuller city legend** — `js/analyst.js:916-925`.
- Lists 9 city types including Military base, Naval base, Active conflict zone city, and Diplomatic capital.
- The map key also lists three threat-ring levels (CRITICAL / HIGH / ELEVATED).
- City icons are older, simpler glyphs (`globe.js:247-257`); colours differ for port `#00BCD4`, energy `#FF9F0A`, city `#6674CC`.

**4. WEBCAMS** — `js/features.js:116-256`.
- Toggle a panel, then click a story.
- Calls `https://api.windy.com/webcams/api/v3/webcams?nearby={lat},{lng},50&include=images,player,location&limit=9` with header `x-windy-api-key` (the key constant is `WINDY_KEY`, defined in the keys file, which was not opened).
- Shows a 3×3 thumbnail grid and a lightbox. The lightbox embeds `cam.player.streaming.embed`, then `day.embed`, then `current.embed`, falling back to a full-size image.

**5. WARGAME** — `js/analyst.js:812-848, 982-1054`.
- An overlay that rebinds globe point-clicks.
- `generateWargameScenarios(story)` asks the model (650 tokens) for exactly 3 scenarios as JSON: `{title, probability, path: escalation | de-escalation | lateral, hours, description, dstLat, dstLng, indicators[]}`.
- Renders scenario cards and draws coloured arcs from the story to each destination: escalation `#FF2D55`, de-escalation `#30D158`, lateral `#FF9F0A`.
- `resetWargameArcs` clears them.

**6. QUAKES overlay** — `js/ui.js:326-365`.
- Client-side fetch of the USGS `4.5_day.geojson` feed.
- `makeEqMarker` draws 3 concentric wave rings plus a core sized `8 + (mag-4.5)*3`.
- Colour by magnitude: ≥7 `#FF2D55`, ≥6 `#FF9F0A`, ≥5 `#FFD60A`, else `#30D158`.
- Info via `showEqInfo` / `openSingleEq` (`globe.js:592/624`).
- AUSPEX replaced this with the worker snapshot's typed events.

**7. Parked features** — `js/removed_features.js`, with restore instructions in the file header.
- SATELLITE: NASA GIBS BlueMarble WMS texture, fetched as a blob.
- HEAT: 12° grid cluster blobs sized `60 + count*22` px.
- FOG: a canvas overlay darkening low-coverage zones.

**8. Bloomberg TV broadcaster** — `config.js:30`.
- channelId `UCIALMKvObZNtJ6AmdCLP7Lg`, handle `Bloomberg`.
- AUSPEX removed it because its live stream blocks embedding. Meridian has only 5 channels.

**Meridian lacks:** MIRRORS, BLINDSPOT, VERIFY, TRANSLATE, LISTEN, provenance, the AI brief and dossier in the popup (its `openArticle`, `ui.js:184-228`, just prints `summary` and `body`), RELIEF, SECTORS, typed event icons, category icons, the tour, vessels, the aura, and the AI proxy. Its localStorage keys are `meridian_wl` and `meridian_news_cache_v5`. Its Analyst board function list is the same as AUSPEX's apart from the wargame additions.

---

## Key file index (absolute paths)
- `/Users/connorevans/Downloads/AUSPEX/index.html` — all markup; command panel 85-110, map key 112-117, article panel 170-225, analyst overlay 255-324, broadcast panel 598-621
- `/Users/connorevans/Downloads/AUSPEX/js/icons.js` — event and category icons, colours, resolvers
- `/Users/connorevans/Downloads/AUSPEX/js/globe.js` — city icons 247-281, all marker builders 282-536, dispatcher 817-993, event card and info panels 998-1324, arcs 1329-1427
- `/Users/connorevans/Downloads/AUSPEX/js/config.js` — CATS, AI routing, BROADCASTERS, all state
- `/Users/connorevans/Downloads/AUSPEX/js/ui.js` — feed cards, picker, article popup, ticker, sentiment, markets, watchlist, scrubber
- `/Users/connorevans/Downloads/AUSPEX/js/analyst.js` — analyst board, `callOpenAI`, consensus, red team, daily and conflict briefs, map key 907-1072, `refreshArcs`, tools, saved boards
- `/Users/connorevans/Downloads/AUSPEX/js/features.js` — broadcast player, drag and resize, city panel
- `/Users/connorevans/Downloads/AUSPEX/js/mirrors.js`, `/js/blindspot.js`, `/js/verify.js`, `/js/reach.js` — popup lenses
- `/Users/connorevans/Downloads/AUSPEX/js/overlay.js` — flights, cables, divergence, cascade, silence, threats, city and country toggles, shipping, sanctions
- `/Users/connorevans/Downloads/AUSPEX/js/data.js` — `detectCat`, `extractCoords`, coordinate tables, fallback stories
- `/Users/connorevans/Downloads/AUSPEX/js/news.js` — fetch, filter, cache pipeline
- `/Users/connorevans/Downloads/AUSPEX/js/tutorial.js`, `/js/aura.js`, `/js/snapshot.js`, `/js/vessels.js`, `/js/main.js`
- `/Users/connorevans/Downloads/AUSPEX/api/ai.mjs` — AI proxy
- `/Users/connorevans/Downloads/AUSPEX/src/normalize.js` — event typing
- `/Users/connorevans/Downloads/AUSPEX/scripts/reclassify-cities.mjs` and `/data/cities-1000.json` — city icon assignment
- `/Users/connorevans/Downloads/AUSPEX/css/auspex.css` — variables 3-46, markers 355-436, flights and vessels 710-738, map key 908-931, broadcast 939-973, event markers 1150-1170, relief markers 1451-1469
- `/Users/connorevans/Desktop/Portfolio/meridian copy/js/{globe,ui,features,analyst,removed_features,config}.js`