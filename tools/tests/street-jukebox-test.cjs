/* ═══════════════════════════════════════════════════════════════
   street-jukebox-test.cjs – Jukebox-huoneen (talo 5) validointi
     PORTTI : 1. painallus ovella = potku (ikkunat syttyvät 20 s)
              2. painallus valaistulla ovella = huone auki
     VALINTA (v4.46+): ▲ / ▼ = kursori (0 = Exit, 1..N = kappale)
              (o)/Space/⚡ = ota kappale listalle TAI poista se
              rivi 0 + (o)/Space/⚡ tai Enter = soita valitut & poistu
     OSTO   : 1 kolikko / valittu kappale; vajaat kolikot → soi niin
              monta kuin riittää; äänen puuttuessa kolikot palautuvat
     HUOM   : uudistettu v11.44 monivalintamalliin (vanha yhden
              valinnan odotus ('Valinta: N', 'SOI NYT') poistui v4.46:ssa)
   Ajo: node tools/tests/street-jukebox-test.cjs
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');   // D:\AI\AI_street (forkki, ei enää D:\AI\Main)
const streetSrc = require('./street-src.cjs');
const audioSrc  = fs.readFileSync(path.join(ROOT, 'audio.js'), 'utf8');
const stateSrc  = fs.readFileSync(path.join(ROOT, 'gameState.js'), 'utf8');

/* Jukeboxin rivimäärä lähteestä: rivi 0 = Exit + N raitaa. Kiertologiikka
   (v11.57) vaatii tarkan rivimäärän, jotta navigointi osuu tunnetulle riville. */
