/* ═══════════════════════════════════════════════════════════
   game.js – Laivanupotus (sinkship) – pelin ydin
   Viihtyisä päivähuone (proseduraalinen) + 10×10-laivanupotus.
   Ohjaus:
     · hiiri / kosketus suoraan ruutuun
     · näppäimistö: nuolet/W,S,D = kursori · Enter/Space = isku ·
       R = käännä · A = automaattiasetus
     · mobiili: D-pad + ⚡ (toimi) / ⟳ (käännä) / 🎲 (automaatti)
   ═══════════════════════════════════════════════════════════ */
const Laivanupotus = (() => {
'use strict';

let cnv, ctx, afid, lt = 0, t = 0;
let W = 800, H = 540;
let lastTouchMs = 0;

/* ── Tilat ── */
let st = 'title';                 // title | place | battle | over
let touch = false;
const keys = {};
let cur = { r: 5, c: 5 };

/* ── Viestit / efektit ── */
let msg = '', msgT = 0;
let badFlash = 0, hitFlash = 0;
let booms = [];                   // { x, y, r, life, max }
let waves = [];                   // ruutujen satunnaisvaiheet (aaltoilu)

/* ── Pelivakiot ── */
const N = 10;
const SHIP_DEFS = [
    { n: 'Lentotukialus', l: 5 },
    { n: 'Taistelulaiva', l: 4 },
    { n: 'Risteilijä',    l: 3 },
    { n: 'Sukellusvene',  l: 3 },
    { n: 'Hävittäjä',     l: 2 },
];

/* ═══ Pelitila ═══════════════════════════════════ */
let state = null;
let ready = false;                 // kaikki laivat asetettu – odottaa aloitusvahvistusta (Enter)
let battleStartAt = 0;             // aikaleima (ms), milloin taistelu alkaa automaattisesti
const BATTLE_START_DELAY = 4000;   // dramaattinen lähtölaskenta (4 s)

function mkSide() {
    return {
        grid: Array.from({ length: N }, () => Array(N).fill(-1)),   // laivaidx tai -1
        hit:  Array.from({ length: N }, () => Array(N).fill(false)),
        ships: SHIP_DEFS.map(s => ({ len: s.l, rem: s.l, sunk: false })),
        sunk: 0,
    };
}

function fresh() {
    return {
        player: mkSide(), enemy: mkSide(),
        turn: 'player', orient: 0, placeIdx: 0,
        aiHunt: [], aiNext: 0, shots: 0,
        aiTarget: null,            // { r, c } – mihin tekoäly tähtää (näkyy viiveen aikana)
        win: null,                 // null | 'win' | 'lose'
    };
}

/* ═══ Laivan asettelu ════════════════════════════ */
function placeShip(s, idx, r, c, ori) {
    const sh = SHIP_DEFS[idx];
    const dr = ori ? 1 : 0, dc = ori ? 0 : 1;
    if (r + dr * (sh.l - 1) >= N || c + dc * (sh.l - 1) >= N) return false;
    for (let k = 0; k < sh.l; k++) {
        if (s.grid[r + dr * k][c + dc * k] >= 0) return false;
    }
    for (let k = 0; k < sh.l; k++) s.grid[r + dr * k][c + dc * k] = idx;
    return true;
}

function autoPlace(s, startIdx) {
    let guard = 0;
    for (let idx = startIdx; idx < SHIP_DEFS.length; idx++) {
        let ok = false, g2 = 0;
        while (!ok && g2 < 500) {
            const r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
            const ori = Math.random() < 0.5 ? 0 : 1;
            ok = placeShip(s, idx, r, c, ori);
            g2++;
        }
        guard++;
        if (guard > 200) break;
    }
    return guard < 200;
}

/* ═══ Tulitus ════════════════════════════════════ */
function fire(s, r, c) {
    if (s.hit[r][c]) return null;
    s.hit[r][c] = true;
    const si = s.grid[r][c];
    if (si >= 0) {
        const sh = s.ships[si];
        sh.rem--;
        if (sh.rem <= 0 && !sh.sunk) { sh.sunk = true; s.sunk++; return 'sunk'; }
        return 'hit';
    }
    return 'miss';
}

function pushHunt(r, c) {
    const H = state.player.hit;
    if (r - 1 >= 0 && !H[r - 1][c]) state.aiHunt.push({ r: r - 1, c: c });
    if (r + 1 <  N && !H[r + 1][c]) state.aiHunt.push({ r: r + 1, c: c });
    if (c - 1 >= 0 && !H[r][c - 1]) state.aiHunt.push({ r: r, c: c - 1 });
    if (c + 1 <  N && !H[r][c + 1]) state.aiHunt.push({ r: r, c: c + 1 });
}

/* ═══ Kierroksen kulku ═══════════════════════════ */
function endIfDone() {
    const S = state;
    if (S.enemy.sunk >= SHIP_DEFS.length) { S.win = 'win'; endGame(true); return true; }
    if (S.player.sunk >= SHIP_DEFS.length) { S.win = 'lose'; endGame(false); return true; }
    return false;
}

function playerFire(r, c) {
    if (st !== 'battle' || state.win || state.turn !== 'player') return;
    const res = fire(state.enemy, r, c);
    if (res === null) return;
    state.shots++;
    cur.r = r; cur.c = c;
    const L = layout();
    boomAt(cellCx(L.px, c), cellCy(L.py, r), res === 'sunk' ? 26 : 16, res === 'sunk' ? 34 : 22);
    if (res === 'sunk') { SoundFX.playSink(); ntf(SHIP_DEFS[state.enemy.grid[r][c]].n + ' upposi!'); }
    else if (res === 'hit') { SoundFX.playHit(); hitFlash = 14; }
    else { SoundFX.playSplash(); }
    updateHUD();
    if (endIfDone()) return;
    state.turn = 'enemy';
    state.aiTarget = aiPickTarget();   // päätä kohde heti – pelaaja näkee mihin tähdätään
    state.aiNext = 60;                 // 1 s viive ennen tekoälyn iskua
}

function aiPickTarget() {
    const S = state;
    let cell = null;
    while (S.aiHunt.length) {
        const cnd = S.aiHunt.shift();
        if (cnd && cnd.r >= 0 && cnd.r < N && cnd.c >= 0 && cnd.c < N && !S.player.hit[cnd.r][cnd.c]) { cell = cnd; break; }
    }
    let guard = 0;
    while (!cell && guard < 400) {
        const r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
        if (!S.player.hit[r][c]) cell = { r: r, c: c };
        guard++;
    }
    return cell;
}

function aiAct() {
    const S = state;
    const cell = S.aiTarget || aiPickTarget();
    S.aiTarget = null;
    if (!cell) return;
    const res = fire(S.player, cell.r, cell.c);
    if (res === 'hit' || res === 'sunk') pushHunt(cell.r, cell.c);
    const L = layout();
    boomAt(cellCx(L.px, cell.c), cellCy(L.py, cell.r), res === 'sunk' ? 26 : 16, res === 'sunk' ? 34 : 22);
    if (res === 'sunk') SoundFX.playSink();
    else if (res === 'hit') SoundFX.playHit();
    else SoundFX.playSplash();
    updateHUD();
    if (endIfDone()) return;
    S.turn = 'player';
}

/* ═══ Pelin aloitus / lopetus ════════════════════ */
function resetGame() {
    state = fresh();
    ready = false;
    battleStartAt = 0;
    cur = { r: 5, c: 5 };
    booms = []; badFlash = 0; hitFlash = 0;
    st = 'place';
    ntf('Aseta laivastosi: ' + SHIP_DEFS[0].n + ' (' + SHIP_DEFS[0].l + ' ruutua)');
    updateHUD();
}

function allShipsPlaced(s) {
    let cells = 0;
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
            if (s.grid[r][c] >= 0) cells++;
    return cells >= SHIP_DEFS.reduce((a, x) => a + x.l, 0);
}

function startBattle() {
    if (!allShipsPlaced(state.player)) {   // varmistus: taistelu vasta kun kaikki laivat asetettu
        ntf('Aseta kaikki laivat ensin!', 90);
        return;
    }
    autoPlace(state.enemy, 0);
    state.turn = 'player';
    st = 'battle';
    ntf('Taistelu alkaa! Ammu vihollisen ruudukkoa.');
    updateHUD();
}

function endGame(won) {
    st = 'over';
    g('overlay').classList.remove('hidden');
    g('overlay-title').textContent = won ? '🏆 Voitit!' : '💀 Hävisit';
    const stats = '<br>Iskujasi: <b>' + state.shots + '</b> – ' +
        'upotettuja: <b>' + state.enemy.sunk + ' / 5</b>.';
    const reward = won ? '<br>Ansaitsit yhden 💰!' : '';
    g('overlay-message').innerHTML =
        (won ? 'Koko vihollisen laivasto on pohjassa!' : 'Vihollinen upotti koko laivastosi.') +
        stats + reward +
        '<br><br>Pelaatko uudelleen?';
    g('overlay-action-btn').textContent = 'Pelaa';
    g('overlay-exit-btn').textContent = 'Poistu';
    g('overlay-exit-btn').style.display = '';
    if (won) {
        SoundFX.playWin();
        try { window.parent.postMessage('COIN_COLLECTED', '*'); } catch(e) {}
    } else {
        SoundFX.playLose();
    }
}

function g(id) { return document.getElementById(id); }

/* ═══ Layout-koordinaatit (riippuvat canvasin W/H:stä) ═══ */
function layout() {
    const hudH = Math.max(44, Math.min(80, Math.round(H * 0.14)));
    const portrait = H > W * 1.35;
    const gapB = portrait ? 10 : 14;
    let cell;
    if (portrait) {
        cell = Math.floor((H - hudH - gapB - 18) / (2 * N));
        cell = Math.min(cell, Math.floor((W - 18) / N));
    } else {
        cell = Math.min(Math.floor((W - 220 - gapB) / (2 * N)), Math.floor((H - hudH - 10) / (N + 1)));
    }
    cell = Math.max(15, Math.min(46, cell));
    const board = cell * N;
    let ex, ey, px, py;
    if (portrait) {
        const x = Math.floor((W - board) / 2);
        ey = hudH + 12;
        ex = px = x;
        py = ey + board + gapB + 6;
    } else {
        const total = board * 2 + gapB;
        const x0 = Math.floor((W - total) / 2);
        ey = py = hudH + 2;          // laudat alkavat heti katon alapuolelta
        ex = x0;
        px = x0 + board + gapB;
    }
    return { hudH, portrait, cell, board, ex, ey, px, py, gapB };
}

function cellCx(bx, c) { return Math.round(bx + (c + 0.5) * layout().cell); }
function cellCy(by, r) { return Math.round(by + (r + 0.5) * layout().cell); }

function boomAt(x, y, r0, life) { booms.push({ x: x, y: y, r: r0, life: life, max: life }); }

/* ═══ Viesti (canvas-banneri) ═══ */
function ntf(m, frames) { msg = m; msgT = frames || 120; }

/* ═══ HUD (DOM) ═══ */
function updateHUD() {
    const S = state;
    if (g('turn-display')) {
        if (st === 'title')       g('turn-display').textContent = '🎯 Valmis aloitukseen';
        else if (st === 'place')  g('turn-display').textContent = ready ? '🎯 Taistelu alkaa…' : '🎯 Aseta laivastosi';
        else if (st === 'over')   g('turn-display').textContent = S.win === 'win' ? '🏆 Voitit!' : '💀 Hävisit';
        else                      g('turn-display').textContent = S.turn === 'player' ? '🎯 Sinun vuorosi' : '🤖 Vihollisen vuoro…';
    }
    if (g('enemy-ships'))  g('enemy-ships').textContent  = '👁 Upotettu: ' + S.enemy.sunk + '/5';
    if (g('player-ships')) g('player-ships').textContent = '🛡 Sinä: ' + (SHIP_DEFS.length - S.player.sunk) + '/5';
    if (g('shots-display')) g('shots-display').textContent = '🎯 Iskut: ' + S.shots;
}

/* ═══ Ohjaus: näppäimistö ═══ */
/* keyName: e.code (fyysinen näppäin) tai e.key (merkki) – toimii kaikissa selaimissa */
function keyName(e) {
    const c = e.code || e.key;
    return typeof c === 'string' ? c.toUpperCase() : '';
}

function onKey(e) {
    keys[e.code || e.key || ''] = (e.type === 'keydown');
    if (e.type !== 'keydown') return;
    const c = keyName(e);
    const mv = (dr) => {
        cur.r = Math.max(0, Math.min(N - 1, cur.r + dr[0]));
        cur.c = Math.max(0, Math.min(N - 1, cur.c + dr[1]));
    };
    const act = () => {
        if (st === 'place') { if (ready) startBattle(); else tryPlace(); }
        else if (st === 'battle') playerFire(cur.r, cur.c);
    };
    const UP    = c === 'ARROWUP'    || c === 'KEYW' || c === 'W';
    const DOWN  = c === 'ARROWDOWN'  || c === 'KEYS' || c === 'S';
    const LEFT  = c === 'ARROWLEFT';
    const RIGHT = c === 'ARROWRIGHT' || c === 'KEYD' || c === 'D';
    const ACT   = c === 'ENTER' || c === 'KEYENTER' || c === 'NUMPADENTER' || c === 'SPACE' || c === ' ';
    const ROT   = c === 'KEYR' || c === 'R' || c === 'KEYK' || c === 'K';
    const AUTO  = c === 'KEYA' || c === 'A' || c === 'KEYE' || c === 'E';
    const UNDO  = c === 'BACKSPACE' || c === 'KEYU' || c === 'U' || c === 'KEYZ' || c === 'Z';
    if (UP || DOWN || LEFT || RIGHT || ACT || ROT || AUTO || UNDO) e.preventDefault();
    if (st === 'over') {
        if (ACT) { g('overlay').classList.add('hidden'); resetGame(); }
        else if (c === 'ESCAPE' || c === 'BACKSPACE') {
            try { window.parent.postMessage('RETURN_TO_STREET', '*'); } catch(e) {}
        }
        return;
    }
    if (st === 'title') {
        if (ACT) {
            g('overlay').classList.add('hidden');
            const ob = g('overlay-action-btn');
            if (ob && typeof ob.blur === 'function') ob.blur();
            resetGame();
        }
        return;
    }
    if (UP) mv([-1, 0]);
    else if (DOWN) mv([1, 0]);
    else if (LEFT) mv([0, -1]);
    else if (RIGHT) mv([0, 1]);
    else if (ACT) act();
    else if (ROT) { if (st === 'place') { state.orient = 1 - state.orient; SoundFX.playRotate(); } }
    else if (AUTO) { if (st === 'place') doAuto(); }
    else if (UNDO) { if (st === 'place') undoPlace(); }
}

function tryPlace() {
    const S = state;
    if (placeShip(S.player, S.placeIdx, cur.r, cur.c, S.orient)) {
        SoundFX.playPlace();
        S.placeIdx++;
        if (S.placeIdx >= SHIP_DEFS.length) {
            ready = true;
            msg = ''; msgT = 0;
            battleStartAt = performance.now() + BATTLE_START_DELAY;
            updateHUD();
        } else {
            ntf('Seuraava: ' + SHIP_DEFS[S.placeIdx].n + ' (' + SHIP_DEFS[S.placeIdx].l + ' ruutua)' +
                ' – ' + (S.orient ? 'pysty' : 'vaaka'), 100);
        }
    } else {
        badFlash = 16;
        ntf('Ei mahdu tai menee päällekkäin!', 70);
    }
}

function doAuto() {
    if (st !== 'place' || ready) return;
    if (autoPlace(state.player, state.placeIdx)) {
        ready = true;
        ntf('Automaatti: laivat asetettu!', 240);
        battleStartAt = performance.now() + BATTLE_START_DELAY;
        updateHUD();
    }
}

/* ── Viimeisimmän asetetun laivan peruutus (U / ⌫ / Z) ── */
function undoPlace() {
    const S = state;
    if (st !== 'place' || S.placeIdx <= 0) return;
    S.placeIdx--;
    for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
            if (S.player.grid[r][c] === S.placeIdx) S.player.grid[r][c] = -1;
    ready = false;
    battleStartAt = 0;
    ntf('Peruutettu: ' + SHIP_DEFS[S.placeIdx].n);
    SoundFX.playRotate();
}

/* ═══ Ohjaus: kosketusnapit ═══ */
function pressDir(dr) {
    cur.r = Math.max(0, Math.min(N - 1, cur.r + dr[0]));
    cur.c = Math.max(0, Math.min(N - 1, cur.c + dr[1]));
}
function pressAct() {
    if (st === 'over') { g('overlay').classList.add('hidden'); resetGame(); }
    else if (st === 'place') { if (ready) startBattle(); else tryPlace(); }
    else if (st === 'battle') playerFire(cur.r, cur.c);
}

function setupInput() {
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', e => { keys[e.code || e.key || ''] = false; });

    const bind = (sel, fn) => {
        const el = document.querySelector(sel);
        if (el) el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
    };
    bind('.touch-btn.up',    () => pressDir([-1, 0]));
    bind('.touch-btn.down',  () => pressDir([1, 0]));
    bind('.touch-btn.left',  () => pressDir([0, -1]));
    bind('.touch-btn.right', () => pressDir([0, 1]));
    bind('#act-btn',  pressAct);
    bind('#rot-btn',  () => { if (st === 'place') { state.orient = 1 - state.orient; SoundFX.playRotate(); } });
    bind('#auto-btn', doAuto);

    cnv.addEventListener('mousedown', e => {
        if (Date.now() - lastTouchMs < 350) return;   // kosketus aiheuttaa jo tapahtuman
        canvasPick(e.clientX, e.clientY);
    });
    cnv.addEventListener('touchstart', e => {
        lastTouchMs = Date.now();
        const to = e.touches[0];
        if (to) canvasPick(to.clientX, to.clientY);
    }, { passive: true });
}

function canvasPick(sx, sy) {
    if (st === 'title' || st === 'over') return;
    const rect = cnv.getBoundingClientRect();
    const x = (sx - rect.left) * (W / rect.width);
    const y = (sy - rect.top) * (H / rect.height);
    const L = layout();
    const cell = L.cell;
    const pick = (bx, by) => {
        if (x < bx || y < by || x >= bx + cell * N || y >= by + cell * N) return null;
        return { r: Math.floor((y - by) / cell), c: Math.floor((x - bx) / cell) };
    };
    const pe = pick(L.ex, L.ey), pp = pick(L.px, L.py);
    if (st === 'place') {
        if (pp) { cur.r = pp.r; cur.c = pp.c; }   // klikkaus siirtää vain kursorin – asetus Enter/⚡
        return;
    }
    if (st === 'battle' && state.turn === 'player') {
        if (pe) { playerFire(pe.r, pe.c); }
        else if (pp) { cur.r = pp.r; cur.c = pp.c; }
    }
}

/* ═══ Pääsilmukka ════════════════════════════════ */
function update(dt) {
    t += dt;
    if (msgT > 0) msgT -= dt;
    if (badFlash > 0) badFlash -= dt;
    if (hitFlash > 0) hitFlash -= dt;

    // Automaattinen taistelun aloitus, kun koko laivasto on asetettu (reaaliajassa)
    if (st === 'place' && ready && battleStartAt && performance.now() >= battleStartAt) {
        battleStartAt = 0;
        startBattle();
    }

    // Räjähdys-/roiskerenkaat
    for (let i = booms.length - 1; i >= 0; i--) {
        booms[i].life -= dt;
        if (booms[i].life <= 0) booms.splice(i, 1);
    }

    // Tekoälyn vuoro
    if (st === 'battle' && state.win === null && state.turn === 'enemy') {
        state.aiNext -= dt;
        if (state.aiNext <= 0) aiAct();
    }
}

/* ═══ Pienet piirtoapurit ═══ */
function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w - r, y, x + w - r, y + r, r);
    ctx.arcTo(x + w - r, y + h - r, x + w - 2 * r, y + h - r, r);
    ctx.arcTo(x + r, y + h - r, x + r, y + h - 2 * r, r);
    ctx.arcTo(x, y + r, x, y, r);
    ctx.closePath();
}

