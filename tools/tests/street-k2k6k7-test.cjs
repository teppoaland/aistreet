// Headless-testi: K2 + K6 + K7 (v10.05) – ladataan street.js vm:ssä ja
// validoidaan portti (clamp + validate) kaikilla tasoilla + NORMAL-identiteetti.
const fs = require('fs');
const vm = require('vm');

let src = require('./street-src.cjs');

// Paljasta sisäiset kaaosfunktiot testiä varten (ei vaikuta tuotantoon).
/* Koukku-injektio: export-rivi on kasvanut v11.x:n aikana → pidetään sama
   muoto kuin muissa penkeissä (kaikki julkiset funktiot + __test). */
const API = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };';
const before = API;
/* Vaihe 5 (v11.38) osa 5: korttidefit muuttivat street/chaos-cards.js-moduuliin
   (StreetChaosCards). Injektio ottaa ne moduulin rajapinnasta, joten penkin
   oma logiikka (T.chaosCardDefs) pysyy ennallaan. */
const after = API.replace(' };', ', __test: { clampChaosCfg, validateChaosCfg, chaosProfile, generateFullChaosSeed, chaosAbilityFor, CHAOS_DEFAULTS2, drawChaosCfg, chaosCardDefs: StreetChaosCards.defs } };');
if (!src.includes(before)) { console.error('FATAL: return-lause ei löytynyt'); process.exit(1); }
src = src.replace(before, after);

// Ympäristö-stubit (moduulilataus tarvitsee vain location + URLSearchParams).
const sandbox = {
  console,
  Math,
  Date,
  JSON,
  URLSearchParams,
  location: { search: '' },
  document: {
    addEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ getContext: () => null, style: {}, classList: { add: () => {}, remove: () => {} } })
  },
  window: { addEventListener: () => {} },
  navigator: { maxTouchPoints: 0 },
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  StreetAudio: { init: () => {}, start: () => {}, stop: () => {}, playDeathGong: () => {}, getCtx: () => null, getDestination: () => null, playJukebox: () => {}, playJukeboxQueue: () => {}, appendJukeboxQueue: () => {}, stopJukebox: () => {}, isJukeboxPlaying: () => false, getJukeboxQueuePos: () => 0, setHungerTempo: () => {} },
  GameState: { STORAGE_KEY: 'x', defaultState: { inventory: { coin: false, coinCount: 0, hamburgerCount: 5 }, litLamps: [false,false,false,false,false], isDay: null }, load: () => ({}), save: () => {}, reset: () => {} },
  setTimeout, clearTimeout, setInterval, clearInterval
};
sandbox.globalThis = sandbox;

try {
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'street.js' });
} catch (e) {
  console.error('FATAL: IIFE-lataus epäonnistui:', e && e.stack || e);
  process.exit(1);
}

const Street = vm.runInContext('Street', sandbox);
const T = Street && Street.__test;
if (!T) { console.error('FATAL: __test ei paljastunut'); process.exit(1); }

function fail(msg) { console.error('FAIL:', msg); process.exitCode = 1; }

// 1) NORMAL = CHAOS_DEFAULTS2 (pääsääntö 1: bitti-identtinen)
const normal = T.drawChaosCfg('normal');
const defaults = T.CHAOS_DEFAULTS2;
const newAxes = ['dayFadeFrames','nightFadeFrames','cycleChangeDelayFrames','nightLampFirst','nightLampInterval','spawnLampDelay','cabBlinkMin','cabBlinkMax','cabRerollMin','cabRerollMax','mosquitoDayDim','meteorTempoMult','sfxVolumeMult'];
for (const k of newAxes) {
  if (normal[k] !== defaults[k]) fail(`NORMAL ${k} eroaa defaultista: ${normal[k]} != ${defaults[k]}`);
}
if (T.validateChaosCfg(normal).length !== 0) fail('NORMAL validoituu virheellisesti');
console.log('1) NORMAL = CHAOS_DEFAULTS2  OK');

// 2) Korttidekit: 10 korttia, kaikilla id + dur + apply + restore
const defs = T.chaosCardDefs();
if (defs.length !== 10) fail(`Kortteja ${defs.length} (odotettu 10)`);
for (const d of defs) {
  if (!d.id || !d.dur || typeof d.apply !== 'function' || typeof d.restore !== 'function') fail(`Kortti ${d.id} viallinen`);
}
console.log('2) Korttidekit =', defs.length, 'korttia  OK');

// 3) Jokainen taso: drawChaosCfg → validate = 0 virhettä
for (const lvl of ['normal','mild','good','bad']) {
  const cfg = T.drawChaosCfg(lvl);
  const errs = T.validateChaosCfg(cfg);
  if (errs.length) fail(`${lvl}: validate = [${errs.join(', ')}]`);
  // uudet akselit klampin sisällä
  for (const k of newAxes) { if (typeof cfg[k] !== 'number') fail(`${lvl}: ${k} puuttuu`); }
}
console.log('3) mild/good/bad validate 0 virhettä  OK');

// 4) FULL: 2000 arpaa rejection sampling → 0 hylättyä
let fullReject = 0;
for (let i = 0; i < 2000; i++) {
  const cfg = T.drawChaosCfg('full');
  if (T.validateChaosCfg(cfg).length) fullReject++;
}
if (fullReject) fail(`FULL hylättyjä arpoja: ${fullReject}/2000`);
console.log('4) FULL 2000 arpaa → 0 hylättyä  OK');

// 5) Portin klampit uusille akseleille (ääriarvot eivät vuoda yli)
const clampCfg = T.clampChaosCfg(Object.assign({}, defaults, {
  dayFadeFrames: 1, nightFadeFrames: 99999, cycleChangeDelayFrames: 0,
  nightLampFirst: 0, nightLampInterval: 999, spawnLampDelay: 9999,
  cabBlinkMin: 0, cabBlinkMax: 0, cabRerollMin: 99999, cabRerollMax: -5,
  mosquitoDayDim: 99, meteorTempoMult: 0, sfxVolumeMult: 999
}));
const bounds = {
  dayFadeFrames: [300, 3000], nightFadeFrames: [300, 3000], cycleChangeDelayFrames: [120, 1800],
  nightLampFirst: [4, 90], nightLampInterval: [2, 60], spawnLampDelay: [0, 900],
  cabBlinkMin: [120, 1200], cabRerollMin: [300, 3600],
  mosquitoDayDim: [0, 1], meteorTempoMult: [0.1, 5], sfxVolumeMult: [0.3, 2.0]
};
for (const [k, [lo, hi]] of Object.entries(bounds)) {
  if (clampCfg[k] < lo || clampCfg[k] > hi) fail(`klampi ${k}: ${clampCfg[k]} ulkopuolella [${lo},${hi}]`);
}
if (clampCfg.cabBlinkMax < clampCfg.cabBlinkMin) fail('cabBlinkMax < cabBlinkMin');
if (clampCfg.cabRerollMax < clampCfg.cabRerollMin) fail('cabRerollMax < cabRerollMin');
console.log('5) Klampit ääriarvoilla  OK');

console.log('\n=== TULOS:', process.exitCode === undefined ? 0 : (process.exitCode || 0) === 0 ? 'OK – kaikki läpäisi' : 'VIRHEITÄ', '===');
