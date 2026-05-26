// --------------------
// js/app.js - OPTIMIZED
// Handles real-time data, UI updates, zoom/pan, and controls
// Simplified device status: only online/offline with 5-second timeout using icons
// Updated database connection status to use icons instead of text
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


// --------------------
// DATA LISTENING AND MANAGEMENT
// --------------------

function setupDataListening() {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const databaseStatusIcon = document.getElementById('database-status-icon');

    // Hide the original text-based status elements
    statusDot.style.display = 'none';
    statusText.style.display = 'none';

    // Monitor Firebase connection and update database status icon
    database.ref('.info/connected').on('value', function (connectedSnap) {
        if (connectedSnap.val() === true) {
            databaseStatusIcon.src = 'assets/db_connected.png';
            databaseStatusIcon.alt = 'Database Connected';
        } else {
            databaseStatusIcon.src = 'assets/db_disconnected.png';
            databaseStatusIcon.alt = 'Database Disconnected';
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
            updateHRChartData();    // NEW
            updateBRChartData();    // NEW
        })
        .catch(handleDataError);
}


// Consolidated data point creation - UPDATED
function createDataPoint(key, data) {
    return {
        key: key,
        timestamp: data.timestamp || 'Unknown',
        rh: data.rh || 0,
        lh: data.lh || 0,
        rt: data.rt || 0,
        lt: data.lt || 0,
        total: data.total || 0,
        hr: data.hr || 0,  // NEW: Heart rate
        br: data.br || 0   // NEW: Breathing rate
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
        hrPanOffset = 0;  // NEW
        brPanOffset = 0;  // NEW
        updateChartData();
        updateHRChartData();  // NEW
        updateBRChartData();  // NEW
    }
}


// --------------------
// UI UPDATE FUNCTIONS
// --------------------

// Consolidated UI value updates - UPDATED
function updateSensorValues(data) {
    const sensors = [
        { id: 'rh-value', value: data.rh },
        { id: 'lh-value', value: data.lh },
        { id: 'rt-value', value: data.rt },
        { id: 'lt-value', value: data.lt },
        { id: 'total-value', value: data.total },
        { id: 'hr-value', value: data.hr },  // NEW
        { id: 'br-value', value: data.br }   // NEW
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
        { index: 0, key: 'rh' },
        { index: 1, key: 'lh' },
        { index: 2, key: 'rt' },
        { index: 3, key: 'lt' }
    ];

    datasets.forEach(dataset => {
        weightChart.data.datasets[dataset.index].data = displayData.map(item => item[dataset.key]);
    });
}


function updateChartYAxis(displayData) {
    const allValues = displayData.flatMap(item => [item.rh, item.lh, item.rt, item.lt]);
    weightChart.options.scales.y.suggestedMax = Math.max(...allValues, 10) * 1.1;
}


// --------------------
// HR/BR CHART FUNCTIONS - NEW SECTION
// --------------------

function getHRDisplayData() {
    let start = Math.max(0, allHistoricalData.length - hrDataWindow - hrPanOffset);
    let end = Math.min(allHistoricalData.length, start + hrDataWindow);
    
    if (end - start < hrDataWindow) {
        start = Math.max(0, end - hrDataWindow);
    }
    
    return allHistoricalData.slice(start, end);
}

function getBRDisplayData() {
    let start = Math.max(0, allHistoricalData.length - brDataWindow - brPanOffset);
    let end = Math.min(allHistoricalData.length, start + brDataWindow);
    
    if (end - start < brDataWindow) {
        start = Math.max(0, end - brDataWindow);
    }
    
    return allHistoricalData.slice(start, end);
}

function updateHRChartData() {
    if (allHistoricalData.length === 0 || !hrChart) return;
    
    const displayData = getHRDisplayData();
    
    hrChart.data.labels = displayData.map(item => item.timestamp);
    hrChart.data.datasets[0].data = displayData.map(item => item.hr);
    
    // Update Y-axis scale
    const allValues = displayData.map(item => item.hr);
    hrChart.options.scales.y.suggestedMax = Math.max(...allValues, 10) * 1.1;
    
    hrChart.update('none');
}

function updateBRChartData() {
    if (allHistoricalData.length === 0 || !brChart) return;
    
    const displayData = getBRDisplayData();
    
    brChart.data.labels = displayData.map(item => item.timestamp);
    brChart.data.datasets[0].data = displayData.map(item => item.br);
    
    // Update Y-axis scale
    const allValues = displayData.map(item => item.br);
    brChart.options.scales.y.suggestedMax = Math.max(...allValues, 10) * 1.1;
    
    brChart.update('none');
}

function resetHRToLiveView() {
    hrPanOffset = 0;
    hrDataWindow = 20;
    document.getElementById('hr-time-window').value = hrDataWindow;
    updateHRChartData();
}

function resetBRToLiveView() {
    brPanOffset = 0;
    brDataWindow = 20;
    document.getElementById('br-time-window').value = brDataWindow;
    updateBRChartData();
}


// --------------------
// CHART NAVIGATION AND ZOOM
// --------------------

function resetToLiveView() {
    isAutoScroll = true;
    panOffset = 0;
    hrPanOffset = 0;  // NEW
    brPanOffset = 0;  // NEW
    currentDataWindow = 20;
    zoomLevel = 1;
    document.getElementById('time-window').value = currentDataWindow;
    updateChartData();
    updateHRChartData();  // NEW
    updateBRChartData();  // NEW
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
                hrPanOffset = panOffset;  // NEW
                brPanOffset = panOffset;  // NEW
                updateChartData();
                updateHRChartData();  // NEW
                updateBRChartData();  // NEW
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
    
    hrPanOffset = panOffset;  // NEW
    brPanOffset = panOffset;  // NEW

    currentDataWindow = newDataWindow;
    document.getElementById('time-window').value = currentDataWindow;
    zoomLevel = 1000 / currentDataWindow;
    updateChartData();
    updateHRChartData();  // NEW
    updateBRChartData();  // NEW
}


// --------------------
// DEVICE STATUS MONITORING
// --------------------

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


// --------------------
// TARE COMMAND HANDLING
// --------------------

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
        tareButton.textContent = "TARE BED";
        tareStatus.style.display = 'none';
    }, 3000);
}


