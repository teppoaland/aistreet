/* ═══════════════════════════════════════════════════════════════
   street-avenger-test.cjs – Oviukon (Avenger) validointi (v4.15)
     - arvonta: oviukko 1/8 → kolikko 1/5 → kukkaruukku
     - oviukko astuu OVESTA kynnykseltä (ei putoa ikkunasta)
     - peräänkäynti 2.0 px/f > pelaaja 1.225 → ei väistettävissä
     - kontakti → 3 s jäädytys (hit-stop) → vasta sitten kosahtaminen
     - osuma: tainnutus 600 f + tasan 1 hampurilainen, ei tuplavähennystä
     - paluu ovelle ja katoaminen; iframe-jäädytys; cooldown; portit
   Ajo:  node street-avenger-test.cjs
   Tekniikka: Node vm + canvas/document-stub + _dbg-export TESTIKOPIOSSA
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = 'd:/AI/Main';
const streetSrc = require('./street-src.cjs');
const stateSrc = fs.readFileSync(path.join(ROOT, 'gameState.js'), 'utf8');

/* _dbg-export lisätään vain testikopioon (ei repossa) */
const MARK = 'return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };';
const DBG_EXPORT = `return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon, _dbg: {
    avenger: () => avenger, avengerCooldown: () => avengerCooldown,
    player: () => player, buildings: buildings,
    consts: { AVENGER_CHANCE, AVENGER_COOLDOWN, AVENGER_SPEED, AVENGER_TELEGRAPH, AVENGER_HIT_R, AVENGER_STUN, AVENGER_FREEZE, PLAYER_SPEED },
    flowerPot: () => flowerPot, kickCoin: () => kickCoin,
    burgers: () => hamburgerCount, playerDead: () => playerDead,
    spawnAvenger: spawnAvenger, updateAvenger: updateAvenger,
    spawnKickDrop: spawnKickDrop, knockPlayerDown: knockPlayerDown,
    setCooldown: (v) => { avengerCooldown = v; },
    setBurgers: (n) => { hamburgerCount = n; },
    setKnocked: (v) => { player.knockedDown = v; },
    reset: () => { avenger = null; avengerCooldown = 0; flowerPot = null; kickCoin = null; kickCoinCooldown = 0; player.knockedDown = false; player.knockdownTimer = 0; },
    clearLights: () => { for (const k in smallHouseLights) { smallHouseLights[k].lit = false; smallHouseLights[k].timer = 0; } }
} };`;
if (streetSrc.indexOf(MARK) === -1) { console.log('X: return-lausetta ei loytynyt street.js:sta'); process.exit(1); }
const testSrc = streetSrc.replace(MARK, DBG_EXPORT);

const problems = [], oks = [];
const fail = (m) => problems.push(m);
const ok = (m) => oks.push(m);
const GY = 310;   // GROUND_Y

function makeCtx() {
    return {
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
        font: '', textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0,
        imageSmoothingEnabled: true,
        save() {}, restore() {}, translate() {}, scale() {}, rotate() {}, setTransform() {}, resetTransform() {},
        beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, rect() {},
        quadraticCurveTo() {}, bezierCurveTo() {}, arcTo() {}, fill() {}, stroke() {}, clip() {},
        fillRect() {}, strokeRect() {}, clearRect() {},
        createRadialGradient() { return { addColorStop() {} }; },
        createLinearGradient() { return { addColorStop() {} }; },
        measureText(t) { return { width: String(t).length * 6 }; },
        fillText() {}, strokeText() {},
        drawImage() {}, setLineDash() {}, getLineDash() { return []; }
    };
}


