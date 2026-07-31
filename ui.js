/**
 * ui.js - User Interface Controller
 * Manages DOM updates, events, drawer controls, lists, and filter elements.
 */

// Cache DOM elements
const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  eventList: document.getElementById('event-list'),
  listCount: document.getElementById('list-count'),
  
  // Stats
  statTotal: document.querySelector('#stat-total .stat-value'),
  statFires: document.querySelector('#stat-fires .stat-value'),
  statStorms: document.querySelector('#stat-storms .stat-value'),
  statVolcanoes: document.querySelector('#stat-volcanoes .stat-value'),
  
  // Filters
  searchInput: document.getElementById('search-input'),
  categoryFilter: document.getElementById('category-filter'),
  timeFilter: document.getElementById('time-filter'),
  
  // Detail Drawer
  detailDrawer: document.getElementById('detail-drawer'),
  closeDrawerBtn: document.getElementById('close-drawer-btn'),
  drawerCategory: document.getElementById('drawer-category'),
  drawerTitle: document.getElementById('drawer-title'),
  drawerDate: document.getElementById('drawer-date'),
  drawerStatus: document.getElementById('drawer-status'),
  drawerCoords: document.getElementById('drawer-coords'),
  drawerSources: document.getElementById('drawer-sources'),
  gibsToggle: document.getElementById('gibs-toggle'),
  drawerNews: document.getElementById('drawer-news'),
  toggleMarkersBtn: document.getElementById('toggle-markers'),
  toggleHeatmapBtn: document.getElementById('toggle-heatmap'),
  syncIndicator: document.getElementById('sync-indicator')
};

// State variables for event handlers
let currentFilterChangeCallback = null;
let currentSelectionCallback = null;
let currentGibsToggleCallback = null;
let activeEvent = null;

/**
 * Initializes UI listeners.
 */
export function initUI({ onFilterChange, onEventSelect, onGibsToggle, onViewModeChange }) {
  currentFilterChangeCallback = onFilterChange;
  currentSelectionCallback = onEventSelect;
  currentGibsToggleCallback = onGibsToggle;

  // Add filter change listeners
  elements.searchInput.addEventListener('input', triggerFilterChange);
  elements.categoryFilter.addEventListener('change', triggerFilterChange);
  elements.timeFilter.addEventListener('change', triggerFilterChange);

  // Close drawer listener
  elements.closeDrawerBtn.addEventListener('click', closeDrawer);

  // GIBS Layer Toggle listener
  elements.gibsToggle.addEventListener('change', (e) => {
    if (currentGibsToggleCallback && activeEvent) {
      currentGibsToggleCallback(activeEvent, e.target.checked);
    }
  });

  // View Mode switches
  if (elements.toggleMarkersBtn && elements.toggleHeatmapBtn) {
    elements.toggleMarkersBtn.addEventListener('click', () => {
      elements.toggleMarkersBtn.classList.add('active');
      elements.toggleHeatmapBtn.classList.remove('active');
      if (onViewModeChange) onViewModeChange('markers');
    });

    elements.toggleHeatmapBtn.addEventListener('click', () => {
      elements.toggleHeatmapBtn.classList.add('active');
      elements.toggleMarkersBtn.classList.remove('active');
      if (onViewModeChange) onViewModeChange('heatmap');
    });
  }
}

/**
 * Hides the loading screen overlay.
 */
export function hideLoader() {
  if (elements.loadingOverlay) {
    elements.loadingOverlay.classList.add('fade-out');
  }
}

/**
 * Shows the loading screen overlay.
 */
export function showLoader() {
  if (elements.loadingOverlay) {
    elements.loadingOverlay.classList.remove('fade-out');
  }
}

/**
 * Controls the visibility of the "Syncing live NASA data..." banner.
 * @param {boolean} isLoading - Active state showing loading rotating state
 * @param {boolean} isSynced - Synced check state showing green check
 */
export function showSyncIndicator(isLoading = true, isSynced = false) {
  if (!elements.syncIndicator) return;
  
  if (isLoading) {
    elements.syncIndicator.classList.remove('synced');
    elements.syncIndicator.classList.add('active');
    elements.syncIndicator.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> Syncing NASA...';
  } else if (isSynced) {
    elements.syncIndicator.classList.add('active', 'synced');
    elements.syncIndicator.innerHTML = '<i class="fa-solid fa-circle-check"></i> Live Synced';
    
    // Auto-hide synced indicator after 3 seconds
    setTimeout(() => {
      if (elements.syncIndicator.classList.contains('synced')) {
        elements.syncIndicator.classList.remove('active');
      }
    }, 3000);
  } else {
    elements.syncIndicator.classList.remove('active', 'synced');
  }
}

/**
 * Updates all stat cards in the header.
 * @param {Array} allEvents - Complete list of loaded events
 */
