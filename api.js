/**
 * api.js - EONET API Client
 * Handles fetching, filtering, caching, and cleaning natural event data.
 */

const EONET_BASE_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';

// In-memory cache to prevent redundant API calls within a session
const cache = {
  data: null,
  timestamp: null,
  daysFilter: null
};

const CACHE_KEY = 'eonet_events_cache';
const CACHE_TIME_KEY = 'eonet_events_timestamp';

/**
 * Synchronously retrieves cached events from localStorage if available.
 * @param {number} days - Timeframe in days
 * @returns {Object|null} { data: Array, isExpired: boolean }
 */
export function getCachedEventsLocal(days = 30) {
  try {
    const cachedData = localStorage.getItem(`${CACHE_KEY}_${days}`);
    const cachedTime = localStorage.getItem(`${CACHE_TIME_KEY}_${days}`);
    
    if (cachedData && cachedTime) {
      // 1 hour cache validation (60 minutes)
      const expirationLimit = 60 * 60 * 1000;
      const isExpired = (Date.now() - parseInt(cachedTime, 10)) > expirationLimit;
      return {
        data: JSON.parse(cachedData),
        isExpired: isExpired
      };
    }
  } catch (e) {
    console.error('Error reading localStorage cache:', e);
  }
  return null;
}

/**
 * Fetch events from EONET API.
 * In case of failure or rate limits, returns mock fallback data to keep the app working.
 * @param {number} days - Timeframe in days
 * @returns {Promise<Array>} cleaned event objects
 */
export async function fetchEvents(days = 30) {
  const cacheDuration = 5 * 60 * 1000; // 5 minutes in-memory cache
  const now = Date.now();

  if (cache.data && cache.timestamp && (now - cache.timestamp < cacheDuration) && cache.daysFilter === days) {
    console.log('Returning cached EONET data');
    return cache.data;
  }

  try {
    // EONET API accepts 'status=all' or 'status=open' (default).
    // We request 'open' events to keep the response fast and relevant to active disasters.
    const url = `${EONET_BASE_URL}?days=${days}&status=open`;
    console.log(`Fetching planetary data from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API response error: ${response.status}`);
    }
    
    const json = await response.json();
    const cleanedEvents = parseEonetResponse(json.events || []);
    
    // Save to in-memory cache
    cache.data = cleanedEvents;
    cache.timestamp = now;
    cache.daysFilter = days;
    
    // Save to localStorage
    try {
      localStorage.setItem(`${CACHE_KEY}_${days}`, JSON.stringify(cleanedEvents));
      localStorage.setItem(`${CACHE_TIME_KEY}_${days}`, String(now));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    
    return cleanedEvents;
  } catch (error) {
    console.warn('Failed to fetch from EONET API, loading fallback data. Error:', error);
    const mockEvents = getMockFallbackEvents();
    return mockEvents;
  }
}

/**
 * Normalizes EONET API JSON response into a consistent structure.
 */
function parseEonetResponse(events) {
  return events
    .filter(event => event.geometry && event.geometry.length > 0)
    .map(event => {
      // Map EONET categories to our standard IDs
      const rawCategory = event.categories?.[0]?.id || 'unknown';
      let category = 'other';
      if (rawCategory === 'wildfires') category = 'wildfires';
      else if (rawCategory === 'severeStorms') category = 'severeStorms';
      else if (rawCategory === 'volcanoes') category = 'volcanoes';
      else if (rawCategory === 'seaLakeIce') category = 'seaLakeIce';
      else return null; // Filter out irrelevant categories for our 4-type dashboard

      // Extract geometry information.
      const trackPoints = event.geometry.map(g => ({
        coordinates: [g.coordinates[1], g.coordinates[0]], // [lat, lng] for Leaflet
        date: new Date(g.date),
        magnitude: g.magnitudeValue,
        unit: g.magnitudeUnit
      })).sort((a, b) => a.date - b.date); // Sort chronological

      // Current/latest location is the last point in the track
      const latestPoint = trackPoints[trackPoints.length - 1];

      return {
        id: event.id,
        title: event.title,
        category: category,
        categoryTitle: event.categories?.[0]?.title || 'Natural Event',
        closed: event.closed,
        sources: event.sources || [],
        latestCoords: latestPoint.coordinates,
        date: latestPoint.date,
        magnitude: latestPoint.magnitude,
        magnitudeUnit: latestPoint.unit,
        track: trackPoints
      };
    })
    .filter(event => event !== null);
}

/**
 * Returns mock event data in case NASA API is unavailable.
 * Ensures the app has beautiful real-looking planet data for demonstrations.
 */
