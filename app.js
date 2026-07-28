/**
 * app.js - Main Application Coordinator
 * Boots the application, fetches telemetry data, and binds UI filters to map/charts.
 */

import { fetchEvents, getCachedEventsLocal, getMockFallbackEvents } from './api.js';
import { initMap, updateMapMarkers, focusCoordinates, toggleGibsOverlay, clearStormTracks, setMapViewMode } from './map.js';
import { updateDrawerChart } from './chart.js';
import { 
  initUI, 
  hideLoader, 
  showLoader, 
  updateStats, 
  renderEventList, 
  openDrawer,
  getFilters,
  showSyncIndicator
} from './ui.js';

// Application State
let allEvents = [];
let filteredEvents = [];
let loadedTimeframe = 30; // default timeframe

/**
 * Initializes the application modules and fetches starting data.
 */
async function bootstrap() {
  console.log('Bootstrapping EONET Tracker...');

  // 1. Initialize Map
  initMap('map', handleEventSelect);

  // 2. Initialize UI callbacks
  initUI({
    onFilterChange: handleFilterChange,
    onEventSelect: handleEventSelect,
    onGibsToggle: handleGibsToggle,
    onViewModeChange: handleViewModeChange
  });

  // 3. Load initial data (past 30 days)
  await loadData(loadedTimeframe);
}

/**
 * Callback when the map visualization view mode is changed (Markers vs Heatmap).
 */
function handleViewModeChange(mode) {
  console.log('Changing Map view mode to:', mode);
  setMapViewMode(mode);
}

/**
 * Fetches data from API, processes counts, and updates UI & Map.
 * Optimizes performance by instantly rendering local cache/mock and validation in background.
 * @param {number} days - Timeframe in days
 */
async function loadData(days) {
  loadedTimeframe = days;
  
  // 1. Attempt to load from localStorage cache first
  const cacheObj = getCachedEventsLocal(days);
  
  if (cacheObj) {
    console.log('Instant render: Loading EONET cache from localStorage');
    allEvents = cacheObj.data;
    updateStats(allEvents);
    applyFilters(getFilters());
    hideLoader(); // Hide full-screen loader immediately
    
    // If cache is expired, revalidate in background
    if (cacheObj.isExpired) {
      console.log('Cache is expired, revalidating in background...');
      triggerBackgroundSync(days);
    } else {
      console.log('Cache is fresh. No background sync needed.');
    }
  } else {
    // 2. No cache exists - render fallback mock data instantly to avoid blank map
    console.log('No cache found. Rendering mock templates instantly & syncing in background');
    
    allEvents = getMockFallbackEvents();
    updateStats(allEvents);
    applyFilters(getFilters());
    hideLoader(); // Hide loader immediately so screen responds instantly
    
    // Trigger background sync to pull live NASA data
    triggerBackgroundSync(days);
  }
}

/**
 * Triggers background EONET fetch and silently refreshes indicators and data.
 * @param {number} days - Timeframe in days
 */
async function triggerBackgroundSync(days) {
  showSyncIndicator(true, false); // Show spinning Syncing NASA indicator
  
  try {
    const liveEvents = await fetchEvents(days);
    
    // Only apply if the timeframe hasn't changed while we were fetching
    if (loadedTimeframe === days) {
      allEvents = liveEvents;
      updateStats(allEvents);
      applyFilters(getFilters());
      showSyncIndicator(false, true); // Show Sync Checkmark
    }
  } catch (err) {
    console.error('Background sync failed:', err);
    showSyncIndicator(false, false); // Hide sync indicator
  }
}

/**
 * Callback when filters or search query change.
 * Checks if a refetch is needed, or runs local list filtering.
 * @param {Object} filters - current filter states
 */
async function handleFilterChange(filters) {
  // If user changed the timeframe (days), we need to fetch new data from NASA EONET
  if (filters.timeframe !== loadedTimeframe) {
    await loadData(filters.timeframe);
    return;
  }

  // Otherwise, filter the current cached list locally
  applyFilters(filters);
}

/**
 * Applies search and category filters to active dataset and refreshes Map/UI.
 */
function applyFilters(filters) {
  filteredEvents = allEvents;

  // Filter by category
  if (filters.category !== 'all') {
    filteredEvents = filteredEvents.filter(event => event.category === filters.category);
  }

  // Filter by search query
  if (filters.query) {
    filteredEvents = filteredEvents.filter(event => 
      event.title.toLowerCase().includes(filters.query) || 
      event.categoryTitle.toLowerCase().includes(filters.query)
    );
  }

  // Update map markers
  updateMapMarkers(filteredEvents, handleEventSelect);

  // Update sidebar list
  renderEventList(filteredEvents);
}

/**
 * Callback when a marker or sidebar card is selected.
 */
function handleEventSelect(event) {
  console.log('Selected Event:', event.title);

  // 1. Center map on selected disaster coordinates and zoom in
  focusCoordinates(event.latestCoords, 6);

  // 2. Open side sliding details drawer
  openDrawer(event);

  // 3. Render Chart.js line or bar graphs
  updateDrawerChart(event, allEvents);
}


/**
 * Callback when GIBS Satellite toggle switch changes state.
 */
function handleGibsToggle(event, active) {
  toggleGibsOverlay(event, active);
  
  // If activating, focus in a bit closer to make imagery visible
  if (active) {
    focusCoordinates(event.latestCoords, 7);
  }
}

// Start application when page loads
window.addEventListener('DOMContentLoaded', bootstrap);