function boot(startBurgers) {
    let clock = 0, pending = null;
    let rndValue = 0.5;                    // Math.random – ohjattava
    const winL = {}, store = {}, listeners = {};

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
            addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
            appendChild() {}, setAttribute() {},
            getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
            querySelector(sel) { return sel === 'iframe' ? iframe : null; },
            querySelectorAll() { return []; }
        };
    }
    const cache = {};
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
        StreetAudio: { init() {}, start() {}, stop() {}, getCtx() { return null; }, playDeathGong() {},
                      /* v11.x: koko street.js:n käyttämä audio-api stubataan */
                      isJukeboxPlaying() { return false; }, playJukebox() { return false; },
                      playJukeboxQueue() { return false; }, appendJukeboxQueue() {}, stopJukebox() {},
                      getJukeboxQueuePos() { return 0; }, setHungerTempo() {}, setMenuActive() {},
                      fadeOutMenuMusic() {}, playChaosIntro() {}, playPanelOn() {}, playPanelOff() {}, playTypeClick() {} },
        window: {
            addEventListener(t, f) { (winL[t] = winL[t] || []).push(f); },
            removeEventListener() {},
            focus() {}, blur() {}, postMessage() {}, innerWidth: 1024, innerHeight: 700, devicePixelRatio: 1
        },
        document: {
            getElementById(id) { return cache[id] || (cache[id] = makeEl(id)); },
            querySelector() { return null; }, querySelectorAll() { return []; },
            createElement() { return makeEl('tmp'); },
            addEventListener() {}, removeEventListener() {},
            body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head')
        }
    };
    sandbox.document.getElementById = (id) => {
        if (id === 'game-canvas') return canvasEl;
        return cache[id] || (cache[id] = makeEl(id));
    };
    sandbox.Math = new Proxy(Math, { get(t, p) { return p === 'random' ? (() => rndValue) : t[p]; } });
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(stateSrc, sandbox, { filename: 'gameState.js' });
    vm.runInContext('var __st = GameState.load(); __st.inventory.coinCount = 0; __st.inventory.hamburgerCount = ' + startBurgers + '; GameState.save(__st);', sandbox);
    vm.runInContext(testSrc, sandbox, { filename: 'street.js (testikopio)' });
    const Street = vm.runInContext('Street', sandbox);
    Street.init(canvasEl);
    const d = Street._dbg;

    const h = {
        frame(n) {
            for (let i = 0; i < (n || 1); i++) {
                const cb = pending; pending = null;
                if (!cb) throw new Error('rAF-ketju katkesi');
                clock += 16.7;
                cb(clock);
            }
        },
        key(type, k) { for (const f of (winL[type] || []).slice()) f({ key: k, preventDefault() {} }); },
        hold(k) { h.key('keydown', k); },
        release(k) { h.key('keyup', k); },
        tapAction() { h.key('keyup', ' '); h.key('keydown', ' '); },
        rnd(v) { rndValue = v; },
        dbg: d,
        overlay(on) {
            const el = cache['game-iframe-overlay'] || (cache['game-iframe-overlay'] = makeEl('game-iframe-overlay'));
            if (on) el.classList.add('active'); else el.classList.remove('active');
        },
        savedBurgers() { return JSON.parse(store['pimeakatu_gamestate']).inventory.hamburgerCount; },
        dist(a) { const p = d.player(); return Math.hypot((p.x + p.w / 2) - (a.x + a.w / 2), (p.y + p.h / 2) - (a.y + a.h / 2)); }
    };
    return h;
}

