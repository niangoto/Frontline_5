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
const MAX_UNITS = 150;  // New constant for maximum units
const MAX_TURNS = 15;  // New constant for maximum turns
const CAPITAL_RADIUS = UNIT_RADIUS;  // Now same size as units
const CAPITAL_COLOR = "#FFD700";
const SELECTION_COLOR = "#00FF00";
const SELECTION_LINE_WIDTH = 2;
const SELECTED_UNIT_COLOR = "#00FF00";
const SELECTED_UNIT_LINE_WIDTH = 3;
// Дължини на стрелките
const BLACK_ARROW_LENGTH = 50;
const BLUE_ARROW_LENGTH = BLACK_ARROW_LENGTH * 2;
// Пример: границата е между lat1 и lat2 (север-юг), canvas.height = 600
const LAT1 = 54.8; // северна граница (пример)
const LAT2 = 50.3; // южна граница (пример)

// DOM elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const gameInfo = document.getElementById('game-info');
const readyBtn = document.getElementById('ready-btn');
const settingsModal = document.getElementById('settings-modal');
const turnInput = document.getElementById('turn-input');
const confirmBtn = document.getElementById('confirm-btn');

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
    capitals: [null, null], // Store capital positions for each player
    selectionStart: null,
    selectionEnd: null,
    selectedUnits: [],
    gameMode: "2players", // "2players" или "vsbot"
};

// Сега вече може:
let ARROW_LENGTH = Math.max(40, Math.floor(canvas.width / gameData.maxTurns / 2));

// Начално положение на фронтовата линия (географски координати)
function latToY(lat) {
    // Преобразува latitude към y в canvas
    return ((LAT1 - lat) / (LAT1 - LAT2)) * canvas.height;
}
function yToLat(y) {
    // Преобразува y в latitude
    return LAT1 - (y / canvas.height) * (LAT1 - LAT2);
}
function geoToCanvas([lon, lat]) {
    // longitude -> x, latitude -> y
    // Пример: x = (lon - LON1) / (LON2 - LON1) * canvas.width
    const LON1 = 14.0; // западна граница (пример)
    const LON2 = 24.0; // източна граница (пример)
    let x = ((lon - LON1) / (LON2 - LON1)) * canvas.width;
    let y = latToY(lat);
    return [x, y];
}
// Game class definition should come before any usage
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.frontLine = [];
        this.playerUnits = [[], []];
        this.currentPlayer = 0;
        this.selectedUnit = null;
        this.phase = "settings";
        this.battlePhase = false;
        this.turnCount = 0;
        this.maxTurns = 3;
        this.maxUnits = 10;
        this.gameMode = "2players"; 
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw territories
        if (this.frontLine.length > 1) {
            // Draw red territory
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            for (const point of this.frontLine) {
                this.ctx.lineTo(point[0], point[1]);
            }
            this.ctx.lineTo(0, this.canvas.height);
            this.ctx.closePath();
            this.ctx.fillStyle = '#ffcccc';
            this.ctx.fill();

            // Draw blue territory
            this.ctx.beginPath();
            this.ctx.moveTo(this.canvas.width, 0);
            for (const point of this.frontLine) {
                this.ctx.lineTo(point[0], point[1]);
            }
            this.ctx.lineTo(this.canvas.width, this.canvas.height);
            this.ctx.closePath();
            this.ctx.fillStyle = '#ccceff';
            this.ctx.fill();

            // Draw front line
            this.ctx.beginPath();
            this.ctx.moveTo(this.frontLine[0][0], this.frontLine[0][1]);
            for (const point of this.frontLine) {
                this.ctx.lineTo(point[0], point[1]);
            }
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Draw points on front line
            for (const point of this.frontLine) {
                this.ctx.beginPath();
                this.ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
                this.ctx.fillStyle = '#000000';
                this.ctx.fill();
            }
        }

        // Draw units
        for (let player = 0; player < 2; player++) {
            // Skip drawing red units during blue's placement phase
            if (this.phase === "placement" && player === 0 && this.currentPlayer === 1) {
                continue;
            }

            for (const unit of this.playerUnits[player]) {
                unit.draw(this.ctx, unit === this.selectedUnit);
            }
        }

        // Update game info
        const gameInfo = document.getElementById('game-info');
        if (this.phase === "placement") {
            gameInfo.textContent = `Играч ${this.currentPlayer + 1}: Поставяне на единици (${this.playerUnits[this.currentPlayer].length}/${this.maxUnits})`;
        } else if (this.phase.endsWith("_arrows")) {
            gameInfo.textContent = `Играч ${this.currentPlayer + 1}: Задаване на посоки`;
        }
    }
    update() {
        // ... съществуващ код ...

        // Проверка за бот
        if (this.gameMode === "vsbot" && 
            this.currentPlayer === 1 && 
            (this.phase === "placement" || this.phase === "player2_arrows")) {
            
            if (!this.bot) {
                this.bot = new BotController(this);
            }
            
            // Изкуствено забавяне за по-естествено поведение
            setTimeout(() => {
                this.bot.makeDecision();
                
                // Автоматично маркиране като готов ако е необходимо
                if (this.phase === "placement" && 
                    this.playerUnits[1].length >= this.maxUnits) {
                    this.handleReadyClick();
                } else if (this.phase === "player2_arrows") {
                    // Даваме малко време на стрелките да се визуализират
                    setTimeout(() => this.handleReadyClick(), 500);
                }
            }, 1000);
        }
    }
}