function handleTareTimeout(tareButton, tareStatus) {
    tareStatus.textContent = 'Tare timeout! Please check device connection.';
    tareStatus.style.color = '#e74c3c';
    tareButton.disabled = false;
    tareButton.textContent = 'TARE BED';
    setTimeout(() => { tareStatus.style.display = 'none'; }, 3000);
}


function handleTareError(error, tareButton, tareStatus) {
    console.error('Error sending tare command:', error);
    tareStatus.textContent = 'Error sending tare command!';
    tareStatus.style.color = '#e74c3c';
    tareStatus.style.display = 'block';
    tareButton.disabled = false;
    tareButton.textContent = 'TARE BED';
    setTimeout(() => { tareStatus.style.display = 'none'; }, 3000);
}


// --------------------
// ERROR HANDLING
// --------------------

function handleDataError(error) {
    console.error("Data error:", error);
    document.getElementById('stats-info').textContent = 'Error: ' + error.message;
}


// --------------------
// EVENT WIRING
// --------------------

window.onload = function () {
    initChart();
    initHRChart();  // NEW
    initBRChart();  // NEW

    const chartCanvas = document.getElementById('weight-chart');

    // Consolidated event listeners
    const eventConfig = [
        { 
            element: chartCanvas, 
            event: 'wheel', 
            handler: handleChartScroll 
        },
        { 
            element: chartCanvas, 
            event: 'mousedown', 
            handler: (e) => {
                isDragging = true;
                dragStartX = e.clientX;
                dragStartPanOffset = panOffset;
                isAutoScroll = false;
                chartCanvas.style.cursor = 'grabbing';
            }
        },
        { 
            element: chartCanvas, 
            event: 'mousemove', 
            handler: (e) => {
                if (!isDragging) return;
                const dx = e.clientX - dragStartX;
                const dataPointsToPan = Math.round(dx / 15);
                panOffset = Math.max(0, Math.min(allHistoricalData.length - currentDataWindow, 
                    dragStartPanOffset + dataPointsToPan));
                hrPanOffset = panOffset;  // NEW
                brPanOffset = panOffset;  // NEW
                updateChartData();
                updateHRChartData();  // NEW
                updateBRChartData();  // NEW
            }
        },
        { 
            element: chartCanvas, 
            event: 'mouseup', 
            handler: () => { 
                isDragging = false; 
                chartCanvas.style.cursor = 'default'; 
            }
        },
        { 
            element: chartCanvas, 
            event: 'mouseleave', 
            handler: () => { 
                isDragging = false; 
                chartCanvas.style.cursor = 'default'; 
            }
        },
        { 
            element: 'time-window', 
            event: 'input', 
            handler: function () {
                currentDataWindow = parseInt(this.value) || 20;
                panOffset = 0;
                hrPanOffset = 0;  // NEW
                brPanOffset = 0;  // NEW
                isAutoScroll = true;
                zoomLevel = 1;
                updateChartData();
                updateHRChartData();  // NEW
                updateBRChartData();  // NEW
            }
        },
        // NEW: HR time window control
        { 
            element: 'hr-time-window', 
            event: 'input', 
            handler: function () {
                hrDataWindow = parseInt(this.value) || 20;
                hrPanOffset = 0;
                updateHRChartData();
            }
        },
        // NEW: BR time window control
        { 
            element: 'br-time-window', 
            event: 'input', 
            handler: function () {
                brDataWindow = parseInt(this.value) || 20;
                brPanOffset = 0;
                updateBRChartData();
            }
        },
        { 
            element: 'live-view-button', 
            event: 'click', 
            handler: resetToLiveView 
        },
        { 
            element: 'load-older-button', 
            event: 'click', 
            handler: () => { 
                isAutoScroll = false; 
                loadOlderData(); 
            }
        },
        { 
            element: 'view-newer-button', 
            event: 'click', 
            handler: () => { 
                isAutoScroll = false; 
                panOffset = Math.max(0, panOffset - currentDataWindow); 
                hrPanOffset = panOffset;  // NEW
                brPanOffset = panOffset;  // NEW
                updateChartData();
                updateHRChartData();  // NEW
                updateBRChartData();  // NEW
            }
        },
        { 
            element: 'zoom-in-button', 
            event: 'click', 
            handler: () => zoomChart(0.8) 
        },
        { 
            element: 'zoom-out-button', 
            event: 'click', 
            handler: () => zoomChart(1.2) 
        },
        { 
            element: 'tare-button', 
            event: 'click', 
            handler: sendTareCommand 
        }
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