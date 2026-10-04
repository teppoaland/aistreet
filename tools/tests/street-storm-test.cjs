/* ═══════════════════════════════════════════════════════════
   street-storm-test.cjs – BAD-myrsky: paksut pilvet + sade + ukkonen (v11.52)

   Miksi: BAD-myrsky tuo paksut pilvet (cloudThickMult) sekä sateen ja
   ukkosen SATUNNAISINA PURSKEINA (tyyni → purske → tyyni). Salama iskee
   ylhäältä alas talojen TAAKSE (ei koskaan eteen) ja väläyttää koko ruudun;
   jyrinä soi matalana hetki välähdyksen jälkeen. Vain BAD (chaosFlags.storm);
   NORMAL/MILD/GOOD/FULL pysyvät bitti-identtisinä (stormBurst = false).

   Testi ajaa oikeat init()/updateStorm()/drawLightningBolt() kutsut ja
   todistaa käytöksen muistiinpanevalla ctx-stubilla + lähdetarkistuksin.

   Ajo: node tools/tests/street-storm-test.cjs
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
const near = (a, b, eps) => Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps);

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
    resetStorm, updateStorm, triggerLightning, makeBoltPath, initRain,
    drawRain, drawLightningBolt, updateLightning,
    get stormBurst() { return stormBurst; },
    get rainDrops() { return rainDrops; },
    get lightning() { return lightning; },
    get phase() { return stormPhase; },
    set phase(v) { stormPhase = v; },
    get stormTimer() { return stormTimer; },
    set stormTimer(v) { stormTimer = v; },
    get thunderTimer() { return thunderTimer; },
    set thunderTimer(v) { thunderTimer = v; },
    get thunderPending() { return thunderPending; },
    set thunderPending(v) { thunderPending = v; },
    get conf() { return { cloudThickMult, rainAmount, stormCalmMin, stormCalmMax, stormBurstMin, stormBurstMax, thunderGapMin, thunderGapMax }; },
    consts: { GROUND_Y, WORLD_W, WORLD_H, RAIN_MAX: STORM_RAIN_MAX, FLASH: LIGHTNING_FLASH_FRAMES, SEGS: LIGHTNING_BOLT_SEGS }
} };`);
if (!src.includes(API)) { console.error('FAIL: export-rivi ei löytynyt street.js:stä'); process.exit(1); }
src = src.replace(API, DBG);

vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), sandbox);
vm.runInContext(src, sandbox);
const Street = vm.runInContext('Street', sandbox);
const Chaos = vm.runInContext('StreetChaos', sandbox);
const StreetSfxMod = vm.runInContext('StreetSfx', sandbox);
const T = Street.__t;
const C = T.consts;

/* Laske playThunder-kutsut (street.js kutsuu StreetSfx.playThunder()). */
let thunderCalls = 0;
StreetSfxMod.playThunder = () => { thunderCalls++; };

Street.setChaos('normal');
try { Street.init(canvasStub); } catch (e) { console.log('  (init: ' + e.message + ')'); }

/* Apurit lähdetekstin paloitteluun. */
function sliceFrom(name, endMark) {
    const i = src.indexOf(name);
    if (i < 0) return '';
    const j = src.indexOf(endMark, i);
    return j < 0 ? src.slice(i) : src.slice(i, j);
}
const fnBody = (n) => sliceFrom('function ' + n + '(', '\n    }');

console.log('\n1) Kaaosakselit: oletukset, profiilit, portti');
const def = Chaos.CHAOS_DEFAULTS2;
ok('CHAOS_DEFAULTS2: cloudThickMult = 1', def.cloudThickMult === 1, def.cloudThickMult);
ok('CHAOS_DEFAULTS2: stormBurst = false', def.stormBurst === false, def.stormBurst);
ok('CHAOS_DEFAULTS2: rainAmount = 0', def.rainAmount === 0, def.rainAmount);
ok('CHAOS_DEFAULTS2: thunderGapMin/Max = 0/0', def.thunderGapMin === 0 && def.thunderGapMax === 0);
const badP = Chaos.chaosProfile('bad');
ok('BAD: cloudThickMult > 1 (paksut pilvet)', badP.cloudThickMult > 1, badP.cloudThickMult);
ok('BAD: stormBurst = true', badP.stormBurst === true, badP.stormBurst);
ok('BAD: rainAmount > 0', badP.rainAmount > 0, badP.rainAmount);
ok('BAD: purske- ja tyynijaksot > 0', badP.stormCalmMin > 0 && badP.stormCalmMax >= badP.stormCalmMin &&
    badP.stormBurstMin > 0 && badP.stormBurstMax >= badP.stormBurstMin,
    [badP.stormCalmMin, badP.stormCalmMax, badP.stormBurstMin, badP.stormBurstMax]);
ok('BAD: thunderGapMin/Max > 0', badP.thunderGapMin > 0 && badP.thunderGapMax >= badP.thunderGapMin,
    [badP.thunderGapMin, badP.thunderGapMax]);