/* ═══ TESTI 1: kadun polku – potku ovelle → oviukko → osuma (ei väistettävissä) ═══ */
try {
    const e = boot(6);
    const A = e.dbg.consts;
    /* v4.68: oviukko hidastettiin 2.0 → 1.0 (½ pelaajasta) – tarkoituksellinen
       "teeskennelty karkuunpääsy": avoimella kadulla se ei saa kiinni, mutta
       laidalla / ruuhkan takana nappaa. Siksi ei enää "aina pelaajaa nopeampi". */
    if (!(A.AVENGER_SPEED < A.PLAYER_SPEED)) fail('Vakiot: AVENGER_SPEED ei ole pelaajaa hitaampi (v4.68)');
    else ok('Vakiot: oviukko ' + A.AVENGER_SPEED + ' px/f < pelaaja ' + A.PLAYER_SPEED + ' px/f (v4.68: karkuun voi päästä)');
    if (A.AVENGER_STUN !== 600) fail('Vakiot: AVENGER_STUN ei ole 600 (' + A.AVENGER_STUN + ')');
    if (A.AVENGER_CHANCE !== 0.12 || A.AVENGER_COOLDOWN !== 1800) fail('Vakiot: arvonta/cooldown ei 0.12/1800');
    else ok('Vakiot: 1/8 arvonta (0.12) + 30 s cooldown (1800 f)');

    // Kävele talon 2 ovelle (buildings[2], ovi x 225): alas → oikealle → ylös
    e.rnd(0.05);                       // oviukon arvonta osuu
    e.hold('ArrowDown'); e.frame(60); e.release('ArrowDown');
    e.hold('ArrowRight'); e.frame(143); e.release('ArrowRight');
    e.hold('ArrowUp'); e.frame(55); e.release('ArrowUp');
    const pl = e.dbg.player();
    ok('Kävely ovelle: pelaaja (' + Math.round(pl.x) + ', ' + Math.round(pl.y) + ')');

    // 1. potku: sytyttää talon valot (ei pudotusta)
    e.tapAction(); e.frame(4);
    if (e.dbg.avenger()) fail('Ensimmäinen potku synnytti oviukon (valot vasta syttyivät)');
    // 2. potku: pudotus – rnd 0.05 → oviukko
    e.tapAction(); e.frame(2);

    const a = e.dbg.avenger();
    if (!a) {
        fail('Oviukko ei syntynyt potkusta (oviukon arvonta)');
    } else {
        const doorX = 225, windowY = GY - e.dbg.buildings[2].h + 40;   // 210 = ruukun lähtökorkeus
        ok('Oviukko syntyi: x ' + Math.round(a.x) + ' (ovi ' + doorX + '), y ' + Math.round(a.y) + ' (kynnys ' + (GY - 30) + ')');
        if (Math.abs(a.y - (GY - 30)) > 1) fail('Oviukko ei aloita kynnykseltä (y ' + a.y + ')');
        else if (Math.abs(a.y - windowY) < 5) fail('Oviukko putoaa ikkunasta (y ' + a.y + ' = ruukun korkeus)');
        else ok('Oviukko astuu OVESTA kynnykseltä – ei putoa ikkunasta (y ' + Math.round(a.y) + ' vs ruukku ' + windowY + ')');
        if (Math.abs(a.x - (doorX - 10)) > 4) fail('Oviukon x ei ole oven kohdalla (' + a.x + ')');
        if (a.phase !== 'emerge') fail('Oviukko ei aloita emerge-vaiheesta (' + a.phase + ')');
        else ok('Ulostulon varoitus: phase=emerge ' + A.AVENGER_TELEGRAPH + ' f (~350 ms)');
        if (!(e.dbg.avengerCooldown() > 0)) fail('Cooldown ei käynnistynyt oviukosta');
        else ok('Cooldown käynnistyi: ' + Math.round(e.dbg.avengerCooldown()) + ' f');

        // Pakene täydellä nopeudella oikealle (sähkökaappi x200 on vasemmalla – ei saa sotkea)
        let contactFrame = 0, chaseStart = 0, dChase0 = 0, dHit = 0;
        e.hold('ArrowRight');
        for (let i = 1; i <= 600; i++) {
            e.frame(1);
            const cur = e.dbg.avenger();
            if (!cur) break;
            if (cur.phase === 'chase' && !chaseStart) { chaseStart = i; dChase0 = e.dist(cur); }
            if (cur.phase === 'hold') { contactFrame = i; dHit = e.dist(cur); break; }
        }
        if (!contactFrame) fail('Oviukko ei tavoittanut pakenevaa pelaajaa (ei väistettävissä -vaatimus)');
        else ok('Oviukko tavoitti pakenevan pelaajan ' + contactFrame + ' f kohdalla (etäisyys ' + dChase0.toFixed(1) + ' → ' + dHit.toFixed(1) + ')');
        if (!(dHit < dChase0)) fail('Etäisyys ei pienentynyt peräänkäynnissä');
        const contactAv = e.dbg.avenger();
        if (!contactAv || contactAv.phase !== 'hold') fail('Kontakti ei aloittanut jäädytystä (phase=' + (contactAv && contactAv.phase) + ')');
        else ok('Kontakti → phase=hold (3 s jäädytys alkaa)');
        if (e.dbg.player().knockedDown) fail('Pelaaja kosahti heti – jäädytystä ei tullut');
        else if (e.dbg.player().knockdownTimer !== 0) fail('Tainnutuslaskuri käynnistyi jo jäädytyksen alussa');
        else ok('Jäädytyksen alussa: pelaaja seisoo (ei vielä kosahtanut)');
        if (e.dbg.burgers() !== 6) fail('Hampurilainen meni jo jäädytyksen alussa (' + e.dbg.burgers() + ')');
        else ok('Jäädytyksen alussa: 6 🍔 tallessa (menetys vasta kosahtamisesta)');

        // Maailma seisoo: pelaaja ei liiku vaikka juoksee, oviukko ei liiku
        const frozenPx = e.dbg.player().x, frozenAx = contactAv.x;
        e.frame(60);
        if (Math.abs(e.dbg.player().x - frozenPx) > 0.001) fail('Pelaaja liikkui jäädytyksen aikana (' + frozenPx + '→' + e.dbg.player().x + ')');
        else if (Math.abs(e.dbg.avenger().x - frozenAx) > 0.001) fail('Oviukko liikkui jäädytyksen aikana');
        else ok('60 f jäädytystä: koko maailma seisoo (pelaaja ja oviukko paikallaan)');

        // Jäädytys loppuu → pelaaja kosahtaa kasaan (tainnutus + 1 🍔)
        let freezef = 60;
        while (e.dbg.avenger() && e.dbg.avenger().phase === 'hold' && freezef < 400) { e.frame(1); freezef++; }
        e.release('ArrowRight');
        if (A.AVENGER_FREEZE !== 180) fail('AVENGER_FREEZE ei ole 180 f (3 s)');
        else ok('Jäädytys kesti ' + freezef + ' f (tavoite ' + A.AVENGER_FREEZE + ' f = 3 s)');
        if (!e.dbg.player().knockedDown) fail('Pelaaja ei kosahtanut jäädytyksen jälkeen');
        else if (e.dbg.player().knockdownTimer < 590 || e.dbg.player().knockdownTimer > 600) fail('Tainnutuksen pituus ei ole 600 (' + e.dbg.player().knockdownTimer + ')');
        else ok('Kosahtaminen: tainnutus 600 f alkoi vasta jäädytyksen jälkeen');
        if (e.dbg.burgers() !== 5 || e.savedBurgers() !== 5) fail('Hampurilaisia ei mennyt tasan 1 (' + e.dbg.burgers() + '/' + e.savedBurgers() + ')');
        else ok('Kosahtaminen: tasan 1 hampurilainen (6 → 5, tallennettu)');

        // Ei tuplavähennystä tainnutuksen aikana
        e.frame(120);
        if (e.dbg.player().knockedDown && e.dbg.burgers() !== 5) fail('Tainnutuksen aikana tuli toinen osuma (' + e.dbg.burgers() + ')');
        else ok('120 f tainnutuksen aikana → edelleen 5 hampurilaista (ei tuplaosumaa)');

        // Paluu ovelle + katoaminen tainnutuksen aikana
        for (let i = 0; i < 600 && e.dbg.avenger(); i++) e.frame(1);
        if (e.dbg.avenger()) fail('Oviukko ei palannut ovelle ja kadonnut');
        else ok('Oviukko käveli takaisin kynnykselle ja katosi (avenger = null)');
        let cleared = 0;
        for (let i = 0; i < 700 && e.dbg.player().knockedDown; i++) { e.frame(1); cleared++; }
        if (e.dbg.player().knockedDown) fail('Tainnutus ei päättynyt 600 f jälkeen');
        else if (e.dbg.burgers() !== 5) fail('Hampurilaiset muuttuivat tainnutuksen jälkeen (' + e.dbg.burgers() + ')');
        else ok('Tainnutus päättyi (+' + cleared + ' f) ja hampurilaiset pysyivät 5:ssä');
    }
} catch (err) { fail('Testi 1 (katu): poikkeus – ' + err.message); }