function font(px, bold) { ctx.font = (bold ? 'bold ' : '') + px + 'px "Press Start 2P", "Courier New", monospace'; }
function fitFs(text, maxW, minPx, maxPx) {
    let px = maxPx;
    while (px > minPx) {
        if (ctx.measureText(text).width <= maxW) break;
        px--;
    }
    return px;
}

/* ═══ Viihtyisä päivähuone ═══ */
function drawRoom(L) {
    // Seinä: lämmin päivävalo
    const wall = ctx.createLinearGradient(0, 0, 0, Math.round(H * 0.82));
    wall.addColorStop(0, '#f6ead2');
    wall.addColorStop(0.55, '#e8d5ae');
    wall.addColorStop(1, '#d9bd92');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, Math.round(H * 0.82));

    // Täpläinen tapetti (vaaleat pystyraidat)
    ctx.fillStyle = 'rgba(200,170,120,0.20)';
    for (let x = 8; x < W + 16; x += 24) ctx.fillRect(x, 6, 4, Math.round(H * 0.8));
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = 20; x < W + 16; x += 24) ctx.fillRect(x, 6, 2, Math.round(H * 0.8));

    // Lista (seinän alareuna)
    ctx.fillStyle = '#9a7246';
    ctx.fillRect(0, Math.round(H * 0.82) - 7, W, 7);
    ctx.fillStyle = '#7c5a36';
    ctx.fillRect(0, Math.round(H * 0.82) - 2, W, 2);

    // Lattia: lämpimät lautaset perspektiivillä
    const fy = Math.round(H * 0.82);
    const floor = ctx.createLinearGradient(0, fy, 0, H);
    floor.addColorStop(0, '#8a6a45');
    floor.addColorStop(1, '#64482c');
    ctx.fillStyle = floor;
    ctx.fillRect(0, fy, W, H - fy);

    ctx.strokeStyle = 'rgba(40,24,10,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 9; i++) {
        const fx = i * (W / 9);
        ctx.moveTo(fx, fy + 1);
        ctx.lineTo(fx + (fx - W / 2) * 0.05, H);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let k = 1; k <= 4; k++) {
        const yy = fy + (H - fy) * k / 5;
        ctx.moveTo(0, yy); ctx.lineTo(W, yy);
    }
    ctx.stroke();
}

