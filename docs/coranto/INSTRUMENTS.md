# INSTRUMENTS: what each layer is, and whether it works

Every layer below was switched on in a browser on 2026-10-11 and its status
line read back. "Works" means it loaded real data and said where from.
Counts are what it showed at the time.

## Keys

| Key (in `.env`) | Set | What it is for |
|---|---|---|
| `NEWS_API_KEY` | yes | One extra news index (NewsAPI) |
| `OPENAI_API_KEY` | yes | AI briefs and the voice assistant. Still needs rotating |
| `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | yes | Live civil flights worldwide |
| `AISSTREAM_API_KEY` | yes | Live ships |
| `FEC_API_KEY` | yes | US campaign money |
| `FIRMS_MAP_KEY` | no | Not needed: fires use NASA's keyless daily files |
| `MAPILLARY_CLIENT_TOKEN` | no | Street Level photos. The layer says KEY REQUIRED |
| `TOMTOM_API_KEY` | no | Live road traffic. Without it Street Traffic draws nothing |
| `GOOGLE_MAPS_API_KEY` or `CESIUM_ION_TOKEN` | no | Photoreal 3D cities. Without one the globe is satellite imagery |
| `TFL_APP_KEY` | no | London transit detail (optional) |
| `LL2_API_TOKEN` | no | Higher rate limit for launches (optional) |

## Layers

| Layer | What it shows | Source | Status |
|---|---|---|---|
| World News | Headlines pinned to the places they name | 35 publishers | Works (32 of 35 answering) |
| Upcoming Elections | Polling days, next 120 days | Wikidata | Works (23) |
| Satellites | Satellites from orbital elements | CelesTrak | Works (828 shown of about 28,000 tracked) |
| Live Flights | Civil aircraft | OpenSky Network | Works (10,300) |
| Military Flights | Military aircraft broadcasting position | adsb.lol | Works (42) |
| Local ADS-B | Aircraft from your own radio receiver | RTL-SDR over WebUSB | Needs a receiver plugged in |
| Live Vessels | Ships, drawn by class | AISStream | Works (12,000) |
| Street Traffic | Measured road speed, drawn as moving dots | TomTom flow on OpenStreetMap roads | Needs a TomTom key. Without one it draws nothing and says so |
| Transit | Buses and trains | GTFS-Realtime feeds | Works (255) |
| Bike Share | Docks and bikes | GBFS feeds | Works; loads by city |
| Cameras | Public traffic and weather cameras | Agency feeds, Street View fallback | Works (3,900 listed) |
| Recent Imagery | Recent satellite imagery | NASA GIBS | Works |
| Street Level | Street photos | Mapillary | Needs a key |
| Mapped ALPR Cameras | Licence-plate readers | OpenStreetMap | Works (zoom into a city) |
| Mapped Installations | Military sites | OpenStreetMap | Works (near the view) |
| Data Centers | Data centres | Bundled list | Works (4,400) |
| Submarine Cables | Undersea cables | TeleGeography (non-commercial licence) | Works (2,600) |
| Dams | US dams | US Army Corps of Engineers | Works (716) |
| Natural Hazards | Cyclones, floods, volcanoes and more | GDACS, NASA EONET | Works (76) |
| Space Missions | Launches, last and next 30 days | Launch Library 2 | Works; slow to start, switches Satellites on while it is on |
| Earthquakes | Last 24 hours | USGS | Works (44) |
| Active Fires | Fire detections, last 24 hours | NASA FIRMS | Works (173,700) |
| Fire Perimeters | US wildfire outlines | NIFC | Works (108). Incident detail from InciWeb is unavailable: the `wildfire.gov` domain was failing DNS on 2026-10-11, for everyone |
| Wind | Wind field | NOAA GFS | Works |
| Rain radar | Radar | NOAA | Works |
| Satellite clouds | Cloud imagery | NOAA | Works |
| Lightning density | Lightning | NOAA | Works |
| Cyclone advisories | Tropical cyclones | NOAA NHC | Works |
| Directions | Routes between two points | OpenStreetMap routing | Works |
| Radio | Radio stations by place | Radio Browser | Works (750) |

## Note: traffic is real or absent

The engine Coranto is built on can simulate traffic when it has no data.
Coranto switches that off for people: Street Traffic draws dots only on roads
with measured flow from TomTom, and with no key it draws nothing. The dots
show how fast each road is moving; they are not individual vehicles.