const TRACK_N   = (streetSrc.match(/url:\s*'jukebox\//g) || []).length;   // 9
const JUKE_ROWS = TRACK_N + 1;                                            // 10 (0 = Exit)

const problems = [], oks = [];
const fail = (m) => problems.push(m);
const ok = (m) => oks.push(m);

const ROOM_MARK = '♪ JUKEBOX';   // vain drawJukeboxRoom piirtää tämän
let texts = [];
let shapes = [];                 // piirtojen rajat (J10: ei kankaan ulkopuolelle)
function noteShape(x, y, rx, ry) { shapes.push([x - (rx || 0), y - (ry || 0), x + (rx || 0), y + (ry || 0)]); }

function makeCtx() {
    return {
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
        font: '', textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0,
        imageSmoothingEnabled: true,
        save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, setTransform() {}, resetTransform() {},
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
        arc(x, y, r) { noteShape(x, y, r, r); },
        ellipse(x, y, rx, ry) { noteShape(x, y, rx, ry); },
        rect() {},
        quadraticCurveTo() {}, bezierCurveTo() {}, arcTo() {}, fill() {}, stroke() {}, clip() {},
        fillRect(x, y, w, h) { noteShape(x + w / 2, y + h / 2, w / 2, h / 2); },
        strokeRect(x, y, w, h) { noteShape(x + w / 2, y + h / 2, w / 2 + 1, h / 2 + 1); },
        clearRect() {},
        createRadialGradient() { return { addColorStop() {} }; },
        createLinearGradient() { return { addColorStop() {} }; },
        measureText(t) { return { width: String(t).length * 6 }; },
        fillText(t) { texts.push(String(t)); }, strokeText() {},
        drawImage() {}, setLineDash() {}, getLineDash() { return []; }
    };
}

function boot(seed, startCoins, opts) {
    opts = opts || {};
    let clock = 0, pending = null;
    let s = (seed >>> 0) || 1;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

    const winL = {}, store = {}, listeners = {}, cached = {};
    let jukePlaying = false, jukeCalls = [], jukeStopped = 0;
    let queueCalls = [], appendCalls = [];      // v11.44: monivalinnan jono

    const ctx = makeCtx();
    const canvasEl = {
        id: 'game-canvas', style: {}, width: 800, height: 400, tabIndex: 0,
        addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
        getContext() { return ctx; },
        getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400, right: 800, bottom: 400 }; }
    };

    const iframe = {
        src: '', onload: null, style: {},
        addEventListener() {}, removeEventListener() {}, blur() {}, focus() {},
        contentWindow: { focus() {}, blur() {}, postMessage() {} }
    };

    function makeEl(id) {
        const classes = new Set();
        return {
            id, style: {}, offsetHeight: 0, clientWidth: 1024, clientHeight: 700,
            textContent: '', innerHTML: '', value: '',
            classList: {
                add(c) { classes.add(c); }, remove(c) { classes.delete(c); },
                toggle(c, on) { if (on === undefined) { classes.has(c) ? classes.delete(c) : classes.add(c); } else if (on) classes.add(c); else classes.delete(c); },
                contains(c) { return classes.has(c); }
            },
            __classes: classes,
            addEventListener(t, f) { (listeners[id] = listeners[id] || {}); (listeners[id][t] = listeners[id][t] || []).push(f); },
            removeEventListener() {}, focus() {}, blur() {},
            appendChild() {}, setAttribute() {},
            getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
            querySelector(sel) { return sel === 'iframe' ? iframe : null; },
            querySelectorAll() { return []; }
        };
    }

    const sandbox = {
        console, setTimeout, clearTimeout, Date, JSON,
        performance: { now: () => clock },
        requestAnimationFrame(cb) { pending = cb; return 1; },
        cancelAnimationFrame() {},
        localStorage: {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: (k) => { delete store[k]; }
        },
        navigator: { maxTouchPoints: 0 },
        StreetAudio: {
            init() {}, start() {}, stop() { jukePlaying = false; jukeStopped++; },
            getCtx() { return null; }, playDeathGong() {},
            isJukeboxPlaying() { return jukePlaying; },
            playJukebox(url) {
                jukeCalls.push(url);
                if (opts.failAudio) return false;
                jukePlaying = true; return true;
            },
            /* v4.46+: monivalinta soittaa JONON (playJukeboxQueue) ja
               soivan jonon perään voi lisätä (appendJukeboxQueue, v4.99). */
            playJukeboxQueue(urls) {
                queueCalls.push((urls || []).slice());
                if (opts.failAudio) return false;
                jukePlaying = true; return true;
            },
            appendJukeboxQueue(urls) {
                appendCalls.push((urls || []).slice());
                if (opts.failAudio) return false;
                jukePlaying = true; return true;
            },
            stopJukebox() { jukePlaying = false; },
            getJukeboxQueuePos() { return opts.queuePos || 0; },
            setHungerTempo() {}, setMenuActive() {}, fadeOutMenuMusic() {},
            playChaosIntro() {}, playPanelOn() {}, playPanelOff() {}, playTypeClick() {}
        },
        window: {
            addEventListener(t, f) { (winL[t] = winL[t] || []).push(f); },
            removeEventListener() {},
            focus() {}, blur() {}, postMessage() {}, innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1
        },
        document: {
            getElementById() { return null; },
            querySelector() { return null; }, querySelectorAll() { return []; },
            createElement() { return makeEl('tmp'); },
            addEventListener() {}, removeEventListener() {},
            body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head')
        }
    };
    sandbox.document.getElementById = (id) => {
        if (id === 'game-canvas') return canvasEl;
        return cached[id] || (cached[id] = makeEl(id));
    };
    sandbox.Math = new Proxy(Math, { get(t, p) { return p === 'random' ? rnd : t[p]; } });
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(stateSrc, sandbox, { filename: 'gameState.js' });
    vm.runInContext('var __st = GameState.load(); __st.inventory.coinCount = ' + startCoins + '; GameState.save(__st);', sandbox);
    vm.runInContext(streetSrc, sandbox, { filename: 'street.js' });
    const Street = vm.runInContext('Street', sandbox);
    Street.init(canvasEl);

    return {
        frame(n) {
            for (let i = 0; i < (n || 1); i++) {
                const cb = pending; pending = null;
                if (!cb) throw new Error('rAF-ketju katkesi');
                clock += 16.7;
                texts = [];
                shapes = [];
                cb(clock);
            }
        },
        key(type, k) { for (const f of (winL[type] || []).slice()) f({ key: k, preventDefault() {} }); },
        hold(k) { this.key('keydown', k); },
        release(k) { this.key('keyup', k); },
        tapAction() { this.key('keyup', ' '); this.key('keydown', ' '); },
        press(id) { for (const f of ((listeners[id] || {})['touchstart'] || []).slice()) f({ preventDefault() {} }); },
        pressMouse(id) { for (const f of ((listeners[id] || {})['mousedown'] || []).slice()) f({ preventDefault() {} }); },
        releaseBtn(id) { for (const f of ((listeners[id] || {})['touchend'] || []).slice()) f({ preventDefault() {} }); },
        listenerCount(id, type) { return ((listeners[id] || {})[type] || []).length; },
        room() { return texts.some((t) => t.indexOf(ROOM_MARK) >= 0); },
        sawText(needle) { return texts.some((t) => t.indexOf(needle) >= 0); },
        notif() { return (cached['notification'] || {}).textContent || ''; },
        hud() { return (cached['hud-bar'] || {}).innerHTML || ''; },
        savedCoins() { return JSON.parse(store['pimeakatu_gamestate']).inventory.coinCount; },
        jukeCalls() { return jukeCalls.slice(); },
        jukeQueueCalls() { return queueCalls.map((u) => u.slice()); },
        jukeAppendCalls() { return appendCalls.map((u) => u.slice()); },
        savedJukeQueue() { return (JSON.parse(store['pimeakatu_gamestate'] || '{}').jukeQueue) || []; },
        jukeStopped() { return jukeStopped; },
        setJukeboxPlaying(v) { jukePlaying = !!v; },
        shapes() { return shapes.slice(); },
        iframe, store
    };
}