// Create game instance
let game = new Game(canvas);

// Инициализация на играта
let botController = null;
if (gameData.gameMode === "vsbot") {
    botController = new BotController(gameData);
}

// Клас Unit
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
        this.assignedPoints = [];  // Инициализираме масива тук
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
        this.entrenched = false; // Ново свойство
    }

    updatePosition() {
        const scale = getUnitScale();
        // Първо обработваме избутването
        if (this.beingPushed) {
            this.x = this.prevX + (this.pushTargetX - this.prevX) * this.pushProgress;
            this.y = this.prevY + (this.pushTargetY - this.prevY) * this.pushProgress;
            this.pushProgress = Math.min(1.0, this.pushProgress + MOVE_SPEED / 10);

            // Ако центърът е напълно извън екрана — премахни единицата
            if (
                this.x < 0 ||
                this.x > canvas.width ||
                this.y < 0 ||
                this.y > canvas.height
            ) {
                gameData.playerUnits[this.player] = gameData.playerUnits[this.player].filter(u => u !== this);
                return;
            }

            // Check distance from front line after being pushed
            let tooClose = false;
            for (let point of gameData.frontLine) {
                let dist = Math.sqrt((this.x - point[0])**2 + (this.y - point[1])**2);
                if (dist < UNIT_RADIUS * scale) {
                    tooClose = true;
                    break;
                }
            }

            // Ако е твърде близо до фронта и е притисната и от ръба (центърът извън екрана) — премахни
            if (tooClose) {
                if (
                    this.x < 0 ||
                    this.x > canvas.width ||
                    this.y < 0 ||
                    this.y > canvas.height
                ) {
                    gameData.playerUnits[this.player] = gameData.playerUnits[this.player].filter(u => u !== this);
                    return;
                }
                // Ако е само твърде близо до фронта — премахни
                gameData.playerUnits[this.player] = gameData.playerUnits[this.player].filter(u => u !== this);
                return;
            }

            // Ако ще излезе извън екрана — спри движението (не премахвай)
            if (
                this.x - UNIT_RADIUS * scale < 0 ||
                this.x + UNIT_RADIUS * scale > canvas.width ||
                this.y - UNIT_RADIUS * scale < 0 ||
                this.y + UNIT_RADIUS * scale > canvas.height
            ) {
                this.beingPushed = false;
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            // Спри движението ако попадне в морето (BuSe карта)
            if (isInSeaZone(this.x, this.y)) {
                this.beingPushed = false;
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            if (this.pushProgress >= 1.0) {
                this.beingPushed = false;
                this.prevX = this.x;
                this.prevY = this.y;
                // Актуализираме и целевите позиции ако има активно движение
                if (this.isMoving) {
                    this.targetX += (this.pushTargetX - this.prevX);
                    this.targetY += (this.pushTargetY - this.prevY);
                }
            }
            return;
        }

        if (this.isMoving) {
            // Изчисляваме потенциалните нови координати
            let newX = this.prevX + (this.targetX - this.prevX) * this.moveProgress;
            let newY = this.prevY + (this.targetY - this.prevY) * this.moveProgress;

            // Ако ще излезе извън екрана — спри движението (не премахвай)
            if (
                newX - UNIT_RADIUS * scale < 0 ||
                newX + UNIT_RADIUS * scale > canvas.width ||
                newY - UNIT_RADIUS * scale < 0 ||
                newY + UNIT_RADIUS * scale > canvas.height
            ) {
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            // Спри движението ако влиза в морето (BuSe карта)
            if (isInSeaZone(newX, newY)) {
                this.isMoving = false;
                this.blockedByFront = true;
                return;
            }

            // Вектор на движение
            let moveDirX = this.targetX - this.prevX;
            let moveDirY = this.targetY - this.prevY;
            let moveLen = Math.sqrt(moveDirX**2 + moveDirY**2);

            if (moveLen > 0.001) {
                moveDirX /= moveLen;
                moveDirY /= moveLen;
            }

            // Проверка за разстояние до фронтовата линия
            let tooClose = false;
            let closestDist = Infinity;
            let closestPoint = null;

            // Use BuSe distance for movement checks
            let minDistanceToFront = (gameData.BuSeCapitalsLocked ? 2.5 : 1.5) * UNIT_RADIUS * scale;
            for (let point of gameData.frontLine) {
                let dist = Math.sqrt((newX - point[0])**2 + (newY - point[1])**2);
                if (dist < minDistanceToFront) {
                    tooClose = true;
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestPoint = point;
                    }
                }
            }

            if (!tooClose) {
                // Свободно движение
                this.x = newX;
                this.y = newY;
                this.moveProgress = Math.min(1.0, this.moveProgress + MOVE_SPEED / (moveLen + 0.1));
            } else {
                // Проверяваме дали се приближаваме или отдалечаваме от точката
                if (closestPoint) {
                    // Вектор към най-близката точка от фронта
                    let toPointX = closestPoint[0] - this.x;
                    let toPointY = closestPoint[1] - this.y;

                    // Скаларно произведение
                    let dotProduct = moveDirX * toPointX + moveDirY * toPointY;

                    if (dotProduct <= 0) {
                        // Позволяваме движение
                        this.x = newX;
                        this.y = newY;
                        this.moveProgress = Math.min(1.0, this.moveProgress + MOVE_SPEED / (moveLen + 0.1));
                    } else {
                        // Спираме движението
                        this.blockedByFront = true;
                        this.isMoving = false;
                    }
                } else {
                    this.blockedByFront = true;
                    this.isMoving = false;
                }
            }

            if (this.moveProgress >= 1.0) {
                this.isMoving = false;
            }
        }
    }

    draw(selected = false, showArrows = true) {
        // Рисуване на единицата
        const scale = getUnitScale();
        // Ако е entrenched, сменяме цвета на зелено
        if (this.entrenched) {
            ctx.fillStyle = "#228B22"; // Зелен цвят за окоп
        } else {
            ctx.fillStyle = PLAYER_COLORS[this.player];
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, UNIT_RADIUS * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Дебел зелен контур за маркирани единици
        if (gameData.selectedUnits.includes(this)) {
            ctx.strokeStyle = SELECTED_UNIT_COLOR;
            ctx.lineWidth = SELECTED_UNIT_LINE_WIDTH * scale;
            ctx.stroke();
            ctx.lineWidth = 1;
        } else {
            ctx.strokeStyle = PLAYER_COLORS[this.player];
            ctx.stroke();
        }
        
        if (showArrows) {
            // Синя стрелка (вижда се само ако е зададена)
            if (this.blueArrow) {
                let [endX, endY] = this.blueArrow;
                let dx = endX - this.x;
                let dy = endY - this.y;
                let dist = Math.hypot(dx, dy);
                let maxLen = BLUE_ARROW_LENGTH * scale;
                if (dist > maxLen) {
                    let s = maxLen / dist;
                    endX = this.x + dx * s;
                    endY = this.y + dy * s;
                }
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = "#0000FF";
                ctx.lineWidth = 2 * scale;
                ctx.stroke();

                let angle = Math.atan2(endY - this.y, endX - this.x);
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - 10 * scale * Math.cos(angle - Math.PI/6),
                    endY - 10 * scale * Math.sin(angle - Math.PI/6)
                );
                ctx.lineTo(
                    endX - 10 * scale * Math.cos(angle + Math.PI/6),
                    endY - 10 * scale * Math.sin(angle + Math.PI/6)
                );
                ctx.closePath();
                ctx.fillStyle = "#0000FF";
                ctx.fill();
                ctx.lineWidth = 1;
            }
            // Черна стрелка (вижда се винаги, ако има зададена посока)
            if (this.direction !== null && !this.isMoving) {
                let blackLen = BLACK_ARROW_LENGTH * scale;
                let endX = this.x + blackLen * Math.cos(this.direction);
                let endY = this.y + blackLen * Math.sin(this.direction);
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 2 * scale;
                ctx.stroke();

                let angle = this.direction;
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - 10 * scale * Math.cos(angle - Math.PI/6),
                    endY - 10 * scale * Math.sin(angle - Math.PI/6)
                );
                ctx.lineTo(
                    endX - 10 * scale * Math.cos(angle + Math.PI/6),
                    endY - 10 * scale * Math.sin(angle + Math.PI/6)
                );
                ctx.closePath();
                ctx.fillStyle = "#000000";
                ctx.fill();
                ctx.lineWidth = 1;
            }
        }
    }
}

