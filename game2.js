// Проверка за задължителни глобални променливи
if (!window.gameData || !window.game) {
    console.error("Грешка: game.js трябва да се зареди преди game2.js!");
}
// Изчисляване на битка


// Изчисляване на битка
function calculateBattle() {
    if (gameData.frontLine.length === 0) {
        initializeFrontLine();
        return;
    }

    // Запазваме старите позиции на фронтовата линия
    window.oldFrontLine = gameData.frontLine.map(point => [...point]);

    gameData.battlePhase = true;
    gameData.turnCount++;

    // Инициализация на всички единици
    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            unit.assignedPoints = unit.assignedPoints || [];
            unit.totalPoints = unit.totalPoints || 0;
            unit.partialPoints = unit.partialPoints || 0;
            unit.forwardMoves = unit.forwardMoves || 0;
            
            unit.prevX = unit.x;
            unit.prevY = unit.y;
            unit.isMoving = false;
            unit.moveProgress = 0;
            unit.blockedByFront = false;
            unit.beingPushed = false;
            unit.pushProgress = 0;

            if (gameData.turnCount > 1) {
                unit.blueArrow = null;
            }
        }
    }

    // Обработка на всяка точка от фронтовата линия
    gameData.frontLineWinners = [null, null];
    let futureFrontLine = gameData.frontLine.map(point => [...point]);
    
    // Максимално разстояние за движение на фронтовата линия
    const MAX_FRONT_MOVE = 10;
    
    for (let pointIdx = 0; pointIdx < gameData.frontLine.length; pointIdx++) {
        let [px, py] = gameData.frontLine[pointIdx];
        let closest = [[], []];  // [player0, player1]
        const scale = getUnitScale();
        const maxUnitDist = BLACK_ARROW_LENGTH * scale;

        // Намиране на най-близките единици за всеки играч
        for (let player of [0, 1]) {
            for (let unit of gameData.playerUnits[player]) {
                let dist = Math.sqrt((unit.x - px)**2 + (unit.y - py)**2);
                if (dist <= maxUnitDist) {
                    closest[player].push({ unit, dist });
                }
            }
            closest[player].sort((a, b) => a.dist - b.dist);
        }

        // Присвояване на точки и изчисляване на влиянието
        for (let player of [0, 1]) {
            let unitsInfo = closest[player];
            if (unitsInfo.length === 0) continue;

            if (unitsInfo.length >= 2) {
                let unit1 = unitsInfo[0].unit;
                let unit2 = unitsInfo[1].unit;
                let dist1 = unitsInfo[0].dist;
                let dist2 = unitsInfo[1].dist;

                if (Math.abs(dist1 - dist2) < 0.1) {
                    unit1.assignedPoints.push([px, py]);
                    unit2.assignedPoints.push([px, py]);
                    unit1.partialPoints += 0.5;
                    unit2.partialPoints += 0.5;
                } else {
                    unitsInfo[0].unit.assignedPoints.push([px, py]);
                    unitsInfo[0].unit.totalPoints += 1;
                }
            } else {
                unitsInfo[0].unit.assignedPoints.push([px, py]);
                unitsInfo[0].unit.totalPoints += 1;
            }
        }

        // Изчисляване на силата на двата играча за текущата точка
        let strengths = [0, 0];
        let winningUnits = [null, null];

        for (let player of [0, 1]) {
            let unitsInfo = closest[player];
            if (unitsInfo.length >= 2 && Math.abs(unitsInfo[0].dist - unitsInfo[1].dist) < 0.1) {
                strengths[player] = 1.0;
                winningUnits[player] = [unitsInfo[0].unit, unitsInfo[1].unit];
            } else if (unitsInfo.length >= 1) {
                let unit = unitsInfo[0].unit;
                strengths[player] = 1.0 / (unit.assignedPoints.length + 1);
                winningUnits[player] = unit;
            } else {
                strengths[player] = 0;
                winningUnits[player] = null;
            }
        }

        // --- Логика за движение на точките ---
        if (pointIdx === 0) {
            // Специална обработка за първата точка (горен ръб)
            if (strengths[0] > strengths[1]) {
                gameData.frontLineWinners[0] = 0;
                let moveX = Math.min(MAX_FRONT_MOVE, 5);
                let newX = gameData.frontLine[0][0] + moveX;
                if (!isInSeaZone(newX, 0) && !isMovementTowardOwnTerritory(0, newX, 0)) {
                    futureFrontLine[0][0] = newX;
                }
            } else if (strengths[1] > strengths[0]) {
                gameData.frontLineWinners[0] = 1;
                let moveX = Math.min(MAX_FRONT_MOVE, 5);
                let newX = gameData.frontLine[0][0] - moveX;
                if (!isInSeaZone(newX, 0) && !isMovementTowardOwnTerritory(1, newX, 0)) {
                    futureFrontLine[0][0] = newX;
                }
            }
            futureFrontLine[0][1] = 0;
            continue;
        }
        
        if (pointIdx === gameData.frontLine.length - 1) {
            // Специална обработка за последната точка (долен ръб)
            if (strengths[0] > strengths[1]) {
                gameData.frontLineWinners[1] = 0;
                let moveX = Math.min(MAX_FRONT_MOVE, 5);
                let newX = gameData.frontLine[pointIdx][0] + moveX;
                if (!isInSeaZone(newX, canvas.height) && !isMovementTowardOwnTerritory(0, newX, canvas.height)) {
                    futureFrontLine[pointIdx][0] = newX;
                }
            } else if (strengths[1] > strengths[0]) {
                gameData.frontLineWinners[1] = 1;
                let moveX = Math.min(MAX_FRONT_MOVE, 5);
                let newX = gameData.frontLine[pointIdx][0] - moveX;
                if (!isInSeaZone(newX, canvas.height) && !isMovementTowardOwnTerritory(1, newX, canvas.height)) {
                    futureFrontLine[pointIdx][0] = newX;
                }
            }
            futureFrontLine[pointIdx][1] = canvas.height;
            continue;
        }

        // Обработка на обикновените точки
        if (strengths[0] > strengths[1] && winningUnits[0]) {
            if (Array.isArray(winningUnits[0])) {
                let [unit1, unit2] = winningUnits[0];
                let avgDirection = calculateAverageDirection(unit1, unit2);
                if (avgDirection !== null) {
                    let newPx = px + Math.min(MAX_FRONT_MOVE, 5 * Math.cos(avgDirection));
                    let newPy = py + Math.min(MAX_FRONT_MOVE, 5 * Math.sin(avgDirection));
                    
                    // Проверяваме дали движението е валидно
                    if (!isInSeaZone(newPx, newPy) && !isMovementTowardOwnTerritory(0, newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], avgDirection, 0);
                        futureFrontLine[pointIdx] = [newPx, newPy];
                    } else {
                        futureFrontLine[pointIdx] = [px, py];
                    }
                }
            } else {
                let unit = winningUnits[0];
                if (unit.direction !== null) {
                    let newPx = px + Math.min(MAX_FRONT_MOVE, 5 * Math.cos(unit.direction));
                    let newPy = py + Math.min(MAX_FRONT_MOVE, 5 * Math.sin(unit.direction));
                    
                    // Проверяваме дали движението е валидно
                    if (!isInSeaZone(newPx, newPy) && !isMovementTowardOwnTerritory(0, newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], unit.direction, 0);
                        futureFrontLine[pointIdx] = [newPx, newPy];
                    } else {
                        futureFrontLine[pointIdx] = [px, py];
                    }
                }
            }
        } else if (strengths[1] > strengths[0] && winningUnits[1]) {
            if (Array.isArray(winningUnits[1])) {
                let [unit1, unit2] = winningUnits[1];
                let avgDirection = calculateAverageDirection(unit1, unit2);
                if (avgDirection !== null) {
                    let newPx = px + Math.min(MAX_FRONT_MOVE, 5 * Math.cos(avgDirection));
                    let newPy = py + Math.min(MAX_FRONT_MOVE, 5 * Math.sin(avgDirection));
                    
                    // Проверяваме дали движението е валидно
                    if (!isInSeaZone(newPx, newPy) && !isMovementTowardOwnTerritory(1, newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], avgDirection, 1);
                        futureFrontLine[pointIdx] = [newPx, newPy];
                    } else {
                        futureFrontLine[pointIdx] = [px, py];
                    }
                }
            } else {
                let unit = winningUnits[1];
                if (unit.direction !== null) {
                    let newPx = px + Math.min(MAX_FRONT_MOVE, 5 * Math.cos(unit.direction));
                    let newPy = py + Math.min(MAX_FRONT_MOVE, 5 * Math.sin(unit.direction));
                    
                    // Проверяваме дали движението е валидно
                    if (!isInSeaZone(newPx, newPy) && !isMovementTowardOwnTerritory(1, newPx, newPy)) {
                        checkAndPushUnits(pointIdx, [newPx, newPy], unit.direction, 1);
                        futureFrontLine[pointIdx] = [newPx, newPy];
                    } else {
                        futureFrontLine[pointIdx] = [px, py];
                    }
                }
            }
        }
    }

    // Проверка за примки и корекция на фронтовата линия
    let savedFrontLine = gameData.frontLine;
    gameData.frontLine = futureFrontLine.map(p => [...p]);
    detectAndRemoveLoops();
    adjustFrontLine();
    checkFrontLineEdgeLoops();

    // Корекция на точките, които са в територията на победителя
    for (let i = 0; i < gameData.frontLine.length; i++) {
        let winner = null;
        if (i === 0 && gameData.frontLineWinners) winner = gameData.frontLineWinners[0];
        else if (i === gameData.frontLine.length - 1 && gameData.frontLineWinners) winner = gameData.frontLineWinners[1];
        
        // Използвай window.oldFrontLine и провери дали съществува и има нужната дължина
        if (
            winner !== null &&
            typeof window.oldFrontLine !== "undefined" &&
            Array.isArray(window.oldFrontLine) &&
            window.oldFrontLine[i] &&
            window.oldFrontLine[i].length === 2 &&
            isInOwnTerritory(winner, gameData.frontLine[i][0], gameData.frontLine[i][1])
        ) {
            gameData.frontLine[i][0] = window.oldFrontLine[i][0];
            gameData.frontLine[i][1] = window.oldFrontLine[i][1];
        }
    }

    // Проверка за единици зад фронтовата линия
    checkUnitsBehindFront();

    // Подготовка на движенията на единиците
    prepareUnitMovements();
    checkForLoss();
}

