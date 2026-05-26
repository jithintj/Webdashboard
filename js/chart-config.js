// Chart initialization and related functions
let weightChart;
let allHistoricalData = [];
let currentDataWindow = 20;
let isAutoScroll = true;
let panOffset = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartPanOffset = 0;
let isLoadingMoreData = false;
let zoomLevel = 1;
let zoomCenterIndex = 0;

// NEW: Separate HR and BR chart variables
let hrChart;
let brChart;
let hrDataWindow = 20;
let brDataWindow = 20;
let hrPanOffset = 0;
let brPanOffset = 0;

function initChart() {
  const ctx = document.getElementById('weight-chart').getContext('2d');
  weightChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'Right Head', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', borderWidth: 2, tension: 0.3, pointRadius: 2 },
      { label: 'Left Head', data: [], borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)', borderWidth: 2, tension: 0.3, pointRadius: 2 },
      { label: 'Right Tail', data: [], borderColor: '#9b59b6', backgroundColor: 'rgba(155,89,182,0.1)', borderWidth: 2, tension: 0.3, pointRadius: 2 },
      { label: 'Left Tail', data: [], borderColor: '#f39c12', backgroundColor: 'rgba(243,156,18,0.1)', borderWidth: 2, tension: 0.3, pointRadius: 2 }
    ]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.08)' }, title: { display: true, text: 'Weight (Kg)' } },
        x: { grid: { color: 'rgba(0,0,0,0.08)' }, title: { display: true, text: 'Time' } }
      },
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 0 }
    }
  });
}

// NEW: Heart Rate Chart Initialization
function initHRChart() {
  const ctx = document.getElementById('hr-chart').getContext('2d');
  hrChart = new Chart(ctx, {
    type: 'line',
    data: { 
      labels: [], 
      datasets: [
        { 
          label: 'Heart Rate', 
          data: [], 
          borderColor: '#e91e63', 
          backgroundColor: 'rgba(233,30,99,0.1)', 
          borderWidth: 3, 
          tension: 0.3, 
          pointRadius: 2 
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { 
          // FIX: beginAtZero set to false for HR — real HR values are 40–120 BPM,
          // starting from 0 compresses the chart and makes variation hard to see.
          // suggestedMin: 40 provides a sensible baseline for heart rate data.
          beginAtZero: false,
          suggestedMin: 40,
          grid: { color: 'rgba(0,0,0,0.08)' }, 
          title: { display: true, text: 'Heart Rate (BPM)' } 
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
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 0 }
    }
  });
}

// NEW: Breathing Rate Chart Initialization
function initBRChart() {
  const ctx = document.getElementById('br-chart').getContext('2d');
  brChart = new Chart(ctx, {
    type: 'line',
    data: { 
      labels: [], 
      datasets: [
        { 
          label: 'Breathing Rate', 
          data: [], 
          borderColor: '#00bcd4', 
          backgroundColor: 'rgba(0,188,212,0.1)', 
          borderWidth: 3, 
          tension: 0.3, 
          pointRadius: 2 
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: 'rgba(0,0,0,0.08)' }, 
          title: { display: true, text: 'Breathing Rate (BRPM)' } 
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
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 0 }
    }
  });
}