// Инициализация на фронтовата линия
function initializeFrontLine() {
    const POINTS_COUNT = 90;
    let mapType = "classic";
    const mapSelect = document.getElementById('map-select');
    if (mapSelect) {
        mapType = mapSelect.value;
    }

    if (mapType === "BuSe") {
        // BuSe карта: използваме външен файл с изкривена линия
        let shape = (typeof BuSe_FRONTLINE !== 'undefined') ? BuSe_FRONTLINE : [];
        // Ако няма shape, fallback към права линия
        if (!shape || shape.length === 0) {
            shape = Array.from({length: POINTS_COUNT}, (_, i) => [canvas.width/2, (i / (POINTS_COUNT-1)) * canvas.height]);
        }
        // Скалираме по текущия размер на canvas
        let scaleY = canvas.height / 600;
        let scaleX = canvas.width / 700;
        let frontLine = shape.map(([x, y]) => [x * scaleX, y * scaleY]);
        gameData.frontLine = frontLine;
        gameData.initialSpacing = canvas.height / POINTS_COUNT;
        gameData.originalYPositions = frontLine.map(([x, y]) => y);

        // --- BuSe: Задаване на столиците от масива и забрана за избор ---
        if (typeof BuSe_CAPITALS !== 'undefined' && Array.isArray(BuSe_CAPITALS)) {
            // Скалиране на столиците по canvas
            gameData.capitals = BuSe_CAPITALS.map(c =>
                c ? [c[0] * scaleX, c[1] * scaleY] : null
            );
        }
        gameData.BuSeCapitalsLocked = true;
        return;
    }

    if (
        mapType === "custom" &&
        typeof INITIAL_FRONTLINE !== "undefined" &&
        Array.isArray(INITIAL_FRONTLINE)
    ) {
        // Използвай точките от INITIAL_FRONTLINE (canvas координати)
        let frontLine = interpolateFrontLine(INITIAL_FRONTLINE, POINTS_COUNT);
        fillFrontLineEnds(frontLine, canvas.height / POINTS_COUNT, canvas);
        gameData.frontLine = frontLine;

        // Изчисли новото spacing за динамична корекция
        let totalLen = 0;
        for (let i = 1; i < gameData.frontLine.length; i++) {
            let dx = gameData.frontLine[i][0] - gameData.frontLine[i-1][0];
            let dy = gameData.frontLine[i][1] - gameData.frontLine[i-1][1];
            totalLen += Math.sqrt(dx*dx + dy*dy);
        }
        gameData.initialSpacing = totalLen / (gameData.frontLine.length - 1);
        gameData.originalYPositions = gameData.frontLine.map(([x, y]) => y);
    } else {
        // Класическа права линия
        gameData.initialSpacing = canvas.height / POINTS_COUNT;
        gameData.originalYPositions = Array.from({ length: POINTS_COUNT }, (_, i) => (i + 1) * gameData.initialSpacing);
        gameData.frontLine = gameData.originalYPositions.map(y => [canvas.width / 2, y]);
        // Първата точка най-горе, последната най-долу
        gameData.frontLine[0][1] = 0;
        gameData.frontLine[gameData.frontLine.length - 1][1] = canvas.height;
    }
}

