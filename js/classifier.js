// js/classifier.js
// Sleep position classifier with visual feedback - Improved classification logic

// Position to image mapping
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
    
    // Initially hide the classification section until device comes online
    toggleClassificationSection(false);
}

// Create the classifier UI elements
function createClassifierUI() {
    const chartContainer = document.querySelector('.chart-container');
    
    // Create classification section
    const classificationSection = document.createElement('div');
    classificationSection.className = 'classification-container';
    classificationSection.id = 'classification-container';
    classificationSection.innerHTML = `
        <div class="classification-header">
            <h2 class="classification-title">Sleep Position Classification</h2>
            <div class="classification-status" id="classification-status">Waiting for device...</div>
        </div>
        
        <div class="position-visualization">
            <div class="position-image-container">
                <img src="assets/pos_empty.png" alt="Sleep Position" id="position-image" class="position-image">
                <div class="position-confidence" id="position-confidence">0% confidence</div>
            </div>
            
            <div class="position-details">
                <div class="current-position" id="current-position">Empty Bed</div>
                <div class="position-debug" id="position-debug"></div>
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

// Show or hide the entire classification section based on device status
function toggleClassificationSection(show) {
    const classificationContainer = document.getElementById('classification-container');
    if (classificationContainer) {
        classificationContainer.style.display = show ? 'block' : 'none';
    }
}

// Check if device is online by looking at device status
function isDeviceOnline() {
    const deviceStatusDot = document.getElementById('device-status-dot');
    if (!deviceStatusDot) return false;
    
    return deviceStatusDot.classList.contains('device-live');
}

// Improved sleep position classification with better logic
function classifySleepPosition(rh, lh, rt, lt, total) {
    // Check if bed is empty
    if (total < 500) {
        return { position: "Empty Bed", confidence: 95, debug: "Total pressure too low" };
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
    const leftRightDiff = Math.abs(leftTotal - rightTotal);
    
    // Calculate head vs tail distribution
    const headTotal = rhPercent + lhPercent;
    const tailTotal = rtPercent + ltPercent;
    const headTailRatio = headTotal / tailTotal;
    const headTailDiff = Math.abs(headTotal - tailTotal);
    
    // Calculate cross-diagonal patterns
    const leftHeadRightTail = lhPercent + rtPercent; // LH + RT
    const rightHeadLeftTail = rhPercent + ltPercent; // RH + LT
    const diagonalDiff = Math.abs(leftHeadRightTail - rightHeadLeftTail);
    
    // Debug information
    let debugInfo = `L/R: ${leftRightRatio.toFixed(2)}, H/T: ${headTailRatio.toFixed(2)}, LR-Diff: ${leftRightDiff.toFixed(1)}%`;
    
    // Check for movement/transition (high fluctuation)
    const sensorValues = [rh, lh, rt, lt];
    const maxVal = Math.max(...sensorValues);
    const minVal = Math.min(...sensorValues);
    const fluctuation = (maxVal - minVal) / total * 100;
    
    // Improved classification logic with more nuanced thresholds
    
    // 1. Empty bed check (already done above)
    
    // 2. Strong left side preference (Straight Left)
    if (leftRightRatio > 2.0 && leftRightDiff > 30) {
        return { 
            position: "Straight Left", 
            confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, "left"),
            debug: debugInfo + ", Strong left bias"
        };
    }
    
    // 3. Strong right side preference (Straight Right)  
    if (leftRightRatio < 0.5 && leftRightDiff > 30) {
        return { 
            position: "Straight Right", 
            confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, "right"),
            debug: debugInfo + ", Strong right bias"
        };
    }
    
    // 4. Check for diagonal patterns using head sensor dominance
    const headSensorDominance = Math.abs(rhPercent - lhPercent);
    const isHeadDominant = headTotal > tailTotal + 10; // Head sensors have 10%+ more pressure
    
    // Diagonal Right - Right head sensor is significantly higher than left head
    if (rhPercent > lhPercent + 8 && headSensorDominance > 8 && leftRightRatio >= 0.6 && leftRightRatio <= 1.4) {
        return { 
            position: "Diagonal Right", 
            confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, "diagonal-right"),
            debug: debugInfo + `, RH dominant: ${rhPercent.toFixed(1)}% vs LH: ${lhPercent.toFixed(1)}%`
        };
    }
    
    // Diagonal Left - Left head sensor is significantly higher than right head  
    if (lhPercent > rhPercent + 8 && headSensorDominance > 8 && leftRightRatio >= 0.7 && leftRightRatio <= 1.67) {
        return { 
            position: "Diagonal Left", 
            confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, "diagonal-left"),
            debug: debugInfo + `, LH dominant: ${lhPercent.toFixed(1)}% vs RH: ${rhPercent.toFixed(1)}%`
        };
    }
    
    // 5. Moderate left preference (could be diagonal left or straight left)
    if (leftRightRatio > 1.2 && leftRightRatio <= 2.0) {
        // If head sensors show imbalance, it's diagonal
        if (headSensorDominance > 5) {
            const position = lhPercent > rhPercent ? "Diagonal Left" : "Diagonal Right";
            return { 
                position, 
                confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, position.toLowerCase().replace(" ", "-")),
                debug: debugInfo + ", Moderate left + head imbalance"
            };
        } else {
            return { 
                position: "Straight Left", 
                confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, "left"),
                debug: debugInfo + ", Moderate left preference"
            };
        }
    }
    
    // 6. Moderate right preference  
    if (leftRightRatio < 0.8 && leftRightRatio >= 0.5) {
        // If head sensors show imbalance, it's diagonal
        if (headSensorDominance > 5) {
            const position = rhPercent > lhPercent ? "Diagonal Right" : "Diagonal Left";
            return { 
                position, 
                confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, position.toLowerCase().replace(" ", "-")),
                debug: debugInfo + ", Moderate right + head imbalance"
            };
        } else {
            return { 
                position: "Straight Right", 
                confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, "right"),
                debug: debugInfo + ", Moderate right preference"
            };
        }
    }
    
    // 7. Balanced distribution - check for subtle diagonal patterns
    if (leftRightRatio >= 0.8 && leftRightRatio <= 1.2) {
        // Even with balanced left/right, check head sensor imbalance for diagonal detection
        if (headSensorDominance > 6) {
            if (rhPercent > lhPercent) {
                return { 
                    position: "Diagonal Right", 
                    confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, "diagonal-right"),
                    debug: debugInfo + ", Balanced L/R but RH > LH"
                };
            } else {
                return { 
                    position: "Diagonal Left", 
                    confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, "diagonal-left"),
                    debug: debugInfo + ", Balanced L/R but LH > RH"
                };
            }
        }
        
        // True center position - all sensors relatively balanced
        return { 
            position: "Straight Center", 
            confidence: calculateImprovedConfidence(rh, lh, rt, lt, total, "center"),
            debug: debugInfo + ", Balanced distribution"
        };
    }
    
    // Default fallback
    return { 
        position: "Straight Center", 
        confidence: 40, 
        debug: debugInfo + ", Default fallback"
    };
}

// Improved confidence calculation
function calculateImprovedConfidence(rh, lh, rt, lt, total, positionType) {
    const rhPercent = (rh / total) * 100;
    const lhPercent = (lh / total) * 100;
    const rtPercent = (rt / total) * 100;
    const ltPercent = (lt / total) * 100;
    
    let expectedPattern = {};
    
    // Define expected patterns for each position type with more realistic expectations
    switch(positionType) {
        case "center":
            expectedPattern = {lh: 25, rh: 25, lt: 25, rt: 25, tolerance: 12};
            break;
        case "left":
            expectedPattern = {lh: 35, rh: 15, lt: 35, rt: 15, tolerance: 15};
            break;
        case "right":
            expectedPattern = {lh: 15, rh: 35, lt: 15, rt: 35, tolerance: 15};
            break;
        case "diagonal-left":
            // Expecting higher left head, moderate left tail, lower right values
            expectedPattern = {lh: 32, rh: 18, lt: 28, rt: 22, tolerance: 18};
            break;
        case "diagonal-right":
            // Expecting higher right head, moderate right tail, lower left values  
            expectedPattern = {lh: 18, rh: 32, lt: 22, rt: 28, tolerance: 18};
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
    
    // Convert to confidence score (30-100%)
    const baseConfidence = Math.max(30, 100 - (avgDev * 100 / expectedPattern.tolerance));
    
    // Bonus confidence for clear patterns
    if (positionType.includes("diagonal")) {
        const headImbalance = Math.abs(rhPercent - lhPercent);
        if (headImbalance > 10) baseConfidence += 10; // Bonus for clear head imbalance
    }
    
    return Math.min(100, Math.round(baseConfidence));
}

// Update position display with debug information
function updatePositionDisplay(position, confidence, debug = "") {
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
    
    // Update debug information
    const debugElement = document.getElementById('position-debug');
    if (debugElement && debug) {
        debugElement.textContent = debug;
        debugElement.style.fontSize = '0.8em';
        debugElement.style.color = '#7f8c8d';
        debugElement.style.marginTop = '5px';
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
    
    // Check if device is online before processing
    if (!isDeviceOnline()) {
        // Hide the entire classification section
        toggleClassificationSection(false);
        return;
    }
    
    // Show the classification section if device is online
    toggleClassificationSection(true);
    
    // Check if device is online (receiving live data)
    const now = Date.now();
    const timeSinceLastUpdate = now - lastDataTimestamp;
    const isLive = timeSinceLastUpdate < 15000;
    
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
    
    // Classify position with improved algorithm
    const { position, confidence, debug } = classifySleepPosition(
        data.rh, data.lh, data.rt, data.lt, data.total
    );
    
    updatePositionDisplay(position, confidence, debug);
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', initClassifier);