/* ── Ikkuna: aamuaurinko + verhot ── */
function drawWindow(L) {
    if (L.portrait) {                       // pysty: pieni aurinkotaulu oikeaan yläkulmaan
        const pw2 = Math.min(46, Math.round(W * 0.12));
        const wx2 = W - pw2 - 6, wy2 = Math.max(2, L.hudH - 26), wh2 = Math.round(H * 0.12);
        const sky2 = ctx.createLinearGradient(0, wy2, 0, wy2 + wh2);
        sky2.addColorStop(0, '#79bae8'); sky2.addColorStop(1, '#d8ecf8');
        ctx.fillStyle = sky2; ctx.fillRect(wx2, wy2, pw2, wh2);
        ctx.fillStyle = '#ffe080';
        ctx.beginPath(); ctx.arc(wx2 + pw2 * 0.7, wy2 + wh2 * 0.4, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#b8a070';
        ctx.fillRect(wx2 - 3, wy2 - 3, pw2 + 6, 3);
        ctx.fillRect(wx2 - 3, wy2 + wh2, pw2 + 6, 3);
        ctx.fillRect(wx2 - 3, wy2, 3, wh2);
        ctx.fillRect(wx2 + pw2, wy2, 3, wh2);
        return;
    }
    let ww = 78, wh = Math.max(44, Math.min(110, L.ey - L.hudH - 12));
    const wx = L.ex - ww - 16;
    if (wx < 6 || wh < 40) return;          // ei mahdu marginaaliin
    const wy = L.hudH + 2;
    const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, '#6db3e8');
    sky.addColorStop(1, '#cde9f8');
    ctx.fillStyle = sky;
    ctx.fillRect(wx, wy, ww, wh);

    // Aurinko + säteet
    const sx = wx + ww * 0.78, sy = wy + wh * 0.34;
    const halo = ctx.createRadialGradient(sx, sy, 2, sx, sy, 30);
    halo.addColorStop(0, 'rgba(255,240,180,0.95)');
    halo.addColorStop(0.4, 'rgba(255,230,150,0.55)');
    halo.addColorStop(1, 'rgba(255,225,130,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(sx, sy, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe080';
    ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.fill();

    // Pilvi (soikiot skaalatulla ympyrällä – ei vaadi ctx.ellipse-tukea)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.translate(wx + ww * 0.3, wy + wh * 0.55);
    ctx.scale(2.2, 1);
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.translate(wx + ww * 0.35, wy + wh * 0.5);
    ctx.scale(1.9, 1);
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Kehys + ristikko + verhot
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(wx - 5, wy - 5, ww + 10, 5);
    ctx.fillRect(wx - 5, wy + wh, ww + 10, 5);
    ctx.fillRect(wx - 5, wy, 5, wh);
    ctx.fillRect(wx + ww, wy, 5, wh);
    ctx.strokeStyle = '#6b4a2c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.stroke();
    // Verhot
    ctx.fillStyle = 'rgba(190,90,60,0.85)';
    ctx.fillRect(wx + 2, wy, 7, wh - 8);
    ctx.fillRect(wx + ww - 9, wy, 7, wh - 8);
    ctx.fillStyle = 'rgba(160,70,45,0.85)';
    ctx.fillRect(wx + 2, wy, 3, wh - 8);
    ctx.fillRect(wx + ww - 6, wy, 3, wh - 8);
    // Ikkunalaudan varjo
    ctx.fillStyle = 'rgba(60,40,20,0.25)';
    ctx.fillRect(wx - 8, wy + wh + 5, ww + 16, 5);
}

/* ── Hylly: kirjoja, laivamalli, kasvi ── */
function drawShelf(L) {
    if (L.portrait) return;          // pystyasennossa ei mahdu (ikkuna/hylly)
    let shx, shy, shw;
    if (L.portrait) {
        shw = Math.min(190, W - 32);
        shx = Math.floor((W - shw) / 2);
        shy = Math.max(2, L.ey - 58);
    } else {
        const freeR = W - (L.px + L.board) - 14;
        if (freeR < 70) return;              // ei mahdu oikeaan marginaaliin
        shw = Math.min(200, Math.max(70, freeR));
        shx = L.px + L.board + 8;
        shy = L.hudH + 4;
    }
    // Hyllylauta
    ctx.fillStyle = '#8a5c34';
    ctx.fillRect(shx - 6, shy + 34, shw + 12, 6);
    ctx.fillStyle = '#6b4524';
    ctx.fillRect(shx - 6, shy + 39, shw + 12, 2);

    // Kirjat
    const bcol = ['#b54538', '#33608f', '#4d7a3a', '#7a4a9e', '#c98a2a', '#5b7fb0'];
    let bx = shx + 4;
    for (let i = 0; i < 5 && bx < shx + shw - 46; i++) {
        const bw = 8 + (i * 37 % 5), bh = 26 + (i * 13 % 8);
        ctx.fillStyle = bcol[i % bcol.length];
        ctx.fillRect(bx, shy + 34 - bh + 1, bw, bh - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(bx + 2, shy + 34 - bh + 4, 1.5, bh - 14);
        bx += bw + 3;
    }
    // Laivamalli hyllyn päällä
    const mx = shx + shw - 40;
    ctx.fillStyle = '#4a3420';
    ctx.fillRect(mx, shy + 34 - 10, 34, 10);            // runko
    ctx.fillStyle = '#6b4a2c';
    ctx.beginPath(); ctx.moveTo(mx + 4, shy + 24); ctx.lineTo(mx + 17, shy + 20); ctx.lineTo(mx + 30, shy + 24); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ddd8cc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx + 17, shy + 20); ctx.lineTo(mx + 17, shy + 6);
    ctx.moveTo(mx + 10, shy + 20); ctx.lineTo(mx + 10, shy + 8);
    ctx.stroke();
    ctx.fillStyle = '#f2ead8';
    ctx.beginPath(); ctx.moveTo(mx + 17, shy + 6); ctx.lineTo(mx + 4, shy + 14); ctx.lineTo(mx + 30, shy + 14); ctx.closePath(); ctx.fill();
    // Kasvi hyllyn päässä
    const px2 = shx + shw - 2;
    ctx.fillStyle = '#9c4a2a';
    ctx.fillRect(px2 - 6, shy + 34 - 12, 12, 12);
    ctx.strokeStyle = '#2f6b2f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px2, shy + 26); ctx.lineTo(px2 + 3, shy + 16);
    ctx.moveTo(px2 - 2, shy + 26); ctx.lineTo(px2 + 1, shy + 20);
    ctx.stroke();
}

/* ── Seinäjuliste: aallot + purjevene ── */
function drawPoster(L) {
    if (L.portrait) return;
    const px = 14, py = L.hudH + 4;
    if (px + 58 > L.ex - 6) return;      // ei mahdu – jätetään pois
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(px - 3, py - 3, 64, 58);
    const g = ctx.createLinearGradient(0, py, 0, py + 52);
    g.addColorStop(0, '#8fc4e8');
    g.addColorStop(1, '#2c5d92');
    ctx.fillStyle = g;
    ctx.fillRect(px, py, 58, 52);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    for (let wv = 0; wv < 3; wv++) {
        const y0 = py + 12 + wv * 13;
        ctx.beginPath();
        for (let x = 0; x <= 58; x += 4) {
            const yy = y0 + Math.sin(x * 0.25 + wv * 1.7 + t * 0.02) * 3;
            if (x === 0) ctx.moveTo(px + x, yy); else ctx.lineTo(px + x, yy);
        }
        ctx.stroke();
    }
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath(); ctx.moveTo(px + 12, py + 34); ctx.lineTo(px + 30, py + 32); ctx.lineTo(px + 46, py + 36); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px + 24, py + 33); ctx.lineTo(px + 24, py + 20); ctx.stroke();
    ctx.fillStyle = '#e8e0cc';
    ctx.beginPath(); ctx.moveTo(px + 24, py + 20); ctx.lineTo(px + 34, py + 26); ctx.lineTo(px + 24, py + 30); ctx.closePath(); ctx.fill();
}

