/* ═══════════════════════════════════════════════════════════════
   street-traffic-rooms-test.cjs – v11.09 validointi (AI_street)
   TARKOITUS: kadun liikenne EI pysähdy, kun pelaaja on
     • BARissa            (barRoom)
     • makuuhuoneessa     (sleepRoom, myös nukkumisen pimennys)
     • kaivossa           (mhAction: putoaminen + kiipeäminen)
   Ennen v11.09: update() palasi näissä haaroissa ennen riviä
   `updateTraffic(dt)`, joten v.x seisoi → moottorin panorointi
   (lasketaan v.x:stä) jäi jumiin ("ääni jyrrää paikallaan") ja
   ajoneuvo palasi kadulle täsmälleen samasta kohdasta.
   LISÄKSI: auto ei saa tainnuttaa pelaajaa huoneessa (playerSafe),
   mutta kadulla / sanomalehteä lukiessa törmäys toimii ennallaan.
   Ajo: node %TEMP%\street-traffic-rooms-test.cjs
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = 'd:/AI/AI_street';
let streetSrc = require('./street-src.cjs');
const ver = require('./ver.cjs');
const stateSrc = fs.readFileSync(path.join(ROOT, 'gameState.js'), 'utf8');

const problems = [], oks = [];
const fail = (m) => problems.push(m);
const ok = (m) => oks.push(m);
const srcCount = (re, s) => { const m = s.match(re); return m ? m.length : 0; };

/* ── Testi-instrumentointi (VAIN tässä testissä): avaa sulkeuman,
      jotta ajoneuvojen sijainti ja tilaliput ovat luettavissa. ── */
const API_OLD = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };';
if (streetSrc.indexOf(API_OLD) < 0) {
    console.error('VIRHE: Street-API-riviä ei löytynyt – päivitä testi.');
    process.exit(2);
}
streetSrc = streetSrc.replace(API_OLD, `return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, __t: {
        vehX: () => vehicles.map(v => (v ? v.x : null)),
        laneY: () => LANE_DEFS.map(l => l.y),
        flags: () => ({ barRoom: barRoom, sleepRoom: sleepRoom, jukeboxRoom: jukeboxRoom, newsRoom: newsRoom, iframeOpen: iframeOpen, mhAction: !!manhole.action, sleepPhase: sleepPhase }),
        setFlags: (o) => {
            if ('barRoom' in o) barRoom = o.barRoom;
            if ('sleepRoom' in o) sleepRoom = o.sleepRoom;
            if ('jukeboxRoom' in o) jukeboxRoom = o.jukeboxRoom;
            if ('newsRoom' in o) newsRoom = o.newsRoom;
            if ('sleepPhase' in o) sleepPhase = o.sleepPhase;
        },
        setSpawn: (li, v) => { spawnTimers[li] = v; },
        clearVeh: () => { for (let i = 0; i < vehicles.length; i++) { if (vehicles[i]) stopVehicleEngine(vehicles[i].engine); vehicles[i] = null; } },
        placeVeh: (li, x, vx) => {
            const v = { type: 'car', x: x, y: LANE_DEFS[li].y, w: 80, h: 30, vx: (vx === undefined ? 0 : vx), direction: 1, hasHeadlight: true };
            v.engine = startVehicleEngine(v);
            vehicles[li] = v; updateVehicleEngine(v.engine, v);
            return v.x;
        },
        startMh: (idx) => { manhole.action = { idx: idx, phase: 'fall', t: MH_FALL_FRAMES }; },
        mhInfo: (idx) => ({ x: foreground.manholes[idx].x, y: foreground.manholes[idx].y }),
        player: () => ({ x: player.x, y: player.y, knockedDown: player.knockedDown, burgers: hamburgerCount, coins: coinCount }),
        setPlayer: (o) => { Object.assign(player, o); },
        burgers: () => hamburgerCount,
        setBurgers: (n) => { hamburgerCount = n; },
        setCoins: (n) => { coinCount = n; }
    } };`);

/* ── Web Audio -stubi: moottorin panorointi (pan) lokataan ─────────
   pan = (v.x / WORLD_W) * 2 − 1 → jos liikenne ei päivity, pan
   jämähtää paikalleen (käyttäjän raportoima "jyrräävä" ääni). ── */
let panLog = [];
let frameNo = 0;

