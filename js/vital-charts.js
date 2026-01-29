// js/vital-charts.js
// Separate file for breathing and heart rate charts

let breathingChart, heartChart;
let brDataWindow = 20, hrDataWindow = 20;

// Initialize both charts
function initVitalCharts() {
    initBreathingChart();
    initHeartChart();
    setupVitalEventListeners();
}

function initBreathingChart() {
    const ctx = document.getElementById('breathing-chart').getContext('2d');
    breathingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Breathing Rate',
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52,152,219,0.1)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 1,
                fill: true
            }]
        },
        options: getVitalChartOptions('Breaths per Minute', 0, 30)
    });
}

function initHeartChart() {
    const ctx = document.getElementById('heart-chart').getContext('2d');
    heartChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Heart Rate',
                data: [],
                borderColor: '#e74c3c',
                backgroundColor: 'rgba(231,76,60,0.1)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 1,
                fill: true
            }]
        },
        options: getVitalChartOptions('Beats per Minute', 40, 120)
    });
}

function getVitalChartOptions(yAxisTitle, minY, maxY) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: false,
                grid: { color: 'rgba(0,0,0,0.08)' },
                title: { display: true, text: yAxisTitle },
                suggestedMin: minY,
                suggestedMax: maxY
            },
            x: {
                grid: { color: 'rgba(0,0,0,0.08)' },
                title: { display: true, text: 'Time' }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: { mode: 'index', intersect: false }
        },
        animation: { duration: 0 }
    };
}

// Update charts with new data
function updateVitalCharts(dataArray) {
    if (!dataArray || dataArray.length === 0) return;
    
    updateBreathingChart(dataArray);
    updateHeartChart(dataArray);
    updateCurrentReadings(dataArray);
}

function updateBreathingChart(dataArray) {
    const displayData = getDisplayData(dataArray, brDataWindow);
    breathingChart.data.labels = displayData.map(d => d.timestamp);
    breathingChart.data.datasets[0].data = displayData.map(d => d.br);
    breathingChart.update('none');
}

function updateHeartChart(dataArray) {
    const displayData = getDisplayData(dataArray, hrDataWindow);
    heartChart.data.labels = displayData.map(d => d.timestamp);
    heartChart.data.datasets[0].data = displayData.map(d => d.hr);
    heartChart.update('none');
}

function getDisplayData(dataArray, windowSize) {
    return dataArray.slice(-windowSize);
}

function updateCurrentReadings(dataArray) {
    if (dataArray.length === 0) return;
    
    const latest = dataArray[dataArray.length - 1];
    
    // Update breathing rate
    const brValue = document.getElementById('current-br-value');
    if (brValue) {
        brValue.textContent = latest.br.toFixed(1);
        updateVitalStatus('br', latest.br);
    }
    
    // Update heart rate
    const hrValue = document.getElementById('current-hr-value');
    if (hrValue) {
        hrValue.textContent = latest.hr.toFixed(1);
        updateVitalStatus('hr', latest.hr);
    }
}

function updateVitalStatus(type, value) {
    const element = document.getElementById(`current-${type}-value`);
    const card = document.getElementById(`${type}-current-card`);
    
    if (!element || !card) return;
    
    let statusClass = 'status-normal';
    
    if (type === 'br') {
        if (value > 25 || value < 8) statusClass = 'status-alert';
        else if (value > 20) statusClass = 'status-warning';
    } else if (type === 'hr') {
        if (value > 100 || value < 50) statusClass = 'status-alert';
        else if (value > 80) statusClass = 'status-warning';
    }
    
    element.className = `card-value ${statusClass}`;
    card.className = `reading-card ${statusClass}`;
}

// Event listeners for controls
function setupVitalEventListeners() {
    // Breathing rate controls
    document.getElementById('br-time-window')?.addEventListener('input', function() {
        brDataWindow = parseInt(this.value) || 20;
        if (typeof updateVitalCharts === 'function') {
            updateVitalCharts(window.allHistoricalData || []);
        }
    });
    
    document.getElementById('br-zoom-in')?.addEventListener('click', () => {
        brDataWindow = Math.max(5, Math.floor(brDataWindow * 0.8));
        document.getElementById('br-time-window').value = brDataWindow;
        updateVitalCharts(window.allHistoricalData || []);
    });
    
    document.getElementById('br-zoom-out')?.addEventListener('click', () => {
        brDataWindow = Math.min(1000, Math.floor(brDataWindow * 1.2));
        document.getElementById('br-time-window').value = brDataWindow;
        updateVitalCharts(window.allHistoricalData || []);
    });
    
    document.getElementById('br-live-view')?.addEventListener('click', () => {
        brDataWindow = 20;
        document.getElementById('br-time-window').value = brDataWindow;
        updateVitalCharts(window.allHistoricalData || []);
    });
    
    // Heart rate controls (similar pattern)
    document.getElementById('hr-time-window')?.addEventListener('input', function() {
        hrDataWindow = parseInt(this.value) || 20;
        updateVitalCharts(window.allHistoricalData || []);
    });
    
    document.getElementById('hr-zoom-in')?.addEventListener('click', () => {
        hrDataWindow = Math.max(5, Math.floor(hrDataWindow * 0.8));
        document.getElementById('hr-time-window').value = hrDataWindow;
        updateVitalCharts(window.allHistoricalData || []);
    });
    
    document.getElementById('hr-zoom-out')?.addEventListener('click', () => {
        hrDataWindow = Math.min(1000, Math.floor(hrDataWindow * 1.2));
        document.getElementById('hr-time-window').value = hrDataWindow;
        updateVitalCharts(window.allHistoricalData || []);
    });
    
    document.getElementById('hr-live-view')?.addEventListener('click', () => {
        hrDataWindow = 20;
        document.getElementById('hr-time-window').value = hrDataWindow;
        updateVitalCharts(window.allHistoricalData || []);
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initVitalCharts);