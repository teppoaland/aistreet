/* ═══════════════════════════════════════════════════════════════
   street-jukebox-test.cjs – Jukebox-huoneen (talo 5) validointi v4.21
     PORTTI : 1. painallus ovella = potku (ikkunat syttyvät 20 s)
              2. painallus valaistulla ovella = huone auki
     VALINTA: ▲ / W = +1   ▼ / S = −1   (0..3)
              0 = ei valintaa → poistuminen ei maksa eikä soita
     OSTO   : valinta 1–3 + poistuminen = 1 kolikko + koko kappale
     Ajo: node street-jukebox-test.cjs  (ei repossa, %TEMP%)
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');   // D:\AI\AI_street (forkki, ei enää D:\AI\Main)
const streetSrcRaw = require('./street-src.cjs');
/* Probe (vain muistiin): pelaajan sijainti – T6:n kävely mitataan metreinä,
   koska 1 🍔 = 2/3-vauhti (v4.70) eikä kiinteä frame-määrä enää riitä. */
const streetSrc = streetSrcRaw.replace('    function update(dt) {',
    '    function update(dt) {\n        globalThis.__p = { x: player.x, y: player.y, kd: player.knockedDown };');
const audioSrc  = fs.readFileSync(path.join(ROOT, 'audio.js'), 'utf8');
const stateSrc  = fs.readFileSync(path.join(ROOT, 'gameState.js'), 'utf8');

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
            setHungerTempo() {},   // v4.94: syntikkatempo (harness-stub täydennetty)
            isJukeboxPlaying() { return jukePlaying; },
            getJukeboxQueuePos() { return 0; },
            playJukeboxQueue(urls) { jukeCalls = jukeCalls.concat(urls || []); jukePlaying = true; return true; },
            playJukebox(url) {
                jukeCalls.push(url);
                if (opts.failAudio) return false;
                jukePlaying = true; return true;
            }
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
        player() { return sandbox.__p || null; },   // probe: { x, y, kd }
        sawText(needle) { return texts.some((t) => t.indexOf(needle) >= 0); },
        notif() { return (cached['notification'] || {}).textContent || ''; },
        hud() { return (cached['hud-bar'] || {}).innerHTML || ''; },
        savedCoins() { return JSON.parse(store['pimeakatu_gamestate']).inventory.coinCount; },
        jukeCalls() { return jukeCalls.slice(); },
        jukeStopped() { return jukeStopped; },
        setJukeboxPlaying(v) { jukePlaying = !!v; },
        shapes() { return shapes.slice(); },
        iframe, store, Street, sandbox, winL, clock: () => clock
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

/* Yksi painallus ovella (potku TAI sisäänkäynti).
   4 frameä: potku asettaa hit-pausen (2 f) → toinen painallus ehtii perille. */
function tapDoor(e) { e.tapAction(); e.frame(4); }


/* ═══════════════════════════════════════════════════════════════
   NÄLKÄKULUTUKSEN LAAJUUS (v4.49 / v4.50)
     - kulutus jatkuu: katu, BAR, jukebox, iframe-pelit
     - jäissä vain nukkuessa (makuuhuone + Zzz-pimennys)
     - burgerien loputtua kuolee MYÖS huoneessa/pelissä: huone/alapeli
       suljetaan ensin → kuolema näkyy kadulla → resetti
     - lukitut arvot (2400 framet, katto 10, HUNGER_WAKE_GRACE 600)
   ═══════════════════════════════════════════════════════════════ */

const st0 = (e) => JSON.parse(e.store['pimeakatu_gamestate'] || '{}');
const burgers = (e) => (st0(e).inventory || {}).hamburgerCount;
const frames = (e) => Math.round(e.clock() / 16.7);
const check = (cond, msg) => { if (cond) ok(msg); else fail(msg); };

/* ── Kävelyreitit: alarataa (y=350) ohi ovien ja kaappien, nousu vasta
      kohdalla (y=280). Sama reitti kuin street-bar-test.cjs:ssä. ─────── */
