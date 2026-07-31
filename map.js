/**
 * map.js - Leaflet Map Controller
 * Manages map layers, markers, custom SVG icons, storm paths, and NASA GIBS satellite tiles.
 */

let map = null;
let markerLayer = null;
let pathLayer = null;
let gibsLayer = null;
let heatLayer = null;
let currentSelectedMarker = null;
let currentViewMode = 'markers'; // 'markers' or 'heatmap'
let cachedEvents = [];
let cachedMarkerSelectCallback = null;

// CartoDB Dark Matter tile layer
const BASE_LAYER_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const BASE_LAYER_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// NASA GIBS WMTS URL template (Web Mercator EPSG:3857)
const GIBS_URL_TEMPLATE = 'https://gibs-{s}.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{x}/{y}.jpg';

/**
 * Initializes the map inside a DOM container.
 * @param {string} domId - Element ID for the map
 * @param {Function} onMarkerClick - Callback when a marker is clicked
 */
export function initMap(domId, onMarkerClick) {
  if (map) return;

  // Initialize leaflet map centered globally
  map = L.map(domId, {
    center: [20.0, 0.0],
    zoom: 2.5,
    minZoom: 2,
    maxZoom: 10,
    zoomControl: false // custom position
  });

  // Add zoom control to bottom right
  L.control.zoom({
    position: 'bottomright'
  }).addTo(map);

  // Add dark base layer
  L.tileLayer(BASE_LAYER_URL, {
    attribution: BASE_LAYER_ATTRIBUTION,
    maxZoom: 20
  }).addTo(map);

  // Initialize groups for markers and storm tracks
  markerLayer = L.layerGroup().addTo(map);
  pathLayer = L.layerGroup().addTo(map);

  // Initialize heat layer (leaflet.heat plugin should be loaded)
  if (typeof L.heatLayer === 'function') {
    heatLayer = L.heatLayer([], {
      radius: 25,
      blur: 15,
      maxZoom: 10,
      gradient: {
        0.4: 'rgba(0, 229, 255, 0.6)', // Cyan (Storm)
        0.6: 'rgba(144, 202, 249, 0.7)', // Blue (Ice)
        0.7: 'rgba(255, 193, 7, 0.8)',   // Yellow/Amber (Volcano)
        1.0: 'rgba(255, 87, 34, 1.0)'    // Red/Orange (Fire)
      }
    });
  } else {
    console.warn('Leaflet.heat plugin not loaded yet.');
  }

  return map;
}

/**
 * Updates the markers on the map based on the event list.
 * @param {Array} events - List of active natural events
 * @param {Function} onMarkerSelect - Callback for when an event is selected
 */
export function updateMapMarkers(events, onMarkerSelect) {
  if (!map) return;

  cachedEvents = events;
  cachedMarkerSelectCallback = onMarkerSelect;

  // Clear previous layers
  markerLayer.clearLayers();
  clearStormTracks();
  removeGibsOverlay();

  events.forEach(event => {
    if (!event.latestCoords || isNaN(event.latestCoords[0]) || isNaN(event.latestCoords[1])) return;

    // Create custom SVG marker
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin ${event.category}" id="marker-${event.id}"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24]
    });

    // Create Marker
    const marker = L.marker(event.latestCoords, { icon: icon });

    // Pop up overlay details
    const popupContent = `
      <div>
        <h4>${event.title}</h4>
        <p><strong>Category:</strong> ${event.categoryTitle}</p>
        <p><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</p>
        ${event.magnitude ? `<p><strong>Intensity:</strong> ${event.magnitude} ${event.magnitudeUnit || ''}</p>` : ''}
        <button id="popup-btn-${event.id}">Analyze Details</button>
      </div>
    `;

    marker.bindPopup(popupContent, {
      closeButton: false,
      offset: [0, -15]
    });

    // Attach click events
    marker.on('click', () => {
      onMarkerSelect(event);
      currentSelectedMarker = marker;
      
      // Draw storm path if it has multiple tracking points
      drawStormPath(event);
    });

    // Handle button click in popup
    marker.on('popupopen', () => {
      const btn = document.getElementById(`popup-btn-${event.id}`);
      if (btn) {
        btn.addEventListener('click', () => {
          map.closePopup();
          onMarkerSelect(event);
        });
      }
    });

    markerLayer.addLayer(marker);
  });

  // Re-build heatmap data points if heatLayer is available
  if (heatLayer) {
    const heatPoints = events
      .filter(event => event.latestCoords && !isNaN(event.latestCoords[0]) && !isNaN(event.latestCoords[1]))
      .map(event => {
        let intensity = 0.5;
        if (event.category === 'wildfires') intensity = 1.0;
        else if (event.category === 'severeStorms') intensity = 0.8;
        else if (event.category === 'volcanoes') intensity = 0.7;
        else if (event.category === 'seaLakeIce') intensity = 0.4;
        return [event.latestCoords[0], event.latestCoords[1], intensity];
      });

    heatLayer.setLatLngs(heatPoints);
  }

  // Apply visibility based on current view mode
  applyViewModeVisibility();
}

