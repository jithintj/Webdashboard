// --------------------
// js/app.js - OPTIMIZED
// Handles real-time data, UI updates, zoom/pan, and controls
// Simplified device status: only online/offline with 5-second timeout using icons
// --------------------

// Global variables
let lastDataTimestamp = 0;
let deviceStatusCheckInterval;
const DEVICE_TIMEOUT = 5000; // 5 seconds
let deviceStatusStartupComplete = false;

// Simplified device status management - removed STALE
const DeviceStatus = {
    UNKNOWN: 'unknown',
    LIVE: 'live',
    OFFLINE: 'offline'
};

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
                allHistoricalData.push(createDataPoint(childSnapshot.key, data));
            });
            allHistoricalData.sort((a, b) => a.key.localeCompare(b.key));
            updateDataPointsCount();
            updateChartData();
        })
        .catch(handleDataError);
}

// Consolidated data point creation
function createDataPoint(key, data) {
    return {
        key: key,
        timestamp: data.timestamp || 'Unknown',
        rh: data.rh || 0,
        lh: data.lh || 0,
        rt: data.rt || 0,
        lt: data.lt || 0,
        total: data.total || 0
    };
}

function processDataPoint(data, key) {
    if (!data) return;
    
    // Update the last data timestamp for device monitoring
    lastDataTimestamp = Date.now();

    // Update UI values
    updateSensorValues(data);
    
    // Update timestamp
    const timestamp = data.timestamp || 'Unknown';
    document.getElementById('timestamp').textContent = timestamp;

    // Send to classifier if available
    if (typeof processDataForClassification === 'function') {
        processDataForClassification(data);
    }

    // Add to historical data
    const newDataPoint = createDataPoint(key, data);
    allHistoricalData.push(newDataPoint);
    
    // Maintain data limit and sort
    if (allHistoricalData.length > 1000) {
        allHistoricalData = allHistoricalData.slice(-1000);
    }
    allHistoricalData.sort((a, b) => a.key.localeCompare(b.key));

    updateDataPointsCount();

    if (isAutoScroll) {
        panOffset = 0;
        updateChartData();
    }
}

// Consolidated UI value updates
function updateSensorValues(data) {
    const sensors = [
        { id: 'rh-value', value: data.rh },
        { id: 'lh-value', value: data.lh },
        { id: 'rt-value', value: data.rt },
        { id: 'lt-value', value: data.lt },
        { id: 'total-value', value: data.total }
    ];

    sensors.forEach(sensor => {
        if (sensor.value !== undefined) {
            const element = document.getElementById(sensor.id);
            element.textContent = sensor.value.toFixed(1);
            element.classList.add('value-change');
            setTimeout(() => element.classList.remove('value-change'), 300);
        }
    });
}

function updateDataPointsCount() {
    document.getElementById('data-points').textContent = allHistoricalData.length;
}

function updateChartData() {
    if (allHistoricalData.length === 0) {
        document.getElementById('stats-info').textContent = 'Waiting for data...';
        return;
    }

    const displayData = getDisplayData();
    document.getElementById('stats-info').textContent =
        `Showing ${displayData.length} data points ${isAutoScroll ? '(Live)' : '(Historical)'} | Zoom: ${zoomLevel.toFixed(1)}x`;

    updateChartDataset(displayData);
    updateChartYAxis(displayData);
    weightChart.update('none');
}

function getDisplayData() {
    let start = Math.max(0, allHistoricalData.length - currentDataWindow - panOffset);
    let end = Math.min(allHistoricalData.length, start + currentDataWindow);
    if (end - start < currentDataWindow) {
        start = Math.max(0, end - currentDataWindow);
    }
    return allHistoricalData.slice(start, end);
}

function updateChartDataset(displayData) {
    weightChart.data.labels = displayData.map(item => item.timestamp);
    
    const datasets = [
        { index: 0, key: 'total' },
        { index: 1, key: 'rh' },
        { index: 2, key: 'lh' },
        { index: 3, key: 'rt' },
        { index: 4, key: 'lt' }
    ];

    datasets.forEach(dataset => {
        weightChart.data.datasets[dataset.index].data = displayData.map(item => item[dataset.key]);
    });
}

