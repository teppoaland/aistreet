// v11.31 – FULL CHAOS: BAR myy olutta 🍺, 🍔 ei kulu, törmäys −1 🪙, humala horjuttaa.
// Harness: Node vm + canvas-stub (sama tekniikka kuin chaos-normal-check.cjs).
// Koukut injektoidaan VAIN muistiin – repossa oleva street.js on koskematon.
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
const docTarget = {
    getElementById: () => makeEl(), querySelector: () => makeEl(), querySelectorAll: () => [],
    createElement: () => makeEl(), addEventListener() {}, removeEventListener() {}, body: { appendChild() {} }
};
const store = {}, session = {};
const RealDate = Date;
let fakeNow = 1700000000000;   // ohjattava kello (horjunnan vaihe testattavissa)
const sandbox = {
    Math, JSON,
    Date: new Proxy(RealDate, { get(t, k) { return (k === 'now') ? (() => fakeNow) : t[k]; } }),
    performance: { now: () => 0 },
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
docTarget.getElementById = (id) => (id === 'hud-bar') ? hudEl : makeEl();
sandbox.globalThis = sandbox;
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

let src = require('./street-src.cjs');
const ver = require('./ver.cjs');
const markerRe = /return \{ init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon \};/;
if (!markerRe.test(src)) { console.error('FAIL: return-lause ei löytynyt street.js:stä'); process.exit(1); }
const hooks = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon,\n' +
    '        __t: {\n' +
    '            get coinCount() { return coinCount; }, set coinCount(v) { coinCount = v; },\n' +
    '            get hamburgerCount() { return hamburgerCount; }, set hamburgerCount(v) { hamburgerCount = v; },\n' +
    '            get drunkLevel() { return drunkLevel; }, set drunkLevel(v) { drunkLevel = v; },\n' +
    '            get drunkTimer() { return drunkTimer; }, set drunkTimer(v) { drunkTimer = v; },\n' +
    '            get hamburgerTimer() { return hamburgerTimer; }, set hamburgerTimer(v) { hamburgerTimer = v; },\n' +
    '            get burgerInterval() { return burgerInterval; },\n' +
    '            get barBuyQty() { return barBuyQty; },\n' +
    '            get playerDead() { return playerDead; }, set playerDead(v) { playerDead = v; },\n' +
    '            get level() { return chaosLevel; },\n' +
    '            set barRoom(v) { barRoom = v; },\n' +
    '            keys, collisionCost, update, updateHUD, drawBarRoom: StreetRooms.drawBar, player,\n' +
    '            drunkAimShift, fireBeam, distanceToSegment,\n' +
    '            aim(x, y) { aimX = x; aimY = y; },\n' +
    '            get shootingStar() { return shootingStar; }, set shootingStar(v) { shootingStar = v; },\n' +
    '            set beamCooldownTimer(v) { beamCooldownTimer = v; },\n' +
    '            get beamWeaponCollected() { return beamWeaponCollected; }, set beamWeaponCollected(v) { beamWeaponCollected = v; },\n' +
    '            get dayT() { return dayNight.t; }, set dayT(v) { dayNight.t = v; },\n' +
    '        } };';
src = src.replace(markerRe, hooks);
ok('street.js: return-lause löytyi (koukut vain muistiin)', true);

vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), sandbox);
vm.runInContext(src, sandbox);
const Street = vm.runInContext('Street', sandbox);
const T = Street.__t;
ok('koukut käytettävissä (collisionCost + update + updateHUD)',
    !!(T && typeof T.collisionCost === 'function' && typeof T.update === 'function' && typeof T.updateHUD === 'function'));

function fresh(level) {
    for (const k in store) delete store[k];
    for (const k in session) delete session[k];
    for (const k in T.keys) delete T.keys[k];
    T.barRoom = false;
    T.playerDead = false;
    T.player.knockedDown = false;   // init ei nollaa tätä (oikeassa pelissä reload hoitaa)
    T.player.knockdownTimer = 0;
    Street.setChaos(level);
    Street.init(canvasStub);
}

