/* ═══════════════════════════════════════════════════════════
   split-rooms-logic.cjs – Vaihe 5 osa 8 (v11.44): huoneiden LOGIIKKA
   SAMaan moduuliin (street/rooms.js) piirron kanssa.

   PELKKÄ SIIRTO + nimeäminen moduulin rajalla (host = ENV, kuten osassa 6).
   Siirrettävät lohkot (alkuperäiset rivinumerot):
     A 2695–2901  updateSleepRoom + updateBarRoom + updateJukeboxRoom
     B 4299–4402  resetJukeboxRoom + jukePickedTracks + jukeboxExitAndPlay
     C 4449–4482  closeBarRoom + closeSleepRoom + closeJukeboxRoom
   POIS JÄÄVÄT: closeNewsRoom + closeRoom (rekisterisilmukka) – rekisteri
   `rooms[]` kokoaa kaikki neljä huonetta ja jää street.js:ään.

   Uudelleennimeäminen tehdään lookbehindilla (?<![\w.$]), jotta esim.
   `state.isDay` ei muutu muotoon ENV.state.ENV.isDay. Jokainen nimi
   tarkistetaan: 0 osumaa = kirjoitusvirhe, ja siirron jälkeen nimen on
   oltava 0 kertaa ilman ENV.-etuliitettä (muuten bind unohtui – ansa 3).

   Ajo:  node tools/refactor/split-rooms-logic.cjs
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'street.js');
const OUT = path.join(ROOT, 'street', 'rooms.js');

const raw = fs.readFileSync(SRC, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);

const BLOCKS = [
    {
        start: 2695, end: 2901, what: 'huoneiden update-funktiot',
        first: '    /* Makuuhuone (talo 7): liikenne jatkaa taustalla',
        has: ['function updateSleepRoom(dt) {', 'function updateBarRoom(dt) {', 'function updateJukeboxRoom(dt) {'],
        not: ['function updateNewsRoom(']
    },
    {
        start: 4299, end: 4402, what: 'jukeboxin valinnat ja poistuminen',
        first: '    /* ═══ JUKEBOX: valinnat ja poistuminen (v4.46)',
        has: ['function resetJukeboxRoom() {', 'function jukePickedTracks() {', 'function jukeboxExitAndPlay() {'],
        not: ['leaveHiddenStateForDeath']
    },
    {
        start: 4449, end: 4482, what: 'huoneiden close-funktiot',
        first: '    /* Sulkee BARin; peruu tämän vierailun ostot',
        has: ['function closeBarRoom() {', 'function closeSleepRoom() {', 'function closeJukeboxRoom() {'],
        not: ['function closeNewsRoom() {', 'function closeRoom() {']
    }
];

for (const b of BLOCKS) {
    const text = lines.slice(b.start - 1, b.end).join('\n');
    const bad = [];
    if (!text.startsWith(b.first)) bad.push('alkurivi ei täsmää');
    for (const s of b.has) if (!text.includes(s)) bad.push('puuttuu: ' + s);
    for (const s of b.not) if (text.includes(s)) bad.push('ei pitäisi sisältää: ' + s);
    if (!text.trimEnd().endsWith('}')) bad.push('loppu ei ole sulkeva aaltosulku');
    if (bad.length) { console.error('VARMISTUS EPÄONNISTUI (' + b.what + '): ' + bad.join(' | ')); process.exit(1); }
    console.log('  lohko OK: ' + b.what + ' (rv ' + b.start + '–' + b.end + ', ' + (b.end - b.start + 1) + ' rv)');
}

let body = BLOCKS.map((b) => lines.slice(b.start - 1, b.end).join('\n')).join('\n\n');

/* ── Uudelleennimeäminen: nimi → ENV.nimi (lookbehind suojaa .-polut) ── */
const NAMES = [
    'SLEEP_FADE_FRAMES', 'sleepRoom', 'sleepPhase', 'sleepSel', 'sleepHeldUp', 'sleepHeldDown',
    'barRoom', 'barBuyQty', 'barBuyHeldUp', 'barBuyHeldDown',
    'jukeboxRoom', 'jukeSel', 'jukeHeldUp', 'jukeHeldDown', 'jukeSpaceHeld', 'jukeEnterHeld',
    'jukePick', 'jukeQueue', 'jukeSavedPos',
    'coinCount', 'hamburgerCount', 'hamburgerTimer', 'burgerInterval', 'drunkLevel', 'drunkTimer',
    'DRUNK_MAX', 'HUNGER_WAKE_GRACE', 'isDay', 'dayT', 'cycleChangeTimer',
    'CYCLE_CHANGE_DELAY_FRAMES', 'DAY_FORCE', 'actionJustPressed',
    'state', 'keys', 'chaosFlags', 'JUKEBOX_TRACKS',
    'updateHUD', 'playCoin', 'saveChaosSession', 'resetMoon', 'resetSun', 'showNotification', 'StreetAudio'
];
for (const name of NAMES) {
    const re = new RegExp('(?<![\\w.$])' + name + '\\b', 'g');
    const n = (body.match(re) || []).length;
    if (n === 0) { console.error('Nimeä ei löytynyt siirrettävästä koodista: ' + name); process.exit(1); }
    body = body.replace(re, 'ENV.' + name);
    console.log('  ' + String(n).padStart(3) + ' × ' + name + '  →  ENV.' + name);
}
/* Jokainen nimi on nyt siivottu: 0 osumaa ilman etuliitettä. */
for (const name of NAMES) {
    const re = new RegExp('(?<![\\w.$])' + name + '\\b', 'g');
    const n = (body.match(re) || []).length;
    if (n !== 0) { console.error('JÄI SIIVOAMATTA: ' + name + ' × ' + n); process.exit(1); }
}
if (!/\bStreetTraffic\b/.test(body)) { console.error('StreetTraffic-kutsut katosivat – huoneiden liikenne ei pysähdy.'); process.exit(1); }
if (/ENV\.StreetTraffic/.test(body)) { console.error('StreetTraffic nimetty vahingossa – sen pitää olla globaali moduuliviittaus.'); process.exit(1); }
if (/\bGameState\b/.test(body) === false) { console.error('GameState-kutsut katosivat.'); process.exit(1); }