/* ═══ TESTI 2: iframe-peli auki → peräänkäynti jäissä (ei näkymätöntä osumaa) ═══ */
try {
    const m = boot(6);
    m.dbg.spawnAvenger(m.dbg.buildings[2]);
    const a = m.dbg.avenger();
    if (!a) fail('Testi 2: spawnAvenger ei tehnyt oviukkoa');
    m.frame(30);                                   // emerge ohi + liikettä
    const x0 = a.x, y0 = a.y;
    if (a.x === 215 - 10 && a.y === GY - 30) fail('Testi 2: oviukko ei lähtenyt liikkeelle');
    m.overlay(true);                               // iframe-peli auki
    m.frame(60);
    if (a.x !== x0 || a.y !== y0) fail('Testi 2: oviukko liikkui iframen aikana (' + x0 + '→' + a.x + ')');
    else ok('Iframe auki: oviukko jäissä 60 f (ei näkymätöntä osumaa)');
    m.overlay(false);
    m.frame(30);
    if (a.x === x0 && a.y === y0) fail('Testi 2: oviukko ei jatkanut iframen sulkeuduttua');
    else ok('Iframe kiinni: peräänkäynti jatkui normaalisti');
} catch (err) { fail('Testi 2 (iframe): poikkeus – ' + err.message); }

