// 🌍 Initialize the Leaflet map centered at coordinates [20, 0] with zoom level 2
let map = L.map("map").setView([20, 0], 2);

// 🗺️ Add OpenStreetMap tile layer to the map
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Create a marker cluster group
let markers = L.markerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  maxClusterRadius: 80, // Maximum radius that a cluster will cover from the central marker
});

// Store references to markers for easier access
let markerRefs = {};

// Weather API configuration (using OpenWeatherMap as an example)
const WEATHER_API_KEY = "YOUR_API_KEY_HERE"; // This should be replaced with an actual API key
const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather";

let crashData = [];
let chart;
let timelineChart;
let operatorChart; // New chart for operator analysis

/**
 * 📥 Asynchronously load crash data from JSON file and initialize visualization
 * @returns {Promise<void>} Resolves when data is loaded and visualization is initialized
 */
async function loadData() {
  console.log("🔍 Loading crash data...");
  const res = await fetch("data/crashes.json");
  crashData = await res.json();
  console.log(`✅ Loaded ${crashData.length} crash records`);
  renderMarkers(crashData);
  updateAnalytics(crashData);
  updateTimeline(crashData);
}

/**
 * 🎯 Render crash markers on the map with color-coded severity
 * @param {Array} data - Array of crash data objects
 */
function renderMarkers(data) {
  // Clear existing markers from the map
  markers.clearLayers();
  
  // Create markers for each crash with color based on fatality count
  data.forEach((crash) => {
    if (crash.Latitude && crash.Longitude) {
      // Determine marker color based on fatality count
      const fatalityCount = crash.Fatalities || 0;
      let color = "green"; // Default color for low fatalities
      
      if (fatalityCount > 50) {
        color = "red";
      } else if (fatalityCount > 10) {
        color = "orange";
      } else if (fatalityCount > 0) {
        color = "yellow";
      }
      
      // Calculate marker size based on fatalities (min 5, max 15)
      const markerSize = Math.max(5, Math.min(15, fatalityCount / 10));
      
      // Create a unique key for this crash
      const crashKey = `${crash.Location}-${crash.Year}`;
      
      // Create circle marker with visual properties based on fatalities
      const marker = L.circleMarker([crash.Latitude, crash.Longitude], {
        radius: markerSize,
        fillColor: color,
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7,
      }).bindPopup(`
        <b>${crash.Location}</b><br>
        Year: ${crash.Year}<br>
        Type: ${crash.Type}<br>
        Fatalities: ${crash.Fatalities}<br>
        Country: ${crash.Country}<br>
        <div id="weather-info-${crash.Year}-${crash.Location.replace(/\s+/g, '-')}">Loading weather data...</div>
        <button onclick="fetchWeatherData(${crash.Latitude}, ${crash.Longitude}, '${crash.Year}', '${crash.Location.replace(/\s+/g, '-')}')">Load Weather</button>
      `);
      
      // Store reference to marker
      markerRefs[crashKey] = marker;
      
      markers.addLayer(marker);
    }
  });
  
  // Add the marker cluster group to the map
  map.addLayer(markers);
}

/**
 * ☁️ Fetch weather data for a specific crash location (demo implementation)
 * @param {number} lat - Latitude coordinate
 * @param {number} lon - Longitude coordinate
 * @param {string} year - Year of the crash
 * @param {string} locationId - Unique identifier for the location
 */
async function fetchWeatherData(lat, lon, year, locationId) {
  try {
    // For demo purposes, we're using current weather API
    // In a real implementation, you would use a historical weather API
    const response = await fetch(`${WEATHER_API_URL}?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`);
    
    if (!response.ok) {
      throw new Error('Weather data not available');
    }
    
    const weatherData = await response.json();
    
    // Update the popup with weather information
    const weatherInfoDiv = document.getElementById(`weather-info-${year}-${locationId}`);
    if (weatherInfoDiv) {
      weatherInfoDiv.innerHTML = `
        <b>Weather Conditions:</b><br>
        Temperature: ${weatherData.main.temp}°C<br>
        Humidity: ${weatherData.main.humidity}%<br>
        Wind Speed: ${weatherData.wind.speed} m/s<br>
        Conditions: ${weatherData.weather[0].description}
      `;
    }
  } catch (error) {
    const weatherInfoDiv = document.getElementById(`weather-info-${year}-${locationId}`);
    if (weatherInfoDiv) {
      weatherInfoDiv.innerHTML = "Weather data unavailable";
    }
  }
}

/**
 * 📊 Update analytics dashboard with crash statistics
 * @param {Array} data - Array of crash data objects
 */