function makeAudioCtx(getClock) {
    const n = (extra) => Object.assign({ connect() {}, disconnect() {} }, extra || {});
    const param = (v) => ({
        value: v, setValueAtTime() {}, linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {}, cancelScheduledValues() {}
    });
    return {
        state: 'running', destination: {}, sampleRate: 44100,
        get currentTime() { return getClock() / 1000; },
        resume() {},
        createOscillator() { return n({ type: 'sine', frequency: param(0), detune: param(0), start() {}, stop() {} }); },
        createGain() { return n({ gain: param(0) }); },
        createBiquadFilter() { return n({ type: 'lowpass', frequency: param(0), Q: param(0) }); },
        createWaveShaper() { return n({ curve: null, oversample: 'none' }); },
        createStereoPanner() { return n({ pan: { value: 0, setTargetAtTime(v) { panLog.push({ f: frameNo, v: v }); } } }); }
    };
}

function makeCtx() {
    return {
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
        font: '', textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0,
        imageSmoothingEnabled: true, lineCap: '', lineJoin: '',
        save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, setTransform() {}, resetTransform() {},
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, rect() {},
        quadraticCurveTo() {}, bezierCurveTo() {}, arcTo() {}, fill() {}, stroke() {}, clip() {},
        fillRect() {}, strokeRect() {}, clearRect() {},
        createRadialGradient() { return { addColorStop() {} }; },
        createLinearGradient() { return { addColorStop() {} }; },
        createPattern() { return null; },
        measureText(t) { return { width: String(t).length * 6 }; },
        fillText() {}, strokeText() {},
        drawImage() {}, setLineDash() {}, getLineDash() { return []; }
    };
}

/* ── Headless-käynnistys (sama tekniikka kuin muissa street-testeissä) ── */
function boot(opts) {
    opts = opts || {};
    let clock = 0, pending = null;
    let s = (opts.seed >>> 0) || 12345;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const store = {}, session = {}, winL = {}, docL = {}, cached = {};
    const audioCtx2 = makeAudioCtx(() => clock);
    const ctx2d = makeCtx();
    const canvasEl = {
        id: 'game-canvas', style: {}, width: 800, height: 400, tabIndex: 0, offsetHeight: 0,
        addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
        getContext() { return ctx2d; },
        getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }; }
    };
    const iframeEl = {
        src: '', onload: null, style: {},
        addEventListener() {}, removeEventListener() {}, blur() {}, focus() {},
        contentWindow: { focus() {}, blur() {}, postMessage() {} }
    };
    const makeEl = (id) => {
        const classes = new Set();
        return {
            id, style: { setProperty() {} }, offsetHeight: 0, offsetWidth: 0,
            clientWidth: 1024, clientHeight: 700, tabIndex: 0,
            textContent: '', innerHTML: '', value: '', src: '', disabled: false,
            classList: {
                add(c) { classes.add(c); }, remove(c) { classes.delete(c); },
                toggle(c, on) { if (on === undefined) { classes.has(c) ? classes.delete(c) : classes.add(c); } else if (on) classes.add(c); else classes.delete(c); },
                contains(c) { return classes.has(c); }
            },
            addEventListener(t, f) { const m = docL[id] || (docL[id] = {}); (m[t] = m[t] || []).push(f); },
            removeEventListener() {}, focus() {}, blur() {}, appendChild() {}, setAttribute() {},
            getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
            querySelector(sel) { return sel === 'iframe' ? iframeEl : null; },
            querySelectorAll() { return []; },
            play() { return { catch() {} }; }, pause() {}, load() {}
        };
    };

    const sandbox = {
        console, setTimeout, clearTimeout, Date, JSON, Float32Array, URLSearchParams,
        performance: { now: () => clock },
        location: { search: '', href: 'http://localhost/index.html' },
        requestAnimationFrame(cb) { pending = cb; return 1; },
        cancelAnimationFrame() {},
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        },
        sessionStorage: {
            getItem: (k) => (k in session ? session[k] : null),
            setItem: (k, v) => { session[k] = String(v); },
            removeItem: (k) => { delete session[k]; }
        },
        navigator: { maxTouchPoints: 0 },
        StreetAudio: new Proxy({
            init() {}, start() {}, stop() {}, getCtx() { return audioCtx2; },
            playDeathGong() {}, isJukeboxPlaying() { return false; }, getJukeboxQueuePos() { return 0; },
            playJukeboxQueue() { return true; }, appendJukeboxQueue() { return true; },
            setHungerTempo() {}, setMenuActive() {}, fadeOutMenuMusic() {},
            playChaosIntro() {}, playPanelOn() {}, playPanelOff() {}, playTypeClick() {}
        }, { get(t, p) { return (p in t) ? t[p] : () => {}; } }),
        window: {
            addEventListener(t, f) { (winL[t] = winL[t] || []).push(f); },
            removeEventListener() {}, focus() {}, blur() {}, postMessage() {},
            innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1,
            location: { search: '' },
            matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; }
        },
        document: {
            getElementById() { return null; },
            querySelector() { return null; }, querySelectorAll() { return []; },
            createElement() { return makeEl('tmp'); },
            addEventListener() {}, removeEventListener() {},
            body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head'),
            hidden: false, visibilityState: 'visible'
        }
    };
    sandbox.document.getElementById = (id) => (id === 'game-canvas' ? canvasEl : (cached[id] || (cached[id] = makeEl(id))));
    sandbox.window.document = sandbox.document;
    sandbox.window.top = sandbox.window;
    sandbox.Math = new Proxy(Math, { get(t, p) { return p === 'random' ? rnd : t[p]; } });
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(stateSrc, sandbox, { filename: 'gameState.js' });
    vm.runInContext('var __st = GameState.load();' +
        '__st.inventory.coinCount = ' + (opts.coins === undefined ? 20 : opts.coins) + ';' +
        '__st.inventory.hamburgerCount = ' + (opts.burgers === undefined ? 6 : opts.burgers) + ';' +
        'GameState.save(__st);', sandbox);
    vm.runInContext(streetSrc, sandbox, { filename: 'street.js' });
    const Street = vm.runInContext('Street', sandbox);
    Street.init(canvasEl);

    return {
        frame(n) {
            for (let i = 0; i < (n || 1); i++) {
                const cb = pending; pending = null;
                if (!cb) throw new Error('rAF-ketju katkesi');
                clock += 16.7;
                frameNo++;
                cb(clock);
            }
        },
        T: Street.__t, Street, sandbox, store
    };
}