/**
 * Sets the map visualization view mode.
 * @param {string} mode - 'markers' or 'heatmap'
 */
export function setMapViewMode(mode) {
  if (currentViewMode === mode) return;
  currentViewMode = mode;
  applyViewModeVisibility();
}

/**
 * Toggles map layers visibility based on current view mode.
 */
function applyViewModeVisibility() {
  if (!map) return;

  if (currentViewMode === 'heatmap') {
    if (map.hasLayer(markerLayer)) {
      map.removeLayer(markerLayer);
    }
    if (heatLayer && !map.hasLayer(heatLayer)) {
      map.addLayer(heatLayer);
    }
  } else {
    if (heatLayer && map.hasLayer(heatLayer)) {
      map.removeLayer(heatLayer);
    }
    if (!map.hasLayer(markerLayer)) {
      map.addLayer(markerLayer);
    }
  }
}

/**
 * Focuses the map on a specific coordinates
 * @param {Array} coords - [lat, lng]
 * @param {number} zoom - Zoom level
 */
export function focusCoordinates(coords, zoom = 6) {
  if (!map || !coords) return;
  map.setView(coords, zoom, {
    animate: true,
    duration: 1.0
  });
}

/**
 * Draws storm tracking tracks as lines and points on the map.
 * @param {Object} event - The selected event
 */
function drawStormPath(event) {
  clearStormTracks();

  if (event.category !== 'severeStorms' || !event.track || event.track.length <= 1) {
    return;
  }

  const coordinates = event.track.map(t => t.coordinates);

  // Glow polyline
  const glowLine = L.polyline(coordinates, {
    color: 'var(--color-storm)',
    weight: 6,
    opacity: 0.3,
    lineCap: 'round'
  });

  // Sharp inner polyline
  const mainLine = L.polyline(coordinates, {
    color: 'var(--color-storm)',
    weight: 2,
    opacity: 0.9,
    dashArray: '5, 8',
    lineCap: 'round'
  });

  pathLayer.addLayer(glowLine);
  pathLayer.addLayer(mainLine);

  // Add small tracking circles at historical locations
  event.track.forEach((point, index) => {
    // Make circles transparently glowing
    const isLatest = index === event.track.length - 1;
    if (isLatest) return; // Latest already has a marker pin

    const circle = L.circleMarker(point.coordinates, {
      radius: 4,
      fillColor: 'var(--color-storm)',
      color: '#fff',
      weight: 1,
      fillOpacity: 0.8
    });

    circle.bindTooltip(`Storm location on ${new Date(point.date).toLocaleDateString()}<br>Wind: ${point.magnitude || 'Unknown'} kts`, {
      direction: 'top',
      className: 'custom-tooltip'
    });

    pathLayer.addLayer(circle);
  });
}

/**
 * Clears the drawn paths from the map.
 */
export function clearStormTracks() {
  if (pathLayer) pathLayer.clearLayers();
}

/**
 * Toggles NASA GIBS satellite overlay on the map.
 * @param {Object} event - Active selected event
 * @param {boolean} active - Active state
 */
export function toggleGibsOverlay(event, active) {
  removeGibsOverlay();

  if (!active || !event) return;

  // Format event date for GIBS: YYYY-MM-DD
  const eventDate = new Date(event.date);
  const today = new Date();
  
  let dateStr = 'default';
  // If the event happened more than 1 day ago, request that day's imagery
  if (today.getTime() - eventDate.getTime() > 24 * 3600 * 1000) {
    dateStr = eventDate.toISOString().split('T')[0];
  }

  console.log(`Loading NASA GIBS layer for date: ${dateStr}`);

  // Create the tile layer
  gibsLayer = L.tileLayer(GIBS_URL_TEMPLATE, {
    attribution: 'NASA GIBS',
    time: dateStr,
    maxZoom: 9,
    opacity: 0.8,
    bounds: L.latLngBounds([-85.0511, -180], [85.0511, 180]) // Web Mercator bounds
  });

  map.addLayer(gibsLayer);
  
  // Bring it below markers, above base layer
  if (gibsLayer.bringToBack) {
    gibsLayer.bringToBack();
  }
}

/**
 * Removes the GIBS satellite overlay.
 */
export function removeGibsOverlay() {
  if (map && gibsLayer) {
    map.removeLayer(gibsLayer);
    gibsLayer = null;
  }
}
