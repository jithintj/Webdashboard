// js/classifier.js
// Sleep position classifier with visual feedback

// Position to image mapping
const POSITION_IMAGES = {
    "Supine Position": "pos_supine.png",
    "Prone Position": "pos_prone.png",
    "Left Lateral Position": "pos_left_lateral.png",
    "Right Lateral Position": "pos_right_lateral.png",
    "Left Diagonal Supine": "pos_left_diagonal_supine.png",
    "Right Diagonal Supine": "pos_right_diagonal_supine.png",
    "Left Diagonal Prone": "pos_left_diagonal_prone.png",
    "Right Diagonal Prone": "pos_right_diagonal_prone.png",
    "Semi-Fowler Position": "pos_semi_fowler.png",
    "Trendelenburg Position": "pos_trendelenburg.png",
    "Left Fetal Position": "pos_left_fetal.png",
    "Right Fetal Position": "pos_right_fetal.png",
    "Patient Moving/Transitioning": "pos_transitioning.png",
    "Bed Empty or Patient Rising": "pos_empty.png",
    "Unknown/Transitioning Position": "pos_unknown.png"
};

// Position history tracking
let positionHistory = [];
const MAX_HISTORY = 20;
let currentPosition = "Unknown/Transitioning Position";
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
    updatePositionDisplay("Unknown/Transitioning Position", 0);
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
                <img src="assets/pos_unknown.png" alt="Sleep Position" id="position-image" class="position-image">
                <div class="position-confidence" id="position-confidence">0% confidence</div>
            </div>
            
            <div class="position-details">
                <div class="current-position" id="current-position">Unknown/Transitioning Position</div>
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

