/* ═══════════════════════════════════════════════════════════════
   street-chaos-fade-test.cjs – KAAOSTASON VALINNAN SIIRTYMÄ (v11.02)
     NORMAL-valinta:  musta 2 s (valikkobiisi vaimenee samalla)
                      → peli käynnistyy mustan alla
                      → katu paljastuu 1 s häivytyksellä  (yht. 3 s)
     Ennallaan:       ?chaos= -kytkin → ei siirtymää, ei introa
   Ajo: node street-chaos-fade-test.cjs   (ei repossa, %TEMP%)
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = 'd:/AI/AI_street';
const streetSrc = require('./street-src.cjs');
const audioSrc  = fs.readFileSync(path.join(ROOT, 'audio.js'), 'utf8');
const stateSrc  = fs.readFileSync(path.join(ROOT, 'gameState.js'), 'utf8');

const problems = [], oks = [];
const check = (c, m) => { if (c) oks.push(m); else problems.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MENU_TRACK = 'alec_koff';       // valikkobiisi
const INTRO_TRACK = '391308';         // kaaos-intro (jukebox/8_...)

function makeCtx() {
    const grad = { addColorStop() {} };
    return new Proxy({
        createRadialGradient: () => grad, createLinearGradient: () => grad,
        measureText: (t) => ({ width: String(t).length * 6 }),
        canvas: { width: 800, height: 400 }
    }, { get(t, k) { if (k in t) return t[k]; return () => {}; }, set() { return true; } });
}

function gainNode() {
    return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
             connect() { return this; }, disconnect() {}, start() {}, stop() {} };
}
function oscNode() {
    return { type: 'square', frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
             connect() { return this; }, disconnect() {}, start() {}, stop() {}, onended: null };
}
function filterNode() {
    return { type: 'lowpass', frequency: { value: 1000, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 1 },
             connect() { return this; }, disconnect() {}, start() {}, stop() {} };
}
function srcNode() {
    return { buffer: null, loop: false, connect() { return this; }, disconnect() {}, start() {}, stop() {}, onended: null };
}
function fakeCtx() {
    return { state: 'running', currentTime: 0, sampleRate: 44100, destination: {},
             resume() {}, suspend() {}, close() {},
             createGain: gainNode, createOscillator: oscNode, createBiquadFilter: filterNode,
             createBufferSource: srcNode,
             createAnalyser: () => ({ fftSize: 0, connect() { return this; } }),
             createDynamicsCompressor: () => ({ connect() { return this; }, threshold: { value: 0 }, knee: { value: 0 },
                                                ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 } }),
             createBuffer: (c, l) => ({ getChannelData: () => new Float32Array(l) }) };
}

/* ═══ TESTIPENKKI: selain- ja audio-stubit ═══════════════════════ */
function boot(search, opts) {
    opts = opts || {};
    const ctx = makeCtx();
    const winL = {}, cached = {}, listeners = {}, classLog = {};
    const localStore = {}, sessionStore = {}, audioInstances = [];

    class FakeAudio {
        constructor(src) { this.src = src || ''; this.volume = 1; this.paused = true; this.currentTime = 0; this.loop = false; this.__ls = {}; audioInstances.push(this); }
        play() { this.paused = false; return Promise.resolve(); }
        pause() { this.paused = true; }
        addEventListener(t, f) { (this.__ls[t] = this.__ls[t] || []).push(f); }
        removeEventListener() {} load() {} canPlayType() { return 'maybe'; }
    }

    function makeEl(id) {
        const classes = new Set(), log = [];
        classLog[id] = log;
        return {
            id, style: {}, dataset: {}, textContent: '', innerHTML: '', value: '', className: '',
            width: 800, height: 400, offsetWidth: 800, offsetHeight: 24, clientWidth: 1024, clientHeight: 700,
            classList: {
                add(c) { classes.add(c); log.push(['+', c]); },
                remove(c) { classes.delete(c); log.push(['-', c]); },
                toggle(c, on) { if (on === undefined) { classes.has(c) ? classes.delete(c) : classes.add(c); } else if (on) classes.add(c); else classes.delete(c); },
                contains(c) { return classes.has(c); }
            },
            __classes: classes,
            addEventListener(t, f) { (listeners[id] = listeners[id] || {}); (listeners[id][t] = listeners[id][t] || []).push(f); },
            removeEventListener() {}, focus() {}, blur() {}, appendChild() {}, removeChild() {},
            setAttribute() {}, getAttribute() { return null; }, remove() {}, insertBefore() {},
            scrollIntoView() {}, contains() { return false; },
            getBoundingClientRect() { return { left: 0, top: 0, right: 800, bottom: 400, width: 800, height: 400 }; },
            getContext() { return ctx; }, querySelector() { return null; }, querySelectorAll() { return []; }
        };
    }

    const canvasEl = makeEl('game-canvas');
    const buttons = [];
    for (const lvl of ['normal', 'mild', 'good', 'bad', 'full']) {
        const b = { __level: lvl, style: {}, __ls: {}, classList: { add() {}, remove() {}, contains: () => false },
                    getAttribute: (n) => (n === 'data-level' ? lvl : null),
                    addEventListener(t, f) { (b.__ls[t] = b.__ls[t] || []).push(f); }, removeEventListener() {} };
        buttons.push(b);
    }

    const documentStub = {
        getElementById(id) {
            if (id === 'game-canvas') return canvasEl;
            if (id === 'start-gate' && !opts.gate) return null;
            return cached[id] || (cached[id] = makeEl(id));
        },
        querySelector() { return null; }, querySelectorAll() { return []; },
        createElement() { return makeEl('tmp' + Math.random()); },
        addEventListener() {}, removeEventListener() {},
        body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head')
    };
    const menuEl = documentStub.getElementById('chaos-menu');
    menuEl.querySelectorAll = (sel) => (sel === '[data-level]' ? buttons : []);


    let clock = 0;
    const winStub = {
        addEventListener(t, f) { (winL[t] = winL[t] || []).push(f); }, removeEventListener() {},
        AudioContext: fakeCtx, webkitAudioContext: fakeCtx,
        innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1,
        focus() {}, blur() {}, postMessage() {},
        matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {}, removeEventListener() {}, removeListener() {} })
    };

    const sandbox = {
        console, setTimeout, clearTimeout, setInterval, clearInterval, Date, JSON, Math,
        performance: { now: () => clock },
        requestAnimationFrame() { return 1; },        // pelisilmukkaa ei ajeta (ei tarvita)
        cancelAnimationFrame() {}, innerWidth: 1024, innerHeight: 700,
        localStorage: { getItem: (k) => (k in localStore ? localStore[k] : null), setItem: (k, v) => { localStore[k] = String(v); }, removeItem: (k) => { delete localStore[k]; } },
        sessionStorage: { getItem: (k) => (k in sessionStore ? sessionStore[k] : null), setItem: (k, v) => { sessionStore[k] = String(v); }, removeItem: (k) => { delete sessionStore[k]; } },
        navigator: { userAgent: 'node', maxTouchPoints: 0, platform: 'node' },
        document: documentStub, window: winStub, location: { search, href: 'http://localhost/' + search },
        Audio: FakeAudio, AudioContext: fakeCtx, URLSearchParams, Image: function () {}, Uint8ClampedArray
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(stateSrc, sandbox, { filename: 'gameState.js' });
    vm.runInContext(audioSrc, sandbox, { filename: 'audio.js' });
    vm.runInContext(streetSrc, sandbox, { filename: 'street.js' });
    const Street = vm.runInContext('Street', sandbox);
    const StreetAudio = vm.runInContext('StreetAudio', sandbox);

    const track = (needle) => audioInstances.filter((a) => String(a.src || '').indexOf(needle) >= 0);

    return {
        Street, StreetAudio, buttons, audioInstances,
        domReady() { for (const f of (winL['DOMContentLoaded'] || []).slice()) f({}); },
        click(level) {
            const b = buttons.find((x) => x.__level === level);
            for (const f of (b.__ls['click'] || []).slice()) f({ preventDefault() {} });
        },
        has(id, cls) { const e = documentStub.getElementById(id); return e.__classes ? e.__classes.has(cls) : false; },
        log(id) { return (classLog[id] || []).slice(); },
        session() { return sessionStore; },
        menuAudio() { return track(MENU_TRACK)[0]; },
        introAudio() { return track(INTRO_TRACK)[0]; },
        notif() { return (cached['notification'] || {}).textContent || ''; },
        hud() { return (cached['hud-bar'] || {}).innerHTML || ''; }
    };
}