// Нови помощни функции:

// Проверка за единици зад фронтовата линия
function checkUnitsBehindFront() {
    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            const isBehind = isUnitBehindFrontLine(unit, player);
            if (isBehind) {
                // Връщане на единицата на безопасна позиция
                unit.x = unit.prevX;
                unit.y = unit.prevY;
                unit.targetX = unit.prevX;
                unit.targetY = unit.prevY;
                unit.isMoving = false;
            }
        }
    }
}

// Проверка дали единица е зад фронтовата линия
function isUnitBehindFrontLine(unit, player) {
    // Намираме най-близката точка от фронтовата линия
    let closestDist = Infinity;
    let closestPoint = null;
    
    for (let point of gameData.frontLine) {
        const dist = Math.hypot(unit.x - point[0], unit.y - point[1]);
        if (dist < closestDist) {
            closestDist = dist;
            closestPoint = point;
        }
    }
    
    if (!closestPoint) return false;
    
    // Определяме ориентацията на фронтовата линия в тази точка
    const frontAngle = getFrontAngleAtPoint(closestPoint);
    const unitAngle = Math.atan2(closestPoint[1] - unit.y, closestPoint[0] - unit.x);
    
    // Изчисляваме разликата в ъглите
    let angleDiff = normalizeAngle(unitAngle - frontAngle);
    
    // Ако единицата е от грешната страна спрямо фронтовата линия
    if (player === 0 && angleDiff > 0 && angleDiff < Math.PI) {
        return true;
    }
    if (player === 1 && (angleDiff < 0 || angleDiff > Math.PI)) {
        return true;
    }
    
    return false;
}

// Нормализиране на ъгъл в диапазона [0, 2π)
function normalizeAngle(angle) {
    while (angle < 0) angle += 2 * Math.PI;
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    return angle;
}

// Връща ъгъла на фронтовата линия в дадена точка
function getFrontAngleAtPoint(point) {
    const idx = gameData.frontLine.findIndex(p => p[0] === point[0] && p[1] === point[1]);
    if (idx <= 0 || idx >= gameData.frontLine.length - 1) {
        return Math.PI/2; // Вертикална линия за крайните точки
    }
    
    const prev = gameData.frontLine[idx - 1];
    const next = gameData.frontLine[idx + 1];
    return Math.atan2(next[1] - prev[1], next[0] - prev[0]);
}
// Корекция на фронтовата линия
function adjustFrontLine() {
    if (!gameData.originalYPositions || gameData.originalYPositions.length === 0) {
        initializeFrontLine();
        return;
    }

    const minSpacing = gameData.initialSpacing * 0.7;
    const maxSpacing = gameData.initialSpacing * 1.5;
    const maxPoints = 200;

    // Винаги запазваме първата и последната точка
    let newLine = [gameData.frontLine[0].slice()];
    
    // 1. Премахваме точките, които са твърде близо
    for (let i = 1; i < gameData.frontLine.length - 1; i++) {
        const prev = newLine[newLine.length - 1];
        const curr = gameData.frontLine[i];
        const dist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
        
        if (dist >= minSpacing) {
            newLine.push(curr.slice());
        }
    }
    
    // Добавяме последната точка
    newLine.push(gameData.frontLine[gameData.frontLine.length - 1].slice());

    // 2. Добавяме точки при големи разстояния (гарантираме че няма прекалено големи празнини)
    let finalLine = [newLine[0].slice()];
    for (let i = 1; i < newLine.length; i++) {
        const prev = finalLine[finalLine.length - 1];
        const curr = newLine[i];
        const dx = curr[0] - prev[0];
        const dy = curr[1] - prev[1];
        const dist = Math.hypot(dx, dy);

        // Основна промяна: добавяме точно толкова точки, колкото са нужни
        if (dist > maxSpacing) {
            const numSegments = Math.ceil(dist / maxSpacing);
            const step = 1 / numSegments;
            
            for (let j = 1; j < numSegments; j++) {
                const t = j * step;
                const x = prev[0] + dx * t;
                const y = prev[1] + dy * t;
                finalLine.push([x, y]);
            }
        }
        finalLine.push(curr.slice());
    }

    // 3. Ограничаваме броя точки
    if (finalLine.length > maxPoints) {
        finalLine = interpolateFrontLine(finalLine, maxPoints);
    }

    // 4. Коригираме крайните точки
    finalLine[0][1] = 0;
    finalLine[finalLine.length - 1][1] = canvas.height;

    gameData.frontLine = finalLine;
    clampFrontLineToLand();
    checkFrontLineEdgeLoops();
}
// Гарантира, че никоя точка от фронтовата линия не е в морето (освен ако е крайна)
function clampFrontLineToLand() {
    // Пропускаме първата и последната точка (крайните)
    for (let i = 1; i < gameData.frontLine.length - 1; i++) {
        let [x, y] = gameData.frontLine[i];
        if (isInSeaZone(x, y)) {
            // Върни точката на предишната сухоземна позиция (или просто не я мести)
            // Тук ще върнем към предишната позиция, ако има такава
            // Ако няма, просто не местим (оставяме я на ръба)
            // За целта пазим старата линия в calculateBattle
            if (typeof oldFrontLine !== "undefined" && oldFrontLine[i]) {
                gameData.frontLine[i][0] = oldFrontLine[i][0];
                gameData.frontLine[i][1] = oldFrontLine[i][1];
            }
        }
    }
}

