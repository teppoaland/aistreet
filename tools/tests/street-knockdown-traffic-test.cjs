/* ═══════════════════════════════════════════════════════════════
   street-knockdown-traffic-test.cjs – v11.10/v11.12 validointi (AI_street)
   TARKOITUS (v11.10): kadun liikenne EI pysähdy tainnutuksessa, kun
   kaataja ei ollut auto (sähkökaappi, rosvo, kukkaruukku, lamppu,
   oviukko). Vain auton osuma on kolari → silloin liikenne seisoo koko
   tainnutuksen ajan (ennallaan).
   POHJANA (v11.09, regressio mukana): kadun liikenne EI pysähdy, kun
   pelaaja on
     • BARissa            (barRoom)
     • makuuhuoneessa     (sleepRoom, myös nukkumisen pimennys)
     • kaivossa           (mhAction: putoaminen + kiipeäminen)
   Ennen v11.09: update() palasi näissä haaroissa ennen riviä
   `updateTraffic(dt)`, joten v.x seisoi → moottorin panorointi
   (lasketaan v.x:stä) jäi jumiin ("ääni jyrrää paikallaan") ja
   ajoneuvo palasi kadulle täsmälleen samasta kohdasta.
   LISÄKSI: auto ei saa tainnuttaa pelaajaa huoneessa (playerSafe),
   mutta kadulla / sanomalehteä lukiessa törmäys toimii ennallaan.
   LISÄKSI (v11.12): kolarin putoamistaso on 25 px ylös osumakohdasta
   (v4.78: 10 px) → tainnutuksen aikana paikalleen jäänyt auto ei osu
   heti uudelleen, kun pelaaja nousee ylös (skenaario 10).
   Kontrolli vanhalla arvolla (10 px) – uudelleen osumia PITÄÄ näkyä:
     $env:STREET_KNOCK_LIFT="10"; node %TEMP%\street-knockdown-traffic-test.cjs
   Ajo: node %TEMP%\street-knockdown-traffic-test.cjs
   Esikorjaus-kontrolli (bugi pitää näkyä):
     $env:STREET_ROOT="$env:TEMP\v1110-precheck"; $env:STREET_EXPECT_BUG="1";
     node %TEMP%\street-knockdown-traffic-test.cjs
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.STREET_ROOT || 'd:/AI/AI_street';
const EXPECT_BUG = process.env.STREET_EXPECT_BUG === '1';   // esikorjaus-kontrolli
let streetSrc = require('./street-src.cjs');
const ver = require('./ver.cjs');

/* v11.12-kontrolli: aja sama paketti vanhalla putoamistasolla (10 px).
   Silloin odotus käännetään: uudelleen osumia PITÄÄ näkyä (skenaario 10). */
const KNOCK_LIFT = process.env.STREET_KNOCK_LIFT || '25';
const EXPECT_OLD_LIFT = KNOCK_LIFT !== '25';
if (EXPECT_OLD_LIFT) {
    const NEW_LINE = 'player.knockFallY = player.y + player.h - 25;';
    const OLD_LINE = 'player.knockFallY = player.y + player.h - ' + KNOCK_LIFT + ';';
    if (streetSrc.indexOf(NEW_LINE) < 0) {
        console.error('VIRHE: v11.12:n putoamistasoriviä (−25) ei löytynyt – päivitä testi.');
        process.exit(2);
    }
    streetSrc = streetSrc.replace(NEW_LINE, OLD_LINE);
    if (streetSrc.indexOf(OLD_LINE) < 0) { console.error('VIRHE: kontrollipatch ei onnistunut.'); process.exit(2); }
}
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
        setCoins: (n) => { coinCount = n; },
        /* v11.10: tainnutus + liikenne */
        knock: () => ({ knockedDown: player.knockedDown, knockFallY: player.knockFallY, timer: player.knockdownTimer }),
        resetKnock: () => { player.knockedDown = false; player.knockdownTimer = 0; player.knockFallY = undefined; },
        playerBox: () => ({ w: player.w, h: player.h }),
        cabinets: () => electricCabinets.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h, on: c.on })),
        setCab: (i, on) => { electricCabinets[i].on = on; },
        setRobber: (o) => {
            robber = Object.assign({
                x: 0, y: ROBBER_FOOT_Y - ROBBER_H, w: ROBBER_W, h: ROBBER_H,
                facing: 1, dir: 1, speed: 1, pause: 0, walkTimer: 0, ttl: 99999
            }, o || {});
            return { x: robber.x, y: robber.y };
        },
        robberPos: () => (robber ? { x: robber.x, y: robber.y, ttl: robber.ttl } : null),
        clearRobber: () => { robber = null; robberCooldown = 999999; }
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
        location: { search: '?cabs=1', href: 'http://localhost/index.html' },
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
            location: { search: '?cabs=1&hole=0' },
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

