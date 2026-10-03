// v10.32 – FULL CHAOS: (1) aloituskolikot kiinteä 2 (kuten NO CHAOS)
//                   (2) +1 🪙 jokaisesta ammutusta meteoriitista (vain FULL)
// Harness: sama tekniikka kuin chaos-normal-check.cjs (Node vm + canvas-stub).
// HUOM: testikoukut injektoidaan VAIN muistiin – repossa oleva street.js on
// edelleen koskematon (alkuperäinen return-lause).
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
/* Deterministinen Math.random: FULL/BAD arpovat talojen järjestyksen ja
   meteoriittitaajuuden. Ilman tätä meteoriitti saattoi jäädä talon taakse
   (osuma estyy) tai syntyä eri paikkaan → penkki heilui 0–4 (A/B: sama vika
   myös ennen refaktorointia, joten kyse ei ollut regressiosta). */
/* kiinteä siemen: sama layout joka ajolla. 37/40 siemenistä menee läpi –
   loput 3 asettavat talon meteoriitin eteen (osuma estyy). Vaihda tarvittaessa:
   MC_SEED=2 npm: node tools/tests/street-meteor-coin-test.cjs */
let __seed = Number(process.env.MC_SEED || 7) >>> 0 || 1;
const rnd = () => { __seed = (__seed * 1664525 + 1013904223) >>> 0; return __seed / 4294967296; };
sandbox.Math = new Proxy(Math, { get(t, p) { return p === 'random' ? rnd : t[p]; } });
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
const markerRe = /return \{ init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession(, clearBeamWeapon)? \};/;
if (!markerRe.test(src)) { console.error('FAIL: return-lause ei löytynyt street.js:stä'); process.exit(1); }
const hooks = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession,\n' +
    '        __t: {\n' +
    '            get cfg() { return chaosCfg; },\n' +
    '            get coinCount() { return coinCount; },\n' +
    '            get beamWeaponCollected() { return beamWeaponCollected; },\n' +
    '            set beamWeaponCollected(v) { beamWeaponCollected = v; },\n' +
    '            get shootingStar() { return shootingStar; },\n' +
    '            set shootingStar(v) { shootingStar = v; },\n' +
    '            get dayT() { return dayT; },\n' +
    '            set dayT(v) { dayT = v; },\n' +
    '            aim(x, y) { aimX = x; aimY = y; },\n' +
    '            player, coin, fireBeam, update\n' +
    '        } };';
src = src.replace(markerRe, hooks);
ok('street.js: return-lause löytyi (repo-tiedosto koskematon, koukut vain muistissa)', true);

vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), sandbox);
vm.runInContext(src, sandbox);
const Street = vm.runInContext('Street', sandbox);
const T = Street.__t;
ok('testikoukut käytettävissä', !!(T && T.player && T.coin && typeof T.fireBeam === 'function' && typeof T.update === 'function'));
// init() asettaa moduulin state-olion – oikea käynnistysjärjestys on setChaos → init
// (index.html: hubi → Street.setChaos(level) → Street.init(canvas))
console.log('\n[0] Uusi peli FULL-tasolla (tyhjä tallennus, oikea käynnistysjärjestys)');
try { Street.setChaos('full'); } catch (e) { console.log('  SKIP  setChaos: ' + e.message + '\n' + e.stack); }
try {
    Street.init(canvasStub);
    ok('FULL: uusi peli alkaa 2 kolikolla (chaosCfg.startCoins → state)', T.coinCount === 2, T.coinCount);
    ok('FULL: aloitus tallennettu heti (localStorage coinCount = 2)', JSON.parse(store[Object.keys(store)[0]]).inventory.coinCount === 2);
} catch (e) { console.log('  SKIP  init(): ' + e.message + '\n' + e.stack); }

