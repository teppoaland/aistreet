/* ═══════════════════════════════════════════════════════════
   street-rooms-logic-test.cjs – Vaihe 5 osa 8 (v11.44)

   Miksi: huoneiden LOGIIKKA siirrettiin street/rooms.js-moduuliin ja
   street.js:n tila sidotaan get+set -pareina. Tämä on penkki, joka ajaa
   siirretyn logiikan OIKEASTI läpi (update() → huonerekisteri → moduuli)
   ja todistaa, että arvot kulkevat molempiin suuntiin:

     makuuhuone  Nuku/Poistu (isDay vaihtuu, +1 🍔, herätysrauha)
     BAR         osto/peruutus (1 🪙 = 1 🍔), katto 10, FULL = 🍺
     jukebox     monivalinta, veloitus 1 🪙/kappale, ei kolikoita,
                 äänen puuttuminen → palautus
     closeRoom   moduulin close-funktiot rekisterin kautta
     rakenne     tila on ENV.-etuliitteellä (ansa 3: bind ei saa unohtua)

   Ajo: node tools/tests/street-rooms-logic-test.cjs
   ═══════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');

let checks = 0, fails = 0;
function ok(name, cond, extra) {
    checks++;
    if (cond) console.log('  ok    ' + name);
    else { fails++; console.log('  FAIL  ' + name + (extra !== undefined ? '   -> ' + JSON.stringify(extra) : '')); }
}

/* ── canvas- ja DOM-stubit (sama tekniikka kuin street-drunk-test) ── */
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
const hudEl = { innerHTML: '', offsetHeight: 20, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } };
const notifEl = { textContent: '', style: {} };   // showNotification kirjoittaa tähän
const docTarget = {
    getElementById: () => makeEl(), querySelector: () => makeEl(), querySelectorAll: () => [],
    createElement: () => makeEl(), addEventListener() {}, removeEventListener() {}, body: { appendChild() {} }
};
docTarget.getElementById = (id) => (id === 'hud-bar') ? hudEl : (id === 'notification' ? notifEl : makeEl());

const store = {}, session = {};
const audio = { playing: false, appendOk: true, queuePos: 0, playOk: true, played: [] };
const sandbox = {
    Math, JSON,
    Date, performance: { now: () => 0 },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: k => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); }, removeItem: k => { delete session[k]; } },
    document: new Proxy(docTarget, { get(t, k) { if (k in t) return t[k]; return () => null; }, set() { return true; } }),
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
vm.createContext(sandbox);
sandbox.StreetAudio = new Proxy({}, {
    get(t, k) {
        if (k === 'isJukeboxPlaying') return () => audio.playing;
        if (k === 'playJukeboxQueue') return (urls) => { if (!audio.playOk) return false; audio.played.push(urls); return true; };
        if (k === 'appendJukeboxQueue') return () => audio.appendOk;
        if (k === 'getJukeboxQueuePos') return () => audio.queuePos;
        return () => {};
    }
});

/* ── Koukut vain muistiin (repossa oleva street.js on koskematon) ── */
let src = require('./street-src.cjs');
const API = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };';
const DBG = API.replace(' };', `, __t: {
    update, keys,
    get state() { return state; },
    get coinCount() { return coinCount; }, set coinCount(v) { coinCount = v; },
    get hamburgerCount() { return hamburgerCount; }, set hamburgerCount(v) { hamburgerCount = v; },
    get hamburgerTimer() { return hamburgerTimer; }, set hamburgerTimer(v) { hamburgerTimer = v; },
    get drunkLevel() { return drunkLevel; }, set drunkLevel(v) { drunkLevel = v; },
    get drunkTimer() { return drunkTimer; },
    get burgerInterval() { return burgerInterval; },
    get isDay() { return isDay; }, set isDay(v) { isDay = v; },
    get dayT() { return dayT; }, set dayT(v) { dayT = v; },
    get sleepRoom() { return sleepRoom; }, set sleepRoom(v) { sleepRoom = v; },
    get sleepPhase() { return sleepPhase; }, set sleepPhase(v) { sleepPhase = v; },
    get sleepSel() { return sleepSel; }, set sleepSel(v) { sleepSel = v; },
    get barRoom() { return barRoom; }, set barRoom(v) { barRoom = v; },
    get barBuyQty() { return barBuyQty; },
    get jukeboxRoom() { return jukeboxRoom; }, set jukeboxRoom(v) { jukeboxRoom = v; },
    get jukeQueue() { return jukeQueue; },
    get jukeSel() { return jukeSel; }, set jukeSel(v) { jukeSel = v; },
    get jukeSpaceHeld() { return jukeSpaceHeld; }, set jukeSpaceHeld(v) { jukeSpaceHeld = v; },
    get jukeEnterHeld() { return jukeEnterHeld; }, set jukeEnterHeld(v) { jukeEnterHeld = v; },
    pick(i, v) { if (v === undefined) return jukePick[i]; jukePick[i] = v; },
    clearPicks() { for (let i = 0; i < jukePick.length; i++) jukePick[i] = false; },
    setAction(v) { actionJustPressed = v; },
    room: n => ({ sleep: sleepRoom, bar: barRoom, jukebox: jukeboxRoom, news: newsRoom })[n]
} };`);
if (!src.includes(API)) { console.error('FAIL: export-rivi ei löytynyt street.js:stä'); process.exit(1); }
src = src.replace(API, DBG);

vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), sandbox);
vm.runInContext(src, sandbox);
const Street = vm.runInContext('Street', sandbox);
const T = Street.__t;
ok('koukut käytettävissä (update + setAction + room)', !!(T && typeof T.update === 'function' && typeof T.setAction === 'function' && typeof T.room === 'function'));

const HUNGER_WAKE_GRACE = 600;   // street.js:n vakio (v4.41)
function fresh(level) {
    for (const k in store) delete store[k];
    for (const k in session) delete session[k];
    for (const k in T.keys) delete T.keys[k];
    audio.playing = false; audio.appendOk = true; audio.playOk = true; audio.queuePos = 0; audio.played = [];
    notifEl.textContent = '';
    T.sleepRoom = false; T.sleepPhase = 0; T.sleepSel = 0;
    T.barRoom = false; T.jukeboxRoom = false;
    /* Oikeassa pelissä jukeboxin OVI (tryJukeboxDoor) synkkaa reunanilmaisut
       näppäintilaan sisään astuttaessa – penkissä tehdään sama nollaus,
       muuten edellisen poistumisen reuna jäisi päälle eikä Space toimisi. */
    T.jukeSpaceHeld = false; T.jukeEnterHeld = false;
    T.clearPicks();
    Street.setChaos(level || 'normal');
    Street.init(canvasStub);
    T.setAction(false);
}
/* Yksi näppäinpainallus (reunailmaisu) + haluttu määrä framejä perään. */
function press(keys, frames) {
    for (const k in T.keys) delete T.keys[k];
    for (const k of keys) T.keys[k] = true;
    T.update(1);
    for (const k of keys) T.keys[k] = false;
    for (let i = 0; i < (frames || 0); i++) T.update(1);
}