/* ── v11.10: tainnutus (ei auton aiheuttama) – liikenne EI saa jäätyä.
   Esikorjauskontrollissa (EXPECT_BUG) odotus käännetään: silloin bugi
   pitää näkyä eli liikenteen pitää jäätyä. */
function expectKnockMoving(label, r) {
    if (EXPECT_BUG) {
        if (r.frozen > 0) ok('ESIKORJAUS vahvistettu: ' + label + ' – liikenne jäätyi ' + r.frozen + ' framella (bugi näkyy)');
        else fail('ESIKORJAUS: ' + label + ' – bugia EI havaittu (liikenne pyöri ilman korjausta)');
        return;
    }
    if (r.missed > 0) { fail(label + ': ajoneuvo katosi kesken mittauksen (' + r.missed + ' framea ilman ajoneuvoa)'); return; }
    if (r.frozen > 0) fail(label + ': LIIKENNE JÄÄTYI ' + r.frozen + ' framella tainnutuksen aikana (x ei muuttunut)');
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
    if (EXPECT_BUG) {
        ok('Esikorjaus-kontrolli: lähde-invariantit ja versioleimat ohitettu (korjaus poistettu kopiosta)');
    } else {
        if (c !== 5) fail('Lähde: updateTraffic(dt, true) -kutsuja odotettiin 5 (kaivo, makuuhuone, BAR, jukebox, tainnutus), löytyi ' + c);
        else ok('Lähde: 5 kutsua (kaivo, makuuhuone, BAR, jukebox, tainnutus)');
        if (s.indexOf('if (player.knockFallY === undefined) StreetTraffic.update(dt, true);') < 0)
            fail('Lähde: tainnutushaaran liikennekutsu puuttuu (v11.10)');
        else ok('Lähde: tainnutushaara päivittää liikennettä, kun kaataja ei ole auto');
        const kfSet = srcCount(/player\.knockFallY = (?!undefined)/g, s);
        const kfClr = srcCount(/player\.knockFallY = undefined/g, s);
        if (kfSet !== 1) fail('Lähde: knockFallY-asetuksia (arvo) odotettiin 1 (vain auton osuma), löytyi ' + kfSet);
        else ok('Lähde: knockFallY asetetaan arvolla vain auton osumassa (merkki kolarista)');
        if (kfClr !== 1) fail('Lähde: knockFallY-nollauksia odotettiin 1 (ylösnousu), löytyi ' + kfClr);
        /* Vaihe 5 osa 7 (v11.42): rivi muutti street/traffic.js-moduuliin, jossa
           pelaaja sidotaan H.player-nimellä → sallitaan molemmat muodot. */
        if (!/(?:H\.)?player\.knockFallY = (?:H\.)?player\.y \+ (?:H\.)?player\.h - 25;/.test(s))
            fail('Lähde: v11.12:n putoamistaso (osumakohta −25 px) puuttuu');
        else ok('Lähde: kolarin putoamistaso −25 px (v11.12; v4.78 oli −10 px)');
        /* Oviukon 3 s hit-stop (AVENGER_FREEZE 180) säilyy: globaali jäädytys
           tulee ennen tainnutushaaraa, eikä sitä muutettu v11.10:ssä. */
        if (srcCount(/hitPauseTimer = AVENGER_FREEZE;/g, s) !== 1)
            fail('Lähde: oviukon hit-stop (hitPauseTimer = AVENGER_FREEZE) puuttuu');
        else ok('Lähde: oviukon 3 s hit-stop ennallaan (AVENGER_FREEZE 180 f)');
        const hpIdx = s.indexOf('if (hitPauseTimer > 0) { hitPauseTimer -= dt; return; }');
        /* Vaihe 1 (v11.38): tainnutushaara on omassa funktiossaan
           (updateKnockedDown) – sama tarkoitus: hit-stop on ennen sitä ja
           liikennekutsu (knockFallY) on tallella haaran sisällä. */
        const kdIdx = s.indexOf('if (updateKnockedDown(dt)) return;');
        const kdCall = s.indexOf('if (player.knockFallY === undefined) StreetTraffic.update(dt, true);');
        if (hpIdx < 0 || kdIdx < 0 || !(hpIdx < kdIdx))
            fail('Lähde: hit-stopin ja tainnutushaaran järjestys muuttui');
        else if (kdCall < 0)
            fail('Lähde: tainnutushaaran liikennekutsu (knockFallY) puuttuu');
        else ok('Lähde: hit-stop ennakoi tainnutushaaraa – oviukon jäädytys ei kärsi');
    }
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
    /* 15 (v11.37) → 18 (v11.44): kutsut ennallaan (13), mutta laskuri laskee
       myös maininnat: siirretyt kutsut rooms.js:ssä (5) + bind-rivi (1) +
       moduulin otsikkolista (1). Yksi uusi kutsu → 19. */
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

/* ═══════════════════════════════════════════════════════════════
   7) ⚡ SÄHKÖKAAPPI (v11.10): isku ei pysäytä liikennettä
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const t = boot({ seed: 21, burgers: 6, coins: 20 });
    const T = t.T;
    T.clearRobber();
    T.clearVeh(); T.setSpawn(0, 0);
    const cab = T.cabinets()[0];
    if (!cab.on) { fail('Kaappi: ?cabs=1 ei pakottanut kaappia päälle – testi ei voi ajaa'); return; }
    T.placeVeh(0, 60, 1);                       // kaista 0 (y=340), tasainen 1 px/frame
    const pb = T.playerBox();
    const b0 = T.burgers(), c0 = T.player().coins;
    // Osumaehto (update): x < cab.x + cab.w && x + w > cab.x && y < cab.y && y + h > cab.y
    T.setPlayer({ x: cab.x - 2, y: cab.y - Math.round(pb.h / 4), knockedDown: false, knockFallY: undefined });
    t.frame(1);
    const k = T.knock();
    if (!k.knockedDown) fail('Kaappi: sähköisku ei tainnuttanut pelaajaa (skenaario ei aja)');
    else ok('Kaappi: sähköisku tainnutti pelaajan (🍔 ' + b0 + ' → ' + T.burgers() + ')');
    if (k.knockFallY !== undefined) fail('Kaappi: knockFallY asetettu → sääntö luulisi kolariksi');
    else ok('Kaappi: knockFallY ei ole asetettu (ei auton osuma)');
    if (T.burgers() !== b0 - 1) fail('Kaappi: 🍔-vähennys väärä (' + b0 + ' → ' + T.burgers() + ')');
    if (T.player().coins !== c0) fail('Kaappi: kolikkosaldo muuttui (ei kuulu iskuun)');
    if (!(k.timer > 0)) fail('Kaappi: tainnutusajastin ei käynnistynyt');
    const b1 = T.burgers();
    expectKnockMoving('Sähkökaappi (TAINNUTUS)', watch(t, 0, 30));
    if (T.burgers() !== b1) fail('Kaappi: 🍔 putosi uudelleen kesken tainnutuksen (' + b1 + ' → ' + T.burgers() + ')');
    else ok('Kaappi: makaavaan pelaajaan ei tullut uutta osumaa (🍔 ennallaan)');
})();

/* ═══════════════════════════════════════════════════════════════
   8) 🧤 ROSVO (v11.10): kiinniotto ei pysäytä liikennettä
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const t = boot({ seed: 22, burgers: 6, coins: 20 });
    const T = t.T;
    T.clearRobber();
    T.clearVeh(); T.setSpawn(0, 0);
    T.placeVeh(1, 200, 1);                      // kaista 1 (y=328)
    const pb = T.playerBox();
    // Jalkakäytäväkaista: jalat 310…326 → rosvo voi napata, auto ei osu (raja 343)
    T.setPlayer({ x: 120, y: 314 - pb.h, knockedDown: false, knockFallY: undefined });
    t.frame(2);
    if (T.robberPos() !== null) fail('Rosvo: yllätysrosvo ilmestyi itsestään testin aikana');
    const p = T.player();
    T.setRobber({ x: p.x, y: p.y });             // rosvo kiinni pelaajassa (etäisyys 0 < ROBBER_HIT_R)
    const b0 = T.burgers(), c0 = p.coins;
    t.frame(1);
    const k = T.knock();
    if (!k.knockedDown) fail('Rosvo: kiinniotto ei tainnuttanut pelaajaa (skenaario ei aja)');
    else ok('Rosvo: kiinniotto tainnutti pelaajan (🍔 ' + b0 + ' → ' + T.burgers() + ')');
    if (k.knockFallY !== undefined) fail('Rosvo: knockFallY asetettu → sääntö luulisi kolariksi');
    else ok('Rosvo: knockFallY ei ole asetettu (ei auton osuma)');
    if (T.player().coins !== 0) fail('Rosvo: kolikoita ei viety (v4.68-regressio: ' + T.player().coins + ' jäljellä)');
    else ok('Rosvo: rosvo vei kaikki kolikot (v4.68 ennallaan, ' + c0 + ' → 0)');
    if (!(k.timer > 500)) fail('Rosvo: tainnutusaika ei ole pidennetty (ROBBER_STUN), ' + k.timer);
    else ok('Rosvo: tainnutus kestää pidennetyn ajan (' + Math.round(k.timer) + ' framea)');
    const b1 = T.burgers();
    expectKnockMoving('Rosvo (TAINNUTUS)', watch(t, 1, 30));
    if (T.burgers() !== b1) fail('Rosvo: 🍔 putosi uudelleen kesken tainnutuksen (' + b1 + ' → ' + T.burgers() + ')');
    else ok('Rosvo: makaavaan pelaajaan ei tullut uutta osumaa (🍔 ennallaan)');
})();

/* ═══════════════════════════════════════════════════════════════
   9) 🚗 AUTO (kolari): liikenne PYSÄHTYY – kolariin osallinen
      (haluttu käytös: sama ennen ja jälkeen v11.10)
   ═══════════════════════════════════════════════════════════════ */
(function () {
    const t = boot({ seed: 23, burgers: 6 });
    const T = t.T;
    T.clearRobber();
    T.clearVeh(); T.setSpawn(0, 0);
    T.placeVeh(0, 100, 1);
    T.setPlayer({ x: 100, y: T.laneY()[0] + 5, knockedDown: false, knockFallY: undefined });
    t.frame(1);
    const k = T.knock();
    if (!k.knockedDown) { fail('Auto: törmäys ei tainnuttanut pelaajaa (skenaario ei aja)'); return; }
    if (k.knockFallY === undefined) fail('Auto: knockFallY puuttuu → kolaria ei tunnistettaisi');
    else ok('Auto: knockFallY asetettu (kolari tunnistetaan)');
    const r = watch(t, 0, 30);
    if (r.frozen < 28) fail('Auto (kolari): liikenne ei pysähtynyt – jäissä vain ' + r.frozen + '/29 framea');
    else ok('Auto (kolari): liikenne seisoo koko tainnutuksen ajan (' + r.frozen + '/29 framea jäissä)');
    const b2 = T.burgers();
    /* Auto pois pelaajan päältä ennen ylösnousua: jäätynyt auto jäisi muuten
       makaavan pelaajan päälle ja v4.78:n mukainen uusi törmäys (uusi −1 🍔)
       vääristäisi "liikenne jatkuu" -mittauksen. */
    T.placeVeh(0, 300, 1);
    let guard = 0;
    while (T.knock().knockedDown && guard < 1200) { t.frame(1); guard++; }
    if (T.knock().knockedDown) fail('Auto: tainnutus ei päättynyt (1100+ framea, timer=' + Math.round(T.knock().timer) + ')');
    else ok('Auto: tainnutus päättyi kuten ennenkin (' + (guard + 31) + ' framea ≈ 600 f)');
    if (T.burgers() !== b2) fail('Auto: pelaaja sai uuden osuman liikenteen ollessa jäissä (🍔 ' + b2 + ' → ' + T.burgers() + ')');
    else ok('Auto: liikennettä ei päivitetty tainnutuksen aikana eikä uutta osumaa tullut (🍔 ennallaan)');
    if (T.knock().knockFallY !== undefined) fail('Auto: knockFallY ei nollautunut ylösnoustessa (v4.78-regressio)');
    const r2 = watch(t, 0, 20);
    if (r2.frozen > 0) fail('Auto: liikenne ei jatkanut tainnutuksen jälkeen (jäätyi ' + r2.frozen + ' framella)');
    else ok('Auto: tainnutuksen päätyttyä liikenne jatkuu normaalisti');
})();

/* ═══════════════════════════════════════════════════════════════
   10) 🚗 KOLARIN JÄLKEINEN UUDELLEEN OSUMA (v11.12)
       Auton osuma nostaa putoamistason 25 px ylös osumakohdasta
       (v4.78: 10 px). Kolari jäädyttää liikenteen → auto jää
       paikalleen makaavan pelaajan päälle, joten ylösnoustessa
       pelaaja sai herkästi heti uuden osuman (−1 🍔). +15 px nosto
       poistaa tämän tavanomaisilla seisontasyvyyksillä.
       Mittaus: aseta pelaaja syvyydelle y, aja auto päälle, päästä
       tainnutus (600 f) loppuun ja katso, putoaako 🍔 uudelleen.
       Osumaehto (updateTraffic): jalat > kaistan y + auton h/2
       (kaista 0: 355, kaista 1: 343) ja y < 347 (aita)
       → hit-y:t kaista 0: 326…346, kaista 1: 314…334.
   ═══════════════════════════════════════════════════════════════ */
function reHitProbe(lane, y) {
    const t = boot({ seed: 400 + y, burgers: 20, coins: 20 });
    const T = t.T;
    T.clearRobber();
    T.clearVeh();
    T.setSpawn(0, 999999); T.setSpawn(1, 999999);                 // ei uusia spawnauksia
    const cabs = T.cabinets();
    for (let i = 0; i < cabs.length; i++) T.setCab(i, false);     // kaapit pois (ei sähköiskua)
    const pb = T.playerBox();
    T.setPlayer({ x: 100, y: y, knockedDown: false, knockFallY: undefined });
    T.placeVeh(lane, 60, lane === 0 ? 1 : -1);                    // auto pelaajan kohdalle
    t.frame(1);
    const k1 = T.knock();
    if (!k1.knockedDown) return { hit: false, y: y };
    const b1 = T.burgers();
    t.frame(605);                                                 // 600 f tainnutus + 5 f
    const b2 = T.burgers();
    return { hit: true, y: y, feet: y + pb.h, fallY: k1.knockFallY, standY: T.player().y,
             reHit: (b2 < b1) || T.knock().knockedDown };
}

function liftSweep(lane, from, to) {
    const hits = [], reHits = [];
    for (let y = from; y <= to; y++) {
        const r = reHitProbe(lane, y);
        if (!r.hit) continue;
        hits.push(y);
        if (r.reHit) reHits.push(y);
    }
    return { hits: hits, reHits: reHits };
}

(function () {
    const z0 = liftSweep(0, 326, 340);   // tavanomainen seisontavyöhyke, kaista 0
    const z1 = liftSweep(1, 314, 328);   // tavanomainen seisontavyöhyke, kaista 1
    const d0 = liftSweep(0, 341, 346);   // syvin mahdollinen (aivan aidan juuressa)
    const d1 = liftSweep(1, 329, 334);
    const normal = z0.reHits.length + z1.reHits.length;
    const deep = d0.reHits.length + d1.reHits.length;
    const hitCount = z0.hits.length + z1.hits.length;
    const LIFT = EXPECT_OLD_LIFT ? 10 : 25;

    if (hitCount < 10) fail('Kolari-ikkuna: osumia löytyi vain ' + hitCount + ' (mittaus ei toimi)');
    else ok('Kolari-ikkuna: osuma syntyi ' + hitCount + ' syvyydellä (kaista 0 ' + z0.hits.length + ', kaista 1 ' + z1.hits.length + ')');

    const zoneTxt = 'kaista 0: [' + (z0.reHits.join(',') || '–') + '], kaista 1: [' + (z1.reHits.join(',') || '–') + ']';
    if (EXPECT_OLD_LIFT) {
        if (normal > 0) ok('KONTROLLI (' + LIFT + ' px): uudelleen osumia ' + normal + ' kpl → bugi näkyy ilman v11.12-korjausta · ' + zoneTxt);
        else fail('KONTROLLI (' + LIFT + ' px): uudelleen osumia ei havaittu – rivi ei vaikuta mittaukseen');
    } else if (normal > 0) {
        fail('Kolari → ylösnousu: uudelleen osumia ' + normal + ' kpl tavanomaisilla syvyyksillä · ' + zoneTxt);
    } else {
        ok('Kolari → ylösnousu (v11.12, −25 px): EI uudelleen osumia tavanomaisilla syvyyksillä · ' + zoneTxt);
    }
    /* Syvimmät osumat (pelaaja aivan aidan juuressa) raportoidaan tiedoksi –
       niissä pelaaja seisoo jo kiinni aidassa, eivätkä ne ole tavanomaista
       kadulla kävelyä. */
    ok('Kolari-ikkuna (tiedoksi): syvin vyöhyke ' + (d0.hits.length + d1.hits.length) +
       ' osumaa → uudelleen osumia ' + deep + ' kpl [' + (d0.reHits.join(',') || '-') + ' | ' + (d1.reHits.join(',') || '-') + '] (' + (EXPECT_OLD_LIFT ? 'vanha −10 px' : 'v11.12 −25 px') + ')');

    /* Putoamistason täsmäisyys: esimerkki kaista 0, y = 330 */
    const ex = reHitProbe(0, 336);
    const expectFall = 336 + 30 - LIFT;
    if (!ex.hit) fail('Kolari: esimerkkisyvyys y=336 ei osunut');
    else if (Math.abs(ex.fallY - expectFall) > 1e-6)
        fail('Kolari: putoamistaso väärä (fallY=' + ex.fallY + ', odotettu ' + expectFall + ')');
    else ok('Kolari: putoamistaso = osumakohta − ' + LIFT + ' px (jalat ' + ex.feet + ' → ' + ex.fallY + '), ylösnousu y=' + Math.round(ex.standY));
})();

/* ── Raportti ── */
console.log('\n══════ v11.10/v11.12 – liikenne ei pysähdy tainnutuksessa (paitsi kolari) ══════');
if (EXPECT_BUG) console.log('   (esikorjaus-kontrolli: STREET_EXPECT_BUG=1, ROOT=' + ROOT + ')');
if (EXPECT_OLD_LIFT) console.log('   (kontrolliajo: STREET_KNOCK_LIFT=' + KNOCK_LIFT + ' → odotus käännetty)');
oks.forEach((o) => console.log('  ✔ ' + o));
problems.forEach((p) => console.log('  ✘ ' + p));
console.log('\nTulos: ' + oks.length + ' OK, ' + problems.length + ' löydöstä');
process.exit(problems.length ? 1 : 0);
