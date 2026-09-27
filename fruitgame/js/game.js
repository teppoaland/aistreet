// game.js – Hedelmäpeli: pelin tila, RNG ja iframe-kommunikaatio
class FruitGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.inIframe = (window.parent !== window);

        // Testitila: ?coins=N asettaa saldon, ?debug antaa ison kassan
        const params = new URLSearchParams(window.location.search);
        this.debug = params.has('debug');
        const startParam = parseInt(params.get('coins'), 10);
        this.coins = this.debug ? DEBUG_COINS
            : (isNaN(startParam) ? START_COINS : Math.max(0, startParam));

        // Rullat: pos = nauhan positio (liukuva), state = idle|free|brake|done
        this.reels = [];
        for (let i = 0; i < REEL_COUNT; i++) {
            this.reels.push({
                pos: Math.random() * STRIP_LEN,
                wantStop: false,
                state: 'idle',
                from: 0,
                to: 0,
                t: 0,
                dur: 0,
                lastIdx: -1
            });
        }

        this.spinning = false;
        this.spinT = 0;
        this.resultIds = ['cherry', 'cherry', 'cherry'];
        this.resultSlots = [0, 0, 0];
        this.lastWin = 0;
        this.winRows = [false, false, false];
        this.flash = 0;
        this.bigWin = null;
        this.bigWinT = 0;
        this.insertT = 0;
        this.sparkles = [];
        this.message = '';
        this.messageKind = 'info';
        this.spins = 0;
        this.wins = 0;
        this.time = 0;
        this.lastTs = 0;
        this.hudT = 0;              // HUD-tarkistusväli (ilmaisen pyöräytyksen tila)

        // Talon ilmainen pyöräytys (1 / 120 s) – aikaleima pelin omassa avaimessa
        this.lastFreeSpinAt = this.readFreeSpinStamp();
        this.freeSpinAvailable = this.freeSpinReady();
        this.freeSpinIn = 0;        // sekuntia seuraavaan ilmaiseen
        this.spinWasFree = false;   // oliko käynnissä oleva pyöräytys ilmainen
        this.applyFreeSpin();

        this.renderer = new Renderer(this.canvas, this);
        this.input = new InputHandler(this);

        // Saldo kadulta (street lähettää fruitSync-viestin kun peli avataan)
        window.addEventListener('message', (e) => this.onMessage(e));

        this.setMessage(this.debug ? 'DEBUG: kassa ' + this.coins : 'Tervetuloa! Paina PYÖRÄYTÄ.', 'info');
        if (this.freeSpinAvailable) this.setMessage('Talo tarjoaa 1 ilmaisen pyöräytyksen!', 'good');
        this.updateHUD();

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    /* ═══ PELISILMUKKA ═══════════════════════════════ */
    loop(ts) {
        requestAnimationFrame(this.loop);
        if (!this.lastTs) this.lastTs = ts;
        const dt = Math.min((ts - this.lastTs) / 1000, 0.06);
        this.lastTs = ts;
        this.update(dt);
        this.renderer.render();
    }

    update(dt) {
        this.time += dt;
        // Ilmaisen pyöräytyksen tila: jäädytys kuluu reaaliajassa → tarkista 4× sekunnissa
        this.hudT += dt;
        if (this.hudT >= 0.25) {
            this.hudT = 0;
            const wasFree = this.freeSpinAvailable;
            this.applyFreeSpin();
            if (wasFree !== this.freeSpinAvailable) this.updateHUD();
        }
        if (this.insertT > 0) this.insertT = Math.max(0, this.insertT - dt);
        if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.5);
        if (this.bigWinT > 0) {
            this.bigWinT -= dt;
            if (this.bigWinT <= 0) this.bigWin = null;
        }

        if (this.spinning) {
            this.spinT += dt;
            for (let i = 0; i < REEL_COUNT; i++) this.updateReel(i, dt);
            if (this.reels.every((r) => r.state === 'done')) this.finishSpin();
        }

        // Kipinät
        for (let i = this.sparkles.length - 1; i >= 0; i--) {
            const s = this.sparkles[i];
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.vy += 70 * dt;
            s.life -= dt;
            if (s.life <= 0) this.sparkles.splice(i, 1);
        }
    }

    /* ═══ PYÖRÄYTYS ══════════════════════════════════ */
    spin() {
        if (this.spinning) return;

        // 1) Talon ilmainen pyöräytys menee ensin – ei veloitusta eikä fruitBet-viestiä
        if (this.freeSpinAvailable) {
            this.spinWasFree = true;
            this.lastFreeSpinAt = Date.now();
            this.writeFreeSpinStamp(this.lastFreeSpinAt);
            this.applyFreeSpin();
            this.updateHUD();
            this.setMessage('Talo tarjoaa: ilmainen pyöräytys!', 'good');
            AudioFX.playFreeSpin();
        } else {
            // 2) Maksullinen pyöräytys: 1 kolikko = 1 pyöräytys
            if (this.coins < BET) {
                this.setMessage(this.freeSpinIn > 0
                    ? 'Ei kolikoita! Ilmainen pyöräytys ' + this.formatFreeSpinIn() + ' kuluttua.'
                    : 'Ei kolikoita! Hanki lisää kadulta.', 'bad');
                AudioFX.playNoCoin();
                return;
            }
            this.spinWasFree = false;
            this.coins -= BET;
            this.sendToParent({ type: 'fruitBet' });
            AudioFX.playCoinIn();
            this.insertT = 0.42;
        }

        // Tulos arvotaan heti – rullat vain esittävät sen
        this.resultIds = [pickSymbolId(), pickSymbolId(), pickSymbolId()];
        this.resultSlots = [pickSlot(this.resultIds[0]), pickSlot(this.resultIds[1]), pickSlot(this.resultIds[2])];

        for (let i = 0; i < REEL_COUNT; i++) {
            const r = this.reels[i];
            r.wantStop = false;
            r.state = 'free';
            r.t = 0;
            r.dur = 0;
        }

        this.winRows = [false, false, false];
        this.flash = 0;
        this.bigWin = null;
        this.bigWinT = 0;
        this.spinning = true;
        this.spinT = 0;
        this.lastWin = 0;
        if (!this.spinWasFree) this.setMessage('Onnea matkaan…', 'info');
        this.updateHUD();
    }

    updateReel(i, dt) {
        const r = this.reels[i];
        if (r.state === 'done') return;

        if (r.state === 'free') {
            r.pos += SPIN_SPEED * dt;
            const idx = Math.floor(r.pos);
            if (idx !== r.lastIdx) {
                r.lastIdx = idx;
                if (idx % 2 === 0) AudioFX.playTick();
            }
            if (!r.wantStop && this.spinT >= STOP_DELAYS[i]) r.wantStop = true;
            if (r.wantStop) {
                const d = distToTarget(r.pos, this.resultSlots[i]);
                if (d <= DECEL_DIST) {
                    r.state = 'brake';
                    r.from = r.pos;
                    r.to = r.pos + d;
                    r.t = 0;
                    r.dur = Math.max(MIN_DECEL, (2 * d) / SPIN_SPEED);
                }
            }
        } else if (r.state === 'brake') {
            r.t += dt;
            const k = Math.min(1, r.t / r.dur);
            const e = 2 * k - k * k;              // lineaarinen hidastus
            r.pos = r.from + (r.to - r.from) * e;
            if (k >= 1) {
                r.pos = r.to;
                r.state = 'done';
                AudioFX.playStop();
            }
        }
    }

    finishSpin() {
        this.spinning = false;
        const ids = this.resultIds;
        const win = payoutFor(ids);
        const triple = (ids[0] === ids[1] && ids[1] === ids[2]);
        this.lastWin = win;
        this.spins++;

        if (win > 0) {
            this.wins++;
            this.coins += win;
            this.sendToParent({ type: 'fruitWin', coins: win });
            this.winRows = [
                ids[0] === ids[1],
                (ids[0] === ids[1]) || (ids[1] === ids[2]),
                ids[1] === ids[2]
            ];
            this.flash = 1;
            if (triple && ids[0] === 'diamond') {
                this.bigWin = 'JÄTTIPOTTI! +' + win;
                this.bigWinT = 2.4;
                AudioFX.playWin(3);
            } else if (triple) {
                this.bigWin = 'SUURI VOITTO! +' + win;
                this.bigWinT = 2.0;
                AudioFX.playWin(2);
            } else {
                this.bigWin = null;
                AudioFX.playWin(1);
            }
            this.setMessage(this.spinWasFree
                ? 'Ilmaisen voitto: +' + win + ' kolikkoa!'
                : 'Voitit +' + win + ' kolikkoa!', 'good');
            this.spawnSparkles(triple);
        } else {
            this.winRows = [false, false, false];
            this.bigWin = null;
            this.setMessage('Ei voittoa – yritä uudelleen!', 'bad');
            AudioFX.playLose();
        }
        this.updateHUD();
    }

    spawnSparkles(big) {
        const n = big ? 42 : 20;
        const colors = ['255,215,0', '255,255,255', '255,180,60', '120,235,255'];
        for (let i = 0; i < n; i++) {
            const x = reelX(Math.floor(Math.random() * REEL_COUNT)) + Math.random() * WIN_W;
            const y = PAYLINE_Y - 12 + Math.random() * 24;
            this.sparkles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 90,
                vy: -40 - Math.random() * 120,
                life: 0.5 + Math.random() * 0.7,
                maxLife: 1.2,
                size: 2 + Math.floor(Math.random() * 3),
                rgb: colors[Math.floor(Math.random() * colors.length)]
            });
        }
    }

    /* ═══ POISTUMINEN ════════════════════════════════ */
    exitToStreet() {
        if (this.spinning) {
            this.setMessage('Odota että rullat pysähtyvät!', 'bad');
            return;
        }
        this.sendToParent('RETURN_TO_STREET');
    }

    /* ═══ KADUN KANSSA (postMessage) ═════════════════ */
    sendToParent(msg) {
        if (!this.inIframe) return;
        try { window.parent.postMessage(msg, '*'); } catch (e) {}
    }

    onMessage(e) {
        const d = e.data;
        if (d && d.type === 'fruitSync' && typeof d.coins === 'number') {
            this.coins = Math.max(0, Math.floor(d.coins));
            this.updateHUD();
        }
    }

    /* ═══ ILMAINEN PYÖRÄYTYS (talon tarjoama) ═══════ */
    readFreeSpinStamp() {
        try {
            const v = window.localStorage.getItem(FREE_SPIN_KEY);
            return v ? (parseInt(v, 10) || 0) : 0;
        } catch (e) { return 0; }
    }

    writeFreeSpinStamp(t) {
        try { window.localStorage.setItem(FREE_SPIN_KEY, String(t)); } catch (e) {}
    }

    /** Onko jäädytys (120 s) kulunut edellisestä ilmaisesta pyöräytyksestä? */
    freeSpinReady() {
        return (Date.now() - this.lastFreeSpinAt) >= FREE_SPIN_COOLDOWN_MS;
    }

    /** Päivittää ilmaisen pyöräytyksen tilan ja jäljellä olevan ajan */
    applyFreeSpin() {
        this.freeSpinAvailable = this.freeSpinReady();
        const left = FREE_SPIN_COOLDOWN_MS - (Date.now() - this.lastFreeSpinAt);
        this.freeSpinIn = this.freeSpinAvailable ? 0 : Math.max(0, left / 1000);
    }

    formatFreeSpinIn() {
        const s = Math.ceil(this.freeSpinIn);
        return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }

    /* ═══ HUD ════════════════════════════════════════ */
    setMessage(text, kind) {
        this.message = text;
        this.messageKind = kind || 'info';
    }

    updateHUD() {
        const c = document.getElementById('coin-display');
        if (c) c.textContent = '💰 ' + this.coins;
        const b = document.getElementById('bet-display');
        if (b) b.textContent = 'PANOS ' + BET;
        const w = document.getElementById('win-display');
        if (w) w.textContent = 'VOITTO ' + (this.lastWin > 0 ? '+' + this.lastWin : '–');
        const st = document.getElementById('stat-display');
        if (st) st.textContent = '🎰 ' + this.spins + ' / ' + this.wins;
        const btn = document.getElementById('spin-btn');
        if (btn) {
            // Ilmainen pyöräytys pitää napin käytettävänä myös ilman kolikoita
            btn.classList.toggle('disabled', this.coins < BET && !this.freeSpinAvailable);
            btn.classList.toggle('free', this.freeSpinAvailable);
        }
    }

}

/* Käynnistys – sama käytäntö kuin digGame1/digGame2 (js/game.js) */
window.addEventListener('DOMContentLoaded', () => {
    new FruitGame();
});