/* ── Kävely talo 5:n ovelle (ovi x=410, y=294) ───────────────
   Alarataa (y=350) lamppujen ohi, sitten ylös (y=280) oven eteen:
   etäisyys oveen ≈ 3 px (< DOOR_RADIUS 19).                    */
function walkToDoor(e) {
    e.hold('ArrowDown'); e.frame(60); e.release('ArrowDown');       // y 290 → 350
    e.hold('ArrowRight'); e.frame(296); e.release('ArrowRight');    // x 40 → ~402
    e.hold('ArrowUp'); e.frame(60); e.release('ArrowUp');           // y 350 → 280
    e.frame(1);
}

/* Yksi painallus ovella (potku TAI sisäänkäynti) TAI valintanappi huoneessa.
   HUOM (v11.44): näppäin on myös VAPAUTETTAVA – muuten Space jää pohjaan eikä
   huoneen reunanilmaisu (jukeSpaceHeld) enää laukea (sama kuin oikeassa pelissä). */
function tapDoor(e) {
    e.tapAction();
    e.frame(4);
    e.release(' ');
    e.frame(1);
}

/* ═══ STAATTISET TARKISTUKSET ═══ */
const TRACKS = ['Knived_Our_song.mp3', 'Knived_Unafraid.mp3', 'Knived_Unafraid_instrumental.mp3'];
for (const t of TRACKS) {
    const p = path.join(ROOT, 'jukebox', t);
    if (!fs.existsSync(p)) { fail('T1: jukebox/' + t + ' puuttuu'); continue; }
    const size = fs.statSync(p).size;
    if (size > 1000000) ok('T1: jukebox/' + t + ' olemassa (' + (size / 1048576).toFixed(1) + ' MB, 128 kbps)');
    else fail('T1: jukebox/' + t + ' liian pieni (' + size + ' B)');
    if (streetSrc.indexOf('jukebox/' + t) >= 0) ok('T2: street.js viittaa tiedostoon jukebox/' + t);
    else fail('T2: street.js ei viittaa tiedostoon jukebox/' + t);
}
if (/function playJukebox\(url\)/.test(audioSrc) && /function stopJukebox\(\)/.test(audioSrc) && /function isJukeboxPlaying\(\)/.test(audioSrc))
    ok('T3: audio.js: playJukebox / stopJukebox / isJukeboxPlaying');