function updateAnalytics(data) {
  // Calculate summary statistics
  const total = data.length;
  const totalFatal = data.reduce((sum, d) => sum + (d.Fatalities || 0), 0);
  const avgFatal = total ? (totalFatal / total).toFixed(1) : 0;

  // Update DOM elements with statistics
  document.getElementById("count").textContent = total;
  document.getElementById("fatalities").textContent = totalFatal;
  document.getElementById("avg").textContent = avgFatal;

  // Group crashes by decade for chart visualization
  const grouped = {};
  data.forEach((d) => {
    const decade = Math.floor(d.Year / 10) * 10;
    grouped[decade] = (grouped[decade] || 0) + 1;
  });

  const labels = Object.keys(grouped).sort();
  const values = labels.map((l) => grouped[l]);

  // Destroy existing chart if it exists
  if (chart) chart.destroy();
  
  // Create new bar chart showing crashes per decade
  chart = new Chart(document.getElementById("chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Crashes per Decade",
          data: values,
          backgroundColor: "rgba(255,99,132,0.6)",
        },
      ],
    },
    options: { 
      scales: { y: { beginAtZero: true } },
      responsive: true,
      maintainAspectRatio: false
    },
  });
  
  // New Operator Analysis Chart
  updateOperatorAnalysis(data);
}

// New function for operator analysis
function updateOperatorAnalysis(data) {
  // Group crashes by operator (using Type as proxy since we don't have Operator field)
  const operatorGrouped = {};
  data.forEach((d) => {
    // Using Type as operator since Operator field isn't in our dataset
    const operator = d.Type || "Unknown";
    if (!operatorGrouped[operator]) {
      operatorGrouped[operator] = { crashes: 0, fatalities: 0 };
    }
    operatorGrouped[operator].crashes += 1;
    operatorGrouped[operator].fatalities += d.Fatalities || 0;
  });

  // Convert to array and sort by crash count
  const operatorArray = Object.entries(operatorGrouped)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.crashes - a.crashes);

  // Take top 8 operators
  const topOperators = operatorArray.slice(0, 8);
  const operatorLabels = topOperators.map(op => op.name);
  const crashCounts = topOperators.map(op => op.crashes);
  const fatalityCounts = topOperators.map(op => op.fatalities);

  // Destroy existing chart if it exists
  if (operatorChart) operatorChart.destroy();

  // Create operator analysis chart
  operatorChart = new Chart(document.getElementById("operator-chart"), {
    type: "bar",
    data: {
      labels: operatorLabels,
      datasets: [
        {
          label: "Crashes",
          data: crashCounts,
          backgroundColor: "rgba(54, 162, 235, 0.7)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1
        },
        {
          label: "Fatalities",
          data: fatalityCounts,
          backgroundColor: "rgba(255, 99, 132, 0.7)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Count"
          }
        },
        x: {
          title: {
            display: true,
            text: "Aircraft Type"
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Top Aircraft Types by Crashes and Fatalities'
        }
      }
    }
  });
}

// Timeline chart function
function updateTimeline(data) {
  // Group crashes by year for timeline
  const yearlyData = {};
  data.forEach((d) => {
    yearlyData[d.Year] = (yearlyData[d.Year] || 0) + 1;
  });

  const years = Object.keys(yearlyData).sort();
  const counts = years.map((y) => yearlyData[y]);

  // Destroy existing chart if it exists
  if (timelineChart) timelineChart.destroy();

  // Create timeline chart
  timelineChart = new Chart(document.getElementById("timeline-chart"), {
    type: "line",
    data: {
      labels: years,
      datasets: [
        {
          label: "Crashes per Year",
          data: counts,
          borderColor: "rgba(54, 162, 235, 1)",
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          fill: true,
          tension: 0.1
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Number of Crashes"
          }
        },
        x: {
          title: {
            display: true,
            text: "Year"
          }
        }
      }
    },
  });
}

// Timeline chart function
function updateTimeline(data) {
  // Group data by year
  const yearlyData = {};
  data.forEach((d) => {
    yearlyData[d.Year] = (yearlyData[d.Year] || 0) + 1;
  });

  const years = Object.keys(yearlyData).sort();
  const counts = years.map((year) => yearlyData[year]);

  const ctx = document.getElementById("timeline-chart").getContext("2d");
  
  if (timelineChart) timelineChart.destroy();
  
  timelineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: years,
      datasets: [{
        label: "Crashes per Year",
        data: counts,
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Number of Crashes"
          }
        },
        x: {
          title: {
            display: true,
            text: "Year"
          }
        }
      }
    }
  });
}

// Apply filter function
function applyFilters() {
  // Get filter values from UI elements
  const minY = +document.getElementById("yearMin").value || 0;
  const maxY = +document.getElementById("yearMax").value || 9999;
  const type = document.getElementById("typeFilter").value;
  const region = document.getElementById("regionFilter").value.toLowerCase();
  const minF = +document.getElementById("fatalFilter").value || 0;
  
  // Weather filters (not fully implemented in this demo)
  const precipitation = document.getElementById("precipitationFilter").value;
  const minWind = +document.getElementById("windMin").value || 0;
  const maxWind = +document.getElementById("windMax").value || 999;
  const maxVisibility = +document.getElementById("visibilityFilter").value || 999;

  // Filter crash data based on user inputs
  const filtered = crashData.filter(
    (c) =>
      c.Year >= minY &&
      c.Year <= maxY &&
      (type === "All" || c.Type === type) &&
      (!region || (c.Country && c.Country.toLowerCase().includes(region))) &&
      (c.Fatalities || 0) >= minF
      // Weather filters would be applied here in a full implementation
  );

  // Update visualization with filtered data
  renderMarkers(filtered);
  updateAnalytics(filtered);
  updateTimeline(filtered);
}