ok('MILD/GOOD: ei myrskyä', !Chaos.chaosProfile('mild').stormBurst && !Chaos.chaosProfile('good').stormBurst);
const fullCfg = Chaos.drawChaosCfg('full');
ok('FULL: ei myrskyä (stormBurst false, rainAmount 0)', fullCfg.stormBurst === false && fullCfg.rainAmount === 0,
    [fullCfg.stormBurst, fullCfg.rainAmount]);
ok('clampChaosCfg: cloudThickMult 99 → 4', Chaos.clampChaosCfg(Object.assign({}, def, { cloudThickMult: 99 })).cloudThickMult === 4);
ok('clampChaosCfg: cloudThickMult -5 → 1', Chaos.clampChaosCfg(Object.assign({}, def, { cloudThickMult: -5 })).cloudThickMult === 1);
ok('clampChaosCfg: rainAmount -5 → 0', Chaos.clampChaosCfg(Object.assign({}, def, { rainAmount: -5 })).rainAmount === 0);
ok('clampChaosCfg: thunderGapMin -5 → 0', Chaos.clampChaosCfg(Object.assign({}, def, { thunderGapMin: -5 })).thunderGapMin === 0);
ok('clampChaosCfg: stormCalmMax < min → nostetaan', Chaos.clampChaosCfg(Object.assign({}, def, { stormCalmMin: 100, stormCalmMax: 10 })).stormCalmMax === 100);

console.log('\n2) NORMAL/MILD/GOOD: ei sadetta eikä ukkosta (bitti-identtinen)');
for (const lvl of ['normal', 'mild', 'good']) {
    Street.setChaos(lvl);
    ok(lvl + ': stormBurst = false', T.stormBurst === false, T.stormBurst);
    ok(lvl + ': rainAmount = 0, cloudThickMult = 1', T.conf.rainAmount === 0 && T.conf.cloudThickMult === 1,
        [T.conf.rainAmount, T.conf.cloudThickMult]);
}

console.log('\n3) BAD: myrsky päällä');
Street.setChaos('bad');
ok('BAD: stormBurst = true', T.stormBurst === true);
ok('BAD: rainAmount = 1, cloudThickMult > 1', T.conf.rainAmount === 1 && T.conf.cloudThickMult > 1,
    [T.conf.rainAmount, T.conf.cloudThickMult]);
ok('BAD: chaosFlags.storm päällä (lähde)', /chaosFlags\.storm\s*=\s*isBad/.test(src));

console.log('\n4) Sää-tilakone: tyyni → purske → tyyni');
Street.setChaos('bad');
T.resetStorm();
ok('resetStorm: alkaa tyynestä', T.phase === 'calm' && T.rainDrops.length === 0);
T.phase = 'calm'; T.stormTimer = 0.5;
T.updateStorm(1);
ok('tyyni loppuu → purske alkaa', T.phase === 'burst', T.phase);
ok('purske synnyttää sateen (rainAmount × RAIN_MAX)',
    T.rainDrops.length === Math.round(C.RAIN_MAX * 1), T.rainDrops.length);
ok('pisarat maailman sisällä', T.rainDrops.every((d) => d.x >= 0 && d.x <= C.WORLD_W && d.y >= 0 && d.y <= C.WORLD_H && d.len > 0));
ok('pisaroilla on syvyys z ∈ [0,1]', T.rainDrops.every((d) => d.z >= 0 && d.z <= 1));
pts = []; ops = [];
T.drawRain();                                  // lähi-kerros (z >= 0.5)
const segs = [];
for (let i = 1; i < pts.length; i += 2) segs.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
ok('lähi-sade piirtyy (moveTo+lineTo per pisara)', pts.length >= 2 && pts.length % 2 === 0, pts.length);
ok('pisaran viiva on vino tuulen mukaan (dx ≠ 0)', segs.length > 0 && segs.some((s) => s[0] !== 0));
ok('pisaran viiva osoittaa alaspäin (dy > 0)', segs.length > 0 && segs.every((s) => s[1] > 0));
const drop = T.rainDrops[0];
drop.y = 100;
T.thunderTimer = 9999; T.stormTimer = 9999;
T.updateStorm(1);
ok('sade valuu alaspäin (y kasvaa)', drop.y > 100 && drop.y < C.WORLD_H, drop.y);
T.phase = 'burst'; T.stormTimer = 0.5; T.thunderTimer = 9999;
T.updateStorm(1);
ok('purske loppuu → tyyni + sade poistuu', T.phase === 'calm' && T.rainDrops.length === 0,
    [T.phase, T.rainDrops.length]);

console.log('\n5) Salama: ylhäältä alas, talojen taakse');
Street.setChaos('bad');
T.resetStorm();
T.triggerLightning();
const bolt = T.lightning.bolt;
ok('salama syntyy (lightning + polku)', !!bolt && bolt.length === C.SEGS + 1, bolt ? bolt.length : null);
ok('alkaa ylhäältä (y = 4)', bolt[0].y === 4, bolt[0].y);
ok('päättyy maan tasoon (GROUND_Y + 6)', near(bolt[bolt.length - 1].y, C.GROUND_Y + 6), bolt[bolt.length - 1].y);
ok('pysyy vaakasuunnassa ruudulla', bolt.every((p) => p.x >= 6 && p.x <= C.WORLD_W - 6),
    [Math.min.apply(null, bolt.map((p) => p.x)), Math.max.apply(null, bolt.map((p) => p.x))]);