// Подготовка на движенията на единиците
function prepareUnitMovements() {
    const scale = getUnitScale();
    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            if (unit.blueArrow) {
                let [endX, endY] = unit.blueArrow;
                let dx = endX - unit.x;
                let dy = endY - unit.y;
                let dist = Math.hypot(dx, dy);
                let maxLen = BLUE_ARROW_LENGTH * scale;
                if (dist > maxLen) {
                    let s = maxLen / dist;
                    endX = unit.x + dx * s;
                    endY = unit.y + dy * s;
                }
                unit.targetX = endX;
                unit.targetY = endY;
                unit.isMoving = true;
                unit.moveProgress = 0;
            } else if (unit.direction !== null) {
                let endX = unit.x + BLACK_ARROW_LENGTH * scale * Math.cos(unit.direction);
                let endY = unit.y + BLACK_ARROW_LENGTH * scale * Math.sin(unit.direction);
                unit.targetX = endX;
                unit.targetY = endY;
                unit.isMoving = true;
                unit.moveProgress = 0;
            }
        }
    }
}
// Проверка дали единица е в селекционния правоъгълник
function isUnitInSelection(unit) {
    if (!gameData.selectionStart || !gameData.selectionEnd) return false;
    
    const minX = Math.min(gameData.selectionStart[0], gameData.selectionEnd[0]);
    const maxX = Math.max(gameData.selectionStart[0], gameData.selectionEnd[0]);
    const minY = Math.min(gameData.selectionStart[1], gameData.selectionEnd[1]);
    const maxY = Math.max(gameData.selectionStart[1], gameData.selectionEnd[1]);
    
    return unit.x >= minX && unit.x <= maxX && unit.y >= minY && unit.y <= maxY;
}

// Рисуване на селекционния правоъгълник
function drawSelection() {
    if (gameData.selectionStart && gameData.selectionEnd) {
        const scale = getUnitScale();
        const [x1, y1] = gameData.selectionStart;
        const [x2, y2] = gameData.selectionEnd;
        ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.beginPath();
        ctx.rect(x1, y1, x2 - x1, y2 - y1);
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = 3 * scale;
        ctx.setLineDash([5 * scale, 3 * scale]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
    }
}

// Обработка на групово задаване на стрелки
function handleGroupArrowDirection(pos, button) {
    if (gameData.selectedUnits.length === 0) return false;
    
    // Изчисляваме центъра на селекцията
    let centerX = 0, centerY = 0;
    for (const unit of gameData.selectedUnits) {
        centerX += unit.x;
        centerY += unit.y;
    }
    centerX /= gameData.selectedUnits.length;
    centerY /= gameData.selectedUnits.length;
    
    const [x, y] = pos;
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx**2 + dy**2);
    
    for (const unit of gameData.selectedUnits) {
        if (button === 2) {  // Десен бутон - синя стрелка (2x дължина)
            const maxDist = BLUE_ARROW_LENGTH;
            const scaledDx = dx * maxDist / dist;
            const scaledDy = dy * maxDist / dist;
            unit.blueArrow = [unit.x + scaledDx, unit.y + scaledDy];
            unit.direction = null;
        } else {  // Ляв бутон - черна стрелка
            unit.direction = Math.atan2(dy, dx);
            unit.blueArrow = null;
        }
    }
    
    resetSelection();
    return true;
}
// Обновяване на позициите на единиците
function updateUnits() {
    let allStopped = true;
    let anyPushing = false;

    for (let player of [0, 1]) {
        for (let unit of gameData.playerUnits[player]) {
            if (unit.beingPushed) {
                unit.updatePosition();
                anyPushing = true;
                allStopped = false;
            }
        }
    }

    if (!anyPushing) {
        for (let player of [0, 1]) {
            for (let unit of gameData.playerUnits[player]) {
                if (!unit.beingPushed) {
                    unit.updatePosition();
                    if (unit.isMoving) {
                        allStopped = false;
                    }
                }
            }
        }

        checkUnitsDistanceFromFront();
    }

    if (allStopped && gameData.battlePhase) {
        if (gameData.turnCount >= gameData.maxTurns) {
            gameData.battlePhase = false;
            gameData.phase = "player1_arrows";
            gameData.currentPlayer = 0;
            gameData.turnCount = 0;

            // Reset unit directions
            for (let player of [0, 1]) {
                for (let unit of gameData.playerUnits[player]) {
                    unit.direction = null;
                    unit.blueArrow = null;
                }
            }

            readyBtn.classList.remove('hidden');
        } else {
            calculateBattle();
        }
    }
    // Проверка за загуба
    checkForLoss();
}

