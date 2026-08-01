# EONET Planetary Disaster Tracker

https://silver-youtiao-dcbc70.netlify.app/

A high-performance, dark-themed dashboard tracking active global natural hazards in real-time. Built entirely with vanilla technologies, utilizing NASA’s EONET (Earth Observatory Natural Event Tracker) and GIBS (Global Imagery Browse Services) APIs.

---

##  Key Features

*   **Real-Time Hazard Mapping**: Plots active wildfires, volcanoes, severe storms, and sea ice drift.
*   **Dual View Modes**:
    *   **Markers View**: Pulse-glowing SVG custom map pins color-coded by hazard type.
    *   **Heatmap View**: Global density visualization powered by `Leaflet.heat` with category-weighted gradients.
*   **Evergreen NASA TV Broadcast**: Embedded live broadcast stream from official NASA feeds.
*   **NASA GIBS Satellite Overlays**: Interactive high-resolution MODIS satellite corrected reflectance layer centered directly on selected coordinates.
*   **Active Storm Trails**: Renders polyline storm tracks and historical wind speed telemetry tooltips.
*   **Local Coverage Reports**: Simulates localized news feeds and headlines matching current disaster details.
*   **Chart.js Analysis**: Line charts detailing hurricane wind speeds over time, and comparative bar charts outlining global event distributions.
*   **Instant Load (SWR Caching)**: Employs Stale-While-Revalidate caching logic via `localStorage`. The map loads instantly (<100ms) with cached/mock telemetry while revalidating and updating from NASA API in the background.

---

##  Tech Stack & Architecture

To prevent disk-space bloat and iCloud sync errors (common with large node repositories), this project is built **completely dependency-free** at the local file level. All frameworks and libraries are loaded directly via secure global CDNs.

*   **Core**: HTML5, Vanilla JavaScript (ES modules), Vanilla CSS (Cyberpunk glassmorphic layout)
*   **Mapping Engine**: Leaflet.js
*   **Heatmap Rendering**: Leaflet.heat
*   **Graphs & Telemetry**: Chart.js
*   **Icons & Fonts**: FontAwesome v6, Google Fonts (Orbitron, Inter)

# EONET-Planetary-Disaster-Tracker
