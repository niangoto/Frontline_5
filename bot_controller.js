class BotController {
    constructor(gameData) {
        this.gameData = gameData;
        this.player = 1;
        this.canvas = document.getElementById('game-canvas');
    }

    makeDecision() {
        if (this.gameData.phase === "placement") {
            this.handlePlacementPhase();
        } else if (this.gameData.phase === "player2_arrows") {
            this.handleArrowPhase();
        }
    }

    handlePlacementPhase() {
        if (!this.gameData.capitals[this.player]) {
            this.placeCapital();
        } else if (this.gameData.playerUnits[this.player].length < this.gameData.maxUnits) {
            this.placeUnitEvenly();
        }
    }

    placeCapital() {
        // Поставя столицата в защитена зона, далеч от фронта и врага
        const safeZone = 100;
        let bestPosition = null;
        let bestScore = -Infinity;
        for (let i = 0; i < 10; i++) {
            const x = this.canvas.width * 0.75 + Math.random() * this.canvas.width * 0.2;
            const y = Math.random() * (this.canvas.height - 200) + 100;
            if (!this.isInOwnTerritory(x, y)) continue;
            const frontDistance = this.calculateDistanceToFront(x, y);
            if (frontDistance < safeZone) continue;
            const enemyCapital = this.gameData.capitals[0];
            let enemyDist = enemyCapital ? Math.hypot(x - enemyCapital[0], y - enemyCapital[1]) : 0;
            const score = frontDistance + enemyDist * 0.5;
            if (score > bestScore) {
                bestScore = score;
                bestPosition = [x, y];
            }
        }
        if (!bestPosition) {
            bestPosition = [
                this.canvas.width * 0.75,
                this.canvas.height / 2
            ];
        }
        this.gameData.capitals[this.player] = bestPosition;
    }

    placeUnitEvenly() {
        const n = this.gameData.maxUnits;
        const front = this.gameData.frontLine;
        const idx = this.gameData.playerUnits[this.player].length;
        const posOnFront = Math.round((front.length - 1) * (idx + 0.5) / n);
        const [fx, fy] = front[posOnFront];

        // Опитай няколко offset-а зад фронта (от синята страна)
        const offsets = [60, 90, 120, 150];
        for (let offset of offsets) {
            let x = fx + offset;
            if (x > this.canvas.width - 30) x = this.canvas.width - 30;
            let y = fy;
            if (this.isValidUnitPosition(x, y)) {
                this.gameData.playerUnits[this.player].push(new Unit(this.player, x, y));
                return;
            }
        }

        // Ако не може, опитай близо до столицата
        const capital = this.gameData.capitals[this.player];
        if (capital && this.isValidUnitPosition(capital[0], capital[1])) {
            this.gameData.playerUnits[this.player].push(new Unit(this.player, capital[0], capital[1]));
            return;
        }

        // Ако пак не може, опитай няколко случайни позиции в синята територия
        for (let i = 0; i < 10; i++) {
            const rx = this.canvas.width * 0.7 + Math.random() * this.canvas.width * 0.25;
            const ry = 50 + Math.random() * (this.canvas.height - 100);
            if (this.isValidUnitPosition(rx, ry)) {
                this.gameData.playerUnits[this.player].push(new Unit(this.player, rx, ry));
                return;
            }
        }
        // Ако нищо не стане, не добавя нищо (но това е малко вероятно)
    }

    handleArrowPhase() {
        const ownUnits = this.gameData.playerUnits[this.player];

        // 1. Опит за отстъпление на застрашени единици (синя стрелка)
        for (const unit of ownUnits) {
            if (this.isUnitInDanger(unit) || this.isUnitSurrounded(unit)) {
                const retreatPoint = this.findRetreatPosition(unit);
                if (retreatPoint) {
                    unit.blueArrow = [retreatPoint[0], retreatPoint[1]];
                    unit.direction = null;
                    continue;
                }
            }
            unit.blueArrow = null; // по подразбиране няма синя стрелка
        }

        // 2. Приоритизирай заградени врагове
        const encircled = this.findEncircledEnemies();
        if (encircled.length > 0) {
            for (const enemy of encircled) {
                // Избери най-близките 2-3 свои единици да атакуват този враг
                let attackers = ownUnits
                    .map(u => ({u, d: Math.hypot(u.x - enemy.x, u.y - enemy.y)}))
                    .filter(obj => !obj.u.blueArrow)
                    .sort((a, b) => a.d - b.d)
                    .slice(0, 3)
                    .map(obj => obj.u);
                for (const attacker of attackers) {
                    attacker.direction = Math.atan2(enemy.y - attacker.y, enemy.x - attacker.x);
                    attacker.blueArrow = null;
                }
            }
            return; // Ако има заградени, не прави други атаки
        }

        // Приоритет: атака на столица, атака на уязвими, атака на фронта
        const enemyCapital = this.gameData.capitals[0];
        const vulnerableEnemies = this.findVulnerableEnemies();
        const weakPoint = this.findWeakFrontPoint() || [this.canvas.width / 2, this.canvas.height / 2];

        for (const unit of ownUnits) {
            if (unit.blueArrow) continue; // вече има синя стрелка (отстъпление)

            let target = null;

            // Ако може да атакува столицата
            if (enemyCapital && Math.hypot(unit.x - enemyCapital[0], unit.y - enemyCapital[1]) < 200) {
                target = enemyCapital;
            }
            // Ако има уязвим враг наблизо
            else if (vulnerableEnemies.length > 0) {
                let closest = null, minDist = Infinity;
                for (const enemy of vulnerableEnemies) {
                    const d = Math.hypot(unit.x - enemy.x, unit.y - enemy.y);
                    if (d < minDist) {
                        minDist = d;
                        closest = enemy;
                    }
                }
                if (closest && minDist < 200) target = [closest.x, closest.y];
            }
            // Иначе към най-слабата точка на фронта
            if (!target) target = weakPoint;

            // Задай черна стрелка (direction)
            const dx = target[0] - unit.x;
            const dy = target[1] - unit.y;
            unit.direction = Math.atan2(dy, dx);
            unit.blueArrow = null;
        }
    }

    attackTarget(units, target) {
        for (const unit of units) {
            const dx = target[0] - unit.x;
            const dy = target[1] - unit.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 75) {
                const scale = 100 / dist;
                unit.blueArrow = [
                    unit.x + dx * scale,
                    unit.y + dy * scale
                ];
            } else {
                unit.direction = Math.atan2(dy, dx);
            }
        }
    }

    findVulnerableEnemies() {
        // Връща вражески единици, които са изолирани (малко съюзници наблизо)
        const vulnerable = [];
        const enemyUnits = this.gameData.playerUnits[0];
        for (const enemy of enemyUnits) {
            let allyCount = 0;
            for (const otherEnemy of enemyUnits) {
                if (enemy === otherEnemy) continue;
                const dist = Math.hypot(enemy.x - otherEnemy.x, enemy.y - otherEnemy.y);
                if (dist < 60) allyCount++;
            }
            if (allyCount < 2) {
                vulnerable.push(enemy);
            }
        }
        return vulnerable;
    }

    attackEnemyUnits(targets) {
        for (const target of targets) {
            const attackers = this.unitsThatCanAttack([target.x, target.y], 120);
            if (attackers.length > 1) {
                this.attackTarget(attackers, [target.x, target.y]);
            }
        }
    }

    findSurroundTargets() {
        // Търси вражески единици, които могат да бъдат заградени (нямат съюзници наблизо и са близо до наши)
        const surround = [];
        const enemyUnits = this.gameData.playerUnits[0];
        const ownUnits = this.gameData.playerUnits[this.player];
        for (const enemy of enemyUnits) {
            let ownNearby = 0;
            for (const own of ownUnits) {
                const dist = Math.hypot(enemy.x - own.x, enemy.y - own.y);
                if (dist < 70) ownNearby++;
            }
            let enemyNearby = 0;
            for (const otherEnemy of enemyUnits) {
                if (enemy === otherEnemy) continue;
                const dist = Math.hypot(enemy.x - otherEnemy.x, enemy.y - otherEnemy.y);
                if (dist < 60) enemyNearby++;
            }
            if (ownNearby >= 2 && enemyNearby < 2) {
                surround.push(enemy);
            }
        }
        return surround;
    }

    surroundEnemyUnits(targets) {
        for (const target of targets) {
            const attackers = this.unitsThatCanAttack([target.x, target.y], 120);
            if (attackers.length > 1) {
                this.attackTarget(attackers, [target.x, target.y]);
            }
        }
    }

    defendUnits() {
        let actionTaken = false;
        const ownUnits = this.gameData.playerUnits[this.player];
        for (const unit of ownUnits) {
            if (this.isUnitInDanger(unit) || this.isUnitSurrounded(unit)) {
                const retreatPoint = this.findRetreatPosition(unit);
                if (retreatPoint) {
                    unit.blueArrow = [retreatPoint[0], retreatPoint[1]];
                    actionTaken = true;
                }
            }
        }
        return actionTaken;
    }

    generalAdvance() {
        const weakPoint = this.findWeakFrontPoint() || [this.canvas.width / 2, this.canvas.height / 2];
        const units = this.gameData.playerUnits[this.player];
        for (const unit of units) {
            if (!unit.direction && !unit.blueArrow) {
                const dx = weakPoint[0] - unit.x;
                const dy = weakPoint[1] - unit.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 75) {
                    const scale = 100 / dist;
                    unit.blueArrow = [
                        unit.x + dx * scale,
                        unit.y + dy * scale
                    ];
                } else {
                    unit.direction = Math.atan2(dy, dx);
                }
            }
        }
    }

    isInOwnTerritory(x, y) {
        if (this.player === 0) {
            const redPoly = [[0, 0], ...this.gameData.frontLine, [0, this.canvas.height]];
            return this.pointInPolygon([x, y], redPoly);
        } else {
            const bluePoly = [[this.canvas.width, 0], ...this.gameData.frontLine, [this.canvas.width, this.canvas.height]];
            return this.pointInPolygon([x, y], bluePoly);
        }
    }

    pointInPolygon(point, polygon) {
        const [x, y] = point;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            const intersect = ((yi > y) !== (yj > y)) &&
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    calculateDistanceToFront(x, y) {
        let minDist = Infinity;
        for (const point of this.gameData.frontLine) {
            const dist = Math.hypot(x - point[0], y - point[1]);
            if (dist < minDist) minDist = dist;
        }
        return minDist;
    }

    findWeakFrontPoint() {
        let weakestPoint = null;
        let minStrength = Infinity;
        for (let i = 1; i < this.gameData.frontLine.length - 1; i++) {
            const point = this.gameData.frontLine[i];
            const enemyStrength = this.calculateEnemyStrengthNearPoint(point);
            const ownStrength = this.calculateOwnStrengthNearPoint(point);
            const strengthRatio = enemyStrength / (ownStrength + 0.1);
            if (strengthRatio < minStrength) {
                minStrength = strengthRatio;
                weakestPoint = point;
            }
        }
        return weakestPoint;
    }

    calculateEnemyStrengthNearPoint(point) {
        let strength = 0;
        const enemyUnits = this.gameData.playerUnits[0];
        for (const unit of enemyUnits) {
            const dist = Math.hypot(unit.x - point[0], unit.y - point[1]);
            if (dist < 75) strength += 1 / (dist + 1);
        }
        return strength;
    }

    calculateOwnStrengthNearPoint(point) {
        let strength = 0;
        const ownUnits = this.gameData.playerUnits[this.player];
        for (const unit of ownUnits) {
            const dist = Math.hypot(unit.x - point[0], unit.y - point[1]);
            if (dist < 75) strength += 1 / (dist + 1);
        }
        return strength;
    }

    unitsThatCanAttack(target, range = 125) {
        const attackers = [];
        const units = this.gameData.playerUnits[this.player];
        for (const unit of units) {
            const dist = Math.hypot(unit.x - target[0], unit.y - target[1]);
            if (dist < range) attackers.push(unit);
        }
        return attackers;
    }

    isUnitInDanger(unit) {
        let enemyCount = 0;
        const enemyUnits = this.gameData.playerUnits[0];
        for (const enemy of enemyUnits) {
            const dist = Math.hypot(unit.x - enemy.x, unit.y - enemy.y);
            if (dist < 90) enemyCount++;
        }
        return enemyCount > 2;
    }

    isUnitSurrounded(unit) {
        // Проверява дали единицата е обградена от врагове и няма съюзници наблизо
        let enemyCount = 0;
        let allyCount = 0;
        const enemyUnits = this.gameData.playerUnits[0];
        const ownUnits = this.gameData.playerUnits[this.player];
        for (const enemy of enemyUnits) {
            const dist = Math.hypot(unit.x - enemy.x, unit.y - enemy.y);
            if (dist < 70) enemyCount++;
        }
        for (const ally of ownUnits) {
            if (ally === unit) continue;
            const dist = Math.hypot(unit.x - ally.x, unit.y - ally.y);
            if (dist < 60) allyCount++;
        }
        return enemyCount > 2 && allyCount < 2;
    }

    findRetreatPosition(unit) {
        const capital = this.gameData.capitals[this.player];
        if (!capital) return null;
        const dx = capital[0] - unit.x;
        const dy = capital[1] - unit.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 30) return null;
        const newX = unit.x + dx * 0.7;
        const newY = unit.y + dy * 0.7;
        if (this.isValidUnitPosition(newX, newY)) {
            return [newX, newY];
        }
        return null;
    }

    isValidUnitPosition(x, y) {
        if (this.calculateDistanceToFront(x, y) < 22.5) return false;
        const allUnits = [
            ...this.gameData.playerUnits[0],
            ...this.gameData.playerUnits[1]
        ];
        for (const unit of allUnits) {
            const dist = Math.hypot(x - unit.x, y - unit.y);
            if (dist < 30) return false;
        }
        const capital = this.gameData.capitals[this.player];
        if (capital) {
            const dist = Math.hypot(x - capital[0], y - capital[1]);
            if (dist < 30) return false;
        }
        return this.isInOwnTerritory(x, y);
    }

    isEnemyEncircled(enemy) {
        // Проверява дали вражеската единица е обградена от ботови единици от поне 3 различни посоки
        const ownUnits = this.gameData.playerUnits[this.player];
        let angles = [];
        for (const own of ownUnits) {
            const dx = own.x - enemy.x;
            const dy = own.y - enemy.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 80) { // радиус на "заграждане"
                angles.push(Math.atan2(dy, dx));
            }
        }
        if (angles.length < 3) return false;
        // Сортирай ъглите и виж дали покриват поне 2/3 от окръжността
        angles.sort((a, b) => a - b);
        let covered = 0;
        for (let i = 1; i < angles.length; i++) {
            let diff = angles[i] - angles[i-1];
            if (diff < 0) diff += 2 * Math.PI;
            covered += diff;
        }
        // Добави разликата между последния и първия (затваря окръжността)
        let diff = (angles[0] + 2 * Math.PI) - angles[angles.length - 1];
        if (diff < 0) diff += 2 * Math.PI;
        covered += diff;
        // Ако покритието е над 4 радиана (~230 градуса), смятаме за заграден
        return covered > 4;
    }

    findEncircledEnemies() {
        const enemyUnits = this.gameData.playerUnits[0];
        return enemyUnits.filter(enemy => this.isEnemyEncircled(enemy));
    }
}