ok('etenee alaspäin (y ei kasva ylöspäin)', bolt.every((p, i) => i === 0 || p.y >= bolt[i - 1].y));
pts = []; ops = [];
T.drawLightningBolt();
ok('drawLightningBolt piirtää polun (15 pistettä)', pts.length === C.SEGS + 1, pts.length);
ok('piirron päätepiste = maan taso', near(pts[pts.length - 1][1], C.GROUND_Y + 6), pts[pts.length - 1][1]);
const rBody = fnBody('render');
const iP = rBody.indexOf('drawLightningBolt()');
ok('salama piirretään ENNEN taustasiluettia', iP > 0 && iP < rBody.indexOf('drawBackdrop('), [iP, rBody.indexOf('drawBackdrop(')]);
ok('salama piirretään ENNEN taloja (talot peittävät → ei koskaan eteen)',
    iP > 0 && iP < rBody.indexOf('drawBuildings('), [iP, rBody.indexOf('drawBuildings(')]);
const iRain = rBody.indexOf('drawRain()');
ok('sade piirretään ENNEN efektikerrosta (kaiken edessä)',
    iRain > 0 && iRain < rBody.indexOf('drawScreenEffects()'), [iRain, rBody.indexOf('drawScreenEffects()')]);
const iBack = rBody.indexOf('drawRainBack()');
ok('kauko-sade piirretään taustasiluetin JÄLKEEN', iBack > rBody.indexOf('drawBackdrop('), [iBack, rBody.indexOf('drawBackdrop(')]);
ok('kauko-sade piirretään talojen ETEEN (jää talojen taakse)', iBack > 0 && iBack < rBody.indexOf('drawBuildings('), [iBack, rBody.indexOf('drawBuildings(')]);
const seBody = fnBody('drawScreenEffects');
ok('välähdys koko ruudulle (fillRect 0,0,WORLD_W,WORLD_H)',
    seBody.includes('lightning.flashAlpha') && seBody.includes('fillRect(0, 0, WORLD_W, WORLD_H)'));

console.log('\n6) Jyrinä: matala ääni hetki välähdyksen jälkeen');
Street.setChaos('bad');
T.resetStorm();
T.thunderPending = 1; thunderCalls = 0;
T.updateStorm(1);
ok('viivästetty jyrinä soi (playThunder)', thunderCalls === 1, thunderCalls);
ok('jyrinä kuitataan (thunderPending = -1)', T.thunderPending === -1, T.thunderPending);
Street.setChaos('normal');
T.thunderPending = 1; thunderCalls = 0;
T.updateStorm(1);
ok('ei-NORMAL: jyrinä ei soi (updateStorm no-op)', thunderCalls === 0, thunderCalls);
T.thunderPending = -1;
Street.setChaos('bad');

console.log('\n7) Lähteet: matala ääni, ei dialogeja, kytkennät');
const thunderSrc = sliceFrom('function playThunder(', '\n}\n');
ok('playThunder: lowpass-kohina', thunderSrc.includes("lp.type = 'lowpass'"));
ok('playThunder: matalat bassosävelet (62 Hz, 44 Hz)', thunderSrc.includes('freq: 62') && thunderSrc.includes('freq: 44'));
ok('playThunder: KOLME limittäistä kerrosta', thunderSrc.includes('delay: 0.20') && thunderSrc.includes('delay: 0.40'));
ok('playThunder: ei korkeita säveliä (kaikki < 200 Hz)',
    (thunderSrc.match(/freq:\s*(\d+)/g) || []).every((s) => Number(s.replace(/\D/g, '')) < 200));
ok('StreetSfx vie playThunderin', src.includes('playThunder: playThunder'));
const stormFns = ['updateStorm', 'triggerLightning', 'updateRain', 'drawRain', 'drawRainBack', 'rainStreak', 'drawLightningBolt', 'resetStorm', 'makeBoltPath', 'initRain'];
ok('myrskyfunktioissa ei uusia dialogeja (sääntö 06)',
    stormFns.every((n) => !fnBody(n).includes('showNotification')));
ok('updateStorm kutsutaan update():ssa', /updateStorm\(dt\);/.test(src));
ok('resetStorm kutsutaan init():ssä', /resetStorm\(\);/.test(src));
ok('cloudThickMult käytössä drawCloudsissa', src.includes('* cloudThickMult'));

console.log('\n8) Versio');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok('#version-tag ' + ver.VERSION, ver.tagOk(html));
ok('kaikki ?v=-leimat = ' + ver.NUM + ' (≥4 kpl)', ver.stampsConsistent(html) && ver.stamps(html).length >= 4);

console.log(fails ? '\n=== TULOS: ' + fails + ' löydöstä (' + checks + ' tarkistusta) ==='
                  : '\n=== TULOS: ' + checks + ' OK, 0 löydöstä ===');
process.exit(fails ? 1 : 0);