let notifA = '';   // siirtymäpolun aloitusilmoitus (sääntö 06 -vertailu)


/* ═══ TESTIT ═════════════════════════════════════════════════════ */
async function main() {
    /* A: NORMAL-valinta hubista → 3 s siirtymä */
    const A = boot('', { gate: false });
    A.domReady();
    check(!A.has('chaos-menu', 'hidden'), 'A: hubi näkyvissä latauksessa');
    check(!A.has('chaos-blackout', 'on') && !A.has('chaos-blackout', 'reveal'),
          'A: mustaverho EI ole päällä ennen valintaa');
    const mEl = A.menuAudio();
    check(!!mEl && mEl.paused === false, 'A: valikkobiisi soi hubissa');

    const T0 = Date.now();
    A.click('normal');
    const at = () => Date.now() - T0;

    check(A.has('chaos-blackout', 'on'), 'A: t=0 mustaverho .on (mustuminen alkaa)');
    check(A.has('chaos-menu', 'faded'), 'A: t=0 valikon tekstit haihtuvat (ennallaan)');
    check(Object.keys(A.session()).length === 0, 'A: t=0 kaaossessiota ei vielä tallennettu');
    check(!A.introAudio(), 'A: t=0 intro ei soi vielä');

    const vals = [];
    await sleep(300); vals.push(mEl.volume);
    await sleep(400); vals.push(mEl.volume);
    await sleep(400); vals.push(mEl.volume);
    await sleep(400); vals.push(mEl.volume);
    check(vals.every((v) => v > 0 && v < 0.05),
          'A: valikkobiisi vaimenee portaittain 2 s aikana: ' + vals.map((v) => v.toFixed(4)).join(' > '));
    check(vals[0] > vals[1] && vals[1] > vals[2] && vals[2] > vals[3],
          'A: valikkobiisin voimakkuus laskee monotonisesti');
    check(A.has('chaos-blackout', 'on') && !A.has('chaos-blackout', 'reveal') && !A.has('chaos-menu', 'hidden'),
          'A: t=' + at() + ' ms (< 2000) musta yhä päällä, peli ei vielä käynnistynyt');
    check(Object.keys(A.session()).length === 0, 'A: t=' + at() + ' ms kaaossessio EI vielä tallennettu');

    await sleep(900);            // raja 2000 ms reilusti ylitetty, paljastus vielä kesken (< 3000)
    check(A.has('chaos-menu', 'hidden'), 'A: t=' + at() + ' ms valikko piilossa (peli käynnistynyt)');
    check(A.has('chaos-blackout', 'reveal') && !A.has('chaos-blackout', 'on'),
          'A: t=' + at() + ' ms mustaverho siirtyi paljastusvaiheeseen (.reveal)');
    const sessKey = Object.keys(A.session()).find((k) => k.indexOf('chaos') >= 0);
    check(!!sessKey && JSON.parse(A.session()[sessKey]).level === 'normal',
          'A: kaaossessio tallennettu tasolla normal (setChaos/saveChaosSession ajettu)');
    const iEl = A.introAudio();
    check(!!iEl && iEl.paused === false, 'A: kaaos-intro soi heti mustan alla');
    notifA = A.notif();   // vrt. ?chaos=-polun aloitusilmoitukseen (sääntö 06: ei uutta tekstiä)

    await sleep(1200);           // ≈ 3600 ms → paljastus (3 s) varmasti valmis
    check(A.has('chaos-blackout', 'hidden') && !A.has('chaos-blackout', 'reveal'),
          'A: t=' + at() + ' ms mustaverho pois tieltä (kokonaiskesto 3 s)');
    const seq = A.log('chaos-blackout').map((x) => x[0] + x[1]).join(' ');
    check(seq === '+on -on +reveal -reveal +hidden', 'A: luokkajärjestys on → reveal → hidden (' + seq + ')');
    check(A.menuAudio().paused === true, 'A: valikkobiisi pysähtyi häivytyksen lopuksi');
    check(Math.abs(A.menuAudio().volume - 0.05) < 1e-9,
          'A: valikkobiisin äänenvoimakkuus palautui 0.05:een seuraavaa valikkoa varten');
}


