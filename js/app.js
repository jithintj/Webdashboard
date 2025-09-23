// --------------------

// js/app.js

// Handles real-time data, UI updates, zoom/pan, and controls

// Uses firebase `database` and chart globals defined in firebase-config.js and chart-config.js

// --------------------



// Global variables

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



  // Check if classifier function exists and send data to it

  if (typeof processDataForClassification === 'function') {

    processDataForClassification(data);

  }



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



// Monitor device status

function monitorDeviceStatus() {

  const now = Date.now();

  const timeSinceLastUpdate = now - lastDataTimestamp;

  const deviceStatusDot = document.getElementById('device-status-dot');

  const deviceStatusText = document.getElementById('device-status-text');

  

  // Remove all status classes

  deviceStatusDot.classList.remove('device-live', 'device-stale', 'device-offline');

  

  // If we've never received data (lastDataTimestamp is 0), show as offline

  if (lastDataTimestamp === 0) {

    deviceStatusDot.classList.add('device-offline');

    deviceStatusText.textContent = 'Device offline';

    return;

  }

  

  if (timeSinceLastUpdate < 5000) {

    deviceStatusDot.classList.add('device-live');

    deviceStatusText.textContent = 'Device online';

  } else if (timeSinceLastUpdate < DEVICE_TIMEOUT) {

    deviceStatusDot.classList.add('device-stale');

    deviceStatusText.textContent = 'Device stale';

  } else {

    deviceStatusDot.classList.add('device-offline');

    deviceStatusText.textContent = 'Device offline';

  }

}



function initializeDeviceMonitoring() {

  lastDataTimestamp = 0; // Set to 0 to indicate no data received yet

  // Start with offline status

  const deviceStatusDot = document.getElementById('device-status-dot');

  const deviceStatusText = document.getElementById('device-status-text');

  deviceStatusDot.className = 'status-dot device-offline';

  deviceStatusText.textContent = 'Device offline';

  

  // Start monitoring

  deviceStatusCheckInterval = setInterval(monitorDeviceStatus, 1000);

}



function sendTareCommand() {

  const tareButton = document.getElementById('tare-button');

  const tareStatus = document.getElementById('tare-status');



  tareButton.disabled = true;

  tareButton.textContent = "TARING...";



  const ts = Date.now();

  database.ref('commands/tare').set({

    command: "TARE",

    status: "pending",

    timestamp: ts

  })

  .then(() => {

    tareStatus.textContent = 'Tare command sent! Waiting for completion...';

    tareStatus.style.display = 'block';

    tareStatus.style.color = '#3498db';



    const tareStatusRef = database.ref('commands/tare/status');

    const listener = tareStatusRef.on('value', (snapshot) => {

      if (snapshot.val() === 'completed') {

        tareStatus.textContent = 'Tare completed successfully!';

        tareStatus.style.color = '#27ae60';



        tareStatusRef.off('value', listener);



        setTimeout(() => {

          tareButton.disabled = false;

          tareButton.textContent = "TARE SCALES";

          tareStatus.style.display = 'none';

        }, 3000);

      }

    });



    setTimeout(() => {

      try {

        tareStatusRef.off('value', listener);

      } catch (e) {}

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



// --------------------

// Event wiring

// --------------------

window.onload = function () {

  initChart();



  const chartCanvas = document.getElementById('weight-chart');



  chartCanvas.addEventListener('wheel', handleChartScroll);



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



  document.getElementById('time-window').addEventListener('input', function () {

    currentDataWindow = parseInt(this.value) || 20;

    panOffset = 0;

    isAutoScroll = true;

    zoomLevel = 1;

    updateChartData();

  });



  document.getElementById('live-view-button').addEventListener('click', resetToLiveView);

  document.getElementById('load-older-button').addEventListener('click', () => { isAutoScroll = false; loadOlderData(); });

  document.getElementById('view-newer-button').addEventListener('click', () => { isAutoScroll = false; panOffset = Math.max(0, panOffset - currentDataWindow); updateChartData(); });

  document.getElementById('zoom-in-button').addEventListener('click', () => zoomChart(0.8));

  document.getElementById('zoom-out-button').addEventListener('click', () => zoomChart(1.2));



  document.getElementById('tare-button').addEventListener('click', sendTareCommand);



  initializeDeviceMonitoring();

  setupDataListening();

};



window.addEventListener('beforeunload', function() {

  if (deviceStatusCheckInterval) {

    clearInterval(deviceStatusCheckInterval);

  }

});