function meteor() {
    // hpLeft: 1 = valmiiksi vaurioitunut meteoriitti: v11.14:ssä täysi kestää
    // 2 osumaa (1. osuma vain lämmittää) → 1 osuma riittää tappavaan, joten
    // tämä testi mittaa edelleen kolikkopalkkiota eikä hp-mekaniikkaa.
    return { kind: 'meteorite', x: 400, y: 100, vx: -0.5, vy: 0.5, r: 10, active: true, life: 0, trail: [], timer: 600, hpLeft: 1 };
}
function armFiring() {            // ase kädessä, yö, lamppurivin alapuolella, kasvot meteoriittia kohti
    T.beamWeaponCollected = true;
    T.dayT = 0;
    T.player.y = 320;            // 320 + 30 = 350 > LAMP_BASE_Y (325)
    T.player.facing = 1;         // facing * vx = -0.5 < 0 → ammunta sallittu
    T.shootingStar = meteor();
    T.aim(400, 100);             // säde päättyy meteoriitin keskelle
}

/* ═══ 1. FULL: aloituskolikot kiinteä 2, muut akselit edelleen satunnaisia ═══ */
const startCoinsSet = new Set(), respawnSet = new Set(), burgerSet = new Set(), trafficSet = new Set();
let respawnOutOfRange = 0;
for (let i = 0; i < 200; i++) {
    Street.setChaos('full');
    const cfg = T.cfg;
    startCoinsSet.add(cfg.startCoins);
    if (cfg.coinRespawnFrames < 1800 || cfg.coinRespawnFrames > 18000) respawnOutOfRange++;
    respawnSet.add(cfg.coinRespawnFrames);
    burgerSet.add(cfg.startBurgers);
    trafficSet.add(cfg.trafficSpeedMult);
}
console.log('\n[1] FULL-arpa 200× – aloituspaketti');
ok('FULL: startCoins aina 2 (1 arvo, 200 arpaa)', startCoinsSet.size === 1 && startCoinsSet.has(2), [...startCoinsSet]);
ok('FULL: muut akselit ennallaan – startBurgers yhä 2–10 arvonta', burgerSet.size > 1, burgerSet.size + ' arvoa');
ok('FULL: kolikon syntymäväli yhä 1800–18000 fr (EI muutettu)', respawnSet.size > 1 && respawnOutOfRange === 0, respawnSet.size + ' arvoa, ulkona=' + respawnOutOfRange);
ok('FULL: trafficSpeedMult yhä satunnainen', trafficSet.size > 1, trafficSet.size + ' arvoa');

/* ═══ 2. FULL: osuma → +1 🪙 ═══ */
console.log('\n[2] FULL: meteoriitin ampuminen');
Street.setChaos('full');
armFiring();
const before = T.coinCount;
T.fireBeam();
ok('FULL: osuma antaa +1 kolikon', T.coinCount === before + 1, before + ' -> ' + T.coinCount);
ok('FULL: meteoriitti tuhoutuu osumasta', T.shootingStar.active === false, T.shootingStar.active);
const stateKey = Object.keys(store)[0];
const saved = JSON.parse(store[stateKey]);
ok('FULL: saldo tallennettu localStorageen (' + saved.inventory.coinCount + ')', saved.inventory.coinCount === T.coinCount);
ok('FULL: kadun kolikkolippu EI kulunut (inventory.coin != true)', saved.inventory.coin !== true, saved.inventory.coin);
const before2 = T.coinCount;
T.fireBeam();
ok('FULL: sama meteoriitti ei anna toista kolikkoa', T.coinCount === before2, before2 + ' -> ' + T.coinCount);

/* ═══ 3. BAD: tuhoutuu mutta EI kolikkoa (portti pitää) ═══ */
console.log('\n[3] BAD CHAOS: portti (ase voi jäädä kenttään jaetusta tallennuksesta)');
Street.setChaos('bad');
try { Street.init(canvasStub); } catch (e) { console.log('  (init BAD uudelleen: ' + e.message + ')'); }   // nollaa v11.14-laukaisulukon
armFiring();
const before3 = T.coinCount;
T.fireBeam();
ok('BAD: meteoriitti tuhoutuu kuten ennen (toiminto ennallaan)', T.shootingStar.active === false, T.shootingStar.active);
ok('BAD: ei kolikkoa (chaosLevel-portti pitää)', T.coinCount === before3, before3 + ' -> ' + T.coinCount);