/* ── Mittari: eteneekö ajoneuvo joka framella + päivittyykö pan ── */
function watch(t, li, frames) {
    const xs = [], pans = [];
    for (let i = 0; i < frames; i++) {
        const before = panLog.length;
        t.frame(1);
        xs.push(t.T.vehX()[li]);
        pans.push(panLog.length - before);
    }
    let frozen = 0, missed = 0, noPan = 0;
    for (let i = 0; i < xs.length; i++) {
        if (xs[i] === null) { missed++; continue; }
        if (i > 0 && xs[i - 1] !== null && Math.abs(xs[i] - xs[i - 1]) < 1e-9) frozen++;
        if (pans[i] === 0) noPan++;
    }
    return { xs: xs, frozen: frozen, missed: missed, noPan: noPan };
}

function movingCheck(label, r) {
    if (r.missed > 0) { fail(label + ': ajoneuvo katosi kesken mittauksen (' + r.missed + ' framea ilman ajoneuvoa)'); return; }
    if (r.frozen > 0) fail(label + ': LIIKENNE JÄÄTYI ' + r.frozen + ' framella (x ei muuttunut)');
    else ok(label + ': x eteni joka framella (' + r.xs.length + ' framea)');
    if (r.noPan > 0) fail(label + ': moottorin panorointia ei päivitetty ' + r.noPan + ' framella (ääni jyrräisi paikallaan)');
    else ok(label + ': moottoriäänen panorointi päivittyi joka framella');
}

/* ═══════════════════════════════════════════════════════════════
   1) KATU (baseline) – liikenne pyörii kuten ennenkin
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const t = boot({ seed: 11 });
    t.T.clearVeh(); t.T.setSpawn(0, 0);
    t.frame(2);
    if (t.T.vehX()[0] === null) { fail('Katu (baseline): ajoneuvoa ei spawnautunut'); return; }
    movingCheck('Katu (baseline)', watch(t, 0, 40));
})();

/* ═══════════════════════════════════════════════════════════════
   2) BAR-huone
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const t = boot({ seed: 12 });
    const T = t.T;
    T.clearVeh(); T.setSpawn(0, 0);
    T.setFlags({ barRoom: true });
    t.frame(2);
    if (!T.flags().barRoom) { fail('BAR: huone ei pysynyt auki (barRoom = false)'); return; }
    if (T.vehX()[0] === null) fail('BAR: liikenne ei pyöri huoneessa (ajoneuvoa ei spawnautunut)');
    else movingCheck('BAR-huone', watch(t, 0, 40));

    /* 2b) auto ei voi tainnuttaa pelaajaa huoneessa (playerSafe = true) */
    const yHit = T.laneY()[0] + 5;       // sama paikka, jossa katuosuma tapahtuu (ks. skenaario 5)
    T.setPlayer({ x: 100, y: yHit, knockedDown: false });
    T.placeVeh(0, 100);
    const b0 = T.burgers();
    t.frame(5);
    if (T.player().knockedDown || T.burgers() !== b0)
        fail('BAR: auto tainnutti pelaajan huoneessa (' + b0 + ' → ' + T.burgers() + ' 🍔)');
    else ok('BAR: auto ei voi tainnuttaa pelaajaa huoneessa (playerSafe)');
})();

