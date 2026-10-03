/* ═══════════════════════════════════════════════════════════════
   street-manhole-bonus-test.cjs – Avoimen kaivon arvonta (v4.69)
     T1 staattiset tarkistukset (nupit + lukitut arvot ennallaan)
     T2 ?hole=0 -> ei putoamisia (kansi paikallaan)
     T3 0 kolikkoa  -> jokainen putoaminen: 0 (ei mitaan) TAI +3
     T4 5 kolikkoa  -> jokainen putoaminen: +3 TAI -min(rahat,2)
     Ajo: node street-manhole-bonus-test.cjs   (ei repossa, %TEMP%)
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');   // D:\AI\AI_street (forkki, ei enää D:\AI\Main)
const streetSrcRaw = require('./street-src.cjs');
const fruitSrc = fs.readFileSync(path.join(ROOT, 'fruitgame', 'js', 'constants.js'), 'utf8');
const stateSrc = fs.readFileSync(path.join(ROOT, 'gameState.js'), 'utf8');

/* Mittari: montako kertaa bonus-arpa heitettiin + arvotut luvut (vain laskuri,
   ei logiikkaa). Arvot talletetaan, jotta 1/6-osuus voidaan todeta suoraan
   arvonnasta eikä pelkästään kolikkosaldojen erotuksista. */
const MARK = '        if (Math.random() < MH_BONUS_CHANCE) {';
const PROBE = '    function update(dt) {';
const streetSrc = streetSrcRaw
    .replace(MARK, '        (globalThis.__mhVals = globalThis.__mhVals || []).push(Math.random());\n' +
                   '        globalThis.__mhRolls = (globalThis.__mhRolls || 0) + 1;\n' +
                   '        if (globalThis.__mhVals[globalThis.__mhVals.length - 1] < MH_BONUS_CHANCE) {')
    .replace(PROBE, PROBE + '\n        globalThis.__p = { x: player.x, y: player.y, kd: player.knockedDown, mh: manhole.open, act: !!manhole.action, hp: hamburgerCount };');
if (streetSrc === streetSrcRaw) {
    console.log('VAROITUS: bonus-arpakohtaa ei loytynyt - mittari ei ole kaytossa');
}

const problems = [], oks = [];
const fail = (m) => problems.push(m);
const ok = (m) => oks.push(m);
const check = (cond, msg) => { if (cond) ok(msg); else fail(msg); };

let shapes = [];
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
        fillText() {}, strokeText() {}, drawImage() {}, setLineDash() {}, getLineDash() { return []; }
    };
}

function boot(seed, startCoins, holeParam) {
    let clock = 0, pending = null;
    let s = (seed >>> 0) || 1;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

    const winL = {}, store = {}, listeners = {}, cached = {};
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
            addEventListener(t, f) { (listeners[id] = listeners[id] || {}); (listeners[id][t] = listeners[id][t] || []).push(f); },
            removeEventListener() {}, focus() {}, blur() {},
            appendChild() {}, setAttribute() {},
            getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
            querySelector(sel) { return sel === 'iframe' ? iframe : null; },
            querySelectorAll() { return []; }
        };
    }

    const sandbox = {
        console, setTimeout, clearTimeout, Date, JSON, URLSearchParams,
        location: { search: holeParam ? ('?hole=' + holeParam) : '' },
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
            init() {}, start() {}, stop() {}, getCtx() { return null; }, playDeathGong() {},
            setHungerTempo() {},   // v4.94: syntikkatempo (harness-stub täydennetty)
            isJukeboxPlaying() { return false; }, getJukeboxQueuePos() { return 0; },
            playJukeboxQueue() { return true; }, playJukebox() { return true; }
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
    /* Paljon hampurilaisia: liikenne saa tainnuttaa ilman etta peli resetoituu */
    vm.runInContext('var __st = GameState.load(); __st.inventory.coinCount = ' + startCoins +
                    '; __st.inventory.hamburgerCount = 999; GameState.save(__st);', sandbox);
    vm.runInContext(streetSrc, sandbox, { filename: 'street.js' });
    const Street = vm.runInContext('Street', sandbox);
    Street.init(canvasEl);

    return {
        frame(n) {
            for (let i = 0; i < (n || 1); i++) {
                const cb = pending; pending = null;
                if (!cb) throw new Error('rAF-ketju katkesi');
                clock += 16.7;
                shapes = [];
                cb(clock);
            }
        },
        key(type, k) { for (const f of (winL[type] || []).slice()) f({ key: k, preventDefault() {} }); },
        hold(k) { this.key('keydown', k); },
        release(k) { this.key('keyup', k); },
        rolls() { return sandbox.__mhRolls || 0; },
        mhVals() { return (sandbox.__mhVals || []).slice(); },   // arvotut luvut (1/6-raja)

        coins() { return JSON.parse(store['pimeakatu_gamestate']).inventory.coinCount; },
        shapes() { return shapes.slice(); },
        player() { return sandbox.__p || null; },
        sandbox, store
    };
}