else fail('T3: audio.js:n jukebox-api puuttuu');
if (/const JUKEBOX_VOLUME = MUSIC_VOLUME;/.test(audioSrc) && /const JUKEBOX_GAP = 2500;/.test(audioSrc))
    ok('T4: audio.js: JUKEBOX_VOLUME + JUKEBOX_GAP (2,5 s)');
else fail('T4: audio.js:n jukebox-vakiot puuttuvat');
/* v11.44: forkissa suojissa on myös introPlaying → sallitaan se (tarkoitus sama:
   jukeboxin (tai intron) aikana taustamusiikki ei käynnisty). */
const guards = (audioSrc.match(/if \(jukePlaying \|\| phase === 'jukebox'(?: \|\| introPlaying)?\) return;/g) || []).length;
if (guards === 2) ok('T5: audio.js: start() ja onGesture() eivät käynnistä taustamusiikkia jukeboxin aikana');
else fail('T5: jukebox-suojia ' + guards + ' (odotettu 2)');
if (/playJukebox, playJukeboxQueue, appendJukeboxQueue, stopJukebox,/.test(audioSrc) &&
    /isJukeboxPlaying, getJukeboxQueuePos, setHungerTempo/.test(audioSrc)) ok('T6: audio.js: jukebox-api viety julki (return)');
else fail('T6: jukebox-api puuttuu returnista');
if (/drawJukeboxRoom/.test(streetSrc) && /function drawJukeboxCabinet/.test(streetSrc))
    ok('T7: street.js: drawJukeboxRoom + drawJukeboxCabinet (proseduraalinen kaappi)');
else fail('T7: jukebox-huoneen piirto puuttuu');
if (/smallHouseLights\[JUKEBOX_BLDG_IDX\]/.test(streetSrc)) ok('T8: portti käyttää talo 5:n ikkunavaloja (smallHouseLights[4])');
else fail('T8: porttilogiikka puuttuu');

/* Apuri: onko vierailu "tyhjä"? Valintalaskuri (▶ N track(s)) piirretään vain
   kun valintoja on – tyhjänä rivi 0 näyttää '–' (v4.46). */
const noPicks = (e) => !e.sawText('track(s)') && !e.sawText('✓ 1 🪙');

