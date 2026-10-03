/* ═══════════════════════════════════════════════════════════════
   street-fruit-test.cjs – Katu ↔ Hedelmäpeli -integraation validointi
   (Node vm + canvas-stub, sama tekniikka kuin aiemmissa validoinneissa)
   Ajo:  node street-fruit-test.cjs
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = 'd:/AI/Main';
const streetSrc = require('./street-src.cjs');
const stateSrc = fs.readFileSync(path.join(ROOT, 'gameState.js'), 'utf8');
const GROUND_Y = Number(/const GROUND_Y = (\d+);/.exec(streetSrc)[1]);
const buildings = vm.runInNewContext('(' + /const buildings = (\[[\s\S]*?\]);/.exec(streetSrc)[1] + ')');

const problems = [], oks = [];
const fail = (m) => problems.push(m);
const ok = (m) => oks.push(m);

function makeCtx() {
    return {
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
        font: '', textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0,
        imageSmoothingEnabled: true,
        save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, setTransform() {}, resetTransform() {},
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, rect() {},
        quadraticCurveTo() {}, bezierCurveTo() {}, arcTo() {}, fill() {}, stroke() {}, clip() {},
        fillRect() {}, strokeRect() {}, clearRect() {},
        createRadialGradient() { return { addColorStop() {} }; },
        createLinearGradient() { return { addColorStop() {} }; },
        measureText(t) { return { width: String(t).length * 6 }; },
        fillText() {}, strokeText() {}, drawImage() {}, setLineDash() {}, getLineDash() { return []; }
    };
}

function boot(seed, startCoins) {
    let clock = 0, pending = null;
    let s = (seed >>> 0) || 1;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

    const winL = {};
    const store = {};
    const posted = [];           // iframe.contentWindow.postMessage -kutsut

    const ctx = makeCtx();
    const canvasEl = {
        id: 'game-canvas', style: {}, width: 800, height: 400, tabIndex: 0,
        addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
        getContext() { return ctx; },
        getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }; }
    };

    const iframe = {
        src: '', onload: null, style: {},
        addEventListener() {}, removeEventListener() {}, blur() {}, focus() {},
        contentWindow: {
            focusCalled: 0,
            focus() { this.focusCalled++; }, blur() {},
            postMessage(msg) { posted.push(msg); }
        }
    };

    function makeEl(id) {
        const classes = new Set();
        return {
            id, style: {}, offsetHeight: 0, clientWidth: 1024, clientHeight: 700,
            textContent: '', innerHTML: '', value: '',
            classList: {
                add(c) { classes.add(c); }, remove(c) { classes.delete(c); },
                toggle(c, on) { if (on === undefined) { classes.has(c) ? classes.delete(c) : classes.add(c); } else if (on) classes.add(c); else classes.delete(c); },
                contains(c) { return classes.has(c); }
            },
            __classes: classes,
            addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
            appendChild() {}, setAttribute() {},
            getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
            querySelector(sel) { return sel === 'iframe' ? iframe : null; },
            querySelectorAll() { return []; }
        };
    }
    const cache = {};

    const sandbox = {
        console, setTimeout, clearTimeout, Date, JSON,
        performance: { now: () => clock },
        requestAnimationFrame(cb) { pending = cb; return 1; },
        cancelAnimationFrame() {},
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        },
        navigator: { maxTouchPoints: 0 },
        StreetAudio: { init() {}, start() {}, stop() {}, getCtx() { return null; }, playDeathGong() {},
                      /* v11.x: koko street.js:n käyttämä audio-api stubataan (ei kaadu puuttuvaan metodiin) */
                      isJukeboxPlaying() { return false; }, playJukebox() { return false; },
                      playJukeboxQueue() { return false; }, appendJukeboxQueue() {}, stopJukebox() {},
                      getJukeboxQueuePos() { return 0; }, setHungerTempo() {}, setMenuActive() {},
                      fadeOutMenuMusic() {}, playChaosIntro() {}, playPanelOn() {}, playPanelOff() {}, playTypeClick() {} },
        window: {
            addEventListener(t, f) { (winL[t] = winL[t] || []).push(f); },
            removeEventListener(t, f) { const a = winL[t] || []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); },
            focus() {}, blur() {}, postMessage() {}, innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1
        },
        document: {
            getElementById(id) { return cache[id] || (cache[id] = makeEl(id)); },
            querySelector() { return null; }, querySelectorAll() { return []; },
            createElement() { return makeEl('tmp'); },
            addEventListener() {}, removeEventListener() {},
            body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head')
        }
    };
    let canvasElRef = null;
    sandbox.document.getElementById = (id) => {
        if (id === 'game-canvas') return canvasEl;
        return cache[id] || (cache[id] = makeEl(id));
    };
    sandbox.Math = new Proxy(Math, { get(t, p) { return p === 'random' ? rnd : t[p]; } });
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(stateSrc, sandbox, { filename: 'gameState.js' });

    // Alkusaldo kadulle ennen initiä (GameState tallentaa localStoragen kautta)
    vm.runInContext('var __st = GameState.load(); __st.inventory.coinCount = ' + startCoins + '; GameState.save(__st);', sandbox);

    vm.runInContext(streetSrc, sandbox, { filename: 'street.js' });
    const Street = vm.runInContext('Street', sandbox);
    Street.init(canvasEl);

    const h = {
        frame(n) {
            for (let i = 0; i < (n || 1); i++) {
                const cb = pending; pending = null;
                if (!cb) throw new Error('rAF-ketju katkesi');
                clock += 16.7;
                cb(clock);
            }
        },
        key(type, k) { for (const f of (winL[type] || []).slice()) f({ key: k, preventDefault() {} }); },
        hold(k) { h.key('keydown', k); },
        release(k) { h.key('keyup', k); },
        /* Toiminto vaatii tilasiirtymän: keyup + keydown samalla framella */
        tapAction() { h.key('keyup', ' '); h.key('keydown', ' '); },
        msg(data) { for (const f of (winL['message'] || []).slice()) f({ data }); },
        savedCoins() { return JSON.parse(store['pimeakatu_gamestate']).inventory.coinCount; },
        overlay: () => cache['game-iframe-overlay'],
        posted, store, iframe, sandbox
    };
    return h;
}