/* ── Pöytä, jolla merikartat lepäävät ── */
function drawTable(L) {
    const b = L.board;
    let tx0, tx1, ty0, ty1;
    if (L.portrait) {
        tx0 = Math.min(L.ex, L.px) - 10;
        tx1 = Math.max(L.ex, L.px) + b + 10;
        ty0 = Math.min(L.ey, L.py) + 4;
        ty1 = Math.max(L.ey, L.py) + b + 16;
    } else {
        tx0 = L.ex - 14;
        tx1 = L.px + b + 14;
        ty0 = L.ey - 2;
        ty1 = L.py + b + 18;
    }
    if (ty0 >= ty1 - 6) ty0 = ty1 - 10;
    // Jalat
    ctx.fillStyle = '#4a2e16';
    ctx.fillRect(tx0 + 8, ty1 - 8, 8, 8);
    ctx.fillRect(tx1 - 16, ty1 - 8, 8, 8);
    // Kansi
    const top = ctx.createLinearGradient(0, ty0, 0, ty1);
    top.addColorStop(0, '#a87a48');
    top.addColorStop(0.4, '#c08e54');
    top.addColorStop(1, '#8a5f36');
    ctx.fillStyle = top;
    rr(tx0, ty0, tx1 - tx0, ty1 - ty0, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,38,18,0.6)';
    ctx.lineWidth = 1.5;
    rr(tx0 + 2, ty0 + 2, tx1 - tx0 - 4, ty1 - ty0 - 4, 5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,30,0.25)';
    ctx.beginPath();
    ctx.moveTo(tx0 + 12, ty0 + 8); ctx.lineTo(tx1 - 12, ty0 + 8);
    ctx.moveTo(tx0 + 12, ty1 - 4); ctx.lineTo(tx1 - 12, ty1 - 4);
    ctx.stroke();
}

