/* ═══════════════════════════════════════════════════════════════
   street-window-lights-test.cjs – ikkunavalot BAD/FULLissa (v11.41)

   Miksi: `updateLitWindows()` arpoo uuden tavoitteen (0..windowTargetMax)
   VAIN kun jokin ikkuna sammuu. Jos lista on tyhjä, se ei koskaan täyty.
   BAD/FULLin `shuffleBuildingOrder()` nollasi listan → katu jäi ilman
   ikkunavaloja koko runiksi (käyttäjän havainto 3.10.2026). Korjaus:
   `seedLitWindows()` kylvää valot heti uudelleen.

   Testi on DETERMINISTINEN: `Math.random` on kiinnitetty arvoon 0.9, joten
   `floor(0.9 * (n+1))` antaa tunnetun määrän ikkunoita.

   Ajo: node tools/tests/street-window-lights-test.cjs
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');

/* Math.random kiinni → toistettava ikkunamäärä */
const FixedMath = Object.create(Math);
FixedMath.random = () => 0.9;

const canvasStub = { getContext: () => ctxStub, width: 800, height: 400, clientWidth: 800, clientHeight: 400, style: {} };
const ctxStub = new Proxy({}, { get(t, k) { return () => ({ addColorStop() {} }); } });

const sandbox = {
    console, Math: FixedMath, Date, JSON, URLSearchParams,
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
const DBG = API.replace(' };', `, __t: {
    get litWindows() { return litWindows; },
    set litWindowsEmpty(v) { litWindows.length = 0; },
    set windowTargetMax(v) { windowTargetMax = v; },
    get windowTargetMax() { return windowTargetMax; },
    shuffleOrder: shuffleBuildingOrder,
    resetOrder: resetBuildingOrder
} };`);
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

console.log('\n1) Latauksen jälkeinen kylvö (windowTargetMax oletus 5 → floor(0.9·6) = 5)');
ok('litWindows kylvettiin latauksessa (5)', T.litWindows.length === 5, T.litWindows.length);

console.log('\n2) NORMAL: tavoite 3 → shuffle/reset kylvävät 3');
T.windowTargetMax = 3;
T.litWindowsEmpty = true;
T.shuffleOrder();
ok('shuffleBuildingOrder kylvää heti (3)', T.litWindows.length === 3, T.litWindows.length);
T.litWindowsEmpty = true;
T.resetOrder();   // edellinen shuffle → palauttaa oletusasettelun ja kylvää
ok('resetBuildingOrder kylvää heti (3)', T.litWindows.length === 3, T.litWindows.length);

console.log('\n3) BAD: windowTargetMax arvotaan (0.9 → 2) ja valot syttyvät silti');
Street.setChaos('bad');
ok('BAD: windowTargetMax = 2', T.windowTargetMax === 2, T.windowTargetMax);
T.litWindowsEmpty = true;
T.shuffleOrder();   // BAD/FULL kutsuu tätä init():ssa
ok('BAD: shuffle kylvää ikkunavalot (2) – ennen v11.41 tämä oli 0', T.litWindows.length > 0, T.litWindows.length);

console.log(fail ? '\n=== TULOS: ' + fail + ' löydöstä ===' : '\n=== TULOS: 0 löydöstä ===');
process.exit(fail ? 1 : 0);