/**
 * 🔄 Reset all filters to default values
 */
function resetFilters() {
  // Reset filter input fields
  document.getElementById("yearMin").value = "";
  document.getElementById("yearMax").value = "";
  document.getElementById("typeFilter").value = "All";
  document.getElementById("regionFilter").value = "";
  document.getElementById("fatalFilter").value = "";
  
  // Reset weather filters
  document.getElementById("precipitationFilter").value = "all";
  document.getElementById("windMin").value = "";
  document.getElementById("windMax").value = "";
  document.getElementById("visibilityFilter").value = "";
  
  renderMarkers(crashData);
  updateAnalytics(crashData);
  updateTimeline(crashData);
}

// 🎯 Future enhancement placeholder function
function futureEnhancement() {
  // Reserved for future functionality
  // Will implement advanced filtering options
}

/**
 * Search crashes based on query text
 * @param {string} query - Search query
 */
function searchCrashes(query) {
  if (!query || query.trim() === '') {
    clearSearchResults();
    return;
  }
  
  query = query.toLowerCase().trim();
  
  // Filter crashes based on query
  const results = crashData.filter(crash => 
    (crash.Location && crash.Location.toLowerCase().includes(query)) ||
    (crash.Country && crash.Country.toLowerCase().includes(query)) ||
    (crash.Type && crash.Type.toLowerCase().includes(query))
  );
  
  displaySearchResults(results);
  highlightMatchingMarkers(results);
}

/**
 * Display search results in the sidebar
 * @param {Array} results - Array of crash objects
 */
function displaySearchResults(results) {
  const resultsContainer = document.getElementById('searchResults');
  
  if (results.length === 0) {
    resultsContainer.innerHTML = '<p>No results found.</p>';
    resultsContainer.style.display = 'block';
    return;
  }
  
  let html = `<p>Found ${results.length} result(s):</p>`;
  
  results.forEach((crash, index) => {
    html += `
      <div class="search-result-item" data-index="${index}" onclick="jumpToCrash(${JSON.stringify(crash).replace(/"/g, '&quot;')})">
        <strong>${crash.Location}</strong> (${crash.Year})<br>
        <small>${crash.Type} - ${crash.Fatalities} fatalities</small>
      </div>`;
  });
  
  resultsContainer.innerHTML = html;
  resultsContainer.style.display = 'block';
}

/**
 * Highlight matching markers on the map
 * @param {Array} results - Array of crash objects
 */
function highlightMatchingMarkers(results) {
  // Clear previous highlights
  clearMarkerHighlights();
  
  // Highlight matching markers
  results.forEach(crash => {
    const crashKey = `${crash.Location}-${crash.Year}`;
    const marker = markerRefs[crashKey];
    
    if (marker) {
      // Temporarily increase the size and change color to highlight
      marker.setStyle({
        radius: marker.options.radius + 3,
        color: '#ffeb3b',
        weight: 3
      });
      
      // Store original style for later restoration
      marker.originalStyle = {
        radius: marker.options.radius - 3,
        color: marker.options.color,
        weight: marker.options.weight
      };
    }
  });
}

/**
 * Clear marker highlights
 */
function clearMarkerHighlights() {
  // Restore original style for all markers
  Object.values(markerRefs).forEach(marker => {
    if (marker.originalStyle) {
      marker.setStyle(marker.originalStyle);
      delete marker.originalStyle;
    }
  });
}

/**
 * Jump to a specific crash location on the map
 * @param {Object} crash - Crash object
 */
function jumpToCrash(crash) {
  if (crash.Latitude && crash.Longitude) {
    map.setView([crash.Latitude, crash.Longitude], 10);
    
    // Find and open the popup for this marker
    const crashKey = `${crash.Location}-${crash.Year}`;
    const marker = markerRefs[crashKey];
    
    if (marker) {
      // Close any open popups first
      map.closePopup();
      
      // Open popup for this marker after a short delay to ensure map is positioned
      setTimeout(() => {
        marker.openPopup();
      }, 500);
    }
  }
}

/**
 * Clear search results
 */
function clearSearchResults() {
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('searchInput').value = '';
  clearMarkerHighlights();
}

// 📡 Event listeners for filter buttons
document.getElementById("applyFilter").addEventListener("click", applyFilters);
document.getElementById("resetFilter").addEventListener("click", resetFilters);

// Add event listeners for search functionality
document.getElementById('searchButton').addEventListener('click', function() {
  const query = document.getElementById('searchInput').value;
  searchCrashes(query);
});

document.getElementById('clearSearchButton').addEventListener('click', clearSearchResults);

document.getElementById('searchInput').addEventListener('keyup', function(event) {
  if (event.key === 'Enter') {
    searchCrashes(this.value);
  }
});

// 🚀 Initialize the application when page loads
loadData();