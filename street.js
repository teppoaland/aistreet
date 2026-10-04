/* ═══════════════════════════════════════════════════════════
   street.js – "AI CHAOS STREET" -päävalikkopeli
   2D-sivukuvattu pimeä kaupunkikatu: 9 taloa, ovet,
   5 katulamppua talojen väleissä.
   ═══════════════════════════════════════════════════════════ */

const Street = (() => {
    let canvas, ctx;

    const WORLD_W = 800;
    const WORLD_H = 400;
    const GROUND_Y = 310;

    /* ── Pelaaja ─────────────────────────────────────── */
    const player = {
        x: 40, y: GROUND_Y - 20, w: 20, h: 30,
        vx: 0, vy: 0, facing: 1, lookY: 0, walking: false,
        walkFrame: 0, walkTimer: 0,
        kicking: false, kickFrame: 0,
        knockedDown: false, knockdownTimer: 0,
        knockFallY: undefined   // auton osuman putoamistaso (osumakohta −25 px); muutoin GROUND_Y+10
    };
    const PLAYER_SPEED = 1.225;   // hidastettu 30% (oli 1.75) – kävely hitaampi kuin autot
    const GRAVITY = 0.4;
    const JUMP_VEL = -7;
    const KICK_DURATION = 10; // frameä @ ~60fps ≈ 170ms
    const HIT_PAUSE = 2;      // hit pause -pysähdys osumasta (~33 ms) – vain potkun osumille

    /* ── Syötteet ────────────────────────────────────── */
    const keys = {};
    let actionPressed = false;
    let actionJustPressed = false;

    /* ── Talot ───────────────────────────────────────── */
    const buildings = [
        { x: 0,   w: 80, h: 200 },
        { x: 90,  w: 60, h: 170 },
        { x: 200, w: 50, h: 140 },
        { x: 260, w: 70, h: 190 },
        { x: 380, w: 60, h: 155 },
        { x: 450, w: 80, h: 210 },
        { x: 560, w: 50, h: 145 },
        { x: 640, w: 70, h: 180 },
        { x: 730, w: 70, h: 195 }
    ];

    /* Rakot talojen välissä: kiinteä jono, jonka avulla talot
       voidaan latoa uudelleen järjestykseen niin, että asettelu on AINA
       täsmälleen 0…800 (leveydet 590 + rakot 210 = 800) eikä synny
       päällekkäisyyksiä. Käytetään VAIN kaaosjärjestyksen arvonnassa
       (shuffleBuildingOrder, BAD/FULL) – NORMAL käyttää omia x-arvoja. */
    const BUILDING_GAPS = [10, 50, 10, 50, 10, 30, 30, 20];

    // Yölliset harmaansävyt – arvotaan taloille joka latauskerralla
    const BUILDING_PALETTE = [
        '#1a1a2e', '#1c1a1e', '#1a1f1c', '#1e1a1a', '#1a1c24',
        '#1a1e22', '#1c1c1a', '#1a1a24', '#1e1c1a',
        '#1b1a20', '#1a1d1e', '#1d1a1c', '#1a1b26', '#1c1e1a',
        '#1e1a1e', '#1a221e', '#1c1a22', '#1a1e1c'
    ];

    function randomizeBuildingColors() {
        // Fisher-Yates shuffle kopio paletista (kaaos K1: buildingPalette korvaa oletuksen)
        const palette = buildingPalette || BUILDING_PALETTE;
        const shuffled = palette.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        for (let i = 0; i < buildings.length; i++) {
            buildings[i].bodyColor = shuffled[i];
            buildings[i].corniceType = Math.floor(Math.random() * 7);  // 0–6
            // Ovityypit ilman lautamallia (4)
            const doorTypes = [0,1,3,5,6];
            buildings[i].doorType = doorTypes[Math.floor(Math.random() * doorTypes.length)];
        }
    }

    /* ── Kaaos: talojen järjestyksen arpominen ────────────────
       VAIN BAD/FULL. Talot pysyvät KOKONAISINA – korkeus, kyltti, rooli,
       ovi, väri ja lamppu kulkevat mukana – mutta niiden keskinäinen
       järjestys kadulla arvotaan. Rakot (BUILDING_GAPS) säilyvät, joten
       asettelu on aina täsmälleen 0…800 eikä päällekkäisyyksiä synny.
       NORMAL/MILD/GOOD: funktiota ei kutsuta → peli bitti-identtinen.
       chaosRng → ?seed= tekee arvonnasta toistettavan. */
    function shuffleBuildingOrder() {
        const n = buildings.length;
        const order = [];
        for (let i = 0; i < n; i++) order.push(i);
        for (let i = n - 1; i > 0; i--) {                 // Fisher-Yates
            const j = Math.floor(chaosRng() * (i + 1));
            const t = order[i]; order[i] = order[j]; order[j] = t;
        }
        const posOf = [];
        let x = 0;
        for (let k = 0; k < n; k++) {
            const idx = order[k];
            posOf[idx] = k;
            buildings[idx].x = x;                          // talo säilyttää oman w/h/roolin
            x += buildings[idx].w + (BUILDING_GAPS[k] || 0);
        }
        /* Lamput: talon viereiseen rakoon (vasen ensin; jos rako on jo
           varattu, oikea). Rakoindeksit 0..7 = talojen väliset raot → kaksi
           lamppua ei koskaan päädy samaan (pieneen) rakoon. */
        const usedGap = {};
        const lampOrder = lamps.map(l => ({ l, k: posOf[l.bldgIdx] })).sort((a, b) => a.k - b.k);
        for (const entry of lampOrder) {
            const k = entry.k;
            let gi;
            if (k > 0 && !usedGap[k - 1]) gi = k - 1;
            else if (k < n - 1 && !usedGap[k]) gi = k;
            else if (k > 0) gi = k - 1;
            else gi = 0;
            usedGap[gi] = true;
            const leftB = buildings[order[gi]];
            entry.l.x = leftB.x + leftB.w + (BUILDING_GAPS[gi] || 0) / 2;
        }
        /* Sähkökaapit: talon vasen seinä (kuten alun perinkin). */
        for (const c of electricCabinets) {
            if (c.bldgIdx !== undefined) c.x = buildings[c.bldgIdx].x;
        }
        /* Puut: alun perin 2. ja 4. raossa (rako-indeksit 1 ja 3) → samat raot. */
        if (trees.length >= 2) {
            trees[0].x = buildings[order[1]].x + buildings[order[1]].w + (BUILDING_GAPS[1] || 0) / 2;
            trees[1].x = buildings[order[3]].x + buildings[order[3]].w + (BUILDING_GAPS[3] || 0) / 2;
        }
        /* Esilasketut rakenteet (kynnysgeometria lasketaan initForegroundissa
           uudelle asettelulle; ikkunavälimuisti ja -valot nollataan). */
        _allWindows = null;
        litWindows.length = 0;
        /* Bugikorjaus: kylvä ikkunavalot HETI uudelleen. Muuten BAD/FULL jäi
           ilman ikkunavaloja koko runiksi, koska updateLitWindows() arpoo uuden
           tavoitteen vain kun jokin ikkuna sammuu → tyhjä lista ei koskaan täyty. */
        seedLitWindows();
        buildingOrderShuffled = true;
    }

    /* ── Lamput (talojen väleissä) ──────────────────── */
    const lamps = [
        { x: 85,  bldgIdx: 1, lit: false, label: 'DIG\nGAME',    gameUrl: 'digGame1/game_main.html' },
        { x: 255, bldgIdx: 3, lit: false, label: 'DIG\nDÄSH', gameUrl: 'digGame2/game_main.html' },
        { x: 445, bldgIdx: 5, lit: false, label: 'BLUE\nMÄX',     gameUrl: 'bm/game_main.html' },
        { x: 625, bldgIdx: 7, lit: false, label: 'COM-\nMANDO',   gameUrl: null },
        { x: 720, bldgIdx: 8, lit: false, label: 'BAR',   gameUrl: null }
    ];

    const LAMP_POST_H = 75;
    const LAMP_BASE_Y = GROUND_Y + 15;   // tolpan juuri = syvyysviiva (325): pelaaja on
                                         // pylvään TAKANA, kun jalkapiste on tämän yläpuolella
    const DOOR_W = 26;
    const DOOR_H = 32;
    const DOOR_RADIUS = 19;

    /* ── Ovien kynnysviuhka (yksi kivirivi heti kynnyksen vieressä) ── */
    // Renkaat: d = syvyys, w = puolileveys renkaan ulkoreunalla, n = kiilakivien määrä
    // HUOM: talot ovat kiinni kadun varressa → vain yksi rivi, ei saa valua autotielle.
    const THRESH_RINGS = [
        { d: 5, w: 16, n: 3 }
    ];
    const THRESH_TOP_Y = 7;          // rivin yläraja GROUND_Y:n alapuolella (kynnyslaatan alla)
    const THRESH_DIP = 2;            // V-painuma keskellä (kiveys vajoaa ovea kohti)
    const THRESH_DETAILS = true;     // kulumat, halkeamat, pikkukivet
    const THRESH_LIGHT = true;       // oviaukon valo aktiivisille oville
    const THRESH_LIGHT_HOUSE = '255,230,150';   // talojen lämmin valo
    const THRESH_LIGHT_BAR = '255,102,163';     // BAR: neonpinkki (sopii kylttiin)
    const THRESH_LIGHT_JUKEBOX = '215,130,255'; // Jukebox-talo (talo 5): violetti neoni
    const KERB_GAP_EXTRA = 5;        // lasketun reunakiven lisäys oven leveyteen

    /* ── Mustat lehdettömät puut (isoimmat raot) ── */
    // Isoimmat raot: talo 1–2 (x 150–200) ja talo 3–4 (x 330–380).
    // 1. puu = 1/3 viereisestä matalasta talosta (buildings[2].h = 140), pienennetty 30%
    // 2. puu = 2/3 ensimmäisen puun alkuperäisestä korkeudesta (ei pienennystä)
    const TREE1_H = buildings[2].h / 3 * 0.7;
    const TREE2_H = buildings[2].h / 3 * 2 / 3;
    const trees = [
        { x: 175, h: TREE1_H, phase: Math.random() * Math.PI * 2 },   // rako talojen 1–2 välissä
        { x: 355, h: TREE2_H, phase: Math.random() * Math.PI * 2 }    // rako talojen 3–4 välissä
    ];

/* ── Kolikko ─────────────────────────────────────── */
    const coin = { x: 590, y: 325, collected: false, sparkle: 0, despawnTimer: 0, despawnCooldown: 0, respawnTimer: 0 };
    // Kolikko ilmestyy sinne, missä pelaajan jalat voivat liikkua:
    //   x: 0..(WORLD_W - player.w), y: GROUND_Y..(WORLD_H - 50 + player.h)
    const COIN_X_MIN = 0;
    const COIN_X_MAX = WORLD_W - player.w;          // 780
    const COIN_Y_MIN = GROUND_Y;                    // 310 – jalat maan tasolla
    const COIN_Y_MAX = (WORLD_H - 50) + player.h;   // 380 – jalat alimmillaan (aidan takana)
    function randomCoinX() { return COIN_X_MIN + Math.random() * (COIN_X_MAX - COIN_X_MIN); }
    function randomCoinY() { return COIN_Y_MIN + Math.random() * (COIN_Y_MAX - COIN_Y_MIN); }
    let COIN_RESPAWN_FRAMES = 7200;   // 120 s @ 60 fps – säädettävissä kaaostasolla

    /* ── Sädease – poimittava kadulta, vain FULL CHAOS ── */
    let beamWeaponCollected = false;   // tallennettu tila (gameState.js)
    let beamPickup = null;             // { x, y } – esine kadulla (null = ei näkyvissä)
    /* Bugikorjaus: poiminta onnistuu vain, jos pelaajan JALKAPISTE on alle
       10 px päässä esineestä (`update`). Satunnainen y (`randomCoinY`) saattoi viedä
       esineen täsmälleen lampputolpan kohdalle, jossa sitä ei saanut napattua:
         • matalilla y-arvoilla (310–325) koko esine jää pylvään TAAKSE piiloon
           (tolpan juuri on syvyysviivalla LAMP_BASE_Y 325),
         • täsmäasettumista vaikeuttaa tolpan estoblokki: pelaajan keskiö 286–295
           työnnetään aina ±15 px päähän (LAMP_BLOCK_X) → 10 px:n säde ei täyty,
         • syvemmät y-arvot ovat ajoradalla, jossa FULL CHAOSin liikenne kaataa
           pelaajan kesken poiminnan.
       Nyt esine ilmestyy AINA samalle syvyysviivalle: teräsaidan viereen, pelaajan
       alimpaan mahdolliseen jalkapisteeseen (COIN_Y_MAX = (WORLD_H − 50) + h = 380).
       Siellä jalkapiste on tasan esineen kohdalla (dy = 0) → täysi 10 px:n
       vaakasuuntainen pelivara, tolppablokki ei laukea lainkaan (keskiö 365 >
       LAMP_PASS_FRONT_Y 310), pylväs ei peitä esinettä (esine ja vilkkuva piste ovat
       pylvään juuren alapuolella) eikä liikenne yllä aidan juureen asti. */
    const BEAM_PICKUP_Y = COIN_Y_MAX;                  // 380 = aidan juuri (alin jalkapiste)
    // x saa olla satunnainen, mutta ei aivan reunaan: poiminta vaatii pelaajan
    // keskipisteen alle 10 px päähän, ja keskipiste yltää välille [w/2, WORLD_W − w/2].
    const BEAM_PICKUP_X_MIN = player.w / 2;            // 10
    const BEAM_PICKUP_X_MAX = WORLD_W - player.w / 2;  // 790
    let aimX = 0, aimY = 0;            // tähtäyspiste (maailmakoordinaatit)
    let aimActive = false;             // hiiri on käynyt (ristikko näytetään PC:llä)
    let beamFireTimer = 0;             // säteen piirto frameä laukaisun jälkeen
    let beamCooldownTimer = 0;         // laukaisun lukitus – tikittää update()ssa
    let beamStartX = 0, beamStartY = 0;  // säteen lähtöpiste (jäädytetään laukaisussa)
    let beamEndX = 0, beamEndY = 0;      // säteen kohdepiste (jäädytetään laukaisussa)
    const BEAM_HIT_TOLERANCE = 0;      // osuma vain jos säde osuu meteoriitin kehään (tarkka)
    const BEAM_FIRE_FRAMES = 60;       // säteen näkyvyysaika (frameä) – ~1 s valoraita
    const BEAM_COOLDOWN_FRAMES = 60;   // laukaisuväli 1,0 s – huti maksaa saman kuin osuma
    const METEOR_HITS_TO_KILL = 2;     // meteoriitti kestää 2 osumaa (kuori halkeaa ensin)

    /* ── Sähkökaapit (talojen kyljissä, kerrostalon vas. seinä) ── */
    // 1. kaappi: 1. puu (trees[0], x 175) on talojen 1–2 välissä. Sen oikealla
    // puolella olevan talon (buildings[2], x 200–250) vasen seinä on x 200.
    // 2. kaappi: talo 7 (buildings[6], x 560–610, matala h 145) – sama ilmentymä
    // kopiona, vasen seinä x 560 (2px rako oveen, ikkunat kaapin yläpuolella).
    // Kaappi on ikkunan kokoinen (8×14), harmaa. Tila on elävä: alussa arvotaan
    // ~50 % päälle, ja sen jälkeen jokainen kaappi sammuu/käynnistyy itsestään
    // omaan satunnaiseen tahtiinsa (CAB_REROLL_MIN..MAX frameä → tila arvotaan
    // uudelleen). Vain päällä oleva kaappi antaa sähköiskun (tajunta pois +
    // hampurilaisen menetys, kuten kukkaruukku/auto). Päällä olevan kaapin
    // keltainen varoitusvalo vilkkuu jokaisella kaapilla OMAAN tahtiin ja
    // vaiheeseensa (ei tasatahtiin); sammuksissa olevan kaapin valo on tumma
    // eikä kaappi iske. Testityökalu (ei tallenna): ?cabs=1 = molemmat päällä,
    // ?cabs=0 = molemmat sammuksissa (jäädyttää tilakellon).
    let   ELECTRIC_CABINET_ON = 0.5;      // todennäköisyys, että kaappi on päällä (kaaos K3)
    let   CAB_BLINK_MIN = 420, CAB_BLINK_MAX = 700;   // oma vilkunta ms / kaappi (kaaos K2)
    let   CAB_REROLL_MIN = 900, CAB_REROLL_MAX = 2100;  // uusi arpa 15–35 s välein / kaappi (kaaos K2)
    const CAB_FORCE = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search).get('cabs') : null;
    const cabOn = () => CAB_FORCE === '1' ? true : (CAB_FORCE === '0' ? false : Math.random() < ELECTRIC_CABINET_ON);
    const cabRerollTimer = () => CAB_REROLL_MIN + Math.random() * (CAB_REROLL_MAX - CAB_REROLL_MIN);
    const electricCabinets = [
        { x: 200, w: 8, h: 14, y: GROUND_Y - 16, bldgIdx: 2,
          on: cabOn(), phase: Math.random() * Math.PI * 2,
          period: CAB_BLINK_MIN + Math.random() * (CAB_BLINK_MAX - CAB_BLINK_MIN),
          timer: cabRerollTimer() },   // talo 3 – vasen seinä
        { x: 560, w: 8, h: 14, y: GROUND_Y - 16, bldgIdx: 6,
          on: cabOn(), phase: Math.random() * Math.PI * 2,
          period: CAB_BLINK_MIN + Math.random() * (CAB_BLINK_MAX - CAB_BLINK_MIN),
          timer: cabRerollTimer() }    // talo 7 – vasen seinä
    ];

    /* talojen/lamppujen/kaappien/puiden OLETUSPAIKAT talteen, jotta
       NORMAL/MILD/GOOD palautuvat bitti-identtisiksi myös BAD/FULL-runin
       jälkeen (shuffleBuildingOrder mutatoi x-arvot pysyvästi). */
    const BUILDING_X_DEFAULT = buildings.map(b => b.x);
    const LAMP_X_DEFAULT     = lamps.map(l => l.x);
    const CAB_X_DEFAULT      = electricCabinets.map(c => c.x);
    const TREE_X_DEFAULT     = trees.map(t => t.x);
    let buildingOrderShuffled = false;   // onko edellinen init sekoittanut järjestyksen
    function resetBuildingOrder() {
        if (!buildingOrderShuffled) return;   // NORMAL/MILD/GOOD: ei kosketa (bitti-identtinen)
        for (let i = 0; i < buildings.length; i++) buildings[i].x = BUILDING_X_DEFAULT[i];
        for (let i = 0; i < lamps.length; i++) lamps[i].x = LAMP_X_DEFAULT[i];
        for (let i = 0; i < electricCabinets.length; i++) electricCabinets[i].x = CAB_X_DEFAULT[i];
        for (let i = 0; i < trees.length; i++) trees[i].x = TREE_X_DEFAULT[i];
        _allWindows = null;
        litWindows.length = 0;
        seedLitWindows();   // sama syy (esim. BAD/FULL → NORMAL samassa sessiossa)
        buildingOrderShuffled = false;
    }

    /* ── Avain (Dig Gamesta) ───────────────────────── */
    let digKeyCollected = false;
    let boulderKeyCollected = false;
    let bmKeyCollected = false;
    // Sama ehto kuin palkintohuoneessa (handleAction) ja HUD:issa – yksi lähde.
    function allKeysCollected() {
        return digKeyCollected && boulderKeyCollected && bmKeyCollected;
    }
    /* ── Makuuhuone (ex-palkintohuone, talo 7) ────────
       Ovi on aina auki (sama käytös kuin BAR:lla): ei avaimia
       eikä lamppua, päivällä ja yöllä – pelaaja päättää itse, milloin
       haluaa nukkua. Huoneessa on kaksi valintaa: Nuku ja Poistu.
         Poistu = ei muuta mitään (päivä/yö pysyy ennallaan)
         Nuku   = päivä → yö  TAI  yö → päivä
       Molemmat ovat ilmaisia eikä niillä ole vaikutusta talouteen. */
    let sleepRoom = false;         // makuuhuone päällä
    let sleepSel = 0;              // 0 = Nuku, 1 = Poistu
    let sleepHeldUp = false;       // ▲ reunanilmaisu
    let sleepHeldDown = false;     // ▼ reunanilmaisu
    let sleepPhase = 0;            // > 0 = nukkumisen pimennys käynnissä (frameä)
    const SLEEP_DARK_FRAMES = 45;   // ~0,75 s: ruutu ehtii mustaksi ennen Zzziä
    const SLEEP_ZZZ_FRAMES  = 280;  // ~3 s: itse Zzz-efekti mustalla taustalla
    const SLEEP_FADE_FRAMES = SLEEP_DARK_FRAMES + SLEEP_ZZZ_FRAMES;  // ~3,75 s yhteensä
    /* ── Nälkä on jäissä vain nukkuessa (käyttäjän linjaus) ──
       Makuuhuone ja nukkumisen Zzz-pimennys pysäyttävät nälkäajastimen,
       joten pelaaja ei voi kuolla nukkuessaan. Kaikkialla muualla (katu,
       BAR, jukebox, iframe-pelit) kulutus jatkuu kuten kadulla –
       pelaaja huolehtii itse, ettei pelaa tai käy "ostoksilla" nälissään. */
    function hungerOnHold() { return sleepRoom || sleepPhase > 0; }
    /* Tila, jossa kuolema ei näkyisi: huone peittää kadun tai alapeli on
       auki. Sinne ei jätetä pelaajaa kuolemaan – huone/alapeli suljetaan
       ensin (leaveHiddenStateForDeath), jotta kuolinsekvenssi näkyy kadulla.
       Myös sanomalehden lukutila peittää kadun. */
    function insideHiddenState() { return iframeOpen || barRoom || jukeboxRoom || newsRoom; }
/* ── Päivä/yö-tila (Vaihe 4 loppuun): yksi olio ────────────
       Aiemmin 15 irtamuuttujaa (~178 viittausta): isDay, dayT, moonX,
       moonNightClock, moonDark, moonSaveTimer, sunX, sunDayClock,
       sunSaveTimer, cycleChangeTimer, dayLampsOff, nightShowArmed,
       nightShowQueue, nightShowTimer, spawnLampTimer. Ryhmittely kokoaa
       tilan yhteen paikkaan (nollaus/reset myöhemmin yhdestä paikasta) –
       EI toiminnallisia muutoksia.
       HUOM: `state.isDay` (tallennettu pelitila) on ERI asia kuin
       `dayNight.isDay` (tämän istunnon liukuva tila). */
    const dayNight = {
        isDay: false,            // istunnon päivä/yö-tila (tallennetaan `state.isDay`:hin)
        t: 0,                    // 0 = yö … 1 = päivä (liukuva; entinen `dayT`)
        cycleChangeTimer: 0,     // kaaos K2: asetetaan alla (CYCLE_CHANGE_DELAY_FRAMES + 1)
        moonX: 0,                // kuun nykyinen x   (asetetaan alla: MOON_X_MIN)
        moonNightClock: 0,       // yön kulku (framet) kuun rataa varten
        moonDark: 0,             // kuun laskusta johtuva pimeneminen
        moonSaveTimer: 0,        // tallennusvälin laskuri
        sunX: 0,                 // auringon x       (asetetaan alla: SUN_X)
        sunDayClock: 0,          // päivän kulku (framet) auringon rataa varten
        sunSaveTimer: 0,         // tallennusvälin laskuri
        dayLampsOff: false,      // päivä sammutti katuvalot kerran
        nightShowArmed: false,   // yön lamppushow saa laueta (asetetaan alla: DAY_FORCE)
        nightShowQueue: [],      // syttymättömien lamppujen indeksit
        nightShowTimer: 0,       // frameä seuraavaan lamppuun
        spawnLampTimer: 0        // laskuri spawn-lamppushow'lle
    };
    let barRoom = false;
    let barBuyQty = 0;             // BAR: tämän vierailun ostetut (▼ peruu vain nämä)
    let barBuyHeldUp = false;      // ▲ reunanilmaisu – ei toistoa pohjassa
    let barBuyHeldDown = false;    // ▼ reunanilmaisu

    /* ── Jukebox (talo 5, buildings[4], ovi x 410) ────
       Ovi aukeaa vasta kun talon ikkunat on potkaistu valaistuiksi
       (1. painallus ovella = potku → valot 20 s, 2. painallus = sisään).
       1 kolikko = 1 kappale, joka soi kokonaan loppuun asti. */
    const JUKEBOX_BLDG_IDX = 4;
    /* Makuuhuone (ex-palkintohuone, talo 7, ovi x 675, lamps[3]):
       ovi aina auki, ei lukkoa eikä kolikoita */
    const SLEEP_BLDG_IDX = 7;
    /* HOSTEL-kyltti (makuuhuoneen talo): sininen neonvalo julkisivussa.
       Kyltti piirretään talon mukana (ks. drawHostelSign), joten se seuraa
       taloa BAD/FULLin järjestyssekotuksessa ja katoaa talon tuhoutuessa.
       Huoneen sisällä on sama nimi (HOSTEL - BEDROOM). */
    const HOSTEL_SIGN_TEXT  = '[HOSTEL]';   // tiukka asettelu: ei välilyöntejä
    const HOSTEL_NEON       = '#7fdcff';   // neonin ydin (vaalea sininen)
    const HOSTEL_NEON_GLOW  = '#0a84ff';   // hohteen väri (tummempi sininen)
    /* CASINO-kyltti (hedelmäpelitalo, buildings[6]): neonvihreä teksti
       ohuessa mustassa kehyksessä + jalat, talon katon yläpuolella.
       Kyltti piirretään talon mukana (ks. drawCasinoSign), joten se seuraa
       taloa BAD/FULLin järjestyssekotuksessa ja katoaa talon tuhoutuessa. */
    const FRUIT_BLDG_IDX   = 6;             // hedelmäpelitalo (buildings[6])
    const CASINO_SIGN_TEXT = 'CASINO';
    const CASINO_NEON      = '#8dffb0';    // neonin ydin (vaalea vihreä)
    const CASINO_NEON_GLOW = '#0ac84f';    // pieni hehku (tummempi vihreä)
    const BAR_BLDG_IDX = 8;      // BAR-talo (tuhoutuu vasta viimeisenä)
    /* Laivanupotus (talo 2, buildings[2]) – ei omaa lamppua,
       1. potku sytyttää ikkunat, 2. potku avaa oven. Aina auki yöllä ja päivällä. */
    const SINKSHIP_BLDG_IDX = 2;
    /* Tiedostonimet vastaavat sisältöä (korjattu 20.9.2026): aiemmin
       `our_song.mp3` ja `unafraid.mp3` olivat ristissä keskenään → raita 1 ja 2
       soivat valitun nimen vastaisesti. Älä "korjaa" nimiä takaisin ristiin.
       Rivit 4–6 lisätty 22.9.2026: D:\AI\free_music -kansion kolme
       ilmaista heavy metal -raitaa entisten jatkoksi (1 → 6).: raidat 7–9
       lisätty (Alex Morgan + 2× NickPanek). Hinta ja veloitus ennallaan:
       1 🪙 / kappale (sääntö 04). */
    const JUKEBOX_TRACKS = [
        { url: 'jukebox/Knived_Our_song.mp3',              title: 'Knived - Our Song',          duration: '4:24' },
        { url: 'jukebox/Knived_Unafraid.mp3',              title: 'Knived - Unafraid',          duration: '4:43' },
        { url: 'jukebox/Knived_Unafraid_instrumental.mp3', title: 'Knived - Unafraid (inst.)',  duration: '2:08' },
        { url: 'jukebox/alec_koff-heavy-doom-dark-metal-493397.mp3', title: 'Alec Koff - Heavy Doom',        duration: '1:53',
          cover: 'jukebox/covers/4.png' },
        { url: 'jukebox/alec_koff-in-heavy-metal-492175.mp3',        title: 'Alec Koff - In Heavy Metal',    duration: '2:45',
          cover: 'jukebox/covers/5.png' },
        { url: 'jukebox/mrclaps-this-heavy-metal-492569.mp3',        title: 'MrClaps - This Heavy Metal',    duration: '2:09',
          cover: 'jukebox/covers/6.png' },
        { url: 'jukebox/7_alex-morgan-thrash-metal-591343.mp3',                     title: 'Alex Morgan - Thrash Metal',         duration: '3:02',
          cover: 'jukebox/covers/7_alex-morgan-thrash-metal-591343.png' },
        { url: 'jukebox/8_nickpanek-coffee-first-heavy-grunge-metal-instrumental-391308.mp3', title: 'NickPanek - Coffee First Heavy Grunge Metal (inst.)', duration: '3:04',
          cover: 'jukebox/covers/8_nickpanek-coffee-first-heavy-grunge-metal-instrumental-391308.png' },
        { url: 'jukebox/9_nickpanek-heavy-doom-metal-instrumental-288971.mp3',                title: 'NickPanek - Heavy Doom Metal (inst.)',                duration: '3:02',
          cover: 'jukebox/covers/9_nickpanek-heavy-doom-metal-instrumental-288971.png' }
    ];
    /* Kansikuvat (22.9.2026): raidoilla 4–6 on kansikuva, joka näytetään
       jukebox-kaapin levykuvan paikalla **kappaleen soidessa**. Raidoilla 1–3
       ei ole kuvaa → niiden kohdalla levy piirretään täsmälleen kuten ennen.
       Lataus BAR-taulun mallilla: `ready`-lippu + `typeof Image` -tarkistus
       (headless-validonnat), varapinta jos kuva ei lataudu. Ei uusia
       localStorage-avaimia eikä talousmuutoksia (sääntö 04).

       ⚠ MÄPPÄYS – kansiotiedoston nimi = **jukebox-rivi** (`covers/4.png` =
       rivi 4). D:\AI\free_music -kansion numerointi EI vastaa jukeboxin rivejä,
       koska jukeboxissa raidat ovat aakkosjärjestyksessä:
         jukebox rivi 4 (Alec Koff - Heavy Doom)     ← 6_img.PNG
         jukebox rivi 5 (Alec Koff - In Heavy Metal) ← 5_img.PNG
         jukebox rivi 6 (MrClaps - This Heavy Metal) ← 4_img.PNG
       Älä kopioi kuvia uudelleen "numero numeroa vasten" – tarkista tämä lista.
       Kuvien sisällöllä ei ole väliä, vain rivi↔kuva-paritus ratkaisee. */
    const jukeCovers = JUKEBOX_TRACKS.map((t) => {
        if (!t.cover || typeof Image !== 'function') return null;
        const rec = { img: new Image(), ready: false };
        rec.img.onload  = () => { rec.ready = true;  };
        rec.img.onerror = () => { rec.ready = false; };
        rec.img.src = t.cover;
        return rec;
    });
    let jukeboxRoom = false;
    let jukeSel = 0;               // kursori: 0 = Poistu-rivi, 1..N = kappale
    let jukeHeldUp = false;        // ▲ reunanilmaisu
    let jukeHeldDown = false;      // ▼ reunanilmaisu
    /* Monivalinta: kappaleita voi valita useamman ja valitut soitetaan
       poistuttaessa yksi kerrallaan (1 → N). Hinta ennallaan: 1 🪙 / kappale. */
    let jukePick = JUKEBOX_TRACKS.map(() => false);  // valitut kappaleet (true = listalla)
    let jukeSpaceHeld = false;     // Space/⚡/(o) reunanilmaisu (ota/poista)
    let jukeEnterHeld = false;     // Enter-reunanilmaisu (soita & poistu)
    let jukeQueue = [];            // soivat kappaleet numeroina (1..N), sama kuin audio-jono
    let jukeSavedPos = -1;         // viimeksi tallennettu jukebox-positio

    /* ── Sanomalehti ──────────────────────────
       Kadulla lojuva lehti avataan toimintonapilla → peliohjeet.
       Lukutila on kuin canvas-huone: maailma jäätyy, nälkä kuluu
       ja ✕-nappi sulkee (closeRoom). Sivuja selataan
       ▲/▼, Space (⚡) vie seuraavalle sivulle ja poistuu viimeiseltä,
       (o)/Enter poistuu heti. Ei tallennettavaa tilaa. */
    let newsRoom = false;
    let newsHeldUp = false;        // ▲ reunanilmaisu
    let newsHeldDown = false;      // ▼ reunanilmaisu
    let newsSpaceHeld = false;     // Space/⚡ reunanilmaisu (seuraava sivu)
    let newsExitHeld = false;      // (o)/Enter reunanilmaisu (poistu heti)

    /* ── Huonerekisteri (Vaihe 3) ─────────────────────────────────────────
       Jokainen kadun canvas-huone on olio, jolla on sama rajapinta:
         isOpen()   – onko huone auki (koko näkymä on huone)
         update(dt) – true = käsitteli framen (update() palaa heti)
         draw()     – piirtää huoneen (kutsutaan vain kun isOpen())
         close()    – ✕ / closeRoom(): sulkee huoneen, true = oli auki
       Uuden huoneen lisäys = yksi olio tähän listaan + omat update/draw/
       close-funktiot – update(), render() eivät muutu.
       Huoneet ovat modaalisia (enintään yksi auki kerrallaan), joten
       järjestys on vapaa; se on kuitenkin sama kuin entinen käsittelyjärjestys.
       HUOM: oven avaaminen (potku, valot, avaimet) on yhä omissa
       tryXxxDoor()-funktioissaan – huone ei avaa itseään. */
    /* ── Huoneiden LOGIIKKA omasta tiedostosta (Vaihe 5 osa 8) ──
       street/rooms.js omistaa huoneiden update/close- ja jukebox-funktiot
       (piirto siirtyi jo osassa 6). Tähän tuodaan samat nimet, joten rekisteri
       ja kutsut eivät muutu. */
    const {
        updateSleepRoom, updateBarRoom, updateJukeboxRoom,
        closeSleepRoom, closeBarRoom, closeJukeboxRoom, resetJukeboxRoom
    } = StreetRooms;

    const rooms = [
        { name: 'sleep',   isOpen: () => sleepRoom,   update: updateSleepRoom,   draw: StreetRooms.drawSleep,     close: closeSleepRoom },
        { name: 'bar',     isOpen: () => barRoom,     update: updateBarRoom,     draw: StreetRooms.drawBar,       close: closeBarRoom },
        { name: 'jukebox', isOpen: () => jukeboxRoom, update: updateJukeboxRoom, draw: StreetRooms.drawJukebox,   close: closeJukeboxRoom },
        { name: 'news',    isOpen: () => newsRoom,    update: updateNewsRoom,    draw: StreetNews.drawView, close: closeNewsRoom }
    ];


    let coinCount = 0;
    let hamburgerCount = 5;
    let hamburgerTimer = 2400;  // 40s @ ~60fps – lukittu tahti (sääntö 04)
    let burgerInterval = 2400;  // 🍔-kulutustahti kaaosakselina (K4); NORMAL 2400
    /* ── Olut & humala (VAIN FULL CHAOS) ─────────────────────────
       FULLissa BAR myy olutta 🍺 hampurilaisten sijaan. Elämä on
       KAKSIKERROKSINEN: 🍺 (ylin, ostettava, tuottaa humalan) kuluu ensin,
       ja vasta kun oluet on juotu loppuun, klassinen 🍔-nälkä palaa.
       Sama sääntö koskee törmäystä: se vie ylimmän kerroksen. Humalataso =
       oluiden määrä (0–10): 1 = hieman horjuntaa, 10 ≈ lähes mahdoton;
       haihtuu 1 taso / burgerInterval (sama tahti kuin 🍔:llä). MUUT MOODIT
       eivät kosketa näitä muuttujia lainkaan. */
    const DRUNK_MAX = 10;         // humalan katto (= oluiden katto)
    const BAR_BEER_H = 58;        // oluttuopin korkeus BAR-huoneessa (px)
    /* Humalan horjunnan voimakkuus tasolla 10 (helppo säätö yhdestä vakiosta).
       Skaalautuu lineaarisesti 1 → 10; lopullinen amplitudi ≈ ×0,6 / ×0,45. */
    const DRUNK_WOBBLE_MAX = 3.0;
    /* Tästä humalatasosta ylöspäin pelaaja ottaa PAIKALLAAN hallitsemattomia
       askeleita (/c): seistessäkin keho horjahtaa suuntaan tai toiseen
       – voi ajautua auton alle tekemättä mitään. Askeleen pituus ja tahti
       kasvavat humalan mukana (10 ≈ lähes mahdoton ohjata). */
    const DRUNK_IDLE_WOBBLE_MIN = 7;
    const DRUNK_STEP_PX = 9;      // perusaskeleen pituus (px)
    const DRUNK_STEP_MIN = 60;    // lyhin väli askeleiden välillä (1 s = 60 fr)
    const DRUNK_STEP_MAX = 300;   // pisin väli (5 s = 300 fr) – aina satunnainen 1–5 s
    const DRUNK_STEP_FRAMES = 9;  // askel liu'utetaan näin monen framen yli (ei nykäystä)
    let drunkLevel = 0;           // 0–10 (vain FULL)
    let drunkTimer = 0;           // humalan haihtumisajastin (vain FULL)
    let drunkStepTimer = 0;       // seuraavaan hallitsemattomaan askeleeseen
    let drunkLurchX = 0;          // jäljellä oleva hallitsematon siirtymä (px, liukuva)
    let drunkLurchY = 0;
    let drunkLurchFrames = 0;     // montako frameä liukua on jäljellä
    /* /f: humalassa ≥ DRUNK_AIM_MIN (3) sädeaseen TÄHTÄYS alkaa horjua
       (ristikko + itse laukaus). 1–2 = ei virhettä; 8–10 = osuu enää tuurilla.
       käyrä LOIVENNETTU – 3–5 🍺 vielä helppo (pieni heitto),
       jyrkkenee vasta 6→10. Taulukko: siirtymä (px) per humalataso (0–10). */
    const DRUNK_AIM_MIN = 3;
    const DRUNK_AIM_PX = [0, 0, 0, 3, 5, 7, 10, 15, 30, 46, 60];
    function drunkWobble() {
        if (drunkLevel <= 0) return 0;
        return (drunkLevel / DRUNK_MAX) * DRUNK_WOBBLE_MAX;
    }
    /* Tähtäysvirhe humalassa (/f): horjuva siirtymä tähtäyspisteeseen. */
    function drunkAimShift() {
        if (!chaosFlags.drunk || drunkLevel < DRUNK_AIM_MIN) return { x: 0, y: 0 };
        const lvl = Math.max(0, Math.min(DRUNK_MAX, Math.round(drunkLevel)));
        const amp = DRUNK_AIM_PX[lvl] || 0;
        if (amp <= 0) return { x: 0, y: 0 };
        const f = amp / DRUNK_AIM_PX[DRUNK_MAX];     // taajuus kasvaa humalan mukana
        const t = Date.now() * 0.001;
        return {
            x: Math.sin(t * (1.6 + f * 3.0)) * amp,
            y: Math.sin(t * (1.3 + f * 2.4) + 1.1) * amp * 0.8
        };
    }
    /* Herätysrauha: nukkumisen jälkeen nälkäajastimelle jää vähintään
       tämä aika, ettei 1 🍔:lla nukkunut voi kuolla heti sängystä noustuaan.
       Ajastin ei nollaudu täyteen → ei ilmaista 40 s:ää eikä sängyssä
       käymisen hyväksikäyttöä. */
    let   HUNGER_WAKE_GRACE = 600;  // 10 s @ ~60fps (kaaos K4)
    /* HUD:n 🍔-varoitus: vilkkuva punainen, kun tämä määrä tai
       vähemmän on jäljellä. 3 on oikea raja – siinä kannattaa jo syödä,
       ettei henki lähde seuraavasta osumasta. */
    const HUNGER_WARN = 3;
    /* ── 🍔-määrä vaikuttaa kävelyvauhtiin ────────────────────────
       Pelaaja tuntee olonsa kropassa: nälkäisenä jalka painaa, hyvin
       syöneenä kulkee lujaa. Vain pelaajan liike hidastuu/kiihtyy –
       talousarvot (kolikot, 🍔-tahti 2400, katto 10, hinnat, RTP) ja
       vihollisten nopeudet (oviukko 2.0, rosvo 1.05) ovat ennallaan
       (sääntö 04). Seuraus: 8–10 🍔:llä oviukon voi karistaa karkuun –
       se on tarkoituksellinen palkinto täydestä vatsasta. */
    const HUNGER_SPEED_SLOW_MAX  = 3;      // tähän asti hidas (sama raja kuin HUD-varoitus)
    const HUNGER_SPEED_FAST_MIN  = 8;      // tästä ylöspäin nopea
    const HUNGER_SPEED_SLOW_MULT = 2 / 3;  // nälkäinen: 2/3 normaalista
    const HUNGER_SPEED_FAST_MULT = 2;      // täysi vatsa: tuplanopeus
    /* Testityökalu (ei tallenna mitään, kuten ?day / ?hole): ?burgers=9
       pakottaa VAIN vauhtilaskennan käyttämään tätä 🍔-määrää → kaikki
       kolme vauhtitasoa voi testata heti. HUD ja oikea saldo näyttävät
       edelleen totuuden eikä localStorageen kirjoiteta mitään. */
    const BURGER_PARAM = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search).get('burgers') : null;
    const BURGER_FORCE = (BURGER_PARAM !== null && /^\d+$/.test(BURGER_PARAM))
        ? Number(BURGER_PARAM) : null;
    /* Vauhtikerroin: ≤3 🍔 → 2/3 · 4–7 🍔 → 1,00 (normaali) · ≥8 🍔 → 2,00 */
    function hungerMultFor(n) {
        if (n <= HUNGER_SPEED_SLOW_MAX) return HUNGER_SPEED_SLOW_MULT;
        if (n >= HUNGER_SPEED_FAST_MIN) return HUNGER_SPEED_FAST_MULT;
        return 1;
    }
    function hungerSpeedMult() {
        const n = (BURGER_FORCE !== null) ? BURGER_FORCE : hamburgerCount;
        return hungerMultFor(n);
    }
    let firstHouseWindowsLit = false;
    let firstHouseKickCount = 0;
    let firstHouseKickTarget = 0;    // random 3-6, arvotaan ekan potkun yhteydessä
    let firstHouseWindowTimer = 0;   // 20s laskuri, nollautuu joka potkusta
    let flowerPot = null;            // { x, y, vx, vy, active, rotation }
    let kickCoin = null;             // { x, y, vy, landed, ttl } – kolikko potkusta
    let kickCoinCooldown = 0;        // 30s tauko ennen kuin uusi kolikko voi pudota potkusta

    /* ── Salainen kolikkopalkkio (TESTITYÖKALU) ────────
       Vitoslamppu (lamps[4], x 720) 20 potkua putkeen → +20 kolikkoa.
       Avain-cheat (5 potkua → kaikki avaimet + koko valorivi syttyy) säilyy
       koskemattomana; tämä on sen jatko ("5 + 15 heti perään").
       Ei popuppia, ei ääntä, ei hiukkasia – vain saldo kasvaa (HUD + tallennus).
       Putki nollautuu: välissä toinen lamppu, tauko > COIN_CHEAT_GAP, palkkio,
       respawn/reset. Cooldownin aikana potkut eivät kerrytä putkea lainkaan. */
    const COIN_CHEAT_LAMP     = 4;      // vitoslamppu (x 720, BAR-lamppu)
    const COIN_CHEAT_KICKS    = 20;     // potkut putkeen (5 avain-cheat + 15 jatkoa)
    const COIN_CHEAT_REWARD   = 20;     // kolikkoa palkkiosta
    const COIN_CHEAT_GAP      = 120;    // 2s @ ~60fps: sallittu väli potkujen välissä
    const COIN_CHEAT_COOLDOWN = 3600;   // 60s @ ~60fps palkkion jälkeen (0 = ei cooldownia)
    /* ── Salainen kolikkopalkkio: putken tila (Vaihe 4) ────────────────
       Ryhmitelty yhdeksi olioksi (ennen kolme irrallista muuttujaa).
       Testityökalu: ei vaikuta talouteen eikä tallennu. */
    const coinCheat = {
        streak: 0,      // peräkkäiset potkut vitoslamppuun
        gapTimer: 0,    // montako frameä putki vielä pysyy voimassa
        cooldown: 0,    // cooldownin jäljellä olevat framet
        reset() { this.streak = 0; this.gapTimer = 0; this.cooldown = 0; }
    };

    /* ── Oviukko (Avenger): kolikon vastakohta ────────
       Ei putoa ikkunasta kuten ruukku/kolikko – astuu OVESTA kynnykseltä ja
       lähtee perään. Nopeus on ½ pelaajan nopeudesta: pelaaja luulee
       pääsevänsä karkuun, mutta katu on rajattu (800 px) → laidalla se
       nappaa ("jahtaa kuvaruudun laitaan asti ja antaa turpaan").
       Nälkäisenä (≤3 🍔 = 0,82) se tavoittaa jo avoimella kadulla.
       Huoneet ja sanomalehti jäädyttävät sen (updateAvenger ei pyöri).
       Osuma = tainnutus + 1 hampurilainen (kuten kukkaruukku).
       AVENGER_KIND: 'twin' = pelaajan kaksonen (nyt). 'dog' = koira myöhemmin. */
    const AVENGER_KIND      = 'twin';
    let   AVENGER_CHANCE    = 0.12;    // 1/8 – harvinaisempi kuin kolikko (1/5); kaaos K3
    let   AVENGER_COOLDOWN  = 1800;    // 30s tauko @ ~60fps (kuten potkukolikolla); kaaos K3
    let   AVENGER_SPEED     = 1.0;     // ½ nopeudesta (oli 2.0) – teeskennelty karkuunpääsy; kaaos K3
    let   AVENGER_TELEGRAPH = 21;      // ~350ms oviaukon varoitus ennen ulostuloa; kaaos K3
    const AVENGER_HIT_R     = 18;      // osumasäde (px)
    let   AVENGER_STUN      = 600;     // 10s tainnutus (sama kuin ruukulla/autolla); kaaos K4
    let   AVENGER_FREEZE    = 180;     // 3s jäädytys (hit-stop) kontaktista ennen kosahtamista; kaaos K3
    let avenger = null;              // { x, y, w, h, bldgIdx, facing, phase, timer, walkTimer, scale }
    let avengerCooldown = 0;         // tauko ennen kuin uusi oviukko voi tulla

    /* ── Rosvo – partioi jalkakäytävällä ──
       Pysyvä hahmo: kävelee edestakaisin talojen puoleisella jalkakäytäväkaistalla.
       Kiinniotto = tainnutus + 1 hampurilainen (kuten avenger), mutta väistettävissä:
       loiki kadun toiselle puolelle (↓) pois kaistalta → rosvo ei seuraa sinne. */
    const ROBBER_W       = 20;
    const ROBBER_H       = 30;
    let   ROBBER_SPEED   = 1.05;      // peruskävelynopeus – arvotaan spawnissa; kaaos
    const ROBBER_SPEED_MIN_MULT = 0.80;   // alaraja −20 % → 0,84
    const ROBBER_SPEED_MAX_MULT = 1.50;   // yläraja +50 % → 1,575
    const ROBBER_HIT_R   = 16;        // kiinnioton säde (px)
    const ROBBER_TURN    = 40;        // ~0,7 s reunapysähdys käännöksessä (väistöikkuna)
    // Jalkakäytäväkaista (talojen puoli): jalat GROUND_Y … GROUND_Y+16
    const ROBBER_LANE_TOP    = GROUND_Y;          // 310
    const ROBBER_LANE_BOTTOM = GROUND_Y + 16;     // 326
    const ROBBER_FOOT_Y      = GROUND_Y + 4;      // rosvon jalkojen lepokorkeus
    // Yllätysesiintyminen: rosvo ilmestyy vain paluussa pelistä/jukeboxista/BARista
    let   ROBBER_APPEAR_CHANCE = 0.4;   // 1/2.5 että rosvo ilmestyy paluussa; kaaos
    let   ROBBER_COOLDOWN      = 1500;  // ~25 s tauko rosvon esiintymisten välillä; kaaos
    const ROBBER_MIN_DIST      = 200;   // turvasäde ULOSTULOKOHDASTA: rosvo ei koskaan
                                        // ilmesty lähelle sitä kohtaa, josta pelaaja tuli
                                        // ulos (reunaklampattu ehdokas hylätään) – pätee
                                        // jokaiseen oveen, ks. spawnRobber()
    let   ROBBER_TTL           = 900;   // ~15 s elinikä – katoaa jos ei nappaa kiinni; kaaos
    const ROBBER_GRACE_FRAMES  = 3600;  // 60 s aloitusrauha: rosvo ei ilmesty heti pelin alettua
    let   ROBBER_STUN          = 900;   // ~15 s tainnutus kiinniotosta – pidempi kuin muiden
                                        // osumien 600, jotta pelaaja ehtii nähdä, mitä kävi; kaaos K4
    let   ROBBER_CHASES_Y      = false; // rosvo jahtaa vapaasti y-akselilla (vain BAD CHAOS)
    let robber = null;        // { x, y, w, h, facing, dir, speed, pause, walkTimer, ttl }
    let robberCooldown = 0;   // tauko ennen kuin uusi rosvo voi ilmestyä
    let robberGraceTimer = 0; // aloitusrauha (framet): rosvo ei ilmesty ennen kuin 0
    let playerDead = false;          // kuolemasekvenssi käynnissä
    let deathTimer = 0;              // laskuri ennen reloadia (frameä)
    let deathAlpha = 0;              // mustan overlayn alpha (0→1 pimennyksen aikana)
    const smallHouseLights = {};     // { '2': { lit: false, timer: 0 }, ... }
    let groundAnimal = null;         // { type, x, y, vx, direction, hopY, hopVel, animTimer, pauseTimer }
    let animalSpawnTimer = 900;      // 15s välein
    let isTouchDevice = false;
    let animClock = 0;                // animaatiokello (~frameä): hengitys + silmän vilkahdus
    let hitPauseTimer = 0;            // hit pause -laskuri: maailma jäätyy osumasta (frameä)
    let vehicleShakeTimer =0;          // tärinä ajoneuvon törmäyksestä  (frameä, vain visuaalinen)
    let meteorShakeTimer = 0;         // meteoriitin törmäyksen tärinä (frameä, vain visuaalinen)
    let meteorFlash = null;           // meteoriitin taivasvälähdys { t }
    let iframeOpen = false;           // alapeli auki (overlay) → päivän liuku pysähtyy

    /* ── Kamera (mobiili: vaakasuuntainen seuranta) ── */
    let viewW = WORLD_W;          // näkyvä maailmanleveys (PC: koko katu)
    let camX = 0;                 // kameraoffsetti vaakasuunnassa (0 = ei siirtoa)
    const CAMERA_LERP = 0.18;     // seurannan pehmeys (0–1)
    const VIEWW_MIN = 260;        // mobiilizoomauksen minimi-leveys (ei liian äärimmäinen)

    /* ── Kaukaisen kaupungin siluetti (parallaksitausta) ── */
    // Haalea sinertävä skyline lähitalojen ja puiden takana (peittää tähdet).
    // BACKDROP_PARALLAX = kuinka suuren osan kameran liikkeestä tausta "jättää väliin".
    const BACKDROP_PARALLAX = 0.4;       // tausta liikkuu 40 % kameran nopeudesta
    const BACKDROP_BASE_Y  = GROUND_Y + 4; // tyvi jää aina kiveyksen alle (ei 1px rakoa)
    const BACKDROP_PALETTE = ['#141a2c', '#171e33', '#1b2338', '#1f2942'];
    const BACKDROP_SCALE   = 0.5;        // taustatalot 50 % koossa – hillitty, kaukainen
    // Ikkunaristikko skaalattu 50 %: 10×14 → 5×7, välit 9/14 → 5/7, offset 8/10 → 4/5
    const BACKDROP_WIN_W  = Math.max(4, Math.round(10 * BACKDROP_SCALE));   // 5
    const BACKDROP_WIN_H  = Math.max(5, Math.round(14 * BACKDROP_SCALE));   // 7
    const BACKDROP_WIN_DX = Math.max(3, Math.round(9 * BACKDROP_SCALE));    // 5
    const BACKDROP_WIN_DY = Math.max(4, Math.round(14 * BACKDROP_SCALE));   // 7
    const BACKDROP_WIN_OX = Math.max(2, Math.round(8 * BACKDROP_SCALE));    // 4
    const BACKDROP_WIN_OY = Math.max(3, Math.round(10 * BACKDROP_SCALE));   // 5
    let backdrop = null;                 // { blocks: [...] } – generoidaan kerran init():ssä

    /* ── Päivä/yö ──
       Kun pelaaja on läpäissyt kaikki kolme peliä, kadulle nousee päivä kerran
       (kuu vaihtuu auringoksi, valoisuus päivätasolle). Sen jälkeen tilan voi
       vaihtaa talon 7 makuuhuoneessa (Nuku: päivä ⇄ yö) ja valinta tallennetaan
       (state.isDay). Yksi liukuva arvo dayNight.t (0 = yö … 1 = päivä) ohjaa kaikki
       muutokset, joten yö-tila piirtyy täsmälleen kuten ennen (kaikki lisäykset
       ovat ehtoja dayNight.t > 0). VISUAALINEN VAIN: hitboxit, törmäykset, kamera,
       avaimet ja talous eivät muutu mihinkään. Poikkeus: Jukebox ja
       Hedelmäpeli ovat auki vain öisin (ks. CLOSED_SIGN). */
    let   DAY_FADE_FRAMES   = 1200;        // ~20 s auringonnousu (yö → päivä; kaaos K2)
    let   NIGHT_FADE_FRAMES = 1200;        // ~20 s auringonlasku (päivä → yö; kaaos K2)
    let DAY_SKY_TOP     = '#3f7fc0';     // päivätaivaan yläosa (kaaos K1)
    let DAY_SKY_MID     = '#78b4e0';     // keskikohta
    let DAY_SKY_HORIZON = '#ffd9a0';     // lämmin horisontti
    /* YÖ/PÄIVÄ -KIERTO: kuu ja aurinko vaeltavat taivaan yli ja
       vuorokausi vaihtuu automaattisesti. Kun kuu laskee → 15 s → päivä,
       aurinko laskee → 15 s → yö. Nukkuminen ja lampun potku toimivat
       edelleen erillisinä tapoina vaihtaa vuorokaudenaikaa. */
    /* KUUN RATA: kuu alkaa aina vasemmasta laidasta (MOON_X_MIN) ja
       liukuu yön kuluessa oikealle, kunnes laskeutuu kokonaan pois näkyvistä
       (MOON_SET_X, oikean reunan yli). Laskeutuessaan se pimentää maisemaa
       hiukan (MOON_SET_DARK_ALPHA).
       Kuun paikka TALLENNETAAN (state.moonClock): F5/reload ei enää
       palauta kuuta lähtöasemaan, vaan se jatkaa siitä mihin jäi. Kuu alkaa
       alusta vain kun uusi yö alkaa (Nuku) tai kun koko tallennus nollataan
       (kuolema / ✕ "aloita alusta" → GameState.reset / removeItem). */
    const SUN_Y = 62, SUN_R = 26;       // auringon korkeus ja koko
    const SUN_X = -SUN_R * 3;              // auringon alku = ulos vasemmalta, laskeutuu oikealle
    const MOON_Y = 60, MOON_R = 30;               // kuun korkeus ja koko
    let   DAY_CYCLE_FRAMES = 10800;               // ~3 min: yhden yön TAI päivän kesto; kaaos
    const MOON_X_MIN = -MOON_R * 3;               // kuun alku = ulos vasemmalta, laskeutuu oikealle
    const MOON_SET_X = WORLD_W + MOON_R * 3;      // laskeuma ≈ 890 → kokonaan pois
    let   MOON_NIGHT_FRAMES = DAY_CYCLE_FRAMES;   // kuun liukuaika (sama kuin sykli)
    const MOON_SET_START = 0.60;                  // tästä p:stä alkaen kuu häipyy → maisema pimenee
    const MOON_SET_DARK_ALPHA = 0.15;             // "hiukan": max pimeneminen (0 = ei)
    const MOON_SAVE_FRAMES = 120;                 // tallenna kuun paikka ~2 s välein
    /* Auringon liuku päivällä: sama mekaniikka kuin kuulla yöllä.
       Aurinko alkaa vasemmalta (SUN_X) ja liukuu oikealle DAY_CYCLE_FRAMES
       aikana, kunnes laskeutuu pois (SUN_SET_X). Paikka tallennetaan. */
    const SUN_SET_X = WORLD_W + SUN_R * 3;        // laskeuma ≈ 878 → kokonaan pois
    let   SUN_DAY_FRAMES = DAY_CYCLE_FRAMES;      // auringon liukuaika (sama kuin sykli)
    const SUN_SAVE_FRAMES = 120;                  // tallenna auringon paikka ~2 s välein
    let   CYCLE_CHANGE_DELAY_FRAMES = 900;        // 15 s viive ennen automaattista vaihtoa (kaaos K2)
    /* ── Kuun ulkoasu ──
       Kuu piirretään tähtien JÄLKEEN (mutta pilvien eteen), jotta tähdet eivät
       enää tuiki kuun läpi – ennen kuu näytti "leikatulta reijältä". Pimeä puoli
       ei ole pikimusta vaan maavalon (earthshine) siniharmaa: kuu näyttää
       pyöreältä kappaleelta, joka peittää tähdet. Varjokerrokset on klipattu kuun
       kiekkoon, joten mikään ei karkaa reunan ulkopuolelle. Kaikki alla olevat
       arvot ovat ulkoasunuppeja – ne EIVÄT vaikuta kuun rataan
       (MOON_NIGHT_FRAMES) eivätkä talouteen. */
    const MOON_LIT_RGB        = [238, 242, 245];  // valoisa sirppi: hopeinen kylmä valkoinen (#eef2f5)
    const MOON_DAWN_RGB       = [255, 214, 150];  // aamunkoiton lämmin sävy sirpissä
    const MOON_DAWN_TINT      = 0.55;             // paljonko sirppi lämpenee dayT:llä (0 = ei)
    const MOON_EARTHSHINE_RGB = [64, 74, 98];     // maavalon sävy (viileä harmaansininen #404a62)
    const MOON_EARTHSHINE_A   = 0.55;             // maavalon peittävyys (0 = vanha musta varjo)
    const MOON_EARTHSHINE_FADE = 0.85;            // maavalo häipyy tämän verran nopeammin kuin sirppi
    const MOON_SHADOW_R       = 0.78;             // varjokiekon säde (× MOON_R) – entinen geometria
    const MOON_SHADOW_OFF     = 0.40;             // varjokiekon siirto (× MOON_R) – sirppi aukeaa oikealle
    const MOON_SHADOW_Y       = -0.08;            // varjokiekon pysty siirto (× MOON_R)
    const MOON_TERMINATOR_SOFT = 3;               // terminaattorin pehmeys (1 = kova reuna)
    const MOON_TERMINATOR_SPREAD = 0.12;          // uloimman pehmennyskiekon lisäsäde (× varjokiekko)
    const MOON_LIMB_DARK      = 0.10;             // pallomaisuus: reunan tummennus (0 = ei)
    const MOON_GLOW_A         = 0.26;             // hehkun kirkkaus (ennen 0.18)
    const MOON_GLOW_RGB       = [226, 236, 255];  // hehkun sävy (kylmä hopeansininen #e2ecff)
    const MOON_CRATER_RGB     = [70, 78, 96];     // kraatterien sävy (viileä tummanharmaa #464e60)
    /* Kraatterit ja maret – kiinteä lista (ei satunnaisuutta): x/y/r kuun säteen
       suhteina, a = tummuus. Piirretään ennen maavaloa → terävinä valoisalla
       sirpillä ja himmeinä tummalla puolella (maavalo kuultaa läpi).
       Tyhjä lista = ei yksityiskohtia. */
    const MOON_CRATERS = [
        { x: -0.55, y: -0.25, r: 0.16, a: 0.13 },   // valoisa sirppi
        { x: -0.45, y:  0.30, r: 0.13, a: 0.12 },
        { x: -0.30, y:  0.05, r: 0.10, a: 0.10 },
        { x:  0.30, y: -0.20, r: 0.24, a: 0.10 },   // tumma puoli (mare)
        { x:  0.45, y:  0.32, r: 0.16, a: 0.09 },
        { x:  0.12, y:  0.55, r: 0.12, a: 0.08 },
    ];
/* ── Talojen kuusta tulevat varjot ──
       Kuu on talojen TAKANA → talot varjostavat koko kadun. Varjon kauempi
       reuna siirtyy kuusta poispäin (dayNight.moonX), joten suunta kääntyy kuun
       liikkuessa. Puhtaasti visuaalista – ei koske taloutta, hitboxeja eikä
       mekaniikkoja (sääntö 04). */
    const MOON_BLD_SHADOW_LEN   = 0.36;   // varjon pituus (× talon korkeus)
    const MOON_BLD_SHADOW_SKEW  = 0.055;  // vaakasiirtymä (× (talonX − moonX) × korkeus/100)
    const MOON_BLD_SHADOW_ALPHA = 0.50;   // tummuus talon juuressa (0 = pois)
dayNight.moonX = MOON_X_MIN;                 // kuun nykyinen x (ks. update)
dayNight.moonNightClock = 0;                 // yön kulku (framet) kuun rataa varten
dayNight.moonSaveTimer = 0;                  // tallennusvälin laskuri
dayNight.sunX = SUN_X;                       // auringon x (päivällä liukuu)
dayNight.sunDayClock = 0;                    // päivän kulku (framet) auringon rataa varten
dayNight.sunSaveTimer = 0;                   // tallennusvälin laskuri
dayNight.cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES + 1;  // > DELAY = "ei käynnissä"
/* Kuun kuva: assets/moon.png (alpha-PNG) – korvaa proseduraalisen
       sirpin kun kuva on ladattu. Jos kuva ei lataudu (tai headless-testi),
       piirretään entinen proseduraalinen kuu (fallback). Käännös on tehty jo
       itse kuvaan → piirrossa ei ole ctx.rotatea. */
    const MOON_PIC_SRC = 'assets/moon.png';
    const moonPic = (typeof Image === 'function') ? new Image() : null;
    let moonPicReady = false;
    if (moonPic) {
        moonPic.onload  = () => { moonPicReady = true; };
        moonPic.onerror = () => { moonPicReady = false; };
        moonPic.src = MOON_PIC_SRC;
    }
    const DAY_LIGHT_RGB   = [70, 58, 40];  // additive-päivänvalon sävy
    const DAY_LIGHT_ALPHA = 0.30;          // 0 = ei valoa … ~0.35 = kirkas päivä
    const LAMP_DAY_DIM    = 0.15;          // paljonko lampun hehkusta jää päivällä
    let   MOSQUITO_DAY_DIM = 1;            // 1 = moskiitot häviävät päivällä (yöllä ennallaan); kaaos K2
    /* ── Pilvien päivätummuus ──
       Muoto ja määrä ovat yön ennallaan (initClouds) – vain väri tummenee ja
       peittävyys kasvaa dayT:n mukana, jotta pilvet erottuvat päivätaivaalta.
       dayNight.t = 0 → väri ja alpha ovat täsmälleen yön ennallaan. */
    const CLOUD_NIGHT_CIRRUS = [190, 200, 225];  // yön ohuet juovat
    const CLOUD_NIGHT_HAZY   = [180, 195, 215];  // yön hunnut
    const CLOUD_DAY_CIRRUS   = [96, 104, 124];   // päivä: tummanharmaa juova
    const CLOUD_DAY_HAZY     = [62, 68, 84];     // päivä: selvästi tummempi huntu
    let CLOUD_DAY_ALPHA    = 5;                // peittävyyskerroin päivällä (1 = ei muutosta) – kaaos K1
    const VEHICLE_HEADLIGHT_DIM = 1;       // ajovalot: 1 = kokonaan pois päivällä, 0 = ei muutosta
    /* Testityökalut (eivät tallenna mitään): ?day=1 = päivä heti,
       ?day=0 = pakota yö. Pakotettu tila ohittaa tallennetun tilan eikä
       käynnistä ensiauringonnousua → kumpaankin suuntaan voi testata. */
    const DAY_PARAM = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search).get('day') : null;
    const DAY_FORCE = (DAY_PARAM === '1') ? 'day' : (DAY_PARAM === '0' ? 'night' : null);
    const DAY_DEBUG = DAY_FORCE !== null;   // pakotettu → liuku heti perille

    /* ── Yölepakot ──────────────────────── */
    let BAT_COUNT_MAX   = 5;               // 0–5 lepakkoa, random – kaaos K1
    const BAT_Y_MIN       = 45;              // ylin: kuun korkeudella (MOON_Y=60, R=30 → alareuna 90)
    const BAT_Y_MAX       = 245;             // minimi: lampun kupujen yläpuolella (bulbY = 257)
    const BAT_SPEED_MIN   = 0.25;            // hitain vauhti
    const BAT_SPEED_MAX   = 0.7;             // nopein vauhti
    const BAT_WING_MIN    = 2;               // pienin siipiväli (≈ moskiitto)
    const BAT_WING_MAX    = 9;               // isoin siipiväli (puolitettu)
    const BAT_LIFE_MIN    = 900;             // minimi elinikä (15 s @60fps)
    const BAT_LIFE_MAX    = 3600;            // maksimi elinikä
    const BAT_COLORS      = ['#000000', '#080808', '#0a0a0a', '#050510', '#000005'];

    /* ── Päivälinnut ─────────────────────── */
    let   BIRD_COUNT_MIN  = 10;   // kaaos
    let   BIRD_COUNT_MAX  = 15;   // kaaos
    const BIRD_WING_MIN   = 2;
    const BIRD_WING_MAX   = 5;
    const BIRD_SPEED_MIN  = 0.2;
    const BIRD_SPEED_MAX  = 0.6;
    const BIRD_LIFE_MIN   = 1800;
    const BIRD_LIFE_MAX   = 4800;
    const BIRD_COLORS     = ['#000000', '#080808'];

    /* Päivä sammuttaa katuvalot kerran: kun aurinko on noussut
       täyteen (dayNight.t === 1), kaikki lamput sammutetaan kertaalleen. Ne voi
       silti potkaista uudelleen päälle myös päivällä. Lippu nollautuu vasta
       kun yö on palannut → seuraava auringonnousu sammuttaa taas kerran. */

    /* ── Yö sytyttää katuvalot yksi kerrallaan ──
       Päivän peilikuva: kun aurinko on laskenut täyteen (dayNight.t === 0) ja
       pelaaja on jo edennyt (päivä/yö ratkaistu = state.isDay === false,
       ts. 3 avainta + makuuhuoneen Nuku yöhön), katuvalot syttyvät itsestään
       yksi kerrallaan vasemmalta oikealle – pieni "wow" auringonlaskun päälle.
       Uudessa pelissä (state.isDay === null) valot pitää yhä potkia itse.
       HUOM: kickCount ei kasva → avain-cheat (5 potkua), kolikkopalkkio
       (20 potkua) ja ylikuumeneminen (5 potkua) pysyvät täysin ennallaan.
       Testityökalu ?day=0 näyttää efektin heti. */
    let   NIGHT_LAMP_FIRST    = 30;      // ~0,5 s ennen ensimmäistä lamppua (kaaos K2)
    let   NIGHT_LAMP_INTERVAL = 18;      // ~0,3 s lamppujen välissä (5 lamppua ≈ 1,7 s; kaaos K2)
    const NIGHT_LAMP_ORDER    = 'wave';  // 'wave' = x-järjestys · 'near' = lähin ensin
dayNight.nightShowArmed = (DAY_FORCE === 'night');  // laukeaa vain aidosta päivä→yö-siirtymästä
    let   SPAWN_LAMP_DELAY = 240;        // 4 s viive ennen lamppushowta spawnissa (kaaos K2)

    /* Saako yön lamppushow laueta? Vain kun päivä/yö on jo ratkaistu
       (pelaaja on edennyt). Testityökalu ?day=0 ohittaa portin. */
    function nightLampsAllowed() {
        if (DAY_FORCE) return DAY_FORCE === 'night';
        return state.isDay === false;
    }

    /* Kasaa yön lamppushow: mukaan vain sammuneet lamput, järjestys nupin
       mukaan. Jos kaikki jo palavat, jono jää tyhjäksi (ei ääntä/hiukkasia). */
    function startNightLampShow() {
        const idx = [];
        for (let i = 0; i < lamps.length; i++) { if (!lamps[i].lit) idx.push(i); }
        if (idx.length === 0) return;
        if (NIGHT_LAMP_ORDER === 'near') {
            const px = player.x + player.w / 2;
            idx.sort((a, b) => Math.abs(lamps[a].x - px) - Math.abs(lamps[b].x - px));
        }
        dayNight.nightShowQueue = idx;
        dayNight.nightShowTimer = NIGHT_LAMP_FIRST;
    }

    /* ── Aukiolo: Jukebox ja Hedelmäpeli auki vain öisin ──
       Päivällä ovesta tulee sama teksti-popup kuin lukitusta ovesta.
       Talousarvot eivät muutu – vain aukioloaika. Nuppi: CLOSED_AT_DAYT
       (sama raja kuin makuuhuoneen tilanvaihdossa: dayNight.t >= 0.5 = päivä). */
    const CLOSED_SIGN    = 'Open\n8pm-6am';
    const CLOSED_AT_DAYT = 0.5;   // tämän yli = päivä = ovet kiinni
    function nightOnlyClosed() { return dayNight.t >= CLOSED_AT_DAYT; }

    /* ── Ovet auki ilman lampun potkaisua päivällä ──
       Päivällä (dayNight.t >= CLOSED_AT_DAYT) ovi aukeaa ilman että katuvalo
       pitää potkaista päälle – valoisalla kadulla lamppu ei ole portti.
       Avainportit (Dig Däsh vaatii digKey, Blue Mäx vaatii boulderKey)
       pysyvät ennallaan, samoin koko yökäytös. Makuuhuone (talo 7) on
       aina auki eikä tarvitse lamppua.
       Nuppi DOOR_NO_LAMP_AT_DAY: false = vanha käytös (lamppu ensin aina). */
    const DOOR_NO_LAMP_AT_DAY = true;
    function lampFreeOpen() { return DOOR_NO_LAMP_AT_DAY && dayNight.t >= CLOSED_AT_DAYT; }

    /* Päivän tavoite liu'ulle: 1 = päivä, 0 = yö. Tallennettu tila
       (dayNight.isDay) ratkaisee, paitsi pakotettuna ?day=0/1. */
    function dayTarget() {
        if (DAY_FORCE === 'day') return 1;
        if (DAY_FORCE === 'night') return 0;
        return dayNight.isDay ? 1 : 0;
    }

    /* ── Kuun kello ──
       Yksi lähde kuun paikalle: kellosta (framet) lasketaan x ja pimeneminen.
       Samaa funktiota käyttävät init (tallennettu kello), resetMoon (0) ja
       update (kello + dt), joten kaava ei voi livahtaa eri versioiksi.
       dayNight.moonX säilyy murto-osaisena (EI Math.round) → kuu liukuu pehmeästi
       kuten pilvet, eikä hyppää pikselistä toiseen, vaikka vauhti on hidas. */
    function applyMoonClock(clock) {
        dayNight.moonNightClock = clock;
        const p = Math.min(1, dayNight.moonNightClock / MOON_NIGHT_FRAMES);
        dayNight.moonX = (skyDir >= 0)
            ? MOON_X_MIN + p * (MOON_SET_X - MOON_X_MIN)
            : MOON_SET_X - p * (MOON_SET_X - MOON_X_MIN);   // float → nykimätön liuku (kaaos: suunta)
        dayNight.moonDark = Math.min(1, Math.max(0, (p - MOON_SET_START) / (1 - MOON_SET_START)))
                   * MOON_SET_DARK_ALPHA;
    }

    /* Kuun paikka tallennetaan portin omaan tallennukseen (state.moonClock),
       jotta F5/reload jatkaa samasta kohdasta. Sama linja kuin isDay:llä:
       testityökalut (?day=0/1) eivät tallenna mitään.
       HUOM: tallennusta EI tehdä sivun sulkeutuessa (pagehide/beforeunload):
       kuolema ja ✕-resetti poistavat tallennuksen ennen reloadia, joten
       sulkeutumishetken kirjoitus herättäisi nollatun tallennuksen henkiin.
       2 s väli riittää – pahin F5-virhe on ~1,5 px kuun radalla. */
    function saveMoonClock() {
        if (DAY_FORCE) return;
        state.moonClock = Math.round(dayNight.moonNightClock);
        GameState.save(state);
    }

    /* ── Kuun nollaus ──
       Kuu alkaa vasemmasta laidasta (MOON_X_MIN) ja pimeneminen nollataan.
       Kutsutaan jokaisessa uudessa yössä (makuuhuoneen Nuku) → nollatila
       tallennetaan heti, ettei reload palauta edellisen yön paikkaa. */
    function resetMoon() {
        applyMoonClock(0);
        dayNight.moonSaveTimer = 0;
        rollMoonShadowMults();   // uusi yö → varjot arvotaan uudelleen (BAD/FULL)
        saveMoonClock();
    }

    /* ── Auringon kello ──
       Sama lähdeperiaate kuin kuulla: kellosta (framet) lasketaan x.
       Samaa funktiota käyttävät init (tallennettu kello), resetSun (0) ja
       update (kello + dt). dayNight.sunX säilyy murto-osaisena (EI Math.round). */
    function applySunClock(clock) {
        dayNight.sunDayClock = clock;
        const p = Math.min(1, dayNight.sunDayClock / SUN_DAY_FRAMES);
        dayNight.sunX = (skyDir >= 0)
            ? SUN_X + p * (SUN_SET_X - SUN_X)
            : SUN_SET_X - p * (SUN_SET_X - SUN_X);       // float → nykimätön liuku (kaaos: suunta)
    }

    function saveSunClock() {
        if (DAY_FORCE) return;
        state.sunClock = Math.round(dayNight.sunDayClock);
        GameState.save(state);
    }

    function resetSun() {
        applySunClock(0);
        dayNight.sunSaveTimer = 0;
        saveSunClock();
    }

    // Kaksisuuntainen liikenne: kaksi ajorataa (kaistaa)
    // 0 = alempi (lahempana kameraa), vasemmalta oikealle
    // 1 = ylempi (kauempana), oikealta vasemmalle
    const LANE_DEFS = [
        { y: 340, direction: 1  },  // alempi (L→R)
        { y: 328, direction: -1 }   // ylempi (R→L)
    ];
    let vehicles = [null, null];      // yksi ajoneuvo per kaista
    let spawnTimers = [300, 300];     // 5 s ekaan spawniin molemmille
    const TRAFFIC_DAY_MULT = 2;       // päivällä liikennevirta tuplataan (spawn-väli /2)

    /* ── Viemärinkannet: avoin kaivo (käyttäjän pyyntö 21.9.2026) ──
       Kadulla on 2 viemärinkantta (foreground.manholes). Jos kansi puuttuu,
       kohta on musta reikä: siihen astuva pelaaja putoaa alas (katoaa) ja
       köpii takaisin ylös.
       MENETYS: putoaminen vie **enintään 2 🪙** (kolikot hulahtavat
       viemäriin): 3 → 1, 2 → 0, 1 → 0 (ainutkin kolikko menee), 0 → ei mitään.
       TULO (käyttäjän pyyntö 23.9.2026): randomina **1/6 putoamisista
       kaivon pohjalta löytyy rahaa +3 🪙** – muuten menetys kuten ennen.
       Putoaminen ei syö 🍔:tä eikä tapa pelaajaa.
       Ei tainnutusta (toisin kuin auto/sähkökaappi/kukkaruukku).
       Arvonta: pelin alussa 1/6 (satunnainen kansi puuttuu) ja 1/10 joka
       kerta kun pelaaja palaa kadulle huoneesta tai alapelistä – tilanne voi
       vaihtua molempiin suuntiin (kansi katoaa TAI asennetaan takaisin).
       Tila on vain muistissa → uusi arpa joka latauksella (ei uutta
       localStorage-avainta, gameState.js ei muutu).
       Testityökalut (eivät tallenna): ?hole=1 = 1. kansi puuttuu heti,
       ?hole=2 = 2. kansi puuttuu, ?hole=0 = molemmat paikallaan. */
    const MANHOLE_START_CHANCE  = 1 / 6;   // uusi peli / sivun lataus
    const MANHOLE_RETURN_CHANCE = 1 / 10;  // paluu huoneesta / alapelistä
    const MH_COIN_COST = 2;                // putoaminen vie enintään 2 kolikkoa
    const MH_BONUS_CHANCE = 1 / 6;         // 1/6 putoamisista: kaivosta löytyy rahaa (parametri)
    const MH_BONUS_COINS  = 3;             // löydön suuruus: +3 🪙
    const MH_HIT_RX = 11;                  // törmäysellipsi: piirros on 14×7,
    const MH_HIT_RY = 5;                   //   hitusen pienempi → ovelle mahtuu
    const MH_FALL_FRAMES  = 36;            // ~0,6 s: vajoaa reikään (katoaa) – nopea
    const MH_CLIMB_FRAMES = 210;           // ~3,5 s: köpii hitaasti takaisin ylös
    const MH_RISE_PART    = 0.65;          // osuus kiipeämisestä, jolloin hahmo nousee esiin
    const MH_STEP_PX      = 9;             // loppuosa: astuu reiän reunan yli kuivalle
    const MH_CLIMB_WOBBLE = 1.6;           // köpimisen sivuttaisheilunta (px, vain visuaalinen)
    /* ── Kaivon tila (Vaihe 4: ryhmitelty olioksi) ──────────────────────
       Aiemmin kaivon tila oli kolmea irrallista muuttujaa (auki oleva kansi,
       sisällä-lippu ja käynnissä oleva pudotus/kiipeäminen).
       Hyöty: nollaus ja uudelleenarvonta yhdessä paikassa (manhole.reset()),
       ei hajallaan kymmenissä kohdissa. Vain muistissa – ei tallenneta
       (kansi arvotaan uudelleen huoneesta/alapelistä palatessa). */
    const manhole = {
        open: null,                   // null = kannet paikallaan · 0/1 = kumpi puuttuu
        inside: [false, false],       // oliko jalkapiste reiän ellipsissä (reunaehto)
        action: null,                 // { idx, phase: 'fall' | 'climb', t } pudotuksen aikana
        reset() { this.open = null; this.inside = [false, false]; this.action = null; }
    };
    let wasHiddenStreet = false;           // oliko huone/alapeli auki viime framella (paluu = 1/10)

    const MH_HOLE_PARAM = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search).get('hole') : null;
    /* undefined = ei pakotettu · null = pakotettu "kannet paikallaan" · 0/1 = pakotettu kansi */
    const MH_FORCE = (MH_HOLE_PARAM === '0' || MH_HOLE_PARAM === '1' || MH_HOLE_PARAM === '2')
        ? (MH_HOLE_PARAM === '0' ? null : Number(MH_HOLE_PARAM) - 1)
        : undefined;

    /* Onko pelaajan jalkapiste reiän ellipsin sisällä? */
    function manholeHit(idx) {
        const mh = (foreground && foreground.manholes) ? foreground.manholes[idx] : null;
        if (!mh) return false;
        const fx = (player.x + player.w / 2) - mh.x;
        const fy = (player.y + player.h - 1) - mh.y;
        return (fx * fx) / (MH_HIT_RX * MH_HIT_RX) + (fy * fy) / (MH_HIT_RY * MH_HIT_RY) <= 1;
    }

    /* Alkutilanne: 1/6 → satunnainen kansi puuttuu. */
    function rollManholeState() {
        manhole.reset();                       // alkutilanne: ei auki olevaa kantta eikä sekvenssiä
        if (MH_FORCE !== undefined) { manhole.open = MH_FORCE; return; }
        manhole.open = (Math.random() < MANHOLE_START_CHANCE)
            ? (Math.random() < 0.5 ? 0 : 1)
            : null;
        manhole.inside = [manholeHit(0), manholeHit(1)];
    }

    /* Paluu kadulle: 1/10 → tilanne vaihtuu (kansi katoaa TAI palaa paikalleen). */
    function maybeRerollManholeState() {
        if (MH_FORCE !== undefined || playerDead || manhole.action) return;
        if (Math.random() >= MANHOLE_RETURN_CHANCE) return;
        manhole.open = (manhole.open == null)
            ? (Math.random() < 0.5 ? 0 : 1)
            : null;
        /* Jos jalat ovat juuri uuden reiän kohdalla, putoaminen ei laukea
           heti: jalkapisteen pitää käydä välillä ellipsin ulkopuolella. */
        manhole.inside = [manholeHit(0), manholeHit(1)];
    }

    /* Paluu kadulle -vahti: kun huone tai alapeli sulkeutuu, arvotaan 1/10
       viemärinkannelle ja mahdollisesti ilmestyy rosvo yllätyksenä.
       Kattaa kaikki poistumistiet: ✕, Poistu, Space, Enter, RETURN_TO_STREET. */
    let wasHiddenKind = null;   // 'iframe' | 'sleep' | 'bar' | 'jukebox' | null
    function trackHiddenStreet() {
        const nowHidden = iframeOpen || sleepRoom || barRoom || jukeboxRoom;
        const nowKind = iframeOpen ? 'iframe' : sleepRoom ? 'sleep' : barRoom ? 'bar' : jukeboxRoom ? 'jukebox' : null;
        if (wasHiddenStreet && !nowHidden) {
            maybeRerollManholeState();
            // Rosvo: yllätys vain paluussa pelistä / jukeboxista / BARista
            if (wasHiddenKind === 'iframe' || wasHiddenKind === 'jukebox' || wasHiddenKind === 'bar') {
                maybeSpawnRobber();
            }
        }
        wasHiddenStreet = nowHidden;
        wasHiddenKind = nowKind;
    }

    /* ── Kukkaruukun pudotus ──────────────────────── */
    function spawnFlowerPot(bldg) {
        const dc = doorCenter(bldg);
        spawnParticles(dc.x, dc.y, '#ff6644', 8);
        const windowY = GROUND_Y - bldg.h + 40;
        flowerPot = { x: dc.x, y: windowY, vx: 0, vy: 0, rotation: 0, active: true };
    }

    /* ── Oviukko: astuu ovesta kynnykseltä (ei putoa ikkunasta) ── */
    function spawnAvenger(bldg) {
        const dc = doorCenter(bldg);
        spawnParticles(dc.x, dc.y, '#ff8866', 8);
        avenger = {
            x: dc.x - 10, y: GROUND_Y - 30, w: 20, h: 30,
            bldgIdx: buildings.indexOf(bldg),
            facing: 1, phase: 'emerge', timer: AVENGER_TELEGRAPH,
            walkTimer: 0, scale: buildingScale(bldg)
        };
    }

    /* ── Rosvo: yllätysesiintyminen jalkakäytävällä ──
       Ilmestyy satunnaiseen kohtaan vähintään ROBBER_MIN_DIST päähän pelaajasta
       ja kävelee kohti tätä, kunnes nappaa kiinni (katoaa) tai elinikä (ttl) loppuu.
       Tila vain muistissa (ei tallenneta localStorageen). */
    /* Rosvon nopeus arvotetaan jokaisella ilmestymisellä: perusarvo (1.05)
       ± liukumaväli −20 % … +50 % (lo = 0,84 … hi = 1,575). */
    function randomRobberSpeed() {
        const lo = ROBBER_SPEED * ROBBER_SPEED_MIN_MULT;
        const hi = ROBBER_SPEED * ROBBER_SPEED_MAX_MULT;
        // Kaaos K3: rosvon nopeusarpa ei saa ylittää 1.4 × C (kyvykkyys)
        const max = threatSpeedMax(chaosAbility());
        return Math.min(lo + Math.random() * (hi - lo), max);
    }

    function spawnRobber() {
        const pcx = player.x + player.w / 2;
        /* Turvasäde ULOSTULOKOHDASTA (geneerinen, kaikki ovet): rosvo ei koskaan
           saa ilmestyä lähelle sitä kohtaa, josta pelaaja juuri tuli ulos – muuten
           pelaaja ei ehdi havaita mitään. Reunaklampaus ei saa rikkoa tätä: jos
           klampattu ehdokas jäi liian lähelle, se hylätään ja arvotaan uudelleen
           (kumpi tahansa puoli); varmistuksena valitaan kauempi puoli. Ennen tämä
           oli häkäkorjaus vain BAR-ovelle (reunaklamppi vei spawnin pelaajan kylkeen). */
        const clear = Math.min(ROBBER_MIN_DIST, (WORLD_W - ROBBER_W) / 2);
        let x = null;
        for (let attempt = 0; attempt < 12 && x === null; attempt++) {
            const side = Math.random() < 0.5 ? -1 : 1;   // kumpi puoli pelaajasta
            const cc = pcx + side * (clear + Math.random() * Math.max(0, (WORLD_W - ROBBER_W) - 2 * clear));
            const cand = Math.max(4, Math.min(WORLD_W - ROBBER_W - 4, cc - ROBBER_W / 2));
            if (Math.abs(cand + ROBBER_W / 2 - pcx) >= clear) x = cand;
        }
        if (x === null) {   // varmistus: valitaan puoli, joka on kauempana pelaajasta
            const left  = Math.max(4, pcx - clear - ROBBER_W);
            const right = Math.min(WORLD_W - ROBBER_W - 4, pcx + clear);
            x = (pcx - (left + ROBBER_W / 2) >= (right + ROBBER_W / 2) - pcx) ? left : right;
        }
        const dir = (pcx > x + ROBBER_W / 2) ? 1 : -1;   // kulkee kohti pelaajaa
        robber = {
            x: x, y: ROBBER_FOOT_Y - ROBBER_H,
            w: ROBBER_W, h: ROBBER_H,
            facing: dir, dir: dir,
            speed: randomRobberSpeed(),
            pause: ROBBER_TURN,          // hetki ennen liikettä (pelaajalla aikaa reagoida)
            walkTimer: 0, ttl: ROBBER_TTL
        };
    }

    /* Rosvo ilmestyy vain paluussa pelistä/jukeboxista/BARista (cooldown + sattuma) –
       ei ole kadulla koko ajan. */
    function maybeSpawnRobber() {
        if (playerDead || robber || robberCooldown > 0) return;
        if (robberGraceTimer > 0) return;   // 60 s aloitusrauha: peli ei ala ryöstöllä
        if (Math.random() >= ROBBER_APPEAR_CHANCE) return;
        spawnRobber();
        robberCooldown = ROBBER_COOLDOWN;
    }

    /* ── Potkun pudotus: oviukko (1/8) → kolikko (1/5) → kukkaruukku ── */
    function spawnKickDrop(bldg) {
        const dc = doorCenter(bldg);
        const windowY = GROUND_Y - bldg.h + 40;
        // 1/8 oviukko – kolikon vastakohta (tainnutus + 1 hampurilainen)
        if (avengerCooldown <= 0 && !avenger && Math.random() < AVENGER_CHANCE) {
            avengerCooldown = AVENGER_COOLDOWN;
            spawnAvenger(bldg);
            return;
        }
        // 1/5 kolikko – mutta vain jos cooldown on ohi (estää kolikoiden farmaamisen)
        if (kickCoinCooldown <= 0 && Math.random() < 0.2) {
            spawnParticles(dc.x, windowY, '#ffd700', 8);
            kickCoin = { x: dc.x, y: windowY, vy: 0, landed: false, ttl: 600 };
            kickCoinCooldown = 1800;  // 30s @ 60fps
        } else {
            spawnFlowerPot(bldg);
        }
    }

    /* ── Oviukon päivitys: emerge → chase → hold (3 s) → kosahtaminen → return ──
       Kutsutaan sekä normaalivirrasta että tainnutus-haarasta, jotta paluu
       ovelle jatkuu myös silloin kun pelaaja makaa maassa.
       Ei näkymätöntä osumaa iframe-pelin aikana (loop() ei pysähdy overlayn ajaksi). */
    function updateAvenger(dt) {
        if (!avenger) return;
        const ov = document.getElementById('game-iframe-overlay');
        if (ov && ov.classList.contains('active')) return;   // peli auki → jäihin

        const a = avenger;
        const acx = a.x + a.w / 2, acy = a.y + a.h / 2;
        const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;

        // 1) Varoitus: ovi aukeaa kynnyksellä ennen kuin hahmo astuu ulos
        if (a.phase === 'emerge') {
            a.timer -= dt;
            if (a.timer <= 0) a.phase = 'chase';
            return;
        }

        // 2) Peräänkäynti – nopeampi kuin pelaaja → tavoittaa aina (ei väistettävissä)
        if (a.phase === 'chase') {
            a.facing = (pcx - acx) >= 0 ? 1 : -1;
            a.x += Math.sign(pcx - acx) * AVENGER_SPEED * dt;
            a.y += Math.sign(player.y - a.y) * AVENGER_SPEED * dt;
            a.walkTimer += dt;
            const d = Math.sqrt((pcx - acx) * (pcx - acx) + (pcy - acy) * (pcy - acy));
            if (d < AVENGER_HIT_R) {
                // Kontakti: koko maailma jäätyy 3 s (hit-stop) → dramaattinen isku
                spawnParticles(pcx, pcy, '#ffaa44', 12);
                playKnock();
                a.phase = 'hold';
                hitPauseTimer = AVENGER_FREEZE;
            }
            return;
        }

        // 3) Jäädytys (3 s): maailma seisoo – vasta lopuksi pelaaja kosahtaa kasaan
        if (a.phase === 'hold') {
            if (!player.knockedDown) { knockPlayerDown(); }   // tainnutus + 1 🍔 (vain kerran)
            spawnParticles(pcx, pcy, '#ff6644', 18);
            playKnock();
            a.phase = 'return';
            return;
        }

        // 4) Paluu: kävelee takaisin kynnykselle ja katoaa ovesta
        const homeX = doorCenter(buildings[a.bldgIdx]).x - a.w / 2;
        const homeY = GROUND_Y - a.h;
        a.x += Math.sign(homeX - a.x) * AVENGER_SPEED * dt;
        a.y += Math.sign(homeY - a.y) * AVENGER_SPEED * dt;
        a.walkTimer += dt;
        a.facing = (homeX - a.x) >= 0 ? 1 : -1;
        if (Math.abs(homeX - a.x) < 2 && Math.abs(homeY - a.y) < 2) {
            spawnParticles(homeX + a.w / 2, GROUND_Y - 10, '#ff8866', 8);
            avenger = null;
        }
    }

    /* ── Rosvon päivitys: partiointi + kiinniotto ──
       Partioi vain jalkakäytäväkaistalla (ei mene tielle). Kiinniotto
       tapahtuu vain kun pelaajan jalat ovat samalla kaistalla JA rosvo on
       riittävän lähellä → väistö = loiki kadun toiselle puolelle (↓). */
    function updateRobber(dt) {
        if (!robber) return;
        const ov = document.getElementById('game-iframe-overlay');
        if (ov && ov.classList.contains('active')) return;   // peli auki → jäihin

        const r = robber;
        const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
        const rcx = r.x + r.w / 2, rcy = r.y + r.h / 2;

        // Elinikä: katoaa jos ei nappaa kiinni ajoissa (yllätys – ei kadulla pidempään)
        if (r.ttl !== undefined) {
            r.ttl -= dt;
            if (r.ttl <= 0) {
                robber = null;
                return;
            }
        }

        // BAD CHAOS → rosvo jahtaa vapaasti (molemmat akselit, kuten avenger).
        // Muuten partioi jalkakäytäväkaistalla edestakaisin + reunapysähdys (väistöikkuna).
        if (r.pause > 0) {
            r.pause -= dt;
        } else if (ROBBER_CHASES_Y) {
            r.facing = (pcx - rcx) >= 0 ? 1 : -1;
            r.x += Math.sign(pcx - rcx) * r.speed * dt;
            r.y += Math.sign(player.y - r.y) * r.speed * dt;
            r.walkTimer += dt;
        } else {
            r.x += r.dir * r.speed * dt;
            r.walkTimer += dt;
        }
        if (!ROBBER_CHASES_Y) {
            if (r.x <= 4) {
                r.x = 4;
                if (r.dir < 0) { r.dir = 1; r.pause = ROBBER_TURN; }
            } else if (r.x >= WORLD_W - r.w - 4) {
                r.x = WORLD_W - r.w - 4;
                if (r.dir > 0) { r.dir = -1; r.pause = ROBBER_TURN; }
            }
            r.facing = r.dir;
        }

        // Kiinniotto: jahtauksessa (BAD) pelkkä etäisyys; muuten vaatii jalkakäytäväkaistan.
        const dx = pcx - rcx, dy = pcy - rcy;
        const onLane = (player.y + player.h >= ROBBER_LANE_TOP && player.y + player.h <= ROBBER_LANE_BOTTOM);
        const canGrab = !player.knockedDown && !playerDead && (ROBBER_CHASES_Y || onLane);
        if (canGrab && Math.sqrt(dx * dx + dy * dy) < ROBBER_HIT_R) {
            spawnParticles(pcx, pcy, '#ff6644', 14);
            spawnParticles(rcx, rcy, '#ff6644', 8);
            playKnock();
            knockPlayerDown();   // tainnutus + −1 🍔 (0 → kuolema)
            if (!playerDead) player.knockdownTimer = ROBBER_STUN;   // pidennetty maassaolo – ehtii nähdä, mitä kävi
            // Rosvo vie kaikki rahat: kolikkosaldo nollataan.
            // Ei erillistä dialogia (sääntö 06) – pelaaja huomaa itse.
            if (coinCount > 0) {
                coinCount = 0;
                state.inventory.coinCount = 0;
                GameState.save(state);
                updateHUD();
            }
            const push = (pcx < rcx) ? -1 : 1;
            player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x + push * 30));
            robber = null;       // rosvo katoaa nappauksen jälkeen (ei jää jahtaamaan)
        }
    }

    /* ── Törmäysvaikutus ───────────────────────────────
       FULLissa osuma vie YLIMMÄN kerroksen: −1 🍺 jos olutta on, muuten
       −1 🍔 (0 → kuolema) – sama sääntö kuin aikapohjaisella nälällä.
       MUUT MOODIT täsmälleen entinen: −1 🍔 ja 0 → kuolema.
       Tainnutus asetetaan aina kutsujassa – tämä hoitaa vain "hinnan". */
    function collisionCost() {
        if (chaosFlags.drunk && drunkLevel > 0) {
            drunkLevel--;                 // olutkerros imee iskun
            drunkTimer = burgerInterval;
            saveChaosSession();           // F5 ei hukkaa humalaa
            updateHUD();
            return;
        }
        hamburgerCount--;
        state.inventory.hamburgerCount = hamburgerCount;
        GameState.save(state);
        updateHUD();
        if (hamburgerCount <= 0) { killPlayer(); }
    }

    /* ── Onnettomuus: tainnutus + 1 🍔 (FULL: −1 🪙) ───
       Sama vaikutus kuin kukkaruukulla/autolla/sähköiskulla.
       Käyttää vain uusi oviukko-koodi – vanhat haarat ennallaan. */
    function knockPlayerDown() {
        player.knockedDown = true;
        player.knockdownTimer = AVENGER_STUN;
        player.kicking = false;
        player.kickFrame = 0;
        collisionCost();
    }

    /* ── Pelaajan kuolema (hampurilaiset loppu) ────── */
    function killPlayer() {
        playerDead = true;
        deathTimer = 180;          // 3s @ ~60fps
        deathAlpha = 0;
        player.knockedDown = true; // pelaaja kaatuu maahan
        player.knockdownTimer = 9999; // pysyy maassa koko sekvenssin ajan
        player.vx = 0;
        player.kicking = false;
        for (let li = 0; li < vehicles.length; li++) {
            if (vehicles[li] && vehicles[li].engine) stopVehicleEngine(vehicles[li].engine);
        }
        StreetAudio.stop();        // pysäytä taustamusiikki
        StreetAudio.playDeathGong(); // gongi kumahtaa
    }

    /* ── Avoin kaivo: pudotus ja ylöskiipeäminen ───────
       Pelaaja astui reiän ellipsiin → vajoaa alas (katoaa), köpii takaisin
       ylös ja jatkaa matkaa. Menetys: **enintään 2 🪙** (1 → 0, 0 → ei mitään);
       mutta **1/6 putoamisista kaivon pohjalta löytyy +3 🪙**.
       Ei tainnutusta eikä 🍔-menetystä.
       Sekvenssin ajan katu on jäissä (update palaa heti alussa). */
    function startManholeFall(idx) {
        const mh = foreground.manholes[idx];
        manhole.action = { idx: idx, phase: 'fall', t: MH_FALL_FRAMES };
        player.kicking = false;
        player.kickFrame = 0;
        player.walking = false;
        hitPauseTimer = HIT_PAUSE;                     // pieni pysähdys osumasta
        playKnock();                                   // putoamisen tömähdys
        spawnParticles(mh.x, mh.y - 2, '#3a3a3a', 8);  // pölyä reiän reunalta
    }

    function updateManholeAction(dt) {
        const a = manhole.action;
        const mh = foreground.manholes[a.idx];
        a.t -= dt;

        if (a.phase === 'climb') {
            /* Kiipeäminen: hahmo nousee hitaasti KAIVON KESKELTÄ
               (jalat reiän keskipisteessä) ja astuu lopuksi reunan yli
               kuivalle. Logiikka seuraa visuaalia → loppuasento on valmis
               eikä hahmo hypähdä viimeisellä framella. */
            const p = Math.max(0, Math.min(1, 1 - a.t / MH_CLIMB_FRAMES));
            const stepP = Math.max(0, (p - MH_RISE_PART) / (1 - MH_RISE_PART));
            player.x = mh.x - player.w / 2;
            player.y = (mh.y - player.h) - MH_STEP_PX * stepP;
            player.vx = 0; player.vy = 0;
            if (a.t > 0) return;
            /* Ylös päästy: jalat ovat ellipsin ulkopuolella → ei heti uutta
               putoamista, mutta seuraava astuminen laukaisee taas. */
            player.walking = false;
            player.walkFrame = 0;
            manhole.inside[a.idx] = false;
            manhole.action = null;
            spawnParticles(mh.x, mh.y - 6, '#5a5a5a', 8);
            return;
        }

        /* Pudotus: pelaaja valuu nopeasti reiän KESKIPISTEESEEN
           (jalat keskelle) ja vajoaa siitä alas. */
        const pull = Math.min(1, 0.22 * dt);
        player.x += (mh.x - player.w / 2 - player.x) * pull;
        player.y += (mh.y - player.h - player.y) * pull;
        player.vx = 0; player.vy = 0;
        if (a.t > 0) return;

        /* Pohjassa: tavallisesti kolikot hulahtavat viemäriin
           – menetys enintään 2 🪙: 3 → 1, 2 → 0, 1 → 0 (ainutkin kolikko
           menee), 0 → ei mitään. Mutta **1/6 putoamisista** kaivon pohjalta
           löytyy rahaa: **+3 🪙**. Ei 🍔-menetystä eikä kuolemaa. */
        if (Math.random() < MH_BONUS_CHANCE) {
            coinCount += MH_BONUS_COINS;
            state.inventory.coinCount = coinCount;
            GameState.save(state);
            updateHUD();
            playCoin();                                     // kolikon pling
            spawnParticles(mh.x, mh.y - 4, '#ffd700', 12);  // kultatäplät reiästä
        } else if (coinCount > 0) {
            coinCount = Math.max(0, coinCount - MH_COIN_COST);
            state.inventory.coinCount = coinCount;
            GameState.save(state);
            updateHUD();
        }
        a.phase = 'climb';
        a.t = MH_CLIMB_FRAMES;
        player.x = mh.x - player.w / 2;     // kiipeäminen alkaa reiän keskeltä
        player.y = mh.y - player.h;
    }

    /* ── Pienten talojen valot ──────────────────── */
    for (let i = 0; i < buildings.length; i++) {
        if (i !== 0 && !lamps.some(l => l.bldgIdx === i)) {
            smallHouseLights[i] = { lit: false, timer: 0 };
        }
    }
    let savedPlayerX = 40;
    let savedPlayerY = GROUND_Y - 20;

    /* ── Tila ────────────────────────────────────────── */
    let state;
    let animFrameId;
    let lastTime = 0;
    let particles = [];
    let stars = [];
    let shootingStar = null;   // Tähdenlento
    let satellite = null;      // Satelliitti
    let bats = [];             // Yölepakot
    let batSpawnTimer;         // lepakoiden spawn-väli
    let birds = [];            // Päivälinnut
    let birdSpawnTimer;        // lintujen spawn-väli
    let birdTargetCount;       // lintujen tavoiteltu määrä
    let clouds = [];            // Pilvet (cirrus + hazy)
    let lastCloudTime = 0;     // Pilvien dt-laskenta
    let windDir = Math.random() < 0.5 ? 1 : -1;
    let windSpeed = 2 + Math.random() * 3; // px/s (2–5)
    /* BAD-myrsky (purske): sade + ukkonen. Tilakone: tyyni → purske → tyyni.
       NORMAL/MILD/GOOD/FULL: stormBurst = false → funktiot ovat no-opeja. */
    let rainDrops = [];        // sade: { x, y, len, speed }
    let stormPhase = 'calm';   // 'calm' | 'burst'
    let stormTimer = 0;        // jäljellä oleva aika (framet)
    let thunderTimer = 0;      // seuraavan salaman laskuri purskeen aikana
    let lightning = null;      // aktiivinen salama { t, bolt, boltAlpha, flashAlpha }
    let thunderPending = -1;   // frame laskuri jyrinälle (-1 = ei mitään)

    /* ── Äänet omasta tiedostosta (Vaihe 5) ──
       street/sfx.js sisältää kaikki kadun SFX-äänet ja ajoneuvon moottoriäänen.
       Moduuli omistaa audioCtx:n ja SFX-tason (K6); tänne tuodaan samat nimet,
       joten kutsuva koodi ei muutu. */
    const {
        initAudio, sfxTone, playKick, playWalk, playCoin, playKnock, playZap, playLaser,
        playMeteorHit, playBuildingCollapse, playBeamEmpty, playLampOn,
        startVehicleEngine, updateVehicleEngine, stopVehicleEngine
    } = StreetSfx;
    StreetSfx.bind({ WORLD_W: WORLD_W });   // moottoriäänen panorointi tarvitsee maailman leveyden

    /* ── Sanomalehden asettelu + piirto omasta tiedostosta (Vaihe 5 osa 3) ──
       street/news.js omistaa lehden sivutilan (screen) ja asetteluvälimuistin.
       Tähän sidotaan street.js:n sulkeumassa asuvat arvot live-gettereinä,
       joten esim. viewW seuraa resizeä ja ctx asettuu initissä. */
    StreetNews.bind({
        get ctx() { return ctx; },
        get canvas() { return canvas; },
        get viewW() { return viewW; },
        get foreground() { return foreground; },
        get player() { return player; },
        get vehicles() { return vehicles; },
        get newsRoom() { return newsRoom; },
        get iframeOpen() { return iframeOpen; },
        WORLD_W: WORLD_W, WORLD_H: WORLD_H, VIEWW_MIN: VIEWW_MIN
    });

    /* ── Ajoneuvojen piirto omasta tiedostosta (Vaihe 5 osa 4) ──
       street/traffic.js sisältää drawVehicle(v):n. Liikennologiikka
       (spawn, liike, törmäys) jää tänne. Live-getterit: ctx asettuu
       initissä ja dayNight.t liukuu päivä/yö-syklin mukana. */
    StreetTraffic.bind({
        get ctx() { return ctx; },
        get dayT() { return dayNight.t; },
        VEHICLE_HEADLIGHT_DIM: VEHICLE_HEADLIGHT_DIM,
        /* Vaihe 5 osa 7 – liikennologiikka lukee/mutatoi näitä. */
        WORLD_W: WORLD_W,   // ←: PUUTTUI (spawn x = WORLD_W + w → undefined+w = NaN!)
        get vehicles() { return vehicles; },
        get spawnTimers() { return spawnTimers; },
        get player() { return player; },
        get vehicleShakeTimer() { return vehicleShakeTimer; }, set vehicleShakeTimer(v) { vehicleShakeTimer = v; },
        get trafficSpeedMult() { return trafficSpeedMult; },
        get trafficSpawnMult() { return trafficSpawnMult; },
        get PLAYER_DEPTH_MAX_Y() { return PLAYER_DEPTH_MAX_Y; },   // määritelty rivillä ~8041 → getteri (TDZ)
        LANE_DEFS: LANE_DEFS, TRAFFIC_DAY_MULT: TRAFFIC_DAY_MULT,
        chaosAllGone: chaosAllGone, spawnParticles: spawnParticles, collisionCost: collisionCost,
        sfx: { playKnock: playKnock, startEngine: startVehicleEngine, updateEngine: updateVehicleEngine, stopEngine: stopVehicleEngine }
    });


    // Apufunktio: oven keskipiste
    function doorCenter(bldg) {
        return {
            x: bldg.x + bldg.w / 2,
            y: GROUND_Y - DOOR_H / 2
        };
    }

    /* ═══════════════════════════════════════════════════
       ALOITUS
       ═══════════════════════════════════════════════════ */
    /* ═══════════════════════════════════════════════════════════
       AI CHAOS – kaaostasot
       Keskitetty profiilirakenne: muuttaa VAIN olemassa olevia
       arvoja/kertoimia – ei uutta pelilogiikkaa. NORMAL = nykyiset
       arvot bitti-identtisinä. FULL CHAOS arpoo uniikin siemenen.
       ═══════════════════════════════════════════════════════════ */
    /* ── Kaaoskonfiguraatio omasta tiedostosta (Vaihe 5) ──
       street/chaos-config.js sisältää oletukset, ?seed=-arvonnan, K1-apurit,
       portin (clampChaosCfg + validateChaosCfg) ja drawChaosCfg:n.
       Tuodaan samat nimet tähän, joten muu koodi ei muutu. */
    const {
        CHAOS_DEFAULTS, CHAOS_DEFAULTS2, CHAOS_PARAMS, CHAOS_SEED, CHAOS_DEBUG,
        makeRng, chaosRng, rnd, rndInt, WARM_PALETTE, NEAR_BLACK_PALETTE,
        SUN_GLOW_DEFAULT, randomHuePalette, randomDarkSky, randomAnimalTypes,
        randomSunColor, generateFullChaosSeed, chaosProfile, clamp, chaosAbilityFor,
        stunMaxOf, burgerIntervalMin, threatSpeedMax, threatTelegraphMin, threatBudget,
        clampChaosCfg, validateChaosCfg, drawChaosCfg
    } = StreetChaos;

    /* Sidotaan street.js:ssä asuvat kaksi asiaa kaaosmoduuliin (Vaihe 5). */
    StreetChaos.bind({ WORLD_W: WORLD_W, hungerMultFor: hungerMultFor });

    let chaosLevel = 'normal';
    let chaosCfg = Object.assign({}, CHAOS_DEFAULTS2);
    /* Johdetut moodiliput (Vaihe 2): sama tieto kuin `chaosLevel === 'full'`
       / `'bad'`, mutta YHDESSÄ paikassa (applyChaosFlags). Koodi lukee näitä
       chaosCfg:n rinnalla → mooditarkistus ei ole ripoteltuna pitkin tiedostoa.
       Liput johdetaan AINA chaosLevelistä (myös F5-palautuksessa), joten ne
       eivät voi jäädä vanhentuneiksi. */
    const chaosFlags = {
        beer: false,          // FULL: BAR myy olutta 🍺 hampurilaisten sijaan
        drunk: false,         // FULL: humala horjuttaa ohjausta ja tähtäystä
        beamWeapon: false,    // FULL: sädease + meteoriitin ampuminen
        meteorAlways: false,  // FULL: meteoriitti joka välissä
        meteorKill: false,    // FULL: ammuttu meteoriitti = +1 🪙
        meteorHalf: false,    // BAD: meteoriitin arpa 50 % (ei asetta)
        badDemo: false,       // BAD: aloitusdemo (talo romahtaa heti)
        badFinale: false,     // BAD: finaali – ei tähtiä, hidas meteoriittiväli
        ruin: false,          // BAD/FULL: rauniot – talojärjestys arvotaan, liikenne ja eläimet seisovat, savu
        mosquitoes: false,    // BAD/FULL: lamppujen hyttyset isompia ja tummempia (K1/K3)
        storm: false,         // BAD: myrsky – paksut pilvet (aina) + sade + ukkonen purskeina
        anyChaos: false       // ei-NORMAL: kaaosakselit ja K7-kortit aktiivisia
    };
    /* ── Kuunvarjojen kaaoskerroin (BAD/FULL) ──
       Jokainen talo saa oman kertoimensa 1,00…chaosCfg.moonShadowMax, joka
       arvotaan KERRAN PER YÖ (uusi peli / Nuku / päivä→yö) ja pysyy yön ajan
       vakiona → varjot eivät väpätä framesta toiseen. Kerroin skaalaa sekä
       pituuden että kallistuksen. Oma RNG-instanssi: arvonta ei siirrä
       FULLin/luottien arvontajonoa eikä riko ?seed=-toistuvuutta.
       NORMAL/MILD/GOOD: max = 1 → kaikki kertoimet 1 → piirto bitti-identtinen. */
    let moonShadowMult = [];
    let moonShadowNight = 0;
    let moonShadowRng = (CHAOS_SEED !== null) ? makeRng((CHAOS_SEED ^ 0x5f3a1b) >>> 0) : Math.random;
    function rollMoonShadowMults() {
        moonShadowNight++;
        if (CHAOS_SEED !== null) {
            moonShadowRng = makeRng(((CHAOS_SEED ^ 0x5f3a1b) + moonShadowNight * 2654435761) >>> 0);
        }
        const max = Number(chaosCfg && chaosCfg.moonShadowMax) > 1 ? Number(chaosCfg.moonShadowMax) : 1;
        moonShadowMult = buildings.map(() => (max > 1 ? 1 + moonShadowRng() * (max - 1) : 1));
    }
    let windSpeedMult = 1, windDirFlip = false;
    let trafficSpeedMult = 1, trafficSpawnMult = 1;
    let skyDir = 1;
    /* Uudet kaaosakselimuuttujat (K1/K2/K3) – alustetaan NORMAL-arvoihin.
       Kirjoitetaan applyChaosProfile():issa vasta vaiheissa. */
    let cloudCount = 18, cloudOpacityMult = 1, cloudBandTop = 40, cloudBandH = 40;
    let cloudSizeMult = 1, cloudCirrusShare = 0.35, starCount = 80, starSizeMult = 1;
    let sunColor = null, sunGlow = null;
    let animalSpeedMult = 1, animalDirBias = 0.5, animalTypeWeights = null;
    let batSpawnFrames = 1800, birdSpeedMult = 1, beetleCount = 1;
    let windowTargetMax = 5, windowDurMin = 10000, windowDurMax = 30000;
    let lampHueShift = 0, threatWarnMult = 1;
    let buildingPalette = null;   // talojen väripaletti (null = BUILDING_PALETTE)
    let meteorTempoMult = 1;      // tähdenlennon/satelliitin tahti (K2)
    /* SFX-taso (K6) asuu äänimoduulissa (Vaihe 5): StreetSfx.setVolume() */
    let fogAlpha        = 0;      // sumuverhon peittävyys (K7/K1)
    // Kaaos – uudet akselit (polariteetti: ikävät = BAD/FULL, neutraalit = kaikki chaos-tasot)
    let doorLockChance   = 0;     // lukitut ovet (jukebox + hedelmäpeli), 0 = ei koskaan (NORMAL)
    let staggerAmount    = 0;     // pelaajan hoipertelu (0–1), 0 = suora kävely (NORMAL)
    let screenShakeAmount = 0;    // koko ajan hiukan tärisevä kuva (0–1), 0 = ei (NORMAL)
    let lampRedFlicker   = 0;     // lamppu napsahtaa hetkeksi punaiseksi (todennäköisyys/frame)
    let barBurntLetter   = -1;    // BAR-kyltin palanut kirjain (-1 = ei mitään, 0–2 = B/A/R)
    let cabFlicker       = 0;     // sähkökaapin valon "rätinä" (0–1)
    let sunSizeMult      = 1;     // auringon koko (1 = nykyinen, 2 = tupla)
    // K1/K6 – BAD-myrsky (paksut pilvet + sade + ukkonen purskeina)
    let cloudThickMult   = 1;     // hazy-pilvien pystysädekerroin (1 = nykyinen)
    let stormBurst       = false; // BAD: sade + ukkonen päällä
    let rainAmount       = 0;     // sateen voimakkuus (0 = ei sadetta)
    let stormCalmMin = 0, stormCalmMax = 0, stormBurstMin = 0, stormBurstMax = 0;
    let thunderGapMin = 0, thunderGapMax = 0;

    /* Kaaos – satunnaisesti lukittu ovi (jukebox + hedelmäpeli).
       Ei ilmoitusta (sääntö 06): ovi ei vain aukea. BAR ja makuuhuone
       ovat aina auki (pelaajan turvapaikat) – niitä ei koskaan lukita. */
    function doorLocked() { return doorLockChance > 0 && Math.random() < doorLockChance; }

    /* Deterministinen siemen + testikytkimet (K0-infra).
       ?seed=N → sama kaaos jokaisella latauksella · ?debug → konsolidumppi. */


    /* Kaaos K1 – visuaaliset apurit: talopaletit + auringon värit */

    /* ── Tähdenlento + satelliitti – apufunktiot (❓4) ──
       Sama logiikka oli aiemmin kahtena kopiona (tainnutus-haara + kadun
       update). Yhdistetty, jotta sama koodi pätee molemmissa paikoissa. */
    const METEOR_SHAKE_FRAMES = 150;  // meteoriitin törmäyksen tärinän kesto (frameä, ~2.5 s)
    const METEOR_FLASH_FRAMES = 60;   // meteoriitin taivasvälähdyksen kesto (frameä, ~1 s)
    const METEOR_BACKDROP_HOUSES = 3; // meteoriitin osuma tuhoaa N taustataloa rivistä

    /* ── Katuvarren talon tuhoutuminen meteoriitista ────────────────
       BAD ja FULL: kun taustarivistä on tuhoutunut tarpeeksi (BACKDROP_GONE_SHARE),
       meteoriitit alkavat osua KATUVARREN taloihin – kaikki 9 taloa, mutta BAR
       (idx 8) vasta viimeisenä (siksi pelaaja voi ostaa 🍔:tä loppuun asti).
       FULLissa pelaaja voi estää tuhon ampumalla meteoriitit alas (sädease);
       BADissa asetta ei ole → tuho on vääjäämätön (moodin ironia).
       Tila on vain muistissa (kuten rosvo/kaivo) → palautuu init()issä, ja
       kuolema/F5 lataa sivun uudelleen (talot ehjinä, kuten taustarivikin). */
    const BACKDROP_GONE_SHARE = 0.60;   // eskalaatio, kun taustarivistä on jäljellä ≤ 60 %
    const BLDG_DMG_FLASH   = 30;    // ~0,5 s: kaikki ikkunat keltaisiksi
    const BLDG_DMG_SHAKE   = 60;    // ~1,0 s: talo tärisee (pölyä irtoaa)
    const BLDG_DMG_BLACK   = 60;    // ~1,0 s: seinät ja ikkunat mustiksi
    const BLDG_DMG_BURN    = 90;    // ~1,5 s: musta massa hehkuu keltaiseksi
    const BLDG_DMG_OUTLINE = 60;    // ~1,0 s: vain mustat ääriviivat jäljellä
    const BLDG_DMG_FADE    = 60;    // ~1,0 s: ääriviivat häipyvät → talo katoaa
    const BLDG_DMG_PHASES  = [BLDG_DMG_FLASH, BLDG_DMG_SHAKE, BLDG_DMG_BLACK,
                              BLDG_DMG_BURN, BLDG_DMG_OUTLINE, BLDG_DMG_FADE];
    const BLDG_DMG_TOTAL   = BLDG_DMG_FLASH + BLDG_DMG_SHAKE + BLDG_DMG_BLACK +
                             BLDG_DMG_BURN + BLDG_DMG_OUTLINE + BLDG_DMG_FADE;
    const BLDG_DMG_BLACK_C = '#0a0a0c';   // hiiltynyt seinä
    const BLDG_DMG_YELLOW  = '#ffd23a';   // hehkuva massa
    const AIM_ANGLE_MIN    = 20 * Math.PI / 180;   // tähdätyn meteoriitin kulma
    const AIM_ANGLE_MAX    = 84 * Math.PI / 180;
    let buildingDmg = {};              // idx → { phase, t } · 'gone' = tuhoutunut talo
    /* tuhon jälkitila siivottiin:
         buildingRubble  = tuhoutuneen talon paikalle jäävä musta romukasa
                           (arvotaan kerran, kasa ≤ RUBBLE_H_MAX = DOOR_H/2)
         standingDoorIdx = yksi satunnainen talo pitää ovensa pystyssä pelkkinä
                           ulkokarmina; -1 = arpaa ei ole vielä heitetty
       BAD-avaus: BAD = BAD – heti kadulle tullessa yksi satunnainen eturivin
       talo tuhoutuu malliksi (jopa BAR). Testi: ?baddemo=0 / ?baddemo=N. */
    let buildingRubble = {};           // idx → { w, h, x, lumps[], shade }
    let standingDoorIdx = -1;
    const RUBBLE_H_MAX = Math.round(DOOR_H / 2);   // 16 px – kasa ei koskaan tätä korkeampi
    const BAD_DEMO_DELAY = 120;        // ~2 s kadulle tulosta
    /* BAD-finaali: kun eskalaatio on päällä (`backdropMostlyGone`),
       BADissa ei enää arvota tähtiä vaan jokainen meteoriitti tähdätään taloon
       ja väli on kiinteän lyhyt → katuvarren talot sortuvat ~11–19 s välein
       (~4,3–7 s väli + lento 6–12 s). FULL säilyy ennallaan (600 f, ammuttavissa alas). */
    const BAD_FINALE_GAP_MIN = 260;    // ~4,3 s
    const BAD_FINALE_GAP_MAX = 420;    // ~7,0 s
    const BAD_DEMO_PARAM = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search).get('baddemo') : null;
    const BAD_DEMO_OFF = (BAD_DEMO_PARAM === '0');
    const BAD_DEMO_IDX = (BAD_DEMO_PARAM !== null && /^[0-8]$/.test(BAD_DEMO_PARAM))
        ? Number(BAD_DEMO_PARAM) : null;
    let badDemoTimer = -1;             // >0 tikittää · 0 laukeaa · -1 ei viritetty
    let badDemoDone = false;

    /* Testityökalut (eivät tallenna mitään, kuten ?day / ?hole / ?cabs):
         ?bldg=1        = eskalaatio pakotettu heti päälle
         ?bldgtarget=N  = pakota kohdetalo N (0–8) ja eskalaatio */
    const BLDG_PARAM = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search).get('bldg') : null;
    const BLDG_FORCE = (BLDG_PARAM === '1');
    const BLDG_TARGET_PARAM = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search).get('bldgtarget') : null;
    const BLDG_TARGET = (BLDG_TARGET_PARAM !== null && /^\d$/.test(BLDG_TARGET_PARAM))
        ? Number(BLDG_TARGET_PARAM) : null;

    function buildingGone(idx) { return buildingDmg[idx] === 'gone'; }

    /* kaikki 9 katuvarren taloa tuhoutuneet (vain BAD/FULL). */
    function buildingsAllGone() {
        for (let i = 0; i < buildings.length; i++) {
            if (!buildingGone(i)) return false;
        }
        return true;
    }
    function chaosAllGone() {
        return chaosFlags.ruin && buildingsAllGone();
    }

    /* Eskalaatio: taustarivistä ≥ 40 % tuhoutunut (tai testikytkin päällä). */
    /* lohkoja ei enää poisteta vaan ne merkitään raunioiksi (b.ruin) →
       kynnys laskee EHJISTÄ lohkoista (raunio ei ole enää "jäljellä").
       kynnys 25 % → 60 % (ks. BACKDROP_GONE_SHARE). */
    function backdropMostlyGone() {
        if (BLDG_FORCE || BLDG_TARGET !== null) return true;
        if (!backdrop || !backdrop.total) return false;
        let intact = 0;
        for (const b of backdrop.blocks) if (!b.ruin) intact++;
        return intact <= Math.ceil(backdrop.total * BACKDROP_GONE_SHARE);
    }

    /* BAD-finaali = eskalaatio päällä BADissa. Silloin tähtiä ei enää
       arvota lainkaan (aina tähdätty meteoriitti) ja väli on lyhyt (nextSkyGap).
       FULL/MILD/GOOD/NORMAL eivät koskaan osu tähän haaraan. */
    function badFinalePhase() {
        return chaosFlags.badFinale && backdropMostlyGone();
    }

    /* seuraavan taivaankappaleen väli (frameä). FULL = 600 kuten ennen,
       BAD-finaali = lyhyt kiinteä väli, muuten entinen arpa. Arvontajärjestys
       säilyy muilla tasoilla täsmälleen ennallaan → NORMAL bitti-identtinen. */
    function nextSkyGap() {
        if (chaosFlags.meteorAlways) return 600;
        if (badFinalePhase()) {
            return BAD_FINALE_GAP_MIN + Math.random() * (BAD_FINALE_GAP_MAX - BAD_FINALE_GAP_MIN);
        }
        return (600 + Math.random() * 2100) * meteorTempoMult;
    }

    /* Kohdetalo: satunnainen ehjä talo – BAR vasta kun muut on tuhottu.
       myös KESKEN oleva romahdus ohitetaan (`buildingDmg` olemassa),
       koska startBuildingCollapse hylkäisi osuman → meteoriitti menisi hukkaan. */
    function pickBuildingTarget() {
        if (BLDG_TARGET !== null) return buildingDmg[BLDG_TARGET] ? -1 : BLDG_TARGET;
        const intact = [], others = [];
        for (let i = 0; i < buildings.length; i++) {
            if (buildingDmg[i]) continue;   // 'gone' TAI romahdus kesken
            intact.push(i);
            if (i !== BAR_BLDG_IDX) others.push(i);
        }
        if (!intact.length) return -1;
        const pool = others.length ? others : intact;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    /* Tähdätty meteoriitti: lähtee lähimmältä laidalta hieman ruudun
       ulkopuolelta ja kulma ratkaistaan niin, että osuma tulee tarkalleen talon
       kohdalle. Kulma vaihtelee luontevasti: keskitalo ~35° (viisto), laidan
       talo (esim. BAR) ~82° (jyrkkä syöksy). Lento kestää ~6–12 s, joten
       meteoriitin ehtii nähdä ja ampua alas (FULL). */
    function makeAimedMeteor(idx) {
        const b = buildings[idx];
        const targetX = b.x + b.w / 2;
        const fromRight = targetX > WORLD_W / 2;
        const edgeX = fromRight ? (WORLD_W + 6) : -6;
        const y0 = 10 + Math.random() * 40;
        const want = Math.abs(edgeX - targetX);          // tarvittava vaakamatka
        let ang = Math.atan2(GROUND_Y - y0, want);
        ang = Math.max(AIM_ANGLE_MIN, Math.min(AIM_ANGLE_MAX, ang));
        const spd = 0.45 + Math.random() * 0.4;
        const dir = fromRight ? -1 : 1;
        return {
            kind: 'meteorite',
            targetBldgIdx: idx,
            x: edgeX, y: y0,
            vx: Math.cos(ang) * spd * dir,
            vy: Math.sin(ang) * spd,
            r: 8 + Math.random() * 6,
            active: true, life: 0,
            hpLeft: METEOR_HITS_TO_KILL,
            cracked: false, hitFlash: 0,
            trail: [],
            timer: nextSkyGap()   // FULL 600 · BAD-finaali lyhyt väli · muuten entinen arpa
        };
    }

    /* ── BAD-avaus: BAD = BAD ──────────────────────────────────────
       Heti kadulle tullessa (~2 s) yksi SATUNNAINEN eturivin talo tuhoutuu
       malliksi siitä, mitä on luvassa – jopa BAR (idx 8) voi olla se talo,
       koska BADissa ei ole asetta eikä armoa. Meteoriitti syntyy vain kadulla
       ja yöllä (updateBadDemo yön haarassa) eikä koskaan kesken toisen
       meteoriitin. Tuho kulkee täsmälleen samaa ketjua kuin tavallinen osuma
       (välähdys + tärinä + startBuildingCollapse). Kerran per kierros. */
    function makeBadDemoMeteor(idx) {
        const b = buildings[idx];
        const targetX = b.x + b.w / 2;
        const fromRight = targetX > WORLD_W / 2;
        const run = 150 + Math.random() * 120;          // lyhyt vaakamatka → nopea lento
        const edgeX = Math.max(-6, Math.min(WORLD_W + 6, fromRight ? (targetX + run) : (targetX - run)));
        const y0 = 8 + Math.random() * 24;
        let ang = Math.atan2(GROUND_Y - y0, Math.max(20, Math.abs(edgeX - targetX)));
        ang = Math.max(AIM_ANGLE_MIN, Math.min(AIM_ANGLE_MAX, ang));
        const spd = 1.6 + Math.random() * 0.6;          // ~3 s osumaan
        const dir = fromRight ? -1 : 1;
        return {
            kind: 'meteorite',
            targetBldgIdx: idx,
            x: edgeX, y: y0,
            vx: Math.cos(ang) * spd * dir,
            vy: Math.sin(ang) * spd,
            r: 8 + Math.random() * 6,
            active: true, life: 0,
            hpLeft: METEOR_HITS_TO_KILL,
            cracked: false, hitFlash: 0,
            trail: [], timer: 600
        };
    }

    function updateBadDemo(dt) {
        if (badDemoTimer < 0 || badDemoDone) return;
        if (shootingStar && shootingStar.active) return;   // taivas varattu
        badDemoTimer -= dt;
        if (badDemoTimer > 0) return;
        let idx = (BAD_DEMO_IDX !== null) ? BAD_DEMO_IDX : Math.floor(Math.random() * buildings.length);
        if (buildingGone(idx)) idx = pickBuildingTarget();   // ehti jo tuhoutua → mikä tahansa ehjä
        if (idx < 0) { badDemoDone = true; badDemoTimer = -1; return; }
        shootingStar = makeBadDemoMeteor(idx);
        badDemoDone = true;
        badDemoTimer = -1;
    }

    /* Tuhoutuminen alkaa: talo menettää toimintonsa heti (valot pois, ei uusia
       ikkunavaloja, oviukko katoaa talon mukana).: ovi katoaa – vain yksi
       satunnainen talo pitää ovensa pystyssä pelkkinä ulkokarmina (drawDoor). */
    function startBuildingCollapse(idx) {
        const b = buildings[idx];
        if (!b || buildingGone(idx) || buildingDmg[idx]) return false;
        buildingDmg[idx] = { phase: 0, t: 0 };
        if (smallHouseLights[idx]) { smallHouseLights[idx].lit = false; smallHouseLights[idx].timer = 0; }
        if (idx === 0) {
            firstHouseWindowsLit = false;
            firstHouseKickCount = 0; firstHouseKickTarget = 0; firstHouseWindowTimer = 0;
        }
        for (let i = litWindows.length - 1; i >= 0; i--) {
            if (litWindows[i].bldgIdx === idx) litWindows.splice(i, 1);
        }
        if (avenger && avenger.bldgIdx === idx) avenger = null;   // oviukko katoaa talon mukana
        const cx = b.x + b.w / 2;
        playBuildingCollapse();
        spawnParticles(cx, GROUND_Y - 8, '#cfc6b4', 18);
        spawnParticles(cx, GROUND_Y - 8, '#8d8578', 10);
        /* talon tuhoutuessa sen viereinen lamppu sammuu (kupu mustaksi,
           ei enää hehkua). Hakee lampun joko bldgIdx- tai leftBldgIdx-kentästä. */
        for (let i = 0; i < lamps.length; i++) {
            if (lamps[i].leftBldgIdx === idx || lamps[i].bldgIdx === idx) {
                if (lamps[i].lit) {
                    lamps[i].lit = false;
                    state.litLamps[i] = false;
                    GameState.save(state);
                }
                break;
            }
        }
        return true;
    }

    /* Animaation eteneminen: vaiheet 0–5 → lopulta 'gone'. */
    function updateBuildingDamage(dt) {
        for (const key in buildingDmg) {
            const d = buildingDmg[key];
            if (d === 'gone') continue;
            d.t += dt;
            while (d !== 'gone' && d.t >= BLDG_DMG_PHASES[d.phase]) {
                d.t -= BLDG_DMG_PHASES[d.phase];
                d.phase++;
                const b = buildings[Number(key)];
                const cx = b ? b.x + b.w / 2 : 0;
                if (d.phase === 2) {          // seinät mustuivat: matala tömähdys + hiilipöly
                    playKnock();
                    spawnParticles(cx, GROUND_Y - 10, '#6e6a62', 12);
                } else if (d.phase === 4) {   // ääriviivat esiin: kipinöitä ja tomua
                    spawnParticles(cx, GROUND_Y - (b ? b.h * 0.6 : 60), '#ffd23a', 12);
                    spawnParticles(cx, GROUND_Y - 6, '#ffb347', 14);
                }
                if (d.phase >= BLDG_DMG_PHASES.length) {
                    buildingDmg[key] = 'gone';
                    makeBuildingRubble(Number(key));   // paikalle jää musta kasa
                    // yksi satunnainen talo pitää ovensa pystyssä pelkkinä
                    // ulkokarmina – arpa heitetään vain kerran (ks. drawDoor).
                    if (standingDoorIdx === -1) standingDoorIdx = Math.floor(Math.random() * buildings.length);
                    spawnParticles(cx, GROUND_Y - 6, '#5c574f', 16);
                }
            }
        }
    }

    /* Uusi peli / reset: kaikki talot takaisin ehjinä (vain muistissa).
       myös romukasat, pystyyn jäävä ovikehys ja BAD-avaus nollautuvat. */
    function resetBuildingDamage() {
        buildingDmg = {};
        buildingRubble = {};
        standingDoorIdx = -1;
        badDemoTimer = -1;
        badDemoDone = false;
    }

    /* tuhoutuneen talon paikalle jäävä musta romukasa. Muoto arvotaan
       KERRAN (ei per frame), jotta kasa ei välky. Kasa ei koskaan ylitä puolta
       ovenkorkeudesta (RUBBLE_H_MAX = DOOR_H / 2 = 16 px). */
    function makeBuildingRubble(idx) {
        const b = buildings[idx];
        if (!b) return;
        const w = Math.round(b.w * (0.45 + Math.random() * 0.40));      // 45–85 % talon leveydestä
        const h = 6 + Math.floor(Math.random() * (RUBBLE_H_MAX - 5));   // 6 … RUBBLE_H_MAX
        const n = 2 + Math.floor(Math.random() * 3);                    // 2–4 möykkyä
        const lumps = [];
        for (let i = 0; i < n; i++) {
            lumps.push({
                f: (i + 0.5) / n + (Math.random() - 0.5) * 0.30,        // möykyn kohta (0–1)
                h: Math.max(3, Math.round(h * (0.45 + Math.random() * 0.55))),
                w: Math.round(w * (0.22 + Math.random() * 0.30))
            });
        }
        buildingRubble[idx] = {
            w, h, lumps,
            x: Math.round((b.w - w) / 2),                               // keskitetty talon pohjalle
            shade: 0.06 + Math.random() * 0.12,                         // hiiltymän sävy
            /* tuhoutuneesta talosta nousevat vaaleat savukiekurat
               (vain BAD/FULL). */ 
            bldgH: b.h,                                                 // talon alkuperäinen korkeus (savun max-korkeus = bldgH/3)
            smokeParticles: [],
            smokeTimer: 200 + Math.random() * 200,                      // aloitussyke ~3–7 s
            smokes: Math.random() < 0.33                                 // vain ~1/3 raunioista savuaa
        };
    }

    /* Meteoriitin esiintymistodennäköisyys: tappavat meteoriitit
       tulevat FULL CHAOS -modessa aina ja BAD CHAOS -modessa harvakseltaan
       (BAD:ssa ei ole sädeasetta → pelaaja joutuu katsomaan kaupungin tuhoutuvan).
       MILD/GOOD/NORMAL = 0 (ei koskaan). */
    function meteoriteChance() {
        if (chaosFlags.meteorAlways) return 1;       // aina (sädease testattavissa)
        if (chaosFlags.meteorHalf) return 0.5;      // 25 → 50 % (tuho nopeammaksi, ei asetta)
        return 0;
    }

    /* Meteoriitin osuma tuhoaa taustarivin taloja: lähin lohko + sen
       viereiset (yhteensä METEOR_BACKDROP_HOUSES), jotta skyline sortuu paikallisesti
       siihen missä meteoriitti osui. Wrap-around pitää rivin ehjänä reunalla. */
    function destroyBackdropHouses(impactX) {
        if (!backdrop || !backdrop.blocks.length) return;
        const bgShift = camX * (1 - BACKDROP_PARALLAX);
        const target = impactX - bgShift;   // maailmakoordinaatti → tausta-avaruus
        const blocks = backdrop.blocks;
        let best = -1, bestDist = Infinity;
        for (let i = 0; i < blocks.length; i++) {
            if (blocks[i].ruin) continue;   // raunio ei kelpaa kohteeksi
            const cx = blocks[i].x + blocks[i].w / 2;
            const d = Math.abs(cx - target);
            if (d < bestDist) { bestDist = d; best = i; }
        }
        if (best < 0) return;   // koko rivi jo raunioina
        // lohkoja EI enää poisteta – lähin + seuraavat rapistuvat
        // raunioiksi (kierrä reunalla, jotta skyline sortuu osumakohdassa).
        const hit = [];
        for (let k = 0; k < blocks.length && hit.length < METEOR_BACKDROP_HOUSES; k++) {
            const b = blocks[(best + k) % blocks.length];
            if (b.ruin) continue;   // vain ehjät lohkot -> aina 3 uutta rauniota
            hit.push(b);
        }
        for (const b of hit) ruinBackdropBlock(b);
    }

    /* taustalohko → RAUNIO. Iso kerrostalo ei katoa kokonaan: horisonttiin
       jää kohtuu korkea RUNKO (pystypalkit + laattaviivat = seinät puuttuvat) ja
       lisäksi 1–3 seinäpalaa. Lohko pysyy rivissä (x/w ennallaan), joten skyline
       ei saa aukkoa. Toinen osuma samaan lohkoon: runko ei enää laske, mutta
       yksi seinäpala murenee → raunio rapistuu muttei katoa koskaan. */
    const BD_RUIN_STUB_MIN = 0.55;    // rungon korkeus alkuperäisestä (min)
    const BD_RUIN_STUB_MAX = 0.80;    // ... (max)
    function ruinBackdropBlock(b) {
        if (b.ruin) {
            if (b.ruin.walls.length) b.ruin.walls.splice(Math.floor(Math.random() * b.ruin.walls.length), 1);
            return;
        }
        const stub = Math.round(b.h * (BD_RUIN_STUB_MIN + Math.random() * (BD_RUIN_STUB_MAX - BD_RUIN_STUB_MIN)));
        const ruin = { stub, cols: [], slabs: [], walls: [] };
        const nCols = 2 + Math.floor(Math.random() * 3);      // 2–4 pystypalkkia
        for (let i = 0; i < nCols; i++) {
            const f = (i + 0.5) / nCols + (Math.random() - 0.5) * 0.10;
            ruin.cols.push(Math.max(0, Math.min(b.w - 2, Math.round(b.w * f))));
        }
        const nSlabs = 2 + Math.floor(Math.random() * 3);     // 2–4 laattaviivaa
        for (let i = 0; i < nSlabs; i++) {
            ruin.slabs.push(Math.round(stub * (0.25 + 0.65 * (i + 1) / (nSlabs + 1))));
        }
        const nWalls = 1 + Math.floor(Math.random() * 3);     // 1–3 seinäpalaa
        for (let i = 0; i < nWalls; i++) {
            const w = Math.round(b.w * (0.25 + Math.random() * 0.35));
            const x = Math.round(Math.random() * Math.max(0, b.w - w));
            const h = Math.round(10 + Math.random() * Math.max(8, stub * 0.45));
            ruin.walls.push({ x, w, h });                     // seinä nousee pohjasta
        }
        b.ruin = ruin;
    }

    /* ── Sädease: tähtäys + laukaisu ── */
    function beamCanFire() {
        if (!beamWeaponCollected) return false;
        if (beamCooldownTimer > 0) return false;   // laukaisuväli (piilottaa myös ristikon)
        if (!shootingStar || !shootingStar.active || shootingStar.kind !== 'meteorite') return false;
        if (dayNight.t > 0) return false;
        // pelaajan on oltava kääntyneenä meteoriitin tulosuuntaan (ei ammuntaa selästä)
        if (player.facing * shootingStar.vx >= 0) return false;
        // ampuu vain lamppurivistön alapuolella (kadun puolella, ei talojen takaa)
        if (player.y + player.h < LAMP_BASE_Y) return false;
        return true;
    }

    /* Sädeaseen piipun kärki maailmakoordinaateissa: sama piste
       piirrolle ja säteen lähtöpisteelle → säde lähtee aseesta, ei sen alta. */
    function beamMuzzle() {
        const cx = player.x + player.w / 2;
        const dir = player.facing;
        const gripX = cx + dir * 5;         // etukäden ote
        const gripY = player.y + 18;        // nostettu ote
        const len = 12.5;                   // piipun kärjen etäisyys otteesta
        const a = -Math.PI / 4;             // 45° ylös-eteen
        return {
            x: gripX + dir * Math.cos(a) * len,
            y: gripY + Math.sin(a) * len    // sin(-45°) < 0 → y pienenee (ylös)
        };
    }

    /* Onko meteoriitti jonkin katurivin talon takana (meteoriitti piirretään
       talojen takana → talon läpi ei voi osua). Tarkistaa meteoriitin SIJAINNIN,
       ei säteen linjaa – linja kulkee aina talovyöhykkeen läpi, joten linja-tarkistus
       estäisi kaikki osumat. */
    function meteoriteBehindBuilding() {
        const mx = shootingStar.x, my = shootingStar.y;
        // tähdätty meteoriitti piirretään nyt talojen TAKANA kuten muutkin
        // (ks. render), joten talon runko estää säteen myös siltä: osuma onnistuu
        // vain, kun meteoriitti on katon yläpuolella. Tuhoutunut talo ei estä.
        for (const b of buildings) {
            if (buildingGone(buildings.indexOf(b))) continue;   // tuhoutunut talo ei estä sädettä
            if (mx >= b.x && mx <= b.x + b.w && my >= GROUND_Y - b.h && my <= GROUND_Y) {
                return true;
            }
        }
        return false;
    }

    function distanceToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(px - ax, py - ay);
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    function fireBeam() {
        // lukon aikana kuiva klikki – muuten hiljainen "ei laukausta"
        // (päivällä, ilman meteoriittia tai väärinpäin seisten ei kuulu klikkiä)
        if (beamCooldownTimer > 0) { playBeamEmpty(); return; }
        if (!beamCanFire()) return;
        // lukko päälle ENNEN osumatarkistusta → huti maksaa saman kuin osuma
        beamCooldownTimer = BEAM_COOLDOWN_FRAMES;
        beamFireTimer = BEAM_FIRE_FRAMES;
        const m = beamMuzzle();
        const sh = drunkAimShift();          // humala horjuttaa tähtäystä
        const ax = aimX + sh.x, ay = aimY + sh.y;
        beamStartX = m.x; beamStartY = m.y;
        beamEndX = ax; beamEndY = ay;
        playLaser();
        // talon takana olevaan meteoriittiin ei voi osua (tarkistaa sijainnin, ei linjaa)
        if (meteoriteBehindBuilding()) return;
        const d = distanceToSegment(shootingStar.x, shootingStar.y, m.x, m.y, ax, ay);
        if (d < shootingStar.r + BEAM_HIT_TOLERANCE) {
            // meteoriitti kestää METEOR_HITS_TO_KILL osumaa. Ensimmäinen
            // osuma vain lämmittää sen (sävy vaihtuu tasaisesti oranssiksi: ydin,
            // vana ja hehku) ja kolahtaa; tuhoutuminen ja kolikko vasta tappavasta.
            const hpBefore = (shootingStar.hpLeft === undefined) ? METEOR_HITS_TO_KILL : shootingStar.hpLeft;
            shootingStar.hpLeft = hpBefore - 1;
            shootingStar.hitFlash = 10;   // lyhyt lämmin välähdys osumasta
            if (shootingStar.hpLeft > 0) {
                shootingStar.cracked = true;
                playMeteorHit();
                spawnParticles(shootingStar.x, shootingStar.y, '#ffb46a', 12);
                return;
            }
            // Tappava osuma → meteoriitti räjähtää ennen maahan osumista (ei taustatuhoa, ei tärinää)
            spawnParticles(shootingStar.x, shootingStar.y, '#dbe6ff', 22);
            spawnParticles(shootingStar.x, shootingStar.y, '#f4f8ff', 12);
            shootingStar.active = false;
            // FULL CHAOS – jokainen ammuttu meteoriitti = +1 🪙.
            // Portti chaosFlags.meteorKill: ase on jaettu tallennuskenttä, joten
            // BADissa (25 % meteoriitit) ei tule kolikkoa – muut tasot pysyvät ennallaan.
            // Sääntö 06: ei uutta tekstiä – pling + kultakipinät + HUD-lukema riittävät.
            if (chaosFlags.meteorKill) {
                coinCount++;
                state.inventory.coinCount = coinCount;
                GameState.save(state);
                playCoin();
                spawnParticles(shootingStar.x, shootingStar.y, '#ffd700', 10);
                updateHUD();
            }
        }
    }

    function spawnBeamPickup() {
        // Vain FULL CHAOS ja vain jos ase on vielä ansaitsematta.
        if (!chaosFlags.beamWeapon || beamWeaponCollected) { beamPickup = null; return; }
        /* y on AINA sama (teräsaidan vieressä, pelaajan alin jalkapiste) –
           satunnainen y vei esineen toisinaan lampputolpan taakse, josta sitä ei
           voinut poimia lainkaan. Vain x arvotaan, ja sekään ei aivan reunaan. */
        const bx = BEAM_PICKUP_X_MIN + Math.random() * (BEAM_PICKUP_X_MAX - BEAM_PICKUP_X_MIN);
        beamPickup = { x: bx, y: BEAM_PICKUP_Y };
    }

    function updateShootingStar(dt) {
        if (!shootingStar || !shootingStar.active) {
            if (shootingStar) { shootingStar.timer -= dt; }
            if (!shootingStar || shootingStar.timer <= 0) {
                if (chaosFlags.anyChaos && (Math.random() < meteoriteChance() || badFinalePhase())) {
                    // Iso, hitaasti putoava meteoriitti – tähdenlennon tilalla.
                    // viisto laskeutumiskulma 40–60° vaakasuorasta (kuten tähdenlento),
                    // jotta ehtii nähdä ja säikähtää. Suunta oikealle/vasemmalle, lähtö vastakkaiselta reunalta.
                    // eskalaation jälkeen meteoriitti tähdätään ehjään
                    // katuvarren taloon (kaikki 9, mutta BAR viimeisenä) → tuho
                    // etenee vääjäämättä, ellei pelaaja ammu meteoriittia alas
                    // (FULL: sädease). Ennen eskalaatiota syntyy kuten ennen.
                    const aimIdx = backdropMostlyGone() ? pickBuildingTarget() : -1;
                    if (aimIdx >= 0) { shootingStar = makeAimedMeteor(aimIdx); return; }
                    const mAng = (40 + Math.random() * 20) * Math.PI / 180;
                    const mDir = Math.random() < 0.5 ? 1 : -1;
                    const mSpd = 0.45 + Math.random() * 0.4;
                    shootingStar = {
                        kind: 'meteorite',
                        x: mDir > 0 ? (10 + Math.random() * 80) : (WORLD_W - 10 - Math.random() * 80),
                        y: 10 + Math.random() * 40,
                        vx: Math.cos(mAng) * mSpd * mDir,
                        vy: Math.sin(mAng) * mSpd,
                        r: 8 + Math.random() * 6,
                        active: true, life: 0,
                        hpLeft: METEOR_HITS_TO_KILL,   // 2 osumaa tuhoaa
                        cracked: false, hitFlash: 0,   // cracked = ottanut osuman → lämmin oranssi sävy
                        trail: [], timer: nextSkyGap()   // BAD-finaalissa lyhyt väli
                    };
                } else {
                    const ang = -0.3 - Math.random() * 0.5;
                    const spd = 1.5 + Math.random() * 2.5;
                    shootingStar = {
                        kind: 'star',
                        x: -10 + Math.random() * WORLD_W * 0.4,
                        y: 15 + Math.random() * 100,
                        vx: Math.cos(ang) * spd,
                        vy: Math.sin(ang) * spd,
                        active: true, life: 120 + Math.random() * 180,
                        trail: [], timer: StreetChaosCards.meteorBurst ? (5 + Math.random() * 15) : nextSkyGap()
                    };
                }
            }
        } else if (shootingStar.kind === 'meteorite') {
            shootingStar.x += shootingStar.vx * dt;
            shootingStar.y += shootingStar.vy * dt;
            shootingStar.life += dt;
            if (shootingStar.hitFlash > 0) shootingStar.hitFlash -= dt;   // osumavälähdys
            shootingStar.trail.push({x: shootingStar.x, y: shootingStar.y});
            if (shootingStar.trail.length > 72) shootingStar.trail.shift();  // 1.5x pidempi häntä (oli 48)
            if (shootingStar.y >= GROUND_Y) {
                meteorShakeTimer = METEOR_SHAKE_FRAMES;
                meteorFlash = { t: METEOR_FLASH_FRAMES };   // taivas välähtää (ei etualan palloa)
                destroyBackdropHouses(shootingStar.x);      // taustarivi sortuu osumakohdasta
                // eskalaation jälkeen osuma tuhoaa katuvarren talon
                if (shootingStar.targetBldgIdx !== undefined) startBuildingCollapse(shootingStar.targetBldgIdx);
                spawnParticles(shootingStar.x, GROUND_Y - 4, '#dbe6ff', 18);
                spawnParticles(shootingStar.x, GROUND_Y - 4, '#f4f8ff', 10);
                shootingStar.active = false;
            } else if (shootingStar.x < -40 || shootingStar.x > WORLD_W + 40) {
                shootingStar.active = false;   // lensi ulos sivusta, ei törmäystä
            }
        } else {
            shootingStar.x += shootingStar.vx * dt;
            shootingStar.y -= shootingStar.vy * dt;
            shootingStar.trail.push({x: shootingStar.x, y: shootingStar.y});
            if (shootingStar.trail.length > 18) shootingStar.trail.shift();
            shootingStar.life -= dt;
            if (shootingStar.life <= 0 || shootingStar.x > WORLD_W + 30 || shootingStar.y < -30 || shootingStar.y > GROUND_Y) {
                shootingStar.active = false;
            }
        }
    }

    function drawMeteorite() {
        const m = shootingStar;
        // osuman ottanut meteoriitti on "lämmennyt" – muoto ja syke pysyvät
        // täysin ennallaan, vain sävy vaihtuu tasaisesti lämpimään oranssiin
        // (ei halkeamia eikä muita muotoyksityiskohtia: se näytti mustalta rastilta).
        const dmg = m.cracked === true;
        const trailRGB = dmg ? '255,155,50' : '205,220,245';
        // lämmenneen meteoriitin vana on hoikempi (0.5 + k*0.8, oli 0.7 + k*1.4)
        // ja 1.5x pidempi (72 pistettä, oli 48) + kylläinen oranssi väri
        for (let t = 0; t < m.trail.length; t++) {
            const tr = m.trail[t];
            const k = t / m.trail.length;
            ctx.fillStyle = 'rgba(' + trailRGB + ',' + (k * 0.4) + ')';
            ctx.beginPath(); ctx.arc(tr.x, tr.y, 0.5 + k * 0.8, 0, Math.PI * 2); ctx.fill();
        }
        // Hoikka ydin + heikko hehku: kylmä jäänvalkoinen → lämmenneenä oranssi
        const pulse = 0.85 + Math.sin(m.life * 0.12) * 0.15;
        const r = m.r * pulse * 0.55;   // laihempi ydin
        const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 2.4);
        if (dmg) {
            glow.addColorStop(0, 'rgba(255,180,60,' + (0.6 * pulse) + ')');
            glow.addColorStop(0.55, 'rgba(255,130,30,0.25)');
            glow.addColorStop(1, 'rgba(200,80,10,0)');
        } else {
            glow.addColorStop(0, 'rgba(240,246,255,' + (0.5 * pulse) + ')');
            glow.addColorStop(0.55, 'rgba(175,195,225,0.20)');
            glow.addColorStop(1, 'rgba(150,170,200,0)');
        }
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(m.x, m.y, r * 2.4, 0, Math.PI * 2); ctx.fill();
        // Ydin (lämmenneenä kylläinen oranssi)
        ctx.fillStyle = dmg ? '#ffa030' : '#f4f8ff';
        ctx.beginPath(); ctx.arc(m.x, m.y, r * 0.7, 0, Math.PI * 2); ctx.fill();
        // Osumavälähdys: lyhyt lämmin pop (~10 f) – pelkkä sävy, ei muotoa
        if (m.hitFlash > 0) {
            const flash = Math.min(1, m.hitFlash / 10);
            ctx.fillStyle = 'rgba(255,214,160,' + (0.75 * flash).toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(m.x, m.y, r * 1.5, 0, Math.PI * 2); ctx.fill();
        }
    }

    function updateSatellite(dt) {
        if (!satellite || !satellite.active) {
            if (satellite) { satellite.timer -= dt; }
            if (!satellite || satellite.timer <= 0) {
                const dir = Math.random() < 0.5 ? 1 : -1;
                satellite = {
                    x: dir > 0 ? -10 : WORLD_W + 10,
                    y: 25 + Math.random() * 70,
                    vx: dir * (0.25 + Math.random() * 0.5),
                    active: true, blinkPhase: Math.random() * Math.PI * 2,
                    timer: (400 + Math.random() * 900) * meteorTempoMult
                };
            }
        } else {
            satellite.x += satellite.vx * dt;
            satellite.blinkPhase += 0.08 * dt;
            if ((satellite.vx > 0 && satellite.x > WORLD_W + 15) || (satellite.vx < 0 && satellite.x < -15)) {
                satellite.active = false;
            }
        }
    }



    /* Päivittää johdetut moodiliput chaosLevelistä. Kutsutaan AINA kun taso vaihtuu
       (applyChaosProfile) → myös F5-palautus (?chaos= / sessionStorage) päivittyy. */
    function applyChaosFlags() {
        const isFull = chaosLevel === 'full';
        const isBad = chaosLevel === 'bad';
        const ruins = isBad || isFull;          // BAD ja FULL jakavat raunio-logiikan
        chaosFlags.beer          = isFull;
        chaosFlags.drunk         = isFull;
        chaosFlags.beamWeapon    = isFull;
        chaosFlags.meteorAlways  = isFull;
        chaosFlags.meteorKill    = isFull;
        chaosFlags.meteorHalf    = isBad;
        chaosFlags.badDemo       = isBad;
        chaosFlags.badFinale     = isBad;
        chaosFlags.ruin          = ruins;
        chaosFlags.mosquitoes    = ruins;
        chaosFlags.storm         = isBad;   // BAD: myrsky (sade + ukkonen purskeina)
        chaosFlags.anyChaos      = chaosLevel !== 'normal';
    }

    function applyChaosProfile(level, cfgOverride) {
        chaosLevel = level || 'normal';
        applyChaosFlags();   // johdetut moodiliput (Vaihe 2)
        // cfgOverride = F5-soft reset: käytetään tallennettua ratkaistua configia
        // suoraan (klampataan idempotentisti turvaksi) – ei uutta arpaa.
        chaosCfg = cfgOverride ? clampChaosCfg(cfgOverride) : drawChaosCfg(chaosLevel);   // portti: klampit + validointi (pääsääntö 2)
        // Kirjoitetaan kertoimet olemassa oleviin muuttujiin
        DAY_CYCLE_FRAMES     = chaosCfg.dayCycleFrames;
        MOON_NIGHT_FRAMES    = chaosCfg.dayCycleFrames;
        SUN_DAY_FRAMES       = chaosCfg.dayCycleFrames;
        BIRD_COUNT_MIN       = chaosCfg.birdMin;
        BIRD_COUNT_MAX       = chaosCfg.birdMax;
        COIN_RESPAWN_FRAMES  = chaosCfg.coinRespawnFrames;
        ROBBER_APPEAR_CHANCE = chaosCfg.robberChance;
        ROBBER_SPEED         = chaosCfg.robberSpeed;
        ROBBER_COOLDOWN      = chaosCfg.robberCooldown;
        ROBBER_TTL           = chaosCfg.robberTtl;
        ROBBER_CHASES_Y      = chaosCfg.robberChasesY === true;
        windSpeedMult        = chaosCfg.windSpeedMult;
        windDirFlip          = chaosCfg.windDirFlip;
        trafficSpeedMult     = chaosCfg.trafficSpeedMult;
        trafficSpawnMult     = chaosCfg.trafficSpawnMult;
        skyDir               = chaosCfg.skyDir;
        // K1 – visuaaliset akselit
        cloudCount          = chaosCfg.cloudCount;
        cloudOpacityMult    = chaosCfg.cloudOpacityMult;
        cloudSizeMult       = chaosCfg.cloudSizeMult;
        cloudBandTop        = chaosCfg.cloudBandTop;
        cloudBandH          = chaosCfg.cloudBandH;
        cloudCirrusShare    = chaosCfg.cloudCirrusShare;
        starCount           = chaosCfg.starCount;
        starSizeMult        = chaosCfg.starSizeMult;
        sunColor            = chaosCfg.sunColor;
        sunGlow             = chaosCfg.sunGlow;
        animalSpeedMult     = chaosCfg.animalSpeedMult;
        animalDirBias       = chaosCfg.animalDirBias;
        animalTypeWeights   = chaosCfg.animalTypeWeights;
        batSpawnFrames      = chaosCfg.batSpawnFrames;
        birdSpeedMult       = chaosCfg.birdSpeedMult;
        beetleCount         = chaosCfg.beetleCount;
        windowTargetMax     = chaosCfg.windowTargetMax;
        windowDurMin        = chaosCfg.windowDurMin;
        windowDurMax        = chaosCfg.windowDurMax;
        lampHueShift        = chaosCfg.lampHueShift;
        buildingPalette     = chaosCfg.buildingPalette;
        CLOUD_DAY_ALPHA     = chaosCfg.cloudDayAlpha;
        DAY_SKY_TOP         = chaosCfg.daySkyTop;
        DAY_SKY_MID         = chaosCfg.daySkyMid;
        DAY_SKY_HORIZON     = chaosCfg.daySkyHorizon;
        SILHOUETTE_CHANCE   = chaosCfg.silhouetteChance;
        WIN_DAY_FILL        = chaosCfg.winDayFill;
        LAMP_RADIUS         = chaosCfg.lampRadius;
        BAT_COUNT_MAX       = chaosCfg.batCountMax;
        // K2 (kellon rytmit) + K6 (SFX)
        DAY_FADE_FRAMES     = chaosCfg.dayFadeFrames;
        NIGHT_FADE_FRAMES   = chaosCfg.nightFadeFrames;
        CYCLE_CHANGE_DELAY_FRAMES = chaosCfg.cycleChangeDelayFrames;
        NIGHT_LAMP_FIRST    = chaosCfg.nightLampFirst;
        NIGHT_LAMP_INTERVAL = chaosCfg.nightLampInterval;
        SPAWN_LAMP_DELAY    = chaosCfg.spawnLampDelay;
        CAB_BLINK_MIN       = chaosCfg.cabBlinkMin;
        CAB_BLINK_MAX       = chaosCfg.cabBlinkMax;
        CAB_REROLL_MIN      = chaosCfg.cabRerollMin;
        CAB_REROLL_MAX      = chaosCfg.cabRerollMax;
        MOSQUITO_DAY_DIM    = chaosCfg.mosquitoDayDim;
        meteorTempoMult     = chaosCfg.meteorTempoMult;
        StreetSfx.setVolume(chaosCfg.sfxVolumeMult);
        fogAlpha            = chaosCfg.fogAlpha;
        // Kaaos – uudet akselit
        doorLockChance      = chaosCfg.doorLockChance;
        staggerAmount       = chaosCfg.staggerAmount;
        screenShakeAmount   = chaosCfg.screenShakeAmount;
        lampRedFlicker      = chaosCfg.lampRedFlicker;
        barBurntLetter      = chaosCfg.barBurntLetter;
        cabFlicker          = chaosCfg.cabFlicker;
        sunSizeMult         = chaosCfg.sunSizeMult;
        // K1/K6 – BAD-myrsky (paksut pilvet + sade + ukkonen purskeina)
        cloudThickMult      = chaosCfg.cloudThickMult;
        stormBurst          = chaosCfg.stormBurst === true;
        rainAmount          = chaosCfg.rainAmount;
        stormCalmMin        = chaosCfg.stormCalmMin;
        stormCalmMax        = chaosCfg.stormCalmMax;
        stormBurstMin       = chaosCfg.stormBurstMin;
        stormBurstMax       = chaosCfg.stormBurstMax;
        thunderGapMin       = chaosCfg.thunderGapMin;
        thunderGapMax       = chaosCfg.thunderGapMax;
        // Kaappien vilkuntajakso päivittyy uusiin CAB_BLINK-arvoihin
        for (const cab of electricCabinets) cab.period = CAB_BLINK_MIN + Math.random() * (CAB_BLINK_MAX - CAB_BLINK_MIN);
        // K7-korttipakka: aktivoi vain ei-NORMAL-tasoilla
        StreetChaosCards.reset();
        // K3 (uhka) + K4 (keho/reppu): C-indeksi tuotantokäyttöön
        AVENGER_CHANCE      = chaosCfg.avengerChance;
        AVENGER_SPEED       = chaosCfg.avengerSpeed;
        AVENGER_TELEGRAPH   = chaosCfg.avengerTelegraph;
        AVENGER_FREEZE      = chaosCfg.avengerFreeze;
        AVENGER_COOLDOWN    = chaosCfg.avengerCooldown;
        AVENGER_STUN        = chaosCfg.avengerStun;
        ROBBER_STUN         = chaosCfg.robberStun;
        ELECTRIC_CABINET_ON = chaosCfg.cabinetOnChance;
        HUNGER_WAKE_GRACE   = chaosCfg.hungerWakeGrace;
        burgerInterval      = chaosCfg.burgerInterval;
        // Spawn-arpa turvalliselle jalkakäytävälle (ei ajokaistoille y 328/340)
        player.x = rnd(4, WORLD_W - player.w - 4);
        player.y = (Math.random() < 0.8)
            ? (280 + rnd(0, 8))          // talojen puoli (ylhäällä, turvassa autoilta)
            : (347 + rnd(0, 3));         // aidan puoli (alhaalla, turvassa autoilta)
        player.facing = Math.random() < 0.5 ? 1 : -1;
        if (CHAOS_DEBUG) {
            console.table(chaosCfg);
            console.log('[chaos] level =', chaosLevel,
                '· C =', chaosAbilityFor(chaosCfg),
                '· burgerIntervalMin =', burgerIntervalMin(chaosCfg, chaosAbilityFor(chaosCfg)),
                '· validate =', validateChaosCfg(chaosCfg));
        }
    }

    function setChaos(level, cfg) {
        applyChaosProfile(level, cfg);
        return chaosLevel;
    }

    /* Kaaossession: F5/reload palauttaa saman moden ilman alkuhubia.
       sessionStorage selviää reloadista mutta tyhjenee uudessa välilehdessä
       (→ "peliin tulo" näyttää hubin). ✕-hard reset ja kuolema tyhjentävät sen. */
    const CHAOS_SESSION_KEY = 'aistreet_chaos_session';
    function saveChaosSession() {
        try {
            /* humala (🍺) tallennetaan session mukana, jotta F5-soft
               reset ei hukkaa sitä – vain hard reset (✕ / kuolema / uusi
               välilehti) tyhjentää koko session (clearChaosSession). */
            sessionStorage.setItem(CHAOS_SESSION_KEY, JSON.stringify({
                level: chaosLevel, cfg: chaosCfg, drunk: drunkLevel, drunkT: drunkTimer
            }));
        } catch (e) {}
    }
    function loadChaosSession() {
        try {
            const raw = sessionStorage.getItem(CHAOS_SESSION_KEY);
            if (!raw) return null;
            const s = JSON.parse(raw);
            if (!s || typeof s.level !== 'string') return null;
            return s;
        } catch (e) { return null; }
    }
    function clearChaosSession() {
        try { sessionStorage.removeItem(CHAOS_SESSION_KEY); } catch (e) {}
    }

    /* Poistaa sädeaseen inventorysta: kutsutaan, kun peli palaa
       Click/Press-aloitusnäytölle (ei kaaos-sessiota = uusi peli / kuolema /
       ✕-resetti). Sädease on "kerran per run" -esine, joten se ei saa jäädä
       käteen uudella kierroksella. F5-soft reset ei kutsu tätä → sädease
       säilyy samassa runissa. */
    function clearBeamWeapon() {
        try {
            const st = GameState.load();
            if (st && st.beamWeaponCollected) {
                st.beamWeaponCollected = false;
                GameState.save(st);
            }
        } catch (e) {}
        beamWeaponCollected = false;
        beamPickup = null;
    }

    /* ═══════════════════════════════════════════════════════════
       KAAOS v2 – portti
       Kaikki kaaosarvot kulkevat clampChaosCfg() → validateChaosCfg()
       -portin läpi (pääsääntö 2). NORMAL = nykyiset literaalit.
       Kutsutaan tuotannossa vaiheissa; tässä vaiheessa
       toiminnot ovat valmiina ja ?debug raportoi ne.
       ═══════════════════════════════════════════════════════════ */

    // 1) Kyvykkyysindeksi C (luku 5.1)
    function chaosSpeedMult() { return chaosCfg.playerSpeedMult || 1; }
    // Portti käyttää ARVOTTAVAN configin arvoja (playerSpeedMult + startBurgers):
    // muuten C laskettaisiin vanhalla chaosCfg:llä ja väärällä 🍔-määrällä.
    // Ajonaikainen C (liike, rosvon spawn) käyttää elävää 🍔-määrää.
    function chaosAbility()   { return chaosSpeedMult() * hungerSpeedMult(); }

    // 2) Selviytymisinvariantti (luku 5.2)

    // 3) Uhka (luku 5.3)

    // 4) Portti: klampit

    // 5) Portti: hyväksyntä – hylkää epäreilu arpa (pääsääntö 2)

    // 6) FULL-arpa: enintään 40 yritystä, muuten turvallinen klampattu arpa


    /* ── K7-kaaoskortit omasta tiedostosta (Vaihe 5 osa 5) ──
       street/chaos-cards.js omistaa korttipakan tilan (cardState) ja korttidefit.
       Tähän sidotaan ne street.js:n sulkeuman arvot, joita korttien
       save/apply/restore muuttaa – get+set -pareina, jotta muutokset näkyvät
       samoihin olioihin kuin ennen (esim. applyChaosProfile, render). */
    StreetChaosCards.bind({
        get anyChaos() { return chaosFlags.anyChaos; },
        rng: chaosRng,
        consts: { WORLD_W: WORLD_W, GROUND_Y: GROUND_Y },
        fx: {
            randomHuePalette: randomHuePalette,
            randomizeBuildingColors: randomizeBuildingColors,
            getAvailableWindows: getAvailableWindows,
            pickColorType: pickColorType
        },
        state: {
            get sunColor() { return sunColor; },               set sunColor(v) { sunColor = v; },
            get sunGlow() { return sunGlow; },                 set sunGlow(v) { sunGlow = v; },
            get daySkyTop() { return DAY_SKY_TOP; },           set daySkyTop(v) { DAY_SKY_TOP = v; },
            get daySkyMid() { return DAY_SKY_MID; },           set daySkyMid(v) { DAY_SKY_MID = v; },
            get daySkyHor() { return DAY_SKY_HORIZON; },       set daySkyHor(v) { DAY_SKY_HORIZON = v; },
            get fogAlpha() { return fogAlpha; },               set fogAlpha(v) { fogAlpha = v; },
            get windSpeed() { return windSpeed; },             set windSpeed(v) { windSpeed = v; },
            get buildingPalette() { return buildingPalette; }, set buildingPalette(v) { buildingPalette = v; },
            get animalSpawnTimer() { return animalSpawnTimer; }, set animalSpawnTimer(v) { animalSpawnTimer = v; },
            get starCount() { return starCount; },
            get starSizeMult() { return starSizeMult; },
            get stars() { return stars; },
            get litWindows() { return litWindows; }
        }
    });

    /* Testikytkin (ei tallenna mitään, kuten ?day / ?hole / ?cabs):
       ?card=<id> pitää yhden K7-kortin päällä loputtomiin → jokainen kortti
       on helppo katsoa yksi kerrallaan eikä tarvitse arvata, mikä ruudulla
       on korteista. Id:t: green · meteor · fog · gust · blackout · windows ·
       parade · palette · sky · stars.  Ilman parametria ei muuta mitään. */
    const CARD_PARAM = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search).get('card') : null;
    if (CARD_PARAM) StreetChaosCards.setForcedCard(CARD_PARAM);

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        // Pikseliterävyys: ei pehmennystä skaalattaessa (sprite-piirto)
        ctx.imageSmoothingEnabled = false;
        randomizeBuildingColors();  // arvo taloille uudet sävyt joka kerta
        /* palauta oletusasettelu (myös BAD/FULL-runin jälkeen), sitten
           BAD/FULL arpoo talojen keskinäisen järjestyksen kadulla. Talot pysyvät
           kokonaisina (korkeus/kyltti/rooli/ovi/lamppu mukana); NORMAL/MILD/GOOD
           eivät kutsu arvontaa (bitti-identtiset). */
        resetBuildingOrder();
        if (chaosFlags.ruin) shuffleBuildingOrder();   // BAD/FULL: talojärjestys arvotaan
        resetBuildingDamage();      // talot ehjinä uudessa pelissä (vain muistissa)
        /* laske jokaiselle lampulle sen vasemman puoleinen talo (naapuri).
           Lamppu on aina kahden talon välissä – bldgIdx kertoo oikean puolen,
           leftBldgIdx lasketaan tässä talojen nykyisten sijaintien perusteella. */
        for (let i = 0; i < lamps.length; i++) {
            const lx = lamps[i].x;
            let bestIdx = -1, bestRight = -Infinity;
            for (let j = 0; j < buildings.length; j++) {
                const right = buildings[j].x + buildings[j].w;
                if (right <= lx + 3 && right > bestRight) {
                    bestRight = right;
                    bestIdx = j;
                }
            }
            lamps[i].leftBldgIdx = bestIdx;
        }
        state = GameState.load();
        /* Onko kyseessä aivan uusi peli (0-tila)? Kuun kello (moonClock)
           jätetään vertailusta pois: se tallentuu itsestään heti yön alettua,
           eikä sen kuulu sammuttaa aloitusohjetta. Sama auringon kellolle. */
        const progressState = Object.assign({}, state);
        delete progressState.moonClock;
        delete progressState.sunClock;
        const freshGame = (JSON.stringify(progressState) === JSON.stringify(GameState.defaultState));
        // Kaaos K4: uuden pelin syntymäpaketti kaaosakselina
        // (aloituskolikot · aloitus🍔 2–10).: aloituskolikot ovat FULLissa
        // KIINTEÄT = NO CHAOSin arvo (CHAOS_DEFAULTS2.startCoins); muilla tasoilla
        // ne ovat aina olleet CHAOS_DEFAULTS2:sta. Tallennettu saldo voittaa aina
        // (sääntö 01) → koskee vain aivan uutta peliä.
        if (freshGame) {
            state.inventory.coinCount = chaosCfg.startCoins;
            state.inventory.hamburgerCount = chaosCfg.startBurgers;
            GameState.save(state);
        }
        for (let i = 0; i < lamps.length; i++) {
            lamps[i].lit = state.litLamps[i];
            lamps[i].kickCount = lamps[i].kickCount || 0;
            lamps[i].overheat = lamps[i].overheat || false;
            lamps[i].overheatTimer = lamps[i].overheatTimer || 0;
            lamps[i]._mosq = null;   // BAD/FULL arpoo moskiittojen koon/värin uudelleen joka kierroksella
            if (!lamps[i].baseShade) {
                const g = 35 + Math.random() * 30;  // 35–65 harmaan vaaleus
                // Kaaos K1: lampHueShift värjää tolpan sävyn (0 = harmaa, kuten ennen)
                lamps[i].baseShade = lampHueShift ? ('hsl(' + lampHueShift + ',22%,' + g + '%)') : ('hsl(0,0%,' + g + '%)');
                lamps[i].hatShade  = lampHueShift ? ('hsl(' + lampHueShift + ',22%,' + (g - 8) + '%)') : ('hsl(0,0%,' + (g - 8) + '%)');
            }
        }
        // Siivoa vanha 6 lampun tila localStorageen jääneestä tallennuksesta
        if (state.litLamps.length > lamps.length) {
            state.litLamps.length = lamps.length;
            GameState.save(state);
        }
        coin.collected = state.inventory.coin;
        coinCount = state.inventory.coinCount || 0;
        coin.respawnTimer = coin.collected ? 1 : 0;
        coin.despawnTimer = coin.collected ? 0 : 600;
        hamburgerCount = state.inventory.hamburgerCount || 5;
        hamburgerTimer = burgerInterval;
        drunkLevel = 0;              // humala alkaa aina nollasta (vain FULL)
        drunkTimer = burgerInterval;
        /* F5-soft reset palauttaa humalan kaaos-sessiosta; hard reset
           (✕ / kuolema / uusi välilehti) tyhjentää session → humala nollautuu. */
        if (chaosFlags.drunk) {
            const ds = loadChaosSession();
            if (ds && typeof ds.drunk === 'number') {
                drunkLevel = Math.max(0, Math.min(DRUNK_MAX, Math.round(ds.drunk)));
                if (typeof ds.drunkT === 'number') drunkTimer = Math.max(1, ds.drunkT);
            }
        }
        drunkStepTimer = DRUNK_STEP_MIN + Math.random() * (DRUNK_STEP_MAX - DRUNK_STEP_MIN);
        drunkLurchX = 0;
        drunkLurchY = 0;
        drunkLurchFrames = 0;
        if (coin.collected) { coin.x = -100; coin.y = -100; }
        else { coin.x = randomCoinX(); coin.y = randomCoinY(); }
        digKeyCollected = state.digKeyCollected || false;
        boulderKeyCollected = state.boulderKeyCollected || false;
        bmKeyCollected = state.bmKeyCollected || false;
        beamWeaponCollected = state.beamWeaponCollected || false;
        spawnBeamPickup();
        beamCooldownTimer = 0;   // uusi peli ei ala keskeneräisellä lukolla
        robberGraceTimer = ROBBER_GRACE_FRAMES;   // 60 s aloitusrauha: ei rosvoa heti
        /* BAD-avaus: BAD = BAD – laskuri viritetään tässä, mutta meteoriitti
           syntyy vasta kadulla ja yöllä (updateBadDemo yön haarassa). */
        badDemoTimer = (chaosFlags.badDemo && !BAD_DEMO_OFF) ? BAD_DEMO_DELAY : -1;
        badDemoDone = false;
        /* Päivä/yö on tallennettu tila (state.isDay):
             null  = ei vielä ratkaistu → 3 avainta nostaa päivän kerran
             true  = päivä, false = yö (makuuhuoneen Nuku-valinta)
           Valmiiksi läpäisty peli avautuu siis suoraan päivänä (käytös),
           mutta nukkumalla tilan voi vaihtaa ja valinta pysyy tallessa. */
        if (state.isDay == null && !DAY_FORCE && allKeysCollected()) {
            state.isDay = true;
            GameState.save(state);
        }
        dayNight.isDay = (state.isDay === true);
        dayNight.t = dayTarget();
        /* Kuun paikka palautetaan tallennuksesta: F5/reload ei palauta
           kuuta lähtöasemaan. Nollatila syntyy vain kun tallennus on tyhjä
           (kuolema / ✕ "aloita alusta") tai kun uusi yö alkaa Nukusta.
           Testityökalut ?day=0/1 näyttävät kuun lähtöasemasta kuten ennen. */
        applyMoonClock(DAY_FORCE ? 0 : (Number(state.moonClock) || 0));
        applySunClock(DAY_FORCE ? 0 : (Number(state.sunClock) || 0));
        dayNight.spawnLampTimer = freshGame ? SPAWN_LAMP_DELAY : 0;  // 4 s → lamppushow vain uudessa pelissa
        /* Jukebox-soitto palautetaan tallennuksesta: F5 ei katkaise soittoa. */
        if (state.jukeQueue && state.jukeQueue.length > 0 && state.jukePos !== undefined) {
            const urls = [];
            for (let i = 0; i < state.jukeQueue.length; i++) {
                const idx = state.jukeQueue[i];
                if (idx > 0 && idx <= JUKEBOX_TRACKS.length) urls.push(JUKEBOX_TRACKS[idx - 1].url);
            }
            if (urls.length > 0 && StreetAudio.playJukeboxQueue(urls, state.jukePos)) {
                jukeQueue = state.jukeQueue.slice();
                jukeSavedPos = state.jukePos;
            }
        }
        stars = [];
        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: Math.random() * WORLD_W,
                y: Math.random() * (GROUND_Y - 30),
                r: (Math.random() * 1.5 + 0.5) * starSizeMult,
                blink: Math.random() * Math.PI * 2
            });
        }
        initClouds();
        resetStorm();   // BAD-myrsky: sade + ukkonen lähtevät tyynestä (purske alkaa ajastimella)
        initBackdrop();
        initForeground();
        rollManholeState();   // avoin kaivo: 1/6 (tai ?hole=0/1/2)
        rollMoonShadowMults();   // kuunvarjot: per talo ×1…max (BAD/FULL 3)
        setupInput();
        resize();
        lastTime = performance.now();
        loop(lastTime);
        StreetAudio.init();
        updateHUD();

        // Näytä ohjepopup vain tuoreessa/0-tilassa (ensimmäinen lataus tai kuoleman reset)
        if (freshGame) {
            showSpawnHint();
        }
    }

    /* ═══════════════════════════════════════════════════
       SYÖTTEET
       ═══════════════════════════════════════════════════ */
    function clientToWorld(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return { x: 0, y: 0 };
        const x = (clientX - rect.left) / rect.width * canvas.width + camX;
        const y = (clientY - rect.top) / rect.height * canvas.height;
        return { x, y };
    }

    function setupInput() {
        // ⚡ Pakota D-pad näkyviin kaikilla kosketuslaitteilla
        //    (varmempi kuin pelkkä CSS @media, toimii myös HTTPS/Pagesissa)
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            isTouchDevice = true;
            const tr = document.getElementById('touch-row');
            if (tr) tr.classList.add('force-show');
        }

        window.addEventListener('keydown', e => {
            keys[e.key] = true;
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (!actionPressed) actionJustPressed = true;
                actionPressed = true;
            }
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', e => {
            keys[e.key] = false;
            if (e.key === ' ' || e.key === 'Enter') actionPressed = false;
        });

        // Sädease: PC = hiiri (tähtäys + klikkaus), mobiili = täppäys taivaalle
        canvas.addEventListener('mousemove', (e) => {
            const p = clientToWorld(e.clientX, e.clientY);
            aimX = p.x; aimY = p.y; aimActive = true;
        });
        canvas.addEventListener('mousedown', (e) => {
            const p = clientToWorld(e.clientX, e.clientY);
            aimX = p.x; aimY = p.y; aimActive = true;
            fireBeam();
        });
        canvas.addEventListener('touchstart', (e) => {
            if (!e.touches || !e.touches.length) return;
            const t = e.touches[0];
            const p = clientToWorld(t.clientX, t.clientY);
            aimX = p.x; aimY = p.y;
            fireBeam();
            if (e.cancelable) e.preventDefault();
        }, { passive: false });

        const setupBtn = (id, key) => {
            const btn = document.getElementById(id);
            if (!btn) return;

            // Estetään synteettisten mouse-tapahtumien kaksoiskäsittely mobiililla
            let touchActive = false;

            const onDown = (e) => {
                e.preventDefault();
                if (id === 'action-btn' && !actionPressed) actionJustPressed = true;
                if (id === 'action-btn') actionPressed = true;
                keys[key] = true;
            };
            const onUp = (e) => {
                e.preventDefault();
                keys[key] = false;
                if (id === 'action-btn') actionPressed = false;
            };
            const onCancel = () => {
                keys[key] = false;
                if (id === 'action-btn') actionPressed = false;
            };

            // Mobiili: kosketustapahtumat
            btn.addEventListener('touchstart', (e) => {
                touchActive = true;
                onDown(e);
            }, { passive: false });
            btn.addEventListener('touchend', (e) => {
                onUp(e);
                // Viiveellä nollataan, jotta myöhästynyt synteettinen mousedown ei mene läpi
                setTimeout(() => { touchActive = false; }, 400);
            }, { passive: false });
            btn.addEventListener('touchcancel', (e) => {
                onCancel();
                setTimeout(() => { touchActive = false; }, 400);
            }, { passive: false });

            // Työpöytä: hiiritapahtumat (ohitetaan jos touch-aktiivinen)
            btn.addEventListener('mousedown', (e) => {
                if (touchActive) return;
                onDown(e);
            });
            btn.addEventListener('mouseup', (e) => {
                if (touchActive) return;
                onUp(e);
            });
            btn.addEventListener('mouseleave', () => {
                if (touchActive) return;
                onCancel();
            });
        };

        setupBtn('btn-up', 'ArrowUp');
        setupBtn('btn-down', 'ArrowDown');
        setupBtn('btn-left', 'ArrowLeft');
        setupBtn('btn-right', 'ArrowRight');
        setupBtn('action-btn', ' ');
    }

    /* ═══════════════════════════════════════════════════
       PELISILMUKKA
       ═══════════════════════════════════════════════════ */
    function loop(timestamp) {
        animFrameId = requestAnimationFrame(loop);
        const dt = Math.min((timestamp - lastTime) / 16.667, 3);
        lastTime = timestamp;
        updateLitWindows();
        update(dt);
        render();
        actionJustPressed = false;
    }
    let LAMP_RADIUS = 30;   // kaaos K1
/* ═══════════════════════════════════════════════════
       PÄIVITYS
       ═══════════════════════════════════════════════════ */
    /* ── Kamera: seuraa pelaajaa vaakasuunnassa (mobiili) ── */
    function updateCamera() {
        if (viewW >= WORLD_W) { camX = 0; return; }
        const target = Math.max(0, Math.min(WORLD_W - viewW, player.x + player.w / 2 - viewW / 2));
        camX += (target - camX) * CAMERA_LERP;
        if (Math.abs(target - camX) < 0.5) camX = target;
    }

    /* Vaihe 5 osa 7: liikennologiikka siirrettiin street/traffic.js-moduuliin
       (updateTraffic). Tila (vehicles, spawnTimers, player, kertoimet) sidotaan
       gettereillä tuonnempana; kutsut ovat muotoa StreetTraffic.update(dt[, playerSafe]). */

    /* Vaihe 5 osa 8: huoneiden LOGIIKKA (updateSleepRoom,
       updateBarRoom, updateJukeboxRoom) siirrettiin street/rooms.js-moduuliin.
       Huoneiden tila (sleep-, bar- ja juke-muuttujat) sidotaan get+set
       -pareina alempana; kutsut tulevat huonerekisterin kautta (rooms[]). */

    /* Sanomalehti: sivujen selaus; liikenne EI pysähdy → auto voi ajaa yli (lehti putoaa, tainnutus). */
    function updateNewsRoom(dt) {
        // SANOMALEHTI – sivuttain selattava ohjelehti
        //   ▲ / ▼ = edellinen / seuraava sivu (ei kierrä yli)
        //   Space (⚡) = seuraava sivu; viimeisellä sivulla poistuu kadulle
        //   (o) / Enter = poistu heti      ✕-nappi = sulje (closeRoom)
        //   Ilmainen eikä muuta taloutta; nälkä kuluu kuten huoneissa.
        //   LIIKENNE EI PYSÄHDY: auto voi ajaa yli kesken lukemisen
        //   → lehti putoaa kädestä ja pelaaja kaatuu kadulle (tainnutus +
        //   −1 🍔 kuten muutenkin; 0 🍔 = kuolema). Turvassa ovat kaistojen
        //   välinen rako sekä aivan aidan juuri – samat rajat kuin ennen.
        if (newsRoom) {
            if (StreetTraffic.update(dt)) {
                closeNewspaper();          // lehti lentää kädestä
                actionJustPressed = false;
                return true;
            }

            const L = StreetNews.layout();
            const lastIdx = Math.max(0, L.screens.length - 1);
            const selUp = !!(keys['ArrowUp'] || keys['w'] || keys['W']);
            const selDown = !!(keys['ArrowDown'] || keys['s'] || keys['S']);
            if (selUp && !newsHeldUp) StreetNews.prev();
            if (selDown && !newsHeldDown) StreetNews.next();
            newsHeldUp = selUp;
            newsHeldDown = selDown;

            const nextDown = !!keys[' '];
            if (nextDown && !newsSpaceHeld) {
                if (StreetNews.index() < lastIdx) StreetNews.next();
                else closeNewspaper();           // viimeinen sivu → takaisin kadulle
            }
            newsSpaceHeld = nextDown;

            const exitDown = !!(keys['o'] || keys['O'] || keys['Enter']);
            if (exitDown && !newsExitHeld) closeNewspaper();
            newsExitHeld = exitDown;

            actionJustPressed = false;
            return true;
        }
        return false;
    }

    /* Tainnutus: liikenne pysähtyy vain auton kolarista, pudotus knockFallY-tasolle, maailma jäätyy mutta ajastimet/partikkelit/oviukko/meteoriitti pyörivät. */
    function updateKnockedDown(dt) {
        // Tainnutus - kukkaruukku osui
        if (player.knockedDown) {
            // LIIKENNE EI PYSÄHDY: tainnutus jäädyttää kadun, mutta
            // liikenne jatkaa – paitsi jos kaataja oli auto. Vain auton osuma
            // on kolari, johon liikenne on osallisena (`player.knockFallY`
            // asetetaan ainoastaan updateTrafficin törmäyksessä) → silloin
            // liikenne seisoo koko tainnutuksen ajan, kuten ennenkin.
            // Sähkökaappi, rosvo, kukkaruukku, lamppu ja oviukko eivät
            // pysäytä liikennettä. `playerSafe = true`: makaavaan pelaajaan
            // ei tule uutta osumaa (ei toistuvaa 🍔-menetystä).
            if (player.knockFallY === undefined) StreetTraffic.update(dt, true);
            player.knockdownTimer -= dt;
            // Putoamistaso: auton osuma kaataa 25 px ylös osumakohdasta (: 10,
            // 25 px – pysähtynyt auto ei osu heti uudelleen ylösnoustessa);
            // muilla tainnutuslähteillä oletus jalkakäytävän taso (GROUND_Y + 10).
            const fallY = (player.knockFallY !== undefined) ? player.knockFallY : (GROUND_Y + 10);
            player.vx = 0; player.vy += GRAVITY * dt; player.y += player.vy * dt;
            if (player.y + player.h >= fallY) { player.y = fallY - player.h; player.vy = 0; }
            if (player.knockdownTimer <= 0) { player.knockedDown = false; player.knockdownTimer = 0; player.knockFallY = undefined; }
            if (player.kicking) { player.kickFrame += dt; if (player.kickFrame >= KICK_DURATION) { player.kicking = false; player.kickFrame = 0; } }
            for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx; p.y += p.vy; p.life--; if (p.life <= 0) particles.splice(i, 1); }
            coin.sparkle += 0.05 * dt;
            if (firstHouseWindowsLit && firstHouseWindowTimer > 0) { firstHouseWindowTimer -= dt; if (firstHouseWindowTimer <= 0) { firstHouseWindowsLit = false; firstHouseKickCount = 0; firstHouseKickTarget = 0; } }
            for (const idx in smallHouseLights) { const sh = smallHouseLights[idx]; if (sh.lit && sh.timer > 0) { sh.timer -= dt; if (sh.timer <= 0) { sh.lit = false; sh.timer = 0; } } }
            updateAvenger(dt);   // oviukko: paluu ovelle jatkuu tainnutuksen aikana
            for (let i = 0; i < lamps.length; i++) { if (lamps[i].overheatTimer > 0) { lamps[i].overheatTimer -= dt; if (lamps[i].overheatTimer <= 0) { lamps[i].overheatTimer = 0; lamps[i].overheat = false; lamps[i].kickCount = 0; } } }
            updateShootingStar(dt);
            updateSatellite(dt);
            actionJustPressed = false;
            return true;
        }
        return false;
    }

    /* Savukiekurat tuhoutuneista taloista: nousevat ja hiipuvat, vain BAD/FULL. */
    function updateBuildingSmoke(dt) {
        // ── Savukiekurat tuhoutuneista taloista (siirretty tänne) ──
        if (chaosFlags.ruin) {
            for (const key in buildingDmg) {
                if (buildingDmg[key] !== 'gone') continue;
                const idx = Number(key);
                const r = buildingRubble[idx];
                if (!r || !r.smokeTimer || !r.smokes) continue;   // vain ~1/3:lla savu päällä
                const b = buildings[idx];
                if (!b) continue;
                r.smokeTimer -= dt;
                if (r.smokeTimer <= 0) {
                    const count = 1 + Math.floor(Math.random() * 3);
                    const cx = b.x + b.w / 2;
                    for (let i = 0; i < count; i++) {
                        r.smokeParticles.push({
                            x: cx + (Math.random() - 0.5) * r.w * 0.6,
                            y: GROUND_Y - r.h - Math.random() * 4,
                            vx: (Math.random() - 0.5) * 0.084,   // 0.12 * 0.7 (30 % hitaampi)
                            vy: (-0.08 - Math.random() * 0.12) * 0.7,   // 30 % hitaampi
                            r: 1.5 + Math.random() * 2,   // pienempi: 1.5–3.5 px (oli 3–7)
                            alpha: 0.06 + Math.random() * 0.08,   // läpinäkyvämpi: 0.06–0.14 (alkuperäinen 0.12–0.20)
                            life: 90 + Math.random() * 90,
                            maxH: r.bldgH * 0.33
                        });
                    }
                    r.smokeTimer = 200 + Math.random() * 200;
                }
                const particles = r.smokeParticles;
                for (let i = particles.length - 1; i >= 0; i--) {
                    const p = particles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.r += 0.008 * dt;   // laajenee noustessa (hitaammin, koska pienempiä)
                    p.life -= dt;
                    p.alpha *= 0.998;
                    const startY = GROUND_Y - r.h;
                    if (p.life <= 0 || p.alpha < 0.01 || (startY - p.y) > p.maxH) {
                        particles.splice(i, 1);
                    }
                }
            }
        }
    }

    /* Päivä/yö: ensiauringonnousu (3 avainta), liuku kohti tavoitetta (pysähtyy huoneissa/iframessa), yön lamppushown viritys ja päivän lamppusammutus. */
    function updateDayNight(dt) {
        // ── Päivä/yö: liuku kohti tallennettua tavoitetta ──
        // Ensiauringonnousu (käytös): kun kaikki 3 avainta on koossa eikä
        // tilaa ole vielä ratkaistu, kadulle nousee päivä kerran. Sen jälkeen
        // tila on tallennettu (state.isDay) ja makuuhuoneen Nuku-valinta
        // vaihtaa sitä vapaasti (päivä ⇄ yö).
        if (state.isDay == null && !DAY_FORCE && allKeysCollected()) {
            state.isDay = true;
            dayNight.isDay = true;
            GameState.save(state);
        }
        // Liuku pysäytetään, kunnes pelaaja on taas kadulla: avain saadaan
        // alapelistä (iframe) ja huoneista → muutos näkyy kadulle palatessa
        // eikä jää taustalla näkymättömiin (myös lehteä lukiessa).
        const dayWanted = dayTarget();
        if (dayNight.t !== dayWanted && !iframeOpen && !sleepRoom && !barRoom &&
            !jukeboxRoom && !newsRoom) {
            const fadeFrames = (dayWanted > dayNight.t) ? DAY_FADE_FRAMES : NIGHT_FADE_FRAMES;
            const step = DAY_DEBUG ? 1 : dt / fadeFrames;
            if (dayWanted > dayNight.t) {
                const wasNight = dayNight.t === 0;
                dayNight.t = Math.min(1, dayNight.t + step);
                if (wasNight) { shootingStar = null; satellite = null; }
            } else {
                dayNight.t = Math.max(0, dayNight.t - step);
            }
            if (Math.abs(dayWanted - dayNight.t) < step) dayNight.t = dayWanted;  // ei jää värähtelyä
        }

        // Päivänvalo on näkynyt tässä istunnossa → yön lamppushow saa laueta
        // . Näin efekti ei laukea pelkästä sivunlatauksesta yöllä.
        if (dayNight.t > 0) dayNight.nightShowArmed = true;

        // ── Päivä sammuttaa katuvalot kerran ──
        // Kynnys on täysi päivä (dayNight.t === 1): hehku on siihen mennessä jo
        // hiipunut LAMP_DAY_DIM:iin, joten sammutus ei poksahda silmään.
        // Lippu nollautuu vasta kun yö on palannut → kerran per auringonnousu.
        // Lampun voi silti potkaista päälle myös päivällä (lit = true).
        if (dayNight.t === 1) {
            if (!dayNight.dayLampsOff) {
                dayNight.dayLampsOff = true;
                let anyLit = false;
                for (let i = 0; i < lamps.length; i++) {
                    if (lamps[i].lit) {
                        lamps[i].lit = false;
                        state.litLamps[i] = false;
                        anyLit = true;
                    }
                }
                if (anyLit) GameState.save(state);
            }
        } else if (dayNight.t === 0) {
            dayNight.dayLampsOff = false;
            // Yö laskeutui täyteen → katuvalot syttyvät itsestään yksi
            // kerrallaan, mutta vain kun pelaaja on jo edennyt
            // (päivä/yö ratkaistu). Uudessa pelissä valot potkitaan yhä itse.
            if (dayNight.nightShowArmed && nightLampsAllowed()) {
                dayNight.nightShowArmed = false;
                startNightLampShow();
            }
            // Näytös etenee vain kadulla: huoneet ja iframet pysäyttävät
            // ajastimen (kuten päivän liukukin), ja tila tallennetaan per
            // lamppu, jotta reload kesken shown ei hukkaa jo syttyneitä.
            // HUOM: kickCount ei kasva → cheatit ja ylikuumeneminen ennallaan.
            if (dayNight.nightShowQueue.length && !iframeOpen && !sleepRoom && !barRoom &&
                !jukeboxRoom && !playerDead) {
                dayNight.nightShowTimer -= dt;
                if (dayNight.nightShowTimer <= 0) {
                    const i = dayNight.nightShowQueue.shift();
                    lamps[i].lit = true;
                    state.litLamps[i] = true;
                    GameState.save(state);
                    spawnParticles(lamps[i].x, GROUND_Y + 19 - LAMP_POST_H, '#ffff88', 8);
                    playLampOn();
                    dayNight.nightShowTimer = NIGHT_LAMP_INTERVAL;
                }
            }
        }
    }

    /* Spawn-lamppushow: pelin alussa/kuoleman jälkeen 4 s → lamput syttyvät yksi kerrallaan. */
    function updateSpawnLampShow(dt) {
        // ── Spawn-lamppushow: pelin alussa/kuoleman jälkeen 4 s → lamput syttyvät ──
        // Käyttää samaa startNightLampShow()-mekaniikkaa kuin yön tullessa.
        if (dayNight.spawnLampTimer > 0 && !dayNight.isDay && !playerDead && !iframeOpen && !sleepRoom && !barRoom && !jukeboxRoom) {
            dayNight.spawnLampTimer -= dt;
            if (dayNight.spawnLampTimer <= 0) {
                startNightLampShow();                    // sytytä lamput yksi kerrallaan
            }
        }
    }

    /* Jukebox-soiton tallennus: seuraa positiota ja päivittää tilan F5:n yli. */
    function updateJukeboxPersistence(dt) {
        // ── Jukebox-soiton tallennus: seuraa positiota ja päivitä state F5:n yli ──
        if (StreetAudio.isJukeboxPlaying()) {
            const qPos = StreetAudio.getJukeboxQueuePos();
            if (qPos !== jukeSavedPos && qPos >= 0) {
                jukeSavedPos = qPos;
                state.jukePos = qPos;
                state.jukeQueue = jukeQueue.slice();
                GameState.save(state);
            }
        } else if (state.jukeQueue && state.jukeQueue.length > 0 && !iframeOpen && !sleepRoom && !barRoom && !jukeboxRoom && !newsRoom) {
            // Soitto loppui, tyhjennä tallennettu tila
            state.jukeQueue = [];
            state.jukePos = 0;
            GameState.save(state);
            jukeSavedPos = -1;
        }
    }

    /* Yö/päivä-kierto: kuu/aurinko liikkuu, CYCLE_CHANGE_DELAY_FRAMES odotus ja automaattinen vaihto; kellot tallennetaan ~2 s välein. */
    function updateDayCycle(dt) {
        // ── Yö/päivä -kierto: kuu liukuu yöllä, aurinko päivällä ──
        // Kun kuu/aurinko on kadonnut, odotetaan CYCLE_CHANGE_DELAY_FRAMES
        // (15 s) ja vaihdetaan automaattisesti seuraavaan vuorokaudenaikaan.
        // Kellot tallennetaan ~2 s välein, jotta F5 jatkaa samasta kohdasta.
        if (!dayNight.isDay) {
            if (dayNight.moonNightClock < MOON_NIGHT_FRAMES) {
                applyMoonClock(dayNight.moonNightClock + dt);
                if (dayNight.moonNightClock >= MOON_NIGHT_FRAMES) {
                    dayNight.cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES;  // aloita 15 s viive
                }
            } else {
                applyMoonClock(MOON_NIGHT_FRAMES);      // pysyy päätepisteessä
                dayNight.cycleChangeTimer = Math.max(0, dayNight.cycleChangeTimer - dt);
                if (dayNight.cycleChangeTimer <= 0) {
                    dayNight.isDay = true;
                    state.isDay = true;
                    GameState.save(state);
                    resetSun();
                    dayNight.cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES + 1;  // nollaa tila
                }
            }
            dayNight.moonSaveTimer += dt;
            if (dayNight.moonSaveTimer >= MOON_SAVE_FRAMES) {
                dayNight.moonSaveTimer = 0;
                saveMoonClock();
            }
        } else {
            dayNight.moonDark = 0;
            if (dayNight.sunDayClock < SUN_DAY_FRAMES) {
                applySunClock(dayNight.sunDayClock + dt);
                if (dayNight.sunDayClock >= SUN_DAY_FRAMES) {
                    dayNight.cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES;  // aloita 15 s viive
                }
            } else {
                applySunClock(SUN_DAY_FRAMES);          // pysyy päätepisteessä
                dayNight.cycleChangeTimer = Math.max(0, dayNight.cycleChangeTimer - dt);
                if (dayNight.cycleChangeTimer <= 0) {
                    dayNight.isDay = false;
                    state.isDay = false;
                    GameState.save(state);
                    resetMoon();
                    resetSun();
                    dayNight.cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES + 1;  // nollaa tila
                }
            }
            dayNight.sunSaveTimer += dt;
            if (dayNight.sunSaveTimer >= SUN_SAVE_FRAMES) {
                dayNight.sunSaveTimer = 0;
                saveSunClock();
            }
        }
    }

    /* Kuolemasekvenssi: pimennys etenee, sitten GameState.reset() + reload. true = kuolema vei vuoron. */
    function updateDeathSequence(dt) {
        // ── Kuolemasekvenssi ─────────────────────────
        if (playerDead) {
            deathTimer -= dt;
            deathAlpha = Math.min(1, 1 - (deathTimer / 180));
            if (deathTimer <= 0) {
                clearChaosSession();   // kuolema vie takaisin alkuhubiin (kuten ennen)
                GameState.reset();
                location.reload();
            }
            return true;
        }
        return false;
    }

    /* Nälkä (1/60 s): kulutus jatkuu kaikkialla paitsi nukkuessa; 0 🍔 → killPlayer + ulos piilosta. true = nälkäkuolema vei vuoron. */
    function updateHunger(dt) {
        // ── Nälkä (hampurilaisajastin, 1/60s) ────────────────────────
        // Kulutus jatkuu kaikkialla kuten kadulla: myös BAR:ssa,
        // jukeboxissa ja iframe-peleissä → pelaajan pitää aina huolehtia,
        // että 🍔 riittää. Jäissä vain nukkuessa (hungerOnHold)
        // ja kuolleena (yllä oleva return).
        // Nälkäkuolema laukeaa myös huoneessa/pelissä: huone tai
        // alapeli suljetaan ensin, jotta pelaaja romahtaa näkyvästi kadulle
        // eikä peli näytä nollautuvan kesken pelaamisen.
        // Tahti (burgerInterval, kaaos K4) ja katto 10.
        if (!hungerOnHold()) {
            /* FULL: JOS olutta on, se kuluu ensin (humala haihtuu,
               🍔 säilyy). Vasta kun 🍺 = 0, klassinen 🍔-nälkä palaa. */
            let burgerHungerActive = true;
            if (chaosFlags.drunk && drunkLevel > 0) {
                burgerHungerActive = false;
                drunkTimer -= dt;
                if (drunkTimer <= 0) {
                    drunkLevel--;
                    drunkTimer = burgerInterval;
                    saveChaosSession();   // F5 ei hukkaa humalaa
                    updateHUD();
                }
            }
            if (burgerHungerActive) {
                if (hamburgerCount > 0) {
                    hamburgerTimer -= dt;
                    if (hamburgerTimer <= 0) {
                        hamburgerCount--;
                        state.inventory.hamburgerCount = hamburgerCount;
                        GameState.save(state);
                        updateHUD();
                        hamburgerTimer = hamburgerCount > 0 ? burgerInterval : 0;
                    }
                }
                if (hamburgerCount <= 0) {              // 0 🍔 → kuolema
                    killPlayer();                       // kuolinsekvenssi alkaa heti
                    if (insideHiddenState()) leaveHiddenStateForDeath();
                    return true;
                }
            }
        }
        return false;
    }

    /* Paluu kadulle -vahti: viemärinkannen tila voi muuttua huoneesta palatessa; rosvon ttl kuluu myös piilossa. */
    function updateHiddenTracking(dt) {
        // ── Paluu kadulle -vahti: huone tai alapeli sulkeutui →
        //    1/10 mahdollisuus, että viemärinkannen tilanne muuttuu
        //    (kansi katoaa tai asennetaan takaisin paikalleen).
        trackHiddenStreet();

        // rosvon elinikä kuluu myös piilossa (huone/alapeli), jotta
        // "piiloudu ja odota" -pakoreitti toimii kaikilla kaaostasoilla.
        if (robber && (iframeOpen || sleepRoom || barRoom || jukeboxRoom || newsRoom)) {
            if (robber.ttl !== undefined) {
                robber.ttl -= dt;
                if (robber.ttl <= 0) robber = null;
            }
        }
    }

    /* Kaivosarja käynnissä: katu on jäissä, liikenne jatkaa taustalla, pelaaja ei ota osumia. true = sekvenssi vei vuoron. */
    function updateManholeSequence(dt) {
        // ── Avoin kaivo: pudotus / ylöskiipeäminen käynnissä ──
        // Katu on jäissä sekvenssin ajan (kuten nukkumisen pimennys).
        // LIIKENNE EI PYSÄHDY: sama periaate kuin jukebox-huoneessa
        // autot ajavat taustalla, jotta yksikään ajoneuvo ei jää
        // jyrräämään paikalleen (moottoriäänen panorointi seuraa v.x:ää).
        // Pelaaja on reiässä (kadun ulkopuolella) → playerSafe = true:
        // ei törmäystä, ei tainnutusta eikä 🍔-menetystä kesken sekvenssin.
        if (manhole.action) { StreetTraffic.update(dt, true); updateManholeAction(dt); return true; }
        return false;
    }

    /* Liike: 🍔/kaaos-vauhti, vaaka- ja pystyliike, humalan horjunta ja hallitsemattomat askeleet, lampputolppien estoblokki, kamera ja kävely-/potkuanimaatio. */
    function updateMovement(dt) {
        // ── Liike ──────────────────────────────────
        /* Vauhti riippuu 🍔-määrästä (hungerSpeedMult) ja kaaos-kävelynopeudesta
           (playerSpeedMult, K4): chaosAbility() = molemmat kerrointa. PLAYER_SPEED
           (1.225) on normitaso. NORMALissa playerSpeedMult = 1 → muutos on no-op. */
        const speedMult = chaosAbility();
        StreetAudio.setHungerTempo(hungerSpeedMult());   // syntikkatempo pysyy 🍔-sidonnaisena
        const moveSpeed = PLAYER_SPEED * speedMult;
        let moveX = 0;
        if (keys['ArrowLeft'] || keys['a'] || keys['A'])  moveX = -1;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) moveX = 1;
        player.vx = moveX * moveSpeed;

        // Vertikaalinen liike ylös/alas (ei hyppyä, ei painovoimaa)
        const PLAYER_Y_MIN = GROUND_Y - player.h;            // 280 = yläraja (maksimoitu liikealue)
        const PLAYER_Y_MAX = WORLD_H - 50;                     // 350 = aidan yläreuna, pelaaja aidan takana
        let moveY = 0;
        if (keys['ArrowUp'] || keys['w'] || keys['W'])     moveY = -1;
        if (keys['ArrowDown'] || keys['s'] || keys['S'])   moveY = 1;
        player.y += moveY * moveSpeed * dt;
        player.y = Math.max(PLAYER_Y_MIN, Math.min(PLAYER_Y_MAX, player.y));
        player.lookY = moveY;   // katseen suunta piirtoa varten (−1 ylös, +1 alas)
        player.vy = 0;

        player.x += player.vx * dt;

        const wobble = chaosFlags.drunk ? drunkWobble() : staggerAmount;
        const moving = (moveX !== 0 || moveY !== 0);
        if (wobble > 0 && moving) {
            const t = Date.now() * 0.001;
            player.x += Math.sin(t * 2.1) * wobble * 0.6 * dt;
            player.y += Math.sin(t * 1.5 + 0.8) * wobble * 0.45 * dt;
            player.y = Math.max(PLAYER_Y_MIN, Math.min(PLAYER_Y_MAX, player.y));
        }
        /* humalainen (≥ DRUNK_IDLE_WOBBLE_MIN 🍺) ottaa PAIKALLAAN
           HALLITSEMATTOMIA askeleita suuntaan tai toiseen – myös ilman
           ohjausta. Pituus ja tahti kasvavat humalan mukana. Askel LIPUU
           pehmeästi DRUNK_STEP_FRAMES framen yli (ei nykäystä). */
        if (chaosFlags.drunk && !moving && drunkLevel >= DRUNK_IDLE_WOBBLE_MIN) {
            drunkStepTimer -= dt;
            if (drunkStepTimer <= 0) {
                const strong = (drunkLevel - DRUNK_IDLE_WOBBLE_MIN) / (DRUNK_MAX - DRUNK_IDLE_WOBBLE_MIN);
                const stepPx = DRUNK_STEP_PX * (0.7 + 0.6 * strong);
                const dir = (Math.random() < 0.5) ? -1 : 1;
                drunkLurchX += dir * stepPx;
                drunkLurchY += (Math.random() - 0.5) * stepPx * 0.7;
                drunkLurchFrames = DRUNK_STEP_FRAMES;
                drunkStepTimer = DRUNK_STEP_MIN + Math.random() * (DRUNK_STEP_MAX - DRUNK_STEP_MIN);
            }
        }
        // Pehmeä liuku: jaetaan askeleen siirtymä jäljellä oleville frameille
        if (drunkLurchFrames > 0) {
            const ax = drunkLurchX / drunkLurchFrames;
            const ay = drunkLurchY / drunkLurchFrames;
            player.x += ax;
            player.y += ay;
            drunkLurchX -= ax;
            drunkLurchY -= ay;
            drunkLurchFrames--;
            if (drunkLurchFrames <= 0) { drunkLurchX = 0; drunkLurchY = 0; }
            player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x));
            player.y = Math.max(PLAYER_Y_MIN, Math.min(PLAYER_Y_MAX, player.y));
        }

        // Estä pelaajaa kävelemästä lampputolppien läpi
        // Lamppu on kadun puolella → pelaaja kiertää joko ALHAALTA (edestä) tai YLHÄÄLTÄ (takaa)
        const LAMP_BLOCK_X = 15;
        const LAMP_PASS_FRONT_Y = GROUND_Y;       // 310 – center alle = edestä ohi
        const LAMP_PASS_BEHIND_Y = 286;            // player.y ≤ 286 = takaa ohi (rakennusten juuressa)
        for (const lamp of lamps) {
            const cx = player.x + player.w / 2;
            const cy = player.y + player.h / 2;
            const dx = cx - lamp.x;
            if (cy < LAMP_PASS_FRONT_Y && player.y > LAMP_PASS_BEHIND_Y && Math.abs(dx) < LAMP_BLOCK_X) {
                if (dx < 0) {
                    player.x = lamp.x - LAMP_BLOCK_X - player.w / 2;
                } else {
                    player.x = lamp.x + LAMP_BLOCK_X - player.w / 2;
                }
            }
        }

        player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x));

        updateCamera();

        const onGround = true;  // pelaaja on aina pinnalla (ei hyppyjä)

        // Päivitä kävelyanimaatio
        if (moveX !== 0) {
            player.facing = moveX;
            player.walking = true;
            // Askel- ja animaatiotahti kulkee vauhdin mukana → jalat eivät liu'u
            player.walkTimer += dt * speedMult;
            if (player.walkTimer > 8) {
                player.walkFrame = (player.walkFrame + 1) % 4;
                player.walkTimer = 0;
                if (onGround) playWalk();
            }
        } else {
            player.walking = false;
            player.walkFrame = 0;
            player.walkTimer = 0;
        }

        // Potku-animaatio
        if (player.kicking) {
            player.kickFrame += dt;
            if (player.kickFrame >= KICK_DURATION) {
                player.kicking = false;
                player.kickFrame = 0;
            }
        }
    }

    /* Kadun kolikon keräys: osuessa saldo +1, tallennus ja pling. */
    function updateCoinPickup(dt) {
        // ── Kolikon keräys ──────────────────────────
        if (!coin.collected) {
            const dx = (player.x + player.w/2) - coin.x;
            const dy = (player.y + player.h) - coin.y;    // jalkojen alin piste, ei keskikohta
            if (Math.sqrt(dx*dx + dy*dy) < 8) {           // tarkka osuma – ei enää kaukaa nappausta
                const cx = coin.x, cy = coin.y;
                coinCount++;
                state.inventory.coin = true;
                state.inventory.coinCount = coinCount;
                GameState.save(state);
                coin.collected = true; coin.x = -100; coin.y = -100;
                playCoin();
                coin.respawnTimer = COIN_RESPAWN_FRAMES;  // 120s @ 60fps (kaaos: väli)
                spawnParticles(cx, cy, '#ffd700', 12);
                updateHUD();
            }
        }
    }

    /* Sädeaseen poiminta: FULL-aseen nosto kadulta, kun jalkapiste osuu esineeseen. */
    function updateBeamPickup(dt) {
        // ── Sädeaseen poiminta ──────────────
        if (beamPickup) {
            const dx = (player.x + player.w/2) - beamPickup.x;
            const dy = (player.y + player.h) - beamPickup.y;
            if (Math.sqrt(dx*dx + dy*dy) < 10) {
                beamWeaponCollected = true;
                state.beamWeaponCollected = true;
                GameState.save(state);
                spawnParticles(beamPickup.x, beamPickup.y, '#bcd7ff', 14);
                playCoin();
                showNotification('Ray gun. Shoot the meteorites!');
                beamPickup = null;
                updateHUD();
            }
        }
    }

    /* Kolikon ajastimet: respawn 120 s, katoaminen 10 s ja cooldown (kaaos K5 voi muuttaa tahtia). */
    function updateCoinTimers(dt) {
        // ── Kolikon respawn (120s välein) ──────
        if (coin.collected && coin.respawnTimer > 0) {
            coin.respawnTimer -= dt;
            if (coin.respawnTimer <= 0) {
                coin.collected = false;
                coin.x = randomCoinX(); coin.y = randomCoinY();
                coin.despawnTimer = 600;  // 10s katoamisajastin
                coin.respawnTimer = 0;
            }
        }

        // ── Kolikon katoaminen (10s) ──────
        if (!coin.collected && coin.despawnTimer > 0) {
            coin.despawnTimer -= dt;
            if (coin.despawnTimer <= 0) {
                coin.x = -100; coin.y = -100;        // piilota
                coin.despawnTimer = 0;
                coin.despawnCooldown = 1800;          // 30s tauko ennen uutta
            }
        }

        // ── Kolikon cooldown katoamisen jälkeen ──────
        if (!coin.collected && coin.despawnCooldown > 0) {
            coin.despawnCooldown -= dt;
            if (coin.despawnCooldown <= 0) {
                coin.x = randomCoinX(); coin.y = randomCoinY();
                coin.despawnTimer = 600;  // uusi 10s
            }
        }
    }

    /* Avoin kaivo: astuminen reiän päälle laukaisee putoamisen (reunaehtoinen). true = putoaminen alkoi. */
    function updateManholeStep(dt) {
        // ── Avoin kaivo: astuminen reiän päälle ─────────────
        // Reunaehtoinen: putoaminen laukeaa vain kun jalkapiste siirtyy
        // ellipsin sisään. Jos kansi katoaa jalkojen alta (paluu huoneesta),
        // putoaminen ei laukea ennen kuin pelaaja astuu pois ja takaisin.
        if (manhole.open != null && !iframeOpen && !player.knockedDown) {
            const inside = manholeHit(manhole.open);
            if (inside && !manhole.inside[manhole.open]) {
                startManholeFall(manhole.open);
                return true;
            }
            manhole.inside[manhole.open] = inside;
        }
        return false;
    }

    /* Sähkökaapit: tilakello arpoo päälle/pois omalla tahdilla (?cabs jäädyttää) ja päällä oleva kaappi antaa sähköiskun (tainnutus + −1 🍔 / FULL −1 🪙). */
    function updateElectricCabinets(dt) {
        // ── Sähkökaapit: tilakello ────────────────
        // Kaappi voi sammua tai käynnistyä itsestään: jokaisella on oma
        // satunnainen väli (CAB_REROLL_MIN..MAX frameä), jonka jälkeen tila
        // arvotaan uudelleen (~50 % päällä). Vilkkuva valo kertoo tilan.
        // Testityökalu ?cabs=0/1 jäädyttää tilan.
        if (CAB_FORCE === null) {
            for (const cab of electricCabinets) {
                cab.timer -= dt;
                if (cab.timer > 0) continue;
                cab.on = Math.random() < ELECTRIC_CABINET_ON;
                cab.timer = cabRerollTimer();
            }
        }

        // ── Sähkökaapit: sähköisku ─────────────────
        for (const cab of electricCabinets) {
            if (cab.bldgIdx !== undefined && buildingGone(cab.bldgIdx)) continue;   // kaappi katosi talon mukana
            if (!cab.on) continue;           // sammuksissa oleva kaappi ei iske
            if (player.knockedDown) break;   // isku jo saatu – ei toista kaappia samalla kertaa
            // Vaakasuunnassa laatikon sisällä, pystysuunnassa pää kaapin
            // yläreunan yläpuolella (seinää vasten) → ei osumaa alhaalta.
            if (player.x < cab.x + cab.w && player.x + player.w > cab.x &&
                player.y < cab.y && player.y + player.h > cab.y) {
                player.knockedDown = true;
                player.knockdownTimer = 600;
                player.kicking = false;
                player.kickFrame = 0;
                // Sähköisku viskaa pelaajan taaksepäin (estää heti uudelleen osumisen)
                const ccx = cab.x + cab.w / 2;
                const pushDir = (player.x + player.w / 2) < ccx ? -1 : 1;
                player.x = Math.max(0, Math.min(WORLD_W - player.w, player.x + pushDir * 30));
                spawnParticles(ccx, cab.y + cab.h / 2, '#ffe066', 16);
                playZap();
                collisionCost();   // FULL → −1 🪙, muuten −1 🍔
            }
        }
    }

    /* Partikkelit: liike ja elinikä. */
    function updateParticles(dt) {
        // ── Partikkelit ─────────────────────────────
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    /* Kadun ajastimet: lamppujen ylikuumeneminen, kolikon kimaltelu, talon 0 ikkuna-ajastin ja pienten talojen valoajastin. */
    function updateStreetTimers(dt) {
        // ── Lamppujen ylikuumenemisajastin ─────────
        for (let i = 0; i < lamps.length; i++) {
            if (lamps[i].overheatTimer > 0) {
                lamps[i].overheatTimer -= dt;
                if (lamps[i].overheatTimer <= 0) {
                    lamps[i].overheatTimer = 0;
                    lamps[i].overheat = false;
                    lamps[i].kickCount = 0;
                }
            }
        }

        // ── Notifikaatio ─────────────────────────────
        // (hoidetaan nyt setTimeoutilla showNotification-funktiossa)
        coin.sparkle += 0.05 * dt;

        // ── Talon 0 ikkunoiden ajastin (20s ilman potkua → sammuu) ──
        if (firstHouseWindowsLit && firstHouseWindowTimer > 0) {
            firstHouseWindowTimer -= dt;
            if (firstHouseWindowTimer <= 0) {
                firstHouseWindowsLit = false;
                firstHouseKickCount = 0;
                firstHouseKickTarget = 0;
            }
        }

        // ── Pienten talojen valoajastin ────────────────
        for (const idx in smallHouseLights) {
            const sh = smallHouseLights[idx];
            if (sh.lit && sh.timer > 0) { sh.timer -= dt; if (sh.timer <= 0) { sh.lit = false; sh.timer = 0; } }
        }
    }

    /* Kukkaruukun fysiikka: putoaa ja osuu pelaajaan → tainnutus + −1 🍔. */
    function updatePot(dt) {
        // ── Kukkaruukun fysiikka ──────────────────────
        if (flowerPot && flowerPot.active) {
            flowerPot.vy += 0.12 * dt; flowerPot.x += flowerPot.vx * dt; flowerPot.y += flowerPot.vy * dt; flowerPot.rotation += 0.08 * dt;
            const fpx = flowerPot.x, fpy = flowerPot.y, ppx = player.x + player.w/2, ppy = player.y;
            if (Math.sqrt((fpx-ppx)*(fpx-ppx)+(fpy-ppy)*(fpy-ppy)) < 20) {
                if (!player.knockedDown) {
                    player.knockedDown = true; player.knockdownTimer = 600; player.kicking = false; player.kickFrame = 0;
                    collisionCost();   // FULL → −1 🪙, muuten −1 🍔
                }
                spawnParticles(ppx, ppy, '#ff6644', 15); flowerPot = null;
            } else if (flowerPot.y > GROUND_Y + 20 || flowerPot.x < -30 || flowerPot.x > WORLD_W + 30) {
                if (flowerPot.y > GROUND_Y) spawnParticles(flowerPot.x, GROUND_Y, '#8B4513', 5);
                flowerPot = null;
            }
        }
    }

    /* Potkusta pudonnut kolikko: fysiikka, poiminta ja salaisen kolikkopalkkion (cheat) putken vanheneminen. */
    function updateKickCoin(dt) {
        // ── Potkusta pudonneen kolikon fysiikka ──────
        if (kickCoinCooldown > 0) kickCoinCooldown -= dt;
        // Salainen kolikkopalkkio: putken vanheneminen + cooldown
        if (coinCheat.gapTimer > 0) { coinCheat.gapTimer -= dt; if (coinCheat.gapTimer <= 0) { coinCheat.gapTimer = 0; coinCheat.streak = 0; } }
        if (coinCheat.cooldown > 0) { coinCheat.cooldown -= dt; if (coinCheat.cooldown < 0) coinCheat.cooldown = 0; }
        if (kickCoin) {
            if (!kickCoin.landed) {
                kickCoin.vy += 0.12 * dt;
                kickCoin.y += kickCoin.vy * dt;
                if (kickCoin.y >= GROUND_Y + 10) {
                    kickCoin.y = GROUND_Y + 10;
                    kickCoin.landed = true;
                    spawnParticles(kickCoin.x, kickCoin.y, '#ffd700', 6);
                }
            } else {
                kickCoin.ttl -= dt;
                if (kickCoin.ttl <= 0) kickCoin = null;
            }
            if (kickCoin) {
                const kpx = kickCoin.x, kpy = kickCoin.y;
                const ppx = player.x + player.w / 2, ppy = player.y + player.h / 2;
                if (Math.sqrt((kpx - ppx) * (kpx - ppx) + (kpy - ppy) * (kpy - ppy)) < 30) {
                    coinCount++;
                    state.inventory.coin = true;
                    state.inventory.coinCount = coinCount;
                    GameState.save(state);
                    playCoin();
                    spawnParticles(kpx, kpy, '#ffd700', 12);
                    updateHUD();
                    kickCoin = null;
                }
            }
        }
    }

    /* Vastustajat: oviukon cooldown + liike, rosvon cooldown + jahtaus ja K7-korttipakan kesto. */
    function updateEnemies(dt) {
        // ── Oviukko (Avenger) ────────────────────────
        if (avengerCooldown > 0) avengerCooldown -= dt;
        updateAvenger(dt);

        // ── Rosvo: yllätys + kiinniotto ──
        if (robberCooldown > 0) robberCooldown -= dt;
        if (robberGraceTimer > 0) robberGraceTimer -= dt;   // 60 s aloitusrauha kuluu
        updateRobber(dt);

        // ── K7-korttipakka: laukaisee/palauttaa visuaaliset kortit ──
        StreetChaosCards.update(dt);
    }

    /* Katueläin: spawnaus, liike ja poistuminen (vain NORMAL/ei-kaaos-raunioissa). */
    function updateAnimal(dt) {
        // ── Katueläin ────────────────────────────────
        if (!groundAnimal) {
            if (!chaosAllGone()) {   // BAD/FULL rauniot – ei eläimiä kadulla
                animalSpawnTimer -= dt;
                if (animalSpawnTimer <= 0) {
                    const types = animalTypeWeights || ['mouse','mouse','rat','rat','rabbit']; const type = types[Math.floor(Math.random()*types.length)];
                    const dir = (Math.random() < animalDirBias) ? 1 : -1;
                    // Satunnainen juoksukorkeus: aidan juuresta (335) nykyiseen ylälaitaan (307, ei ihan seinään)
                    const baseY = GROUND_Y - 3 + Math.random() * (GROUND_Y + 25 - (GROUND_Y - 3));
                    let w,h,speed;
                    if (type==='mouse') { w=8; h=4; speed=(1.8+Math.random()*1.2)*animalSpeedMult; }
                    else if (type==='rat') { w=14; h=6; speed=(1.2+Math.random()*0.8)*animalSpeedMult; }
                    else { w=10; h=10; speed=(1.5+Math.random()*0.8)*animalSpeedMult; }
                    groundAnimal = { type,w,h,x:dir>0?-w:WORLD_W+w,y:baseY-h,vx:dir*speed,direction:dir,hopY:0,hopVel:0,animTimer:0,pauseTimer:0 };
                    if (StreetChaosCards.animalParade > 0) { StreetChaosCards.consumeAnimalParade(); animalSpawnTimer = 60; }
                    else animalSpawnTimer = 900;
                }
            }
        } else {
            const a = groundAnimal;
            if (!(a.type==='rabbit'&&a.pauseTimer>0)) { a.x += a.vx * dt; a.animTimer += dt; }
            if (a.type === 'rabbit') {
                if (a.pauseTimer > 0) { a.pauseTimer -= dt; a.vx = 0; if (a.pauseTimer<=0) a.vx = a.direction*(1.5+Math.random()*0.8)*animalSpeedMult; }
                else {
                    if (a.hopY===0 && Math.random()<0.08*dt) a.hopVel = -0.9 - Math.random()*0.5;
                    if (a.hopVel!==0 || a.hopY<0) { a.hopY += a.hopVel*dt; a.hopVel += 0.15*dt; if (a.hopY>=0) { a.hopY=0; a.hopVel=0; } }
                    if (Math.random() < 0.002*dt) a.pauseTimer = 120 + Math.floor(Math.random()*480);
                }
            }
            if ((a.direction>0 && a.x>WORLD_W+a.w+10) || (a.direction<0 && a.x<-a.w-10)) groundAnimal = null;
        }
    }

    /* Taivas: tähdenlento, meteoriitit (spawnit, tähdätty meteoriitti, osuma) ja satelliitti – vain yöllä; nollaa kesken lennon olleet päivän alkaessa. */
    function updateSky(dt) {
        // ── Tähdenlento + satelliitti (vain yöllä) ────
        // Päivällä (dayNight.t > 0) niitä ei enää spawnata; update() nollaa
        // kesken lennon olleet oliot päivän alkaessa.
        if (dayNight.t <= 0) {
            updateBadDemo(dt);       // BAD-avaus laukeaa vain kadulla ja yöllä
            updateShootingStar(dt);
            updateSatellite(dt);

            // ── Lepakot (vain yöllä) ────────────
            if (!bats.length) {
                // Spawnaa 0..BAT_COUNT_MAX lepakkoa batSpawnFrames-välein (kaaos K1)
                if (batSpawnTimer === undefined) batSpawnTimer = batSpawnFrames;
                batSpawnTimer -= dt;
                if (batSpawnTimer <= 0) {
                    const count = Math.floor(Math.random() * (BAT_COUNT_MAX + 1)); // 0–5
                    for (let i = 0; i < count; i++) {
                        const dir = Math.random() < 0.5 ? 1 : -1;
                        const speed = BAT_SPEED_MIN + Math.random() * (BAT_SPEED_MAX - BAT_SPEED_MIN);
                        const baseY = BAT_Y_MIN + Math.random() * (BAT_Y_MAX - BAT_Y_MIN);
                        bats.push({
                            x: dir > 0 ? -20 : WORLD_W + 20,
                            y: baseY,
                            vx: dir * speed,
                            vy: (Math.random() - 0.5) * speed * 0.3,
                            wingSize: BAT_WING_MIN + Math.random() * (BAT_WING_MAX - BAT_WING_MIN),
                            color: BAT_COLORS[Math.floor(Math.random() * BAT_COLORS.length)],
                            flapPhase: Math.random() * Math.PI * 2,
                            life: BAT_LIFE_MIN + Math.random() * (BAT_LIFE_MAX - BAT_LIFE_MIN),
                            dirTimer: 120 + Math.random() * 300,
                            fadeTimer: 0,
                            fadeDuration: 0
                        });
                    }
                    batSpawnTimer = batSpawnFrames;
                }
            } else {
                for (let i = bats.length - 1; i >= 0; i--) {
                    const b = bats[i];

                    // Häivytys: kutistuu ja hidastuu → horisonttiefekti
                    if (b.fadeTimer > 0) {
                        b.fadeTimer -= dt;
                        b.x += b.vx * dt * 0.4;
                        b.y += b.vy * dt * 0.4;
                        if (b.fadeTimer <= 0 || b.x < -40 || b.x > WORLD_W + 40) {
                            bats.splice(i, 1);
                        }
                        continue;
                    }

                    // Normaali liike
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                    b.life -= dt;

                    // Elinikä loppui → aloita fade-out (1–5 s)
                    if (b.life <= 0) {
                        b.fadeTimer = 60 + Math.random() * 240;
                        b.fadeDuration = b.fadeTimer;
                        b.vx *= 0.3;
                        b.vy *= 0.3;
                        continue;
                    }

                    // Reunan yli → poista heti
                    if (b.x < -40 || b.x > WORLD_W + 40) {
                        bats.splice(i, 1);
                        continue;
                    }

                    // 90 asteen satunnaiskäännös
                    b.dirTimer -= dt;
                    if (b.dirTimer <= 0) {
                        if (Math.random() < 0.3) {
                            const temp = b.vx;
                            if (Math.random() < 0.5) {
                                b.vx = -b.vy;
                                b.vy = temp;
                            } else {
                                b.vx = b.vy;
                                b.vy = -temp;
                            }
                        }
                        b.dirTimer = 120 + Math.random() * 300;
                    }

                    // Pysytään Y-rajojen sisällä
                    b.y = Math.max(BAT_Y_MIN, Math.min(BAT_Y_MAX, b.y));
                }
            }
        } else {
            // Päivällä lepakot poistetaan
            if (bats.length) bats = [];
        }
    }

    /* Päivälinnut: istuskelevat puissa, siirtyvät ajoittain uuteen paikkaan; yöllä poistetaan. */
    function updateBirds(dt) {
        // ── Päivälinnut ────────────
        if (dayNight.isDay) {
            // Alusta tavoitemäärä jos ei ole asetettu tai kaikki linnut ovat kuolleet
            if (birdTargetCount === undefined || (birds.length === 0 && birdTargetCount > 0 && birdSpawnTimer === undefined)) {
                birdTargetCount = BIRD_COUNT_MIN + Math.floor(Math.random() * (BIRD_COUNT_MAX - BIRD_COUNT_MIN + 1));
                birdSpawnTimer = 60 + Math.random() * 120;
            }

            // Spawnaa lintuja yksi kerrallaan, kunnes tavoite saavutetaan
            if (birds.length < birdTargetCount) {
                birdSpawnTimer -= dt;
                if (birdSpawnTimer <= 0) {
                    const ti = Math.floor(Math.random() * trees.length);
                    const tr = trees[ti];
                    const spread = tr.h * 0.6;
                    const baseY = GROUND_Y - 5;
                    const x0 = tr.x + (Math.random() - 0.5) * spread * 2;
                    const y0 = baseY - tr.h * (0.75 + Math.random() * 0.2);
                    birds.push({
                        x: x0, y: y0, targetX: x0, targetY: y0,
                        perched: true,
                        perchTimer: 180 + Math.random() * 540,
                        wingSize: BIRD_WING_MIN + Math.random() * (BIRD_WING_MAX - BIRD_WING_MIN),
                        color: BIRD_COLORS[Math.floor(Math.random() * BIRD_COLORS.length)],
                        flapPhase: Math.random() * Math.PI * 2,
                        life: BIRD_LIFE_MIN + Math.random() * (BIRD_LIFE_MAX - BIRD_LIFE_MIN),
                        fadeTimer: 0, fadeDuration: 0, treeIdx: ti
                    });
                    birdSpawnTimer = 30 + Math.random() * 90;
                }
            }

            // Päivitä kaikki olemassa olevat linnut
            for (let i = birds.length - 1; i >= 0; i--) {
                const b = birds[i];

                // Fade
                if (b.fadeTimer > 0) {
                    b.fadeTimer -= dt;
                    b.x += (b.targetX - b.x) * 0.02 * dt;
                    b.y += (b.targetY - b.y) * 0.02 * dt;
                    if (b.fadeTimer <= 0) {
                        birds.splice(i, 1);
                        // Kun viimeinenkin lintu on poistunut, nollaa tavoite ja spawn-timer,
                        // jotta seuraavalla framella init ehto (birdTargetCount === undefined)
                        // laukeaa ja uusi parvi alkaa spawnata (bugikorjaus).
                        if (birds.length === 0) { birdTargetCount = undefined; birdSpawnTimer = undefined; }
                    }
                    continue;
                }

                b.life -= dt;
                if (b.life <= 0) {
                    b.fadeTimer = 90 + Math.random() * 150;
                    b.fadeDuration = b.fadeTimer;
                    continue;
                }

                if (b.perched) {
                    b.perchTimer -= dt;
                    if (b.perchTimer <= 0) {
                        const tr = trees[b.treeIdx];
                        const spread = tr.h * 0.6;
                        const baseY = GROUND_Y - 5;
                        b.targetX = tr.x + (Math.random() - 0.5) * spread * 2;
                        b.targetY = baseY - tr.h * (0.65 + Math.random() * 0.3);
                        b.perched = false;
                        b.flapPhase = Math.random() * Math.PI * 2;
                    }
                } else {
                    const dx = b.targetX - b.x;
                    const dy = b.targetY - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 1.5) {
                        b.x = b.targetX;
                        b.y = b.targetY;
                        b.perched = true;
                        b.perchTimer = 180 + Math.random() * 540;
                    } else {
                        const step = (0.6 + Math.random() * 0.4) * birdSpeedMult * dt;
                        b.x += (dx / dist) * step;
                        b.y += (dy / dist) * step;
                    }
                }
            }
        } else {
            // Yöllä linnut poistetaan
            if (birds.length) { birds = []; birdTargetCount = undefined; birdSpawnTimer = undefined; }
        }
    }

    function update(dt) {
        // Ajoneuvon törmäyksen tärinä (vain visuaalinen – ei jäädytä pelilogiikkaa)
        if  (vehicleShakeTimer > 0) { vehicleShakeTimer -= dt; }
        if (meteorShakeTimer > 0) { meteorShakeTimer -= dt; }
        updateBuildingDamage(dt);   // tuhoutuvien talojen animaatio etenee
        updateBuildingSmoke(dt);
        if (beamFireTimer > 0) { beamFireTimer -= dt; }
        if (beamCooldownTimer > 0) { beamCooldownTimer -= dt; }   // laukaisuväli
        if (meteorFlash) { meteorFlash.t -= dt; if (meteorFlash.t <= 0) meteorFlash = null; }

        // ── Hit pause: maailma jäätyy 2  frameä osumasta (render jatkaa) ──
        if (hitPauseTimer > 0) { hitPauseTimer -= dt; return; }

        // Animaatiokello (hengitys, silmän vilkahdus)
        animClock += dt;

        updateDayNight(dt);

        updateSpawnLampShow(dt);

        updateJukeboxPersistence(dt);

        updateDayCycle(dt);

        if (updateDeathSequence(dt)) return;

        if (updateHunger(dt)) return;

        updateHiddenTracking(dt);

        if (updateManholeSequence(dt)) return;

        /* Huonerekisteri (Vaihe 3): makuuhuone → BAR → jukebox → sanomalehti.
           Huone on modaalinen → true = koko frame käsitelty, update() palaa. */
        for (const room of rooms) if (room.update(dt)) return;

        updateClouds(dt);
        updateStorm(dt);   // BAD-myrsky: sade + salamat (no-op muilla tasoilla)
        updateForeground(dt);

        if (updateKnockedDown(dt)) return;

        updateMovement(dt);

        updateCoinPickup(dt);

        updateBeamPickup(dt);

        updateCoinTimers(dt);

        if (updateManholeStep(dt)) return;

        updateElectricCabinets(dt);

        // HUOM: hampurilaisajastin siirrettiin update():n alkuun
        // (kuolemasekvenssin jälkeen) → kulutus jatkuu myös BAR:ssa,
        // jukeboxissa ja iframe-peleissä eikä pysähdy huoneisiin.

        // ── Toiminto ────────────────────────────────
        if (actionJustPressed) handleAction();

        updateParticles(dt);

        updateStreetTimers(dt);

        updatePot(dt);

        updateKickCoin(dt);

        updateEnemies(dt);

        updateAnimal(dt);

        // ── Ajoneuvot: liike, spawnit ja törmäys ──────────
        //    Siirretty omaan funktioonsa, jotta sama liikenne
        //    pyörii myös sanomalehteä lukiessa (ks. newsRoom-haara yllä).
        StreetTraffic.update(dt);

        updateSky(dt);

        updateBirds(dt);
    }

/* ── Toimintopainikkeen käsittely ──────────────── */
    /* Sanomalehden poiminta: tainnutettuna ei voi poimia. */
    function tryNewspaper() {
        // 0. SANOMALEHTI – kadulla lojuva lehti: poimimalla aukeaa
        //    peliohjeet. Ilmainen eikä vaikuta talouteen (sääntö 04).
        //    Lehti on sijoitettu kauas ovista ja lampuista, joten tämä
        //    tarkistus ei varasta minkään muun kohteen toimintoa.
        //    Tainnutettuna lehteä ei voi poimia.
        if (!player.knockedDown && StreetNews.near()) { openNewspaper(); return true; }
        return false;
    }

    /* Hedelmäpeli (talo 7): auki vain öisin, ei lamppua eikä avainta. */
    function tryFruitDoor(px, py) {
        // 0. HEDELMÄPELI (talo 7, buildings[6], x 560–610) – ei lamppua eikä avainta,
        //    mutta auki vain öisin
        const fruitDoor = doorCenter(buildings[6]);
        const fdx = px - fruitDoor.x, fdy = py - fruitDoor.y;
        if (Math.sqrt(fdx * fdx + fdy * fdy) < DOOR_RADIUS) {
            if (buildingGone(6)) return true;   // tuhoutunut talo – musta ovi ei toimi
            if (nightOnlyClosed()) { showNotification(CLOSED_SIGN); return true; }
            if (doorLocked()) return true;                       // kaaos: ovi satunnaisesti lukossa (ei ilmoitusta)
            enterGame('fruitgame/game_main.html');
            return true;
        }
        return false;
    }

    /* Jukebox (talo 5): 1. painallus sytyttää ikkunat, 2. painallus avaa huoneen; auki vain öisin. */
    function tryJukeboxDoor(px, py) {
        // 0.5 JUKEBOX (talo 5, buildings[4], ovi x 410) – auki vain öisin;
        //     yöllä ovi aukeaa vasta kun talon ikkunat palavat
        //     (1. painallus ovella = potku → valot syttyvät 20 s)
        const jkDoor = doorCenter(buildings[JUKEBOX_BLDG_IDX]);
        const jkLights = smallHouseLights[JUKEBOX_BLDG_IDX];
        const jkdx = px - jkDoor.x, jkdy = py - jkDoor.y;
        const jkInReach = Math.sqrt(jkdx * jkdx + jkdy * jkdy) < DOOR_RADIUS;
        if (jkInReach && buildingGone(JUKEBOX_BLDG_IDX)) return true;   // tuhoutunut talo
        if (jkInReach && nightOnlyClosed()) { showNotification(CLOSED_SIGN); return true; }
        if (jkLights && jkLights.lit && jkInReach) {
            if (doorLocked()) return true;                       // kaaos: ovi satunnaisesti lukossa (ei ilmoitusta)
            jukeboxRoom = true;
            jukeSel = 0;
            jukeHeldUp = false;
            jukeHeldDown = false;
            // Estä sama painallus (Space/Enter) laukaisemasta valintaa heti perään
            jukeSpaceHeld = !!(keys[' '] || keys['o'] || keys['O']);
            jukeEnterHeld = !!keys['Enter'];
            jukePick = [];
            for (let i = 0; i < JUKEBOX_TRACKS.length; i++) jukePick.push(false);
            if (!StreetAudio.isJukeboxPlaying()) jukeQueue = [];  // ei vanhaa "♪ SOI" -riviä
            return true;
        }
        return false;
    }

    /* Laivanupotus (talo 2): aina auki; 1. painallus sytyttää valot, 2. avaa pelin. */
    function trySinkshipDoor(px, py) {
        // 0.6 LAIVANUPOTUS (talo 2, buildings[2]) – aina auki yöllä ja päivällä;
        //     1. painallus ovella = potku → valot syttyvät 20 s
        //     2. painallus valaistulla ovella = Laivanupotus aukeaa
        const ssDoor = doorCenter(buildings[SINKSHIP_BLDG_IDX]);
        const ssLights = smallHouseLights[SINKSHIP_BLDG_IDX];
        const ssdx = px - ssDoor.x, ssdy = py - ssDoor.y;
        const ssInReach = Math.sqrt(ssdx * ssdx + ssdy * ssdy) < DOOR_RADIUS;
        if (ssInReach && buildingGone(SINKSHIP_BLDG_IDX)) return true;   // tuhoutunut talo
        if (ssLights && ssLights.lit && ssInReach) {
            enterGame('sinkship/game_main.html');
            return true;
        }
        return false;
    }

    /* Ovet ja potkut: ovista kävellään sisään (BAR, makuuhuone, pelitalot), talon 0 ovi potkii ikkunat valaistuiksi, muut talot syttyvät potkusta ja lamppu toggleaa/ylikuumenee (sis. salaiset cheatit). */
    function tryDoorsAndKicks(px, py) {
        // 1. OVET ENSIN – ei potkua, kävellään suoraan sisään
        for (let i = 0; i < lamps.length; i++) {
            const lamp = lamps[i];
            const dc = doorCenter(buildings[lamp.bldgIdx]);
            const dx = px - dc.x, dy = py - dc.y;
            if (Math.sqrt(dx*dx + dy*dy) < DOOR_RADIUS) {
                if (buildingGone(lamp.bldgIdx)) return;   // tuhoutunut talo – ovi ei toimi
                // BAR – aina auki (talo 8, lamp[4])
                if (i === 4) {
                    barRoom = true;
                    barBuyQty = 0;
                    barBuyHeldUp = false;
                    barBuyHeldDown = false;
                    return;
                }
                // Makuuhuone (talo 7): ovi on aina auki – ei avaimia eikä
                // lamppua, päivällä ja yöllä (kuten BAR).
                if (lamp.bldgIdx === SLEEP_BLDG_IDX) {
                    sleepRoom = true;
                    sleepSel = 0;
                    sleepHeldUp = false;
                    sleepHeldDown = false;
                    sleepPhase = 0;
                    return;
                }
                // Päivällä lamppua ei tarvita: valoisa katu avaa oven
                if (lamp.lit || lampFreeOpen()) {
                    // Dig Däsh vaatii Dig Gamesta kerätyn avaimen
                    if (lamp.gameUrl && lamp.gameUrl.includes('digGame2') && !digKeyCollected) {
                        showNotification('🔑 Key missing! Beat the game in the first house to get it!');
                        return;
                    }
                    // Blue Mäx vaatii Dig Däshistä kerätyn avaimen
                    if (lamp.gameUrl && lamp.gameUrl.includes('bm/') && !boulderKeyCollected) {
                        showNotification('🔑 Key missing, pal! Get it from the previous house!');
                        return;
                    }
                    if (lamp.gameUrl) { enterGame(lamp.gameUrl); }
                    else { showNotification('🚧 No entry without a key! Get the keys or figure something else out.'); }
                } else {
                    showNotification('Dark\nDoor is locked\nLight the lamp!');
                }
                return;
            }
        }
// Talon 0 ovi – potkimalla ikkunoihin syttyy valot (3-6 potkua)
        const dc0 = doorCenter(buildings[0]);
        const dx0 = px - dc0.x, dy0 = py - dc0.y;
        if (Math.sqrt(dx0*dx0 + dy0*dy0) < DOOR_RADIUS) {
            if (buildingGone(0)) return;   // tuhoutunut talo – potku ei tee mitään
            playKick();
            player.kicking = true;
            player.kickFrame = 0;
            hitPauseTimer = HIT_PAUSE;   // tuntuva osuma
            if (firstHouseWindowsLit && !flowerPot && !kickCoin && !avenger) { spawnKickDrop(buildings[0]); return; }
            if (firstHouseKickTarget === 0) {
                firstHouseKickTarget = 3 + Math.floor(Math.random() * 4); // 3-6
            }
            firstHouseKickCount++;
            if (firstHouseKickCount === 3) {
                showNotification('Careful! This may end badly. Try the next door.');
            }
            firstHouseWindowTimer = 1200; // 20s
            if (firstHouseKickCount >= firstHouseKickTarget && !firstHouseWindowsLit) {
                firstHouseWindowsLit = true;
                spawnParticles(dc0.x, dc0.y, '#ffdd88', 10);
            }
            return;
        }
        for (let i = 0; i < buildings.length; i++) {
            if (lamps.some(l => l.bldgIdx === i)) continue;
            if (i === 0) continue;
            const dc = doorCenter(buildings[i]);
            const dx = px - dc.x, dy = py - dc.y;
            if (Math.sqrt(dx*dx + dy*dy) < DOOR_RADIUS) {
                playKick(); player.kicking = true; player.kickFrame = 0;
                hitPauseTimer = HIT_PAUSE;   // tuntuva osuma
                if (buildingGone(i)) return;   // tuhoutunut talo – ovi ei toimi
                const sh = smallHouseLights[i];
                if (sh.lit && !flowerPot && !kickCoin && !avenger) { spawnKickDrop(buildings[i]); }
                else { sh.lit = true; sh.timer = 1200; spawnParticles(dc.x, dc.y, '#ffdd88', 6); }
                return;
            }
        }

        // 2. Ei oven lähellä → POTKU!
        playKick();
        player.kicking = true;
        player.kickFrame = 0;

        // Tarkista osuuko potku lamppuun
        for (let i = 0; i < lamps.length; i++) {
            const lamp = lamps[i];
            const dx = px - lamp.x, dy = (player.y + player.h) - (GROUND_Y + 15);
            if (Math.sqrt(dx*dx + dy*dy) < (LAMP_RADIUS + 10) / 2) {   // potkurange puolitettu: 40 → 20 px
                // Jos lamppu on ylikuumentunut, älä tee mitään
                if (lamp.overheat) {
                    return;
                }
                // Toggle ON/OFF
                lamps[i].lit = !lamps[i].lit;
                state.litLamps[i] = lamps[i].lit;
                // Laske potkut
                lamps[i].kickCount = (lamps[i].kickCount || 0) + 1;
                hitPauseTimer = HIT_PAUSE;   // tuntuva osuma (myös ylikuumeneminen)

                // ── Salainen kolikkopalkkio (TESTITYÖKALU) ──
                // Avain-cheatin jatko: vitoslamppu 20 potkua putkeen → +20 kolikkoa.
                // Hiljainen: ei popuppia, ei ääntä, ei hiukkasia → vain saldo kasvaa.
                if (i === COIN_CHEAT_LAMP) {
                    if (coinCheat.cooldown > 0) {
                        coinCheat.streak = 0;             // cooldownin aikana ei kerrytetä
                    } else {
                        coinCheat.streak++;
                        coinCheat.gapTimer = COIN_CHEAT_GAP;
                        if (coinCheat.streak >= COIN_CHEAT_KICKS) {
                            coinCheat.streak = 0;
                            coinCheat.gapTimer = 0;
                            coinCheat.cooldown = COIN_CHEAT_COOLDOWN;
                            coinCount += COIN_CHEAT_REWARD;
                            state.inventory.coin = true;
                            state.inventory.coinCount = coinCount;
                            GameState.save(state);
                            updateHUD();
                        }
                    }
                } else {
                    coinCheat.streak = 0;                 // välissä toinen lamppu → putki katki
                }

                if (lamps[i].kickCount >= 5) {
// Salainen lamppu: 5 potkua → avaa kaikki ovet (vain viimeinen lamppu)
                    if (i === 4) {
                        for (let j = 0; j < lamps.length; j++) {
                            lamps[j].lit = true;
                            state.litLamps[j] = true;
                        }
                        digKeyCollected = true;
                        state.digKeyCollected = true;
                        boulderKeyCollected = true;
                        state.boulderKeyCollected = true;
                        bmKeyCollected = true;
                        state.bmKeyCollected = true;
                        lamps[i].kickCount = 0;
                        GameState.save(state);
                    } else {
                    // 5 potkua putkeen → ylikuumenee 20 sekunniksi
                    lamps[i].lit = false;
                    lamps[i].overheat = true;
                    lamps[i].overheatTimer = 1200; // 20s @ ~60fps
                    state.litLamps[i] = false;
                    GameState.save(state);
                    spawnParticles(lamp.x, GROUND_Y + 19 - LAMP_POST_H, '#ff4400', 20);
                    }
                    return;
                }

                GameState.save(state);
                if (lamps[i].lit) {
                    spawnParticles(lamp.x, GROUND_Y + 19 - LAMP_POST_H, '#ffff88', 8);
                } else {
                    // Lamppu sammui – ei tekstiä, näkyy visuaalisesti
                }
                return;
            }
        }
    }

    function handleAction() {
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;

        if (tryNewspaper()) return;

        if (tryFruitDoor(px, py)) return;

        if (tryJukeboxDoor(px, py)) return;

        if (trySinkshipDoor(px, py)) return;

        tryDoorsAndKicks(px, py);
    }

    /* Lähettää kadun kolikkosaldon hedelmäpeliin (postMessage) */
    function sendFruitBalance() {
        const overlay = document.getElementById('game-iframe-overlay');
        const iframe = overlay ? overlay.querySelector('iframe') : null;
        if (iframe && iframe.contentWindow) {
            try { iframe.contentWindow.postMessage({ type: 'fruitSync', coins: coinCount }, '*'); } catch (e) {}
        }
    }

    function enterGame(url) {
        // Tallenna pelaajan sijainti ennen peliin menoa
        savedPlayerX = player.x;
        savedPlayerY = player.y;
        GameState.save(state);
        // Tyhjennä näppäintila, ettei jää jumiin
        clearKeys();
        const overlay = document.getElementById('game-iframe-overlay');
        const iframe = overlay.querySelector('iframe');
        // Näytä overlay ENSIN, sitten vasta lataa iframe
        // (estää 0×0 canvas -bugin pelien käynnistyessä)
        overlay.classList.add('active');
        iframeOpen = true;   // päivän liuku odottaa, että pelaaja palaa kadulle
        // StreetAudio.stop(); – musiikki jatkaa soimista pelien aikana (sykli hoitaa tauot)
        iframe.onload = () => {
            try { iframe.contentWindow.focus(); } catch(e) {}
            // Hedelmäpeli: lähetä kadun kolikkosaldo peliin
            if (url && url.indexOf('fruitgame') !== -1) sendFruitBalance();
        };
        iframe.src = url;
        window._streetReturn = (e) => {
            if (e.data === 'RETURN_TO_STREET') closeGame();
            if (e.data === 'KEY_COLLECTED') {
                digKeyCollected = true;
                state.digKeyCollected = true;
                GameState.save(state);
            }
            if (e.data === 'BM_KEY_COLLECTED') {
                bmKeyCollected = true;
                state.bmKeyCollected = true;
                /* Loppupalkinto: Blue Mäxin avaimesta täydet 🍔 (10)
                   + 20 🪙. Toistuva – jokainen avaimen nappaus palkitsee
                   uudelleen. Sääntö 06: ei uutta tekstiä, pelaaja näkee
                   HUD:in lukemat kadulle palatessaan. */
                coinCount += 20;
                hamburgerCount = 10;              // "täydet 10" = katto täyteen
                state.inventory.coinCount = coinCount;
                state.inventory.hamburgerCount = hamburgerCount;
                GameState.save(state);
                updateHUD();
            }
            if (e.data === 'BOULDER_KEY_COLLECTED') {
                boulderKeyCollected = true;
                state.boulderKeyCollected = true;
                GameState.save(state);
            }
            if (e.data === 'COIN_COLLECTED') {
                coinCount++;
                state.inventory.coinCount = coinCount;
                GameState.save(state);
                updateHUD();
            }
            // Hedelmäpeli: panos (−1 kolikko / pyöräytys)
            if (e.data && e.data.type === 'fruitBet') {
                coinCount = Math.max(0, coinCount - 1);
                state.inventory.coinCount = coinCount;
                GameState.save(state);
                updateHUD();
                sendFruitBalance();
            }
            // Hedelmäpeli: voitot (+n kolikkoa)
            if (e.data && e.data.type === 'fruitWin' && typeof e.data.coins === 'number') {
                coinCount += Math.max(0, Math.floor(e.data.coins));
                state.inventory.coinCount = coinCount;
                GameState.save(state);
                updateHUD();
                sendFruitBalance();
            }
        };
        window.addEventListener('message', window._streetReturn);
    }

    /* Vaihe 5 osa 8: jukeboxin valinnat ja poistuminen
       (resetJukeboxRoom, jukePickedTracks, jukeboxExitAndPlay) ovat
       street/rooms.js-moduulissa; nimet tuodaan StreetRooms-destrukturoinnilla. */

    /* ═══ NÄLKÄKUOLEMA HUONEESSA/ALAPELISSÄ ══════════════
       Jos 🍔 loppuu kesken huoneen tai alapelin, pelaaja kuolee heti – kuten
       kadullakin (vain nukkuminen on jäissä). Huone/alapeli suljetaan ensin,
       jotta kuolinsekvenssi näkyy kadulla eikä peli näytä nollautuvan kesken
       pelaamisen. Kutsutaan vain nälkäblokista; talousarvot ennallaan. */
    function leaveHiddenStateForDeath() {
        if (iframeOpen) closeGame();   // alapeli kiinni (overlay pois)
        else closeRoom();              // BAR / makuuhuone / jukebox kiinni
    }

    /* ═══ SANOMALEHTI ══════════════════════════════════════
       Kadun lehti avataan toimintonapilla, kun pelaaja seisoo sen
       kohdalla. Lukutila on kuin canvas-huone: maailma jäätyy, nälkä
       kuluu ja ✕-nappi sulkee (closeRoom). */
    function openNewspaper() {
        newsRoom = true;
        StreetNews.reset();
        /* Estä sama painallus laukaisemasta sivunvaihtoa heti perään
           (sama kikka kuin jukeboxissa: jukeSpaceHeld). */
        newsHeldUp = !!(keys['ArrowUp'] || keys['w'] || keys['W']);
        newsHeldDown = !!(keys['ArrowDown'] || keys['s'] || keys['S']);
        newsSpaceHeld = !!keys[' '];
        newsExitHeld = !!(keys['o'] || keys['O'] || keys['Enter']);
    }

    function closeNewspaper() {
        newsRoom = false;
        StreetNews.reset();
        newsHeldUp = false;
        newsHeldDown = false;
        newsSpaceHeld = false;
        newsExitHeld = false;
    }

    /* ═══ SULJE HUONE (sanomalehti/BAR/sleep/jukebox) ✕-napista ═════════════ */
    /* Palauttaa true jos huone suljettiin, false jos ei oltu huoneessa. */
    /* Sulkee sanomalehden (✕ / poistuminen). true = oli auki. */
    function closeNewsRoom() {
        if (newsRoom) {           // sanomalehti kiinni (✕ / poistuminen)
            closeNewspaper();
            return true;
        }
        return false;
    }

    /* Vaihe 5 osa 8: closeBarRoom / closeSleepRoom /
       closeJukeboxRoom siirrettiin street/rooms.js-moduuliin. HUOM:
       closeNewsRoom ja closeRoom (rekisterisilmukka) jäävät tänne, koska
       rooms[] kokoaa kaikki neljä huonetta. */

    function closeRoom() {
        for (const room of rooms) if (room.isOpen() && room.close()) return true;
        return false;
    }

    /* Sulkee alapelin (iframe). Palauttaa true jos alapeli oli auki.
       index.html:n ✕-nappi käyttää tätä: sulje ensin, resetoi vasta kadulla. */
    function closeGame() {
        const overlay = document.getElementById('game-iframe-overlay');
        if (!overlay || !overlay.classList.contains('active')) return false;
        const iframe = overlay.querySelector('iframe');

        // Vapauta iframen fokus ENNEN piilotusta
        try { iframe.contentWindow && iframe.contentWindow.blur(); } catch(e) {}
        iframe.blur();

        overlay.classList.remove('active');
        iframe.src = '';
        iframeOpen = false;   // takaisin kadulla → päivän liuku jatkuu

        if (window._streetReturn) {
            window.removeEventListener('message', window._streetReturn);
            window._streetReturn = null;
        }

        // Tyhjää näppäintila ja palauta fokus pääsivulle
        clearKeys();
        window.focus();
        try { canvas.focus(); } catch(e) {}
        // Varmistus: fokusoi canvas uudelleen pienen viiveen jälkeen
        setTimeout(() => {
            try { canvas.focus(); } catch(e) {}
        }, 50);
        StreetAudio.start(); // herätä AudioContext jos suspendattu
        /* Tila luetaan tallennuksesta vain jos tallennus on olemassa.
           Jos localStorage ei ole käytettävissä (esim. yksityinen selaus),
           muistissa oleva tila säilyy – muuten katu näyttäisi nollautuvan
           aina alapelistä palatessa. */
        let savedRaw = null;
        try { savedRaw = localStorage.getItem(GameState.STORAGE_KEY); } catch (e) {}
        if (savedRaw) state = GameState.load();
        for (let i = 0; i < lamps.length; i++) {
            lamps[i].lit = state.litLamps[i];
            lamps[i].kickCount = 0;
            lamps[i].overheat = false;
            lamps[i].overheatTimer = 0;
        }
        // Salainen kolikkopalkkio: ei siirry elämältä/istunnolta toiselle
        coinCheat.reset();
        coin.collected = state.inventory.coin;
        coinCount = state.inventory.coinCount || 0;
        coin.respawnTimer = coin.collected ? 1 : 0;
        coin.despawnTimer = coin.collected ? 0 : 600;
        /* 0 🍔 pysyy 0:na (ei `|| 5`): nälkäkuolema ei saa "parantua" siitä,
           että closeGame sulkee alapelin kesken kuolinsekvenssiä. */
        hamburgerCount = (state.inventory.hamburgerCount != null)
            ? state.inventory.hamburgerCount : 5;
        /* HUOM: ajastinta EI enää nollata tässä – se jatkaa siitä
           mihin jäi, kuten kadulla. Vanha `hamburgerTimer = 2400` antoi
           ilmaisen 40 s joka kerta, kun alapelistä poistui → hedeläpelin
           lyhyet sessiot eivät koskaan kuluttaneet mitään. */
        if (coin.collected) { coin.x = -100; coin.y = -100; }
        else { coin.x = randomCoinX(); coin.y = randomCoinY(); }
        digKeyCollected = state.digKeyCollected || false;
        boulderKeyCollected = state.boulderKeyCollected || false;
        bmKeyCollected = state.bmKeyCollected || false;
        beamWeaponCollected = state.beamWeaponCollected || false;
        spawnBeamPickup();
        beamCooldownTimer = 0;   // resetti ei jätä lukkoa päälle
        sleepRoom = false;
        sleepSel = 0;
        sleepHeldUp = false;
        sleepHeldDown = false;
        sleepPhase = 0;
        dayNight.isDay = (state.isDay === true);   // tallennettu päivä/yö pysyy
        barRoom = false;
        resetJukeboxRoom();   // jono (jukeQueue) saa jatkua alapelin aikana
        player.x = savedPlayerX; player.y = savedPlayerY;
        player.vx = 0; player.vy = 0;
        updateHUD();
        return true;
    }

    /** Tyhjentää kaikki näppäintilat ja action-flagit */
    function clearKeys() {
        for (const k in keys) delete keys[k];
        actionPressed = false;
        actionJustPressed = false;
    }

    // durationMs: lukuaika näytöllä. Oletus 2500 ms (kaikki muut popupit),
    // vain aloitusohje käyttää pidempää aikaa (showSpawnHint).
    function showNotification(text, durationMs = 2500) {
        const el = document.getElementById('notification');
        // Peruuta edellinen aikakatkaisu jos uusi teksti tulee
        if (el._timeout) clearTimeout(el._timeout);
        if (el._fadeTimeout) clearTimeout(el._fadeTimeout);
        // Näytä teksti heti
        el.textContent = text;
        el.style.opacity = '1';
        el.style.transition = 'none';
        el.style.animation = 'popIn 0.3s ease-out';
        // Lukuaika (oletus 2.5s), sitten fadeout 0.5s
        el._timeout = setTimeout(() => {
            el.style.transition = 'opacity 0.5s';
            el.style.opacity = '0';
            el._fadeTimeout = setTimeout(() => {
                el.textContent = '';
                el.style.animation = 'none';
            }, 500);
        }, durationMs);
    }

    function showSpawnHint() {
    // Intentionally empty. was TIP: kick the doors to light the lamps!
    }

    function spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4 - 2,
                color, life: 20 + Math.random() * 20, maxLife: 40
            });
        }
    }

    function updateHUD() {
        const coinEl = document.querySelector('#hud-inventory .inv-coin');
        if (coinEl) coinEl.classList.toggle('has', state.inventory.coin);
        // Inventaario HUD-palkkiin (ei muuta alkuperäistä tekstiä, lisää vain statuksen)
        const hudBar = document.getElementById('hud-bar');
        const allKeys = allKeysCollected();
        let status = '';
        if (allKeys) status = ' 🗝️ All keys!';
        else {
            const keys = (digKeyCollected?1:0) + (boulderKeyCollected?1:0) + (bmKeyCollected?1:0);
            status = ' 🔑 Keys: ' + keys + '/3';
        }
        status += ' | 💰 Coins: ' + coinCount;
        if (beamWeaponCollected) status += ' 🔫';   // sädease ansaittu
        if (chaosFlags.beer) {
            /* FULL: 🍔 = peruskerros (kuluu vasta kun 🍺 loppu),
               🍺 = ylin kerros. Näytetään todelliset määrät; 🍔 vilkkuu
               kuten ennenkin, kun ≤ HUNGER_WARN (3). */
            var fBurg = '';
            for (var fb = 0; fb < hamburgerCount; fb++) fBurg += '🍔';
            if (hamburgerCount <= HUNGER_WARN) fBurg = '<span class="burger-warning">' + fBurg + '</span>';
            var fBeer = '';
            for (var bb = 0; bb < drunkLevel; bb++) fBeer += '🍺';
            status += ' | ' + fBurg + fBeer;
        } else {
            // Hampurilaiset (lives) – vilkkuva varoitus kun jäljellä <= HUNGER_WARN (3)
            var burgerStr = '';
            if (hamburgerCount <= HUNGER_WARN) {
                for (var bi = 0; bi < hamburgerCount; bi++) burgerStr += '🍔';
                burgerStr = '<span class="burger-warning">' + burgerStr + '</span>';
            } else {
                for (var bi = 0; bi < hamburgerCount; bi++) burgerStr += '🍔';
            }
            status += ' | ' + burgerStr;
        }
        if (hudBar) hudBar.innerHTML = '<span style="display:block;text-align:center;margin-top:2px">' + status + '</span>';
    }

    /* ── Pilvijärjestelmä (cirrus + hazy, kapea kaistale) ── */
    function initClouds() {
        clouds = [];
        windDir = (Math.random() < 0.5 ? 1 : -1) * (windDirFlip ? -1 : 1);
        windSpeed = (2 + Math.random() * 3) * windSpeedMult; // px/s (2–5) × kaaoskerroin

        // Pilvikaistale: cloudBandTop..cloudBandTop+cloudBandH (kaaos K1)
        const bandTop = cloudBandTop, bandH = cloudBandH;
        for (let i = 0; i < cloudCount; i++) {
            const typeRoll = Math.random();
            let w, opacity, type;
            if (typeRoll < cloudCirrusShare) {
                type = 'cirrus';
                w = (60 + Math.random() * 180) * cloudSizeMult;
                opacity = (0.005 + Math.random() * 0.015) * cloudOpacityMult;
            } else {
                type = 'hazy';
                w = (80 + Math.random() * 220) * cloudSizeMult;
                opacity = (0.015 + Math.random() * 0.035) * cloudOpacityMult;
            }
            clouds.push({
                x: Math.random() * WORLD_W,
                y: bandTop + Math.random() * bandH,
                w: w, opacity: opacity, type: type,
            });
        }
    }

    function updateClouds(dt) {
        if (!lastCloudTime) { lastCloudTime = performance.now(); return; }
        // dt tulee jo parametrina, käytä suoraan
        for (const c of clouds) {
            c.x += windDir * windSpeed * dt / 16.667; // normalisoi ~60fps frameen
            // Wrap-around
            if (c.x > WORLD_W + c.w) c.x = -c.w;
            else if (c.x < -c.w) c.x = WORLD_W + c.w;
        }
    }

    function drawClouds() {
        /* Pilvien väri ja peittävyys liukuvat yön vaaleasta päivän tummaan
           . dayNight.t = 0 → arvot ovat täsmälleen yön ennallaan. */
        const dayMix = dayNight.t;
        const mix = (n, d) => Math.round(n + (d - n) * dayMix);
        const cirrusRGB = mix(CLOUD_NIGHT_CIRRUS[0], CLOUD_DAY_CIRRUS[0]) + ',' +
                          mix(CLOUD_NIGHT_CIRRUS[1], CLOUD_DAY_CIRRUS[1]) + ',' +
                          mix(CLOUD_NIGHT_CIRRUS[2], CLOUD_DAY_CIRRUS[2]);
        const hazyRGB   = mix(CLOUD_NIGHT_HAZY[0], CLOUD_DAY_HAZY[0]) + ',' +
                          mix(CLOUD_NIGHT_HAZY[1], CLOUD_DAY_HAZY[1]) + ',' +
                          mix(CLOUD_NIGHT_HAZY[2], CLOUD_DAY_HAZY[2]);
        const alphaMul = 1 + (CLOUD_DAY_ALPHA - 1) * dayMix;   // päivällä pilvet vahvistuvat
        for (const c of clouds) {
            const x = c.x, y = c.y;
            if (x < -c.w || x > WORLD_W + c.w) continue;

            const a = c.opacity * alphaMul;
            ctx.save();

            if (c.type === 'cirrus') {
                // Ohuet haituvaiset cirrus-juovat (korkeus ~1-2px)
                const streaks = 3 + Math.floor(c.w * 0.015);
                for (let i = 0; i < streaks; i++) {
                    const ox = (i - (streaks - 1) / 2) * (c.w * 0.11);
                    const oy = (i % 3 - 1) * 1.0;
                    const sw = c.w * 0.5 * (0.6 + 0.4 * (1 - Math.abs(i - (streaks - 1) / 2) / (streaks / 2)));
                    const fa = a * (0.35 + 0.65 * (1 - Math.abs(i - (streaks - 1) / 2) / (streaks / 2)));
                    ctx.fillStyle = 'rgba(' + cirrusRGB + ',' + fa + ')';
                    ctx.beginPath();
                    ctx.ellipse(x + ox, y + oy, sw, 1.0, 0.015 * (i - 1), 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                // Hazy: vaakasuoria päällekkäisiä hattaraellipsejä
                const baseClr = hazyRGB;
                const parts = 4 + Math.floor(c.w * 0.012);
                for (let i = 0; i < parts; i++) {
                    const ox = (i - (parts - 1) / 2) * (c.w * 0.14);
                    const oy = Math.sin(i * 2.3) * 2.5;
                    const dist = Math.abs(i - (parts - 1) / 2) / ((parts - 1) / 2);
                    const lw = c.w * (0.15 + 0.10 * (1 - dist));
                    const la = a * (0.5 + 0.5 * (1 - dist));
                    ctx.fillStyle = 'rgba(' + baseClr + ',' + la + ')';
                    const ry = (3 + dist * 2) * cloudThickMult;   // kaos K1: paksumpi pilvi (BAD)
                    ctx.beginPath();
                    ctx.ellipse(x + ox, y + oy, lw, ry, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.restore();
        }
    }

    /* ── BAD-myrsky: sade + ukkonen satunnaisina purskeina ──────────────
       Tilakone: tyyni (calm) → myrskypurske (burst) → tyyni. Purskeen aikana
       sade valuu ja salama iskee thunderGap-välein. Kaikki vain BADissa
       (chaosFlags.storm); NORMAL/MILD/GOOD/FULL: stormBurst = false → ei mitään,
       joten piirto ja päivitys ovat no-opeja (NORMAL bitti-identtinen).
       Salama piirretään taivaskerrokseen (talot peittävät alaosan – ei koskaan
       talojen eteen) ja välähdys koko ruudulle; jyrinä soi matalana viiveellä
       välähdyksen jälkeen (0,4–3,0 s; kerroksia 5–10). Ei uutta tekstiä (sääntö 06), ei pelimekaanista
       vaikutusta (pelaajaan iskevä salama = erillinen tuleva versio). */
    const STORM_RAIN_MAX = 150;         // pisaramäärä täydellä teholla (rainAmount = 1)
    const STORM_RAIN_SPEED = 5.5;       // pisaran pystysuora perusnopeus (px/frame, puolitettu)
    const RAIN_WIND_FACTOR = 0.45;      // vinokulma tuulen mukaan: vaakakallistus = windSpeed × tämä
    const LIGHTNING_FLASH_FRAMES = 24;  // välähdyksen kokonaiskesto (~0,4 s)
    const LIGHTNING_BOLT_SEGS = 14;     // siksak-segmenttien määrä
    const THUNDER_DELAY_MIN = 0.4;      // salama → jyrinä, lähin ukkonen (s)
    const THUNDER_DELAY_MAX = 3.0;      // salama → jyrinä, kaukaisin ukkonen (s)

    /* Arpoo [a, b]. Jos väli on 0, palauttaa a:n KUTSUMISTA Math.random()ia:
       muuten NORMAL/MILD/GOOD/FULL kuluttaisivat jaetun satunnaisjonon jo
       init():ssä ja siirtäisivät deterministisiä simulaatioita (esim.
       manhole-bonus-penkki). Vain BAD (väli > 0) kuluttaa jonoa. */
    function randStorm(a, b) {
        const span = Math.max(0, b - a);
        return span > 0 ? a + Math.random() * span : a;
    }

    /* Nollaa myrsky tyyneksi (init / uusi peli). */
    function resetStorm() {
        stormPhase = 'calm';
        stormTimer = randStorm(stormCalmMin, stormCalmMax);
        rainDrops = [];
        lightning = null;
        thunderPending = -1;
        thunderTimer = 0;
    }

    function initRain() {
        rainDrops = [];
        const n = Math.round(STORM_RAIN_MAX * rainAmount);
        for (let i = 0; i < n; i++) {
            rainDrops.push({
                x: Math.random() * WORLD_W,
                y: Math.random() * WORLD_H,
                z: Math.random(),                 // syvyys 0 (kaukana) … 1 (lähellä)
                len: 8 + Math.random() * 10,
                speed: 0.9 + Math.random() * 0.5
            });
        }
    }

    function updateRain(dt) {
        if (!rainDrops.length) return;
        const wind = windDir * windSpeed * RAIN_WIND_FACTOR;   // vinokulma tuulen voimakkuuden mukaan
        for (const d of rainDrops) {
            const zf = 0.55 + d.z * 0.9;                        // kauko (z pieni) = hitaampi → syvyys
            d.y += STORM_RAIN_SPEED * d.speed * zf * dt;
            d.x += wind * d.speed * zf * dt;
            if (d.y > WORLD_H + 6) { d.y = -6; d.x = Math.random() * WORLD_W; }
            if (d.x < -6) d.x += WORLD_W + 12;
            else if (d.x > WORLD_W + 6) d.x -= WORLD_W + 12;
        }
    }

    /* Salaman siksak-polku: ylhäältä alas talojen taakse asti. */
    function makeBoltPath() {
        const segs = LIGHTNING_BOLT_SEGS;
        const endY = GROUND_Y + 6;
        const step = (endY - 4) / segs;
        let x = 60 + Math.random() * (WORLD_W - 120);
        let y = 4;
        const pts = [];
        for (let i = 0; i <= segs; i++) {
            pts.push({ x: x, y: y });
            y += step;
            if (i > 0 && i < segs) {
                x += (Math.random() - 0.5) * 34;
                x = Math.max(6, Math.min(WORLD_W - 6, x));
            }
        }
        return pts;
    }

    /* Käynnistää yhden salaman: polku + välähdys + viivästetty jyrinä. */
    function triggerLightning() {
        lightning = { t: 0, bolt: makeBoltPath(), boltAlpha: 1, flashAlpha: 0.8 };
        thunderPending = (THUNDER_DELAY_MIN + Math.random() * (THUNDER_DELAY_MAX - THUNDER_DELAY_MIN)) * 60;   // 0,4–3,0 s (×60 = framet)
    }

    function updateLightning(dt) {
        if (!lightning) return;
        lightning.t += dt;
        const k = lightning.t / LIGHTNING_FLASH_FRAMES;   // 0 → 1
        const flick = 0.5 + 0.5 * Math.cos(lightning.t * 1.7);   // nopea välkky
        lightning.flashAlpha = Math.max(0, (1 - k) * (0.5 + 0.5 * flick)) * 0.8;
        lightning.boltAlpha  = Math.max(0, (1 - k) * (0.4 + 0.6 * flick));
        if (lightning.t >= LIGHTNING_FLASH_FRAMES) lightning = null;
    }

    /* Sää-tilakone: vaiheet + sade + salamat. Vain BAD (stormBurst). */
    function updateStorm(dt) {
        if (!stormBurst) return;
        updateLightning(dt);
        if (thunderPending >= 0) {
            thunderPending -= dt;
            if (thunderPending <= 0) { thunderPending = -1; StreetSfx.playThunder(); }
        }
        if (stormPhase === 'calm') {
            stormTimer -= dt;
            if (stormTimer <= 0) {
                stormPhase = 'burst';
                stormTimer = randStorm(stormBurstMin, stormBurstMax);
                thunderTimer = 60;         // ensimmäinen salama ~1 s kuluttua
                initRain();
            }
            return;
        }
        // burst
        stormTimer -= dt;
        updateRain(dt);
        thunderTimer -= dt;
        if (thunderTimer <= 0) {
            triggerLightning();
            thunderTimer = randStorm(thunderGapMin, thunderGapMax);
        }
        if (stormTimer <= 0) {
            stormPhase = 'calm';
            stormTimer = randStorm(stormCalmMin, stormCalmMax);
            rainDrops = [];
        }
    }

    /* Salama (taivaskerros → eturivin talot peittävät alaosan, ei koskaan eteen). */
    function drawLightningBolt() {
        if (!lightning || !lightning.bolt || lightning.boltAlpha <= 0) return;
        const a = lightning.boltAlpha;
        const pts = lightning.bolt;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        // Hehku
        ctx.strokeStyle = 'rgba(200,225,255,' + (0.35 * a).toFixed(3) + ')';
        ctx.lineWidth = 4;
        ctx.stroke();
        // Ydin
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.95 * a).toFixed(3) + ')';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
    }

    /* Yhden pisaran viiva liikkeen suuntaan: putoaa alaspäin ja taittuu tuulen
       mukaan vinoksi. Kaukaiset pisarat (z pieni) ovat lyhyempiä ja liikkuvat
       hitaammin → syvyysvaikutelma. Vinokulma = tuulen voimakkuus. */
    function rainStreak(d) {
        const zf = 0.55 + d.z * 0.9;                                  // syvyyskerroin
        const vx = windDir * windSpeed * RAIN_WIND_FACTOR * d.speed * zf;
        const vy = STORM_RAIN_SPEED * d.speed * zf;
        const n = Math.sqrt(vx * vx + vy * vy) || 1;
        const len = d.len * (0.6 + d.z * 1.1);
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + (vx / n) * len, d.y + (vy / n) * len);
    }

    /* Kauko-sade: talojen TAAKSE (himmeä, hidas) – syvyysvaikutelma. */
    function drawRainBack() {
        if (!rainDrops.length) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(150,175,205,0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of rainDrops) if (d.z < 0.5) rainStreak(d);
        ctx.stroke();
        ctx.restore();
    }

    /* Lähi-sade: kaiken ETEEN (kirkkaampi, nopeampi; BAD-myrskyn purske). */
    function drawRain() {
        if (!rainDrops.length) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(180,200,220,0.36)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of rainDrops) if (d.z >= 0.5) rainStreak(d);
        ctx.stroke();
        ctx.restore();
    }

    /* ── Kaukaisen kaupungin siluetti – kertagenerointi (ei randomia per frame) ── */
    function initBackdrop() {
        backdrop = { blocks: [] };
        let x = 0;
        let blockIdx = 0;
        while (x < WORLD_W) {
            const w = Math.round((28 + Math.floor(Math.random() * 43)) * BACKDROP_SCALE);   // 14–35
            const h = Math.round((100 + Math.floor(Math.random() * 131)) * BACKDROP_SCALE); // 50–115
            const b = {
                x, w, h,
                color: BACKDROP_PALETTE[Math.floor(Math.random() * BACKDROP_PALETTE.length)],
                roof: Math.floor(Math.random() * 4),                  // 0 tasakatto, 1 porrastus, 2 harja, 3 laite
                band: Math.random() < 0.5,
                winCols: Math.max(1, Math.floor((w - BACKDROP_WIN_OX * 2) / BACKDROP_WIN_DX)),
                winRows: Math.max(1, Math.floor((h - BACKDROP_WIN_OY * 2) / BACKDROP_WIN_DY)),
                device: Math.floor(Math.random() * 3),                // kattolaite (roof === 3)
                deviceX: 0.2 + Math.random() * 0.6,                   // kattolaitteen paikka (osuus leveydestä)
                lit: null
            };
            // Joka 3. talo saa yhden himmeän lämpimän ikkunan (eloa, ei sekoitu pelattaviin)
            if (blockIdx % 3 === 0) {
                b.lit = {
                    c: Math.floor(Math.random() * b.winCols),
                    r: Math.floor(Math.random() * b.winRows)
                };
            }
            blockIdx++;
            backdrop.blocks.push(b);
            backdrop.total = backdrop.blocks.length;   // eskalaatiokynnys (BACKDROP_GONE_SHARE)
            x += w;   // talot kiinni toisissaan → yhtenäinen skyline
        }
    }

    /* ── Etualan elementit (kiveys, ruohot, viemärit, kuoriainen) ── */
    function initForeground() {
        foreground = {
            copingStones: [],     // Reunakivet
            pavingStones: [],     // Kiveysrivit
            grassTufts: [],
            treeGrassTufts: [],  // Pienet ruohotupsut puiden juurella (1/4 koko)
            manholes: [],
            beetles: [],
            newspaper: null,
            ironFence: null,     // Rauta-aita alalaidassa
            thresholds: [],      // Ovien kynnysviuhkat (esilaskettu geometria)
            kerbGaps: []         // Oviaukkojen kohdat (laskettu reunakivi)
        };

        // Reunakivet (yläreuna)
        let sx = 0;
        while (sx < WORLD_W) {
            const gap = 22 + Math.floor(Math.random() * 10);
            foreground.copingStones.push({ x: sx, w: gap - 2, shade: 1 + Math.floor(Math.random() * 3) });
            sx += gap;
        }

        // Kiveyspinta (4 riviä) – saumavaihe ja sävy vaihtelevat taloittain,
        // jotta sama kiveysruudukko ei jatku yhtenä "barina" laidasta laitaan.
        const houseAt = (x) => {
            for (let i = 0; i < buildings.length; i++) {
                const b = buildings[i];
                if (x >= b.x && x < b.x + b.w) return i;
            }
            return -1;   // talojen väli (rako)
        };
        const housePhase = [], houseDrift = [];
        for (let i = 0; i < buildings.length; i++) {
            let hs = i * 2089 + 7;
            const hrnd = () => { hs = (hs * 9301 + 49297) % 233280; return hs / 233280; };
            housePhase.push(Math.round(hrnd() * 6));       // 0–6 px saumavaihe per talo
            houseDrift.push(Math.round(hrnd() * 2 - 1));   // −1 / 0 / +1 sävy per talo
        }
        for (let row = 0; row < 4; row++) {
            const ry = GROUND_Y + 5 + row * 20;
            const colOff = row % 2 === 0 ? 0 : 11;
            let sx = colOff;
            while (sx < WORLD_W) {
                const sw = 16 + Math.floor(Math.random() * 12);
                const sh = 16 + Math.floor(Math.random() * 5);
                const hi = houseAt(sx);
                const phase = hi >= 0 ? housePhase[hi] : 0;
                const drift = hi >= 0 ? houseDrift[hi] : 0;
                const shade = Math.max(10, Math.min(17, 10 + Math.floor(Math.random() * 8) + drift));
                foreground.pavingStones.push({ x: sx + phase, y: ry, w: sw, h: sh, shade: shade });
                sx += sw + Math.floor(Math.random() * 4);
            }
        }

        // Ruohotupsut (4 kpl, heti aidan edessä)
        for (let i = 0; i < 4; i++) {
            foreground.grassTufts.push({
                x: 60 + Math.random() * 680,
                y: WORLD_H - 10 + Math.random() * 5,   // aidan juuressa, alareunan tuntumassa
                blades: 3 + Math.floor(Math.random() * 3),  // 3-5 kortta
                phase: Math.random() * Math.PI * 2
            });
        }
        // Lajittele vasemmalta oikealle
        foreground.grassTufts.sort((a, b) => a.x - b.x);

        // Pienet ruohotupsut (1/4 koko) puiden juurella – random paikka raossa
        // Puut: talot 1–2 (x 150–200) ja talot 3–4 (x 330–380), raon leveys ~50px
        for (const tr of trees) {
            for (let i = 0; i < 3; i++) {
                foreground.treeGrassTufts.push({
                    x: tr.x - 25 + Math.random() * 50,
                    y: GROUND_Y - 5 + Math.random() * 5,   // puun juurella
                    blades: 3 + Math.floor(Math.random() * 3),  // 3-5 kortta
                    phase: Math.random() * Math.PI * 2
                });
            }
        }
        foreground.treeGrassTufts.sort((a, b) => a.x - b.x);

        // Viemärinkannet (2 kpl)
        foreground.manholes.push({
            x: 200 + Math.random() * 30,
            y: GROUND_Y + 24 + Math.random() * 6,
            steamTimer: 180 + Math.random() * 300,
            steamParticles: []
        });
        foreground.manholes.push({
            x: 570 + Math.random() * 30,
            y: GROUND_Y + 22 + Math.random() * 8,
            steamTimer: 180 + Math.random() * 300,
            steamParticles: []
        });

        // Kuoriaiset (beetleCount kpl; kaaos K1)
        foreground.beetles = [];
        for (let i = 0; i < beetleCount; i++) {
            foreground.beetles.push({
                x: 100 + Math.random() * 600,
                y: GROUND_Y + 62 + Math.random() * 20,
                dir: Math.random() < 0.5 ? 1 : -1,
                animTimer: Math.random() * Math.PI * 2,
                speed: 0.3 + Math.random() * 0.3
            });
        }

        /* Sanomalehti (poimittavissa) – rauta-aidan aukkoon kauas
           kaikista ovista (lähin ovi x 410), jotta poiminta ei varasta
           oven toimintoa eikä lehti jää aidan taakse piiloon. */
        foreground.newspaper = {
            x: 338 + Math.random() * 14,
            y: GROUND_Y + 40 + Math.random() * 10,
            angle: -0.05 + Math.random() * 0.1
        };

        // Ovien kynnysviuhkat – tarvitsee viemärien paikat (detaljien väistö)
        buildThresholds();

        // Rauta-aita – musta takorauta-aita kadun alalaitaan, keskellä aukko
        const FENCE_TOP = WORLD_H - 50;        // aidan yläreuna
        const FENCE_BOTTOM = WORLD_H;           // aidan alareuna (canvasin pohja)
        const FENCE_BAR_SPACING = 12;           // pystypiikkien väli
        const GAP_START = 335;                  // keskiaukon alku
        const GAP_END = 465;                    // keskiaukon loppu (130px aukko)
        const segments = [];
        // Vasen segmentti
        const segs = [{ start: 0, end: GAP_START }, { start: GAP_END, end: WORLD_W }];
        for (const seg of segs) {
            const bars = [];
            let bx = seg.start + 6; // pieni marginaali reunasta
            while (bx < seg.end - 2) {
                bars.push(bx);
                bx += FENCE_BAR_SPACING;
            }
            segments.push({ startX: seg.start, endX: seg.end, barX: bars });
        }
        foreground.ironFence = {
            topY: FENCE_TOP,
            bottomRailY: WORLD_H - 6,
            barSpacing: FENCE_BAR_SPACING,
            gapStart: GAP_START,
            gapEnd: GAP_END,
            segments: segments
        };
    }

    /* ── Ovien kynnysviuhka: esilaskettu geometria (kerran initissä) ──
       Kiveys "kaatuu" kohti ovea: saumat osoittavat kynnykseen, renkaat
       syvenevät ovesta poispäin ja keskusta painuu hieman (V-painuma).
       Kiilat ryhmitellään sävyittäin → muutama fill per ovi per frame. */
    function buildThresholds() {
        if (!foreground) return;
        foreground.thresholds = [];
        foreground.kerbGaps = [];

        const SAMPLE_U = [-1, -0.5, 0, 0.5, 1];   // jaetut rajapistenäytteet → ei rakoja renkaiden väliin
        const nearManhole = (x, y, r) => {
            for (const mh of foreground.manholes) {
                const dx = mh.x - x, dy = mh.y - y;
                if (dx * dx + dy * dy < r * r) return true;
            }
            return false;
        };

        for (let bi = 0; bi < buildings.length; bi++) {
            const b = buildings[bi];
            const cx = b.x + b.w / 2;                 // sama piste kuin oven keskipiste
            const s = buildingScale(b);               // syvyys/leveys skaalautuvat kuten ovi
            // Deterministinen random per talo (sama tekniikka kuin lampun jalustassa)
            let seed = bi * 7919 + 13;
            const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

            const gapHalf = (DOOR_W * s) / 2 + KERB_GAP_EXTRA;
            const yTop = GROUND_Y + THRESH_TOP_Y;
            const dipAt = (u) => THRESH_DIP * (1 - Math.abs(u)) * s;
            const edgeX = (u, w) => cx + u * w * s;         // w = skaalaamaton puolileveys
            const edgeY = (u, baseY) => baseY + dipAt(u);
            const usWith = (uA, uB) => {                    // u-arvot välillä [uA,uB] (rajapistenäytteet mukaan)
                const out = [uA];
                for (const su of SAMPLE_U) if (su > uA + 1e-9 && su < uB - 1e-9) out.push(su);
                out.push(uB);
                return out;
            };

            const groups = new Map(), wear = new Map();
            const add = (map, shade, poly) => {
                const key = Math.max(0, Math.min(255, Math.round(shade)));
                if (!map.has(key)) map.set(key, []);
                map.get(key).push(poly);
            };
            const seams = [], hseams = [], ringYs = [];
            const leftEdge = [edgeX(-1, DOOR_W / 2), yTop];
            const rightEdge = [edgeX(1, DOOR_W / 2), yTop];
            let wIn = DOOR_W / 2, y0 = yTop;
            for (let r = 0; r < THRESH_RINGS.length; r++) {
                const cfg = THRESH_RINGS[r];
                const n = cfg.n, y1 = y0 + cfg.d * s;
                ringYs.push([y0, y1]);
                // Renkaan yläraja – sama pistejono kuin edellisen renkaan alaraja
                const topHs = [];
                for (const u of SAMPLE_U) topHs.push(edgeX(u, wIn), edgeY(u, y0));
                hseams.push(topHs);
                // Kiilakivet: saumat osoittavat kynnykseen
                for (let i = 0; i < n; i++) {
                    const uA = (i / n) * 2 - 1, uB = ((i + 1) / n) * 2 - 1;
                    const poly = [];
                    for (const u of usWith(uA, uB)) poly.push(edgeX(u, wIn), edgeY(u, y0));
                    const botUs = usWith(uA, uB);
                    for (let k = botUs.length - 1; k >= 0; k--) poly.push(edgeX(botUs[k], cfg.w), edgeY(botUs[k], y1));
                    // Lähempänä ovea hieman vaaleampi (kuivempi sisäänkäynti)
                    const shade = 12.5 + (THRESH_RINGS.length - r) * 0.6 + (rnd() * 3 - 1.5);
                    add(groups, shade, poly);
                    // Tallattu keskilinja (kuluminen) – piirretään peruskiilojen päälle
                    if (i === Math.floor(n / 2) && rnd() < 0.8) add(wear, shade - 2.5, poly);
                    if (i > 0) seams.push([edgeX(uA, wIn), edgeY(uA, y0), edgeX(uA, cfg.w), edgeY(uA, y1)]);
                }
                leftEdge.push(edgeX(-1, cfg.w), y1);
                rightEdge.push(edgeX(1, cfg.w), y1);
                wIn = cfg.w; y0 = y1;
            }
            // Viuhkan alaraja
            const botHs = [];
            for (const u of SAMPLE_U) botHs.push(edgeX(u, wIn), edgeY(u, y0));
            hseams.push(botHs);

            // Ulkoreuna: yläraja (V-painuma) → oikea vino sivu → alaraja → vasen vino sivu
            const border = [];
            for (const u of SAMPLE_U) border.push(edgeX(u, DOOR_W / 2), edgeY(u, yTop));
            for (let k = 2; k < rightEdge.length; k += 2) border.push(rightEdge[k], rightEdge[k + 1]);
            for (let k = botHs.length - 2; k >= 2; k -= 2) border.push(botHs[k], botHs[k + 1]);
            for (let k = leftEdge.length - 2; k >= 2; k -= 2) border.push(leftEdge[k], leftEdge[k + 1]);
            // Detaljit: halkeamat (saumaa pitkin) + pikkukivet
            const cracks = [], pebbles = [];
            if (THRESH_DETAILS) {
                for (let c = 0; c < 2 && seams.length >= 2; c++) {
                    const ln = seams[Math.floor(rnd() * seams.length)];
                    const t0 = 0.3 + rnd() * 0.15, t1 = Math.min(1, t0 + 0.45 + rnd() * 0.2);
                    cracks.push([ln[0] + (ln[2] - ln[0]) * t0, ln[1] + (ln[3] - ln[1]) * t0,
                                 ln[0] + (ln[2] - ln[0]) * t1, ln[1] + (ln[3] - ln[1]) * t1]);
                }
                for (let p = 0; p < 2; p++) {
                    const u = rnd() * 2 - 1;
                    const rr = Math.floor(rnd() * THRESH_RINGS.length);
                    const wA = rr === 0 ? DOOR_W / 2 : THRESH_RINGS[rr - 1].w;
                    const wB = THRESH_RINGS[rr].w;
                    const t = 0.15 + rnd() * 0.8;
                    const px = edgeX(u, wA + (wB - wA) * t);
                    const py = ringYs[rr][0] + (ringYs[rr][1] - ringYs[rr][0]) * t;
                    if (nearManhole(px, py, 15)) continue;   // ei detaljeja viemärinkannen päälle
                    pebbles.push([Math.round(px), Math.round(py), rnd() < 0.5 ? 1 : 2, 1,
                                  rnd() < 0.5 ? '#3a3a3a' : '#2c2c2c']);
                }
            }

            const toBuckets = (map) => {
                const arr = [];
                for (const [shade, polys] of map) {
                    const hex = shade.toString(16).padStart(2, '0');
                    arr.push({ fill: '#' + hex + hex + hex, polys: polys });
                }
                arr.sort((a, b) => a.fill < b.fill ? -1 : 1);
                return arr;
            };

            const slabW = Math.round((DOOR_W + 2) * s);
            const gapL = Math.round(cx - gapHalf), gapR = Math.round(cx + gapHalf);
            foreground.thresholds.push({
                bldgIdx: bi,
                cx: cx,
                gapL: gapL,
                gapR: gapR,
                groups: toBuckets(groups),
                wear: toBuckets(wear),
                seams: seams,
                hseams: hseams,
                border: border,
                cracks: cracks,
                pebbles: pebbles,
                slab: { x: Math.round(cx - slabW / 2), y: GROUND_Y + 2, w: slabW, h: Math.max(4, Math.round(5 * s)) },
                lightRGB: bi === 8 ? THRESH_LIGHT_BAR
                        : bi === JUKEBOX_BLDG_IDX ? THRESH_LIGHT_JUKEBOX
                        : THRESH_LIGHT_HOUSE,
                depth: y0 - yTop
            });
            foreground.kerbGaps.push({ l: gapL, r: gapR });
        }
        foreground.kerbGaps.sort((a, b) => a.l - b.l);
    }

    function updateForeground(dt) {
        if (!foreground) return;
        const fg = foreground;

        // Viemärien höyry
        for (const mh of fg.manholes) {
            mh.steamTimer -= dt;
            if (mh.steamTimer <= 0) {
                // Tuota uusi höyrypartikkeli
                const count = 1 + Math.floor(Math.random() * 3);
                for (let i = 0; i < count; i++) {
                    mh.steamParticles.push({
                        x: mh.x + (Math.random() - 0.5) * 14,
                        y: mh.y - 2,
                        vy: -0.15 - Math.random() * 0.25,
                        vx: (Math.random() - 0.5) * 0.15,
                        alpha: 0.15 + Math.random() * 0.1,
                        life: 60 + Math.random() * 90,
                        r: 2 + Math.random() * 4
                    });
                }
                mh.steamTimer = 180 + Math.random() * 420;
            }
            // Päivitä olemassaolevat höyryt
            for (let i = mh.steamParticles.length - 1; i >= 0; i--) {
                const p = mh.steamParticles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.r += 0.012 * dt;
                p.life -= dt;
                p.alpha *= 0.997;
                if (p.life <= 0 || p.alpha < 0.005) mh.steamParticles.splice(i, 1);
            }
        }

        // Kuoriaiset
        for (const b of fg.beetles) {
            b.x += b.dir * b.speed * dt;
            b.animTimer += 0.08 * dt;
            // Käännös reunoilla
            if (b.x < 20 && b.dir < 0) b.dir = 1;
            if (b.x > WORLD_W - 20 && b.dir > 0) b.dir = -1;
        }
    }

/* ═══════════════════════════════════════════════════
       PIIRTO – tausta, talot, maa
       ═══════════════════════════════════════════════════ */
    /* Huoneet ovat modaalisia: koko näkymä on huone ja kamera keskittää (jukebox, BAR, lehti). true = huone piirrettiin. */
    function drawRoomView() {
        for (const room of rooms) {
            if (!room.isOpen()) continue;
            camX = (WORLD_W - viewW) / 2;                 // kamera keskittää huoneen
            ctx.save();
            ctx.translate(-Math.round(camX), 0);
            room.draw();
            ctx.restore();
            return true;
        }
        return false;
    }

    /* Maailman muunnos: kamera + tärinät (oviukon isku, ajoneuvon törmäys, meteoriitti, kaaoksen jatkuva huojunta). HUOM: ctx.restore() on render():n lopussa. */
    function pushWorldTransform() {
        ctx.save();
        ctx.translate(-Math.round(camX), 0);
        // Oviukon isku: 1–2 px tärinä jäädytyksen aikana (hitPauseTimer toimii kellona)
        if (avenger && avenger.phase === 'hold' && hitPauseTimer > 0) {
            ctx.translate(Math.round(Math.sin(hitPauseTimer * 0.9) * 1.6), 0);
        }
        // Ajoneuvon törmäyksen tärinä
        if (vehicleShakeTimer > 0) {
            ctx.translate(Math.round(Math.sin(vehicleShakeTimer *0.9) *1.6), 0);
        }
        // Meteoriitin törmäyksen tärinä – voimakkaampi, molemmissa suunnissa
        if (meteorShakeTimer > 0) {
            ctx.translate(
                Math.round(Math.sin(meteorShakeTimer * 0.9) * 3),
                Math.round(Math.cos(meteorShakeTimer * 0.7) * 2)
            );
        }
        // Kaaos – koko ajan hiukan tärisevä kuva (BAD/FULL): pieni jatkuva huojunta
        if (screenShakeAmount > 0) {
            const t = Date.now() * 0.001;
            ctx.translate(
                Math.round(Math.sin(t * 13.7) * screenShakeAmount * 1.4),
                Math.round(Math.sin(t * 11.3 + 0.5) * screenShakeAmount * 1.1)
            );
        }
    }

    /* Yötaivas + päivätaivaan liuku (dayNight.t). */
    function drawSkyGradient() {
        // Taivas
        const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
        skyGrad.addColorStop(0, '#0a0a1e');
        skyGrad.addColorStop(0.6, '#111133');
        skyGrad.addColorStop(1, '#1a1a3e');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, WORLD_W, GROUND_Y);

        // Päivätaivas (lopputila) – liukuu yötaivaan päälle dayT:n mukaan
        if (dayNight.t > 0) {
            const dayGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
            dayGrad.addColorStop(0, DAY_SKY_TOP);
            dayGrad.addColorStop(0.55, DAY_SKY_MID);
            dayGrad.addColorStop(1, DAY_SKY_HORIZON);
            ctx.save();
            ctx.globalAlpha = dayNight.t;
            ctx.fillStyle = dayGrad;
            ctx.fillRect(0, 0, WORLD_W, GROUND_Y);
            ctx.restore();
        }
    }

    /* Aurinko: hehku, hitaasti pyörivä sädekehä ja kiekko (kaaos voi vaihtaa värin ja koon). */
    function drawSun() {
        // Aurinko (päivä) – liukuu vasemmalta oikealle päivän aikana
        if (dayNight.t > 0) {
            ctx.save();
            ctx.globalAlpha = dayNight.t;
            // Hehku – sunGlow (kaaos) tai nykyinen lämmin (NORMAL bitti-identtinen)
            const glowStops = sunGlow || SUN_GLOW_DEFAULT;
            const discColor = sunColor || '#ffe066';
            const rayRGB = sunColor
                ? sunColor.slice(1).match(/../g).map(h => parseInt(h, 16)).join(',')
                : '255,238,160';
            const SR = SUN_R * sunSizeMult;   // kaaos: auringon koko (NORMAL = 1)
            const sunGlowGrad = ctx.createRadialGradient(dayNight.sunX, SUN_Y, SR * 0.4, dayNight.sunX, SUN_Y, SR * 3.4);
            sunGlowGrad.addColorStop(0, glowStops[0]);
            sunGlowGrad.addColorStop(0.4, glowStops[1]);
            sunGlowGrad.addColorStop(1, glowStops[2]);
            ctx.fillStyle = sunGlowGrad;
            ctx.beginPath(); ctx.arc(dayNight.sunX, SUN_Y, SR * 3.4, 0, Math.PI*2); ctx.fill();
            // Hitaasti pyörivä sädekehä
            const spin = Date.now() * 0.00012;
            ctx.strokeStyle = 'rgba(' + rayRGB + ',0.35)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                const ang = spin + i * Math.PI / 4;
                const r0 = SR + 5;
                const r1 = r0 + (i % 2 === 0 ? 9 : 5);
                ctx.beginPath();
                ctx.moveTo(dayNight.sunX + Math.cos(ang) * r0, SUN_Y + Math.sin(ang) * r0);
                ctx.lineTo(dayNight.sunX + Math.cos(ang) * r1, SUN_Y + Math.sin(ang) * r1);
                ctx.stroke();
            }
            // Kiekko: sunColor (kaaos) tai lämmin keltainen (NORMAL bitti-identtinen)
            ctx.fillStyle = discColor;
            ctx.beginPath(); ctx.arc(dayNight.sunX, SUN_Y, SR, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }
    }

    /* Tähdet: jokaisella oma twinkle; himmenevät päivän tullessa. */
    function drawStars() {
        // Tähdet (jokaisella oma random twinkle) – himmenevät päivän tullessa
        if (dayNight.t < 1) {
            const starFade = 1 - dayNight.t;
            for (const s of stars) {
                const freq = 800 + s.blink * 3000;
                const twinkle = Math.sin(Date.now() / freq + s.blink) * 0.5 + 0.5;
                const a = (0.15 + twinkle * 0.7) * starFade;
                ctx.fillStyle = 'rgba(255,255,' + Math.floor(200 + twinkle * 55) + ',' + a + ')';
                ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
                // Kirkas pilkahdus
                if (twinkle > 0.92) {
                    ctx.fillStyle = 'rgba(255,255,255,' + (a * 1.5) + ')';
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 0.5, 0, Math.PI*2); ctx.fill();
                }
            }
        }
    }

    /* Sirppikuu: hehku, kuva tai proseduraalinen fallback, kraatterit, maavalo + terminaattori, limb darkening. */
    function drawMoon() {
        /* ── Sirppikuu ──
           Piirretään tähtien jälkeen (kuu peittää tähdet) mutta ennen pilviä
           (pilvi kuun edessä on oikein). Kuu liukuu yön aikana vasemmalta
           oikealle ja laskeutuu pois (, X päivittyy moonNightClockin
           mukaan). Rakenne: hehku → valoisa kiekko → kraatterit → maavalo
           (pehmeä terminaattori) → pallomaisuus. Varjokerrokset on klipattu
           kuun kiekkoon → mikään ei karkaa reunan ulkopuolelle. */
        if (dayNight.t < 1) {
            ctx.save();
            const moonY = MOON_Y, moonR = MOON_R;
            const moonFade  = 1 - dayNight.t;                                             // sirpin häipyminen päivällä
            const earthFade = Math.max(0, moonFade - MOON_EARTHSHINE_FADE * dayNight.t);  // maavalo häipyy ensin
            const shadowOff = moonR * MOON_SHADOW_OFF;
            const tint = dayNight.t * MOON_DAWN_TINT;                                     // aamunkoitto lämmittää sirpin
            const mixCh = (a, b) => Math.round(a + (b - a) * tint);

            // 1) Hehku
            ctx.globalAlpha = moonFade;
            const moonGlow = ctx.createRadialGradient(dayNight.moonX, moonY, moonR * 0.4, dayNight.moonX, moonY, moonR * 2.8);
            const glowRGB = MOON_GLOW_RGB[0] + ',' + MOON_GLOW_RGB[1] + ',' + MOON_GLOW_RGB[2];
            moonGlow.addColorStop(0, 'rgba(' + glowRGB + ',' + MOON_GLOW_A.toFixed(3) + ')');
            moonGlow.addColorStop(0.4, 'rgba(' + glowRGB + ',' + (MOON_GLOW_A * 0.33).toFixed(3) + ')');
            moonGlow.addColorStop(1, 'rgba(' + glowRGB + ',0)');
            ctx.fillStyle = moonGlow;
            ctx.beginPath(); ctx.arc(dayNight.moonX, moonY, moonR * 2.8, 0, Math.PI*2); ctx.fill();

            // 2) Kuu-kuva: assets/moon.png – sama koko kuin entinen
            //    kiekko (2 × MOON_R = 60 px). Käännös on tehty jo itse kuvaan
            //    → ei ctx.rotatea. globalAlpha = moonFade pätee myös kuvaan,
            //    joten päivänvaihdon häivytys säilyy. Jos kuva ei ole vielä
            //    ladattu (tai headless-validointi), piirretään entinen
            //    proseduraalinen kuu (fallback).
            if (moonPicReady) {
                ctx.imageSmoothingEnabled = true; // kuva → pehmennetty skaalaus
                const d = moonR * 2;
                ctx.drawImage(moonPic, dayNight.moonX - d / 2, moonY - d / 2, d, d);
            } else {
                // 2b) Valoisa kiekko (dayNight.t = 0 → MOON_LIT_RGB; aamunkoitolla lämpenee)
                ctx.fillStyle = 'rgb(' + mixCh(MOON_LIT_RGB[0], MOON_DAWN_RGB[0]) + ',' +
                                         mixCh(MOON_LIT_RGB[1], MOON_DAWN_RGB[1]) + ',' +
                                         mixCh(MOON_LIT_RGB[2], MOON_DAWN_RGB[2]) + ')';
                ctx.beginPath(); ctx.arc(dayNight.moonX, moonY, moonR, 0, Math.PI*2); ctx.fill();

                // 3) Kraatterit ja maret (terävinä valoisalla sirpillä, himmeinä tummalla)
                if (MOON_CRATERS.length) {
                    ctx.save();
                    ctx.beginPath(); ctx.arc(dayNight.moonX, moonY, moonR, 0, Math.PI*2); ctx.clip();
                    for (const c of MOON_CRATERS) {
                        ctx.fillStyle = 'rgba(' + MOON_CRATER_RGB[0] + ',' + MOON_CRATER_RGB[1] + ',' +
                                        MOON_CRATER_RGB[2] + ',' + c.a.toFixed(3) + ')';
                        ctx.beginPath();
                        ctx.arc(dayNight.moonX + c.x * moonR, moonY + c.y * moonR, c.r * moonR, 0, Math.PI*2);
                        ctx.fill();
                    }
                    ctx.restore();
                }

                // 4) Maavalo + pehmeä terminaattori (klipattu kuun kiekkoon)
                if (earthFade > 0.004) {
                    const esRGB = MOON_EARTHSHINE_RGB[0] + ',' + MOON_EARTHSHINE_RGB[1] + ',' + MOON_EARTHSHINE_RGB[2];
                    const steps = Math.max(1, MOON_TERMINATOR_SOFT);
                    const stepA = MOON_EARTHSHINE_A * 0.4;   // 3 porrasta → ydin ≈ MOON_EARTHSHINE_A
                    ctx.save();
                    ctx.beginPath(); ctx.arc(dayNight.moonX, moonY, moonR, 0, Math.PI*2); ctx.clip();
                    for (let i = steps - 1; i >= 0; i--) {
                        const k = 1 + (steps > 1 ? i / (steps - 1) : 0) * MOON_TERMINATOR_SPREAD;
                        ctx.fillStyle = 'rgba(' + esRGB + ',' + (stepA * earthFade).toFixed(3) + ')';
                        ctx.beginPath();
                        ctx.arc(dayNight.moonX + shadowOff, moonY + moonR * MOON_SHADOW_Y,
                                moonR * MOON_SHADOW_R * k, 0, Math.PI*2);
                        ctx.fill();
                    }
                    ctx.restore();
                }

                // 5) Pallomaisuus: reuna tummenee hiukan (limb darkening)
                if (MOON_LIMB_DARK > 0) {
                    const limb = ctx.createRadialGradient(dayNight.moonX, moonY, moonR * 0.55, dayNight.moonX, moonY, moonR);
                    limb.addColorStop(0, 'rgba(0,0,0,0)');
                    limb.addColorStop(1, 'rgba(0,0,0,' + MOON_LIMB_DARK.toFixed(3) + ')');
                    ctx.fillStyle = limb;
                    ctx.beginPath(); ctx.arc(dayNight.moonX, moonY, moonR, 0, Math.PI*2); ctx.fill();
                }
            }
            ctx.restore();
        }

    }

    /* Tähdenlento ja meteoriitti (kaikki meteoriitit tässä kerroksessa → talot peittävät ne). */
    function drawShootingStars() {
        // Tähdenlento / meteoriitti (vain yöllä)
        if (dayNight.t <= 0 && shootingStar && shootingStar.active) {
            if (shootingStar.kind === 'meteorite') {
                // KAIKKI meteoriitit piirretään tässä kerroksessa (taustasiluetti ja
                // katuvarren talot piirretään päälle) → myös tähdätty meteoriitti katoaa
                // talojen taakse juuri ennen osumaa. Pelaaja näkee vasta välähdyksen ja
                // tuhon alun, ei itse iskua (piirsi tähdätyn talojen EDELLÄ).
                drawMeteorite();
            } else {
                for (let t = 0; t < shootingStar.trail.length; t++) {
                    const tr = shootingStar.trail[t];
                    const alpha = (t / shootingStar.trail.length) * 0.5;
                    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
                    ctx.beginPath(); ctx.arc(tr.x, tr.y, 0.5, 0, Math.PI*2); ctx.fill();
                }
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.beginPath(); ctx.arc(shootingStar.x, shootingStar.y, 0.8, 0, Math.PI*2); ctx.fill();
                const sg = ctx.createRadialGradient(shootingStar.x, shootingStar.y, 0, shootingStar.x, shootingStar.y, 4);
                sg.addColorStop(0, 'rgba(255,255,255,0.35)');
                sg.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = sg;
                ctx.beginPath(); ctx.arc(shootingStar.x, shootingStar.y, 4, 0, Math.PI*2); ctx.fill();
            }
        }
    }

    /* Satelliitti: pieni vilkkuva piste, vain yöllä. */
    function drawSatellite() {
        // Satelliitti (pieni vilkkuva piste) – vain yöllä
        if (dayNight.t <= 0 && satellite && satellite.active) {
            const blink = Math.sin(satellite.blinkPhase) * 0.5 + 0.5;
            const alpha = 0.25 + blink * 0.65;
            ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
            ctx.beginPath(); ctx.arc(satellite.x, satellite.y, 1.5, 0, Math.PI*2); ctx.fill();
        }
    }

    /* Meteoriitin törmäysvälähdys: koko taivas välähtää (piirretään talojen taakse). */
    function drawMeteorFlash() {
        // Meteoriitin törmäysvälähdys: koko taivas välähtää salaman lailla (talojen takana)
        if (meteorFlash) {
            const k = meteorFlash.t / METEOR_FLASH_FRAMES;   // 1 → 0
            ctx.fillStyle = 'rgba(255,255,235,' + (0.8 * k) + ')';
            ctx.fillRect(0, 0, WORLD_W, GROUND_Y);
        }
    }

    /* Ruudun päälliskerrokset järjestyksessä: päivänvalo (additive), kuun laskun pimennys, sumuverho, oviukon iskun vinjetti + tähdet, kuoleman pimennys. */
    function drawScreenEffects() {
        // ── Päivänvalo (lopputila: kaikki 3 avainta) ──
        // Yksi additive-kerros kirkastaa koko kadun (asfaltti, talot, siluetti,
        // puut, ajoneuvot, pelaaja) ilman että yhtään piirtofunktiota tai
        // väripalettia tarvitsee säätää uudelleen. Piirretään ennen oviukon
        // vinjettiä ja kuoleman pimennystä → ne toimivat ennallaan.
        if (dayNight.t > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgba(' + DAY_LIGHT_RGB[0] + ',' + DAY_LIGHT_RGB[1] + ',' + DAY_LIGHT_RGB[2] + ',' + (DAY_LIGHT_ALPHA * dayNight.t).toFixed(3) + ')';
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
            ctx.restore();
        }

        // ── Kuu laskeutui → maisema pimenee hiukan ──
        if (dayNight.moonDark > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,' + dayNight.moonDark.toFixed(3) + ')';
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
            ctx.restore();
        }

        // ── Sumuverho (kaaos K1 / K7-kortti "Sumu nousee") ──
        // Peittävyys ≤ 0.5 (luettavuus). Vaalea harmaasävy peittää koko
        // kadun mutta jättää hahmon ja ovet erottuviksi.
        if (fogAlpha > 0.001) {
            ctx.save();
            ctx.globalAlpha = Math.min(0.5, fogAlpha);
            const fogGrad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
            fogGrad.addColorStop(0, '#aebfd0');
            fogGrad.addColorStop(1, '#8a9bab');
            ctx.fillStyle = fogGrad;
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
            ctx.restore();
        }

        // ── Oviukon isku: jäädytyksen vinjetti + iskuvälähdys + tähdet ──
        if (avenger && avenger.phase === 'hold') {
            const hk = 1 - Math.max(0, Math.min(1, hitPauseTimer / AVENGER_FREEZE));   // 0 → 1
            // Iskuvälähdys heti kontaktissa
            if (hk < 0.10) {
                ctx.fillStyle = 'rgba(255,235,205,' + (0.45 * (1 - hk / 0.10)).toFixed(3) + ')';
                ctx.fillRect(0, 0, WORLD_W, WORLD_H);
            }
            // Tummenevat reunat (vinjetti) koko 3 s jäädytyksen ajan
            const vg = ctx.createRadialGradient(WORLD_W / 2, 190, 70, WORLD_W / 2, 190, 430);
            vg.addColorStop(0, 'rgba(0,0,0,0)');
            vg.addColorStop(1, 'rgba(0,0,0,' + (0.6 * Math.min(1, hk * 1.6)).toFixed(3) + ')');
            ctx.fillStyle = vg;
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
            // Tähdet alkavat kiertää pään ympäri jo ennen kosahtamista
            const sx0 = player.x + player.w / 2, sy0 = player.y + 6;
            const st = (AVENGER_FREEZE - Math.max(0, hitPauseTimer)) * 0.07;
            ctx.strokeStyle = '#ffdd44'; ctx.lineWidth = 1;
            for (let si = 0; si < 3; si++) {
                const ang = st + si * 2.1;
                const ax2 = sx0 + Math.cos(ang) * 14, ay2 = sy0 + Math.sin(ang) * 8;
                ctx.beginPath();
                ctx.moveTo(ax2 - 2, ay2 - 2); ctx.lineTo(ax2 + 2, ay2 + 2);
                ctx.moveTo(ax2 + 2, ay2 - 2); ctx.lineTo(ax2 - 2, ay2 + 2);
                ctx.stroke();
            }
        }

        // ── Ukkosen välähdys (koko ruutu, BAD-myrsky) ──
        if (lightning && lightning.flashAlpha > 0.01) {
            ctx.fillStyle = 'rgba(255,255,255,' + lightning.flashAlpha.toFixed(3) + ')';
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
        }

        // ── Kuoleman pimennys ─────────────────────────
        if (playerDead) {
            ctx.fillStyle = 'rgba(0,0,0,' + deathAlpha + ')';
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
        }
    }

    function render() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, viewW, WORLD_H);

        if (drawRoomView()) return;

        pushWorldTransform();

        drawSkyGradient();

        drawSun();

        drawStars();

        drawMoon();
        // Pilvet (kapea cirrus/hazy-kaistale) – kuun edessä (oikein)
        drawClouds();
        // Salama pilvistä (talot peittävät alaosan – ei koskaan talojen eteen)
        drawLightningBolt();

        drawShootingStars();

        drawSatellite();

        drawMeteorFlash();

        // Kaukainen kaupunkisiluetti (parallaksi 0.4×) – tähtien/taivaan päällä, talojen takana
        drawBackdrop(camX * (1 - BACKDROP_PARALLAX));
        // Kauko-sade talojen taakse (himmeä, hidas) – BAD-myrsky
        drawRainBack();
        drawBuildings();
        // meteoriitteja ei enää piirretä talojen edessä (ks. taivashaara yllä),
        // joten tähdätty meteoriitti jää talojen ja taustasiluetin taakse.
        // Lepakot talojen EDELLÄ
        if (bats.length) { drawBats(); }
        drawGround();
        drawMoonBuildingShadows();   // kuunvarjot taloilta kadulle

        // Sähkökaapit (talojen kyljissä)
        drawElectricCabinet();

        // Mustat lehdettömät puut (raoissa)
        drawTrees();
        // Päivälinnut puiden ympärillä
        if (birds.length) { drawBirds(); }
        // Pienet ruohotupsut puiden juurella
        if (foreground) { drawTreeGrassTufts(); }

        // BAR-viittakyltti (puunraossa, osoittaa oikealle)
        drawBarSign();

        // Lamput – valo AINA hahmojen alla (valo ei peitä ketään). Pylväs sen
        // sijaan syvyysjärjestyksessä: pylvään juuri seisoo syvyysviivalla
        // LAMP_BASE_Y, joten jalkapiste viivan yläpuolella = hahmo on pylvään
        // TAKANA → pylväs piirretään vasta hahmon jälkeen. Rosvon jalkapiste on
        // kiinteä (ROBBER_FOOT_Y 314 < LAMP_BASE_Y 325) → rosvo on AINA pylvään
        // takana ja piirretään aina ennen kaikkia pylväitä.
        const lampFeetY = Math.round(player.y) + player.h - 1;
        for (const lamp of lamps) drawLampGlow(lamp);

        // Ovet – kaikkiin taloihin
        for (const bldg of buildings) drawDoor(bldg);

        // Kolikko
        if (!coin.collected) drawCoin();

        // Sädease-esine kadulla
        if (beamPickup) drawBeamPickup();

        // Kukkaruukku
        if (flowerPot && flowerPot.active) drawFlowerPot();

        // Potkusta pudonnut kolikko
        if (kickCoin) drawKickCoin();

        // Katueläin – syvyysjako lamppupylvään suhteen: takana-juokseva
        // (jalkapiste < LAMP_BASE_Y) piirretään kuten ennen pylväiden alle,
        // edellä-juokseva (jalkapiste >= LAMP_BASE_Y) vasta kaikkien pylväiden
        // jälkeen (ks. alla) – sama periaate kuin pelaajalla.
        const aFeetY = groundAnimal ? animalDepthFeet() : 0;
        if (groundAnimal && aFeetY < LAMP_BASE_Y) drawAnimal();

        // Oviukko (Avenger) – piirretään pelaajan alle
        if (avenger) drawAvenger();

        // Rosvo – partioi jalkakäytävällä. Jalat 314 < LAMP_BASE_Y 325
        // → aina pylvään TAKANA: piirretään ennen kaikkia pylväitä, jotta pylväs
        // peittää rosvon riippumatta pelaajan syvyydestä.
        if (robber) drawRobber();

        // Pelaajan EDESSÄ olevat pylväät (pelaajan jalkapiste >= LAMP_BASE_Y):
        // pylväs pelaajan alle – mutta rosvon PÄÄLLE (rosvo on aina takana).
        for (const lamp of lamps) if (lampFeetY >= LAMP_BASE_Y) drawLampPost(lamp);

        // Ajoneuvot, jotka ovat pelaajaa KAUEMPANA (ajoneuvon keskipiste Y <
        // pelaajan jalkapiste): piirretään ENNEN pelaajaa, jotta pelaaja
        // piirtyy niiden PÄÄLLE. Sama syvyysperiaate kuin lamppu-
        // pylväillä. Tässä kohtaa takapylväitä ei voi olla (ne
        // vaatisivat pelaajan jalkapisteen < LAMP_BASE_Y 325), joten autot
        // pysyvät yhä pylväiden edessä kuten ennenkin.
        if (vehicles[1] && vehicles[1].y + vehicles[1].h / 2 < lampFeetY) StreetTraffic.drawVehicle(vehicles[1]);
        if (vehicles[0] && vehicles[0].y + vehicles[0].h / 2 < lampFeetY) StreetTraffic.drawVehicle(vehicles[0]);

        // Pelaaja – avoimessa kaivossa vajoaa/kiipeää
        if (manhole.action) { drawPlayerManhole(); } else { drawPlayer(); }

        // Sädease: säde + tähtäysristikko
        drawBeam();
        // Avoin kaivo: musta aukko pelaajan PÄÄLLE pudotuksen aikana,
        // jotta pelaaja näyttää katoavan reikään
        drawManholeOverlay();

        // Sanomalehden poimintavihje pelaajan yläpuolelle
        StreetNews.drawHint();

        // Pelaajan TAKANA olevat lamppupylväät – piirretään vasta nyt, jotta
        // pylväs peittää pelaajan ja rosvon (aina takana).
        // Ennen ajoneuvoja, jotta autot pysyvät pylvään edessä kuten ennenkin.
        for (const lamp of lamps) if (lampFeetY < LAMP_BASE_Y) drawLampPost(lamp);

        // Katueläin pylvään edestä (jalkapiste >= LAMP_BASE_Y): piirretään
        // kaikkien pylväiden päälle.
        if (groundAnimal && aFeetY >= LAMP_BASE_Y) drawAnimal();

        // Ajoneuvot, jotka ovat pelaajaa LÄHEMPÄNÄ (keskipiste Y >= pelaajan
        // jalkapiste): piirretään pelaajan jälkeen kuten ennenkin.
        // Ylempi kaista (1, kauempana) ensin, alempi (0, lähempänä) päälle.
        if (vehicles[1] && vehicles[1].y + vehicles[1].h / 2 >= lampFeetY) StreetTraffic.drawVehicle(vehicles[1]);
        if (vehicles[0] && vehicles[0].y + vehicles[0].h / 2 >= lampFeetY) StreetTraffic.drawVehicle(vehicles[0]);

        // Rauta-aita (etualalla, pelaajan takana → piirretään pelaajan päälle).
        // BAD/FULL (rauniot): aitaa ei piirretä lainkaan – kadun reuna on
        // hajonnut muun kaupungin mukana (chaosFlags.ruin = BAD tai FULL).
        if (foreground && foreground.ironFence && !chaosFlags.ruin) { drawIronFence(); }
        // Ruohotupsut aidan juuressa
        if (foreground) { drawGrassTufts(); }

        // Partikkelit
        for (const p of particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x-2, p.y-2, 4, 4);
        }
        ctx.globalAlpha = 1;

        // Sade kaiken edessä (BAD-myrskyn purske)
        drawRain();

        drawScreenEffects();

        ctx.restore();
    }

    /* ── Rauhalliset ikkunavalot (0-5 kpl, 1-10min paloaika) ── */
    const litWindows = []; // { wx, wy, bldgIdx, offTime }

    function collectAllWindows() {
        const all = [];
        for (let bi = 0; bi < buildings.length; bi++) {
            const b = buildings[bi];
            for (let wy = GROUND_Y - b.h + 25; wy < GROUND_Y - 35; wy += 32) {
                for (let wx = b.x + 10; wx < b.x + b.w - 15; wx += 24) {
                    if (wx + 10 > b.x + b.w - 6) continue;
                    all.push({ wx, wy, bldgIdx: bi });
                }
            }
        }
        return all;
    }

    let _allWindows = null;
    function getAvailableWindows() {
        if (!_allWindows) _allWindows = collectAllWindows();
        // Suodata pois talot joiden valot on potkittu päälle
        return _allWindows.filter(w => {
            const idx = w.bldgIdx;
            if (idx === 0 && firstHouseWindowsLit) return false;
            if (smallHouseLights[idx] && smallHouseLights[idx].lit) return false;
            if (buildingGone(idx)) return false;   // tuhoutuneessa talossa ei ole ikkunoita
            return true;
        });
    }

    // Väriavustajat ikkunoille: keltainen (60%), sinertävä TV (20%), punertava tunnelma (20%)
    function pickColorType() {
        const r = Math.random() * 100;
        if (r < 60) return 'yellow';
        if (r < 80) return 'blue';
        return 'red';
    }

    // Deterministinen väri ikkunan sijainnin perusteella (houseLit-taloille)
    function getWindowColorType(wx, wy, bldgIdx) {
        const hash = (wx * 31 + wy * 17 + bldgIdx * 7) % 100;
        if (hash < 60) return 'yellow';
        if (hash < 80) return 'blue';
        return 'red';
    }

    function addRandomLitWindow() {
        const avail = getAvailableWindows().filter(w => 
            !litWindows.some(l => l.wx === w.wx && l.wy === w.wy && l.bldgIdx === w.bldgIdx)
        );
        if (avail.length === 0) return;
        const w = avail[Math.floor(Math.random() * avail.length)];
        // Kesto: windowDurMin..windowDurMax (kaaos K1; NORMAL 10–30 s)
        const duration = windowDurMin + Math.random() * (windowDurMax - windowDurMin);
        litWindows.push({ wx: w.wx, wy: w.wy, bldgIdx: w.bldgIdx, offTime: Date.now() + duration, colorType: pickColorType() });
    }

    function updateLitWindows() {
        const now = Date.now();
        let changed = false;
        // Poista sammuneet
        for (let i = litWindows.length - 1; i >= 0; i--) {
            if (now >= litWindows[i].offTime) {
                litWindows.splice(i, 1);
                changed = true;
            }
        }
        // Vain kun joku sammui: arvo uusi tavoite 0..windowTargetMax
        if (changed) {
            const target = Math.floor(Math.random() * (windowTargetMax + 1));
            while (litWindows.length < target) addRandomLitWindow();
            while (litWindows.length > windowTargetMax) litWindows.shift();
        }
    }

    function isWindowLit(wx, wy, bldgIdx) {
        return litWindows.some(w => w.wx === wx && w.wy === wy && w.bldgIdx === bldgIdx);
    }

    // Apufunktio: vaalentaa hex-väriä lisäämällä offsetin RGB-kanaviin
    function lightenHex(hex, offset) {
        /* Bugikorjaus: vahti – jos tulo ei ole #rrggbb, palautetaan se
           sellaisenaan. Muuten parseInt tuottaisi NaN → '#NaNNaNxx', jonka selain
           hylkää hiljaa (canvas jäisi edelliseen väriin). NORMAL: hex sisään →
           bitti-identtinen ulos. */
        if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
        const r = Math.min(255, parseInt(hex.slice(1,3), 16) + offset);
        const g = Math.min(255, parseInt(hex.slice(3,5), 16) + offset);
        const b = Math.min(255, parseInt(hex.slice(5,7), 16) + offset);
        return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
    }

    // Interpoloi kahden hex-värin välillä (t 0 = a, 1 = b) – päivä/yö-siirtymät
    function mixHex(a, b, t) {
        if (t <= 0) return a;
        if (t >= 1) return b;
        /* vahti – ei-hex tai kelvoton t palauttaa a:n (ennen: '#NaNNaNxx'
           tai läpinäkyväksi tulkittu '#000000' → "musta maski" kesken siirtymän). */
        if (typeof a !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(a)) return a;
        if (typeof b !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(b)) return a;
        if (!Number.isFinite(t)) return a;
        const ca = parseInt(a.slice(1), 16), cb = parseInt(b.slice(1), 16);
        const ch = v => (v & 255).toString(16).padStart(2, '0');
        const r  = Math.round(((ca >> 16) & 255) + (((cb >> 16) & 255) - ((ca >> 16) & 255)) * t);
        const g  = Math.round(((ca >> 8) & 255) + (((cb >> 8) & 255) - ((ca >> 8) & 255)) * t);
        const bl = Math.round((ca & 255) + ((cb & 255) - (ca & 255)) * t);
        return '#' + ch(r) + ch(g) + ch(bl);
    }
    // Päivällä tumma ikkunalasi vaalenee taivaan heijastukseksi: tavalliset talot
    // #151716, 3-riviset (kauempana) hiukan tummempaa syvyyden takia.
    let WIN_DAY_FILL      = '#151716';   // kaaos K1
    const WIN_DAY_FILL_FLAT = '#101110';

    // Siluetin todennäköisyys keltaisessa ikkunassa (0.50 = testaus, myöhemmin 0.05)
    let SILHOUETTE_CHANCE = 0.50;   // kaaos K1

    function shouldShowSilhouette(wx, wy, bldgIdx, colorType) {
        if (colorType !== 'yellow') return false;
        const hash = (wx * 13 + wy * 29 + bldgIdx * 41) % 1000;
        return hash < SILHOUETTE_CHANCE * 1000;
    }

    function drawSilhouette(wx, wy) {
        // Pieni tumma figuuri 10×14 ikkunassa (seisoo alalaidalla)
        const cx = wx + 5, cy = wy;
        // Pää – tummempi
        ctx.fillStyle = 'rgba(6,3,1,0.72)';
        ctx.beginPath();
        ctx.arc(cx, cy + 5.8, 1.8, 0, Math.PI * 2);
        ctx.fill();
        // Hartiat – selkeästi leveät, tunnistettava siluetti
        ctx.fillStyle = 'rgba(8,4,1,0.62)';
        ctx.fillRect(cx - 2.0, cy + 8, 4.0, 1.1);
        // Vartalo – selvästi kapeampi, kapenee jalkoihin
        ctx.beginPath();
        ctx.moveTo(cx - 1.0, cy + 9.1);
        ctx.lineTo(cx + 1.0, cy + 9.1);
        ctx.lineTo(cx + 0.6, cy + 13);
        ctx.lineTo(cx - 0.6, cy + 13);
        ctx.closePath();
        ctx.fill();
    }

    /* Kylvä 0..windowTargetMax ikkunaa heti palamaan. Kutsutaan moduulin latauksessa
       (alla) ja aina kun talojärjestys vaihtuu – ks. shuffle/resetBuildingOrder,
       bugikorjaus. */
    function seedLitWindows() {
        for (let i = 0; i < Math.floor(Math.random() * (windowTargetMax + 1)); i++) addRandomLitWindow();
    }
    seedLitWindows();

    // Palauttaa ikkunan värit tyypin perusteella: keltainen, sinertävä (TV), punertava (tunnelma)
    function getWindowColors(colorType, wx, wy) {
        const dt = Date.now() * 0.001;
        const f1 = 0.92 + Math.sin(dt*2.3 + wx*0.07 + wy*0.13)*0.08;
        let r, g, b, glowR, glowG, glowB;
        if (colorType === 'blue') {
            // Sinertävä TV-valo: kylmä sinivalkoinen
            r = Math.floor(60 + Math.sin(dt*1.9+wy*0.1)*15);
            g = Math.floor(150 + Math.sin(dt*2.1+wx*0.08)*20);
            b = Math.floor(220 + Math.sin(dt*1.5+wy*0.06)*10);
            glowR = 80; glowG = 180; glowB = 255;
        } else if (colorType === 'red') {
            // Punertava tunnelmavalo: lämmin oranssi/punainen
            r = Math.floor(230 + Math.sin(dt*1.9+wy*0.1)*10);
            g = Math.floor(55 + Math.sin(dt*2.1+wx*0.08)*15);
            b = Math.floor(25 + Math.sin(dt*1.5+wy*0.06)*15);
            glowR = 255; glowG = 80; glowB = 60;
        } else {
            // Keltainen (oletus): eri keltaisen sävyjä
            r = Math.floor(240 + Math.sin(dt*1.9+wy*0.1)*10);
            g = Math.floor(195 + Math.sin(dt*2.1+wx*0.08)*15);
            b = Math.floor(75 + Math.sin(dt*1.5+wy*0.06)*20);
            glowR = 255; glowG = 200; glowB = 80;
        }
        const fillAlpha = (0.72 * f1).toFixed(3);
        return {
            fill: `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${fillAlpha})`,
            stroke: `rgba(${Math.floor(r*1.08)},${Math.floor(g*0.95)},${Math.floor(b*1.3)},0.55)`,
            glow0: `rgba(${glowR},${glowG},${glowB},0.22)`,
            glow1: `rgba(${glowR},${glowG},${glowB},0)`
        };
    }

    // Apufunktio: ikkunarivien määrä talolle (sama logiikka kuin drawBuildingsin ikkunasilmukka)
    function buildingWindowRows(b) {
        return Math.ceil((b.h - 60) / 32);
    }

    // Syvyysefekti: matalampi talo = kauempana = pienempi
    // 5 riviä = 100 %, 4 riviä = 95 %, 3 riviä = 90 %
    function buildingScale(b) {
        const rows = buildingWindowRows(b);
        if (rows >= 5) return 1.00;
        if (rows === 4) return 0.95;
        return 0.90;
    }

    function drawBuildings() {
        for (const b of buildings) {
            const idx = buildings.indexOf(b);
            // tuhoutuneen talon paikalle jää musta romukasa (drawRubble),
            // tuhoutuva piirretään omalla animaatiollaan (drawCollapsingBuilding).
            const dmgState = buildingDmg[idx];
            if (dmgState === 'gone') { drawRubble(b, idx); continue; }
            if (dmgState) { drawCollapsingBuilding(b, idx, dmgState); continue; }
            // Runko – käytä talon omaa yönsävyä, fallback jos puuttuu
            const bodyC = b.bodyColor || '#1a1a2e';
            // Syvyysefekti: skaalaa talo pohjan keskipisteen ympäri (ovet pysyvät paikoillaan)
            const s = buildingScale(b);
            // Taaimmaiset talot (3 ikkunariviä, skaala 90 %): ei vaaleita ulkokehyksiä
            // → ikkunat painuvat seinään ja näyttävät pienemmiltä (syvyysvaikutelma)
            const flatWindows = buildingWindowRows(b) <= 3;
            const cx = b.x + b.w / 2;
            ctx.save();
            ctx.translate(cx, GROUND_Y);
            ctx.scale(s, s);
            ctx.translate(-cx, -GROUND_Y);
            ctx.fillStyle = bodyC;
            ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
            // Ikkunat
            const houseLit = !StreetChaosCards.lightsOut && ((idx === 0 && firstHouseWindowsLit) || (smallHouseLights[idx] && smallHouseLights[idx].lit));
            // Oven "ei-ikkunaa" -alue (sis. +2px syvennysreunus) – ikkunoita ei piirretä oven taakse
            const dLeft = b.x + b.w / 2 - DOOR_W / 2 - 2;
            const dTop = GROUND_Y - DOOR_H - 2;
            const dRight = dLeft + DOOR_W + 4;
            for (let wy = GROUND_Y - b.h + 25; wy < GROUND_Y - 35; wy += 32) {
                for (let wx = b.x + 10; wx < b.x + b.w - 15; wx += 24) {
                    if (wx + 10 > b.x + b.w - 6) continue;
                    // Ohita ikkuna joka jää oven (tai sen kehyksen) taakse
                    if (wx + 10 > dLeft && wx < dRight && wy + 14 > dTop) continue;
                    if (houseLit) {
                        const ct = getWindowColorType(wx, wy, idx);
                        const wc = getWindowColors(ct, wx, wy);
                        ctx.fillStyle = wc.fill;
                        ctx.fillRect(wx, wy, 10, 14);
                        if (shouldShowSilhouette(wx, wy, idx, ct)) drawSilhouette(wx, wy);
                        if (!flatWindows) {
                            ctx.strokeStyle = wc.stroke; ctx.lineWidth = 1;
                            ctx.strokeRect(wx, wy, 10, 14);
                        }
                        const glow = ctx.createRadialGradient(wx+5, wy+7, 1, wx+5, wy+7, 12);
                        glow.addColorStop(0, wc.glow0);
                        glow.addColorStop(1, wc.glow1);
                        ctx.fillStyle = glow;
                        ctx.fillRect(wx-6, wy-5, 22, 24);
                    } else {
                        const litWin = StreetChaosCards.lightsOut ? null : litWindows.find(w => w.wx === wx && w.wy === wy && w.bldgIdx === idx);
                        if (litWin) {
                            const ct = litWin.colorType || 'yellow';
                            const wc = getWindowColors(ct, wx, wy);
                            ctx.fillStyle = wc.fill;
                            ctx.fillRect(wx, wy, 10, 14);
                            if (shouldShowSilhouette(wx, wy, idx, ct)) drawSilhouette(wx, wy);
                            if (!flatWindows) {
                                ctx.strokeStyle = wc.stroke; ctx.lineWidth = 1;
                                ctx.strokeRect(wx, wy, 10, 14);
                            }
                            const glow = ctx.createRadialGradient(wx+5, wy+7, 1, wx+5, wy+7, 12);
                            glow.addColorStop(0, wc.glow0);
                            glow.addColorStop(1, wc.glow1);
                            ctx.fillStyle = glow;
                            ctx.fillRect(wx-6, wy-5, 22, 24);
                        } else {
                            // 3 rivin talot (flatWindows): ei kehystä → ikkuna erottuu syvennyksenä.
                            // Tummempi täyttö + 1 px tumma ylävarjo + 1 px vaalea alaparre = upotus seinässä.
                            // Päivällä täyttö vaalenee taivaan heijastukseksi (WIN_DAY_FILL*);
                            // valaistut ikkunat ja kaikki toiminta ennallaan.
                            ctx.fillStyle = mixHex(flatWindows ? '#05050d' : '#0a0a15',
                                                   flatWindows ? WIN_DAY_FILL_FLAT : WIN_DAY_FILL, dayNight.t);
                            ctx.fillRect(wx, wy, 10, 14);
                            if (flatWindows) {
                                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                                ctx.fillRect(wx, wy, 10, 1);
                                ctx.fillStyle = lightenHex(bodyC, 0x06);
                                ctx.fillRect(wx, wy + 14, 10, 1);
                            } else {
                                ctx.strokeStyle = '#2a2a3e'; ctx.lineWidth = 1;
                                ctx.strokeRect(wx, wy, 10, 14);
                            }
                        }
                    }
                }
            }
            // Yläreuna / lippa – tyyli arvottu per talo
            drawCornice(b, bodyC);
            /* Makuuhuone (talo 7): sininen HOSTEL-neonkyltti julkisivussa.
               Kyltti piirretään tässä, joten se seuraa taloa myös BAD/FULLin
               järjestyssekotuksessa ja katoaa talon tuhoutuessa. */
            if (idx === SLEEP_BLDG_IDX) drawHostelSign(b);
            /* Hedelmäpelitalo (buildings[6]): neonvihreä CASINO-kyltti
               katon yläpuolella. Sama logiikka: seuraa taloa BAD/FULLin
               järjestyssekotuksessa ja katoaa talon tuhoutuessa. */
            if (idx === FRUIT_BLDG_IDX) drawCasinoSign(b);
            ctx.restore();
        }
    }

    /* ── Taloja koskevat apurit ─────────────────────────────────── */

    /* Talon ikkunaruudukko (kopio drawBuildingsin silmukasta): kutsuu cb(wx, wy)
       jokaiselle ikkunalle, ohittaen oven taakse jäävät. Ehjä talo piirretään
       edelleen drawBuildingsin omalla koodillaan – tämä on tuhoutumispiirron
       tarpeisiin eikä muuta ehjän talon ulkoasua mitenkään. */
    function forEachBuildingWindow(b, cb) {
        const dLeft = b.x + b.w / 2 - DOOR_W / 2 - 2;
        const dTop = GROUND_Y - DOOR_H - 2;
        const dRight = dLeft + DOOR_W + 4;
        for (let wy = GROUND_Y - b.h + 25; wy < GROUND_Y - 35; wy += 32) {
            for (let wx = b.x + 10; wx < b.x + b.w - 15; wx += 24) {
                if (wx + 10 > b.x + b.w - 6) continue;
                if (wx + 10 > dLeft && wx < dRight && wy + 14 > dTop) continue;
                cb(wx, wy);
            }
        }
    }

    /* Tuhoutuvan talon piirto: vaiheet
         0 flash   – runko ennallaan, KAIKKI ikkunat keltaisina
         1 shake   – sama, mutta talo tärisee (talokohtainen jitter)
         2 black   – seinät ja ikkunat mustiksi (hiiltyy)
         3 burn    – musta massa hehkuu keltaiseksi, ääriviivat alkavat erottua
         4 outline – talo läpinäkyvä: jäljellä vain mustat ääriviivat
         5 fade    – ääriviivat häipyvät → talo katoaa ('gone')
       Kaikki piirretään talon omassa skaalassa (buildingScale), kuten muukin
       talopiirto, jotta syvyysvaikutelma säilyy. */
    function drawCollapsingBuilding(b, idx, d) {
        const s = buildingScale(b);
        const cx = b.x + b.w / 2;
        const bodyC = b.bodyColor || '#1a1a2e';
        const topY = GROUND_Y - b.h;
        const phase = d.phase;
        // Vaihe 1: talokohtainen tärinä (koko ruudun tärinä on erikseen osumahetkellä)
        let jx = 0, jy = 0;
        if (phase === 1) {
            jx = Math.round(Math.sin(d.t * 1.7) * 2);
            jy = Math.round(Math.cos(d.t * 2.3));
        }
        ctx.save();
        ctx.translate(cx + jx, GROUND_Y + jy);
        ctx.scale(s, s);
        ctx.translate(-cx, -GROUND_Y);

        if (phase <= 1) {
            // 0–1: runko ennallaan, kaikki ikkunat keltaisina + hehku
            ctx.fillStyle = bodyC;
            ctx.fillRect(b.x, topY, b.w, b.h);
            forEachBuildingWindow(b, (wx, wy) => {
                const wc = getWindowColors('yellow', wx, wy);
                ctx.fillStyle = wc.fill;
                ctx.fillRect(wx, wy, 10, 14);
                const glow = ctx.createRadialGradient(wx + 5, wy + 7, 1, wx + 5, wy + 7, 12);
                glow.addColorStop(0, wc.glow0);
                glow.addColorStop(1, wc.glow1);
                ctx.fillStyle = glow;
                ctx.fillRect(wx - 6, wy - 5, 22, 24);
            });
        } else if (phase === 2) {
            // 2: seinät ja ikkunat mustiksi (hiiltyy), hiilloksen punerrus ikkunan alareunassa
            ctx.fillStyle = BLDG_DMG_BLACK_C;
            ctx.fillRect(b.x, topY, b.w, b.h);
            forEachBuildingWindow(b, (wx, wy) => {
                ctx.fillStyle = '#050507';
                ctx.fillRect(wx, wy, 10, 14);
                ctx.fillStyle = 'rgba(255,170,60,0.14)';
                ctx.fillRect(wx, wy + 12, 10, 2);
            });
        } else if (phase === 3) {
            // 3: musta massa alkaa hehkua keltaiseksi (koko massa, hehku pohjalta)
            const k = Math.min(1, d.t / BLDG_DMG_BURN);
            ctx.fillStyle = mixHex(BLDG_DMG_BLACK_C, BLDG_DMG_YELLOW, k);
            ctx.fillRect(b.x, topY, b.w, b.h);
            const gl = ctx.createLinearGradient(0, GROUND_Y, 0, topY);
            gl.addColorStop(0, 'rgba(255,205,80,' + (0.30 * k).toFixed(3) + ')');
            gl.addColorStop(1, 'rgba(255,150,30,0)');
            ctx.fillStyle = gl;
            ctx.fillRect(b.x - 8, topY, b.w + 16, b.h);
            // Mustat ääriviivat alkavat erottua massan päältä
            ctx.strokeStyle = 'rgba(0,0,0,' + (0.30 + 0.70 * k).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.strokeRect(b.x + 0.5, topY + 0.5, b.w - 1, b.h - 1);
            forEachBuildingWindow(b, (wx, wy) => ctx.strokeRect(wx + 0.5, wy + 0.5, 9, 13));
        } else {
            // 4–5: talo on läpinäkyvä – jäljellä vain mustat ääriviivat
            // (ulkoreuna, kattolista ja ikkunaristikko), jotka häipyvät pois.
            const k = (phase >= 5) ? Math.max(0, 1 - d.t / BLDG_DMG_FADE) : 1;
            ctx.globalAlpha = k;
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(b.x + 0.5, topY + 0.5, b.w - 1, b.h - 1);
            forEachBuildingWindow(b, (wx, wy) => ctx.strokeRect(wx + 0.5, wy + 0.5, 9, 13));
            ctx.beginPath();
            ctx.moveTo(b.x, topY + 3); ctx.lineTo(b.x + b.w, topY + 3);
            ctx.moveTo(b.x + 2, topY); ctx.lineTo(b.x + b.w - 2, topY);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    /* tuhoutuneen talon romukasa – randomi musta kasa tuhkaharmaalla
       ääriviivalla (erottuu kiveyksestä), korkeus enintään RUBBLE_H_MAX eli
       puoli ovenkorkeudesta. Piirretään talon omassa syvyysskaalassa, kuten
       muukin talopiirto. */
    function drawRubble(b, idx) {
        const r = buildingRubble[idx];
        if (!r) return;
        const s = buildingScale(b);
        const cx = b.x + b.w / 2;
        ctx.save();
        ctx.translate(cx, GROUND_Y);
        ctx.scale(s, s);
        ctx.translate(-cx, -GROUND_Y);
        const x0 = b.x + r.x;
        ctx.fillStyle = mixHex('#08080a', '#2e2b27', r.shade);
        ctx.beginPath();
        ctx.moveTo(x0, GROUND_Y + 1);
        for (const l of r.lumps) {
            const lx = x0 + r.w * l.f;
            ctx.lineTo(lx - l.w / 2, GROUND_Y - l.h * 0.45);
            ctx.lineTo(lx, GROUND_Y - l.h);
            ctx.lineTo(lx + l.w / 2, GROUND_Y - l.h * 0.45);
        }
        ctx.lineTo(x0 + r.w, GROUND_Y + 1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(96,92,86,0.40)';   // tuhka: kasa luettavaksi
        ctx.lineWidth = 1;
        ctx.stroke();
        /* vaaleat savukiekurat tuhoutuneen talon päältä (vain BAD/FULL).
           Piirretään skaalatussa koordinaatistossa (ctx.save jo tehty). */
        if (r.smokeParticles && r.smokeParticles.length) {
            for (const p of r.smokeParticles) {
                const a = Math.max(0, Math.min(p.alpha, 0.5));
                if (a < 0.01) continue;
                ctx.fillStyle = 'rgba(195,205,215,' + a.toFixed(3) + ')';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    /* ── Kaukaisen kaupungin siluetti – piirto ── */
    // bgShift = kameran "jälkeenjäävä" siirto kerrokselle (render antaa camX*(1-0.4)).
    function drawBackdrop(bgShift) {
        if (!backdrop) return;
        ctx.save();
        ctx.translate(Math.round(bgShift), 0);
        for (const b of backdrop.blocks) drawBackdropBlock(b);
        // Ilmaperspektiivi: ohut sinertävä huntu horisontin yläpuolella häivyttää siluetin kärkiä
        const haze = ctx.createLinearGradient(0, GROUND_Y - 120, 0, GROUND_Y);
        haze.addColorStop(0, 'rgba(120,140,190,0)');
        haze.addColorStop(1, 'rgba(120,140,190,0.05)');
        ctx.fillStyle = haze;
        ctx.fillRect(0, GROUND_Y - 120, WORLD_W, 120);
        ctx.restore();
    }

    function drawBackdropBlock(b) {
        // meteoriitin osuma jättää raunion (ks. ruinBackdropBlock)
        if (b.ruin) { drawBackdropRuin(b); return; }
        const topY = BACKDROP_BASE_Y - b.h;
        // Runko – litteä haalea sävy (ei gradienttia: kaukainen kohde)
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, topY, b.w, b.h);

        // Ikkunaristikko – runkoa tummempi, ilman reunoja ja glow'ta (skaalattu 50 %)
        ctx.fillStyle = '#0f1424';
        for (let r = 0; r < b.winRows; r++) {
            for (let c = 0; c < b.winCols; c++) {
                const wx = b.x + BACKDROP_WIN_OX + c * BACKDROP_WIN_DX;
                const wy = topY + BACKDROP_WIN_OY + r * BACKDROP_WIN_DY;
                if (wx + BACKDROP_WIN_W > b.x + b.w - BACKDROP_WIN_OX) continue;    // ei reunan yli
                if (wy + BACKDROP_WIN_H > BACKDROP_BASE_Y - BACKDROP_WIN_OY) continue;
                ctx.fillRect(wx, wy, BACKDROP_WIN_W, BACKDROP_WIN_H);
            }
        }

        // Yksi himmeä lämmin ikkuna (jos lohkolle arvottu)
        if (b.lit) {
            const wx = b.x + BACKDROP_WIN_OX + b.lit.c * BACKDROP_WIN_DX;
            const wy = topY + BACKDROP_WIN_OY + b.lit.r * BACKDROP_WIN_DY;
            ctx.fillStyle = 'rgba(255,214,150,0.10)';
            ctx.fillRect(wx, wy, BACKDROP_WIN_W, BACKDROP_WIN_H);
        }

        // Katto – 4 mallia (skaalattu 50 %)
        const topC = lightenHex(b.color, 0x08);
        switch (b.roof) {
            case 0: // tasakatto + parapet
                ctx.fillStyle = topC;
                ctx.fillRect(b.x - 1, topY - 2, b.w + 2, 2);
                break;
            case 1: // porrastettu (2 askelmaa)
                ctx.fillStyle = topC;
                ctx.fillRect(b.x + Math.floor(b.w * 0.3), topY - 2, Math.ceil(b.w * 0.4), 2);
                ctx.fillStyle = topC;
                ctx.fillRect(b.x - 1, topY - 4, b.w + 2, 2);
                break;
            case 2: // harjakatto (vinot laidat)
                ctx.fillStyle = topC;
                ctx.beginPath();
                ctx.moveTo(b.x - 1, topY);
                ctx.lineTo(b.x + b.w / 2, topY - 4);
                ctx.lineTo(b.x + b.w + 1, topY);
                ctx.closePath();
                ctx.fill();
                break;
            case 3: { // kattolaite (vesitorni / antenni / hormi) – paikka kiinteä initistä
                const dx = b.x + Math.round(b.w * b.deviceX);
                if (b.device === 0) {
                    // vesitorni: ohut jalka + säiliö
                    ctx.fillStyle = topC;
                    ctx.fillRect(dx - 1, topY - 5, 2, 5);
                    ctx.fillRect(dx - 3, topY - 8, 6, 3);
                } else if (b.device === 1) {
                    // antenni: ohut pystysauva
                    ctx.fillStyle = topC;
                    ctx.fillRect(dx, topY - 6, 1, 6);
                } else {
                    // hormi
                    ctx.fillStyle = topC;
                    ctx.fillRect(dx - 2, topY - 4, 4, 4);
                }
                break;
            }
        }

        // Reunalista (band) – ohut vaaleampi viiva rungon yläosassa
        if (b.band) {
            ctx.fillStyle = lightenHex(b.color, 0x06);
            ctx.fillRect(b.x, topY + 3, b.w, 1);
        }
    }

    /* taustarivin RAUNIO – iso kerrostalo ei katoa kokonaan. Seinät ovat
       poissa, joten horisonttiin jää runko: pystypalkit + laattaviivat, ja
       pohjassa 1–3 seinäpalaa. Sama litteä, kaukainen tyyli kuin ehjässä
       lohkossa (ei ikkunaristikkoa, ei glowia, ei kattoa). */
    function drawBackdropRuin(b) {
        const r = b.ruin;
        const baseY = BACKDROP_BASE_Y;
        const topY = baseY - r.stub;
        const frameC = lightenHex(b.color, 0x08);   // runko: hitusen vaaleampi sävy
        // Seinäpalat (muutama osa seinistä jäi pystyyn) – talon oma sävy
        for (const w of r.walls) {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x + w.x, baseY - w.h, w.w, w.h);
            ctx.fillStyle = frameC;                 // murtunut yläreuna erottuu
            ctx.fillRect(b.x + w.x, baseY - w.h, w.w, 1);
        }
        // Laattaviivat (kerrokset) – runko näkyy, kun seinät ovat poissa
        ctx.fillStyle = frameC;
        for (const f of r.slabs) ctx.fillRect(b.x, baseY - f, b.w, 1);
        // Pystypalkit kantavat jäljellä olevan rungon
        for (const c of r.cols) ctx.fillRect(b.x + c, topY, 2, r.stub);
    }

    /* ── Sähkökaapit (talojen kyljissä, kerrostalon vas. seinä) ── */
    function drawElectricCabinet() {
        for (const c of electricCabinets) {
            if (c.bldgIdx !== undefined && buildingGone(c.bldgIdx)) continue;   // kaappi katosi talon mukana
            const cx = c.x, cy = c.y + 5, cw = c.w, ch = c.h;
            const centerX = cx + cw / 2;

            // Runko (harmaa metalli) – pelkkä laatikko
            ctx.fillStyle = '#55555c';
            ctx.fillRect(cx, cy, cw, ch);
            ctx.fillStyle = '#6c6c74';
            ctx.fillRect(cx + 1, cy + 1, cw - 2, 2);
            ctx.strokeStyle = '#2b2b31';
            ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);

            // Etuluukku
            ctx.fillStyle = '#48484f';
            ctx.fillRect(cx + 2, cy + 5, cw - 4, ch - 7);
            ctx.fillStyle = '#3d3d43';
            ctx.fillRect(cx + 2, cy + 5, cw - 4, 1);

            // Vilkkuva keltainen varoitusvalo yläosassa – vain jos kaappi on päällä;
            // jokaisella kaapilla oma vaihe ja tahti → valot vilkkuvat itsenäisesti.
            let on = c.on && Math.sin(Date.now() / c.period + c.phase) > 0;
            // Kaaos: valo "rätisee" – nopea epäsäännöllinen välkyntä päälle/pois
            if (cabFlicker > 0 && c.on) {
                const t = Date.now() * 0.001;
                const crackle = Math.sin(t * 31.7 + c.phase * 5) * Math.sin(t * 17.3 + c.x);
                if (crackle > 1 - cabFlicker * 0.6) on = true;
                else if (crackle < -1 + cabFlicker * 0.6) on = false;
            }
            if (on) {
                ctx.fillStyle = '#ffd700';
                ctx.beginPath();
                ctx.arc(centerX, cy - 2, 2.5, 0, Math.PI * 2);
                ctx.fill();
                const glow = ctx.createRadialGradient(centerX, cy - 2, 0.5, centerX, cy - 2, 7);
                glow.addColorStop(0, 'rgba(255,215,0,0.6)');
                glow.addColorStop(1, 'rgba(255,215,0,0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(centerX, cy - 2, 7, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = '#4a4410';
                ctx.beginPath();
                ctx.arc(centerX, cy - 2, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Lippatyylit (0–6): erilaisia kattolippoja
    function drawCornice(b, bodyC) {
        const topY = GROUND_Y - b.h;
        const topC = lightenHex(bodyC, 0x0e);
        const topC2 = lightenHex(bodyC, 0x06);
        const topCDark = lightenHex(bodyC, 0x04);

        switch (b.corniceType || 0) {
            case 0: // Tasainen peruslippa (alkuperäinen)
                ctx.fillStyle = topC;
                ctx.fillRect(b.x - 2, topY - 3, b.w + 4, 5);
                break;
            case 1: // Leveä uloke
                ctx.fillStyle = topC2;
                ctx.fillRect(b.x - 2, topY - 2, b.w + 4, 3);
                ctx.fillStyle = topC;
                ctx.fillRect(b.x - 6, topY - 6, b.w + 12, 4);
                break;
            case 2: // Porrastettu (3 askelmaa)
                ctx.fillStyle = topC2;
                ctx.fillRect(b.x - 1, topY - 2, b.w + 2, 3);
                ctx.fillStyle = topC;
                ctx.fillRect(b.x - 3, topY - 5, b.w + 6, 3);
                ctx.fillStyle = topCDark;
                ctx.fillRect(b.x - 4, topY - 8, b.w + 8, 3);
                break;
            case 3: // Kaksoiskaista
                ctx.fillStyle = topC;
                ctx.fillRect(b.x - 3, topY - 4, b.w + 6, 3);
                ctx.fillStyle = topC2;
                ctx.fillRect(b.x - 3, topY - 8, b.w + 6, 3);
                ctx.fillStyle = bodyC;
                ctx.fillRect(b.x - 3, topY - 7, b.w + 6, 1);
                break;
            case 4: // Viistetty / trapezoidi (leveämpi alhaalta)
                ctx.fillStyle = topC;
                ctx.fillRect(b.x - 5, topY - 3, b.w + 10, 7);
                ctx.fillStyle = topC2;
                ctx.fillRect(b.x - 2, topY - 7, b.w + 4, 4);
                break;
            case 5: // Hammasrivikoriste (dentil)
                ctx.fillStyle = topC;
                ctx.fillRect(b.x - 3, topY - 6, b.w + 6, 5);
                ctx.fillStyle = topC2;
                ctx.fillRect(b.x - 3, topY - 9, b.w + 6, 3);
                // Pienet pystyhampaat
                ctx.fillStyle = topCDark;
                const dentW = 5, gap = 6, count = Math.floor(b.w / (dentW + gap));
                const startX = b.x + (b.w - count * (dentW + gap) + gap) / 2;
                for (let d = 0; d < count; d++) {
                    ctx.fillRect(startX + d * (dentW + gap), topY - 6, dentW, 5);
                }
                break;
            case 6: // Ohut moderni
                ctx.fillStyle = topC;
                ctx.fillRect(b.x - 1, topY - 3, b.w + 2, 4);
                ctx.fillStyle = topC2;
                ctx.fillRect(b.x - 4, topY - 5, b.w + 8, 2);
                break;
        }
    }

    /* ── Musta lehdetön puu (siluetti taivasta vasten) ── */
    // swayX = latvan vaakasiirto tuulen mukana (px). Tyvi pysyy maassa kiinni,
    // siirto kasvaa korkeuden mukaan → puu taipuu, ei kaadu jäykkänä.
    /* ── Päivälinnut (ruskea siluetti puiden ympärillä) ── */
    function drawBirds() {
        for (const b of birds) {
            let curSize = b.wingSize;
            if (b.fadeTimer > 0 && b.fadeDuration > 0) {
                curSize = b.wingSize * Math.max(0, b.fadeTimer / b.fadeDuration);
            }
            if (curSize < 0.5) continue;
            const s = curSize;
            const bodyR = Math.max(1.5, s * 0.28);
            ctx.fillStyle = b.color;

            if (b.perched) {
                // Istuu: pieni ruumis + pää
                ctx.beginPath();
                ctx.arc(b.x, b.y, bodyR * 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(b.x + 1.5, b.y - bodyR * 0.3, bodyR * 0.4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Lentää: siivenisku kuten lepakoilla
                const t = Date.now() * 0.005 + b.flapPhase;
                const flap = Math.sin(t);
                const spread = Math.abs(flap);
                const span = s * (0.25 + spread * 0.75);
                const rise = s * 0.45 * spread;

                ctx.beginPath();
                ctx.moveTo(b.x - bodyR * 0.3, b.y - bodyR * 0.5);
                ctx.quadraticCurveTo(
                    b.x - span * 0.6, b.y - bodyR - rise * 0.5,
                    b.x - span, b.y - bodyR - rise
                );
                ctx.lineTo(b.x - span * 0.7, b.y + bodyR * 0.3);
                ctx.lineTo(b.x - bodyR * 0.2, b.y + bodyR * 0.8);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(b.x + bodyR * 0.3, b.y - bodyR * 0.5);
                ctx.quadraticCurveTo(
                    b.x + span * 0.6, b.y - bodyR - rise * 0.5,
                    b.x + span, b.y - bodyR - rise
                );
                ctx.lineTo(b.x + span * 0.7, b.y + bodyR * 0.3);
                ctx.lineTo(b.x + bodyR * 0.2, b.y + bodyR * 0.8);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.arc(b.x, b.y, bodyR, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawBareTree(cx, baseY, h, swayX) {
        if (!swayX) swayX = 0;
        // Korkeuden mukaan kasvava taipuma (0 tyvessä, täysi latvassa)
        const offAt = (y) => {
            const rel = Math.max(0, Math.min(1, (baseY - y) / h));
            return swayX * rel * Math.sqrt(rel);   // rel^1.5 – pehmeä taipuma
        };
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#000';
        ctx.lineCap = 'round';

        const trunkH = h * 0.45;
        const trunkW = Math.max(2, h * 0.16);

        // Runko (tyvestä leveämpi, latvaa kohti kapeampi) – tyvi ankkuroitu
        ctx.beginPath();
        ctx.moveTo(cx - trunkW * 0.5, baseY);
        ctx.lineTo(cx + trunkW * 0.5, baseY);
        ctx.lineTo(cx + trunkW * 0.18 + offAt(baseY - trunkH), baseY - trunkH);
        ctx.lineTo(cx - trunkW * 0.18 + offAt(baseY - trunkH), baseY - trunkH);
        ctx.closePath();
        ctx.fill();

        // Deterministinen 2D-kohina (sama tulos joka ruudulla → ei välkyntää)
        function noise2(x, y) {
            const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            return s - Math.floor(s); // [0,1)
        }

        // Haarat – orgaaninen, epäsymmetrinen rekursio (deterministinen kohina)
        // Piirrossa pisteet siirretään tuulen taipuman mukaan: alku- ja loppupiste
        // saavat saman siirron kuin y-koordinaatti → haarat pysyvät kiinni toisissaan.
        function branch(x, y, ang, len, w, depth) {
            if (len < 1.5 || w < 0.5 || depth > 7) return;
            const x2 = x + Math.cos(ang) * len;
            const y2 = y + Math.sin(ang) * len;
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(x + offAt(y), y);
            ctx.lineTo(x2 + offAt(y2), y2);
            ctx.stroke();

            // Epäsymmetrinen haarautuminen: kulmat, pituudet ja leveydet vaihtelevat
            const n1 = noise2(x2, y2);
            const n2 = noise2(y2 + 3.1, x2 - 2.7);
            const spread = 0.3 + n1 * 0.45;            // 0.3–0.75 rad
            const bend = (n2 - 0.5) * 0.6;             // koko latvan taivutussuunta
            const lenL = len * (0.6 + n1 * 0.25);      // 0.6–0.85
            const lenR = len * (0.6 + n2 * 0.25);
            const w2 = w * 0.62;
            branch(x2, y2, ang - spread + bend, lenL, w2, depth + 1);
            branch(x2, y2, ang + spread * (0.7 + n2 * 0.6) + bend, lenR, w2 * (0.9 + n1 * 0.2), depth + 1);
        }

        const topY = baseY - trunkH;
        branch(cx, topY, -Math.PI / 2, h * 0.52, trunkW * 0.4, 0);
        branch(cx, topY, -Math.PI / 2 - 0.85, h * 0.42, trunkW * 0.28, 0);
        branch(cx, topY, -Math.PI / 2 + 0.7, h * 0.46, trunkW * 0.26, 0);

        // Lisähaara: oikean alaoksan puolesta välistä +45° (vain puut 1 ja 2)
        // Lasketaan oikean haaran (indeksi 3) keskipiste ja piirretään lisähaara.
        // cx on aina sama kutsussa (tr.x), joten tämä koskee molempia puita.
        const rAng = -Math.PI / 2 + 0.7;
        const rLen = h * 0.46;
        const rW = trunkW * 0.26;
        const rMidX = cx + Math.cos(rAng) * rLen * 0.5;
        const rMidY = topY + Math.sin(rAng) * rLen * 0.5;
        branch(rMidX, rMidY, rAng + Math.PI / 4, rLen * 0.75, rW * 0.55, 2);

        // Palauta oletus, ettei pyöreä viivapää vuoda muihin piirroksiin
        ctx.lineCap = 'butt';
    }

    function drawTrees() {
        // Tuuli: pilvet kulkevat windDir/windSpeed-arvolla (initClouds) → puut
        // nojaavat samaan suuntaan ja huojuvat tuulen voiman mukaan.
        const t = Date.now() * 0.001;                       // sekunnit
        for (const tr of trees) {
            const phase = tr.phase || 0;
            const gust = 0.65 + 0.35 * Math.sin(t * 0.37 + phase);        // hidas puuska
            const osc = Math.sin(t * (1.0 + windSpeed * 0.10) + phase);   // huojunta
            const amp = (0.65 + windSpeed * 0.25) * gust;                 // latvan amplitudi (px)
            const lean = windDir * amp * 0.5;                             // lepoasento tuulen suuntaan
            drawBareTree(tr.x, GROUND_Y - 5, tr.h, lean + osc * amp);
        }
    }

    /* ── Lepakot (musta siluetti yötaivaalla) ───── */
    function drawBats() {
        for (const bat of bats) {
            // Fade: pienennä koko suhteessa fadeTimer / fadeDuration
            let curSize = bat.wingSize;
            if (bat.fadeTimer > 0 && bat.fadeDuration > 0) {
                curSize = bat.wingSize * Math.max(0, bat.fadeTimer / bat.fadeDuration);
            }
            if (curSize < 0.5) continue;     // liian pieni → ohita

            const t = Date.now() * 0.005 + bat.flapPhase;
            const flap = Math.sin(t);                      // -1..1 = siipien asento
            const spread = Math.abs(flap);                 // 0..1
            const s = curSize;
            const bodyR = Math.max(1.5, s * 0.28);
            const span = s * (0.25 + spread * 0.75);       // siipien puoliväli
            const rise = s * 0.45 * spread;                // siipien nousu

            ctx.fillStyle = bat.color;

            // Vasen siipi
            ctx.beginPath();
            ctx.moveTo(bat.x - bodyR * 0.3, bat.y - bodyR * 0.5);
            ctx.quadraticCurveTo(
                bat.x - span * 0.6, bat.y - bodyR - rise * 0.5,
                bat.x - span, bat.y - bodyR - rise
            );
            ctx.lineTo(bat.x - span * 0.7, bat.y + bodyR * 0.3);
            ctx.lineTo(bat.x - bodyR * 0.2, bat.y + bodyR * 0.8);
            ctx.closePath();
            ctx.fill();

            // Oikea siipi (peilikuva)
            ctx.beginPath();
            ctx.moveTo(bat.x + bodyR * 0.3, bat.y - bodyR * 0.5);
            ctx.quadraticCurveTo(
                bat.x + span * 0.6, bat.y - bodyR - rise * 0.5,
                bat.x + span, bat.y - bodyR - rise
            );
            ctx.lineTo(bat.x + span * 0.7, bat.y + bodyR * 0.3);
            ctx.lineTo(bat.x + bodyR * 0.2, bat.y + bodyR * 0.8);
            ctx.closePath();
            ctx.fill();

            // Ruumis
            ctx.beginPath();
            ctx.arc(bat.x, bat.y, bodyR, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* Terävä pikselifontti (3x5 glyphit) – ei anti-aliasointia, pysyy terävänä skaalauksessa */
    function drawPixelText(text, cx, cy, scale, color) {
        const G = {
            'B': [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
            'A': [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
            'R': [[1,1,1],[1,0,1],[1,1,1],[1,1,0],[1,0,1]],
        };
        const rows = 5, cols = 3;
        const gw = cols * scale;
        const gap = scale;
        const totalW = text.length * gw + (text.length - 1) * gap;
        // Pyöristä aloitus kokonaisluvuiksi → terävät reunat (ei anti-aliasointia)
        const startX = Math.round(cx - totalW / 2);
        const startY = Math.round(cy - (rows * scale) / 2);
        ctx.fillStyle = color;
        for (let li = 0; li < text.length; li++) {
            const g = G[text[li]];
            if (!g) continue;
            const gx = startX + li * (gw + gap);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (g[r][c]) ctx.fillRect(gx + c * scale, startY + r * scale, scale, scale);
                }
            }
        }
    }

    /* ── BAR-viittakyltti (puunraossa, osoittaa oikealle) ── */
    function drawBarSign() {
        const sx = 143;               // siirretty vasemmalle (hiukan vasemman talon päälle)
        const cy = GROUND_Y - 10;     // matala keskikorkeus
        const tailW = 3;              // I-häntä
        const shaftLen = 22;          // varsi (palautettu alkuperäiseen pituuteen)
        const headLen = 9;            // nuolenkärki
        const halfH = 5;              // varren puolikorkeus

        // Pieniä jalkoja – kyltti ei roiku ilmassa (laudan alta maahan)
        const legW = 2;
        const legTop = cy + halfH;             // laudan alareuna
        const legH = GROUND_Y - legTop;        // maahan asti

        // ── Neonpinkki hohde kyltistä maahan ja ympärille ──
        // Piirretään kyltirungon ALLE: tumma lauta ja terävä neonteksti
        // pysyvät päällimmäisinä. Keskus = neontekstin keskipiste, väri
        // sama kuin tekstissä ja BAR:n kynnysvalossa (#FF66A3 / 255,102,163).
        // Hidas "hengitys" (±25 %) tekee hohteen selkeämmin erottuvaksi.
        const gcx = sx + (tailW + shaftLen + headLen) / 2;
        const gpulse = 0.75 + 0.25 * Math.sin(Date.now() / 3800);
        // Päivänvalo himmentää hohteen pois: auringonnousun (~20 s)
        // aikana pinkki maa- ja ympäristöhehku hiipuu täyteen päivään mennessä
        // nollaan – mutta itse kyltti (neon + väri) jää, sillä BAR on auki
        // myös päivällä (vrt. Jukebox: sammuttaa myös tekstin).
        const gDayDim = 1 - dayNight.t;
        if (gDayDim > 0.01) {
            const gAlpha = gpulse * gDayDim;
            // 1) Valopohja kyltin alla maassa (rajoitettu katupintaan) – säde
            // 1/3 pienempi kuin ympäristöhehku, ettei pinkki leviä liian kauas
            // kadulle
            const gRad = 72;                        // ympäristöhehkun säde
            const gRadPool = Math.round(gRad * 2 / 3); // kadulle leviävä valopohja
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
            ctx.clip();
            const gPool = ctx.createRadialGradient(gcx, GROUND_Y + 12, 4, gcx, GROUND_Y + 12, gRadPool);
            gPool.addColorStop(0, 'rgba(255,102,163,' + (0.19 * gAlpha).toFixed(3) + ')');
            gPool.addColorStop(0.45, 'rgba(255,102,163,' + (0.08 * gAlpha).toFixed(3) + ')');
            gPool.addColorStop(1, 'rgba(255,102,163,0)');
            ctx.fillStyle = gPool;
            ctx.fillRect(gcx - gRadPool, GROUND_Y, gRadPool * 2, gRadPool * 2);
            ctx.restore();
            // 2) Ympäristöhehku kyltin ympärillä (puu, talon seinä)
            const gAmb = ctx.createRadialGradient(gcx, cy, 4, gcx, cy, gRad - 4);
            gAmb.addColorStop(0, 'rgba(255,102,163,' + (0.11 * gAlpha).toFixed(3) + ')');
            gAmb.addColorStop(0.5, 'rgba(255,102,163,' + (0.05 * gAlpha).toFixed(3) + ')');
            gAmb.addColorStop(1, 'rgba(255,102,163,0)');
            ctx.fillStyle = gAmb;
            ctx.beginPath(); ctx.arc(gcx, cy, gRad - 4, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = '#1F1614';
        ctx.fillRect(sx + tailW + 2, legTop, legW, legH);
        ctx.fillRect(sx + tailW + shaftLen - legW - 2, legTop, legW, legH);

        // Kyltin runko – pimeä puinen nuoli I====> (lähes musta siluetti)
        ctx.fillStyle = '#1F1614';
        // Häntä (I)
        ctx.fillRect(sx, cy - halfH, tailW, halfH * 2);
        // Varsi (====)
        ctx.fillRect(sx + tailW, cy - halfH, shaftLen, halfH * 2);
        // Nuolenkärki (>)
        ctx.beginPath();
        ctx.moveTo(sx + tailW + shaftLen, cy - halfH - 2);
        ctx.lineTo(sx + tailW + shaftLen + headLen, cy);
        ctx.lineTo(sx + tailW + shaftLen, cy + halfH + 2);
        ctx.closePath();
        ctx.fill();

        // Hienovarainen reunus – vain aavistus määrittelyä pimeässä siluetissa
        ctx.strokeStyle = '#0c0908';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Neon-teksti 'BAR>' – '>' muodostaa nuolen neonvärisenä (keskitetään kyltille)
        const tcx = sx + (tailW + shaftLen + headLen) / 2;
        const tcy = cy;
        ctx.save();
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Kaaos: yksi kirjain (B/A/R) voi olla "palanut" – piirretään tummana
        // ilman hehkua. NORMALissa barBurntLetter = -1 → teksti piirtyy kuten ennen.
        if (barBurntLetter >= 0) {
            const sign = 'BAR>';
            const chW = ctx.measureText('B').width;   // monospace → sama leveys joka kirjaimella
            for (let i = 0; i < sign.length; i++) {
                ctx.save();
                if (i === barBurntLetter) {
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = '#3a1510';        // palanut: tumma, ei hehkua
                } else {
                    ctx.shadowColor = '#FF0055';
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = '#FF66A3';
                }
                ctx.fillText(sign[i], tcx + (i - (sign.length - 1) / 2) * chW, tcy);
                ctx.restore();
            }
        } else {
            ctx.shadowColor = '#FF0055';   // Hohteen väri (hieman tummempi punapinkki kuin itse teksti)
            ctx.shadowBlur = 10;           // Kuinka kauas hohde leviää
            ctx.fillStyle = '#FF66A3';     // Itse tekstin (kirjainten) ydin, hieman kirkkaampi/vaaleampi
            ctx.fillText('BAR>', tcx, tcy);
        }
        ctx.restore();
    }


    /* ── HOSTEL-neonkyltti (makuuhuoneen talo 7) ─────────────────────
       Sininen neonkyltti talon julkisivussa heti katon lipan alla
       (ikkunarivin yläpuolella). Kyltti piirretään drawBuildingsin
       sisällä eli talon omassa syvyysskaalassa, joten se seuraa taloa
       BAD/FULLin järjestyssekotuksessa ja katoaa talon tuhoutuessa.
       Hehku himmenee päivänvalossa kuten BAR-kyltillä, mutta itse
       kyltti jää näkyviin kaikissa tiloissa – pelaaja löytää
       makuuhuoneen myös sekoitetusta kadusta. Laatta mitoitetaan
       tekstin mukaan (napakka, ei ylimääräistä tyhjää). */
    function drawHostelSign(b) {
        const cx     = b.x + b.w / 2;
        const topY   = GROUND_Y - b.h;
        const fs     = 8;                       // Press Start 2P on monospace → 1 em / merkki
        const padX   = 5;                       // laatan sisämarginaali tekstin molemmin puolin
        const signW  = HOSTEL_SIGN_TEXT.length * fs + padX * 2;   // napakka laatta tekstin ympärille
        const signH  = 16;
        const sx     = cx - signW / 2;
        const sy     = topY + 4;                // heti lipan alle
        const pulse = 0.8 + 0.2 * Math.sin(Date.now() / 3400);
        const dim   = (1 - dayNight.t) * pulse; // päivällä 0 → vain kyltti jää

        ctx.save();
        // 1) Valohehku: seinä kyltin ympärillä + valopohja kadulle
        if (dim > 0.01) {
            const gcy = sy + signH / 2;
            const halo = ctx.createRadialGradient(cx, gcy, 3, cx, gcy, 52);
            halo.addColorStop(0,   'rgba(10,132,255,' + (0.16 * dim).toFixed(3) + ')');
            halo.addColorStop(0.5, 'rgba(10,132,255,' + (0.07 * dim).toFixed(3) + ')');
            halo.addColorStop(1,   'rgba(10,132,255,0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(cx, gcy, 52, 0, Math.PI * 2);
            ctx.fill();
            // Valopohja rajoitetaan katupintaan (kuten BAR-kyltillä)
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
            ctx.clip();
            const pool = ctx.createRadialGradient(cx, GROUND_Y + 12, 4, cx, GROUND_Y + 12, 46);
            pool.addColorStop(0, 'rgba(10,132,255,' + (0.15 * dim).toFixed(3) + ')');
            pool.addColorStop(1, 'rgba(10,132,255,0)');
            ctx.fillStyle = pool;
            ctx.fillRect(cx - 46, GROUND_Y, 92, 92);
            ctx.restore();
        }

        // 2) Kylttilaatta + ohut reunus
        ctx.fillStyle = '#0a0d18';
        ctx.fillRect(sx, sy, signW, signH);
        ctx.strokeStyle = '#1d2c46';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, signW - 1, signH - 1);

        // 3) Neon-teksti – laatta mitoitetaan tekstin mukaan (ks. signW),
        //    joten kyltti pysyy kapeana ja tiiviinä
        ctx.font = fs + 'px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = HOSTEL_NEON_GLOW;
        ctx.shadowBlur = 9;
        ctx.fillStyle = HOSTEL_NEON;
        ctx.fillText(HOSTEL_SIGN_TEXT, cx, Math.round(sy + signH / 2) + 1);
        ctx.restore();
    }


    /* ── CASINO-neonkyltti (hedelmäpelitalo, buildings[6]) ──────────
       Neonvihreä teksti ohuessa mustassa kehyksessä, kaksi ohutta
       jalkaa katon yläpuolella. Ei taustaa eikä haloja. Piirretään
       drawBuildingsin sisällä eli talon omassa syvyysskaalassa, joten se
       seuraa taloa BAD/FULLin järjestyssekotuksessa ja katoaa talon
       tuhoutuessa. Pieni ilmarako jää katon ja kyltin väliin (lyhyet jalat). */
    function drawCasinoSign(b) {
        const cx        = b.x + b.w / 2;
        const topY      = GROUND_Y - b.h;
        const fs        = 8;                            // Press Start 2P on monospace → 1 em / merkki
        const textW     = CASINO_SIGN_TEXT.length * fs; // 'CASINO' → 48 px
        const padX      = 2;
        const frameW    = textW + padX * 2;
        const frameH    = 12;
        const legGap    = 7;                            // pieni ilmarako katon ja kyltin välissä (jalat)
        const fx        = Math.round(cx - frameW / 2);
        const fy        = topY - legGap - frameH;       // kehyksen yläreuna
        const legW      = 1;
        const legTop    = fy + frameH;                  // kehyksen alareuna
        const legBottom = topY;                         // katon yläreuna
        ctx.save();
        ctx.shadowBlur = 0;                             // jalat ja kehys ilman hehkua
        // 1) Jalat: kaksi ohutta mustaa pylvästä kehyksen alta katolle
        ctx.fillStyle = '#000';
        ctx.fillRect(fx + 4, legTop, legW, legBottom - legTop);
        ctx.fillRect(fx + frameW - 4 - legW, legTop, legW, legBottom - legTop);
        // 2) Kehys: ohuin mahdollinen musta reunus – ei taustaa
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(fx + 0.5, fy + 0.5, frameW - 1, frameH - 1);
        // 3) Neon-teksti + pieni hehku
        ctx.font = fs + 'px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = CASINO_NEON_GLOW;
        ctx.shadowBlur = 7;                      // pieni hehku
        ctx.fillStyle = CASINO_NEON;
        ctx.fillText(CASINO_SIGN_TEXT, cx, Math.round(fy + frameH / 2) + 1);
        ctx.restore();
    }


    function drawGround() {
        // Taustapohja
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);

        // Yläreunan katukiveys (reunakivet) – oviaukon kohdalla katkaistu (laskettu reunakivi)
        const copingY = GROUND_Y - 4, copingH = 8;
        for (const cs of foreground.copingStones) {
            for (const seg of splitAtKerbGaps(cs.x, cs.x + cs.w)) {
                ctx.fillStyle = '#2' + cs.shade + '2' + cs.shade + '2' + cs.shade;
                ctx.fillRect(seg[0], copingY, seg[1] - seg[0], copingH);
                ctx.fillStyle = '#161616';
                ctx.fillRect(seg[0], copingY, seg[1] - seg[0], 1);
            }
        }

        // Kiveyspinta – esigeneroiduista
        for (const ps of foreground.pavingStones) {
            const hex = ps.shade.toString(16).padStart(2, '0');
            ctx.fillStyle = '#' + hex + hex + hex;
            ctx.fillRect(ps.x, ps.y, ps.w, ps.h);
            ctx.fillStyle = '#151515';
            ctx.fillRect(ps.x, ps.y, 1, ps.h);
            ctx.fillRect(ps.x, ps.y + ps.h - 1, ps.w, 1);
        }

        // Ala- ja yläreunaviivat (katkaistu oviaukon kohdalta – laskettu reunakivi)
        drawStreetLine(GROUND_Y, 3, '#2a2a2a');
        drawStreetLine(GROUND_Y - 2, 2, '#3a3a3a');

        // Ovien kynnysviuhka + laskettu reunakivi + kynnyslaatta
        if (foreground) { drawThresholdPaving(); }

        // Viemärinkannet
        if (foreground) { drawManholes(); }
        // Sanomalehti
        if (foreground && foreground.newspaper) { StreetNews.drawOnStreet(); }

        // Kuoriaiset
        if (foreground && foreground.beetles) { for (const b of foreground.beetles) drawBeetle(b); }

    }

    /* ── Talojen kuusta tulevat varjot ──
       Jokaisen 9 talon pohjan alle piirretään puolisuunnikas GROUND_Y:stä
       alaspäin; kauempi reuna siirtyy kuusta poispäin ((x − dayNight.moonX)·k). Kun
       kuu liikkuu vasemmalta oikealle, varjo kääntyy oikealta vasemmalle.
       Täyttö on pystygradientti (tumma pohjassa → pois kauempaa) ja alpha
       seuraa kuun näkyvyyttä (1 − dayNight.t). Piirretään drawGround():n JÄLKEEN,
       joten kaikki kadun objektit jäävät varjon sisään. */
    function drawMoonBuildingShadows() {
        if (dayNight.t >= 1 || MOON_BLD_SHADOW_ALPHA <= 0) return;
        const fade = 1 - dayNight.t;                            // kuun näkyvyys
        for (let idx = 0; idx < buildings.length; idx++) {
            const b = buildings[idx];
            if (buildingGone(buildings.indexOf(b))) continue;   // tuhoutunut talo ei heitä varjoa
            const x0 = b.x, x1 = b.x + b.w;
            /* Kaaoskerroin (BAD/FULL): talon oma arpa 1,00…moonShadowMax, arvottu
               kerran per yö → skaalaa sekä pituuden että kallistuksen. */
            const ms = moonShadowMult[idx] || 1;
            const L = b.h * MOON_BLD_SHADOW_LEN * ms;     // varjon pituus
            const k = MOON_BLD_SHADOW_SKEW * (b.h / 100) * ms;
            const s0 = (x0 - dayNight.moonX) * k;                  // kauemman reunan siirto
            const s1 = (x1 - dayNight.moonX) * k;
            const grad = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + L);
            grad.addColorStop(0,    'rgba(0,0,0,' + (MOON_BLD_SHADOW_ALPHA * fade).toFixed(3) + ')');
            grad.addColorStop(0.55, 'rgba(0,0,0,' + (MOON_BLD_SHADOW_ALPHA * fade * 0.5).toFixed(3) + ')');
            grad.addColorStop(1,    'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x0, GROUND_Y);
            ctx.lineTo(x1, GROUND_Y);
            ctx.lineTo(x1 + s1, GROUND_Y + L);
            ctx.lineTo(x0 + s0, GROUND_Y + L);
            ctx.closePath();
            ctx.fill();
        }
    }

    /* Katkaisee vaakaviivan oviaukkojen kohdalta (laskettu reunakivi) */
    function drawStreetLine(y, h, style) {
        ctx.fillStyle = style;
        const gaps = (foreground && foreground.kerbGaps) ? foreground.kerbGaps : [];
        let x = 0;
        for (const g of gaps) {
            if (g.l > x) ctx.fillRect(x, y, g.l - x, h);
            if (g.r > x) x = g.r;
        }
        if (x < WORLD_W) ctx.fillRect(x, y, WORLD_W - x, h);
    }

    /* Palauttaa [x0,x1]-palat, jotka jäävät oviaukkojen ulkopuolelle */
    function splitAtKerbGaps(x0, x1) {
        const gaps = (foreground && foreground.kerbGaps) ? foreground.kerbGaps : [];
        let parts = [[x0, x1]];
        for (const g of gaps) {
            const next = [];
            for (const seg of parts) {
                if (g.r <= seg[0] || g.l >= seg[1]) { next.push(seg); continue; }
                if (g.l > seg[0]) next.push([seg[0], g.l]);
                if (g.r < seg[1]) next.push([g.r, seg[1]]);
            }
            parts = next;
        }
        return parts.filter(seg => seg[1] - seg[0] > 0.5);
    }

    /* ── Ovien kynnysviuhka + laskettu reunakivi + kynnyslaatta ──
       Kiveys kaatuu/kallistuu ovea kohti: vinot saumat, V-painuma,
       laskettu reunakivi katkaisee kadun viivat oviaukon kohdalta. */
    function drawThresholdPaving() {
        if (!foreground || !foreground.thresholds) return;
        const fillPolys = (grp) => {
            ctx.fillStyle = grp.fill;
            ctx.beginPath();
            for (const poly of grp.polys) {
                ctx.moveTo(poly[0], poly[1]);
                for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i], poly[i + 1]);
                ctx.closePath();
            }
            ctx.fill();
        };

        for (const t of foreground.thresholds) {
            // 1) Kiilakivet sävyryhmittäin (muutama fill per ovi)
            for (const grp of t.groups) fillPolys(grp);

            // 1b) Tallattu keskilinja (kuluminen) peruskiilojen päälle
            for (const grp of t.wear) fillPolys(grp);

            // 2) Oviaukon valo (vain aktiivisille oville – sama logiikka kuin drawDoor)
            const isBar = t.bldgIdx === 8;
            const ownerLamp = lamps.find(l => l.bldgIdx === t.bldgIdx);
            const jukeboxLit = t.bldgIdx === JUKEBOX_BLDG_IDX &&
                               !!(smallHouseLights[t.bldgIdx] && smallHouseLights[t.bldgIdx].lit);
            // Makuuhuone (talo 7): ovi aina auki → valo palaa kynnyksellä
            const sleepOpen = (t.bldgIdx === SLEEP_BLDG_IDX);
            const sinkshipLit = t.bldgIdx === SINKSHIP_BLDG_IDX &&
                                !!(smallHouseLights[t.bldgIdx] && smallHouseLights[t.bldgIdx].lit);
            // tuhoutuneen talon kynnysvalo sammuu (kiveys jää katutilaksi)
            const active = !buildingGone(t.bldgIdx) && (isBar || jukeboxLit || sleepOpen || sinkshipLit ||
                           !!(ownerLamp && (ownerLamp.lit || lampFreeOpen())));
            if (THRESH_LIGHT && active) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(t.border[0], t.border[1]);
                for (let i = 2; i < t.border.length; i += 2) ctx.lineTo(t.border[i], t.border[i + 1]);
                ctx.closePath();
                ctx.clip();
                const r = t.depth + 12;
                // Keltaisten (talojen) ovivalojen hidas syke yöllä:
                // sama ~60 s jakso kuin BAR-kyltillä → koko katu hengittää
                // samaan tahtiin. Päivällä (dayNight.t → 1) syke hiipuu pois ja
                // valo palaa tasaisesti kuten ennenkin. BAR/jukebox-värit
                // (pinkki/violetti) pysyvät sykkimättöminä.
                const tpulse = 1 + 0.40 * Math.sin(Date.now() / 3800) * (t.lightRGB === THRESH_LIGHT_HOUSE ? 1 - dayNight.t : 0);
                const lg = ctx.createRadialGradient(t.cx, GROUND_Y + 2, 2, t.cx, GROUND_Y + 2, r);
                lg.addColorStop(0, 'rgba(' + t.lightRGB + ',' + (0.16 * tpulse).toFixed(3) + ')');
                lg.addColorStop(0.5, 'rgba(' + t.lightRGB + ',' + (0.06 * tpulse).toFixed(3) + ')');
                lg.addColorStop(1, 'rgba(' + t.lightRGB + ',0)');
                ctx.fillStyle = lg;
                ctx.fillRect(t.cx - r, GROUND_Y, r * 2, r);
                ctx.restore();
            }

            // 3) Saumat (vinot) + renkaiden rajapisteet
            ctx.strokeStyle = '#161616';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (const ln of t.seams) { ctx.moveTo(ln[0], ln[1]); ctx.lineTo(ln[2], ln[3]); }
            for (const hs of t.hseams) {
                ctx.moveTo(hs[0], hs[1]);
                for (let i = 2; i < hs.length; i += 2) ctx.lineTo(hs[i], hs[i + 1]);
            }
            ctx.stroke();
            // 4) Halkeamat + pikkukivet
            if (THRESH_DETAILS) {
                if (t.cracks.length) {
                    ctx.strokeStyle = '#0d0d0d';
                    ctx.beginPath();
                    for (const ln of t.cracks) { ctx.moveTo(ln[0], ln[1]); ctx.lineTo(ln[2], ln[3]); }
                    ctx.stroke();
                }
                for (const pb of t.pebbles) {
                    ctx.fillStyle = pb[4];
                    ctx.fillRect(pb[0], pb[1], pb[2], pb[3]);
                }
            }

            // 5) Viuhkan ulkoreuna – erottaa viuhkan suorasta kiveyksestä
            ctx.strokeStyle = '#0e0e0e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(t.border[0], t.border[1]);
            for (let i = 2; i < t.border.length; i += 2) ctx.lineTo(t.border[i], t.border[i + 1]);
            ctx.closePath();
            ctx.stroke();
            ctx.lineWidth = 1;

            // 6) Laskettu reunakivi: kynnyslinja oven alle + viisteet katkon reunoille
            const gw = t.gapR - t.gapL;
            ctx.fillStyle = '#3a3a3a';
            ctx.fillRect(t.gapL + 2, GROUND_Y, gw - 4, 1);          // kynnyslinjan yläreuna
            ctx.fillStyle = '#1c1c1c';
            ctx.fillRect(t.gapL, GROUND_Y + 1, gw, 1);              // varjoraot kynnyksen alle
            ctx.fillStyle = '#343434';
            ctx.fillRect(t.gapL, GROUND_Y - 3, 2, 4);               // viiste vasen (reunakivi kaatuu alas)
            ctx.fillRect(t.gapR - 2, GROUND_Y - 3, 2, 4);           // viiste oikea
            ctx.fillStyle = '#0b0b0b';
            ctx.fillRect(t.gapL, GROUND_Y - 4, 1, 5);
            ctx.fillRect(t.gapR - 1, GROUND_Y - 4, 1, 5);

            // 7) Kynnyslaatta (ovi nousee kynnyksellä)
            const sb = t.slab;
            ctx.fillStyle = '#2f2f2f';
            ctx.fillRect(sb.x, sb.y, sb.w, 1);
            ctx.fillStyle = '#232323';
            ctx.fillRect(sb.x, sb.y + 1, sb.w, sb.h - 2);
            ctx.fillStyle = '#141414';
            ctx.fillRect(sb.x, sb.y + sb.h - 1, sb.w, 1);
            ctx.fillStyle = '#0e0e0e';
            ctx.fillRect(sb.x - 1, sb.y, 1, sb.h);
            ctx.fillRect(sb.x + sb.w, sb.y, 1, sb.h);
        }
    }

    /* Etualan apufunktiot ─────────────────────────── */
    function drawManholes() {
        for (let i = 0; i < foreground.manholes.length; i++) {
            const mh = foreground.manholes[i];
            const mx = mh.x, my = mh.y;
            ctx.fillStyle = '#0d0d0d';
            ctx.beginPath();
            ctx.ellipse(mx + 1, my + 2, 15, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            if (manhole.open === i) {
                // Kansi puuttuu → musta aukko
                drawManholeHole(mx, my);
            } else {
                ctx.fillStyle = '#2a2a2e';
                ctx.beginPath();
                ctx.ellipse(mx, my, 14, 7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#1a1a1e'; ctx.lineWidth = 1;
                ctx.stroke();
                ctx.strokeStyle = '#3a3a3e';
                ctx.beginPath();
                ctx.ellipse(mx, my - 2, 12, 5, 0, Math.PI, 0);
                ctx.stroke();
                ctx.fillStyle = '#444';
                for (let n = 0; n < 6; n++) {
                    const angle = n * Math.PI / 3 + 0.2;
                    ctx.beginPath();
                    ctx.arc(mx + Math.cos(angle) * 10, my + Math.sin(angle) * 4.5, 1.2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            drawManholeSteam(mh);
        }
    }

    /* ── Avoin viemäri: kohta on musta, ei kantta ──
       Sama piirto tehdään myös pelaajan PÄÄLLE pudotuksen aikana
       (drawManholeOverlay) → pelaaja näyttää vajoavan kaivoon. */
    function drawManholeHole(mx, my) {
        // Aukon sisus – täysin musta
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(mx, my, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Valurautainen kehä (tumma reuna)
        ctx.strokeStyle = '#1b1b1f'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(mx, my, 14, 7, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Lähihuulen kiiltolaita (alareuna) – erottaa reiän mustasta asfaltista
        ctx.strokeStyle = '#3a3a3e'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(mx, my + 0.5, 12.5, 5.5, 0, 0, Math.PI);
        ctx.stroke();
    }

    /* Viemärin höyry – sama sekä kannellisessa että avoimessa tilassa */
    function drawManholeSteam(mh) {
        for (const p of mh.steamParticles) {
            ctx.fillStyle = 'rgba(200,205,215,' + p.alpha + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* Putoamisen aikana musta aukko piirretään vasta pelaajan jälkeen →
       pelaaja vajoaa reikään ja katoaa. */
    function drawManholeOverlay() {
        if (!manhole.action) return;
        const mh = (foreground && foreground.manholes) ? foreground.manholes[manhole.action.idx] : null;
        if (!mh) return;
        drawManholeHole(mh.x, mh.y);
        drawManholeSteam(mh);
    }







    function drawTuft(tx, ty, blades, phase, scale, t) {
        const sway = Math.sin(t + phase) * 2 * scale;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(tx, ty + 3 * scale, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let b = 0; b < blades; b++) {
            const bx = tx + (-3 + b * 2.5) * scale;
            const bh = (7 + (b % 3) * 4) * scale;
            const bend = sway * (0.6 + b * 0.15);
            ctx.strokeStyle = b % 2 === 0 ? '#3a4a2a' : '#4a5a30';
            ctx.lineWidth = 1.2 * scale;
            ctx.beginPath();
            ctx.moveTo(bx, ty);
            ctx.quadraticCurveTo(bx + bend * 0.5, ty - bh * 0.5, bx + bend, ty - bh);
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawGrassTufts() {
        const t = Date.now() * 0.003;
        for (const tuft of foreground.grassTufts) {
            drawTuft(tuft.x, tuft.y, tuft.blades, tuft.phase, 1, t);
        }
    }

    function drawTreeGrassTufts() {
        const t = Date.now() * 0.003;
        for (const tuft of foreground.treeGrassTufts) {
            drawTuft(tuft.x, tuft.y, tuft.blades, tuft.phase, 0.25, t);
        }
    }



    function drawBeetle(b) {
        const bx = b.x, by = b.y;
        const legPhase = Math.sin(b.animTimer) * 1.5;
        ctx.save();
        if (b.dir < 0) { ctx.translate(bx, 0); ctx.scale(-1, 1); ctx.translate(-bx, 0); }
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(bx - 3, by + 1 + legPhase, 1, 2);
        ctx.fillRect(bx - 1, by + 1 - legPhase, 1, 2);
        ctx.fillRect(bx + 2, by + 1 + legPhase, 1, 2);
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.ellipse(bx, by, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0a0a0a';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(bx + 3, by - 1);
        ctx.lineTo(bx + 7, by - 4);
        ctx.moveTo(bx + 3, by - 0.5);
        ctx.lineTo(bx + 6, by + 1);
        ctx.stroke();
        ctx.restore();
    }

    function drawIronFence() {
        const f = foreground.ironFence;
        if (!f || !f.segments) return;

        for (const seg of f.segments) {
            const startX = seg.startX;
            const endX = seg.endX;
            const bars = seg.barX;

            // ── Varjo aidan takana ──
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(startX + 2, f.topY + 2, endX - startX - 4, f.bottomRailY - f.topY + 2);

            // ── Vaakaraudat ──
            // Alajuoksu (paksumpi) – pyöreä sylinteriefekti pystygradientilla
            const railGrad = ctx.createLinearGradient(0, f.bottomRailY - 1, 0, f.bottomRailY + 6);
            railGrad.addColorStop(0,   '#3a3a3a');   // yläkiilto
            railGrad.addColorStop(0.5, '#2e2e2e');   // keskiosa
            railGrad.addColorStop(1,   '#1a1a1a');   // alavarjo
            ctx.fillStyle = railGrad;
            ctx.fillRect(startX, f.bottomRailY - 1, endX - startX, 7);
            // Niitit joka pystypiikin kohdalle (miltei musta, ei valopilkku)
            for (const bx of bars) {
                ctx.fillStyle = '#0b0b0b';
                ctx.beginPath();
                ctx.arc(bx + 1, f.bottomRailY + 2, 1.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#171717';
                ctx.beginPath();
                ctx.arc(bx + 0.6, f.bottomRailY + 1.6, 0.7, 0, Math.PI * 2);
                ctx.fill();
            }
            // Yläjuoksu
            ctx.fillStyle = '#222222';
            ctx.fillRect(startX, f.topY + 12, endX - startX, 4);
            ctx.fillStyle = '#2e2e2e';
            ctx.fillRect(startX + 1, f.topY + 13, endX - startX - 2, 2);

            // ── Pystypiikit ──
            for (const bx of bars) {
                // Piikin varsi
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(bx, f.topY + 15, 2, f.bottomRailY - f.topY - 15);
                // Piikin kärki (terävä yläosa)
                ctx.fillStyle = '#252525';
                ctx.beginPath();
                ctx.moveTo(bx - 1, f.topY + 15);
                ctx.lineTo(bx + 1, f.topY + 15);
                ctx.lineTo(bx + 1, f.topY + 1);
                ctx.lineTo(bx + 0.5, f.topY - 1);
                ctx.lineTo(bx, f.topY - 5);
                ctx.lineTo(bx - 0.5, f.topY - 1);
                ctx.lineTo(bx - 1, f.topY + 1);
                ctx.closePath();
                ctx.fill();
                // Kevyt kiilto piikin kärkeen
                ctx.fillStyle = '#3a3a3a';
                ctx.beginPath();
                ctx.moveTo(bx - 0.3, f.topY + 5);
                ctx.lineTo(bx + 0.3, f.topY + 5);
                ctx.lineTo(bx + 0.3, f.topY - 1);
                ctx.lineTo(bx, f.topY - 4);
                ctx.closePath();
                ctx.fill();
            }

            // ── Päätytolpat (segmenttien reunat) ──
            const drawEndPost = (px) => {
                ctx.fillStyle = '#080808';
                ctx.fillRect(px - 3, f.topY - 2, 6, f.bottomRailY - f.topY + 8);
                ctx.fillStyle = '#151515';
                ctx.fillRect(px - 2, f.topY, 4, f.bottomRailY - f.topY);
                // Tolpan pallo
                ctx.fillStyle = '#0a0a0a';
                ctx.beginPath();
                ctx.arc(px, f.topY - 4, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath();
                ctx.arc(px - 0.5, f.topY - 5, 2, 0, Math.PI * 2);
                ctx.fill();
            };
            drawEndPost(startX);
            drawEndPost(endX);
        }

        // ── Keskiaukon reunatolpat (paksummat, koristeellisemmat) ──
        const drawGapPost = (px) => {
            // Tolpan runko
            ctx.fillStyle = '#080808';
            ctx.fillRect(px - 4, f.topY - 6, 8, f.bottomRailY - f.topY + 12);
            ctx.fillStyle = '#121212';
            ctx.fillRect(px - 3, f.topY - 2, 6, f.bottomRailY - f.topY + 4);
            // Koriste-ura
            ctx.fillStyle = '#080808';
            ctx.fillRect(px - 2, f.topY + 18, 4, 14);
            // Pallo huipulla
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath();
            ctx.arc(px, f.topY - 6, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1e1e1e';
            ctx.beginPath();
            ctx.arc(px - 1, f.topY - 8, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Alahela
            ctx.fillStyle = '#151515';
            ctx.fillRect(px - 4, f.bottomRailY + 2, 8, 6);
        };
        drawGapPost(f.gapStart);
        drawGapPost(f.gapEnd);
    }

    /* ── Huoneiden piirto omasta tiedostosta (Vaihe 5 osa 6) ──
       street/rooms.js piirtää makuuhuoneen, jukeboxin ja BARin. Huoneiden
       TILA ja syöttölogiikka (update- ja close-funktiot) sekä oven avaus jäävät tänne.
       Tähän sidotaan ne street.js:n sulkeuman arvot, joita piirto lukee –
       live-gettereinä, jotta esim. viewW/camX seuraavat resizeä ja
       coinCount/hamburgerCount ostoksia. Vakiot annetaan arvoina. */
    StreetRooms.bind({
        get ctx() { return ctx; },
        get canvas() { return canvas; },
        get viewW() { return viewW; },
        get camX() { return camX; },
        get isDay() { return dayNight.isDay; }, set isDay(v) { dayNight.isDay = v; },
        get coinCount() { return coinCount; }, set coinCount(v) { coinCount = v; },
        get hamburgerCount() { return hamburgerCount; }, set hamburgerCount(v) { hamburgerCount = v; },
        get drunkLevel() { return drunkLevel; }, set drunkLevel(v) { drunkLevel = v; },
        get barBuyQty() { return barBuyQty; }, set barBuyQty(v) { barBuyQty = v; },
        get jukeQueue() { return jukeQueue; }, set jukeQueue(v) { jukeQueue = v; },
        get jukePick() { return jukePick; },
        get jukeSel() { return jukeSel; }, set jukeSel(v) { jukeSel = v; },
        get jukeCovers() { return jukeCovers; },
        get sleepPhase() { return sleepPhase; }, set sleepPhase(v) { sleepPhase = v; },
        get sleepSel() { return sleepSel; }, set sleepSel(v) { sleepSel = v; },
        chaosFlags: chaosFlags,
        /* Vaihe 5 osa 8 – huoneiden LOGIIKKA lukee ja mutatoi näitä.
           get+set kaikelle, mihin siirretty koodi kirjoittaa; muuttujat ovat
           edelleen street.js:n sulkeumassa, joten sama tila pysyy. */
        get keys() { return keys; },
        get state() { return state; },
        get dayT() { return dayNight.t; },
        get actionJustPressed() { return actionJustPressed; }, set actionJustPressed(v) { actionJustPressed = v; },
        get sleepRoom() { return sleepRoom; }, set sleepRoom(v) { sleepRoom = v; },
        get sleepHeldUp() { return sleepHeldUp; }, set sleepHeldUp(v) { sleepHeldUp = v; },
        get sleepHeldDown() { return sleepHeldDown; }, set sleepHeldDown(v) { sleepHeldDown = v; },
        get barRoom() { return barRoom; }, set barRoom(v) { barRoom = v; },
        get barBuyHeldUp() { return barBuyHeldUp; }, set barBuyHeldUp(v) { barBuyHeldUp = v; },
        get barBuyHeldDown() { return barBuyHeldDown; }, set barBuyHeldDown(v) { barBuyHeldDown = v; },
        get jukeboxRoom() { return jukeboxRoom; }, set jukeboxRoom(v) { jukeboxRoom = v; },
        get jukeHeldUp() { return jukeHeldUp; }, set jukeHeldUp(v) { jukeHeldUp = v; },
        get jukeHeldDown() { return jukeHeldDown; }, set jukeHeldDown(v) { jukeHeldDown = v; },
        get jukeSpaceHeld() { return jukeSpaceHeld; }, set jukeSpaceHeld(v) { jukeSpaceHeld = v; },
        get jukeEnterHeld() { return jukeEnterHeld; }, set jukeEnterHeld(v) { jukeEnterHeld = v; },
        get jukeSavedPos() { return jukeSavedPos; }, set jukeSavedPos(v) { jukeSavedPos = v; },
        get hamburgerTimer() { return hamburgerTimer; }, set hamburgerTimer(v) { hamburgerTimer = v; },
        get drunkTimer() { return drunkTimer; }, set drunkTimer(v) { drunkTimer = v; },
        get cycleChangeTimer() { return dayNight.cycleChangeTimer; }, set cycleChangeTimer(v) { dayNight.cycleChangeTimer = v; },
        get burgerInterval() { return burgerInterval; },
        get HUNGER_WAKE_GRACE() { return HUNGER_WAKE_GRACE; },
        get CYCLE_CHANGE_DELAY_FRAMES() { return CYCLE_CHANGE_DELAY_FRAMES; },
        DAY_FORCE: DAY_FORCE,
        updateHUD: updateHUD, playCoin: playCoin, saveChaosSession: saveChaosSession,
        resetMoon: resetMoon, resetSun: resetSun, showNotification: showNotification,
        StreetAudio: StreetAudio,
        WORLD_W: WORLD_W, WORLD_H: WORLD_H, VIEWW_MIN: VIEWW_MIN, GROUND_Y: GROUND_Y,
        JUKEBOX_TRACKS: JUKEBOX_TRACKS,
        SLEEP_DARK_FRAMES: SLEEP_DARK_FRAMES, SLEEP_ZZZ_FRAMES: SLEEP_ZZZ_FRAMES,
        SLEEP_FADE_FRAMES: SLEEP_FADE_FRAMES,
        DRUNK_MAX: DRUNK_MAX, BAR_BEER_H: BAR_BEER_H
    });

/* ── Lampputolppa ─────────────────────────────── */
    /* Geometria yhdestä paikasta: tolpan juuri (syvyysviiva LAMP_BASE_Y),
       yläpää ja kuvun keskikohta. */
    function lampGeom(lamp) {
        const bx = lamp.x;                     // tolpan juuri (x)
        const by = LAMP_BASE_Y;                // tolpan juuri (y = maanpinta + 15px alempana)
        const poleTop = by - LAMP_POST_H + 15; // tolpan yläpää
        const bulbY = poleTop - 8;             // lampun kupu (lähempänä tolppaa)
        return { bx: bx, by: by, poleTop: poleTop, bulbY: bulbY };
    }

    /* Kaaos – lamppu napsahtaa satunnaisesti hetkeksi punaiseksi
       (vain chaos-tasot; NORMAL = lampRedFlicker 0 → ei koskaan). Sama
       "punainen välähdys" kuin ylikuumentuneella, mutta ilman savua. */
    function lampRedSnap(lamp) {
        if (lampRedFlicker <= 0 || !lamp.lit) return false;
        const t = Date.now() * 0.001;
        const s = Math.sin(t * 1.9 + lamp.x * 0.53) * Math.sin(t * 3.7 + lamp.x * 0.13);
        return s > (1 - lampRedFlicker * 4);
    }

    /* Valo: ylikuumentumisen hehku, savu ja valokeila. Piirretään AINA ennen
       pylvästä ja pelaajaa → valo ei koskaan peitä pelaajaa, vain pylväs peittää
       (ks. render: pylväs piirretään joko ennen tai jälkeen pelaajan). */
    function drawLampGlow(lamp) {
        if (StreetChaosCards.lightsOut) return;   // K7-kortti "Valot sammuvat"
        const geom = lampGeom(lamp);
        const bx = geom.bx, bulbY = geom.bulbY;
        // Päivällä hehku himmenee (LAMP_DAY_DIM) ja moskiitot häipyvät
        // (MOSQUITO_DAY_DIM). HUOM: lamp.lit ei muutu mihinkään →
        // yöllä ovet aukeavat potkaistusta lampusta täsmälleen kuten ennenkin.
        const dayDim = 1 - LAMP_DAY_DIM * dayNight.t;
        const redSnap = lampRedSnap(lamp);   // kaaos: satunnainen punainen välähdys
// Ylikuumentuneen lampun punainen hehku + savu
        if (lamp.overheat) {
            const flicker = Math.sin(Date.now() * 0.02) * 0.4 + 0.6;
            const g = ctx.createRadialGradient(bx, bulbY + 10, 3, bx, bulbY + 10, 50);
            g.addColorStop(0, 'rgba(255,80,20,' + (0.25 * flicker) + ')');
            g.addColorStop(0.5, 'rgba(255,40,0,' + (0.06 * flicker) + ')');
            g.addColorStop(1, 'rgba(255,20,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(bx, bulbY + 10, 50, 0, Math.PI*2); ctx.fill();

            // Savupilvi
            const smokeAlpha = 0.15 + flicker * 0.2;
            ctx.fillStyle = 'rgba(80,80,80,' + smokeAlpha + ')';
            ctx.beginPath();
            const smokeY = bulbY - 8 - Math.sin(Date.now() * 0.015) * 6;
            ctx.arc(bx - 4, smokeY, 6, 0, Math.PI*2); ctx.fill();
            ctx.arc(bx + 4, smokeY - 2, 5, 0, Math.PI*2); ctx.fill();
            ctx.arc(bx, smokeY - 4, 7, 0, Math.PI*2); ctx.fill();
        }

        // Valokeila (jos palaa) – himmenee päivällä; lampHueShift värjää (kaaos K1)
        if (lamp.lit && dayDim > 0.01) {
            const g = ctx.createRadialGradient(bx, bulbY + 10, 4, bx, bulbY + 10, 90);
            if (redSnap) {
                g.addColorStop(0, 'hsla(0,85%,65%,' + (0.7 * dayDim).toFixed(3) + ')');
                g.addColorStop(0.5, 'hsla(0,90%,50%,' + (0.15 * dayDim).toFixed(3) + ')');
                g.addColorStop(1, 'hsla(0,90%,50%,0)');
            } else if (lampHueShift) {
                g.addColorStop(0, 'hsla(' + lampHueShift + ',80%,70%,' + (0.7 * dayDim).toFixed(3) + ')');
                g.addColorStop(0.5, 'hsla(' + lampHueShift + ',85%,55%,' + (0.15 * dayDim).toFixed(3) + ')');
                g.addColorStop(1, 'hsla(' + lampHueShift + ',85%,55%,0)');
            } else {
                g.addColorStop(0, 'rgba(255,240,150,' + (0.7 * dayDim).toFixed(3) + ')');
                g.addColorStop(0.5, 'rgba(255,200,50,' + (0.15 * dayDim).toFixed(3) + ')');
                g.addColorStop(1, 'rgba(255,200,50,0)');
            }
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(bx, bulbY + 10, 90, 0, Math.PI*2); ctx.fill();
        }
    }

    /* Pylväsrakenne: varsi, jalusta, poikkipalkki, kupu, hattu, hehkulamppu,
       moskiitot ja ylikuumentumisen piste. Kutsutaan render()istä joko ennen
       pelaajaa (pelaaja pylvään edessä) tai pelaajan jälkeen (pelaaja takana). */
    function drawLampPost(lamp) {
        const geom = lampGeom(lamp);
        const bx = geom.bx, by = geom.by, poleTop = geom.poleTop, bulbY = geom.bulbY;
        const dayDim = 1 - LAMP_DAY_DIM * dayNight.t;   // hehkulampun piste + moskiitot
        /* K7 "Valot sammuvat" (bugikorjaus): lamppu ei pala – myöskään
           kupu eikä valopilkku. Vain PIIRTO: `lamp.lit` pysyy ennallaan, koska
           ovilogiikka (lampFreeOpen, omistajalamppu) lukee sitä. */
        const litNow = lamp.lit && !StreetChaosCards.lightsOut;

        // Tolpan varsi (puinen/rautainen) – keskeltä vaalea, reunoilta tumma = pyöreä sylinteriefekti
        const poleGrad = ctx.createLinearGradient(bx - 3, 0, bx + 3, 0);
        poleGrad.addColorStop(0,   '#33230f');  // vasen reuna (tumma)
        poleGrad.addColorStop(0.5, '#6f5230');  // keskusta (vaalea)
        poleGrad.addColorStop(1,   '#241708');  // oikea reuna (tummin)
        ctx.fillStyle = poleGrad;
        ctx.fillRect(bx - 3, poleTop, 6, by - poleTop);

        // Tolpan jalusta – katukivetyksen rasteri (vaihtelevat sävyt + saumat)
        const baseL = parseInt((lamp.baseShade || 'hsl(0,0%,50%)').match(/(\d+)%/)[1], 10);
        const baseX = bx - 7, baseY = by - 6, baseW = 14, baseH = 6;
        // Saumatausta (mortar) – tumma, erottaa kivet
        ctx.fillStyle = 'hsl(0,0%,' + Math.max(10, baseL - 24) + '%)';
        ctx.fillRect(baseX, baseY, baseW, baseH);
        // Kivet: kaksi limittäistä riviä, deterministinen sävyvaihtelu per lamppu
        // Pystyraita (kivien välinen sauma) peilataan oikealle/vasemmalle per lamppu
        let s = lamp.x * 7 + baseL;
        const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
        const stoneW = 6, stoneH = 2, gap = 1;
        const mirror = rnd() < 0.5;  // kaksi vaihtoehtoa: pystyraita oikealla tai vasemmalla
        for (let row = 0; row < 2; row++) {
            const y = baseY + row * (stoneH + gap);
            const offset = row === 1 ? -Math.floor(stoneW / 2) : 0;
            const stones = [];
            for (let x = offset; x < baseW; x += stoneW + gap) {
                const sx = Math.max(baseX, baseX + x);
                const sw = Math.min(stoneW, baseX + baseW - sx);
                if (sw > 0) stones.push([sx, sw]);
            }
            if (mirror) {
                for (const st of stones) st[0] = baseX + baseW - (st[0] - baseX + st[1]);
            }
            for (const [sx, sw] of stones) {
                const shade = baseL - 8 + rnd() * 28;  // vähän vaaleampaa kuin kuva
                ctx.fillStyle = 'hsl(0,0%,' + Math.round(Math.min(82, Math.max(16, shade))) + '%)';
                ctx.fillRect(sx, y, sw, stoneH);
            }
        }
        // Yläreunan ohut valokorostus (bevel)
        ctx.fillStyle = 'hsl(0,0%,' + Math.min(90, baseL + 30) + '%)';
        ctx.fillRect(baseX, baseY, baseW, 1);

        // Poikkipalkki lampun alla
        ctx.fillStyle = '#4a3820';
        ctx.fillRect(bx - 10, poleTop - 4, 20, 4);

        // Lampun kupu
        let cupFill;
        if (lamp.overheat) {
            cupFill = 'rgba(255,' + Math.round(60 + (Math.sin(Date.now() * 0.025) * 0.3 + 0.7) * 40) + ',10,0.8)';
        } else if (litNow && lampRedSnap(lamp)) {
            cupFill = '#ff5040';   // kaaos: hetkellinen punainen välähdys
        } else if (litNow) {
            cupFill = '#ffffaa';
        } else {
            // Staattinen (ei pala): pyöreä dome – keskiö vaalea, laidat tummemmat
            const cupGrad = ctx.createRadialGradient(bx, bulbY + 3, 1, bx, bulbY + 3, 10);
            cupGrad.addColorStop(0,    '#3a3a3a');
            cupGrad.addColorStop(0.55, '#262626');
            cupGrad.addColorStop(1,    '#141414');
            cupFill = cupGrad;
        }
        ctx.fillStyle = cupFill;
        ctx.beginPath();
        ctx.arc(bx, bulbY + 6, 9, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = lamp.overheat ? '#882200' : '#555'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, bulbY + 6, 9, Math.PI, 0);
        ctx.stroke();

        // Kuvun "hattu" (patinoitu harmaa) – pyöreä: keskiö vaalea, laidat tummemmat
        if (lamp.overheat) {
            ctx.fillStyle = '#662200';
            ctx.fillRect(bx - 9, bulbY - 3, 18, 4);
        } else {
            const capGrad = ctx.createLinearGradient(bx - 9, 0, bx + 9, 0);
            capGrad.addColorStop(0,   '#2f2f2f');
            capGrad.addColorStop(0.5, '#5f5f5f');
            capGrad.addColorStop(1,   '#2f2f2f');
            ctx.fillStyle = capGrad;
            ctx.fillRect(bx - 9, bulbY - 3, 18, 4);
        }

        // Pieni valopilkku kuvun sisällä (himmenee päivällä)
        if (litNow && dayDim > 0.01) {
            ctx.save();
            ctx.globalAlpha = dayDim;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(bx, bulbY + 4, 4, 0, Math.PI*2);
            ctx.fill();
            // Moskiitot lampun valossa – häipyvät päivällä kokonaan
            const mosquitoDim = 1 - MOSQUITO_DAY_DIM * dayNight.t;
            if (mosquitoDim > 0.01) {
                ctx.globalAlpha = dayDim * mosquitoDim;
                const t = Date.now() * 0.001;
                const mAlphaMin = isTouchDevice ? 0.25 : 0.126;
                const mAlphaRange = isTouchDevice ? 0.2 : 0.063;
                const mRadius = isTouchDevice ? 2.0 : 1.3;
                const mGlow = isTouchDevice;
                /* BAD/FULL – jokaisella moskiitolla oma satunnainen koko
                   (100–300 % nykyisestä) ja väri (sävy 0–360°). Arvotaan KERRAN
                   per kierros (lamp._mosq; nollataan init()issä) → selkeä
                   vaihtelu, ei per-frame-vilkkumista. NORMAL/MILD/GOOD: ei
                   haaraa → entinen kiinteä koko/väri (bitti-identtinen). */
                const mosqChaos = chaosFlags.mosquitoes;   // BAD/FULL: isommat ja tummemmat hyttyset (K1/K3)
                if (mosqChaos && !lamp._mosq) {
                    lamp._mosq = [];
                    for (let k = 0; k < 4; k++) {
                        lamp._mosq.push({ sizeMult: 1 + 2 * Math.random(), hue: Math.floor(Math.random() * 360) });
                    }
                }
                for (let m = 0; m < 4; m++) {
                    const mt = t * (1.1 + m * 0.25);
                    const mx = bx + Math.cos(mt + m * 2.3) * (10 + Math.sin(mt * 0.6) * 5);
                    const my = bulbY + 6 + Math.sin(mt * 1.2 + m * 1.7) * (8 + Math.cos(mt * 0.8) * 4);
                    const malpha = mAlphaMin + Math.sin(mt * 2.5 + m) * mAlphaRange;
                    const attr = mosqChaos ? lamp._mosq[m] : null;
                    const sizeF = attr ? (attr.sizeMult - 1) / 2 : 0;   // 0–1: kuinka iso (1 = 300 %)
                    const r = attr ? mRadius * attr.sizeMult : mRadius;
                    const dotCol  = attr ? ('hsla(' + attr.hue + ',95%,70%,') : 'rgba(255,240,170,';
                    const glowCol = attr ? ('hsla(' + attr.hue + ',90%,62%,') : 'rgba(255,220,140,';
                    /* isoilla moskiitoilla kevyempi ulkoreuna (ei "isoja
                       palloja") ja tummempi keskuspiste (runko), joka kasvaa koon
                       mukana → kokoero näkyy ilman liioittelua. NORMAL (attr=null):
                       sizeF 0 → identtinen entisen kanssa (bitti-identtinen). */
                    const edgeFade = 1 - 0.30 * sizeF;               // iso = hieman kevyempi
                    const haloA = Math.min(1, malpha + (mGlow ? 0.15 : 0)) * edgeFade;
                    if (mGlow) {
                        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, r * 2);
                        glow.addColorStop(0, glowCol + (malpha * edgeFade) + ')');
                        glow.addColorStop(1, glowCol + '0)');
                        ctx.fillStyle = glow;
                        ctx.beginPath();
                        ctx.arc(mx, my, r * 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.fillStyle = dotCol + haloA + ')';
                    ctx.beginPath();
                    ctx.arc(mx, my, r, 0, Math.PI * 2);
                    ctx.fill();
                    if (attr) {
                        // Tummempi keskuspiste (runko): alfa kasvaa koon mukana,
                        // jotta pienet pysyvät huomaamattomina ja isot erottuvat.
                        const bodyA = Math.min(0.9, (malpha + 0.10) * (0.5 + sizeF));
                        ctx.fillStyle = 'hsla(' + attr.hue + ',85%,30%,' + bodyA.toFixed(3) + ')';
                        ctx.beginPath();
                        ctx.arc(mx, my, r * 0.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
        }
        if (lamp.overheat) {
            const flicker = Math.sin(Date.now() * 0.03) * 0.4 + 0.6;
            ctx.fillStyle = 'rgba(255,120,20,' + flicker + ')';
            ctx.beginPath();
            ctx.arc(bx, bulbY + 4, 3, 0, Math.PI*2);
            ctx.fill();
        }
    }

    /* ── Ovi talossa ─────────────────────────────── */
    function drawDoor(bldg) {
        const dc = doorCenter(bldg);
        const dx = dc.x - DOOR_W / 2;
        const dy = GROUND_Y - DOOR_H;
        const ownerLamp = lamps.find(l => l.bldgIdx === buildings.indexOf(bldg));
        const bldgIdx = buildings.indexOf(bldg);
        /* tuhoutuneen talon mustaa ovea EI enää piirretä (9 mustaa ovea
           näytti epäloogiselta). Vain YKSI satunnainen talo saa pitää ovensa
           pystyssä – ja siitäkin jää pelkät ulkokarmit: ei ovea, ei lehteä, ei
           kahvaa, ei kynnysvaloa. Arpa on heitetty tuhoutumishetkellä
           (updateBuildingDamage → standingDoorIdx). */
        if (buildingGone(bldgIdx)) {
            if (bldgIdx !== standingDoorIdx) return;
            const sF = buildingScale(bldg);
            ctx.save();
            ctx.translate(dc.x, GROUND_Y);
            ctx.scale(sF, sF);
            ctx.translate(-dc.x, -GROUND_Y);
            ctx.fillStyle = '#241d16';                              // hiiltynyt karmi
            ctx.fillRect(dx - 2, dy - 2, 2, DOOR_H + 2);            // vasen karmi
            ctx.fillRect(dx + DOOR_W, dy - 2, 2, DOOR_H + 2);       // oikea karmi
            ctx.fillRect(dx - 2, dy - 4, DOOR_W + 4, 2);            // yläkarmi
            ctx.strokeStyle = 'rgba(126,116,100,0.45)';             // kulunut reuna
            ctx.lineWidth = 1;
            ctx.strokeRect(dx - 2.5, dy - 4.5, DOOR_W + 5, DOOR_H + 5);
            ctx.restore();
            return;
        }
        const isBar = (bldgIdx === 8);
        // Jukebox-talo (5): ovi näkyy auki vasta kun ikkunat on potkaistu valaistuiksi
        const isJukebox = (bldgIdx === JUKEBOX_BLDG_IDX);
        const jukeboxOpen = isJukebox && !!(smallHouseLights[bldgIdx] && smallHouseLights[bldgIdx].lit);
        // Laivanupotus (talo 2): sama mekanismi, aina auki yöllä ja päivällä
        const isSinkship = (bldgIdx === SINKSHIP_BLDG_IDX);
        const sinkshipOpen = isSinkship && !!(smallHouseLights[bldgIdx] && smallHouseLights[bldgIdx].lit);
        // Makuuhuone (talo 7): ovi on aina auki (kuten BAR)
        const sleepOpen = (bldgIdx === SLEEP_BLDG_IDX);
        const isActive = (isBar || jukeboxOpen || sinkshipOpen || sleepOpen) ? true
                       : (ownerLamp && (ownerLamp.lit || lampFreeOpen()));
        const doorType = bldg.doorType || 0;

        // Syvyysefekti: ovi skaalautuu talon etäisyyden mukaan (pohjan keskipisteen ympäri)
        const s = buildingScale(bldg);
        ctx.save();
        ctx.translate(dc.x, GROUND_Y);
        ctx.scale(s, s);
        ctx.translate(-dc.x, -GROUND_Y);

        // Ovikaari / syvennys (kaikille yhteinen)
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(dx - 2, dy - 2, DOOR_W + 4, DOOR_H + 2);

        // Oven runkovärit
        const doorBase = isActive ? '#5a3a20' : '#1a1010';
        const doorAccent = isActive ? '#7a4a30' : '#2a1a1a';
        const doorLight = isActive ? '#8a5a40' : '#1e1515';
        const doorDark = isActive ? '#3a2010' : '#0e0a0a';

        switch (doorType) {
            case 0: // Klassinen kaksipaneeli (alkuperäinen)
                ctx.fillStyle = doorBase; ctx.fillRect(dx, dy, DOOR_W, DOOR_H);
                ctx.strokeStyle = doorAccent; ctx.lineWidth = 1;
                ctx.strokeRect(dx + 3, dy + 3, Math.floor(DOOR_W/2) - 6, DOOR_H - 10);
                ctx.strokeRect(dx + DOOR_W/2 + 2, dy + 3, Math.floor(DOOR_W/2) - 6, DOOR_H - 10);
                drawHandle(dx + DOOR_W - 6, dy + DOOR_H/2, isActive);
                break;
            case 1: // Yksipaneeli (keskitetty)
                ctx.fillStyle = doorBase; ctx.fillRect(dx, dy, DOOR_W, DOOR_H);
                ctx.strokeStyle = doorAccent; ctx.lineWidth = 1;
                const pw = DOOR_W - 12, ph = DOOR_H - 16;
                ctx.strokeRect(dx + 6, dy + 5, pw, ph);
                ctx.strokeStyle = doorDark; ctx.lineWidth = 0.5;
                ctx.strokeRect(dx + 8, dy + 7, pw - 4, ph - 4);
                drawHandle(dx + DOOR_W - 7, dy + DOOR_H/2, isActive);
                break;
            case 2: // Kaariovi
                ctx.fillStyle = doorBase; ctx.fillRect(dx, dy + 8, DOOR_W, DOOR_H - 8);
                ctx.beginPath(); ctx.arc(dc.x, dy + 8, DOOR_W/2, Math.PI, 0); ctx.fill();
                ctx.strokeStyle = doorAccent; ctx.lineWidth = 1; ctx.stroke();
                ctx.strokeStyle = doorAccent; ctx.lineWidth = 0.7;
                ctx.beginPath(); ctx.arc(dc.x - DOOR_W/4 + 1, dy + 12, DOOR_W/4 - 3, Math.PI*0.9, Math.PI*2.1); ctx.stroke();
                ctx.beginPath(); ctx.arc(dc.x + DOOR_W/4 - 1, dy + 12, DOOR_W/4 - 3, Math.PI*0.9, Math.PI*2.1, true); ctx.stroke();
                drawHandle(dx + DOOR_W - 6, dy + DOOR_H/2 + 4, isActive);
                break;
            case 3: // Ikkunaovi (lasi yläosassa)
                ctx.fillStyle = doorBase; ctx.fillRect(dx, dy, DOOR_W, DOOR_H);
                const wiY = dy + 4, wiH = 14, wiP = 5;
                ctx.fillStyle = isActive ? '#3a3020' : '#0a0a10';
                ctx.fillRect(dx + wiP, wiY, DOOR_W - wiP*2, wiH);
                ctx.fillStyle = isActive ? 'rgba(255,200,100,0.25)' : 'rgba(20,20,30,0.4)';
                ctx.fillRect(dx + wiP + 1, wiY + 1, DOOR_W - wiP*2 - 2, wiH - 2);
                ctx.strokeStyle = doorDark; ctx.lineWidth = 0.7;
                ctx.strokeRect(dx + wiP + 1, wiY + 1, DOOR_W - wiP*2 - 2, wiH - 2);
                ctx.beginPath(); ctx.moveTo(dc.x, wiY + 1); ctx.lineTo(dc.x, wiY + wiH - 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(dx + wiP + 1, wiY + wiH/2); ctx.lineTo(dx + DOOR_W - wiP - 2, wiY + wiH/2); ctx.stroke();
                ctx.strokeStyle = doorAccent; ctx.lineWidth = 1;
                ctx.strokeRect(dx + 4, wiY + wiH + 5, DOOR_W - 8, DOOR_H - wiH - 14);
                drawHandle(dx + DOOR_W - 6, dy + DOOR_H/2, isActive);
                break;
            case 4: // Lautaovi (pystylaudoitus)
                ctx.fillStyle = doorBase; ctx.fillRect(dx, dy, DOOR_W, DOOR_H);
                const pW = 6, pN = Math.floor(DOOR_W / pW);
                for (let p = 0; p < pN; p++) {
                    ctx.fillStyle = p % 2 === 0 ? doorBase : doorDark;
                    ctx.fillRect(dx + p * pW, dy, pW, DOOR_H);
                }
                ctx.fillStyle = doorDark;
                ctx.fillRect(dx + 1, dy + 6, DOOR_W - 2, 3);
                ctx.fillRect(dx + 1, dy + DOOR_H - 10, DOOR_W - 2, 3);
                ctx.fillStyle = doorLight;
                for (let p = 0; p < pN; p++) {
                    ctx.fillRect(dx + p * pW + 1, dy + 7, 2, 1);
                    ctx.fillRect(dx + p * pW + 1, dy + DOOR_H - 9, 2, 1);
                }
                drawHandle(dx + DOOR_W - 7, dy + DOOR_H/2, isActive);
                break;
            case 5: // Moderni sileä ovi
                ctx.fillStyle = doorBase;
                ctx.fillRect(dx + 1, dy + 1, DOOR_W - 2, DOOR_H - 2);
                ctx.strokeStyle = doorAccent; ctx.lineWidth = 1.5;
                ctx.strokeRect(dx + 1, dy + 1, DOOR_W - 2, DOOR_H - 2);
                const barY = dy + DOOR_H/2;
                ctx.fillStyle = isActive ? '#ccaa66' : '#444';
                ctx.fillRect(dx + DOOR_W - 10, barY - 1, 8, 3);
                ctx.fillStyle = isActive ? '#ffd700' : '#555';
                ctx.fillRect(dx + DOOR_W - 9, barY - 0.5, 6, 2);
                ctx.fillStyle = isActive ? '#ffd700' : '#333';
                ctx.beginPath();
                ctx.arc(dx + DOOR_W - 7, dy + DOOR_H/2 - 6, 1.8, 0, Math.PI*2);
                ctx.fill();
                break;
            case 6: // Koristeellinen (listoitukset + tympanoni)
                ctx.fillStyle = doorBase; ctx.fillRect(dx, dy, DOOR_W, DOOR_H);
                ctx.strokeStyle = doorAccent; ctx.lineWidth = 1;
                ctx.strokeRect(dx + 2, dy + 2, DOOR_W - 4, DOOR_H - 4);
                ctx.strokeStyle = doorLight; ctx.lineWidth = 0.7;
                ctx.strokeRect(dx + 4, dy + 4, DOOR_W - 8, DOOR_H - 8);
                ctx.fillStyle = doorDark;
                ctx.fillRect(dx + 5, dy + 6, DOOR_W - 10, 10);
                ctx.strokeStyle = doorLight; ctx.lineWidth = 0.5;
                ctx.strokeRect(dx + 5, dy + 6, DOOR_W - 10, 10);
                ctx.strokeStyle = doorAccent; ctx.lineWidth = 0.7;
                ctx.strokeRect(dx + 7, dy + 20, DOOR_W/2 - 10, DOOR_H - 28);
                ctx.strokeRect(dx + DOOR_W/2 + 2, dy + 20, DOOR_W/2 - 10, DOOR_H - 28);
                drawHandle(dx + DOOR_W - 7, dy + DOOR_H/2, isActive);
                break;
        }

        // Merkkivalo oven yllä (kaikille yhteinen)
        if (ownerLamp) {
            // K7 "Valot sammuvat" pimentää myös ovivalon (vain piirto)
            const doorLit = ownerLamp.lit && !StreetChaosCards.lightsOut;
            ctx.fillStyle = doorLit ? '#ffd700' : '#222';
            if (doorLit) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 6; }
            ctx.fillRect(dx + DOOR_W/2 - 5, dy - 7, 10, 3);
            ctx.shadowBlur = 0;
        }

        // BAR-kyltti oven yllä (talo 8)
        if (isBar) {
            ctx.fillStyle = '#6b2d0a';
            ctx.fillRect(dx - 4, dy - 26, DOOR_W + 8, 16);
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(dx - 2, dy - 24, DOOR_W + 4, 12);
            const barPhase = Date.now() / 350;
            const blink = Math.sin(barPhase);
            const barHue = 46 + blink * 6;
            const barLight = 50 + blink * 38;              // 12–88 % – selkeä vilkku
            ctx.fillStyle = 'hsl(' + barHue + ', 100%, ' + barLight + '%)';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 6 + Math.abs(blink) * 16;     // hehku voimistuu kirkkaana
            ctx.font = 'bold 9px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('  BAR  ', dc.x, dy - 14);
            ctx.shadowBlur = 0;
            ctx.textAlign = 'start';
        }

        // Jukebox-kyltti oven yllä (talo 5) – kiinni yläkarmissa (alareuna 1 px
        // oviaukon yläreunan yläpuolella). Terävä neoni: tumma ääriviiva
        // pitää tekstin luettavana, hehku on pieni (ei sumeaa massaa).
        if (isJukebox) {
            ctx.fillStyle = '#2a1030';
            ctx.fillRect(dx - 12, dy - 19, DOOR_W + 24, 16);
            ctx.fillStyle = '#3d1846';
            ctx.fillRect(dx - 10, dy - 17, DOOR_W + 20, 12);
            // Päivällä kyltti sammutettu (jukebox auki vain öisin):
            // neoni ei pala eikä hehku – laatta jää näkyviin sammuneena.
            const dayClosed = nightOnlyClosed();
            const jkBlink = Math.sin(Date.now() / 420);
            const jkLight = dayClosed ? 16 : ((jukeboxOpen ? 62 : 46) + jkBlink * 14);
            ctx.font = 'bold 9px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(18,4,22,0.9)';
            ctx.strokeText('♪JUKEBOX', dc.x, dy - 7);
            ctx.fillStyle = 'hsl(318, 100%, ' + jkLight + '%)';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = dayClosed ? 0 : (3 + Math.abs(jkBlink) * 5);
            ctx.fillText('♪JUKEBOX', dc.x, dy - 7);
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1;
            ctx.textAlign = 'start';
        }

        ctx.restore();
    }

    function drawHandle(hx, hy, isActive) {
        ctx.fillStyle = isActive ? '#ffd700' : '#333';
        ctx.beginPath();
        ctx.arc(hx, hy, 2.5, 0, Math.PI*2);
        ctx.fill();
    }
/* ── Kolikko ──────────────────────────────────── */
    function drawCoin() {
        const cx = coin.x, cy = coin.y;
        // Hehku
        const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 4.5);
        g.addColorStop(0, 'rgba(255,215,0,0.5)');
        g.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(cx, cy, 4.5, 2, 0, 0, Math.PI*2); ctx.fill();
        // Kolikon pinta (litistetty perspektiivi)
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.ellipse(cx, cy, 4 + Math.sin(coin.sparkle) * 0.3, 1.5, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#cc9900'; ctx.lineWidth = 0.5;
        ctx.stroke();
        // $ -merkki
        ctx.fillStyle = '#aa7700';
        ctx.font = 'bold 3px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('$', cx, cy + 1);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }

    /* ── Sädease-esine kadulla ───────────── */
    function drawBeamPickup() {
        const bx = beamPickup.x, by = beamPickup.y;
        const glow = ctx.createRadialGradient(bx, by, 1, bx, by, 7);
        glow.addColorStop(0, 'rgba(150,200,255,0.5)');
        glow.addColorStop(1, 'rgba(150,200,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
        // Sädease: kapea runko + piippu (osoittaa ylös)
        ctx.save();
        ctx.translate(bx, by);
        ctx.fillStyle = '#3a4a66';
        ctx.fillRect(-2, -8, 4, 8);          // runko
        ctx.fillStyle = '#9fb8d8';
        ctx.fillRect(-1, -14, 2, 6);         // piippu
        ctx.fillStyle = '#7fe0ff';           // hohtava kärki
        ctx.fillRect(-1, -15, 2, 2);
        /* pieni vilkkuva keltainen piste piipun yllä. Vain PISTE vilkkuu
           (ase pysyy paikallaan) – pelaaja hoksaa, että esine on poimittava.
           Jukeboxin neonin tapaan aika lasketaan Date.now():sta (ei uutta tilaa). */
        const blink = Math.sin(Date.now() / 200) * 0.5 + 0.5;       // 0…1, ~1,25 s sykli
        const dotAlpha = 0.25 + blink * 0.75;
        const dotGlow = ctx.createRadialGradient(0, -20, 0.5, 0, -20, 4);
        dotGlow.addColorStop(0, 'rgba(255,235,120,' + (0.55 * dotAlpha).toFixed(3) + ')');
        dotGlow.addColorStop(1, 'rgba(255,220,80,0)');
        ctx.fillStyle = dotGlow;
        ctx.beginPath(); ctx.arc(0, -20, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,240,140,' + dotAlpha.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(0, -20, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    /* ── Säde: pystyviiva pelaajasta tähtäyspisteeseen ── */
    function drawBeam() {
        // Tähtäysristikko vain PC:llä (hiiri), kun tähtäys aktiivinen
        if (beamCanFire() && !isTouchDevice && aimActive) {
            const sh = drunkAimShift();      // ristikko horjuu humalassa
            const cx = aimX + sh.x, cy = aimY + sh.y;
            ctx.strokeStyle = 'rgba(150,210,255,0.9)';
            ctx.lineWidth = 1;
            const r = 4;
            ctx.beginPath();
            ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
            ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
            ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(150,210,255,0.4)';
            ctx.stroke();
        }
        // Laser-valoraita: kirkas ydin + hehku, häipyy ~1 s ajan
        if (beamFireTimer > 0) {
            const life = beamFireTimer / BEAM_FIRE_FRAMES;   // 1 → 0
            const fade = Math.min(1, life * 1.6);            // kirkkaana alussa, häipyy lopussa
            ctx.save();
            ctx.lineCap = 'round';
            // Ulompi hehku (leveä, himmeä)
            ctx.strokeStyle = 'rgba(120,190,255,' + (0.32 * fade).toFixed(3) + ')';
            ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(beamStartX, beamStartY); ctx.lineTo(beamEndX, beamEndY); ctx.stroke();
            // Keskimmäinen raita
            ctx.strokeStyle = 'rgba(170,215,255,' + (0.65 * fade).toFixed(3) + ')';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(beamStartX, beamStartY); ctx.lineTo(beamEndX, beamEndY); ctx.stroke();
            // Ydin (lähes valkoinen)
            ctx.strokeStyle = 'rgba(238,250,255,' + (0.95 * fade).toFixed(3) + ')';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(beamStartX, beamStartY); ctx.lineTo(beamEndX, beamEndY); ctx.stroke();
            ctx.restore();
        }
    }

    /* ── Kukkaruukku ──────────────────────────────── */
    function drawFlowerPot() {
        const fp = flowerPot;
        ctx.save(); ctx.translate(fp.x, fp.y); ctx.rotate(fp.rotation);
        ctx.fillStyle = '#8B4513'; ctx.beginPath(); ctx.moveTo(-6,3); ctx.lineTo(-8,-5); ctx.lineTo(8,-5); ctx.lineTo(6,3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5a2d0c'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#3d2817'; ctx.fillRect(-6,-5,12,2);
        ctx.fillStyle = '#2d8a2d'; ctx.beginPath(); ctx.ellipse(2,-7,4,2.5,0.3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-3,-6,3,2,-0.4,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }

    /* ── Potkusta pudonnut kolikko ────────────────── */
    function drawKickCoin() {
        const kx = kickCoin.x, ky = kickCoin.y;
        const spin = kickCoin.landed ? 0 : Math.sin(Date.now() / 55) * 0.5;
        // Hehku
        const g = ctx.createRadialGradient(kx, ky, 1, kx, ky, 6);
        g.addColorStop(0, 'rgba(255,215,0,0.6)');
        g.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(kx, ky, 6, 0, Math.PI * 2); ctx.fill();
        // Kolikon pinta
        ctx.fillStyle = '#ffd700';
        ctx.beginPath(); ctx.ellipse(kx, ky, 5 + spin, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#cc9900'; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.fillStyle = '#aa7700';
        ctx.font = 'bold 4px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('$', kx, ky + 1);
        ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }

    /* ── Katueläin ───────────────────────────────── */
    /* Jalkapiste (syvyys) samalla logiikalla kuin drawAnimal laskee sprite-y:n:
       ay = a.y + a.hopY + (rabbit-lisä) → jalat ≈ ay + a.h. Verrataan
       LAMP_BASE_Y:hin, jotta eläin piirtyy pylvään eteen tai taakse. */
    function animalDepthFeet() {
        const a = groundAnimal; if (!a) return 0;
        return Math.round(a.y + a.hopY + (a.type === 'rabbit' ? 25 : 0)) + a.h;
    }

    function drawAnimal() {
        const a = groundAnimal; if (!a) return;
        const ax = Math.round(a.x), ay = Math.round(a.y + a.hopY + (a.type === 'rabbit' ? 25 : 0)), dir = a.direction;
        const t = a.animTimer;
        ctx.save();
        if (a.type === 'mouse') {
            const bob = Math.sin(t*0.25)*0.8;
            ctx.fillStyle = '#999aaa'; ctx.fillRect(ax+1, ay+bob, 10, 4);
            const hx = dir>0?ax+9:ax-3;
            ctx.fillStyle = '#aaaabb'; ctx.fillRect(hx, ay-1+bob, 5, 5);
            ctx.fillStyle = '#111'; ctx.fillRect(hx+(dir>0?3:1), ay+bob, 1.5, 1.5);
            ctx.fillStyle = '#cc9999'; ctx.beginPath(); ctx.arc(hx+2, ay-3+bob+Math.sin(t*0.3)*1, 2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#777788'; const lp = t*0.5;
            for (let l=0;l<4;l++) { const lx=ax+2+l*2.5; ctx.fillRect(lx, ay+3+bob, 1.5, 2+Math.sin(lp+l*1.5)*1.5); }
            ctx.strokeStyle = '#8877aa'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(dir>0?ax:ax+10, ay+2+bob);
            ctx.quadraticCurveTo(dir>0?ax-5:ax+15, ay+Math.sin(t*0.35)*4+bob, dir>0?ax-10:ax+20, ay-1+Math.sin(t*0.35)*4+bob); ctx.stroke();
        } else if (a.type === 'rat') {
            const bob = Math.sin(t*0.2)*0.6;
            ctx.fillStyle = '#776655'; ctx.fillRect(ax+1, ay+1+bob, 16, 5);
            const hx = dir>0?ax+14:ax-5;
            ctx.fillStyle = '#887766'; ctx.fillRect(hx, ay-2+bob, 6, 6);
            ctx.fillStyle = '#330000'; ctx.fillRect(hx+(dir>0?4:1), ay-1+bob, 2, 2);
            ctx.fillStyle = '#aa8877'; ctx.beginPath(); ctx.arc(hx+2, ay-4+bob+Math.sin(t*0.25)*0.8, 2.5, 0, Math.PI); ctx.fill();
            ctx.fillStyle = '#554433'; const lp = t*0.4;
            for (let l=0;l<4;l++) { const lx=ax+3+l*3.5; ctx.fillRect(lx, ay+5+bob, 1.5, 2.5+Math.sin(lp+l*1.4)*1.8); }
            ctx.strokeStyle = '#aa9988'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(dir>0?ax:ax+16, ay+3+bob);
            ctx.bezierCurveTo(dir>0?ax-6:ax+22, ay+Math.sin(t*0.22)*5+bob, dir>0?ax-12:ax+28, ay+Math.sin(t*0.28+1.5)*4+bob, dir>0?ax-18:ax+34, ay-2+bob); ctx.stroke();
        } else {
            const bodyY = ay;
            ctx.fillStyle = '#b0a090'; ctx.fillRect(ax+2, bodyY+2, 10, 7);
            ctx.fillStyle = '#c0b0a0'; ctx.fillRect(ax+(dir>0?8:0), bodyY-3+Math.sin(t*0.15)*1.2, 5, 5);
            ctx.fillStyle = '#111'; ctx.fillRect(ax+(dir>0?11:1), bodyY-1+Math.sin(t*0.15)*1.2, 1.5, 1.5);
            const ew = Math.sin(t*0.25)*2;
            ctx.fillStyle = '#c0b0a0'; ctx.fillRect(ax+(dir>0?9:3), bodyY-9+ew, 2, 6); ctx.fillRect(ax+(dir>0?11:5), bodyY-8-ew, 2, 6);
            ctx.fillStyle = '#e0c0c0'; ctx.fillRect(ax+(dir>0?10:4), bodyY-8+ew, 1, 3); ctx.fillRect(ax+(dir>0?12:6), bodyY-7-ew, 1, 3);
            ctx.fillStyle = '#f0f0f0'; ctx.beginPath(); ctx.arc(dir>0?ax+1:ax+11, bodyY+5+Math.sin(t*0.3)*1.5, 3, 0, Math.PI*2); ctx.fill();
            if (a.hopY >= -1) { ctx.fillStyle = '#a09080'; ctx.fillRect(ax+(dir>0?6:0), bodyY+7, 2, 2); ctx.fillRect(ax+(dir>0?9:3), bodyY+7, 2, 2); }
        }
        ctx.restore();
    }


    /* ── Oviukko (Avenger) – pelaajan kaksonen, astuu ovesta ──
       Sama blokkityyli kuin drawPlayer, mutta tunnisteväri (tummanpunainen paita)
       – erottuu pelaajasta ilman tekstiä. Skaalautuu talon buildingScale()-arvolla. */
    function drawAvenger() {
        const a = avenger;
        if (!a) return;
        const s = a.scale || 1;
        const px = Math.round(a.x), py = Math.round(a.y);
        const pw = a.w, ph = a.h;
        // Ulostulo: liukuu esiin kynnykseltä (alpha + pieni nousu)
        const emerge = a.phase === 'emerge'
            ? 1 - Math.max(0, Math.min(1, a.timer / AVENGER_TELEGRAPH)) : 1;
        const top = py + (1 - emerge) * 10;
        const bobY = (Math.floor(a.walkTimer / 6) % 2) * 1;   // 2-frame kävelysykli

        ctx.save();
        // Peilaus kulkusuunnan mukaan + talon syvyysskaalaus (pohjan keskipiste)
        ctx.translate(px + pw / 2, GROUND_Y);
        ctx.scale(s * (a.facing === -1 ? -1 : 1), s);
        ctx.translate(-(px + pw / 2), -GROUND_Y);
        ctx.globalAlpha = 0.35 + 0.65 * emerge;

        // Maakosketusvarjo (2 kerrosta, kuten pelaajalla)
        const feetX = px + pw / 2, feetY = py + ph - 1;
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath(); ctx.ellipse(feetX, feetY, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath(); ctx.ellipse(feetX, feetY, 6, 1.8, 0, 0, Math.PI * 2); ctx.fill();

        // Housut + kengät
        ctx.fillStyle = '#16265c';
        ctx.fillRect(px + 4, top + 21 + bobY, pw - 8, 8);
        ctx.fillStyle = '#221008';
        ctx.fillRect(px + 4, top + 29, pw - 8, 2);
        // Vartalo – tunnisteväri: tummanpunainen paita (pelaaja #3366cc)
        ctx.fillStyle = '#a03030';
        ctx.fillRect(px + 4, top + 10 + bobY, pw - 8, ph - 18);
        // Kylkivarjostus + etureunan valokaista
        ctx.fillStyle = '#7a2020';
        ctx.fillRect(px + 4, top + 10 + bobY, 2, ph - 18);
        ctx.fillStyle = '#c05050';
        ctx.fillRect(px + pw - 5, top + 10 + bobY, 1, ph - 18);
        // Vyötärön raja
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.fillRect(px + 4, top + 21 + bobY, pw - 8, 1);
        // Kädet (lepoasento, seuraa bobY:tä) + kädet hihan päissä
        const backArmX = px + 3, frontArmX = px + pw - 6, armY = top + 12 + bobY;
        ctx.fillStyle = '#7a2020';
        ctx.fillRect(backArmX, armY, 3, 8);
        ctx.fillRect(frontArmX, armY, 3, 8);
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(backArmX, armY + 8, 3, 2);
        ctx.fillRect(frontArmX, armY + 8, 3, 2);
        // Pää + hiukset
        ctx.fillStyle = '#ffcc99';
        ctx.beginPath(); ctx.arc(px + pw / 2, top + 6 + bobY, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#553300';
        ctx.beginPath(); ctx.arc(px + pw / 2, top + 3 + bobY, 7, Math.PI, 0); ctx.fill();
        // Kasvojen takaosan varjo + lipan varjo
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(px + 4, top + 6 + bobY, 2, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(px + 5, top + 5 + bobY, 11, 1);
        // Silmä (kulkusuunnan puoleinen)
        ctx.fillStyle = '#2b2118';
        ctx.fillRect(px + 13, top + 7 + bobY, 2, 2);
        // Jäädytyksen aikana käsi ojennettuna kohti pelaajaa (isku kiinni)
        if (a.phase === 'hold') {
            ctx.fillStyle = '#7a2020';
            ctx.fillRect(frontArmX + 3, armY + 1, 7, 3);
            ctx.fillStyle = '#ffcc99';
            ctx.fillRect(frontArmX + 10, armY + 1, 3, 3);
        }
        // Lippis (tunnisteväri)
        ctx.fillStyle = '#a03030';
        ctx.fillRect(px + pw / 2 - 6, top, 14, 5);
        ctx.fillStyle = '#7a2020';
        ctx.fillRect(px + pw / 2 + 2, top + 1, 7, 3);

        ctx.restore();
    }

    /* ── Rosvo – pelaajan kaksonen mustissa vaatteissa (Spy vs Spy),
       puukko kädessä. Partioi jalkakäytävällä. Sama blokkityyli kuin
       drawAvenger, mutta tunnistevärit: musta asu + teräs puukko. */
    function drawRobber() {
        const r = robber;
        if (!r) return;
        const px = Math.round(r.x), py = Math.round(r.y);
        const pw = r.w, ph = r.h;
        const bobY = (Math.floor(r.walkTimer / 6) % 2) * 1;   // 2-frame kävelysykli
        const top = py;

        ctx.save();
        // Peilaus kulkusuunnan mukaan (akseli rosvon jalkaviivalla)
        ctx.translate(px + pw / 2, py + ph - 1);
        ctx.scale(r.facing === -1 ? -1 : 1, 1);
        ctx.translate(-(px + pw / 2), -(py + ph - 1));

        // Maakosketusvarjo (2 kerrosta, kuten pelaajalla)
        const feetX = px + pw / 2, feetY = py + ph - 1;
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath(); ctx.ellipse(feetX, feetY, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath(); ctx.ellipse(feetX, feetY, 6, 1.8, 0, 0, Math.PI * 2); ctx.fill();

        // Housut + kengät (musta)
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(px + 4, top + 21 + bobY, pw - 8, 8);
        ctx.fillStyle = '#000000';
        ctx.fillRect(px + 4, top + 29, pw - 8, 2);
        // Vartalo – musta paita (pelaaja #3366cc)
        ctx.fillStyle = '#151515';
        ctx.fillRect(px + 4, top + 10 + bobY, pw - 8, ph - 18);
        // Kylkivarjostus + etureunan valokaista (hienovarainen)
        ctx.fillStyle = '#000000';
        ctx.fillRect(px + 4, top + 10 + bobY, 2, ph - 18);
        ctx.fillStyle = '#2e2e2e';
        ctx.fillRect(px + pw - 5, top + 10 + bobY, 1, ph - 18);
        // Vyötärön raja
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(px + 4, top + 21 + bobY, pw - 8, 1);
        // Kädet (lepoasento) + kädet hihan päissä
        const backArmX = px + 3, frontArmX = px + pw - 6, armY = top + 12 + bobY;
        ctx.fillStyle = '#151515';
        ctx.fillRect(backArmX, armY, 3, 8);
        ctx.fillRect(frontArmX, armY, 3, 8);
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(backArmX, armY + 8, 3, 2);
        ctx.fillRect(frontArmX, armY + 8, 3, 2);
        // Pää + hiukset
        ctx.fillStyle = '#ffcc99';
        ctx.beginPath(); ctx.arc(px + pw / 2, top + 6 + bobY, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.arc(px + pw / 2, top + 3 + bobY, 7, Math.PI, 0); ctx.fill();
        // Kasvojen varjo + silmä (kulkusuunnan puoleinen)
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(px + 4, top + 6 + bobY, 2, 4);
        ctx.fillStyle = '#2b2118';
        ctx.fillRect(px + 13, top + 7 + bobY, 2, 2);
        // Puukko etummaisessa kädessä (kahva + terä), osoittaa kulkusuuntaan
        ctx.fillStyle = '#333333';
        ctx.fillRect(frontArmX + 1, armY + 6, 3, 2);          // kahva
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(frontArmX + 4, armY + 4, 2, 5);          // terä
        ctx.beginPath();
        ctx.moveTo(frontArmX + 6, armY + 4);
        ctx.lineTo(frontArmX + 9, armY + 6.5);
        ctx.lineTo(frontArmX + 6, armY + 9);
        ctx.closePath(); ctx.fill();                          // terän kärki
        // Hattu (Spy vs Spy – musta)
        ctx.fillStyle = '#000000';
        ctx.fillRect(px + pw / 2 - 6, top, 14, 5);
        ctx.fillRect(px + pw / 2 + 2, top + 1, 7, 3);

        ctx.restore();
    }

    /* ── Pelaaja avoimessa kaivossa ─────────
       Pudotus: hahmo kutistuu nopeasti reiän keskipisteeseen → vajoaa alas ja
       katoaa (musta aukko piirretään päälle: drawManholeOverlay).
       Ylöskiipeäminen: nousee hitaasti (~3,5 s) reiän keskeltä, askel reunan
       yli viimeistelee – pieni sivuttaisheilunta tekee köpimisen tunnun. */
    function drawPlayerManhole() {
        const a = manhole.action;
        if (a.phase === 'fall' && a.t <= 0) return;   // pohjalla → ei piirretä
        const feetX = Math.round(player.x) + player.w / 2;
        const feetY = Math.round(player.y) + player.h - 1;
        let k, wob = 0;
        if (a.phase === 'fall') {
            // 1 → 0,10 (katoaa reikään)
            const p = Math.max(0, Math.min(1, 1 - a.t / MH_FALL_FRAMES));
            k = 1 - 0.90 * p;
        } else {
            // 0,10 → 1: nousee esiin reiän keskeltä; loppuosa = askel reunan yli
            const p = Math.max(0, Math.min(1, 1 - a.t / MH_CLIMB_FRAMES));
            const riseP = Math.min(1, p / MH_RISE_PART);
            k = 0.10 + 0.90 * riseP;
            wob = Math.sin(p * Math.PI * 7) * MH_CLIMB_WOBBLE * (1 - riseP);
        }
        if (k <= 0.05) return;
        ctx.save();
        ctx.translate(feetX + wob, feetY);
        ctx.scale(k, k);
        ctx.translate(-feetX, -feetY);
        drawPlayer();
        ctx.restore();
    }

    /* ── Pelaaja ────────────────────────────────── */
    /* ── Syvyysskaalaus: pelaaja pienenee kauas (Y pieni), kasvaa lähelle ── */
    const PLAYER_DEPTH_MID    = 315;            // liikeradan keskikohta 280…350 = nykyinen koko (1.00)
    const PLAYER_DEPTH_MAX_Y  = WORLD_H - 50;   // sama kuin update()in PLAYER_Y_MAX (350)
    const PLAYER_DEPTH_AMOUNT = 0.10;           // ±10 % → 0.90 kauas / 1.10 lähelle
    function playerDepthScale() {
        const t = (player.y - PLAYER_DEPTH_MID) / (PLAYER_DEPTH_MAX_Y - PLAYER_DEPTH_MID);
        return 1 + Math.max(-1, Math.min(1, t)) * PLAYER_DEPTH_AMOUNT;
    }

    function drawPlayer() {
        const px = Math.round(player.x), py = Math.round(player.y);
        const pw = player.w, ph = player.h;
        // Syvyysskaalaus: koko riippuu Y-syvyydestä, ankkuri = jalkojen kosketuspiste
        const depthScale = playerDepthScale();
        const ax = px + pw / 2, ay = py + ph - 1;

        if (player.knockedDown) {
            ctx.save();
            const cx = px + pw/2, gy = py + ph;
            ctx.translate(cx, gy);
            ctx.scale(depthScale, depthScale);   // tainnutusasento skaalautuu jalkapisteestä
            if (player.facing === -1) ctx.scale(-1, 1);
            // Keho (lähellä päätä, ei 20px irti)
            ctx.fillStyle = '#3366cc'; ctx.fillRect(-8, -16, 16, 14);
            // Kädet sivuille (maassa)
            ctx.fillStyle = '#3355aa'; ctx.fillRect(-16, -12, 8, 4); ctx.fillRect(8, -12, 8, 4);
            // Pää
            ctx.fillStyle = '#ffcc99'; ctx.beginPath(); ctx.arc(0, -5, 6, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#553300'; ctx.beginPath(); ctx.arc(0, -8, 6, Math.PI, 0); ctx.fill();
            // Tähdet pään ympärillä
            const t = Date.now()*0.005;
            ctx.strokeStyle = '#ffdd44'; ctx.lineWidth = 1;
            for (let s=0;s<3;s++) { const ang=t+s*2.1; ctx.beginPath(); ctx.moveTo(Math.cos(ang)*14-2, -12+Math.sin(ang)*10-2); ctx.lineTo(Math.cos(ang)*14+2, -12+Math.sin(ang)*10+2); ctx.moveTo(Math.cos(ang)*14+2, -12+Math.sin(ang)*10-2); ctx.lineTo(Math.cos(ang)*14-2, -12+Math.sin(ang)*10+2); ctx.stroke(); }
            ctx.restore();
            return;
        }

        ctx.save();
        // Syvyysskaalaus jalan kosketuspisteestä (myös maakosketusvarjo skaalautuu)
        ctx.translate(ax, ay);
        ctx.scale(depthScale, depthScale);
        ctx.translate(-ax, -ay);
        // Maakosketusvarjo – ankkuroi hahmon maahan (symmetrinen, piirretään ennen peilausta)
        const feetX = px + pw / 2, feetY = py + ph - 1;
        const shadowW = player.walking ? 11 : 10;
        ctx.fillStyle = 'rgba(0,0,0,0.30)';
        ctx.beginPath(); ctx.ellipse(feetX, feetY, shadowW, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath(); ctx.ellipse(feetX, feetY, shadowW - 4, 1.8, 0, 0, Math.PI * 2); ctx.fill();
        if (player.facing === -1) {
            ctx.translate(px+pw/2, 0);
            ctx.scale(-1, 1);
            ctx.translate(-(px+pw/2), 0);
        }
        // Kävelyn kevennys + paikallaan hengitys (ylävartalo 1 px, ~2,4 s sykli)
        const breathe = (!player.walking && !player.kicking)
            ? (Math.floor(animClock / 36) % 4 >= 2 ? 1 : 0) : 0;
        const bobY = breathe + (player.walking ? (player.walkFrame % 2) * 1 : 0);
        // Potkun aikana ylävartalo nojaa: ennakossa taakse, osumassa eteen
        const kickKp = player.kicking ? (player.kickFrame / KICK_DURATION) : 0;
        const kickLean = player.kicking
            ? (kickKp < 0.2 ? -1 : Math.round(Math.sin(((kickKp - 0.2) / 0.8) * Math.PI)))
            : 0;
        ctx.save();
        ctx.translate(kickLean, 0);   // koko ylävartalo nojaa potkun tahdissa
        // Vartalo (paita) – kylkivarjostus tuo pyöreyttä
        ctx.fillStyle = '#3366cc';
        ctx.fillRect(px+4, py+10 + bobY, pw-8, ph-18);
        // Selän varjokaista (takaosa) + etureunan valokaista
        ctx.fillStyle = '#2b57ab';
        ctx.fillRect(px+4, py+10 + bobY, 2, ph-18);
        ctx.fillStyle = '#4a7de0';
        ctx.fillRect(px+pw-5, py+10 + bobY, 1, ph-18);
        // Leuan varjo + niskavarjo paidan yläosassa (kaulan illuusio)
        // Pään ympyrä peittää paidan yläreunan → varjo vasta pään alareunan tasolle
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(px+5, py+12 + bobY, pw-10, 2);
        // Vyötärön raja (erottaa paidan housuista)
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.fillRect(px+4, py+21 + bobY, pw-8, 1);
        // Kädet – lepoasennossa, seuraavat vain vartalon bobY:tä (ei heiluntaa)
        const backArmX  = px + 3,      backArmY  = py + 12 + bobY;
        const frontArmX = px + pw - 6, frontArmY = backArmY;
        ctx.fillStyle = '#3355aa';
        ctx.fillRect(backArmX, backArmY, 3, 8);
        ctx.fillRect(frontArmX, frontArmY, 3, 8);
        // Hihansuut + kädet (iho) hihan päissä
        ctx.fillStyle = '#254a9c';
        ctx.fillRect(backArmX, backArmY + 7, 3, 1);
        ctx.fillRect(frontArmX, frontArmY + 7, 3, 1);
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(backArmX, backArmY + 8, 3, 2);
        ctx.fillRect(frontArmX, frontArmY + 8, 3, 2);
        ctx.fillStyle = '#e8b487';
        ctx.fillRect(backArmX, backArmY + 9, 3, 1);
        ctx.fillRect(frontArmX, frontArmY + 9, 3, 1);
        // Pää
        ctx.fillStyle = '#ffcc99';
        ctx.beginPath(); ctx.arc(px+pw/2, py+6 + bobY, 7, 0, Math.PI*2); ctx.fill();
        // Hiukset (otsatukka)
        ctx.fillStyle = '#553300';
        ctx.beginPath(); ctx.arc(px+pw/2, py+3 + bobY, 7, Math.PI, 0); ctx.fill();
        // Kasvojen takaosan varjo + lipan varjo (syvyys)
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(px+4, py+6 + bobY, 2, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(px+5, py+5 + bobY, 11, 1);
        // Silmä (kulkusuunnan puoleinen) – vilkahtaa ~100 ms / 3,6 s (kello)
        const eyeY = py+7 + bobY + (player.lookY || 0);
        const blink = (Math.floor(animClock) % 216) >= 210;
        ctx.fillStyle = '#2b2118';
        if (blink) ctx.fillRect(px+13, eyeY + 1, 2, 1);
        else       ctx.fillRect(px+13, eyeY, 2, 2);
        // Lippis – lippa kulkusuuntaan
        ctx.fillStyle = '#3366cc';
        ctx.fillRect(px+pw/2 - 6, py, 14, 5);
        ctx.fillStyle = '#224488';
        ctx.fillRect(px+pw/2 + 2, py + 1, 7, 3);   // lippa sirompi (12→7)
        ctx.fillRect(px+pw/2 + 4, py + 4, 6, 1);
        // Dynaaminen valo: lähin palava lamppu antaa ohuen lämpimän reunavalon
        // (lasketaan lokaalikoordinaateissa → kääntyy peilauksen mukana)
        let rimA = 0, rimSide = 0;
        // blackoutissa yksikään lamppu ei valaise (K7 "Valot sammuvat")
        const rimLightsOut = StreetChaosCards.lightsOut;
        for (const lamp of lamps) {
            if (!lamp.lit || rimLightsOut) continue;
            const d = Math.abs(lamp.x - (px + pw / 2));
            if (d < 70) {
                const a = (1 - d / 70) * 0.35;
                if (a > rimA) { rimA = a; rimSide = (lamp.x > px + pw / 2) ? 1 : -1; }
            }
        }
        if (rimA > 0.04) {
            const localSide = rimSide * player.facing;
            const torsoX = localSide > 0 ? px + pw - 5 : px + 4;
            const headX  = localSide > 0 ? px + 16 : px + 4;
            ctx.fillStyle = 'rgba(255,221,136,' + rimA.toFixed(3) + ')';
            ctx.fillRect(torsoX, py + 10 + bobY, 1, ph - 19);
            ctx.fillRect(headX, py + 7 + bobY, 1, 3);
        }
        /* Sädease kädessä: harmaa kepakko 45° kulmassa etukädessä, osoittaa eteen-ylös.
           ase näkyy vain yöllä (dayNight.t <= 0). Päivällä se on piilossa, koska aseella ei
           voi muutenkaan ampua (beamCanFire() vaatii dayNight.t <= 0) eikä meteoriitteja synny.
           Tallennettu tila (beamWeaponCollected) EI muutu → kerran napattu ase ilmestyy
           itsestään takaisin käteen, kun yö ja meteoriitit palaavat. */
        if (beamWeaponCollected && dayNight.t <= 0) {
            ctx.save();
            ctx.translate(frontArmX + 1, frontArmY + 6);
            ctx.rotate(-Math.PI / 4);
            ctx.fillStyle = '#8a9098';          // harmaa runko
            ctx.fillRect(-2, -1.5, 15, 3);
            ctx.fillStyle = '#6b7179';          // varjokaista
            ctx.fillRect(-2, -0.5, 15, 1);
            ctx.fillStyle = '#b7c0c9';          // vaalea kärki (hohtava)
            ctx.fillRect(11, -1.5, 3, 3);
            ctx.restore();
        }
        ctx.restore();   // potkun nojaus päättyy
        // Jalat – housut (tumma laivastonsininen erottuu paidasta)
        ctx.fillStyle = '#16265c';
        if (player.kicking) {
            const kp = player.kickFrame / KICK_DURATION; // 0..1
            // Ennakointi: 20 % ajasta jalka vedetään taakse, sitten heilahdus 0→1→0
            const ANTICIP = 0.2;
            const swing = kp < ANTICIP
                ? -0.35 * (kp / ANTICIP)
                : Math.sin(((kp - ANTICIP) / (1 - ANTICIP)) * Math.PI);
            // Tukijalka
            ctx.fillRect(px + 3, py + ph - 8, 4, 8);
            // Potkiva jalka – pyörähtää eteen
            ctx.save();
            ctx.translate(px + pw - 10, py + ph - 6);
            ctx.rotate(-swing * 1.1);
            ctx.fillRect(0, -2, 4, 14);
            ctx.restore();
            // Kenkä potkivassa jalassa (+ valojuova)
            const shoeX = px + pw - 8 + swing * 20;
            const shoeY = py + ph - 6 - swing * 12;
            ctx.fillStyle = '#221008';
            ctx.fillRect(shoeX - 3, shoeY + 2, 8, 3);
            ctx.fillStyle = '#3a2a1c';
            ctx.fillRect(shoeX - 3, shoeY + 2, 8, 1);
        } else {
            // Kävelyanimaatio: jalat heiluvat walkFramen mukaan (0-3)
            const wf = player.walking ? player.walkFrame : 0;
            const legSwing = player.walking ? ((wf === 1 || wf === 3) ? 4 : 0) : 0;
            const leftOffset  = (wf === 1) ? -legSwing : (wf === 3) ? legSwing : 0;
            const rightOffset = (wf === 1) ? legSwing : (wf === 3) ? -legSwing : 0;
            // Vasen jalka
            ctx.fillRect(px + 5 + leftOffset, py + ph - 8, 4, 8 + Math.abs(leftOffset) * 0.5);
            // Oikea jalka
            ctx.fillRect(px + pw - 9 + rightOffset, py + ph - 8, 4, 8 + Math.abs(rightOffset) * 0.5);
            // Kengät (+ valojuova)
            ctx.fillStyle = '#221008';
            ctx.fillRect(px + 4 + leftOffset, py + ph - 2 + Math.abs(leftOffset) * 0.5, 6, 2);
            ctx.fillRect(px + pw - 10 + rightOffset, py + ph - 2 + Math.abs(rightOffset) * 0.5, 6, 2);
            ctx.fillStyle = '#3a2a1c';
            ctx.fillRect(px + 4 + leftOffset, py + ph - 2 + Math.abs(leftOffset) * 0.5, 6, 1);
            ctx.fillRect(px + pw - 10 + rightOffset, py + ph - 2 + Math.abs(rightOffset) * 0.5, 6, 1);
        }
        ctx.restore();
    }

    /* SKAALAUS */
    function resize() {
        const wrapper = document.getElementById('game-wrapper');
        if (!wrapper) return;

        const hud = document.getElementById('hud-bar');
        const hudH = hud ? hud.offsetHeight + 8 : 0;   // HUD + pieni väli
        const maxW = wrapper.clientWidth - 16;

        if (!isTouchDevice) {
            // PC: koko katu näkyvissä (ei kameraa, ei scrollausta)
            viewW = WORLD_W;
            camX = 0;
            const maxH = wrapper.clientHeight - hudH;
            const scale = Math.min(maxW / WORLD_W, maxH / WORLD_H);
            canvas.width = WORLD_W;
            canvas.height = WORLD_H;
            canvas.style.width = Math.floor(WORLD_W * scale) + 'px';
            canvas.style.height = Math.floor(WORLD_H * scale) + 'px';
            return;
        }

        // Mobiili: vaakakamera. Vaakamoodissa koko katu mahtuu (ei scrollausta);
        // pystymoodissa zoomataan täyttämään korkeus ja kamera seuraa pelaajaa.
        const isLandscape = window.innerWidth > window.innerHeight;
        // tablettihaarassa ohjaimet voivat olla 2× (110 px napit) →
        // varaus mitataan rivin todellisesta korkeudesta. Puhelimella rivi on
        // 3 × 55 + 2 × 4 = 173 px → 173 + 12 = 185 eli täsmälleen entinen
        // vakio, joten puhelin/vaakamoodi eivät muutu lainkaan.
        const rowEl = document.getElementById('touch-row');
        const rowH = rowEl ? rowEl.offsetHeight : 0;
        const CONTROL_RESERVE = isLandscape ? 0 : Math.max(185, rowH + 12);
        const availH = Math.max(200, wrapper.clientHeight - hudH - CONTROL_RESERVE);

        // Tavoite: täytä käytettävissä oleva korkeus (maksimaalinen vertikaalitila)
        const scaleH = availH / WORLD_H;
        viewW = Math.max(VIEWW_MIN, Math.min(WORLD_W, maxW / scaleH));
        // Varmista ettei canvas ylitä näytön leveyttä
        const scale = Math.min(scaleH, maxW / viewW);

        canvas.width = Math.round(viewW);
        canvas.height = WORLD_H;
        canvas.style.width = Math.floor(viewW * scale) + 'px';
        canvas.style.height = Math.floor(WORLD_H * scale) + 'px';
        // Clampaa kamera uuteen viewW:hen (älä näytä maailman ulkopuolelle)
        camX = Math.max(0, Math.min(WORLD_W - viewW, camX));
    }

    return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };
})();

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const menu = document.getElementById('chaos-menu');
    if (!canvas) return;
    const urlParams = new URLSearchParams(location.search);
    const chaosParam = urlParams.get('chaos');   // testikytkin: ?chaos=normal|mild|good|bad|full
    if (chaosParam) {
        Street.setChaos(chaosParam);             // ohittaa hubin (testikäyttö, ei tallenna)
        Street.init(canvas);
        return;
    }
    if (!menu) { Street.init(canvas); return; }   // ei hubia → käynnistä suoraan
    // F5-soft reset: jos kaaossession on tallessa, ohita hubi ja jatka samassa modessa.
    const savedChaos = Street.loadChaosSession();
    if (savedChaos) {
        menu.classList.add('hidden');
        Street.setChaos(savedChaos.level, savedChaos.cfg);
        Street.init(canvas);
        return;
    }
    /* ═══ Automaattinen hover-kierros (mobiili + nopeutus) ═══
       Kun pelaaja avaa näkymän ("CLICK / PRESS ANY KEY"), hover-efekti liukuu
       kerran kaikkien viiden kaaosnapin yli ylhäältä alas: 5 s NAPAUTUKSESTA
       (: kello käy jo gaten 2 s viiveen aikana, joten efekti ehtii näkyä
       heti kun valikko on auennut), sen jälkeen 10 s välein (kierroksen alusta
       alkuun) niin kauan kuin valikko on auki. Jos kierros jää väliin (valikko
       ei vielä näy / välilehti piilossa / ohjeikkuna), uusi yritys tehdään
       AUTO_HOVER_RETRY_MS (0,5 s) päästä – ei vasta 10 s päästä.
       Yksi nappi kerrallaan 173 ms
       (: 450 → 346 ms eli +30 %, sen jälkeen vielä puolet pois
       346 → 173 ms), ja viimeinen (FULL CHAOS)
       jää päälle 2 s – samalla koko näyttö tärisee. Pito ja tärinä ovat
       ennallaan: ne tulevat ikään kuin siitä, että valikko tippuu.
       Efekti on pelkkä luokka .auto-hover (style.css = täsmälleen sama ulkoasu
       kuin :hover), joten oikea hiiri ja täppäys toimivat koko ajan
       normaalisti – oikea osoitin myös keskeyttää käynnissä olevan liu'un.
       Esteettömyys: liikkeen vähentäminen (reduce-motion) ei
       enää sammuta koko kierrosta eikä näytön tärinää – nappi välähtää ja
       näyttö tärisee kaikilla laitteilla. Sama linjaus kuin INSTRUCTIONS-
       vilkunnassa, ja lisäksi pelin oma canvas-tärinä (BAD/FULL,
       meteoriitti, kolari: ctx.translate) on aina toiminut jokaisella
       laitteella → valikko oli ainoa reduce-motionilla lukittu efekti.
       Moni Android raportoi reduce-motionin ollessa poista animaatiot
       tilassa, joten tärinä katosi puhelimilta kokonaan; poisti
       portin myös style.css:stä. Muoto ennallaan: yksi kierros / 10 s,
       pito + tärinä 2 s (AUTO_HOVER_HOLD_MS), värinä 2–4 px.
       Peruutus: kosketuslaitteella nappialueen touchstart
       keskeyttää käynnissä olevan liu'un. PC:n mouseenter-peruutus POISTETTIIN
       ssä: selain laukaisee mouseenterin uudelleen, kun gate katoaa
       osoittimen alta tai hover-ketju päivittyy, ja se pyyhkäisi koko
       automaattikierroksen → seuraava tuli vasta 10 s päästä (pelaaja näki
       ensimmäisen efektin ~17 s kohdalla, kun hiiri lepäsi valikon päällä).
       Osoittimen alla oleva nappi ohitetaan värien osalta, mutta pito ja
       tärinä ajetaan aina.
       Testikytkin: ?autohover=0 (ei tallennu). */
    const AUTO_HOVER_ON        = urlParams.get('autohover') !== '0';
    const AUTO_HOVER_START_MS  = 5000;    // viive näkymän avaavasta napautuksesta ("CLICK / PRESS")
    const AUTO_HOVER_RETRY_MS  = 500;     // väliin jäänyt kierros yritetään pian uudelleen
    const AUTO_HOVER_REPEAT_MS = 10000;   // kierroksen alusta seuraavan alkuun = 10 s
    const AUTO_HOVER_STEP_MS   = 173;     // yksi nappi kerrallaan (4 × 173 ms ennen FULL CHAOSia)
    /* viimeinen nappi (FULL CHAOS) jää päälle ja koko näyttö tärisee
       saman ajan (style.css: @keyframes chaos-shake – kesto pidettävä samana). */
    const AUTO_HOVER_HOLD_MS   = 2000;    // FULL CHAOS -pidon + tärinän kesto
    const AUTO_HOVER_SHAKE_CLASS = 'shaking';
    const autoHoverShakeEl = menu;        // koko valikkonäyttö (kattaa koko ruudun)
    const autoHoverBtns = () => Array.prototype.slice.call(menu.querySelectorAll('.chaos-buttons button'));
    let autoHoverNext = null;     // seuraavan kierroksen ajastin (ketjutettu setTimeout:
                                  // tasan 10 s väli myös hitaalla laitteella)
    let autoHoverTimers = [];     // käynnissä olevan liu'un ajastimet


    function clearAutoHover() {
        autoHoverTimers.forEach((t) => clearTimeout(t));
        autoHoverTimers = [];
        autoHoverBtns().forEach((b) => b.classList.remove('auto-hover'));
        // tärinä katkeaa aina samalla (oikea hiiri, valinta, stopAutoHover)
        if (autoHoverShakeEl) autoHoverShakeEl.classList.remove(AUTO_HOVER_SHAKE_CLASS);
    }
    function stopAutoHover() {
        if (autoHoverNext) { clearTimeout(autoHoverNext); autoHoverNext = null; }
        clearAutoHover();
    }
    /* Palauttaa true, jos kierros ajettiin; false = jäi väliin → uusi yritys pian. */
    function autoHoverSweep() {
        if (!AUTO_HOVER_ON || started || document.hidden) return false;       // peli käynnistynyt / välilehti piilossa
        if (menu.classList.contains('hidden') || menu.classList.contains('faded')) return false;
        if (insOpen || insClosing) return false;                              // ohjeikkuna päällä
        /* reduce-motion ei enää estä kumpaakaan osaa – väri-
           välähdys ja näytön tärinä ajetaan kaikilla
           laitteilla, kuten pelin canvas-tärinä (BAD/FULL, meteoriitti,
           kolari: ctx.translate) on aina tehnyt. */
        clearAutoHover();
        const btns = autoHoverBtns();
        if (!btns.length) return true;        // ei nappeja → ei jäädä 0,5 s:n uusintasilmukkaan
        const under = document.querySelector('.chaos-buttons button:hover');  // oikea osoitin voittaa aina
        const last = btns.length - 1;
        btns.forEach((btn, i) => {
            const hovered = (btn === under);
            const hold = (i === last) ? AUTO_HOVER_HOLD_MS : 0;   // vain FULL CHAOS jää päälle
            /* osoittimen alla olevaa nappia ei väritetä (ulkoasu olisi
               :hoverin kanssa identtinen), mutta pito + tärinä ajetaan AINA –
               muuten valikon päällä lepäävä hiiri vei efektin kohokohdan. */
            if (!hovered) {
                autoHoverTimers.push(setTimeout(() => btn.classList.add('auto-hover'), i * AUTO_HOVER_STEP_MS));
                autoHoverTimers.push(setTimeout(() => btn.classList.remove('auto-hover'),
                                                i * AUTO_HOVER_STEP_MS + (hold || AUTO_HOVER_STEP_MS)));
            }
            if (hold && autoHoverShakeEl) {             // näytön tärinä pidon ajaksi (kaikilla laitteilla)
                autoHoverTimers.push(setTimeout(() => autoHoverShakeEl.classList.add(AUTO_HOVER_SHAKE_CLASS), i * AUTO_HOVER_STEP_MS));
                autoHoverTimers.push(setTimeout(() => autoHoverShakeEl.classList.remove(AUTO_HOVER_SHAKE_CLASS), i * AUTO_HOVER_STEP_MS + hold));
            }
        });
        return true;
    }
    /* Kierros ajastetaan aina edellisen kierroksen alusta (ketjutettu setTimeout):
       setInterval ehtisi vanheta hitaalla laitteella ja 1. väli menisi 9 sekuntiin.
       jos kierros jäi väliin (ran = false), uusi yritys tehdään pian –
       muuten yksi ohitettu kierros siirtäisi efektin koko 10 s:n päähän. */
    function scheduleAutoHover(delay) {
        autoHoverNext = setTimeout(() => {
            autoHoverNext = null;
            const ran = autoHoverSweep();
            if (AUTO_HOVER_ON && !started) scheduleAutoHover(ran ? AUTO_HOVER_REPEAT_MS : AUTO_HOVER_RETRY_MS);
        }, delay);
    }
    function startAutoHover() {
        /* reduce-motion ei enää estä kierrosta – efekti käynnistyy myös
           puhelimilla.: kutsutaan jo gaten napautuksessa (kello käy
           napautuksesta) ja varaksi uudelleen, kun valikko on auennut; jälkimmäinen
           kutsu on no-op, koska autoHoverNext on jo asetettu. */
        if (!AUTO_HOVER_ON || autoHoverNext) return;
        scheduleAutoHover(AUTO_HOVER_START_MS);
    }
    /* Kosketuslaite: täppäys nappialueelle keskeyttää käynnissä olevan liu'un
       (pelaajan oma täppäys voittaa aina).: PC:n mouseenter-peruutus
       POISTETTU – selain laukaisee mouseenterin uudelleen, kun gate katoaa
       osoittimen alta tai hover-ketju päivittyy, jolloin se pyyhkäisi käynnissä
       olevan automaattikierroksen (seuraava tuli vasta 10 s päästä ≈ 17 s).
       Osoittimen alla oleva nappi ohitetaan joka tapauksessa värien osalta. */
    const autoHoverZone = menu.querySelector('.chaos-buttons');
    if (autoHoverZone) autoHoverZone.addEventListener('touchstart', clearAutoHover, { passive: true });

    menu.classList.remove('hidden');
    // Aloitusgate: ensimmäinen ele avaa äänilukon ja näyttää chaos-valikon.
    const gate = document.getElementById('start-gate');
    const showMenu = () => {
        if (gate) gate.classList.add('hidden');
        menu.classList.remove('hidden');
        startAutoHover();   // hover-kierto käyntiin, kun valikko on auennut
    };
    if (gate) {
        // Click/Press-näytölle palattaessa sädease poistetaan inventorysta.
        Street.clearBeamWeapon();
        gate.classList.remove('hidden');
        StreetAudio.setMenuActive(true);   // valikko aktiiviseksi jo gatessa → onGesture avaa musiikin
        const GATE_MENU_DELAY_MS = 2000;   // 2 s viive → sama napautus ei osu chaos-valikon nappiin (mobiilin ghost-click)
        let unlocked = false;
        const unlock = () => {
            if (unlocked) return;
            unlocked = true;
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('mousedown', unlock);
            window.removeEventListener('touchstart', unlock);
            gate.classList.add('faded');   // tekstit haihtuvat pois 2 s viiveen aikana
            /* hover-kierroksen kello käy jo tästä napautuksesta, joten
               efekti ehtii näkyä heti kun valikko on auennut (5 s napautuksesta
               eikä 5 s valikon avautumisesta). showMenu()in oma
               startAutoHover() on tämän jälkeen no-op (autoHoverNext asetettu). */
            startAutoHover();
            setTimeout(showMenu, GATE_MENU_DELAY_MS);
        };
        window.addEventListener('keydown', unlock);
        window.addEventListener('mousedown', unlock);
        window.addEventListener('touchstart', unlock);
    } else {
        showMenu();
        StreetAudio.setMenuActive(true);   // fallback: ei gate-elementtiä
    }
    const CHAOS_INTRO_TRACK = 'jukebox/8_nickpanek-coffee-first-heavy-grunge-metal-instrumental-391308.mp3';
    /* Siirtymä: kaaostason valinnasta näyttö mustenee 2 s
       (CHAOS_BLACKOUT_MS) ja valikkobiisi vaimenee samaan aikaan; peli
       käynnistyy mustan alla, minkä jälkeen katu paljastuu 1 s häivytyksellä
       (CHAOS_REVEAL_MS) → koko siirtymä on 3 s. Nupit: alla.
       BAD CHAOS saa lisävarotuksen – mustaan ruutuun kirjoitetaan
       keltainen teksti merkki merkiltä (sama klik-ääni kuin ohjeikkunassa),
       minkä jälkeen musta häivytetään kuten muillakin tasoilla → BAD-siirtymä
       on n. 3,5 s pidempi (kirjoitus ~1,1 s + lukuaika;: hold
       0,8 → 2,3 s, jotta tekstin ehtii lukea). Intro soi sen aikana
       kuten ennenkin; muut tasot kulkevat täsmälleen entistä polkua. */
    const CHAOS_BLACKOUT_MS = 2000;   // mustuminen + valikkobiisin häivytys
    const CHAOS_REVEAL_MS = 1000;     // mustan häivytys pois → katu näkyy
    /* BAD CHAOS -varoitus: ajoitusnupit (vain BAD CHAOS). */
    const BAD_WARN_LEVEL   = 'bad';
    const BAD_WARN_TYPE_MS = 50;      // perusväli per merkki (ohjeissa 18 ms)
    const BAD_WARN_HOLD_MS = 2300;    // teksti valmis → lukuaika ennen häivytystä (0, 8 → 2, 3 s)
    const blackout = document.getElementById('chaos-blackout');
    const warnEl   = document.getElementById('chaos-warning');
    /* Varoitusteksti luetaan kerran HTML:stä (kuten ohjeet
       #instructions-source:sta) ja normalisoidaan, ettei sisennys päädy
       kirjoitukseen. Tyhjä/ puuttuva teksti → varoitusta ei näytetä. */
    const warnText = warnEl ? warnEl.textContent.replace(/\s+/g, ' ').trim() : '';
    let started = false;

    /* Kirjoittaa varoitustekstin merkki merkiltä mustaan ruutuun.
       Sama kuvio kuin typeInstructions(): tekstisolmu + vilkkuva kursori
       (.ins-caret) ja naksahdus joka INS_TYPE_CLICK_EVERY merkki.
       Teksti valmis → kursori pois → BAD_WARN_HOLD_MS → done(). */
    function typeChaosWarning(done) {
        if (!warnEl || !warnText) { if (done) done(); return; }
        warnEl.textContent = '';
        const node = document.createTextNode('');
        const caret = document.createElement('span');
        caret.className = 'ins-caret';
        caret.textContent = '\u25AE';
        warnEl.appendChild(node);
        warnEl.appendChild(caret);
        let i = 0, clicks = 0;
        const step = () => {
            if (i >= warnText.length) {                     // teksti valmis
                if (caret.parentNode) caret.parentNode.removeChild(caret);
                if (done) setTimeout(done, BAD_WARN_HOLD_MS);
                return;
            }
            const ch = warnText.charAt(i++);
            node.textContent += ch;
            if (++clicks % INS_TYPE_CLICK_EVERY === 0 && StreetAudio.playTypeClick) StreetAudio.playTypeClick();
            let pause = BAD_WARN_TYPE_MS;
            if (ch === '.' || ch === '!' || ch === '?') pause += INS_TYPE_SENTENCE_MS;
            setTimeout(step, pause);
        };
        step();
    }

    const start = (level) => {
        if (started) return;
        started = true;
        stopAutoHover();                    // hover-kierto pois (valikko himmenee)
        menu.classList.add('faded');        // tekstit haihtuvat pois ennen pelin alkua
        if (blackout) blackout.classList.add('on');   // näyttö mustenee
        const warn = level === BAD_WARN_LEVEL && !!warnText;   // vain BAD CHAOS
        // varoitusteksti tyhjennetään heti, ettei se ehdi näkyä mustan
        // 2 s häivytyksen aikana – se kirjoitetaan vasta kun ruutu on musta.
        if (warnEl) warnEl.textContent = '';
        // valikkobiisi vaimenee mustumisen aikana. Funktio on aina
        // samassa versiossa – varmistus, ettei vanha välimuistiin jäänyt
        // audio.js kaada koko käynnistystä.
        if (StreetAudio.fadeOutMenuMusic) StreetAudio.fadeOutMenuMusic(CHAOS_BLACKOUT_MS);
        setTimeout(() => {
            menu.classList.add('hidden');
            StreetAudio.setMenuActive(false);   // valikkobiisi pois, peli alkaa
            Street.setChaos(level);
            Street.saveChaosSession();
            Street.init(canvas);
            StreetAudio.playChaosIntro(CHAOS_INTRO_TRACK);   // kaaos-intro: yksi kappale kerran, sitten wave-musiikki
            // paljastus – musta häivytetään pois, sitten elementti pois tieltä.
            // BAD CHAOS odottaa varoituksen valmiiksi; intro soi sen
            // aikana kuten muillakin tasoilla, joten vain paljastus viivästyy.
            const reveal = () => {
                if (!blackout) return;
                blackout.classList.remove('on');
                blackout.classList.add('reveal');
                setTimeout(() => {
                    blackout.classList.remove('reveal');
                    blackout.classList.add('hidden');
                    if (warnEl) warnEl.textContent = '';   // ei jää jäänteitä seuraavaan näkymään
                }, CHAOS_REVEAL_MS);
            };
            if (warn) typeChaosWarning(reveal); else reveal();
        }, CHAOS_BLACKOUT_MS);
    };
    menu.querySelectorAll('[data-level]').forEach(btn => {
        btn.addEventListener('click', () => start(btn.getAttribute('data-level')));
        btn.addEventListener('touchend', (e) => {
            if (e.cancelable) e.preventDefault();
            start(btn.getAttribute('data-level'));
        }, { passive: false });
    });
    /* ═══ Ohjeikkuna ═══════════════════════════════════════════
       INSTRUCTIONS-valinta: avaus 1 s (CRT power-on) → ohjeteksti
       kirjoitetaan merkki merkiltä (kesto = tekstin pituus) → sulku 2 s
       (rivit alas + CRT power-off). Ikkuna EI mene itsestään kiinni:
       pelaaja sulkee sen täppäämällä näyttöä tai painamalla Esc.
       Äänet: StreetAudio.playPanelOn / playTypeClick / playPanelOff.
       Ajoitusnupit ovat alla; itse teksti luetaan #instructions-source:sta
       (index.html), joten sitä voi vapaasti lisätä/vähentää. */
    const insLink    = document.getElementById('instructions-link');
    const insOverlay = document.getElementById('instructions-overlay');
    const insPanel   = document.getElementById('instructions-panel');
    const insBody    = document.getElementById('instructions-body');
    const insSource  = document.getElementById('instructions-source');

    const INS_OPEN_MS          = 1000;   // ikkunan avautuminen (CRT power-on)
    const INS_CLOSE_MS         = 2000;   // sulku: rivikaskadi + CRT power-off
    const INS_TYPE_BASE_MS     = 18;     // perusväli per merkki
    const INS_TYPE_COMMA_MS    = 120;    // lisätauko pilkun/kaksoispisteen jälkeen
    const INS_TYPE_SENTENCE_MS = 260;    // lisätauko lauseen jälkeen
    const INS_TYPE_LINE_MS     = 320;    // tauko ennen seuraavaa riviä
    const INS_TYPE_CLICK_EVERY = 3;      // kirjoitusklik joka N:s merkki

    let insTimer      = null;    // kirjoituksen ajastin
    let insCloseTimer = null;    // sulun varajastin (estetyt animaatiot)
    let insOpen       = false;   // ikkuna auki
    let insClosing    = false;   // sulkuanimaatio käynnissä
    let insLines      = null;    // ohjeteksti talteen: [{ tag, text }]

    function insReducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* Ohjeteksti luetaan kerran #instructions-source:sta (h2 + p). */
    function readInstructions() {
        if (insLines || !insSource) return insLines;
        insLines = [];
        insSource.querySelectorAll('h2, p').forEach(el => {
            insLines.push({ tag: el.tagName.toLowerCase(), text: el.textContent.trim() });
        });
        return insLines;
    }

    /* Kirjoittaa ohjeet merkki merkiltä rivi kerrallaan. */
    function typeInstructions() {
        const lines = readInstructions();
        if (!lines || !lines.length || !insBody) return;
        let li = 0, ci = 0, clicks = 0, lineEl = null, node = null, caret = null;

        function finishTyping() {
            blinkFinalWords();                   // "HAVE FUN!" vilkahtaa kerran
            insBody.classList.add('ins-done');   // paljastaa "TAP SCREEN OR PRESS ESC TO CLOSE"
        }

        function step() {
            insTimer = null;
            if (insClosing) return;
            if (li >= lines.length) { finishTyping(); return; }

            if (!lineEl) {                       // aloita uusi rivi
                lineEl = document.createElement(lines[li].tag);
                lineEl.className = lines[li].text ? 'ins-line' : 'ins-line ins-gap';   // tyhjä rivi = riviväli
                node = document.createTextNode('');
                caret = document.createElement('span');
                caret.className = 'ins-caret';
                caret.textContent = '▮';
                lineEl.appendChild(node);
                lineEl.appendChild(caret);
                insBody.appendChild(lineEl);
                insTimer = setTimeout(step, INS_TYPE_LINE_MS);
                return;
            }

            const text = lines[li].text;
            const ch = text.charAt(ci++);
            node.textContent += ch;
            if (insPanel) insPanel.scrollTop = insPanel.scrollHeight;   // seuraa kirjoitusta
            if (ch && ++clicks % INS_TYPE_CLICK_EVERY === 0 && StreetAudio.playTypeClick) StreetAudio.playTypeClick();

            if (ci >= text.length) {              // rivi valmis → seuraava
                if (caret && caret.parentNode) caret.parentNode.removeChild(caret);
                li++; ci = 0; lineEl = null; node = null; caret = null;
                insTimer = setTimeout(step, INS_TYPE_LINE_MS);
                return;
            }
            let pause = INS_TYPE_BASE_MS;
            if (ch === ',' || ch === ';' || ch === ':') pause += INS_TYPE_COMMA_MS;
            else if (ch === '.' || ch === '!' || ch === '?') pause += INS_TYPE_SENTENCE_MS;
            insTimer = setTimeout(step, pause);
        }
        step();
    }

    /* Loppuhuuto: "HAVE FUN!" vilkahtaa kerran heti kun teksti on valmis.
       Sana erotetaan omaksi span-elementiksi, jotta vain se vilkkuu
       (opacity muuttuu, leveys ei → teksti ei siirry mihinkään). */
    function blinkFinalWords() {
        const last = insBody && insBody.lastElementChild;       // viimeinen rivi
        const node = last && last.firstChild;                   // sen tekstisolmu
        if (!node || !node.textContent) return;
        const m = /(HAVE\s+FUN!?)\s*$/i.exec(node.textContent);  // loppuhuuto rivin lopussa
        if (!m) return;
        const span = document.createElement('span');
        span.className = 'ins-fun ins-blink';                   // .ins-blink = 1 vilkahdus
        span.textContent = m[1];
        node.textContent = node.textContent.slice(0, m.index);
        last.appendChild(span);
    }

    function openInstructions() {
        if (!insOverlay || started || insOpen || insClosing) return;
        insOpen = true;
        if (insBody) { insBody.innerHTML = ''; insBody.classList.remove('ins-done'); }
        if (insPanel) insPanel.scrollTop = 0;
        insOverlay.classList.remove('hidden');
        if (StreetAudio.playPanelOn) StreetAudio.playPanelOn();
        window.addEventListener('keydown', onInsKey);
        // Teksti alkaa vasta kun ikkuna on avautunut
        insTimer = setTimeout(typeInstructions, insReducedMotion() ? 0 : INS_OPEN_MS);
    }

    function closeInstructions() {
        if (!insOverlay || !insOpen || insClosing) return;
        insClosing = true;
        if (insTimer) { clearTimeout(insTimer); insTimer = null; }
        window.removeEventListener('keydown', onInsKey);
        if (StreetAudio.playPanelOff) StreetAudio.playPanelOff();
        insOverlay.classList.add('ins-closing');
        insOverlay.addEventListener('animationend', onInsClosed);
        // Varakeino: estetyillä animaatioilla animationend ei laukea lainkaan
        insCloseTimer = setTimeout(onInsClosed, insReducedMotion() ? 0 : INS_CLOSE_MS);
    }

    /* Sulku valmis (taustaverhon oma animaatio tai varajastin) → piilota. */
    function onInsClosed(e) {
        if (e && e.target !== insOverlay) return;    // lapsianimaatiot ohitetaan
        if (insCloseTimer) { clearTimeout(insCloseTimer); insCloseTimer = null; }
        insOverlay.removeEventListener('animationend', onInsClosed);
        insOverlay.classList.remove('ins-closing');
        insOverlay.classList.add('hidden');
        insOpen = false;
        insClosing = false;
    }

    function onInsKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); closeInstructions(); }
    }

    /* Sama kuvio kuin kaaostasonapeissa: touchend hoitaa napautuksen heti ja
       estää synteettisen clickin (ei 300 ms viivettä eikä tuplalaukaisua).
       Avaus on varmistettu `insOpen`-lipulla, sulku `insClosing`-lipulla. */
    function bindInsTap(el, fn) {
        if (!el) return;
        el.addEventListener('click', fn);
        el.addEventListener('touchend', (e) => {
            if (e.cancelable) e.preventDefault();
            fn();
        }, { passive: false });
    }
    bindInsTap(insLink, openInstructions);
    bindInsTap(insOverlay, closeInstructions);

});
window.addEventListener('resize', () => { if (Street.resize) Street.resize(); });