/* ═══ 1. FULL: BAR myy olutta (▲ = 1 🍺 / 1 🪙, katto 10, ▼ peru) ═══ */
console.log('\n[1] FULL: BAR myy olutta 🍺');
fresh('full');
T.coinCount = 3; T.drunkLevel = 0;
const b0 = T.hamburgerCount;
T.barRoom = true;
T.keys['ArrowUp'] = true; T.update(1);
ok('▲ osti 1 🍺 (humala 0 → 1)', T.drunkLevel === 1, T.drunkLevel);
ok('kolikko 3 → 2', T.coinCount === 2, T.coinCount);
ok('oluesta 🍔 ei muutu (' + b0 + ')', T.hamburgerCount === b0, T.hamburgerCount);
T.keys['ArrowUp'] = false; T.update(1);
T.keys['ArrowUp'] = true; T.update(1);
ok('toinen osto (humala 1 → 2)', T.drunkLevel === 2, T.drunkLevel);
T.drunkLevel = 10; T.coinCount = 5;
T.keys['ArrowUp'] = false; T.update(1);
T.keys['ArrowUp'] = true; T.update(1);
ok('katto 10: ei osta yli (kolikko pysyy 5)', T.drunkLevel === 10 && T.coinCount === 5, T.drunkLevel + '/' + T.coinCount);
T.keys['ArrowUp'] = false; T.update(1);
T.keys['ArrowDown'] = true; T.update(1);
ok('▼ peru: humala 10 → 9', T.drunkLevel === 9, T.drunkLevel);
ok('▼ peru: kolikko takaisin (5 → 6)', T.coinCount === 6, T.coinCount);
T.keys['ArrowDown'] = false; T.update(1); T.barRoom = false;

/* ═══ 2. FULL: 🍺 ylin kerros – 🍔 kuluu vasta kun oluet loppu ═══ */
console.log('\n[2] FULL: kaksikerroksinen elämä');
fresh('full');
T.drunkLevel = 3; T.hamburgerCount = 5;
for (let i = 0; i < 30; i++) T.update(1);
ok('🍺 > 0: 🍔 ei kulu (5), oluen haihtumisajastin tikittää', T.hamburgerCount === 5 && T.drunkLevel === 3,
    T.hamburgerCount + '/' + T.drunkLevel);
T.drunkLevel = 0; T.hamburgerTimer = 3;
T.update(1); T.update(1); T.update(1); T.update(1);
ok('🍺 = 0 → klassinen 🍔-nälkä palaa (5 → 4)', T.hamburgerCount === 4, T.hamburgerCount);

/* ═══ 3. FULL: törmäys vie ylimmän kerroksen (🍺 ensin, sitten 🍔) ═══ */
console.log('\n[3] FULL: törmäys vie ylimmän kerroksen');
fresh('full');
T.drunkLevel = 2; T.coinCount = 5; T.hamburgerCount = 8;
T.collisionCost();
ok('törmäys: 🍺 2 → 1 (kolikot & 🍔 ennallaan)', T.drunkLevel === 1 && T.coinCount === 5 && T.hamburgerCount === 8,
    T.drunkLevel + '/' + T.coinCount + '/' + T.hamburgerCount);
T.drunkLevel = 0;
T.collisionCost();
ok('🍺 = 0 → törmäys vie 🍔 (8 → 7)', T.hamburgerCount === 7, T.hamburgerCount);
T.hamburgerCount = 1; T.playerDead = false;
T.collisionCost();
ok('0 🍔 → kuolema', T.hamburgerCount === 0 && T.playerDead === true, T.hamburgerCount + '/' + T.playerDead);

/* ═══ 4. FULL: humala haihtuu 1 / burgerInterval ═══ */
console.log('\n[4] FULL: humala haihtuu');
fresh('full');
T.drunkLevel = 5; T.drunkTimer = 3;
T.update(1); T.update(1); T.update(1); T.update(1);
ok('humala 5 → 4', T.drunkLevel === 4, T.drunkLevel);
ok('ajastin nollautui (≈ burgerInterval)', T.drunkTimer > 1000 && T.drunkTimer <= T.burgerInterval, T.drunkTimer + ' vs ' + T.burgerInterval);