export function getMockFallbackEvents() {
  const today = new Date();
  
  const mockTemplates = [
    {
      id: "MOCK_FIRE_001",
      title: "Dixie Wildfire - Northern California",
      category: "wildfires",
      categoryTitle: "Wildfires",
      closed: null,
      sources: [{ id: "InciWeb", url: "https://inciweb.nwcg.gov/" }],
      latestCoords: [40.015, -121.124],
      date: new Date(today.getTime() - 2 * 3600000), // 2 hrs ago
      magnitude: 96324,
      magnitudeUnit: "Acres",
      track: [{ coordinates: [40.015, -121.124], date: new Date(today.getTime() - 2 * 3600000), magnitude: 96324, unit: "Acres" }]
    },
    {
      id: "MOCK_FIRE_002",
      title: "Amazon Rainforest Burn Anomalies",
      category: "wildfires",
      categoryTitle: "Wildfires",
      closed: null,
      sources: [{ id: "INPE", url: "http://queimadas.dgi.inpe.br/queimadas" }],
      latestCoords: [-9.124, -62.341],
      date: new Date(today.getTime() - 6 * 3600000),
      magnitude: 450,
      magnitudeUnit: "MW",
      track: [{ coordinates: [-9.124, -62.341], date: new Date(today.getTime() - 6 * 3600000), magnitude: 450, unit: "MW" }]
    },
    {
      id: "MOCK_STORM_001",
      title: "Super Typhoon Maria",
      category: "severeStorms",
      categoryTitle: "Severe Storms",
      closed: null,
      sources: [{ id: "JTWC", url: "https://www.metoc.navy.mil/jtwc/" }],
      latestCoords: [21.5, 126.8],
      date: today,
      magnitude: 115,
      magnitudeUnit: "kts",
      track: [
        { coordinates: [15.2, 138.4], date: new Date(today.getTime() - 48 * 3600000), magnitude: 65, unit: "kts" },
        { coordinates: [16.8, 135.9], date: new Date(today.getTime() - 36 * 3600000), magnitude: 80, unit: "kts" },
        { coordinates: [18.1, 133.1], date: new Date(today.getTime() - 24 * 3600000), magnitude: 95, unit: "kts" },
        { coordinates: [19.9, 129.8], date: new Date(today.getTime() - 12 * 3600000), magnitude: 110, unit: "kts" },
        { coordinates: [21.5, 126.8], date: today, magnitude: 115, unit: "kts" }
      ]
    },
    {
      id: "MOCK_STORM_002",
      title: "Hurricane Arthur",
      category: "severeStorms",
      categoryTitle: "Severe Storms",
      closed: null,
      sources: [{ id: "NHC", url: "https://www.nhc.noaa.gov/" }],
      latestCoords: [28.4, -76.2],
      date: new Date(today.getTime() - 1 * 3600000),
      magnitude: 85,
      magnitudeUnit: "kts",
      track: [
        { coordinates: [24.1, -79.5], date: new Date(today.getTime() - 24 * 3600000), magnitude: 60, unit: "kts" },
        { coordinates: [26.3, -77.8], date: new Date(today.getTime() - 12 * 3600000), magnitude: 75, unit: "kts" },
        { coordinates: [28.4, -76.2], date: new Date(today.getTime() - 1 * 3600000), magnitude: 85, unit: "kts" }
      ]
    },
    {
      id: "MOCK_VOLCANO_001",
      title: "Fagradalsfjall Eruption",
      category: "volcanoes",
      categoryTitle: "Volcanoes",
      closed: null,
      sources: [{ id: "IMO", url: "https://en.vedur.is/" }],
      latestCoords: [63.903, -22.273],
      date: new Date(today.getTime() - 1 * 3600000),
      magnitude: null,
      magnitudeUnit: null,
      track: [{ coordinates: [63.903, -22.273], date: new Date(today.getTime() - 1 * 3600000), magnitude: null, unit: null }]
    },
    {
      id: "MOCK_VOLCANO_002",
      title: "Mount Sakurajima Eruption Plume",
      category: "volcanoes",
      categoryTitle: "Volcanoes",
      closed: null,
      sources: [{ id: "JMA", url: "https://www.jma.go.jp/jma/indexe.html" }],
      latestCoords: [31.593, 130.657],
      date: new Date(today.getTime() - 24 * 3600000),
      magnitude: 9000,
      magnitudeUnit: "ft",
      track: [{ coordinates: [31.593, 130.657], date: new Date(today.getTime() - 24 * 3600000), magnitude: 9000, unit: "ft" }]
    },
    {
      id: "MOCK_ICE_001",
      title: "Iceberg A-76 Calving Event",
      category: "seaLakeIce",
      categoryTitle: "Sea and Lake Ice",
      closed: null,
      sources: [{ id: "USNIC", url: "https://usnic.noaa.gov/" }],
      latestCoords: [-75.8, -59.5],
      date: new Date(today.getTime() - 10 * 86400000),
      magnitude: 4320,
      magnitudeUnit: "km^2",
      track: [{ coordinates: [-75.8, -59.5], date: new Date(today.getTime() - 10 * 86400000), magnitude: 4320, unit: "km^2" }]
    },
    {
      id: "MOCK_ICE_002",
      title: "Wilkins Ice Shelf Fractures",
      category: "seaLakeIce",
      categoryTitle: "Sea and Lake Ice",
      closed: null,
      sources: [{ id: "NSIDC", url: "https://nsidc.org/" }],
      latestCoords: [-70.2, -73.0],
      date: new Date(today.getTime() - 5 * 86400000),
      magnitude: null,
      magnitudeUnit: null,
      track: [{ coordinates: [-70.2, -73.0], date: new Date(today.getTime() - 5 * 86400000), magnitude: null, unit: null }]
    }
  ];

  return mockTemplates;
}