// Проверка за поставяне на единица
function handlePlacement(pos) {
    const scale = getUnitScale();
    // BuSe карта: не позволявай избор на столица
    if (gameData.BuSeCapitalsLocked) {
        let [x, y] = pos;
        let player = gameData.currentPlayer;

        // Забрани поставане в морето
        if (isInSeaZone(x, y)) return false;

        // Проверка за премахване на съществуваща единица
        for (let i = 0; i < gameData.playerUnits[player].length; i++) {
            let unit = gameData.playerUnits[player][i];
            if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) <= UNIT_RADIUS * scale) {
                gameData.playerUnits[player].splice(i, 1);
                return true;
            }
        }

        // Проверка за максимален брой единици
        if (gameData.playerUnits[player].length >= gameData.maxUnits) {
            return false;
        }
        
        // Проверка за разстояние от фронтова линия
        let minDistance = (gameData.BuSeCapitalsLocked ? 2.5 : 1.5) * UNIT_RADIUS * scale;
        for (let point of gameData.frontLine) {
            if (Math.sqrt((x - point[0])**2 + (y - point[1])**2) < minDistance) {
                return false;
            }
        }
        
        // Проверка за разстояние от други единици
        for (let unit of gameData.playerUnits[player]) {
            if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) < UNIT_RADIUS * 2 * scale) {
                return false;
            }
        }
        
        // Проверка за разстояние от столицата
        if (gameData.capitals[player]) {
            let capital = gameData.capitals[player];
            if (Math.sqrt((x - capital[0])**2 + (y - capital[1])**2) < UNIT_RADIUS * 2 * scale) {
                return false;
            }
        }
        
        if (!isInOwnTerritory(player, x, y)) {
            return false;
        }
        
        let newUnit = new Unit(player, x, y);
        gameData.playerUnits[player].push(newUnit);
        return true;
    }

    let [x, y] = pos;
    let player = gameData.currentPlayer;

    // Забрани поставане в морето (за всички карти, ако има дефинирана морска зона)
    if (isInSeaZone(x, y)) return false;

    // Проверка за столица
    if (!gameData.capitals[player]) {
        return handleCapitalPlacement(pos);
    }

    // Проверка за премахване на съществуваща единица
    for (let i = 0; i < gameData.playerUnits[player].length; i++) {
        let unit = gameData.playerUnits[player][i];
        if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) <= UNIT_RADIUS * scale) {
            gameData.playerUnits[player].splice(i, 1);
            return true;
        }
    }
    
    // Проверка за максимален брой единици
    if (gameData.playerUnits[player].length >= gameData.maxUnits) {
        return false;
    }
    
    // Проверка за разстояние от фронтова линия
    let minDistance = (gameData.BuSeCapitalsLocked ? 2.5 : 1.5) * UNIT_RADIUS * scale;
    for (let point of gameData.frontLine) {
        if (Math.sqrt((x - point[0])**2 + (y - point[1])**2) < minDistance) {
            return false;
        }
    }
    
    // Проверка за разстояние от други единици
    for (let unit of gameData.playerUnits[player]) {
        if (Math.sqrt((x - unit.x)**2 + (y - unit.y)**2) < UNIT_RADIUS * 2 * scale) {
            return false;
        }
    }
    
    // Проверка за разстояние от столицата
    if (gameData.capitals[player]) {
        let capital = gameData.capitals[player];
        if (Math.sqrt((x - capital[0])**2 + (y - capital[1])**2) < UNIT_RADIUS * 2 * scale) {
            return false;
        }
    }
    
    if (!isInOwnTerritory(player, x, y)) {
        return false;
    }
    
    let newUnit = new Unit(player, x, y);
    gameData.playerUnits[player].push(newUnit);
    // Ако е режим срещу бот и червения играч е готов, активирай бота
    if (gameData.gameMode === "vsbot" && 
        gameData.phase === "placement" && 
        gameData.currentPlayer === 1) {
        setTimeout(() => activateBot(), 100);
    }
    if (gameData.gameMode === "vsbot" && gameData.currentPlayer === 1) {
        setTimeout(activateBot, 100);
    }
    return true;
}
// Нова функция за активиране на бота
function activateBot() {
    if (!game.bot) {
        game.bot = new BotController(gameData);
    }
    
    if (gameData.phase === "placement") {
        // Ако ботът все още няма столица
        if (!gameData.capitals[1]) {
            game.bot.placeCapital();
            // Проверяваме дали е поставена успешно
            if (gameData.capitals[1]) {
                setTimeout(activateBot, 100);
            }
            return;
        }
        
        // Поставяме единици докато не стигнем максимума
        if (gameData.playerUnits[1].length < gameData.maxUnits) {
            game.bot.placeUnitEvenly(); // <-- ТУК!
            setTimeout(activateBot, 100);
        } else {
            // Преминаваме към фазата на стрелките
            gameData.currentPlayer = 0;
            gameData.phase = "player1_arrows";
            readyBtn.classList.remove('hidden');
        }
    } 
    else if (gameData.phase === "player2_arrows") {
        game.bot.handleArrowPhase();
        setTimeout(() => {
            gameData.phase = "battle";
            readyBtn.classList.add('hidden');
            calculateBattle();
        }, 500);
    }
}
function handleArrowSelection(pos, button) {
    let [x, y] = pos;
    
    // Проверяваме дали имаме вече избрана единица
    if (gameData.selectedUnit) {
        handleArrowDirection(pos, button);
        return true;
    }
    
    // Търсим единица под курсора
    for (let unit of gameData.playerUnits[gameData.currentPlayer]) {
        if (Math.sqrt((unit.x - x)**2 + (unit.y - y)**2) <= UNIT_RADIUS) {
            gameData.selectedUnit = unit;
            return true;
        }
    }
    return false;
}
function resetSelection() {
    gameData.selectionStart = null;
    gameData.selectionEnd = null;
    gameData.selectedUnits = [];
    gameData.selectedUnit = null;
}
// Обработка на посока на стрелка
function handleArrowDirection(pos, button) {
    if (!gameData.selectedUnit) return false;

    let [x, y] = pos;
    let dx = x - gameData.selectedUnit.x;
    let dy = y - gameData.selectedUnit.y;

    if (button === 2) {  // Десен бутон - синя стрелка (права)
        gameData.selectedUnit.blueArrow = [x, y];
        gameData.selectedUnit.direction = null;
    } else {  // Ляв бутон - черна стрелка
        gameData.selectedUnit.direction = Math.atan2(dy, dx);
        gameData.selectedUnit.blueArrow = null;
    }

    // Ако единицата е entrenched, махаме entrenched
    if (gameData.selectedUnit.entrenched) {
        gameData.selectedUnit.entrenched = false;
    }

    gameData.selectedUnit = null;
    return true;
}

