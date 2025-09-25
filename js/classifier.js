// js/classifier.js - OPTIMIZED
// Sleep position classifier with device icon support

// Constants
const POSITION_IMAGES = {
    "Straight Center": "pos_center.png",
    "Straight Left": "pos_left.png",
    "Straight Right": "pos_right.png",
    "Diagonal Left": "pos_diagonal_left.png",
    "Diagonal Right": "pos_diagonal_right.png",
    "Empty Bed": "pos_empty.png"
};

const MAX_HISTORY = 20;
const CONFIDENCE_THRESHOLDS = {
    HIGH: 80,
    MEDIUM: 60,
    LOW: 0
};

// State management
const ClassifierState = {
    positionHistory: [],
    currentPosition: "Empty Bed",
    currentConfidence: 0,
    positionChangeTimer: null,
    elements: {}
};

// Initialize classifier
function initClassifier() {
    createClassifierUI();
    cacheDOMElements();
    initializeClassifierState();
}

function createClassifierUI() {
    const chartContainer = document.querySelector('.chart-container');
    
    if (!chartContainer) return;
    
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
    
    chartContainer.parentNode.insertBefore(classificationSection, chartContainer.nextSibling);
}

function cacheDOMElements() {
    ClassifierState.elements = {
        positionImage: document.getElementById('position-image'),
        positionHistory: document.getElementById('position-history'),
        classificationStatus: document.getElementById('classification-status'),
        positionConfidence: document.getElementById('position-confidence'),
        currentPosition: document.getElementById('current-position'),
        positionDebug: document.getElementById('position-debug'),
        classificationContainer: document.getElementById('classification-container')
    };
}

function initializeClassifierState() {
    ClassifierState.currentPosition = "Empty Bed";
    ClassifierState.currentConfidence = 0;
    ClassifierState.positionHistory = [];
    
    updatePositionDisplay("Empty Bed", 0);
    toggleClassificationSection(false);
}

// Updated device status check for icon-based system
function isDeviceOnline() {
    const deviceStatusIcon = document.getElementById('device-status-icon');
    return deviceStatusIcon && deviceStatusIcon.src.includes('device_online.png');
}

function isDataLive() {
    return typeof lastDataTimestamp !== 'undefined' && (Date.now() - lastDataTimestamp < 15000);
}

// Consolidated classification logic
function classifySleepPosition(rh, lh, rt, lt, total) {
    // Empty bed check
    if (total < 500) {
        return createClassificationResult("Empty Bed", 95, "Total pressure too low");
    }
    
    const percentages = calculatePercentages(rh, lh, rt, lt, total);
    const patterns = analyzePatterns(percentages);
    
    return determinePosition(percentages, patterns);
}

function calculatePercentages(rh, lh, rt, lt, total) {
    return {
        rh: (rh / total) * 100,
        lh: (lh / total) * 100,
        rt: (rt / total) * 100,
        lt: (lt / total) * 100
    };
}

function analyzePatterns(percentages) {
    const leftTotal = percentages.lh + percentages.lt;
    const rightTotal = percentages.rh + percentages.rt;
    const headTotal = percentages.rh + percentages.lh;
    const tailTotal = percentages.rt + percentages.lt;
    
    return {
        leftRightRatio: leftTotal / rightTotal,
        leftRightDiff: Math.abs(leftTotal - rightTotal),
        headTailRatio: headTotal / tailTotal,
        headTailDiff: Math.abs(headTotal - tailTotal),
        headSensorDominance: Math.abs(percentages.rh - percentages.lh),
        isHeadDominant: headTotal > tailTotal + 10
    };
}

