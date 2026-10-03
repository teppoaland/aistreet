/* ═══════════════════════════════════════════════════════════
   street-moon-shadow-test.cjs – kuunvarjojen kaaoskerroin (v11.49)

   Miksi: BAD/FULLissa jokainen talo heittää kadulle oman mittaisen
   kuunvarjonsa (kerroin 1,00…3,00). Kerroin arvotaan KERRAN PER YÖ
   (uusi peli / Nuku / päivä→yö) ja pysyy yön ajan vakiona.

   Testi ajaa oikean init():n ja kutsuu drawMoonBuildingShadows()ia
   oikealla ctx-stubilla, joka tallentaa monikulmion pisteet →
   geometria todistetaan kaavasta (L = b.h · MOON_BLD_SHADOW_LEN · ms,
   k = MOON_BLD_SHADOW_SKEW · (b.h/100) · ms) eikä vain lähdetekstistä.

   Ajo: node tools/tests/street-moon-shadow-test.cjs
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
const near = (a, b) => Math.abs(a - b) < 1e-6;

/* ── ctx, joka tallentaa piirtokutsut; moveTo/lineTo myös pisteinä ── */
let ops = [];
let pts = [];
const grad = { addColorStop() {} };
function makeCtx() {
    const target = {
        measureText: (t) => ({ width: String(t).length * 6 }),
        canvas: { width: 800, height: 400 }
    };
    return new Proxy(target, {
        get(t, k) {
            if (k in t) return t[k];
            if (typeof k === 'string') {
                if (k === 'moveTo' || k === 'lineTo') {
                    return function (x, y) { ops.push(k); pts.push([x, y]); };
                }
                if (k === 'createRadialGradient' || k === 'createLinearGradient') {
                    return function () { ops.push(k); return grad; };
                }
                return function () { ops.push(k); };
            }
            return () => {};
        },
        set(t, k, v) { t[k] = v; if (k === 'fillStyle' || k === 'strokeStyle') ops.push(String(k)); return true; }
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
    get(t, k) {
        if (k === 'getContext') return () => ctxStub;
        if (k === 'style') return {};
        if (k === 'width' || k === 'height') return 800;
        return () => {};
    }, set() { return true; }
});

/* Math.random on kiinnitetty: vaihe 1 = vakio 0.5 (tunnettu tulos),
   vaihe 2 = kultaisen leikkauksen jono (arvot vaihtelevat, ei toistu). */
const FixedMath = Object.create(Math);
let randomImpl = () => 0.5;
let seqN = 0;
FixedMath.random = () => randomImpl();
const useSequenceRandom = () => { randomImpl = () => ((seqN = (seqN + 1) % 1000000) * 0.6180339887498949 % 1); };

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
    createElement: () => makeEl(), addEventListener() {}, removeEventListener() {},
    body: { appendChild() {} }
}, { get(t, k) { if (k in t) return t[k]; return () => null; }, set() { return true; } });
sandbox.window = {
    addEventListener() {}, removeEventListener() {}, parent: { postMessage() {} },
    innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1, location: { search: '' }
};

/* ── Koukut vain muistiin (repossa oleva street.js on koskematon) ── */
let src = require('./street-src.cjs');
const API = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };';
const DBG = API.replace(' };', `, __t: {
    roll: rollMoonShadowMults, resetMoon, drawShadow: drawMoonBuildingShadows,
    get mults() { return moonShadowMult.slice(); },
    set mult(v) { moonShadowMult = moonShadowMult.map(function () { return v; }); },
    get buildings() { return buildings; },
    setDay: v => { dayNight.t = v; },
    setMoonX: v => { dayNight.moonX = v; },
    get max() { return chaosCfg.moonShadowMax; },
    consts: { LEN: MOON_BLD_SHADOW_LEN, SKEW: MOON_BLD_SHADOW_SKEW, ALPHA: MOON_BLD_SHADOW_ALPHA, GROUND_Y: GROUND_Y }
} };`);
if (!src.includes(API)) { console.error('FAIL: export-rivi ei löytynyt street.js:stä'); process.exit(1); }
src = src.replace(API, DBG);

vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), sandbox);
vm.runInContext(src, sandbox);
const Street = vm.runInContext('Street', sandbox);
const Chaos = vm.runInContext('StreetChaos', sandbox);
const T = Street.__t;
const C = T.consts;

