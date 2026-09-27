// physics.js - Fysiikkamoottori (kivet, timantit, puut, talot, painovoima)

class Physics {
    constructor(game) {
        this.game = game;
        // Aktiivisesti putoavat (vauhti jo saavutettu)
        this.falling = new Set();
        // "Keikahdus": 1 kehyksen viive ennen putoamista
        this.teetering = new Set();
    }

    reset() {
        this.falling.clear();
        this.teetering.clear();
    }

    key(x, y) { return x + ',' + y; }

    // Onko ruutu läpäistävissä pelaajalle
    isPassable(x, y) {
        if (x < 0 || x >= this.game.cols || y < 0 || y >= this.game.rows) return false;
        const tile = this.game.grid[y][x];
        return tile === TILE.EMPTY || tile === TILE.DIRT ||
               tile === TILE.DIAMOND || tile === TILE.EXIT || tile === TILE.KEY || tile === TILE.GRASS;
    }

    // Voiko putoava objekti pudota tähän (tyhjä tila, ei pelaajaa)
    canFallInto(x, y) {
        if (x < 0 || x >= this.game.cols || y < 0 || y >= this.game.rows) return false;
        if (this.game.grid[y][x] !== TILE.EMPTY) return false;
        if (this.game.player.x === x && this.game.player.y === y) return false;
        return true;
    }

    // Onko pelaaja suoraan tämän ruudun alla
    isPlayerBelow(x, y) {
        return this.game.player.x === x && this.game.player.y === y + 1;
    }

    isFallingTile(tile) {
        return tile === TILE.BOULDER || tile === TILE.DIAMOND ||
               tile === TILE.TREE || tile === TILE.HOUSE;
    }

    // Tarkista voiko peliobjekti (kivi, timantti, puu, talo) liikkua alas
    updateFalling(x, y) {
        const tile = this.game.grid[y][x];
        if (!this.isFallingTile(tile)) return false;

        const k = this.key(x, y);

        if (y + 1 >= this.game.rows) {
            this.falling.delete(k);
            this.teetering.delete(k);
            return false;
        }

        const below = this.game.grid[y + 1][x];
        const playerBelow = this.isPlayerBelow(x, y);

        // Putoaminen tyhjään tilaan
        if (below === TILE.EMPTY) {
            // Pelaaja alla TUKEE objektia -> ei putoa (ellei jo vauhdissa)
            if (playerBelow && !this.falling.has(k)) {
                this.teetering.delete(k);
                return false;
            }

            // Keikahdus: 1 kehyksen viive ennen putoamista
            if (!this.falling.has(k) && !this.teetering.has(k)) {
                this.teetering.add(k);
                // Puun/talon pudotus pinnalta antaa pisteet
                if ((tile === TILE.TREE || tile === TILE.HOUSE) && y === SURFACE_ROW) {
                    this.game.awardDrop();
                }
                return false;
            }

            // Nyt pudotaan yksi ruutu
            this.teetering.delete(k);
            this.falling.delete(k);
            // Puu/talo jättää pinnalle nurmikon
            this.game.grid[y][x] =
                (y === SURFACE_ROW && (tile === TILE.TREE || tile === TILE.HOUSE))
                ? TILE.GRASS : TILE.EMPTY;

            if (playerBelow) {
                if (tile === TILE.DIAMOND) {
                    this.game.collectDiamond();
                } else {
                    this.game.killPlayer();
                }
            } else {
                this.game.grid[y + 1][x] = tile;
                this.falling.add(this.key(x, y + 1));
                this.checkEnemyCrush(x, y + 1, tile);
            }
            return true;
        }

        // Alla kova ruutu -> pysähtyy (pieni tömähdys, kun vauhti pysähtyy)
        if (this.falling.has(k) &&
            (tile === TILE.BOULDER || tile === TILE.TREE || tile === TILE.HOUSE)) {
            AudioFX.playThud();
        }
        this.falling.delete(k);
        this.teetering.delete(k);

        // Liukuminen vain kivillä ja timanteilla (puu/talo putoavat suoraan)
        if ((tile === TILE.BOULDER || tile === TILE.DIAMOND) &&
            (below === TILE.BOULDER || below === TILE.DIAMOND)) {
            if (this.canFallInto(x - 1, y) && this.canFallInto(x - 1, y + 1)) {
                this.game.grid[y][x] = TILE.EMPTY;
                this.game.grid[y][x - 1] = tile;
                this.checkEnemyCrush(x - 1, y, tile);
                return true;
            }
            if (this.canFallInto(x + 1, y) && this.canFallInto(x + 1, y + 1)) {
                this.game.grid[y][x] = TILE.EMPTY;
                this.game.grid[y][x + 1] = tile;
                this.checkEnemyCrush(x + 1, y, tile);
                return true;
            }
        }

        // Kivi/puu/talo murskaa alla olevan vihollisen
        if ((tile === TILE.BOULDER || tile === TILE.TREE || tile === TILE.HOUSE) &&
            (below === TILE.FIREFLY || below === TILE.BUTTERFLY)) {
            this.game.grid[y][x] = TILE.EMPTY;
            this.checkEnemyCrush(x, y + 1, tile, below);
            return true;
        }

        return false;
    }

    // Tarkista osuiko putoava objekti viholliseen
    checkEnemyCrush(x, y, tile, targetOverride = null) {
        const target = targetOverride !== null ? targetOverride : this.game.grid[y][x];
        if (tile === TILE.BOULDER || tile === TILE.TREE || tile === TILE.HOUSE) {
            if (target === TILE.FIREFLY) {
                this.game.grid[y][x] = tile;
                this.game.score += SCORE_ENEMY;
                this.game.updateHUD();
                this.game.spawnExplosion(x, y);
                AudioFX.playCrush();
            } else if (target === TILE.BUTTERFLY) {
                // Perhonen räjähtää 3x3 alueelta ja tuhoaa ympäristön
                this.game.grid[y][x] = tile;
                this.game.score += SCORE_ENEMY;
                this.explode(x, y, 1);
                this.game.updateHUD();
                AudioFX.playCrush();
            }
        }
    }

    // Käy läpi koko kenttä ja päivitä fysiikka (alhaalta ylös)
    updateAll() {
        let anyMoved = false;
        for (let y = this.game.rows - 1; y >= 0; y--) {
            for (let x = 0; x < this.game.cols; x++) {
                if (this.updateFalling(x, y)) {
                    anyMoved = true;
                }
            }
        }
        return anyMoved;
    }

    // Räjäytä ympäröivät ruudut (tuhoaa kaiken paitsi seinät ja portin)
    explode(x, y, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.game.cols && ny >= 0 && ny < this.game.rows) {
                    const t = this.game.grid[ny][nx];
                    if (t !== TILE.WALL && t !== TILE.EXIT && t !== TILE.KEY) {
                        this.game.grid[ny][nx] = TILE.EMPTY;
                        this.game.spawnExplosion(nx, ny);
                        if (this.game.player.x === nx && this.game.player.y === ny) {
                            this.game.killPlayer();
                        }
                    }
                }
            }
        }
    }
}
