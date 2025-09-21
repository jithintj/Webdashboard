// --------------------
// js/app.js
// Handles real-time data, UI updates, zoom/pan, and controls
// Uses firebase `database` and chart globals defined in firebase-config.js and chart-config.js
// --------------------

// Add these variables at the top with other global variables
let lastDataTimestamp = 0;
let deviceStatusCheckInterval;
const DEVICE_TIMEOUT = 10000; // 10 seconds without data = offline

function setupDataListening() {
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  statusDot.className = 'status-dot connecting';
  statusText.textContent = 'Connecting to database...';

  // Monitor Firebase connection
  database.ref('.info/connected').on('value', function (connectedSnap) {
    if (connectedSnap.val() === true) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Connected to database';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Disconnected from database';
    }
  });

  // Load initial history and subscribe to new points
  loadHistoricalData();
  database.ref('patient/readings').orderByKey().limitToLast(1)
    .on('child_added', (snapshot) => processDataPoint(snapshot.val(), snapshot.key));
}

function loadHistoricalData() {
  database.ref('patient/readings').orderByKey().limitToLast(1000).once('value')
    .then((snapshot) => {
      allHistoricalData = [];
      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        allHistoricalData.push({
          key: childSnapshot.key,
          timestamp: data.timestamp,
          rh: data.rh || 0,
          lh: data.lh || 0,
          rt: data.rt || 0,
          lt: data.lt || 0,
          total: data.total || 0
        });
      });
      allHistoricalData.sort((a, b) => a.key.localeCompare(b.key));
      document.getElementById('data-points').textContent = allHistoricalData.length;
      updateChartData();
    })
    .catch((error) => {
      console.error("Error loading historical data:", error);
      document.getElementById('stats-info').textContent = 'Error loading data: ' + error.message;
    });
}

function processDataPoint(data, key) {
  if (!data) return;
  
  // Update the last data timestamp
  lastDataTimestamp = Date.now();

  const updateValue = (id, value) => {
    if (value !== undefined) {
      const el = document.getElementById(id);
      el.textContent = value.toFixed(1);
      el.classList.add('value-change');
      setTimeout(() => el.classList.remove('value-change'), 300);
    }
  };

  updateValue('rh-value', data.rh);
  updateValue('lh-value', data.lh);
  updateValue('rt-value', data.rt);
  updateValue('lt-value', data.lt);
  updateValue('total-value', data.total);

  const timestamp = data.timestamp || 'Unknown';
  document.getElementById('timestamp').textContent = timestamp;

  const newDataPoint = {
    key,
    timestamp,
    rh: data.rh || 0,
    lh: data.lh || 0,
    rt: data.rt || 0,
    lt: data.lt || 0,
    total: data.total || 0
  };
  allHistoricalData.push(newDataPoint);
  allHistoricalData.sort((a, b) => a.key.localeCompare(b.key));

  if (allHistoricalData.length > 1000) {
    allHistoricalData = allHistoricalData.slice(-1000);
  }

  document.getElementById('data-points').textContent = allHistoricalData.length;

  if (isAutoScroll) {
    panOffset = 0;
    updateChartData();
  }
}

function updateChartData() {
  if (allHistoricalData.length === 0) {
    document.getElementById('stats-info').textContent = 'Waiting for data...';
    return;
  }

  // Default behavior: show the latest window (chart-config.js manages currentDataWindow, panOffset)
  let start = Math.max(0, allHistoricalData.length - currentDataWindow - panOffset);
  let end = Math.min(allHistoricalData.length, start + currentDataWindow);
  if (end - start < currentDataWindow) start = Math.max(0, end - currentDataWindow);

  const displayData = allHistoricalData.slice(start, end);
  document.getElementById('stats-info').textContent =
    `Showing ${displayData.length} data points (${start}-${end}) ${isAutoScroll ? '(Live)' : '(Historical)'} | Zoom: ${zoomLevel.toFixed(1)}x`;

  weightChart.data.labels = displayData.map(item => item.timestamp);
  weightChart.data.datasets[0].data = displayData.map(item => item.total);
  weightChart.data.datasets[1].data = displayData.map(item => item.rh);
  weightChart.data.datasets[2].data = displayData.map(item => item.lh);
  weightChart.data.datasets[3].data = displayData.map(item => item.rt);
  weightChart.data.datasets[4].data = displayData.map(item => item.lt);

  const allValues = displayData.flatMap(item => [item.total, item.rh, item.lh, item.rt, item.lt]);
  weightChart.options.scales.y.suggestedMax = Math.max(...allValues, 10) * 1.1;
  weightChart.update('none');
}