/* ═══ 1. Rakenne: logiikka on moduulissa, tila ENV.-etuliitteellä ═══ */
console.log('\n[1] Rakenne (street/rooms.js + get+set-bind)');
{
    const roomsPath = path.join(root, 'street', 'rooms.js');
    const roomsSrc = fs.readFileSync(roomsPath, 'utf8');
    const streetSrcOne = fs.readFileSync(path.join(root, 'street.js'), 'utf8');
    const names = ['updateSleepRoom', 'updateBarRoom', 'updateJukeboxRoom',
        'closeSleepRoom', 'closeBarRoom', 'closeJukeboxRoom', 'resetJukeboxRoom'];
    const missing = names.filter((n) => vm.runInContext('typeof StreetRooms.' + n, sandbox) !== 'function');
    ok('moduulin rajapinta: 7 logiikkafunktiota + 3 piirtofunktiota', missing.length === 0 &&
        vm.runInContext('typeof StreetRooms.drawSleep', sandbox) === 'function' &&
        vm.runInContext('typeof StreetRooms.drawBar', sandbox) === 'function' &&
        vm.runInContext('typeof StreetRooms.drawJukebox', sandbox) === 'function', missing);
    ok('street.js: nimet tuodaan StreetRooms-destrukturoinnilla', /const \{\s*\n\s*updateSleepRoom, updateBarRoom, updateJukeboxRoom,\s*\n\s*closeSleepRoom, closeBarRoom, closeJukeboxRoom, resetJukeboxRoom\s*\n\s*\} = StreetRooms;/.test(streetSrcOne));
    ok('street.js: ei enää omia huonefunktioita', !streetSrcOne.includes('function updateSleepRoom(') &&
        !streetSrcOne.includes('function jukeboxExitAndPlay(') && !streetSrcOne.includes('function closeBarRoom('));
    ok('rooms.js: siirretyt funktiot + tila ENV.-etuliitteellä (ansa 3)', roomsSrc.includes('function updateSleepRoom(dt) {') &&
        roomsSrc.includes('function jukeboxExitAndPlay() {') && roomsSrc.includes('ENV.sleepRoom') &&
        roomsSrc.includes('ENV.coinCount') && !/if \(sleepRoom\) \{/.test(roomsSrc) && !/(?<![\w.$])coinCount\s*[-+]{2}/.test(roomsSrc));
    ok('rekisteri + closeRoom jäivät street.js:ään', streetSrcOne.includes('for (const room of rooms) if (room.update(dt)) return;') &&
        streetSrcOne.includes('function closeRoom() {') && streetSrcOne.includes('function closeNewsRoom() {'));
}

/* ═══ 2. Makuuhuone: Nuku vaihtaa päivä/yön, +1 🍔, herätysrauha ═══ */
console.log('\n[2] Makuuhuone (Nuku / Poistu)');
{
    fresh('normal');
    T.dayT = 0; T.isDay = false; T.hamburgerCount = 5; T.hamburgerTimer = 100;
    T.sleepRoom = true; T.sleepSel = 0;
    T.setAction(true); T.update(1);
    ok('Nuku käynnistää pimennyksen (sleepPhase > 0), huone pysyy auki', T.sleepPhase > 0 && T.sleepRoom,
        { phase: T.sleepPhase, room: T.sleepRoom });
    for (let i = 0; i < 400 && T.sleepRoom; i++) T.update(1);
    ok('pimennys päättyy → huone sulkeutuu', T.sleepRoom === false && T.sleepPhase === 0);
    ok('yö → päivä (isDay false → true)', T.isDay === true, T.isDay);
    ok('+1 🍔 nukkumisesta (5 → 6), myös tallennettuun tilaan', T.hamburgerCount === 6 && T.state.inventory.hamburgerCount === 6,
        { hud: T.hamburgerCount, state: T.state.inventory.hamburgerCount });
    ok('herätysrauha: ajastin ≥ ' + HUNGER_WAKE_GRACE, T.hamburgerTimer >= HUNGER_WAKE_GRACE, T.hamburgerTimer);

    /* päivä → yö samalla valinnalla */
    fresh('normal');
    T.dayT = 1; T.isDay = true; T.sleepRoom = true; T.sleepSel = 0;
    T.setAction(true); T.update(1);
    for (let i = 0; i < 400 && T.sleepRoom; i++) T.update(1);
    ok('päivä → yö (isDay true → false)', T.isDay === false, T.isDay);

    /* Poistu ei muuta mitään eikä vaihda päivää */
    fresh('normal');
    T.dayT = 0; T.isDay = false; T.hamburgerCount = 5;
    T.sleepRoom = true; T.sleepSel = 1;
    T.setAction(true); T.update(1);
    ok('Poistu: huone kiinni, ei pimennystä eikä 🍔-lisää',
        T.sleepRoom === false && T.sleepPhase === 0 && T.sleepSel === 0 &&
        T.isDay === false && T.hamburgerCount === 5,
        { room: T.sleepRoom, phase: T.sleepPhase, isDay: T.isDay, burgers: T.hamburgerCount });

    /* 🍔-katto 10: nukkuminen ei ylitä sitä */
    fresh('normal');
    T.dayT = 0; T.isDay = false; T.hamburgerCount = 10;
    T.sleepRoom = true; T.sleepSel = 0;
    T.setAction(true); T.update(1);
    for (let i = 0; i < 400 && T.sleepRoom; i++) T.update(1);
    ok('katto 10: nukkuminen ei nosta 🍔 yli katon', T.hamburgerCount === 10, T.hamburgerCount);
}

/* ═══ 3. BAR: osto/peruutus (1 🪙 = 1 🍔), katto, 0 kolikkoa ═══ */
console.log('\n[3] BAR (osto / peruutus)');
{
    fresh('normal');
    T.coinCount = 3; T.hamburgerCount = 5; T.barRoom = true;
    press(['ArrowUp']);
    ok('▲ osti 1 🍔 / 1 🪙', T.hamburgerCount === 6 && T.coinCount === 2 && T.barBuyQty === 1,
        { burgers: T.hamburgerCount, coins: T.coinCount, qty: T.barBuyQty });
    ok('osto tallentui tilaan (state.inventory)', T.state.inventory.hamburgerCount === 6 && T.state.inventory.coinCount === 2);
    press(['ArrowDown']);
    ok('▼ perui oston (🍔 6 → 5, 🪙 2 → 3)', T.hamburgerCount === 5 && T.coinCount === 3 && T.barBuyQty === 0,
        { burgers: T.hamburgerCount, coins: T.coinCount, qty: T.barBuyQty });

    T.hamburgerCount = 10; T.coinCount = 3;
    press(['ArrowUp']);
    ok('katto 10: ei osta yli (kolikko pysyy 3)', T.hamburgerCount === 10 && T.coinCount === 3 && T.barBuyQty === 0);

    T.hamburgerCount = 5; T.coinCount = 0;
    press(['ArrowUp']);
    ok('0 kolikkoa: ei ostoa', T.hamburgerCount === 5 && T.coinCount === 0 && T.barBuyQty === 0);

    T.coinCount = 3;
    press(['ArrowUp']);
    T.setAction(true); T.update(1);
    ok('poistuminen: huone kiinni ja barBuyQty nollautuu', T.barRoom === false && T.barBuyQty === 0);
}

/* ═══ 4. BAR FULL: olut 🍺 (chaosFlags.beer-haara moduulissa) ═══ */
console.log('\n[4] BAR FULL (olut)');
{
    fresh('full');
    T.coinCount = 3; T.drunkLevel = 0; T.barRoom = true;
    const burgers0 = T.hamburgerCount;
    press(['ArrowUp']);
    ok('▲ osti 1 🍺 / 1 🪙 (FULL-haara)', T.drunkLevel === 1 && T.coinCount === 2 && T.barBuyQty === 1,
        { drunk: T.drunkLevel, coins: T.coinCount, qty: T.barBuyQty });
    ok('oluesta 🍔 ei muutu', T.hamburgerCount === burgers0, T.hamburgerCount);
    ok('oluet nollaavat haihtumisajastimen (drunkTimer = burgerInterval)', T.drunkTimer === T.burgerInterval && T.drunkTimer > 0,
        { drunkTimer: T.drunkTimer, burgerInterval: T.burgerInterval });
    press(['ArrowDown']);
    ok('▼ perui oluen (humala 1 → 0, 🪙 2 → 3)', T.drunkLevel === 0 && T.coinCount === 3 && T.barBuyQty === 0);
}

/* ═══ 5. Jukebox: valinnat, veloitus 1 🪙/kappale, palautus ═══ */
console.log('\n[5] Jukebox (valinnat ja veloitus)');
{
    /* yksi valinta: maksu ja soitto */
    fresh('normal');
    T.coinCount = 2; T.jukeboxRoom = true; T.jukeSel = 0; T.pick(0, true);
    press([' ']);
    ok('1 valinta: −1 🪙 ja jono soi ([1])', T.coinCount === 1 && JSON.stringify(T.jukeQueue) === '[1]' && audio.played.length === 1,
        { coins: T.coinCount, queue: T.jukeQueue, played: audio.played.length });
    ok('huone sulkeutuu poistuttaessa (resetJukeboxRoom)', T.jukeboxRoom === false && T.jukeSel === 0);
    ok('storessa näkyy veloitus (state.inventory.coinCount 1)', T.state.inventory.coinCount === 1);

    /* monta valintaa, 1 kolikko → soitetaan niin monta kuin riittää */
    fresh('normal');
    T.coinCount = 1; T.jukeboxRoom = true; T.pick(0, true); T.pick(2, true);
    ok('jukebox auki ja kursori rivillä 0 (Poistu) ennen painallusta', T.jukeboxRoom === true && T.jukeSel === 0);
    press([' ']);
    ok('2 valintaa / 1 🪙: soitetaan 1 (jonossa [1]) eikä kolikkoa jää', T.coinCount === 0 &&
        JSON.stringify(T.jukeQueue) === '[1]' && audio.played.length === 1,
        { coins: T.coinCount, queue: T.jukeQueue, played: audio.played.length, room: T.jukeboxRoom, pick: [T.pick(0), T.pick(2)] });
    ok('ilmoitus kertoo vajaudesta (ennallaan, ei uusi dialogi)', /Not enough coins for all/.test(notifEl.textContent), notifEl.textContent);

    /* ei valintoja → ei veloitusta */
    fresh('normal');
    T.coinCount = 2; T.jukeboxRoom = true;
    ok('jukebox auki ennen painallusta (ei valintoja)', T.jukeboxRoom === true);
    press([' ']);
    ok('ei valintoja: ei veloitusta eikä soittoa', T.coinCount === 2 && audio.played.length === 0 && T.jukeboxRoom === false,
        { coins: T.coinCount, played: audio.played.length, room: T.jukeboxRoom });

    /* 0 kolikkoa + valinta → "ei kolikoita" -polku */
    fresh('normal');
    notifEl.textContent = '';
    T.coinCount = 0; T.jukeboxRoom = true; T.pick(0, true);
    press([' ']);
    ok('0 🪙: ei veloitusta, ei soittoa, huone kiinni', T.coinCount === 0 && audio.played.length === 0 && T.jukeboxRoom === false,
        { coins: T.coinCount, played: audio.played.length, room: T.jukeboxRoom, notif: notifEl.textContent });
    ok('ilmoitus "No coins!" (ennallaan)', /No coins!/.test(notifEl.textContent), notifEl.textContent);

    /* ääni ei aukea → veloitetut kolikot takaisin */
    fresh('normal');
    notifEl.textContent = '';
    T.coinCount = 1; T.jukeboxRoom = true; T.pick(0, true);
    const queueBefore = T.jukeQueue.slice();
    audio.playOk = false;
    press([' ']);
    ok('ääni ei auennut: kolikko palautetaan (1 → 1) eikä jono muutu', T.coinCount === 1 &&
        JSON.stringify(T.jukeQueue) === JSON.stringify(queueBefore),
        { coins: T.coinCount, queue: T.jukeQueue, before: queueBefore, room: T.jukeboxRoom });
    ok('ilmoitus palautuksesta (ennallaan)', /coins refunded/.test(notifEl.textContent), notifEl.textContent);
}

/* ═══ 6. closeRoom: moduulin close-funktiot rekisterin kautta ═══ */
console.log('\n[6] closeRoom (rekisteri → moduuli)');
{
    fresh('normal');
    T.coinCount = 3; T.barRoom = true;
    press(['ArrowUp']);
    ok('BAR auki ja osto tehty (barBuyQty 1)', T.barRoom === true && T.barBuyQty === 1);
    ok('closeRoom() sulki BARin ja perui vierailun ostot', Street.closeRoom() === true && T.barRoom === false && T.barBuyQty === 0);

    T.sleepRoom = true; T.sleepSel = 1; T.sleepPhase = 5;
    ok('closeRoom() sulki makuuhuoneen (myös kesken pimennyksen)',
        Street.closeRoom() === true && T.sleepRoom === false && T.sleepSel === 0 && T.sleepPhase === 0);

    const coins0 = T.coinCount;
    T.jukeboxRoom = true; T.pick(0, true);
    ok('closeRoom() sulki jukeboxin ILMAN veloitusta (✕ = peruuta)',
        Street.closeRoom() === true && T.jukeboxRoom === false && T.pick(0) === false && T.coinCount === coins0,
        { coins: T.coinCount, was: coins0, pick: T.pick(0) });

    ok('closeRoom() ilman avointa huonetta palauttaa false', Street.closeRoom() === false);
}

/* ── Raportti ── */
console.log('\n══════ Vaihe 5 osa 8 – huoneiden logiikka street/rooms.js:ssä ══════');
console.log('\nTulos: ' + (checks - fails) + ' OK, ' + fails + ' löydöstä');
process.exit(fails ? 1 : 0);