// Проверка дали движението е към собствената територия
function isMovementTowardOwnTerritory(player, newX, newY) {
    // Проверяваме дали новата позиция е в територията на играча
    return isInOwnTerritory(player, newX, newY);
}
// Изчисляване на средна посока между две единици
function calculateAverageDirection(unit1, unit2) {
    if (unit1.direction === null && unit2.direction === null) {
        return null;
    }
    
    if (unit1.direction === null) return unit2.direction;
    if (unit2.direction === null) return unit1.direction;
    
    let x1 = Math.cos(unit1.direction);
    let y1 = Math.sin(unit1.direction);
    let x2 = Math.cos(unit2.direction);
    let y2 = Math.sin(unit2.direction);
    
    let avgX = (x1 + x2) / 2;
    let avgY = (y1 + y2) / 2;
    
    let length = Math.sqrt(avgX**2 + avgY**2);
    if (length > 0.001) {
        avgX /= length;
        avgY /= length;
    }
    
    return Math.atan2(avgY, avgX);
}

// Проверка и избутване на единици твърде близо до фронта
function checkUnitsDistanceFromFront() {
    const scale = getUnitScale();
    let minDistance = (gameData.BuSeCapitalsLocked ? 2.5 : 1.5) * UNIT_RADIUS * scale;
    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            // Не избутвай, ако вече е избутван или се движи
            if (unit.beingPushed || unit.isMoving) continue;

            let closestPoint = null;
            let closestDist = Infinity;
            for (let point of gameData.frontLine) {
                let dist = Math.sqrt((unit.x - point[0])**2 + (unit.y - point[1])**2);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestPoint = point;
                }
            }
            // Ако е твърде близо, избутай така че да е точно на minDistance
            if (closestDist < minDistance && closestPoint) {
                let pushDirX = unit.x - closestPoint[0];
                let pushDirY = unit.y - closestPoint[1];
                let pushLen = Math.sqrt(pushDirX**2 + pushDirY**2);
                if (pushLen > 0.001) {
                    pushDirX /= pushLen;
                    pushDirY /= pushLen;
                } else {
                    // Ако е точно върху фронта, избутай надясно/наляво според играча
                    pushDirX = player === 0 ? -1 : 1;
                    pushDirY = 0;
                }
                // Use special push distance for BuSe map
                let pushDistance = minDistance - closestDist + 1; // +1 за сигурност
                unit.beingPushed = true;
                unit.prevX = unit.x;
                unit.pushTargetX = unit.x + pushDirX * pushDistance;
                unit.pushTargetY = unit.y + pushDirY * pushDistance;
                unit.pushProgress = 0;
            }
        }
    }
}

function checkAndPushUnits(pointIdx, newPoint, direction, pushingPlayer) {
    const scale = getUnitScale();
    let [px, py] = gameData.frontLine[pointIdx];
    let [newPx, newPy] = newPoint;
    let opponent = 1 - pushingPlayer;
    // Use special distance for BuSe map
    let minPushDistance = (gameData.BuSeCapitalsLocked ? 2.5 : 1.5) * UNIT_RADIUS * scale;
    for (let unit of gameData.playerUnits[opponent]) {
        let dist = Math.sqrt((unit.x - newPx)**2 + (unit.y - newPy)**2);
        if (dist < minPushDistance) {
            let pushDistance = minPushDistance - dist;
            let pushDirX = Math.cos(direction);
            let pushDirY = Math.sin(direction);
            unit.beingPushed = true;
            unit.prevX = unit.x;
            unit.pushTargetX = unit.x + pushDirX * pushDistance;
            unit.pushTargetY = unit.y + pushDirY * pushDistance;
            unit.pushProgress = 0;
        }
    }
}