function resetToLiveView() {
  isAutoScroll = true;
  panOffset = 0;
  currentDataWindow = 20;
  zoomLevel = 1;
  document.getElementById('time-window').value = currentDataWindow;
  updateChartData();
}

function loadOlderData() {
  if (isLoadingMoreData || allHistoricalData.length === 0) return;

  isLoadingMoreData = true;
  document.getElementById('loading-indicator').style.display = 'block';

  const oldestKey = allHistoricalData[0].key;
  const dataPointsToLoad = parseInt(document.getElementById('time-window').value) || 20;

  database.ref('patient/readings')
    .orderByKey()
    .endBefore(oldestKey)
    .limitToLast(dataPointsToLoad)
    .once('value')
    .then((snapshot) => {
      const newData = [];
      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        newData.push({
          key: childSnapshot.key,
          timestamp: data.timestamp,
          rh: data.rh || 0,
          lh: data.lh || 0,
          rt: data.rt || 0,
          lt: data.lt || 0,
          total: data.total || 0
        });
      });

      if (newData.length > 0) {
        allHistoricalData = newData.concat(allHistoricalData);
        document.getElementById('data-points').textContent = allHistoricalData.length;
        panOffset = allHistoricalData.length - newData.length;
        updateChartData();
      }

      isLoadingMoreData = false;
      document.getElementById('loading-indicator').style.display = 'none';
    })
    .catch((error) => {
      console.error("Error loading older data:", error);
      isLoadingMoreData = false;
      document.getElementById('loading-indicator').style.display = 'none';
    });
}

function handleChartScroll(event) {
  event.preventDefault();
  isAutoScroll = false;

  const chartCanvas = document.getElementById('weight-chart');
  const rect = chartCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;

  if (allHistoricalData.length > 0) {
    const dataPointsPerPixel = allHistoricalData.length / rect.width;
    zoomCenterIndex = Math.floor(x * dataPointsPerPixel);
  }

  const delta = Math.sign(event.deltaY);
  if (delta > 0) zoomChart(0.9, zoomCenterIndex);
  else zoomChart(1.1, zoomCenterIndex);
}

function zoomChart(scaleFactor, centerIndex = null) {
  if (centerIndex === null) {
    centerIndex = allHistoricalData.length - currentDataWindow / 2;
  }

  const newDataWindow = Math.max(5, Math.min(1000, Math.round(currentDataWindow * scaleFactor)));
  const centerPosition = allHistoricalData.length - panOffset - currentDataWindow / 2;
  panOffset = Math.max(0, Math.min(allHistoricalData.length - newDataWindow,
    allHistoricalData.length - centerPosition - newDataWindow / 2));

  currentDataWindow = newDataWindow;
  document.getElementById('time-window').value = currentDataWindow;
  zoomLevel = 1000 / currentDataWindow;
  updateChartData();
}

// Add this function to monitor device status
function monitorDeviceStatus() {
  const now = Date.now();
  const timeSinceLastUpdate = now - lastDataTimestamp;
  const deviceStatusDot = document.getElementById('device-status-dot');
  const deviceStatusText = document.getElementById('device-status-text');
  
  // Clear existing classes
  deviceStatusDot.classList.remove('device-live', 'device-stale', 'device-offline');
  
  if (timeSinceLastUpdate < 5000) { // Updated in last 5 seconds
    deviceStatusDot.classList.add('device-live');
    deviceStatusText.textContent = 'Device online';
  } else if (timeSinceLastUpdate < DEVICE_TIMEOUT) { // Updated in last 10 seconds
    deviceStatusDot.classList.add('device-stale');
    deviceStatusText.textContent = 'Device stale';
  } else { // No data for more than 10 seconds
    deviceStatusDot.classList.add('device-offline');
    deviceStatusText.textContent = 'Device offline';
  }
}

// Initialize device status monitoring when the app loads
function initializeDeviceMonitoring() {
  // Set initial status
  lastDataTimestamp = Date.now();
  monitorDeviceStatus();
  
  // Check status every second
  deviceStatusCheckInterval = setInterval(monitorDeviceStatus, 1000);
}

