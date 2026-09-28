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
        knockFallY: undefined   // auton osuman putoamistaso (osumakohta −25 px, v11.12); muutoin GROUND_Y+10 (v4.78)
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
    const coin = { x: 590, y: 325, collected: false, sparkle: 0, despawnTimer: 0, despawnCooldown: 0 };
    // Kolikko ilmestyy sinne, missä pelaajan jalat voivat liikkua:
    //   x: 0..(WORLD_W - player.w), y: GROUND_Y..(WORLD_H - 50 + player.h)
    const COIN_X_MIN = 0;
    const COIN_X_MAX = WORLD_W - player.w;          // 780
    const COIN_Y_MIN = GROUND_Y;                    // 310 – jalat maan tasolla
    const COIN_Y_MAX = (WORLD_H - 50) + player.h;   // 380 – jalat alimmillaan (aidan takana)
    function randomCoinX() { return COIN_X_MIN + Math.random() * (COIN_X_MAX - COIN_X_MIN); }
    function randomCoinY() { return COIN_Y_MIN + Math.random() * (COIN_Y_MAX - COIN_Y_MIN); }
    let COIN_RESPAWN_FRAMES = 7200;   // 120 s @ 60 fps – säädettävissä kaaostasolla (v5.03)

    /* ── Sädease (v10.20) – poimittava kadulta, vain FULL CHAOS ── */
    let beamWeaponCollected = false;   // tallennettu tila (gameState.js)
    let beamPickup = null;             // { x, y } – esine kadulla (null = ei näkyvissä)
    /* v11.15 (bugikorjaus): poiminta onnistuu vain, jos pelaajan JALKAPISTE on alle
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
    let beamCooldownTimer = 0;         // laukaisun lukitus (v11.14) – tikittää update()ssa
    let beamStartX = 0, beamStartY = 0;  // säteen lähtöpiste (jäädytetään laukaisussa)
    let beamEndX = 0, beamEndY = 0;      // säteen kohdepiste (jäädytetään laukaisussa)
    const BEAM_HIT_TOLERANCE = 0;      // osuma vain jos säde osuu meteoriitin kehään (tarkka, v10.26)
    const BEAM_FIRE_FRAMES = 60;       // säteen näkyvyysaika (frameä) – ~1 s valoraita
    const BEAM_COOLDOWN_FRAMES = 60;   // v11.14: laukaisuväli 1,0 s – huti maksaa saman kuin osuma
    const METEOR_HITS_TO_KILL = 2;     // v11.14: meteoriitti kestää 2 osumaa (kuori halkeaa ensin)

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
    let   CAB_BLINK_MIN = 420, CAB_BLINK_MAX = 700;   // oma vilkunta ms / kaappi (kaaos K2, v10.05)
    let   CAB_REROLL_MIN = 900, CAB_REROLL_MAX = 2100;  // uusi arpa 15–35 s välein / kaappi (kaaos K2)
    const CAB_FORCE = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search).get('cabs') : null;
    const cabOn = () => CAB_FORCE === '1' ? true : (CAB_FORCE === '0' ? false : Math.random() < ELECTRIC_CABINET_ON);
    const cabRerollTimer = () => CAB_REROLL_MIN + Math.random() * (CAB_REROLL_MAX - CAB_REROLL_MIN);
    const electricCabinets = [
        { x: 200, w: 8, h: 14, y: GROUND_Y - 16,
          on: cabOn(), phase: Math.random() * Math.PI * 2,
          period: CAB_BLINK_MIN + Math.random() * (CAB_BLINK_MAX - CAB_BLINK_MIN),
          timer: cabRerollTimer() },   // talo 3 – vasen seinä
        { x: 560, w: 8, h: 14, y: GROUND_Y - 16,
          on: cabOn(), phase: Math.random() * Math.PI * 2,
          period: CAB_BLINK_MIN + Math.random() * (CAB_BLINK_MAX - CAB_BLINK_MIN),
          timer: cabRerollTimer() }    // talo 7 – vasen seinä
    ];

    /* ── Avain (Dig Gamesta) ───────────────────────── */
    let digKeyCollected = false;
    let boulderKeyCollected = false;
    let bmKeyCollected = false;
    // Sama ehto kuin palkintohuoneessa (handleAction) ja HUD:issa – yksi lähde.
    function allKeysCollected() {
        return digKeyCollected && boulderKeyCollected && bmKeyCollected;
    }
    /* ── Makuuhuone (ex-palkintohuone, talo 7) ────────
       Ovi on aina auki (v4.43, sama käytös kuin BAR:lla): ei avaimia
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
    /* ── Nälkä on jäissä vain nukkuessa (v4.41, käyttäjän linjaus) ──
       Makuuhuone ja nukkumisen Zzz-pimennys pysäyttävät nälkäajastimen,
       joten pelaaja ei voi kuolla nukkuessaan. Kaikkialla muualla (katu,
       BAR, jukebox, iframe-pelit) kulutus jatkuu kuten kadulla (v4.49) –
       pelaaja huolehtii itse, ettei pelaa tai käy "ostoksilla" nälissään. */
    function hungerOnHold() { return sleepRoom || sleepPhase > 0; }
    /* Tila, jossa kuolema ei näkyisi: huone peittää kadun tai alapeli on
       auki. Sinne ei jätetä pelaajaa kuolemaan – huone/alapeli suljetaan
       ensin (leaveHiddenStateForDeath), jotta kuolinsekvenssi näkyy kadulla.
       Myös sanomalehden lukutila (v4.53) peittää kadun. */
    function insideHiddenState() { return iframeOpen || barRoom || jukeboxRoom || newsRoom; }
    let isDay = false;             // tallennettu päivä/yö-tila (state.isDay)
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
       ovi aina auki, ei lukkoa eikä kolikoita (v4.43) */
    const SLEEP_BLDG_IDX = 7;
    /* Laivanupotus (talo 2, buildings[2]) – ei omaa lamppua,
       1. potku sytyttää ikkunat, 2. potku avaa oven. Aina auki yöllä ja päivällä. */
    const SINKSHIP_BLDG_IDX = 2;
    /* Tiedostonimet vastaavat sisältöä (korjattu 20.9.2026, v4.27): aiemmin
       `our_song.mp3` ja `unafraid.mp3` olivat ristissä keskenään → raita 1 ja 2
       soivat valitun nimen vastaisesti. Älä "korjaa" nimiä takaisin ristiin.
       Rivit 4–6 lisätty 22.9.2026 (v4.60): D:\AI\free_music -kansion kolme
       ilmaista heavy metal -raitaa entisten jatkoksi (1 → 6). v4.97: raidat 7–9
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
    /* Monivalinta (v4.46): kappaleita voi valita useamman ja valitut soitetaan
       poistuttaessa yksi kerrallaan (1 → N). Hinta ennallaan: 1 🪙 / kappale. */
    let jukePick = JUKEBOX_TRACKS.map(() => false);  // valitut kappaleet (true = listalla)
    let jukeSpaceHeld = false;     // Space/⚡/(o) reunanilmaisu (ota/poista)
    let jukeEnterHeld = false;     // Enter-reunanilmaisu (soita & poistu)
    let jukeQueue = [];            // soivat kappaleet numeroina (1..N), sama kuin audio-jono
    let jukeSavedPos = -1;         // viimeksi tallennettu jukebox-positio (v4.92)

    /* ── Sanomalehti (v4.53) ──────────────────────────
       Kadulla lojuva lehti avataan toimintonapilla → peliohjeet.
       Lukutila on kuin canvas-huone: maailma jäätyy, nälkä kuluu
       (v4.49/v4.50) ja ✕-nappi sulkee (closeRoom). Sivuja selataan
       ▲/▼, Space (⚡) vie seuraavalle sivulle ja poistuu viimeiseltä,
       (o)/Enter poistuu heti. Ei tallennettavaa tilaa. */
    let newsRoom = false;
    let newsScreen = 0;            // näkyvä "näyttö" (pitkä sivu voi olla usealla)
    let newsHeldUp = false;        // ▲ reunanilmaisu
    let newsHeldDown = false;      // ▼ reunanilmaisu
    let newsSpaceHeld = false;     // Space/⚡ reunanilmaisu (seuraava sivu)
    let newsExitHeld = false;      // (o)/Enter reunanilmaisu (poistu heti)

    let coinCount = 0;
    let coinRespawnTimer = 0;
    let hamburgerCount = 5;
    let hamburgerTimer = 2400;  // 40s @ ~60fps – lukittu tahti (sääntö 04)
    let burgerInterval = 2400;  // 🍔-kulutustahti kaaosakselina (K4, v10.04); NORMAL 2400
    /* Herätysrauha (v4.41): nukkumisen jälkeen nälkäajastimelle jää vähintään
       tämä aika, ettei 1 🍔:lla nukkunut voi kuolla heti sängystä noustuaan.
       Ajastin ei nollaudu täyteen → ei ilmaista 40 s:ää eikä sängyssä
       käymisen hyväksikäyttöä. */
    let   HUNGER_WAKE_GRACE = 600;  // 10 s @ ~60fps (kaaos K4, v10.04)
    /* HUD:n 🍔-varoitus (v4.39): vilkkuva punainen, kun tämä määrä tai
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

    /* ── Salainen kolikkopalkkio (TESTITYÖKALU, v4.23) ────────
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
    let coinCheatStreak = 0;            // peräkkäiset potkut vitoslamppuun
    let coinCheatGapTimer = 0;          // montako frameä putki vielä pysyy voimassa
    let coinCheatCooldown = 0;          // cooldownin jäljellä olevat framet

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

    /* ── Rosvo (v4.66) – partioi jalkakäytävällä ──
       Pysyvä hahmo: kävelee edestakaisin talojen puoleisella jalkakäytäväkaistalla.
       Kiinniotto = tainnutus + 1 hampurilainen (kuten avenger), mutta väistettävissä:
       loiki kadun toiselle puolelle (↓) pois kaistalta → rosvo ei seuraa sinne. */
    const ROBBER_W       = 20;
    const ROBBER_H       = 30;
    let   ROBBER_SPEED   = 1.05;      // peruskävelynopeus – arvotaan spawnissa; kaaos (v5.03)
    const ROBBER_SPEED_MIN_MULT = 0.80;   // alaraja −20 % → 0,84
    const ROBBER_SPEED_MAX_MULT = 1.50;   // yläraja +50 % → 1,575
    const ROBBER_HIT_R   = 16;        // kiinnioton säde (px)
    const ROBBER_TURN    = 40;        // ~0,7 s reunapysähdys käännöksessä (väistöikkuna)
    // Jalkakäytäväkaista (talojen puoli): jalat GROUND_Y … GROUND_Y+16
    const ROBBER_LANE_TOP    = GROUND_Y;          // 310
    const ROBBER_LANE_BOTTOM = GROUND_Y + 16;     // 326
    const ROBBER_FOOT_Y      = GROUND_Y + 4;      // rosvon jalkojen lepokorkeus
    // Yllätysesiintyminen: rosvo ilmestyy vain paluussa pelistä/jukeboxista/BARista
    let   ROBBER_APPEAR_CHANCE = 0.4;   // 1/2.5 että rosvo ilmestyy paluussa; kaaos (v5.03)
    let   ROBBER_COOLDOWN      = 1500;  // ~25 s tauko rosvon esiintymisten välillä; kaaos (v5.03)
    const ROBBER_MIN_DIST      = 130;   // min. etäisyys pelaajasta, kun rosvo ilmestyy
    let   ROBBER_TTL           = 900;   // ~15 s elinikä – katoaa jos ei nappaa kiinni; kaaos (v5.03)
    const ROBBER_BAR_EXCLUDE_R = 100;   // ei koskaan aivan BAR-oven kohdalle – pelaaja käy
                                        // BAR:ssa usein; muissa ovissa huono tuuri sallitaan
    let   ROBBER_STUN          = 900;   // ~15 s tainnutus kiinniotosta – pidempi kuin muiden
                                        // osumien 600, jotta pelaaja ehtii nähdä, mitä kävi; kaaos K4
    let   ROBBER_CHASES_Y      = false; // v10.12: rosvo jahtaa vapaasti y-akselilla (vain BAD CHAOS)
    let robber = null;        // { x, y, w, h, facing, dir, speed, pause, walkTimer, ttl }
    let robberCooldown = 0;   // tauko ennen kuin uusi rosvo voi ilmestyä
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
    let meteorShakeTimer = 0;         // meteoriitin törmäyksen tärinä (v10.15, frameä, vain visuaalinen)
    let meteorFlash = null;           // meteoriitin taivasvälähdys { t } (v10.16)
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

    /* ── Päivä/yö (v4.33) ──
       Kun pelaaja on läpäissyt kaikki kolme peliä, kadulle nousee päivä kerran
       (kuu vaihtuu auringoksi, valoisuus päivätasolle). Sen jälkeen tilan voi
       vaihtaa talon 7 makuuhuoneessa (Nuku: päivä ⇄ yö) ja valinta tallennetaan
       (state.isDay). Yksi liukuva arvo dayT (0 = yö … 1 = päivä) ohjaa kaikki
       muutokset, joten yö-tila piirtyy täsmälleen kuten ennen (kaikki lisäykset
       ovat ehtoja dayT > 0). VISUAALINEN VAIN: hitboxit, törmäykset, kamera,
       avaimet ja talous eivät muutu mihinkään. Poikkeus: Jukebox ja
       Hedelmäpeli ovat auki vain öisin (v4.34, ks. CLOSED_SIGN). */
    let dayT = 0;                          // 0 = yö … 1 = päivä (liukuva)
    let   DAY_FADE_FRAMES   = 1200;        // ~20 s auringonnousu (yö → päivä; kaaos K2, v10.05)
    let   NIGHT_FADE_FRAMES = 1200;        // ~20 s auringonlasku (päivä → yö; kaaos K2)
    let DAY_SKY_TOP     = '#3f7fc0';     // päivätaivaan yläosa (kaaos K1, v10.03)
    let DAY_SKY_MID     = '#78b4e0';     // keskikohta
    let DAY_SKY_HORIZON = '#ffd9a0';     // lämmin horisontti
    /* YÖ/PÄIVÄ -KIERTO (v4.89): kuu ja aurinko vaeltavat taivaan yli ja
       vuorokausi vaihtuu automaattisesti. Kun kuu laskee → 15 s → päivä,
       aurinko laskee → 15 s → yö. Nukkuminen ja lampun potku toimivat
       edelleen erillisinä tapoina vaihtaa vuorokaudenaikaa. */
    /* KUUN RATA (v4.65): kuu alkaa aina vasemmasta laidasta (MOON_X_MIN) ja
       liukuu yön kuluessa oikealle, kunnes laskeutuu kokonaan pois näkyvistä
       (MOON_SET_X, oikean reunan yli). Laskeutuessaan se pimentää maisemaa
       hiukan (MOON_SET_DARK_ALPHA).
       Kuun paikka TALLENNETAAN (v4.74, state.moonClock): F5/reload ei enää
       palauta kuuta lähtöasemaan, vaan se jatkaa siitä mihin jäi. Kuu alkaa
       alusta vain kun uusi yö alkaa (Nuku) tai kun koko tallennus nollataan
       (kuolema / ✕ "aloita alusta" → GameState.reset / removeItem). */
    const SUN_Y = 62, SUN_R = 26;       // auringon korkeus ja koko
    const SUN_X = -SUN_R * 3;              // auringon alku = ulos vasemmalta (v4.89), laskeutuu oikealle
    const MOON_Y = 60, MOON_R = 30;               // kuun korkeus ja koko
    let   DAY_CYCLE_FRAMES = 10800;               // ~3 min: yhden yön TAI päivän kesto; kaaos (v5.03)
    const MOON_X_MIN = -MOON_R * 3;               // kuun alku = ulos vasemmalta (v4.89), laskeutuu oikealle
    const MOON_SET_X = WORLD_W + MOON_R * 3;      // laskeuma ≈ 890 → kokonaan pois
    let   MOON_NIGHT_FRAMES = DAY_CYCLE_FRAMES;   // kuun liukuaika (sama kuin sykli)
    const MOON_SET_START = 0.60;                  // tästä p:stä alkaen kuu häipyy → maisema pimenee
    const MOON_SET_DARK_ALPHA = 0.15;             // "hiukan": max pimeneminen (0 = ei)
    const MOON_SAVE_FRAMES = 120;                 // tallenna kuun paikka ~2 s välein (v4.74)
    /* Auringon liuku päivällä (v4.89): sama mekaniikka kuin kuulla yöllä.
       Aurinko alkaa vasemmalta (SUN_X) ja liukuu oikealle DAY_CYCLE_FRAMES
       aikana, kunnes laskeutuu pois (SUN_SET_X). Paikka tallennetaan. */
    const SUN_SET_X = WORLD_W + SUN_R * 3;        // laskeuma ≈ 878 → kokonaan pois
    let   SUN_DAY_FRAMES = DAY_CYCLE_FRAMES;      // auringon liukuaika (sama kuin sykli)
    const SUN_SAVE_FRAMES = 120;                  // tallenna auringon paikka ~2 s välein
    let   CYCLE_CHANGE_DELAY_FRAMES = 900;        // 15 s viive ennen automaattista vaihtoa (kaaos K2, v10.05)
    /* ── Kuun ulkoasu (v4.72) ──
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
/* ── Talojen kuusta tulevat varjot (v4.80) ──
       Kuu on talojen TAKANA → talot varjostavat koko kadun. Varjon kauempi
       reuna siirtyy kuusta poispäin (moonX), joten suunta kääntyy kuun
       liikkuessa. Puhtaasti visuaalista – ei koske taloutta, hitboxeja eikä
       mekaniikkoja (sääntö 04). */
    const MOON_BLD_SHADOW_LEN   = 0.36;   // varjon pituus (× talon korkeus)
    const MOON_BLD_SHADOW_SKEW  = 0.055;  // vaakasiirtymä (× (talonX − moonX) × korkeus/100)
    const MOON_BLD_SHADOW_ALPHA = 0.50;   // tummuus talon juuressa (0 = pois)
    let moonX = MOON_X_MIN;                       // kuun nykyinen x (ks. update)
    let moonNightClock = 0;                       // yön kulku (framet) kuun rataa varten
    let moonDark = 0;                             // kuun laskusta johtuva pimeneminen
    let moonSaveTimer = 0;                        // tallennusvälin laskuri (v4.74)
    let sunX = SUN_X;                             // auringon nykyinen x (päivällä liukuu, v4.89)
    let sunDayClock = 0;                          // päivän kulku (framet) auringon rataa varten
    let sunSaveTimer = 0;                         // tallennusvälin laskuri (v4.89)
    let cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES + 1;  // > DELAY = "ei käynnissä" (v4.89)