/* ═══ TESTI 3: pelaaja jo tainnoksissa → ei toista hampurilaista ═══ */
try {
    const g = boot(6);
    g.dbg.reset();
    g.dbg.setBurgers(6);
    g.dbg.spawnAvenger(g.dbg.buildings[2]);
    const a = g.dbg.avenger();
    const p = g.dbg.player();
    a.phase = 'chase'; a.x = p.x; a.y = p.y;       // oviukko kiinni pelaajassa
    g.dbg.setKnocked(true);                        // valmiiksi tainnoksissa (esim. auto)
    g.dbg.updateAvenger(1);                        // kontakti → jäädytys
    if (a.phase !== 'hold') fail('Testi 3: kontakti ei aloittanut jäädytystä (' + a.phase + ')');
    else ok('Jäädytys: kontakti → phase=hold (ei vahinkoa vielä)');
    g.dbg.updateAvenger(1);                        // jäädytys ohi → kosahtaminen
    if (g.dbg.burgers() !== 6) fail('Testi 3: oviukko vei hampurilaisen tainnoksisssa olevalta (' + g.dbg.burgers() + ')');
    else ok('Suoja: valmiiksi tainnoksissa → ei toista -1 🍔 (6 pysyy)');
    if (a.phase !== 'return') fail('Testi 3: oviukko ei lähtenyt paluuseen osuman jälkeen');
    else ok('Suoja: oviukko lähti paluuseen (phase=return)');
} catch (err) { fail('Testi 3 (suoja): poikkeus – ' + err.message); }

/* ═══ TESTI 4: viimeinen hampurilainen → kuolema ═══ */
try {
    const k = boot(1);
    k.dbg.reset();
    k.dbg.setBurgers(1);
    k.dbg.spawnAvenger(k.dbg.buildings[2]);
    const a = k.dbg.avenger(), p = k.dbg.player();
    a.phase = 'chase'; a.x = p.x; a.y = p.y;
    k.dbg.setKnocked(false);
    k.dbg.updateAvenger(1);                        // kontakti → 3 s jäädytys
    if (k.dbg.burgers() !== 1) fail('Testi 4: hamburilainen meni jo jäädytyksen alussa');
    k.dbg.updateAvenger(1);                        // jäädytys ohi → kosahtaminen
    if (k.dbg.burgers() !== 0) fail('Testi 4: viimeinen hampurilainen ei kulunut (' + k.dbg.burgers() + ')');
    else if (!k.dbg.playerDead()) fail('Testi 4: killPlayer ei käynnistynyt');
    else ok('Viimeinen 🍔 (1 → 0) → kuolemasekvenssi käynnistyi');
    if (!p.knockedDown) fail('Testi 4: pelaaja ei kaatunut kuolemassa');
} catch (err) { fail('Testi 4 (kuolema): poikkeus – ' + err.message); }