/* ── Kävely talo 7:n ovelle (x 560–610, ovi keskellä 585) ───── */
function walkToFruitDoor(e, budget) {
    e.hold('ArrowDown');
    e.frame(5);                 // y 290 → ~296 (ohittaa sähkökaapin x 560)
    e.release('ArrowDown');
    e.hold('ArrowRight');
    let frames = 0;
    while (frames < (budget || 1200) && !e.iframe.src) {
        e.frame(1); frames++;
        if (frames >= 360 && frames % 3 === 0) e.tapAction();
    }
    e.release('ArrowRight');
    e.release(' ');
    return frames;
}

/* ═══ TESTI 1: talo 7 → hedelmäpeli + koko protokolla ════════ */
let firstOk = false;
for (const seed of [1, 7, 13, 42]) {
    let e;
    try {
        e = boot(seed, 5);
        walkToFruitDoor(e);
        if (e.iframe.src !== 'fruitgame/game_main.html') {
            fail('seed ' + seed + ': talo 7:n ovi ei avannut hedelmäpeliä (src="' + e.iframe.src + '")');
            continue;
        }
        if (!e.overlay().__classes.has('active')) fail('seed ' + seed + ': overlay ei saanut active-luokkaa');

        // Saldo juuri ennen protokollaa (kävelyllä on saatettu kerätä katukolikko)
        const entry = e.savedCoins();
        const n0 = e.posted.length;
        if (typeof e.iframe.onload === 'function') e.iframe.onload();
        const sync = e.posted.slice(n0).find((m) => m && m.type === 'fruitSync');
        if (!sync) fail('seed ' + seed + ': fruitSync ei lähtenyt iframen onloadissa');
        else if (sync.coins !== entry) fail('seed ' + seed + ': fruitSync.coins ' + sync.coins + ' != ' + entry);
        if (e.iframe.contentWindow.focusCalled < 1) fail('seed ' + seed + ': iframea ei fokusoitu');

        const n1 = e.posted.length;
        e.msg({ type: 'fruitBet' });
        const echo1 = e.posted.slice(n1).find((m) => m && m.type === 'fruitSync');
        if (!echo1 || echo1.coins !== entry - 1) fail('seed ' + seed + ': fruitBet ei veloittanut (echo ' + (echo1 && echo1.coins) + ', odotus ' + (entry - 1) + ')');
        if (e.savedCoins() !== entry - 1) fail('seed ' + seed + ': fruitBet ei tallentunut GameStateen (' + e.savedCoins() + ')');

        e.msg({ type: 'fruitWin', coins: 7 });
        if (e.savedCoins() !== entry + 6) fail('seed ' + seed + ': fruitWin ei lisännyt voittoa (' + e.savedCoins() + ')');
        e.msg({ type: 'fruitWin', coins: -5 });
        if (e.savedCoins() !== entry + 6) fail('seed ' + seed + ': negatiivinen fruitWin muutti saldoa');

        e.msg('COIN_COLLECTED');
        if (e.savedCoins() !== entry + 7) fail('seed ' + seed + ': COIN_COLLECTED ei toimi enää (' + e.savedCoins() + ')');

        for (let i = 0; i < entry + 10; i++) e.msg({ type: 'fruitBet' });
        if (e.savedCoins() !== 0) fail('seed ' + seed + ': saldo ei pysähtynyt nollaan (' + e.savedCoins() + ')');

        e.msg('RETURN_TO_STREET');
        if (e.overlay().__classes.has('active')) fail('seed ' + seed + ': overlay ei sulkeutunut');
        if (e.iframe.src !== '') fail('seed ' + seed + ': iframe.src ei tyhjentynyt');
        const n2 = e.posted.length;
        e.msg({ type: 'fruitBet' });
        if (e.posted.length !== n2) fail('seed ' + seed + ': protokolla jäi eloon sulkemisen jälkeen');
        if (!firstOk) { ok('talo 7 → hedelmäpeli (seed ' + seed + '): fruitSync 5 → fruitBet 4 → fruitWin 11 → clamp 0 → RETURN_TO_STREET tyhjentää iframen ✓'); firstOk = true; }
    } catch (err) {
        fail('seed ' + seed + ': poikkeus – ' + err.message);
    }
}