/* ── 1) Lisää lohkot street/rooms.js-moduuliin (ennen julkista rajapintaa) ── */
let mod = fs.readFileSync(OUT, 'utf8').split(/\r\n/).join('\n');   // vertailut LF:llä
const MARK = '    /* ── Julkinen rajapinta (street.js:n huonerekisteri käyttää näitä) ── */';
if (mod.split(MARK).length - 1 !== 1) { console.error('Julkisen rajapinnan merkkiä ei löytynyt rooms.js:stä.'); process.exit(1); }
mod = mod.split(MARK).join(body + '\n' + MARK);

const RET_OLD = '    return {\n        bind: bind,\n        drawSleep: drawSleepRoom,\n        drawJukebox: drawJukeboxRoom,\n        drawBar: drawBarRoom\n    };';
const RET_NEW = '    return {\n        bind: bind,\n        drawSleep: drawSleepRoom,\n        drawJukebox: drawJukeboxRoom,\n        drawBar: drawBarRoom,\n        updateSleepRoom: updateSleepRoom,\n        updateBarRoom: updateBarRoom,\n        updateJukeboxRoom: updateJukeboxRoom,\n        closeSleepRoom: closeSleepRoom,\n        closeBarRoom: closeBarRoom,\n        closeJukeboxRoom: closeJukeboxRoom,\n        resetJukeboxRoom: resetJukeboxRoom\n    };';
if (mod.split(RET_OLD).length - 1 !== 1) { console.error('return-lohkoa ei löytynyt rooms.js:stä.'); process.exit(1); }
mod = mod.split(RET_OLD).join(RET_NEW);

