/* ═══════════════════════════════════════════════════════════════
   street-spawn-safe-test.cjs – spawn ei koskaan sähkökaapin kohdalle (v11.72)

   Miksi: `applyChaosProfile()` arpoo pelaajan spawn-paikan. Talojen puolella
   (y 280–288) pelaajan vartalo (h = 30) peittää AINA sähkökaapin yläreunan
   (cab.y = GROUND_Y − 16 = 294) → vaakalimitys kaapin kanssa riitti osumaan.
   Päällä oleva kaappi (50 %) iski siis heti spawnissa ilman että pelaaja ehti
   väistää (käyttäjän havainto 4.10.2026). Korjaus: spawn työnnetään kaapin
   sivulle. Korjaus ei käytä RNG-kutsuja → NORMAL-maailma ja ?seed=-arinnat
   pysyvät bitti-identtisinä.

   Testi todistaa kolme asiaa:
     1) geometria on aidosti vaarallinen (raaka arpa osuisi) – ilman tätä
        penkki ei voisi napata bugia,
     2) oikea spawn EI koskaan osu kaappiin (5000 arpaa) ja pysyy rajoissa,
     3) kiinnitetty arpa (0.25) osuisi kaappiin → spawn siirtyy silti pois.

   Ajo: node tools/tests/street-spawn-safe-test.cjs
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');

/* Ohjattava Math.random: section 3 arpoo oikeasti, section 4 kiinnittää. */
const sandboxMath = Object.create(Math);
let randomFn = () => Math.random();     // node:n globaali Math → vaihteleva arpa
sandboxMath.random = () => randomFn();

const ctxStub = new Proxy({}, { get(t, k) { return () => ({ addColorStop() {} }); } });
const canvasStub = { getContext: () => ctxStub, width: 800, height: 400, clientWidth: 800, clientHeight: 400, style: {} };

const sandbox = {
    console, Math: sandboxMath, Date, JSON, URLSearchParams,
    location: { search: '' },
    document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => canvasStub, body: { appendChild() {} } },
    window: { addEventListener() {}, innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1, location: { search: '' } },
    navigator: { maxTouchPoints: 0 },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    StreetAudio: { init() {}, start() {}, stop() {}, playDeathGong() {}, getCtx: () => null, getDestination: () => null, playJukebox() {}, playJukeboxQueue() {}, appendJukeboxQueue() {}, stopJukebox() {}, isJukeboxPlaying: () => false, getJukeboxQueuePos: () => 0, setHungerTempo() {} },
    GameState: { STORAGE_KEY: 'x', defaultState: { inventory: { coin: false, coinCount: 0, hamburgerCount: 5 }, litLamps: [false, false, false, false, false], isDay: null }, load: () => ({}), save() {}, reset() {} },
    setTimeout, clearTimeout, setInterval, clearInterval
};
sandbox.globalThis = sandbox;

let fail = 0;
const F = (m) => { fail++; console.error('  X ' + m); };
const ok = (m, cond, extra) => { if (!cond) F(m + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); else console.log('  ok   ' + m); };

let src = require('./street-src.cjs');
const API = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };';
const DBG = API.replace(' };', `, __t: { player, electricCabinets, WORLD_W, GROUND_Y } };`);
if (!src.includes(API)) { console.error('FAIL: export-rivi ei löytynyt'); process.exit(1); }
src = src.replace(API, DBG);

try {
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), sandbox);
    vm.runInContext(src, sandbox, { filename: 'street.js' });
} catch (e) {
    console.error('FATAL: IIFE-lataus epäonnistui:', e && e.stack || e);
    process.exit(1);
}
const Street = vm.runInContext('Street', sandbox);
const T = Street.__t;

const overlaps = (p, cabs) => {
    for (const cab of cabs) {
        if (p.x < cab.x + cab.w && p.x + p.w > cab.x &&
            p.y < cab.y && p.y + p.h > cab.y) return cab;
    }
    return null;
};

/* ── 1) Lähdetarkistukset: vartio on olemassa ───────────────────── */
console.log('\n1) Lähde: spawn-väistö paikallaan');
ok('applyChaosProfile: cabTop-vartio löytyy', src.includes('const cabTop = GROUND_Y - 16;'));
ok('spawn työnnetään kaapin sivulle (left/right)',
   src.includes('const right = Math.min(WORLD_W - player.w - 4, cab.x + cab.w + 4);') &&
   src.includes('const left  = Math.max(4, cab.x - player.w - 4);'));
ok('väistö tapahtuu vain kaapin korkeudella',
   src.includes('if (player.y < cabTop && player.y + player.h > cabTop) {'));

/* ── 2) Geometria on aidosti vaarallinen ────────────────────────── */
console.log('\n2) Kontrolli: raaka arpa osuisi kaappiin (bugi oli oikea)');
let rawHits = 0;
for (let i = 0; i < 200000; i++) {
    const p = { x: 4 + Math.random() * 772, y: 280 + Math.random() * 8, w: 20, h: 30 };
    if (overlaps(p, T.electricCabinets)) rawHits++;
}
ok('200 000 raakaa spawnia → osuu kaappiin (odotus ~1 %)', rawHits > 0, rawHits + ' osumaa');

/* ── 3) Oikea spawn ei osu – 5000 arpaa ─────────────────────────── */
console.log('\n3) Oikea spawn (5000 × setChaos normal) ei koskaan osu');
let hits = 0, building = 0, outOfBounds = 0;
for (let i = 0; i < 5000; i++) {
    Street.setChaos('normal');
    const p = T.player;
    if (overlaps(p, T.electricCabinets)) hits++;
    const cabTop = T.GROUND_Y - 16;
    if (p.y < cabTop && p.y + p.h > cabTop) building++;
    if (p.x < 4 - 1e-9 || p.x > T.WORLD_W - p.w - 4 + 1e-9) outOfBounds++;
}
ok('0 osumaa kaappiin 5000 spawnissa', hits === 0, hits + ' osumaa');
ok('spawnit pysyvät rajoissa [4, WORLD_W−w−4]', outOfBounds === 0, outOfBounds + ' rajojen ulkopuolella');
ok('talojen puolen spawnit syntyvät (~80 %)', building > 3500, building);

/* ── 4) Kiinnitetty arpa: osuisi → siirtyy silti pois ───────────── */
console.log('\n4) Kiinnitetty arpa (0.25): spawn osuisi kaappiin → väistö siirtää');
randomFn = () => 0.25;             // x = 4 + 0.25·772 = 197 (kaapin 1 ikkunassa), y = 282
Street.setChaos('normal');
const p4 = T.player;
ok('spawn ei jää kaapin kohdalle (x siirrettiin)', !overlaps(p4, T.electricCabinets),
   { x: p4.x, y: p4.y });
ok('x siirrettiin kaapin oikealle puolelle (≥ cab.x + cab.w)', p4.x >= 200 + 8,
   { x: p4.x });
randomFn = () => Math.random();

console.log(fail ? '\n=== TULOS: ' + fail + ' löydöstä ===' : '\n=== TULOS: 0 löydöstä ===');
process.exit(fail ? 1 : 0);