// Откриване и премахване на примки във фронтовата линия
function detectAndRemoveLoops() {
    if (gameData.frontLine.length < 3) return;

    let n = gameData.frontLine.length;
    const TOUCH_DIST = 5; // Праг за "докосване" в пиксели

    for (let i = 0; i < n - 2; i++) {
        for (let j = i + 2; j < n - 1; j++) {
            // Не сравняваме съседни сегменти
            if (j === i + 1) continue;
            const A = gameData.frontLine[i];
            const B = gameData.frontLine[i + 1];
            const C = gameData.frontLine[j];
            const D = gameData.frontLine[j + 1];

            // 1. Реално пресичане
            if (doSegmentsIntersect(A, B, C, D)) {
                const pointsToRemove = gameData.frontLine.slice(i + 1, j + 1);
                gameData.frontLine = [
                    ...gameData.frontLine.slice(0, i + 1),
                    ...gameData.frontLine.slice(j + 1)
                ];
                removeUnitsInLoop([A, ...pointsToRemove, D]);
                return;
            }

            // 2. Докосване на краища (ако B и C са много близо)
            const dx = B[0] - C[0];
            const dy = B[1] - C[1];
            if (Math.hypot(dx, dy) < TOUCH_DIST) {
                const pointsToRemove = gameData.frontLine.slice(i + 1, j + 1);
                gameData.frontLine = [
                    ...gameData.frontLine.slice(0, i + 1),
                    ...gameData.frontLine.slice(j + 1)
                ];
                removeUnitsInLoop([A, ...pointsToRemove, D]);
                return;
            }
        }
    }
}

