// v11.30 – Blue Mäxin avaimen loppupalkinto: +20 🪙 ja täydet 10 🍔.
// Harness: sama tekniikka kuin chaos-normal-check.cjs (Node vm + canvas-stub).
// Testikoukut injektoidaan VAIN muistiin – repossa oleva street.js on koskematon.
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = 'd:/AI/AI_street';

let checks = 0, fails = 0;
function ok(name, cond, extra) {
    checks++;
    if (cond) console.log('  ok    ' + name);
    else { fails++; console.log('  FAIL  ' + name + (extra !== undefined ? '   → ' + JSON.stringify(extra) : '')); }
}

/* ── canvas- ja DOM-stubit ───────────────────────────────── */
const grad = { addColorStop() {} };
const ctxStub = new Proxy({ createRadialGradient: () => grad, createLinearGradient: () => grad, measureText: () => ({ width: 6 }) },
    { get(t, k) { if (k in t) return t[k]; return () => {}; }, set() { return true; } });
function makeEl() {
    return new Proxy({
        addEventListener() {}, removeEventListener() {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        style: {}, getContext: () => ctxStub,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }),
        focus() {}, blur() {}, appendChild() {}, remove() {},
        querySelector: () => makeEl(), querySelectorAll: () => []
    }, { get(t, k) { if (k in t) return t[k]; return () => null; }, set() { return true; } });
}
const canvasStub = new Proxy({}, {
    get(t, k) { if (k === 'getContext') return () => ctxStub; if (k === 'style') return {}; if (k === 'width' || k === 'height') return 800; return () => {}; },
    set() { return true; }
});
const store = {}, session = {};
const sandbox = {
    Math, Date, JSON,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: k => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); }, removeItem: k => { delete session[k]; } },
    document: new Proxy({
        getElementById: () => makeEl(), querySelector: () => makeEl(), querySelectorAll: () => [],
        createElement: () => makeEl(), addEventListener() {}, removeEventListener() {}, body: { appendChild() {} }
    }, { get(t, k) { if (k in t) return t[k]; return () => null; }, set() { return true; } }),
    window: {
        addEventListener() {}, removeEventListener() {}, parent: { postMessage() {} },
        innerWidth: 800, innerHeight: 400,
        matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
    },
    location: { search: '?debug' },
    navigator: { userAgent: 'node', maxTouchPoints: 0 },
    URLSearchParams, Image: function () {}, Uint8ClampedArray, Audio: function () {}
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sandbox.StreetAudio = new Proxy({}, {
    get(t, k) {
        if (k === 'isJukeboxPlaying') return () => false;
        if (k === 'playJukeboxQueue') return () => false;
        if (k === 'getJukeboxQueuePos') return () => 0;
        return () => {};
    }
});
sandbox.console = Object.assign({}, console, { log: () => {}, table: () => {}, info: () => {} });

/* ── testikoukut (vain muistiin) ─────────────────────────── */
let src = require('./street-src.cjs');
const ver = require('./ver.cjs');
const markerRe = /return \{ init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon \};/;
if (!markerRe.test(src)) { console.error('FAIL: return-lause ei löytynyt street.js:stä'); process.exit(1); }
const hooks = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon,\n' +
    '        __t: {\n' +
    '            enterGame,\n' +
    '            get coinCount() { return coinCount; },\n' +
    '            set coinCount(v) { coinCount = v; },\n' +
    '            get hamburgerCount() { return hamburgerCount; },\n' +
    '            set hamburgerCount(v) { hamburgerCount = v; }\n' +
    '        } };';
src = src.replace(markerRe, hooks);

vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), sandbox);
vm.runInContext(src, sandbox);
const Street = vm.runInContext('Street', sandbox);
const T = Street.__t;
ok('testikoukut käytettävissä (enterGame + coinCount + hamburgerCount)',
    !!(T && typeof T.enterGame === 'function'));

Street.setChaos('normal');
Street.init(canvasStub);
ok('NORMAL init OK (peli käynnistyy)', true);

function fire(data) {
    if (typeof sandbox.window._streetReturn !== 'function') throw new Error('window._streetReturn ei asetettu');
    sandbox.window._streetReturn({ data });
}

/* ── [1] Avaimen nappaus: +20 🪙 ja täydet 10 🍔 ─────────── */
console.log('\n[1] BM_KEY_COLLECTED → +20 🪙 ja 🍔 täyteen 10');
T.coinCount = 5; T.hamburgerCount = 3;
T.enterGame('bm/game_main.html');
fire('BM_KEY_COLLECTED');
ok('kolikot 5 → 25 (+20)', T.coinCount === 25, T.coinCount);
ok('🍔 3 → 10 (täydet)', T.hamburgerCount === 10, T.hamburgerCount);
{ const saved = JSON.parse(store['pimeakatu_gamestate']);
  ok('kolikot tallennettu (25)', saved.inventory.coinCount === 25, saved.inventory.coinCount);
  ok('🍔 tallennettu (10)', saved.inventory.hamburgerCount === 10, saved.inventory.hamburgerCount);
  ok('bmKeyCollected = true', saved.bmKeyCollected === true, saved.bmKeyCollected); }

/* ── [2] Toistuva: uusi nappaus palkitsee taas ───────────── */
console.log('\n[2] Toistuva palkinto (uusi pelikerta)');
T.enterGame('bm/game_main.html');
fire('BM_KEY_COLLECTED');
ok('kolikot 25 → 45 (taas +20)', T.coinCount === 45, T.coinCount);
ok('🍔 pysyy 10:ssä (ei yli katon)', T.hamburgerCount === 10, T.hamburgerCount);

/* ── [3] 🍔-katto: ei 8 → 18 vaan 8 → 10 ────────────────── */
console.log('\n[3] 🍔-katto 10');
T.coinCount = 0; T.hamburgerCount = 8;
T.enterGame('bm/game_main.html');
fire('BM_KEY_COLLECTED');
ok('🍔 8 → 10 (ei 18)', T.hamburgerCount === 10, T.hamburgerCount);
ok('kolikot 0 → 20', T.coinCount === 20, T.coinCount);

/* ── [4] Muut avainviestit eivät anna palkintoa ──────────── */
console.log('\n[4] Regressio: muut avaimet ennallaan');
T.coinCount = 7; T.hamburgerCount = 4;
T.enterGame('bm/game_main.html');
fire('BOULDER_KEY_COLLECTED');
ok('BOULDER_KEY_COLLECTED: kolikot ennallaan (7)', T.coinCount === 7, T.coinCount);
ok('BOULDER_KEY_COLLECTED: 🍔 ennallaan (4)', T.hamburgerCount === 4, T.hamburgerCount);
fire('KEY_COLLECTED');
ok('KEY_COLLECTED: kolikot ennallaan (7)', T.coinCount === 7, T.coinCount);

/* ── [5] Sääntö 06 + versioleima ─────────────────────────── */
console.log('\n[5] Sääntö 06 ja versioleima');
ok('ei uutta showNotification-kutsua BM-haarassa',
    !/BM_KEY_COLLECTED[\s\S]{0,500}showNotification/.test(src));
ok('index.html #version-tag = ' + ver.VERSION,
    ver.tagOk(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));

console.log('\n' + (fails === 0 ? 'KAIKKI OK' : 'FAIL') + ': ' + (checks - fails) + '/' + checks + ' tarkistusta läpi');
process.exit(fails ? 1 : 0);
