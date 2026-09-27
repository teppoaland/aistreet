// game.js - Pelin pääohjain, osa 1

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new Renderer(this.canvas, this);
        this.physics = new Physics(this);
        this.enemyAI = new EnemyAI(this);
        this.input = new InputHandler(this);

        this.grid = [];
        this.cols = 20;
        this.rows = 15;
        this.player = { x: 0, y: 0, facing: DIR.RIGHT };
        this.level = 0;
        this.diamondsCollected = 0;
        this.diamondsNeeded = 10;
        this.keyCollected = false;
        this.score = 0;
        this.lives = INITIAL_LIVES;
        this.paused = false;
        this.gameOver = false;
        this.animFrameId = null;
        this.lastFrameTime = 0;
        this.lastEnemyMove = 0;
        this.levelComplete = false;
        this.allLevelsComplete = false;

        this.overlay = document.getElementById('overlay');
        this.overlayTitle = document.getElementById('overlay-title');
        this.overlayMessage = document.getElementById('overlay-message');
        this.overlayButton = document.getElementById('overlay-button');

        // iOS:ää varten on kuunneltava myös touchstart-tapahtumaa
        const confirmAction = (e) => {
            if (e && e.cancelable) e.preventDefault(); // Estää tuplaklikkaukset (ghost clicks)
            this.handleConfirm();
        };

        this.overlayButton.addEventListener('click', confirmAction);
        this.overlayButton.addEventListener('touchstart', confirmAction, { passive: false });

        // Tausta-ajon hallinta: välilehti taustalle -> tauko
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !this.paused && !this.gameOver && !this.levelComplete && this.timerEnd > 0) {
                this.togglePause();
            }
        });

        this.startGame();
    }

    startGame(skipIntro) {
        // Debug-tila: URL-parametri ?debug ohittaa intron ja aloittaa suoraan
        const urlParams = new URLSearchParams(window.location.search);
        const isDebug = urlParams.has('debug');
        
        this.level = 0;
        this.score = 0;
        this.lives = INITIAL_LIVES;
        this.gameOver = false;
        this.levelComplete = false;
        this.timerEnd = 0;
        this.deathEnd = 0;
        this.timeRemaining = 0;
        this.paused = !skipIntro && !isDebug;
        this.hideOverlay();
        this.loadLevel(this.level);
        this.updateHUD();
        this.renderer.resize();
        this.startLoop();

        if (!skipIntro && !isDebug) {
            const lvl = LEVEL_DATA[0];
            this.showOverlay('💎 ' + lvl.name,
                'Etsi avaimia 🔑 Kerää ' + lvl.diamondsNeeded + ' timanttia\nja etene uloskäynnille!\n⏱ Aikaa on vain 45 sekuntia, että pidä kiirettä!',
                'Aloita');
        }
        this.renderer.render();
    }

    loadLevel(index) {
        if (index >= LEVEL_DATA.length) {
            this.allLevelsComplete = true;
            this.showOverlay('🎉 Kaikki tasot läpäisty!',
                'Lopulliset pisteet: ' + this.score,
                'JATKA');
            this.stopLoop();
            return;
        }

        const data = parseLevel(LEVEL_DATA[index]);
        this.grid = data.grid;
        this.cols = data.width;
        this.rows = data.height;
        this.player.x = data.playerStartX;
        this.player.y = data.playerStartY;
        this.player.facing = DIR.RIGHT;
        this.diamondsCollected = 0;
        this.keyCollected = false;
        this.levelHasKey = false;
        this.levelComplete = false;

        // Turvatoimi: tarvittavat timantit eivät voi ylittää kentän timantteja
        let totalDiamonds = 0;
        let hasKey = false;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] === TILE.DIAMOND) totalDiamonds++;
                if (this.grid[y][x] === TILE.KEY) hasKey = true;
            }
        }
        this.diamondsNeeded = Math.min(data.diamondsNeeded, totalDiamonds);
        this.levelHasKey = hasKey;

        this.physics.reset();
        this.enemyAI.scanEnemies();
        this.lastEnemyMove = performance.now();

        document.getElementById('level-display').textContent =
            'Taso: ' + (index + 1) + ' - ' + data.name;

        this.renderer.resize();
        this.updateHUD();
        this.timerEnd = 0;
    }

    movePlayer(dir) {
        if (this.paused || this.gameOver || this.levelComplete || this.deathEnd > 0) return;
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
                this.player.x = nx; this.player.y = ny;
                break;
            case TILE.DIRT:
                this.grid[ny][nx] = TILE.EMPTY;
                this.player.x = nx; this.player.y = ny;
                break;
            case TILE.DIAMOND:
                this.grid[ny][nx] = TILE.EMPTY;
                this.player.x = nx; this.player.y = ny;
                this.collectDiamond();
                break;
            case TILE.KEY:
                this.grid[ny][nx] = TILE.EMPTY;
                this.player.x = nx; this.player.y = ny;
                this.collectKey();
                break;
            case TILE.COIN:
                this.grid[ny][nx] = TILE.EMPTY;
                this.player.x = nx; this.player.y = ny;
                try { window.parent.postMessage('COIN_COLLECTED', '*'); } catch(e) {}
                break;
            case TILE.BOULDER: {
                const bx = nx + dir.dx;
                const by = ny + dir.dy;
                if (bx >= 0 && bx < this.cols && by >= 0 && by < this.rows &&
                    this.grid[by][bx] === TILE.EMPTY) {
                    this.grid[by][bx] = TILE.BOULDER;
                    this.grid[ny][nx] = TILE.EMPTY;
                    this.player.x = nx; this.player.y = ny;
                }
                break;
            }
            case TILE.EXIT:
                if (this.diamondsCollected >= this.diamondsNeeded && 
                    (!this.levelHasKey || this.keyCollected)) {
                    this.completeLevel(); return;
                }
                break;
            case TILE.FIREFLY:
            case TILE.BUTTERFLY:
                this.killPlayer(); return;
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
        if (this.deathEnd > 0) return;
        const d = dir || this.player.facing;
        this.player.facing = d;
        const nx = this.player.x + d.dx;
        const ny = this.player.y + d.dy;
        if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
            const tile = this.grid[ny][nx];
            if (tile === TILE.DIRT) {
                this.grid[ny][nx] = TILE.EMPTY;
            } else if (tile === TILE.DIAMOND) {
                this.grid[ny][nx] = TILE.EMPTY;
                this.collectDiamond();
            } else {
                return;
            }
            this.applyGravity();
            this.lastFrameTime = performance.now();
            this.updateHUD();
            this.renderer.render();
        }
    }

    // Välilyönti: pelin tilan siirtymät (kaivu tapahtuu space+suunta)
    spaceAction() {
        if (this.allLevelsComplete) {
            try { window.parent.postMessage('RETURN_TO_STREET', '*'); } catch(e) {}
        } else if (this.gameOver) {
            this.startGame(true);
        } else if (this.levelComplete) {
            this.nextLevel();
        } else if (this.paused) {
            this.togglePause();
        }
    }

    // Enter / overlay-nappi: jatka tilan mukaan
    handleConfirm() {
        if (this.allLevelsComplete) {
            try { window.parent.postMessage('RETURN_TO_STREET', '*'); } catch(e) {}
            return;
        }
        if (this.gameOver) {
            this.startGame(true);
        } else if (this.levelComplete) {
            this.nextLevel();
        } else if (this.paused) {
            this.togglePause();
        }
    }

    collectDiamond() {
        this.diamondsCollected++;
        this.score += SCORE_DIAMOND;
        AudioFX.playDiamond();
    }

    collectKey() {
        this.keyCollected = true;
        this.score += SCORE_KEY;
        AudioFX.playDiamond();
        // Avain lähettää BOULDER_KEY_COLLECTED vain tasolta 3 eteenpäin
        if (this.level >= 2) {
            try { window.parent.postMessage('BOULDER_KEY_COLLECTED', '*'); } catch(e) {}
        }
    }

    applyGravity() {
        this.physics.updateAll();
    }

    killPlayer() {
        if (this.deathEnd > 0) return; // jo kuolemassa
        AudioFX.playExplosion();
        this.renderer.addDeathExplosion(this.player.x, this.player.y);
        this.timerEnd = 0;
        this.deathEnd = performance.now() + 6000;
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
            this.loadLevel(this.level);
        }
        this.renderer.render();
    }

    completeLevel() {
        this.score += SCORE_LEVEL_BONUS;
        this.levelComplete = true;
        if (this.level === MAX_LEVELS - 1) {
            // Viimeinen taso: paluu kadulle
            this.allLevelsComplete = true;
            this.showOverlay('🎉 Kaikki tasot läpäisty!',
                'Keräsit ' + this.diamondsCollected + ' / ' + this.diamondsNeeded + ' timanttia\nBonus: +' + SCORE_LEVEL_BONUS + '\nLopulliset pisteet: ' + this.score,
                'OK');
        } else {
            this.showOverlay('✅ Taso läpäisty!',
                'Keräsit ' + this.diamondsCollected + ' / ' + this.diamondsNeeded + ' timanttia\nBonus: +' + SCORE_LEVEL_BONUS,
                'Seuraava taso');
        }
        this.updateHUD();
        this.renderer.render();
    }

    nextLevel() {
        this.level++;
        this.levelComplete = false;
        this.paused = false;
        this.hideOverlay();
        this.loadLevel(this.level);
        this.updateHUD();
        this.renderer.resize();
        this.renderer.render();
    }

    restartLevel() {
        this.loadLevel(this.level);
        this.updateHUD();
        this.renderer.render();
    }

    togglePause() {
        if (this.gameOver) return;
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

    spawnExplosion(x, y) {
        this.renderer.addExplosion(x, y);
    }

    updateHUD() {
        document.getElementById('diamond-display').textContent =
            '💎 ' + this.diamondsCollected;
        document.getElementById('diamond-goal-display').textContent =
            'Tavoite: ' + this.diamondsNeeded;
        // Avaimen tila
        const keyEl = document.getElementById('key-display');
        if (keyEl) {
            keyEl.textContent = this.keyCollected ? '🔑 ✓' : '🔑 ✗';
            keyEl.style.color = this.keyCollected ? '#ffd700' : '#ff4444';
        }
        document.getElementById('score-display').textContent =
            'Pisteet: ' + this.score;
        document.getElementById('lives-display').textContent =
            '❤️ ' + this.lives;
        // Ajastin
        const timerEl = document.getElementById('timer-display');
        if (timerEl && this.timerEnd > 0 && !this.paused && !this.levelComplete && !this.gameOver) {
            const s = Math.max(0, Math.ceil((this.timerEnd - performance.now()) / 1000));
            timerEl.textContent = '⏱ ' + s;
            timerEl.style.color = s <= 10 ? '#ff4444' : '';
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

        // Kuoleman viive: näytä räjähdys 3s, sitten suorita kuolema
        if (this.deathEnd > 0) {
            if (timestamp >= this.deathEnd) {
                this.deathEnd = 0;
                this.finalizeKill();
            } else {
                this.renderer.render();
                return;
            }
        }

        if (!this.paused && !this.levelComplete) {
            // Aloita ajastin tarvittaessa (45 s)
            if (this.timerEnd === 0) {
                this.timerEnd = performance.now() + 45 * 1000;
            }
            // Ajastin: jos aika loppuu, pelaaja kuolee
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