/* ═══ J1: PORTTI – potku ensin, sitten sisään ═══ */
try {
    const e = boot(3, 5);
    walkToDoor(e);
    const c0 = e.savedCoins();
    tapDoor(e);                                   // 1. painallus = potku
    if (e.room()) fail('J1: huone aukesi ilman valoja (portti vuotaa)');
    else if (e.savedCoins() !== c0) fail('J1: potku muutti kolikoita');
    else ok('J1: 1. painallus ovella = potku, huone ei aukea (portti pitää)');
    tapDoor(e);                                   // 2. painallus valaistulla ovella
    if (!e.room()) fail('J1: huone ei auennut valaistulla ovella');
    else if (e.savedCoins() !== c0) fail('J1: sisäänkäynti veloitti kolikon');
    else ok('J1: 2. painallus valaistulla ovella avaa huoneen (ei veloitusta)');
    if (e.sawText('Exit')) ok('J1: rivi 0 on "Exit"');
    else fail('J1: Exit-rivi puuttuu');
    if (e.sawText('Enter = play & exit')) ok('J1: ohjeteksti näkyy (pick/remove + play & exit)');
    else fail('J1: ohjeteksti puuttuu');
    if (noPicks(e)) ok('J1: vierailu alkaa ilman valintoja (rivi 0 = "–")');
    else fail('J1: valintoja oli jo valmiiksi');

    /* ═══ J2: MONIVALINTA (v4.46) – kursori + Space-valinta ilman veloitusta
       ▲/▼ = kursori (0 = Exit, 1..N = raita), (o)/Space/⚡ = ota/poista. */
    e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1);
    if (e.sawText('Knived - Our Song')) ok('J2: ▼ vei kursorin riville 1 (Our Song)');
    else fail('J2: ▼ ei siirtänyt kursoria riville 1');
    if (e.savedCoins() !== c0) fail('J2: kursorin liike veloitti'); else ok('J2: kursorin liike ei veloita');

    tapDoor(e);                                   // Space = ota kappale listalle
    if (e.sawText('✓ 1 🪙')) ok('J2: Space otti raidan listalle (✓ 1 🪙)');
    else fail('J2: valintamerkki puuttui');
    if (e.sawText('▶ 1 track(s)')) ok('J2: valintalaskuri näyttää 1');
    else fail('J2: valintalaskuri ei päivittynyt');
    tapDoor(e);                                   // Space uudelleen = poista valinta
    if (noPicks(e)) ok('J2: Space poisti valinnan (toggle, rivi 0 näyttää taas "–")');
    else fail('J2: valinnan poisto ei toiminut');

    /* Lista kiertää päästä päähän (v11.57): kursori ei jumita reunaan.
       Lähtö rivi 1 (yllä ▼ kerran) → ▼ × N kiertää koko listan takaisin riville 0. */
    for (let i = 0; i < TRACK_N; i++) { e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1); }
    if (e.room() && noPicks(e)) ok('J2: ▼ kiertää koko listan (ei ylitä loppua)');
    else fail('J2: ▼ jäi jumiin / ylitti listan');
    e.hold('ArrowUp'); e.frame(1); e.release('ArrowUp'); e.frame(1);          // rivi 0 → viimeinen raita
    if (e.room() && noPicks(e)) ok('J2: ▲ riviltä 0 kiertyy viimeiselle raidalle');
    else fail('J2: ▲ meni negatiiviseksi');
    e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1);      // viimeinen → rivi 0
    if (e.room() && noPicks(e)) ok('J2: ▼ viimeiseltä riviltä kiertyy takaisin riville 0');
    else fail('J2: ▼ ei kiertynyt riville 0');
    if (e.savedCoins() !== c0) fail('J2: valinnat veloittivat'); else ok('J2: valinnat eivät veloita (vasta poistuessa)');

    /* ═══ J3: POISTUMINEN ilman valintoja (rivi 0 + Space) ═══ */
    tapDoor(e);
    if (e.room()) fail('J3: poistuminen ei onnistunut');
    else if (e.savedCoins() !== c0 || e.jukeQueueCalls().length !== 0) fail('J3: ilman valintoja tuli veloitus/soitto');
    else ok('J3: ilman valintoja poistuminen ei veloita eikä soita mitään');
    if (e.notif() === '') ok('J3: ei turhia ilmoituksia ilman valintoja');
    else fail('J3: ilmoitus tuli ilman valintoja: ' + e.notif());

