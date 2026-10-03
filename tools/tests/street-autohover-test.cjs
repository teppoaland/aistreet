/* ═══════════════════════════════════════════════════════════════
   street-autohover-test.cjs – AUTOMAATTINEN HOVER-KIERROS (v11.03/v11.05)
     Valikon ("CHOOSE YOUR CHAOS LEVEL") auettua .auto-hover liukuu
     5 kaaosnapin yli ylhäältä alas: 1 s valikon avautumisesta,
     sen jälkeen 10 s välein, kunnes valikko suljetaan/valitaan.
     v11.05: viimeinen nappi (FULL CHAOS) jää päälle 2 s ja koko
     valikkonäyttö tärisee saman ajan (#chaos-menu.shaking).
     Oikea hover, valinta, reduce-motion, piilotettu välilehti,
     ohjeikkuna, ?autohover=0, ?chaos= ja F5.
   v11.17: askel 450 → 346 → 173 ms; reduce-motion ei estä kiertoa;
     mouseenter-peruutus vain (hover: hover) -laitteille, kosketuslaitteen
     vastine on touchstart (perheet L/N/M + lähdevahti).
   v11.27: reduce-motion-portit poistettu kokonaan (street.js:n motion-
     lippu + style.css:n @media-yliajo) → tärinä ajetaan myös
     puhelimilla, sama efekti kuin PC:llä. Ajoitusodotukset päivitetty
     173 ms askeleelle (vanhat olivat 346/450 ms ajalta).vastine on touchstart (perheet L/N/M + lähdevahti).
   Ajo: node street-autohover-test.cjs   (ei repossa, %TEMP%)
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = 'd:/AI/AI_street';
const streetSrc = require('./street-src.cjs');
const ver = require('./ver.cjs');
const audioSrc  = fs.readFileSync(path.join(ROOT, 'audio.js'), 'utf8');
const stateSrc  = fs.readFileSync(path.join(ROOT, 'gameState.js'), 'utf8');

const problems = [], oks = [];
const check = (c, m) => { if (c) oks.push(m); else problems.push(m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/* ═══ TESTIPENKKI (selain- ja audio-stubit) ═══════════════════════ */
function boot(search, opts) {
    opts = opts || {};
    const ctx = makeCtx();
    const winL = {}, cached = {}, listeners = {}, classLog = {};
    const localStore = {}, sessionStore = {};
    const t = { start: 0 };
    const rel = () => Math.round(Date.now() - (t.start || Date.now()));

    class FakeAudio {
        constructor(src) { this.src = src || ''; this.volume = 1; this.paused = true; this.currentTime = 0; this.loop = false; this.__ls = {}; }
        play() { this.paused = false; return Promise.resolve(); }
        pause() { this.paused = true; }
        addEventListener(ev, f) { (this.__ls[ev] = this.__ls[ev] || []).push(f); }
        removeEventListener() {} load() {} canPlayType() { return 'maybe'; }
    }

    function makeEl(id) {
        const classes = new Set(), log = [];
        classLog[id] = log;
        return {
            id, style: {}, dataset: {}, textContent: '', innerHTML: '', value: '', className: '',
            width: 800, height: 400, offsetWidth: 800, offsetHeight: 24, clientWidth: 1024, clientHeight: 700,
            classList: {
                add(c) { classes.add(c); log.push(['+', c, rel()]); },
                remove(c) { classes.delete(c); log.push(['-', c, rel()]); },
                toggle(c, on) { if (on === undefined) { classes.has(c) ? classes.delete(c) : classes.add(c); } else if (on) classes.add(c); else classes.delete(c); },
                contains(c) { return classes.has(c); }
            },
            __classes: classes,
            __log: log,
            addEventListener(ev, f) { (listeners[id] = listeners[id] || {}); (listeners[id][ev] = listeners[id][ev] || []).push(f); },
            removeEventListener() {}, focus() {}, blur() {}, appendChild() {}, removeChild() {},
            setAttribute() {}, getAttribute() { return null; }, remove() {}, insertBefore() {},
            scrollIntoView() {}, contains() { return false; },
            getBoundingClientRect() { return { left: 0, top: 0, right: 800, bottom: 400, width: 800, height: 400 }; },
            getContext() { return ctx; }, querySelector() { return null; }, querySelectorAll() { return []; }
        };
    }
    const canvasEl = makeEl('game-canvas');
    const zoneEl = makeEl('chaos-buttons-zone');      // .chaos-buttons (mouseenter-alue)
    const buttons = [];
    let seq = 0;
    for (const lvl of ['normal', 'mild', 'good', 'bad', 'full']) {
        const classes = new Set(), log = [];
        const b = {
            __level: lvl, __classes: classes, __log: log, __ls: {}, style: {},
            classList: {
                add(c) { classes.add(c); log.push(['+', c, ++seq, rel()]); },
                remove(c) { classes.delete(c); log.push(['-', c, ++seq, rel()]); },
                contains(c) { return classes.has(c); }
            },
            getAttribute: (n) => (n === 'data-level' ? lvl : null),
            addEventListener(ev, f) { (b.__ls[ev] = b.__ls[ev] || []).push(f); },
            removeEventListener() {}
        };
        buttons.push(b);
    }

    const documentStub = {
        hidden: false,
        getElementById(id) {
            if (id === 'game-canvas') return canvasEl;
            if (id === 'start-gate' && opts.gate === false) return null;
            return cached[id] || (cached[id] = makeEl(id));
        },
        querySelector(sel) {
            if (sel === '.chaos-buttons button:hover') return (opts.hoverIndex >= 0 ? buttons[opts.hoverIndex] : null);
            return null;
        },
        querySelectorAll() { return []; },
        createElement() { return makeEl('tmp' + Math.round(Math.random() * 1e6)); },
        addEventListener() {}, removeEventListener() {},
        body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head')
    };
    const menuEl = documentStub.getElementById('chaos-menu');
    menuEl.querySelectorAll = (sel) => ((sel === '[data-level]' || sel === '.chaos-buttons button') ? buttons : []);
    menuEl.querySelector = (sel) => (sel === '.chaos-buttons' ? zoneEl : null);

    const winStub = {
        addEventListener(ev, f) { (winL[ev] = winL[ev] || []).push(f); }, removeEventListener() {},
        AudioContext: fakeCtx, webkitAudioContext: fakeCtx,
        innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1,
        focus() {}, blur() {}, postMessage() {},
        /* v11.17: street.js kysyy kahta media-kyselyä – (prefers-reduced-motion:
           reduce) ja (hover: hover) – joten stub vastaa kyselyn mukaan.
           opts.touch = puhelin: ei hoveria ((hover: none)). */
        matchMedia: (q) => ({ matches: (String(q).indexOf('hover: hover') >= 0) ? !opts.touch : !!opts.reducedMotion,
                              addEventListener() {}, addListener() {}, removeEventListener() {}, removeListener() {} })
    };

    const sandbox = {
        console, setTimeout, clearTimeout, setInterval, clearInterval, Date, JSON, Math,
        performance: { now: () => Date.now() },
        requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
        innerWidth: 1024, innerHeight: 700,
        localStorage: { getItem: (k) => (k in localStore ? localStore[k] : null), setItem: (k, v) => { localStore[k] = String(v); }, removeItem: (k) => { delete localStore[k]; } },
        sessionStorage: { getItem: (k) => (k in sessionStore ? sessionStore[k] : null), setItem: (k, v) => { sessionStore[k] = String(v); }, removeItem: (k) => { delete sessionStore[k]; } },
        navigator: { userAgent: 'node', maxTouchPoints: 0, platform: 'node' },
        document: documentStub, window: winStub, location: { search, href: 'http://localhost/' + search },
        Audio: FakeAudio, AudioContext: fakeCtx, URLSearchParams, Image: function () {}, Uint8ClampedArray
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    if (opts.chaosSession) sessionStore['aistreet_chaos_session'] = opts.chaosSession;   // F5-simulaatio
    vm.runInContext(stateSrc, sandbox, { filename: 'gameState.js' });
    vm.runInContext(audioSrc, sandbox, { filename: 'audio.js' });
    vm.runInContext(streetSrc, sandbox, { filename: 'street.js' });

    const adds = (i) => buttons[i].__log.filter((x) => x[0] === '+' && x[1] === 'auto-hover');

    return {
        rel,
        domReady() { t.start = Date.now(); for (const f of (winL['DOMContentLoaded'] || []).slice()) f({}); },
        unlockGate() { for (const f of (winL['mousedown'] || []).slice()) f({}); },
        click(level) { const b = buttons.find((x) => x.__level === level); for (const f of (b.__ls['click'] || []).slice()) f({ preventDefault() {} }); },
        clickEl(id) { const ls = ((listeners[id] || {})['click'] || []).slice(); for (const f of ls) f({ preventDefault() {} }); return ls.length; },
        zoneEnter() { const ls = ((listeners['chaos-buttons-zone'] || {})['mouseenter'] || []).slice(); for (const f of ls) f({}); return ls.length; },
        /* v11.17: kosketuslaitteen vastine (touchstart) + kuuntelijoiden määrä */
        zoneListenerCount(type) { return ((listeners['chaos-buttons-zone'] || {})[type] || []).length; },
        zoneTouchFire() { const ls = ((listeners['chaos-buttons-zone'] || {})['touchstart'] || []).slice(); for (const f of ls) f({}); return ls.length; },
        setHidden(v) { documentStub.hidden = !!v; },
        adds(i) { return adds(i).length; },
        addAt(i, n) { const a = adds(i)[n || 0]; return a ? a[3] : -1; },
        removes(i) { return buttons[i].__log.filter((x) => x[0] === '-' && x[1] === 'auto-hover').length; },
        remAt(i, n) { const all = buttons[i].__log.filter((x) => x[0] === '-' && x[1] === 'auto-hover'); const a = (n === -1) ? all[all.length - 1] : all[n || 0]; return a ? a[3] : -1; },
        has(i) { return buttons[i].__classes.has('auto-hover'); },
        anyHover() { return buttons.some((b) => b.__classes.has('auto-hover')); },
        allAdds() { return buttons.map((b) => adds(buttons.indexOf(b)).length); },
        session() { return sessionStore; },
        has0(id, cls) { const e = documentStub.getElementById(id); return e.__classes ? e.__classes.has(cls) : false; },
        /* v11.05: näytön tärinä (#chaos-menu.shaking) */
        shakeLog(sign) { const e = documentStub.getElementById('chaos-menu'); return (e.__log || []).filter((x) => x[0] === sign && x[1] === 'shaking'); },
        shakeAdds() { return this.shakeLog('+').length; },
        shakeAt(n) { const a = this.shakeLog('+')[n || 0]; return a ? a[2] : -1; },
        shakeRemAt(n) { const all = this.shakeLog('-'); const a = (n === -1) ? all[all.length - 1] : all[n || 0]; return a ? a[2] : -1; },
        shaking() { return this.has0('chaos-menu', 'shaking'); }
    };
}
/* ═══ TESTIT ══════════════════════════════════════════════════════ */
async function main() {
    /* A: peruspolku (ei gatea) – 1 s valikon auettua, napit ylhäältä alas, 10 s sykli,
          valinta keskeyttää kierroksen */
    const A = boot('', { gate: false });
    A.domReady();
    await sleep(300);
    check(A.adds(0) === 0 && !A.anyHover(),
          'A: t=' + A.rel() + ' ms – efekti ei ala heti (odottaa 1 s valikon avautumisesta)');

    await sleep(1300);                    // ≈1600 ms → napit 1–4 käyty (173 ms askel), FULL CHAOS ei vielä (1692 ms)
    const mid = A.allAdds();
    check(mid[0] === 1 && mid[4] === 0 && (mid[1] + mid[2] + mid[3]) >= 2,
          'A: liuku käynnissä eikä FULL CHAOS vielä (' + mid.join('/') + ')');
    check(A.shakeAdds() === 0, 'A: näyttö ei tärise ennen FULL CHAOS -nappia (t=' + A.rel() + ' ms)');

    await sleep(1000);                    // ≈2600 ms → FULL CHAOS päällä + tärinä käynnissä
    check(A.has(4) && A.shaking(), 'A: FULL CHAOS jäi päälle ja näyttö tärisee (t=' + A.rel() + ' ms)');
    check(!A.has(0) && !A.has(1) && !A.has(2) && !A.has(3),
          'A: neljä edellistä nappia vapautuivat ennen FULL CHAOSin pitoa');

    await sleep(1600);                    // ≈4200 ms → pito (2 s, päättyi 3692 ms) ja tärinä päättyneet
    check(!A.has(4) && !A.shaking() && A.removes(4) >= 1,
          'A: FULL CHAOSin pito päättyi eikä jää päälle (t=' + A.rel() + ' ms)');
    /* HUOM: clearAutoHover() tyhjentää luokat myös jokaisen kierroksen alussa,
       joten pituus mitataan VIIMEISESTÄ poistosta (-1), ei ensimmäisestä. */
    const hold = A.remAt(4, -1) - A.addAt(4);
    check(hold >= 1850 && hold <= 2200, 'A: FULL CHAOS pysyi päällä ≈2 s (' + hold + ' ms)');
    const shake = A.shakeRemAt(-1) - A.shakeAt(0);
    check(shake >= 1850 && shake <= 2200, 'A: näytön tärinä kesti ≈2 s (' + shake + ' ms)');
    check(A.shakeAdds() === 1, 'A: tärinä ajettiin tasan kerran (' + A.shakeAdds() + ')');
    check([0, 1, 2, 3].every((i) => A.removes(i) >= 1),
          'A: myös .auto-hover poistettiin joka napilta (' + [0, 1, 2, 3, 4].map((i) => A.removes(i)).join('/') + ')');
    check(!A.anyHover(), 'A: liuku päättyi eikä jää päälle (t=' + A.rel() + ' ms)');

    const first = [0, 1, 2, 3, 4].map((i) => A.addAt(i));
    check(A.addAt(0) >= 950 && A.addAt(0) <= 1400,
          'A: efekti alkoi t=' + A.addAt(0) + ' ms valikon avautumisesta (tavoite 1000 ms)');
    check(first.every((v, i) => i === 0 || v > first[i - 1]),
          'A: järjestys on ylhäältä alas eli NO CHAOS → FULL CHAOS (' + first.join(' < ') + ' ms)');
    const step = A.addAt(1) - A.addAt(0);
    check(step >= 140 && step <= 240, 'A: askeleen pituus ≈173 ms (v11.17: 450 → 346 → 173) (' + step + ' ms)');
    check(A.addAt(4) - A.addAt(0) >= 620 && A.addAt(4) - A.addAt(0) <= 900,
          'A: viiden napin liuku ≈0,7 s (' + (A.addAt(4) - A.addAt(0)) + ' ms)');
    check(Math.abs(A.shakeAt(0) - A.addAt(4)) <= 3,
          'A: tärinä alkoi samalla hetkellä kun FULL CHAOS syttyi (' + A.shakeAt(0) + ' vs ' + A.addAt(4) + ' ms)');

    await sleep(5000);                    // ≈9200 ms
    check(A.adds(0) === 1, 'A: t=' + A.rel() + ' ms – ylimääräistä kierrosta ei tullut ennen 10 s');
    await sleep(2100);                    // ≈11300 ms → 2. kierros käynnissä (1 s + 10 s)
    const gap = A.addAt(0, 1) - A.addAt(0, 0);
    check(A.adds(0) === 2, 'A: toinen kierros alkoi (edellisestä ' + gap + ' ms)');
    check(gap >= 9800 && gap <= 10600,
          'A: kierros toistuu 10 s välein kierroksen alusta (' + gap + ' ms)');

    A.click('normal');                    // kesken 2. kierroksen
    check(!A.anyHover(), 'A: valinta poisti .auto-hover heti kaikilta napeilta');
    check(!A.shaking(), 'A: valinta ei jätä tärinää päälle');
    const cut = A.allAdds();
    check(A.adds(4) === 1, 'A: valinta katkaisi 2. kierroksen ennen nappia 5 (' + cut.join('/') + ')');
    await sleep(700);
    check(A.allAdds().join('/') === cut.join('/'),
          'A: valinnan jälkeen keskeytynyt liuku ei jatku (' + cut.join('/') + ' → ' + A.allAdds().join('/') + ')');
}

/* B/C: oikea osoitin (hiiri) voittaa aina */
async function mainB() {
    const B = boot('', { gate: false, hoverIndex: 2 });     // nappi 3 = GOOD on oikean osoittimen alla
    B.domReady();
    await sleep(3100);                    // ≈3200 ms → liuku ohi, FULL CHAOS päällä
    check(B.adds(2) === 0 && !B.has(2), 'B: oikean osoittimen alla oleva nappi (3 = GOOD) jätettiin väliin');
    check(B.adds(0) === 1 && B.adds(1) === 1 && B.adds(3) === 1 && B.adds(4) === 1,
          'B: muut 4 nappia saivat efektin normaalisti (' + B.allAdds().join('/') + ')');
    check(B.has(4) && B.shaking(), 'B: pito + tärinä ajetaan, vaikka osoitin on muualla napin päällä');

    /* C: osoitin valikkoalueelle keskeyttää käynnissä olevan liu'un heti */
    const C = boot('', { gate: false });
    C.domReady();
    await sleep(1060);                    // nappi 1 on juuri syttynyt
    check(C.adds(0) === 1, 'C: t=' + C.rel() + ' ms – liuku käynnissä (nappi 1 sai efektin)');
    const hit = C.zoneEnter();
    check(hit > 0, 'C: valikkoalueen mouseenter-kuuntelija löytyi (' + hit + ' kpl)');
    check(!C.anyHover(), 'C: oikea osoitin keskeytti liu\'un heti (auto-hover pois)');
    check(!C.shaking(), 'C: tärinä ei alkanut keskeytetyssä liu\'ussa');
    await sleep(500);
    check(C.allAdds()[1] === 0 && C.allAdds()[4] === 0 && !C.anyHover() && C.shakeAdds() === 0,
          'C: keskeytynyt liuku ei jatkanut seuraaviin nappeihin eikä tärinä lauennut (' + C.allAdds().join('/') + ')');
}

/* D: aloitusgate – efekti alkaa vasta kun valikko on oikeasti auennut (ei gaten aikana) */
async function mainD() {
    const D = boot('', {});               // gate mukana (oletus)
    D.domReady();
    check(!D.has0('start-gate', 'hidden'), 'D: aloitusgate näkyy ensin');
    await sleep(1500);
    check(D.adds(0) === 0 && !D.anyHover() && D.shakeAdds() === 0,
          'D: gaten aikana (valikko piilossa) efekti ei ala eikä näyttö tärise');
    D.unlockGate();
    const u = D.rel();
    await sleep(2400);                    // gate 2000 ms + efekti 1000 ms = 3000 ms
    check(D.adds(0) === 0, 'D: t=+' + (D.rel() - u) + ' ms avauksesta – valikko juuri avautui, efekti ei vielä');
    await sleep(900);                     // ≈3400 ms → liuku alkanut
    check(D.adds(0) === 1, 'D: t=+' + (D.rel() - u) + ' ms avauksesta – efekti alkoi valikon auettua');
    await sleep(1400);                    // ≈4700 ms → FULL CHAOS + tärinä (nappi 5 syttyi +3692, pito 2 s)
    check(D.has(4) && D.shaking(),
          'D: t=+' + (D.rel() - u) + ' ms avauksesta – FULL CHAOS + tärinä ajetaan myös gatesta tultaessa');
    await sleep(2200);                    // ≈6900 ms → pito (2 s, päättyi 5692 ms) päättynyt
    check(!D.has(4) && !D.shaking(),
          'D: t=+' + (D.rel() - u) + ' ms avauksesta – pito ja tärinä päättyivät eikä jää päälle');
}

/* E: esteettömyys, testikytkimet ja piilotettu välilehti */
async function mainE() {
    const E = boot('?autohover=0', { gate: false });
    E.domReady();
    await sleep(1500);
    check(E.adds(0) === 0 && !E.anyHover() && E.shakeAdds() === 0, 'E: ?autohover=0 – efekti ei käynnisty (testikytkin)');

    const F = boot('?chaos=normal', {});            // ?chaos= ohittaa hubin
    F.domReady();
    await sleep(1200);
    check(F.adds(0) === 0 && !F.anyHover() && F.shakeAdds() === 0, 'F: ?chaos=normal – hubia ei näytetä eikä efektiä ajeta');

    /* G (v11.27): reduce-motion ei enää estä MITÄÄN osaa – efekti on sama
       kuin liikkeen salliessa. Ennen v11.27 tärinä jäi pois sekä street.js:n
       motion-lipulla että style.css:n @media-yliajolla, joten moni Android
       ("poista animaatiot" / virransäästö) ei nähnyt tärinää lainkaan
       (= käyttäjän raportoima mobiilibugi). */
    const G = boot('', { gate: false, reducedMotion: true });
    G.domReady();
    await sleep(1600);                    // ≈1600 ms → napit 1–4 käyty
    check(G.adds(0) === 1 && G.adds(1) === 1, 'G: reduce-motion – efekti käynnistyi normaalisti (' + G.allAdds().join('/') + ')');
    await sleep(1000);                    // ≈2600 ms → FULL CHAOS + tärinä
    check(G.has(4) && G.shaking(), 'G: reduce-motion – FULL CHAOS + näytön tärinä ajetaan (v11.27, t=' + G.rel() + ' ms)');
    await sleep(1600);                    // ≈4200 ms → pito (2 s) päättynyt
    check(!G.anyHover() && !G.shaking() && G.shakeAdds() === 1,
          'G: reduce-motion – kierto päättyi ja tärinä ajettiin tasan kerran (' + G.shakeAdds() + ')');

    const H = boot('', { gate: false });
    H.domReady();
    H.setHidden(true);
    await sleep(1200);
    check(H.adds(0) === 0 && !H.anyHover() && H.shakeAdds() === 0, 'H: document.hidden – kierros ohitetaan kun välilehti on piilossa');
    H.setHidden(false);
}

/* I: ohjeikkuna (INSTRUCTIONS) auki → automaattihover ei aja sen päälle */
async function mainI() {
    const I = boot('', { gate: false });
    I.domReady();
    const bound = I.clickEl('instructions-link');
    check(bound > 0, 'I: INSTRUCTIONS-linkin klikkikuuntelija löytyi (' + bound + ' kpl)');
    await sleep(1400);
    check(I.adds(0) === 0 && !I.anyHover() && I.shakeAdds() === 0, 'I: ohjeikkunan ollessa auki automaattihover ohitetaan');
}

/* J: F5-soft reset – tallennettu kaaossessio → hubi ohitetaan, ei efektiä */
async function mainJ() {
    const J = boot('', { gate: false, chaosSession: JSON.stringify({ level: 'normal' }) });
    J.domReady();
    check(J.has0('chaos-menu', 'hidden'), 'J: F5 – valikko heti piilossa (session löytyi)');
    await sleep(1200);
    check(J.adds(0) === 0 && !J.anyHover() && J.shakeAdds() === 0, 'J: F5-reset – hubia ei näytetä eikä hover-kiertoa ajeta');
}

/* K: valinta kesken FULL CHAOSin pitoa → tärinä katkeaa heti eikä jää päälle */
async function mainK() {
    const K = boot('', { gate: false });
    K.domReady();
    await sleep(3100);                    // ≈3200 ms → pito + tärinä käynnissä (alkoivat 2800 ms)
    check(K.has(4) && K.shaking(), 'K: t=' + K.rel() + ' ms – FULL CHAOS -pito + näytön tärinä käynnissä');
    K.click('full');
    check(!K.shaking(), 'K: valinta kesken tärinän katkaisi tärinän heti');
    check(!K.anyHover(), 'K: valinta poisti myös FULL CHAOSin pidon');
    await sleep(1600);
    check(!K.shaking() && K.shakeAdds() === 1 && !K.anyHover(),
          'K: tärinä ei palaa eikä pito jää päälle valinnan jälkeen (tärinöitä ' + K.shakeAdds() + ')');
}

/* L/N/M: PUHELIN (v11.17)
     (hover: none) → synteettinen mouseenter ei voi tappaa liukua, koska
     peruutus kiinnitetään vain hoveroiville laitteille; kosketuslaitteen
     vastine on touchstart. reduce-motion (Androidin "poista animaatiot")
     ei enää (v11.27) vaikuta kumpaankaan osaan: myös tärinä ajetaan,
     joten puhelin näyttää saman efektin kuin PC. */
async function mainL() {
    const L = boot('', { gate: false, touch: true });
    L.domReady();
    check(L.zoneListenerCount('mouseenter') === 0, 'L: puhelin (hover: none) – mouseenter-peruutusta ei kiinnitetä (v11.17)');
    check(L.zoneListenerCount('touchstart') === 1, 'L: puhelin – touchstart-peruutus on kiinnitetty (v11.17)');
    await sleep(1300);                    // ≈1400 ms → liuku käynnissä (nappi 5 syttyy 1692 ms)
    const lmid = L.allAdds();
    check(lmid[0] === 1 && lmid[4] === 0, 'L: puhelimella liuku käynnistyi normaalisti (' + lmid.join('/') + ')');
    const cutL = L.zoneTouchFire();
    check(cutL === 1 && !L.anyHover() && !L.shaking(), 'L: täppäys nappialueelle keskeyttää liu\'un heti');
    await sleep(900);                     // ≈2300 ms → keskeytetty liuku ei jatkanut
    check(L.adds(3) === 0 && L.adds(4) === 0 && !L.anyHover() && L.shakeAdds() === 0,
          'L: keskeytetty liuku ei jatkanut eikä tärinä lauennut (' + L.allAdds().join('/') + ')');

    /* N: puhelin ilman reduce-motionia → koko kierto + tärinä ajetaan */
    const N = boot('', { gate: false, touch: true });
    N.domReady();
    await sleep(2600);                    // ≈2700 ms → FULL CHAOS päällä (pito 1692–3692)
    check(N.has(4) && N.shaking(), 'N: puhelimella FULL CHAOS + tärinä ajetaan');
    await sleep(2200);                    // ≈4900 ms → pito päättynyt
    check(!N.anyHover() && !N.shaking(), 'N: puhelimella pito päättyi eikä jää päälle');

    /* M: puhelin + reduce-motion = Androidin "poista animaatiot" (v11.27:
       sama efekti kuin ilman reduce-motionia – myös tärinä ajetaan) */
    const M = boot('', { gate: false, touch: true, reducedMotion: true });
    M.domReady();
    await sleep(2600);                    // ≈2700 ms → FULL CHAOS päällä
    check(M.adds(1) === 1 && M.adds(3) === 1 && M.has(4),
          'M: puhelin + reduce-motion – koko kierto ajetaan (' + M.allAdds().join('/') + ')');
    check(M.shaking(), 'M: puhelin + reduce-motion – näytön tärinä ajetaan nytkin (v11.27)');
    await sleep(2200);                    // ≈4900 ms → pito päättyi
    check(M.adds(4) === 1 && !M.anyHover() && !M.shaking() && M.shakeAdds() === 1,
          'M: puhelin + reduce-motion – tärinä ajettiin tasan kerran eikä jää päälle (' + M.shakeAdds() + ')');
}

/* LÄHDEVAHTI (v11.27): varmistaa, ettei reduce-motion-portti palaa kiertoon
   eikä tärinään, että askelväli on 173 ms ja että ohjeikkunan oma
   reduce-motion-lohko on ennallaan. */
async function mainSrc() {
    const src = streetSrc;
    const cssSrc = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    check(/const AUTO_HOVER_STEP_MS\s*=\s*173;/.test(src), 'LÄHDE: AUTO_HOVER_STEP_MS = 173 (v11.17)');
    check(!/if \(!AUTO_HOVER_ON \|\| insReducedMotion\(\) \|\| autoHoverNext\) return;/.test(src),
          'LÄHDE: startAutoHover ei enää estä kiertoa reduce-motionilla');
    check(!/const motion = !insReducedMotion\(\);/.test(src), 'LÄHDE: motion-lippu on poistettu (v11.27)');
    check(/if \(hold && autoHoverShakeEl\) \{/.test(src),
          'LÄHDE: shaking-luokka ajetaan ilman reduce-motion-porttia (v11.27)');
    check(src.indexOf('insReducedMotion() ? 0 : INS_OPEN_MS') >= 0,
          'LÄHDE: insReducedMotion() on yhä käytössä ohjeikkunan ajoituksissa');
    check(cssSrc.indexOf('#chaos-menu.shaking { animation: none') < 0
          && !/prefers-reduced-motion: reduce\)\s*\{\s*#chaos-menu\.shaking/.test(cssSrc),
          'LÄHDE: style.css ei enää sammuta tärinää reduce-motionissa (v11.27)');
    check(/#chaos-menu\.shaking \{\r?\n\s*animation: chaos-shake 2s linear both;/.test(cssSrc)
          && /@keyframes chaos-shake/.test(cssSrc),
          'LÄHDE: tärinä-animaatio ja keyframes ovat ennallaan');
    check(/@media \(prefers-reduced-motion: reduce\) \{\r?\n\s*#instructions-overlay,/.test(cssSrc),
          'LÄHDE: ohjeikkunan oma reduce-motion-lohko on tallella');
    check(/matchMedia\('\(hover: hover\)'\)/.test(src), 'LÄHDE: mouseenter-peruutus vain (hover: hover) -laitteille');
    check(/addEventListener\('touchstart', clearAutoHover, \{ passive: true \}\)/.test(src),
          'LÄHDE: kosketuslaitteen touchstart-peruutus on paikallaan');
    check(/AUTO_HOVER_HOLD_MS\s*=\s*2000;/.test(src), 'LÄHDE: FULL CHAOSin pito 2 s (ennallaan)');
    check(/AUTO_HOVER_REPEAT_MS\s*=\s*10000;/.test(src), 'LÄHDE: kierrosväli 10 s (ennallaan)');
    check(ver.tagOk(htmlSrc) && ver.stampsConsistent(htmlSrc) && htmlSrc.indexOf('style.css?v=' + ver.NUM) >= 0,
          'LÄHDE: versioleimat ' + ver.VERSION + ' (index.html, ?v= = #version-tag)');
}

main().then(mainB).then(mainD).then(mainE).then(mainI).then(mainJ).then(mainK).then(mainL).then(mainSrc).then(() => {
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

