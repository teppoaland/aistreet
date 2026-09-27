// game.js - Pelin pääohjain (yksi yhtenäinen maailma, ei tasoja)

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new Renderer(this.canvas, this);
        this.physics = new Physics(this);
        this.enemyAI = new EnemyAI(this);
        this.input = new InputHandler(this);

        this.grid = [];
        this.cols = 0;
        this.rows = WORLD_ROWS;
        this.player = { x: 0, y: 0, facing: DIR.RIGHT };
        this.playerStartX = 0;
        this.playerStartY = 0;
        this.diamondsCollected = 0;
        this.score = 0;
        this.lives = INITIAL_LIVES;
        this.paused = false;
        this.gameOver = false;
        this.worldComplete = false;
        this.animFrameId = null;
        this.lastFrameTime = 0;
        this.lastEnemyMove = 0;
        this.deathEnd = 0;
        this.timerEnd = 0;
        this.timeRemaining = 0;

        this.overlay = document.getElementById('overlay');
        this.overlayTitle = document.getElementById('overlay-title');
        this.overlayMessage = document.getElementById('overlay-message');
        this.overlayButton = document.getElementById('overlay-button');
        const confirmAction = (e) => {
            if (e && e.cancelable) e.preventDefault();
            this.handleConfirm();
        };
        this.overlayButton.addEventListener('click', confirmAction);
        this.overlayButton.addEventListener('touchstart', confirmAction, { passive: false });

        // Tausta-ajon hallinta: välilehti taustalle -> tauko
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !this.paused && !this.gameOver && !this.worldComplete) {
                this.togglePause();
            }
        });

        this.startGame();
    }

    startGame(skipIntro) {
        this.score = 0;
        this.lives = INITIAL_LIVES;
        this.diamondsCollected = 0;
        this.gameOver = false;
        this.worldComplete = false;
        this.deathEnd = 0;
        this.timerEnd = 0;
        this.paused = !skipIntro;
        this.hideOverlay();
        this.buildWorld();
        this.updateHUD();
        this.renderer.resize();
        this.startLoop();

        if (!skipIntro) {
            this.showOverlay('⛏️ Dig Game',
                'Kulje maailman halki!\n' +
                'Kävele maan pinnalla tai kaivaudu maahan.\n\n' +
                'Puhelimella pelatessa käännä 📱 puhelin pystyasentoon.\n\n' +
                'Etsi avain maailman itäpäästä. GO!',
                'Aloita');
        }
        this.renderer.render();
    }

    // Rakentaa (uudelleen) yhtenäisen maailman
    buildWorld() {
        const world = buildWorld();
        this.grid = world.grid;
        this.cols = world.width;
        this.rows = world.height;
        this.player.x = world.playerStartX;
        this.player.y = world.playerStartY;
        this.playerStartX = world.playerStartX;
        this.playerStartY = world.playerStartY;
        this.player.facing = DIR.RIGHT;
        this.physics.reset();
        this.enemyAI.scanEnemies();
        this.lastEnemyMove = performance.now();
    }

    // Kuoleman jälkeen pelaaja palaa alkuun (maailma säilyy kaivettuna)
    respawnPlayer() {
        this.player.x = this.playerStartX;
        this.player.y = this.playerStartY;
        this.player.facing = DIR.RIGHT;
    }

    restartWorld() {
        this.startGame(true);
        this.updateHUD();
        this.renderer.render();
    }

    movePlayer(dir) {
        if (this.paused || this.gameOver || this.worldComplete || this.deathEnd > 0) return;
        const oldX = this.player.x, oldY = this.player.y;

        this.player.facing = dir;

        const nx = this.player.x + dir.dx;
        const ny = this.player.y + dir.dy;

        if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) {
            this.applyGravity();
            this.lastFrameTime = performance.now();
            this.updateHUD();
            this.renderer.render();
            return;
        }

        const targetTile = this.grid[ny][nx];

        switch (targetTile) {
            case TILE.EMPTY:
            case TILE.GRASS:      // maanpinta: kävellään, ei kaiveta
                this.player.x = nx; this.player.y = ny;
                break;
            case TILE.DIRT:       // maan alla: kaivetaan
                this.grid[ny][nx] = TILE.EMPTY;
                this.player.x = nx; this.player.y = ny;
                this.renderer.addCrumbs(nx, ny);
                break;
            case TILE.DIAMOND:
                this.grid[ny][nx] = TILE.EMPTY;
                this.player.x = nx; this.player.y = ny;
                this.collectDiamond();
                break;
            case TILE.BOULDER:
            case TILE.TREE:
            case TILE.HOUSE: {   // kaikki objektit työnnettäviä
                const bx = nx + dir.dx;
                const by = ny + dir.dy;
                // Työnnetään vain, jos takana on tyhjää.
                // Jos 2 objektia on kasassa peräkkäin, ei voi työntää.
                if (bx >= 0 && bx < this.cols && by >= 0 && by < this.rows &&
                    this.grid[by][bx] === TILE.EMPTY) {
                    this.grid[by][bx] = targetTile;
                    this.grid[ny][nx] = TILE.EMPTY;
                    this.player.x = nx; this.player.y = ny;
                }
                break;
            }
            case TILE.KEY:
                // Kerää avain ja poista se ruudusta
                this.grid[ny][nx] = (ny === SURFACE_ROW) ? TILE.GRASS : TILE.EMPTY;
                this.collectKey();
                return;
            case TILE.COIN:
                this.grid[ny][nx] = (ny === SURFACE_ROW) ? TILE.GRASS : TILE.EMPTY;
                this.player.x = nx; this.player.y = ny;
                try { window.parent.postMessage('COIN_COLLECTED', '*'); } catch(e) {}
                break;
            case TILE.FIREFLY:
            case TILE.BUTTERFLY:
                this.killPlayer();
                return;
            case TILE.WALL:
                break;
        }

        if (this.player.x !== oldX || this.player.y !== oldY) AudioFX.playMove();
        this.applyGravity();
        this.lastFrameTime = performance.now();
        this.updateHUD();
        this.renderer.render();
    }

    // Syö yksi multapala/timantti "etänä" annettuun suuntaan (ei liiku)
    remoteDig(dir) {
        if (this.paused || this.gameOver || this.worldComplete || this.deathEnd > 0) return;
        const d = dir || this.player.facing;
        this.player.facing = d;
        const nx = this.player.x + d.dx;
        const ny = this.player.y + d.dy;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
            const tile = this.grid[ny][nx];
            if (tile === TILE.DIRT) {
                this.grid[ny][nx] = TILE.EMPTY;
                this.renderer.addCrumbs(nx, ny);
            } else if (tile === TILE.DIAMOND) {
                this.grid[ny][nx] = TILE.EMPTY;
                this.collectDiamond();
            } else if (tile === TILE.BOULDER || tile === TILE.TREE || tile === TILE.HOUSE) {
                // Tartu objektiin ja vedä se pelaajan paikalle (vaihdetaan paikkaa).
                // Alin prioriteetti: multa ja timantti hoidetaan ensin.
                const ox = this.player.x, oy = this.player.y;
                // Kiveä ei voi vetää maanpinnalle (nurmelle) — se jäisi "ylimääräiseksi"
                // objektiksi pinnalle ja estäisi jatkosiirrot.
                if (tile === TILE.BOULDER && oy === SURFACE_ROW) return;
                this.grid[oy][ox] = tile;
                // Jos puu/talo vedetään pois pinnalta, jää nurmi jäljelle
                this.grid[ny][nx] =
                    (ny === SURFACE_ROW && (tile === TILE.TREE || tile === TILE.HOUSE))
                    ? TILE.GRASS : TILE.EMPTY;
                this.player.x = nx;
                this.player.y = ny;
            } else {
                return; // taivasta, seinää tms. ei voi syödä tai tarttua
            }
            this.applyGravity();
            this.lastFrameTime = performance.now();
            this.updateHUD();
            this.renderer.render();
        }
    }

    // Välilyönti: pelin tilan siirtymät
    spaceAction() {
        if (this.gameOver) {
            this.startGame(true);
        } else if (this.worldComplete) {
            try { window.parent.postMessage('RETURN_TO_STREET', '*'); } catch(e) {}
        } else if (this.paused) {
            this.togglePause();
        }
    }

    // Enter / overlay-nappi: jatka tilan mukaan
    handleConfirm() {
        if (this.gameOver) {
            this.startGame(true);
        } else if (this.worldComplete) {
            // Palaa kadulle (avain kerätty)
            try { window.parent.postMessage('RETURN_TO_STREET', '*'); } catch(e) {}
        } else if (this.paused) {
            this.togglePause();
        }
    }

    togglePause() {
        if (this.gameOver || this.worldComplete) return;
        this.paused = !this.paused;
        if (this.paused) {
            this.timeRemaining = this.timerEnd > 0 ? this.timerEnd - performance.now() : 0;
            this.showOverlay('⏸️ Tauko', 'Paina P tai Enter jatkaaksesi', 'Jatka');
        } else {
            if (this.timerEnd > 0 && this.timeRemaining > 0) {
                this.timerEnd = performance.now() + this.timeRemaining;
            }
            this.hideOverlay();
        }
    }

    collectDiamond() {
        this.diamondsCollected++;
        this.score += SCORE_DIAMOND;
        AudioFX.playDiamond();
    }

    // Puun/talon pudotus pinnalta monttuun
    awardDrop() {
        this.score += SCORE_DROP;
        this.updateHUD();
    }

    applyGravity() {
        this.physics.updateAll();
    }

    killPlayer() {
        if (this.deathEnd > 0) return; // jo kuolemassa
        this.timerEnd = 0;
        AudioFX.playExplosion();
        this.renderer.addDeathExplosion(this.player.x, this.player.y);
        this.deathEnd = performance.now() + 3000;
        this.renderer.render();
    }

    finalizeKill() {
        this.lives--;
        this.updateHUD();
        if (this.lives <= 0) {
            this.showOverlay('💀 Kuolit!',
                'Elämät loppuivat! Pisteet: ' + this.score,
                'Pelaa uudelleen');
            this.gameOver = true;
            this.stopLoop();
        } else {
            this.respawnPlayer();
        }
        this.renderer.render();
    }

    completeWorld() {
        this.score += SCORE_WORLD_BONUS;
        this.worldComplete = true;
        this.showOverlay('🎉 Maailma läpäisty!',
            'Löysit tien maailman itäpäähän!\n\n' +
            'Kerätyt timantit: ' + this.diamondsCollected +
            '\nPisteet: ' + this.score,
            'Pelaa uudelleen');
        this.updateHUD();
        this.renderer.render();
    }

    collectKey() {
        this.score += SCORE_WORLD_BONUS;
        this.worldComplete = true;
        this.showOverlay('🔑 Avain löydetty!',
            'Nyt pääset seuraavaan\ntaloon pääkadulla!\n\n' +
            'Kerätyt timantit: ' + this.diamondsCollected +
            '\nPisteet: ' + this.score,
            'OK');
        // Ilmoita pääsivulle että avain on kerätty
        try { window.parent.postMessage('KEY_COLLECTED', '*'); } catch(e) {}
        this.updateHUD();
        this.renderer.render();
    }

    spawnExplosion(x, y) {
        this.renderer.addExplosion(x, y);
    }

    updateHUD() {
        const progress = Math.max(0, Math.min(100,
            Math.round((this.player.x / Math.max(1, this.cols - 1)) * 100)));
        const progEl = document.getElementById('progress-display');
        if (progEl) progEl.textContent = 'Matka: ' + progress + '%';
        document.getElementById('diamond-display').textContent =
            '💎 ' + this.diamondsCollected;
        document.getElementById('score-display').textContent =
            'Pisteet: ' + this.score;
        document.getElementById('lives-display').textContent =
            '❤️ ' + this.lives;
        // Ajastin
        const timerEl = document.getElementById('timer-display');
        if (timerEl && this.timerEnd > 0 && !this.paused && !this.worldComplete) {
            const s = Math.max(0, Math.ceil((this.timerEnd - performance.now()) / 1000));
            timerEl.textContent = '⏱ ' + s;
            timerEl.style.color = s <= 10 ? '#ff4444' : '#ffd700';
        }
    }

    showOverlay(title, message, buttonText) {
        this.overlayTitle.textContent = title;
        this.overlayMessage.textContent = message;
        this.overlayButton.textContent = buttonText;
        this.overlay.classList.remove('hidden');
    }

    hideOverlay() {
        this.overlay.classList.add('hidden');
    }

    startLoop() {
        this.stopLoop();
        this.lastFrameTime = performance.now();
        this.lastEnemyMove = performance.now();
        this.loop(this.lastFrameTime);
    }

    stopLoop() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
    }

    loop(timestamp) {
        if (this.gameOver) return;
        this.animFrameId = requestAnimationFrame((t) => this.loop(t));
        this.renderer.updateAnimations();

        // Kuoleman viive: näytä räjähdys, sitten suorita kuolema
        if (this.deathEnd > 0) {
            if (timestamp >= this.deathEnd) {
                this.deathEnd = 0;
                this.finalizeKill();
            } else {
                this.renderer.render();
                return;
            }
        }

        if (!this.paused && !this.worldComplete) {
            // Aloita ajastin (45s)
            if (this.timerEnd === 0) {
                this.timerEnd = performance.now() + 45000;
            }
            // Aika loppui → kuolema
            if (timestamp >= this.timerEnd) {
                this.timerEnd = 0;
                this.killPlayer();
                return;
            }
            // Painovoima joka kehyksellä
            if (timestamp - this.lastFrameTime >= FRAME_DELAY) {
                this.lastFrameTime = timestamp;
                this.applyGravity();
                this.updateHUD();
            }
            // Viholliset liikkuvat hitaammin -> pelaaja ehtii karkuun
            if (timestamp - this.lastEnemyMove >= ENEMY_DELAY) {
                this.lastEnemyMove = timestamp;
                this.enemyAI.updateAll();
                this.updateHUD();
            }
        }
        this.renderer.render();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new Game();
});