/* ═══ J4–J6: OSTO, SOIVAN JONON LISÄYS (v4.99), KAPPALEEN PÄÄTTYMINEN ═══ */
try {
    const e = boot(3, 5);
    walkToDoor(e);
    const c0 = e.savedCoins();
    tapDoor(e); tapDoor(e);                        // potku + sisään
    if (!e.room()) { fail('J4: huone ei auennut (portti)'); throw new Error('portti'); }

    /* J4: valitse raita 2 (▼▼ + Space) → rivi 0 + Space = −1 kolikko + jono soi */
    if (noPicks(e)) ok('J4: vierailu alkaa ilman valintoja');
    else fail('J4: vierailu ei alkanut tyhjänä');
    e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1);
    e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1);
    if (!e.sawText('Knived - Unafraid')) fail('J4: kursori ei asettunut raitalle 2');
    tapDoor(e);                                    // Space = ota raita 2 listalle
    if (!e.sawText('✓ 1 🪙')) fail('J4: raidan 2 valinta ei asettunut');
    e.hold('ArrowUp'); e.frame(1); e.release('ArrowUp'); e.frame(1);
    e.hold('ArrowUp'); e.frame(1); e.release('ArrowUp'); e.frame(1);   // takaisin riville 0
    tapDoor(e);                                    // Space rivillä 0 = soita & poistu
    let q = e.jukeQueueCalls();
    if (e.room()) fail('J4: huone jäi auki oston jälkeen');
    else if (e.savedCoins() !== c0 - 1) fail('J4: kolikkoveloitus väärin (' + c0 + '→' + e.savedCoins() + ')');
    else if (q.length !== 1 || q[0].join(',') !== 'jukebox/Knived_Unafraid.mp3') fail('J4: soitettiin väärä jono: ' + JSON.stringify(q));
    else ok('J4: 1 valinta → tasan −1 kolikko + jukebox/Knived_Unafraid.mp3 jonossa');
    if (JSON.stringify(e.savedJukeQueue()) === '[2]') ok('J4: jono tallentui tilaan (jukeQueue [2])');
    else fail('J4: jono ei tallentunut: ' + JSON.stringify(e.savedJukeQueue()));
    if (e.hud().indexOf('Coins: ' + e.savedCoins()) >= 0) ok('J4: HUD näyttää uuden kolikkosaldon');
    else fail('J4: HUD ei päivittynyt: ' + e.hud());

    /* J5 (v4.99): soidessa kursori on VAPAA ja uudet valinnat lisätään jonon perään */
    tapDoor(e);
    if (!e.room()) fail('J5: huone ei auennut kappaleen soidessa');
    else {
        if (e.sawText('♪ PLAYING')) ok('J5: soiva raita näkyy ("♪ PLAYING")');
        else fail('J5: ♪ PLAYING -teksti puuttuu');
        e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1);
        e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1);
        e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1);   // raita 3
        tapDoor(e);                                 // Space = ota raita 3 listalle
        const cc = e.savedCoins();
        e.key('keyup', 'Enter'); e.key('keydown', 'Enter'); e.frame(4);        // Enter = lisää & poistu
        const ap = e.jukeAppendCalls();
        if (e.room()) fail('J5: Enter ei poistunut huoneesta');
        else if (ap.length !== 1 || ap[0].join(',') !== 'jukebox/Knived_Unafraid_instrumental.mp3')
            fail('J5: soivaan jonoon ei lisätty oikeaa raitaa: ' + JSON.stringify(ap));
        else if (e.savedCoins() !== cc - 1) fail('J5: lisäys veloitti väärin (' + cc + '→' + e.savedCoins() + ')');
        else ok('J5: soidessa Enter lisäsi raidan 3 jonon perään (1 🪙, v4.99)');
    }

    /* J6: kappale päättyy → uusi vierailu alkaa tyhjänä ja osto toimii */
    e.setJukeboxPlaying(false);
    tapDoor(e);
    if (!e.room()) fail('J6: huone ei auennut kappaleen päätyttyä');
    else {
        if (noPicks(e)) ok('J6: uusi vierailu alkaa ilman valintoja');
        else fail('J6: valinnat jäivät päälle');
        /* ▼ × N → listan pohja (viimeinen raita). Pitkä pito (90 f) ei toista
           (reunanilmaisu): vain 1 askel → kierto takaisin riville 0. */
        for (let i = 0; i < TRACK_N; i++) { e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1); }
        e.hold('ArrowDown'); e.frame(90); e.release('ArrowDown'); e.frame(1);   // pitkä pito = 1 askel → rivi 0
        e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1);    // rivi 0 → raita 1
        tapDoor(e);                                    // ota raita 1 listalle
        if (!e.sawText('✓ 1 🪙')) fail('J6: valinta ei asettunut');
        e.hold('ArrowUp'); e.frame(1); e.release('ArrowUp'); e.frame(1);        // raita 1 → rivi 0
        const cc = e.savedCoins();
        tapDoor(e);
        q = e.jukeQueueCalls();
        if (e.savedCoins() !== cc - 1 || q.length !== 2) fail('J6: toinen osto väärin: ' + JSON.stringify(q) + ' (' + cc + '→' + e.savedCoins() + ')');
        else ok('J6: kappaleen päätyttyä uusi osto toimii (jono 2/2)');
    }
} catch (err) { fail('J4–J6: poikkeus – ' + err.message); }

} catch (err) { fail('J1–J3: poikkeus – ' + err.message); }