/* ═══ 5. FULL: HUD = 🍔×n + 🍺×m (todelliset luvut) ═══ */
console.log('\n[5] FULL: HUD');
fresh('full');
T.hamburgerCount = 6; T.drunkLevel = 3;
T.updateHUD();
ok('HUD: 6 🍔', (hudEl.innerHTML.match(/🍔/g) || []).length === 6, (hudEl.innerHTML.match(/🍔/g) || []).length);
ok('HUD: 3 🍺', (hudEl.innerHTML.match(/🍺/g) || []).length === 3, (hudEl.innerHTML.match(/🍺/g) || []).length);

/* ═══ 6. NORMAL/BAD: entinen käytös (ei olutta) ═══ */
console.log('\n[6] NORMAL/BAD: bitti-identtinen');
for (const lvl of ['normal', 'bad']) {
    fresh(lvl);
    T.coinCount = 5; T.hamburgerCount = 3;
    T.collisionCost();
    ok(lvl.toUpperCase() + ': törmäys −1 🍔 (3 → 2), kolikot ennallaan', T.hamburgerCount === 2 && T.coinCount === 5, T.hamburgerCount + '/' + T.coinCount);
    T.hamburgerCount = 1; T.coinCount = 5; T.playerDead = false;
    T.collisionCost();
    ok(lvl.toUpperCase() + ': 1 🍔 → 0 → kuolema', T.hamburgerCount === 0 && T.playerDead === true, T.hamburgerCount + '/' + T.playerDead);
    fresh(lvl);
    T.coinCount = 2; T.hamburgerCount = 3; T.drunkLevel = 0;
    T.barRoom = true;
    T.keys['ArrowUp'] = true; T.update(1);
    ok(lvl.toUpperCase() + ': BAR myy 🍔 (3 → 4), humala 0', T.hamburgerCount === 4 && T.drunkLevel === 0, T.hamburgerCount + '/' + T.drunkLevel);
    T.keys['ArrowUp'] = false; T.update(1); T.barRoom = false;
    T.hamburgerCount = 6; T.updateHUD();
    ok(lvl.toUpperCase() + ': HUD ei sisällä 🍺, 6 🍔',
        (hudEl.innerHTML.match(/🍺/g) || []).length === 0 && (hudEl.innerHTML.match(/🍔/g) || []).length === 6,
        (hudEl.innerHTML.match(/🍔/g) || []).length);
}

/* ═══ 7. Versio + lähdetarkistus ═══ */
console.log('\n[7] Versio & lähde');
ok('index.html #version-tag = ' + ver.VERSION, ver.tagOk(fs.readFileSync(path.join(root, 'index.html'), 'utf8')));
/* Vaihe 5 osa 6 (v11.40): drawBarRoom muutti street/rooms.js-moduuliin, jossa
   barBuyQty sidotaan ENV.barBuyQty-nimellä → sallitaan molemmat muodot. */
ok('oluttuopin teksti löytyy drawBarRoomista', /'You drank ' \+ (?:ENV\.)?barBuyQty \+ 'x🍺 beers!'/.test(src));
ok('törmäyskustannus keskitetty collisionCost()-apuriin', /function collisionCost\(\)/.test(src));

/* ═══ 8. BAR-huoneen piirto ei kaadu (FULL = olut / muut = hampurilainen) ═══ */
console.log('\n[8] BAR-huoneen piirto (drawBarRoom / street/rooms.js)');
for (const lvl of ['full', 'normal']) {
    fresh(lvl);
    T.barRoom = true;
    let err = null;
    try { T.drawBarRoom(); } catch (e) { err = e.message; }
    ok(lvl.toUpperCase() + ': drawBarRoom ei kaadu', err === null, err);
    T.barRoom = false;
}