function determinePosition(percentages, patterns) {
    const { leftRightRatio, leftRightDiff, headSensorDominance } = patterns;
    
    // Strong side preferences
    if (leftRightRatio > 2.0 && leftRightDiff > 30) {
        return createClassificationResult("Straight Left", calculateConfidence(percentages, "left"), "Strong left bias");
    }
    
    if (leftRightRatio < 0.5 && leftRightDiff > 30) {
        return createClassificationResult("Straight Right", calculateConfidence(percentages, "right"), "Strong right bias");
    }
    
    // Diagonal patterns based on head sensor dominance
    if (headSensorDominance > 8) {
        if (percentages.rh > percentages.lh + 8 && isBalancedSideRatio(leftRightRatio)) {
            return createClassificationResult("Diagonal Right", calculateConfidence(percentages, "diagonal-right"), 
                `RH dominant: ${percentages.rh.toFixed(1)}% vs LH: ${percentages.lh.toFixed(1)}%`);
        }
        
        if (percentages.lh > percentages.rh + 8 && isBalancedSideRatio(leftRightRatio)) {
            return createClassificationResult("Diagonal Left", calculateConfidence(percentages, "diagonal-left"),
                `LH dominant: ${percentages.lh.toFixed(1)}% vs RH: ${percentages.rh.toFixed(1)}%`);
        }
    }
    
    // Moderate preferences
    if (leftRightRatio > 1.2 && leftRightRatio <= 2.0) {
        return handleModeratePreference(percentages, patterns, "left");
    }
    
    if (leftRightRatio < 0.8 && leftRightRatio >= 0.5) {
        return handleModeratePreference(percentages, patterns, "right");
    }
    
    // Balanced distribution
    if (isBalancedSideRatio(leftRightRatio)) {
        if (headSensorDominance > 6) {
            const position = percentages.rh > percentages.lh ? "Diagonal Right" : "Diagonal Left";
            return createClassificationResult(position, calculateConfidence(percentages, position.toLowerCase().replace(" ", "-")),
                "Balanced L/R with head imbalance");
        }
        return createClassificationResult("Straight Center", calculateConfidence(percentages, "center"), "Balanced distribution");
    }
    
    // Default fallback
    return createClassificationResult("Straight Center", 40, "Default fallback");
}

function isBalancedSideRatio(ratio) {
    return ratio >= 0.8 && ratio <= 1.2;
}

function handleModeratePreference(percentages, patterns, side) {
    const { headSensorDominance } = patterns;
    
    if (headSensorDominance > 5) {
        const isLeftPreferred = side === "left";
        const headDominantSide = percentages.lh > percentages.rh ? "left" : "right";
        const position = (isLeftPreferred && headDominantSide === "left") || (!isLeftPreferred && headDominantSide === "right") ? 
            `Diagonal ${side.charAt(0).toUpperCase() + side.slice(1)}` : 
            `Diagonal ${headDominantSide.charAt(0).toUpperCase() + headDominantSide.slice(1)}`;
        
        return createClassificationResult(position, calculateConfidence(percentages, position.toLowerCase().replace(" ", "-")),
            `Moderate ${side} + head imbalance`);
    }
    
    return createClassificationResult(`Straight ${side.charAt(0).toUpperCase() + side.slice(1)}`, 
        calculateConfidence(percentages, side), `Moderate ${side} preference`);
}

function createClassificationResult(position, confidence, debug) {
    return { position, confidence, debug };
}

// Consolidated confidence calculation
function calculateConfidence(percentages, positionType) {
    const expectedPatterns = {
        "center": { lh: 25, rh: 25, lt: 25, rt: 25, tolerance: 12 },
        "left": { lh: 35, rh: 15, lt: 35, rt: 15, tolerance: 15 },
        "right": { lh: 15, rh: 35, lt: 15, rt: 35, tolerance: 15 },
        "diagonal-left": { lh: 32, rh: 18, lt: 28, rt: 22, tolerance: 18 },
        "diagonal-right": { lh: 18, rh: 32, lt: 22, rt: 28, tolerance: 18 }
    };

    const pattern = expectedPatterns[positionType] || expectedPatterns.center;
    
    const deviations = [
        Math.abs(percentages.lh - pattern.lh),
        Math.abs(percentages.rh - pattern.rh),
        Math.abs(percentages.lt - pattern.lt),
        Math.abs(percentages.rt - pattern.rt)
    ];
    
    const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / deviations.length;
    let confidence = Math.max(30, 100 - (avgDeviation * 100 / pattern.tolerance));
    
    // Bonus for clear diagonal patterns
    if (positionType.includes("diagonal") && Math.abs(percentages.rh - percentages.lh) > 10) {
        confidence += 10;
    }
    
    return Math.min(100, Math.round(confidence));
}