// Рисуване на играта
function drawGame() {
    // Clear the visible canvas before applying transforms
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    applyViewTransform(ctx);

    // BuSe карта: фон изображение
    if (document.getElementById('map-select') && document.getElementById('map-select').value === 'BuSe') {
        if (!drawGame.bgImg) {
            drawGame.bgImg = new Image();
            drawGame.bgImg.src = 'map1.png';
        }
        ctx.globalAlpha = 1.0;
        // Draw background image in world coordinates
        ctx.drawImage(drawGame.bgImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    } else {
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // --- Рисуване на морето (BuSe карта) ---
    if (
        document.getElementById('map-select') &&
        document.getElementById('map-select').value === 'BuSe' &&
        typeof BuSe_SEA_ZONES !== "undefined" &&
        Array.isArray(BuSe_SEA_ZONES)
    ) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#4A90E2";
        const scaleX = canvas.width / 700;
        const scaleY = canvas.height / 600;
        for (const zone of BuSe_SEA_ZONES) {
            if (zone.length > 1) {
                ctx.beginPath();
                ctx.moveTo(zone[0][0] * scaleX, zone[0][1] * scaleY);
                for (let i = 1; i < zone.length; i++) {
                    ctx.lineTo(zone[i][0] * scaleX, zone[i][1] * scaleY);
                }
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Рисуване на териториите
    if (gameData.frontLine.length > 1) {
        // Чертаем червената територия (лява)
        let redTerritory = [[0, 0], ...gameData.frontLine, [0, canvas.height]];
        ctx.beginPath();
        ctx.moveTo(redTerritory[0][0], redTerritory[0][1]);
        for (let i = 1; i < redTerritory.length; i++) {
            ctx.lineTo(redTerritory[i][0], redTerritory[i][1]);
        }
        ctx.globalAlpha = (document.getElementById('map-select') && document.getElementById('map-select').value === 'BuSe') ? 0.25 : 1.0;
        ctx.fillStyle = "#FFC8C8";
        ctx.fill();
        ctx.globalAlpha = 1.0;
        // Чертаем синята територия (дясна)
        let blueTerritory = [[canvas.width, 0], ...gameData.frontLine, [canvas.width, canvas.height]];
        ctx.beginPath();
        ctx.moveTo(blueTerritory[0][0], blueTerritory[0][1]);
        for (let i = 1; i < blueTerritory.length; i++) {
            ctx.lineTo(blueTerritory[i][0], blueTerritory[i][1]);
        }
        ctx.globalAlpha = (document.getElementById('map-select') && document.getElementById('map-select').value === 'BuSe') ? 0.25 : 1.0;
        ctx.fillStyle = "#9696FF";
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Чертаем фронтовата линия
        ctx.beginPath();
        ctx.moveTo(gameData.frontLine[0][0], gameData.frontLine[0][1]);
        for (let i = 1; i < gameData.frontLine.length; i++) {
            ctx.lineTo(gameData.frontLine[i][0], gameData.frontLine[i][1]);
        }
        ctx.strokeStyle = FRONT_LINE_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
        
        // Точки на фронтовата линия
        // for (let i = 0; i < gameData.frontLine.length; i++) {
        //     let point = gameData.frontLine[i];
        //     let color = FRONT_LINE_COLOR;
        //     if (gameData.frontLineWinners) {
        //         if (i === 0 && gameData.frontLineWinners[0] !== null) {
        //             color = gameData.frontLineWinners[0] === 0 ? "#FF0000" : "#0000FF";
        //         } else if (i === gameData.frontLine.length - 1 && gameData.frontLineWinners[1] !== null) {
        //             color = gameData.frontLineWinners[1] === 0 ? "#FF0000" : "#0000FF";
        //         }
        //     }
        //     ctx.beginPath();
        //     ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
        //     ctx.fillStyle = color;
        //     ctx.fill();
        // }

        if (gameData.frontLineWinners) {
            ctx.beginPath();
            ctx.arc(gameData.frontLine[0][0], 0, 7, 0, Math.PI * 2);
            ctx.fillStyle = gameData.frontLineWinners[0] === 0 ? "#FF0000" : "#0000FF";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(gameData.frontLine[gameData.frontLine.length - 1][0], canvas.height, 7, 0, Math.PI * 2);
            ctx.fillStyle = gameData.frontLineWinners[1] === 0 ? "#FF0000" : "#0000FF";
            ctx.fill();
        }
    }

    // Рисуване на селекционния правоъгълник
    if (gameData.phase.endsWith("_arrows") && gameData.selectionStart) {
        drawSelection();
    }

    // Рисуване на единиците
    for (let player of [0, 1]) {
        // Пропускаме червените единици по време на фазата на поставяне на синия играч
        if (gameData.phase === "placement" && player === 0 && gameData.currentPlayer === 1) {
            continue;
        }

        for (let unit of gameData.playerUnits[player]) {
            let selected = (gameData.phase.endsWith("_arrows") && 
                          gameData.currentPlayer === player && 
                          unit === gameData.selectedUnit);
            
            let showUnitArrows = true;
            if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase) {
                showUnitArrows = (player === gameData.currentPlayer);
            } else if (gameData.battlePhase) {
                showUnitArrows = gameData.showArrows;
            }
            
            unit.draw(selected, showUnitArrows);
        }
    }

    // Рисуване на столиците
    for (let player = 0; player < 2; player++) {
        // Пропускаме червената столица по време на фазата на поставяне на синия играч
        if (gameData.phase === "placement" && player === 0 && gameData.currentPlayer === 1) {
            continue;
        }

        let capital = gameData.capitals[player];
        if (capital) {
            ctx.beginPath();
            ctx.arc(capital[0], capital[1], CAPITAL_RADIUS * getUnitScale(), 0, Math.PI * 2);
            ctx.fillStyle = CAPITAL_COLOR;
            ctx.fill();
            ctx.strokeStyle = PLAYER_COLORS[player];
            ctx.lineWidth = 3 * getUnitScale();
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

    ctx.restore();

    // Актуализиране на информацията за играта
    let infoText = "";
    if (gameData.phase === "placement") {
        // BuSe карта: не показвай съобщение за избор на столица
        if (!gameData.BuSeCapitalsLocked && !gameData.capitals[gameData.currentPlayer]) {
            infoText = `Играч ${gameData.currentPlayer + 1}: Поставете столица (кликнете върху вашата територия)`;
        } else {
            infoText = `Играч ${gameData.currentPlayer + 1}: Поставете единици (${gameData.playerUnits[gameData.currentPlayer].length}/${gameData.maxUnits})`;
        }
    } else if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase) {
        infoText = `Играч ${gameData.currentPlayer + 1}: Ляв бутон - стрелка, Десен бутон - движение (2x дължина)`;
    } else if (gameData.battlePhase) {
        infoText = `Битка - ход ${gameData.turnCount} от ${gameData.maxTurns}`;
        infoText = `Битка - ход ${gameData.turnCount} от ${gameData.maxTurns}`;
    } else if (gameData.phase === "end") {
        infoText = "Край на играта!";
    }
    
    // Добавяне на информация за броя единици
    let unitsInfo = ` | Червени: ${gameData.playerUnits[0].length}, Сини: ${gameData.playerUnits[1].length} единици`;
    infoText += unitsInfo;
    
    gameInfo.textContent = infoText;

    // Актуализиране на видимостта на бутона "Готово"
    if (gameData.phase === "placement") {
        if (gameData.playerUnits[gameData.currentPlayer].length > 0) {
        } else {
            readyBtn.classList.add('hidden');
        }
    }
}

// --- ZOOM & PAN STATE ---
let view = {
    scale: 1,
    minScale: 1, // Забранява намаляване (минимум 1)
    maxScale: 4, // Максимално увеличение (примерно 4x)
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragStart: null,
    dragOrigin: null
};

// --- ZOOM & PAN HELPERS ---
function applyViewTransform(ctx) {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);
}

function screenToWorld([x, y]) {
    return [
        (x - view.offsetX) / view.scale,
        (y - view.offsetY) / view.scale
    ];
}

function worldToScreen([x, y]) {
    return [
        x * view.scale + view.offsetX,
        y * view.scale + view.offsetY
    ];
}

// --- PATCH DRAWING TO SUPPORT ZOOM/PAN ---
function drawGame() {
    // Clear the visible canvas before applying transforms
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    applyViewTransform(ctx);

    // BuSe карта: фон изображение
    if (document.getElementById('map-select') && document.getElementById('map-select').value === 'BuSe') {
        if (!drawGame.bgImg) {
            drawGame.bgImg = new Image();
            drawGame.bgImg.src = 'map1.png';
        }
        ctx.globalAlpha = 1.0;
        // Draw background image in world coordinates
        ctx.drawImage(drawGame.bgImg, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    } else {
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // --- Рисуване на морето (BuSe карта) ---
    if (
        document.getElementById('map-select') &&
        document.getElementById('map-select').value === 'BuSe' &&
        typeof BuSe_SEA_ZONES !== "undefined" &&
        Array.isArray(BuSe_SEA_ZONES)
    ) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#4A90E2";
        const scaleX = canvas.width / 700;
        const scaleY = canvas.height / 600;
        for (const zone of BuSe_SEA_ZONES) {
            if (zone.length > 1) {
                ctx.beginPath();
                ctx.moveTo(zone[0][0] * scaleX, zone[0][1] * scaleY);
                for (let i = 1; i < zone.length; i++) {
                    ctx.lineTo(zone[i][0] * scaleX, zone[i][1] * scaleY);
                }
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Рисуване на териториите
    if (gameData.frontLine.length > 1) {
        // Чертаем червената територия (лява)
        let redTerritory = [[0, 0], ...gameData.frontLine, [0, canvas.height]];
        ctx.beginPath();
        ctx.moveTo(redTerritory[0][0], redTerritory[0][1]);
        for (let i = 1; i < redTerritory.length; i++) {
            ctx.lineTo(redTerritory[i][0], redTerritory[i][1]);
        }
        ctx.globalAlpha = (document.getElementById('map-select') && document.getElementById('map-select').value === 'BuSe') ? 0.25 : 1.0;
        ctx.fillStyle = "#FFC8C8";
        ctx.fill();
        ctx.globalAlpha = 1.0;
        // Чертаем синята територия (дясна)
        let blueTerritory = [[canvas.width, 0], ...gameData.frontLine, [canvas.width, canvas.height]];
        ctx.beginPath();
        ctx.moveTo(blueTerritory[0][0], blueTerritory[0][1]);
        for (let i = 1; i < blueTerritory.length; i++) {
            ctx.lineTo(blueTerritory[i][0], blueTerritory[i][1]);
        }
        ctx.globalAlpha = (document.getElementById('map-select') && document.getElementById('map-select').value === 'BuSe') ? 0.25 : 1.0;
        ctx.fillStyle = "#9696FF";
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Чертаем фронтовата линия
        ctx.beginPath();
        ctx.moveTo(gameData.frontLine[0][0], gameData.frontLine[0][1]);
        for (let i = 1; i < gameData.frontLine.length; i++) {
            ctx.lineTo(gameData.frontLine[i][0], gameData.frontLine[i][1]);
        }
        ctx.strokeStyle = FRONT_LINE_COLOR;
        ctx.lineWidth =  2;
        ctx.stroke();
        ctx.lineWidth = 1;
        
        // Точки на фронтовата линия
        // for (let i = 0; i < gameData.frontLine.length; i++) {
        //     let point = gameData.frontLine[i];
        //     let color = FRONT_LINE_COLOR;
        //     if (gameData.frontLineWinners) {
        //         if (i === 0 && gameData.frontLineWinners[0] !== null) {
        //             color = gameData.frontLineWinners[0] === 0 ? "#FF0000" : "#0000FF";
        //         } else if (i === gameData.frontLine.length - 1 && gameData.frontLineWinners[1] !== null) {
        //             color = gameData.frontLineWinners[1] === 0 ? "#FF0000" : "#0000FF";
        //         }
        //     }
        //     ctx.beginPath();
        //     ctx.arc(point[0], point[1], 3, 0, Math.PI * 2);
        //     ctx.fillStyle = color;
        //     ctx.fill();
        // }

        if (gameData.frontLineWinners) {
            ctx.beginPath();
            ctx.arc(gameData.frontLine[0][0], 0, 7, 0, Math.PI * 2);
            ctx.fillStyle = gameData.frontLineWinners[0] === 0 ? "#FF0000" : "#0000FF";
            ctx.fill();

            ctx.beginPath();
            ctx.arc(gameData.frontLine[gameData.frontLine.length - 1][0], canvas.height, 7, 0, Math.PI * 2);
            ctx.fillStyle = gameData.frontLineWinners[1] === 0 ? "#FF0000" : "#0000FF";
            ctx.fill();
        }
    }

    // Рисуване на селекционния правоъгълник
    if (gameData.phase.endsWith("_arrows") && gameData.selectionStart) {
        drawSelection();
    }

    // Рисуване на единиците
    for (let player of [0, 1]) {
        // Пропускаме червените единици по време на фазата на поставяне на синия играч
        if (gameData.phase === "placement" && player === 0 && gameData.currentPlayer === 1) {
            continue;
        }

        for (let unit of gameData.playerUnits[player]) {
            let selected = (gameData.phase.endsWith("_arrows") && 
                          gameData.currentPlayer === player && 
                          unit === gameData.selectedUnit);
            
            let showUnitArrows = true;
            if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase) {
                showUnitArrows = (player === gameData.currentPlayer);
            } else if (gameData.battlePhase) {
                showUnitArrows = gameData.showArrows;
            }
            
            unit.draw(selected, showUnitArrows);
        }
    }

    // Рисуване на столиците
    for (let player = 0; player < 2; player++) {
        // Пропускаме червената столица по време на фазата на поставяне на синия играч
        if (gameData.phase === "placement" && player === 0 && gameData.currentPlayer === 1) {
            continue;
        }

        let capital = gameData.capitals[player];
        if (capital) {
            ctx.beginPath();
            ctx.arc(capital[0], capital[1], CAPITAL_RADIUS * getUnitScale(), 0, Math.PI * 2);
            ctx.fillStyle = CAPITAL_COLOR;
            ctx.fill();
            ctx.strokeStyle = PLAYER_COLORS[player];
            ctx.lineWidth = 3 * getUnitScale();
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

    // Актуализиране на информацията за играта
    let infoText = "";
    if (gameData.phase === "placement") {
        // BuSe карта: не показвай съобщение за избор на столица
        if (!gameData.BuSeCapitalsLocked && !gameData.capitals[gameData.currentPlayer]) {
            infoText = `Играч ${gameData.currentPlayer + 1}: Поставете столица (кликнете върху вашата територия)`;
        } else {
            infoText = `Играч ${gameData.currentPlayer + 1}: Поставете единици (${gameData.playerUnits[gameData.currentPlayer].length}/${gameData.maxUnits})`;
        }
    } else if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase) {
        infoText = `Играч ${gameData.currentPlayer + 1}: Ляв бутон - стрелка, Десен бутон - движение (2x дължина)`;
    } else if (gameData.battlePhase) {
        infoText = `Битка - ход ${gameData.turnCount} от ${gameData.maxTurns}`;
    } else if (gameData.phase === "end") {
        infoText = "Край на играта!";
    }
    
    // Добавяне на информация за броя единици
    let unitsInfo = ` | Червени: ${gameData.playerUnits[0].length}, Сини: ${gameData.playerUnits[1].length} единици`;
    infoText += unitsInfo;
    
    gameInfo.textContent = infoText;

    // Актуализиране на видимостта на бутона "Готово"
    if (gameData.phase === "placement") {
        if (gameData.playerUnits[gameData.currentPlayer].length > 0) {
            readyBtn.classList.remove('hidden');
        } else {
            readyBtn.classList.add('hidden');
        }
    }
}

// --- PATCH INPUT EVENTS TO SUPPORT ZOOM/PAN ---
canvas.addEventListener('mousedown', function(e) {
    // Позволи пан само ако няма селектирани единици
    // и не се настройва синя стрелка за единица
    const isSettingBlueArrow = (
        gameData.phase.endsWith("_arrows") &&
        !gameData.battlePhase &&
        gameData.selectedUnit !== null
    );
    if (e.button === 2 && gameData.selectedUnits.length === 0 && !isSettingBlueArrow) {
        view.dragging = true;
        view.dragStart = [e.clientX, e.clientY];
        view.dragOrigin = [view.offsetX, view.offsetY];
        return;
    }
    let rect = canvas.getBoundingClientRect();
    let pos = screenToWorld([e.clientX - rect.left, e.clientY - rect.top]);
    let button = e.button;
    
    if (gameData.phase === "placement") {
        // Само ако НЕ е BuSe карта, позволи местене/премахване на столица
        if (!gameData.BuSeCapitalsLocked) {
            let capital = gameData.capitals[gameData.currentPlayer];
            if (capital && Math.sqrt((pos[0] - capital[0])**2 + (pos[1] - capital[1])**2) <= CAPITAL_RADIUS) {
                gameData.capitals[gameData.currentPlayer] = null;
                return;
            }
        }
        // Обработка на поставяне
        handlePlacement(pos);
    } else if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase) {
        if (gameData.selectedUnits.length > 0) {
            // Ако имаме маркирани единици, обработваме второто кликване
            handleGroupArrowDirection(pos, button);
        } else {
            // Първо проверяваме дали не сме кликнали върху единица
            if (!handleArrowSelection(pos, button)) {
                // Ако не сме кликнали върху единица, започваме селекция
                gameData.selectionStart = pos;
                gameData.selectionEnd = pos;
            }
        }
    }
});

canvas.addEventListener('mousemove', function(e) {
    // Позволи пан само ако няма селектирани единици
    // и не се настройва синя стрелка за единица
    const isSettingBlueArrow = (
        gameData.phase.endsWith("_arrows") &&
        !gameData.battlePhase &&
        gameData.selectedUnit !== null
    );
    if (view.dragging && gameData.selectedUnits.length === 0 && !isSettingBlueArrow) {
        let dx = e.clientX - view.dragStart[0];
        let dy = e.clientY - view.dragStart[1];
        view.offsetX = view.dragOrigin[0] + dx;
        view.offsetY = view.dragOrigin[1] + dy;
        return;
    }
    let rect = canvas.getBoundingClientRect();
    let pos = screenToWorld([e.clientX - rect.left, e.clientY - rect.top]);
    if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase && 
        gameData.selectionStart && e.buttons === 1) {
        gameData.selectionEnd = pos;
        
        // Маркираме единиците в селекцията
        gameData.selectedUnits = [];
        for (let unit of gameData.playerUnits[gameData.currentPlayer]) {
            if (isUnitInSelection(unit)) {
                gameData.selectedUnits.push(unit);
            }
        }
    }
    if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase && gameData.selectedUnit && e.buttons === 2) {
        gameData.selectedUnit.blueArrow = pos;
    }
});

canvas.addEventListener('mouseup', function(e) {
    // Позволи спиране на пан само ако няма селектирани единици
    // и не се настройва синя стрелка за единица
    const isSettingBlueArrow = (
        gameData.phase.endsWith("_arrows") &&
        !gameData.battlePhase &&
        gameData.selectedUnit !== null
    );
    if (view.dragging && e.button === 2 && gameData.selectedUnits.length === 0 && !isSettingBlueArrow) {
        view.dragging = false;
        return;
    }
    let rect = canvas.getBoundingClientRect();
    let pos = screenToWorld([e.clientX - rect.left, e.clientY - rect.top]);
    if (gameData.phase.endsWith("_arrows") && !gameData.battlePhase && 
        gameData.selectionStart && gameData.selectionEnd) {
        // Ако правоъгълникът е твърде малък, го игнорирай
        const minX = Math.min(gameData.selectionStart[0], gameData.selectionEnd[0]);
        const maxX = Math.max(gameData.selectionStart[0], gameData.selectionEnd[0]);
        const minY = Math.min(gameData.selectionStart[1], gameData.selectionEnd[1]);
        const maxY = Math.max(gameData.selectionStart[1], gameData.selectionEnd[1]);
        
        if (maxX - minX < 10 && maxY - minY < 10) {
            gameData.selectionStart = null;
            gameData.selectionEnd = null;
            gameData.selectedUnits = [];
        }
    }
});
canvas.addEventListener('wheel', function(e) {
    // Zoom in/out
    e.preventDefault();
    let rect = canvas.getBoundingClientRect();
    let mouse = [e.clientX - rect.left, e.clientY - rect.top];
    let world = screenToWorld(mouse);

    let scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
    let newScale = Math.max(view.minScale, Math.min(view.maxScale, view.scale * scaleFactor));
    if (newScale === view.scale) return;

    // Adjust offset so zoom is centered on mouse
    view.offsetX = mouse[0] - (world[0] * newScale);
    view.offsetY = mouse[1] - (world[1] * newScale);
    view.scale = newScale;
}, { passive: false });

canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
});

// Бутон за готовност
readyBtn.addEventListener('click', function() {
    if (gameData.phase === "placement") {
        if (!gameData.capitals[gameData.currentPlayer]) return;
        if (gameData.gameMode === "vsbot" && gameData.currentPlayer === 1) {
            readyBtn.classList.add('hidden');
            setTimeout(activateBot, 100);
            return; // Не сменяй currentPlayer, ботът ще го направи
        }
        if (gameData.playerUnits[gameData.currentPlayer].length > 0) {
            gameData.currentPlayer = 1 - gameData.currentPlayer;
            if (gameData.currentPlayer === 1 && gameData.gameMode === "vsbot") {
                readyBtn.classList.add('hidden');
                setTimeout(activateBot, 100);
            } else if (gameData.currentPlayer === 0) {
                gameData.phase = "player1_arrows";
            }
        }
    } else if (gameData.phase.endsWith("_arrows")) {
        if (gameData.phase === "player1_arrows") {
            gameData.phase = "player2_arrows";
            gameData.currentPlayer = 1;
            if (gameData.gameMode === "vsbot") {
                setTimeout(activateBot, 100);
            }
        } else if (gameData.phase === "player2_arrows") {
            gameData.phase = "battle";
            readyBtn.classList.add('hidden');
            calculateBattle();
        }
    }
    gameData.selectedUnit = null;
});
// Настройки на играта
document.getElementById('confirm-btn').addEventListener('click', function() {
    let turns = parseInt(document.getElementById('turn-input').value);
    let units = parseInt(document.getElementById('units-input').value);
    // Запазваме избрания режим
    const modeSelect = document.getElementById('mode-select');
    game.gameMode = modeSelect.value;
    gameData.gameMode = modeSelect.value;
    if (turns >= 1 && turns <= MAX_TURNS && units >= 1 && units <= MAX_UNITS) {
        // Запазваме настройките в gameData
        gameData.maxTurns = turns;
        gameData.maxUnits = units;
        ARROW_LENGTH = Math.max(40, Math.floor(canvas.width / gameData.maxTurns / 2));
        
        // Актуализираме текста за брой единици
        if (gameData.phase === "placement") {
            gameInfo.textContent = `Играч ${gameData.currentPlayer + 1}: Поставете единици (${gameData.playerUnits[gameData.currentPlayer].length}/${gameData.maxUnits})`;
        }
        
        settingsModal.classList.add('hidden');
        gameData.phase = "placement";
        initializeFrontLine();
        gameLoop();
    }
});

// Single game loop function
function gameLoop() {
    if (gameData.battlePhase) {
        updateUnits();
    }
    drawGame();
    requestAnimationFrame(gameLoop);
}

// Single initialization
initializeFrontLine();
settingsModal.classList.remove('hidden');
readyBtn.classList.add('hidden');

function handleCapitalPlacement(pos) {
    // BuSe карта: не позволявай избор на столица
    if (gameData.BuSeCapitalsLocked) {
        return false;
    }
    let [x, y] = pos;
    let player = gameData.currentPlayer;

    // Проверка за разстояние от фронтова линия
    let minDistance = UNIT_RADIUS * 2 * getUnitScale();
    for (let point of gameData.frontLine) {
        if (Math.sqrt((x - point[0])**2 + (y - point[1])**2) < minDistance) {
            return false;
        }
    }

    // Единствената проверка за територия:
    if (!isInOwnTerritory(player, x, y)) {
        return false;
    }

    gameData.capitals[player] = [x, y];
    return true;
}

function checkForLoss() {
    for (let player = 0; player < 2; player++) {
        const opponent = 1 - player; // Променено от "опонент" на "opponent"

        // Проверка дали играчът е загубил всичките си единици
        if (gameData.playerUnits[player].length === 0) {
            endGame(opponent, `Играч ${opponent + 1} печели! Играч ${player + 1} загуби всичките си единици.`);
            return;
        }

        // Проверка дали столицата на играча е в територията на противника
        const capital = gameData.capitals[player];
        if (capital) {
            const isInOpponentTerritory = isCapitalInOpponentTerritory(player, capital);
            if (isInOpponentTerritory) {
                endGame(opponent, `Играч ${opponent + 1} печели! Столицата на играч ${player + 1} е превзета.`);
                return;
            }
        }
    }
}
function endGame(winningPlayer, message) {
    gameData.phase = "end";



    gameData.battlePhase = false;
    gameInfo.textContent = message;

    // Скриваме бутона "Готово"

    readyBtn.classList.add('hidden');
}

function isCapitalInOpponentTerritory(player, capital) {
    const [x, y] = capital;

    // Определяме територията на противника
    let opponentTerritory;
    if (player === 0) {
        // Червеният играч (лява територия), проверяваме дали е в синята територия
        opponentTerritory = [[canvas.width, 0], ...gameData.frontLine, [canvas.width, canvas.height]];
    } else {
        // Синият играч (дясна територия), проверяваме дали е в червената територия
        opponentTerritory = [[0, 0], ...gameData.frontLine, [0, canvas.height]];
    }

    // Проверяваме дали столицата е в територията на противника
    return pointInPolygon([x, y], opponentTerritory);
}

function interpolateFrontLine(points, targetCount) {
    if (points.length <= 2) return points;
    
    // Изчисляваме общата дължина
    let totalLength = 0;
    const lengths = [];
    for (let i = 1; i < points.length; i++) {
        const dx = points[i][0] - points[i-1][0];
        const dy = points[i][1] - points[i-1][1];
        const len = Math.sqrt(dx*dx + dy*dy);
        lengths.push(len);
        totalLength += len;
    }

    // Създаваме нова линия с гарантирана минимална гъстота
    const MIN_SPACING = 5; // Минимално разстояние между точки
    const newLine = [points[0]];
    let currentLength = 0;
    let currentIndex = 0;
    
    for (let i = 1; i < targetCount - 1; i++) {
        let targetDist = i * (totalLength / (targetCount - 1));
        
        // Намиране на сегмента, съдържащ целевата точка
        while (currentIndex < lengths.length && 
               currentLength + lengths[currentIndex] < targetDist) {
            currentLength += lengths[currentIndex];
            currentIndex++;
        }
        
        if (currentIndex >= lengths.length) break;
        
        // Изчисляване на позицията в сегмента
        const segProgress = (targetDist - currentLength) / lengths[currentIndex];
        const p1 = points[currentIndex];
        const p2 = points[currentIndex + 1];
        
        const x = p1[0] + (p2[0] - p1[0]) * segProgress;
        const y = p1[1] + (p2[1] - p1[1]) * segProgress;
        
        // Проверка за минимално разстояние от предишната точка
        if (newLine.length > 0) {
            const lastPoint = newLine[newLine.length - 1];
            const dist = Math.hypot(x - lastPoint[0], y - lastPoint[1]);
            if (dist < MIN_SPACING) continue;
        }
        
        newLine.push([x, y]);
    }
    
    // Добавяме последната точка, ако не съвпада
    const lastPoint = points[points.length - 1];
    if (newLine.length === 0 || 
        newLine[newLine.length-1][0] !== lastPoint[0] || 
        newLine[newLine.length-1][1] !== lastPoint[1]) {
        newLine.push(lastPoint.slice());
    }
    
    return newLine;
}
function interpolateFrontLineBySpacing(points, spacing) {
    // 1. Изчисли дължините на сегментите
    let lengths = [];
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        let dx = points[i][0] - points[i-1][0];
        let dy = points[i][1] - points[i-1][1];
        let len = Math.sqrt(dx*dx + dy*dy);
        lengths.push(len);
        totalLength += len;
    }

    let result = [points[0].slice()];
    let currIdx = 1;
    let currLen = 0;
    let prev = points[0].slice();

    while (currIdx < points.length) {
        let segLen = lengths[currIdx-1];
        let remain = spacing - currLen;
        if (segLen >= remain) {
            // Слагаме нова точка на разстояние spacing от предишната
            let t = remain / segLen;
            let x = prev[0] + (points[currIdx][0] - prev[0]) * t;
            let y = prev[1] + (points[currIdx][1] - prev[1]) * t;
            result.push([x, y]);
            // Новият сегмент започва от тази точка
            prev = [x, y];
            lengths[currIdx-1] = segLen - remain;
            points[currIdx-1] = prev;
            currLen = 0;
        } else {
            // Отиваме към следващия сегмент
            currLen += segLen;
            prev = points[currIdx].slice();
            currIdx++;
        }
    }
    // Добави последната точка, ако не съвпада с последната от масива
    if (result.length === 0 || (result[result.length-1][0] !== points[points.length-1][0] || result[result.length-1][1] !== points[points.length-1][1])) {
        result.push(points[points.length-1].slice());
    }
    return result;
}

const mapSelect = document.getElementById('map-select');
if (mapSelect) {
    mapSelect.addEventListener('change', function() {
        initializeFrontLine();
        // Отключи местенето на столица ако не е BuSe карта
        if (mapSelect.value !== "BuSe") {
            gameData.BuSeCapitalsLocked = false;
        }
        drawGame();
    });
}

function fillFrontLineEnds(frontLine, spacing, canvas) {
    // Запълни отгоре
    let first = frontLine[0];
    if (first[1] > 0) {
        let steps = Math.ceil(first[1] / spacing);
        let dx = (frontLine[1][0] - first[0]) / (frontLine[1][1] - first[1]);
        for (let i = 1; i <= steps; i++) {
            let y = first[1] - i * spacing;
            if (y < 0) y = 0;
            let x = first[0] + dx * (y - first[1]);
            frontLine.unshift([x, y]);
            if (y === 0) break;
        }
    }
    frontLine[0][1] = 0;

    // Запълни отдолу
    let last = frontLine[frontLine.length - 1];
    if (last[1] < canvas.height) {
        let steps = Math.ceil((canvas.height - last[1]) / spacing);
        let dx = (last[0] - frontLine[frontLine.length - 2][0]) / (last[1] - frontLine[frontLine.length - 2][1]);
        for (let i = 1; i <= steps; i++) {
            let y = last[1] + i * spacing;
            if (y > canvas.height) y = canvas.height;
            let x = last[0] + dx * (y - last[1]);
            frontLine.push([x, y]);
            if (y === canvas.height) break;
        }
    }
    frontLine[frontLine.length - 1][1] = canvas.height;
    // НЕ пипай x-координатите!
}

// Проверка дали е в собствената територия
function isInOwnTerritory(player, x, y) {
    // Винаги определяй територията по полигон
    if (player === 0) {
        // Червен: лявата територия
        let redPoly = [[0, 0], ...gameData.frontLine, [0, canvas.height]];
        return pointInPolygon([x, y], redPoly);
    } else {
        // Син: дясната територия
        let bluePoly = [[canvas.width, 0], ...gameData.frontLine, [canvas.width, canvas.height]];
        return pointInPolygon([x, y], bluePoly);
    }
}

function nextPlacementTurn() {
    gameData.currentPlayer = (gameData.currentPlayer + 1) % 2;
    if (gameData.gameMode === "vsbot" && gameData.currentPlayer === 1) {
        botController.makeDecision();
        // След като ботът разположи, премини към следващия ход:
        gameData.currentPlayer = 0;
    }
}

// Функция за намиране на най-близката точка по ръба на морската зона
function findClosestSeaEdgePoint(x, y) {
    if (
        typeof BuSe_SEA_ZONES === "undefined" ||
        !Array.isArray(BuSe_SEA_ZONES) ||
        BuSe_SEA_ZONES.length === 0
    ) return null;

    const scaleX = canvas.width / 700;
    const scaleY = canvas.height / 600;
    let minDist = Infinity;
    let result = null;

    for (const zone of BuSe_SEA_ZONES) {
        for (let i = 0; i < zone.length; i++) {
            const zx = zone[i][0] * scaleX;
            const zy = zone[i][1] * scaleY;
            const dist = Math.hypot(x - zx, y - zy);
            if (dist < minDist) {
                minDist = dist;
                result = { zone, idx: i, point: [zx, zy] };
            }
        }
    }
    return result;
}

// Нови функции за проверка на ръбовете
function checkFrontLineEdgeLoops() {
    // Проверка за горен ръб (y <= 0)
    for (let i = 1; i < gameData.frontLine.length - 1; i++) {
        let [x, y] = gameData.frontLine[i];
        if (y <= 0) {
            let loopPoints = gameData.frontLine.slice(0, i + 1);
            if (loopPoints.length > 2) {
                removeUnitsInLoop([...loopPoints, [x, 0]]);
            }
            gameData.frontLine = [[x, 0], ...gameData.frontLine.slice(i + 1)];
            return true;
        }
    }
    
    // Проверка за долен ръб (y >= canvas.height)
    for (let i = gameData.frontLine.length - 2; i > 0; i--) {
        let [x, y] = gameData.frontLine[i];
        if (y >= canvas.height) {
            let loopPoints = gameData.frontLine.slice(i);
            if (loopPoints.length > 2) {
                removeUnitsInLoop([[x, canvas.height], ...loopPoints]);
            }
            gameData.frontLine = [...gameData.frontLine.slice(0, i), [x, canvas.height]];
            return true;
        }
    }
    
    // Проверка за ляв ръб (x <= 0)
    for (let i = 1; i < gameData.frontLine.length - 1; i++) {
        let [x, y] = gameData.frontLine[i];
        if (x <= 0) {
            let loopPoints = [...gameData.frontLine.slice(0, i + 1), [0, y]];
            if (loopPoints.length > 2) {
                removeUnitsInLoop(loopPoints);
            }
            gameData.frontLine = [[0, y], ...gameData.frontLine.slice(i + 1)];
            return true;
        }
    }
    
    // Проверка за десен ръб (x >= canvas.width)
    for (let i = gameData.frontLine.length - 2; i > 0; i--) {
        let [x, y] = gameData.frontLine[i];
        if (x >= canvas.width) {
            let loopPoints = [[canvas.width, y], ...gameData.frontLine.slice(i)];
            if (loopPoints.length > 2) {
                removeUnitsInLoop(loopPoints);
            }
            gameData.frontLine = [...gameData.frontLine.slice(0, i), [canvas.width, y]];
            return true;
        }
    }
    
    return false;
}

// Проверка дали точка е в морската зона (само за BuSe карта)
function isInSeaZone(x, y) {
    if (
        typeof BuSe_SEA_ZONES !== "undefined" &&
        Array.isArray(BuSe_SEA_ZONES) &&
        BuSe_SEA_ZONES.length > 0 &&
        document.getElementById('map-select') &&
        document.getElementById('map-select').value === 'BuSe'
    ) {
        // Вземи скалата за BuSe карта
        const scaleX = canvas.width / 700;
        const scaleY = canvas.height / 600;
        for (const zone of BuSe_SEA_ZONES) {
            // Преобразувай x, y към оригиналната координатна система на морето
            if (pointInPolygon([x / scaleX, y / scaleY], zone)) return true;
        }
    }
    return false;
}

// Utility: Проверка дали е избрана BuSe карта
function isBuSeMap() {
    const mapSelect = document.getElementById('map-select');
    return mapSelect && mapSelect.value === 'BuSe';
}

// Utility: Връща скалата за единици (1 за всички карти, 1/3 за BuSe)
function getUnitScale() {
    return isBuSeMap() ? 1/3 : 1;
}