/* Moduulin otsikko + bind-lista ajan tasalle */
const HEAD_OLD = '   Huoneiden TILA ja syöttölogiikka (updateSleepRoom/updateBarRoom/\n   updateJukeboxRoom, closeXxxRoom, oven avaus) ovat yhä street.js:ssä –\n   tässä on vain piirto, kuten osissa 3–5.';
const HEAD_NEW = '   Lisäksi HUONEIDEN LOGIIKKA (Vaihe 5 osa 8, v11.44): updateSleepRoom /\n   updateBarRoom / updateJukeboxRoom, jukeboxExitAndPlay + apurit ja\n   closeSleepRoom / closeBarRoom / closeJukeboxRoom. Huoneiden tilamuuttujat\n   (sleep-, bar- ja juke-) pysyvät street.js:n sulkeumassa ja sidotaan get+set\n   -pareina; huonerekisteri `rooms[]`, closeNewsRoom ja closeRoom (silmukka)\n   jäävät street.js:ään.';
if (mod.split(HEAD_OLD).length - 1 !== 1) { console.error('Moduulin otsikkotekstiä ei löytynyt.'); process.exit(1); }
mod = mod.split(HEAD_OLD).join(HEAD_NEW);

const BINDLIST_OLD = '       ENV.DRUNK_MAX · ENV.BAR_BEER_H';
const BINDLIST_NEW = '       ENV.DRUNK_MAX · ENV.BAR_BEER_H · (osa 8) get+set sleep-, bar- ja\n' +
    '       juke-muuttujille, coinCount, hamburgerCount, hamburgerTimer, drunkLevel,\n' +
    '       drunkTimer, isDay, dayT, cycleChangeTimer, actionJustPressed, jukeQueue,\n' +
    '       jukeSavedPos + getterit jukePick, keys, state, burgerInterval,\n' +
    '       SLEEP_FADE_FRAMES, HUNGER_WAKE_GRACE, CYCLE_CHANGE_DELAY_FRAMES, DAY_FORCE\n' +
    '       ja apurit updateHUD / playCoin / saveChaosSession / resetMoon / resetSun /\n' +
    '       showNotification / StreetAudio';
if (mod.split(BINDLIST_OLD).length - 1 !== 1) { console.error('Bind-listaa ei löytynyt rooms.js:stä.'); process.exit(1); }
mod = mod.split(BINDLIST_OLD).join(BINDLIST_NEW);
fs.writeFileSync(OUT, mod.split('\n').join(eol), 'utf8');

/* ── 2) Poista lohkot street.js:stä (tilalle kohdistuskommentti) ── */
const REPLACEMENTS = [
    ['    /* v11.44 (Vaihe 5 osa 8): huoneiden LOGIIKKA (updateSleepRoom,\n' +
     '       updateBarRoom, updateJukeboxRoom) siirrettiin street/rooms.js-moduuliin.\n' +
     '       Huoneiden tila (sleep-, bar- ja juke-muuttujat) sidotaan get+set\n' +
     '       -pareina alempana; kutsut tulevat huonerekisterin kautta (rooms[]). */'],
    ['    /* v11.44 (Vaihe 5 osa 8): jukeboxin valinnat ja poistuminen\n' +
     '       (resetJukeboxRoom, jukePickedTracks, jukeboxExitAndPlay) ovat\n' +
     '       street/rooms.js-moduulissa; nimet tuodaan StreetRooms-destrukturoinnilla. */'],
    ['    /* v11.44 (Vaihe 5 osa 8): closeBarRoom / closeSleepRoom /\n' +
     '       closeJukeboxRoom siirrettiin street/rooms.js-moduuliin. HUOM:\n' +
     '       closeNewsRoom ja closeRoom (rekisterisilmukka) jäävät tänne, koska\n' +
     '       rooms[] kokoaa kaikki neljä huonetta. */']
];
let out = lines.join('\n');
// Vahti: kohdistuskommenteissa saa olla täsmälleen yksi lohkon lopetusmerkki.
for (const [i, r] of REPLACEMENTS.entries()) {
    if (r[0].split('*/').length - 1 !== 1) { console.error('Kohdistuskommentissa ' + i + ' on väärä määrä lopetusmerkkejä.'); process.exit(1); }
}
BLOCKS.forEach((b, i) => {
    const text = lines.slice(b.start - 1, b.end).join('\n');
    if (out.split(text).length - 1 !== 1) { console.error('Lohkoa ei löytynyt täsmälleen kerran: ' + b.what); process.exit(1); }
    out = out.split(text).join(REPLACEMENTS[i][0]);
});