/* ── Apurit ─────────────────────────────────────────────────── */

/* Kaivon keskipiste piirrosta: drawManholes piirtaa ellipse(mx+1, my+2, 15, 8)
   -> bbox 30x16, josta mx = minX + 14, my = minY + 6. */
function findManholes(e) {
    const out = [];
    for (const s of e.shapes()) {
        const w = s[2] - s[0], h = s[3] - s[1];
        if (Math.abs(w - 30) < 0.01 && Math.abs(h - 16) < 0.01) out.push({ x: s[0] + 14, y: s[1] + 6 });
    }
    return out;
}

/* Frame-kohtainen kirjanpito: putoamiset (bonus-arvan hetki) ja muut
   kolikkomuutokset erotellaan toisistaan. */
function makeTracker(e) {
    let prevRolls = e.rolls(), prevCoins = e.coins(), frames = 0;
    const rec = [], external = [];
    function step() {
        e.frame(1); frames++;
        const r = e.rolls(), c = e.coins();
        if (r > prevRolls) {
            rec.push({ before: prevCoins, after: c, frame: frames });
            prevRolls = r; prevCoins = c;
            return 'roll';
        }
        if (c !== prevCoins) {
            external.push({ before: prevCoins, after: c, frame: frames });
            prevCoins = c;
            return 'coin';
        }
        return null;
    }
    function run(n) { for (let i = 0; i < n; i++) { if (step() === 'roll') return 'roll'; } return null; }
    return { step, run, rec, external, frames: () => frames };
}

/* Aja pelaaja reiän kohdalle: ensin jalkapiste reiän tasolle (y = mh.y - 29),
   sitten x reiän keskikohdalle. Kumpikin liike voi laukaista putoamisen.
   HUOM: y ensin – kukkaruukku/kaappi (x 200) on väistettävä alarataa pitkin. */
function driveToHole(e, mh, t) {
    let p = e.player();
    if (!p) return null;
    if (p.kd) { t.run(40); return null; }                       // tainnutus: odota
    const dy = (mh.y - 29) - p.y;
    if (Math.abs(dy) > 1.5) {
        const k = dy >= 0 ? 'ArrowDown' : 'ArrowUp';
        e.hold(k);
        const r = t.run(Math.min(40, Math.max(2, Math.round(Math.abs(dy) / 1.225) + 2)));
        e.release(k);
        if (r === 'roll') return 'roll';
    }
    p = e.player();
    const dx = (mh.x - 10) - p.x;
    if (Math.abs(dx) > 2) {
        const k = dx > 0 ? 'ArrowRight' : 'ArrowLeft';
        e.hold(k);
        const r = t.run(Math.min(40, Math.max(1, Math.round(Math.abs(dx) / 1.225))));
        e.release(k);
        if (r === 'roll') return 'roll';
    }
    return null;
}

/* Kävele reiän kohdalle ja putoa want kertaa.
   HUOM (v11.44): budjetti mitoitettu 1/6-arvonnalle – aikaisempi 400 kierrosta
   riitti 1/3:lle, mutta tainnutusten odottelu (40 f/kierros) vei kaiken ajan. */