/* ═══ J7: EI KOLIKOITA – ei veloitusta, ilmoitus, ulos pääsee ═══ */
try {
    const e = boot(5, 0);
    walkToDoor(e);
    tapDoor(e); tapDoor(e);
    if (!e.room()) fail('J7: huone ei auennut 0 kolikolla');
    else {
        e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1);
        if (!e.sawText('Knived - Our Song')) fail('J7: kursori ei asettunut raitalle 1');
        tapDoor(e);                                 // ota raita 1 listalle (ilman kolikoita)
        if (!e.sawText('✓ 1 🪙')) fail('J7: valinta ei asettunut (ilman kolikoita valinta on sallittu)');
        e.hold('ArrowUp'); e.frame(1); e.release('ArrowUp'); e.frame(1);
        tapDoor(e);                                 // rivi 0 = soita & poistu → ei kolikoita
        if (e.room()) fail('J7: huoneeseen jäi jumiin ilman kolikoita');
        else if (e.savedCoins() !== 0 || e.jukeQueueCalls().length !== 0) fail('J7: 0 kolikolla tuli veloitus/soitto');
        else if (e.notif().indexOf('No coins!') < 0) fail('J7: ilmoitus puuttui (' + e.notif() + ')');
        else ok('J7: 0 kolikkoa → ei veloitusta, ei soittoa, ilmoitus ("No coins!") + poistuminen ok');
    }
} catch (err) { fail('J7: poikkeus – ' + err.message); }

/* ═══ J8: ÄÄNTÄ EI SAADA – veloitetut kolikot palautetaan ═══ */
try {
    const e = boot(7, 3, { failAudio: true });
    walkToDoor(e);
    tapDoor(e); tapDoor(e);
    const c0 = e.savedCoins();                     // kadun kolikko voi olla poimittu matkalla
    e.hold('ArrowDown'); e.frame(1); e.release('ArrowDown'); e.frame(1);
    tapDoor(e);                                    // ota raita 1 listalle
    e.hold('ArrowUp'); e.frame(1); e.release('ArrowUp'); e.frame(1);
    tapDoor(e);                                    // soita & poistu → ääni ei aukea
    if (e.savedCoins() !== c0) fail('J8: kolikkoa ei palautettu (' + c0 + ' → ' + e.savedCoins() + ')');
    else if (e.jukeQueueCalls().length !== 1) fail('J8: playJukeboxQueue-kutsuja ' + e.jukeQueueCalls().length);
    else if (e.notif().indexOf('coins refunded') < 0) fail('J8: palautusilmoitus puuttui (' + e.notif() + ')');
    else ok('J8: äänen puuttuessa veloitetut kolikot palautetaan + ilmoitus');
} catch (err) { fail('J8: poikkeus – ' + err.message); }

