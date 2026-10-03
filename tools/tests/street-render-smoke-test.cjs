/* ═══════════════════════════════════════════════════════════
   street-render-smoke-test.cjs – render()-polun savutesti (v11.38)

   Miksi: Vaihe 1 pilkkoi render():n 10 piirtofunktioon, eikä
   YKSIKÄÄN penkki kutsunut render()iä. Tämä testi ajaa oikean
   update()+render()-parin vm:ssä ja varmistaa, että kaikki
   kerrokset piirtyvät eivätkä heitä poikkeusta:

     yö · päivä (aurinko + päivänvalo) · sumu + tärinä + kuun lasku
     · neljä huonetta (makuuhuone/BAR/jukebox/lehti) · tainnutus
     · kuoleman pimennys · FULL CHAOS

   Ajo: node tools/tests/street-render-smoke-test.cjs
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
    else { fails++; console.log('  FAIL  ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

/* ── ctx, joka tallentaa piirtokutsut (profiili kertoo mitä piirrettiin) ── */
let ops = [];
const grad = { addColorStop() {} };
function makeCtx() {
    const target = {
        measureText: (t) => ({ width: String(t).length * 6 }),
        canvas: { width: 800, height: 400 }
    };
    return new Proxy(target, {
        get(t, k) {
            if (k in t) return t[k];
            if (typeof k === 'string') {
                if (k === 'createRadialGradient' || k === 'createLinearGradient') {
                    return function () { ops.push(k); return grad; };
                }
                return function () { ops.push(k); };
            }
            return () => {};
        },
        set(t, k, v) { t[k] = v; if (k === 'fillStyle' || k === 'strokeStyle') ops.push(String(k) + '=' + String(v)); return true; }
    });
}
const ctxStub = makeCtx();
function makeEl() {
    return new Proxy({
        addEventListener() {}, removeEventListener() {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        style: {}, getContext: () => ctxStub, focus() {}, blur() {}, appendChild() {}, remove() {},
        querySelector: () => makeEl(), querySelectorAll: () => [],
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 })
    }, { get(t, k) { if (k in t) return t[k]; return () => null; }, set() { return true; } });
}
const canvasStub = new Proxy({}, {
    get(t, k) {
        if (k === 'getContext') return () => ctxStub;
        if (k === 'style') return {};
        if (k === 'width' || k === 'height') return 800;
        return () => {};
    }, set() { return true; }
});

const store = {}, session = {};
const RealDate = Date;
let fakeNow = 1700000000000;
const sandbox = {
    Math, JSON, console, URLSearchParams,
    Date: new Proxy(RealDate, { get(t, k) { return (k === 'now') ? (() => fakeNow) : t[k]; } }),
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    Image: function () {}, Audio: function () {},
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    sessionStorage: { getItem: (k) => (k in session ? session[k] : null), setItem: (k, v) => { session[k] = String(v); }, removeItem: (k) => { delete session[k]; } },
    location: { search: '' },
    navigator: { userAgent: 'node', maxTouchPoints: 0 },
    StreetAudio: new Proxy({}, {
        get(t, k) {
            if (k === 'isJukeboxPlaying') return () => false;
            if (k === 'playJukebox' || k === 'playJukeboxQueue') return () => false;
            if (k === 'getJukeboxQueuePos') return () => 0;
            return () => {};
        }
    })
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
sandbox.document = new Proxy({
    getElementById: () => makeEl(), querySelector: () => makeEl(), querySelectorAll: () => [],
    createElement: () => makeEl(), addEventListener() {}, removeEventListener() {},
    body: { appendChild() {} }
}, { get(t, k) { if (k in t) return t[k]; return () => null; }, set() { return true; } });
sandbox.window = {
    addEventListener() {}, removeEventListener() {}, parent: { postMessage() {} },
    innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1, location: { search: '' }
};

/* ── Koukut vain muistiin (repossa oleva street.js on koskematon) ── */
let src = require('./street-src.cjs');
const API = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };';
const DBG = API.replace(' };', `, __t: {
    update, render, player, lamps, buildings,
    setDay: v => { dayNight.t = v; }, setFog: v => { fogAlpha = v; },
    setMoonDark: v => { dayNight.moonDark = v; }, setShake: v => { screenShakeAmount = v; },
    setFlash: v => { meteorFlash = v ? { t: 12 } : null; },
    setSleep: (v, phase) => { sleepRoom = v; sleepPhase = phase || 0; },
    setBar: v => { barRoom = v; }, setJuke: v => { jukeboxRoom = v; }, setNews: v => { newsRoom = v; },
    setKnock: v => { player.knockedDown = v; player.knockdownTimer = v ? 600 : 0; },
    room: n => ({ sleep: sleepRoom, bar: barRoom, jukebox: jukeboxRoom, news: newsRoom })[n],
    setDead: v => { playerDead = v; deathAlpha = v ? 0.5 : 0; },
    addBirds: n => { for (let i = 0; i < n; i++) birds.push({ x: 100 + i * 20, y: 280, vx: 0.3, vy: 0, frame: 0, ttl: 600 }); },
    addBats: n => { for (let i = 0; i < n; i++) bats.push({ x: 100 + i * 20, y: 120, vx: 0.5, vy: 0.2, life: 60, r: 3 }); }
} };`);
if (!src.includes(API)) { console.error('FAIL: export-rivia ei loytynyt street.js:sta'); process.exit(1); }
src = src.replace(API, DBG);

vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), sandbox);
vm.runInContext(src, sandbox);
const Street = vm.runInContext('Street', sandbox);
const T = Street.__t;

function renderOnce(label) {
    ops = [];
    let err = null;
    try { T.render(); } catch (e) { err = e; }
    ok('render() ei kaada: ' + label, !err, err ? err.message : null);
    ok('render() piirsi (' + label + '): ' + ops.length + ' kutsua', ops.length > 20, ops.length);
    return ops;
}

Street.setChaos('normal');
try { Street.init(canvasStub); } catch (e) { console.log('  (init: ' + e.message + ')'); }

console.log('1) Yo');
T.setDay(0);
for (let i = 0; i < 60; i++) T.update(1);
const night = renderOnce('yo');
ok('yo: taivas + tahdet (arc) ja kuun hehku (createRadialGradient)',
    night.includes('arc') && night.includes('createRadialGradient'));

console.log('2) Paiva (aurinko + paivanvalo)');
T.setDay(1);
for (let i = 0; i < 30; i++) T.update(1);
const day = renderOnce('paiva');
ok('paiva: paivataivas (createLinearGradient) + auringon hehku (createRadialGradient)',
    day.includes('createLinearGradient') && day.includes('createRadialGradient'));

console.log('3) Sumu + tarina + kuun lasku + valahdys + lepakot/linnut');
T.setDay(0); T.setFog(0.4); T.setShake(0.5); T.setMoonDark(0.15); T.setFlash(true);
T.addBats(3); T.addBirds(4);
renderOnce('efektit');
T.setFog(0); T.setShake(0); T.setMoonDark(0); T.setFlash(false);

console.log('4) Huoneet (drawRoomView)');
const roomCases = [
    ['makuuhuone', () => T.setSleep(true, 0)],
    ['makuuhuone (nukkumisen pimennys)', () => T.setSleep(true, 30)],
    ['BAR', () => T.setBar(true)],
    ['jukebox', () => T.setJuke(true)],
    ['sanomalehti', () => T.setNews(true)]
];
for (const [name, set] of roomCases) {
    T.setSleep(false, 0); T.setBar(false); T.setJuke(false); T.setNews(false);
    set();
    renderOnce(name);
    for (let i = 0; i < 5; i++) T.update(1);
    T.setSleep(false, 0); T.setBar(false); T.setJuke(false); T.setNews(false);
    T.setDay(0);
}

console.log('4b) closeRoom() – huonerekisteri (Vaihe 3)');
const closers = [
    ['makuuhuone', () => T.setSleep(true, 0)],
    ['BAR', () => T.setBar(true)],
    ['jukebox', () => T.setJuke(true)],
    ['sanomalehti', () => T.setNews(true)]
];
for (const [name, open] of closers) {
    T.setSleep(false, 0); T.setBar(false); T.setJuke(false); T.setNews(false);
    open();
    const wasOpen = !!T.room(name === 'sanomalehti' ? 'news' : name === 'makuuhuone' ? 'sleep' : name === 'BAR' ? 'bar' : 'jukebox');
    const closed = Street.closeRoom();
    ok('closeRoom sulki huoneen: ' + name, wasOpen && closed === true && !T.room('sleep') && !T.room('bar') && !T.room('jukebox') && !T.room('news'));
}
ok('closeRoom ilman avointa huonetta palauttaa false', Street.closeRoom() === false);

console.log('5) Tainnutus + kuoleman pimennys');
T.setKnock(true);
for (let i = 0; i < 10; i++) T.update(1);
renderOnce('tainnutus');
T.setKnock(false);
T.setDead(true);
const death = renderOnce('kuoleman pimennys');
ok('kuoleman pimennys: musta peitto piirrettiin (fillStyle=rgba(0,0,0,…))',
    death.some((o) => o.indexOf('fillStyle=rgba(0,0,0') === 0), death.filter((o) => o.indexOf('fillStyle=') === 0).slice(0, 4));
T.setDead(false);
for (let i = 0; i < 30; i++) T.update(1);

console.log('6) FULL CHAOS (olutta, humalaa, meteoriitteja, saadekehoja)');
Street.setChaos('full');
try { Street.init(canvasStub); } catch (e) { console.log('  (init FULL: ' + e.message + ')'); }
for (let i = 0; i < 120; i++) { fakeNow += 16; T.update(1); }
renderOnce('FULL');

console.log('');
console.log('Tulos: ' + (checks - fails) + ' / ' + checks + ' OK, ' + fails + ' löydöstä');
process.exit(fails ? 1 : 0);