/* ── Merikartta (ruudukko + kehys) ── */
function drawBoardFrame(L, x, y) {
    const b = L.board, cell = L.cell;
    // Kehys (tumma messinki)
    ctx.fillStyle = '#171b30';
    ctx.fillRect(x - 7, y - 7, b + 14, b + 14);
    ctx.strokeStyle = '#c9a84e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 6.5, y - 6.5, b + 13, b + 13);
    
}

/* Meri: ruudut + aaltoilevat välkkeet */
function drawSea(L, x, y) {
    const cell = L.cell;
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            const cx = x + c * cell, cy = y + r * cell;
            ctx.fillStyle = ((r + c) % 2 === 0) ? '#123a66' : '#0e3157';
            ctx.fillRect(cx, cy, cell, cell);
            // Aaltoileva valo (kevyt sinertävä välke)
            const ph = waves[r][c];
            const a = 0.10 + 0.08 * Math.sin(t * 0.05 + ph);
            ctx.fillStyle = 'rgba(130,180,235,' + a.toFixed(2) + ')';
            const gw = Math.max(2, Math.round(cell * 0.28));
            const gh = Math.max(1, Math.round(cell * 0.10));
            ctx.fillRect(cx + Math.round(cell * 0.22), cy + Math.round(cell * 0.42), gw, gh);
        }
    }
    // Ruudukkoritilä
    ctx.strokeStyle = 'rgba(10,20,40,0.75)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < N; i++) {
        ctx.moveTo(x, y + i * cell); ctx.lineTo(x + cell * N, y + i * cell);
        ctx.moveTo(x + i * cell, y); ctx.lineTo(x + i * cell, y + cell * N);
    }
    ctx.stroke();
}

