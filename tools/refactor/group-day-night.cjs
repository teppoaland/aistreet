/* ═══════════════════════════════════════════════════════════
   group-day-night.cjs – Vaihe 4 loppuun (v11.45): päivä/yö-tila
   yhdeksi olioksi (`dayNight`).

   Ennen: 15 irtamuuttujaa (~178 viittausta)
     isDay · dayT · moonX · moonNightClock · moonDark · moonSaveTimer ·
     sunX · sunDayClock · sunSaveTimer · cycleChangeTimer · dayLampsOff ·
     nightShowArmed · nightShowQueue · nightShowTimer · spawnLampTimer
   Jälkeen: `const dayNight = { … }` – sama semantiikka, tila yhdessä
   paikassa (nollaus/reset myöhemmin yhdestä paikasta).

   PELKKÄ RYHMITTELY: ei uusia mekaniikkoja. `state.isDay` (tallennettu
   pelitila) on ERI asia eikä sitä nimetä (lookbehind suojaa `.isDay`).

   Järjestys (tärkeä): (1) deklaraatiot korvataan merkeillä, (2) vasta
   sitten nimetään viittaukset – muuten myös olion kenttänimet nimettyisivät,
   (3) lopuksi merkit korvataan oliolla ja järjestysherkillä alkuarvoilla.

   Ajo:  node tools/refactor/group-day-night.cjs
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'street.js');

const raw = fs.readFileSync(SRC, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
let src = raw.split(/\r\n/).join('\n');          // vertailut LF:llä

/* ── 1) Deklaraatiot → merkit ─────────────────────────────────────── */
const DECLS = [
    ['obj', '    let isDay = false;             // tallennettu päivä/yö-tila (state.isDay)'],
    ['del', '    let dayT = 0;                          // 0 = yö … 1 = päivä (liukuva)'],
    ['cycle', '    let cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES + 1;  // > DELAY = "ei käynnissä" (v4.89)'],
    ['del', '    let dayLampsOff = false;'],
    ['armed', "    let nightShowArmed = (DAY_FORCE === 'night');  // laukeaa vain aidosta päivä→yö-siirtymästä"],
    ['del', '    let nightShowQueue = [];             // syttymättömien lamppujen indeksit'],
    ['del', '    let nightShowTimer = 0;              // frameä seuraavaan lamppuun'],
    ['del', '    let spawnLampTimer = 0;              // laskuri spawn-lamppushow\'lle'],
    ['moonsun',
        '    let moonX = MOON_X_MIN;                       // kuun nykyinen x (ks. update)\n' +
        '    let moonNightClock = 0;                       // yön kulku (framet) kuun rataa varten\n' +
        '    let moonDark = 0;                             // kuun laskusta johtuva pimeneminen\n' +
        '    let moonSaveTimer = 0;                        // tallennusvälin laskuri (v4.74)\n' +
        '    let sunX = SUN_X;                             // auringon nykyinen x (päivällä liukuu, v4.89)\n' +
        '    let sunDayClock = 0;                          // päivän kulku (framet) auringon rataa varten\n' +
        '    let sunSaveTimer = 0;                         // tallennusvälin laskuri (v4.89)']
];
const MARKERS = { obj: '/*@DNOBJ@*/', cycle: '/*@DNCYCLE@*/', armed: '/*@DNARMED@*/', moonsun: '/*@DNMOONSUN@*/' };
for (const [kind, text] of DECLS) {
    const n = src.split(text).length - 1;
    if (n !== 1) { console.error('Deklaraatiota ei löytynyt täsmälleen kerran (' + kind + ', ' + n + '): ' + text.slice(0, 60)); process.exit(1); }
    if (kind === 'del') src = src.split(text + '\n').join('');   // koko rivi pois
    else src = src.split(text).join(MARKERS[kind]);
}

