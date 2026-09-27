// enemies.js - Vihollisten tekoäly (tulikärpäset ja perhoset)

class EnemyAI {
    constructor(game) {
        this.game = game;
        this.enemyStates = []; // pysyvät tilat: {x, y, type, dirIndex}
    }

    // Kerää kaikki viholliset kentältä (kutsutaan kerran tasoa ladattaessa)
    scanEnemies() {
        this.enemyStates = [];
        for (let y = 0; y < this.game.rows; y++) {
            for (let x = 0; x < this.game.cols; x++) {
                const tile = this.game.grid[y][x];
                if (tile === TILE.FIREFLY || tile === TILE.BUTTERFLY) {
                    this.enemyStates.push({
                        x: x, y: y, type: tile,
                        dirIndex: Math.floor(Math.random() * 4),
                    });
                }
            }
        }
    }

    // Suunnat: tulikärpänen kääntyy vasemmalle (CCW), perhonen oikealle (CW)
    getDirections(type) {
        if (type === TILE.FIREFLY) {
            return [DIR.UP, DIR.RIGHT, DIR.DOWN, DIR.LEFT];
        }
        return [DIR.RIGHT, DIR.DOWN, DIR.LEFT, DIR.UP];
    }

    // Liikuta yhtä vihollista
    moveEnemy(enemy) {
        const dirs = this.getDirections(enemy.type);

        // Tulikärpänen suosii vasemmalle (CCW), perhonen oikealle (CW)
        const first = enemy.type === TILE.FIREFLY
            ? (enemy.dirIndex + 3) % 4  // CCW
            : (enemy.dirIndex + 1) % 4; // CW
        const second = enemy.dirIndex;                    // eteenpäin
        const third = enemy.type === TILE.FIREFLY
            ? (enemy.dirIndex + 1) % 4   // CW
            : (enemy.dirIndex + 3) % 4;  // CCW
        const fourth = (enemy.dirIndex + 2) % 4;          // ympäri

        const order = [first, second, third, fourth];

        for (const idx of order) {
            const d = dirs[idx];
            const nx = enemy.x + d.dx;
            const ny = enemy.y + d.dy;
            if (this.isEnemyPassable(nx, ny)) {
                this.moveEnemyTo(enemy, nx, ny);
                enemy.dirIndex = idx;
                return;
            }
        }
    }

    isEnemyPassable(x, y) {
        if (x < 0 || x >= this.game.cols || y < 0 || y >= this.game.rows) return false;
        // Viholliset liikkuvat vain tyhjässä tilassa (ei mullassa, kivissä, timanteissa)
        return this.game.grid[y][x] === TILE.EMPTY;
    }

    moveEnemyTo(enemy, newX, newY) {
        const oldX = enemy.x;
        const oldY = enemy.y;

        // Törmäys pelaajaan
        if (this.game.player.x === newX && this.game.player.y === newY) {
            this.game.killPlayer();
            return;
        }

        this.game.grid[oldY][oldX] = TILE.EMPTY;
        this.game.grid[newY][newX] = enemy.type;
        enemy.x = newX;
        enemy.y = newY;
    }

    // Tarkista onko vihollinen pelaajan ruudussa
    checkPlayerCollision() {
        for (const enemy of this.enemyStates) {
            if (enemy.x === this.game.player.x && enemy.y === this.game.player.y) {
                this.game.killPlayer();
                return true;
            }
        }
        return false;
    }

    // Päivitä kaikki viholliset
    updateAll() {
        // Poista murskatut viholliset (kivi/timantti korvannut ruudun)
        this.enemyStates = this.enemyStates.filter(e =>
            this.game.grid[e.y][e.x] === e.type
        );
        for (const enemy of this.enemyStates) {
            this.moveEnemy(enemy);
        }
        this.checkPlayerCollision();
    }
}