/* Destrukturointi huonerekisterin eteen */
const ROOMS_OLD = '    const rooms = [\n';
const ROOMS_NEW = '    /* ── Huoneiden LOGIIKKA omasta tiedostosta (Vaihe 5 osa 8, v11.44) ──\n' +
    '       street/rooms.js omistaa huoneiden update/close- ja jukebox-funktiot\n' +
    '       (piirto siirtyi jo osassa 6). Tähän tuodaan samat nimet, joten rekisteri\n' +
    '       ja kutsut eivät muutu. */\n' +
    '    const {\n' +
    '        updateSleepRoom, updateBarRoom, updateJukeboxRoom,\n' +
    '        closeSleepRoom, closeBarRoom, closeJukeboxRoom, resetJukeboxRoom\n' +
    '    } = StreetRooms;\n\n' +
    '    const rooms = [\n';
if (out.split(ROOMS_OLD).length - 1 !== 1) { console.error('rooms[]-rekisterin alkua ei löytynyt kerran.'); process.exit(1); }
out = out.split(ROOMS_OLD).join(ROOMS_NEW);

/* Bind: jaetut getterit get+set -pareiksi (siirretty logiikka kirjoittaa niitä) */
const BIND_SHARED_OLD =
    '        get isDay() { return isDay; },\n' +
    '        get coinCount() { return coinCount; },\n' +
    '        get hamburgerCount() { return hamburgerCount; },\n' +
    '        get drunkLevel() { return drunkLevel; },\n' +
    '        get barBuyQty() { return barBuyQty; },\n' +
    '        get jukeQueue() { return jukeQueue; },\n' +
    '        get jukePick() { return jukePick; },\n' +
    '        get jukeSel() { return jukeSel; },\n' +
    '        get jukeCovers() { return jukeCovers; },\n' +
    '        get sleepPhase() { return sleepPhase; },\n' +
    '        get sleepSel() { return sleepSel; },';
const BIND_SHARED_NEW =
    '        get isDay() { return isDay; }, set isDay(v) { isDay = v; },\n' +
    '        get coinCount() { return coinCount; }, set coinCount(v) { coinCount = v; },\n' +
    '        get hamburgerCount() { return hamburgerCount; }, set hamburgerCount(v) { hamburgerCount = v; },\n' +
    '        get drunkLevel() { return drunkLevel; }, set drunkLevel(v) { drunkLevel = v; },\n' +
    '        get barBuyQty() { return barBuyQty; }, set barBuyQty(v) { barBuyQty = v; },\n' +
    '        get jukeQueue() { return jukeQueue; }, set jukeQueue(v) { jukeQueue = v; },\n' +
    '        get jukePick() { return jukePick; },\n' +
    '        get jukeSel() { return jukeSel; }, set jukeSel(v) { jukeSel = v; },\n' +
    '        get jukeCovers() { return jukeCovers; },\n' +
    '        get sleepPhase() { return sleepPhase; }, set sleepPhase(v) { sleepPhase = v; },\n' +
    '        get sleepSel() { return sleepSel; }, set sleepSel(v) { sleepSel = v; },';
if (out.split(BIND_SHARED_OLD).length - 1 !== 1) { console.error('Bind-lohkon jaettuja gettereitä ei löytynyt sellaisenaan.'); process.exit(1); }
out = out.split(BIND_SHARED_OLD).join(BIND_SHARED_NEW);