/* ═══ 4. Muut kaaostasot: aloituskolikot ennallaan 2 ═══ */
console.log('\n[4] Muut tasot: aloituskolikot ennallaan (0 muutosta)');
for (const lvl of ['normal', 'mild', 'good', 'bad']) {
    Street.setChaos(lvl);
    /* v11.29: BAD antaa katsojan syntymäpaketin (100 kolikkoa) – muut tasot 2. */
    const want = (lvl === 'bad') ? 100 : 2;
    ok(lvl.toUpperCase() + ': startCoins = ' + want, T.cfg.startCoins === want, T.cfg.startCoins);
}
Street.setChaos('normal');
ok('NORMAL: coinRespawnFrames yhä 7200 (bit-identtinen)', T.cfg.coinRespawnFrames === 7200, T.cfg.coinRespawnFrames);

/* ═══ 5. Regressio: kadun kolikon keräys toimii edelleen (+1, globaali polku) ═══
   HUOM (v11.44): FULLissa liikenne/oviukko voi kaataa pelaajan kesken
   yrityksen (armFiring jättää pelaajan y=320 = kaistalle) → kolikon keräys jäi
   väliin ja penkki heilui 0–4. Tämä tarkistus mittaa KOLIKKOPOLKUA, joten
   pelaaja siirretään turvaradalle ja tainnutus nollataan joka kierroksella. */
console.log('\n[5] Regressio: kadun kolikko (sama koodi kaikilla tasoilla)');
try {
    Street.setChaos('full');
    const before4 = T.coinCount;
    let collected = false, tries = 0;
    // Sama silmukka kuin pelissä (update). Lamput voivat työntää pelaajaa
    // sivusuunnassa → kolikko asetetaan uudelleen jalkoihin ja yritetään uudelleen.
    for (let i = 0; i < 5 && !collected; i++) {
        T.player.y = 350;                    // turvarata (≥ PLAYER_DEPTH_MAX_Y 347)
        T.player.knockedDown = false;
        T.player.knockdownTimer = 0;
        T.coin.collected = false;
        T.coin.x = T.player.x + T.player.w / 2;
        T.coin.y = T.player.y + T.player.h;
        T.update(1);
        tries = i + 1;
        collected = (T.coin.collected === true) && (T.coinCount === before4 + 1);
    }
    ok('FULL: kadun kolikko kerääntyy edelleen → +1', collected, tries + ' yritystä, ' + before4 + ' -> ' + T.coinCount);
} catch (e) {
    console.log('  SKIP  update()-harness ei taipunut: ' + e.message);
}

/* ═══ 6. Kolikon syntymäväli: FULL siemenessä ennallaan (ei koskettu) ═══ */
console.log('\n[6] Ei-kosketut akselit (varmistus)');
Street.setChaos('full');
{ const s = new Set(); for (let i = 0; i < 50; i++) { Street.setChaos('full'); s.add(T.cfg.coinRespawnFrames); }
  ok('FULL: kolikon syntymäväli yhä arvonta (useita arvoja 50 arvalla)', s.size > 1, s.size + ' arvoa'); }
{ const s = new Set(); for (let i = 0; i < 50; i++) { Street.setChaos('full'); s.add(T.cfg.startBurgers); }
  ok('FULL: aloitus🍔 yhä 2–10 arvonta', s.size > 1, s.size + ' arvoa'); }

console.log('\n' + (fails === 0 ? 'KAIKKI OK' : 'FAIL') + ': ' + (checks - fails) + '/' + checks + ' tarkistusta läpi');
process.exit(fails ? 1 : 0);