/* B: ?chaos= -kytkin → ei siirtymää, ei introa */
async function mainB() {
    const B = boot('?chaos=normal', {});
    B.domReady();
    check(B.log('chaos-blackout').length === 0 && !B.has('chaos-blackout', 'on'),
          'B: ?chaos=normal – mustaverho ei koskaan aktivoidu (testikytkin ennallaan)');
    check(!B.introAudio(), 'B: ?chaos=normal – hubi ohitetaan, introa ei soiteta');
    check(!B.has('chaos-menu', 'faded'), 'B: ?chaos=normal – valikon häivytystä ei ajeta');
    check(B.notif() === notifA,
          'B: sama aloitusilmoitus molemmilla poluilla → siirtymä EI lisää tekstiä (sääntö 06). Ilmoitus: "' + notifA + '"');

    /* C: kaksoisvalinta ei käynnistä siirtymää kahdesti */
    const C = boot('', { gate: false });
    C.domReady();
    C.click('normal');
    C.click('normal');
    const seqC = C.log('chaos-blackout').map((x) => x[0] + x[1]).join(' ');
    check(seqC === '+on', 'C: kaksoisvalinta ei käynnistä siirtymää kahdesti (' + seqC + ')');
}

main().then(mainB).then(() => {
    console.log('── OK (' + oks.length + ') ──');
    for (const m of oks) console.log('  [OK] ' + m);
    if (problems.length) {
        console.log('── ONGELMAT (' + problems.length + ') ──');
        for (const m of problems) console.log('  [FAIL] ' + m);
        process.exit(1);
    }
    console.log('KAIKKI KUNNOSSA: ' + oks.length + ' tarkistusta, 0 löydöstä.');
    process.exit(0);
}).catch((err) => { console.error('AJOVIRHE: ' + ((err && err.stack) || err)); process.exit(2); });