function walkToFruitDoor(e) {          // hedeläpelitalo, ovi n. x 585
    e.hold('ArrowDown'); e.frame(60); e.release('ArrowDown');
    e.hold('ArrowRight'); e.frame(445); e.release('ArrowRight');
    e.hold('ArrowUp'); e.frame(60); e.release('ArrowUp');
    e.frame(1);
}
function walkToBarDoor(e) {            // BAR, ovi x≈765
    e.hold('ArrowDown'); e.frame(60); e.release('ArrowDown');
    e.hold('ArrowRight'); e.frame(596); e.release('ArrowRight');
    e.hold('ArrowUp'); e.frame(60); e.release('ArrowUp');
    e.frame(1);
}
function walkToSleepDoor(e) {          // makuuhuone, ovi x 675
    e.hold('ArrowDown'); e.frame(60); e.release('ArrowDown');
    e.hold('ArrowRight'); e.frame(512); e.release('ArrowRight');
    e.hold('ArrowUp'); e.frame(60); e.release('ArrowUp');
    e.frame(1);
}
/* Etsi siemen, jolla annettu ovi aukeaa (ajoneuvot ovat satunnaisia) */
function findEntry(walkFn, marker, coins) {
    for (let s = 1; s <= 30; s++) {
        const e = boot(s, coins || 5);
        walkFn(e);
        if (tapUntil(e, () => e.sawText(marker), 12)) return { e, seed: s };
    }
    return null;
}
function tapUntil(e, cond, tries) {
    for (let i = 0; i < (tries || 20); i++) {
        e.tapAction(); e.frame(4);
        if (cond()) return true;
    }
    return false;
}
/* Hedelmäpelitalon ovi: napauta ja siirry tarvittaessa hitusen oikealle */
function enterFruitDoor(e) {
    walkToFruitDoor(e);
    for (let i = 0; i < 14; i++) {
        e.tapAction(); e.frame(4);
        if (e.iframe.src) return 'iframe';
        if (e.sawText('MAKUUHUONE')) return 'sleep';
        e.hold('ArrowRight'); e.frame(4); e.release('ArrowRight'); e.frame(1);
    }
    return 'fail';
}

/* ═══ T1: katu – kulutus jatkuu (baseline) ═══════════════════════ */
(function T1() {
    console.log('T1 katu: hampurilainen kuluu (baseline)');
    const e = boot(11, 5);
    const b0 = burgers(e);
    e.frame(2500);
    const d = b0 - burgers(e);
    check(d === 1, 'kadulla 2500 framea -> kului ' + d + ' (odotus 1)');
})();

/* ═══ T2: jukebox-huone – kulutus jatkuu (ennen: 0) ══════════════ */
(function T2() {
    console.log('T2 jukebox-huone: hampurilainen kuluu');
    const e = boot(11, 5);
    walkToDoor(e);
    tapDoor(e);            // 1. potku -> ikkunat valaistuiksi
    tapDoor(e);            // 2. -> huone auki
    if (!e.room()) { fail('T2: jukebox-huone ei auennut (yö/portti)'); return; }
    const b0 = burgers(e);
    e.frame(2500);
    const d = b0 - burgers(e);
    check(d === 1, 'jukeboxissa 2500 framea -> kului ' + d + ' (odotus 1, ennen v4.49: 0)');
    const b1 = burgers(e);
    e.frame(300);
    check(burgers(e) === b1, 'ei ylimaaraista kulumista (300 framea lisaa -> ' + burgers(e) + ')');
})();

/* ═══ T3: BAR-huone – kulutus jatkuu (ennen: 0) ══════════════════ */
(function T3() {
    console.log('T3 BAR-huone: hampurilainen kuluu');
    const r = findEntry(walkToBarDoor, 'EXIT: (o) / Space', 9);
    if (!r) { fail('T3: BAR-huone ei auennut siemenilla 1-30'); return; }
    console.log('  (BAR aukesi siemenella ' + r.seed + ')');
    const e = r.e;
    const b0 = burgers(e);
    e.frame(2500);
    const d = b0 - burgers(e);
    check(d === 1, 'BAR:ssa 2500 framea -> kului ' + d + ' (odotus 1, ennen v4.49: 0)');
})();

/* ═══ T4: hedeläpeli (iframe) – kulutus jatkuu + poistuminen ei
       nollaa ajastinta (ennen: closeGame nollasi 2400) ════════════ */
