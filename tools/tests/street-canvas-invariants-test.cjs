/* ═══════════════════════════════════════════════════════════════
   street-canvas-invariants-test.cjs – canvas-kutsujen invariantit (v11.43)

   Miksi: kaksi oikeaa bugia jäi penkeiltä huomaamatta, koska ne EIVÄT
   kaataneet mitään Node-stubissa – oikea selain vain hylkää kelvottoman
   arvon HILJAA:
     1) `#NaNNaNxx`-väri (FULLin hsl-paletti + hex-apuri) → canvas jäi
        edelliseen väriin → talot/tausta "katosivat".
     2) `translate(NaN,0)` (puuttuva `WORLD_W`-sidonta → spawn x = NaN)
        → ajoneuvo katosi ja liikenne jäityi.
   Siksi tämä penkki ajaa peliä ~420 frameä (yli ensimmäisen ajoneuvon
   spawnin, frame 300) ja tarkistaa KAIKKI canvas-kutsujen argumentit.

   Ajo: node tools/tests/street-canvas-invariants-test.cjs
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const srcBase = require('./street-src.cjs');

const API = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };';
const SRC = srcBase.replace(API, API.replace(' };', ', __t: { update, render, get chaosLevel() { return chaosLevel; } } };'));

const GRADIENT = new Set(['createLinearGradient', 'createRadialGradient', 'createPattern']);
let fail = 0;
const F = (m) => { fail++; console.error('  X ' + m); };

function makeCtx(ops) {
    return new Proxy({}, {
        get(t, k) {
            if (GRADIENT.has(k)) return () => ({ addColorStop() {} });
            if (k === 'measureText') return () => ({ width: 10 });
            if (k in t) return t[k];
            return (...a) => { ops.push([String(k), ...a]); };
        },
        set(t, k, v) { t[k] = v; ops.push(['#' + String(k), v]); return true; }
    });
}

/* ROLLS: 3 satunnaista FULL-arpaa + 1 NORMAL (kontrolli). FULL arvotaan joka
   latauksella uudelleen → invarianttien on pidettävä kaikilla arvoilla. */
const ROLLS = ['full', 'full', 'full', 'normal'];
for (const mode of ROLLS) {
    const ops = [];
    const ctxStub = makeCtx(ops);
    const canvas = { getContext: () => ctxStub, width: 800, height: 400, clientWidth: 800, clientHeight: 400, style: {},
        addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }) };
    const sandbox = {
        console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, URLSearchParams, location: { search: '' },
        document: { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => canvas, body: { appendChild() {} } },
        window: { addEventListener() {}, innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1, location: { search: '' } },
        navigator: { maxTouchPoints: 0 }, performance: { now: () => 0 }, requestAnimationFrame: () => 0,
        StreetAudio: { init() {}, start() {}, stop() {}, playDeathGong() {}, getCtx: () => null, getDestination: () => null, playJukebox() {}, playJukeboxQueue() {}, appendJukeboxQueue() {}, stopJukebox() {}, isJukeboxPlaying: () => false, getJukeboxQueuePos: () => 0, setHungerTempo() {} },
        GameState: { STORAGE_KEY: 'x', defaultState: { inventory: { coin: false, coinCount: 0, hamburgerCount: 5 }, litLamps: [false, false, false, false, false], isDay: null }, load: () => ({}), save() {}, reset() {} },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        setTimeout, clearTimeout, setInterval, clearInterval
    };
    sandbox.globalThis = sandbox;

    let T;
    try {
        vm.createContext(sandbox);
        vm.runInContext(fs.readFileSync(path.join(root, 'gameState.js'), 'utf8'), sandbox);
        vm.runInContext(SRC, sandbox, { filename: 'street.js' });
        const Street = vm.runInContext('Street', sandbox);
        T = Street.__t;
        Street.setChaos(mode);
        Street.init(canvas);
    } catch (e) { F(mode + ': lataus/init kaatui: ' + e.message); continue; }

    let upErr = null, renderErr = null, missingPlayer = 0, renders = 0;
    const badArgs = new Map(), badColours = new Map();
    for (let f = 0; f < 420; f++) {
        try { T.update(1); } catch (e) { upErr = 'frame ' + f + ': ' + e.message; break; }
        if (f % 60 !== 0) continue;
        ops.length = 0;
        try { T.render(); } catch (e) { renderErr = 'frame ' + f + ': ' + e.message; break; }
        renders++;
        for (const o of ops) {
            if (o[0][0] === '#') {                       // tyylin asetus (fillStyle, font, …)
                if (o[1] === undefined || o[1] === null) badColours.set(o[0], String(o[1]));
                else if (typeof o[1] === 'string' && /(NaN|undefined)/.test(o[1])) badColours.set(o[0], o[1]);
                continue;
            }
            for (const a of o.slice(1)) {
                if (a === undefined || a === null || (typeof a === 'number' && !Number.isFinite(a))) {
                    badArgs.set(o[0], o[0] + '(' + o.slice(1).join(',') + ')');
                }
            }
        }
        if (!ops.some((o) => o[0] === '#fillStyle' && String(o[1]).startsWith('#'))) missingPlayer++;
    }
    const tag = mode + ' (mode)';
    if (upErr) F(tag + ': update kaatui – ' + upErr);
    else if (renderErr) F(tag + ': render kaatui – ' + renderErr);
    else if (badArgs.size) F(tag + ': canvas-kutsussa kelvoton luku – ' + [...badArgs.values()].slice(0, 3).join(' · '));
    else if (badColours.size) F(tag + ': kelvoton väri/style – ' + [...badColours.entries()].slice(0, 3).map(([k, v]) => k + '=' + v).join(' · '));
    else if (renders && missingPlayer === renders) F(tag + ': pelaajaa ei piirretty kertaakaan');
    else console.log('  ok   ' + tag + ': ' + renders + ' renderiä ilman kelvottomia arvoja');
}

console.log(fail ? '\n=== TULOS: ' + fail + ' löydöstä ===' : '\n=== TULOS: 0 löydöstä ===');
process.exit(fail ? 1 : 0);