function collectFalls(e, mh, want, guardMax) {
    const t = makeTracker(e);
    let guard = 0, waits = 0, moves = 0;
    const guardCap = guardMax || 1500;
    while (t.rec.length < want && guard < guardCap) {
        guard++;
        const wasKd = !!(e.player() && e.player().kd);
        const r = driveToHole(e, mh, t);
        if (r === 'roll') t.run(280);       // pudotus + kiipeaminen ~246 framea
        else if (wasKd) waits++;
        else moves++;
        if (r !== 'roll') t.run(20);
    }
    console.log('  kaivo ' + JSON.stringify(mh) + ': pelaaja ' + JSON.stringify(e.player()) +
                ', putoamisia ' + t.rec.length + ' (kierroksia ' + guard + ', tainnutus-odotuksia ' +
                waits + ', siirtymia ' + moves + ')');
    return t;
}

/* Yhteiset tarkistukset jokaiselle putoamiselle. */
function report(e, t, tag, startCoins) {
    console.log('  ' + tag + ': putoamisia ' + t.rec.length + ', frameja ' + t.frames() +
                ', kolikot lopussa ' + e.coins() + ' (alku ' + startCoins + ')');
    console.log('  ' + tag + ': muut kolikkomuutokset (esim. katu-kolikko): ' +
                JSON.stringify(t.external));
    check(t.rec.length >= 10, tag + ': putoamisia kertyi ' + t.rec.length + ' (>= 10; MH_BONUS_CHANCE 1/6 hidastaa kertymää)');
    let bonus = 0;
    const bad = [];
    for (const r of t.rec) {
        const delta = r.after - r.before;
        const loss = Math.min(r.before, 2);
        if (delta > 0) { bonus++; if (delta !== 3) bad.push('loyto ' + delta + ' (odotus +3)'); }
        else if (delta !== -loss) bad.push('menetys ' + delta + ' rahoilla ' + r.before + ' (odotus ' + (-loss) + ')');
        if (r.after < 0) bad.push('saldo negatiivinen');
    }
    check(bad.length === 0, tag + ': jokainen putoaminen noudatti saantoa (virheet: ' +
          (bad.length ? bad.join('; ') : '0') + ')');
    const sum = t.rec.reduce((a, r) => a + (r.after - r.before), 0) +
                t.external.reduce((a, x) => a + (x.after - x.before), 0);
    check(e.coins() === startCoins + sum,
          tag + ': saldo taytmaan kirjanpidon kanssa (' + e.coins() + ' = ' + startCoins +
          ' + ' + sum + ')');
    const share = t.rec.length ? bonus / t.rec.length : 0;
    console.log('  ' + tag + ': loytoja (+3) ' + bonus + '/' + t.rec.length + ' = ' +
                (share * 100).toFixed(0) + ' %');
    /* Suora todiste arvonnasta (ei kolikkosaldoista): 1/6-rajan alle jääneet */
    const vals = e.mhVals();
    const rawHits = vals.filter((v) => v < 1 / 6).length;
    console.log('  ' + tag + ': arvotut luvut ' + JSON.stringify(vals.map((v) => Number(v.toFixed(3)))) +
                ' -> < 1/6: ' + rawHits + '/' + vals.length);
    check(share >= 0.08 && share <= 0.30,
          tag + ': loytojen osuus ~1/6 (8-30 %): ' + (share * 100).toFixed(0) + ' %');
    check(e.coins() >= 0, tag + ': kolikkosaldo ei koskaan negatiivinen (lopussa ' + e.coins() + ')');
}