(function T4() {
    console.log('T4 hedelapeli (iframe): kulutus jatkuu eika poistuminen nollaa ajastinta');
    let e = null, seed = 0;
    for (let s = 1; s <= 30 && !e; s++) {
        const t = boot(s, 5);
        if (enterFruitDoor(t) === 'iframe') { e = t; seed = s; }
    }
    if (!e) { fail('T4: hedelapelitalon ovi ei auennut siemenilla 1-30'); return; }
    console.log('  (hedelapeli aukesi siemenella ' + seed + ')');
    ok('T4a: iframe aukesi (' + e.iframe.src + ')');

    const b0 = burgers(e);
    let f = 0;
    while (burgers(e) === b0 && f < 3000) { e.frame(10); f += 10; }
    if (burgers(e) === b0) { fail('T4b: ei kulunut iframen aikana (3000 framea)'); return; }
    ok('T4b: hampurilainen kului iframen aikana (' + f + ' framea)');

    const tA = frames(e);                 // kulutushetki iframessa
    e.frame(1200);                        // puoli syklia eteenpain
    const b1 = burgers(e);
    e.sandbox.window._streetReturn({ data: 'RETURN_TO_STREET' });
    e.frame(2);
    check(!e.iframe.src, 'T4c: RETURN_TO_STREET sulki iframen');

    let f2 = 0;
    while (burgers(e) === b1 && f2 < 3000) { e.frame(10); f2 += 10; }
    const gap = frames(e) - tA;
    check(gap < 2900,
          'T4d: ajastin jatkui poistumisen yli (kulutusten vali ' + gap +
          ' framea ~2400; nollauksella 3600)');
})();

/* ═══ T5: makuuhuone – nälkä jäissä + Nuku +1 (ennallaan) ════════
   HUOM (v11.00): pelaajalle näkyvät tekstit käännettiin englanniksi →
   huoneen tunnistaa otsikosta 'BEDROOM' (ennen 'MAKUUHUONE'). */
(function T5() {
    console.log('T5 makuuhuone: nalka jaissa, Nuku +1');
    const r = findEntry(walkToSleepDoor, 'BEDROOM', 5);
    if (!r) { fail('T5: makuuhuone ei auennut siemenilla 1-30'); return; }
    console.log('  (makuuhuone aukesi siemenella ' + r.seed + ')');
    const e = r.e;
    const b0 = burgers(e);
    e.frame(3000);
    check(burgers(e) === b0, 'makuuhuoneessa 3000 framea -> ei kulunut (' + b0 + ' -> ' + burgers(e) + ')');
    e.tapAction(); e.frame(1);           // sleepSel 0 = Nuku
    e.frame(420);                        // Zzz-pimennys ~325 framea
    check(burgers(e) === b0 + 1, 'Nuku antoi +1 (' + b0 + ' -> ' + burgers(e) + ')');
})();

/* ═══ T6: nälkäkuolema huoneessa (v4.50) – huone sulkeutuu ja pelaaja
       romahtaa kadulle; 0 🍔:lla ei voi jäädä "turvaan" huoneeseen ═ */
(function T6() {
    console.log('T6 nalkakuolema huoneessa: huone sulkeutuu, kuolema kadulla');
    /* Etsi siemen: hedeläpelitalo auki -> ulos -> 1 burgeri -> BAR auki */
    let e = null, seed = 0;
    for (let s = 1; s <= 60 && !e; s++) {
        const t = boot(s, 5);
        if (enterFruitDoor(t) !== 'iframe') continue;
        const st = st0(t);
        st.inventory.hamburgerCount = 1;
        t.store['pimeakatu_gamestate'] = JSON.stringify(st);
        t.sandbox.window._streetReturn({ data: 'RETURN_TO_STREET' });
        t.frame(2);
        /* Kävele BARin ovelle: 1 🍔 → 2/3-vauhti (v4.70), joten etenemistä
           mitataan pelaajan x:stä (ovi ≈ 765, DOOR_RADIUS 19 → x ≥ 745 osuu). */
        t.hold('ArrowRight');
        for (let i = 0; i < 60; i++) {
            t.frame(8);
            const p = t.player();
            if (p && p.x >= 745) break;
        }
        t.release('ArrowRight'); t.frame(1);
        if (tapUntil(t, () => t.sawText('EXIT: (o) / Space'), 12)) { e = t; seed = s; }
    }
    if (!e) { fail('T6: BAR-huone ei auennut siemenilla 1-30'); return; }
    console.log('  (BAR aukesi siemenella ' + seed + ')');
    check(burgers(e) === 1, 'T6a: 1 burgeri tallenteessa (nyt ' + burgers(e) + ')');

    let f = 0;
    while (burgers(e) > 0 && f < 3000) { e.frame(10); f += 10; }
    check(burgers(e) === 0, 'T6b: viimeinen burgeri kului huoneessa (' + f + ' framea)');

    e.frame(3);
    check(!e.sawText('EXIT: (o) / Space'),
          'T6c: huone sulkeutui kuoleman takia (ei nakymatonta kuolemaa)');

    let died = false, err = '';
    try { e.frame(400); } catch (err2) { died = /location/.test(String(err2)); err = String(err2); }
    check(died || e.store['pimeakatu_gamestate'] === undefined,
          'T6d: kuolema naytettiin kadulla ja peli resetoitui (reset=' +
          (e.store['pimeakatu_gamestate'] === undefined) + ' ' + err + ')');
})();

