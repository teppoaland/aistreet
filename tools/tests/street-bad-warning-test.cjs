/* ======================================================================
   street-bad-warning-test.cjs - BAD CHAOS -VAROITUS (v11.25)
     BAD:   musta 2 s -> "You will suffer!" merkki merkitta (klik-aani)
            -> 800 ms tauko -> musta pois 1 s -> peli
     Muut:  NORMAL / FULL tasmalleen entinen 3 s aikajana, ei varoitusta
     Myos:  varoitusteksti EI nay mustan haivytyksen aikana (tyhjennetaan
            valinnassa), saanto 06 (ei uusia ilmoituksia), versio 11.25
   Ajo: node %TEMP%\street-bad-warning-test.cjs   (ei repossa)
   ====================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = 'd:/AI/AI_street';
const streetSrc = require('./street-src.cjs');
const ver = require('./ver.cjs');
const audioSrc  = fs.readFileSync(path.join(ROOT, 'audio.js'), 'utf8');
const stateSrc  = fs.readFileSync(path.join(ROOT, 'gameState.js'), 'utf8');
const htmlSrc   = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cssSrc    = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');

const WARN = 'You will suffer!';
const CARET = '\u25AE';
const problems = [], oks = [];
const check = (c, m) => { if (c) oks.push(m); else problems.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeout) {
    const t0 = Date.now();
    while (Date.now() - t0 < (timeout || 8000)) { if (fn()) return true; await sleep(20); }
    return !!fn();
}

/* --- canvas- ja audio-stubit (sama tekniikka kuin muissa penkeissa) --- */
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
/* --- DOM-stubi: elementit, joilla on oikea tekstipuu (varoitus kirjoitetaan
       tekstisolmuun + kursoriin) ------------------------------------------ */