// Classify sleep position based on sensor data
function classifySleepPosition(rh, lh, rt, lt, total) {
    if (total < 50) return { position: "Bed Empty or Patient Rising", confidence: 95 };
    
    // Calculate percentage distribution
    const rhPercent = (rh / total) * 100;
    const lhPercent = (lh / total) * 100;
    const rtPercent = (rt / total) * 100;
    const ltPercent = (lt / total) * 100;
    
    // Calculate aggregated values
    const headTotal = rhPercent + lhPercent;
    const tailTotal = rtPercent + ltPercent;
    const leftTotal = lhPercent + ltPercent;
    const rightTotal = rhPercent + rtPercent;
    const headDiff = Math.abs(rhPercent - lhPercent);
    const tailDiff = Math.abs(rtPercent - ltPercent);
    const headTailRatio = headTotal / tailTotal;
    const leftRightRatio = leftTotal / rightTotal;
    
    // Check for movement/transition
    const sensorValues = [rh, lh, rt, lt];
    const maxVal = Math.max(...sensorValues);
    const minVal = Math.min(...sensorValues);
    const fluctuation = (maxVal - minVal) / total * 100;
    
    if (fluctuation > 40) {
        return { position: "Patient Moving/Transitioning", confidence: 85 };
    }
    
    // Classification logic
    if (headDiff < 20 && tailDiff < 20) {
        if (headTailRatio > 1.3) {
            return { position: "Trendelenburg Position", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Trendelenburg Position") };
        }
        if (headTailRatio < 0.7) {
            return { position: "Semi-Fowler Position", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Semi-Fowler Position") };
        }
        return { position: "Supine Position", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Supine Position") };
    }
    
    if (leftRightRatio > 3) {
        // Primarily on left side
        if (headTailRatio > 1.1) {
            return { position: "Left Lateral Position", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Left Lateral Position") };
        }
        if (headTailRatio < 0.9) {
            return { position: "Left Fetal Position", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Left Fetal Position") };
        }
        if (headTailRatio >= 0.9 && headTailRatio <= 1.1) {
            const position = leftTotal > 80 ? "Left Lateral Position" : "Left Diagonal Supine";
            return { position, confidence: getPositionConfidence(rh, lh, rt, lt, total, position) };
        }
    }
    
    if (leftRightRatio < 0.33) {
        // Primarily on right side
        if (headTailRatio > 1.1) {
            return { position: "Right Lateral Position", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Right Lateral Position") };
        }
        if (headTailRatio < 0.9) {
            return { position: "Right Fetal Position", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Right Fetal Position") };
        }
        if (headTailRatio >= 0.9 && headTailRatio <= 1.1) {
            const position = rightTotal > 80 ? "Right Lateral Position" : "Right Diagonal Supine";
            return { position, confidence: getPositionConfidence(rh, lh, rt, lt, total, position) };
        }
    }
    
    if (leftRightRatio > 1.5 && leftRightRatio <= 3) {
        // Diagonal left
        if (tailTotal > 55) {
            return { position: "Left Diagonal Prone", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Left Diagonal Prone") };
        }
        return { position: "Left Diagonal Supine", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Left Diagonal Supine") };
    }
    
    if (leftRightRatio < 0.67 && leftRightRatio >= 0.33) {
        // Diagonal right
        if (tailTotal > 55) {
            return { position: "Right Diagonal Prone", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Right Diagonal Prone") };
        }
        return { position: "Right Diagonal Supine", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Right Diagonal Supine") };
    }
    
    if (tailTotal > 60 && headDiff < 25) {
        return { position: "Prone Position", confidence: getPositionConfidence(rh, lh, rt, lt, total, "Prone Position") };
    }
    
    // If none of the above match with confidence
    return { position: "Unknown/Transitioning Position", confidence: 30 };
}

// Calculate confidence score for position classification
function getPositionConfidence(rh, lh, rt, lt, total, position) {
    const rhPercent = (rh / total) * 100;
    const lhPercent = (lh / total) * 100;
    const rtPercent = (rt / total) * 100;
    const ltPercent = (lt / total) * 100;
    
    let expectedPattern = {};
    
    // Define expected patterns for each position
    switch(position) {
        case "Supine Position":
            expectedPattern = {lh: 25, rh: 25, lt: 25, rt: 25, tolerance: 10};
            break;
        case "Prone Position":
            expectedPattern = {lh: 20, rh: 20, lt: 30, rt: 30, tolerance: 10};
            break;
        case "Left Lateral Position":
            expectedPattern = {lh: 40, rh: 10, lt: 40, rt: 10, tolerance: 10};
            break;
        case "Right Lateral Position":
            expectedPattern = {lh: 10, rh: 40, lt: 10, rt: 40, tolerance: 10};
            break;
        case "Left Diagonal Supine":
            expectedPattern = {lh: 35, rh: 15, lt: 35, rt: 15, tolerance: 10};
            break;
        case "Right Diagonal Supine":
            expectedPattern = {lh: 15, rh: 35, lt: 15, rt: 35, tolerance: 10};
            break;
        case "Left Diagonal Prone":
            expectedPattern = {lh: 30, rh: 15, lt: 40, rt: 15, tolerance: 12};
            break;
        case "Right Diagonal Prone":
            expectedPattern = {lh: 15, rh: 30, lt: 15, rt: 40, tolerance: 12};
            break;
        case "Semi-Fowler Position":
            expectedPattern = {lh: 20, rh: 20, lt: 30, rt: 30, tolerance: 10};
            break;
        case "Trendelenburg Position":
            expectedPattern = {lh: 30, rh: 30, lt: 20, rt: 20, tolerance: 10};
            break;
        case "Left Fetal Position":
            expectedPattern = {lh: 30, rh: 10, lt: 45, rt: 15, tolerance: 15};
            break;
        case "Right Fetal Position":
            expectedPattern = {lh: 10, rh: 30, lt: 15, rt: 45, tolerance: 15};
            break;
        default:
            return 0; // Unknown position has 0 confidence
    }
    
    // Calculate deviation from expected pattern
    const lhDev = Math.abs(lhPercent - expectedPattern.lh);
    const rhDev = Math.abs(rhPercent - expectedPattern.rh);
    const ltDev = Math.abs(ltPercent - expectedPattern.lt);
    const rtDev = Math.abs(rtPercent - expectedPattern.rt);
    
    const avgDev = (lhDev + rhDev + ltDev + rtDev) / 4;
    
    // Convert to confidence score (0-100%)
    const confidence = Math.max(0, 100 - (avgDev * 100 / expectedPattern.tolerance));
    return Math.min(100, Math.round(confidence));
}

// Update position display based on classification
function updatePositionDisplay(position, confidence) {
    // Update current position and confidence
    currentPosition = position;
    currentConfidence = confidence;
    
    // Update image
    if (positionImageElement) {
        const imagePath = `assets/${POSITION_IMAGES[position] || 'pos_unknown.png'}`;
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
        
        // Create a simplified position name for display
        let displayName = entry.position;
        if (displayName.length > 20) {
            displayName = displayName.replace('Position', '').trim();
        }
        
        historyItem.innerHTML = `
            <span class="history-time">${entry.timestamp}</span>
            <span class="history-position">${displayName}</span>
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
    
    // Only classify if we have sufficient data
    if (data.total > 50) {
        const { position, confidence } = classifySleepPosition(
            data.rh, data.lh, data.rt, data.lt, data.total
        );
        
        updatePositionDisplay(position, confidence);
    } else {
        updatePositionDisplay("Bed Empty or Patient Rising", 95);
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', initClassifier);