// Помощна функция за проверка на пресичане на сегменти
function doSegmentsIntersect(A, B, C, D) {
    function ccw(p1, p2, p3) {
        return (p3[1]-p1[1])*(p2[0]-p1[0]) > (p2[1]-p1[1])*(p3[0]-p1[0]);
    }
    return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
}
function drawSelectedUnits() {
    if (gameData.selectedUnits.length === 0) return;
    
    // Рисуване на свързващи линии към центъра на селекцията
    if (gameData.selectionStart && gameData.selectionEnd) {
        const minX = Math.min(gameData.selectionStart[0], gameData.selectionEnd[0]);
        const maxX = Math.max(gameData.selectionStart[0], gameData.selectionEnd[0]);
        const minY = Math.min(gameData.selectionStart[1], gameData.selectionEnd[1]);
        const maxY = Math.max(gameData.selectionStart[1], gameData.selectionEnd[1]);
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        ctx.beginPath();
        for (const unit of gameData.selectedUnits) {
            ctx.moveTo(unit.x, unit.y);
            ctx.lineTo(centerX, centerY);
        }
        ctx.strokeStyle = "rgba(0, 255, 0, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}
// Премахване на единици вътре в примка
function removeUnitsInLoop(loopPoints) {
    if (loopPoints.length < 3) return;
    
    // Създаваме затворен полигон
    const polygon = [...loopPoints, loopPoints[0]];
    
    for (let player of [0, 1]) {
        gameData.playerUnits[player] = gameData.playerUnits[player].filter(unit => {
            // Проверяваме дали единицата е в примката
            const inside = pointInPolygon([unit.x, unit.y], polygon);
            
            // Ако единицата е в примката, премахваме я
            return !inside;
        });
    }
}

//проверка на пресичане на сегменти (остава същата)
function doSegmentsIntersect(A, B, C, D) {
    function ccw(p1, p2, p3) {
        return (p3[1]-p1[1])*(p2[0]-p1[0]) > (p2[1]-p1[1])*(p3[0]-p1[0]);
    }
    return ccw(A, C, D) !== ccw(B, C, D) && ccw(A, B, C) !== ccw(A, B, D);
}
// Проверка дали точка е вътре в полигон
function pointInPolygon(point, polygon) {
    let [x, y] = point;
    let n = polygon.length;
    let inside = false;
    let xinters;
    
    let [p1x, p1y] = polygon[0];
    for (let i = 1; i <= n; i++) {
        let [p2x, p2y] = polygon[i % n];
        if (y > Math.min(p1y, p2y)) {
            if (y <= Math.max(p1y, p2y)) {
                if (x <= Math.max(p1x, p2x)) {
                    if (p1y !== p2y) {
                        xinters = (y-p1y)*(p2x-p1x)/(p2y-p1y)+p1x;
                    }
                    if (p1x === p2x || x <= xinters) {
                        inside = !inside;
                    }
                }
            }
        }
        [p1x, p1y] = [p2x, p2y];
    }
    
    return inside;
}
window.gameData = gameData;
window.game = game;
window.canvas = canvas;
window.ctx = ctx;

// Add touch event handlers
canvas.addEventListener('touchstart', handleTouchStart, false);
canvas.addEventListener('touchmove', handleTouchMove, false);
canvas.addEventListener('touchend', handleTouchEnd, false);

let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;

function handleTouchStart(event) {
    event.preventDefault();
    isTouching = true;
    const touch = event.touches[0];
    touchStartX = touch.clientX - canvas.offsetLeft;
    touchStartY = touch.clientY - canvas.offsetTop;
    
    // Convert touch to click
    const clickEvent = {
        clientX: touchStartX,
        clientY: touchStartY,
        button: 0 // Left click
    };
    handleClick(clickEvent);
}

function handleTouchMove(event) {
    event.preventDefault();
    if (!isTouching) return;
    
    const touch = event.touches[0];
    const currentX = touch.clientX - canvas.offsetLeft;
    const currentY = touch.clientY - canvas.offsetTop;
    
    // Handle drag events if needed
    if (gameData.selectedUnit) {
        handleArrowDirection([currentX, currentY], 0);
    }
}

function handleTouchEnd(event) {
    event.preventDefault();
    isTouching = false;
}

// Add scale factor for mobile screens
function getUnitScale() {
    // Get the smaller dimension to scale proportionally
    const screenScale = Math.min(
        canvas.width / 700,  // Original width
        canvas.height / 600  // Original height
    );
    return Math.max(0.5, Math.min(1, screenScale));
}

// 1. Fix battle calculation with more accurate strength comparison
function calculateBattle() {
    // Save old positions
    const oldFrontLine = gameData.frontLine.map(point => [...point]);
    gameData.battlePhase = true;
    gameData.turnCount++;

    // Reset unit states
    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            unit.assignedPoints = [];
            unit.totalPoints = 0;
            unit.partialPoints = 0;
            unit.forwardMoves = 0;
            unit.prevX = unit.x;
            unit.prevY = unit.y;
            unit.isMoving = false;
            unit.moveProgress = 0;
            unit.blockedByFront = false;
            unit.beingPushed = false;
            unit.pushProgress = 0;
        }
    }

    const MAX_FRONT_MOVE = 10;
    const scale = getUnitScale();
    const maxUnitDist = BLACK_ARROW_LENGTH * scale;
    let futureFrontLine = gameData.frontLine.map(point => [...point]);
    
    // Process each point on the frontline
    for (let pointIdx = 0; pointIdx < gameData.frontLine.length; pointIdx++) {
        let [px, py] = gameData.frontLine[pointIdx];
        let closest = [[], []];

        // Find closest units
        for (let player of [0, 1]) {
            for (let unit of gameData.playerUnits[player]) {
                let dist = Math.hypot(unit.x - px, unit.y - py);
                if (dist <= maxUnitDist) {
                    // Ако е entrenched, сила = 2/(dist+1), иначе 1/(dist+1)
                    let strength = unit.entrenched ? 2.0 / (dist + 1) : 1.0 / (dist + 1);
                    closest[player].push({ unit, dist, strength });
                }
            }
            // Сортираме по сила (най-силните първи)
            closest[player].sort((a, b) => b.strength - a.strength);
        }

        // Calculate strengths and determine winning units
        let strengths = [0, 0];
        let winningUnits = [null, null];

        for (let player of [0, 1]) {
            let unitsInfo = closest[player];
            if (unitsInfo.length >= 2 && Math.abs(unitsInfo[0].dist - unitsInfo[1].dist) < 0.1) {
                // Ако и двете са entrenched, сила = 2+2=4
                strengths[player] = unitsInfo[0].strength + unitsInfo[1].strength;
                winningUnits[player] = [unitsInfo[0].unit, unitsInfo[1].unit];
            } else if (unitsInfo.length >= 1) {
                strengths[player] = unitsInfo[0].strength;
                winningUnits[player] = unitsInfo[0].unit;
            }
        }

        // Handle special cases for first and last points
        if (pointIdx === 0 || pointIdx === gameData.frontLine.length - 1) {
            const isTop = pointIdx === 0;
            const y = isTop ? 0 : canvas.height;
            
            if (strengths[0] > strengths[1]) {
                let moveX = Math.min(MAX_FRONT_MOVE, 5);
                let newX = px + moveX;
                if (!isInSeaZone(newX, y) && !isMovementTowardOwnTerritory(0, newX, y)) {
                    futureFrontLine[pointIdx][0] = newX;
                }
            } else if (strengths[1] > strengths[0]) {
                let moveX = Math.min(MAX_FRONT_MOVE, 5);
                let newX = px - moveX;
                if (!isInSeaZone(newX, y) && !isMovementTowardOwnTerritory(1, newX, y)) {
                    futureFrontLine[pointIdx][0] = newX;
                }
            }
            futureFrontLine[pointIdx][1] = y;
            continue;
        }

        // Handle regular points
        if (strengths[0] > strengths[1] && winningUnits[0]) {
            let winner = Array.isArray(winningUnits[0]) ? winningUnits[0][0] : winningUnits[0];
            if (winner.entrenched) continue;
            if (Array.isArray(winningUnits[0])) {
                let [unit1, unit2] = winningUnits[0];
                let avgDirection = calculateAverageDirection(unit1, unit2);
                if (avgDirection !== null) {
                    let moveDistance = Math.min(MAX_FRONT_MOVE, 5);
                    let newPx = px + moveDistance * Math.cos(avgDirection);
                    let newPy = py + moveDistance * Math.sin(avgDirection);
                    
                    if (!isInSeaZone(newPx, newPy) && !isMovementTowardOwnTerritory(0, newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], avgDirection, 0);
                        futureFrontLine[pointIdx] = [newPx, newPy];
                    }
                }
            } else {
                let unit = winningUnits[0];
                if (unit.direction !== null) {
                    let moveDistance = Math.min(MAX_FRONT_MOVE, 5);
                    let newPx = px + moveDistance * Math.cos(unit.direction);
                    let newPy = py + moveDistance * Math.sin(unit.direction);
                    
                    if (!isInSeaZone(newPx, newPy) && !isMovementTowardOwnTerritory(0, newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], unit.direction, 0);
                        futureFrontLine[pointIdx] = [newPx, newPy];
                    }
                }
            }
        } else if (strengths[1] > strengths[0] && winningUnits[1]) {
            let winner = Array.isArray(winningUnits[1]) ? winningUnits[1][0] : winningUnits[1];
            if (winner.entrenched) continue;
            // Similar logic for player 1
            if (Array.isArray(winningUnits[1])) {
                let [unit1, unit2] = winningUnits[1];
                let avgDirection = calculateAverageDirection(unit1, unit2);
                if (avgDirection !== null) {
                    let moveDistance = Math.min(MAX_FRONT_MOVE, 5);
                    let newPx = px - moveDistance * Math.cos(avgDirection);
                    let newPy = py - moveDistance * Math.sin(avgDirection);
                    
                    if (!isInSeaZone(newPx, newPy) && !isMovementTowardOwnTerritory(1, newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], avgDirection + Math.PI, 1);
                        futureFrontLine[pointIdx] = [newPx, newPy];
                    }
                }
            }
        }
    }

    // Apply changes and post-process
    gameData.frontLine = futureFrontLine;
    detectAndRemoveLoops();
    adjustFrontLine();
    checkFrontLineEdgeLoops();
    clampFrontLineToLand();
    
    // Update unit positions
    checkUnitsBehindFront();
    prepareUnitMovements();
    checkForLoss();
}

