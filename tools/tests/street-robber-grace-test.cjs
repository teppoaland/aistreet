/* ═══════════════════════════════════════════════════════════
   street-robber-grace-test.cjs – rosvon rauha + turvasäde (v11.54)

   Miksi: (1) rosvo ei saa ilmestyä ensimmäiseen 60 sekuntiin (peli ei ala
   ryöstöllä) · (2) rosvo ei koskaan saa ilmestyä lähelle sitä kohtaa, josta
   pelaaja juuri tuli ulos (turvasäde 200 px, kaikki ovet) – reunaklampaus ei
   saa rikkoa tätä. Aiemmin turva oli häkäkorjaus vain BAR-ovelle.

   Testi ajaa oikeat init()/maybeSpawnRobber()/spawnRobber()/updateEnemies()
   kutsut ja todistaa, ettei spawn tule koskaan liian lähelle ulostulokohtaa
   (myös reunaovilla). Ajo: node tools/tests/street-robber-grace-test.cjs
   ═══════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const ver = require('./ver.cjs');

let checks = 0, fails = 0;
function ok(name, cond, extra) {
    checks++;
    if (cond) console.log('  ok    ' + name);
    else { fails++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

const grad = { addColorStop() {} };
function makeCtx() {
    const target = { measureText: (t) => ({ width: String(t).length * 6 }), canvas: { width: 800, height: 400 } };
    return new Proxy(target, {
        get(t, k) {
            if (k in t) return t[k];
            if (typeof k === 'string') {
                if (k === 'createRadialGradient' || k === 'createLinearGradient') return function () { return grad; };
                return function () {};
            }
            return () => {};
        }, set(t, k, v) { t[k] = v; return true; }
    });
}
const ctxStub = makeCtx();
function makeEl() {
    return new Proxy({
        addEventListener() {}, removeEventListener() {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        style: {}, getContext: () => ctxStub, focus() {}, blur() {}, appendChild() {}, remove() {},
        querySelector: () => makeEl(), querySelectorAll: () => [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 })
    }, { get(t, k) { if (k in t) return t[k]; return () => null; }, set() { return true; } });
}
const canvasStub = new Proxy({}, {
    get(t, k) { if (k === 'getContext') return () => ctxStub; if (k === 'style') return {}; if (k === 'width' || k === 'height') return 800; return () => {}; },
    set() { return true; }
});

const FixedMath = Object.create(Math);
FixedMath.random = () => 0.5;

const store = {}, session = {};
const RealDate = Date;
const sandbox = {
    Math: FixedMath, JSON, console, URLSearchParams,
    Date: new Proxy(RealDate, { get(t, k) { return (k === 'now') ? (() => 1700000000000) : t[k]; } }),
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    Image: function () {}, Audio: function () {},
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    sessionStorage: { getItem: (k) => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); }, removeItem: (k) => { delete session[k]; } },
    location: { search: '' },
    navigator: { userAgent: 'node', maxTouchPoints: 0 },
    StreetAudio: new Proxy({}, {
        get(t, k) {
            if (k === 'isJukeboxPlaying') return () => false;
            if (k === 'playJukebox' || k === 'playJukeboxQueue') return () => false;
            if (k === 'getJukeboxQueuePos') return () => 0;
            return () => {};
        }
    })
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sandbox.document = new Proxy({
    getElementById: () => makeEl(), querySelector: () => makeEl(), querySelectorAll: () => [],
    createElement: () => makeEl(), addEventListener() {}, removeEventListener() {}, body: { appendChild() {} }
}, { get(t, k) { if (k in t) return t[k]; return () => null; }, set() { return true; } });
sandbox.window = {
    addEventListener() {}, removeEventListener() {}, parent: { postMessage() {} },
    innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1, location: { search: '' }
};

/* ── Koukut vain muistiin (repossa oleva street.js on koskematon) ── */
let src = require('./street-src.cjs');
const API = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };';
const DBG = API.replace(' };', `, __t: {
    maybeSpawnRobber, spawnRobber, updateEnemies,
    get robber() { return robber; },
    set robber(v) { robber = v; },
    get grace() { return robberGraceTimer; },
    set grace(v) { robberGraceTimer = v; },
    get cooldown() { return robberCooldown; },
    set cooldown(v) { robberCooldown = v; },
    set playerX(v) { player.x = v; },
    get pcx() { return player.x + player.w / 2; },
    consts: { MIN_DIST: ROBBER_MIN_DIST, GRACE: ROBBER_GRACE_FRAMES, W: WORLD_W, ROBBER_W: ROBBER_W }
} };`);
if (!src.includes(API)) { console.error('FAIL: export-rivi ei löytynyt street.js:stä'); process.exit(1); }
src = src.replace(API, DBG);
function sliceFrom(name, endMark) {
    const i = src.indexOf(name);
    if (i < 0) return '';
    const j = src.indexOf(endMark, i);
    return j < 0 ? src.slice(i) : src.slice(i, j);
}
const fnBody = (n) => sliceFrom('function ' + n + '(', '\n    }');

vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), sandbox);
vm.runInContext(src, sandbox);
const Street = vm.runInContext('Street', sandbox);
const T = Street.__t;
const C = T.consts;

Street.setChaos('normal');
try { Street.init(canvasStub); } catch (e) { console.log('  (init: ' + e.message + ')'); }

console.log('\n1) Lähteet: rauha + turvasäde + reunaklampin korjaus');
ok('ROBBER_GRACE_FRAMES = 3600 (60 s)', C.GRACE === 3600, C.GRACE);
ok('ROBBER_MIN_DIST = 200 (turvasäde ulostulokohdasta)', C.MIN_DIST === 200, C.MIN_DIST);
ok('BAR-ovi-häkä (ROBBER_BAR_EXCLUDE_R) POISTETTU', !src.includes('ROBBER_BAR_EXCLUDE_R'));
ok('maybeSpawnRobber estää rauhan aikana', fnBody('maybeSpawnRobber').includes('robberGraceTimer > 0'));
ok('updateEnemies tikittää rauhaa', fnBody('updateEnemies').includes('robberGraceTimer -= dt'));
ok('init() asettaa rauhan', /robberGraceTimer = ROBBER_GRACE_FRAMES;/.test(src));
ok('spawnRobber varmistaa turvasäteen klampin jälkeen', fnBody('spawnRobber').includes('>= clear'));
ok('spawnRobber ei enää käytä BAR-häkää', !fnBody('spawnRobber').includes('barDoorX'));
ok('uusia dialogeja ei tullut (sääntö 06)',
    !fnBody('spawnRobber').includes('showNotification') && !fnBody('maybeSpawnRobber').includes('showNotification'));

console.log('\n2) 60 s aloitusrauha');
ok('init(): rauha täynnä (' + C.GRACE + ' f)', T.grace === C.GRACE, T.grace);
Street.setChaos('bad');   // BAD: appearChance 0.75 → 0,5-arpa osuisi, jollei rauhaa
T.robber = null; T.cooldown = 0; T.grace = 100;
T.maybeSpawnRobber();
ok('rauhan aikana rosvo EI ilmesty', T.robber === null);
T.grace = 0; T.robber = null; T.cooldown = 0;
T.maybeSpawnRobber();
ok('rauhan loputtua rosvo ilmestyy', T.robber !== null);
T.robber = null; T.grace = 10;
try { T.updateEnemies(2); } catch (e) { console.log('  (updateEnemies: ' + e.message + ')'); }
ok('rauha kuluu updateEnemiesissa (10 → 8)', T.grace === 8, T.grace);

console.log('\n3) Turvasäde ulostulokohdasta (kaikki ovet, reunaklampin ohitse)');
const posX = [0, 20, 40, 120, 225, 295, 410, 490, 585, 675, 765, 780];
let worstDist = Infinity, worstX = null, bad = 0, outOfWorld = 0;
for (const px of posX) {
    T.playerX = px;
    T.grace = 0; T.cooldown = 0;
    for (let i = 0; i < 150; i++) {
        T.robber = null;
        T.spawnRobber();
        const r = T.robber;
        if (!r) { bad++; continue; }
        const center = r.x + C.ROBBER_W / 2;
        const d = Math.abs(center - T.pcx);
        if (d < worstDist) { worstDist = d; worstX = px; }
        if (d < C.MIN_DIST) bad++;
        if (r.x < 4 || r.x > C.W - C.ROBBER_W - 4) outOfWorld++;
    }
}
ok('jokainen spawn ≥ 200 px ulostulokohdasta (' + bad + ' poikkeusta)', bad === 0,
    { bad: bad, worstDist: worstDist, worstX: worstX });
ok('spawn pysyy aina maailman sisällä', outOfWorld === 0, outOfWorld);
ok('turvasäde toteutuu myös reunataloilla (0 / 765 / 780)', worstDist >= C.MIN_DIST, { worstDist, worstX });

console.log('\n4) Säännöt ja versio');
ok('rosvo katoaa nappauksen jälkeen (lähde)', /robber = null;\s*\/\/ rosvo katoaa/.test(src) || src.includes('rosvo katoaa nappauksen jälkeen'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok('#version-tag ' + ver.VERSION, ver.tagOk(html));
ok('kaikki ?v=-leimat = ' + ver.NUM + ' (≥4 kpl)', ver.stampsConsistent(html) && ver.stamps(html).length >= 4);

console.log(fails ? '\n=== TULOS: ' + fails + ' löydöstä (' + checks + ' tarkistusta) ==='
                  : '\n=== TULOS: ' + checks + ' OK, 0 löydöstä ===');
process.exit(fails ? 1 : 0);