/* Piirtää varjot kerran ja palauttaa monikulmiot taloittain [[x,y]×4]. */
function drawPolys() {
    ops = []; pts = [];
    T.setDay(0);            // yö: varjot näkyvissä
    T.drawShadow();
    const out = [];
    for (let i = 0; i < pts.length; i += 4) out.push(pts.slice(i, i + 4));
    return out;
}
/* Kaavan mukainen varjo (moonX, ms) talolle b. */
function expected(b, moonX, ms) {
    const L = b.h * C.LEN * ms;
    const k = C.SKEW * (b.h / 100) * ms;
    return [
        [b.x, C.GROUND_Y],
        [b.x + b.w, C.GROUND_Y],
        [b.x + b.w + (b.x + b.w - moonX) * k, C.GROUND_Y + L],
        [b.x + (b.x - moonX) * k, C.GROUND_Y + L]
    ];
}
function polysMatch(polys, moonX, mults) {
    const blds = T.buildings;
    if (polys.length !== blds.length) return 'taloja ' + polys.length + ' ≠ ' + blds.length;
    for (let i = 0; i < blds.length; i++) {
        const e = expected(blds[i], moonX, mults[i]);
        for (let j = 0; j < 4; j++) {
            if (!near(polys[i][j][0], e[j][0]) || !near(polys[i][j][1], e[j][1])) {
                return 'talo ' + i + ' piste ' + j + ' = ' + JSON.stringify(polys[i][j]) + ' ≠ ' + JSON.stringify(e[j]);
            }
        }
    }
    return null;
}

Street.setChaos('normal');
try { Street.init(canvasStub); } catch (e) { console.log('  (init: ' + e.message + ')'); }

console.log('\n1) NORMAL – varjot bitti-identtiset (kaikki kertoimet 1)');
ok('NORMAL: chaosCfg.moonShadowMax = 1', T.max === 1, T.max);
T.roll();
ok('NORMAL: yhdeksän kerrointa, kaikki 1', T.mults.length === 9 && T.mults.every((m) => m === 1), T.mults);
T.setMoonX(140);
const normalPolys = drawPolys();
ok('NORMAL: 9 varjoa × 4 pistettä = 36 pistettä', pts.length === 36, pts.length);
const normalErr = polysMatch(normalPolys, 140, T.mults);
ok('NORMAL: geometria = MOON_BLD_SHADOW_LEN/SKEW (ms = 1)', normalErr === null, normalErr);

console.log('\n2) Kerroin skaalaa pituuden JA kallistuksen');
T.mult = 2;                       // käsin: kerroin 2 jokaiselle talolle
const doubled = drawPolys();
const b0 = T.buildings[0];
const L1 = b0.h * C.LEN, L2 = b0.h * C.LEN * 2;
ok('×2: varjon pituus kaksinkertaistuu',
    near(doubled[0][2][1] - C.GROUND_Y, L2) && near(normalPolys[0][2][1] - C.GROUND_Y, L1),
    [normalPolys[0][2][1] - C.GROUND_Y, doubled[0][2][1] - C.GROUND_Y]);
const dx1 = normalPolys[0][2][0] - normalPolys[0][1][0];
const dx2 = doubled[0][2][0] - doubled[0][1][0];
ok('×2: vaakakallistus kaksinkertaistuu', near(dx2, dx1 * 2) && dx1 !== 0, [dx1, dx2]);
const ms2Err = polysMatch(doubled, 140, T.buildings.map(() => 2));
ok('×2: geometria = kaava (ms = 2)', ms2Err === null, ms2Err);
T.mult = 1;

console.log('\n3) BAD – arpa per talo, kerran per yö');
Street.setChaos('bad');
ok('BAD: chaosCfg.moonShadowMax = 3', T.max === 3, T.max);
useSequenceRandom();
T.roll();
const badM1 = T.mults;
T.setMoonX(140);
const badPolys = drawPolys();
ok('BAD: 9 kerrointa, jokainen 1,00–3,00', badM1.length === 9 && badM1.every((m) => m >= 1 && m <= 3), badM1);
ok('BAD: kertoimet vaihtelevat taloittain (ei sama kaikilla)',
    Math.min.apply(null, badM1) !== Math.max.apply(null, badM1), badM1);