function boot(search, opts) {
    opts = opts || {};
    const ctx = makeCtx();
    const winL = {}, cached = {}, listeners = {}, classLog = {};

    class FakeAudio {
        constructor(src) { this.src = src || ''; this.volume = 1; this.paused = true; this.currentTime = 0; this.loop = false; this.__ls = {}; }
        play() { this.paused = false; return Promise.resolve(); }
        pause() { this.paused = true; }
        addEventListener(t, f) { (this.__ls[t] = this.__ls[t] || []).push(f); }
        removeEventListener() {} load() {} canPlayType() { return 'maybe'; }
    }

    function textNode(t) { return { nodeType: 3, textContent: String(t == null ? '' : t), parentNode: null }; }

    function makeEl(id) {
        const classes = new Set(), log = [];
        classLog[id] = log;
        const el = {
            id, style: {}, dataset: {}, value: '', className: '', innerHTML: '', _text: '',
            width: 800, height: 400, offsetWidth: 800, offsetHeight: 24, clientWidth: 1024, clientHeight: 700,
            scrollTop: 0, scrollHeight: 0, childNodes: [],
            classList: {
                add(c) { classes.add(c); log.push(['+', c]); },
                remove(c) { classes.delete(c); log.push(['-', c]); },
                toggle(c, on) { if (on === undefined) { classes.has(c) ? classes.delete(c) : classes.add(c); } else if (on) classes.add(c); else classes.delete(c); },
                contains(c) { return classes.has(c); }
            },
            __classes: classes,
            addEventListener(t, f) { (listeners[id] = listeners[id] || {}); (listeners[id][t] = listeners[id][t] || []).push(f); },
            removeEventListener() {}, focus() {}, blur() {},
            appendChild(c) { el.childNodes.push(c); c.parentNode = el; return c; },
            removeChild(c) { const i = el.childNodes.indexOf(c); if (i >= 0) el.childNodes.splice(i, 1); c.parentNode = null; return c; },
            insertBefore(c) { return el.appendChild(c); },
            setAttribute() {}, getAttribute() { return null; }, remove() {},
            scrollIntoView() {}, contains() { return false; },
            getBoundingClientRect() { return { left: 0, top: 0, right: 800, bottom: 400, width: 800, height: 400 }; },
            getContext() { return ctx; }, querySelector() { return null; }, querySelectorAll() { return []; }
        };
        Object.defineProperty(el, 'textContent', {
            get() { return el._text + el.childNodes.map((c) => (c && c.textContent) || '').join(''); },
            set(v) { el._text = String(v == null ? '' : v); for (const c of el.childNodes) c.parentNode = null; el.childNodes.length = 0; }
        });
        return el;
    }
    const canvasEl = makeEl('game-canvas');
    const buttons = [];
    for (const lvl of ['normal', 'mild', 'good', 'bad', 'full']) {
        const b = { __level: lvl, style: {}, __ls: {},
                    classList: { add() {}, remove() {}, contains: () => false },
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
        createElement() { return makeEl('tmp' + Math.random()); },
        createTextNode(t) { return textNode(t); },
        querySelector() { return null; }, querySelectorAll() { return []; },
        addEventListener() {}, removeEventListener() {},
        body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head')
    };
    const menuEl = documentStub.getElementById('chaos-menu');
    menuEl.querySelectorAll = (sel) => (sel === '[data-level]' ? buttons : []);

    const winStub = {
        addEventListener(t, f) { (winL[t] = winL[t] || []).push(f); }, removeEventListener() {},
        AudioContext: fakeCtx, webkitAudioContext: fakeCtx,
        innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1,
        focus() {}, blur() {}, postMessage() {},
        matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {}, removeEventListener() {}, removeListener() {} })
    };

    const sandbox = {
        console, setTimeout, clearTimeout, setInterval, clearInterval, Date, JSON, Math,
        performance: { now: () => 0 },
        requestAnimationFrame() { return 1; },        // pelisilmukkaa ei ajeta
        cancelAnimationFrame() {}, innerWidth: 1024, innerHeight: 700,
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        navigator: { userAgent: 'node', maxTouchPoints: 0, platform: 'node' },
        document: documentStub, window: winStub, location: { search, href: 'http://localhost/' + search },
        Audio: FakeAudio, AudioContext: fakeCtx, URLSearchParams, Image: function () {}, Uint8ClampedArray
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(stateSrc, sandbox, { filename: 'gameState.js' });
    vm.runInContext(audioSrc, sandbox, { filename: 'audio.js' });
    vm.runInContext(streetSrc, sandbox, { filename: 'street.js' });

    /* index.html:n varoitusteksti stubiin ennen pelin kaynnistysta
       (selaimessa teksti on elementissa jo HTML:ssa) */
    const m = /id="chaos-warning"[^>]*>([^<]*)</.exec(htmlSrc);
    const warnStub = documentStub.getElementById('chaos-warning');
    if (m) warnStub.textContent = m[1];

    const warn = () => String(documentStub.getElementById('chaos-warning').textContent || '');
    const notif = () => { const e = cached['notification'] || {}; return String(e.textContent || '') + '|' + String(e.innerHTML || ''); };
    const StreetAudio = vm.runInContext('StreetAudio', sandbox);

    return {
        StreetAudio,
        domReady() { for (const f of (winL['DOMContentLoaded'] || []).slice()) f({}); },
        click(level) {
            const b = buttons.find((x) => x.__level === level);
            for (const f of (b.__ls['click'] || []).slice()) f({ preventDefault() {} });
        },
        has(id, cls) { const e = documentStub.getElementById(id); return e.__classes ? e.__classes.has(cls) : false; },
        log(id) { return (classLog[id] || []).slice().map((x) => x.join('')).join(','); },
        warn, notif
    };
}
/* ============================ TESTIT ============================ */
async function main() {
    /* --- 1. BAD CHAOS: varoitus kirjoitetaan mustaan ruutuun -------- */
    const A = boot('', { gate: false });
    let clicks = 0, intros = 0;
    const origClick = A.StreetAudio.playTypeClick;
    A.StreetAudio.playTypeClick = function () { clicks += 1; return origClick.apply(this, arguments); };
    const origIntro = A.StreetAudio.playChaosIntro;
    A.StreetAudio.playChaosIntro = function () { intros += 1; return origIntro.apply(this, arguments); };

    check(A.warn() === WARN, 'index.html: #chaos-warning sisaltaa tekstin jo ennen pelia');

    A.domReady();
    check(A.has('chaos-blackout', 'on') === false, 'ennen valintaa musta ei ole paalla');

    const t0 = Date.now();
    A.click('bad');
    check(A.has('chaos-blackout', 'on') === true, 'BAD: musta paalle heti valinnasta');
    check(A.has('chaos-menu', 'faded') === true, 'BAD: valikon tekstit himmenevat');
    check(A.warn() === '', 'BAD: varoitusteksti tyhjennetaan heti (ei nay 2 s haivytyksen aikana)');

    await sleep(900);
    check(A.warn() === '', 'BAD: 0,9 s -> varoitusta ei viela kirjoiteta');
    check(A.has('chaos-menu', 'hidden') === false, 'BAD: valikko piilotetaan vasta 2 s kohdalla');
    check(A.has('chaos-blackout', 'reveal') === false, 'BAD: paljastus ei ala ennen 2 s');

    const typing = await waitFor(() => A.warn().length > 0, 4000);
    check(typing, 'BAD: kirjoitus alkaa n. 2 s kohdalla');
    await sleep(150);
    const mid = A.warn();
    const typed = mid.split(CARET).join('');
    check(typed.length > 0 && typed.length < WARN.length, 'BAD: teksti kasvaa merkki merkitta ("' + typed + '")');
    check(mid.indexOf(CARET) >= 0, 'BAD: kursori nakyvissa kirjoituksen aikana');
    check(WARN.indexOf(typed) === 0, 'BAD: kirjoitettu alku tasmaa tekstiin');
    check(A.has('chaos-blackout', 'reveal') === false, 'BAD: ruutu pysyy mustana kirjoituksen ajan');
    check(intros === 1, 'BAD: kaaos-intro soi jo kirjoituksen aikana (t = 2 s, kuten ennenkin)');
    check(clicks > 0, 'BAD: klik-aania kuuluu kirjoituksen aikana (tassa vaiheessa ' + clicks + ' kpl)');

    const completed = await waitFor(() => A.warn() === WARN, 4000);
    check(completed, 'BAD: teksti valmis tasmalleen "You will suffer!"');
    check(A.warn().indexOf(CARET) < 0, 'BAD: kursori poistetaan kun teksti on valmis');
    check(clicks === 5, 'BAD: klik-aania yhteensa 5 (joka 3. merkki 16 merkista), tuli ' + clicks);
    check(A.has('chaos-blackout', 'reveal') === false, 'BAD: mustaa ei haivytetata heti tekstin valmistuttua');

    await sleep(400);
    check(A.warn() === WARN, 'BAD: teksti pysyy nakyvissa holdin ajan');
    check(A.has('chaos-blackout', 'reveal') === false, 'BAD: 0,4 s holdista -> ei viela paljastusta');

    const revealed = await waitFor(() => A.has('chaos-blackout', 'reveal'), 2000);
    const revealAt = Date.now() - t0;
    check(revealed, 'BAD: musta haivytetaan holdin jalkeen (n. +0,8 s)');
    /* Aikajana on seinäkello: koneen kuorma venyttää summaa. Vaiheet
       tarkistetaan erikseen yllä (2 s → kirjoitus → 0,8 s hold → paljastus),
       joten tässä riittää alaraja (design) + väljä yläraja (kuorma). */
    check(revealAt > 3600 && revealAt < 7000, 'BAD: paljastus n. 3,9 s kohdalla (mitattu ' + revealAt + ' ms, 3,6-7,0 s)');
    const hidden = await waitFor(() => A.has('chaos-blackout', 'hidden'), 2000);
    check(hidden, 'BAD: musta pois tielta +1 s -> koko siirtyma n. 4,9 s');
    check(A.warn() === '', 'BAD: varoitusteksti siivotaan haivytyksen lopussa');
    const notifBad = A.notif();
    check(!/suffer/i.test(notifBad), 'BAD: varoitus EI tule ilmoituksena (saanto 06)');
    /* --- 2. Muut kaaostasot: entinen aikajana, ei varoitusta -------- */
    let notifNormal = null;
    for (const lvl of ['normal', 'full']) {
        const B = boot('', { gate: false });
        let c2 = 0;
        const oc2 = B.StreetAudio.playTypeClick;
        B.StreetAudio.playTypeClick = function () { c2 += 1; return oc2.apply(this, arguments); };
        B.domReady();
        const b0 = Date.now();
        B.click(lvl);
        check(B.warn() === '', lvl.toUpperCase() + ': varoitus tyhja heti valinnasta');

        await sleep(600);
        check(B.warn() === '', lvl.toUpperCase() + ': varoitusta ei kirjoiteta 0,6 s kohdalla');
        check(B.has('chaos-blackout', 'on') === true, lvl.toUpperCase() + ': musta paalla heti (kuten ennen)');

        const rv = await waitFor(() => B.has('chaos-blackout', 'reveal'), 3000);
        const rvMs = Date.now() - b0;
        check(rv, lvl.toUpperCase() + ': paljastus alkaa n. 2 s (entinen aikajana)');
        /* Sama kuormahuomio kuin BADissa: alaraja = design, yläraja väljä. */
        check(rvMs > 1900 && rvMs < 3600, lvl.toUpperCase() + ': paljastus ajallaan (mitattu ' + rvMs + ' ms, 1,9-3,6 s)');
        const hd = await waitFor(() => B.has('chaos-blackout', 'hidden'), 2000);
        check(hd, lvl.toUpperCase() + ': musta pois tielta +1 s (yht. 3 s)');
        check(B.warn() === '', lvl.toUpperCase() + ': varoitus pysyy tyhjana koko siirtyman');
        check(c2 === 0, lvl.toUpperCase() + ': ei kirjoitusklikkeja');
        check(!/suffer/i.test(B.notif()), lvl.toUpperCase() + ': ei varoitusilmoitusta (saanto 06)');
        if (lvl === 'normal') notifNormal = B.notif();
    }
    check(notifBad === notifNormal, 'BAD: ilmoituselementti tasmalleen sama kuin NORMALilla (ei uutta dialogia)');

    /* --- 3. Ulkoasu, teksti ja versioleimat ------------------------- */
    check(/#chaos-warning\s*\{[\s\S]*?color:\s*#ffe066/.test(cssSrc), 'style.css: varoitus on ohjeiden keltainen (#ffe066)');
    check(/#chaos-warning\s*\{[\s\S]*?white-space:\s*nowrap/.test(cssSrc), 'style.css: varoitus mahtuu yhdelle riville (nowrap)');
    check(/#chaos-warning\s*\{[\s\S]*?position:\s*absolute[\s\S]*?justify-content:\s*center/.test(cssSrc), 'style.css: varoitus on mustan keskella (absolute + flex)');
    check(/caret\.className = 'ins-caret'/.test(streetSrc), 'street.js: kursori on ohjeikkunan .ins-caret (sama vilkku)');
    check(/INS_TYPE_CLICK_EVERY === 0 && StreetAudio\.playTypeClick/.test(streetSrc), 'street.js: sama klik-aani (playTypeClick) kuin ohjeissa');
    check(/const BAD_WARN_LEVEL\s*=\s*'bad'/.test(streetSrc), 'street.js: varoitus vain BAD-tasolle');
    check(/if \(warn\) typeChaosWarning\(reveal\); else reveal\(\);/.test(streetSrc), 'street.js: muut tasot kulkevat entista polkua (else reveal)');
    check(ver.tagOk(htmlSrc), 'index.html: #version-tag ' + ver.VERSION);
    check(ver.stampsConsistent(htmlSrc), 'index.html: kaikki ?v=-leimat = ' + ver.NUM + ' (ei jaanteita)');
    check(ver.stamps(htmlSrc).length >= 4, 'index.html: ?v=-leimat (≥4 kpl, kaikki samassa numerossa)');
    check(/id="chaos-warning">You will suffer!</.test(htmlSrc), 'index.html: tekstia voi muuttaa HTML:sta');
    check(/typeChaosWarning\(reveal\)/.test(streetSrc), 'street.js: BAD-haara kutsuu typeChaosWarningia');
}

/* ============================ RAPORTTI ============================ */
function report() {
    console.log('');
    for (const m of oks) console.log('  OK   ' + m);
    for (const m of problems) console.log('  FAIL ' + m);
    console.log('');
    console.log('  Tulos: ' + oks.length + ' OK / ' + problems.length + ' ongelmaa');
    process.exit(problems.length ? 1 : 0);
}

main().then(() => report()).catch((e) => { console.error('AJOVIRHE:', e); process.exit(1); });