function detectAndRemoveLoops() {
    if (gameData.frontLine.length < 3) return;

    const TOUCH_DIST = 5; // Праг за "докосване" в пиксели
    let foundLoop = false;
    let loopRemoved = false;

    do {
        foundLoop = false;
        const n = gameData.frontLine.length;

        // Проверка за пресичания между сегменти
        for (let i = 0; i < n - 2 && !foundLoop; i++) {
            for (let j = i + 2; j < n - 1 && !foundLoop; j++) {
                // Не сравняваме съседни сегменти
                if (j === i + 1) continue;

                const A = gameData.frontLine[i];
                const B = gameData.frontLine[i + 1];
                const C = gameData.frontLine[j];
                const D = gameData.frontLine[j + 1];

                // 1. Проверка за реално пресичане
                if (doSegmentsIntersect(A, B, C, D)) {
                    const pointsToRemove = gameData.frontLine.slice(i + 1, j + 1);
                    gameData.frontLine = [
                        ...gameData.frontLine.slice(0, i + 1),
                        ...gameData.frontLine.slice(j + 1)
                    ];
                    removeUnitsInLoop([A, ...pointsToRemove, D]);
                    foundLoop = true;
                    loopRemoved = true;
                    break;
                }

                // 2. Проверка за докосване на краища (ако B и C са много близо)
                const dx = B[0] - C[0];
                const dy = B[1] - C[1];
                if (Math.hypot(dx, dy) < TOUCH_DIST) {
                    const pointsToRemove = gameData.frontLine.slice(i + 1, j + 1);
                    gameData.frontLine = [
                        ...gameData.frontLine.slice(0, i + 1),
                        ...gameData.frontLine.slice(j + 1)
                    ];
                    removeUnitsInLoop([A, ...pointsToRemove, D]);
                    foundLoop = true;
                    loopRemoved = true;
                    break;
                }
            }
        }

        // 3. Проверка за примки по ръбовете на екрана
        if (!foundLoop) {
            checkFrontLineEdgeLoops();
        }
    } while (foundLoop);

    return loopRemoved;
}
// 3. Improve point spacing adjustment
function adjustFrontLine() {
    if (!gameData.originalYPositions || gameData.originalYPositions.length === 0) {
        initializeFrontLine();
        return;
    }

    const minSpacing = gameData.initialSpacing * 0.7;
    const maxSpacing = gameData.initialSpacing * 1.5;
    const maxPoints = 200;

    // Remove points that are too close
    let newLine = [gameData.frontLine[0]];
    for (let i = 1; i < gameData.frontLine.length - 1; i++) {
        const prev = newLine[newLine.length - 1];
        const curr = gameData.frontLine[i];
        const dist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
        
        if (dist >= minSpacing) {
            newLine.push([...curr]);
        }
    }
    newLine.push([...gameData.frontLine[gameData.frontLine.length - 1]]);

    // Add points where spacing is too large
    let finalLine = [newLine[0]];
    for (let i = 1; i < newLine.length; i++) {
        const prev = finalLine[finalLine.length - 1];
        const curr = newLine[i];
        const dx = curr[0] - prev[0];
        const dy = curr[1] - prev[1];
        const dist = Math.hypot(dx, dy);
        
        if (dist > maxSpacing) {
            const segments = Math.ceil(dist / maxSpacing);
            for (let j = 1; j < segments; j++) {
                const t = j / segments;
                finalLine.push([
                    prev[0] + dx * t,
                    prev[1] + dy * t
                ]);
            }
        }
        finalLine.push([...curr]);
    }

    // Ensure edges stay at y=0 and y=canvas.height
    finalLine[0][1] = 0;
    finalLine[finalLine.length - 1][1] = canvas.height;

    gameData.frontLine = finalLine;
}