/* ═══ 9. FULL: ≥7 🍺 → horjuu myös PAIKALLAAN (v11.31b) ═══ */
console.log('\n[9] FULL: paikallaan horjuminen ≥7 🍺');
function idleDrift(level) {
    // FULL: välillä rosvo/auto voi tarttua → pakotetaan puhdas ikkuna (ei
    // tainnutusta eikä >15 px hyppyä = ei vaaran työntöä). Itse askel ≤ ~12 px.
    for (let attempt = 0; attempt < 80; attempt++) {
        fresh('full');
        for (const k in T.keys) delete T.keys[k];   // ei liike-näppäimiä
        T.player.x = 400; T.player.y = 280;
        T.drunkLevel = level;
        const x0 = T.player.x;
        let maxDev = 0, prevX = x0, clean = true;
        for (let i = 0; i < 420; i++) {
            fakeNow += 50; T.update(1);
            if (T.player.knockedDown || Math.abs(T.player.x - prevX) > 15) { clean = false; break; }
            prevX = T.player.x;
            const d = Math.abs(T.player.x - x0);
            if (d > maxDev) maxDev = d;
        }
        if (clean) return maxDev;
    }
    return -1;
}
ok('selvä (0 🍺): paikallaan ei liiku (x vakio)', idleDrift(0) === 0, idleDrift(0));
ok('6 🍺: ei vielä askelia paikallaan', idleDrift(6) === 0, idleDrift(6));
ok('7 🍺: ottaa hallitsemattomia askeleita paikallaan', idleDrift(7) > 3.0, idleDrift(7));
ok('10 🍺: ottaa askelia paikallaan', idleDrift(10) > 3.0, idleDrift(10));

/* ═══ 10. DIAG: FULLin kulutustahti (burgerInterval) ═══ */
console.log('\n[10] DIAG: FULLin kulutustahti');
{
    const iv = [];
    for (let i = 0; i < 30; i++) { fresh('full'); iv.push(T.burgerInterval); }
    console.log('   burgerInterval-arvat (8x): ' + iv.join(', ') +
        '  → ' + (Math.min(...iv) / 60).toFixed(0) + '-' + (Math.max(...iv) / 60).toFixed(0) + ' s / taso');
    // Kulutuslogiikan varmistus: pakotetaan lyhyt ajastin (ei vaaraa: pelaaja ylhäällä)
    fresh('full');
    T.player.y = 280; T.drunkLevel = 3; T.drunkTimer = 10;
    for (let i = 0; i < 12; i++) { fakeNow += 16; T.update(1); }
    ok('FULL: oluen kulutuslogiikka toimii (lyhyt ajastin)', T.drunkLevel < 3, T.drunkLevel);
    fresh('full');
    T.player.y = 280; T.drunkLevel = 0; T.hamburgerCount = 4; T.hamburgerTimer = 10;
    for (let i = 0; i < 12; i++) { fakeNow += 16; T.update(1); }
    ok('FULL: 🍔-kulutuslogiikka toimii oluen loputtua', T.hamburgerCount < 4, T.hamburgerCount);
}