/* ═══ TESTI 5: regressio – kolikko- ja ruukkupolut ennallaan + cooldown ═══ */
try {
    const r = boot(6);
    r.dbg.reset();
    r.rnd(0.5);                                        // ei oviukkoa, ei kolikkoa
    r.dbg.spawnKickDrop(r.dbg.buildings[2]);
    if (!r.dbg.flowerPot() || r.dbg.avenger()) fail('Testi 5: ruukkupolku rikki (rnd 0.5)');
    else ok('Regressio: rnd 0.5 → kukkaruukku, ei oviukkoa (ennallaan)');

    r.dbg.reset(); r.dbg.setCooldown(0);
    r.rnd(0.15);                                       // oviukko ei osu (0.15 > 0.12), kolikko osuu
    r.dbg.spawnKickDrop(r.dbg.buildings[2]);
    if (!r.dbg.kickCoin() || r.dbg.avenger() || r.dbg.flowerPot()) fail('Testi 5: kolikkopolku rikki (rnd 0.15)');
    else ok('Regressio: rnd 0.15 → kolikko (1/5), ei oviukkoa (ennallaan)');

    r.dbg.reset();
    r.rnd(0.05);                                       // oviukon arvonta osuu
    r.dbg.spawnKickDrop(r.dbg.buildings[2]);
    const first = r.dbg.avenger();
    if (!first) fail('Testi 5: oviukko ei synny rnd 0.05');
    else if (!(r.dbg.avengerCooldown() > 0)) fail('Testi 5: cooldown ei käynnistynyt spawnKickDropista');
    else ok('Arvonta: rnd 0.05 → oviukko + cooldown ' + Math.round(r.dbg.avengerCooldown()) + ' f');
    r.dbg.spawnKickDrop(r.dbg.buildings[2]);           // cooldown estää uuden
    if (r.dbg.avenger() !== first) fail('Testi 5: cooldown ei estänyt toista oviukkoa');
    else ok('Cooldown: toinen potku ei synnyttänyt uutta oviukkoa (sama olio)');

    // Cooldown kulkee frameissä ja oviukko palaa ovelle → uusi potku mahdollinen
    r.frame(30);
    const cd1 = r.dbg.avengerCooldown();
    r.frame(60);
    if (!(r.dbg.avengerCooldown() < cd1)) fail('Testi 5: cooldown ei kulunut frameissä');
    else ok('Cooldown kuluu frameissä (' + Math.round(cd1) + ' → ' + Math.round(r.dbg.avengerCooldown()) + ')');
} catch (err) { fail('Testi 5 (regressio): poikkeus – ' + err.message); }

/* ═══ TESTI 6: portti !avenger – aktiivinen oviukko estää pudotuksen ═══ */
try {
    const g = boot(6);
    g.rnd(0.5);
    g.hold('ArrowDown'); g.frame(60); g.release('ArrowDown');
    g.hold('ArrowRight'); g.frame(143); g.release('ArrowRight');
    g.hold('ArrowUp'); g.frame(55); g.release('ArrowUp');
    g.tapAction(); g.frame(4);                         // 1. potku: valot syttyvät
    g.dbg.spawnAvenger(g.dbg.buildings[4]);            // oviukko kauas (talo 4, ovi x 410)
    const far = g.dbg.avenger();
    g.rnd(0.05);                                       // arvonta osuisi, mutta portti estää
    g.tapAction(); g.frame(2);
    if (g.dbg.flowerPot() || g.dbg.kickCoin()) fail('Testi 6: pudotus syntyi oviukon ollessa aktiivinen');
    else if (g.dbg.avenger() !== far) fail('Testi 6: portti ei pitänyt (uusi oviukko)');
    else ok('Portti: aktiivinen oviukko esti ruukun/kolikon/uuden oviukon potkusta');
} catch (err) { fail('Testi 6 (portti): poikkeus – ' + err.message); }

/* ── RAPORTTI ──────────────────────────────────────────────── */
console.log('=========================================================');
console.log(' OVIUKKO (AVENGER) v4.14 – ARVONTA / VAISTAMATTOMYYS / OSUMA');
console.log('=========================================================');
for (const o of oks) console.log('  ' + o);
console.log('  == LÖYDÖKSET (' + problems.length + ') ==');
if (!problems.length) console.log('  OK: ei virheita.');
for (const p of [...new Set(problems)]) console.log('  X ' + p);
process.exitCode = problems.length ? 1 : 0;