/* ═══ J9: MOBIILIPOLKU – D-pad + ⚡-nappi (monivalinta) ═══ */
try {
    const e = boot(9, 4);
    for (const id of ['btn-up', 'btn-down', 'btn-right', 'action-btn']) {
        if (e.listenerCount(id, 'touchstart') === 0) fail('J9: ' + id + '/touchstart-kuuntelija puuttuu');
    }
    e.press('btn-down'); e.frame(60); e.releaseBtn('btn-down'); e.frame(1);
    e.press('btn-right'); e.frame(296); e.releaseBtn('btn-right'); e.frame(1);
    e.press('btn-up'); e.frame(60); e.releaseBtn('btn-up'); e.frame(1);
    const tapBtn = (id) => { e.press(id); e.frame(2); e.releaseBtn(id); e.frame(1); };
    tapBtn('action-btn');                          // potku
    tapBtn('action-btn');                          // sisään
    if (!e.room()) fail('J9: huone ei auennut kosketusnapein');
    else {
        ok('J9: D-pad + ⚡-nappi avasivat jukebox-huoneen (touch-polku toimii)');
        tapBtn('btn-down');
        if (!e.sawText('Knived - Our Song')) fail('J9: btn-down ei vienyt kursoria raitalle 1');
        else ok('J9: D-pad ▼ vei kursorin raitalle 1 (touch)');
        tapBtn('action-btn');                      // ⚡ = ota raita listalle
        if (!e.sawText('✓ 1 🪙')) fail('J9: ⚡-nappi ei valinnut raitaa');
        else ok('J9: ⚡-nappi otti raidan listalle (touch)');
        tapBtn('btn-up');
        if (!e.sawText('Exit')) fail('J9: btn-up ei palauttanut kursoria riville 0');
        else ok('J9: D-pad ▲ palautti kursorin riville 0 (touch)');
        const c0 = e.savedCoins();
        tapBtn('action-btn');                      // ⚡ rivillä 0 = soita & poistu
        const q = e.jukeQueueCalls();
        if (e.room()) fail('J9: ⚡-nappi ei poistunut huoneesta');
        else if (e.savedCoins() !== c0 - 1 || q.length !== 1 || q[0].join(',') !== 'jukebox/Knived_Our_song.mp3')
            fail('J9: mobiiliosto väärin (' + JSON.stringify(q) + ', ' + c0 + '→' + e.savedCoins() + ')');
        else ok('J9: ⚡-nappi osti raidan 1 (jukebox/Knived_Our_song.mp3) ja poistui huoneesta');
        tapBtn('action-btn');                      // takaisin sisään (soi yhä)
        if (e.sawText('♪ PLAYING')) ok('J9: mobiilissa soiva raita näkyy ("♪ PLAYING")');
        else fail('J9: ♪ PLAYING -tila puuttui mobiilissa');
        const c1 = e.savedCoins();
        for (let i = 0; i < JUKE_ROWS; i++) tapBtn('btn-up');   // koko kierros takaisin riville 0
        tapBtn('action-btn');                           // ei valintoja → ei veloitusta
        if (e.savedCoins() !== c1 || e.jukeQueueCalls().length !== 1) fail('J9: valitsematon poistuminen veloitti');
        else ok('J9: ilman valintoja ⚡-nappi ei veloita uudelleen');
    }
} catch (err) { fail('J9: poikkeus – ' + err.message); }

/* ═══ J10: HUONE PIIRTYY KANKAAN SISÄÄN (0 piirtoa ulkopuolelle) ═══ */
try {
    const e = boot(11, 3);
    walkToDoor(e);
    tapDoor(e); tapDoor(e);
    if (!e.room()) fail('J10: huone ei auennut piirtotestiin');
    else {
        const all = [];
        const grab = () => { for (const s of e.shapes()) all.push(s); };
        grab();
        e.hold('ArrowDown'); e.frame(2); grab(); e.release('ArrowDown'); e.frame(2); grab();
        e.setJukeboxPlaying(true); e.frame(2); grab();      // SOI NYT -tila + pyörivä levy
        let out = 0, worst = '';
        for (const s of all) {
            if (s[0] < -1 || s[1] < -1 || s[2] > 801 || s[3] > 401) {
                out++;
                if (!worst) worst = JSON.stringify(s.map((v) => Math.round(v)));
            }
        }
        if (out === 0) ok('J10: huone piirtyi kokonaan kankaan sisään (' + all.length + ' muotoa, 0 ulkopuolelle)');
        else fail('J10: ' + out + ' piirtoa kankaan ulkopuolelle, esim. ' + worst);
    }
} catch (err) { fail('J10: poikkeus – ' + err.message); }

/* ── RAPORTTI ──────────────────────────────────────────────── */
console.log('=========================================================');
console.log(' JUKEBOX (talo 5, ovi x410) – portti / monivalinta (▲▼ + (o)/Space) / osto v4.46+');
console.log('=========================================================');
for (const o of oks) console.log('  ' + o);
console.log('  == LÖYDÖKSET (' + problems.length + ') ==');
if (!problems.length) console.log('  OK: ei virheita.');
for (const p of [...new Set(problems)]) console.log('  X ' + p);
process.exitCode = problems.length ? 1 : 0;