/* ── Laivat: teräksenharmaa runko + kansi ──
   hide=true (vihollinen): piirrä vain upotetut (muut piilossa) */
function drawShips(L, s, x, y, hide) {
    const cell = L.cell;
    for (let idx = 0; idx < SHIP_DEFS.length; idx++) {
        let rs = [], cs = [];
        for (let r = 0; r < N; r++)
            for (let c = 0; c < N; c++)
                if (s.grid[r][c] === idx) { rs.push(r); cs.push(c); }
        if (!rs.length) continue;                       // ei asetettu
        if (hide && !s.ships[idx].sunk) continue;       // vihollinen: piilossa kunnes upotettu
        const ori = (Math.max(...rs) - Math.min(...rs)) > 0 ? 'v' : 'h';
        const r0 = Math.min(...rs), c0 = Math.min(...cs);
        const len = SHIP_DEFS[idx].l;
        // Runkolaatikko
        const px = x + c0 * cell, py = y + r0 * cell;
        const pw = ori === 'h' ? len * cell : cell;
        const ph = ori === 'v' ? len * cell : cell;
        const body = '#5c6673', deck = '#7d8b96', dark = '#404650';
        ctx.fillStyle = dark;
        ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);
        ctx.fillStyle = body;
        const inset = Math.max(1, Math.round(cell * 0.07));
        ctx.fillRect(px + inset, py + inset, pw - inset * 2, ph - inset * 2);
        ctx.fillStyle = deck;
        if (ori === 'h') ctx.fillRect(px + inset, py + inset + 1, pw - inset * 2, 2);
        else             ctx.fillRect(px + inset + 1, py + inset, 2, ph - inset * 2);
        // Kansi-ikkunarivit
        ctx.fillStyle = 'rgba(255,240,200,0.35)';
        if (ori === 'h') {
            for (let k = 1; k < len; k++) ctx.fillRect(px + k * cell + inset, py + inset + 3, 2, ph - inset * 2 - 6);
        } else {
            for (let k = 1; k < len; k++) ctx.fillRect(px + inset + 3, py + k * cell + inset, pw - inset * 2 - 6, 2);
        }
        // Komentosilta (keskellä)
        ctx.fillStyle = '#39404a';
        const cx0 = px + pw / 2, cy0 = py + ph / 2;
        if (ori === 'h') ctx.fillRect(cx0 - cell / 2 - 1, py + inset, cell + 2, ph - inset * 2);
        else             ctx.fillRect(px + inset, cy0 - cell / 2 - 1, pw - inset * 2, cell + 2);
        ctx.fillStyle = '#b8573a';
        if (ori === 'h') ctx.fillRect(cx0 - cell / 2 - 1, py + inset, cell + 2, 2);
        else             ctx.fillRect(px + inset, cy0 - cell / 2 - 1, 2, cell + 2);
        // Upotettu: puna-musta raidoitus
        if (s.ships[idx].sunk) {
            ctx.fillStyle = 'rgba(160,40,30,0.75)';
            if (ori === 'h') for (let k = 0; k < len; k++) ctx.fillRect(px + k * cell, py + inset, cell, ph - inset * 2);
            else            for (let k = 0; k < len; k++) ctx.fillRect(px + inset, py + k * cell, pw - inset * 2, cell);
            ctx.fillStyle = 'rgba(20,20,20,0.55)';
            if (ori === 'h') for (let k = 0; k < len * 2; k++) ctx.fillRect(px + k * cell / 2 + inset, py + ph * 0.4, 1.5, ph * 0.5);
            else            for (let k = 0; k < len * 2; k++) ctx.fillRect(px + pw * 0.4, py + k * cell / 2 + inset, pw * 0.5, 1.5);
        }
        // Pelaajan alukset: vaalea ääriviiva erottuvuutta varten (vihollinen piilossa)
        if (!hide) {
            ctx.strokeStyle = 'rgba(228,236,246,0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
        }
    }
}

/* ── Ammuntamerkit: huti (roiske) / osuma (tuli) ── */
function drawShots(L, s, x, y) {
    const cell = L.cell;
    for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
            if (!s.hit[r][c]) continue;
            const cx = x + c * cell + cell / 2, cy = y + r * cell + cell / 2;
            const hasShip = s.grid[r][c] >= 0;
            if (hasShip && s.ships[s.grid[r][c]].sunk) continue;   // upotus näyttää rungon
            if (hasShip) {
                // Osuma: liekki
                const fr = cell * 0.42;
                const gr = ctx.createRadialGradient(cx, cy, 1, cx, cy, fr + cell * 0.18);
                gr.addColorStop(0, '#fff3b0');
                gr.addColorStop(0.5, '#ffb020');
                gr.addColorStop(1, 'rgba(160,40,0,0)');
                ctx.fillStyle = gr;
                ctx.beginPath(); ctx.arc(cx, cy, fr + cell * 0.18, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ff8a20';
                ctx.beginPath(); ctx.arc(cx, cy, fr * 0.6, 0, Math.PI * 2); ctx.fill();
            } else {
                // Huti: valkoinen roiske + renkaat
                ctx.strokeStyle = 'rgba(235,244,255,0.9)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(cx, cy, cell * 0.28, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = '#e8f2ff';
                ctx.beginPath(); ctx.arc(cx, cy, cell * 0.10, 0, Math.PI * 2); ctx.fill();
            }
        }
    }
}

