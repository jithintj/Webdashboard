// js/classifier.js
// Sleep position classifier with visual feedback - Simplified to 6 positions

// Position to image mapping - Simplified
const POSITION_IMAGES = {
    "Straight Center": "pos_center.png",
    "Straight Left": "pos_left.png",
    "Straight Right": "pos_right.png",
    "Diagonal Left": "pos_diagonal_left.png",
    "Diagonal Right": "pos_diagonal_right.png",
    "Empty Bed": "pos_empty.png"
};

// Position history tracking
let positionHistory = [];
const MAX_HISTORY = 20;
let currentPosition = "Empty Bed";
let currentConfidence = 0;
let positionChangeTimer = null;

// DOM elements
let positionImageElement, positionHistoryElement, classificationStatusElement;

// Initialize classifier
function initClassifier() {
    // Create UI elements if they don't exist
    createClassifierUI();
    
    // Get references to DOM elements
    positionImageElement = document.getElementById('position-image');
    positionHistoryElement = document.getElementById('position-history');
    classificationStatusElement = document.getElementById('classification-status');
    
    // Set initial state
    updatePositionDisplay("Empty Bed", 0);
}

// Create the classifier UI elements
function createClassifierUI() {
    const chartContainer = document.querySelector('.chart-container');
    
    // Create classification section
    const classificationSection = document.createElement('div');
    classificationSection.className = 'classification-container';
    classificationSection.innerHTML = `
        <div class="classification-header">
            <h2 class="classification-title">Sleep Position Classification</h2>
            <div class="classification-status" id="classification-status">Analyzing...</div>
        </div>
        
        <div class="position-visualization">
            <div class="position-image-container">
                <img src="assets/pos_empty.png" alt="Sleep Position" id="position-image" class="position-image">
                <div class="position-confidence" id="position-confidence">0% confidence</div>
            </div>
            
            <div class="position-details">
                <div class="current-position" id="current-position">Empty Bed</div>
                <div class="position-history">
                    <h3>Recent Positions</h3>
                    <div id="position-history" class="history-timeline"></div>
                </div>
            </div>
        </div>
    `;
    
    // Insert after the chart container
    chartContainer.parentNode.insertBefore(classificationSection, chartContainer.nextSibling);
}

// Classify sleep position based on sensor data - Simplified to 6 positions
function classifySleepPosition(rh, lh, rt, lt, total) {
    // Check if bed is empty
    if (total < 50) {
        return { position: "Empty Bed", confidence: 95 };
    }
    
    // Calculate percentage distribution
    const rhPercent = (rh / total) * 100;
    const lhPercent = (lh / total) * 100;
    const rtPercent = (rt / total) * 100;
    const ltPercent = (lt / total) * 100;
    
    // Calculate aggregated values
    const leftTotal = lhPercent + ltPercent;
    const rightTotal = rhPercent + rtPercent;
    const leftRightRatio = leftTotal / rightTotal;
    
    // Calculate balance between head and tail
    const headTotal = rhPercent + lhPercent;
    const tailTotal = rtPercent + ltPercent;
    const headTailBalance = Math.abs(headTotal - tailTotal);
    
    // Check for movement/transition (high fluctuation)
    const sensorValues = [rh, lh, rt, lt];
    const maxVal = Math.max(...sensorValues);
    const minVal = Math.min(...sensorValues);
    const fluctuation = (maxVal - minVal) / total * 100;
    
    // If there's too much fluctuation, consider it transitioning
    if (fluctuation > 50) {
        // During transition, classify based on dominant side if clear
        if (leftRightRatio > 2) return { position: "Straight Left", confidence: 40 };
        if (leftRightRatio < 0.5) return { position: "Straight Right", confidence: 40 };
        return { position: "Straight Center", confidence: 30 };
    }
    
    // Classification logic for 6 positions
    
    // 1. Straight Center - balanced distribution
    if (leftRightRatio >= 0.7 && leftRightRatio <= 1.43 && headTailBalance < 25) {
        return { position: "Straight Center", confidence: calculateConfidence(rh, lh, rt, lt, total, "center") };
    }
    
    // 2. Straight Left - primarily on left side
    if (leftRightRatio > 2.5) {
        return { position: "Straight Left", confidence: calculateConfidence(rh, lh, rt, lt, total, "left") };
    }
    
    // 3. Straight Right - primarily on right side
    if (leftRightRatio < 0.4) {
        return { position: "Straight Right", confidence: calculateConfidence(rh, lh, rt, lt, total, "right") };
    }
    
    // 4. Diagonal Left - leaning left but not fully lateral
    if (leftRightRatio > 1.43 && leftRightRatio <= 2.5) {
        return { position: "Diagonal Left", confidence: calculateConfidence(rh, lh, rt, lt, total, "diagonal-left") };
    }
    
    // 5. Diagonal Right - leaning right but not fully lateral
    if (leftRightRatio >= 0.4 && leftRightRatio < 0.7) {
        return { position: "Diagonal Right", confidence: calculateConfidence(rh, lh, rt, lt, total, "diagonal-right") };
    }
    
    // Default to center if no clear pattern
    return { position: "Straight Center", confidence: 50 };
}