export function updateStats(allEvents) {
  const counts = { total: 0, wildfires: 0, severeStorms: 0, volcanoes: 0 };
  
  allEvents.forEach(e => {
    counts.total++;
    if (e.category === 'wildfires') counts.wildfires++;
    else if (e.category === 'severeStorms') counts.severeStorms++;
    else if (e.category === 'volcanoes') counts.volcanoes++;
  });

  elements.statTotal.textContent = counts.total;
  elements.statFires.textContent = counts.wildfires;
  elements.statStorms.textContent = counts.severeStorms;
  elements.statVolcanoes.textContent = counts.volcanoes;
}

/**
 * Returns current filter values.
 */
export function getFilters() {
  return {
    query: elements.searchInput.value.toLowerCase().trim(),
    category: elements.categoryFilter.value,
    timeframe: parseInt(elements.timeFilter.value, 10)
  };
}

/**
 * Triggers the parent filter callback.
 */
function triggerFilterChange() {
  if (currentFilterChangeCallback) {
    currentFilterChangeCallback(getFilters());
  }
}

/**
 * Populates and renders the sidebar list of disasters.
 * @param {Array} filteredEvents - Filtered events to show
 */
export function renderEventList(filteredEvents) {
  elements.eventList.innerHTML = '';
  elements.listCount.textContent = `${filteredEvents.length} items`;

  if (filteredEvents.length === 0) {
    elements.eventList.innerHTML = '<div class="no-events">No disasters found matching criteria.</div>';
    return;
  }

  filteredEvents.forEach(event => {
    const card = document.createElement('div');
    card.className = `event-card ${event.category}`;
    card.id = `card-${event.id}`;
    
    if (activeEvent && activeEvent.id === event.id) {
      card.classList.add('active-selection');
    }

    const formattedDate = new Date(event.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const magnitudeStr = event.magnitude 
      ? `<span class="badge">${event.magnitude} ${event.magnitudeUnit || ''}</span>`
      : '';

    card.innerHTML = `
      <div class="event-card-header">
        <h4 class="event-card-title">${event.title}</h4>
      </div>
      <div class="event-card-meta">
        <span class="event-card-category cat-${event.category.replace('severeStorms', 'storm').replace('seaLakeIce', 'ice').replace('wildfires', 'wildfire')}">${event.categoryTitle}</span>
        <div>
          ${magnitudeStr}
          <span>${formattedDate}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      // Highlight card
      document.querySelectorAll('.event-card').forEach(c => c.classList.remove('active-selection'));
      card.classList.add('active-selection');
      
      // Fire select callback
      if (currentSelectionCallback) {
        currentSelectionCallback(event);
      }
    });

    elements.eventList.appendChild(card);
  });
}

/**
 * Opens the drawer panel and populates with event information.
 * @param {Object} event - Selected event details
 */
export function openDrawer(event) {
  activeEvent = event;
  
  // Set drawer badge class
  elements.drawerCategory.className = `event-badge ${event.category}`;
  elements.drawerCategory.textContent = event.categoryTitle;
  
  elements.drawerTitle.textContent = event.title;
  
  // Set date
  const formattedDate = new Date(event.date).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  elements.drawerDate.innerHTML = `<i class="fa-regular fa-calendar"></i> ${formattedDate}`;
  
  // Set status
  const isClosed = event.closed !== null;
  elements.drawerStatus.textContent = isClosed ? 'Closed' : 'Active';
  elements.drawerStatus.style.color = isClosed ? 'var(--text-secondary)' : 'var(--color-active)';

  // Set coordinates
  elements.drawerCoords.textContent = `${event.latestCoords[0].toFixed(4)}, ${event.latestCoords[1].toFixed(4)}`;

  // Reset GIBS switch
  elements.gibsToggle.checked = false;

  // Render sources
  elements.drawerSources.innerHTML = '';
  if (event.sources && event.sources.length > 0) {
    event.sources.forEach(source => {
      const li = document.createElement('li');
      li.innerHTML = `
        <a href="${source.url}" target="_blank" rel="noopener noreferrer">
          ${source.id} <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      `;
      elements.drawerSources.appendChild(li);
    });
  } else {
    elements.drawerSources.innerHTML = `<li class="no-sources">No official report URLs provided.</li>`;
  }

  // Render news coverage
  if (elements.drawerNews) {
    elements.drawerNews.innerHTML = '';
    
    // Determine target redirect url from event sources or fallback Google News search query
    let sourceUrl = `https://news.google.com/search?q=${encodeURIComponent(event.title)}`;
    if (event.sources && event.sources.length > 0 && event.sources[0].url) {
      sourceUrl = event.sources[0].url;
    }

    const reports = generateNewsReports(event);
    reports.forEach(report => {
      const card = document.createElement('div');
      card.className = `news-card ${event.category}`;
      card.innerHTML = `
        <div class="news-card-header">
          <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="news-source-link">
            ${report.source} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.6rem; margin-left: 2px;"></i>
          </a>
          <span class="news-time">${report.time}</span>
        </div>
        <h4 class="news-title">${report.title}</h4>
        <p class="news-summary">${report.summary}</p>
      `;
      elements.drawerNews.appendChild(card);
    });

    // Append Live Video Broadcast Player container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'live-stream-container';
    videoContainer.innerHTML = `
      <h4>Live NASA TV Broadcast</h4>
      <div class="video-wrapper">
        <iframe 
          src="https://www.youtube.com/embed/live_stream?channel=UCLA_njvUpkOdLw46n92tX7g" 
          title="NASA TV Live Stream" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen>
        </iframe>
      </div>
    `;
    elements.drawerNews.appendChild(videoContainer);
  }

  // Open drawer
  elements.detailDrawer.classList.add('open');
}

/**
 * Generates mock news reports/coverage based on event category.
 */
function generateNewsReports(event) {
  const newsTemplates = {
    wildfires: [
      {
        source: "State Emergency Dispatch",
        title: `Containment Crews Deployed to ${event.title}`,
        time: "1 hour ago",
        summary: `Local fire authorities have issued warnings for coordinates surrounding ${event.latestCoords[0].toFixed(2)}, ${event.latestCoords[1].toFixed(2)}. Gusty winds are shifting smoke vectors, pushing AQI to hazardous thresholds.`
      },
      {
        source: "Forestry Sentinel",
        title: "Satellite Scans Confirm Rapid Heat Expansion",
        time: "5 hours ago",
        summary: "Thermal imaging from NASA orbiters shows accelerated crown fire activity. Multiple hotspots have merged. Immediate containment is focused on southern residential flanks."
      }
    ],
    severeStorms: [
      {
        source: "Regional Weather Center",
        title: `${event.title} Triggers High Wind & Rainfall Alerts`,
        time: "45 minutes ago",
        summary: "Coastal radars indicate sustained storm force speeds. Rainfall accumulation is expected to hit peak margins within the next 12 hours. Flash flood evacuations are in progress."
      },
      {
        source: "Marine Traffic Log",
        title: "Maritime Safe Zones Established Amid Extreme Swells",
        time: "3 hours ago",
        summary: "Commercial shipping routes around the cyclone track are temporarily rerouted. Harbour ports have suspended cargo operations due to storm surges reaching up to 4 meters."
      }
    ],
    volcanoes: [
      {
        source: "Geological Observatory",
        title: "Increased Seismic Tremors Detected Near Crater",
        time: "2 hours ago",
        summary: "Seismometers are recording continuous harmonic tremors. Lava output remains steady, with visible fissure fountains. Scientists advise maintaining safety distance from plume zones."
      },
      {
        source: "Aviation Alert Network",
        title: "Red Code Advisory Issued for Flight Corridors",
        time: "6 hours ago",
        summary: "Ash concentration scans show dispersion patterns drifting westward. Local airlines have preemptively cancelled flights traversing the immediate warning airspace."
      }
    ],
    seaLakeIce: [
      {
        source: "Polar Research Log",
        title: `Ice Fracture Accelerates Near ${event.title}`,
        time: "Yesterday",
        summary: "SAR radar imagery indicates new cracks developing along the ice boundary. Ice shelf integrity is being monitored. Scientists attribute the event to warm sub-surface ocean currents."
      },
      {
        source: "Antarctic Shipping Agency",
        title: "Iceberg Drift Advisories Issued for Fishing Vessels",
        time: "2 days ago",
        summary: "Tracking coordinates indicate drift speeds of 0.8 knots. Fishing operators are warned of potential submerged ice hazards extending several miles from the main berg."
      }
    ]
  };

  const defaultTemplates = [
    {
      source: "Global Event Monitor",
      title: `Observation Telemetry Registered for ${event.title}`,
      time: "2 hours ago",
      summary: `Scientific agencies have updated tracking files for ${event.id} at coordinates ${event.latestCoords[0].toFixed(2)}, ${event.latestCoords[1].toFixed(2)}. Telemetry sensors indicate steady activity levels.`
    }
  ];

  return newsTemplates[event.category] || defaultTemplates;
}

/**
 * Closes the drawer panel and notifies map to turn off overlays.
 */
export function closeDrawer() {
  elements.detailDrawer.classList.remove('open');
  
  // Remove highlighted class from list cards
  document.querySelectorAll('.event-card').forEach(c => c.classList.remove('active-selection'));
  
  // Notify GIBS close if active
  if (currentGibsToggleCallback && activeEvent && elements.gibsToggle.checked) {
    elements.gibsToggle.checked = false;
    currentGibsToggleCallback(activeEvent, false);
  }
  
  activeEvent = null;
}