/* ═══ T8: jukebox – burgerien loputtua kuolee myös huoneessa
       (1 🍔 ei riitä "ilmaiseen" jukeboxissa säätämiseen) ═════════ */
(function T8() {
    console.log('T8 jukebox: burgerien loputtua kuolee myos huoneessa');
    const e = boot(11, 5);
    walkToDoor(e); tapDoor(e); tapDoor(e);
    if (!e.room()) { fail('T8: jukebox-huone ei auennut'); return; }
    const b0 = burgers(e);
    let died = false, err = '', f = 0;
    try {
        while (f < 14000) {
            e.frame(10); f += 10;
            if (e.store['pimeakatu_gamestate'] === undefined) { died = true; break; }
        }
    } catch (err2) { died = /location/.test(String(err2)); err = String(err2); }
    check(died, 'T8: ' + b0 + ' burgeria kului huoneessa ja kuolema laukesi (' + f + ' framea) ' + err);
})();

/* ═══ T7: staattiset tarkistukset (sijoittelu + lukitut arvot) ═══ */
(function T7() {
    console.log('T7 staattiset tarkistukset');
    const hIdx = streetSrc.indexOf('hampurilaisajastin, 1/60s');
    /* Vaihe 3 (v11.38): huoneet ajetaan rekisterin kautta
       (`for (const room of rooms) if (room.update(dt)) return;`) – sama tarkoitus:
       nälkäblokin on oltava ENNEN tätä porttia, jotta kulutus ei pysähdy huoneisiin (v4.49). */
    const sIdx = streetSrc.indexOf('for (const room of rooms) if (room.update(dt)) return;');
    check(hIdx > 0 && sIdx > 0 && hIdx < sIdx,
          'nalkablokki on ennen huoneportteja (kulutus ei pysahdy huoneisiin)');
    const cgIdx = streetSrc.indexOf('function closeGame()');
    const cg = streetSrc.slice(cgIdx, streetSrc.indexOf('function clearKeys()'));
    check(cg.indexOf('hamburgerTimer = 2400;') < 0, 'closeGame ei enaa nollaa nalkaajastinta');
    check(/let hamburgerTimer = 2400;/.test(streetSrc), 'lukittu tahti 2400 framet ennallaan (saanto 04)');
    check(/let\s+HUNGER_WAKE_GRACE = 600;/.test(streetSrc), 'HUNGER_WAKE_GRACE 600 ennallaan (let = kaaos-säädettävä)');
    check(/hamburgerCount < 10/.test(streetSrc), 'katto 10 (BAR) ennallaan');
    check(/function insideHiddenState\(\)/.test(streetSrc), 'insideHiddenState-apuri olemassa');
    check(/function leaveHiddenStateForDeath\(\)/.test(streetSrc), 'leaveHiddenStateForDeath olemassa');
    check(streetSrc.indexOf('leaveHiddenStateForDeath();') > 0, 'leaveHiddenStateForDeath kutsutaan');
    check(streetSrc.indexOf('starvingOnExit') < 0, 'siirretty kuolema -lippu (starvingOnExit) poistettu');
    check(/hungerOnHold\(\) \{ return sleepRoom \|\| sleepPhase > 0; \}/.test(streetSrc),
          'nalka jaissa vain nukkuessa (hungerOnHold ennallaan)');
})();

/* ═══ YHTEENVETO ════════════════════════════════════════════════ */
console.log('');
if (problems.length === 0) {
    console.log('KAIKKI OK - ' + oks.length + ' tarkistusta, 0 loydosta');
    process.exit(0);
}
console.log(problems.length + ' LOYdOSTA:');
for (const m of problems) console.log('  X  ' + m);
process.exit(1);


