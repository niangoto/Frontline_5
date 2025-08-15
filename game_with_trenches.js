// Constants
const PLAYER_COLORS = ["#FF0000", "#0000FF"];
const UNIT_RADIUS = 15;
const INITIAL_POINTS = 90;
const FRONT_LINE_COLOR = "#000000";
const BG_COLOR = "#F0F0F0";
const BUTTON_COLOR = "#64C864";
const BUTTON_TEXT_COLOR = "#FFFFFF";
const MAX_MOVE_DISTANCE = 30;
const MIN_DISTANCE_TO_FRONT = UNIT_RADIUS * 1.5;
const MOVE_SPEED = 3;
const MAX_UNITS = 50;
const MAX_TURNS = 15;
const CAPITAL_RADIUS = UNIT_RADIUS;
const CAPITAL_COLOR = "#FFD700";
const SELECTION_COLOR = "#00FF00";
const SELECTION_LINE_WIDTH = 2;
const SELECTED_UNIT_COLOR = "#00FF00";
const SELECTED_UNIT_LINE_WIDTH = 3;
const BLACK_ARROW_LENGTH = 50;
const BLUE_ARROW_LENGTH = BLACK_ARROW_LENGTH * 2;
const LAT1 = 54.8;
const LAT2 = 50.3;

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const gameInfo = document.getElementById('game-info');
const readyBtn = document.getElementById('ready-btn');
const settingsModal = document.getElementById('settings-modal');
const turnInput = document.getElementById('turn-input');
const confirmBtn = document.getElementById('confirm-btn');

// Initialize trench button
const trenchBtn = document.createElement('button');
trenchBtn.id = 'trench-btn';
trenchBtn.className = 'trench-btn';
trenchBtn.textContent = 'Окоп';
document.getElementById('game-container').appendChild(trenchBtn);

// Game data
let gameData = {
    playerUnits: [[], []],
    frontLine: [],
    selectedUnit: null,
    phase: "placement",
    currentPlayer: 0,
    battlePhase: false,
    turnCount: 0,
    showArrows: true,
    maxTurns: 3,
    originalYPositions: [],
    initialSpacing: 0,
    capitals: [null, null],
    selectionStart: null,
    selectionEnd: null,
    selectedUnits: [],
    gameMode: "2players",
};

let ARROW_LENGTH = Math.max(40, Math.floor(canvas.width / gameData.maxTurns / 2));

// Trench functionality
function updateTrenchButtonVisibility() {
    if (gameData.selectedUnits.length > 0 && 
        gameData.phase.includes("arrows") && 
        gameData.currentPlayer === gameData.selectedUnits[0].player) {
        trenchBtn.classList.add('visible');
    } else {
        trenchBtn.classList.remove('visible');
    }
}

// Event Listeners for trench
trenchBtn.addEventListener('click', () => {
    // Enable trench mode for selected units
    for (let unit of gameData.selectedUnits) {
        unit.inTrench = true;
        unit.direction = null;  // Remove any movement direction
        unit.blueArrow = null;  // Remove any blue arrow
    }
    gameData.selectedUnits = [];  // Clear selection
    trenchBtn.classList.remove('visible');  // Hide trench button
});

// Update selection handling to show/hide trench button
canvas.addEventListener('mousedown', function(e) {
    if (gameData.selectedUnits.length > 0) {
        updateTrenchButtonVisibility();
    }
});

class Unit {
    constructor(player, x, y) {
        this.player = player;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.prevX = x;
        this.prevY = y;
        this.direction = null;
        this.assignedPoints = [];
        this.forwardMoves = 0;
        this.totalPoints = 0;
        this.partialPoints = 0;
        this.blueArrow = null;
        this.isMoving = false;
        this.moveProgress = 0;
        this.blockedByFront = false;
        this.beingPushed = false;
        this.pushTargetX = x;
        this.pushTargetY = y;
        this.pushProgress = 0;
        this.inTrench = false;
    }

    updatePosition() {
        // Don't move if in trench
        if (this.inTrench) {
            return;
        }

        const scale = getUnitScale();
        if (this.beingPushed) {
            // ... existing push handling code ...
        }

        if (this.isMoving) {
            // ... existing movement code ...
        }
    }

    draw(selected = false, showArrows = true) {
        const scale = getUnitScale();
        ctx.beginPath();
        ctx.arc(this.x, this.y, UNIT_RADIUS * scale, 0, Math.PI * 2);
        // Use green color for trenched units
        ctx.fillStyle = this.inTrench ? "#008000" : PLAYER_COLORS[this.player];
        ctx.fill();
        
        if (gameData.selectedUnits.includes(this)) {
            ctx.strokeStyle = SELECTED_UNIT_COLOR;
            ctx.lineWidth = SELECTED_UNIT_LINE_WIDTH * scale;
            ctx.stroke();
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = this.inTrench ? "#006400" : PLAYER_COLORS[this.player];
            ctx.stroke();
        }
        
        if (showArrows) {
            // ... existing arrow drawing code ...
        }
    }
}

function handleArrowDirection(pos, button) {
    if (!gameData.selectedUnit) return false;

    let [x, y] = pos;
    let dx = x - gameData.selectedUnit.x;
    let dy = y - gameData.selectedUnit.y;

    // Remove trench status when setting movement
    if (gameData.selectedUnit.inTrench) {
        gameData.selectedUnit.inTrench = false;
    }

    if (button === 2) {
        gameData.selectedUnit.blueArrow = [x, y];
        gameData.selectedUnit.direction = null;
    } else {
        gameData.selectedUnit.direction = Math.atan2(dy, dx);
        gameData.selectedUnit.blueArrow = null;
    }

    gameData.selectedUnit = null;
    return true;
}

function calculateBattle() {
    // ... existing battle initialization code ...

    for (let pointIdx = 0; pointIdx < gameData.frontLine.length; pointIdx++) {
        let [px, py] = gameData.frontLine[pointIdx];
        let closest = [[], []];

        // Find closest units
        for (let player of [0, 1]) {
            for (let unit of gameData.playerUnits[player]) {
                let dist = Math.hypot(unit.x - px, unit.y - py);
                if (dist <= maxUnitDist) {
                    closest[player].push({ unit, dist });
                }
            }
            closest[player].sort((a, b) => a.dist - b.dist);
        }

        // Calculate strengths with trench bonus
        let strengths = [0, 0];
        let winningUnits = [null, null];

        for (let player of [0, 1]) {
            let unitsInfo = closest[player];
            if (unitsInfo.length >= 2 && Math.abs(unitsInfo[0].dist - unitsInfo[1].dist) < 0.1) {
                // Apply trench bonus for two units
                let strength = 1.0;
                if (unitsInfo[0].unit.inTrench) strength += 1.0;
                if (unitsInfo[1].unit.inTrench) strength += 1.0;
                strengths[player] = strength;
                winningUnits[player] = [unitsInfo[0].unit, unitsInfo[1].unit];
            } else if (unitsInfo.length >= 1) {
                // Apply trench bonus for single unit
                let strength = 1.0 / (unitsInfo[0].dist + 1);
                if (unitsInfo[0].unit.inTrench) strength *= 2;
                strengths[player] = strength;
                winningUnits[player] = unitsInfo[0].unit;
            }
        }

        // ... rest of battle handling code ...
    }

    // ... rest of battle cleanup code ...
}

// ... rest of existing game code ...
