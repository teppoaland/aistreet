// Verify NORMAL produces NO chaos values (all defaults) – v10.03
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = 'd:/AI/AI_street';

function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({ createRadialGradient: () => grad, createLinearGradient: () => grad },
    { get(t, k) { if (k in t) return t[k]; return () => {}; }, set() { return true; } });
}
const ctxStub = makeCtx();
function makeEl() {
  return new Proxy({ addEventListener: () => {}, removeEventListener: () => {}, classList: { add(){}, remove(){}, toggle(){}, contains: () => false }, style: {}, getContext: () => ctxStub, getBoundingClientRect: () => ({left:0,top:0,width:800,height:400}), focus(){}, blur(){} },
    { get(t,k){ if(k in t) return t[k]; return () => null; }, set(){ return true; } });
}
const canvasStub = new Proxy({}, { get(t,k){ if(k==='getContext') return () => ctxStub; if(k==='style') return {}; return 800; }, set(){ return true; } });
const store = {};
const sandbox = {
  console, Math, Date, JSON,
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k,v)=>{store[k]=String(v);}, removeItem: k=>{delete store[k];} },
  document: new Proxy({ getElementById: () => makeEl(), querySelector: () => null, querySelectorAll: () => [], createElement: () => makeEl(), addEventListener: () => {}, removeEventListener: () => {}, body: { appendChild(){} } },
    { get(t,k){ if(k in t) return t[k]; return () => null; }, set(){ return true; } }),
  window: { addEventListener(){}, removeEventListener(){}, parent: { postMessage(){} }, innerWidth: 800, innerHeight: 400 },
  location: { search: '?debug' },
  navigator: { userAgent: 'node', maxTouchPoints: 0 },
  URLSearchParams,
  Image: function(){}, Uint8ClampedArray,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sandbox.StreetAudio = new Proxy({}, { get(t,k){ if(k==='isJukeboxPlaying') return () => false; if(k==='playJukeboxQueue') return () => false; if(k==='getJukeboxQueuePos') return () => 0; return () => {}; } });

// capture console.table(chaosCfg)
let capturedCfg = null;
sandbox.console = {
  ...console,
  table: (obj) => { capturedCfg = obj; },
  log: () => {},
  warn: console.warn, error: console.error,
};

vm.runInContext(fs.readFileSync(path.join(root,'gameState.js'),'utf8'), sandbox);
vm.runInContext(require('./street-src.cjs'), sandbox);
const Street = vm.runInContext('Street', sandbox);

Street.setChaos('normal');

const expected = {
  windSpeedMult: 1, windDirFlip: false, trafficSpeedMult: 1, trafficSpawnMult: 1,
  dayCycleFrames: 10800, skyDir: 1, birdMin: 10, birdMax: 15, coinRespawnFrames: 7200,
  robberChance: 0.4, robberSpeed: 1.05, robberCooldown: 1500, robberTtl: 900,
  playerSpeedMult: 1, avengerChance: 0.12, avengerSpeed: 1.0, avengerTelegraph: 21,
  avengerStun: 600, avengerFreeze: 180, avengerCooldown: 1800, robberStun: 900,
  startBurgers: 5, startCoins: 2, hungerWakeGrace: 600, burgerInterval: 2400, fogAlpha: 0,
  cloudCount: 18, cloudOpacityMult: 1, cloudBandTop: 40, cloudBandH: 40,
  cloudSizeMult: 1, cloudCirrusShare: 0.35, cloudDayAlpha: 5,
  daySkyTop: '#3f7fc0', daySkyMid: '#78b4e0', daySkyHorizon: '#ffd9a0',
  starCount: 80, starSizeMult: 1, sunColor: null, sunGlow: null,
  animalSpeedMult: 1, animalDirBias: 0.5, animalTypeWeights: null,
  batSpawnFrames: 1800, birdSpeedMult: 1, beetleCount: 1,
  windowTargetMax: 5, windowDurMin: 10000, windowDurMax: 30000,
  lampHueShift: 0, threatWarnMult: 1,
  silhouetteChance: 0.5, winDayFill: '#151716', lampRadius: 30, batCountMax: 5, buildingPalette: null,
  moonShadowMax: 1,
  cloudThickMult: 2.5, stormBurst: true, rainAmount: 1,
  stormCalmMin: 3600, stormCalmMax: 10800, stormBurstMin: 3600, stormBurstMax: 10800,
  thunderGapMin: 300, thunderGapMax: 900,
  robberChasesY: false, cabinetOnChance: 0.5,
  dayFadeFrames: 1200, nightFadeFrames: 1200, cycleChangeDelayFrames: 900,
  nightLampFirst: 30, nightLampInterval: 18, spawnLampDelay: 240,
  cabBlinkMin: 420, cabBlinkMax: 700, cabRerollMin: 900, cabRerollMax: 2100,
  mosquitoDayDim: 1, meteorTempoMult: 1, sfxVolumeMult: 1,
  doorLockChance: 0, staggerAmount: 0, screenShakeAmount: 0, lampRedFlicker: 0,
  barBurntLetter: -1, cabFlicker: 0, sunSizeMult: 1,
};

if (!capturedCfg) { console.error('FAIL: chaosCfg not captured'); process.exit(1); }

let diff = 0;
for (const [k, v] of Object.entries(expected)) {
  const got = capturedCfg[k];
  if (JSON.stringify(got) !== JSON.stringify(v)) {
    diff++;
    console.log('  MISMATCH ' + k + ': expected ' + JSON.stringify(v) + ' got ' + JSON.stringify(got));
  }
}
// also check for any extra keys that shouldn't exist
for (const k of Object.keys(capturedCfg)) {
  if (!(k in expected)) { diff++; console.log('  UNEXPECTED KEY: ' + k + ' = ' + JSON.stringify(capturedCfg[k])); }
}
console.log(diff === 0 ? 'NORMAL CLEAN: all chaos values at defaults (' + Object.keys(capturedCfg).length + ' keys, 0 diffs)' : 'NORMAL DIRTY: ' + diff + ' diffs');
process.exit(diff ? 1 : 0);