/* ═══ TESTI 2: muut ovet eivät avaa hedelmäpeliä ═════════════ */
try {
    const e2 = boot(5, 5);
    e2.hold('ArrowDown'); e2.frame(5); e2.release('ArrowDown');
    e2.hold('ArrowRight');
    let f2 = 0;
    while (f2 < 260 && !e2.iframe.src) { e2.frame(1); f2++; if (f2 >= 100 && f2 % 4 === 0) e2.tapAction(); }
    e2.release('ArrowRight'); e2.release(' ');
    if (e2.iframe.src && /fruitgame/.test(e2.iframe.src)) fail('muut ovet: HEDELMÄPELI aukesi väärästä ovesta ("' + e2.iframe.src + '")');
    /* v4.86+: muut ovet voivat avata OMAT pelinsä (digGame1/digGame2/bm/sinkship) –
       tämän testin tarkoitus on vain, ettei HEDELMÄPELI aukea muista ovista. */
    else ok('muut ovet: hedelmäpeli ei aukea muista ovista (iframe src = "' + (e2.iframe.src || '') + '")');
} catch (err) { fail('muut ovet: poikkeus – ' + err.message); }

/* ── RAPORTTI ──────────────────────────────────────────────── */
console.log('=========================================================');
console.log(' KATU ↔ HEDELMÄPELI -INTEGRAATIO (headless)');
console.log('=========================================================');
for (const o of oks) console.log('  ' + o);
console.log('  == LÖYDÖKSET (' + problems.length + ') ==');
if (!problems.length) console.log('  OK: ei virheita.');
for (const p of [...new Set(problems)]) console.log('  X ' + p);
process.exitCode = problems.length ? 1 : 0;