/* ═══════════════════════════════════════════════════════════════
   3) Makuuhuone + nukkumisen pimennys
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const t = boot({ seed: 13 });
    const T = t.T;
    T.clearVeh(); T.setSpawn(0, 0);
    T.setFlags({ sleepRoom: true });
    t.frame(2);
    if (!T.flags().sleepRoom) { fail('Makuuhuone: huone ei pysynyt auki (sleepRoom = false)'); return; }
    if (T.vehX()[0] === null) fail('Makuuhuone: liikenne ei pyöri huoneessa (ajoneuvoa ei spawnautunut)');
    else movingCheck('Makuuhuone', watch(t, 0, 40));

    const yHit = T.laneY()[0] + 5;
    T.setPlayer({ x: 100, y: yHit, knockedDown: false });
    T.placeVeh(0, 100);
    const b0 = T.burgers();
    t.frame(5);
    if (T.player().knockedDown || T.burgers() !== b0)
        fail('Makuuhuone: auto tainnutti pelaajan huoneessa (' + b0 + ' → ' + T.burgers() + ' 🍔)');
    else ok('Makuuhuone: auto ei voi tainnuttaa pelaajaa huoneessa (playerSafe)');

    /* Nukkumisen pimennys (sleepPhase > 0): liikenne ei jäädy sekään ajaksi */
    T.clearVeh(); T.setSpawn(0, 0);
    t.frame(2);
    if (T.vehX()[0] === null) fail('Makuuhuone (pimennys): ajoneuvoa ei spawnautunut');
    else {
        T.setFlags({ sleepPhase: 6 });
        const r = watch(t, 0, 8);
        if (r.frozen > 0) fail('Makuuhuone (nukkumisen pimennys): liikenne jäätyi ' + r.frozen + ' framella');
        else ok('Makuuhuone (nukkumisen pimennys): liikenne pyörii koko pimennyksen ajan');
        if (T.flags().sleepRoom || T.flags().sleepPhase !== 0)
            fail('Makuuhuone (pimennys): pimennys ei päättynyt odotetusti');
        else ok('Makuuhuone (pimennys): sekvenssi päättyi normaalisti (huone sulkeutui)');
    }
})();