/* ── 2) Viittaukset → dayNight.X (lookbehind: state.isDay säilyy) ─── */
const RENAMES = [
    ['isDay', 'dayNight.isDay'],
    ['dayT', 'dayNight.t'],
    ['moonX', 'dayNight.moonX'],
    ['moonNightClock', 'dayNight.moonNightClock'],
    ['moonDark', 'dayNight.moonDark'],
    ['moonSaveTimer', 'dayNight.moonSaveTimer'],
    ['sunX', 'dayNight.sunX'],
    ['sunDayClock', 'dayNight.sunDayClock'],
    ['sunSaveTimer', 'dayNight.sunSaveTimer'],
    ['cycleChangeTimer', 'dayNight.cycleChangeTimer'],
    ['dayLampsOff', 'dayNight.dayLampsOff'],
    ['nightShowArmed', 'dayNight.nightShowArmed'],
    ['nightShowQueue', 'dayNight.nightShowQueue'],
    ['nightShowTimer', 'dayNight.nightShowTimer'],
    ['spawnLampTimer', 'dayNight.spawnLampTimer']
];
for (const [name, to] of RENAMES) {
    const re = new RegExp('(?<![\\w.$])' + name + '\\b', 'g');
    const n = (src.match(re) || []).length;
    if (n === 0) { console.error('Viittauksia ei löytynyt: ' + name); process.exit(1); }
    src = src.replace(re, to);
    console.log('  ' + String(n).padStart(3) + ' × ' + name + '  →  ' + to);
}
/* Vahti: jokainen nimi on nyt siivottu (state.isDay on suojattu). */
for (const [name] of RENAMES) {
    const re = new RegExp('(?<![\\w.$])' + name + '\\b', 'g');
    const n = (src.match(re) || []).length;
    if (n !== 0) { console.error('JÄI SIIVOAMATTA: ' + name + ' × ' + n); process.exit(1); }
}
if ((src.match(/\bstate\.isDay\b/g) || []).length < 2) {
    console.error('state.isDay katosi – tallennettu päivä/yö-tila ei saa nimetä.'); process.exit(1);
}

/* ── 2b) Bind-rajapinnan AVAIMET säilyvät ennallaan ────────────────
   Moduulit lukevat `ENV.dayT` / `ENV.isDay` / `ENV.cycleChangeTimer`
   (street/rooms.js ym.), joten getterin NIMI ei saa muuttua – vain
   paluuarvo. Ilman tätä syntyy `get dayNight.t()` = syntaksivirhe. */
const KEYS = [
    ['get dayNight.t() { return dayNight.t; },', 'get dayT() { return dayNight.t; },'],
    ['get dayNight.isDay() { return dayNight.isDay; }, set dayNight.isDay(v) { dayNight.isDay = v; },',
     'get isDay() { return dayNight.isDay; }, set isDay(v) { dayNight.isDay = v; },'],
    ['get dayNight.cycleChangeTimer() { return dayNight.cycleChangeTimer; }, set dayNight.cycleChangeTimer(v) { dayNight.cycleChangeTimer = v; },',
     'get cycleChangeTimer() { return dayNight.cycleChangeTimer; }, set cycleChangeTimer(v) { dayNight.cycleChangeTimer = v; },']
];
for (const [bad, good] of KEYS) {
    if (src.split(bad).length - 1 < 1) { console.error('Bind-avainta ei löytynyt: ' + bad.slice(0, 50)); process.exit(1); }
    src = src.split(bad).join(good);
}
/* Kommenttien nimet takaisin luettavaan muotoon */
for (const [from, to] of [['dayNight.t:llä', 'dayT:llä'], ['dayNight.t:n', 'dayT:n'], ['dayNight.isDay:llä', 'isDay:llä'],
                           ['talonX − dayNight.moonX', 'talonX − moonX']]) {
    src = src.split(from).join(to);
}