// Calculate confidence score for position classification
function calculateConfidence(rh, lh, rt, lt, total, positionType) {
    const rhPercent = (rh / total) * 100;
    const lhPercent = (lh / total) * 100;
    const rtPercent = (rt / total) * 100;
    const ltPercent = (lt / total) * 100;
    
    let expectedPattern = {};
    
    // Define expected patterns for each position type
    switch(positionType) {
        case "center":
            expectedPattern = {lh: 25, rh: 25, lt: 25, rt: 25, tolerance: 15};
            break;
        case "left":
            expectedPattern = {lh: 40, rh: 10, lt: 40, rt: 10, tolerance: 15};
            break;
        case "right":
            expectedPattern = {lh: 10, rh: 40, lt: 10, rt: 40, tolerance: 15};
            break;
        case "diagonal-left":
            expectedPattern = {lh: 35, rh: 15, lt: 35, rt: 15, tolerance: 18};
            break;
        case "diagonal-right":
            expectedPattern = {lh: 15, rh: 35, lt: 15, rt: 35, tolerance: 18};
            break;
        default:
            return 0;
    }
    
    // Calculate deviation from expected pattern
    const lhDev = Math.abs(lhPercent - expectedPattern.lh);
    const rhDev = Math.abs(rhPercent - expectedPattern.rh);
    const ltDev = Math.abs(ltPercent - expectedPattern.lt);
    const rtDev = Math.abs(rtPercent - expectedPattern.rt);
    
    const avgDev = (lhDev + rhDev + ltDev + rtDev) / 4;
    
    // Convert to confidence score (0-100%)
    const confidence = Math.max(30, 100 - (avgDev * 100 / expectedPattern.tolerance));
    return Math.min(100, Math.round(confidence));
}

// Update position display based on classification
function updatePositionDisplay(position, confidence) {
    // Update current position and confidence
    currentPosition = position;
    currentConfidence = confidence;
    
    // Update image
    if (positionImageElement) {
        const imagePath = `assets/${POSITION_IMAGES[position] || 'pos_empty.png'}`;
        positionImageElement.src = imagePath;
        positionImageElement.alt = position;
    }
    
    // Update confidence indicator
    const confidenceElement = document.getElementById('position-confidence');
    if (confidenceElement) {
        confidenceElement.textContent = `${confidence}% confidence`;
        
        // Color code based on confidence
        if (confidence > 80) {
            confidenceElement.style.color = '#27ae60'; // Green - high confidence
        } else if (confidence > 60) {
            confidenceElement.style.color = '#f39c12'; // Orange - medium confidence
        } else {
            confidenceElement.style.color = '#e74c3c'; // Red - low confidence
        }
    }
    
    // Update current position text
    const currentPositionElement = document.getElementById('current-position');
    if (currentPositionElement) {
        currentPositionElement.textContent = position;
    }
    
    // Add to history if position changed significantly
    addToPositionHistory(position, confidence);
}

// Add position to history with debouncing
function addToPositionHistory(position, confidence) {
    // Clear any existing timer
    if (positionChangeTimer) {
        clearTimeout(positionChangeTimer);
    }
    
    // Set a timer to debounce position changes (avoid flickering)
    positionChangeTimer = setTimeout(() => {
        const now = new Date();
        const timestamp = now.toLocaleTimeString();
        
        // Add to history if it's a new position or confidence changed significantly
        if (positionHistory.length === 0 || 
            positionHistory[positionHistory.length - 1].position !== position ||
            Math.abs(positionHistory[positionHistory.length - 1].confidence - confidence) > 20) {
            
            positionHistory.push({
                position,
                confidence,
                timestamp
            });
            
            // Keep history to max size
            if (positionHistory.length > MAX_HISTORY) {
                positionHistory.shift();
            }
            
            // Update history display
            updatePositionHistoryDisplay();
        }
    }, 1000); // Wait 1 second before registering position change
}

// Update the position history display
function updatePositionHistoryDisplay() {
    if (!positionHistoryElement) return;
    
    positionHistoryElement.innerHTML = '';
    
    positionHistory.slice().reverse().forEach(entry => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        historyItem.innerHTML = `
            <span class="history-time">${entry.timestamp}</span>
            <span class="history-position">${entry.position}</span>
            <span class="history-confidence">${entry.confidence}%</span>
        `;
        
        // Color code based on confidence
        if (entry.confidence > 80) {
            historyItem.style.borderLeft = '4px solid #27ae60';
        } else if (entry.confidence > 60) {
            historyItem.style.borderLeft = '4px solid #f39c12';
        } else {
            historyItem.style.borderLeft = '4px solid #e74c3c';
        }
        
        positionHistoryElement.appendChild(historyItem);
    });
}

// Process new data for classification
function processDataForClassification(data) {
    if (!data) return;
    
    // Check if device is online (receiving live data)
    const now = Date.now();
    const timeSinceLastUpdate = now - lastDataTimestamp;
    const isLive = timeSinceLastUpdate < 15000; // 15 seconds threshold for "live"
    
    // Update classification status
    if (classificationStatusElement) {
        if (isLive) {
            classificationStatusElement.textContent = 'Live classification';
            classificationStatusElement.style.color = '#27ae60';
        } else {
            classificationStatusElement.textContent = 'Historical data analysis';
            classificationStatusElement.style.color = '#7f8c8d';
        }
    }
    
    // Classify position
    const { position, confidence } = classifySleepPosition(
        data.rh, data.lh, data.rt, data.lt, data.total
    );
    
    updatePositionDisplay(position, confidence);
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', initClassifier);