/* ═══ 11. FULL: kännissä sädeaseen tähtäys horjuu (v11.31d) ═══ */
console.log('\n[11] FULL: tähtäys horjuu humalassa');
{
    function aimShiftMax(drunk) {
        fresh('full'); T.drunkLevel = drunk;
        let mx = 0;
        for (let i = 0; i < 30; i++) { fakeNow += 37; const s = T.drunkAimShift(); mx = Math.max(mx, Math.hypot(s.x, s.y)); }
        return mx;
    }
    ok('0 🍺: ei tähtäysvirhettä', aimShiftMax(0) === 0, aimShiftMax(0));
    ok('2 🍺: ei tähtäysvirhettä', aimShiftMax(2) === 0, aimShiftMax(2));
    ok('3 🍺: pieni virhe (<20 px)', aimShiftMax(3) > 1 && aimShiftMax(3) < 20, aimShiftMax(3));
    ok('8 🍺: iso virhe (>30 px)', aimShiftMax(8) > 30, aimShiftMax(8));
    ok('10 🍺: iso virhe (>40 px)', aimShiftMax(10) > 40, aimShiftMax(10));

    function setupShot() {
        fresh('full');
        T.beamWeaponCollected = true;
        T.dayT = 0;
        T.player.y = 320;                 // LAMP_BASE_Y (325) alapuolella
        T.player.facing = -1;             // meteoriitti vx>0 → facing*vx < 0
        T.shootingStar = { kind: 'meteorite', x: 300, y: 30, vx: 0.5, vy: 0.4, r: 11,
                           active: true, life: 0, hpLeft: 2, cracked: false, hitFlash: 0, trail: [], timer: 600 };
        T.aim(300, 30);
        T.beamCooldownTimer = 0;
    }
    function hitRate(drunk, n) {
        let hits = 0;
        for (let i = 0; i < n; i++) {
            setupShot();
            T.drunkLevel = drunk;
            fakeNow += 173;
            T.fireBeam();
            if (!T.shootingStar.active || T.shootingStar.hpLeft < 2) hits++;
        }
        return hits / n;
    }
    const r0 = hitRate(0, 60), r3 = hitRate(3, 60), r5 = hitRate(5, 60), r6 = hitRate(6, 60), r7 = hitRate(7, 60), r8 = hitRate(8, 60), r10 = hitRate(10, 60);
    console.log('   osumat: 0🍺=' + (r0 * 100).toFixed(0) + '% · 3🍺=' + (r3 * 100).toFixed(0) + '% · 5🍺=' + (r5 * 100).toFixed(0) + '% · 6🍺=' + (r6 * 100).toFixed(0) + '% · 7🍺=' + (r7 * 100).toFixed(0) + '% · 8🍺=' + (r8 * 100).toFixed(0) + '% · 10🍺=' + (r10 * 100).toFixed(0) + '%');
    ok('selvänä osuu aina', r0 === 1, r0);
    ok('3 🍺 osuu käytännössä aina (>90 %)', r3 > 0.9, r3);
    ok('5 🍺 on vielä helppo (>80 %)', r5 > 0.8, r5);
    ok('8 🍺 osuu enää harvoin (<60 %)', r8 < 0.6, r8);
    ok('10 🍺 osuu enää tuurilla (≤35 %)', r10 <= 0.35, r10);
}

/* ═══ 12. F5-soft reset säilyttää humalan, hard reset nollaa (v11.31e) ═══ */
console.log('\n[12] F5 säilyttää humalan; hard reset nollaa');
{
    for (const k in store) delete store[k];
    for (const k in session) delete session[k];
    for (const k in T.keys) delete T.keys[k];
    T.barRoom = false; T.playerDead = false; T.player.knockedDown = false;
    Street.setChaos('full'); Street.init(canvasStub);
    // juo 2 olutta (BAR ▲) → humala tallentuu kaaos-sessioon
    T.coinCount = 3; T.drunkLevel = 0;
    T.barRoom = true;
    T.keys['ArrowUp'] = true; T.update(1); T.keys['ArrowUp'] = false; T.update(1);
    T.keys['ArrowUp'] = true; T.update(1); T.keys['ArrowUp'] = false; T.update(1);
    T.barRoom = false;
    ok('2 olutta juotu', T.drunkLevel === 2, T.drunkLevel);
    let sess = JSON.parse(session['aistreet_chaos_session'] || '{}');
    ok('olut tallentui sessioon automaattisesti (drunk=2)', sess.drunk === 2, sess.drunk);
    // simuloi F5-soft reset: setChaos + init ILMAN session tyhjennystä
    Street.setChaos('full'); Street.init(canvasStub);
    ok('F5-soft reset: humala säilyy (2)', T.drunkLevel === 2, T.drunkLevel);
    // simuloi hard reset: clearChaosSession + init
    Street.clearChaosSession(); Street.setChaos('full'); Street.init(canvasStub);
    ok('hard reset: humala nollautuu (0)', T.drunkLevel === 0, T.drunkLevel);
}

console.log('\n' + (fails === 0 ? 'KAIKKI OK' : 'FAIL') + ': ' + (checks - fails) + '/' + checks + ' tarkistusta läpi');
process.exit(fails ? 1 : 0);