/* ── 3) Merkit → olio + järjestysherkät alkuarvot ──────────────────── */
const OBJ = [
    '/* ── Päivä/yö-tila (Vaihe 4 loppuun, v11.45): yksi olio ────────────',
    '   Aiemmin 15 irtamuuttujaa (~178 viittausta): isDay, dayT, moonX,',
    '   moonNightClock, moonDark, moonSaveTimer, sunX, sunDayClock,',
    '   sunSaveTimer, cycleChangeTimer, dayLampsOff, nightShowArmed,',
    '   nightShowQueue, nightShowTimer, spawnLampTimer. Ryhmittely kokoaa',
    '   tilan yhteen paikkaan (nollaus/reset myöhemmin yhdestä paikasta) –',
    '   EI toiminnallisia muutoksia.',
    '   HUOM: `state.isDay` (tallennettu pelitila) on ERI asia kuin',
    '   `dayNight.isDay` (tämän istunnon liukuva tila). */',
    'const dayNight = {',
    '    isDay: false,            // istunnon päivä/yö-tila (tallennetaan `state.isDay`:hin)',
    '    t: 0,                    // 0 = yö … 1 = päivä (liukuva; entinen `dayT`)',
    '    cycleChangeTimer: 0,     // kaaos K2: asetetaan alla (CYCLE_CHANGE_DELAY_FRAMES + 1)',
    '    moonX: 0,                // kuun nykyinen x   (asetetaan alla: MOON_X_MIN)',
    '    moonNightClock: 0,       // yön kulku (framet) kuun rataa varten',
    '    moonDark: 0,             // kuun laskusta johtuva pimeneminen',
    '    moonSaveTimer: 0,        // tallennusvälin laskuri (v4.74)',
    '    sunX: 0,                 // auringon x       (asetetaan alla: SUN_X)',
    '    sunDayClock: 0,          // päivän kulku (framet) auringon rataa varten',
    '    sunSaveTimer: 0,         // tallennusvälin laskuri (v4.89)',
    '    dayLampsOff: false,      // päivä sammutti katuvalot kerran (v4.38)',
    '    nightShowArmed: false,   // yön lamppushow saa laueta (asetetaan alla: DAY_FORCE)',
    '    nightShowQueue: [],      // syttymättömien lamppujen indeksit',
    '    nightShowTimer: 0,       // frameä seuraavaan lamppuun',
    '    spawnLampTimer: 0        // laskuri spawn-lamppushow\'lle',
    '};'
].map((line, i) => (i === 0 ? line : '    ' + line)).join('\n');   // sisennys IIFE:n tyyliin

const ASSIGN = {
    cycle: 'dayNight.cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES + 1;  // > DELAY = "ei käynnissä" (v4.89)',
    armed: "dayNight.nightShowArmed = (DAY_FORCE === 'night');  // laukeaa vain aidosta päivä→yö-siirtymästä",
    moonsun: [
        'dayNight.moonX = MOON_X_MIN;                 // kuun nykyinen x (ks. update)',
        'dayNight.moonNightClock = 0;                 // yön kulku (framet) kuun rataa varten',
        'dayNight.moonSaveTimer = 0;                  // tallennusvälin laskuri (v4.74)',
        'dayNight.sunX = SUN_X;                       // auringon x (päivällä liukuu, v4.89)',
        'dayNight.sunDayClock = 0;                    // päivän kulku (framet) auringon rataa varten',
        'dayNight.sunSaveTimer = 0;                   // tallennusvälin laskuri (v4.89)'
    ].join('\n')
};
for (const key of ['obj', 'cycle', 'armed', 'moonsun']) {
    const m = MARKERS[key];
    if (src.split(m).length - 1 !== 1) { console.error('Merkkiä ei löytynyt: ' + m); process.exit(1); }
    src = src.split(m).join(key === 'obj' ? OBJ : ASSIGN[key]);
}

fs.writeFileSync(SRC, src.split('\n').join(eol), 'utf8');
console.log('OK: 15 irtamuuttujaa → dayNight-olio · street.js ' + raw.split(/\r?\n/).length + ' → ' + src.split('\n').length + ' rv');