ok('BAD: vähintään yksi varjo on pidempi kuin nykyinen', badM1.some((m) => m > 1), badM1);
const badErr = polysMatch(badPolys, 140, badM1);
ok('BAD: piirretty geometria vastaa kunkin talon omaa kerrointa', badErr === null, badErr);
ok('BAD: kerroin on vakio yön sisällä (toinen piirto identtinen)',
    polysMatch(drawPolys(), 140, badM1) === null && JSON.stringify(T.mults) === JSON.stringify(badM1));
T.resetMoon();                    // uusi yö (Nuku / päivä→yö) → uusi arpa
ok('uusi yö (resetMoon) arpoo varjot uudelleen', JSON.stringify(T.mults) !== JSON.stringify(badM1), [badM1, T.mults]);
ok('uusi yö: kertoimet pysyvät haarukassa 1,00–3,00', T.mults.every((m) => m >= 1 && m <= 3), T.mults);

console.log('\n4) FULL – sama portti');
Street.setChaos('full');
ok('FULL: chaosCfg.moonShadowMax = 3', T.max === 3, T.max);
T.roll();
ok('FULL: jokainen kerroin 1,00–3,00', T.mults.length === 9 && T.mults.every((m) => m >= 1 && m <= 3), T.mults);
T.setMoonX(140);   // resetMoon siirsi kuun lähtöasemaan – kiinnitä vertailua varten
ok('FULL: geometria vastaa kertoimia', polysMatch(drawPolys(), 140, T.mults) === null);

console.log('\n5) Portti, oletukset ja lähteet');
const def = Chaos.CHAOS_DEFAULTS2;
ok('CHAOS_DEFAULTS2.moonShadowMax = 1', def.moonShadowMax === 1, def.moonShadowMax);
ok('clampChaosCfg: 99 → 3', Chaos.clampChaosCfg(Object.assign({}, def, { moonShadowMax: 99 })).moonShadowMax === 3);
ok('clampChaosCfg: -5 → 1', Chaos.clampChaosCfg(Object.assign({}, def, { moonShadowMax: -5 })).moonShadowMax === 1);
ok('chaosProfile(bad).moonShadowMax = 3', Chaos.chaosProfile('bad').moonShadowMax === 3);
ok('generateFullChaosSeed().moonShadowMax = 3', Chaos.generateFullChaosSeed().moonShadowMax === 3);
ok('CHAOS_DEFAULTS2-lähde sisältää moonShadowMax: 1', /moonShadowMax: 1,/.test(src));
const drawFn = (function () {
    const i = src.indexOf('function drawMoonBuildingShadows()');
    return src.slice(i, src.indexOf('\n    }', i));
})();
ok('piirto lukee talon kertoimen (moonShadowMult[idx] || 1)', drawFn.includes('moonShadowMult[idx] || 1'));
ok('piirto skaalaa pituuden (MOON_BLD_SHADOW_LEN * ms)', drawFn.includes('MOON_BLD_SHADOW_LEN * ms'));
ok('piirto skaalaa kallistuksen ((b.h / 100) * ms)', drawFn.includes('(b.h / 100) * ms'));
ok('tuhoutuneen talon ehto ennallaan', drawFn.includes('buildingGone(buildings.indexOf(b))'));
ok('uusia dialogeja ei tullut (sääntö 06)', !drawFn.includes('showNotification'));
ok('rollMoonShadowMults kutsutaan kahdesta paikasta (init + resetMoon)',
    (src.match(/rollMoonShadowMults\(\);/g) || []).length === 2,
    (src.match(/rollMoonShadowMults\(\);/g) || []).length);
ok('oma RNG-instanssi (ei jaettua chaosRng-jonoa)', /moonShadowRng = makeRng\(/.test(src));

console.log('\n6) Versio');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok('#version-tag ' + ver.VERSION, ver.tagOk(html));
ok('kaikki ?v=-leimat = ' + ver.NUM + ' (≥4 kpl)', ver.stampsConsistent(html) && ver.stamps(html).length >= 4);

console.log(fails ? '\n=== TULOS: ' + fails + ' löydöstä (' + checks + ' tarkistusta) ==='
                  : '\n=== TULOS: ' + checks + ' OK, 0 löydöstä ===');
process.exit(fails ? 1 : 0);