/* ── Kursori (keltainen kehys) ── */
function drawCursor(L, x, y) {
    const cell = L.cell;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.12);
    const cx = x + cur.c * cell, cy = y + cur.r * cell;
    ctx.strokeStyle = 'rgba(255,215,0,' + (0.55 + 0.4 * pulse).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 1, cy + 1, cell - 2, cell - 2);
}

/* ── Tekoälyn tähtäyskursori (punainen rasti, sykkii nopeammin) ── */
function drawAiThinkCursor(L, x, y, target) {
    const cell = L.cell;
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.3);        // nopeampi syke = "miettii"
    const cx = x + target.c * cell + cell / 2, cy = y + target.r * cell + cell / 2;
    const s = cell * (0.3 + 0.2 * pulse);
    const a = 0.55 + 0.4 * pulse;
    // Rasti (X)
    ctx.strokeStyle = 'rgba(220,40,40,' + a.toFixed(2) + ')';
    ctx.lineWidth = Math.max(1.5, cell * 0.12);
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s);
    ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s);
    ctx.stroke();
    // Pieni kysymysmerkki yläpuolella
    font(Math.max(8, Math.round(cell * 0.35)), true);
    ctx.fillStyle = 'rgba(255,200,100,' + (0.4 + 0.4 * Math.sin(t * 0.2)).toFixed(2) + ')';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('?', cx, cy - cell * 0.6);
    ctx.textAlign = 'left';
}

/* ── Asetteluesikatselu (vihreä ok / punainen ei) ── */
function drawPlacementGhost(L) {
    if (st !== 'place') return;
    const S = state;
    if (S.placeIdx >= SHIP_DEFS.length) return;   // kaikki asetettu – ei haamua
    const sh = SHIP_DEFS[S.placeIdx];
    const dr = S.orient ? 1 : 0, dc = S.orient ? 0 : 1;
    const r = cur.r, c = cur.c;
    // Mahtuuko?
    let ok = true;
    if (r + dr * (sh.l - 1) >= N || c + dc * (sh.l - 1) >= N) ok = false;
    if (ok) {
        for (let k = 0; k < sh.l; k++)
            if (S.player.grid[r + dr * k][c + dc * k] >= 0) { ok = false; break; }
    }
    const col = ok ? 'rgba(90,220,120,' : 'rgba(230,70,60,';
    const cell = L.cell;
    for (let k = 0; k < sh.l; k++) {
        const rr2 = r + dr * k, cc2 = c + dc * k;
        if (rr2 < 0 || rr2 >= N || cc2 < 0 || cc2 >= N) continue;
        const cx = L.px + cc2 * cell, cy = L.py + rr2 * cell;
        const a = (0.25 + 0.15 * Math.sin(t * 0.1)).toFixed(2);
        ctx.fillStyle = col + a + ')';
        ctx.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
    }
}