/* ═══════════════════════════════════════════════════════════════
   4) Kaivo (mhAction: putoaminen + kiipeäminen)
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const t = boot({ seed: 14 });
    const T = t.T;
    T.clearVeh(); T.setSpawn(0, 0);
    t.frame(2);
    if (T.vehX()[0] === null) { fail('Kaivo: ajoneuvoa ei spawnautunut'); return; }
    const mh = T.mhInfo(0);
    T.setPlayer({ x: mh.x, y: mh.y - 30, knockedDown: false });
    const b0 = T.burgers();
    T.startMh(0);
    if (!T.flags().mhAction) { fail('Kaivo: mhAction ei käynnistynyt'); return; }
    const r = watch(t, 0, 60);          // 36 framea pudotusta + kiipeämisen alku
    if (r.frozen > 0) fail('Kaivo (putoaminen/kiipeäminen): liikenne jäätyi ' + r.frozen + ' framella');
    else ok('Kaivo (putoaminen + kiipeäminen): liikenne pyörii koko sekvenssin');
    if (T.burgers() !== b0) fail('Kaivo: 🍔-määrä muuttui kesken sekvenssin (' + b0 + ' → ' + T.burgers() + ')');
    else ok('Kaivo: auto ei tainnuttanut pelaajaa kesken sekvenssin (🍔 ennallaan)');
    t.frame(260);
    if (T.flags().mhAction) fail('Kaivo: sekvenssi ei päättynyt (mhAction yhä päällä)');
    else ok('Kaivo: sekvenssi päättyi normaalisti');
})();

/* ═══════════════════════════════════════════════════════════════
   5) Regressio: sanomalehti (newsRoom) – törmäys toimii yhä,
      koska siellä playerSafe = false (pelaaja on kadulla)
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const t = boot({ seed: 15 });
    const T = t.T;
    T.setFlags({ newsRoom: true });
    T.setPlayer({ x: 100, y: T.laneY()[0] + 5, knockedDown: false });
    T.placeVeh(0, 100);
    const b0 = T.burgers();
    t.frame(1);
    if (!T.player().knockedDown) fail('Sanomalehti (regressio): auto ei enää osu kadulla olevaan pelaajaan');
    else if (T.burgers() !== b0 - 1) fail('Sanomalehti (regressio): 🍔-vähennys väärä (' + b0 + ' → ' + T.burgers() + ')');
    else ok('Sanomalehti (regressio): törmäys toimii ennallaan (playerSafe = false)');
})();

/* ═══════════════════════════════════════════════════════════════
   6) Lähde-invariantit (sääntö 06: ei uusia dialogeja) + versioleimat
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const s = require('./street-src.cjs');
    const c = srcCount(/StreetTraffic\.update\(dt, true\)/g, s);
    if (c !== 5) fail('Lähde: updateTraffic(dt, true) -kutsuja odotettiin 5 (kaivo, makuuhuone, BAR, jukebox, tainnutus v11.12), löytyi ' + c);
    else ok('Lähde: 5 kutsua (kaivo, makuuhuone, BAR, jukebox, tainnutus)');
    /* Vaihe 1e (v11.38): kaivon haara on omassa funktiossaan
       (updateManholeSequence) ja sen `return;` on portti `return true;`
       (kutsuja: `if (updateManholeSequence(dt)) return;`). */
    if (s.indexOf('if (manhole.action) { StreetTraffic.update(dt, true); updateManholeAction(dt); return true; }') < 0)
        fail('Lähde: kaivon haarassa ei päivitetä liikennettä');
    /* Vaihe 5 osa 8 (v11.44): huoneiden logiikka siirtyi street/rooms.js:ään,
       jossa tila sidotaan ENV.-etuliitteellä → sallitaan molemmat muodot.
       Vaihe 6: versiomerkintä poistui kommentista, joten sitä ei enää vaadita. */
    if (!/if \((?:ENV\.)?sleepRoom\) \{\s*\n\s*\/\* LIIKENNE EI PYSÄHDY/.test(s))
        fail('Lähde: makuuhuoneen liikennekutsu puuttuu');
    if (!/if \((?:ENV\.)?barRoom\) \{\s*\n\s*\/\* LIIKENNE EI PYSÄHDY/.test(s))
        fail('Lähde: BARin liikennekutsu puuttuu');
    const notif = srcCount(/showNotification/g, s);
    /* 15 (v11.37) → 18 (v11.44): itse KUTSUT eivät lisääntyneet (13 ennen ja
       jälkeen – 5 muutti rooms.js:ään), mutta laskuri on karkea ja laskee myös
       maininnat: siirretyt kutsut (5, ENV.showNotification) + bind-rivi
       street.js:ssä (1) + moduulin otsikkolista (1). Yksi uusi kutsu → 19. */
    if (notif !== 18) fail('Lähde: showNotification-määrä muuttui (' + notif + ', odotettu 18) – sääntö 06 (kutsut 13, loput mainintoja)');
    else ok('Lähde: ei uusia dialogeja (showNotification 18 mainintaa = 13 kutsua + 5 mainintaa, ennallaan)');

    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    /* Vaihe 5: skriptitiedostoja voi olla 4 tai enemmän (street/-osat) → tarkistetaan
       lukumäärän sijaan, että KAIKKI ?v=-leimat ovat samassa numerossa kuin tag. */
    const stamps = ver.stamps(html).length;
    if (stamps < 4) fail('index.html: ?v=-leimoja odotettiin vähintään 4, löytyi ' + stamps);
    if (!ver.tagOk(html)) fail('index.html: #version-tag ei ole ' + ver.VERSION);
    if (stamps >= 4 && ver.tagOk(html) && ver.stampsConsistent(html))
        ok('index.html: versio ' + ver.VERSION + ' (leimat samassa numerossa)');
})();

/* ── Raportti ── */
console.log('\n══════ v11.09 – liikenne ei pysähdy huoneissa ══════');
oks.forEach((o) => console.log('  ✔ ' + o));
problems.forEach((p) => console.log('  ✘ ' + p));
console.log('\nTulos: ' + oks.length + ' OK, ' + problems.length + ' löydöstä');
process.exit(problems.length ? 1 : 0);