// ========== TARE COMMAND (copied/ported from your working monitor.html) ==========
function sendTareCommand() {
  const tareButton = document.getElementById('tare-button');
  const tareStatus = document.getElementById('tare-status');

  // Disable button to prevent repeated commands
  tareButton.disabled = true;
  tareButton.textContent = "TARING...";

  // Create a timestamp and send command object to RTDB
  const ts = Date.now();
  database.ref('commands/tare').set({
    command: "TARE",
    status: "pending",
    timestamp: ts
  })
  .then(() => {
    // Indicate pending state to user
    tareStatus.textContent = 'Tare command sent! Waiting for completion...';
    tareStatus.style.display = 'block';
    tareStatus.style.color = '#3498db'; // blue-ish pending

    // Listen for tare completion on commands/tare/status
    const tareStatusRef = database.ref('commands/tare/status');
    const listener = tareStatusRef.on('value', (snapshot) => {
      if (snapshot.val() === 'completed') {
        // Success — update UI
        tareStatus.textContent = 'Tare completed successfully!';
        tareStatus.style.color = '#27ae60';

        // Remove listener
        tareStatusRef.off('value', listener);

        // Reset button after a short delay
        setTimeout(() => {
          tareButton.disabled = false;
          tareButton.textContent = "TARE SCALES";
          tareStatus.style.display = 'none';
        }, 3000);
      }
    });

    // Timeout fallback (15s) — stop waiting and notify user
    setTimeout(() => {
      try {
        tareStatusRef.off('value', listener);
      } catch (e) {
        // ignore off() errors
      }
      if (tareButton.disabled) {
        tareStatus.textContent = 'Tare timeout! Please check device connection.';
        tareStatus.style.color = '#e74c3c';
        tareButton.disabled = false;
        tareButton.textContent = 'TARE SCALES';
        setTimeout(() => { tareStatus.style.display = 'none'; }, 3000);
      }
    }, 15000);
  })
  .catch((error) => {
    console.error('Error sending tare command:', error);
    tareStatus.textContent = 'Error sending tare command!';
    tareStatus.style.color = '#e74c3c';
    tareStatus.style.display = 'block';
    tareButton.disabled = false;
    tareButton.textContent = 'TARE SCALES';
    setTimeout(() => { tareStatus.style.display = 'none'; }, 3000);
  });
}
// ==============================================================================

// --------------------
// Event wiring
// --------------------
window.onload = function () {
  initChart();

  const chartCanvas = document.getElementById('weight-chart');

  // Wheel zoom
  chartCanvas.addEventListener('wheel', handleChartScroll);

  // Drag panning
  chartCanvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartPanOffset = panOffset;
    isAutoScroll = false;
    chartCanvas.style.cursor = 'grabbing';
  });

  chartCanvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dataPointsToPan = Math.round(dx / 15);
    panOffset = Math.max(0, Math.min(allHistoricalData.length - currentDataWindow, dragStartPanOffset + dataPointsToPan));
    updateChartData();
  });

  chartCanvas.addEventListener('mouseup', () => { isDragging = false; chartCanvas.style.cursor = 'default'; });
  chartCanvas.addEventListener('mouseleave', () => { isDragging = false; chartCanvas.style.cursor = 'default'; });

  // Time window input
  document.getElementById('time-window').addEventListener('input', function () {
    currentDataWindow = parseInt(this.value) || 20;
    panOffset = 0;
    isAutoScroll = true;
    zoomLevel = 1;
    updateChartData();
  });

  // Navigation & zoom buttons
  document.getElementById('live-view-button').addEventListener('click', resetToLiveView);
  document.getElementById('load-older-button').addEventListener('click', () => { isAutoScroll = false; loadOlderData(); });
  document.getElementById('view-newer-button').addEventListener('click', () => { isAutoScroll = false; panOffset = Math.max(0, panOffset - currentDataWindow); updateChartData(); });
  document.getElementById('zoom-in-button').addEventListener('click', () => zoomChart(0.8));
  document.getElementById('zoom-out-button').addEventListener('click', () => zoomChart(1.2));

  // Tare button listener (uses the exact working flow from your monitor.html)
  document.getElementById('tare-button').addEventListener('click', sendTareCommand);

  // Start device status monitoring
  initializeDeviceMonitoring();

  // Start listening to data
  setupDataListening();
};

// Clean up interval when page is unloaded
window.addEventListener('beforeunload', function() {
  if (deviceStatusCheckInterval) {
    clearInterval(deviceStatusCheckInterval);
  }
});