function updateChartYAxis(displayData) {
    const allValues = displayData.flatMap(item => [item.total, item.rh, item.lh, item.rt, item.lt]);
    weightChart.options.scales.y.suggestedMax = Math.max(...allValues, 10) * 1.1;
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
                newData.push(createDataPoint(childSnapshot.key, childSnapshot.val()));
            });

            if (newData.length > 0) {
                allHistoricalData = newData.concat(allHistoricalData);
                updateDataPointsCount();
                panOffset = allHistoricalData.length - newData.length;
                updateChartData();
            }

            isLoadingMoreData = false;
            document.getElementById('loading-indicator').style.display = 'none';
        })
        .catch((error) => {
            handleDataError(error);
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
    zoomChart(delta > 0 ? 0.9 : 1.1, zoomCenterIndex);
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

// Simplified device status monitoring - removed stale condition
function getDeviceStatus() {
    if (!deviceStatusStartupComplete) {
        return DeviceStatus.UNKNOWN;
    }
    
    if (lastDataTimestamp === 0) {
        return DeviceStatus.OFFLINE;
    }
    
    const timeSinceLastUpdate = Date.now() - lastDataTimestamp;
    
    // Simplified: only check if within 5 seconds for live, otherwise offline
    if (timeSinceLastUpdate < DEVICE_TIMEOUT) {
        return DeviceStatus.LIVE;
    } else {
        return DeviceStatus.OFFLINE;
    }
}

function monitorDeviceStatus() {
    const deviceStatusIcon = document.getElementById('device-status-icon');
    
    if (!deviceStatusIcon) return;
    
    const status = getDeviceStatus();
    
    // Switch between device icons based on status
    switch(status) {
        case DeviceStatus.LIVE:
            deviceStatusIcon.src = 'assets/device_online.png';
            deviceStatusIcon.alt = 'Device Online';
            break;
        case DeviceStatus.OFFLINE:
        case DeviceStatus.UNKNOWN:
        default:
            deviceStatusIcon.src = 'assets/device_offline.png';
            deviceStatusIcon.alt = 'Device Offline';
            break;
    }
}

function initializeDeviceMonitoring() {
    lastDataTimestamp = 0;
    deviceStatusStartupComplete = false;
    
    const deviceStatusIcon = document.getElementById('device-status-icon');
    if (deviceStatusIcon) {
        deviceStatusIcon.src = 'assets/device_offline.png';
        deviceStatusIcon.alt = 'Device Offline';
    }
    
    // Changed timeout to match DEVICE_TIMEOUT (5 seconds)
    setTimeout(() => {
        deviceStatusStartupComplete = true;
    }, DEVICE_TIMEOUT);
    
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
                handleTareCompletion(tareButton, tareStatus, listener);
            }
        });

        setTimeout(() => {
            try {
                tareStatusRef.off('value', listener);
            } catch (e) {}
            if (tareButton.disabled) {
                handleTareTimeout(tareButton, tareStatus);
            }
        }, 15000);
    })
    .catch((error) => {
        handleTareError(error, tareButton, tareStatus);
    });
}

function handleTareCompletion(tareButton, tareStatus, listener) {
    tareStatus.textContent = 'Tare completed successfully!';
    tareStatus.style.color = '#27ae60';
    
    if (listener) {
        database.ref('commands/tare/status').off('value', listener);
    }
    
    setTimeout(() => {
        tareButton.disabled = false;
        tareButton.textContent = "TARE SCALES";
        tareStatus.style.display = 'none';
    }, 3000);
}

function handleTareTimeout(tareButton, tareStatus) {
    tareStatus.textContent = 'Tare timeout! Please check device connection.';
    tareStatus.style.color = '#e74c3c';
    tareButton.disabled = false;
    tareButton.textContent = 'TARE SCALES';
    setTimeout(() => { tareStatus.style.display = 'none'; }, 3000);
}

function handleTareError(error, tareButton, tareStatus) {
    console.error('Error sending tare command:', error);
    tareStatus.textContent = 'Error sending tare command!';
    tareStatus.style.color = '#e74c3c';
    tareStatus.style.display = 'block';
    tareButton.disabled = false;
    tareButton.textContent = 'TARE SCALES';
    setTimeout(() => { tareStatus.style.display = 'none'; }, 3000);
}

function handleDataError(error) {
    console.error("Data error:", error);
    document.getElementById('stats-info').textContent = 'Error: ' + error.message;
}

// --------------------
// Event wiring
// --------------------

window.onload = function () {
    initChart();

    const chartCanvas = document.getElementById('weight-chart');

    // Consolidated event listeners
    const eventConfig = [
        { element: chartCanvas, event: 'wheel', handler: handleChartScroll },
        { element: chartCanvas, event: 'mousedown', handler: (e) => {
            isDragging = true;
            dragStartX = e.clientX;
            dragStartPanOffset = panOffset;
            isAutoScroll = false;
            chartCanvas.style.cursor = 'grabbing';
        }},
        { element: chartCanvas, event: 'mousemove', handler: (e) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartX;
            const dataPointsToPan = Math.round(dx / 15);
            panOffset = Math.max(0, Math.min(allHistoricalData.length - currentDataWindow, dragStartPanOffset + dataPointsToPan));
            updateChartData();
        }},
        { element: chartCanvas, event: 'mouseup', handler: () => { 
            isDragging = false; 
            chartCanvas.style.cursor = 'default'; 
        }},
        { element: chartCanvas, event: 'mouseleave', handler: () => { 
            isDragging = false; 
            chartCanvas.style.cursor = 'default'; 
        }},
        { element: 'time-window', event: 'input', handler: function () {
            currentDataWindow = parseInt(this.value) || 20;
            panOffset = 0;
            isAutoScroll = true;
            zoomLevel = 1;
            updateChartData();
        }},
        { element: 'live-view-button', event: 'click', handler: resetToLiveView },
        { element: 'load-older-button', event: 'click', handler: () => { 
            isAutoScroll = false; 
            loadOlderData(); 
        }},
        { element: 'view-newer-button', event: 'click', handler: () => { 
            isAutoScroll = false; 
            panOffset = Math.max(0, panOffset - currentDataWindow); 
            updateChartData(); 
        }},
        { element: 'zoom-in-button', event: 'click', handler: () => zoomChart(0.8) },
        { element: 'zoom-out-button', event: 'click', handler: () => zoomChart(1.2) },
        { element: 'tare-button', event: 'click', handler: sendTareCommand }
    ];

    eventConfig.forEach(config => {
        const element = typeof config.element === 'string' ? 
            document.getElementById(config.element) : config.element;
        if (element) {
            element.addEventListener(config.event, config.handler);
        }
    });

    initializeDeviceMonitoring();
    setupDataListening();
};

window.addEventListener('beforeunload', function() {
    if (deviceStatusCheckInterval) {
        clearInterval(deviceStatusCheckInterval);
    }
});