/* Bind: huoneiden logiikan tarvitsemat uudet nimet */
const BIND_ANCHOR = '        chaosFlags: chaosFlags,';
const BIND_ADD =
    '        chaosFlags: chaosFlags,\n' +
    '        /* Vaihe 5 osa 8 (v11.44) – huoneiden LOGIIKKA lukee ja mutatoi näitä.\n' +
    '           get+set kaikelle, mihin siirretty koodi kirjoittaa; muuttujat ovat\n' +
    '           edelleen street.js:n sulkeumassa, joten sama tila pysyy. */\n' +
    '        get keys() { return keys; },\n' +
    '        get state() { return state; },\n' +
    '        get dayT() { return dayT; },\n' +
    '        get actionJustPressed() { return actionJustPressed; }, set actionJustPressed(v) { actionJustPressed = v; },\n' +
    '        get sleepRoom() { return sleepRoom; }, set sleepRoom(v) { sleepRoom = v; },\n' +
    '        get sleepHeldUp() { return sleepHeldUp; }, set sleepHeldUp(v) { sleepHeldUp = v; },\n' +
    '        get sleepHeldDown() { return sleepHeldDown; }, set sleepHeldDown(v) { sleepHeldDown = v; },\n' +
    '        get barRoom() { return barRoom; }, set barRoom(v) { barRoom = v; },\n' +
    '        get barBuyHeldUp() { return barBuyHeldUp; }, set barBuyHeldUp(v) { barBuyHeldUp = v; },\n' +
    '        get barBuyHeldDown() { return barBuyHeldDown; }, set barBuyHeldDown(v) { barBuyHeldDown = v; },\n' +
    '        get jukeboxRoom() { return jukeboxRoom; }, set jukeboxRoom(v) { jukeboxRoom = v; },\n' +
    '        get jukeHeldUp() { return jukeHeldUp; }, set jukeHeldUp(v) { jukeHeldUp = v; },\n' +
    '        get jukeHeldDown() { return jukeHeldDown; }, set jukeHeldDown(v) { jukeHeldDown = v; },\n' +
    '        get jukeSpaceHeld() { return jukeSpaceHeld; }, set jukeSpaceHeld(v) { jukeSpaceHeld = v; },\n' +
    '        get jukeEnterHeld() { return jukeEnterHeld; }, set jukeEnterHeld(v) { jukeEnterHeld = v; },\n' +
    '        get jukeSavedPos() { return jukeSavedPos; }, set jukeSavedPos(v) { jukeSavedPos = v; },\n' +
    '        get hamburgerTimer() { return hamburgerTimer; }, set hamburgerTimer(v) { hamburgerTimer = v; },\n' +
    '        get drunkTimer() { return drunkTimer; }, set drunkTimer(v) { drunkTimer = v; },\n' +
    '        get cycleChangeTimer() { return cycleChangeTimer; }, set cycleChangeTimer(v) { cycleChangeTimer = v; },\n' +
    '        get burgerInterval() { return burgerInterval; },\n' +
    '        get HUNGER_WAKE_GRACE() { return HUNGER_WAKE_GRACE; },\n' +
    '        get CYCLE_CHANGE_DELAY_FRAMES() { return CYCLE_CHANGE_DELAY_FRAMES; },\n' +
    '        DAY_FORCE: DAY_FORCE,\n' +
    '        updateHUD: updateHUD, playCoin: playCoin, saveChaosSession: saveChaosSession,\n' +
    '        resetMoon: resetMoon, resetSun: resetSun, showNotification: showNotification,\n' +
    '        StreetAudio: StreetAudio,';   // HUOM: pilkku – lohkon omat vakiot jatkuvat tästä
if (out.split(BIND_ANCHOR).length - 1 !== 1) { console.error('Bind-ankkuria (chaosFlags) ei löytynyt kerran.'); process.exit(1); }
out = out.split(BIND_ANCHOR).join(BIND_ADD);

fs.writeFileSync(SRC, out.split('\n').join(eol), 'utf8');

const movedLines = BLOCKS.reduce((n, b) => n + (b.end - b.start + 1), 0);
console.log('OK: ' + movedLines + ' riviä (' + BLOCKS.length + ' lohkoa) → street/rooms.js');
console.log('street.js: ' + lines.length + ' → ' + out.split('\n').length + ' rv · rooms.js: ' + mod.split('\n').length + ' rv');
