/* ═══════════════════════════════════════════════════════════
   street-storm-test.cjs – Myrsky: paksut pilvet + sade + ukkonen (v11.68)

   Miksi: myrsky tuo paksut pilvet (cloudThickMult) sekä sateen ja ukkosen
   SATUNNAISINA PURSKEINA (tyyni → purske → tyyni). Päällä KAIKILLA tasoilla
   (myös NORMAL, stormBurst = true). Sää MUUTTUU pehmeästi: stormLevel liukuu
   0 ↔ 1 (STORM_RAMP_FRAMES ~5 s), joten pilvet paksunevat, sade voimistuu ja
   ukkonen alkaa vasta täydessä myrkyssä – ja kaikki palautuu tyveksi.
   Salama iskee ylhäältä alas talojen TAAKSE (ei koskaan eteen) ja väläyttää
   koko ruudun; jyrinä soi matalana hetki välähdyksen jälkeen.

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
    resetStorm, updateStorm, triggerLightning, makeBoltPath, makeRainDrop, syncRainDrops,
    drawRain, drawRainBack, drawRainFar, drawLightningBolt, updateLightning,
    get dayT() { return dayNight.t; }, set dayT(v) { dayNight.t = v; },
    get stormBurst() { return stormBurst; },
    get rainDrops() { return rainDrops; },
    get lightning() { return lightning; },
    get phase() { return stormPhase; },
    set phase(v) { stormPhase = v; },
    get stormLevel() { return stormLevel; },
    set stormLevel(v) { stormLevel = v; },
    get stormTimer() { return stormTimer; },
    set stormTimer(v) { stormTimer = v; },
    get thunderTimer() { return thunderTimer; },
    set thunderTimer(v) { thunderTimer = v; },
    get thunderPending() { return thunderPending; },
    set thunderPending(v) { thunderPending = v; },
    get conf() { return { cloudThickMult, rainAmount, stormCalmMin, stormCalmMax, stormBurstMin, stormBurstMax, thunderGapMin, thunderGapMax }; },
    consts: { GROUND_Y, WORLD_W, WORLD_H, RAIN_MAX: STORM_RAIN_MAX, FLASH: LIGHTNING_FLASH_FRAMES, SEGS: LIGHTNING_BOLT_SEGS, RAMP: STORM_RAMP_FRAMES, THUNDER_LEVEL: STORM_THUNDER_LEVEL, TOP_Y: LIGHTNING_TOP_Y, RAIN_TOP: RAIN_TOP_Y }
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
ok('CHAOS_DEFAULTS2: cloudThickMult = 2.5 (myrskyn paksunnus)', def.cloudThickMult === 2.5, def.cloudThickMult);
ok('CHAOS_DEFAULTS2: stormBurst = true (kaikki tasot)', def.stormBurst === true, def.stormBurst);
ok('CHAOS_DEFAULTS2: rainAmount = 1', def.rainAmount === 1, def.rainAmount);
ok('CHAOS_DEFAULTS2: thunderGap 300/900', def.thunderGapMin === 300 && def.thunderGapMax === 900);
ok('CHAOS_DEFAULTS2: tyyni 60–180 s (3600–10800 f)', def.stormCalmMin === 3600 && def.stormCalmMax === 10800);
const badP = Chaos.chaosProfile('bad');
ok('BAD = samat myrskyarvot kuin oletus (2.5 / true / 1)',
    badP.cloudThickMult === 2.5 && badP.stormBurst === true && badP.rainAmount === 1,
    [badP.cloudThickMult, badP.stormBurst, badP.rainAmount]);
const mildCfg = Chaos.drawChaosCfg('mild'), goodCfg = Chaos.drawChaosCfg('good');
ok('MILD/GOOD: myrsky periytyy oletuksesta (stormBurst true)',
    mildCfg.stormBurst === true && goodCfg.stormBurst === true, [mildCfg.stormBurst, goodCfg.stormBurst]);
const fullCfg = Chaos.drawChaosCfg('full');
ok('FULL: myrsky päällä (stormBurst true, rainAmount 1)',
    fullCfg.stormBurst === true && fullCfg.rainAmount === 1, [fullCfg.stormBurst, fullCfg.rainAmount]);
ok('clampChaosCfg: cloudThickMult 99 → 4', Chaos.clampChaosCfg(Object.assign({}, def, { cloudThickMult: 99 })).cloudThickMult === 4);
ok('clampChaosCfg: cloudThickMult -5 → 1', Chaos.clampChaosCfg(Object.assign({}, def, { cloudThickMult: -5 })).cloudThickMult === 1);
ok('clampChaosCfg: rainAmount -5 → 0', Chaos.clampChaosCfg(Object.assign({}, def, { rainAmount: -5 })).rainAmount === 0);
ok('clampChaosCfg: thunderGapMin -5 → 0', Chaos.clampChaosCfg(Object.assign({}, def, { thunderGapMin: -5 })).thunderGapMin === 0);
ok('clampChaosCfg: stormCalmMax < min → nostetaan', Chaos.clampChaosCfg(Object.assign({}, def, { stormCalmMin: 100, stormCalmMax: 10 })).stormCalmMax === 100);

console.log('\n2) Kaikki tasot: myrsky päällä (sama kuin BAD)');
for (const lvl of ['normal', 'mild', 'good', 'bad']) {
    Street.setChaos(lvl);
    ok(lvl + ': stormBurst = true', T.stormBurst === true, T.stormBurst);
    ok(lvl + ': rainAmount = 1, cloudThickMult = 2.5', T.conf.rainAmount === 1 && T.conf.cloudThickMult === 2.5,
        [T.conf.rainAmount, T.conf.cloudThickMult]);
}

console.log('\n3) NORMAL tyvenessä: stormLevel 0 → ohuet pilvet (bitti-identtinen)');
Street.setChaos('normal');
T.resetStorm();
ok('NORMAL: alkaa tyvenestä (stormLevel 0)', T.stormLevel === 0, T.stormLevel);
ok('NORMAL: ei pisaroita tyvenessä', T.rainDrops.length === 0, T.rainDrops.length);
ok('NORMAL: stormBurst päällä (myrsky tulee myöhemmin)', T.stormBurst === true);

console.log('\n4) Sää-tilakone + transitio: tyyni → nouseva → täysi → hiipuva');
Street.setChaos('bad');
T.resetStorm();
ok('resetStorm: alkaa tyynestä (stormLevel 0, ei pisaroita)',
    T.phase === 'calm' && T.stormLevel === 0 && T.rainDrops.length === 0);
T.phase = 'calm'; T.stormTimer = 0.5;
T.updateStorm(1);
ok('tyyni loppuu → purske alkaa', T.phase === 'burst', T.phase);
ok('transitio: sää ei ala täytenä (0 < stormLevel < 1)', T.stormLevel > 0 && T.stormLevel < 1, T.stormLevel);
ok('transitio: sade alkaa tihkusta (< RAIN_MAX)', T.rainDrops.length < C.RAIN_MAX, T.rainDrops.length);
ok('transitio: pisaramäärä = RAIN_MAX × stormLevel',
    T.rainDrops.length === Math.round(C.RAIN_MAX * 1 * T.stormLevel), [T.rainDrops.length, T.stormLevel]);
// Aja ramppi täyteen (estetään vaiheen vaihto + salamat)
for (let i = 0; i < C.RAMP + 10; i++) { T.stormTimer = 9999; T.thunderTimer = 9999; T.updateStorm(1); }
ok('transitio valmis: stormLevel = 1 (täysi myrsky)', T.stormLevel === 1, T.stormLevel);
ok('täysi myrsky: pisaroita RAIN_MAX', T.rainDrops.length === C.RAIN_MAX, T.rainDrops.length);
ok('pisarat maailman sisällä (wrap sallittu ±12)', T.rainDrops.every((d) => d.x >= -12 && d.x <= C.WORLD_W + 12 && d.y >= -12 && d.y <= C.WORLD_H + 12 && d.len > 0));
ok('pisaroilla on syvyys z ∈ [0,1]', T.rainDrops.every((d) => d.z >= 0 && d.z <= 1));
const fresh = T.makeRainDrop();
ok('uusi pisara syntyy maailman sisään (x, y, z, len)',
    fresh.x >= 0 && fresh.x <= C.WORLD_W && fresh.y >= 0 && fresh.y <= C.WORLD_H &&
    fresh.z >= 0 && fresh.z <= 1 && fresh.len > 0);
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
// Purske loppuu → sää alkaa hiipua (ei rysäystä)
T.phase = 'burst'; T.stormTimer = 0.5; T.thunderTimer = 9999;
T.updateStorm(1);
ok('purske loppuu → tyyni, sade EI katoa heti (hiipuu)',
    T.phase === 'calm' && T.rainDrops.length > 0, [T.phase, T.rainDrops.length]);
// Hiipuminen loppuun
for (let i = 0; i < C.RAMP + 10; i++) T.updateStorm(1);
ok('transitio alas valmis: stormLevel = 0 ja sade poistuu',
    T.stormLevel === 0 && T.rainDrops.length === 0, [T.stormLevel, T.rainDrops.length]);

console.log('\n4b) Sade vain öisin: päivällä ei sadetta, öisin sataa');
Street.setChaos('normal');
T.resetStorm();
T.dayT = 1;                                  // täysi päivä
T.phase = 'burst'; T.stormTimer = 9999; T.stormLevel = 1; T.thunderTimer = 9999;
for (let i = 0; i < C.RAMP + 10; i++) { T.stormTimer = 9999; T.thunderTimer = 9999; T.updateStorm(1); }
ok('päivällä: myrsky hiipuu olemattomiin (stormLevel = 0)', T.stormLevel === 0, T.stormLevel);
ok('päivällä: ei pisaroita', T.rainDrops.length === 0, T.rainDrops.length);
T.dayT = 0;                                  // yö
T.phase = 'burst'; T.stormTimer = 9999; T.stormLevel = 0; T.thunderTimer = 9999;
for (let i = 0; i < C.RAMP + 10; i++) { T.stormTimer = 9999; T.thunderTimer = 9999; T.updateStorm(1); }
ok('yöllä: myrsky nousee täyteen (stormLevel = 1)', T.stormLevel === 1, T.stormLevel);
ok('yöllä: sataa (pisaroita RAIN_MAX)', T.rainDrops.length === C.RAIN_MAX, T.rainDrops.length);
ok('takarivi (talojen taakse, z < 0.5) alkaa pilvistä: y >= RAIN_TOP - 6',
    T.rainDrops.filter((d) => d.z < 0.5).every((d) => d.y >= C.RAIN_TOP - 6), C.RAIN_TOP);
ok('eturivi (talojen eteen, z >= 0.5) saa tulla näytön ylhäältä: y < RAIN_TOP',
    T.rainDrops.some((d) => d.z >= 0.5 && d.y < C.RAIN_TOP));

console.log('\n5) Salama: ylhäältä alas, talojen taakse');
Street.setChaos('bad');
T.resetStorm();
T.triggerLightning();
const bolt = T.lightning.bolt;
ok('salama syntyy (lightning + polku)', !!bolt && bolt.length === C.SEGS + 1, bolt ? bolt.length : null);
ok('alkaa pilvistä (y = LIGHTNING_TOP_Y, ei ruudun yläreunasta)', bolt[0].y === C.TOP_Y, [bolt[0].y, C.TOP_Y]);
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
const iFar = rBody.indexOf('drawRainFar()');
ok('syvä sade piirretään taustasiluetin TAKANA (ennen drawBackdrop)',
    iFar > 0 && iFar < rBody.indexOf('drawBackdrop('), [iFar, rBody.indexOf('drawBackdrop(')]);
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
T.resetStorm();
T.thunderPending = 1; thunderCalls = 0;
T.updateStorm(1);
ok('myös NORMAL: jyrinä soi (myrsky kaikilla tasoilla)', thunderCalls === 1, thunderCalls);
T.thunderPending = -1;
// Transitio: salama vasta kun sää on lähes täysi myrsky (ei ukkosta tihkusateessa)
Street.setChaos('bad');
T.resetStorm();
T.phase = 'burst'; T.stormTimer = 9999; T.stormLevel = 0.5; T.thunderTimer = 0;
T.updateStorm(1);
ok('transitio: ei salamaa puolikkaalla säällä', T.lightning === null, T.lightning ? 'lightning' : null);
T.stormLevel = 1; T.thunderTimer = 0;
T.updateStorm(1);
ok('täysi myrsky: salama iskee (thunderTimer 0 → triggerLightning)', !!T.lightning);
// v11.56: salaman → jyrinän viive 0,4–3,0 s (kaukaisin ukkonen jyrisee vasta ~3 s päästä)
ok('salama → jyrinä 0,4–3,0 s (THUNDER_DELAY_MIN/MAX)',
    src.includes('THUNDER_DELAY_MIN = 0.4') && src.includes('THUNDER_DELAY_MAX = 3'));
const tlBody = fnBody('triggerLightning');
ok('triggerLightning lukee THUNDER_DELAY_MIN/MAX-vakiot',
    tlBody.includes('THUNDER_DELAY_MIN') && tlBody.includes('THUNDER_DELAY_MAX'));
Street.setChaos('bad');

console.log('\n7) Lähteet: matala ääni, ei dialogeja, kytkennät');
const thunderSrc = sliceFrom('function playThunder(', '\n}\n');
ok('playThunder: lowpass-kohina', thunderSrc.includes("lp.type = 'lowpass'"));
ok('playThunder: matalat bassosävelet (62 Hz, 44 Hz)', thunderSrc.includes('freq: 62') && thunderSrc.includes('freq: 44'));
ok('playThunder: 5–10 kerrosta (THUNDER_LAYERS_MIN/MAX)', src.includes('THUNDER_LAYERS_MIN = 5') && src.includes('THUNDER_LAYERS_MAX = 10'));
ok('playThunder: limitys säilyy (0,2 s askel)', thunderSrc.includes('i * 0.2'));
ok('playThunder: ei korkeita säveliä (kaikki < 200 Hz)',
    (thunderSrc.match(/freq:\s*(\d+)/g) || []).every((s) => Number(s.replace(/\D/g, '')) < 200));
ok('StreetSfx vie playThunderin', src.includes('playThunder: playThunder'));
const stormFns = ['updateStorm', 'triggerLightning', 'updateRain', 'drawRain', 'drawRainBack', 'drawRainFar', 'rainStreak',
    'drawLightningBolt', 'resetStorm', 'makeBoltPath', 'makeRainDrop', 'syncRainDrops', 'randStorm', 'reseedStormRng'];
ok('myrskyfunktioissa ei uusia dialogeja (sääntö 06)',
    stormFns.every((n) => !fnBody(n).includes('showNotification')));
ok('myrskyfunktiot eivät kuluta jaettua Math.random-jonoa (oma RNG)',
    stormFns.every((n) => !fnBody(n).includes('Math.random')));
ok('myrskyn oma RNG (stormRng = makeRng, kuten moonShadowRng)', src.includes('stormRng = makeRng('));
ok('updateStorm kutsutaan update():ssa', /updateStorm\(dt\);/.test(src));
ok('resetStorm kutsutaan init():ssä', /resetStorm\(\);/.test(src));
ok('pilvien paksunnus skaalautuu stormLevelillä (drawClouds)', src.includes('(cloudThickMult - 1) * stormLevel'));
ok('sade lukee stormLeveliä (transitio)', src.includes('0.16 * stormLevel') && src.includes('0.36 * stormLevel'));
ok('transitio: STORM_RAMP_FRAMES = 300', src.includes('STORM_RAMP_FRAMES = 300'));
ok('salaman alku pilvistä (LIGHTNING_TOP_Y = 60, ei y = 4)', src.includes('LIGHTNING_TOP_Y = 60'));
ok('salama vasta täydessä myrskyssä (STORM_THUNDER_LEVEL = 0.85)', src.includes('STORM_THUNDER_LEVEL = 0.85'));
ok('sade alkaa pilvistä (RAIN_TOP_Y = LIGHTNING_TOP_Y)', src.includes('RAIN_TOP_Y = LIGHTNING_TOP_Y'));
ok('vain takarivi alkaa pilvistä (topY = (z < 0.5) ? RAIN_TOP_Y : 0)', src.includes('(z < 0.5) ? RAIN_TOP_Y : 0'));
ok('sade vain öisin (portti dayNight.t < CLOSED_AT_DAYT)', src.includes('dayNight.t < CLOSED_AT_DAYT'));
ok('kolme saderiviä (syvä z<0.25 · keski 0.25–0.5 · lähi z>=0.5)',
    src.includes('d.z < 0.25') && src.includes('d.z >= 0.25 && d.z < 0.5') && src.includes('d.z >= 0.5'));

console.log('\n8) Versio');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok('#version-tag ' + ver.VERSION, ver.tagOk(html));
ok('kaikki ?v=-leimat = ' + ver.NUM + ' (≥4 kpl)', ver.stampsConsistent(html) && ver.stamps(html).length >= 4);

console.log(fails ? '\n=== TULOS: ' + fails + ' löydöstä (' + checks + ' tarkistusta) ==='
                  : '\n=== TULOS: ' + checks + ' OK, 0 löydöstä ===');
process.exit(fails ? 1 : 0);