/* ═══ T1: staattiset tarkistukset ═══════════════════════════════ */
(function T1() {
    console.log('T1 staattiset tarkistukset');
    check(/const MH_BONUS_CHANCE\s*=\s*1 \/ 6;/.test(streetSrcRaw), 'MH_BONUS_CHANCE = 1/6 (23.9.2026, saanto 04)');
    check(/const MH_BONUS_COINS\s*=\s*3;/.test(streetSrcRaw), 'MH_BONUS_COINS = 3');
    check(/const MH_COIN_COST\s*=\s*2;/.test(streetSrcRaw), 'MH_COIN_COST 2 ennallaan (saanto 04)');
    check(/const MH_FALL_FRAMES\s*=\s*36;/.test(streetSrcRaw), 'MH_FALL_FRAMES 36 ennallaan');
    check(/const MH_CLIMB_FRAMES\s*=\s*210;/.test(streetSrcRaw), 'MH_CLIMB_FRAMES 210 ennallaan');
    const fnIdx = streetSrcRaw.indexOf('function updateManholeAction');
    const bonusIdx = streetSrcRaw.indexOf('MH_BONUS_CHANCE', fnIdx);
    const lossIdx = streetSrcRaw.indexOf('} else if (coinCount > 0) {', fnIdx);
    check(fnIdx > 0 && bonusIdx > fnIdx && lossIdx > bonusIdx,
          'bonus-arpa on ENNEN menetyshaaraa (else if)');
    check(/let hamburgerTimer\s*=\s*2400;/.test(streetSrcRaw), 'lukittu nalkatahti 2400 ennallaan');
    check(/const HUNGER_WARN\s*=\s*3;/.test(streetSrcRaw), 'HUNGER_WARN 3 ennallaan');
    check(/Rosvo vie kaikki rahat/.test(streetSrcRaw) && /coinCount = 0;/.test(streetSrcRaw),
          'rosvo (v4.68) vie edelleen rahat');
    check(/const BET\s*=\s*1;/.test(fruitSrc) && /const PAY_PAIR\s*=\s*1;/.test(fruitSrc),
          'hedelmäpeli: panos 1 / pari 1 ennallaan');
    check(/weight: 7, pay: 4/.test(fruitSrc) && /weight: 2, pay: 35/.test(fruitSrc),
          'hedelmäpeli: painot/maksut ennallaan');
})();

/* ═══ T2: ?hole=0 – kansi paikallaan, ei putoamisia ═════════════ */
(function T2() {
    console.log('T2 ?hole=0: kansi paikallaan -> ei putoamisia');
    const e = boot(11, 5, 0);
    e.frame(2);
    const mh = findManholes(e);
    console.log('  kaivot piirrosta: ' + JSON.stringify(mh));
    check(mh.length === 2, 'molemmat kaivot loytyivat piirrosta (2 x 30x16 ellipsi)');
    const m0 = mh[0] || { x: 224, y: 336 };
    const t = makeTracker(e);
    for (let i = 0; i < 40; i++) driveToHole(e, m0, t);   // seiso reiän kohdalla
    check(e.rolls() === 0, '?hole=0: arpaa ei heitetty kertaakaan (' + e.rolls() + ')');
    console.log('  pelaaja lopussa: ' + JSON.stringify(e.player()) + ', frameja ' + t.frames());
})();

/* ═══ T3: ?hole=1, 0 kolikkoa – putoaminen = 0 tai +3 ═══════════ */
(function T3() {
    console.log('T3 ?hole=1, 0 kolikkoa: putoaminen on 0 (ei mitaan) tai +3');
    const e = boot(11, 0, 1);
    e.frame(2);
    const mh = findManholes(e);
    const t = collectFalls(e, mh[0], 18);
    report(e, t, 'T3', 0);
})();

/* ═══ T4: ?hole=2, 5 kolikkoa – putoaminen = +3 tai -min(rahat,2) ═ */
(function T4() {
    console.log('T4 ?hole=2, 5 kolikkoa: putoaminen on +3 tai -min(rahat,2)');
    const e = boot(11, 5, 2);
    e.frame(2);
    const mh = findManholes(e);
    const t = collectFalls(e, mh[1], 18);
    report(e, t, 'T4', 5);
})();

/* ═══ YHTEENVETO ════════════════════════════════════════════════ */
console.log('');
if (problems.length === 0) {
    console.log('KAIKKI OK - ' + oks.length + ' tarkistusta, 0 loydosta');
    process.exit(0);
}
console.log(problems.length + ' LOYDOSTA:');
for (const m of problems) console.log('  X  ' + m);
process.exit(1);