/* Kuun kuva (v4.79): assets/moon.png (alpha-PNG) – korvaa proseduraalisen
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
    let   MOSQUITO_DAY_DIM = 1;            // 1 = moskiitot häviävät päivällä (yöllä ennallaan); kaaos K2 (v10.05)
    /* ── Pilvien päivätummuus (v4.40) ──
       Muoto ja määrä ovat yön ennallaan (initClouds) – vain väri tummenee ja
       peittävyys kasvaa dayT:n mukana, jotta pilvet erottuvat päivätaivaalta.
       dayT = 0 → väri ja alpha ovat täsmälleen yön ennallaan. */
    const CLOUD_NIGHT_CIRRUS = [190, 200, 225];  // yön ohuet juovat
    const CLOUD_NIGHT_HAZY   = [180, 195, 215];  // yön hunnut
    const CLOUD_DAY_CIRRUS   = [96, 104, 124];   // päivä: tummanharmaa juova
    const CLOUD_DAY_HAZY     = [62, 68, 84];     // päivä: selvästi tummempi huntu
    let CLOUD_DAY_ALPHA    = 5;                // peittävyyskerroin päivällä (1 = ei muutosta) – kaaos K1 (v10.03)
    const VEHICLE_HEADLIGHT_DIM = 1;       // ajovalot: 1 = kokonaan pois päivällä, 0 = ei muutosta
    /* Testityökalut (eivät tallenna mitään): ?day=1 = päivä heti,
       ?day=0 = pakota yö. Pakotettu tila ohittaa tallennetun tilan eikä
       käynnistä ensiauringonnousua → kumpaankin suuntaan voi testata. */
    const DAY_PARAM = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search).get('day') : null;
    const DAY_FORCE = (DAY_PARAM === '1') ? 'day' : (DAY_PARAM === '0' ? 'night' : null);
    const DAY_DEBUG = DAY_FORCE !== null;   // pakotettu → liuku heti perille

    /* ── Yölepakot (v4.93) ──────────────────────── */
    let BAT_COUNT_MAX   = 5;               // 0–5 lepakkoa, random – kaaos K1 (v10.03)
    const BAT_Y_MIN       = 45;              // ylin: kuun korkeudella (MOON_Y=60, R=30 → alareuna 90)
    const BAT_Y_MAX       = 245;             // minimi: lampun kupujen yläpuolella (bulbY = 257)
    const BAT_SPEED_MIN   = 0.25;            // hitain vauhti
    const BAT_SPEED_MAX   = 0.7;             // nopein vauhti
    const BAT_WING_MIN    = 2;               // pienin siipiväli (≈ moskiitto)
    const BAT_WING_MAX    = 9;               // isoin siipiväli (puolitettu)
    const BAT_LIFE_MIN    = 900;             // minimi elinikä (15 s @60fps)
    const BAT_LIFE_MAX    = 3600;            // maksimi elinikä
    const BAT_COLORS      = ['#000000', '#080808', '#0a0a0a', '#050510', '#000005'];

    /* ── Päivälinnut (v5.00) ─────────────────────── */
    let   BIRD_COUNT_MIN  = 10;   // kaaos (v5.03)
    let   BIRD_COUNT_MAX  = 15;   // kaaos (v5.03)
    const BIRD_WING_MIN   = 2;
    const BIRD_WING_MAX   = 5;
    const BIRD_SPEED_MIN  = 0.2;
    const BIRD_SPEED_MAX  = 0.6;
    const BIRD_LIFE_MIN   = 1800;
    const BIRD_LIFE_MAX   = 4800;
    const BIRD_COLORS     = ['#000000', '#080808'];

    /* Päivä sammuttaa katuvalot kerran (v4.38): kun aurinko on noussut
       täyteen (dayT === 1), kaikki lamput sammutetaan kertaalleen. Ne voi
       silti potkaista uudelleen päälle myös päivällä. Lippu nollautuu vasta
       kun yö on palannut → seuraava auringonnousu sammuttaa taas kerran. */
    let dayLampsOff = false;

    /* ── Yö sytyttää katuvalot yksi kerrallaan (v4.42) ──
       Päivän peilikuva: kun aurinko on laskenut täyteen (dayT === 0) ja
       pelaaja on jo edennyt (päivä/yö ratkaistu = state.isDay === false,
       ts. 3 avainta + makuuhuoneen Nuku yöhön), katuvalot syttyvät itsestään
       yksi kerrallaan vasemmalta oikealle – pieni "wow" auringonlaskun päälle.
       Uudessa pelissä (state.isDay === null) valot pitää yhä potkia itse.
       HUOM: kickCount ei kasva → avain-cheat (5 potkua), kolikkopalkkio
       (20 potkua) ja ylikuumeneminen (5 potkua) pysyvät täysin ennallaan.
       Testityökalu ?day=0 näyttää efektin heti. */
    let   NIGHT_LAMP_FIRST    = 30;      // ~0,5 s ennen ensimmäistä lamppua (kaaos K2, v10.05)
    let   NIGHT_LAMP_INTERVAL = 18;      // ~0,3 s lamppujen välissä (5 lamppua ≈ 1,7 s; kaaos K2)
    const NIGHT_LAMP_ORDER    = 'wave';  // 'wave' = x-järjestys · 'near' = lähin ensin
    let nightShowArmed = (DAY_FORCE === 'night');  // laukeaa vain aidosta päivä→yö-siirtymästä
    let nightShowQueue = [];             // syttymättömien lamppujen indeksit
    let nightShowTimer = 0;              // frameä seuraavaan lamppuun
    let   SPAWN_LAMP_DELAY = 240;        // 4 s viive ennen lamppushowta spawnissa (kaaos K2, v10.05)
    let spawnLampTimer = 0;              // laskuri spawn-lamppushow'lle

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
        nightShowQueue = idx;
        nightShowTimer = NIGHT_LAMP_FIRST;
    }

    /* ── Aukiolo (v4.34): Jukebox ja Hedelmäpeli auki vain öisin ──
       Päivällä ovesta tulee sama teksti-popup kuin lukitusta ovesta.
       Talousarvot eivät muutu – vain aukioloaika. Nuppi: CLOSED_AT_DAYT
       (sama raja kuin makuuhuoneen tilanvaihdossa: dayT >= 0.5 = päivä). */
    const CLOSED_SIGN    = 'Open\n8pm-6am';
    const CLOSED_AT_DAYT = 0.5;   // tämän yli = päivä = ovet kiinni
    function nightOnlyClosed() { return dayT >= CLOSED_AT_DAYT; }

    /* ── Ovet auki ilman lampun potkaisua päivällä (v4.38) ──
       Päivällä (dayT >= CLOSED_AT_DAYT) ovi aukeaa ilman että katuvalo
       pitää potkaista päälle – valoisalla kadulla lamppu ei ole portti.
       Avainportit (Dig Däsh vaatii digKey, Blue Mäx vaatii boulderKey)
       pysyvät ennallaan, samoin koko yökäytös. Makuuhuone (talo 7) on
       aina auki eikä tarvitse lamppua (v4.43).
       Nuppi DOOR_NO_LAMP_AT_DAY: false = vanha käytös (lamppu ensin aina). */
    const DOOR_NO_LAMP_AT_DAY = true;
    function lampFreeOpen() { return DOOR_NO_LAMP_AT_DAY && dayT >= CLOSED_AT_DAYT; }

    /* Päivän tavoite liu'ulle: 1 = päivä, 0 = yö. Tallennettu tila
       (isDay) ratkaisee, paitsi pakotettuna ?day=0/1. */
    function dayTarget() {
        if (DAY_FORCE === 'day') return 1;
        if (DAY_FORCE === 'night') return 0;
        return isDay ? 1 : 0;
    }

    /* ── Kuun kello (v4.74) ──
       Yksi lähde kuun paikalle: kellosta (framet) lasketaan x ja pimeneminen.
       Samaa funktiota käyttävät init (tallennettu kello), resetMoon (0) ja
       update (kello + dt), joten kaava ei voi livahtaa eri versioiksi.
       moonX säilyy murto-osaisena (EI Math.round) → kuu liukuu pehmeästi
       kuten pilvet, eikä hyppää pikselistä toiseen, vaikka vauhti on hidas. */
    function applyMoonClock(clock) {
        moonNightClock = clock;
        const p = Math.min(1, moonNightClock / MOON_NIGHT_FRAMES);
        moonX = (skyDir >= 0)
            ? MOON_X_MIN + p * (MOON_SET_X - MOON_X_MIN)
            : MOON_SET_X - p * (MOON_SET_X - MOON_X_MIN);   // float → nykimätön liuku (kaaos: suunta)
        moonDark = Math.min(1, Math.max(0, (p - MOON_SET_START) / (1 - MOON_SET_START)))
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
        state.moonClock = Math.round(moonNightClock);
        GameState.save(state);
    }

    /* ── Kuun nollaus (v4.65 / v4.74) ──
       Kuu alkaa vasemmasta laidasta (MOON_X_MIN) ja pimeneminen nollataan.
       Kutsutaan jokaisessa uudessa yössä (makuuhuoneen Nuku) → nollatila
       tallennetaan heti, ettei reload palauta edellisen yön paikkaa. */
    function resetMoon() {
        applyMoonClock(0);
        moonSaveTimer = 0;
        saveMoonClock();
    }

    /* ── Auringon kello (v4.89) ──
       Sama lähdeperiaate kuin kuulla: kellosta (framet) lasketaan x.
       Samaa funktiota käyttävät init (tallennettu kello), resetSun (0) ja
       update (kello + dt). sunX säilyy murto-osaisena (EI Math.round). */
    function applySunClock(clock) {
        sunDayClock = clock;
        const p = Math.min(1, sunDayClock / SUN_DAY_FRAMES);
        sunX = (skyDir >= 0)
            ? SUN_X + p * (SUN_SET_X - SUN_X)
            : SUN_SET_X - p * (SUN_SET_X - SUN_X);       // float → nykimätön liuku (kaaos: suunta)
    }

    function saveSunClock() {
        if (DAY_FORCE) return;
        state.sunClock = Math.round(sunDayClock);
        GameState.save(state);
    }

    function resetSun() {
        applySunClock(0);
        sunSaveTimer = 0;
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
    const TRAFFIC_DAY_MULT = 2;       // päivällä liikennevirta tuplataan (v4.37, spawn-väli /2)

    /* ── Viemärinkannet: avoin kaivo (v4.51/v4.52, käyttäjän pyyntö 21.9.2026) ──
       Kadulla on 2 viemärinkantta (foreground.manholes). Jos kansi puuttuu,
       kohta on musta reikä: siihen astuva pelaaja putoaa alas (katoaa) ja
       köpii takaisin ylös.
       MENETYS (v4.52): putoaminen vie **enintään 2 🪙** (kolikot hulahtavat
       viemäriin): 3 → 1, 2 → 0, 1 → 0 (ainutkin kolikko menee), 0 → ei mitään.
       TULO (v4.69, käyttäjän pyyntö 23.9.2026): randomina **1/6 putoamisista
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
    const MH_COIN_COST = 2;                // putoaminen vie enintään 2 kolikkoa (v4.52)
    const MH_BONUS_CHANCE = 1 / 6;         // 1/6 putoamisista: kaivosta löytyy rahaa (v4.69, parametri)
    const MH_BONUS_COINS  = 3;             // löydön suuruus: +3 🪙 (v4.69)
    const MH_HIT_RX = 11;                  // törmäysellipsi: piirros on 14×7,
    const MH_HIT_RY = 5;                   //   hitusen pienempi → ovelle mahtuu
    const MH_FALL_FRAMES  = 36;            // ~0,6 s: vajoaa reikään (katoaa) – nopea
    const MH_CLIMB_FRAMES = 210;           // ~3,5 s: köpii hitaasti takaisin ylös
    const MH_RISE_PART    = 0.65;          // osuus kiipeämisestä, jolloin hahmo nousee esiin
    const MH_STEP_PX      = 9;             // loppuosa: astuu reiän reunan yli kuivalle
    const MH_CLIMB_WOBBLE = 1.6;           // köpimisen sivuttaisheilunta (px, vain visuaalinen)
    let manholeOpen = null;                // null = kannet paikallaan · 0/1 = kumpi puuttuu
    let mhInside = [false, false];         // oliko jalkapiste reiän ellipsissä (reunaehto)
    let mhAction = null;                   // { idx, phase: 'fall' | 'climb', t } pudotuksen aikana
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
        if (MH_FORCE !== undefined) { manholeOpen = MH_FORCE; mhInside = [false, false]; return; }
        manholeOpen = (Math.random() < MANHOLE_START_CHANCE)
            ? (Math.random() < 0.5 ? 0 : 1)
            : null;
        mhInside = [manholeHit(0), manholeHit(1)];
    }

    /* Paluu kadulle: 1/10 → tilanne vaihtuu (kansi katoaa TAI palaa paikalleen). */
    function maybeRerollManholeState() {
        if (MH_FORCE !== undefined || playerDead || mhAction) return;
        if (Math.random() >= MANHOLE_RETURN_CHANCE) return;
        manholeOpen = (manholeOpen == null)
            ? (Math.random() < 0.5 ? 0 : 1)
            : null;
        /* Jos jalat ovat juuri uuden reiän kohdalla, putoaminen ei laukea
           heti: jalkapisteen pitää käydä välillä ellipsin ulkopuolella. */
        mhInside = [manholeHit(0), manholeHit(1)];
    }

    /* Paluu kadulle -vahti: kun huone tai alapeli sulkeutuu, arvotaan 1/10
       viemärinkannelle ja (v4.66) mahdollisesti ilmestyy rosvo yllätyksenä.
       Kattaa kaikki poistumistiet: ✕, Poistu, Space, Enter, RETURN_TO_STREET. */
    let wasHiddenKind = null;   // 'iframe' | 'sleep' | 'bar' | 'jukebox' | null
    function trackHiddenStreet() {
        const nowHidden = iframeOpen || sleepRoom || barRoom || jukeboxRoom;
        const nowKind = iframeOpen ? 'iframe' : sleepRoom ? 'sleep' : barRoom ? 'bar' : jukeboxRoom ? 'jukebox' : null;
        if (wasHiddenStreet && !nowHidden) {
            maybeRerollManholeState();
            // Rosvo (v4.66): yllätys vain paluussa pelistä / jukeboxista / BARista
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

    /* ── Rosvo: yllätysesiintyminen jalkakäytävällä (v4.66) ──
       Ilmestyy satunnaiseen kohtaan vähintään ROBBER_MIN_DIST päähän pelaajasta
       ja kävelee kohti tätä, kunnes nappaa kiinni (katoaa) tai elinikä (ttl) loppuu.
       Tila vain muistissa (ei tallenneta localStorageen). */
    /* Rosvon nopeus arvotetaan jokaisella ilmestymisellä: perusarvo (1.05)
       ± liukumaväli −20 % … +50 % (lo = 0,84 … hi = 1,575). */
    function randomRobberSpeed() {
        const lo = ROBBER_SPEED * ROBBER_SPEED_MIN_MULT;
        const hi = ROBBER_SPEED * ROBBER_SPEED_MAX_MULT;
        // Kaaos K3 (v10.04): rosvon nopeusarpa ei saa ylittää 1.4 × C (kyvykkyys)
        const max = threatSpeedMax(chaosAbility());
        return Math.min(lo + Math.random() * (hi - lo), max);
    }

    function spawnRobber() {
        const pcx = player.x + player.w / 2;
        // BAR-ovi (lamppu 4 → buildings[8], x 765): tähän kohtaan rosvo EI saa
        // ilmestyä koskaan – pelaaja käy BAR:ssa usein, eikä ulostulossa saa
        // joutua heti kiinni (reunaklamppi vei spawnin pelaajan kylkeen).
        // Muissa ovissa huono tuuri sallitaan.
        const barDoorX = doorCenter(buildings[lamps[4].bldgIdx]).x;
        let x = null;
        for (let attempt = 0; attempt < 8 && x === null; attempt++) {
            const side = Math.random() < 0.5 ? -1 : 1;   // kumpi puoli pelaajasta
            let cand = pcx + side * (ROBBER_MIN_DIST + Math.random() * (WORLD_W - 2 * ROBBER_MIN_DIST - ROBBER_W));
            cand = Math.max(4, Math.min(WORLD_W - ROBBER_W - 4, cand));
            if (Math.abs(cand + ROBBER_W / 2 - barDoorX) >= ROBBER_BAR_EXCLUDE_R) x = cand;
        }
        if (x === null) x = Math.max(4, barDoorX - ROBBER_BAR_EXCLUDE_R - ROBBER_W / 2);   // varmistus
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

    /* ── Rosvon päivitys: partiointi + kiinniotto (v4.66) ──
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

        // v10.12: BAD CHAOS → rosvo jahtaa vapaasti (molemmat akselit, kuten avenger).
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
            // Rosvo vie kaikki rahat (v4.68): kolikkosaldo nollataan.
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

    /* ── Onnettomuus: tainnutus + 1 hampurilainen ───
       Sama vaikutus kuin kukkaruukulla/autolla/sähköiskulla.
       Käyttää vain uusi oviukko-koodi – vanhat haarat ennallaan. */
    function knockPlayerDown() {
        player.knockedDown = true;
        player.knockdownTimer = AVENGER_STUN;
        player.kicking = false;
        player.kickFrame = 0;
        hamburgerCount--;
        state.inventory.hamburgerCount = hamburgerCount;
        GameState.save(state);
        updateHUD();
        if (hamburgerCount <= 0) { killPlayer(); }
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

    /* ── Avoin kaivo: pudotus ja ylöskiipeäminen (v4.51/v4.52/v4.69) ───────
       Pelaaja astui reiän ellipsiin → vajoaa alas (katoaa), köpii takaisin
       ylös ja jatkaa matkaa. Menetys: **enintään 2 🪙** (1 → 0, 0 → ei mitään);
       mutta **1/6 putoamisista kaivon pohjalta löytyy +3 🪙** (v4.69).
       Ei tainnutusta eikä 🍔-menetystä.
       Sekvenssin ajan katu on jäissä (update palaa heti alussa). */
    function startManholeFall(idx) {
        const mh = foreground.manholes[idx];
        mhAction = { idx: idx, phase: 'fall', t: MH_FALL_FRAMES };
        player.kicking = false;
        player.kickFrame = 0;
        player.walking = false;
        hitPauseTimer = HIT_PAUSE;                     // pieni pysähdys osumasta
        playKnock();                                   // putoamisen tömähdys
        spawnParticles(mh.x, mh.y - 2, '#3a3a3a', 8);  // pölyä reiän reunalta
    }

    function updateManholeAction(dt) {
        const a = mhAction;
        const mh = foreground.manholes[a.idx];
        a.t -= dt;

        if (a.phase === 'climb') {
            /* Kiipeäminen (v4.51): hahmo nousee hitaasti KAIVON KESKELTÄ
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
            mhInside[a.idx] = false;
            mhAction = null;
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

        /* Pohjassa (v4.52 / v4.69): tavallisesti kolikot hulahtavat viemäriin
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

    /* ── Potkuääni (Web Audio API) ────────────────── */
    let audioCtx = null;
    let _audioListenersAdded = false;
    function initAudio() {
        if (!audioCtx) {
            audioCtx = StreetAudio.getCtx();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (!_audioListenersAdded) {
            _audioListenersAdded = true;
            const resumeAudio = () => {
                if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            };
            document.addEventListener('touchstart', resumeAudio, { passive: true });
            document.addEventListener('mousedown', resumeAudio);
            document.addEventListener('keydown', resumeAudio);
        }
    }
    function playKick() {
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return;
            const now = audioCtx.currentTime;
            // Lyhyt napsaus – kohina + terävä alku
            const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.06), audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.008));
            }
            const src = audioCtx.createBufferSource();
            src.buffer = buf;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 800;
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.83 * sfxVolumeMult, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            src.connect(filter).connect(gain).connect(audioCtx.destination);
            src.start(now);
            src.stop(now + 0.06);
        } catch(e) {}
    }
    /* ── Kävelyääni ──────────────────────────────── */
    function playWalk() {
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return;
            const now = audioCtx.currentTime;
            const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.05), audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(audioCtx.sampleRate*0.012));
            const src = audioCtx.createBufferSource(); src.buffer = buf;
            const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 300;
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.68 * sfxVolumeMult, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            src.connect(filter).connect(gain).connect(audioCtx.destination);
            src.start(now); src.stop(now + 0.05);
        } catch(e) {}
    }
    /* ── Kolikkoääni ──────────────────────────────── */
    function playCoin() {
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return;
            const now = audioCtx.currentTime;
            // Vieno pling – kaksi sine-oskillaattoria (1200 + 1800 Hz)
            [1200, 1800].forEach(freq => {
                const osc = audioCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = freq;
                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.18 * sfxVolumeMult, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.connect(gain).connect(audioCtx.destination);
                osc.start(now); osc.stop(now + 0.08);
            });
        } catch(e) {}
    }
    /* ── Tömähdys (oviukon osuma) ──────────────────── */
    function playKnock() {
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return;
            const now = audioCtx.currentTime;
            // Matala tömähdys: kohina + lyhyt matala jyrinä
            const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.12), audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.02));
            }
            const src = audioCtx.createBufferSource();
            src.buffer = buf;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 500;
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.75 * sfxVolumeMult, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            src.connect(filter).connect(gain).connect(audioCtx.destination);
            src.start(now); src.stop(now + 0.12);

            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(45, now + 0.11);
            const ogain = audioCtx.createGain();
            ogain.gain.setValueAtTime(0.30 * sfxVolumeMult, now);
            ogain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
            osc.connect(ogain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.12);
        } catch(e) {}
    }
    /* ── Sähköiskun ääni ───────────────────────────── */
    function playZap() {
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return;
            const now = audioCtx.currentTime;
            // Surina: kohina + nopea neliöaalto-sweep alas
            const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.18), audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.04));
            }
            const src = audioCtx.createBufferSource();
            src.buffer = buf;
            const ngain = audioCtx.createGain();
            ngain.gain.setValueAtTime(0.5 * sfxVolumeMult, now);
            ngain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            src.connect(ngain).connect(audioCtx.destination);
            src.start(now); src.stop(now + 0.18);

            const osc = audioCtx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
            const ogain = audioCtx.createGain();
            ogain.gain.setValueAtTime(0.12 * sfxVolumeMult, now);
            ogain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(ogain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.15);
        } catch(e) {}
    }

    /* ── Sädeaseen laserääni (v10.21) – "pew" kuin Star Wars ── */
    function playLaser() {
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return;
            const now = audioCtx.currentTime;
            // Vingahdus: korkea → matala sweep (sahatonni), ~1 s (v10.22)
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1900, now);
            osc.frequency.exponentialRampToValueAtTime(160, now + 1.0);
            const ogain = audioCtx.createGain();
            ogain.gain.setValueAtTime(0.16 * sfxVolumeMult, now);
            ogain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
            osc.connect(ogain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 1.0);
            // Kirkas neliökerros → terävämpi "pew"
            const osc2 = audioCtx.createOscillator();
            osc2.type = 'square';
            osc2.frequency.setValueAtTime(2800, now);
            osc2.frequency.exponentialRampToValueAtTime(320, now + 0.8);
            const g2 = audioCtx.createGain();
            g2.gain.setValueAtTime(0.09 * sfxVolumeMult, now);
            g2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc2.connect(g2).connect(audioCtx.destination);
            osc2.start(now); osc2.stop(now + 0.8);
        } catch(e) {}
    }

    /* ── Meteoriitin osumaääni (v11.14): kivi halkeaa – matala kolahtava
       "klonk" + lyhyt murskautuvan kuoren kohina. Erottuu selvästi laserin
       pew-äänestä, jotta pelaaja tietää osuneensa (1. osuma ei vielä tuhoa). */
    function playMeteorHit() {
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return;
            const now = audioCtx.currentTime;
            // Kolahtava runko: kivi resonoi matalalla
            const osc = audioCtx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(70, now + 0.16);
            const ogain = audioCtx.createGain();
            ogain.gain.setValueAtTime(0.13 * sfxVolumeMult, now);
            ogain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.connect(ogain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.18);
            // Murskautuva kuori: lyhyt keskiääninen kohinapiikki
            const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.09), audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.018));
            }
            const src = audioCtx.createBufferSource(); src.buffer = buf;
            const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass';
            bp.frequency.value = 900; bp.Q.value = 0.9;
            const ngain = audioCtx.createGain();
            ngain.gain.setValueAtTime(0.10 * sfxVolumeMult, now);
            ngain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            src.connect(bp).connect(ngain).connect(audioCtx.destination);
            src.start(now); src.stop(now + 0.09);
        } catch(e) {}
    }

    /* ── Tyhjä laukaus (v11.14): kuiva klikki, kun ase on vielä lukossa.
       Kertoo, että klikkaus meni perille mutta laukaus ei lähde – ei uutta
       tekstiä (sääntö 06), vain ääni. */
    function playBeamEmpty() {
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return;
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(340, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(0.045 * sfxVolumeMult, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc.connect(g).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.06);
        } catch(e) {}
    }

    /* ── Katuvalon syttyminen (yön lamppushow, v4.42) ──
       Pehmeä naksahdus: lyhyt korkea kohinapiikki + lämmin humahdus.
       Sama tyyli kuin muilla kadun SFX:illä (Web Audio, ei tiedostoja). */
    function playLampOn() {
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return;
            const now = audioCtx.currentTime;
            // Naksahdus: lyhyt kohina, korkea suodatus → "klik"
            const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.045), audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.006));
            }
            const src = audioCtx.createBufferSource(); src.buffer = buf;
            const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
            const ngain = audioCtx.createGain();
            ngain.gain.setValueAtTime(0.32 * sfxVolumeMult, now);
            ngain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
            src.connect(hp).connect(ngain).connect(audioCtx.destination);
            src.start(now); src.stop(now + 0.045);
            // Lämmin humahdus: hehkulanka syttyy (hillitty, ei peitä musiikkia)
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(420, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.14);
            const ogain = audioCtx.createGain();
            ogain.gain.setValueAtTime(0.10 * sfxVolumeMult, now);
            ogain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            osc.connect(ogain).connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.16);
        } catch(e) {}
    }

    /* ── Ajoneuvon moottoriääni ────────────────────── */
    function startVehicleEngine(v) {
        try {
            initAudio();
            if (!audioCtx || audioCtx.state !== 'running') return null;
            const now = audioCtx.currentTime;
            let baseFreq, gainVal, lfoRate, lowpassFreq;
            let lfoDepth = 0.22;    // LFO:n modulaatiosyvyys (osuus perustaajuudesta)
            let tankDrive = false;  // panssarivaunu: särö + toinen oskillaattori
            if (v.type === 'motorcycle') {
                baseFreq = 185; gainVal = 0.025; lfoRate = 15; lowpassFreq = 2200;
            } else if (v.type === 'ambulance') {
                baseFreq = 55; gainVal = 0.08; lfoRate = 6; lowpassFreq = 420;
            } else if (v.type === 'tank') {
                // Raskas panssarivaunu: todella matala perusjyrinä (28 Hz) ja kova,
                // säröity sävy. Suodatin päästää yläsävelet ~900 Hz asti, jotta ääni
                // kuuluu myös puhelimen pienestä kaiuttimesta – pelkkä 35 Hz +
                // 200 Hz suodatin jäi kännykässä käytännössä kuulumattomiin.
                baseFreq = 28; gainVal = 0.30; lfoRate = 3; lowpassFreq = 900;
                lfoDepth = 0.35;
                tankDrive = true;
            } else { // car
                baseFreq = 82; gainVal = 0.065; lfoRate = 9; lowpassFreq = 640;
            }
            // Pääoskillaattori – moottorin perusjyrinä
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = baseFreq;
            // LFO: taajuusmodulaatio → suriseva "zzz"/"ZZZzzz"-jyrinä
            const lfo = audioCtx.createOscillator();
            lfo.type = 'triangle';
            lfo.frequency.value = lfoRate;
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = baseFreq * lfoDepth;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            // Alipäästösuodatin pehmentää sahahampaan
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = lowpassFreq;
            // Panssarivaunu: toinen oskillaattori oktaavia ylempänä (kova, koneellinen
            // sävy) + tanh-särö → lisää yläsäveliä, jotta matala jyrinä kuuluu myös
            // puhelimen kaiuttimesta. Molemmat ajetaan saman suodattimen läpi.
            let osc2 = null, shaper = null;
            if (tankDrive) {
                osc2 = audioCtx.createOscillator();
                osc2.type = 'square';
                osc2.frequency.value = baseFreq * 2;
                osc2.detune.value = 12;             // hieno detune → karkea, elävä jyrinä
                const osc2Gain = audioCtx.createGain();
                osc2Gain.gain.value = 0.5;
                osc2.connect(osc2Gain);
                osc2Gain.connect(filter);
                shaper = audioCtx.createWaveShaper();
                const n = 1024, curve = new Float32Array(n);
                for (let i = 0; i < n; i++) {
                    curve[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * 3.5);
                }
                shaper.curve = curve;
                shaper.oversample = '2x';
            }
            // Äänenvoimakkuus (pehmeä fade-in)
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(gainVal, now + 0.5);
            // Stereopanorointi – ääni seuraa auton x-sijaintia
            const panner = (typeof audioCtx.createStereoPanner === 'function') ? audioCtx.createStereoPanner() : null;
            osc.connect(filter);
            if (shaper) { filter.connect(shaper); shaper.connect(gain); }
            else { filter.connect(gain); }
            if (panner) { gain.connect(panner); panner.connect(audioCtx.destination); }
            else { gain.connect(audioCtx.destination); }
            osc.start(now);
            lfo.start(now);
            if (osc2) osc2.start(now);
            const engine = { osc, lfo, gain, panner, osc2 };
            updateVehicleEngine(engine, v);
            return engine;
        } catch (e) { return null; }
    }

    function updateVehicleEngine(engine, v) {
        if (!engine || !audioCtx || !engine.panner) return;
        try {
            const pan = Math.max(-1, Math.min(1, (v.x / WORLD_W) * 2 - 1));
            engine.panner.pan.setTargetAtTime(pan, audioCtx.currentTime, 0.05);
        } catch (e) {}
    }

    function stopVehicleEngine(engine) {
        if (!engine || !audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            engine.gain.gain.cancelScheduledValues(now);
            engine.gain.gain.setValueAtTime(Math.max(engine.gain.gain.value, 0.0001), now);
            engine.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
            engine.osc.stop(now + 0.4);
            engine.lfo.stop(now + 0.4);
            if (engine.osc2) engine.osc2.stop(now + 0.4);
        } catch (e) {}
    }

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
       AI CHAOS – kaaostasot (v5.03)
       Keskitetty profiilirakenne: muuttaa VAIN olemassa olevia
       arvoja/kertoimia – ei uutta pelilogiikkaa. NORMAL = nykyiset
       arvot bitti-identtisinä. FULL CHAOS arpoo uniikin siemenen.
       ═══════════════════════════════════════════════════════════ */
    const CHAOS_DEFAULTS = {
        windSpeedMult: 1, windDirFlip: false,
        trafficSpeedMult: 1, trafficSpawnMult: 1,
        dayCycleFrames: 10800, skyDir: 1,
        birdMin: 10, birdMax: 15,
        coinRespawnFrames: 7200,
        robberChance: 0.4, robberSpeed: 1.05, robberCooldown: 1500, robberTtl: 900
    };
    /* CHAOS_DEFAULTS2 = täysi superset (v10.02): kaikki kaaosakselit NORMAL-arvoilla.
       NORMAL = nykyiset literaalit → peli pysyy bitti-identtisenä (pääsääntö 1). */
    const CHAOS_DEFAULTS2 = Object.assign({}, CHAOS_DEFAULTS, {
        playerSpeedMult: 1,               // kävelynopeuskerroin (kaaos K4, v10.04; klampi 0.6–1.6)
        avengerChance: 0.12, avengerSpeed: 1.0, avengerTelegraph: 21,
        avengerStun: 600, avengerFreeze: 180, avengerCooldown: 1800,
        robberStun: 900, robberChasesY: false, cabinetOnChance: 0.5,   // robberChasesY: rosvo jahtaa vapaasti y-akselilla (v10.12, vain BAD)
        startBurgers: 5, startCoins: 2, hungerWakeGrace: 600, burgerInterval: 2400,
        fogAlpha: 0,
        cloudCount: 18, cloudOpacityMult: 1, cloudBandTop: 40, cloudBandH: 40,
        cloudSizeMult: 1, cloudCirrusShare: 0.35,
        starCount: 80, starSizeMult: 1,
        sunColor: null, sunGlow: null,     // null = nykyinen piirto (ei kaaosakselia vielä)
        animalSpeedMult: 1, animalDirBias: 0.5, animalTypeWeights: null,
        batSpawnFrames: 1800, birdSpeedMult: 1, beetleCount: 1,
        windowTargetMax: 5, windowDurMin: 10000, windowDurMax: 30000,
        lampHueShift: 0, threatWarnMult: 1,
        cloudDayAlpha: 5,                       // CLOUD_DAY_ALPHA (päivän pilvien peittävyys)
        daySkyTop: '#3f7fc0', daySkyMid: '#78b4e0', daySkyHorizon: '#ffd9a0',
        silhouetteChance: 0.5, winDayFill: '#151716',
        lampRadius: 30, batCountMax: 5, buildingPalette: null,
        // K2 (kellon rytmit) + K6 (SFX) – v10.05
        dayFadeFrames: 1200, nightFadeFrames: 1200, cycleChangeDelayFrames: 900,
        nightLampFirst: 30, nightLampInterval: 18, spawnLampDelay: 240,
        cabBlinkMin: 420, cabBlinkMax: 700, cabRerollMin: 900, cabRerollMax: 2100,
        mosquitoDayDim: 1, meteorTempoMult: 1, sfxVolumeMult: 1,
        // Kaaos v10.18 – uudet akselit (NORMAL = no-op)
        doorLockChance: 0, staggerAmount: 0, screenShakeAmount: 0,
        lampRedFlicker: 0, barBurntLetter: -1, cabFlicker: 0, sunSizeMult: 1
    });
    let chaosLevel = 'normal';
    let chaosCfg = Object.assign({}, CHAOS_DEFAULTS2);
    let windSpeedMult = 1, windDirFlip = false;
    let trafficSpeedMult = 1, trafficSpawnMult = 1;
    let skyDir = 1;
    /* Uudet kaaosakselimuuttujat (K1/K2/K3) – alustetaan NORMAL-arvoihin.
       Kirjoitetaan applyChaosProfile():issa vasta vaiheissa v10.03/v10.04. */
    let cloudCount = 18, cloudOpacityMult = 1, cloudBandTop = 40, cloudBandH = 40;
    let cloudSizeMult = 1, cloudCirrusShare = 0.35, starCount = 80, starSizeMult = 1;
    let sunColor = null, sunGlow = null;
    let animalSpeedMult = 1, animalDirBias = 0.5, animalTypeWeights = null;
    let batSpawnFrames = 1800, birdSpeedMult = 1, beetleCount = 1;
    let windowTargetMax = 5, windowDurMin = 10000, windowDurMax = 30000;
    let lampHueShift = 0, threatWarnMult = 1;
    let buildingPalette = null;   // talojen väripaletti (null = BUILDING_PALETTE)
    let meteorTempoMult = 1;      // tähdenlennon/satelliitin tahti (K2, v10.05)
    let sfxVolumeMult   = 1;      // SFX-taso (K6, v10.05)
    let fogAlpha        = 0;      // sumuverhon peittävyys (K7/K1, v10.05)
    // Kaaos v10.18 – uudet akselit (polariteetti: ikävät = BAD/FULL, neutraalit = kaikki chaos-tasot)
    let doorLockChance   = 0;     // lukitut ovet (jukebox + hedelmäpeli), 0 = ei koskaan (NORMAL)
    let staggerAmount    = 0;     // pelaajan hoipertelu (0–1), 0 = suora kävely (NORMAL)
    let screenShakeAmount = 0;    // koko ajan hiukan tärisevä kuva (0–1), 0 = ei (NORMAL)
    let lampRedFlicker   = 0;     // lamppu napsahtaa hetkeksi punaiseksi (todennäköisyys/frame)
    let barBurntLetter   = -1;    // BAR-kyltin palanut kirjain (-1 = ei mitään, 0–2 = B/A/R)
    let cabFlicker       = 0;     // sähkökaapin valon "rätinä" (0–1)
    let sunSizeMult      = 1;     // auringon koko (1 = nykyinen, 2 = tupla)

    /* Kaaos v10.18 – satunnaisesti lukittu ovi (jukebox + hedelmäpeli).
       Ei ilmoitusta (sääntö 06): ovi ei vain aukea. BAR ja makuuhuone
       ovat aina auki (pelaajan turvapaikat) – niitä ei koskaan lukita. */
    function doorLocked() { return doorLockChance > 0 && Math.random() < doorLockChance; }

    /* Deterministinen siemen + testikytkimet (v10.02, K0-infra).
       ?seed=N → sama kaaos jokaisella latauksella · ?debug → konsolidumppi. */
    function makeRng(seed) {               // mulberry32 – sama siemen = sama peli
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const CHAOS_PARAMS = (typeof location !== 'undefined' && typeof URLSearchParams !== 'undefined')
        ? new URLSearchParams(location.search) : null;
    const CHAOS_SEED_PARAM = (CHAOS_PARAMS ? CHAOS_PARAMS.get('seed') : null);
    const CHAOS_SEED = (CHAOS_SEED_PARAM !== null && /^\d+$/.test(CHAOS_SEED_PARAM))
        ? Number(CHAOS_SEED_PARAM) : null;
    const CHAOS_DEBUG = !!(CHAOS_PARAMS && CHAOS_PARAMS.get('debug') !== null);
    let chaosRng = (CHAOS_SEED !== null) ? makeRng(CHAOS_SEED) : Math.random;

    function rnd(a, b) { return a + chaosRng() * (b - a); }
    function rndInt(a, b) { return Math.round(rnd(a, b)); }

    /* Kaaos K1 – visuaaliset apurit (v10.03): talopaletit + auringon värit */
    const WARM_PALETTE = [
        '#2a1a14', '#2a1e16', '#241a12', '#2a1616', '#241822',
        '#2a1c18', '#2a1a1c', '#221a20', '#2a1e14',
        '#241a18', '#26201a', '#2a1818', '#261a1e', '#281c12',
        '#2c1a16', '#221c1a', '#2a1a18', '#262016'
    ];
    const NEAR_BLACK_PALETTE = [
        '#0a0a0c', '#0b0a0c', '#0a0b0a', '#0c0a0a', '#0a0a0e',
        '#0a0c0c', '#0b0b0a', '#0a0a0e', '#0c0b0a',
        '#0a0a0d', '#0a0b0b', '#0c0a0b', '#0a0a0f', '#0b0c0a',
        '#0c0a0c', '#0a0c0b', '#0b0a0e', '#0a0b0a'
    ];
    const SUN_GLOW_DEFAULT = ['rgba(255,224,120,0.55)', 'rgba(255,210,100,0.20)', 'rgba(255,200,80,0)'];
    function randomHuePalette() {
        const arr = [];
        for (let i = 0; i < 18; i++) {
            const h = Math.floor(Math.random() * 360);
            const l = 8 + Math.floor(Math.random() * 8);
            arr.push('hsl(' + h + ',' + (20 + Math.floor(Math.random() * 30)) + '%,' + l + '%)');
        }
        return arr;
    }
    function randomDarkSky() {
        const v = 40 + Math.floor(Math.random() * 120);
        const b = Math.min(255, v + Math.floor(Math.random() * 30));
        const hex = (x) => x.toString(16).padStart(2, '0');
        return '#' + hex(v) + hex(v) + hex(b);
    }
    function randomAnimalTypes() {
        const all = ['mouse', 'rat', 'rabbit'];
        const arr = [];
        for (let i = 0; i < 6; i++) arr.push(all[Math.floor(Math.random() * all.length)]);
        return arr;
    }
    function randomSunColor() {
        const pick = Math.floor(Math.random() * 3);
        if (pick === 0) return { sunColor: '#7dff7d', sunGlow: ['rgba(120,255,120,0.55)', 'rgba(90,220,90,0.20)', 'rgba(70,180,70,0)'] };
        if (pick === 1) return { sunColor: '#d37dff', sunGlow: ['rgba(200,140,255,0.55)', 'rgba(170,110,230,0.20)', 'rgba(140,90,190,0)'] };
        return { sunColor: '#ff4d4d', sunGlow: ['rgba(255,100,100,0.55)', 'rgba(220,80,80,0.20)', 'rgba(180,60,60,0)'] };
    }

    /* ── Tähdenlento + satelliitti – apufunktiot (v10.03, ❓4) ──
       Sama logiikka oli aiemmin kahtena kopiona (tainnutus-haara + kadun
       update). Yhdistetty, jotta sama koodi pätee molemmissa paikoissa. */
    const METEOR_SHAKE_FRAMES = 150;  // meteoriitin törmäyksen tärinän kesto (frameä, ~2.5 s, v10.16)
    const METEOR_FLASH_FRAMES = 60;   // meteoriitin taivasvälähdyksen kesto (frameä, ~1 s, v10.16)
    const METEOR_BACKDROP_HOUSES = 3; // meteoriitin osuma tuhoaa N taustataloa rivistä (v10.19)

    /* Meteoriitin esiintymistodennäköisyys (v10.20/v10.24): tappavat meteoriitit
       tulevat FULL CHAOS -modessa aina ja BAD CHAOS -modessa harvakseltaan
       (BAD:ssa ei ole sädeasetta → pelaaja joutuu katsomaan kaupungin tuhoutuvan).
       MILD/GOOD/NORMAL = 0 (ei koskaan). */
    function meteoriteChance() {
        if (chaosLevel === 'full') return 1;       // aina (sädease testattavissa)
        if (chaosLevel === 'bad') return 0.25;     // harvakseltaan tuhoavia, ei asetta
        return 0;
    }

    /* Meteoriitin osuma tuhoaa taustarivin taloja (v10.19): lähin lohko + sen
       viereiset (yhteensä METEOR_BACKDROP_HOUSES), jotta skyline sortuu paikallisesti
       siihen missä meteoriitti osui. Wrap-around pitää rivin ehjänä reunalla. */
    function destroyBackdropHouses(impactX) {
        if (!backdrop || !backdrop.blocks.length) return;
        const bgShift = camX * (1 - BACKDROP_PARALLAX);
        const target = impactX - bgShift;   // maailmakoordinaatti → tausta-avaruus
        let best = 0, bestDist = Infinity;
        for (let i = 0; i < backdrop.blocks.length; i++) {
            const cx = backdrop.blocks[i].x + backdrop.blocks[i].w / 2;
            const d = Math.abs(cx - target);
            if (d < bestDist) { bestDist = d; best = i; }
        }
        // Poista lähin + seuraavat (kierrä reunalla), suurimmasta indeksistä pienimpään
        const remove = [];
        for (let k = 0; k < METEOR_BACKDROP_HOUSES && remove.length < backdrop.blocks.length; k++) {
            remove.push((best + k) % backdrop.blocks.length);
        }
        remove.sort((a, b) => b - a);
        for (const i of remove) backdrop.blocks.splice(i, 1);
    }

    /* ── Sädease: tähtäys + laukaisu (v10.20) ── */
    function beamCanFire() {
        if (!beamWeaponCollected) return false;
        if (beamCooldownTimer > 0) return false;   // v11.14: laukaisuväli (piilottaa myös ristikon)
        if (!shootingStar || !shootingStar.active || shootingStar.kind !== 'meteorite') return false;
        if (dayT > 0) return false;
        // v10.22: pelaajan on oltava kääntyneenä meteoriitin tulosuuntaan (ei ammuntaa selästä)
        if (player.facing * shootingStar.vx >= 0) return false;
        // v10.22: ampuu vain lamppurivistön alapuolella (kadun puolella, ei talojen takaa)
        if (player.y + player.h < LAMP_BASE_Y) return false;
        return true;
    }

    /* Sädeaseen piipun kärki maailmakoordinaateissa (v10.22): sama piste
       piirrolle ja säteen lähtöpisteelle → säde lähtee aseesta, ei sen alta. */
    function beamMuzzle() {
        const cx = player.x + player.w / 2;
        const dir = player.facing;
        const gripX = cx + dir * 5;         // etukäden ote
        const gripY = player.y + 18;        // nostettu ote (v10.22)
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
       estäisi kaikki osumat. v10.25 */
    function meteoriteBehindBuilding() {
        const mx = shootingStar.x, my = shootingStar.y;
        for (const b of buildings) {
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
        // v11.14: lukon aikana kuiva klikki – muuten hiljainen "ei laukausta"
        // (päivällä, ilman meteoriittia tai väärinpäin seisten ei kuulu klikkiä)
        if (beamCooldownTimer > 0) { playBeamEmpty(); return; }
        if (!beamCanFire()) return;
        // v11.14: lukko päälle ENNEN osumatarkistusta → huti maksaa saman kuin osuma
        beamCooldownTimer = BEAM_COOLDOWN_FRAMES;
        beamFireTimer = BEAM_FIRE_FRAMES;
        const m = beamMuzzle();
        beamStartX = m.x; beamStartY = m.y;
        beamEndX = aimX; beamEndY = aimY;
        playLaser();
        // v10.25: talon takana olevaan meteoriittiin ei voi osua (tarkistaa sijainnin, ei linjaa)
        if (meteoriteBehindBuilding()) return;
        const d = distanceToSegment(shootingStar.x, shootingStar.y, m.x, m.y, aimX, aimY);
        if (d < shootingStar.r + BEAM_HIT_TOLERANCE) {
            // v11.14: meteoriitti kestää METEOR_HITS_TO_KILL osumaa. Ensimmäinen
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
            // v10.32: FULL CHAOS – jokainen ammuttu meteoriitti = +1 🪙.
            // Portti chaosLevel === 'full': ase on jaettu tallennuskenttä, joten
            // BADissa (25 % meteoriitit) ei tule kolikkoa – muut tasot pysyvät ennallaan.
            // Sääntö 06: ei uutta tekstiä – pling + kultakipinät + HUD-lukema riittävät.
            if (chaosLevel === 'full') {
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
        if (chaosLevel !== 'full' || beamWeaponCollected) { beamPickup = null; return; }
        /* v11.15: y on AINA sama (teräsaidan vieressä, pelaajan alin jalkapiste) –
           satunnainen y vei esineen toisinaan lampputolpan taakse, josta sitä ei
           voinut poimia lainkaan. Vain x arvotaan, ja sekään ei aivan reunaan. */
        const bx = BEAM_PICKUP_X_MIN + Math.random() * (BEAM_PICKUP_X_MAX - BEAM_PICKUP_X_MIN);
        beamPickup = { x: bx, y: BEAM_PICKUP_Y };
    }

    function updateShootingStar(dt) {
        if (!shootingStar || !shootingStar.active) {
            if (shootingStar) { shootingStar.timer -= dt; }
            if (!shootingStar || shootingStar.timer <= 0) {
                if (chaosLevel !== 'normal' && Math.random() < meteoriteChance()) {
                    // Iso, hitaasti putoava meteoriitti (v10.15/v10.16) – tähdenlennon tilalla.
                    // v10.16: viisto laskeutumiskulma 40–60° vaakasuorasta (kuten tähdenlento),
                    // jotta ehtii nähdä ja säikähtää. Suunta oikealle/vasemmalle, lähtö vastakkaiselta reunalta.
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
                        hpLeft: METEOR_HITS_TO_KILL,   // v11.14: 2 osumaa tuhoaa
                        cracked: false, hitFlash: 0,   // cracked = ottanut osuman → lämmin oranssi sävy
                        trail: [], timer: chaosLevel === 'full' ? 600 : (600 + Math.random() * 2100) * meteorTempoMult
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
                        trail: [], timer: cardState.meteorBurst ? (5 + Math.random() * 15) : (600 + Math.random() * 2100) * meteorTempoMult
                    };
                }
            }
        } else if (shootingStar.kind === 'meteorite') {
            shootingStar.x += shootingStar.vx * dt;
            shootingStar.y += shootingStar.vy * dt;
            shootingStar.life += dt;
            if (shootingStar.hitFlash > 0) shootingStar.hitFlash -= dt;   // v11.14: osumavälähdys
            shootingStar.trail.push({x: shootingStar.x, y: shootingStar.y});
            if (shootingStar.trail.length > 48) shootingStar.trail.shift();  // v10.16: 2x pidempi häntä
            if (shootingStar.y >= GROUND_Y) {
                meteorShakeTimer = METEOR_SHAKE_FRAMES;
                meteorFlash = { t: METEOR_FLASH_FRAMES };   // v10.16: taivas välähtää (ei etualan palloa)
                destroyBackdropHouses(shootingStar.x);      // v10.19: taustarivi sortuu osumakohdasta
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
        // v11.14: osuman ottanut meteoriitti on "lämmennyt" – muoto ja syke pysyvät
        // täysin ennallaan, vain sävy vaihtuu tasaisesti lämpimään oranssiin
        // (ei halkeamia eikä muita muotoyksityiskohtia: se näytti mustalta rastilta).
        const dmg = m.cracked === true;
        const trailRGB = dmg ? '255,192,140' : '205,220,245';
        // Kapea, vaalea, häipyvä vana (kalpea + hoikka, ei "joulupukin reki")
        for (let t = 0; t < m.trail.length; t++) {
            const tr = m.trail[t];
            const k = t / m.trail.length;
            ctx.fillStyle = 'rgba(' + trailRGB + ',' + (k * 0.4) + ')';
            ctx.beginPath(); ctx.arc(tr.x, tr.y, 0.7 + k * 1.4, 0, Math.PI * 2); ctx.fill();
        }
        // Hoikka ydin + heikko hehku: kylmä jäänvalkoinen → lämmenneenä pehmeä oranssi
        const pulse = 0.85 + Math.sin(m.life * 0.12) * 0.15;
        const r = m.r * pulse * 0.55;   // laihempi ydin
        const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 2.4);
        if (dmg) {
            glow.addColorStop(0, 'rgba(255,206,150,' + (0.5 * pulse) + ')');
            glow.addColorStop(0.55, 'rgba(255,152,78,0.20)');
            glow.addColorStop(1, 'rgba(205,95,45,0)');
        } else {
            glow.addColorStop(0, 'rgba(240,246,255,' + (0.5 * pulse) + ')');
            glow.addColorStop(0.55, 'rgba(175,195,225,0.20)');
            glow.addColorStop(1, 'rgba(150,170,200,0)');
        }
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(m.x, m.y, r * 2.4, 0, Math.PI * 2); ctx.fill();
        // Ydin (lämmenneenä pehmeä oranssi)
        ctx.fillStyle = dmg ? '#ffcf95' : '#f4f8ff';
        ctx.beginPath(); ctx.arc(m.x, m.y, r * 0.7, 0, Math.PI * 2); ctx.fill();
        // Osumavälähdys: lyhyt lämmin pop (~10 f) – pelkkä sävy, ei muotoa (v11.14)
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

    function generateFullChaosSeed() {
        const sun = randomSunColor();
        return {
            windSpeedMult: rnd(0.5, 3.5),
            windDirFlip: Math.random() < 0.5,
            trafficSpeedMult: rnd(0.6, 1.8),
            trafficSpawnMult: rnd(0.4, 1.8),
            dayCycleFrames: rndInt(4000, 22000),
            skyDir: Math.random() < 0.5 ? -1 : 1,
            birdMin: rndInt(0, 12),
            birdMax: rndInt(12, 30),
            coinRespawnFrames: rndInt(1800, 18000),
            robberChance: rnd(0.05, 0.9),
            robberSpeed: rnd(0.7, 2.0),
            robberCooldown: rndInt(300, 3000),
            robberTtl: rndInt(300, 2000),
            // K3 (uhka) + K4 (keho/reppu) – v10.04. Kaikki kulkee portin läpi.
            // v10.18: hidastus poistettu (tylsä) → vain normaali/nopeampi; hoipertelu korvaa sen.
            playerSpeedMult: rnd(1.0, 1.6),
            avengerChance: rnd(0, 0.6),
            avengerSpeed: rnd(0.5, 1.4),
            avengerTelegraph: rndInt(12, 45),
            avengerFreeze: rndInt(0, 300),
            avengerCooldown: rndInt(600, 6000),
            avengerStun: rndInt(150, 600),
            robberStun: rndInt(150, 900),
            cabinetOnChance: rnd(0, 0.9),
            // v10.32: aloituskolikot KIINTEÄT = sama kuin NO CHAOS (CHAOS_DEFAULTS2.startCoins = 2).
            // Ennen rndInt(1, 100) → kolikkoja oli alussa liikaa, eikä meteoriittien
            // ampumiselle ollut motivaatiota. Muut kaaosakselit ennallaan.
            startCoins: CHAOS_DEFAULTS2.startCoins,
            startBurgers: rndInt(2, 10),
            hungerWakeGrace: rndInt(600, 1800),
            burgerInterval: rndInt(1200, 12000),
            // K1 (v10.03) – visuaalinen
            cloudCount: rndInt(4, 34),
            cloudOpacityMult: rnd(0.6, 2.5),
            cloudSizeMult: rnd(0.6, 2.5),
            cloudBandTop: rndInt(10, 100), cloudBandH: rndInt(10, 100),
            cloudCirrusShare: rnd(0, 1),
            cloudDayAlpha: rndInt(1, 10),
            daySkyTop: randomDarkSky(), daySkyMid: randomDarkSky(), daySkyHorizon: randomDarkSky(),
            starCount: rndInt(0, 140), starSizeMult: rnd(0.5, 2),
            sunColor: sun.sunColor, sunGlow: sun.sunGlow,
            silhouetteChance: rnd(0.05, 0.95),
            winDayFill: randomDarkSky(),
            lampRadius: rndInt(20, 60),
            lampHueShift: rndInt(0, 360),
            animalSpeedMult: rnd(0.4, 2.5),
            animalDirBias: rnd(0.1, 0.9),
            animalTypeWeights: randomAnimalTypes(),
            batSpawnFrames: rndInt(600, 3600),
            batCountMax: rndInt(0, 12),
            birdSpeedMult: rnd(0.6, 1.8),
            beetleCount: rndInt(0, 4),
            windowTargetMax: rndInt(0, 12),
            windowDurMin: rndInt(3000, 60000), windowDurMax: rndInt(60000, 300000),
            buildingPalette: randomHuePalette(),
            // K2 + K6 (v10.05)
            dayFadeFrames: rndInt(300, 3000), nightFadeFrames: rndInt(300, 3000),
            cycleChangeDelayFrames: rndInt(120, 1800),
            nightLampFirst: rndInt(4, 90), nightLampInterval: rndInt(2, 60), spawnLampDelay: rndInt(0, 900),
            cabBlinkMin: rndInt(120, 600), cabBlinkMax: rndInt(600, 1200),
            cabRerollMin: rndInt(300, 1800), cabRerollMax: rndInt(1800, 3600),
            mosquitoDayDim: (Math.random() < 0.5 ? 0 : 1),
            meteorTempoMult: rnd(0.1, 5), sfxVolumeMult: rnd(0.5, 1.5),
            // Kaaos v10.18 – uudet akselit. Ikävät (oviukko/hoipertelu/tärinä) arvotaan:
            // FULL voi saada ne tai olla ilman; BAD saa ne aina chaosProfile():ssa.
            doorLockChance: rnd(0, 0.6),
            staggerAmount: rnd(0, 1.0),
            screenShakeAmount: rnd(0, 0.5),
            lampRedFlicker: rnd(0, 0.03),
            barBurntLetter: rndInt(-1, 2),
            cabFlicker: rnd(0, 1),
            sunSizeMult: rnd(0.6, 2.0)
        };
    }

    function chaosProfile(level) {
        switch (level) {
            case 'mild':
                return {
                    windSpeedMult: rnd(0.8, 1.3), windDirFlip: false,
                    trafficSpeedMult: rnd(0.85, 1.2), trafficSpawnMult: rnd(0.85, 1.2),
                    dayCycleFrames: rndInt(7000, 16000), skyDir: 1,
                    birdMin: rndInt(7, 13), birdMax: rndInt(13, 20),
                    coinRespawnFrames: rndInt(4800, 9600),
                    robberChance: rnd(0.25, 0.55), robberSpeed: rnd(0.9, 1.25),
                    robberCooldown: rndInt(1000, 2000), robberTtl: rndInt(700, 1200),
                    // K3 + K4 (v10.04) – v10.18: ei hidastusta (vain normaali/nopeampi)
                    playerSpeedMult: rnd(1.0, 1.1),
                    avengerChance: rnd(0.08, 0.16), avengerSpeed: rnd(0.9, 1.1),
                    avengerTelegraph: rndInt(19, 23), avengerFreeze: rndInt(150, 210),
                    avengerCooldown: rndInt(1400, 2200), avengerStun: rndInt(540, 660),
                    robberStun: rndInt(810, 900), cabinetOnChance: rnd(0.4, 0.6),
                    startBurgers: rndInt(4, 6), burgerInterval: rndInt(1800, 3600),
                    hungerWakeGrace: rndInt(600, 900),
                    cloudCount: rndInt(18, 26), cloudOpacityMult: 1.2, cloudSizeMult: 1.2,
                    cloudBandTop: 40, cloudBandH: 40, cloudCirrusShare: 0.35, cloudDayAlpha: 5,
                    starCount: rndInt(60, 100), starSizeMult: 1,
                    sunColor: null, sunGlow: null,
                    silhouetteChance: 0.3, winDayFill: '#151716',
                    lampRadius: 30, lampHueShift: 0,
                    animalSpeedMult: 1, animalDirBias: 0.5, animalTypeWeights: null,
                    batSpawnFrames: 1800, batCountMax: 5,
                    birdSpeedMult: 1, beetleCount: 1,
                    windowTargetMax: rndInt(3, 6), windowDurMin: 10000, windowDurMax: 30000,
                    buildingPalette: null,
                    dayFadeFrames: 1200, nightFadeFrames: 1200, cycleChangeDelayFrames: 900,
                    nightLampFirst: rndInt(21, 39), nightLampInterval: rndInt(13, 23), spawnLampDelay: 240,
                    cabBlinkMin: 420, cabBlinkMax: 700, cabRerollMin: 900, cabRerollMax: 2100,
                    mosquitoDayDim: 1, meteorTempoMult: 0.8, sfxVolumeMult: rnd(0.9, 1.1),
                    // Kaaos v10.18 – MILD: ei ikäviä (oviukko/hoipertelu/tärinä = 0), vain hennot neutraalit efektit
                    doorLockChance: 0, staggerAmount: 0, screenShakeAmount: 0,
                    lampRedFlicker: rnd(0.0008, 0.002), barBurntLetter: -1,
                    cabFlicker: rnd(0.1, 0.25), sunSizeMult: rnd(1.0, 1.1)
                };
            case 'good':
                return {
                    windSpeedMult: 0.6, windDirFlip: false,
                    trafficSpeedMult: 0.85, trafficSpawnMult: 1.5,
                    dayCycleFrames: 14400, skyDir: 1,
                    birdMin: 14, birdMax: 22,
                    coinRespawnFrames: 3600,
                    robberChance: 0.12, robberSpeed: 0.8, robberCooldown: 2500, robberTtl: 600,
                    // K3 + K4 (v10.04)
                    playerSpeedMult: 1.0,
                    avengerChance: rnd(0.02, 0.06), avengerSpeed: rnd(0.6, 0.8),
                    avengerTelegraph: rndInt(26, 40), avengerFreeze: rndInt(240, 300),
                    avengerCooldown: rndInt(3000, 5000), cabinetOnChance: rnd(0.10, 0.25),
                    startBurgers: rndInt(6, 10), burgerInterval: rndInt(3000, 4800),
                    hungerWakeGrace: rndInt(900, 1800),
                    cloudCount: rndInt(8, 12), cloudOpacityMult: 0.8, cloudSizeMult: 0.8,
                    cloudBandTop: 20, cloudBandH: 40, cloudCirrusShare: 0.5, cloudDayAlpha: 3,
                    daySkyTop: '#4a90c8', daySkyMid: '#8ec4e8', daySkyHorizon: '#ffe9b8',
                    starCount: rndInt(120, 140), starSizeMult: 1.2,
                    sunColor: null, sunGlow: null,
                    silhouetteChance: 0.05, winDayFill: '#2a2e2c',
                    lampRadius: 34, lampHueShift: 35,
                    animalSpeedMult: 1.2, animalDirBias: 0.5,
                    animalTypeWeights: ['mouse', 'rabbit', 'rabbit', 'rabbit', 'rat'],
                    batSpawnFrames: 1800, batCountMax: 3,
                    birdSpeedMult: 1.2, beetleCount: 1,
                    windowTargetMax: rndInt(5, 8), windowDurMin: 20000, windowDurMax: 60000,
                    buildingPalette: WARM_PALETTE,
                    dayFadeFrames: rndInt(1800, 2600), nightFadeFrames: rndInt(1800, 2600), cycleChangeDelayFrames: rndInt(1500, 2400),
                    nightLampFirst: 45, nightLampInterval: 28, spawnLampDelay: 300,
                    cabBlinkMin: 300, cabBlinkMax: 800, cabRerollMin: 1800, cabRerollMax: 3600,
                    mosquitoDayDim: 1, meteorTempoMult: 1.5, sfxVolumeMult: rnd(0.7, 0.85),
                    // Kaaos v10.18 – GOOD: ei ikäviä, vain hennot neutraalit efektit
                    doorLockChance: 0, staggerAmount: 0, screenShakeAmount: 0,
                    lampRedFlicker: rnd(0.0008, 0.002), barBurntLetter: -1,
                    cabFlicker: rnd(0.1, 0.2), sunSizeMult: rnd(1.0, 1.15)
                };
            case 'bad':
                return {
                    windSpeedMult: rnd(2.0, 3.5), windDirFlip: true,
                    trafficSpeedMult: 1.45, trafficSpawnMult: 0.55,
                    dayCycleFrames: 5400, skyDir: -1,
                    birdMin: 0, birdMax: 4,
                    coinRespawnFrames: 14400,
                    // Rosvo jahtaa vapaasti (robberChasesY) → ei saa ilmestyä useammin kuin 30 s välein (1800 f)
                    robberChance: 0.75, robberSpeed: 1.5, robberCooldown: 1800, robberTtl: 1400,
                    robberChasesY: true,
                    // K3 + K4 (v10.04) – v10.18: ei hidastusta (hoipertelu korvaa sen)
                    playerSpeedMult: 1.0,
                    avengerChance: rnd(0.30, 0.50), avengerSpeed: rnd(1.2, 1.4),
                    avengerTelegraph: rndInt(12, 21), avengerFreeze: rndInt(60, 180),
                    avengerCooldown: rndInt(600, 1200), cabinetOnChance: rnd(0.70, 0.90),
                    startBurgers: rndInt(2, 3), burgerInterval: rndInt(1200, 2400),
                    hungerWakeGrace: 600,
                    cloudCount: rndInt(28, 34), cloudOpacityMult: 2.0, cloudSizeMult: 1.4,
                    cloudBandTop: 10, cloudBandH: 70, cloudCirrusShare: 0.15, cloudDayAlpha: 9,
                    daySkyTop: '#3a4044', daySkyMid: '#565e62', daySkyHorizon: '#6e6a5e',
                    starCount: rndInt(15, 30), starSizeMult: 0.8,
                    sunColor: '#c22f2f', sunGlow: ['rgba(200,60,60,0.45)', 'rgba(170,40,40,0.16)', 'rgba(140,30,30,0)'],
                    silhouetteChance: 0.9, winDayFill: '#0c0d0c',
                    lampRadius: 26, lampHueShift: 190,
                    animalSpeedMult: 0.8, animalDirBias: 0.5,
                    animalTypeWeights: ['rat', 'rat', 'rat'],
                    batSpawnFrames: 600, batCountMax: 12,
                    birdSpeedMult: 0.8, beetleCount: 1,
                    windowTargetMax: rndInt(0, 2), windowDurMin: 3000, windowDurMax: 10000,
                    buildingPalette: NEAR_BLACK_PALETTE,
                    dayFadeFrames: rndInt(400, 700), nightFadeFrames: rndInt(400, 700), cycleChangeDelayFrames: rndInt(200, 450),
                    nightLampFirst: 8, nightLampInterval: 4, spawnLampDelay: 60,
                    cabBlinkMin: 200, cabBlinkMax: 400, cabRerollMin: 500, cabRerollMax: 900,
                    mosquitoDayDim: 0, meteorTempoMult: 0.3, sfxVolumeMult: rnd(1.15, 1.35),
                    // Kaaos v10.18 – BAD: ikävät päällä (lukitut ovet, hoipertelu, tärinä) + neutraalit rajummin
                    doorLockChance: rnd(0.4, 0.6),
                    staggerAmount: rnd(0.5, 1.0),
                    screenShakeAmount: rnd(0.25, 0.5),
                    lampRedFlicker: rnd(0.006, 0.02),
                    barBurntLetter: rndInt(0, 2),
                    cabFlicker: rnd(0.5, 0.8),
                    sunSizeMult: rnd(1.6, 2.0)
                };
            case 'full':
                return generateFullChaosSeed();
            default:
                return Object.assign({}, CHAOS_DEFAULTS);
        }
    }

    function applyChaosProfile(level, cfgOverride) {
        chaosLevel = level || 'normal';
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
        // K1 – visuaaliset akselit (v10.03)
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
        // K2 (kellon rytmit) + K6 (SFX) – v10.05
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
        sfxVolumeMult       = chaosCfg.sfxVolumeMult;
        fogAlpha            = chaosCfg.fogAlpha;
        // Kaaos v10.18 – uudet akselit
        doorLockChance      = chaosCfg.doorLockChance;
        staggerAmount       = chaosCfg.staggerAmount;
        screenShakeAmount   = chaosCfg.screenShakeAmount;
        lampRedFlicker      = chaosCfg.lampRedFlicker;
        barBurntLetter      = chaosCfg.barBurntLetter;
        cabFlicker          = chaosCfg.cabFlicker;
        sunSizeMult         = chaosCfg.sunSizeMult;
        // Kaappien vilkuntajakso päivittyy uusiin CAB_BLINK-arvoihin
        for (const cab of electricCabinets) cab.period = CAB_BLINK_MIN + Math.random() * (CAB_BLINK_MAX - CAB_BLINK_MIN);
        // K7-korttipakka: aktivoi vain ei-NORMAL-tasoilla
        chaosCardsReset();
        // K3 (uhka) + K4 (keho/reppu) – v10.04: C-indeksi tuotantokäyttöön
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

    /* Kaaossession (v10.06): F5/reload palauttaa saman moden ilman alkuhubia.
       sessionStorage selviää reloadista mutta tyhjenee uudessa välilehdessä
       (→ "peliin tulo" näyttää hubin). ✕-hard reset ja kuolema tyhjentävät sen. */
    const CHAOS_SESSION_KEY = 'aistreet_chaos_session';
    function saveChaosSession() {
        try {
            sessionStorage.setItem(CHAOS_SESSION_KEY, JSON.stringify({ level: chaosLevel, cfg: chaosCfg }));
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

    /* ═══════════════════════════════════════════════════════════
       KAAOS v2 – portti (v10.02)
       Kaikki kaaosarvot kulkevat clampChaosCfg() → validateChaosCfg()
       -portin läpi (pääsääntö 2). NORMAL = nykyiset literaalit.
       Kutsutaan tuotannossa vaiheissa v10.03/v10.04; tässä vaiheessa
       toiminnot ovat valmiina ja ?debug raportoi ne.
       ═══════════════════════════════════════════════════════════ */
    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    // 1) Kyvykkyysindeksi C (luku 5.1)
    function chaosSpeedMult() { return chaosCfg.playerSpeedMult || 1; }
    // Portti käyttää ARVOTTAVAN configin arvoja (playerSpeedMult + startBurgers):
    // muuten C laskettaisiin vanhalla chaosCfg:llä ja väärällä 🍔-määrällä.
    function chaosAbilityFor(cfg) {
        return (cfg.playerSpeedMult || 1) * hungerMultFor(cfg.startBurgers);
    }
    // Ajonaikainen C (liike, rosvon spawn) käyttää elävää 🍔-määrää.
    function chaosAbility()   { return chaosSpeedMult() * hungerSpeedMult(); }
    function stunMaxOf(cfg)   { return Math.max(cfg.avengerStun, cfg.robberStun); }

    // 2) Selviytymisinvariantti (luku 5.2)
    const BURGER_INTERVAL_FLOOR = 1200;                 // kova lattia
    function burgerIntervalMin(cfg, C) {
        return Math.max(BURGER_INTERVAL_FLOOR, Math.ceil(stunMaxOf(cfg) + 885 / (1.225 * C)));
    }

    // 3) Uhka (luku 5.3)
    function threatSpeedMax(C)     { return 1.4 * C; }
    function threatTelegraphMin(C) { return Math.max(12, Math.ceil(21 / C)); }
    function threatBudget(cfg) {                        // montako uhka-akselia ääripäässä (max 3)
        const ext = (v, lo, hi) => (v <= lo + (hi - lo) * 0.1 || v >= hi - (hi - lo) * 0.1) ? 1 : 0;
        return ext(cfg.avengerChance, 0, 0.6) + ext(cfg.avengerSpeed, 0.5, 1.4)
             + ext(cfg.robberChance, 0, 0.9) + ext(cfg.robberSpeed, 0.7, 2.0)
             + ext(cfg.trafficSpeedMult, 0.6, 1.6) + ext(cfg.trafficSpawnMult, 0.5, 2.5);
    }

    // 4) Portti: klampit
    function clampChaosCfg(cfg) {
        const C = chaosAbilityFor(cfg);
        const c = Object.assign({}, cfg);
        c.playerSpeedMult  = clamp(c.playerSpeedMult, 1.0, 1.6);   // kävelynopeus (K4) – v10.18: ei hidastusta
        c.cloudCount       = clamp(c.cloudCount, 4, 34);
        c.cloudOpacityMult = clamp(c.cloudOpacityMult, 0.4, 2.5);
        c.windSpeedMult    = clamp(c.windSpeedMult, 0.4, 3.5);
        c.starCount        = clamp(c.starCount, 0, 140);
        c.avengerChance    = clamp(c.avengerChance, 0, 0.6);
        c.avengerSpeed     = clamp(c.avengerSpeed, 0.5, threatSpeedMax(C));
        c.avengerTelegraph = clamp(c.avengerTelegraph, threatTelegraphMin(C), 45);
        c.avengerFreeze    = clamp(c.avengerFreeze, 0, 300);       // BAD ≤ 180 (kiristetään tasoissa)
        c.avengerCooldown  = clamp(c.avengerCooldown, 600, 6000);
        c.avengerStun      = clamp(c.avengerStun, 150, 600);      // ei koskaan pidempi kuin nyt
        c.robberStun       = clamp(c.robberStun, 150, 900);
        c.robberSpeed      = clamp(c.robberSpeed, 0.7, threatSpeedMax(C));
        // Liikenteen ylityssääntö (K3): hitainkin pelaaja ehtii kadun yli.
        // ylitys 67 px @ 1.225·C · nopein auto 3.0 (ambulanssi) · 40 % turvamarginaali.
        const crossMax = 0.6 * (WORLD_W + 80) / (3.0 * (67 / (1.225 * C)));
        c.trafficSpeedMult = clamp(c.trafficSpeedMult, 0.6, Math.min(1.6, crossMax));
        c.trafficSpawnMult = clamp(c.trafficSpawnMult, 0.5, 2.5);
        c.cabinetOnChance  = clamp(c.cabinetOnChance, 0, 0.9);     // sähkökaappi päällä
        c.startBurgers     = clamp(c.startBurgers, 2, 10);        // ehdoton
        c.startCoins       = clamp(c.startCoins, 1, 100);
        c.hungerWakeGrace  = clamp(c.hungerWakeGrace, 600, 1800);
        c.burgerInterval   = Math.max(c.burgerInterval, burgerIntervalMin(c, C));  // 🍔-tahti
        c.fogAlpha         = clamp(c.fogAlpha, 0, 0.5);
        // K2 (kellon rytmit) + K6 (SFX) – v10.05
        c.dayFadeFrames    = clamp(c.dayFadeFrames, 300, 3000);
        c.nightFadeFrames  = clamp(c.nightFadeFrames, 300, 3000);
        c.cycleChangeDelayFrames = clamp(c.cycleChangeDelayFrames, 120, 1800);
        c.nightLampFirst   = clamp(c.nightLampFirst, 4, 90);
        c.nightLampInterval = clamp(c.nightLampInterval, 2, 60);
        c.spawnLampDelay   = clamp(c.spawnLampDelay, 0, 900);
        c.cabBlinkMin      = clamp(c.cabBlinkMin, 120, 1200);
        c.cabBlinkMax      = Math.max(clamp(c.cabBlinkMax, 120, 1200), c.cabBlinkMin + 50);
        c.cabRerollMin     = clamp(c.cabRerollMin, 300, 3600);
        c.cabRerollMax     = Math.max(clamp(c.cabRerollMax, 300, 3600), c.cabRerollMin + 50);
        c.mosquitoDayDim   = clamp(c.mosquitoDayDim, 0, 1);
        c.meteorTempoMult  = clamp(c.meteorTempoMult, 0.1, 5);
        c.sfxVolumeMult    = clamp(c.sfxVolumeMult, 0.3, 2.0);
        // Kaaos v10.18 – uudet akselit (visuaaliset/ei-tappavat → vain klampit, ei validointia)
        c.doorLockChance   = clamp(c.doorLockChance, 0, 1);
        c.staggerAmount    = clamp(c.staggerAmount, 0, 1);
        c.screenShakeAmount= clamp(c.screenShakeAmount, 0, 1);
        c.lampRedFlicker   = clamp(c.lampRedFlicker, 0, 0.05);
        c.barBurntLetter   = clamp(Math.round(c.barBurntLetter), -1, 2);
        c.cabFlicker       = clamp(c.cabFlicker, 0, 1);
        c.sunSizeMult      = clamp(c.sunSizeMult, 0.6, 2.0);
        return c;
    }

    // 5) Portti: hyväksyntä – hylkää epäreilu arpa (pääsääntö 2)
    function validateChaosCfg(cfg) {
        const C = chaosAbilityFor(cfg), errs = [];
        if (cfg.burgerInterval < burgerIntervalMin(cfg, C))     errs.push('burgerInterval < kaava');
        if (cfg.avengerSpeed > threatSpeedMax(C))               errs.push('avenger liian nopea');
        if (cfg.robberSpeed  > threatSpeedMax(C))               errs.push('robber liian nopea');
        if (cfg.avengerTelegraph < threatTelegraphMin(C))       errs.push('varoitus liian lyhyt');
        if (stunMaxOf(cfg) > 900)                               errs.push('tainnutus raja');
        if (cfg.startBurgers < 2 || cfg.startBurgers > 10)      errs.push('aloitus🍔 raja');
        if (threatBudget(cfg) > 3)                              errs.push('uhkabudjetti');
        if (cfg.fogAlpha > 0.5)                                 errs.push('sumu liian sakea');
        return errs;
    }

    // 6) FULL-arpa: enintään 40 yritystä, muuten turvallinen klampattu arpa (v10.04)
    function drawChaosCfg(level) {
        if (level !== 'full') {
            return clampChaosCfg(Object.assign({}, CHAOS_DEFAULTS2, chaosProfile(level)));
        }
        for (let i = 0; i < 40; i++) {
            const cfg = clampChaosCfg(Object.assign({}, CHAOS_DEFAULTS2, generateFullChaosSeed()));
            if (validateChaosCfg(cfg).length === 0) return cfg;
        }
        console.warn('[chaos] arpa hylättiin 40× – käytetään klampattua arpaa');
        return clampChaosCfg(Object.assign({}, CHAOS_DEFAULTS2, generateFullChaosSeed()));
    }


    /* ═══════════════════════════════════════════════════════════
       KAAOS K7 – tapahtumakortit (v10.05)
       v1 = vain visuaalisia. Kortit laukeavat itsestään kesken
       session ja palautuvat itsestään. Ei vahinkoa, ei taloutta,
       ei uutta tekstiä. NORMALissa pois päältä (bitti-identtinen).
       ═══════════════════════════════════════════════════════════ */
    const CARD_FIRST_DELAY = 3600;                       // 60 s ennen ensimmäistä korttia
    const CARD_GAP_MIN = 5400, CARD_GAP_MAX = 18000;     // 90–300 s korttien välillä
    let cardState = {
        enabled: false,
        timer: CARD_FIRST_DELAY,        // frameä seuraavaan korttiin
        left: 0,                        // kortteja jäljellä tässä sessiossa
        active: null,                   // { id, t, dur, saved, restore }
        meteorBurst: false,             // Tähtisade
        lightsOut: false,               // Valot sammuvat
        animalParade: 0                 // Eläinparaati: montako eläintä vielä
    };

    function chaosCardsReset() {
        cardState.enabled = (chaosLevel !== 'normal');
        cardState.timer = CARD_FIRST_DELAY;
        cardState.left = (chaosLevel === 'normal') ? 0 : (3 + Math.floor(chaosRng() * 4)); // 3–6
        cardState.active = null;
        cardState.meteorBurst = false;
        cardState.lightsOut = false;
        cardState.animalParade = 0;
    }

    // Korttidekit: save() kaappaa tilan, apply() aloittaa, restore(saved) palauttaa.
    function chaosCardDefs() {
        const skyPresets = [
            { sun: '#7dff7d', glow: ['rgba(120,255,120,0.55)','rgba(90,220,90,0.20)','rgba(70,180,70,0)'], top: '#2f5a2f', mid: '#4f7a4f', hor: '#7a9a6a' },
            { sun: '#d37dff', glow: ['rgba(200,140,255,0.55)','rgba(170,110,230,0.20)','rgba(140,90,190,0)'], top: '#4a2f5a', mid: '#6a4f7a', hor: '#8a6a9a' },
            { sun: '#ff4d4d', glow: ['rgba(255,100,100,0.55)','rgba(220,80,80,0.20)','rgba(180,60,60,0)'], top: '#5a2f2f', mid: '#7a4f4f', hor: '#9a6a6a' }
        ];
        return [
            {   // 1. Vihreä hetki ⭐ – auringon väri + taivaan sävy
                id: 'green', dur: [1200, 2400],
                save: () => ({ sun: sunColor, glow: sunGlow, top: DAY_SKY_TOP, mid: DAY_SKY_MID, hor: DAY_SKY_HORIZON }),
                apply: () => { const p = skyPresets[Math.floor(Math.random() * skyPresets.length)]; sunColor = p.sun; sunGlow = p.glow; DAY_SKY_TOP = p.top; DAY_SKY_MID = p.mid; DAY_SKY_HORIZON = p.hor; },
                restore: (s) => { sunColor = s.sun; sunGlow = s.glow; DAY_SKY_TOP = s.top; DAY_SKY_MID = s.mid; DAY_SKY_HORIZON = s.hor; }
            },
            {   // 2. Tähtisade – 30–60 tähdenlentoa lyhyessä ajassa
                id: 'meteor', dur: [360, 600],
                save: () => ({}),
                apply: () => { cardState.meteorBurst = true; },
                restore: () => { cardState.meteorBurst = false; }
            },
            {   // 3. Sumu nousee – sumuverho α 0.25–0.45
                id: 'fog', dur: [1800, 3600],
                save: () => ({ fog: fogAlpha }),
                apply: () => { fogAlpha = 0.25 + Math.random() * 0.20; },
                restore: (s) => { fogAlpha = s.fog; }
            },
            {   // 4. Tuulenpuuska – tuuli ×2–3, puut nojaavat
                id: 'gust', dur: [900, 1800],
                save: () => ({ wind: windSpeed }),
                apply: () => { windSpeed *= 2 + Math.random(); },
                restore: (s) => { windSpeed = s.wind; }
            },
            {   // 5. Valot sammuvat – lamput + ikkunat pimeiksi hetkeksi
                id: 'blackout', dur: [240, 480],
                save: () => ({}),
                apply: () => { cardState.lightsOut = true; },
                restore: () => { cardState.lightsOut = false; }
            },
            {   // 6. Kaikki ikkunat syttyvät – 8–12 ikkunaa kerralla (raja 12)
                id: 'windows', dur: [1200, 1800],
                save: () => ({}),
                apply: () => { cardFlashWindows(8 + Math.floor(Math.random() * 5)); },
                restore: () => {}
            },
            {   // 7. Eläinparaati – 3–5 eläintä peräkkäin
                id: 'parade', dur: [600, 1200],
                save: () => ({}),
                apply: () => { cardState.animalParade = 3 + Math.floor(Math.random() * 3); animalSpawnTimer = 0; },
                restore: () => { cardState.animalParade = 0; }
            },
            {   // 8. Värien vaihto – talojen paletti sekoittuu (pysyvä)
                id: 'palette', dur: [0, 0],
                save: () => ({}),
                apply: () => { buildingPalette = randomHuePalette(); randomizeBuildingColors(); },
                restore: () => {}
            },
            {   // 9. Taivaan vaihto – päivätaivas hetkeksi myrskyiseksi
                id: 'sky', dur: [1800, 3600],
                save: () => ({ top: DAY_SKY_TOP, mid: DAY_SKY_MID, hor: DAY_SKY_HORIZON }),
                apply: () => { DAY_SKY_TOP = '#3a4044'; DAY_SKY_MID = '#565e62'; DAY_SKY_HORIZON = '#6e6a5e'; },
                restore: (s) => { DAY_SKY_TOP = s.top; DAY_SKY_MID = s.mid; DAY_SKY_HORIZON = s.hor; }
            },
            {   // 10. Tähtitaivas täyteen – tähdet 80 → 140
                id: 'stars', dur: [1200, 2400],
                save: () => ({}),
                apply: () => { const add = Math.max(0, 140 - stars.length); for (let i = 0; i < add; i++) stars.push({ x: Math.random() * WORLD_W, y: Math.random() * (GROUND_Y - 30), r: (Math.random() * 1.5 + 0.5) * starSizeMult, blink: Math.random() * Math.PI * 2 }); },
                restore: () => { if (stars.length > starCount) stars.length = starCount; }
            }
        ];
    }

    function cardFlashWindows(count) {
        const avail = getAvailableWindows().filter(w =>
            !litWindows.some(l => l.wx === w.wx && l.wy === w.wy && l.bldgIdx === w.bldgIdx));
        const n = Math.max(0, Math.min(count, avail.length, 12 - litWindows.length));
        for (let i = 0; i < n; i++) {
            const w = avail[Math.floor(Math.random() * avail.length)];
            litWindows.push({ wx: w.wx, wy: w.wy, bldgIdx: w.bldgIdx, offTime: Date.now() + 15000, colorType: pickColorType() });
        }
    }

    function updateCards(dt) {
        if (!cardState.enabled) return;
        // Aktiivinen kortti käynnissä → tikitä ja palauta, kun aika täynnä
        if (cardState.active) {
            cardState.active.t += dt;
            if (cardState.active.t >= cardState.active.dur) {
                cardState.active.restore(cardState.active.saved);
                cardState.active = null;
                cardState.timer = CARD_GAP_MIN + Math.random() * (CARD_GAP_MAX - CARD_GAP_MIN);
            }
            return;
        }
        // Odotetaan seuraavaa korttia
        if (cardState.left <= 0) return;
        cardState.timer -= dt;
        if (cardState.timer <= 0) {
            const defs = chaosCardDefs();
            const d = defs[Math.floor(Math.random() * defs.length)];
            const dur = d.dur[0] + Math.random() * (d.dur[1] - d.dur[0]);
            const saved = d.save();
            d.apply();
            cardState.active = { id: d.id, t: 0, dur: dur, saved: saved, restore: d.restore };
            cardState.left--;
        }
    }

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        // Pikseliterävyys: ei pehmennystä skaalattaessa (sprite-piirto)
        ctx.imageSmoothingEnabled = false;
        randomizeBuildingColors();  // arvo taloille uudet sävyt joka kerta
        state = GameState.load();
        /* Onko kyseessä aivan uusi peli (0-tila)? Kuun kello (moonClock)
           jätetään vertailusta pois: se tallentuu itsestään heti yön alettua,
           eikä sen kuulu sammuttaa aloitusohjetta. Sama auringon kellolle. */
        const progressState = Object.assign({}, state);
        delete progressState.moonClock;
        delete progressState.sunClock;
        const freshGame = (JSON.stringify(progressState) === JSON.stringify(GameState.defaultState));
        // Kaaos K4 (v10.04): uuden pelin syntymäpaketti kaaosakselina
        // (aloituskolikot · aloitus🍔 2–10). v10.32: aloituskolikot ovat FULLissa
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
            if (!lamps[i].baseShade) {
                const g = 35 + Math.random() * 30;  // 35–65 harmaan vaaleus
                // Kaaos K1 (v10.03): lampHueShift värjää tolpan sävyn (0 = harmaa, kuten ennen)
                lamps[i].baseShade = lampHueShift ? ('hsl(' + lampHueShift + ',22%,' + g + '%)') : ('hsl(0,0%,' + g + '%)');
                lamps[i].hatShade  = lampHueShift ? ('hsl(' + lampHueShift + ',22%,' + (g - 8) + '%)') : ('hsl(0,0%,' + (g - 8) + '%)');
            }
        }
        // Siivoa vanha 6 lampun tila localStorageen jääneestä tallennuksesta (v4.96)
        if (state.litLamps.length > lamps.length) {
            state.litLamps.length = lamps.length;
            GameState.save(state);
        }
        coin.collected = state.inventory.coin;
        coinCount = state.inventory.coinCount || 0;
        coinRespawnTimer = coin.collected ? 1 : 0;
        coin.despawnTimer = coin.collected ? 0 : 600;
        hamburgerCount = state.inventory.hamburgerCount || 5;
        hamburgerTimer = burgerInterval;
        if (coin.collected) { coin.x = -100; coin.y = -100; }
        else { coin.x = randomCoinX(); coin.y = randomCoinY(); }
        digKeyCollected = state.digKeyCollected || false;
        boulderKeyCollected = state.boulderKeyCollected || false;
        bmKeyCollected = state.bmKeyCollected || false;
        beamWeaponCollected = state.beamWeaponCollected || false;
        spawnBeamPickup();
        beamCooldownTimer = 0;   // v11.14: uusi peli ei ala keskeneräisellä lukolla
        /* Päivä/yö on tallennettu tila (state.isDay, v4.33):
             null  = ei vielä ratkaistu → 3 avainta nostaa päivän kerran
             true  = päivä, false = yö (makuuhuoneen Nuku-valinta)
           Valmiiksi läpäisty peli avautuu siis suoraan päivänä (v4.32-käytös),
           mutta nukkumalla tilan voi vaihtaa ja valinta pysyy tallessa. */
        if (state.isDay == null && !DAY_FORCE && allKeysCollected()) {
            state.isDay = true;
            GameState.save(state);
        }
        isDay = (state.isDay === true);
        dayT = dayTarget();
        /* Kuun paikka palautetaan tallennuksesta (v4.74): F5/reload ei palauta
           kuuta lähtöasemaan. Nollatila syntyy vain kun tallennus on tyhjä
           (kuolema / ✕ "aloita alusta") tai kun uusi yö alkaa Nukusta.
           Testityökalut ?day=0/1 näyttävät kuun lähtöasemasta kuten ennen. */
        applyMoonClock(DAY_FORCE ? 0 : (Number(state.moonClock) || 0));
        applySunClock(DAY_FORCE ? 0 : (Number(state.sunClock) || 0));
        spawnLampTimer = freshGame ? SPAWN_LAMP_DELAY : 0;  // 4 s → lamppushow vain uudessa pelissa (v4.90)
        /* Jukebox-soitto palautetaan tallennuksesta (v4.92): F5 ei katkaise soittoa. */
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
        initBackdrop();
        initForeground();
        rollManholeState();   // avoin kaivo: 1/6 (tai ?hole=0/1/2) – v4.51
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

        // Sädease (v10.20): PC = hiiri (tähtäys + klikkaus), mobiili = täppäys taivaalle
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
    let LAMP_RADIUS = 30;   // kaaos K1 (v10.03)
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

    /* ── Liikenne: ajoneuvojen liike, spawnit ja törmäys ──────────
       Kaksi ajorataa (LANE_DEFS). Päivällä liikennevirta tuplataan
       (v4.37): spawn-laskuri kuluu TRAFFIC_DAY_MULT-kertaista vauhtia ja
       kerroin liukuu dayT:n mukana (1 = yö, TRAFFIC_DAY_MULT = täysi päivä).
       Sama 1 ajoneuvo per kaista ja samat nopeudet/törmäykset kuin ennen.
       Palauttaa true, jos ajoneuvo osui pelaajaan tällä framella.
       HUOM (v4.54): liikenne pyörii myös sanomalehteä lukiessa → kadulla
       voi jäädä auton alle kesken lukemisen (lehti putoaa kädestä).
       HUOM (v4.61): liikenne pyörii myös jukebox-huoneessa. Siellä pelaaja
       on sisällä talossa → `playerSafe = true` ohittaa pelaajan
       törmäystestin, joten auto ei voi tainnuttaa kesken musiikin valinnan
       (muuten liike, spawnit ja äänet toimivat täsmälleen kuten kadulla).
       HUOM (v11.09): sama periaate BARissa, makuuhuoneessa (myös nukkumisen
       pimennyksen aikana) ja kaivoon putoamisen/kiipeämisen aikana
       (`mhAction`) → liike, spawnit ja moottoriäänet eivät enää jäädy
       näiden tilojen ajaksi. Ennen korjausta `v.x` seisoi, jolloin moottorin
       panorointi (lasketaan v.x:stä) jäi jumiin ja ajoneuvo palasi kadulle
       täsmälleen samasta kohdasta.
       HUOM (v11.10): sama periaate myös tainnutuksessa (`update()`in
       knockedDown-haara) – mutta VAIN jos kaataja ei ollut auto. Auton osuma
       on kolari, johon liikenne on osallisena → silloin liikenne seisoo koko
       tainnutuksen ajan (`player.knockFallY` asetetaan vain tässä funktiossa,
       joten se toimii merkkinä auton osumasta).
       `PLAYER_DEPTH_MAX_Y` (WORLD_H - 50 = 350) on sama raja kuin
       update()in paikallinen PLAYER_Y_MAX (aidan yläreuna). */
    function updateTraffic(dt, playerSafe) {
        let playerHit = false;

        // 1) Liike ja spawnit
        for (let li = 0; li < LANE_DEFS.length; li++) {
            const lane = LANE_DEFS[li];
            if (!vehicles[li]) {
                spawnTimers[li] -= dt * (1 + (TRAFFIC_DAY_MULT - 1) * dayT);
                if (spawnTimers[li] <= 0) {
                    const dir = lane.direction;
                    const vehRnd = Math.random();
                    let type, w, h, speed;
                    if (vehRnd < 0.37) {
                        type = 'car'; w = 80; h = 30; speed = (1.0 + Math.random() * 0.5) * trafficSpeedMult;
                    } else if (vehRnd < 0.74) {
                        type = 'motorcycle'; w = 40; h = 22; speed = (1.5 + Math.random() * 1.0) * trafficSpeedMult;
                    } else if (vehRnd < 0.98) {
                        type = 'ambulance'; w = 80; h = 34; speed = (1.8 + Math.random() * 1.2) * trafficSpeedMult;
                    } else {
                        // Panssarivaunu on tarkoituksella todella harvinainen: ~2 %
                        // (1/50) spawnauksista. Muu liikenne: auto 37 %, mopo 37 %,
                        // ambulanssi 24 %. (Aiempi vaunun osuus oli 8 %.)
                        type = 'tank'; w = 86; h = 36; speed = (0.4 + Math.random() * 0.4) * trafficSpeedMult;
                    }
                    const vehicle = {
                        type,
                        x: dir > 0 ? -w : WORLD_W + w,
                        y: lane.y,
                        w, h,
                        vx: dir * speed,
                        direction: dir,
                        hasHeadlight: (type === 'tank') ? false : (type !== 'motorcycle' || Math.random() < 0.5)
                    };
                    vehicle.engine = startVehicleEngine(vehicle);
                    vehicles[li] = vehicle;
                    spawnTimers[li] = (1200 + Math.random() * 1200) * trafficSpawnMult; // 20–40s (kaaos: tiheys)
                }
            } else {
                const v = vehicles[li];
                v.x += v.vx * dt;
                updateVehicleEngine(v.engine, v);
                if ((v.direction > 0 && v.x > WORLD_W + v.w + 10) || (v.direction < 0 && v.x < -v.w - 10)) {
                    stopVehicleEngine(v.engine);
                    vehicles[li] = null;
                }
            }
        }

        // 2) Törmäys (molemmat kaistat) – ohitetaan, kun pelaaja on sisällä
        if (!playerSafe && !player.knockedDown) {
            const playerCY = player.y + player.h / 2;
            const gapCenter = (LANE_DEFS[0].y + LANE_DEFS[1].y) / 2;  // 334
            const inGap = Math.abs(playerCY - gapCenter) < 5;          // ±5px turvakaista

            // Kumman kaistan auton kanssa pelaaja on enemmän limittäin?
            const CAR_H = 30; // tyypillinen auton korkeus
            const pTop = player.y, pBot = player.y + player.h;
            const ov0 = Math.max(0, Math.min(pBot, LANE_DEFS[0].y + CAR_H) - Math.max(pTop, LANE_DEFS[0].y));
            const ov1 = Math.max(0, Math.min(pBot, LANE_DEFS[1].y + CAR_H) - Math.max(pTop, LANE_DEFS[1].y));

            for (let li = 0; li < LANE_DEFS.length; li++) {
                const v = vehicles[li];
                if (!v) continue;

                // Pelaaja teräsaidan juuressa → ei kumpikaan kaista osu
                if (player.y >= PLAYER_DEPTH_MAX_Y - 3) continue;

                // Pelaaja kaistojen välisessä raossa → ei osumaa
                if (inGap) continue;

                // Pelaaja on vain lähimmällä kaistalla – kauemman kaistan autot menevät ohi
                if (li === 0 && ov1 > ov0) continue;
                if (li === 1 && ov0 > ov1) continue;

                const vCollisionTop = v.y + v.h * 0.5;
                if (v.x < player.x + player.w && v.x + v.w > player.x &&
                    player.y + player.h > vCollisionTop && player.y < v.y + v.h) {
                    player.knockedDown = true;
                    player.knockdownTimer = 600;
                    player.kicking = false;
                    player.kickFrame = 0;
                    // Kaadutaan 25 px ylös osumakohdasta (v4.78: 10 px, v11.12: 25 px,
                    // jotta pysähtynyt auto ei osu heti uudelleen ylösnoustessa) – muuten
                    // pelaaja jää makaamaan keskelle tietä ja autot kolarijatkuvat
                    // katkeamatta päältä
                    player.knockFallY = player.y + player.h - 25;
                    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ffaa44', 15);
                    playKnock();   // "Smack"-tömähdys
                    vehicleShakeTimer = 90;  // ~1.5s tärinä
                    hamburgerCount--;
                    state.inventory.hamburgerCount = hamburgerCount;
                    GameState.save(state);
                    updateHUD();
                    playerHit = true;
                    if (hamburgerCount <= 0) { killPlayer(); }
                    break;
                }
            }
        }

        return playerHit;
    }

    function update(dt) {
        // Ajoneuvon törmäyksen tärinä (vain visuaalinen – ei jäädytä pelilogiikkaa)
        if  (vehicleShakeTimer > 0) { vehicleShakeTimer -= dt; }
        if (meteorShakeTimer > 0) { meteorShakeTimer -= dt; }
        if (beamFireTimer > 0) { beamFireTimer -= dt; }
        if (beamCooldownTimer > 0) { beamCooldownTimer -= dt; }   // v11.14: laukaisuväli
        if (meteorFlash) { meteorFlash.t -= dt; if (meteorFlash.t <= 0) meteorFlash = null; }

        // ── Hit pause: maailma jäätyy 2  frameä osumasta (render jatkaa) ──
        if (hitPauseTimer > 0) { hitPauseTimer -= dt; return; }

        // Animaatiokello (hengitys, silmän vilkahdus)
        animClock += dt;

        // ── Päivä/yö: liuku kohti tallennettua tavoitetta ──
        // Ensiauringonnousu (v4.32-käytös): kun kaikki 3 avainta on koossa eikä
        // tilaa ole vielä ratkaistu, kadulle nousee päivä kerran. Sen jälkeen
        // tila on tallennettu (state.isDay) ja makuuhuoneen Nuku-valinta
        // vaihtaa sitä vapaasti (päivä ⇄ yö).
        if (state.isDay == null && !DAY_FORCE && allKeysCollected()) {
            state.isDay = true;
            isDay = true;
            GameState.save(state);
        }
        // Liuku pysäytetään, kunnes pelaaja on taas kadulla: avain saadaan
        // alapelistä (iframe) ja huoneista → muutos näkyy kadulle palatessa
        // eikä jää taustalla näkymättömiin (myös lehteä lukiessa, v4.53).
        const dayWanted = dayTarget();
        if (dayT !== dayWanted && !iframeOpen && !sleepRoom && !barRoom &&
            !jukeboxRoom && !newsRoom) {
            const fadeFrames = (dayWanted > dayT) ? DAY_FADE_FRAMES : NIGHT_FADE_FRAMES;
            const step = DAY_DEBUG ? 1 : dt / fadeFrames;
            if (dayWanted > dayT) {
                const wasNight = dayT === 0;
                dayT = Math.min(1, dayT + step);
                if (wasNight) { shootingStar = null; satellite = null; }
            } else {
                dayT = Math.max(0, dayT - step);
            }
            if (Math.abs(dayWanted - dayT) < step) dayT = dayWanted;  // ei jää värähtelyä
        }

        // Päivänvalo on näkynyt tässä istunnossa → yön lamppushow saa laueta
        // (v4.42). Näin efekti ei laukea pelkästä sivunlatauksesta yöllä.
        if (dayT > 0) nightShowArmed = true;

        // ── Päivä sammuttaa katuvalot kerran (v4.38) ──
        // Kynnys on täysi päivä (dayT === 1): hehku on siihen mennessä jo
        // hiipunut LAMP_DAY_DIM:iin, joten sammutus ei poksahda silmään.
        // Lippu nollautuu vasta kun yö on palannut → kerran per auringonnousu.
        // Lampun voi silti potkaista päälle myös päivällä (lit = true).
        if (dayT === 1) {
            if (!dayLampsOff) {
                dayLampsOff = true;
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
        } else if (dayT === 0) {
            dayLampsOff = false;
            // Yö laskeutui täyteen → katuvalot syttyvät itsestään yksi
            // kerrallaan (v4.42), mutta vain kun pelaaja on jo edennyt
            // (päivä/yö ratkaistu). Uudessa pelissä valot potkitaan yhä itse.
            if (nightShowArmed && nightLampsAllowed()) {
                nightShowArmed = false;
                startNightLampShow();
            }
            // Näytös etenee vain kadulla: huoneet ja iframet pysäyttävät
            // ajastimen (kuten päivän liukukin), ja tila tallennetaan per
            // lamppu, jotta reload kesken shown ei hukkaa jo syttyneitä.
            // HUOM: kickCount ei kasva → cheatit ja ylikuumeneminen ennallaan.
            if (nightShowQueue.length && !iframeOpen && !sleepRoom && !barRoom &&
                !jukeboxRoom && !playerDead) {
                nightShowTimer -= dt;
                if (nightShowTimer <= 0) {
                    const i = nightShowQueue.shift();
                    lamps[i].lit = true;
                    state.litLamps[i] = true;
                    GameState.save(state);
                    spawnParticles(lamps[i].x, GROUND_Y + 19 - LAMP_POST_H, '#ffff88', 8);
                    playLampOn();
                    nightShowTimer = NIGHT_LAMP_INTERVAL;
                }
            }
        }

        // ── Spawn-lamppushow (v4.90): pelin alussa/kuoleman jälkeen 4 s → lamput syttyvät ──
        // Käyttää samaa startNightLampShow()-mekaniikkaa kuin yön tullessa.
        if (spawnLampTimer > 0 && !isDay && !playerDead && !iframeOpen && !sleepRoom && !barRoom && !jukeboxRoom) {
            spawnLampTimer -= dt;
            if (spawnLampTimer <= 0) {
                startNightLampShow();                    // sytytä lamput yksi kerrallaan
            }
        }

        // ── Jukebox-soiton tallennus (v4.92): seuraa positiota ja päivitä state F5:n yli ──
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

        // ── Yö/päivä -kierto (v4.89): kuu liukuu yöllä, aurinko päivällä ──
        // Kun kuu/aurinko on kadonnut, odotetaan CYCLE_CHANGE_DELAY_FRAMES
        // (15 s) ja vaihdetaan automaattisesti seuraavaan vuorokaudenaikaan.
        // Kellot tallennetaan ~2 s välein, jotta F5 jatkaa samasta kohdasta.
        if (!isDay) {
            if (moonNightClock < MOON_NIGHT_FRAMES) {
                applyMoonClock(moonNightClock + dt);
                if (moonNightClock >= MOON_NIGHT_FRAMES) {
                    cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES;  // aloita 15 s viive
                }
            } else {
                applyMoonClock(MOON_NIGHT_FRAMES);      // pysyy päätepisteessä
                cycleChangeTimer = Math.max(0, cycleChangeTimer - dt);
                if (cycleChangeTimer <= 0) {
                    isDay = true;
                    state.isDay = true;
                    GameState.save(state);
                    resetSun();
                    cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES + 1;  // nollaa tila
                }
            }
            moonSaveTimer += dt;
            if (moonSaveTimer >= MOON_SAVE_FRAMES) {
                moonSaveTimer = 0;
                saveMoonClock();
            }
        } else {
            moonDark = 0;
            if (sunDayClock < SUN_DAY_FRAMES) {
                applySunClock(sunDayClock + dt);
                if (sunDayClock >= SUN_DAY_FRAMES) {
                    cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES;  // aloita 15 s viive
                }
            } else {
                applySunClock(SUN_DAY_FRAMES);          // pysyy päätepisteessä
                cycleChangeTimer = Math.max(0, cycleChangeTimer - dt);
                if (cycleChangeTimer <= 0) {
                    isDay = false;
                    state.isDay = false;
                    GameState.save(state);
                    resetMoon();
                    resetSun();
                    cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES + 1;  // nollaa tila
                }
            }
            sunSaveTimer += dt;
            if (sunSaveTimer >= SUN_SAVE_FRAMES) {
                sunSaveTimer = 0;
                saveSunClock();
            }
        }

        // ── Kuolemasekvenssi ─────────────────────────
        if (playerDead) {
            deathTimer -= dt;
            deathAlpha = Math.min(1, 1 - (deathTimer / 180));
            if (deathTimer <= 0) {
                clearChaosSession();   // kuolema vie takaisin alkuhubiin (kuten ennen)
                GameState.reset();
                location.reload();
            }
            return;
        }

        // ── Nälkä (hampurilaisajastin, 1/60s) ────────────────────────
        // Kulutus jatkuu kaikkialla kuten kadulla (v4.49): myös BAR:ssa,
        // jukeboxissa ja iframe-peleissä → pelaajan pitää aina huolehtia,
        // että 🍔 riittää. Jäissä vain nukkuessa (hungerOnHold, v4.41)
        // ja kuolleena (yllä oleva return).
        // Nälkäkuolema laukeaa myös huoneessa/pelissä (v4.50): huone tai
        // alapeli suljetaan ensin, jotta pelaaja romahtaa näkyvästi kadulle
        // eikä peli näytä nollautuvan kesken pelaamisen.
        // Tahti (burgerInterval, kaaos K4) ja katto 10.
        if (!hungerOnHold()) {
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
                return;
            }
        }

        // ── Paluu kadulle -vahti (v4.51): huone tai alapeli sulkeutui →
        //    1/10 mahdollisuus, että viemärinkannen tilanne muuttuu
        //    (kansi katoaa tai asennetaan takaisin paikalleen).
        trackHiddenStreet();

        // v10.12: rosvon elinikä kuluu myös piilossa (huone/alapeli), jotta
        // "piiloudu ja odota" -pakoreitti toimii kaikilla kaaostasoilla.
        if (robber && (iframeOpen || sleepRoom || barRoom || jukeboxRoom || newsRoom)) {
            if (robber.ttl !== undefined) {
                robber.ttl -= dt;
                if (robber.ttl <= 0) robber = null;
            }
        }

        // ── Avoin kaivo: pudotus / ylöskiipeäminen käynnissä (v4.51) ──
        // Katu on jäissä sekvenssin ajan (kuten nukkumisen pimennys).
        // LIIKENNE EI PYSÄHDY (v11.09): sama periaate kuin jukebox-huoneessa
        // (v4.61) – autot ajavat taustalla, jotta yksikään ajoneuvo ei jää
        // jyrräämään paikalleen (moottoriäänen panorointi seuraa v.x:ää).
        // Pelaaja on reiässä (kadun ulkopuolella) → playerSafe = true:
        // ei törmäystä, ei tainnutusta eikä 🍔-menetystä kesken sekvenssin.
        if (mhAction) { updateTraffic(dt, true); updateManholeAction(dt); return; }

        // ── Makuuhuone (ex-palkintohuone, talo 7) ──
        //   ▲ / W = Nuku     ▼ / S = Poistu   (valinta liikkuu reunoilla)
        //   (o) / Space / Enter / ⚡ = vahvista valinta
        //   Poistuminen ilman nukkumista ei muuta päivä/yö-tilaa mihinkään.
        //   Nuku → pimennys (SLEEP_FADE_FRAMES) → tila vaihtuu → takaisin kadulle.
        if (sleepRoom) {
            /* LIIKENNE EI PYSÄHDY (v11.09): kadun autot ajavat taustalla myös
               makuuhuoneessa ja nukkumisen pimennyksen aikana – sama periaate
               kuin jukebox-huoneessa (v4.61). Muuten ajoneuvo jäisi jyrräämään
               paikalleen (moottoriäänen panorointi seuraa v.x:ää) ja palaisi
               kadulle täsmälleen samasta kohdasta. Pelaaja on sisällä talossa
               → `playerSafe = true` (ei törmäystä, ei tainnutusta eikä
               🍔-menetystä). Ei talousmuutoksia. */
            updateTraffic(dt, true);

            // Nukkumisen pimennys: tila vaihtuu vasta pimennyksen lopussa
            if (sleepPhase > 0) {
                sleepPhase -= dt;
                if (sleepPhase <= 0) {
                    sleepPhase = 0;
                    // Tila vaihtuu siitä, miltä katu parhaillaan näyttää
                    // (toimii myös keskellä hämärtymistä ja ?day-testityökalulla)
                    isDay = !(dayT >= 0.5);        // päivä → yö  TAI  yö → päivä
                    // Uusi yö → kuu nousee uudelleen vasemmalta (v4.65), ei arvota.
                    cycleChangeTimer = CYCLE_CHANGE_DELAY_FRAMES + 1;  // uusi jakso alkaa (v4.89)
                    if (!isDay) resetMoon();
                    if (isDay) resetSun();              // aurinko alkuun (v4.89)
                    if (!DAY_FORCE) {              // testityökalut eivät tallenna
                        state.isDay = isDay;
                        GameState.save(state);
                    }
                    // +1 🍔 nukkumisesta (v4.44, käyttäjän pyyntö 21.9.2026)
                    if (!DAY_FORCE && hamburgerCount < 10) {
                        hamburgerCount++;
                        state.inventory.hamburgerCount = hamburgerCount;
                        GameState.save(state);
                    }
                    // Herätysrauha (v4.41): ajastin jatkuu siitä mihin se jäi,
                    // mutta vähintään HUNGER_WAKE_GRACE-verran – muuten 1 🍔:lla
                    // nukkunut voisi kuolla heti herätessään.
                    hamburgerTimer = Math.max(hamburgerTimer, HUNGER_WAKE_GRACE);
                    sleepRoom = false;
                    sleepSel = 0;
                    sleepHeldUp = false;
                    sleepHeldDown = false;
                    updateHUD();
                }
                actionJustPressed = false;
                return;
            }

            const selUp = !!(keys['ArrowUp'] || keys['w'] || keys['W']);
            const selDown = !!(keys['ArrowDown'] || keys['s'] || keys['S']);
            if (selUp && !sleepHeldUp) sleepSel = Math.max(0, sleepSel - 1);
            if (selDown && !sleepHeldDown) sleepSel = Math.min(1, sleepSel + 1);
            sleepHeldUp = selUp;
            sleepHeldDown = selDown;

            if (actionJustPressed) {
                if (sleepSel === 0) {
                    sleepPhase = SLEEP_FADE_FRAMES;   // nukahdus käynnissä
                } else {
                    // Poistu: ei muutosta päivä/yö-tilaan
                    sleepRoom = false;
                    sleepSel = 0;
                    sleepHeldUp = false;
                    sleepHeldDown = false;
                }
            }
            actionJustPressed = false;
            return;
        }

        // BAR room – ostomäärää säädetään nuolilla, poistuminen toimintonapista
        //   ▲ / W = osta 1 hampurilainen (1 kolikko)      ▼ / S = peru viimeisin osto
        //   (o) / Space / Enter = poistu
        if (barRoom) {
            /* LIIKENNE EI PYSÄHDY (v11.09): sama periaate kuin jukebox-huoneessa
               (v4.61) – kadun autot ajavat taustalla normaalisti, jotta
               yksikään ajoneuvo ei jää jyrräämään paikalleen (moottoriäänen
               panorointi seuraa v.x:ää) eikä palaa kadulle samasta kohdasta.
               Pelaaja on sisällä talossa → `playerSafe = true` (ei törmäystä,
               ei tainnutusta eikä 🍔-menetystä kesken ostosten). Ei
               talousmuutoksia (ostot ja hinnat ennallaan). */
            updateTraffic(dt, true);

            const buyUp = !!(keys['ArrowUp'] || keys['w'] || keys['W']);
            const buyDown = !!(keys['ArrowDown'] || keys['s'] || keys['S']);

            if (buyUp && !barBuyHeldUp && coinCount > 0 && hamburgerCount < 10) {
                hamburgerCount++;
                coinCount--;
                barBuyQty++;
                state.inventory.hamburgerCount = hamburgerCount;
                state.inventory.coinCount = coinCount;
                GameState.save(state);
                updateHUD();
                playCoin();
            }
            if (buyDown && !barBuyHeldDown && barBuyQty > 0) {
                hamburgerCount--;
                coinCount++;
                barBuyQty--;
                state.inventory.hamburgerCount = hamburgerCount;
                state.inventory.coinCount = coinCount;
                GameState.save(state);
                updateHUD();
                playCoin();
            }
            barBuyHeldUp = buyUp;
            barBuyHeldDown = buyDown;

            if (actionJustPressed) {
                barRoom = false;
                barBuyQty = 0;
                barBuyHeldUp = false;
                barBuyHeldDown = false;
            }
            actionJustPressed = false;
            return;
        }

        // JUKEBOX-huone (talo 5) – monivalinta (v4.46)
        //   ▲ / W = kursori ylös   ▼ / S = kursori alas (0 = Poistu-rivi, 1..N = kappale)
        //   (o) / Space / ⚡ = ota kappale listalle tai poista se
        //   (o) / Space / ⚡ rivillä 0 = soita valitut & poistu
        //   Enter = soita valitut & poistu mistä tahansa
        //   Kun jono soi (valinta vapaana) Space/(o)/⚡ lisää jonoon, Enter = lisää & poistu
        //   Ei valintoja → poistuminen ei veloita eikä soita mitään
        //   Valitut soitetaan poistuttaessa yksi kerrallaan (1 → N), 1 🪙 / kappale
        if (jukeboxRoom) {
            /* Liikenne ei pysähdy (v4.61): kadun autot ajavat taustalla
               normaalisti, jotta yksikään ajoneuvo ei jää jyrräämään
               paikalleen huoneeseen mentäessä. Pelaaja on sisällä talossa →
               `playerSafe = true` (ei törmäystestiä, ei tainnutusta eikä
               🍔-menetystä kesken musiikin valinnan). Ei talousmuutoksia
               (sääntö 04); nälkä kuluu kuten ennenkin (v4.49/v4.50). */
            updateTraffic(dt, true);

            const selUp = !!(keys['ArrowUp'] || keys['w'] || keys['W']);
            const selDown = !!(keys['ArrowDown'] || keys['s'] || keys['S']);
            const trackCount = JUKEBOX_TRACKS.length;
            // Space ja ⚡ asettavat saman keyn (' ') → sama reuna molemmille
            const toggleDown = !!(keys[' '] || keys['o'] || keys['O']);
            const enterDown = !!keys['Enter'];

            // Kursori aina vapaana (v4.99): valinta onnistuu myös soiton aikana,
            // jolloin uudet valinnat lisätään soivan jonon perään.
            if (selUp && !jukeHeldUp) jukeSel = Math.max(0, jukeSel - 1);
            if (selDown && !jukeHeldDown) jukeSel = Math.min(trackCount, jukeSel + 1);
            jukeHeldUp = selUp;
            jukeHeldDown = selDown;

            // Ota / poista kappale (rivi 0 = Poistu: lisää valinnat jonoon & poistu).
            // Soiton aikana Space/(o)/⚡ kappalerivillä togglaa valintaa (kuten normaalisti).
            if (toggleDown && !jukeSpaceHeld) {
                if (jukeSel === 0) jukeboxExitAndPlay();
                else jukePick[jukeSel - 1] = !jukePick[jukeSel - 1];
            }
            jukeSpaceHeld = toggleDown;

            // Enter: lisää valinnat jonoon & poistu mistä tahansa riviltä
            if (enterDown && !jukeEnterHeld) jukeboxExitAndPlay();
            jukeEnterHeld = enterDown;

            actionJustPressed = false;
            return;
        }

        // SANOMALEHTI (v4.53/v4.54) – sivuttain selattava ohjelehti
        //   ▲ / ▼ = edellinen / seuraava sivu (ei kierrä yli)
        //   Space (⚡) = seuraava sivu; viimeisellä sivulla poistuu kadulle
        //   (o) / Enter = poistu heti      ✕-nappi = sulje (closeRoom)
        //   Ilmainen eikä muuta taloutta; nälkä kuluu kuten huoneissa.
        //   LIIKENNE EI PYSÄHDY (v4.54): auto voi ajaa yli kesken lukemisen
        //   → lehti putoaa kädestä ja pelaaja kaatuu kadulle (tainnutus +
        //   −1 🍔 kuten muutenkin; 0 🍔 = kuolema). Turvassa ovat kaistojen
        //   välinen rako sekä aivan aidan juuri – samat rajat kuin ennen.
        if (newsRoom) {
            if (updateTraffic(dt)) {
                closeNewspaper();          // lehti lentää kädestä
                actionJustPressed = false;
                return;
            }

            const L = newsLayout();
            const lastIdx = Math.max(0, L.screens.length - 1);
            const selUp = !!(keys['ArrowUp'] || keys['w'] || keys['W']);
            const selDown = !!(keys['ArrowDown'] || keys['s'] || keys['S']);
            if (selUp && !newsHeldUp) newsScreen = Math.max(0, newsScreen - 1);
            if (selDown && !newsHeldDown) newsScreen = Math.min(lastIdx, newsScreen + 1);
            newsHeldUp = selUp;
            newsHeldDown = selDown;

            const nextDown = !!keys[' '];
            if (nextDown && !newsSpaceHeld) {
                if (newsScreen < lastIdx) newsScreen++;
                else closeNewspaper();           // viimeinen sivu → takaisin kadulle
            }
            newsSpaceHeld = nextDown;

            const exitDown = !!(keys['o'] || keys['O'] || keys['Enter']);
            if (exitDown && !newsExitHeld) closeNewspaper();
            newsExitHeld = exitDown;

            actionJustPressed = false;
            return;
        }

        updateClouds(dt);
        updateForeground(dt);

        // Tainnutus - kukkaruukku osui
        if (player.knockedDown) {
            // LIIKENNE EI PYSÄHDY (v11.10): tainnutus jäädyttää kadun, mutta
            // liikenne jatkaa – paitsi jos kaataja oli auto. Vain auton osuma
            // on kolari, johon liikenne on osallisena (`player.knockFallY`
            // asetetaan ainoastaan updateTrafficin törmäyksessä) → silloin
            // liikenne seisoo koko tainnutuksen ajan, kuten ennenkin.
            // Sähkökaappi, rosvo, kukkaruukku, lamppu ja oviukko eivät
            // pysäytä liikennettä. `playerSafe = true`: makaavaan pelaajaan
            // ei tule uutta osumaa (ei toistuvaa 🍔-menetystä).
            if (player.knockFallY === undefined) updateTraffic(dt, true);
            player.knockdownTimer -= dt;
            // Putoamistaso: auton osuma kaataa 25 px ylös osumakohdasta (v4.78: 10,
            // v11.12: 25 px – pysähtynyt auto ei osu heti uudelleen ylösnoustessa);
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
            return;
        }

        // ── Liike ──────────────────────────────────
        /* Vauhti riippuu 🍔-määrästä (hungerSpeedMult) ja kaaos-kävelynopeudesta
           (playerSpeedMult, K4): chaosAbility() = molemmat kerrointa. PLAYER_SPEED
           (1.225) on normitaso. NORMALissa playerSpeedMult = 1 → muutos on no-op. */
        const speedMult = chaosAbility();
        StreetAudio.setHungerTempo(hungerSpeedMult());   // syntikkatempo pysyy 🍔-sidonnaisena (v4.94)
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

        // Hoipertelu (kaaos K4 v10.18, vain BAD/FULL): normaali vauhti, mutta
        // juopunut sivuttais-/pystyvärähtely → voi ajautua auton alle / kaappiin.
        if (staggerAmount > 0 && (moveX !== 0 || moveY !== 0)) {
            const t = Date.now() * 0.001;
            player.x += Math.sin(t * 2.1) * staggerAmount * 0.6 * dt;
            player.y += Math.sin(t * 1.5 + 0.8) * staggerAmount * 0.45 * dt;
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
                coinRespawnTimer = COIN_RESPAWN_FRAMES;  // 120s @ 60fps (kaaos: väli)
                spawnParticles(cx, cy, '#ffd700', 12);
                updateHUD();
            }
        }

        // ── Sädeaseen poiminta (v10.20) ──────────────
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

        // ── Kolikon respawn (120s välein) ──────
        if (coin.collected && coinRespawnTimer > 0) {
            coinRespawnTimer -= dt;
            if (coinRespawnTimer <= 0) {
                coin.collected = false;
                coin.x = randomCoinX(); coin.y = randomCoinY();
                coin.despawnTimer = 600;  // 10s katoamisajastin
                coinRespawnTimer = 0;
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

        // ── Avoin kaivo: astuminen reiän päälle (v4.51) ─────────────
        // Reunaehtoinen: putoaminen laukeaa vain kun jalkapiste siirtyy
        // ellipsin sisään. Jos kansi katoaa jalkojen alta (paluu huoneesta),
        // putoaminen ei laukea ennen kuin pelaaja astuu pois ja takaisin.
        if (manholeOpen != null && !iframeOpen && !player.knockedDown) {
            const inside = manholeHit(manholeOpen);
            if (inside && !mhInside[manholeOpen]) {
                startManholeFall(manholeOpen);
                return;
            }
            mhInside[manholeOpen] = inside;
        }

        // ── Sähkökaapit: tilakello (v4.85) ────────────────
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
                hamburgerCount--;
                state.inventory.hamburgerCount = hamburgerCount;
                GameState.save(state);
                updateHUD();
                if (hamburgerCount <= 0) {
                    killPlayer();
                }
            }
        }

        // HUOM (v4.49): hampurilaisajastin siirrettiin update():n alkuun
        // (kuolemasekvenssin jälkeen) → kulutus jatkuu myös BAR:ssa,
        // jukeboxissa ja iframe-peleissä eikä pysähdy huoneisiin.

        // ── Toiminto ────────────────────────────────
        if (actionJustPressed) handleAction();

        // ── Partikkelit ─────────────────────────────
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            if (p.life <= 0) particles.splice(i, 1);
        }

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

        // ── Kukkaruukun fysiikka ──────────────────────
        if (flowerPot && flowerPot.active) {
            flowerPot.vy += 0.12 * dt; flowerPot.x += flowerPot.vx * dt; flowerPot.y += flowerPot.vy * dt; flowerPot.rotation += 0.08 * dt;
            const fpx = flowerPot.x, fpy = flowerPot.y, ppx = player.x + player.w/2, ppy = player.y;
            if (Math.sqrt((fpx-ppx)*(fpx-ppx)+(fpy-ppy)*(fpy-ppy)) < 20) {
                if (!player.knockedDown) {
                    player.knockedDown = true; player.knockdownTimer = 600; player.kicking = false; player.kickFrame = 0;
                    hamburgerCount--;
                    state.inventory.hamburgerCount = hamburgerCount;
                    GameState.save(state);
                    updateHUD();
                    if (hamburgerCount <= 0) { killPlayer(); }
                }
                spawnParticles(ppx, ppy, '#ff6644', 15); flowerPot = null;
            } else if (flowerPot.y > GROUND_Y + 20 || flowerPot.x < -30 || flowerPot.x > WORLD_W + 30) {
                if (flowerPot.y > GROUND_Y) spawnParticles(flowerPot.x, GROUND_Y, '#8B4513', 5);
                flowerPot = null;
            }
        }

        // ── Potkusta pudonneen kolikon fysiikka ──────
        if (kickCoinCooldown > 0) kickCoinCooldown -= dt;
        // Salainen kolikkopalkkio: putken vanheneminen + cooldown
        if (coinCheatGapTimer > 0) { coinCheatGapTimer -= dt; if (coinCheatGapTimer <= 0) { coinCheatGapTimer = 0; coinCheatStreak = 0; } }
        if (coinCheatCooldown > 0) { coinCheatCooldown -= dt; if (coinCheatCooldown < 0) coinCheatCooldown = 0; }
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

        // ── Oviukko (Avenger) ────────────────────────
        if (avengerCooldown > 0) avengerCooldown -= dt;
        updateAvenger(dt);

        // ── Rosvo: yllätys + kiinniotto (v4.66) ──
        if (robberCooldown > 0) robberCooldown -= dt;
        updateRobber(dt);

        // ── K7-korttipakka (v10.05): laukaisee/palauttaa visuaaliset kortit ──
        updateCards(dt);

        // ── Katueläin ────────────────────────────────
        if (!groundAnimal) {
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
                if (cardState.animalParade > 0) { cardState.animalParade--; animalSpawnTimer = 60; }
                else animalSpawnTimer = 900;
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

        // ── Ajoneuvot: liike, spawnit ja törmäys ──────────
        //    Siirretty omaan funktioonsa (v4.54), jotta sama liikenne
        //    pyörii myös sanomalehteä lukiessa (ks. newsRoom-haara yllä).
        updateTraffic(dt);

        // ── Tähdenlento + satelliitti (vain yöllä) ────
        // Päivällä (dayT > 0) niitä ei enää spawnata; update() nollaa
        // kesken lennon olleet oliot päivän alkaessa.
        if (dayT <= 0) {
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

        // ── Päivälinnut (v5.00) ────────────
        if (isDay) {
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
                        // laukeaa ja uusi parvi alkaa spawnata (v5.02, bugikorjaus).
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

/* ── Toimintopainikkeen käsittely ──────────────── */
    function handleAction() {
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;

        // 0. SANOMALEHTI (v4.53) – kadulla lojuva lehti: poimimalla aukeaa
        //    peliohjeet. Ilmainen eikä vaikuta talouteen (sääntö 04).
        //    Lehti on sijoitettu kauas ovista ja lampuista, joten tämä
        //    tarkistus ei varasta minkään muun kohteen toimintoa.
        //    Tainnutettuna lehteä ei voi poimia (v4.54).
        if (!player.knockedDown && nearNewspaper()) { openNewspaper(); return; }

        // 0. HEDELMÄPELI (talo 7, buildings[6], x 560–610) – ei lamppua eikä avainta,
        //    mutta auki vain öisin (v4.34)
        const fruitDoor = doorCenter(buildings[6]);
        const fdx = px - fruitDoor.x, fdy = py - fruitDoor.y;
        if (Math.sqrt(fdx * fdx + fdy * fdy) < DOOR_RADIUS) {
            if (nightOnlyClosed()) { showNotification(CLOSED_SIGN); return; }
            if (doorLocked()) return;                       // kaaos v10.18: ovi satunnaisesti lukossa (ei ilmoitusta)
            enterGame('fruitgame/game_main.html');
            return;
        }

        // 0.5 JUKEBOX (talo 5, buildings[4], ovi x 410) – auki vain öisin (v4.34);
        //     yöllä ovi aukeaa vasta kun talon ikkunat palavat
        //     (1. painallus ovella = potku → valot syttyvät 20 s)
        const jkDoor = doorCenter(buildings[JUKEBOX_BLDG_IDX]);
        const jkLights = smallHouseLights[JUKEBOX_BLDG_IDX];
        const jkdx = px - jkDoor.x, jkdy = py - jkDoor.y;
        const jkInReach = Math.sqrt(jkdx * jkdx + jkdy * jkdy) < DOOR_RADIUS;
        if (jkInReach && nightOnlyClosed()) { showNotification(CLOSED_SIGN); return; }
        if (jkLights && jkLights.lit && jkInReach) {
            if (doorLocked()) return;                       // kaaos v10.18: ovi satunnaisesti lukossa (ei ilmoitusta)
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
            return;
        }

        // 0.6 LAIVANUPOTUS (talo 2, buildings[2]) – aina auki yöllä ja päivällä;
        //     1. painallus ovella = potku → valot syttyvät 20 s
        //     2. painallus valaistulla ovella = Laivanupotus aukeaa
        const ssDoor = doorCenter(buildings[SINKSHIP_BLDG_IDX]);
        const ssLights = smallHouseLights[SINKSHIP_BLDG_IDX];
        const ssdx = px - ssDoor.x, ssdy = py - ssDoor.y;
        const ssInReach = Math.sqrt(ssdx * ssdx + ssdy * ssdy) < DOOR_RADIUS;
        if (ssLights && ssLights.lit && ssInReach) {
            enterGame('sinkship/game_main.html');
            return;
        }

        // 1. OVET ENSIN – ei potkua, kävellään suoraan sisään
        for (let i = 0; i < lamps.length; i++) {
            const lamp = lamps[i];
            const dc = doorCenter(buildings[lamp.bldgIdx]);
            const dx = px - dc.x, dy = py - dc.y;
            if (Math.sqrt(dx*dx + dy*dy) < DOOR_RADIUS) {
                // BAR – aina auki (talo 8, lamp[4])
                if (i === 4) {
                    barRoom = true;
                    barBuyQty = 0;
                    barBuyHeldUp = false;
                    barBuyHeldDown = false;
                    return;
                }
                // Makuuhuone (talo 7): ovi on aina auki – ei avaimia eikä
                // lamppua, päivällä ja yöllä (v4.43, kuten BAR).
                if (lamp.bldgIdx === SLEEP_BLDG_IDX) {
                    sleepRoom = true;
                    sleepSel = 0;
                    sleepHeldUp = false;
                    sleepHeldDown = false;
                    sleepPhase = 0;
                    return;
                }
                // Päivällä lamppua ei tarvita (v4.38): valoisa katu avaa oven
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

                // ── Salainen kolikkopalkkio (TESTITYÖKALU, v4.23) ──
                // Avain-cheatin jatko: vitoslamppu 20 potkua putkeen → +20 kolikkoa.
                // Hiljainen: ei popuppia, ei ääntä, ei hiukkasia → vain saldo kasvaa.
                if (i === COIN_CHEAT_LAMP) {
                    if (coinCheatCooldown > 0) {
                        coinCheatStreak = 0;             // cooldownin aikana ei kerrytetä
                    } else {
                        coinCheatStreak++;
                        coinCheatGapTimer = COIN_CHEAT_GAP;
                        if (coinCheatStreak >= COIN_CHEAT_KICKS) {
                            coinCheatStreak = 0;
                            coinCheatGapTimer = 0;
                            coinCheatCooldown = COIN_CHEAT_COOLDOWN;
                            coinCount += COIN_CHEAT_REWARD;
                            state.inventory.coin = true;
                            state.inventory.coinCount = coinCount;
                            GameState.save(state);
                            updateHUD();
                        }
                    }
                } else {
                    coinCheatStreak = 0;                 // välissä toinen lamppu → putki katki
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
                GameState.save(state);
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

    /* ═══ JUKEBOX: valinnat ja poistuminen (v4.46) ═════════════
       Rivi 0 = Poistu, rivit 1..N = kappaleet. (o) / Space / ⚡ ottaa kappaleen
       listalle tai poistaa sen; rivillä 0 sama nappi soittaa valitut ja poistuu.
       Enter soittaa valitut ja poistuu mistä tahansa riviltä. Valitut soitetaan
       yksi kerrallaan (1 → N), hinta ennallaan 1 🪙 / kappale. Jos kolikot eivät
       riitä kaikkiin, soitetaan niin monta kuin niillä saa. */

    /* Nollaa huoneen tila: kursori, valinnat ja reunanilmaisut.
       HUOM: jukeQueuea ei nollata – jono saa soida loppuun huoneen ulkopuolella. */
    function resetJukeboxRoom() {
        jukeboxRoom = false;
        jukeSel = 0;
        jukeHeldUp = false;
        jukeHeldDown = false;
        jukeSpaceHeld = false;
        jukeEnterHeld = false;
        for (let i = 0; i < jukePick.length; i++) jukePick[i] = false;
    }

    /* Valitut kappaleet nousevassa järjestyksessä (1 → N) */
    function jukePickedTracks() {
        const out = [];
        for (let i = 0; i < JUKEBOX_TRACKS.length; i++) {
            if (jukePick[i]) out.push(i + 1);
        }
        return out;
    }

    /* Poistu ja soita valitut: veloitus 1 🪙 / kappale.
       Jos jono soi jo → valinnat lisätään jonon perään (v4.99).
       Jos ei → uusi soitto alkaa valituista. */
    function jukeboxExitAndPlay() {
        const picks = jukePickedTracks();
        if (picks.length === 0) { resetJukeboxRoom(); return; }

        // Veloitus vain niistä kappaleista, joihin kolikot riittävät
        const play = [];
        for (let i = 0; i < picks.length && coinCount > 0; i++) {
            coinCount--;
            play.push(picks[i]);
        }
        if (play.length === 0) {
            showNotification('💰 No coins!');
            resetJukeboxRoom();
            return;
        }
        state.inventory.coinCount = coinCount;
        GameState.save(state);
        updateHUD();

        const urls = [];
        for (let i = 0; i < play.length; i++) urls.push(JUKEBOX_TRACKS[play[i] - 1].url);

        const alreadyPlaying = StreetAudio.isJukeboxPlaying();

        if (alreadyPlaying) {
            // Liitetään soivan jonon perään
            if (StreetAudio.appendJukeboxQueue(urls)) {
                // Päivitä street.js:n jukeQueue: lisää uudet nykyisen perään
                const qPos = StreetAudio.getJukeboxQueuePos();
                const before = (qPos >= 0) ? jukeQueue.slice(0, qPos + 1) : [];
                const after = (qPos >= 0) ? jukeQueue.slice(qPos + 1) : jukeQueue;
                jukeQueue = before.concat(play).concat(after);
                state.jukeQueue = jukeQueue.slice();
                state.jukePos = qPos;
                state.jukeboxPlayedOnce = true;
                GameState.save(state);
                playCoin();
                if (play.length < picks.length) {
                    showNotification('💰 Not enough coins for all – playing ' +
                                     play.length + '/' + picks.length);
                }
            } else {
                // Ääntä ei saatu → kolikot takaisin
                coinCount += play.length;
                state.inventory.coinCount = coinCount;
                GameState.save(state);
                updateHUD();
                showNotification('🔇 No audio – coins refunded.');
            }
        } else {
            // Uusi soitto
            if (StreetAudio.playJukeboxQueue(urls)) {
                jukeQueue = play.slice();
                state.jukeQueue = jukeQueue.slice();
                state.jukePos = 0;
                state.jukeboxPlayedOnce = true;
                GameState.save(state);
                jukeSavedPos = 0;
                playCoin();
                if (play.length < picks.length) {
                    showNotification('💰 Not enough coins for all – playing ' +
                                     play.length + '/' + picks.length);
                }
            } else {
                coinCount += play.length;
                state.inventory.coinCount = coinCount;
                GameState.save(state);
                updateHUD();
                showNotification('🔇 No audio – coins refunded.');
            }
        }
        resetJukeboxRoom();
    }

    /* ═══ NÄLKÄKUOLEMA HUONEESSA/ALAPELISSÄ (v4.50) ══════════════
       Jos 🍔 loppuu kesken huoneen tai alapelin, pelaaja kuolee heti – kuten
       kadullakin (vain nukkuminen on jäissä). Huone/alapeli suljetaan ensin,
       jotta kuolinsekvenssi näkyy kadulla eikä peli näytä nollautuvan kesken
       pelaamisen. Kutsutaan vain nälkäblokista; talousarvot ennallaan. */
    function leaveHiddenStateForDeath() {
        if (iframeOpen) closeGame();   // alapeli kiinni (overlay pois)
        else closeRoom();              // BAR / makuuhuone / jukebox kiinni
    }

    /* ═══ SANOMALEHTI (v4.53) ══════════════════════════════════════
       Kadun lehti avataan toimintonapilla, kun pelaaja seisoo sen
       kohdalla. Lukutila on kuin canvas-huone: maailma jäätyy, nälkä
       kuluu (v4.49/v4.50) ja ✕-nappi sulkee (closeRoom). */
    function openNewspaper() {
        newsRoom = true;
        newsScreen = 0;
        /* Estä sama painallus laukaisemasta sivunvaihtoa heti perään
           (sama kikka kuin jukeboxissa: jukeSpaceHeld). */
        newsHeldUp = !!(keys['ArrowUp'] || keys['w'] || keys['W']);
        newsHeldDown = !!(keys['ArrowDown'] || keys['s'] || keys['S']);
        newsSpaceHeld = !!keys[' '];
        newsExitHeld = !!(keys['o'] || keys['O'] || keys['Enter']);
    }

    function closeNewspaper() {
        newsRoom = false;
        newsScreen = 0;
        newsHeldUp = false;
        newsHeldDown = false;
        newsSpaceHeld = false;
        newsExitHeld = false;
    }

    /* ═══ SULJE HUONE (sanomalehti/BAR/sleep/jukebox) ✕-napista ═════════════ */
    /* Palauttaa true jos huone suljettiin, false jos ei oltu huoneessa. */
    function closeRoom() {
        if (newsRoom) {           // sanomalehti kiinni (✕ / poistuminen)
            closeNewspaper();
            return true;
        }
        if (barRoom) {
            barRoom = false;
            barBuyQty = 0;
            barBuyHeldUp = false;
            barBuyHeldDown = false;
            return true;
        }
        if (sleepRoom) {
            sleepRoom = false;
            sleepSel = 0;
            sleepHeldUp = false;
            sleepHeldDown = false;
            if (sleepPhase > 0) { sleepPhase = 0; }  // kesken nukkumisen → herätä
            return true;
        }
        if (jukeboxRoom) {
            // ✕ = peruuta: valinnat pois ilman veloitusta (v4.46)
            resetJukeboxRoom();
            return true;
        }
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
        coinCheatStreak = 0;
        coinCheatGapTimer = 0;
        coinCheatCooldown = 0;
        coin.collected = state.inventory.coin;
        coinCount = state.inventory.coinCount || 0;
        coinRespawnTimer = coin.collected ? 1 : 0;
        coin.despawnTimer = coin.collected ? 0 : 600;
        /* 0 🍔 pysyy 0:na (ei `|| 5`): nälkäkuolema ei saa "parantua" siitä,
           että closeGame sulkee alapelin kesken kuolinsekvenssiä (v4.50). */
        hamburgerCount = (state.inventory.hamburgerCount != null)
            ? state.inventory.hamburgerCount : 5;
        /* HUOM (v4.49): ajastinta EI enää nollata tässä – se jatkaa siitä
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
        beamCooldownTimer = 0;   // v11.14: resetti ei jätä lukkoa päälle
        sleepRoom = false;
        sleepSel = 0;
        sleepHeldUp = false;
        sleepHeldDown = false;
        sleepPhase = 0;
        isDay = (state.isDay === true);   // tallennettu päivä/yö pysyy
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
        // Aloitusohje: pitempi lukuaika (+2s) kuin muilla popupeilla
        showNotification('Tip: Kick everything – at your own risk!', 4500);
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
        if (beamWeaponCollected) status += ' 🔫';   // sädease ansaittu (v10.20)
        // Hampurilaiset (lives) – vilkkuva varoitus kun jäljellä <= HUNGER_WARN (3)
        var burgerStr = '';
        if (hamburgerCount <= HUNGER_WARN) {
            for (var bi = 0; bi < hamburgerCount; bi++) burgerStr += '🍔';
            burgerStr = '<span class="burger-warning">' + burgerStr + '</span>';
        } else {
            for (var bi = 0; bi < hamburgerCount; bi++) burgerStr += '🍔';
        }
        status += ' | ' + burgerStr;
        if (hudBar) hudBar.innerHTML = '<span style="display:block;text-align:center;margin-top:2px">' + status + '</span>';
    }

    /* ── Pilvijärjestelmä (cirrus + hazy, kapea kaistale) ── */
    function initClouds() {
        clouds = [];
        windDir = (Math.random() < 0.5 ? 1 : -1) * (windDirFlip ? -1 : 1);
        windSpeed = (2 + Math.random() * 3) * windSpeedMult; // px/s (2–5) × kaaoskerroin

        // Pilvikaistale: cloudBandTop..cloudBandTop+cloudBandH (kaaos K1, v10.03)
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
           (v4.40). dayT = 0 → arvot ovat täsmälleen yön ennallaan. */
        const dayMix = dayT;
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
                    ctx.beginPath();
                    ctx.ellipse(x + ox, y + oy, lw, 3 + dist * 2, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.restore();
        }
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

        // Kuoriaiset (beetleCount kpl; kaaos K1, v10.03)
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

        /* Sanomalehti (v4.53: poimittavissa) – rauta-aidan aukkoon kauas
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
    function render() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, viewW, WORLD_H);

        if (sleepRoom) { camX = (WORLD_W - viewW) / 2; ctx.save(); ctx.translate(-Math.round(camX), 0); drawSleepRoom(); ctx.restore(); return; }

        if (barRoom) { camX = (WORLD_W - viewW) / 2; ctx.save(); ctx.translate(-Math.round(camX), 0); drawBarRoom(); ctx.restore(); return; }

        if (jukeboxRoom) { camX = (WORLD_W - viewW) / 2; ctx.save(); ctx.translate(-Math.round(camX), 0); drawJukeboxRoom(); ctx.restore(); return; }

        // Sanomalehti (v4.53) – oma huonekäsittely, kamera keskittää arkin
        if (newsRoom) { camX = (WORLD_W - viewW) / 2; ctx.save(); ctx.translate(-Math.round(camX), 0); drawNewspaperView(); ctx.restore(); return; }

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
        // Meteoriitin törmäyksen tärinä (v10.15) – voimakkaampi, molemmissa suunnissa
        if (meteorShakeTimer > 0) {
            ctx.translate(
                Math.round(Math.sin(meteorShakeTimer * 0.9) * 3),
                Math.round(Math.cos(meteorShakeTimer * 0.7) * 2)
            );
        }
        // Kaaos v10.18 – koko ajan hiukan tärisevä kuva (BAD/FULL): pieni jatkuva huojunta
        if (screenShakeAmount > 0) {
            const t = Date.now() * 0.001;
            ctx.translate(
                Math.round(Math.sin(t * 13.7) * screenShakeAmount * 1.4),
                Math.round(Math.sin(t * 11.3 + 0.5) * screenShakeAmount * 1.1)
            );
        }

        // Taivas
        const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
        skyGrad.addColorStop(0, '#0a0a1e');
        skyGrad.addColorStop(0.6, '#111133');
        skyGrad.addColorStop(1, '#1a1a3e');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, WORLD_W, GROUND_Y);

        // Päivätaivas (lopputila) – liukuu yötaivaan päälle dayT:n mukaan
        if (dayT > 0) {
            const dayGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
            dayGrad.addColorStop(0, DAY_SKY_TOP);
            dayGrad.addColorStop(0.55, DAY_SKY_MID);
            dayGrad.addColorStop(1, DAY_SKY_HORIZON);
            ctx.save();
            ctx.globalAlpha = dayT;
            ctx.fillStyle = dayGrad;
            ctx.fillRect(0, 0, WORLD_W, GROUND_Y);
            ctx.restore();
        }

        // Aurinko (päivä) – liukuu vasemmalta oikealle päivän aikana (v4.89)
        if (dayT > 0) {
            ctx.save();
            ctx.globalAlpha = dayT;
            // Hehku – sunGlow (kaaos) tai nykyinen lämmin (NORMAL bitti-identtinen)
            const glowStops = sunGlow || SUN_GLOW_DEFAULT;
            const discColor = sunColor || '#ffe066';
            const rayRGB = sunColor
                ? sunColor.slice(1).match(/../g).map(h => parseInt(h, 16)).join(',')
                : '255,238,160';
            const SR = SUN_R * sunSizeMult;   // kaaos v10.18: auringon koko (NORMAL = 1)
            const sunGlowGrad = ctx.createRadialGradient(sunX, SUN_Y, SR * 0.4, sunX, SUN_Y, SR * 3.4);
            sunGlowGrad.addColorStop(0, glowStops[0]);
            sunGlowGrad.addColorStop(0.4, glowStops[1]);
            sunGlowGrad.addColorStop(1, glowStops[2]);
            ctx.fillStyle = sunGlowGrad;
            ctx.beginPath(); ctx.arc(sunX, SUN_Y, SR * 3.4, 0, Math.PI*2); ctx.fill();
            // Hitaasti pyörivä sädekehä
            const spin = Date.now() * 0.00012;
            ctx.strokeStyle = 'rgba(' + rayRGB + ',0.35)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 8; i++) {
                const ang = spin + i * Math.PI / 4;
                const r0 = SR + 5;
                const r1 = r0 + (i % 2 === 0 ? 9 : 5);
                ctx.beginPath();
                ctx.moveTo(sunX + Math.cos(ang) * r0, SUN_Y + Math.sin(ang) * r0);
                ctx.lineTo(sunX + Math.cos(ang) * r1, SUN_Y + Math.sin(ang) * r1);
                ctx.stroke();
            }
            // Kiekko: sunColor (kaaos) tai lämmin keltainen (NORMAL bitti-identtinen)
            ctx.fillStyle = discColor;
            ctx.beginPath(); ctx.arc(sunX, SUN_Y, SR, 0, Math.PI*2); ctx.fill();
            ctx.restore();
        }

        // Tähdet (jokaisella oma random twinkle) – himmenevät päivän tullessa
        if (dayT < 1) {
            const starFade = 1 - dayT;
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

        /* ── Sirppikuu (v4.72) ──
           Piirretään tähtien jälkeen (kuu peittää tähdet) mutta ennen pilviä
           (pilvi kuun edessä on oikein). Kuu liukuu yön aikana vasemmalta
           oikealle ja laskeutuu pois (v4.65, X päivittyy moonNightClockin
           mukaan). Rakenne: hehku → valoisa kiekko → kraatterit → maavalo
           (pehmeä terminaattori) → pallomaisuus. Varjokerrokset on klipattu
           kuun kiekkoon → mikään ei karkaa reunan ulkopuolelle. */
        if (dayT < 1) {
            ctx.save();
            const moonY = MOON_Y, moonR = MOON_R;
            const moonFade  = 1 - dayT;                                             // sirpin häipyminen päivällä
            const earthFade = Math.max(0, moonFade - MOON_EARTHSHINE_FADE * dayT);  // maavalo häipyy ensin
            const shadowOff = moonR * MOON_SHADOW_OFF;
            const tint = dayT * MOON_DAWN_TINT;                                     // aamunkoitto lämmittää sirpin
            const mixCh = (a, b) => Math.round(a + (b - a) * tint);

            // 1) Hehku
            ctx.globalAlpha = moonFade;
            const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.4, moonX, moonY, moonR * 2.8);
            const glowRGB = MOON_GLOW_RGB[0] + ',' + MOON_GLOW_RGB[1] + ',' + MOON_GLOW_RGB[2];
            moonGlow.addColorStop(0, 'rgba(' + glowRGB + ',' + MOON_GLOW_A.toFixed(3) + ')');
            moonGlow.addColorStop(0.4, 'rgba(' + glowRGB + ',' + (MOON_GLOW_A * 0.33).toFixed(3) + ')');
            moonGlow.addColorStop(1, 'rgba(' + glowRGB + ',0)');
            ctx.fillStyle = moonGlow;
            ctx.beginPath(); ctx.arc(moonX, moonY, moonR * 2.8, 0, Math.PI*2); ctx.fill();

            // 2) Kuu-kuva (v4.79): assets/moon.png – sama koko kuin entinen
            //    kiekko (2 × MOON_R = 60 px). Käännös on tehty jo itse kuvaan
            //    → ei ctx.rotatea. globalAlpha = moonFade pätee myös kuvaan,
            //    joten päivänvaihdon häivytys säilyy. Jos kuva ei ole vielä
            //    ladattu (tai headless-validointi), piirretään entinen
            //    proseduraalinen kuu (fallback).
            if (moonPicReady) {
                ctx.imageSmoothingEnabled = true; // kuva → pehmennetty skaalaus
                const d = moonR * 2;
                ctx.drawImage(moonPic, moonX - d / 2, moonY - d / 2, d, d);
            } else {
                // 2b) Valoisa kiekko (dayT = 0 → MOON_LIT_RGB; aamunkoitolla lämpenee)
                ctx.fillStyle = 'rgb(' + mixCh(MOON_LIT_RGB[0], MOON_DAWN_RGB[0]) + ',' +
                                         mixCh(MOON_LIT_RGB[1], MOON_DAWN_RGB[1]) + ',' +
                                         mixCh(MOON_LIT_RGB[2], MOON_DAWN_RGB[2]) + ')';
                ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI*2); ctx.fill();

                // 3) Kraatterit ja maret (terävinä valoisalla sirpillä, himmeinä tummalla)
                if (MOON_CRATERS.length) {
                    ctx.save();
                    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI*2); ctx.clip();
                    for (const c of MOON_CRATERS) {
                        ctx.fillStyle = 'rgba(' + MOON_CRATER_RGB[0] + ',' + MOON_CRATER_RGB[1] + ',' +
                                        MOON_CRATER_RGB[2] + ',' + c.a.toFixed(3) + ')';
                        ctx.beginPath();
                        ctx.arc(moonX + c.x * moonR, moonY + c.y * moonR, c.r * moonR, 0, Math.PI*2);
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
                    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI*2); ctx.clip();
                    for (let i = steps - 1; i >= 0; i--) {
                        const k = 1 + (steps > 1 ? i / (steps - 1) : 0) * MOON_TERMINATOR_SPREAD;
                        ctx.fillStyle = 'rgba(' + esRGB + ',' + (stepA * earthFade).toFixed(3) + ')';
                        ctx.beginPath();
                        ctx.arc(moonX + shadowOff, moonY + moonR * MOON_SHADOW_Y,
                                moonR * MOON_SHADOW_R * k, 0, Math.PI*2);
                        ctx.fill();
                    }
                    ctx.restore();
                }

                // 5) Pallomaisuus: reuna tummenee hiukan (limb darkening)
                if (MOON_LIMB_DARK > 0) {
                    const limb = ctx.createRadialGradient(moonX, moonY, moonR * 0.55, moonX, moonY, moonR);
                    limb.addColorStop(0, 'rgba(0,0,0,0)');
                    limb.addColorStop(1, 'rgba(0,0,0,' + MOON_LIMB_DARK.toFixed(3) + ')');
                    ctx.fillStyle = limb;
                    ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI*2); ctx.fill();
                }
            }
            ctx.restore();
        }

        // Pilvet (kapea cirrus/hazy-kaistale) – kuun edessä (oikein)
        drawClouds();

        // Tähdenlento / meteoriitti (vain yöllä)
        if (dayT <= 0 && shootingStar && shootingStar.active) {
            if (shootingStar.kind === 'meteorite') {
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

        // Satelliitti (pieni vilkkuva piste) – vain yöllä
        if (dayT <= 0 && satellite && satellite.active) {
            const blink = Math.sin(satellite.blinkPhase) * 0.5 + 0.5;
            const alpha = 0.25 + blink * 0.65;
            ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
            ctx.beginPath(); ctx.arc(satellite.x, satellite.y, 1.5, 0, Math.PI*2); ctx.fill();
        }

        // Meteoriitin törmäysvälähdys (v10.16): koko taivas välähtää salaman lailla (talojen takana)
        if (meteorFlash) {
            const k = meteorFlash.t / METEOR_FLASH_FRAMES;   // 1 → 0
            ctx.fillStyle = 'rgba(255,255,235,' + (0.8 * k) + ')';
            ctx.fillRect(0, 0, WORLD_W, GROUND_Y);
        }

        // Kaukainen kaupunkisiluetti (parallaksi 0.4×) – tähtien/taivaan päällä, talojen takana
        drawBackdrop(camX * (1 - BACKDROP_PARALLAX));
        drawBuildings();
        // Lepakot talojen EDELLÄ (v4.93)
        if (bats.length) { drawBats(); }
        drawGround();
        drawMoonBuildingShadows();   // kuunvarjot taloilta kadulle (v4.80)

        // Sähkökaapit (talojen kyljissä)
        drawElectricCabinet();

        // Mustat lehdettömät puut (raoissa)
        drawTrees();
        // Päivälinnut puiden ympärillä (v5.00)
        if (birds.length) { drawBirds(); }
        // Pienet ruohotupsut puiden juurella
        if (foreground) { drawTreeGrassTufts(); }

        // BAR-viittakyltti (puunraossa, osoittaa oikealle)
        drawBarSign();

        // Lamput – valo AINA hahmojen alla (valo ei peitä ketään). Pylväs sen
        // sijaan syvyysjärjestyksessä (v4.73): pylvään juuri seisoo syvyysviivalla
        // LAMP_BASE_Y, joten jalkapiste viivan yläpuolella = hahmo on pylvään
        // TAKANA → pylväs piirretään vasta hahmon jälkeen. Rosvon jalkapiste on
        // kiinteä (ROBBER_FOOT_Y 314 < LAMP_BASE_Y 325) → rosvo on AINA pylvään
        // takana ja piirretään aina ennen kaikkia pylväitä (v4.76).
        const lampFeetY = Math.round(player.y) + player.h - 1;
        for (const lamp of lamps) drawLampGlow(lamp);

        // Ovet – kaikkiin taloihin
        for (const bldg of buildings) drawDoor(bldg);

        // Kolikko
        if (!coin.collected) drawCoin();

        // Sädease-esine kadulla (v10.20)
        if (beamPickup) drawBeamPickup();

        // Kukkaruukku
        if (flowerPot && flowerPot.active) drawFlowerPot();

        // Potkusta pudonnut kolikko
        if (kickCoin) drawKickCoin();

        // Katueläin – syvyysjako lamppupylvään suhteen (v4.77): takana-juokseva
        // (jalkapiste < LAMP_BASE_Y) piirretään kuten ennen pylväiden alle,
        // edellä-juokseva (jalkapiste >= LAMP_BASE_Y) vasta kaikkien pylväiden
        // jälkeen (ks. alla) – sama periaate kuin pelaajalla (v4.73).
        const aFeetY = groundAnimal ? animalDepthFeet() : 0;
        if (groundAnimal && aFeetY < LAMP_BASE_Y) drawAnimal();

        // Oviukko (Avenger) – piirretään pelaajan alle
        if (avenger) drawAvenger();

        // Rosvo – partioi jalkakäytävällä (v4.66). Jalat 314 < LAMP_BASE_Y 325
        // → aina pylvään TAKANA: piirretään ennen kaikkia pylväitä, jotta pylväs
        // peittää rosvon riippumatta pelaajan syvyydestä (v4.76).
        if (robber) drawRobber();

        // Pelaajan EDESSÄ olevat pylväät (pelaajan jalkapiste >= LAMP_BASE_Y):
        // pylväs pelaajan alle – mutta rosvon PÄÄLLE (rosvo on aina takana).
        for (const lamp of lamps) if (lampFeetY >= LAMP_BASE_Y) drawLampPost(lamp);

        // Ajoneuvot, jotka ovat pelaajaa KAUEMPANA (ajoneuvon keskipiste Y <
        // pelaajan jalkapiste): piirretään ENNEN pelaajaa, jotta pelaaja
        // piirtyy niiden PÄÄLLE (v4.84). Sama syvyysperiaate kuin lamppu-
        // pylväillä (v4.73). Tässä kohtaa takapylväitä ei voi olla (ne
        // vaatisivat pelaajan jalkapisteen < LAMP_BASE_Y 325), joten autot
        // pysyvät yhä pylväiden edessä kuten ennenkin.
        if (vehicles[1] && vehicles[1].y + vehicles[1].h / 2 < lampFeetY) drawVehicle(vehicles[1]);
        if (vehicles[0] && vehicles[0].y + vehicles[0].h / 2 < lampFeetY) drawVehicle(vehicles[0]);

        // Pelaaja – avoimessa kaivossa vajoaa/kiipeää (v4.51)
        if (mhAction) { drawPlayerManhole(); } else { drawPlayer(); }

        // Sädease: säde + tähtäysristikko (v10.20)
        drawBeam();
        // Avoin kaivo: musta aukko pelaajan PÄÄLLE pudotuksen aikana,
        // jotta pelaaja näyttää katoavan reikään (v4.51)
        drawManholeOverlay();

        // Sanomalehden poimintavihje pelaajan yläpuolelle (v4.53)
        drawNewspaperHint();

        // Pelaajan TAKANA olevat lamppupylväät – piirretään vasta nyt, jotta
        // pylväs peittää pelaajan (v4.73) ja rosvon (aina takana, v4.76).
        // Ennen ajoneuvoja, jotta autot pysyvät pylvään edessä kuten ennenkin.
        for (const lamp of lamps) if (lampFeetY < LAMP_BASE_Y) drawLampPost(lamp);

        // Katueläin pylvään edestä (jalkapiste >= LAMP_BASE_Y): piirretään
        // kaikkien pylväiden päälle (v4.77).
        if (groundAnimal && aFeetY >= LAMP_BASE_Y) drawAnimal();

        // Ajoneuvot, jotka ovat pelaajaa LÄHEMPÄNÄ (keskipiste Y >= pelaajan
        // jalkapiste): piirretään pelaajan jälkeen kuten ennenkin.
        // Ylempi kaista (1, kauempana) ensin, alempi (0, lähempänä) päälle.
        if (vehicles[1] && vehicles[1].y + vehicles[1].h / 2 >= lampFeetY) drawVehicle(vehicles[1]);
        if (vehicles[0] && vehicles[0].y + vehicles[0].h / 2 >= lampFeetY) drawVehicle(vehicles[0]);

        // Rauta-aita (etualalla, pelaajan takana → piirretään pelaajan päälle)
        if (foreground && foreground.ironFence) { drawIronFence(); }
        // Ruohotupsut aidan juuressa
        if (foreground) { drawGrassTufts(); }

        // Partikkelit
        for (const p of particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x-2, p.y-2, 4, 4);
        }
        ctx.globalAlpha = 1;

        // ── Päivänvalo (lopputila: kaikki 3 avainta) ──
        // Yksi additive-kerros kirkastaa koko kadun (asfaltti, talot, siluetti,
        // puut, ajoneuvot, pelaaja) ilman että yhtään piirtofunktiota tai
        // väripalettia tarvitsee säätää uudelleen. Piirretään ennen oviukon
        // vinjettiä ja kuoleman pimennystä → ne toimivat ennallaan.
        if (dayT > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = 'rgba(' + DAY_LIGHT_RGB[0] + ',' + DAY_LIGHT_RGB[1] + ',' + DAY_LIGHT_RGB[2] + ',' + (DAY_LIGHT_ALPHA * dayT).toFixed(3) + ')';
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
            ctx.restore();
        }

        // ── Kuu laskeutui → maisema pimenee hiukan (v4.65) ──
        if (moonDark > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,' + moonDark.toFixed(3) + ')';
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
            ctx.restore();
        }

        // ── Sumuverho (kaaos K1 / K7-kortti "Sumu nousee", v10.05) ──
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

        // ── Kuoleman pimennys ─────────────────────────
        if (playerDead) {
            ctx.fillStyle = 'rgba(0,0,0,' + deathAlpha + ')';
            ctx.fillRect(0, 0, WORLD_W, WORLD_H);
        }

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
        // Kesto: windowDurMin..windowDurMax (kaaos K1, v10.03; NORMAL 10–30 s)
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
        const r = Math.min(255, parseInt(hex.slice(1,3), 16) + offset);
        const g = Math.min(255, parseInt(hex.slice(3,5), 16) + offset);
        const b = Math.min(255, parseInt(hex.slice(5,7), 16) + offset);
        return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
    }

    // Interpoloi kahden hex-värin välillä (t 0 = a, 1 = b) – päivä/yö-siirtymät
    function mixHex(a, b, t) {
        if (t <= 0) return a;
        if (t >= 1) return b;
        const ca = parseInt(a.slice(1), 16), cb = parseInt(b.slice(1), 16);
        const ch = v => (v & 255).toString(16).padStart(2, '0');
        const r  = Math.round(((ca >> 16) & 255) + (((cb >> 16) & 255) - ((ca >> 16) & 255)) * t);
        const g  = Math.round(((ca >> 8) & 255) + (((cb >> 8) & 255) - ((ca >> 8) & 255)) * t);
        const bl = Math.round((ca & 255) + ((cb & 255) - (ca & 255)) * t);
        return '#' + ch(r) + ch(g) + ch(bl);
    }
    // Päivällä tumma ikkunalasi vaalenee taivaan heijastukseksi: tavalliset talot
    // #151716, 3-riviset (kauempana) hiukan tummempaa syvyyden takia (v4.82).
    let WIN_DAY_FILL      = '#151716';   // kaaos K1 (v10.03)
    const WIN_DAY_FILL_FLAT = '#101110';

    // Siluetin todennäköisyys keltaisessa ikkunassa (0.50 = testaus, myöhemmin 0.05)
    let SILHOUETTE_CHANCE = 0.50;   // kaaos K1 (v10.03)

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

    // Alusta: 0..windowTargetMax ikkunaa heti palamaan
    for (let i = 0; i < Math.floor(Math.random() * (windowTargetMax + 1)); i++) addRandomLitWindow();

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
            const houseLit = !cardState.lightsOut && ((idx === 0 && firstHouseWindowsLit) || (smallHouseLights[idx] && smallHouseLights[idx].lit));
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
                        const litWin = cardState.lightsOut ? null : litWindows.find(w => w.wx === wx && w.wy === wy && w.bldgIdx === idx);
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
                            // Päivällä täyttö vaalenee taivaan heijastukseksi (WIN_DAY_FILL*, v4.81);
                            // valaistut ikkunat ja kaikki toiminta ennallaan.
                            ctx.fillStyle = mixHex(flatWindows ? '#05050d' : '#0a0a15',
                                                   flatWindows ? WIN_DAY_FILL_FLAT : WIN_DAY_FILL, dayT);
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
            ctx.restore();
        }
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

    /* ── Sähkökaapit (talojen kyljissä, kerrostalon vas. seinä) ── */
    function drawElectricCabinet() {
        for (const c of electricCabinets) {
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
            // Kaaos v10.18: valo "rätisee" – nopea epäsäännöllinen välkyntä päälle/pois
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

        // ── Neonpinkki hohde kyltistä maahan ja ympärille (v4.83) ──
        // Piirretään kyltirungon ALLE: tumma lauta ja terävä neonteksti
        // pysyvät päällimmäisinä. Keskus = neontekstin keskipiste, väri
        // sama kuin tekstissä ja BAR:n kynnysvalossa (#FF66A3 / 255,102,163).
        // Hidas "hengitys" (±25 %) tekee hohteen selkeämmin erottuvaksi.
        const gcx = sx + (tailW + shaftLen + headLen) / 2;
        const gpulse = 0.75 + 0.25 * Math.sin(Date.now() / 3800);
        // Päivänvalo himmentää hohteen pois (v4.83): auringonnousun (~20 s)
        // aikana pinkki maa- ja ympäristöhehku hiipuu täyteen päivään mennessä
        // nollaan – mutta itse kyltti (neon + väri) jää, sillä BAR on auki
        // myös päivällä (vrt. Jukebox: sammuttaa myös tekstin).
        const gDayDim = 1 - dayT;
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
        // Kaaos v10.18: yksi kirjain (B/A/R) voi olla "palanut" – piirretään tummana
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
        if (foreground && foreground.newspaper) { drawNewspaper(); }

        // Kuoriaiset
        if (foreground && foreground.beetles) { for (const b of foreground.beetles) drawBeetle(b); }

    }

    /* ── Talojen kuusta tulevat varjot (v4.80) ──
       Jokaisen 9 talon pohjan alle piirretään puolisuunnikas GROUND_Y:stä
       alaspäin; kauempi reuna siirtyy kuusta poispäin ((x − moonX)·k). Kun
       kuu liikkuu vasemmalta oikealle, varjo kääntyy oikealta vasemmalle.
       Täyttö on pystygradientti (tumma pohjassa → pois kauempaa) ja alpha
       seuraa kuun näkyvyyttä (1 − dayT). Piirretään drawGround():n JÄLKEEN,
       joten kaikki kadun objektit jäävät varjon sisään. */
    function drawMoonBuildingShadows() {
        if (dayT >= 1 || MOON_BLD_SHADOW_ALPHA <= 0) return;
        const fade = 1 - dayT;                            // kuun näkyvyys
        for (const b of buildings) {
            const x0 = b.x, x1 = b.x + b.w;
            const L = b.h * MOON_BLD_SHADOW_LEN;          // varjon pituus
            const k = MOON_BLD_SHADOW_SKEW * (b.h / 100);
            const s0 = (x0 - moonX) * k;                  // kauemman reunan siirto
            const s1 = (x1 - moonX) * k;
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
            // Makuuhuone (talo 7): ovi aina auki (v4.43) → valo palaa kynnyksellä
            const sleepOpen = (t.bldgIdx === SLEEP_BLDG_IDX);
            const sinkshipLit = t.bldgIdx === SINKSHIP_BLDG_IDX &&
                                !!(smallHouseLights[t.bldgIdx] && smallHouseLights[t.bldgIdx].lit);
            const active = isBar || jukeboxLit || sleepOpen || sinkshipLit ||
                           !!(ownerLamp && (ownerLamp.lit || lampFreeOpen()));
            if (THRESH_LIGHT && active) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(t.border[0], t.border[1]);
                for (let i = 2; i < t.border.length; i += 2) ctx.lineTo(t.border[i], t.border[i + 1]);
                ctx.closePath();
                ctx.clip();
                const r = t.depth + 12;
                // Keltaisten (talojen) ovivalojen hidas syke yöllä (v4.83):
                // sama ~60 s jakso kuin BAR-kyltillä → koko katu hengittää
                // samaan tahtiin. Päivällä (dayT → 1) syke hiipuu pois ja
                // valo palaa tasaisesti kuten ennenkin. BAR/jukebox-värit
                // (pinkki/violetti) pysyvät sykkimättöminä.
                const tpulse = 1 + 0.40 * Math.sin(Date.now() / 3800) * (t.lightRGB === THRESH_LIGHT_HOUSE ? 1 - dayT : 0);
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
            if (manholeOpen === i) {
                // Kansi puuttuu → musta aukko (v4.51)
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

    /* ── Avoin viemäri: kohta on musta, ei kantta (v4.51) ──
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
       pelaaja vajoaa reikään ja katoaa (v4.51). */
    function drawManholeOverlay() {
        if (!mhAction) return;
        const mh = (foreground && foreground.manholes) ? foreground.manholes[mhAction.idx] : null;
        if (!mh) return;
        drawManholeHole(mh.x, mh.y);
        drawManholeSteam(mh);
    }

    /* ═══ SANOMALEHTI: sisältö ja poiminta (v4.53) ═════════════════════
       Kadulla lojuva lehti voidaan poimia toimintonapilla (⚡ / Space /
       Enter) → aukeaa sanomalehtinäkymä, jossa ovat pelin omat peliohjeet.
       Lukeminen on ILMAISTA eikä muuta taloutta (sääntö 04); nälkä kuluu
       myös lukiessa, kuten huoneissa (v4.49/v4.50). Lehti jää katuun, joten
       ohjeet voi lukea uudelleen – ei tallennettavaa tilaa eikä uutta
       localStorage-avainta (gameState.js ei muutu). */
    const NEWS_READ_R = 26;      // kuinka läheltä lehden voi poimia (px)

    /* Manuaalisivu (5. sivu, v4.55): sama rahavirta ASCII-piirroksena.
       Kaksi leveyttä – leveä PC:lle/vaakanäytölle ja kapea pystykännykälle;
       `newsLayout()` valitsee sen, jolla teksti on ruudulla isompi.
       Rivit on rakennettu niin, että reunat ovat tarkalleen kohdakkain
       (leveä = 64 merkkiä, kapea = 40 merkkiä). */
    const NEWS_MANUAL_WIDE = [
        '┌───────────────── kadun tulot ────────────────────────────────┐',
        '│ katu-kolikko 1 kpl / 120 s · kolikko potkusta 1/5 (30 s cd)  │',
        '│ hedelmäpelitalo (ilmainen pyöräytys 1/120 s)                 │',
        '└───────────────────────────────┬──────────────────────────────┘',
        '                                ▼',
        '┌──────────── käytön kohteet (raha pois) ──────────────────────┐',
        '│ BAR:         1 kolikko = 1 🍔 (katto 10)                      │',
        '│ Jukebox:     1 kolikko = 1 koko kappale                      │',
        '│ Hedelmäpeli: 1 kolikko / pyöräytys, RTP 78,5 %               │',
        '│ Makuuhuone:  aina auki (Nuku/Poistu ilmainen)                │',
        '│ Avoin kaivo: ≤ 2 🪙 (3 → 1, 2 → 0, 1 → 0)                     │',
        '└───────────────────────────────┬──────────────────────────────┘',
        '                                ▼',
        '┌──────────── paine (pakko pitää huolta) ──────────────────────┐',
        '│ 🍔 5 alussa, +1 / 40 s · osuma (oviukko, ruukku,              │',
        '│ kukkaruukka, sähkökaappi) = −1 🍔 · 🍔 0 → kuolema + reload    │',
        '└──────────────────────────────────────────────────────────────┘',
    ];

    const NEWS_MANUAL_NARROW = [
        '┌───────── kadun tulot ────────────────┐',
        '│ katu-kolikko 1 kpl / 120 s           │',
        '│ kolikko potkusta 1/5 (30 s cd)       │',
        '│ hedelmäpelitalo: ilmainen 1/120 s    │',
        '└───────────────────┬──────────────────┘',
        '                    ▼',
        '┌─────── käytön kohteet ───────────────┐',
        '│ BAR: 1 kolikko = 1 🍔 (katto 10)      │',
        '│ Jukebox: 1 kolikko / kappale         │',
        '│ Hedelmäpeli: 1 kolikko, RTP 78,5 %   │',
        '│ Makuuhuone: ilmainen (Nuku/Poistu)   │',
        '│ Avoin kaivo: ≤ 2 🪙 (3 → 1, 2 → 0)    │',
        '└───────────────────┬──────────────────┘',
        '                    ▼',
        '┌─────────── paine ────────────────────┐',
        '│ 🍔 5 alussa, +1 / 40 s                │',
        '│ osuma (oviukko, kukkaruukka,         │',
        '│ sähkökaappi) = −1 🍔 · 🍔 0            │',
        '│ → kuolema + reload                   │',
        '└──────────────────────────────────────┘',
    ];

    /* Lehden sisältö: yksi alkio = yksi sivu. Tyhjä merkkijono = riviväli.
       Rivin alun välilyönnit = sisennys (säilyy tekstin kääriytyessä). */
    const NEWSPAPER_PAGES = [
        {
            title: 'AI CHAOS STREET',
            lines: [
                'Move with the arrows or WASD. On the phone: the D-pad and the ⚡ button.',
                'Action ⚡ (Space / Enter): at a door you step in, elsewhere you kick.',
                'Kick a street lamp and the light turns on and the door opens. In daylight the doors are open without lights.',
                '🪙 There is one coin on the street at a time – walk over it. A kick can drop more.',
                '🍔 A burger is your life: hunger takes one every 40 seconds. When 🍔 runs out, you die!',
                'The gauge blinks red when 🍔 is three or less.',
                'Beware the cars, the moped, the flower pot, the fuse box and the door knocker – a hit takes 1 🍔.',
                'An open manhole swallows you: at most 2 🪙 vanish from your wallet.',
                '✕ = restart the whole game – all progress is lost.'
            ]
        },
        {
            title: 'SLEEP & LIGHT',
            lines: [
                '🛏️ The bedroom is always open (right side of the street):',
                '   Sleep = hunger is on hold, you wake with +1 🍔 and the day turns to night (or night to day).',
                '   Exit = changes nothing and costs nothing.',
                'When the three keys are collected, one morning dawns on the street – after that the bedroom changes the time of day.',
                '🎵 The jukebox and the 🍒 fruit machine are open only at night, 8pm–6am.',
                'In daylight the door shows a sign: Open, 8pm - 6am.'
            ]
        },
        {
            title: 'HOUSE GAMES',
            lines: [
                '⛏️ DIG GAME – dig through the dirt, collect the diamonds and find the key.',
                '   The arrows move, Space digs. Hold Space down and press a direction = remote digging.',
                '💎 DIG DÄSH – four levels and a time limit. Collect enough diamonds and the key and the exit opens.',
                '   A falling rock on you = one life gone. Three lives.',
                '✈️ BLUE MÄX – fly with the arrows and destroy the buildings.',
                '   Space or G = machine gun, B = bomb, L = land. Enter = start.',
                'Keys travel from house to house: the Dig Game key opens Dig Däsh, and its key opens Blue Mäx.'
            ]
        },
        {
            title: 'SLOTS',
            lines: [
                '🍒 Fruit machine: bet 1 🪙 / spin. Space, Enter or a tap spins.',
                'A free spin every other minute.',
                'Wins: 💎 35 · 🍔 20 · 🔔 12 · 🍋 7 · 🍒 4. Two of a kind = bet back.',
                'Payout about 78.5 % – the house wins in the long run.',
                '🎵 Jukebox: kick the windows lit and the door opens. 1 🪙 = 1 track.',
                'Pick even three tracks – they play one after another when you leave the room.',
                '🍔 BAR: one coin = one burger. ▼ undoes the purchases of this visit.'
            ]
        },
        {
            /* Manuaali (5. sivu, v4.55) – rahavirta piirroksena.
               `art` = leveä, `artNarrow` = kapea; newsLayout valitsee. */
            title: 'MANUAL',
            art: NEWS_MANUAL_WIDE,
            artNarrow: NEWS_MANUAL_NARROW
        },
        {
            /* 6. sivu – vinkkejä (30.9.2026, käyttäjän teksti) */
            title: 'TIPS',
            lines: [
                'A few tips for playing',
                '',
                'You can earn money by working: in the games keep replaying the start and just grab the coin.',
                'Sleeping gives you 1 burger.',
                'You can play 1 free round of the fruit machine every 120s.',
                '',
                '💡 5 kicks in a row on the 6th lamp:',
                '   all the lamps light up + all the keys.',
                '   If you go on to 20 kicks = +20 🪙. The streak breaks',
                '   if you kick another lamp or wait over 2 s.'
            ]
        }
    ];

    function drawNewspaper() {
        const n = foreground.newspaper;
        const t = Date.now() * 0.0008;
        const flipAngle = n.angle + Math.sin(t + n.x * 0.01) * 0.04;
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(flipAngle);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(1, 2, 22, 12);
        ctx.fillStyle = '#999';
        ctx.fillRect(0, 0, 22, 12);
        ctx.fillStyle = '#aaa';
        ctx.fillRect(0, 0, 22, 1);
        ctx.fillStyle = '#666';
        ctx.fillRect(2, 3, 12, 1);
        ctx.fillRect(2, 5, 16, 1);
        ctx.fillRect(2, 7, 10, 1);
        ctx.fillRect(12, 7, 4, 1);
        ctx.fillStyle = '#777';
        ctx.fillRect(2, 9, 14, 1);
        ctx.restore();
    }

    /* Onko pelaaja lehden kohdalla? (sama ajatus kuin kolikon keräys) */
    function nearNewspaper() {
        const n = (foreground && foreground.newspaper) ? foreground.newspaper : null;
        if (!n) return false;
        const dx = (player.x + player.w / 2) - (n.x + 11);
        const dy = (player.y + player.h / 2) - (n.y + 6);
        return (dx * dx + dy * dy) <= NEWS_READ_R * NEWS_READ_R;
    }

    /* Pieni vihje lehden yläpuolella, kun sen voi poimia (v4.53) */
    function drawNewspaperHint() {
        if (newsRoom || iframeOpen) return;
        const n = (foreground && foreground.newspaper) ? foreground.newspaper : null;
        if (!n || !nearNewspaper()) return;
        const label = 'Read';
        const cx = n.x + 11;
        const cy = n.y - 16;
        ctx.save();
        ctx.font = 'bold 8px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = Math.round(ctx.measureText(label).width) + 10;
        const bx = Math.round(cx - w / 2);
        ctx.fillStyle = 'rgba(8,8,14,0.82)';
        ctx.fillRect(bx, cy - 7, w, 14);
        ctx.strokeStyle = '#8a836f';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, cy - 6.5, w - 1, 13);
        ctx.fillStyle = '#ffe9a8';
        ctx.fillText(label, cx, cy);
        ctx.restore();
    }

    /* Käärii yhden kappaleen näkyvään sarakeleveyteen sana kerrallaan */
    function wrapNewsText(text, maxW) {
        const out = [];
        let line = '';
        const words = String(text).split(' ');
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const test = line ? line + ' ' + word : word;
            if (ctx.measureText(test).width <= maxW) { line = test; continue; }
            if (line) { out.push(line); line = ''; }
            if (ctx.measureText(word).width > maxW) {
                // Yksittäinen sana on saraketta leveämpi → pilkotaan merkki kerrallaan
                let part = '';
                for (const ch of word) {
                    if (part && ctx.measureText(part + ch).width > maxW) { out.push(part); part = ch; }
                    else { part += ch; }
                }
                line = part;
            } else {
                line = word;
            }
        }
        if (line) out.push(line);
        return out;
    }

    /* Sovittaa fontin niin, ettei teksti valu sarakkeen ulkopuolelle */
    function fitNewsFont(text, maxW, baseFs, minFs, family, weight) {
        const pre = weight ? weight + ' ' : '';
        let fs = Math.max(minFs, baseFs);
        ctx.font = pre + fs + 'px ' + family;
        while (fs > minFs && ctx.measureText(text).width > maxW) {
            fs--;
            ctx.font = pre + fs + 'px ' + family;
        }
        return fs;
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

    /* ── Sanomalehden asettelu (v4.53) ────────────────────────────
       Sama näyttösovitus kuin huoneissa (winW, vs, needPx): kapea kännykkä
       zoomataan 1:1:tä suuremmaksi, joten fontin maailmakoko voi olla
       pienempi ja näkyä silti isona. Kaikki kappaleet kääritään sarakkeen
       leveyteen ja jaetaan näkyvän korkeuden mittaisiin "näyttöihin" →
       mitään ei koskaan leikata millään näytöllä. Tulos välimuistiin. */
    let newsCache = { key: '', layout: null };

    function newsLayout() {
        const winW = Math.round(Math.min(WORLD_W, Math.max(VIEWW_MIN, viewW)));
        const vs = (canvas && canvas.height && canvas.clientHeight)
            ? canvas.clientHeight / canvas.height : 1;
        const vsafe = (vs > 0.25) ? vs : 1;
        const needPx = (target, base, max) =>
            Math.round(Math.max(base, Math.min(max, target / vsafe)));

        const panelW = Math.max(196, Math.min(560, winW - 20));
        const panelX = Math.round(400 - panelW / 2);
        const padX   = 12;
        const rowX   = panelX + padX;
        const rowW   = panelW - padX * 2;

        const mastFs  = needPx(17, 12, 18);   // mastoke (AI CHAOS STREET)
        const titleFs = needPx(13, 10, 13);   // sivun otsikko
        const bodyFs  = needPx(15, 13, 20);   // leipäteksti
        const smallFs = needPx(10, 9, 11);    // ylä- ja alatunniste
        const lineH   = Math.round(bodyFs * 1.45);

        const paperTop = 10, paperBottom = 390;
        const subY    = paperTop + smallFs + 8;
        const mastY   = subY + mastFs + 8;
        const ruleY   = mastY + 8;
        const titleY  = ruleY + 6 + titleFs + 10;
        const textTop = titleY + 6;
        const textBottom = paperBottom - 26;
        const footerY = paperBottom - 12;
        const maxLines = Math.max(3, Math.floor((textBottom - textTop) / lineH));

        const key = winW + '|' + bodyFs + '|' + mastFs + '|' + titleFs + '|' + smallFs;
        if (newsCache.key === key && newsCache.layout) return newsCache.layout;

        ctx.save();
        ctx.font = bodyFs + 'px "Courier New", monospace';
        const screens = [];
        for (let p = 0; p < NEWSPAPER_PAGES.length; p++) {
            const page = NEWSPAPER_PAGES[p];

            /* Manuaalisivu (v4.55): ASCII-piirros piirretään merkki
               kerrallaan kiinteälle ruudukolle, joten reunat pysyvät
               kohdakkain myös emojien kanssa. Leveä ja kapea versio –
               valitaan se, jolla teksti on ruudulla isompi. */
            if (page.art) {
                const availH = textBottom - textTop;
                const rateArt = (lines) => {
                    let cols = 0;
                    for (const l of lines) cols = Math.max(cols, Array.from(l).length);
                    const fsW = Math.floor(rowW / (0.6 * cols));
                    const fsH = Math.floor(availH / (lines.length * 1.3));
                    return { lines: lines, cols: cols,
                             fs: Math.max(6, Math.min(bodyFs, fsW, fsH)) };
                };
                const wideArt = rateArt(page.art);
                const narrowArt = page.artNarrow ? rateArt(page.artNarrow) : null;
                const chosen = (narrowArt && narrowArt.fs > wideArt.fs) ? narrowArt : wideArt;
                const artLineH = Math.max(6, Math.round(chosen.fs * 1.3));
                ctx.font = chosen.fs + 'px "Courier New", monospace';
                const cellW = Math.max(2, ctx.measureText('M').width);
                const perScreen = Math.max(3, Math.floor(availH / artLineH));
                for (let i = 0; i < chosen.lines.length; i += perScreen) {
                    const chunk = chosen.lines.slice(i, i + perScreen);
                    const artH = chunk.length * artLineH;
                    screens.push({
                        page: p,
                        lines: [],
                        art: {
                            fs: chosen.fs, cellW: cellW, lineH: artLineH, cols: chosen.cols,
                            top: textTop + Math.round((availH - artH) / 2),
                            lines: chunk
                        }
                    });
                }
                continue;
            }

            const vis = [];
            for (const raw of page.lines) {
                const src = String(raw);
                if (src.trim() === '') { vis.push(''); continue; }   // riviväli
                const indent = (src.match(/^\s*/) || [''])[0];
                const indentPx = indent ? ctx.measureText(indent).width : 0;
                const wrapped = wrapNewsText(src.trim(), Math.max(40, rowW - indentPx));
                for (let i = 0; i < wrapped.length; i++) vis.push(indent + wrapped[i]);
            }
            let i = 0;
            do {
                const chunk = vis.slice(i, i + maxLines);
                while (chunk.length && chunk[0] === '') chunk.shift();               // ei tyhjää alkua
                while (chunk.length && chunk[chunk.length - 1] === '') chunk.pop();  // eikä loppua
                screens.push({ page: p, lines: chunk });
                i += maxLines;
            } while (i < vis.length);
        }
        ctx.restore();   // mittauksen fontti ei vuoda kadun piirtoon

        const layout = {
            winW: winW, panelX: panelX, panelW: panelW, padX: padX, rowX: rowX, rowW: rowW,
            mastFs: mastFs, titleFs: titleFs, bodyFs: bodyFs, smallFs: smallFs, lineH: lineH,
            paperTop: paperTop, paperBottom: paperBottom, subY: subY, mastY: mastY, ruleY: ruleY,
            titleY: titleY, textTop: textTop, textBottom: textBottom, footerY: footerY,
            maxLines: maxLines, screens: screens
        };
        newsCache = { key: key, layout: layout };
        return layout;
    }

    /* Sanomalehtinäkymä (v4.53): vaalea paperiarkki, tumma selkeä teksti.
       Piirto on save()/restore()-parin sisällä, ettei tila vuoda kadulle. */
    function drawNewspaperView() {
        const L = newsLayout();
        const idx = Math.max(0, Math.min(L.screens.length - 1, newsScreen));
        const scr = L.screens[idx];
        const pageCount = NEWSPAPER_PAGES.length;
        const page = NEWSPAPER_PAGES[scr.page];
        const pageScreens = L.screens.filter(s => s.page === scr.page).length;
        const onPage = L.screens.slice(0, idx + 1).filter(s => s.page === scr.page).length;
        const pageTxt = 'PAGE ' + (scr.page + 1) + '/' + pageCount +
                        (pageScreens > 1 ? '  (' + onPage + '/' + pageScreens + ')' : '');
        const hint = '▲/▼ = page   Space = next   (o)/Enter = exit';

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.textBaseline = 'alphabetic';

        // 1) Tausta: katu jää tummaksi arkin taakse
        ctx.fillStyle = '#07070c';
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);

        // 2) Paperiarkki, varjo ja ohut reuna
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(L.panelX + 3, L.paperTop + 5, L.panelW, L.paperBottom - L.paperTop);
        ctx.fillStyle = '#f4eede';
        ctx.fillRect(L.panelX, L.paperTop, L.panelW, L.paperBottom - L.paperTop);
        ctx.strokeStyle = '#c6bca2';
        ctx.lineWidth = 1;
        ctx.strokeRect(L.panelX + 0.5, L.paperTop + 0.5, L.panelW - 1, L.paperBottom - L.paperTop - 1);

        // 3) Ylätunniste: lehden nimi (vasen) ja sivunumero (oikea).
        //    Jos kadulla on ajoneuvo liikkeellä, vasen teksti vaihtuu
        //    vilkkuvaksi varoitukseksi (v4.54) – lukija ehtii sulkea lehden.
        const trafficComing = !!(vehicles[0] || vehicles[1]);
        const topTxt = trafficComing ? '⚠ WATCH OUT – TRAFFIC NEVER STOPS!'
                                     : 'NEWS · GAME GUIDE';
        ctx.fillStyle = '#6a6250';
        ctx.textAlign = 'left';
        ctx.font = 'bold ' + L.smallFs + 'px "Courier New", monospace';
        const pageW = ctx.measureText(pageTxt).width;
        fitNewsFont(topTxt, L.rowW - pageW - 10, L.smallFs, 7, '"Courier New", monospace', 'bold');
        if (trafficComing) {
            ctx.fillStyle = (Math.sin(Date.now() * 0.012) > 0) ? '#a51212' : '#c07a12';
        }
        ctx.fillText(topTxt, L.rowX, L.subY);
        // Sivunumero omalla fontillaan, vaikka varoitusteksti olisi kutistettu
        ctx.font = 'bold ' + L.smallFs + 'px "Courier New", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(pageTxt, L.rowX + L.rowW, L.subY);

        // 4) Mastoke + kaksinkertainen viiva
        ctx.textAlign = 'center';
        fitNewsFont('AI CHAOS STREET', L.rowW, L.mastFs, 9, '"Press Start 2P", monospace', 'normal');
        ctx.fillStyle = '#141414';
        ctx.fillText('AI CHAOS STREET', 400, L.mastY);
        ctx.fillRect(L.panelX + 8, L.ruleY, L.panelW - 16, 2);
        ctx.fillRect(L.panelX + 8, L.ruleY + 3, L.panelW - 16, 1);

        // 5) Sivun otsikko
        fitNewsFont(page.title, L.rowW - 8, L.titleFs, 8, '"Press Start 2P", monospace', 'normal');
        ctx.fillStyle = '#8c1d1d';
        ctx.fillText(page.title, 400, L.titleY);

        // 6) Leipäteksti (valmiiksi käärityt rivit) TAI manuaalin ASCII-piirros
        ctx.fillStyle = '#16150f';
        if (scr.art) {
            const A = scr.art;
            const x0 = L.rowX + Math.max(0, Math.round((L.rowW - A.cols * A.cellW) / 2));
            ctx.font = A.fs + 'px "Courier New", monospace';
            ctx.textAlign = 'center';
            for (let i = 0; i < A.lines.length; i++) {
                const chars = Array.from(A.lines[i]);      // emoji = yksi merkki
                const baseline = A.top + A.fs + i * A.lineH;
                for (let c = 0; c < chars.length; c++) {
                    if (chars[c] === ' ') continue;
                    ctx.fillText(chars[c], x0 + (c + 0.5) * A.cellW, baseline);
                }
            }
            ctx.textAlign = 'left';
        } else {
            ctx.textAlign = 'left';
            ctx.font = L.bodyFs + 'px "Courier New", monospace';
            for (let i = 0; i < scr.lines.length; i++) {
                if (!scr.lines[i]) continue;
                ctx.fillText(scr.lines[i], L.rowX, L.textTop + L.bodyFs + i * L.lineH);
            }
        }

        // 7) Alatunniste: ohjeet (vasen) ja sivunumero (oikea)
        fitNewsFont(hint, L.rowW - pageW - 12, L.smallFs, 7, '"Courier New", monospace', 'bold');
        ctx.fillStyle = '#6a6250';
        ctx.textAlign = 'left';
        ctx.fillText(hint, L.rowX, L.footerY);
        ctx.font = 'bold ' + L.smallFs + 'px "Courier New", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(pageTxt, L.rowX + L.rowW, L.footerY);
        ctx.textAlign = 'left';

        ctx.restore();
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

    /* ── Makuuhuone (ex-palkintohuone, talo 7) ────
       Ovi aina auki (v4.43: ei avaimia eikä lamppua). Huoneessa on kaksi valintaa:
         Nuku   = vaihtaa päivä/yö-tilan (päivä → yö TAI yö → päivä)
         Poistu = ei muuta mitään
       Molemmat ovat ilmaisia. Sänky on piirretty sivusta (pääty, paksu patja,
       tyyny, peitto ja jalat), ja ikkunasta näkyy tämänhetkinen tila.

       SISÄLTÖ SOVITETAAN NÄKYVÄÄN IKKUNAAN (kuten jukebox v4.22): mobiilissa
       canvas on vain `viewW` (260–800) leveä ja kamera keskittää huoneen, joten
       kaikki sijoitetaan x = 400:n ympärille ja enintään `winW − 24` leveäksi.
       Koko piirto on save()/restore()-parin sisällä, ettei tila vuoda kadulle. */
    function drawSleepRoom() {
        const W = WORLD_W, H = WORLD_H;
        const now = Date.now();

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.textBaseline = 'alphabetic';

        /* Ikkunasovitus + fonttikoko (näytön skaala: kapea kännykkä zoomataan) */
        const winW   = Math.round(Math.min(WORLD_W, Math.max(VIEWW_MIN, viewW)));
        const wide   = winW >= 560;                 // sivuikkunalle jää tilaa
        const panelW = Math.max(196, winW - 24);
        const panelX = Math.round(400 - panelW / 2);
        const padX   = 12;
        const rowX   = panelX + padX;
        const rowW   = panelW - padX * 2;
        const vs = (canvas && canvas.height && canvas.clientHeight)
            ? canvas.clientHeight / canvas.height : 1;
        const vsafe = (vs > 0.25) ? vs : 1;
        const needPx = (target, base, max) =>
            Math.round(Math.max(base, Math.min(max, target / vsafe)));

        /* Pystyasettelu: paneeli ylhäällä, sänky alhaalla */
        const titleY  = 80;
        const stateY  = titleY + 22;
        const nameFs  = needPx(15, 12, 15);
        const rowH    = Math.max(18, Math.round(nameFs * 1.5));
        const rowGap  = 6;
        const listTop = stateY + 14;
        const listH   = 2 * (rowH + rowGap) - rowGap;
        const hintY   = listTop + listH + 18;
        const panelTop    = titleY - 26;
        const panelBottom = hintY + 10;

        // 1) Tausta: seinä (yöllä kylmä, päivällä lämmin) + lattia
        ctx.fillStyle = isDay ? '#241d2c' : '#07070f';
        ctx.fillRect(0, 0, W, H);
        const wall = ctx.createLinearGradient(0, 40, 0, GROUND_Y);
        if (isDay) {
            wall.addColorStop(0, '#3b3149');
            wall.addColorStop(1, '#4c4058');
        } else {
            wall.addColorStop(0, '#151326');
            wall.addColorStop(1, '#221f36');
        }
        ctx.fillStyle = wall;
        ctx.fillRect(40, 40, W - 80, GROUND_Y - 40);
        // Lattia + lautojen perspektiivi (sänky seisoo tällä)
        ctx.fillStyle = isDay ? '#2c2434' : '#0f0d18';
        ctx.fillRect(40, GROUND_Y, W - 80, H - GROUND_Y - 40);
        ctx.strokeStyle = isDay ? '#1d1722' : '#08070e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
            const fx = 40 + i * (W - 80) / 8;
            ctx.moveTo(fx, GROUND_Y + 1);
            ctx.lineTo(fx + (fx - W / 2) * 0.16, H - 40);
        }
        ctx.stroke();

        // 2) Paneeli: otsikko + nykyinen tila + valinnat (yksi tumma laatta)
        ctx.fillStyle = '#0b0812';
        ctx.fillRect(panelX, panelTop, panelW, panelBottom - panelTop);
        ctx.strokeStyle = '#3a3348';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 0.5, panelTop + 0.5, panelW - 1, panelBottom - panelTop - 1);
        // Yläreunan sävy kertoo tilan: keltainen = päivä, sininen = yö
        ctx.fillStyle = isDay ? '#ffd070' : '#7c8ad8';
        ctx.fillRect(panelX, panelTop, panelW, 2);

        ctx.textAlign = 'center';
        ctx.font = needPx(16, 12, 16) + 'px "Press Start 2P", monospace';
        ctx.fillStyle = '#eae4f2';
        ctx.fillText('BEDROOM', 400, titleY);

        ctx.font = 'bold ' + nameFs + 'px "Courier New", monospace';
        ctx.fillStyle = isDay ? '#ffdd88' : '#c8d8ff';
        ctx.fillText('Now: ' + (isDay ? '☀️ Day' : '🌙 Night'), 400, stateY);

        /* 3) Valinnat: 0 = Nuku, 1 = Poistu
              ▲/▼ liikuttaa valintaa, ⚡ / Space / (o) vahvistaa */
        const rows = [
            { label: 'Sleep',  note: isDay ? '→ night' : '→ day' },
            { label: 'Exit',   note: 'no change' }
        ];
        for (let i = 0; i < rows.length; i++) {
            const y = listTop + i * (rowH + rowGap);
            const selected = (i === sleepSel);
            const bg     = selected ? '#ffd070' : '#171122';
            const border = selected ? '#fff3d0' : '#3a3348';
            const fg     = selected ? '#1c1400' : '#eae4f2';
            const dim    = selected ? '#5c4400' : '#948ca8';

            ctx.fillStyle = bg;
            ctx.fillRect(rowX, y, rowW, rowH);
            ctx.strokeStyle = border;
            ctx.lineWidth = 1;
            ctx.strokeRect(rowX + 0.5, y + 0.5, rowW - 1, rowH - 1);

            ctx.textBaseline = 'middle';
            const cy = Math.round(y + rowH / 2) + 1;
            ctx.textAlign = 'left';
            ctx.font = nameFs + 'px "Courier New", monospace';
            ctx.fillStyle = fg;
            ctx.fillText((selected ? '▶ ' : '   ') + rows[i].label, rowX + 8, cy);
            ctx.textAlign = 'right';
            ctx.fillStyle = dim;
            ctx.fillText(rows[i].note, rowX + rowW - 8, cy);
        }
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'center';
        ctx.font = Math.max(10, Math.min(nameFs - 1, 13)) + 'px Arial, sans-serif';
        ctx.fillStyle = '#e9e9ef';
        ctx.fillText('▲/▼ = select   ⚡/Space = confirm', 400, hintY);
        ctx.textAlign = 'left';

        // 4) Sänky sivusta: pääty, paksu patja, tyyny, peitto ja jalat
        const bedW  = Math.min(340, panelW - 16);
        const bedL  = Math.round(400 - bedW / 2);
        const bedR  = bedL + bedW;
        const bedFoot = GROUND_Y - 2;              // 308 – jalkojen pohja
        const legH = 10, frameH = 12, mattH = 38;
        const legTop   = bedFoot - legH;           // 298
        const frameTop = legTop - frameH;          // 286
        const mattTop  = frameTop - mattH;         // 248
        const headTop  = mattTop - 34;             // 214 – päädyn yläreuna
        const headW    = 13;
        const pillowW  = Math.round(bedW * 0.24);

        // Jalat
        ctx.fillStyle = '#241812';
        ctx.fillRect(bedL + 16, legTop, 9, legH);
        ctx.fillRect(bedR - 27, legTop, 9, legH);

        // Runko (patjan alla)
        ctx.fillStyle = '#2e2019';
        ctx.fillRect(bedL + 4, frameTop, bedW - 8, frameH);
        ctx.fillStyle = '#3d2a1d';
        ctx.fillRect(bedL + 4, frameTop, bedW - 8, 3);

        // Pääty (vasemmassa reunassa)
        ctx.fillStyle = '#33241a';
        ctx.fillRect(bedL, headTop, headW, frameTop - headTop + 6);
        ctx.fillStyle = '#48321f';
        ctx.fillRect(bedL + 3, headTop + 6, 7, frameTop - headTop - 14);

        // Tyyny
        ctx.fillStyle = '#efe6d2';
        ctx.fillRect(bedL + 18, mattTop - 12, pillowW, 20);
        ctx.fillStyle = '#fbf5e6';
        ctx.fillRect(bedL + 18, mattTop - 12, pillowW, 3);
        ctx.fillStyle = '#d8ceb6';
        ctx.fillRect(bedL + 18, mattTop + 4, pillowW, 4);

        // Paksu patja (yläreuna, runko, keskiviiva, alavarjo)
        ctx.fillStyle = '#cfc6b2';
        ctx.fillRect(bedL + 8, mattTop, bedW - 16, mattH);
        ctx.fillStyle = '#e7dfcb';
        ctx.fillRect(bedL + 8, mattTop, bedW - 16, 5);
        ctx.fillStyle = '#b8af9b';
        ctx.fillRect(bedL + 8, mattTop + Math.round(mattH / 2), bedW - 16, 1);
        ctx.fillStyle = '#a89f8c';
        ctx.fillRect(bedL + 8, mattTop + mattH - 5, bedW - 16, 5);

        // Peitto (jalkopää peittyy, tyyny jää näkyviin)
        const blkL = bedL + 24 + pillowW;
        const blkR = bedR - 8;
        ctx.fillStyle = '#3b4c86';
        ctx.fillRect(blkL, mattTop - 6, blkR - blkL, mattH + 8);
        ctx.fillStyle = '#4d61a6';
        ctx.fillRect(blkL, mattTop - 6, blkR - blkL, 4);
        ctx.fillStyle = '#2f3c6c';
        ctx.fillRect(blkL, mattTop + 12, blkR - blkL, 2);
        ctx.fillRect(blkL, mattTop + 24, blkR - blkL, 2);

        // 5) Ikkuna (vain kun sille jää tilaa): näyttää tämänhetkisen tilan
        if (wide) {
            const wx = 626, wy = 204, ww = 92, wh = 72;
            ctx.fillStyle = '#241d2e';
            ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
            const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
            if (isDay) { sky.addColorStop(0, '#4b8fd0'); sky.addColorStop(1, '#a8d4f0'); }
            else       { sky.addColorStop(0, '#0a1030'); sky.addColorStop(1, '#1b2352'); }
            ctx.fillStyle = sky;
            ctx.fillRect(wx, wy, ww, wh);

            if (isDay) {
                // Aurinko: tasainen keltainen kiekko (ei valkoista palloa keskellä)
                ctx.fillStyle = '#ffe066';
                ctx.beginPath(); ctx.arc(wx + ww * 0.7, wy + wh * 0.34, 11, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(255,224,120,0.85)';
                ctx.lineWidth = 1;
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4 + 0.3;
                    ctx.beginPath();
                    ctx.moveTo(wx + ww * 0.7 + Math.cos(a) * 15, wy + wh * 0.34 + Math.sin(a) * 15);
                    ctx.lineTo(wx + ww * 0.7 + Math.cos(a) * 20, wy + wh * 0.34 + Math.sin(a) * 20);
                    ctx.stroke();
                }
            } else {
                // Sirppikuu + pari tähteä
                ctx.fillStyle = '#fff8cc';
                ctx.beginPath(); ctx.arc(wx + ww * 0.7, wy + wh * 0.34, 11, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#0a1030';
                ctx.beginPath(); ctx.arc(wx + ww * 0.7 + 5, wy + wh * 0.34 - 1, 9, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(wx + 12, wy + 14, 2, 2);
                ctx.fillRect(wx + 27, wy + 24, 2, 2);
                ctx.fillRect(wx + 16, wy + 50, 2, 2);
            }

            // Ikkunaristikko + verhojen varjot reunoissa
            ctx.strokeStyle = '#2b2438';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
            ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(wx, wy, 5, wh);
            ctx.fillRect(wx + ww - 5, wy, 5, wh);
        }

        // 6) Nukkumisen pimennys: ruutu tummuu mustaksi ~0,75 s aikana
        //    (SLEEP_DARK_FRAMES), minkä jälkeen itse "ZZzzZZzzzZzzz…"-efekti näkyy ~3 s
        //    (SLEEP_ZZZ_FRAMES) – yhteensä ~3,75 s. Tila vaihtuu vasta lopussa.
        //    HUOM: pimennys lasketaan KULUNEESTA ajasta (ei jäljellä olevasta),
        //    muuten musta kerros ja Zzz ehtivät mukaan vasta aivan lopussa.
        if (sleepPhase > 0) {
            const elapsed = SLEEP_FADE_FRAMES - sleepPhase;              // kulunut aika
            const fade = Math.max(0, Math.min(1, elapsed / SLEEP_DARK_FRAMES));
            ctx.fillStyle = 'rgba(0,0,0,' + fade.toFixed(3) + ')';
            ctx.fillRect(0, 0, W, H);
            if (fade > 0.05) {
                ctx.globalAlpha = fade;          // Zzz himmenee sisään pimennyksen mukana
                ctx.textAlign = 'center';
                ctx.font = 'bold ' + needPx(20, 16, 22) + 'px "Courier New", monospace';
                ctx.fillStyle = '#ffe9a8';
                ctx.fillText('ZZzzZZzzzZzzz…', 400, 250 + Math.round(Math.sin(now / 300) * 3));
                ctx.textAlign = 'left';
                ctx.globalAlpha = 1;
            }
        }

        ctx.restore();
    }

    /* ── Jukebox-huone (talo 5) ────────────────────
       Monivalinta (v4.46): rivi 0 = Poistu, rivit 1..N = kappaleet (1 🪙 /
       kappale). Valitut soitetaan poistuttaessa yksi kerrallaan (1 → N).
       HUOM: jukebox ei muuta peliääniä mitenkään.

       SELKEYS (v4.22): kaikki tekstit piirretään terävinä (ei
       shadowBlur-sumennusta eikä läpinäkyvää tekstiä) ja koko asettelu
       sovitetaan siihen ikkunaan, joka ruudulla oikeasti näkyy. Mobiilissa
       canvas on vain `viewW` leveä ja kamera keskittää huoneen (camX), joten
       kiinteä 800 px:n asettelu (tekstit x 62…) jäi kankaan ulkopuolelle –
       kapealla kännykällä näkyi vain listan keskikohta. Sisältö on nyt
       keskitetty x = 400:n ympärille ja enintään `winW − 24` leveäksi. */
    function drawJukeboxRoom() {
        const W = WORLD_W, H = WORLD_H;
        const now = Date.now();
        const playing = StreetAudio.isJukeboxPlaying();
        const trackCount = JUKEBOX_TRACKS.length;
        /* Soiva kappale jonon sijainnista (v4.46): montako on jo soitettu.
           jukeQueue = kadun oma kopio soitettavista raidoista (1..N). */
        const qPos = StreetAudio.getJukeboxQueuePos();
        const curTrack = (playing && qPos >= 0 && qPos < jukeQueue.length) ? jukeQueue[qPos] : 0;
        let pickCount = 0;
        for (let i = 0; i < jukePick.length; i++) { if (jukePick[i]) pickCount++; }

        ctx.save();
        // Ei pehmennystä: nollataan kadulta mahdollisesti periytynyt hehku
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'rgba(0,0,0,0)';
        ctx.textBaseline = 'alphabetic';

        /* Sovitus näkyvään ikkunaan (ks. selitys yllä) */
        const winW = Math.round(Math.min(WORLD_W, Math.max(VIEWW_MIN, viewW)));
        const wide = winW >= 620;                 // jukebox-kaappi mahtuu viereen
        const CAB_W = 176, CAB_GAP = 26, PANEL_MAX = 520;
        const panelW = Math.round(wide
            ? Math.min(PANEL_MAX, winW - CAB_W - CAB_GAP - 26)
            : Math.max(196, winW - 24));
        const panelX = Math.round(400 - (wide ? panelW + CAB_GAP + CAB_W : panelW) / 2);
        const padX = 12;
        const rowX = panelX + padX;
        const rowW = panelW - padX * 2;

        /* Näytön skaala (canvas CSS-px / puskurin px): kapea kännykkä
           zoomataan 1:1:tä suuremmaksi → fontin maailmakoko voi olla
           pienempi ja näkyä silti isona. `needPx` valitsee fontin
           maailmakoon niin, että ruudulla näkyy vähintään `target` px. */
        const vs = (canvas && canvas.height && canvas.clientHeight)
            ? canvas.clientHeight / canvas.height : 1;
        const vsafe = (vs > 0.25) ? vs : 1;
        const needPx = (target, base, max) =>
            Math.round(Math.max(base, Math.min(max, target / vsafe)));

        /* Sarakeleveydet paneelin leveydestä; pisin kappalenimi on 25 merkkiä
           → fonttikoko ei koskaan ylitä nimen saraketta. Oikea sarake on
           hieman leveämpi kuin ennen, koska valittu rivi näyttää "✓ 1 🪙". */
        const numW     = Math.max(20, Math.round(rowW * 0.055));
        const priceW   = Math.max(52, Math.round(rowW * 0.16));
        const nameMaxW = rowW - numW - priceW - 16;
        /* Lista on kasvanut (v4.60: 6 kappaletta = 7 riviä). Kun rivejä on
           enemmän kuin 4, rivit tiivistetään ja koko lista sovitetaan niin,
           ettei paneeli valu lattialle (GROUND_Y) eikä peitä alaohjetta.
           3 kappaleen ulkoasu säilyy täsmälleen ennallaan (compact = false). */
        const totalRows = trackCount + 1;         // rivi 0 = Poistu
        const compact   = totalRows > 4;
        const nameFs = compact
            ? Math.max(9, Math.min(needPx(12, 11, 12),
                     Math.floor(nameMaxW / (0.62 * 25))))
            : Math.max(9, Math.min(needPx(16, 13, 16),
                     Math.floor(nameMaxW / (0.62 * 25))));

        /* Pystyasettelu */
        const titleY   = compact ? 74 : 82;
        const stacked  = panelW < 470;            // kolikkosaldo omalle rivilleen
        const balY     = stacked ? titleY + (compact ? 20 : 22) : titleY;
        const listTop  = stacked ? balY + (compact ? 14 : 20) : titleY + (compact ? 20 : 22);
        /* Tilatekstilaatikolle varataan tila (enintään 2 riviä) ennen kuin
           rivikorkeus lasketaan – muuten 7 rivin lista työntäisi paneelin
           alareunan lattialle asti. */
        const infoFsPre = Math.max(9, Math.min(nameFs - 2, 15));
        const infoHPre  = 2 * (infoFsPre + 4) + 10;
        const listMaxH  = Math.max(48, (GROUND_Y - 6) - listTop - 10 - infoHPre - 8);
        let rowGap = compact ? 3 : 6;
        let rowH   = compact ? Math.max(16, Math.round(nameFs * 1.7))
                             : Math.max(18, Math.round(nameFs * 1.9));
        if (compact) {
            // Tiivistä rivejä, kunnes koko lista mahtuu seinälle
            while (totalRows * (rowH + rowGap) - rowGap > listMaxH &&
                   (rowH > 16 || rowGap > 2)) {
                if (rowGap > 2) rowGap--; else rowH--;
            }
        }
        const listH = totalRows * (rowH + rowGap) - rowGap;

        /* Tilatekstit: yksi rivi = yksi fillText, jotta rivi ei koskaan
           katkea keskeltä (luettavuus + testit nojaavat kokonaisiin riveihin) */
        const info = [];
        if (playing) {
            const tr = (curTrack > 0) ? JUKEBOX_TRACKS[curTrack - 1] : null;
            const t = tr ? tr.title : '';
            info.push({ text: '🔊 NOW PLAYING: ' + t, color: '#ffdd88' });
            if (jukeQueue.length > 1) {
                info.push({ text: '📋 In queue: ' + jukeQueue.length + ' track(s)',
                            color: '#8ce88c' });
            }
            info.push({ text: 'Pick more => exit = add to queue', color: '#8ce88c' });
        } else if (pickCount > 0) {
            info.push({ text: 'Selected: ' + pickCount + ' – ' + pickCount + ' 🪙',
                        color: '#ffffff' });
            if (coinCount >= pickCount) {
                info.push({ text: 'Exit (⚡/Space/Enter) = play selected', color: '#8ce88c' });
            } else if (coinCount > 0) {
                info.push({ text: '💰 Not enough coins for all – playing ' + coinCount + '/' + pickCount,
                            color: '#ffcc66' });
            } else {
                info.push({ text: '💰 No coins!', color: '#ff8080' });
            }
        } else {
            info.push({ text: 'No selection – leaving costs nothing', color: '#d8d2e2' });
        }
        const infoFs     = Math.max(9, Math.min(nameFs - 2, 15));
        const infoLineH  = infoFs + 4;
        const infoTop    = listTop + listH + 10;
        const infoH      = info.length * infoLineH + 10;
        const infoBottom = infoTop + infoH;

        /* Yksi yhtenäinen tumma paneeli koko sisällölle = paras kontrasti
           (ei läpinäkyvyyttä eikä seinän kohinaa tekstin alla) */
        const panelTop    = titleY - 24;
        const panelBottom = infoBottom + 8;

        /* Fontin asetus + koon sovitus: asettaa `ctx.font`in ja palauttaa
           käytetyn koon, jolla teksti mahtuu enintään maxW:iin (≥ minFs) */
        const setFitFont = (text, maxW, baseFs, minFs, family) => {
            ctx.font = baseFs + 'px ' + family;
            const w = ctx.measureText(text).width;
            let fs = baseFs;
            if (w > maxW) fs = Math.max(minFs, Math.floor(baseFs * maxW / w));
            ctx.font = fs + 'px ' + family;
            return fs;
        };

        // 1) Tausta + lämminvioletti seinä
        ctx.fillStyle = '#08060e';
        ctx.fillRect(0, 0, W, H);
        const wall = ctx.createLinearGradient(0, 50, 0, GROUND_Y);
        wall.addColorStop(0, '#1c1122');
        wall.addColorStop(1, '#2b1a2e');
        ctx.fillStyle = wall;
        ctx.fillRect(40, 50, W - 80, GROUND_Y - 50);
        // Lattia + lautojen perspektiivi
        ctx.fillStyle = '#120d16';
        ctx.fillRect(40, GROUND_Y, W - 80, H - GROUND_Y - 40);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(40, GROUND_Y, W - 80, 1);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
            const fx = 40 + i * (W - 80) / 8;
            ctx.moveTo(fx, GROUND_Y + 1);
            ctx.lineTo(fx + (fx - W / 2) * 0.16, H - 40);
        }
        ctx.stroke();

        // 2) Paneeli: yksi tumma laatta listalle ja tilateksteille
        ctx.fillStyle = '#0b0710';
        ctx.fillRect(panelX, panelTop, panelW, panelBottom - panelTop);
        ctx.strokeStyle = '#3a3348';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX + 0.5, panelTop + 0.5, panelW - 1, panelBottom - panelTop - 1);
        // Ohut neonreuna (terävä viiva, ei hehkua)
        ctx.fillStyle = '#ff4f96';
        ctx.fillRect(panelX, panelTop, panelW, 2);

        // 3) Otsikko + kolikkosaldo (yksiväriset, ei hehkua)
        ctx.textAlign = 'left';
        setFitFont('♪ JUKEBOX', stacked ? rowW : Math.round(rowW * 0.5),
                   needPx(16, 12, 16), 10, '"Press Start 2P", monospace');
        ctx.fillStyle = '#ff4f96';
        ctx.fillText('♪ JUKEBOX', rowX, titleY);

        const balText = '💰 Coins: ' + coinCount;
        setFitFont(balText, rowW * (stacked ? 1 : 0.5),
                   Math.max(11, Math.min(nameFs, 14)), 10, '"Courier New", monospace');
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = stacked ? 'left' : 'right';
        ctx.fillText(balText, stacked ? rowX : rowX + rowW, balY);

        // 4) Kappalelista: rivi 0 = Poistu, rivit 1..N = kappaleet (valitut ✓)
        for (let i = 0; i <= trackCount; i++) {
            const y = listTop + i * (rowH + rowGap);
            const selected = (i === jukeSel);
            const picked = (i > 0) && !!jukePick[i - 1];
            const playingRow = playing && i > 0 && i === curTrack;
            // Tausta: kursori = kirkas pinkki (tumma teksti), soitossa = kulta,
            // listalle otettu = violetti, muut = tumma
            const bg     = selected ? '#ff3d7f' : (playingRow ? '#2b2410' : (picked ? '#241a3a' : '#171122'));
            const border = selected ? '#ffd0e2' : (playingRow ? '#ffdd88' : (picked ? '#ffd700' : '#3a3348'));
            const fg     = selected ? '#1c000a' : (playingRow ? '#ffe9a8' : '#eae4f2');
            const dim    = selected ? '#5c1230' : (playingRow ? '#c9a95f' : '#948ca8');

            ctx.fillStyle = bg;
            ctx.fillRect(rowX, y, rowW, rowH);
            ctx.strokeStyle = border;
            ctx.lineWidth = 1;
            ctx.strokeRect(rowX + 0.5, y + 0.5, rowW - 1, rowH - 1);

            ctx.textBaseline = 'middle';
            const cy = Math.round(y + rowH / 2) + 1;
            const sideFs = Math.max(11, nameFs - 1);

            // Numero
            ctx.textAlign = 'left';
            ctx.fillStyle = fg;
            ctx.font = Math.max(8, Math.min(10, Math.round(nameFs * 0.62))) +
                       'px "Press Start 2P", monospace';
            ctx.fillText(String(i), rowX + 10, cy);

            // Kappaleen nimi + kesto (leikataan nimi, jos ei mahdu)
            let trackName = (i === 0) ? 'Exit' : JUKEBOX_TRACKS[i - 1].title;
            const durStr = (i > 0) ? ' (' + JUKEBOX_TRACKS[i - 1].duration + ')' : '';
            ctx.font = nameFs + 'px "Courier New", monospace';
            const durW = ctx.measureText(durStr).width;
            const maxW = Math.max(20, nameMaxW - durW);
            while (trackName.length > 4 && ctx.measureText(trackName).width > maxW) {
                trackName = trackName.slice(0, -2) + '…';
            }
            trackName += durStr;
            ctx.fillStyle = fg;
            ctx.fillText(trackName, rowX + 10 + numW, cy);

            // Oikea reuna: soitossa ♪ SOI, valitulla ✓ + hinta, muilla hinta,
            // Poistu-rivillä valittujen määrä
            ctx.textAlign = 'right';
            if (playingRow) {
                ctx.font = 'bold ' + sideFs + 'px "Courier New", monospace';
                ctx.fillStyle = selected ? fg : '#ffdd88';
                ctx.fillText('♪ PLAYING', rowX + rowW - 10, cy);
            } else if (i > 0) {
                ctx.font = sideFs + 'px "Courier New", monospace';
                ctx.fillStyle = selected ? fg : (picked ? '#ffe9a8' : '#ffd700');
                ctx.fillText((picked ? '✓ ' : '') + '1 🪙', rowX + rowW - 10, cy);
            } else if (pickCount > 0) {
                ctx.font = sideFs + 'px "Courier New", monospace';
                ctx.fillStyle = selected ? fg : '#8ce88c';
                ctx.fillText('▶ ' + pickCount + ' track(s)', rowX + rowW - 10, cy);
            } else {
                ctx.font = sideFs + 'px "Courier New", monospace';
                ctx.fillStyle = dim;
                ctx.fillText('–', rowX + rowW - 10, cy);
            }
        }
        ctx.textBaseline = 'alphabetic';
        // 5) Tilatekstit omassa laatikossaan (yksivärinen, ei läpinäkyvyyttä)
        ctx.fillStyle = '#16101f';
        ctx.fillRect(rowX, infoTop, rowW, infoH);
        ctx.strokeStyle = '#4a4160';
        ctx.lineWidth = 1;
        ctx.strokeRect(rowX + 0.5, infoTop + 0.5, rowW - 1, infoH - 1);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < info.length; i++) {
            const it = info[i];
            setFitFont(it.text, rowW - 16, infoFs, 9, '"Courier New", monospace');
            ctx.fillStyle = it.color;
            ctx.fillText(it.text, rowX + 8, Math.round(infoTop + infoH / 2 +
                         (i - (info.length - 1) / 2) * infoLineH));
        }
        ctx.textBaseline = 'alphabetic';

        // 6) Jukebox-kone oikealla – vain kun sille jää tilaa (ei peitä listaa)
        if (wide) {
            /* Soivan kappaleen kansikuva (v4.61): raidat 4–6 → kuva, muut → null */
            const cover = (curTrack > 0) ? jukeCovers[curTrack - 1] : null;
            drawJukeboxCabinet(panelX + panelW + CAB_GAP, GROUND_Y + 4, now, playing,
                               jukeSel > 0 || pickCount > 0, cover);
        }

        // 7) Alaohje (kiinteä ja terävä – ei vilkkumista)
        const helpTxt = '▲/▼ = select   (o)/Space = pick/remove   Enter = play & exit';
        ctx.textAlign = 'center';
        setFitFont(helpTxt, winW - 16, 12, 9, 'Arial, sans-serif');
        ctx.fillStyle = '#e9e9ef';
        ctx.fillText(helpTxt, 400, 380);
        ctx.textAlign = 'left';

        ctx.restore();
    }

    /* Jukebox-kone: Wurlitzer-henkinen kaappi (proseduraalinen, ei kuvatiedostoja
       – paitsi soivan kappaleen kansikuva, jos sellainen on, v4.61) */
    function drawJukeboxCabinet(x, baseY, now, playing, armed, cover) {
        const w = 176, h = 210;
        const top = baseY - h;
        const cx = x + w / 2;

        // Varjo lattialla
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse(cx, baseY + 2, w * 0.5, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Runko: tumma puu/metal, kaareva huippu
        const body = ctx.createLinearGradient(x, 0, x + w, 0);
        body.addColorStop(0, '#20120c');
        body.addColorStop(0.35, '#5a3a22');
        body.addColorStop(0.7, '#3a2418');
        body.addColorStop(1, '#20120c');
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.lineTo(x, top + 46);
        ctx.quadraticCurveTo(x, top, cx, top);
        ctx.quadraticCurveTo(x + w, top, x + w, top + 46);
        ctx.lineTo(x + w, baseY);
        ctx.closePath();
        ctx.fill();

        // Neonkaari: vuorotellen pinkki ja keltainen, hidas pulssi
        const segs = 9;
        const pulse = (Math.sin(now / 260) + 1) / 2;
        ctx.lineWidth = 5;
        for (let i = 0; i < segs; i++) {
            const a0 = Math.PI + (i / segs) * Math.PI;
            const a1 = Math.PI + ((i + 1) / segs) * Math.PI;
            if (i % 2 === 0) {
                ctx.strokeStyle = 'rgba(255,0,85,' + (0.5 + pulse * 0.45).toFixed(2) + ')';
                ctx.shadowColor = '#FF0055';
            } else {
                ctx.strokeStyle = 'rgba(255,221,136,' + (0.45 + (1 - pulse) * 0.45).toFixed(2) + ')';
                ctx.shadowColor = '#ffdd88';
            }
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.ellipse(cx, top + 46, w * 0.44, 40, 0, a0, a1);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Kromirivat kaaren alta alas
        for (let i = 1; i < 7; i++) {
            const rx = x + (w * i) / 7;
            const g = ctx.createLinearGradient(rx - 2, 0, rx + 2, 0);
            g.addColorStop(0, 'rgba(255,255,255,0.04)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
            g.addColorStop(1, 'rgba(0,0,0,0.3)');
            ctx.fillStyle = g;
            ctx.fillRect(rx - 2, top + 62, 4, baseY - top - 64);
        }

        /* Levypesä + levy. Jos **soivalla** kappaleella on kansikuva (raidat
           4–6) ja se on latautunut, kuva piirretään levypesän paikalle
           kuvasuhde säilyttäen; muuten levy piirretään täsmälleen kuten ennen
           (raidat 1–3 sekä tilanne, jossa mikään ei soi). */
        const recY = top + 80, recR = 28;
        ctx.fillStyle = '#0d0a10';
        ctx.beginPath(); ctx.arc(cx, recY, recR + 4, 0, Math.PI * 2); ctx.fill();
        const showCover = playing && !!cover && cover.ready;
        if (showCover) {
            const box = (recR + 4) * 2;                        // koko tumman ympyrän kattava alue
            const iw  = cover.img.naturalWidth  || 1;
            const ih  = cover.img.naturalHeight || 1;
            const k   = Math.min(box / iw, box / ih);          // kuvasuhde säilyy
            const dw  = Math.max(1, Math.round(iw * k));
            const dh  = Math.max(1, Math.round(ih * k));
            const dx  = Math.round(cx - dw / 2);
            const dy  = Math.round(recY - dh / 2);
            ctx.fillStyle = '#120e18';                         // taustalaatta
            ctx.fillRect(cx - recR - 4, recY - recR - 4, box, box);
            ctx.imageSmoothingEnabled = true;                  // valokuva → pehmennetty
            ctx.drawImage(cover.img, dx, dy, dw, dh);
            ctx.imageSmoothingEnabled = false;
            ctx.strokeStyle = 'rgba(255,221,136,0.55)';        // ohut kehys
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - recR - 4 + 0.5, recY - recR - 4 + 0.5, box - 1, box - 1);
        } else {
            ctx.fillStyle = '#171320';
            ctx.beginPath(); ctx.arc(cx, recY, recR, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.10)';
            ctx.lineWidth = 1;
            for (let r = 9; r < recR - 3; r += 3) { ctx.beginPath(); ctx.arc(cx, recY, r, 0, Math.PI * 2); ctx.stroke(); }
            ctx.fillStyle = '#ffdd88';
            ctx.beginPath(); ctx.arc(cx, recY, 3, 0, Math.PI * 2); ctx.fill();
        }
        if (playing) {
            /* Kierto näkyy myös kuvan päällä: piste levypesän reunalla */
            const spin = (now / 300) % (Math.PI * 2);
            const spinR = showCover ? recR + 2 : 18;
            ctx.fillStyle = showCover ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.4)';
            ctx.fillRect(cx + Math.cos(spin) * spinR - 1, recY + Math.sin(spin) * spinR - 1, 2, 2);
        }

        // Kaiutinritilä alaosassa
        for (let gy = baseY - 30; gy < baseY - 8; gy += 5) {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(x + 16, gy, w - 32, 2);
        }

        // Kolikkoluukku + hinta (terävä: yksivärinen teksti, ei läpinäkyvyyttä)
        const slotW = 46, slotH = 14;
        const sx = x + w - slotW - 12, sy = top + 62;
        ctx.fillStyle = '#2b2b34';
        ctx.fillRect(sx, sy, slotW, slotH);
        ctx.strokeStyle = armed ? '#FFD700' : '#8a7a2a';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, slotW - 1, slotH - 1);
        ctx.fillStyle = armed ? '#FFD700' : '#c8a000';
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('1 🪙', sx + slotW / 2, sy + 10);
        ctx.textAlign = 'start';

        // Jalusta
        ctx.fillStyle = '#170d08';
        ctx.fillRect(x + 6, baseY - 8, w - 12, 8);
    }

    /* ── BAR-huoneen seinätaulu (äitihahmo, kuva) ─────────────
       Kuva ladataan kerran. Jos se ei ole vielä valmis (tai lataus
       epäonnistuu), kehyksen sisään piirretään tumma varapinta → asettelu
       pysyy samana eikä piirto kaadu. `typeof Image` -tarkistus pitää
       headless-validonnat (Node-stub) toiminnassa. */
    const BAR_PIC_SRC = 'assets/justiina.png';
    const barPic = (typeof Image === 'function') ? new Image() : null;
    let barPicReady = false;
    if (barPic) {
        barPic.onload  = () => { barPicReady = true; };
        barPic.onerror = () => { barPicReady = false; };
        barPic.src = BAR_PIC_SRC;
    }

    /* ── BAR-huone (talo 8) ────────────────────── */
    function drawBarRoom() {
        // Täysin pimeä tausta
        ctx.fillStyle = '#100808';
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);

        // Seinä – lämmin sävy
        const ga = ctx.createLinearGradient(0, 0, 0, WORLD_H);
        ga.addColorStop(0, '#1a1210');
        ga.addColorStop(1, '#252015');
        ctx.fillStyle = ga;
        ctx.fillRect(60, 60, WORLD_W - 120, WORLD_H - 120);

        // Pöytä
        const tw = 200, th = 14;
        const tx = (WORLD_W - tw) / 2, ty = GROUND_Y - 50;
        ctx.fillStyle = '#4a3520';
        ctx.fillRect(tx, ty, tw, th);
        ctx.fillStyle = '#5a4530';
        ctx.fillRect(tx + 4, ty - 2, tw - 8, 4);
        ctx.fillStyle = '#3a2510';
        ctx.fillRect(tx + 10, ty + th, 10, 50);
        ctx.fillRect(tx + tw - 20, ty + th, 10, 50);

        /* Iso hampurilainen – pöydän pinnalla, skaalattu 2/3:een (v4.25).
           Skaalaus tehdään pöydän pinnan keskipisteestä (bx, ty), joten
           hampurilaisen alaosa pysyy tarkalleen pöydän pinnassa. */
        const BURGER_SCALE = 2 / 3;
        const BURGER_H = 68;                 // alkuperäinen korkeus (by−26 … by+42)
        const bx = tx + tw / 2, by = ty - 42;
        const burgerTop = ty - BURGER_H * BURGER_SCALE;

        ctx.save();
        ctx.translate(bx, ty);
        ctx.scale(BURGER_SCALE, BURGER_SCALE);
        ctx.translate(-bx, -ty);

        // Alapulla
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(bx, by + 28, 40, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A0522D';
        ctx.beginPath();
        ctx.ellipse(bx, by + 25, 38, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pihvi
        ctx.fillStyle = '#4a2010';
        ctx.fillRect(bx - 36, by + 13, 72, 18);
        ctx.fillStyle = '#3a1810';
        ctx.fillRect(bx - 33, by + 16, 66, 12);
        ctx.fillStyle = '#5a3020';
        ctx.beginPath();
        ctx.ellipse(bx, by + 13, 37, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Juusto
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(bx - 34, by + 8);
        ctx.lineTo(bx - 10, by - 2);
        ctx.lineTo(bx + 10, by + 8);
        ctx.lineTo(bx + 34, by + 8);
        ctx.lineTo(bx + 20, by + 13);
        ctx.lineTo(bx - 20, by + 13);
        ctx.closePath();
        ctx.fill();

        // Salaatti
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.moveTo(bx - 34, by);
        for (let i = 0; i < 12; i++) {
            const sx = bx - 34 + i * 5.8;
            const sy = by + Math.sin(i * 0.8) * 3;
            ctx.lineTo(sx, sy);
        }
        ctx.lineTo(bx + 34, by + 5);
        ctx.lineTo(bx - 34, by + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#388E3C';
        ctx.beginPath();
        ctx.moveTo(bx - 34, by);
        for (let i = 0; i < 12; i++) {
            const sx = bx - 34 + i * 5.8;
            const sy = by + Math.sin(i * 0.8) * 3;
            ctx.lineTo(sx, sy + 1);
        }
        ctx.lineTo(bx + 34, by + 6);
        ctx.lineTo(bx - 34, by + 2);
        ctx.closePath();
        ctx.fill();

        // Ylapulla
        ctx.fillStyle = '#A0522D';
        ctx.beginPath();
        ctx.ellipse(bx, by - 8, 38, 18, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(bx, by - 10, 40, 16, 0, Math.PI, 0);
        ctx.fill();

        // Seesaminsiemenet
        ctx.fillStyle = '#F5DEB3';
        var seeds = [[-12, -16], [5, -19], [18, -14], [-20, -10], [25, -8],
            [-8, -6], [0, -5], [15, -6], [-16, -5], [10, -10]];
        for (var si = 0; si < seeds.length; si++) {
            ctx.fillRect(bx + seeds[si][0], by + seeds[si][1], 3, 3);
        }

        // Hoyry
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        var steamT = Date.now() / 600;
        for (var si2 = 0; si2 < 3; si2++) {
            var sx2 = bx - 15 + si2 * 15;
            var sy2 = by - 30 + Math.sin(steamT + si2 * 2.1) * 8;
            ctx.beginPath();
            ctx.moveTo(sx2, sy2);
            ctx.quadraticCurveTo(sx2 + 4, sy2 - 10, sx2 + 8, sy2 - 3);
            ctx.stroke();
        }

        ctx.restore();   // hampurilaisen skaalaus päättyy

        /* ── Asettelu: taulu + äidin lappu + ostotilanne ────────────────
           Kaikki mitoitetaan siitä ikkunasta, joka ruudulla oikeasti näkyy
           (kuten jukebox-huoneessa v4.22): mobiilissa canvas on vain `viewW`
           leveä ja kamera keskittää huoneen (camX), joten kiinteä 800 px:n
           asettelu jäisi kankaan ulkopuolelle. Fonttikoko valitaan näytön
           skaalan mukaan (`needPx`) → tekstit pysyvät luettavina myös
           puhelimen vaakanäytössä. Sisältö mahtuu aina seinän yläreunan
           (y = 60) ja ostorivin väliin eikä mikään osu hampurilaiseen. */
        const winW = Math.round(Math.min(WORLD_W, Math.max(VIEWW_MIN, viewW)));
        const vs = (canvas && canvas.height && canvas.clientHeight)
            ? canvas.clientHeight / canvas.height : 1;
        const vsafe = (vs > 0.25) ? vs : 1;
        const needPx = (target, base, max) =>
            Math.round(Math.max(base, Math.min(max, target / vsafe)));

        /* Suurin fonttikoko, jolla kaikki `rows`-rivit mahtuvat maxW:iin */
        const fitFs = (rows, weight, baseFs, minFs, family, maxW) => {
            let w = 0;
            ctx.font = weight + ' ' + baseFs + 'px ' + family;
            for (let i = 0; i < rows.length; i++) {
                w = Math.max(w, ctx.measureText(rows[i]).width);
            }
            if (w <= maxW) return baseFs;
            return Math.max(minFs, Math.floor(baseFs * maxW / w));
        };

        /* Äidin lappu – 3 riviä (varoitus hampurilaisten kulutuksesta) */
        const hintLines = [
            'WATCH YOUR BURGER INTAKE',
            'REMEMBER TO EAT, MARKO!',
            'Love, Mum'
        ];
        const boxPad = 36;                    // laatikon sisämarginaali
        const hintFs = fitFs(hintLines, 'bold', needPx(12, 10, 12), 8,
                             '"Courier New", monospace', winW - 28 - boxPad);
        ctx.font = 'bold ' + hintFs + 'px "Courier New", monospace';
        let maxHintW = 0;
        for (let m = 0; m < hintLines.length; m++) {
            maxHintW = Math.max(maxHintW, ctx.measureText(hintLines[m]).width);
        }
        const hintBoxW = Math.ceil(maxHintW + boxPad);
        const hintLineH = hintFs + 3;
        const hintBoxH = hintLineH * 3 + 6;

        /* Ostotilanteen rivi – fontti pisimmän vaihtoehdon mukaan */
        const infoRows = [
            'You bought ' + Math.max(barBuyQty, 1) + 'x🍔 burgers!',
            '🍔 Burger quota full. Buy something else!',
            '🍔 No coins. Get some cash!'
        ];
        const infoFs = fitFs(infoRows, 'normal', needPx(15, 13, 15), 8,
                             '"Courier New", monospace', winW - 24);
        const infoBaseline = Math.round(burgerTop - 8);

        /* Sijoitus alhaalta ylös: ostorivi (hampurilaisen yläpuolella),
           sen alla äidin lappu ja ylimpänä pieni seinätaulu ohuissa
           mustissa kehyksissä. Taulu on kiinteän kokoinen (ei täytä koko
           seinää) ja keskitetään seinän yläreunan ja lapun väliin. */
        const infoTop = infoBaseline - infoFs;
        const noteX = Math.round(400 - hintBoxW / 2);
        const noteY = Math.round(infoTop - 4 - hintBoxH);
        const PIC_PAD = 2;                    // mustan kehyksen paksuus
        const PIC_TOP = 60;                   // seinä alkaa y = 60
        const PIC_MAX_IMG_H = 48;             // kuvan maksimikorkeus (pieni taulu)
        const picAspect = (barPicReady && barPic.naturalHeight > 0)
            ? barPic.naturalWidth / barPic.naturalHeight : 315 / 261;
        const picBand = noteY - 6 - PIC_TOP;  // vapaa seinätila taululle
        let picImgH = Math.min(PIC_MAX_IMG_H, picBand - PIC_PAD * 2);
        let picImgW = picImgH * picAspect;
        const picMaxW = winW - 24;            // kapea ikkuna: ei reunojen yli
        if (picImgW + PIC_PAD * 2 > picMaxW) {
            picImgW = picMaxW - PIC_PAD * 2;
            picImgH = picImgW / picAspect;
        }
        const picFrameW = picImgW + PIC_PAD * 2;
        const picFrameH = picImgH + PIC_PAD * 2;
        const picX = Math.round(400 - picFrameW / 2);
        const picY = Math.round(PIC_TOP + (picBand - picFrameH) / 2);

        /* Taulun varjo seinälle, musta kehys ja kuva
           (varakuva, jos kuva ei ole vielä latautunut) */
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(picX + 3, picY + 4, picFrameW, picFrameH);
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(picX, picY, picFrameW, picFrameH);
        if (barPicReady) {
            ctx.imageSmoothingEnabled = true; // valokuva → pehmennetty skaalaus
            ctx.drawImage(barPic, picX + PIC_PAD, picY + PIC_PAD, picImgW, picImgH);
            ctx.imageSmoothingEnabled = false;
        } else {
            const pg = ctx.createLinearGradient(0, picY, 0, picY + picImgH);
            pg.addColorStop(0, '#242424');
            pg.addColorStop(1, '#0e0e0e');
            ctx.fillStyle = pg;
            ctx.fillRect(picX + PIC_PAD, picY + PIC_PAD, picImgW, picImgH);
        }

        /* Äidin lappu (keltaiset raamit) – taulun alla */
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(15, 8, 4, 0.9)';
        ctx.strokeStyle = '#ffcc44';
        ctx.lineWidth = 2;
        ctx.fillRect(noteX, noteY, hintBoxW, hintBoxH);
        ctx.strokeRect(noteX, noteY, hintBoxW, hintBoxH);
        ctx.font = 'bold ' + hintFs + 'px "Courier New", monospace';
        for (let hi = 0; hi < hintLines.length; hi++) {
            ctx.fillStyle = (hi === 2) ? '#ff6644' : '#ffdd88';
            ctx.fillText(hintLines[hi], noteX + hintBoxW / 2,
                         noteY + hintLineH * (hi + 1) + 1);
        }

        // Info-tekstit – ostomäärä = tämän vierailun ostot (▼ pienentää sitä)
        ctx.fillStyle = '#eeddcc';
        ctx.font = 'normal ' + infoFs + 'px "Courier New", monospace';
        ctx.textAlign = 'center';
        if (barBuyQty > 0) {
            ctx.fillText('You bought ' + barBuyQty + 'x🍔 burgers!', 400, infoBaseline);
        } else if (hamburgerCount >= 10) {
            ctx.fillText('🍔 Burger quota full. Buy something else!', 400, infoBaseline);
        } else if (coinCount <= 0) {
            ctx.fillText('🍔 No coins. Get some cash!', 400, infoBaseline);
        }

        // Ohjevihje: ▲ osta / ▼ peru / (o) poistu
        var pulse = Math.sin(Date.now() / 800) * 0.3 + 0.7;
        ctx.fillStyle = 'rgba(255,255,255,' + pulse + ')';
        var exitRow = '▲ = buy 1 🍔   ▼ = undo 1   EXIT: (o) / Space';
        ctx.font = Math.max(8, fitFs([exitRow], 'normal', 10, 8, 'Arial, sans-serif',
                                     winW - 24)) + 'px Arial, sans-serif';
        ctx.fillText(exitRow, 400, 370);
        ctx.textAlign = 'start';
    }

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

    /* Kaaos v10.18 – lamppu napsahtaa satunnaisesti hetkeksi punaiseksi
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
       (ks. render: pylväs piirretään joko ennen tai jälkeen pelaajan, v4.73). */
    function drawLampGlow(lamp) {
        if (cardState.lightsOut) return;   // K7-kortti "Valot sammuvat" (v10.05)
        const geom = lampGeom(lamp);
        const bx = geom.bx, bulbY = geom.bulbY;
        // Päivällä hehku himmenee (LAMP_DAY_DIM) ja moskiitot häipyvät
        // (MOSQUITO_DAY_DIM, v4.38). HUOM: lamp.lit ei muutu mihinkään →
        // yöllä ovet aukeavat potkaistusta lampusta täsmälleen kuten ennenkin.
        const dayDim = 1 - LAMP_DAY_DIM * dayT;
        const redSnap = lampRedSnap(lamp);   // kaaos v10.18: satunnainen punainen välähdys
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
        const dayDim = 1 - LAMP_DAY_DIM * dayT;   // hehkulampun piste + moskiitot

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
        } else if (lamp.lit && lampRedSnap(lamp)) {
            cupFill = '#ff5040';   // kaaos v10.18: hetkellinen punainen välähdys
        } else if (lamp.lit) {
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
        if (lamp.lit && dayDim > 0.01) {
            ctx.save();
            ctx.globalAlpha = dayDim;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(bx, bulbY + 4, 4, 0, Math.PI*2);
            ctx.fill();
            // Moskiitot lampun valossa – häipyvät päivällä kokonaan (v4.38)
            const mosquitoDim = 1 - MOSQUITO_DAY_DIM * dayT;
            if (mosquitoDim > 0.01) {
                ctx.globalAlpha = dayDim * mosquitoDim;
                const t = Date.now() * 0.001;
                const mAlphaMin = isTouchDevice ? 0.25 : 0.126;
                const mAlphaRange = isTouchDevice ? 0.2 : 0.063;
                const mRadius = isTouchDevice ? 2.0 : 1.3;
                const mGlow = isTouchDevice;
                for (let m = 0; m < 4; m++) {
                    const mt = t * (1.1 + m * 0.25);
                    const mx = bx + Math.cos(mt + m * 2.3) * (10 + Math.sin(mt * 0.6) * 5);
                    const my = bulbY + 6 + Math.sin(mt * 1.2 + m * 1.7) * (8 + Math.cos(mt * 0.8) * 4);
                    const malpha = mAlphaMin + Math.sin(mt * 2.5 + m) * mAlphaRange;
                    if (mGlow) {
                        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, mRadius * 2);
                        glow.addColorStop(0, 'rgba(255,220,140,' + malpha + ')');
                        glow.addColorStop(1, 'rgba(255,220,140,0)');
                        ctx.fillStyle = glow;
                        ctx.beginPath();
                        ctx.arc(mx, my, mRadius * 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.fillStyle = 'rgba(255,240,170,' + Math.min(1, malpha + (mGlow ? 0.15 : 0)) + ')';
                    ctx.beginPath();
                    ctx.arc(mx, my, mRadius, 0, Math.PI * 2);
                    ctx.fill();
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
        const isBar = (bldgIdx === 8);
        // Jukebox-talo (5): ovi näkyy auki vasta kun ikkunat on potkaistu valaistuiksi
        const isJukebox = (bldgIdx === JUKEBOX_BLDG_IDX);
        const jukeboxOpen = isJukebox && !!(smallHouseLights[bldgIdx] && smallHouseLights[bldgIdx].lit);
        // Laivanupotus (talo 2): sama mekanismi, aina auki yöllä ja päivällä
        const isSinkship = (bldgIdx === SINKSHIP_BLDG_IDX);
        const sinkshipOpen = isSinkship && !!(smallHouseLights[bldgIdx] && smallHouseLights[bldgIdx].lit);
        // Makuuhuone (talo 7): ovi on aina auki (v4.43, kuten BAR)
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
            ctx.fillStyle = ownerLamp.lit ? '#ffd700' : '#222';
            if (ownerLamp.lit) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 6; }
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
            // Päivällä kyltti sammutettu (jukebox auki vain öisin, v4.34):
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

    /* ── Sädease-esine kadulla (v10.20 / v11.13) ───────────── */
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
        /* v11.13: pieni vilkkuva keltainen piste piipun yllä. Vain PISTE vilkkuu
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

    /* ── Säde: pystyviiva pelaajasta tähtäyspisteeseen (v10.20) ── */
    function drawBeam() {
        // Tähtäysristikko vain PC:llä (hiiri), kun tähtäys aktiivinen
        if (beamCanFire() && !isTouchDevice && aimActive) {
            ctx.strokeStyle = 'rgba(150,210,255,0.9)';
            ctx.lineWidth = 1;
            const r = 4;
            ctx.beginPath();
            ctx.moveTo(aimX - r, aimY); ctx.lineTo(aimX + r, aimY);
            ctx.moveTo(aimX, aimY - r); ctx.lineTo(aimX, aimY + r);
            ctx.stroke();
            ctx.beginPath(); ctx.arc(aimX, aimY, 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(150,210,255,0.4)';
            ctx.stroke();
        }
        // Laser-valoraita: kirkas ydin + hehku, häipyy ~1 s ajan (v10.21)
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
       LAMP_BASE_Y:hin, jotta eläin piirtyy pylvään eteen tai taakse (v4.77). */
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

    /* ── Ajoneuvo ──────────────────────────────────── */
    function drawVehicle(v) {
        if (!v) return;
        const vx = Math.round(v.x), vy = Math.round(v.y), dir = v.direction;
        // Ajovalot himmenevät päivällä (v4.35) – sama liuku kuin katuvaloissa.
        // Takavalot ja ambulanssin kattovilkku eivät muutu (eivät ole ajovaloja).
        const headlightDim = 1 - VEHICLE_HEADLIGHT_DIM * dayT;
        const headlightOn  = v.hasHeadlight !== false && headlightDim > 0.01;
        ctx.save();
        if (dir === -1) { ctx.translate(vx + v.w / 2, 0); ctx.scale(-1, 1); ctx.translate(-(vx + v.w / 2), 0); }

        if (v.type === 'car') {
            const cx = vx, cy = vy;
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx + 3, cy + v.h - 4, v.w - 6, 6);
            ctx.fillStyle = '#9a9a9a'; ctx.fillRect(cx + 2, cy + 2, v.w - 4, v.h - 10);
            ctx.fillStyle = '#7a7a7a'; ctx.fillRect(cx + 10, cy, v.w - 20, v.h - 14);
            ctx.fillStyle = '#6ab8c8'; ctx.fillRect(cx + v.w - 20, cy + 3, 8, v.h - 18);
            ctx.fillStyle = '#558899'; ctx.fillRect(cx + 8, cy + 3, 7, v.h - 18);
            ctx.fillStyle = '#558899'; ctx.fillRect(cx + 26, cy + 3, 12, v.h - 18);
            ctx.fillStyle = '#cccccc'; ctx.fillRect(cx + v.w - 6, cy + v.h - 18, 6, 8);
            ctx.fillStyle = '#aaaaaa'; ctx.fillRect(cx, cy + v.h - 18, 5, 8);
            if (headlightDim > 0.01) {               // ajovalo + hehku (pois päivällä, v4.35)
                ctx.globalAlpha = headlightDim;
                ctx.fillStyle = '#ffee88'; ctx.fillRect(cx + v.w - 4, cy + 6, 5, 4);
                ctx.fillStyle = 'rgba(255,240,150,0.4)'; ctx.fillRect(cx + v.w + 1, cy + 5, 3, 6);
                ctx.globalAlpha = 1;
            }
            ctx.fillStyle = '#cc3333'; ctx.fillRect(cx - 1, cy + 6, 4, 3);
            const wr = 5;
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx + 14, cy + v.h - 4, wr, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + v.w - 14, cy + v.h - 4, wr, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(cx + 14, cy + v.h - 4, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + v.w - 14, cy + v.h - 4, 2.5, 0, Math.PI * 2); ctx.fill();
        } else if (v.type === 'ambulance') {
            const cx = vx, cy = vy;
            // Varjo
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx + 3, cy + v.h - 4, v.w - 6, 6);
            // Valkoinen kori
            ctx.fillStyle = '#e8e8e8'; ctx.fillRect(cx + 2, cy + 4, v.w - 4, v.h - 14);
            // Katto
            ctx.fillStyle = '#f4f4f4'; ctx.fillRect(cx + 6, cy + 1, v.w - 12, v.h - 15);
            // Tumma alareuna
            ctx.fillStyle = '#555'; ctx.fillRect(cx + 4, cy + v.h - 12, v.w - 8, 2);
            // Punainen risti kyljessä
            const rcx = cx + v.w / 2, rcy = cy + 14;
            ctx.fillStyle = '#cc0000';
            ctx.fillRect(rcx - 12, rcy - 2, 24, 4);
            ctx.fillRect(rcx - 2, rcy - 12, 4, 24);
            // Etuikkuna
            ctx.fillStyle = '#6ab8c8'; ctx.fillRect(cx + v.w - 18, cy + 5, 10, v.h - 21);
            // Takaikkuna
            ctx.fillStyle = '#558899'; ctx.fillRect(cx + 4, cy + 5, 6, v.h - 21);
            // Keltainen vilkkuvalo katolla + hehku (vilkkuva)
            const flashOn = Math.sin(Date.now() * 0.012) > -0.3;
            if (flashOn) {
                ctx.fillStyle = '#ffcc00'; ctx.fillRect(cx + v.w/2 - 4, cy - 3, 8, 4);
                ctx.fillStyle = 'rgba(255,240,100,0.45)'; ctx.fillRect(cx + v.w/2 - 2, cy - 5, 4, 3);
                ctx.fillRect(cx + v.w/2 - 6, cy - 2, 12, 2);
            }
            // Renkaat
            const wr = 5;
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx + 14, cy + v.h - 4, wr, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + v.w - 14, cy + v.h - 4, wr, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(cx + 14, cy + v.h - 4, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + v.w - 14, cy + v.h - 4, 2.5, 0, Math.PI * 2); ctx.fill();
            // Takavalo
            ctx.fillStyle = '#cc3333'; ctx.fillRect(cx - 1, cy + v.h - 16, 4, 3);
        } else if (v.type === 'motorcycle') {
            // ── Mopo + kuski (kerrokset: runko → kuski → etukate/tanko) ──
            const cx = vx, cy = vy;

            // 1. Maavarjo
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx + 2, cy + v.h - 2, v.w - 4, 4);

            // 2. Renkaat (takana + edessä)
            const wr = 5;
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(cx + 7, cy + v.h - 5, wr, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + v.w - 7, cy + v.h - 5, wr, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#555';
            ctx.beginPath(); ctx.arc(cx + 7, cy + v.h - 5, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + v.w - 7, cy + v.h - 5, 2, 0, Math.PI * 2); ctx.fill();

            // 3. Runko + penkki (taainnaisena)
            ctx.fillStyle = '#B71C1C';                       // astinlauta
            ctx.fillRect(cx + 15, cy + 15, 14, 3);
            ctx.fillStyle = '#D32F2F';                       // moottorin kate (punainen runko)
            ctx.fillRect(cx + 3, cy + 8, 15, 9);
            ctx.fillStyle = '#222222';                       // penkki
            ctx.fillRect(cx + 3, cy + 4, 12, 4);

            // 4. Kuski (istuu penkillä, pelaajan värit)
            ctx.fillStyle = '#3366cc';                       // vartalo (sininen paita)
            ctx.fillRect(cx + 4, cy - 8, 9, 12);
            ctx.fillStyle = '#16265c';                       // jalat (housut)
            ctx.fillRect(cx + 8, cy + 4, 7, 4);              //   reisi eteen
            ctx.fillRect(cx + 13, cy + 8, 3, 8);             //   sääri astinlaudalle
            ctx.fillStyle = '#ffcc99';                       // pää (iho)
            ctx.fillRect(cx + 4, cy - 16, 8, 9);
            ctx.fillStyle = '#553300';                       // hiukset (otsatukka)
            ctx.fillRect(cx + 10, cy - 15, 2, 2);
            ctx.fillStyle = '#2b2118';                       // silmä (katse eteen)
            ctx.fillRect(cx + 10, cy - 12, 2, 2);
            ctx.fillStyle = '#3366cc';                       // lippis (kupu)
            ctx.fillRect(cx + 3, cy - 19, 11, 4);
            ctx.fillStyle = '#224488';                       // lippis (lippa eteen)
            ctx.fillRect(cx + 11, cy - 17, 6, 3);
            ctx.fillStyle = '#3366cc';                       // käsi ojennettuna tankoon
            ctx.beginPath();
            ctx.moveTo(cx + 10, cy - 5);                     //   olkapää
            ctx.lineTo(cx + 21, cy - 2);                     //   ranne
            ctx.lineTo(cx + 20, cy + 1);                     //   ranteen alaosa
            ctx.lineTo(cx + 9, cy - 1);                      //   kainalo
            ctx.fill();
            ctx.fillStyle = '#ffcc99';                       // sormet tangolla
            ctx.fillRect(cx + 20, cy - 3, 3, 4);

            // 5. Etukate + ohjaustanko (kuskin päälle → syvyys)
            ctx.fillStyle = '#D32F2F';
            ctx.beginPath();
            ctx.moveTo(cx + 29, cy + 17);
            ctx.lineTo(cx + 25, cy + 3);
            ctx.lineTo(cx + 33, cy + 3);
            ctx.lineTo(cx + 37, cy + 17);
            ctx.fill();
            ctx.fillStyle = '#555555';                       // tanko + mittaristo
            ctx.fillRect(cx + 20, cy, 12, 3);

            // 6. Valot
            ctx.fillStyle = '#cc3333';                       // takavalo (jää palamaan)
            ctx.fillRect(cx + 1, cy + 8, 2, 4);
            if (headlightDim > 0.01) {                       // etuvalo pois päivällä (v4.35)
                ctx.globalAlpha = headlightDim;
                ctx.fillStyle = '#ffee88';                   // etuvalo
                ctx.fillRect(cx + 34, cy + 3, 3, 4);
                ctx.fillStyle = 'rgba(255,240,150,0.4)';     // etuvalon hehku
                ctx.fillRect(cx + 37, cy + 3, 2, 4);
                ctx.globalAlpha = 1;
            }
        } else if (v.type === 'tank') {
            const cx = vx, cy = vy;
            
            // 1. Varjo (pidetään vähän leveämpänä)
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; 
            ctx.fillRect(cx - 2, cy + v.h - 4, v.w + 4, 8);

            // 2. Tykkiputki – osoittaa AINA kulkusuuntaan (eteenpäin +x; dir = -1
            //    peilataan drawVehiclesin alussa, joten sama piirto kääntyy itse).
            //    3× pidempi kuin ennen (25 → 75 px). Gradientti kuten lampputolvessa
            //    (tumma–vaalea–tumma) mutta mustana.
            const barrelLen = 75;                 // 3 × vanha 25 px
            const barrelH   = 5;                  // putken paksuus
            const barrelY   = cy + 8;             // putken yläreuna
            const barrelX   = cx + v.w - 20;      // takaosa jää tornin sisään piiloon
            const muzzleW   = 9, muzzleH = 9;     // suujarru (paksumpi pää)
            const muzzleY   = barrelY - (muzzleH - barrelH) / 2;
            const barrelGrad = ctx.createLinearGradient(0, muzzleY, 0, muzzleY + muzzleH);
            barrelGrad.addColorStop(0,   '#0e0e0e');  // yläreuna (tumma)
            barrelGrad.addColorStop(0.5, '#555555');  // keskusta (vaalea)
            barrelGrad.addColorStop(1,   '#0a0a0a');  // alareuna (tummin)
            ctx.fillStyle = barrelGrad;
            ctx.fillRect(barrelX, barrelY, barrelLen, barrelH);                     // putki
            ctx.fillRect(barrelX + barrelLen - muzzleW, muzzleY, muzzleW, muzzleH); // suujarru

            // 3. Maastovärinen panssarirunko
            ctx.fillStyle = '#5a6b3c'; 
            ctx.fillRect(cx, cy + 8, v.w, v.h - 18);
            // Rungon viisteet/yksityiskohdat
            ctx.fillStyle = '#4a5730';
            ctx.fillRect(cx, cy + 8, v.w, 3); // Tummempi yläreuna rungossa

            // 4. Torni (Keskitetympi, vähän korkeampi)
            ctx.fillStyle = '#4d5c32'; 
            ctx.fillRect(cx + 10, cy + 2, v.w - 20, v.h - 22);
            ctx.fillStyle = '#3f4d28'; 
            ctx.fillRect(cx + 14, cy + 2, v.w - 28, v.h - 22);
            
            // 5. Tornin luukku (Se mitä piirsit punaisella ylös)
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(cx + v.w / 2 - 8, cy, 16, 3); // Luukun pohja
            ctx.fillStyle = '#111';
            ctx.fillRect(cx + v.w / 2 - 4, cy - 1, 8, 2); // Luukun kansi

            // 6. Telaketjujen tausta (Koko alaosan peittävä muoto)
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.moveTo(cx + 2, cy + v.h - 10);      // Ylä-vasen
            ctx.lineTo(cx + v.w - 2, cy + v.h - 10);// Ylä-oikea
            ctx.lineTo(cx + v.w, cy + v.h - 2);     // Ala-oikea (viistottu)
            ctx.lineTo(cx, cy + v.h - 2);           // Ala-vasen (viistottu)
            ctx.fill();

            // Telaketjun ylänauhan korostus
            ctx.fillStyle = '#333';
            ctx.fillRect(cx + 2, cy + v.h - 10, v.w - 4, 2);

            // 7. Telapyörät (Renkaat telaketjun sisällä)
            const numWheels = 5;
            const wheelSpacing = (v.w - 10) / (numWheels - 1); 
            
            for (let i = 0; i < numWheels; i++) {
                const wx = cx + 5 + (i * wheelSpacing);
                const wy = cy + v.h - 5; // Renkaiden Y-korkeus
                
                // Ulkorengas (harmaa)
                ctx.fillStyle = '#555555';
                ctx.beginPath(); 
                ctx.arc(wx, wy, 3.5, 0, Math.PI * 2); 
                ctx.fill();
                
                // Renkaan napa/keskiö (tumma)
                ctx.fillStyle = '#111111';
                ctx.beginPath(); 
                ctx.arc(wx, wy, 1.5, 0, Math.PI * 2); 
                ctx.fill();
            }

            // 8. Tummia yksityiskohtia (pieniä pakoputkia/tuuletusaukkoja takaosaan, vasemmalle)
            ctx.fillStyle = '#222';
            ctx.fillRect(cx + 4, cy + 10, 6, 2);
            ctx.fillRect(cx + 4, cy + 14, 6, 2);
        }

        // ── Ajovalot eteenpäin (kaikille ajoneuvotyypeille) ──
        //    Himmenevät päivällä (v4.35); kun kartio on kokonaan himmennyt,
        //    sitä ei piirretä lainkaan.
        if (headlightOn) {
            ctx.globalAlpha = headlightDim;
            const beamY = v.type === 'motorcycle' ? vy + v.h * 0.3 : vy + v.h - 12;
            const beamLen = v.type === 'ambulance' ? 140 : v.type === 'car' ? 105 : 70;
            const beamSpread = 10;
            const beamGrad = ctx.createLinearGradient(vx + v.w, beamY, vx + v.w + beamLen, beamY);
            beamGrad.addColorStop(0, 'rgba(255,250,220,0.32)');
            beamGrad.addColorStop(0.4, 'rgba(255,250,220,0.12)');
            beamGrad.addColorStop(1, 'rgba(255,250,220,0)');
            ctx.fillStyle = beamGrad;
            ctx.beginPath();
            ctx.moveTo(vx + v.w, beamY - 3);
            ctx.lineTo(vx + v.w + beamLen, beamY - beamSpread);
            ctx.lineTo(vx + v.w + beamLen, beamY + beamSpread);
            ctx.lineTo(vx + v.w, beamY + 3);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
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

    /* ── Rosvo (v4.66) – pelaajan kaksonen mustissa vaatteissa (Spy vs Spy),
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

    /* ── Pelaaja avoimessa kaivossa (v4.51) ─────────
       Pudotus: hahmo kutistuu nopeasti reiän keskipisteeseen → vajoaa alas ja
       katoaa (musta aukko piirretään päälle: drawManholeOverlay).
       Ylöskiipeäminen: nousee hitaasti (~3,5 s) reiän keskeltä, askel reunan
       yli viimeistelee – pieni sivuttaisheilunta tekee köpimisen tunnun. */
    function drawPlayerManhole() {
        const a = mhAction;
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
        for (const lamp of lamps) {
            if (!lamp.lit) continue;
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
        // Sädease kädessä (v10.21): harmaa kepakko 45° kulmassa etukädessä, osoittaa eteen-ylös
        if (beamWeaponCollected) {
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
        const CONTROL_RESERVE = isLandscape ? 0 : 185;   // D-padin korkeus + marginaali
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

    return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession };
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
    /* ═══ Automaattinen hover-kierros (v11.03–v11.05b, mobiili + nopeutus v11.17) ═══
       Kun valikko ("CHOOSE YOUR CHAOS LEVEL") on auennut, hover-efekti liukuu
       kerran kaikkien viiden kaaosnapin yli ylhäältä alas: 1 s valikon
       avautumisesta, sen jälkeen 10 s välein (kierroksen alusta alkuun)
       niin kauan kuin valikko on auki. Yksi nappi kerrallaan 346 ms
       (v11.17: 450 → 346 ms eli +30 % nopeampi), ja viimeinen (FULL CHAOS)
       jää päälle 2 s – samalla koko näyttö tärisee.
       Efekti on pelkkä luokka .auto-hover (style.css = täsmälleen sama ulkoasu
       kuin :hover), joten oikea hiiri ja täppäys toimivat koko ajan
       normaalisti – oikea osoitin myös keskeyttää käynnissä olevan liu'un.
       Esteettömyys (v11.17): liikkeen vähentäminen (reduce-motion) EI enää
       sammuta koko kierrosta – nappi välähtää kuten ennenkin, mutta näytön
       tärinä jää pois (motion=false). Sama linjaus kuin INSTRUCTIONS-
       vilkunnassa (v10.31): pelkkä kirkkauden vaihtelu ei aiheuta
       liikeherkkyyttä, ja moni Android raportoi reduce-motionin ollessa
       "poista animaatiot" -tilassa → efekti katosi puhelimilta kokonaan.
       Tärinän estää joka tapauksessa myös style.css:n
       @media (prefers-reduced-motion: reduce) -sääntö (#chaos-menu.shaking).
       Kosketuslaitteet (v11.17): mouseenter-peruutus kiinnitetään vain
       laitteille, jotka oikeasti osaavat hoveroida ((hover: hover)), koska
       puhelimen synteettinen mouseenter saattoi tappaa käynnissä olevan
       liu'un; kosketuslaitteen vastine on nappialueen touchstart.
       Testikytkin: ?autohover=0 (ei tallennu). */
    const AUTO_HOVER_ON        = urlParams.get('autohover') !== '0';
    const AUTO_HOVER_START_MS  = 1000;    // viive siitä, kun valikko on auennut
    const AUTO_HOVER_REPEAT_MS = 10000;   // kierroksen alusta seuraavan alkuun = 10 s
    const AUTO_HOVER_STEP_MS   = 346;     // yksi nappi kerrallaan (4 × 346 ms ennen FULL CHAOSia)
    /* v11.05: viimeinen nappi (FULL CHAOS) jää päälle ja koko näyttö tärisee
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
        // v11.05: tärinä katkeaa aina samalla (oikea hiiri, valinta, stopAutoHover)
        if (autoHoverShakeEl) autoHoverShakeEl.classList.remove(AUTO_HOVER_SHAKE_CLASS);
    }
    function stopAutoHover() {
        if (autoHoverNext) { clearTimeout(autoHoverNext); autoHoverNext = null; }
        clearAutoHover();
    }
    function autoHoverSweep() {
        if (!AUTO_HOVER_ON || started || document.hidden) return;             // peli käynnistynyt / välilehti piilossa
        if (menu.classList.contains('hidden') || menu.classList.contains('faded')) return;
        if (insOpen || insClosing) return;                                    // ohjeikkuna päällä
        /* v11.17: reduce-motion ei enää estä koko kierrosta – vain tärinä jää
           pois (motion = false). Väri-/kirkkausvälähdys säilyy, koska se ei ole
           liikettä (sama linjaus kuin INSTRUCTIONS-vilkunnassa v10.31). */
        const motion = !insReducedMotion();
        clearAutoHover();
        const btns = autoHoverBtns();
        if (!btns.length) return;
        const under = document.querySelector('.chaos-buttons button:hover');  // oikea osoitin voittaa aina
        const last = btns.length - 1;
        btns.forEach((btn, i) => {
            if (btn === under) return;
            const hold = (i === last) ? AUTO_HOVER_HOLD_MS : 0;   // vain FULL CHAOS jää päälle (v11.05)
            autoHoverTimers.push(setTimeout(() => btn.classList.add('auto-hover'), i * AUTO_HOVER_STEP_MS));
            autoHoverTimers.push(setTimeout(() => btn.classList.remove('auto-hover'),
                                            i * AUTO_HOVER_STEP_MS + (hold || AUTO_HOVER_STEP_MS)));
            if (hold && motion && autoHoverShakeEl) {   // v11.05: näytön tärinä pidon ajaksi (v11.17: vain kun liike sallittu)
                autoHoverTimers.push(setTimeout(() => autoHoverShakeEl.classList.add(AUTO_HOVER_SHAKE_CLASS), i * AUTO_HOVER_STEP_MS));
                autoHoverTimers.push(setTimeout(() => autoHoverShakeEl.classList.remove(AUTO_HOVER_SHAKE_CLASS), i * AUTO_HOVER_STEP_MS + hold));
            }
        });
    }
    /* Kierros ajastetaan aina edellisen kierroksen alusta (ketjutettu setTimeout):
       setInterval ehtisi vanheta hitaalla laitteella ja 1. väli menisi 9 sekuntiin. */
    function scheduleAutoHover(delay) {
        autoHoverNext = setTimeout(() => {
            autoHoverNext = null;
            autoHoverSweep();
            if (AUTO_HOVER_ON && !started) scheduleAutoHover(AUTO_HOVER_REPEAT_MS);
        }, delay);
    }
    function startAutoHover() {
        /* v11.17: reduce-motion ei enää estä kierrosta (vain tärinä jää pois,
           ks. autoHoverSweep) – efekti käynnistyy nyt myös puhelimilla. */
        if (!AUTO_HOVER_ON || autoHoverNext) return;
        scheduleAutoHover(AUTO_HOVER_START_MS);
    }
    /* Oikea osoitin valikkoon keskeyttää käynnissä olevan liu'un heti.
       v11.17: peruutus kiinnitetään vain hoveroiville laitteille ((hover: hover)),
       koska kosketuslaitteen synteettinen mouseenter saattoi tappaa käynnissä
       olevan liu'un; kosketuslaitteen vastine on nappialueen touchstart
       (pelaajan oma täppäys voittaa aina, samoin kuin hiiri PC:llä). */
    const autoHoverZone = menu.querySelector('.chaos-buttons');
    const canHoverPointer = !!(window.matchMedia && window.matchMedia('(hover: hover)').matches);
    if (autoHoverZone && canHoverPointer) {
        autoHoverZone.addEventListener('mouseenter', clearAutoHover);
    }
    if (autoHoverZone) autoHoverZone.addEventListener('touchstart', clearAutoHover, { passive: true });

    menu.classList.remove('hidden');
    // Aloitusgate (v10.08): ensimmäinen ele avaa äänilukon ja näyttää chaos-valikon.
    const gate = document.getElementById('start-gate');
    const showMenu = () => {
        if (gate) gate.classList.add('hidden');
        menu.classList.remove('hidden');
        startAutoHover();   // v11.03: hover-kierto käyntiin, kun valikko on auennut
    };
    if (gate) {
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
            gate.classList.add('faded');   // v10.13: tekstit haihtuvat pois 2 s viiveen aikana
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
    /* Siirtymä (v11.02): kaaostason valinnasta näyttö mustenee 2 s
       (CHAOS_BLACKOUT_MS) ja valikkobiisi vaimenee samaan aikaan; peli
       käynnistyy mustan alla, minkä jälkeen katu paljastuu 1 s häivytyksellä
       (CHAOS_REVEAL_MS) → koko siirtymä on 3 s. Nupit: alla. */
    const CHAOS_BLACKOUT_MS = 2000;   // mustuminen + valikkobiisin häivytys
    const CHAOS_REVEAL_MS = 1000;     // mustan häivytys pois → katu näkyy
    const blackout = document.getElementById('chaos-blackout');
    let started = false;
    const start = (level) => {
        if (started) return;
        started = true;
        stopAutoHover();                    // v11.03: hover-kierto pois (valikko himmenee)
        menu.classList.add('faded');        // v10.14: tekstit haihtuvat pois ennen pelin alkua
        if (blackout) blackout.classList.add('on');   // v11.02: näyttö mustenee
        // v11.02: valikkobiisi vaimenee mustumisen aikana. Funktio on aina
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
            // v11.02: paljastus – musta häivytetään pois, sitten elementti pois tieltä
            if (blackout) {
                blackout.classList.remove('on');
                blackout.classList.add('reveal');
                setTimeout(() => {
                    blackout.classList.remove('reveal');
                    blackout.classList.add('hidden');
                }, CHAOS_REVEAL_MS);
            }
        }, CHAOS_BLACKOUT_MS);
    };
    menu.querySelectorAll('[data-level]').forEach(btn => {
        btn.addEventListener('click', () => start(btn.getAttribute('data-level')));
        btn.addEventListener('touchend', (e) => {
            if (e.cancelable) e.preventDefault();
            start(btn.getAttribute('data-level'));
        }, { passive: false });
    });
    /* ═══ Ohjeikkuna (v10.27) ═══════════════════════════════════════════
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
            blinkFinalWords();                   // "HAVE FUN!" vilkahtaa kerran (v10.30)
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
        span.className = 'ins-fun ins-blink';                   // .ins-blink = 1 vilkahdus (v10.30)
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
