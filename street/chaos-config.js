/* ═══════════════════════════════════════════════════════════
   street/chaos-config.js – kaaoskonfiguraatio ja -matematiikka
   (Vaihe 5, siirretty street.js:stä, PELKKÄ SIIRTO.)

   Sisältö: NORMAL/FULL-oletukset · deterministinen arvontageneraattori
   (?seed=) · K1-visuaaliset arvonta-apurit · chaosProfile ja
   generateFullChaosSeed · portti (clampChaosCfg + validateChaosCfg) ·
   drawChaosCfg.

   EI pelitilaa: ainoat ulkopuoliset tarpeet sidotaan bind()-kutsulla
   street.js:stä:
       WORLD_W        – klampin liikenteen ylityssääntö
       hungerMultFor  – kyvykkyysindeksi C (🍔-vaikutus)

   Ladataan ENNEN street.js:iä (index.html). Testipenkit liittävät
   samat osat samassa järjestyksessä: tools/tests/street-src.cjs.
   ═══════════════════════════════════════════════════════════ */
var StreetChaos = (function () {
const CHAOS_DEFAULTS = {
    windSpeedMult: 1, windDirFlip: false,
    trafficSpeedMult: 1, trafficSpawnMult: 1,
    dayCycleFrames: 10800, skyDir: 1,
    birdMin: 10, birdMax: 15,
    coinRespawnFrames: 7200,
    robberChance: 0.4, robberSpeed: 1.05, robberCooldown: 1500, robberTtl: 900
};
/* CHAOS_DEFAULTS2 = täysi superset: kaikki kaaosakselit NORMAL-arvoilla.
   NORMAL = nykyiset literaalit → peli pysyy bitti-identtisenä (pääsääntö 1). */
const CHAOS_DEFAULTS2 = Object.assign({}, CHAOS_DEFAULTS, {
    playerSpeedMult: 1,               // kävelynopeuskerroin (kaaos K4; klampi 0.6–1.6)
    avengerChance: 0.12, avengerSpeed: 1.0, avengerTelegraph: 21,
    avengerStun: 600, avengerFreeze: 180, avengerCooldown: 1800,
    robberStun: 900, robberChasesY: false, cabinetOnChance: 0.5,   // robberChasesY: rosvo jahtaa vapaasti y-akselilla (vain BAD)
    startBurgers: 5, startCoins: 2, hungerWakeGrace: 600, burgerInterval: 2400,
    fogAlpha: 0,
    cloudCount: 18, cloudOpacityMult: 1, cloudBandTop: 40, cloudBandH: 40,
    cloudSizeMult: 1, cloudCirrusShare: 0.35,
    starCount: 80, starSizeMult: 1,
    sunColor: null, sunGlow: null,     // null = nykyinen piirto (ei kaaosakselia vielä)
    animalSpeedMult: 1, animalDirBias: 0.5, animalTypeWeights: null,
    batSpawnFrames: 1800, birdSpeedMult: 1, beetleCount: 1,
    windowTargetMax: 5, windowDurMin: 10000, windowDurMax: 30000,
    lampHueShift: 0, threatWarnMult: 1,
    cloudDayAlpha: 5,                       // CLOUD_DAY_ALPHA (päivän pilvien peittävyys)
    daySkyTop: '#3f7fc0', daySkyMid: '#78b4e0', daySkyHorizon: '#ffd9a0',
    silhouetteChance: 0.5, winDayFill: '#151716',
    lampRadius: 30, batCountMax: 5, buildingPalette: null,
    moonShadowMax: 1,                       // kuunvarjojen kaaoskerroin: per talo ×1…max (BAD/FULL = 3)
    // K1/K6 – BAD-myrsky: paksut pilvet (aina) + sade + ukkonen satunnaisina purskeina.
    // NORMAL/MILD/GOOD/FULL: no-op (cloudThickMult 1, stormBurst false, rain 0, gapit 0).
    cloudThickMult: 1,                      // hazy-pilvien pystysädekerroin (1 = nykyinen)
    stormBurst: false,                      // BAD: sade + ukkonen päällä (purskeina)
    rainAmount: 0,                          // sateen voimakkuus (0 = ei sadetta)
    stormCalmMin: 0, stormCalmMax: 0,       // tyyni jakso (framet)
    stormBurstMin: 0, stormBurstMax: 0,     // myrskypurske (framet)
    thunderGapMin: 0, thunderGapMax: 0,     // salaman väli purskeen aikana (framet)
    // K2 (kellon rytmit) + K6 (SFX)
    dayFadeFrames: 1200, nightFadeFrames: 1200, cycleChangeDelayFrames: 900,
    nightLampFirst: 30, nightLampInterval: 18, spawnLampDelay: 240,
    cabBlinkMin: 420, cabBlinkMax: 700, cabRerollMin: 900, cabRerollMax: 2100,
    mosquitoDayDim: 1, meteorTempoMult: 1, sfxVolumeMult: 1,
    // Kaaos – uudet akselit (NORMAL = no-op)
    doorLockChance: 0, staggerAmount: 0, screenShakeAmount: 0,
    lampRedFlicker: 0, barBurntLetter: -1, cabFlicker: 0, sunSizeMult: 1
});

function makeRng(seed) {               // mulberry32 – sama siemen = sama peli
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const CHAOS_PARAMS = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
    ? new URLSearchParams(location.search) : null;
const CHAOS_SEED_PARAM = (CHAOS_PARAMS ? CHAOS_PARAMS.get('seed') : null);
const CHAOS_SEED = (CHAOS_SEED_PARAM !== null && /^\d+$/.test(CHAOS_SEED_PARAM))
    ? Number(CHAOS_SEED_PARAM) : null;
const CHAOS_DEBUG = !!(CHAOS_PARAMS && CHAOS_PARAMS.get('debug') !== null);
let chaosRng = (CHAOS_SEED !== null) ? makeRng(CHAOS_SEED) : Math.random;

function rnd(a, b) { return a + chaosRng() * (b - a); }
function rndInt(a, b) { return Math.round(rnd(a, b)); }

const WARM_PALETTE = [
    '#2a1a14', '#2a1e16', '#241a12', '#2a1616', '#241822',
    '#2a1c18', '#2a1a1c', '#221a20', '#2a1e14',
    '#241a18', '#26201a', '#2a1818', '#261a1e', '#281c12',
    '#2c1a16', '#221c1a', '#2a1a18', '#262016'
];
const NEAR_BLACK_PALETTE = [
    '#0a0a0c', '#0b0a0c', '#0a0b0a', '#0c0a0a', '#0a0a0e',
    '#0a0c0c', '#0b0b0a', '#0a0a0e', '#0c0b0a',
    '#0a0a0d', '#0a0b0b', '#0c0a0b', '#0a0a0f', '#0b0c0a',
    '#0c0a0c', '#0a0c0b', '#0b0a0e', '#0a0b0a'
];
const SUN_GLOW_DEFAULT = ['rgba(255,224,120,0.55)', 'rgba(255,210,100,0.20)', 'rgba(255,200,80,0)'];
/* hsl → #rrggbb. Miksi: korttien/talojen väriapurit (lightenHex, mixHex) ja
   piirto olettavat HEX-muotoa – aiemmin randomHuePalette palautti hsl(...)-merkkijonoja,
   jolloin parseInt('sl',16) = NaN → '#NaNNaNxx' = virheellinen fillStyle, jonka selain
   hylkää hiljaa (canvas jäi edelliseen väriin) → FULLissa talot/tausta "katosivat".
   Bugikorjaus: paletti tuottaa samat värit hex-muodossa. */
function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const to = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
    return '#' + to(f(0)) + to(f(8)) + to(f(4));
}
function randomHuePalette() {
    const arr = [];
    for (let i = 0; i < 18; i++) {
        const h = Math.floor(Math.random() * 360);
        const l = 8 + Math.floor(Math.random() * 8);
        arr.push(hslToHex(h, 20 + Math.floor(Math.random() * 30), l));
    }
    return arr;
}
function randomDarkSky() {
    const v = 40 + Math.floor(Math.random() * 120);
    const b = Math.min(255, v + Math.floor(Math.random() * 30));
    const hex = (x) => x.toString(16).padStart(2, '0');
    return '#' + hex(v) + hex(v) + hex(b);
}
function randomAnimalTypes() {
    const all = ['mouse', 'rat', 'rabbit'];
    const arr = [];
    for (let i = 0; i < 6; i++) arr.push(all[Math.floor(Math.random() * all.length)]);
    return arr;
}
function randomSunColor() {
    const pick = Math.floor(Math.random() * 3);
    if (pick === 0) return { sunColor: '#7dff7d', sunGlow: ['rgba(120,255,120,0.55)', 'rgba(90,220,90,0.20)', 'rgba(70,180,70,0)'] };
    if (pick === 1) return { sunColor: '#d37dff', sunGlow: ['rgba(200,140,255,0.55)', 'rgba(170,110,230,0.20)', 'rgba(140,90,190,0)'] };
    return { sunColor: '#ff4d4d', sunGlow: ['rgba(255,100,100,0.55)', 'rgba(220,80,80,0.20)', 'rgba(180,60,60,0)'] };
}

function generateFullChaosSeed() {
    const sun = randomSunColor();
    return {
        windSpeedMult: rnd(0.5, 3.5),
        windDirFlip: Math.random() < 0.5,
        trafficSpeedMult: rnd(0.6, 1.8),
        trafficSpawnMult: rnd(0.4, 1.8),
        dayCycleFrames: rndInt(4000, 22000),
        skyDir: Math.random() < 0.5 ? -1 : 1,
        birdMin: rndInt(0, 12),
        birdMax: rndInt(12, 30),
        coinRespawnFrames: rndInt(1800, 18000),
        robberChance: rnd(0.05, 0.9),
        robberSpeed: rnd(0.7, 2.0),
        robberCooldown: rndInt(300, 3000),
        robberTtl: rndInt(300, 2000),
        // K3 (uhka) + K4 (keho/reppu). Kaikki kulkee portin läpi.
        // hidastus poistettu (tylsä) → vain normaali/nopeampi; hoipertelu korvaa sen.
        playerSpeedMult: rnd(1.0, 1.6),
        avengerChance: rnd(0, 0.6),
        avengerSpeed: rnd(0.5, 1.4),
        avengerTelegraph: rndInt(12, 45),
        avengerFreeze: rndInt(0, 300),
        avengerCooldown: rndInt(600, 6000),
        avengerStun: rndInt(150, 600),
        robberStun: rndInt(150, 900),
        cabinetOnChance: rnd(0, 0.9),
        // aloituskolikot KIINTEÄT = sama kuin NO CHAOS (CHAOS_DEFAULTS2.startCoins = 2).
        // Ennen rndInt(1, 100) → kolikkoja oli alussa liikaa, eikä meteoriittien
        // ampumiselle ollut motivaatiota. Muut kaaosakselit ennallaan.
        startCoins: CHAOS_DEFAULTS2.startCoins,
        startBurgers: rndInt(2, 10),
        hungerWakeGrace: rndInt(600, 1800),
        burgerInterval: 2400,   // FULLin kulutustahti KIINTEÄ 40 s (oli rndInt(1200,12000)
                                //   = jopa ~200 s / taso → vaikutti siltä, ettei 🍺/🍔 kulu lainkaan)
        // K1 – visuaalinen
        cloudCount: rndInt(4, 34),
        cloudOpacityMult: rnd(0.6, 2.5),
        cloudSizeMult: rnd(0.6, 2.5),
        cloudBandTop: rndInt(10, 100), cloudBandH: rndInt(10, 100),
        cloudCirrusShare: rnd(0, 1),
        cloudDayAlpha: rndInt(1, 10),
        daySkyTop: randomDarkSky(), daySkyMid: randomDarkSky(), daySkyHorizon: randomDarkSky(),
        starCount: rndInt(0, 140), starSizeMult: rnd(0.5, 2),
        sunColor: sun.sunColor, sunGlow: sun.sunGlow,
        silhouetteChance: rnd(0.05, 0.95),
        winDayFill: randomDarkSky(),
        lampRadius: rndInt(20, 60),
        lampHueShift: rndInt(0, 360),
        animalSpeedMult: rnd(0.4, 2.5),
        animalDirBias: rnd(0.1, 0.9),
        animalTypeWeights: randomAnimalTypes(),
        batSpawnFrames: rndInt(600, 3600),
        batCountMax: rndInt(0, 12),
        birdSpeedMult: rnd(0.6, 1.8),
        beetleCount: rndInt(0, 4),
        windowTargetMax: rndInt(0, 12),
        windowDurMin: rndInt(3000, 60000), windowDurMax: rndInt(60000, 300000),
        buildingPalette: randomHuePalette(),
        // K2 + K6
        dayFadeFrames: rndInt(300, 3000), nightFadeFrames: rndInt(300, 3000),
        cycleChangeDelayFrames: rndInt(120, 1800),
        nightLampFirst: rndInt(4, 90), nightLampInterval: rndInt(2, 60), spawnLampDelay: rndInt(0, 900),
        cabBlinkMin: rndInt(120, 600), cabBlinkMax: rndInt(600, 1200),
        cabRerollMin: rndInt(300, 1800), cabRerollMax: rndInt(1800, 3600),
        mosquitoDayDim: (Math.random() < 0.5 ? 0 : 1),
        meteorTempoMult: rnd(0.1, 5), sfxVolumeMult: rnd(0.5, 1.5),
        // Kaaos – uudet akselit. Ikävät (oviukko/hoipertelu/tärinä) arvotaan:
        // FULL voi saada ne tai olla ilman; BAD saa ne aina chaosProfile():ssa.
        doorLockChance: rnd(0, 0.6),
        staggerAmount: rnd(0, 1.0),
        screenShakeAmount: rnd(0, 0.5),
        lampRedFlicker: rnd(0, 0.03),
        barBurntLetter: rndInt(-1, 2),
        cabFlicker: rnd(0, 1),
        sunSizeMult: rnd(0.6, 2.0),
        // Kuunvarjot: BAD/FULL → jokainen talo ×1…3 (arpa per talo, kerran per yö)
        moonShadowMax: 3
    };
}

function chaosProfile(level) {
    switch (level) {
        case 'mild':
            return {
                windSpeedMult: rnd(0.8, 1.3), windDirFlip: false,
                trafficSpeedMult: rnd(0.85, 1.2), trafficSpawnMult: rnd(0.85, 1.2),
                dayCycleFrames: rndInt(7000, 16000), skyDir: 1,
                birdMin: rndInt(7, 13), birdMax: rndInt(13, 20),
                coinRespawnFrames: rndInt(4800, 9600),
                robberChance: rnd(0.25, 0.55), robberSpeed: rnd(0.9, 1.25),
                robberCooldown: rndInt(1000, 2000), robberTtl: rndInt(700, 1200),
                // K3 + K4: ei hidastusta (vain normaali/nopeampi)
                playerSpeedMult: rnd(1.0, 1.1),
                avengerChance: rnd(0.08, 0.16), avengerSpeed: rnd(0.9, 1.1),
                avengerTelegraph: rndInt(19, 23), avengerFreeze: rndInt(150, 210),
                avengerCooldown: rndInt(1400, 2200), avengerStun: rndInt(540, 660),
                robberStun: rndInt(810, 900), cabinetOnChance: rnd(0.4, 0.6),
                startBurgers: rndInt(4, 6), burgerInterval: rndInt(1800, 3600),
                hungerWakeGrace: rndInt(600, 900),
                cloudCount: rndInt(18, 26), cloudOpacityMult: 1.2, cloudSizeMult: 1.2,
                cloudBandTop: 40, cloudBandH: 40, cloudCirrusShare: 0.35, cloudDayAlpha: 5,
                starCount: rndInt(60, 100), starSizeMult: 1,
                sunColor: null, sunGlow: null,
                silhouetteChance: 0.3, winDayFill: '#151716',
                lampRadius: 30, lampHueShift: 0,
                animalSpeedMult: 1, animalDirBias: 0.5, animalTypeWeights: null,
                batSpawnFrames: 1800, batCountMax: 5,
                birdSpeedMult: 1, beetleCount: 1,
                windowTargetMax: rndInt(3, 6), windowDurMin: 10000, windowDurMax: 30000,
                buildingPalette: null,
                dayFadeFrames: 1200, nightFadeFrames: 1200, cycleChangeDelayFrames: 900,
                nightLampFirst: rndInt(21, 39), nightLampInterval: rndInt(13, 23), spawnLampDelay: 240,
                cabBlinkMin: 420, cabBlinkMax: 700, cabRerollMin: 900, cabRerollMax: 2100,
                mosquitoDayDim: 1, meteorTempoMult: 0.8, sfxVolumeMult: rnd(0.9, 1.1),
                // Kaaos – MILD: ei ikäviä (oviukko/hoipertelu/tärinä = 0), vain hennot neutraalit efektit
                doorLockChance: 0, staggerAmount: 0, screenShakeAmount: 0,
                lampRedFlicker: rnd(0.0008, 0.002), barBurntLetter: -1,
                cabFlicker: rnd(0.1, 0.25), sunSizeMult: rnd(1.0, 1.1)
            };
        case 'good':
            return {
                windSpeedMult: 0.6, windDirFlip: false,
                trafficSpeedMult: 0.85, trafficSpawnMult: 1.5,
                dayCycleFrames: 14400, skyDir: 1,
                birdMin: 14, birdMax: 22,
                coinRespawnFrames: 3600,
                robberChance: 0.12, robberSpeed: 0.8, robberCooldown: 2500, robberTtl: 600,
                // K3 + K4
                playerSpeedMult: 1.0,
                avengerChance: rnd(0.02, 0.06), avengerSpeed: rnd(0.6, 0.8),
                avengerTelegraph: rndInt(26, 40), avengerFreeze: rndInt(240, 300),
                avengerCooldown: rndInt(3000, 5000), cabinetOnChance: rnd(0.10, 0.25),
                startBurgers: rndInt(6, 10), burgerInterval: rndInt(3000, 4800),
                hungerWakeGrace: rndInt(900, 1800),
                cloudCount: rndInt(8, 12), cloudOpacityMult: 0.8, cloudSizeMult: 0.8,
                cloudBandTop: 20, cloudBandH: 40, cloudCirrusShare: 0.5, cloudDayAlpha: 3,
                daySkyTop: '#4a90c8', daySkyMid: '#8ec4e8', daySkyHorizon: '#ffe9b8',
                starCount: rndInt(120, 140), starSizeMult: 1.2,
                sunColor: null, sunGlow: null,
                silhouetteChance: 0.05, winDayFill: '#2a2e2c',
                lampRadius: 34, lampHueShift: 35,
                animalSpeedMult: 1.2, animalDirBias: 0.5,
                animalTypeWeights: ['mouse', 'rabbit', 'rabbit', 'rabbit', 'rat'],
                batSpawnFrames: 1800, batCountMax: 3,
                birdSpeedMult: 1.2, beetleCount: 1,
                windowTargetMax: rndInt(5, 8), windowDurMin: 20000, windowDurMax: 60000,
                buildingPalette: WARM_PALETTE,
                dayFadeFrames: rndInt(1800, 2600), nightFadeFrames: rndInt(1800, 2600), cycleChangeDelayFrames: rndInt(1500, 2400),
                nightLampFirst: 45, nightLampInterval: 28, spawnLampDelay: 300,
                cabBlinkMin: 300, cabBlinkMax: 800, cabRerollMin: 1800, cabRerollMax: 3600,
                mosquitoDayDim: 1, meteorTempoMult: 1.5, sfxVolumeMult: rnd(0.7, 0.85),
                // Kaaos – GOOD: ei ikäviä, vain hennot neutraalit efektit
                doorLockChance: 0, staggerAmount: 0, screenShakeAmount: 0,
                lampRedFlicker: rnd(0.0008, 0.002), barBurntLetter: -1,
                cabFlicker: rnd(0.1, 0.2), sunSizeMult: rnd(1.0, 1.15)
            };
        case 'bad':
            return {
                windSpeedMult: rnd(2.0, 3.5), windDirFlip: true,
                trafficSpeedMult: 1.45, trafficSpawnMult: 0.55,
                dayCycleFrames: 5400, skyDir: -1,
                birdMin: 0, birdMax: 4,
                coinRespawnFrames: 14400,
                // Rosvo jahtaa vapaasti (robberChasesY) → ei saa ilmestyä useammin kuin 30 s välein (1800 f)
                robberChance: 0.75, robberSpeed: 1.5, robberCooldown: 1800, robberTtl: 1400,
                robberChasesY: true,
                // K3 + K4: ei hidastusta (hoipertelu korvaa sen)
                playerSpeedMult: 1.0,
                avengerChance: rnd(0.30, 0.50), avengerSpeed: rnd(1.2, 1.4),
                avengerTelegraph: rndInt(12, 21), avengerFreeze: rndInt(60, 180),
                avengerCooldown: rndInt(600, 1200), cabinetOnChance: rnd(0.70, 0.90),
                /* + (parametri, ei versionnostoa): BAD = katsojamoodi –
                   maailmanloppu katsotaan, ei pelata → kiinteä syntymäpaketti
                   100 🪙 + 10 🍔 (klampit sallivat tasan nämä). Arvot luetaan
                   init():n freshGame-portissa → uusi peli / hard reset
                   (kuolema, ✕ "aloita alusta"); F5-soft reset ei nollaa
                   (session + tallennettu saldo voittaa). Vanha 🍔-arpa jää
                   paikoilleen mutta sen tulos ohitetaan, jotta BADin MUUT
                   arvat eivät siirry (arvontajärjestys = 0 eroa). */
                startCoins: 100, startBurgers: (rndInt(2, 3), 10),
                burgerInterval: rndInt(1200, 2400),
                hungerWakeGrace: 600,
                cloudCount: rndInt(28, 34), cloudOpacityMult: 2.0, cloudSizeMult: 1.4,
                cloudBandTop: 10, cloudBandH: 70, cloudCirrusShare: 0.15, cloudDayAlpha: 9,
                daySkyTop: '#3a4044', daySkyMid: '#565e62', daySkyHorizon: '#6e6a5e',
                starCount: rndInt(15, 30), starSizeMult: 0.8,
                sunColor: '#c22f2f', sunGlow: ['rgba(200,60,60,0.45)', 'rgba(170,40,40,0.16)', 'rgba(140,30,30,0)'],
                silhouetteChance: 0.9, winDayFill: '#0c0d0c',
                lampRadius: 26, lampHueShift: 190,
                animalSpeedMult: 0.8, animalDirBias: 0.5,
                animalTypeWeights: ['rat', 'rat', 'rat'],
                batSpawnFrames: 600, batCountMax: 12,
                birdSpeedMult: 0.8, beetleCount: 1,
                windowTargetMax: rndInt(0, 2), windowDurMin: 3000, windowDurMax: 10000,
                buildingPalette: NEAR_BLACK_PALETTE,
                dayFadeFrames: rndInt(400, 700), nightFadeFrames: rndInt(400, 700), cycleChangeDelayFrames: rndInt(200, 450),
                nightLampFirst: 8, nightLampInterval: 4, spawnLampDelay: 60,
                cabBlinkMin: 200, cabBlinkMax: 400, cabRerollMin: 500, cabRerollMax: 900,
                mosquitoDayDim: 0, meteorTempoMult: 0.15, sfxVolumeMult: rnd(1.15, 1.35),   // 0.3 -> 0.15 (tiheämpi tahti)
                // Kaaos – BAD: ikävät päällä (lukitut ovet, hoipertelu, tärinä) + neutraalit rajummin
                doorLockChance: rnd(0.4, 0.6),
                staggerAmount: rnd(0.5, 1.0),
                screenShakeAmount: rnd(0.25, 0.5),
                lampRedFlicker: rnd(0.006, 0.02),
                barBurntLetter: rndInt(0, 2),
                cabFlicker: rnd(0.5, 0.8),
                sunSizeMult: rnd(1.6, 2.0),
                moonShadowMax: 3,
                // K1/K6 – BAD-myrsky: paksut pilvet (aina) + sade + ukkonen purskeina.
                // Tyyni 60–180 s · purske 60–180 s · salama 3–8 s välein purskeen aikana.
                cloudThickMult: 2.5,
                stormBurst: true,
                rainAmount: 1,
                stormCalmMin: 3600, stormCalmMax: 10800,
                stormBurstMin: 3600, stormBurstMax: 10800,
                thunderGapMin: 180, thunderGapMax: 480
            };
        case 'full':
            return generateFullChaosSeed();
        default:
            return Object.assign({}, CHAOS_DEFAULTS);
    }
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

function chaosAbilityFor(cfg) {
    return (cfg.playerSpeedMult || 1) * hungerMultFor(cfg.startBurgers);
}

function stunMaxOf(cfg)   { return Math.max(cfg.avengerStun, cfg.robberStun); }

const BURGER_INTERVAL_FLOOR = 1200;                 // kova lattia
function burgerIntervalMin(cfg, C) {
    return Math.max(BURGER_INTERVAL_FLOOR, Math.ceil(stunMaxOf(cfg) + 885 / (1.225 * C)));
}

function threatSpeedMax(C)     { return 1.4 * C; }
function threatTelegraphMin(C) { return Math.max(12, Math.ceil(21 / C)); }
function threatBudget(cfg) {                        // montako uhka-akselia ääripäässä (max 3)
    const ext = (v, lo, hi) => (v <= lo + (hi - lo) * 0.1 || v >= hi - (hi - lo) * 0.1) ? 1 : 0;
    return ext(cfg.avengerChance, 0, 0.6) + ext(cfg.avengerSpeed, 0.5, 1.4)
         + ext(cfg.robberChance, 0, 0.9) + ext(cfg.robberSpeed, 0.7, 2.0)
         + ext(cfg.trafficSpeedMult, 0.6, 1.6) + ext(cfg.trafficSpawnMult, 0.5, 2.5);
}

function clampChaosCfg(cfg) {
    const C = chaosAbilityFor(cfg);
    const c = Object.assign({}, cfg);
    c.playerSpeedMult  = clamp(c.playerSpeedMult, 1.0, 1.6);   // kävelynopeus (K4): ei hidastusta
    c.cloudCount       = clamp(c.cloudCount, 4, 34);
    c.cloudOpacityMult = clamp(c.cloudOpacityMult, 0.4, 2.5);
    c.windSpeedMult    = clamp(c.windSpeedMult, 0.4, 3.5);
    c.starCount        = clamp(c.starCount, 0, 140);
    c.avengerChance    = clamp(c.avengerChance, 0, 0.6);
    c.avengerSpeed     = clamp(c.avengerSpeed, 0.5, threatSpeedMax(C));
    c.avengerTelegraph = clamp(c.avengerTelegraph, threatTelegraphMin(C), 45);
    c.avengerFreeze    = clamp(c.avengerFreeze, 0, 300);       // BAD ≤ 180 (kiristetään tasoissa)
    c.avengerCooldown  = clamp(c.avengerCooldown, 600, 6000);
    c.avengerStun      = clamp(c.avengerStun, 150, 600);      // ei koskaan pidempi kuin nyt
    c.robberStun       = clamp(c.robberStun, 150, 900);
    c.robberSpeed      = clamp(c.robberSpeed, 0.7, threatSpeedMax(C));
    // Liikenteen ylityssääntö (K3): hitainkin pelaaja ehtii kadun yli.
    // ylitys 67 px @ 1.225·C · nopein auto 3.0 (ambulanssi) · 40 % turvamarginaali.
    const crossMax = 0.6 * (WORLD_W + 80) / (3.0 * (67 / (1.225 * C)));
    c.trafficSpeedMult = clamp(c.trafficSpeedMult, 0.6, Math.min(1.6, crossMax));
    c.trafficSpawnMult = clamp(c.trafficSpawnMult, 0.5, 2.5);
    c.cabinetOnChance  = clamp(c.cabinetOnChance, 0, 0.9);     // sähkökaappi päällä
    c.startBurgers     = clamp(c.startBurgers, 2, 10);        // ehdoton
    c.startCoins       = clamp(c.startCoins, 1, 100);
    c.hungerWakeGrace  = clamp(c.hungerWakeGrace, 600, 1800);
    c.burgerInterval   = Math.max(c.burgerInterval, burgerIntervalMin(c, C));  // 🍔-tahti
    c.fogAlpha         = clamp(c.fogAlpha, 0, 0.5);
    // K2 (kellon rytmit) + K6 (SFX)
    c.dayFadeFrames    = clamp(c.dayFadeFrames, 300, 3000);
    c.nightFadeFrames  = clamp(c.nightFadeFrames, 300, 3000);
    c.cycleChangeDelayFrames = clamp(c.cycleChangeDelayFrames, 120, 1800);
    c.nightLampFirst   = clamp(c.nightLampFirst, 4, 90);
    c.nightLampInterval = clamp(c.nightLampInterval, 2, 60);
    c.spawnLampDelay   = clamp(c.spawnLampDelay, 0, 900);
    c.cabBlinkMin      = clamp(c.cabBlinkMin, 120, 1200);
    c.cabBlinkMax      = Math.max(clamp(c.cabBlinkMax, 120, 1200), c.cabBlinkMin + 50);
    c.cabRerollMin     = clamp(c.cabRerollMin, 300, 3600);
    c.cabRerollMax     = Math.max(clamp(c.cabRerollMax, 300, 3600), c.cabRerollMin + 50);
    c.mosquitoDayDim   = clamp(c.mosquitoDayDim, 0, 1);
    c.meteorTempoMult  = clamp(c.meteorTempoMult, 0.1, 5);
    c.sfxVolumeMult    = clamp(c.sfxVolumeMult, 0.3, 2.0);
    // Kaaos – uudet akselit (visuaaliset/ei-tappavat → vain klampit, ei validointia)
    c.doorLockChance   = clamp(c.doorLockChance, 0, 1);
    c.staggerAmount    = clamp(c.staggerAmount, 0, 1);
    c.screenShakeAmount= clamp(c.screenShakeAmount, 0, 1);
    c.lampRedFlicker   = clamp(c.lampRedFlicker, 0, 0.05);
    c.barBurntLetter   = clamp(Math.round(c.barBurntLetter), -1, 2);
    c.cabFlicker       = clamp(c.cabFlicker, 0, 1);
    c.sunSizeMult      = clamp(c.sunSizeMult, 0.6, 2.0);
    c.moonShadowMax    = clamp(c.moonShadowMax, 1, 3);
    // K1/K6 – BAD-myrsky (visuaalinen + ääni → vain klampit, ei validointia)
    c.cloudThickMult   = clamp(c.cloudThickMult, 1, 4);
    c.rainAmount       = clamp(c.rainAmount, 0, 2);
    c.stormCalmMin     = clamp(c.stormCalmMin, 0, 10800);
    c.stormCalmMax     = Math.max(clamp(c.stormCalmMax, 0, 10800), c.stormCalmMin);
    c.stormBurstMin    = clamp(c.stormBurstMin, 0, 10800);
    c.stormBurstMax    = Math.max(clamp(c.stormBurstMax, 0, 10800), c.stormBurstMin);
    c.thunderGapMin    = clamp(c.thunderGapMin, 0, 1800);
    c.thunderGapMax    = Math.max(clamp(c.thunderGapMax, 0, 1800), c.thunderGapMin);
    return c;
}

function validateChaosCfg(cfg) {
    const C = chaosAbilityFor(cfg), errs = [];
    if (cfg.burgerInterval < burgerIntervalMin(cfg, C))     errs.push('burgerInterval < kaava');
    if (cfg.avengerSpeed > threatSpeedMax(C))               errs.push('avenger liian nopea');
    if (cfg.robberSpeed  > threatSpeedMax(C))               errs.push('robber liian nopea');
    if (cfg.avengerTelegraph < threatTelegraphMin(C))       errs.push('varoitus liian lyhyt');
    if (stunMaxOf(cfg) > 900)                               errs.push('tainnutus raja');
    if (cfg.startBurgers < 2 || cfg.startBurgers > 10)      errs.push('aloitus🍔 raja');
    if (threatBudget(cfg) > 3)                              errs.push('uhkabudjetti');
    if (cfg.fogAlpha > 0.5)                                 errs.push('sumu liian sakea');
    return errs;
}

function drawChaosCfg(level) {
    if (level !== 'full') {
        return clampChaosCfg(Object.assign({}, CHAOS_DEFAULTS2, chaosProfile(level)));
    }
    for (let i = 0; i < 40; i++) {
        const cfg = clampChaosCfg(Object.assign({}, CHAOS_DEFAULTS2, generateFullChaosSeed()));
        if (validateChaosCfg(cfg).length === 0) return cfg;
    }
    console.warn('[chaos] arpa hylättiin 40× – käytetään klampattua arpaa');
    return clampChaosCfg(Object.assign({}, CHAOS_DEFAULTS2, generateFullChaosSeed()));
}
    /* ── Sidottavat ulkopuoliset (street.js asettaa nämä init-aikana) ── */
    let WORLD_W = 800;
    let hungerMultFor = function () { return 1; };
    function bind(globals) {
        if (globals && typeof globals.WORLD_W === 'number') WORLD_W = globals.WORLD_W;
        if (globals && typeof globals.hungerMultFor === 'function') hungerMultFor = globals.hungerMultFor;
    }

    return {
        bind: bind,
        CHAOS_DEFAULTS: CHAOS_DEFAULTS, CHAOS_DEFAULTS2: CHAOS_DEFAULTS2,
        CHAOS_PARAMS: CHAOS_PARAMS, CHAOS_SEED: CHAOS_SEED, CHAOS_DEBUG: CHAOS_DEBUG,
        makeRng: makeRng, chaosRng: chaosRng, rnd: rnd, rndInt: rndInt,
        WARM_PALETTE: WARM_PALETTE, NEAR_BLACK_PALETTE: NEAR_BLACK_PALETTE,
        SUN_GLOW_DEFAULT: SUN_GLOW_DEFAULT,
        randomHuePalette: randomHuePalette, randomDarkSky: randomDarkSky,
        randomAnimalTypes: randomAnimalTypes, randomSunColor: randomSunColor,
        generateFullChaosSeed: generateFullChaosSeed, chaosProfile: chaosProfile,
        clamp: clamp, chaosAbilityFor: chaosAbilityFor, stunMaxOf: stunMaxOf,
        burgerIntervalMin: burgerIntervalMin, threatSpeedMax: threatSpeedMax,
        threatTelegraphMin: threatTelegraphMin, threatBudget: threatBudget,
        clampChaosCfg: clampChaosCfg, validateChaosCfg: validateChaosCfg,
        drawChaosCfg: drawChaosCfg
    };
})();