/* ── Räjähdys-/roiskerenkaat ── */
function drawBooms() {
    for (const bm of booms) {
        const p = 1 - bm.life / bm.max;                 // 0 → 1
        const r = bm.r * (0.35 + p * 0.85);
        ctx.strokeStyle = 'rgba(255,190,80,' + (0.9 * (1 - p)).toFixed(2) + ')';
        ctx.lineWidth = 2.5 * (1 - p) + 0.5;
        ctx.beginPath(); ctx.arc(bm.x, bm.y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,220,' + (0.7 * (1 - p)).toFixed(2) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bm.x, bm.y, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    }
}

/* ── Dramaattinen taistelun aloitusdialogi (keskitetty, vilkkuva) ── */
function drawBattleDialog(L) {
    if (!(st === 'place' && ready && battleStartAt)) return;
    const remain = battleStartAt - performance.now();
    const p = Math.max(0, Math.min(1, 1 - remain / BATTLE_START_DELAY));   // 0 → 1

    // Tumma tausta (sakenee loppua kohden)
    ctx.fillStyle = 'rgba(0,0,0,' + (0.30 + 0.30 * p).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);

    const bw = Math.min(W - 60, 430), bh = 168;
    const bx = Math.round((W - bw) / 2), by = Math.round((H - bh) / 2);

    // Laatikko
    ctx.fillStyle = 'rgba(12,16,32,0.95)';
    rr(bx, by, bw, bh, 16); ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    rr(bx + 1.5, by + 1.5, bw - 3, bh - 3, 16); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Ylärivi
    font(13, true);
    ctx.fillStyle = '#b8c8e0';
    ctx.fillText('⚓ LAIVASTO VALMIS', W / 2, by + 34);

    // Vilkkuva "TAISTELU ALKAA!!!"
    let fs = 30;
    font(fs, true);
    while (fs > 16 && ctx.measureText('TAISTELU ALKAA!!!').width > bw - 24) {
        fs -= 2;
        font(fs, true);
    }
    const blinkOn = Math.floor(performance.now() / 130) % 2 === 0;
    ctx.fillStyle = blinkOn ? '#ffd700' : '#ff6a3d';
    ctx.fillText('TAISTELU ALKAA!!!', W / 2, by + 84);

    // Lähtölaskenta
    const sec = Math.max(1, Math.ceil(remain / 1000));
    font(22, true);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(sec), W / 2, by + 132);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

/* ── Banneriviesti (canvas) ── */
function drawMsg(L) {
    if (msgT <= 0 || !msg) return;
    const a = Math.min(1, msgT / 16);
    const fontSize = fitFs(msg, W - 60, 11, 17);
    font(fontSize, false);
    const tw = ctx.measureText(msg).width + 24;
    const boxH = Math.max(36, Math.round(fontSize * 2.4));
    const x0 = Math.round((W - tw) / 2), y0 = Math.round(L.hudH * 0.22);
    ctx.fillStyle = 'rgba(8,12,24,' + (0.72 * a).toFixed(3) + ')';
    rr(x0, y0, tw, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,' + (0.85 * a).toFixed(3) + ')';
    ctx.lineWidth = 1;
    rr(x0 + 0.5, y0 + 0.5, tw - 1, boxH - 1, 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,225,140,' + a.toFixed(3) + ')';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, W / 2, y0 + Math.round(boxH / 2));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

/* ── Vuoron osoitin (karttojen välissä) ── */
function drawTurnArrow(L) {
    if (st !== 'battle') return;
    const S = state;
    let px2, py2, ch, tw;
    if (L.portrait) {
        px2 = Math.max(6, Math.round(W * 0.06));
        py2 = Math.round((L.ey + L.board + L.py) / 2);
        ch = S.turn === 'player' ? '▲' : '▼';
        tw = 'AMMU';
    } else {
        px2 = Math.round(((L.ex + L.board) + L.px) / 2) - 40;
        py2 = L.ey + Math.round(L.board / 2);
        ch = S.turn === 'player' ? '◀' : '▶';
        tw = S.turn === 'player' ? 'AMMU' : 'ODOTA';
    }
    const bw2 = 80, bh2 = 38;
    const blink = 0.55 + 0.45 * Math.sin(t * 0.14);
    ctx.fillStyle = 'rgba(10,16,32,' + (0.35 + 0.20 * blink).toFixed(2) + ')';
    rr(px2, py2 - bh2 / 2, bw2, bh2, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,' + (0.30 + 0.30 * blink).toFixed(2) + ')';
    ctx.lineWidth = 1.5;
    rr(px2 + 0.5, py2 - bh2 / 2 + 0.5, bw2 - 1, bh2 - 1, 8);
    ctx.stroke();
    font(13, true);
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch + ' ' + tw, px2 + bw2 / 2, py2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

/* ── Vuorokoonos: koko näkymä ── */
function render() {
    const L = layout();

    // Ruudun tärinä dramaattisen aloituksen aikana (voimistuu loppua kohden)
    let sx = 0, sy = 0;
    if (st === 'place' && ready && battleStartAt) {
        const p = Math.max(0, Math.min(1, 1 - (battleStartAt - performance.now()) / BATTLE_START_DELAY));
        const mag = 4 + 14 * p;
        sx = Math.round((Math.random() * 2 - 1) * mag);
        sy = Math.round((Math.random() * 2 - 1) * mag);
    }
    ctx.save();
    if (sx || sy) ctx.translate(sx, sy);

    drawRoom(L);

    drawWindow(L);
    if (L.portrait) {
        // (pieni aurinkotaulu jo piirretty drawWindow:ssa)
    } else if (L.ex < 100) {
        drawPoster(L);                      // pieni marginaali → juliste ikkunan sijaan
    }
    drawShelf(L);
    drawTable(L);

    // Merikartat
    drawBoardFrame(L, L.ex, L.ey);
    drawBoardFrame(L, L.px, L.py);
    drawSea(L, L.ex, L.ey);
    drawSea(L, L.px, L.py);

    if (state) {
        drawShips(L, state.enemy, L.ex, L.ey, true);
        drawShips(L, state.player, L.px, L.py, false);
        drawShots(L, state.enemy, L.ex, L.ey);
        drawShots(L, state.player, L.px, L.py);
    }

    if (st === 'battle') drawTurnArrow(L);
    drawPlacementGhost(L);

    // Kursori: asetus → omalla alueella · taistelu → vihollisen alueella
    if (state && (st === 'place' || st === 'battle')) {
        if (st === 'place') drawCursor(L, L.px, L.py);
        else if (st === 'battle' && state.turn === 'player') drawCursor(L, L.ex, L.ey);
    }

    // Tekoälyn tähtäyskursori: vihollisen vuorolla näytetään mihin se aikoo ampua
    if (state && st === 'battle' && state.turn === 'enemy' && state.aiTarget) {
        drawAiThinkCursor(L, L.px, L.py, state.aiTarget);
    }

    drawBooms();

    ctx.restore();

    // Isku-/virheflashit
    if (hitFlash > 0) {
        ctx.fillStyle = 'rgba(255,244,220,' + (hitFlash / 14 * 0.22).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
    }
    if (badFlash > 0) {
        ctx.fillStyle = 'rgba(230,70,50,' + (badFlash / 16 * 0.16).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
    }

    drawMsg(L);
    drawBattleDialog(L);
}

/* ═══ Pääsilmukka (rAF) ═══ */
function frame(now) {
    afid = requestAnimationFrame(frame);
    const dt = Math.min(4, Math.max(0.25, (now - lt) / 16.667));
    lt = now;
    update(dt);
    try {
        render();
    } catch (err) {
        // Yksikään piirtokutsu ei saa jäädyttää peliä – looppi ja pelilogiikka jatkuvat
        if (typeof console !== 'undefined' && console.error) console.error('render-virhe:', err);
    }
}

/* ═══ Kokomuutos (canvas sisäinen resoluutio) ═══ */
function rs() {
    if (!cnv) return;
    const wrap = cnv.parentElement;
    const cw = wrap ? wrap.clientWidth : 800;
    const ch = wrap ? wrap.clientHeight : 600;

    let vw = 800, vh = 600;
    try { vw = window.innerWidth || 800; vh = window.innerHeight || 600; } catch (e) {}
    const portrait = vh > vw * 1.2;

    // Jos layout ei ole vielä valmis, yritetään uudestaan
    if (cw <= 100 || ch <= 100) {
        requestAnimationFrame(() => rs());
        return;
    }

    let newW, newH;
    if (!portrait) {
        // Landscape: kuvasuhde W:H ≈ 2:1. Sovita wrapperin sisään.
        const maxByWidth = Math.min(cw, 700);
        const maxByHeight = Math.floor(ch / 0.48);
        newW = Math.max(300, Math.min(maxByWidth, maxByHeight));
        newH = Math.round(newW * 0.48);
    } else {
        // Portrait: kuvasuhde W:H = 1:1.7. Sovita wrapperin sisään.
        const maxByWidth = Math.min(cw, 800);
        const maxByHeight = Math.floor(ch / 1.7);
        newW = Math.max(300, Math.min(maxByWidth, maxByHeight));
        newH = Math.round(newW * 1.7);
    }
    W = newW;
    H = newH;
    cnv.width = W;
    cnv.height = H;
    // CSS-koko: canvas vie wrapperista sen minkä tarvitsee (intrinsic size),
    // wrapperin flex-keskitys hoitaa loput. Ei style.width/height yliajoa.
}

/* ═══ Alustus ═══ */
function init(canvas) {
    cnv = canvas;
    ctx = cnv.getContext('2d');
    try { touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); } catch (e) { touch = false; }

    state = fresh();
    waves = Array.from({ length: N }, () => Array.from({ length: N }, () => Math.random() * Math.PI * 2));

    setupInput();

    const tc = document.querySelector('#touch-controls');
    if (tc) tc.classList.add(touch ? 'force-show' : 'hidden-tc');

    g('overlay-action-btn').addEventListener('click', () => {
        g('overlay').classList.add('hidden');
        const ob = g('overlay-action-btn');
        if (ob && typeof ob.blur === 'function') ob.blur();   // focus pois napista → Enter/Space ei toista resetia
        resetGame();
    });
    g('overlay-exit-btn').addEventListener('click', () => {
        try { window.parent.postMessage('RETURN_TO_STREET', '*'); } catch(e) {}
    });

    rs();
    updateHUD();
    lt = performance.now();
    afid = requestAnimationFrame(frame);
}

return { init: init, rs: rs };
})();
