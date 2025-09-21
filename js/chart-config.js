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

function initChart() {
  const ctx = document.getElementById('weight-chart').getContext('2d');
  weightChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'Total Weight', data: [], borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', borderWidth: 3, tension: 0.3, pointRadius: 2 },
      { label: 'Right Head', data: [], borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', borderWidth: 2, tension: 0.3, pointRadius: 2 },
      { label: 'Left Head', data: [], borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,0.1)', borderWidth: 2, tension: 0.3, pointRadius: 2 },
      { label: 'Right Tail', data: [], borderColor: '#9b59b6', backgroundColor: 'rgba(155,89,182,0.1)', borderWidth: 2, tension: 0.3, pointRadius: 2 },
      { label: 'Left Tail', data: [], borderColor: '#f39c12', backgroundColor: 'rgba(243,156,18,0.1)', borderWidth: 2, tension: 0.3, pointRadius: 2 }
    ]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.08)' }, title: { display: true, text: 'Weight (grams)' } },
        x: { grid: { color: 'rgba(0,0,0,0.08)' }, title: { display: true, text: 'Time' } }
      },
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 0 }
    }
  });
}