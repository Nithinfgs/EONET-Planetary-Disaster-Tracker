/**
 * chart.js - Chart.js Controller
 * Handles rendering statistics, trends, and storm tracks inside the drawer.
 */

let chartInstance = null;

/**
 * Updates the chart inside the drawer.
 * @param {Object} selectedEvent - Selected event object
 * @param {Array} allEvents - Complete list of active events
 */
export function updateDrawerChart(selectedEvent, allEvents) {
  const ctx = document.getElementById('details-chart');
  if (!ctx) return;

  // Clear previous chart
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const isStorm = selectedEvent.category === 'severeStorms';
  const hasTrack = selectedEvent.track && selectedEvent.track.length > 1;

  if (isStorm && hasTrack) {
    renderStormTrackChart(ctx, selectedEvent);
  } else {
    renderCategoryFrequencyChart(ctx, selectedEvent, allEvents);
  }
}

/**
 * Renders a line chart showing a severe storm's intensity over time.
 */
function renderStormTrackChart(ctx, event) {
  const chartTitle = document.getElementById('chart-title');
  if (chartTitle) chartTitle.textContent = "Storm Track Intensity (Wind Speed)";

  // Sort tracking data chronologically
  const sortedTrack = [...event.track].sort((a, b) => a.date - b.date);

  const labels = sortedTrack.map(point => {
    return new Date(point.date).toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit' 
    });
  });

  const dataPoints = sortedTrack.map(point => point.magnitude || 0);

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: `Wind Speed (${event.magnitudeUnit || 'kts'})`,
        data: dataPoints,
        borderColor: '#00e5ff',
        backgroundColor: 'rgba(0, 229, 255, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#00e5ff',
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#8f9cae', font: { size: 9, family: 'Inter' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#8f9cae', font: { size: 9, family: 'Inter' } },
          title: {
            display: true,
            text: event.magnitudeUnit || 'kts',
            color: '#8f9cae',
            font: { size: 9, family: 'Inter' }
          }
        }
      }
    }
  });
}

/**
 * Renders a comparative bar chart showing frequency of active events.
 */
function renderCategoryFrequencyChart(ctx, selectedEvent, allEvents) {
  const chartTitle = document.getElementById('chart-title');
  if (chartTitle) chartTitle.textContent = "Global Event Comparison";

  // Calculate counts for categories
  const counts = {
    wildfires: 0,
    severeStorms: 0,
    volcanoes: 0,
    seaLakeIce: 0
  };

  allEvents.forEach(e => {
    if (counts[e.category] !== undefined) {
      counts[e.category]++;
    }
  });

  const categories = ['Wildfires', 'Storms', 'Volcanoes', 'Ice'];
  const values = [counts.wildfires, counts.severeStorms, counts.volcanoes, counts.seaLakeIce];
  
  // Highlight the current category with a full border/accent
  const backgroundColors = [
    selectedEvent.category === 'wildfires' ? 'rgba(255, 87, 34, 0.6)' : 'rgba(255, 87, 34, 0.25)',
    selectedEvent.category === 'severeStorms' ? 'rgba(0, 229, 255, 0.6)' : 'rgba(0, 229, 255, 0.25)',
    selectedEvent.category === 'volcanoes' ? 'rgba(255, 193, 7, 0.6)' : 'rgba(255, 193, 7, 0.25)',
    selectedEvent.category === 'seaLakeIce' ? 'rgba(144, 202, 249, 0.6)' : 'rgba(144, 202, 249, 0.25)'
  ];

  const borderColors = [
    '#ff5722',
    '#00e5ff',
    '#ffc107',
    '#90caf9'
  ];

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [{
        data: values,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#8f9cae', font: { size: 10, family: 'Inter' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#8f9cae', font: { size: 10, family: 'Inter' }, stepSize: 1 }
        }
      }
    }
  });
}