// Consolidated UI updates
function updatePositionDisplay(position, confidence, debug = "") {
    ClassifierState.currentPosition = position;
    ClassifierState.currentConfidence = confidence;
    
    updatePositionImage(position);
    updateConfidenceDisplay(confidence);
    updatePositionText(position);
    updateDebugInfo(debug);
    addToPositionHistory(position, confidence);
}

function updatePositionImage(position) {
    if (ClassifierState.elements.positionImage) {
        const imagePath = `assets/${POSITION_IMAGES[position] || 'pos_empty.png'}`;
        ClassifierState.elements.positionImage.src = imagePath;
        ClassifierState.elements.positionImage.alt = position;
    }
}

function updateConfidenceDisplay(confidence) {
    if (!ClassifierState.elements.positionConfidence) return;
    
    ClassifierState.elements.positionConfidence.textContent = `${confidence}% confidence`;
    ClassifierState.elements.positionConfidence.style.color = getConfidenceColor(confidence);
}

function updatePositionText(position) {
    if (ClassifierState.elements.currentPosition) {
        ClassifierState.elements.currentPosition.textContent = position;
    }
}

function updateDebugInfo(debug) {
    if (ClassifierState.elements.positionDebug && debug) {
        ClassifierState.elements.positionDebug.textContent = debug;
        ClassifierState.elements.positionDebug.style.fontSize = '0.8em';
        ClassifierState.elements.positionDebug.style.color = '#7f8c8d';
        ClassifierState.elements.positionDebug.style.marginTop = '5px';
    }
}

function getConfidenceColor(confidence) {
    if (confidence > CONFIDENCE_THRESHOLDS.HIGH) return '#27ae60';
    if (confidence > CONFIDENCE_THRESHOLDS.MEDIUM) return '#f39c12';
    return '#e74c3c';
}

function addToPositionHistory(position, confidence) {
    if (ClassifierState.positionChangeTimer) {
        clearTimeout(ClassifierState.positionChangeTimer);
    }
    
    ClassifierState.positionChangeTimer = setTimeout(() => {
        const lastEntry = ClassifierState.positionHistory[ClassifierState.positionHistory.length - 1];
        
        if (!lastEntry || lastEntry.position !== position || Math.abs(lastEntry.confidence - confidence) > 20) {
            ClassifierState.positionHistory.push({
                position,
                confidence,
                timestamp: new Date().toLocaleTimeString()
            });
            
            if (ClassifierState.positionHistory.length > MAX_HISTORY) {
                ClassifierState.positionHistory.shift();
            }
            
            updatePositionHistoryDisplay();
        }
    }, 1000);
}

function updatePositionHistoryDisplay() {
    if (!ClassifierState.elements.positionHistory) return;
    
    ClassifierState.elements.positionHistory.innerHTML = '';
    
    ClassifierState.positionHistory.slice().reverse().forEach(entry => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.style.borderLeft = `4px solid ${getConfidenceColor(entry.confidence)}`;
        
        historyItem.innerHTML = `
            <span class="history-time">${entry.timestamp}</span>
            <span class="history-position">${entry.position}</span>
            <span class="history-confidence">${entry.confidence}%</span>
        `;
        
        ClassifierState.elements.positionHistory.appendChild(historyItem);
    });
}

function toggleClassificationSection(show) {
    if (ClassifierState.elements.classificationContainer) {
        ClassifierState.elements.classificationContainer.style.display = show ? 'block' : 'none';
    }
}

function updateClassificationStatus(isLive) {
    if (!ClassifierState.elements.classificationStatus) return;
    
    ClassifierState.elements.classificationStatus.textContent = isLive ? 'Live classification' : 'Historical data analysis';
    ClassifierState.elements.classificationStatus.style.color = isLive ? '#27ae60' : '#7f8c8d';
}

// Main processing function
function processDataForClassification(data) {
    if (!data) return;
    
    const deviceOnline = isDeviceOnline();
    toggleClassificationSection(deviceOnline);
    
    if (!deviceOnline) return;
    
    updateClassificationStatus(isDataLive());
    
    const classification = classifySleepPosition(data.rh, data.lh, data.rt, data.lt, data.total);
    updatePositionDisplay(classification.position, classification.confidence, classification.debug);
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', initClassifier);