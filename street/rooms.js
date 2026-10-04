/* ═══════════════════════════════════════════════════════════
   street/rooms.js – canvas-huoneiden PIIRTO (makuuhuone, jukebox, BAR)
   (Vaihe 5 osa 6, siirretty street.js:stä, PELKKÄ SIIRTO.)

   Sisältö: `drawSleepRoom` (sänky + Nuku/Poistu + Zzz-pimennys),
   `drawJukeboxRoom` + `drawJukeboxCabinet` (levy + neonkaari) ja
   `drawBarRoom` + `drawBarBeer` (olut, VAIN FULL) sekä BAR-taulun
   kuva-tila (BAR_PIC_SRC / barPic / barPicReady – ei käytetä muualla).

   Lisäksi HUONEIDEN LOGIIKKA (Vaihe 5 osa 8): updateSleepRoom /
   updateBarRoom / updateJukeboxRoom, jukeboxExitAndPlay + apurit ja
   closeSleepRoom / closeBarRoom / closeJukeboxRoom. Huoneiden tilamuuttujat
   (sleep-, bar- ja juke-) pysyvät street.js:n sulkeumassa ja sidotaan get+set
   -pareina; huonerekisteri `rooms[]`, closeNewsRoom ja closeRoom (silmukka)
   jäävät street.js:ään.

   Ulkopuolelta sidotaan (bind): live-getterit street.js:n sulkeuman
   arvoille + vakiot:
       ENV.ctx · ENV.canvas · ENV.viewW · ENV.camX · ENV.isDay · ENV.coinCount ·
       ENV.hamburgerCount · ENV.drunkLevel · ENV.barBuyQty · ENV.jukeQueue ·
       ENV.jukePick · ENV.jukeSel · ENV.jukeCovers · ENV.sleepPhase · ENV.sleepSel ·
       ENV.chaosFlags (olio) ·
       ENV.WORLD_W · ENV.WORLD_H · ENV.VIEWW_MIN · ENV.GROUND_Y · ENV.JUKEBOX_TRACKS ·
       ENV.SLEEP_DARK_FRAMES · ENV.SLEEP_ZZZ_FRAMES · ENV.SLEEP_FADE_FRAMES ·
       ENV.DRUNK_MAX · ENV.BAR_BEER_H · (osa 8) get+set sleep-, bar- ja
       juke-muuttujille, coinCount, hamburgerCount, hamburgerTimer, drunkLevel,
       drunkTimer, isDay, dayT, cycleChangeTimer, actionJustPressed, jukeQueue,
       jukeSavedPos + getterit jukePick, keys, state, burgerInterval,
       SLEEP_FADE_FRAMES, HUNGER_WAKE_GRACE, CYCLE_CHANGE_DELAY_FRAMES, DAY_FORCE
       ja apurit updateHUD / playCoin / saveChaosSession / resetMoon / resetSun /
       showNotification / StreetAudio

   Ladataan ENNEN street.js:iä (index.html). Testipenkit liittävät samat
   osat samassa järjestyksessä: tools/tests/street-src.cjs.
   ═══════════════════════════════════════════════════════════ */
var StreetRooms = (function () {
    /* ── Sidottu host (street.js asettaa bind():llä) ── */
    let ENV = null;
    function bind(host) { ENV = host; }

    /* ── Makuuhuone (ex-palkintohuone, talo 7) ────
       Ovi aina auki (ei avaimia eikä lamppua). Huoneessa on kaksi valintaa:
         Nuku   = vaihtaa päivä/yö-tilan (päivä → yö TAI yö → päivä)
         Poistu = ei muuta mitään
       Molemmat ovat ilmaisia. Sänky on piirretty sivusta (pääty, paksu patja,
       tyyny, peitto ja jalat), ja ikkunasta näkyy tämänhetkinen tila.

       SISÄLTÖ SOVITETAAN NÄKYVÄÄN IKKUNAAN (kuten jukebox): mobiilissa
       ENV.canvas on vain `ENV.viewW` (260–800) leveä ja kamera keskittää huoneen, joten
       kaikki sijoitetaan x = 400:n ympärille ja enintään `winW − 24` leveäksi.
       Koko piirto on save()/restore()-parin sisällä, ettei tila vuoda kadulle. */
    function drawSleepRoom() {
        const W = ENV.WORLD_W, H = ENV.WORLD_H;
        const now = Date.now();

        ENV.ctx.save();
        ENV.ctx.shadowBlur = 0;
        ENV.ctx.shadowColor = 'rgba(0,0,0,0)';
        ENV.ctx.textBaseline = 'alphabetic';

        /* Ikkunasovitus + fonttikoko (näytön skaala: kapea kännykkä zoomataan) */
        const winW   = Math.round(Math.min(ENV.WORLD_W, Math.max(ENV.VIEWW_MIN, ENV.viewW)));
        const wide   = winW >= 560;                 // sivuikkunalle jää tilaa
        const panelW = Math.max(196, winW - 24);
        const panelX = Math.round(400 - panelW / 2);
        const padX   = 12;
        const rowX   = panelX + padX;
        const rowW   = panelW - padX * 2;
        const vs = (ENV.canvas && ENV.canvas.height && ENV.canvas.clientHeight)
            ? ENV.canvas.clientHeight / ENV.canvas.height : 1;
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
        ENV.ctx.fillStyle = ENV.isDay ? '#241d2c' : '#07070f';
        ENV.ctx.fillRect(0, 0, W, H);
        const wall = ENV.ctx.createLinearGradient(0, 40, 0, ENV.GROUND_Y);
        if (ENV.isDay) {
            wall.addColorStop(0, '#3b3149');
            wall.addColorStop(1, '#4c4058');
        } else {
            wall.addColorStop(0, '#151326');
            wall.addColorStop(1, '#221f36');
        }
        ENV.ctx.fillStyle = wall;
        ENV.ctx.fillRect(40, 40, W - 80, ENV.GROUND_Y - 40);
        // Lattia + lautojen perspektiivi (sänky seisoo tällä)
        ENV.ctx.fillStyle = ENV.isDay ? '#2c2434' : '#0f0d18';
        ENV.ctx.fillRect(40, ENV.GROUND_Y, W - 80, H - ENV.GROUND_Y - 40);
        ENV.ctx.strokeStyle = ENV.isDay ? '#1d1722' : '#08070e';
        ENV.ctx.lineWidth = 1;
        ENV.ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
            const fx = 40 + i * (W - 80) / 8;
            ENV.ctx.moveTo(fx, ENV.GROUND_Y + 1);
            ENV.ctx.lineTo(fx + (fx - W / 2) * 0.16, H - 40);
        }
        ENV.ctx.stroke();

        // 2) Paneeli: otsikko + nykyinen tila + valinnat (yksi tumma laatta)
        ENV.ctx.fillStyle = '#0b0812';
        ENV.ctx.fillRect(panelX, panelTop, panelW, panelBottom - panelTop);
        ENV.ctx.strokeStyle = '#3a3348';
        ENV.ctx.lineWidth = 1;
        ENV.ctx.strokeRect(panelX + 0.5, panelTop + 0.5, panelW - 1, panelBottom - panelTop - 1);
        // Yläreunan sävy kertoo tilan: keltainen = päivä, sininen = yö
        ENV.ctx.fillStyle = ENV.isDay ? '#ffd070' : '#7c8ad8';
        ENV.ctx.fillRect(panelX, panelTop, panelW, 2);

        /* Otsikko: talo on HOSTEL – sama nimi kuin ulkona sinisessä
           neonkyltissä. Neon-sininen väri sitoo otsikon kylttiin.
           Press Start 2P on monospace → fontti sovitetaan paneeliin. */
        const roomTitle = 'HOSTEL - BEDROOM';
        let titleFs = needPx(16, 12, 16);
        ENV.ctx.textAlign = 'center';
        ENV.ctx.font = titleFs + 'px "Press Start 2P", monospace';
        const titleW = ENV.ctx.measureText(roomTitle).width;
        const titleMax = panelW - 16;
        if (titleW > titleMax) titleFs = Math.max(7, Math.floor(titleFs * titleMax / titleW));
        ENV.ctx.font = titleFs + 'px "Press Start 2P", monospace';
        ENV.ctx.fillStyle = '#7fdcff';
        ENV.ctx.fillText(roomTitle, 400, titleY);

        ENV.ctx.font = 'bold ' + nameFs + 'px "Courier New", monospace';
        ENV.ctx.fillStyle = ENV.isDay ? '#ffdd88' : '#c8d8ff';
        ENV.ctx.fillText('Now: ' + (ENV.isDay ? '☀️ Day' : '🌙 Night'), 400, stateY);

        /* 3) Valinnat: 0 = Nuku, 1 = Poistu
              ▲/▼ liikuttaa valintaa, ⚡ / Space / (o) vahvistaa */
        const rows = [
            { label: 'Sleep',  note: ENV.isDay ? '→ night' : '→ day' },
            { label: 'Exit',   note: 'no change' }
        ];
        for (let i = 0; i < rows.length; i++) {
            const y = listTop + i * (rowH + rowGap);
            const selected = (i === ENV.sleepSel);
            const bg     = selected ? '#ffd070' : '#171122';
            const border = selected ? '#fff3d0' : '#3a3348';
            const fg     = selected ? '#1c1400' : '#eae4f2';
            const dim    = selected ? '#5c4400' : '#948ca8';

            ENV.ctx.fillStyle = bg;
            ENV.ctx.fillRect(rowX, y, rowW, rowH);
            ENV.ctx.strokeStyle = border;
            ENV.ctx.lineWidth = 1;
            ENV.ctx.strokeRect(rowX + 0.5, y + 0.5, rowW - 1, rowH - 1);

            ENV.ctx.textBaseline = 'middle';
            const cy = Math.round(y + rowH / 2) + 1;
            ENV.ctx.textAlign = 'left';
            ENV.ctx.font = nameFs + 'px "Courier New", monospace';
            ENV.ctx.fillStyle = fg;
            ENV.ctx.fillText((selected ? '▶ ' : '   ') + rows[i].label, rowX + 8, cy);
            ENV.ctx.textAlign = 'right';
            ENV.ctx.fillStyle = dim;
            ENV.ctx.fillText(rows[i].note, rowX + rowW - 8, cy);
        }
        ENV.ctx.textBaseline = 'alphabetic';
        ENV.ctx.textAlign = 'center';
        ENV.ctx.font = Math.max(10, Math.min(nameFs - 1, 13)) + 'px Arial, sans-serif';
        ENV.ctx.fillStyle = '#e9e9ef';
        ENV.ctx.fillText('▲/▼ = select   ⚡/Space = confirm', 400, hintY);
        ENV.ctx.textAlign = 'left';

        // 4) Sänky sivusta: pääty, paksu patja, tyyny, peitto ja jalat
        const bedW  = Math.min(340, panelW - 16);
        const bedL  = Math.round(400 - bedW / 2);
        const bedR  = bedL + bedW;
        const bedFoot = ENV.GROUND_Y - 2;              // 308 – jalkojen pohja
        const legH = 10, frameH = 12, mattH = 38;
        const legTop   = bedFoot - legH;           // 298
        const frameTop = legTop - frameH;          // 286
        const mattTop  = frameTop - mattH;         // 248
        const headTop  = mattTop - 34;             // 214 – päädyn yläreuna
        const headW    = 13;
        const pillowW  = Math.round(bedW * 0.24);

        // Jalat
        ENV.ctx.fillStyle = '#241812';
        ENV.ctx.fillRect(bedL + 16, legTop, 9, legH);
        ENV.ctx.fillRect(bedR - 27, legTop, 9, legH);

        // Runko (patjan alla)
        ENV.ctx.fillStyle = '#2e2019';
        ENV.ctx.fillRect(bedL + 4, frameTop, bedW - 8, frameH);
        ENV.ctx.fillStyle = '#3d2a1d';
        ENV.ctx.fillRect(bedL + 4, frameTop, bedW - 8, 3);

        // Pääty (vasemmassa reunassa)
        ENV.ctx.fillStyle = '#33241a';
        ENV.ctx.fillRect(bedL, headTop, headW, frameTop - headTop + 6);
        ENV.ctx.fillStyle = '#48321f';
        ENV.ctx.fillRect(bedL + 3, headTop + 6, 7, frameTop - headTop - 14);

        // Tyyny
        ENV.ctx.fillStyle = '#efe6d2';
        ENV.ctx.fillRect(bedL + 18, mattTop - 12, pillowW, 20);
        ENV.ctx.fillStyle = '#fbf5e6';
        ENV.ctx.fillRect(bedL + 18, mattTop - 12, pillowW, 3);
        ENV.ctx.fillStyle = '#d8ceb6';
        ENV.ctx.fillRect(bedL + 18, mattTop + 4, pillowW, 4);

        // Paksu patja (yläreuna, runko, keskiviiva, alavarjo)
        ENV.ctx.fillStyle = '#cfc6b2';
        ENV.ctx.fillRect(bedL + 8, mattTop, bedW - 16, mattH);
        ENV.ctx.fillStyle = '#e7dfcb';
        ENV.ctx.fillRect(bedL + 8, mattTop, bedW - 16, 5);
        ENV.ctx.fillStyle = '#b8af9b';
        ENV.ctx.fillRect(bedL + 8, mattTop + Math.round(mattH / 2), bedW - 16, 1);
        ENV.ctx.fillStyle = '#a89f8c';
        ENV.ctx.fillRect(bedL + 8, mattTop + mattH - 5, bedW - 16, 5);

        // Peitto (jalkopää peittyy, tyyny jää näkyviin)
        const blkL = bedL + 24 + pillowW;
        const blkR = bedR - 8;
        ENV.ctx.fillStyle = '#3b4c86';
        ENV.ctx.fillRect(blkL, mattTop - 6, blkR - blkL, mattH + 8);
        ENV.ctx.fillStyle = '#4d61a6';
        ENV.ctx.fillRect(blkL, mattTop - 6, blkR - blkL, 4);
        ENV.ctx.fillStyle = '#2f3c6c';
        ENV.ctx.fillRect(blkL, mattTop + 12, blkR - blkL, 2);
        ENV.ctx.fillRect(blkL, mattTop + 24, blkR - blkL, 2);

        // 5) Ikkuna (vain kun sille jää tilaa): näyttää tämänhetkisen tilan
        if (wide) {
            const wx = 626, wy = 204, ww = 92, wh = 72;
            ENV.ctx.fillStyle = '#241d2e';
            ENV.ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
            const sky = ENV.ctx.createLinearGradient(0, wy, 0, wy + wh);
            if (ENV.isDay) { sky.addColorStop(0, '#4b8fd0'); sky.addColorStop(1, '#a8d4f0'); }
            else       { sky.addColorStop(0, '#0a1030'); sky.addColorStop(1, '#1b2352'); }
            ENV.ctx.fillStyle = sky;
            ENV.ctx.fillRect(wx, wy, ww, wh);

            if (ENV.isDay) {
                // Aurinko: tasainen keltainen kiekko (ei valkoista palloa keskellä)
                ENV.ctx.fillStyle = '#ffe066';
                ENV.ctx.beginPath(); ENV.ctx.arc(wx + ww * 0.7, wy + wh * 0.34, 11, 0, Math.PI * 2); ENV.ctx.fill();
                ENV.ctx.strokeStyle = 'rgba(255,224,120,0.85)';
                ENV.ctx.lineWidth = 1;
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4 + 0.3;
                    ENV.ctx.beginPath();
                    ENV.ctx.moveTo(wx + ww * 0.7 + Math.cos(a) * 15, wy + wh * 0.34 + Math.sin(a) * 15);
                    ENV.ctx.lineTo(wx + ww * 0.7 + Math.cos(a) * 20, wy + wh * 0.34 + Math.sin(a) * 20);
                    ENV.ctx.stroke();
                }
            } else {
                // Sirppikuu + pari tähteä
                ENV.ctx.fillStyle = '#fff8cc';
                ENV.ctx.beginPath(); ENV.ctx.arc(wx + ww * 0.7, wy + wh * 0.34, 11, 0, Math.PI * 2); ENV.ctx.fill();
                ENV.ctx.fillStyle = '#0a1030';
                ENV.ctx.beginPath(); ENV.ctx.arc(wx + ww * 0.7 + 5, wy + wh * 0.34 - 1, 9, 0, Math.PI * 2); ENV.ctx.fill();
                ENV.ctx.fillStyle = '#ffffff';
                ENV.ctx.fillRect(wx + 12, wy + 14, 2, 2);
                ENV.ctx.fillRect(wx + 27, wy + 24, 2, 2);
                ENV.ctx.fillRect(wx + 16, wy + 50, 2, 2);
            }

            // Ikkunaristikko + verhojen varjot reunoissa
            ENV.ctx.strokeStyle = '#2b2438';
            ENV.ctx.lineWidth = 2;
            ENV.ctx.beginPath();
            ENV.ctx.moveTo(wx + ww / 2, wy); ENV.ctx.lineTo(wx + ww / 2, wy + wh);
            ENV.ctx.moveTo(wx, wy + wh / 2); ENV.ctx.lineTo(wx + ww, wy + wh / 2);
            ENV.ctx.stroke();
            ENV.ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ENV.ctx.fillRect(wx, wy, 5, wh);
            ENV.ctx.fillRect(wx + ww - 5, wy, 5, wh);
        }

        // 6) Nukkumisen pimennys: ruutu tummuu mustaksi ~0,75 s aikana
        //    (ENV.SLEEP_DARK_FRAMES), minkä jälkeen itse "ZZzzZZzzzZzzz…"-efekti näkyy ~3 s
        //    (ENV.SLEEP_ZZZ_FRAMES) – yhteensä ~3,75 s. Tila vaihtuu vasta lopussa.
        //    HUOM: pimennys lasketaan KULUNEESTA ajasta (ei jäljellä olevasta),
        //    muuten musta kerros ja Zzz ehtivät mukaan vasta aivan lopussa.
        if (ENV.sleepPhase > 0) {
            const elapsed = ENV.SLEEP_FADE_FRAMES - ENV.sleepPhase;              // kulunut aika
            const fade = Math.max(0, Math.min(1, elapsed / ENV.SLEEP_DARK_FRAMES));
            ENV.ctx.fillStyle = 'rgba(0,0,0,' + fade.toFixed(3) + ')';
            ENV.ctx.fillRect(0, 0, W, H);
            if (fade > 0.05) {
                ENV.ctx.globalAlpha = fade;          // Zzz himmenee sisään pimennyksen mukana
                ENV.ctx.textAlign = 'center';
                ENV.ctx.font = 'bold ' + needPx(20, 16, 22) + 'px "Courier New", monospace';
                ENV.ctx.fillStyle = '#ffe9a8';
                ENV.ctx.fillText('ZZzzZZzzzZzzz…', 400, 250 + Math.round(Math.sin(now / 300) * 3));
                ENV.ctx.textAlign = 'left';
                ENV.ctx.globalAlpha = 1;
            }
        }

        ENV.ctx.restore();
    }

    /* ── Jukebox-huone (talo 5) ────────────────────
       Monivalinta: rivi 0 = Poistu, rivit 1..N = kappaleet (1 🪙 /
       kappale). Valitut soitetaan poistuttaessa yksi kerrallaan (1 → N).
       HUOM: jukebox ei muuta peliääniä mitenkään.

       SELKEYS: kaikki tekstit piirretään terävinä (ei
       shadowBlur-sumennusta eikä läpinäkyvää tekstiä) ja koko asettelu
       sovitetaan siihen ikkunaan, joka ruudulla oikeasti näkyy. Mobiilissa
       ENV.canvas on vain `ENV.viewW` leveä ja kamera keskittää huoneen (ENV.camX), joten
       kiinteä 800 px:n asettelu (tekstit x 62…) jäi kankaan ulkopuolelle –
       kapealla kännykällä näkyi vain listan keskikohta. Sisältö on nyt
       keskitetty x = 400:n ympärille ja enintään `winW − 24` leveäksi. */
    function drawJukeboxRoom() {
        const W = ENV.WORLD_W, H = ENV.WORLD_H;
        const now = Date.now();
        const playing = StreetAudio.isJukeboxPlaying();
        const trackCount = ENV.JUKEBOX_TRACKS.length;
        /* Soiva kappale jonon sijainnista: montako on jo soitettu.
           ENV.jukeQueue = kadun oma kopio soitettavista raidoista (1..N). */
        const qPos = StreetAudio.getJukeboxQueuePos();
        const curTrack = (playing && qPos >= 0 && qPos < ENV.jukeQueue.length) ? ENV.jukeQueue[qPos] : 0;
        let pickCount = 0;
        for (let i = 0; i < ENV.jukePick.length; i++) { if (ENV.jukePick[i]) pickCount++; }

        ENV.ctx.save();
        // Ei pehmennystä: nollataan kadulta mahdollisesti periytynyt hehku
        ENV.ctx.shadowBlur = 0;
        ENV.ctx.shadowColor = 'rgba(0,0,0,0)';
        ENV.ctx.textBaseline = 'alphabetic';

        /* Sovitus näkyvään ikkunaan (ks. selitys yllä) */
        const winW = Math.round(Math.min(ENV.WORLD_W, Math.max(ENV.VIEWW_MIN, ENV.viewW)));
        const wide = winW >= 620;                 // jukebox-kaappi mahtuu viereen
        const CAB_W = 176, CAB_GAP = 26, PANEL_MAX = 520;
        const panelW = Math.round(wide
            ? Math.min(PANEL_MAX, winW - CAB_W - CAB_GAP - 26)
            : Math.max(196, winW - 24));
        const panelX = Math.round(400 - (wide ? panelW + CAB_GAP + CAB_W : panelW) / 2);
        const padX = 12;
        const rowX = panelX + padX;
        const rowW = panelW - padX * 2;

        /* Näytön skaala (ENV.canvas CSS-px / puskurin px): kapea kännykkä
           zoomataan 1:1:tä suuremmaksi → fontin maailmakoko voi olla
           pienempi ja näkyä silti isona. `needPx` valitsee fontin
           maailmakoon niin, että ruudulla näkyy vähintään `target` px. */
        const vs = (ENV.canvas && ENV.canvas.height && ENV.canvas.clientHeight)
            ? ENV.canvas.clientHeight / ENV.canvas.height : 1;
        const vsafe = (vs > 0.25) ? vs : 1;
        const needPx = (target, base, max) =>
            Math.round(Math.max(base, Math.min(max, target / vsafe)));

        /* Sarakeleveydet paneelin leveydestä; pisin kappalenimi on 25 merkkiä
           → fonttikoko ei koskaan ylitä nimen saraketta. Oikea sarake on
           hieman leveämpi kuin ennen, koska valittu rivi näyttää "✓ 1 🪙". */
        const numW     = Math.max(20, Math.round(rowW * 0.055));
        const priceW   = Math.max(52, Math.round(rowW * 0.16));
        const nameMaxW = rowW - numW - priceW - 16;
        /* Lista on kasvanut (6 kappaletta = 7 riviä). Kun rivejä on
           enemmän kuin 4, rivit tiivistetään ja koko lista sovitetaan niin,
           ettei paneeli valu lattialle (ENV.GROUND_Y) eikä peitä alaohjetta.
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
        const listMaxH  = Math.max(48, (ENV.GROUND_Y - 6) - listTop - 10 - infoHPre - 8);
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
            const tr = (curTrack > 0) ? ENV.JUKEBOX_TRACKS[curTrack - 1] : null;
            const t = tr ? tr.title : '';
            info.push({ text: '🔊 NOW PLAYING: ' + t, color: '#ffdd88' });
            if (ENV.jukeQueue.length > 1) {
                info.push({ text: '📋 In queue: ' + ENV.jukeQueue.length + ' track(s)',
                            color: '#8ce88c' });
            }
            info.push({ text: 'Pick more => exit = add to queue', color: '#8ce88c' });
        } else if (pickCount > 0) {
            info.push({ text: 'Selected: ' + pickCount + ' – ' + pickCount + ' 🪙',
                        color: '#ffffff' });
            if (ENV.coinCount >= pickCount) {
                info.push({ text: 'Exit (⚡/Space/Enter) = play selected', color: '#8ce88c' });
            } else if (ENV.coinCount > 0) {
                info.push({ text: '💰 Not enough coins for all – playing ' + ENV.coinCount + '/' + pickCount,
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

        /* Fontin asetus + koon sovitus: asettaa `ENV.ctx.font`in ja palauttaa
           käytetyn koon, jolla teksti mahtuu enintään maxW:iin (≥ minFs) */
        const setFitFont = (text, maxW, baseFs, minFs, family) => {
            ENV.ctx.font = baseFs + 'px ' + family;
            const w = ENV.ctx.measureText(text).width;
            let fs = baseFs;
            if (w > maxW) fs = Math.max(minFs, Math.floor(baseFs * maxW / w));
            ENV.ctx.font = fs + 'px ' + family;
            return fs;
        };

        // 1) Tausta + lämminvioletti seinä
        ENV.ctx.fillStyle = '#08060e';
        ENV.ctx.fillRect(0, 0, W, H);
        const wall = ENV.ctx.createLinearGradient(0, 50, 0, ENV.GROUND_Y);
        wall.addColorStop(0, '#1c1122');
        wall.addColorStop(1, '#2b1a2e');
        ENV.ctx.fillStyle = wall;
        ENV.ctx.fillRect(40, 50, W - 80, ENV.GROUND_Y - 50);
        // Lattia + lautojen perspektiivi
        ENV.ctx.fillStyle = '#120d16';
        ENV.ctx.fillRect(40, ENV.GROUND_Y, W - 80, H - ENV.GROUND_Y - 40);
        ENV.ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ENV.ctx.fillRect(40, ENV.GROUND_Y, W - 80, 1);
        ENV.ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ENV.ctx.lineWidth = 1;
        ENV.ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
            const fx = 40 + i * (W - 80) / 8;
            ENV.ctx.moveTo(fx, ENV.GROUND_Y + 1);
            ENV.ctx.lineTo(fx + (fx - W / 2) * 0.16, H - 40);
        }
        ENV.ctx.stroke();

        // 2) Paneeli: yksi tumma laatta listalle ja tilateksteille
        ENV.ctx.fillStyle = '#0b0710';
        ENV.ctx.fillRect(panelX, panelTop, panelW, panelBottom - panelTop);
        ENV.ctx.strokeStyle = '#3a3348';
        ENV.ctx.lineWidth = 1;
        ENV.ctx.strokeRect(panelX + 0.5, panelTop + 0.5, panelW - 1, panelBottom - panelTop - 1);
        // Ohut neonreuna (terävä viiva, ei hehkua)
        ENV.ctx.fillStyle = '#ff4f96';
        ENV.ctx.fillRect(panelX, panelTop, panelW, 2);

        // 3) Otsikko + kolikkosaldo (yksiväriset, ei hehkua)
        ENV.ctx.textAlign = 'left';
        setFitFont('♪ JUKEBOX', stacked ? rowW : Math.round(rowW * 0.5),
                   needPx(16, 12, 16), 10, '"Press Start 2P", monospace');
        ENV.ctx.fillStyle = '#ff4f96';
        ENV.ctx.fillText('♪ JUKEBOX', rowX, titleY);

        const balText = '💰 Coins: ' + ENV.coinCount;
        setFitFont(balText, rowW * (stacked ? 1 : 0.5),
                   Math.max(11, Math.min(nameFs, 14)), 10, '"Courier New", monospace');
        ENV.ctx.fillStyle = '#ffd700';
        ENV.ctx.textAlign = stacked ? 'left' : 'right';
        ENV.ctx.fillText(balText, stacked ? rowX : rowX + rowW, balY);

        // 4) Kappalelista: rivi 0 = Poistu, rivit 1..N = kappaleet (valitut ✓)
        for (let i = 0; i <= trackCount; i++) {
            const y = listTop + i * (rowH + rowGap);
            const selected = (i === ENV.jukeSel);
            const picked = (i > 0) && !!ENV.jukePick[i - 1];
            const playingRow = playing && i > 0 && i === curTrack;
            // Tausta: kursori = kirkas pinkki (tumma teksti), soitossa = kulta,
            // listalle otettu = violetti, muut = tumma
            const bg     = selected ? '#ff3d7f' : (playingRow ? '#2b2410' : (picked ? '#241a3a' : '#171122'));
            const border = selected ? '#ffd0e2' : (playingRow ? '#ffdd88' : (picked ? '#ffd700' : '#3a3348'));
            const fg     = selected ? '#1c000a' : (playingRow ? '#ffe9a8' : '#eae4f2');
            const dim    = selected ? '#5c1230' : (playingRow ? '#c9a95f' : '#948ca8');

            ENV.ctx.fillStyle = bg;
            ENV.ctx.fillRect(rowX, y, rowW, rowH);
            ENV.ctx.strokeStyle = border;
            ENV.ctx.lineWidth = 1;
            ENV.ctx.strokeRect(rowX + 0.5, y + 0.5, rowW - 1, rowH - 1);

            ENV.ctx.textBaseline = 'middle';
            const cy = Math.round(y + rowH / 2) + 1;
            const sideFs = Math.max(11, nameFs - 1);

            // Numero
            ENV.ctx.textAlign = 'left';
            ENV.ctx.fillStyle = fg;
            ENV.ctx.font = Math.max(8, Math.min(10, Math.round(nameFs * 0.62))) +
                       'px "Press Start 2P", monospace';
            ENV.ctx.fillText(String(i), rowX + 10, cy);

            // Kappaleen nimi + kesto (leikataan nimi, jos ei mahdu)
            let trackName = (i === 0) ? 'Exit' : ENV.JUKEBOX_TRACKS[i - 1].title;
            const durStr = (i > 0) ? ' (' + ENV.JUKEBOX_TRACKS[i - 1].duration + ')' : '';
            ENV.ctx.font = nameFs + 'px "Courier New", monospace';
            const durW = ENV.ctx.measureText(durStr).width;
            const maxW = Math.max(20, nameMaxW - durW);
            while (trackName.length > 4 && ENV.ctx.measureText(trackName).width > maxW) {
                trackName = trackName.slice(0, -2) + '…';
            }
            trackName += durStr;
            ENV.ctx.fillStyle = fg;
            ENV.ctx.fillText(trackName, rowX + 10 + numW, cy);

            // Oikea reuna: soitossa ♪ SOI, valitulla ✓ + hinta, muilla hinta,
            // Poistu-rivillä valittujen määrä
            ENV.ctx.textAlign = 'right';
            if (playingRow) {
                ENV.ctx.font = 'bold ' + sideFs + 'px "Courier New", monospace';
                ENV.ctx.fillStyle = selected ? fg : '#ffdd88';
                ENV.ctx.fillText('♪ PLAYING', rowX + rowW - 10, cy);
            } else if (i > 0) {
                ENV.ctx.font = sideFs + 'px "Courier New", monospace';
                ENV.ctx.fillStyle = selected ? fg : (picked ? '#ffe9a8' : '#ffd700');
                ENV.ctx.fillText((picked ? '✓ ' : '') + '1 🪙', rowX + rowW - 10, cy);
            } else if (pickCount > 0) {
                ENV.ctx.font = sideFs + 'px "Courier New", monospace';
                ENV.ctx.fillStyle = selected ? fg : '#8ce88c';
                ENV.ctx.fillText('▶ ' + pickCount + ' track(s)', rowX + rowW - 10, cy);
            } else {
                ENV.ctx.font = sideFs + 'px "Courier New", monospace';
                ENV.ctx.fillStyle = dim;
                ENV.ctx.fillText('–', rowX + rowW - 10, cy);
            }
        }
        ENV.ctx.textBaseline = 'alphabetic';
        // 5) Tilatekstit omassa laatikossaan (yksivärinen, ei läpinäkyvyyttä)
        ENV.ctx.fillStyle = '#16101f';
        ENV.ctx.fillRect(rowX, infoTop, rowW, infoH);
        ENV.ctx.strokeStyle = '#4a4160';
        ENV.ctx.lineWidth = 1;
        ENV.ctx.strokeRect(rowX + 0.5, infoTop + 0.5, rowW - 1, infoH - 1);
        ENV.ctx.textAlign = 'left';
        ENV.ctx.textBaseline = 'middle';
        for (let i = 0; i < info.length; i++) {
            const it = info[i];
            setFitFont(it.text, rowW - 16, infoFs, 9, '"Courier New", monospace');
            ENV.ctx.fillStyle = it.color;
            ENV.ctx.fillText(it.text, rowX + 8, Math.round(infoTop + infoH / 2 +
                         (i - (info.length - 1) / 2) * infoLineH));
        }
        ENV.ctx.textBaseline = 'alphabetic';

        // 6) Jukebox-kone oikealla – vain kun sille jää tilaa (ei peitä listaa)
        if (wide) {
            /* Kansikuva (raidat 4–9; raidat 1–3 ja Poistu-rivi = null → levy):
               soitossa soivan raidan kansi, muuten selatessa kursorin raidan
               kansi (esikatselu – v11.58). */
            const cover = playing
                ? ((curTrack > 0) ? ENV.jukeCovers[curTrack - 1] : null)
                : ((ENV.jukeSel > 0) ? ENV.jukeCovers[ENV.jukeSel - 1] : null);
            drawJukeboxCabinet(panelX + panelW + CAB_GAP, ENV.GROUND_Y + 4, now, playing,
                               ENV.jukeSel > 0 || pickCount > 0, cover);
        }

        // 7) Alaohje (kiinteä ja terävä – ei vilkkumista)
        const helpTxt = '▲/▼ = select   (o)/Space = pick/remove   Enter = play & exit';
        ENV.ctx.textAlign = 'center';
        setFitFont(helpTxt, winW - 16, 12, 9, 'Arial, sans-serif');
        ENV.ctx.fillStyle = '#e9e9ef';
        ENV.ctx.fillText(helpTxt, 400, 380);
        ENV.ctx.textAlign = 'left';

        ENV.ctx.restore();
    }

    /* Jukebox-kone: Wurlitzer-henkinen kaappi (proseduraalinen, ei kuvatiedostoja
       paitsi soivan kappaleen kansikuva, jos sellainen on) */
    function drawJukeboxCabinet(x, baseY, now, playing, armed, cover) {
        const w = 176, h = 210;
        const top = baseY - h;
        const cx = x + w / 2;

        // Varjo lattialla
        ENV.ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ENV.ctx.beginPath();
        ENV.ctx.ellipse(cx, baseY + 2, w * 0.5, 8, 0, 0, Math.PI * 2);
        ENV.ctx.fill();

        // Runko: tumma puu/metal, kaareva huippu
        const body = ENV.ctx.createLinearGradient(x, 0, x + w, 0);
        body.addColorStop(0, '#20120c');
        body.addColorStop(0.35, '#5a3a22');
        body.addColorStop(0.7, '#3a2418');
        body.addColorStop(1, '#20120c');
        ENV.ctx.fillStyle = body;
        ENV.ctx.beginPath();
        ENV.ctx.moveTo(x, baseY);
        ENV.ctx.lineTo(x, top + 46);
        ENV.ctx.quadraticCurveTo(x, top, cx, top);
        ENV.ctx.quadraticCurveTo(x + w, top, x + w, top + 46);
        ENV.ctx.lineTo(x + w, baseY);
        ENV.ctx.closePath();
        ENV.ctx.fill();

        // Neonkaari: vuorotellen pinkki ja keltainen, hidas pulssi
        const segs = 9;
        const pulse = (Math.sin(now / 260) + 1) / 2;
        ENV.ctx.lineWidth = 5;
        for (let i = 0; i < segs; i++) {
            const a0 = Math.PI + (i / segs) * Math.PI;
            const a1 = Math.PI + ((i + 1) / segs) * Math.PI;
            if (i % 2 === 0) {
                ENV.ctx.strokeStyle = 'rgba(255,0,85,' + (0.5 + pulse * 0.45).toFixed(2) + ')';
                ENV.ctx.shadowColor = '#FF0055';
            } else {
                ENV.ctx.strokeStyle = 'rgba(255,221,136,' + (0.45 + (1 - pulse) * 0.45).toFixed(2) + ')';
                ENV.ctx.shadowColor = '#ffdd88';
            }
            ENV.ctx.shadowBlur = 8;
            ENV.ctx.beginPath();
            ENV.ctx.ellipse(cx, top + 46, w * 0.44, 40, 0, a0, a1);
            ENV.ctx.stroke();
        }
        ENV.ctx.shadowBlur = 0;

        // Kromirivat kaaren alta alas
        for (let i = 1; i < 7; i++) {
            const rx = x + (w * i) / 7;
            const g = ENV.ctx.createLinearGradient(rx - 2, 0, rx + 2, 0);
            g.addColorStop(0, 'rgba(255,255,255,0.04)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.3)');
            g.addColorStop(1, 'rgba(0,0,0,0.3)');
            ENV.ctx.fillStyle = g;
            ENV.ctx.fillRect(rx - 2, top + 62, 4, baseY - top - 64);
        }

        /* Levypesä + levy. Jos kappaleella on kansikuva (raidat 4–9) ja se on
           latautunut, kuva piirretään levypesän paikalle kuvasuhde säilyttäen;
           muuten levy piirretään kuten ennen (raidat 1–3 sekä rivi 0). Kansi
           näytetään soitossa (soiva raita) ja selatessa (kursorin raita, v11.58)
           – valinta tehdään kutsujan puolella (`cover`). */
        const recY = top + 80, recR = 28;
        ENV.ctx.fillStyle = '#0d0a10';
        ENV.ctx.beginPath(); ENV.ctx.arc(cx, recY, recR + 4, 0, Math.PI * 2); ENV.ctx.fill();
        const showCover = !!cover && cover.ready;
        if (showCover) {
            const box = (recR + 4) * 2;                        // koko tumman ympyrän kattava alue
            const iw  = cover.img.naturalWidth  || 1;
            const ih  = cover.img.naturalHeight || 1;
            const k   = Math.min(box / iw, box / ih);          // kuvasuhde säilyy
            const dw  = Math.max(1, Math.round(iw * k));
            const dh  = Math.max(1, Math.round(ih * k));
            const dx  = Math.round(cx - dw / 2);
            const dy  = Math.round(recY - dh / 2);
            ENV.ctx.fillStyle = '#120e18';                         // taustalaatta
            ENV.ctx.fillRect(cx - recR - 4, recY - recR - 4, box, box);
            ENV.ctx.imageSmoothingEnabled = true;                  // valokuva → pehmennetty
            ENV.ctx.drawImage(cover.img, dx, dy, dw, dh);
            ENV.ctx.imageSmoothingEnabled = false;
            ENV.ctx.strokeStyle = 'rgba(255,221,136,0.55)';        // ohut kehys
            ENV.ctx.lineWidth = 1;
            ENV.ctx.strokeRect(cx - recR - 4 + 0.5, recY - recR - 4 + 0.5, box - 1, box - 1);
        } else {
            ENV.ctx.fillStyle = '#171320';
            ENV.ctx.beginPath(); ENV.ctx.arc(cx, recY, recR, 0, Math.PI * 2); ENV.ctx.fill();
            ENV.ctx.strokeStyle = 'rgba(255,255,255,0.10)';
            ENV.ctx.lineWidth = 1;
            for (let r = 9; r < recR - 3; r += 3) { ENV.ctx.beginPath(); ENV.ctx.arc(cx, recY, r, 0, Math.PI * 2); ENV.ctx.stroke(); }
            ENV.ctx.fillStyle = '#ffdd88';
            ENV.ctx.beginPath(); ENV.ctx.arc(cx, recY, 3, 0, Math.PI * 2); ENV.ctx.fill();
        }
        if (playing) {
            /* Kierto näkyy myös kuvan päällä: piste levypesän reunalla */
            const spin = (now / 300) % (Math.PI * 2);
            const spinR = showCover ? recR + 2 : 18;
            ENV.ctx.fillStyle = showCover ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.4)';
            ENV.ctx.fillRect(cx + Math.cos(spin) * spinR - 1, recY + Math.sin(spin) * spinR - 1, 2, 2);
        }

        // Kaiutinritilä alaosassa
        for (let gy = baseY - 30; gy < baseY - 8; gy += 5) {
            ENV.ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ENV.ctx.fillRect(x + 16, gy, w - 32, 2);
        }

        // Kolikkoluukku + hinta (terävä: yksivärinen teksti, ei läpinäkyvyyttä)
        const slotW = 46, slotH = 14;
        const sx = x + w - slotW - 12, sy = top + 62;
        ENV.ctx.fillStyle = '#2b2b34';
        ENV.ctx.fillRect(sx, sy, slotW, slotH);
        ENV.ctx.strokeStyle = armed ? '#FFD700' : '#8a7a2a';
        ENV.ctx.lineWidth = 1;
        ENV.ctx.strokeRect(sx + 0.5, sy + 0.5, slotW - 1, slotH - 1);
        ENV.ctx.fillStyle = armed ? '#FFD700' : '#c8a000';
        ENV.ctx.font = '10px "Courier New", monospace';
        ENV.ctx.textAlign = 'center';
        ENV.ctx.fillText('1 🪙', sx + slotW / 2, sy + 10);
        ENV.ctx.textAlign = 'start';

        // Jalusta
        ENV.ctx.fillStyle = '#170d08';
        ENV.ctx.fillRect(x + 6, baseY - 8, w - 12, 8);
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
    /* ── Oluttuoppi pöydällä (VAIN FULL) ─────────────────
       Korvaa hampurilaisen BAR-huoneessa FULLissa. Piirretään pöydän
       pinnan (tableTop) päälle, keskitetty x = cx. Korkeus = ENV.BAR_BEER_H. */
    function drawBarBeer(cx, tableTop) {
        const w = 44, h = ENV.BAR_BEER_H;
        const x = cx - w / 2, y = tableTop - h;
        // Tuopin runko (tumma ääriviiva + olut)
        ENV.ctx.fillStyle = '#3a2a12';
        ENV.ctx.fillRect(x, y, w, h);
        ENV.ctx.fillStyle = '#c98a1c';
        ENV.ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ENV.ctx.fillStyle = 'rgba(255,255,255,0.12)';   // lasin kiilto
        ENV.ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        // Kahva
        ENV.ctx.strokeStyle = '#3a2a12';
        ENV.ctx.lineWidth = 4;
        ENV.ctx.beginPath();
        ENV.ctx.arc(x + w - 1, y + h * 0.45, 12, -Math.PI / 2, Math.PI / 2);
        ENV.ctx.stroke();
        // Vaahto
        ENV.ctx.fillStyle = '#f7f2e6';
        ENV.ctx.beginPath();
        ENV.ctx.ellipse(cx, y + 3, w / 2 - 1, 7, 0, 0, Math.PI * 2);
        ENV.ctx.fill();
        ENV.ctx.fillStyle = '#fffdf5';
        ENV.ctx.beginPath();
        ENV.ctx.ellipse(cx - 6, y + 2, 10, 6, 0, 0, Math.PI * 2);
        ENV.ctx.ellipse(cx + 8, y + 3, 8, 5, 0, 0, Math.PI * 2);
        ENV.ctx.fill();
        // Kuplat
        ENV.ctx.fillStyle = 'rgba(255,255,255,0.5)';
        const bubbles = [[-10, 20], [6, 14], [-4, 34], [12, 30], [0, 44]];
        for (let i = 0; i < bubbles.length; i++) {
            ENV.ctx.beginPath();
            ENV.ctx.arc(cx + bubbles[i][0], y + bubbles[i][1], 1.6, 0, Math.PI * 2);
            ENV.ctx.fill();
        }
    }

    function drawBarRoom() {
        // Täysin pimeä tausta
        ENV.ctx.fillStyle = '#100808';
        ENV.ctx.fillRect(0, 0, ENV.WORLD_W, ENV.WORLD_H);

        // Seinä – lämmin sävy
        const ga = ENV.ctx.createLinearGradient(0, 0, 0, ENV.WORLD_H);
        ga.addColorStop(0, '#1a1210');
        ga.addColorStop(1, '#252015');
        ENV.ctx.fillStyle = ga;
        ENV.ctx.fillRect(60, 60, ENV.WORLD_W - 120, ENV.WORLD_H - 120);

        // Pöytä
        const tw = 200, th = 14;
        const tx = (ENV.WORLD_W - tw) / 2, ty = ENV.GROUND_Y - 50;
        ENV.ctx.fillStyle = '#4a3520';
        ENV.ctx.fillRect(tx, ty, tw, th);
        ENV.ctx.fillStyle = '#5a4530';
        ENV.ctx.fillRect(tx + 4, ty - 2, tw - 8, 4);
        ENV.ctx.fillStyle = '#3a2510';
        ENV.ctx.fillRect(tx + 10, ty + th, 10, 50);
        ENV.ctx.fillRect(tx + tw - 20, ty + th, 10, 50);

        /* Iso hampurilainen – pöydän pinnalla, skaalattu 2/3:een.
           Skaalaus tehdään pöydän pinnan keskipisteestä (bx, ty), joten
           hampurilaisen alaosa pysyy tarkalleen pöydän pinnassa. */
        const BURGER_SCALE = 2 / 3;
        const BURGER_H = 68;                 // alkuperäinen korkeus (by−26 … by+42)
        const bx = tx + tw / 2, by = ty - 42;
        /* FULLissa pöydällä on oluttuoppi (korkeampi kuin hampurilainen)
           → ostorivi lasketaan todellisen ruuan yläreunasta, ettei se osu. */
        const burgerTop = ty - (ENV.chaosFlags.beer ? ENV.BAR_BEER_H : BURGER_H * BURGER_SCALE);

        if (ENV.chaosFlags.beer) {
            drawBarBeer(bx, ty);   // FULL: olut hampurilaisen tilalla
        } else {
        ENV.ctx.save();
        ENV.ctx.translate(bx, ty);
        ENV.ctx.scale(BURGER_SCALE, BURGER_SCALE);
        ENV.ctx.translate(-bx, -ty);

        // Alapulla
        ENV.ctx.fillStyle = '#8B4513';
        ENV.ctx.beginPath();
        ENV.ctx.ellipse(bx, by + 28, 40, 14, 0, 0, Math.PI * 2);
        ENV.ctx.fill();
        ENV.ctx.fillStyle = '#A0522D';
        ENV.ctx.beginPath();
        ENV.ctx.ellipse(bx, by + 25, 38, 12, 0, 0, Math.PI * 2);
        ENV.ctx.fill();

        // Pihvi
        ENV.ctx.fillStyle = '#4a2010';
        ENV.ctx.fillRect(bx - 36, by + 13, 72, 18);
        ENV.ctx.fillStyle = '#3a1810';
        ENV.ctx.fillRect(bx - 33, by + 16, 66, 12);
        ENV.ctx.fillStyle = '#5a3020';
        ENV.ctx.beginPath();
        ENV.ctx.ellipse(bx, by + 13, 37, 5, 0, 0, Math.PI * 2);
        ENV.ctx.fill();

        // Juusto
        ENV.ctx.fillStyle = '#FFD700';
        ENV.ctx.beginPath();
        ENV.ctx.moveTo(bx - 34, by + 8);
        ENV.ctx.lineTo(bx - 10, by - 2);
        ENV.ctx.lineTo(bx + 10, by + 8);
        ENV.ctx.lineTo(bx + 34, by + 8);
        ENV.ctx.lineTo(bx + 20, by + 13);
        ENV.ctx.lineTo(bx - 20, by + 13);
        ENV.ctx.closePath();
        ENV.ctx.fill();

        // Salaatti
        ENV.ctx.fillStyle = '#4CAF50';
        ENV.ctx.beginPath();
        ENV.ctx.moveTo(bx - 34, by);
        for (let i = 0; i < 12; i++) {
            const sx = bx - 34 + i * 5.8;
            const sy = by + Math.sin(i * 0.8) * 3;
            ENV.ctx.lineTo(sx, sy);
        }
        ENV.ctx.lineTo(bx + 34, by + 5);
        ENV.ctx.lineTo(bx - 34, by + 6);
        ENV.ctx.closePath();
        ENV.ctx.fill();
        ENV.ctx.fillStyle = '#388E3C';
        ENV.ctx.beginPath();
        ENV.ctx.moveTo(bx - 34, by);
        for (let i = 0; i < 12; i++) {
            const sx = bx - 34 + i * 5.8;
            const sy = by + Math.sin(i * 0.8) * 3;
            ENV.ctx.lineTo(sx, sy + 1);
        }
        ENV.ctx.lineTo(bx + 34, by + 6);
        ENV.ctx.lineTo(bx - 34, by + 2);
        ENV.ctx.closePath();
        ENV.ctx.fill();

        // Ylapulla
        ENV.ctx.fillStyle = '#A0522D';
        ENV.ctx.beginPath();
        ENV.ctx.ellipse(bx, by - 8, 38, 18, 0, Math.PI, 0);
        ENV.ctx.fill();
        ENV.ctx.fillStyle = '#8B4513';
        ENV.ctx.beginPath();
        ENV.ctx.ellipse(bx, by - 10, 40, 16, 0, Math.PI, 0);
        ENV.ctx.fill();

        // Seesaminsiemenet
        ENV.ctx.fillStyle = '#F5DEB3';
        var seeds = [[-12, -16], [5, -19], [18, -14], [-20, -10], [25, -8],
            [-8, -6], [0, -5], [15, -6], [-16, -5], [10, -10]];
        for (var si = 0; si < seeds.length; si++) {
            ENV.ctx.fillRect(bx + seeds[si][0], by + seeds[si][1], 3, 3);
        }

        // Hoyry
        ENV.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ENV.ctx.lineWidth = 1.5;
        var steamT = Date.now() / 600;
        for (var si2 = 0; si2 < 3; si2++) {
            var sx2 = bx - 15 + si2 * 15;
            var sy2 = by - 30 + Math.sin(steamT + si2 * 2.1) * 8;
            ENV.ctx.beginPath();
            ENV.ctx.moveTo(sx2, sy2);
            ENV.ctx.quadraticCurveTo(sx2 + 4, sy2 - 10, sx2 + 8, sy2 - 3);
            ENV.ctx.stroke();
        }

        ENV.ctx.restore();   // hampurilaisen skaalaus päättyy
        }   // (FULL = olut / muut moodit = hampurilainen)

        /* ── Asettelu: taulu + äidin lappu + ostotilanne ────────────────
           Kaikki mitoitetaan siitä ikkunasta, joka ruudulla oikeasti näkyy
           (kuten jukebox-huoneessa): mobiilissa ENV.canvas on vain `ENV.viewW`
           leveä ja kamera keskittää huoneen (ENV.camX), joten kiinteä 800 px:n
           asettelu jäisi kankaan ulkopuolelle. Fonttikoko valitaan näytön
           skaalan mukaan (`needPx`) → tekstit pysyvät luettavina myös
           puhelimen vaakanäytössä. Sisältö mahtuu aina seinän yläreunan
           (y = 60) ja ostorivin väliin eikä mikään osu hampurilaiseen. */
        const winW = Math.round(Math.min(ENV.WORLD_W, Math.max(ENV.VIEWW_MIN, ENV.viewW)));
        const vs = (ENV.canvas && ENV.canvas.height && ENV.canvas.clientHeight)
            ? ENV.canvas.clientHeight / ENV.canvas.height : 1;
        const vsafe = (vs > 0.25) ? vs : 1;
        const needPx = (target, base, max) =>
            Math.round(Math.max(base, Math.min(max, target / vsafe)));

        /* Suurin fonttikoko, jolla kaikki `rows`-rivit mahtuvat maxW:iin */
        const fitFs = (rows, weight, baseFs, minFs, family, maxW) => {
            let w = 0;
            ENV.ctx.font = weight + ' ' + baseFs + 'px ' + family;
            for (let i = 0; i < rows.length; i++) {
                w = Math.max(w, ENV.ctx.measureText(rows[i]).width);
            }
            if (w <= maxW) return baseFs;
            return Math.max(minFs, Math.floor(baseFs * maxW / w));
        };

        /* Äidin lappu – 3 riviä (varoitus hampurilaisten kulutuksesta) */
        const hintLines = ENV.chaosFlags.beer ? [
            'WATCH YOUR DRINKING, DEAR',
            'BEER GOES TO YOUR HEAD!',
            'Love, Mum'
        ] : [
            'WATCH YOUR BURGER INTAKE',
            'REMEMBER TO EAT, DUDE!',
            'Love, Mum'
        ];
        const boxPad = 36;                    // laatikon sisämarginaali
        const hintFs = fitFs(hintLines, 'bold', needPx(12, 10, 12), 8,
                             '"Courier New", monospace', winW - 28 - boxPad);
        ENV.ctx.font = 'bold ' + hintFs + 'px "Courier New", monospace';
        let maxHintW = 0;
        for (let m = 0; m < hintLines.length; m++) {
            maxHintW = Math.max(maxHintW, ENV.ctx.measureText(hintLines[m]).width);
        }
        const hintBoxW = Math.ceil(maxHintW + boxPad);
        const hintLineH = hintFs + 3;
        const hintBoxH = hintLineH * 3 + 6;

        /* Ostotilanteen rivi – fontti pisimmän vaihtoehdon mukaan */
        const infoRows = ENV.chaosFlags.beer ? [
            'You drank ' + Math.max(ENV.barBuyQty, 1) + 'x🍺 beers!',
            '🍺 Beer quota full. Go home, drunkard!',
            '🍺 No coins. Get some cash!'
        ] : [
            'You bought ' + Math.max(ENV.barBuyQty, 1) + 'x🍔 burgers!',
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
        ENV.ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ENV.ctx.fillRect(picX + 3, picY + 4, picFrameW, picFrameH);
        ENV.ctx.fillStyle = '#0a0a0a';
        ENV.ctx.fillRect(picX, picY, picFrameW, picFrameH);
        if (barPicReady) {
            ENV.ctx.imageSmoothingEnabled = true; // valokuva → pehmennetty skaalaus
            ENV.ctx.drawImage(barPic, picX + PIC_PAD, picY + PIC_PAD, picImgW, picImgH);
            ENV.ctx.imageSmoothingEnabled = false;
        } else {
            const pg = ENV.ctx.createLinearGradient(0, picY, 0, picY + picImgH);
            pg.addColorStop(0, '#242424');
            pg.addColorStop(1, '#0e0e0e');
            ENV.ctx.fillStyle = pg;
            ENV.ctx.fillRect(picX + PIC_PAD, picY + PIC_PAD, picImgW, picImgH);
        }

        /* Äidin lappu (keltaiset raamit) – taulun alla */
        ENV.ctx.textAlign = 'center';
        ENV.ctx.fillStyle = 'rgba(15, 8, 4, 0.9)';
        ENV.ctx.strokeStyle = '#ffcc44';
        ENV.ctx.lineWidth = 2;
        ENV.ctx.fillRect(noteX, noteY, hintBoxW, hintBoxH);
        ENV.ctx.strokeRect(noteX, noteY, hintBoxW, hintBoxH);
        ENV.ctx.font = 'bold ' + hintFs + 'px "Courier New", monospace';
        for (let hi = 0; hi < hintLines.length; hi++) {
            ENV.ctx.fillStyle = (hi === 2) ? '#ff6644' : '#ffdd88';
            ENV.ctx.fillText(hintLines[hi], noteX + hintBoxW / 2,
                         noteY + hintLineH * (hi + 1) + 1);
        }

        // Info-tekstit – ostomäärä = tämän vierailun ostot (▼ pienentää sitä)
        ENV.ctx.fillStyle = '#eeddcc';
        ENV.ctx.font = 'normal ' + infoFs + 'px "Courier New", monospace';
        ENV.ctx.textAlign = 'center';
        if (ENV.chaosFlags.beer) {
            if (ENV.barBuyQty > 0) {
                ENV.ctx.fillText('You drank ' + ENV.barBuyQty + 'x🍺 beers!', 400, infoBaseline);
            } else if (ENV.drunkLevel >= ENV.DRUNK_MAX) {
                ENV.ctx.fillText('🍺 Beer quota full. Go home, drunkard!', 400, infoBaseline);
            } else if (ENV.coinCount <= 0) {
                ENV.ctx.fillText('🍺 No coins. Get some cash!', 400, infoBaseline);
            }
        } else if (ENV.barBuyQty > 0) {
            ENV.ctx.fillText('You bought ' + ENV.barBuyQty + 'x🍔 burgers!', 400, infoBaseline);
        } else if (ENV.hamburgerCount >= 10) {
            ENV.ctx.fillText('🍔 Burger quota full. Buy something else!', 400, infoBaseline);
        } else if (ENV.coinCount <= 0) {
            ENV.ctx.fillText('🍔 No coins. Get some cash!', 400, infoBaseline);
        }

        // Ohjevihje: ▲ osta / ▼ peru / (o) poistu
        var pulse = Math.sin(Date.now() / 800) * 0.3 + 0.7;
        ENV.ctx.fillStyle = 'rgba(255,255,255,' + pulse + ')';
        var exitRow = ENV.chaosFlags.beer
            ? '▲ = buy 1 🍺   ▼ = undo 1   EXIT: (o) / Space'
            : '▲ = buy 1 🍔   ▼ = undo 1   EXIT: (o) / Space';
        ENV.ctx.font = Math.max(8, fitFs([exitRow], 'normal', 10, 8, 'Arial, sans-serif',
                                     winW - 24)) + 'px Arial, sans-serif';
        ENV.ctx.fillText(exitRow, 400, 370);
        ENV.ctx.textAlign = 'start';
    }

    /* Makuuhuone (talo 7): liikenne jatkaa taustalla, nukkumisen pimennys vaihtaa päivä/yö-tilan ja antaa +1 🍔 (katto 10), Poistu ei muuta mitään. */
    function updateSleepRoom(dt) {
        // ── Makuuhuone (ex-palkintohuone, talo 7) ──
        //   ▲ / W = Nuku     ▼ / S = Poistu   (valinta liikkuu reunoilla)
        //   (o) / Space / Enter / ⚡ = vahvista valinta
        //   Poistuminen ilman nukkumista ei muuta päivä/yö-tilaa mihinkään.
        //   Nuku → pimennys (ENV.SLEEP_FADE_FRAMES) → tila vaihtuu → takaisin kadulle.
        if (ENV.sleepRoom) {
            /* LIIKENNE EI PYSÄHDY: kadun autot ajavat taustalla myös
               makuuhuoneessa ja nukkumisen pimennyksen aikana – sama periaate
               kuin jukebox-huoneessa. Muuten ajoneuvo jäisi jyrräämään
               paikalleen (moottoriäänen panorointi seuraa v.x:ää) ja palaisi
               kadulle täsmälleen samasta kohdasta. Pelaaja on sisällä talossa
               → `playerSafe = true` (ei törmäystä, ei tainnutusta eikä
               🍔-menetystä). Ei talousmuutoksia. */
            StreetTraffic.update(dt, true);

            // Nukkumisen pimennys: tila vaihtuu vasta pimennyksen lopussa
            if (ENV.sleepPhase > 0) {
                ENV.sleepPhase -= dt;
                if (ENV.sleepPhase <= 0) {
                    ENV.sleepPhase = 0;
                    // Tila vaihtuu siitä, miltä katu parhaillaan näyttää
                    // (toimii myös keskellä hämärtymistä ja ?day-testityökalulla)
                    ENV.isDay = !(ENV.dayT >= 0.5);        // päivä → yö  TAI  yö → päivä
                    // Uusi yö → kuu nousee uudelleen vasemmalta, ei arvota.
                    ENV.cycleChangeTimer = ENV.CYCLE_CHANGE_DELAY_FRAMES + 1;  // uusi jakso alkaa
                    if (!ENV.isDay) ENV.resetMoon();
                    if (ENV.isDay) ENV.resetSun();              // aurinko alkuun
                    if (!ENV.DAY_FORCE) {              // testityökalut eivät tallenna
                        ENV.state.isDay = ENV.isDay;
                        GameState.save(ENV.state);
                    }
                    // +1 🍔 nukkumisesta – myös FULLissa (:
                    // ainoa tapa hankkia 🍔 takaisin, koska BAR myy vain olutta)
                    if (!ENV.DAY_FORCE && ENV.hamburgerCount < 10) {
                        ENV.hamburgerCount++;
                        ENV.state.inventory.hamburgerCount = ENV.hamburgerCount;
                        GameState.save(ENV.state);
                    }
                    // Herätysrauha: ajastin jatkuu siitä mihin se jäi,
                    // mutta vähintään ENV.HUNGER_WAKE_GRACE-verran – muuten 1 🍔:lla
                    // nukkunut voisi kuolla heti herätessään.
                    ENV.hamburgerTimer = Math.max(ENV.hamburgerTimer, ENV.HUNGER_WAKE_GRACE);
                    ENV.sleepRoom = false;
                    ENV.sleepSel = 0;
                    ENV.sleepHeldUp = false;
                    ENV.sleepHeldDown = false;
                    ENV.updateHUD();
                }
                ENV.actionJustPressed = false;
                return true;
            }

            const selUp = !!(ENV.keys['ArrowUp'] || ENV.keys['w'] || ENV.keys['W']);
            const selDown = !!(ENV.keys['ArrowDown'] || ENV.keys['s'] || ENV.keys['S']);
            if (selUp && !ENV.sleepHeldUp) ENV.sleepSel = Math.max(0, ENV.sleepSel - 1);
            if (selDown && !ENV.sleepHeldDown) ENV.sleepSel = Math.min(1, ENV.sleepSel + 1);
            ENV.sleepHeldUp = selUp;
            ENV.sleepHeldDown = selDown;

            if (ENV.actionJustPressed) {
                if (ENV.sleepSel === 0) {
                    ENV.sleepPhase = ENV.SLEEP_FADE_FRAMES;   // nukahdus käynnissä
                } else {
                    // Poistu: ei muutosta päivä/yö-tilaan
                    ENV.sleepRoom = false;
                    ENV.sleepSel = 0;
                    ENV.sleepHeldUp = false;
                    ENV.sleepHeldDown = false;
                }
            }
            ENV.actionJustPressed = false;
            return true;
        }
        return false;
    }

    /* BAR (talo 8): FULL myy olutta 🍺 (ENV.drunkLevel), muut tasot hampurilaisia; ▼ peruu vierailun ostot, (o)/Space poistuu. */
    function updateBarRoom(dt) {
        // BAR room – ostomäärää säädetään nuolilla, poistuminen toimintonapista
        //   ▲ / W = osta 1 hampurilainen (1 kolikko)      ▼ / S = peru viimeisin osto
        //   (o) / Space / Enter = poistu
        if (ENV.barRoom) {
            /* LIIKENNE EI PYSÄHDY: sama periaate kuin jukebox-huoneessa
               kadun autot ajavat taustalla normaalisti, jotta
               yksikään ajoneuvo ei jää jyrräämään paikalleen (moottoriäänen
               panorointi seuraa v.x:ää) eikä palaa kadulle samasta kohdasta.
               Pelaaja on sisällä talossa → `playerSafe = true` (ei törmäystä,
               ei tainnutusta eikä 🍔-menetystä kesken ostosten). Ei
               talousmuutoksia (ostot ja hinnat ennallaan). */
            StreetTraffic.update(dt, true);

            const buyUp = !!(ENV.keys['ArrowUp'] || ENV.keys['w'] || ENV.keys['W']);
            const buyDown = !!(ENV.keys['ArrowDown'] || ENV.keys['s'] || ENV.keys['S']);

            if (ENV.chaosFlags.beer) {
                /* FULL: BAR myy olutta 🍺 (1 🪙), katto ENV.DRUNK_MAX.
                   Olut nostaa humalaa ja nollaa haihtumisajastimen. */
                if (buyUp && !ENV.barBuyHeldUp && ENV.coinCount > 0 && ENV.drunkLevel < ENV.DRUNK_MAX) {
                    ENV.drunkLevel++;
                    ENV.drunkTimer = ENV.burgerInterval;
                    ENV.saveChaosSession();   // F5 ei hukkaa humalaa
                    ENV.coinCount--;
                    ENV.barBuyQty++;
                    ENV.state.inventory.coinCount = ENV.coinCount;
                    GameState.save(ENV.state);
                    ENV.updateHUD();
                    ENV.playCoin();
                }
                if (buyDown && !ENV.barBuyHeldDown && ENV.barBuyQty > 0) {
                    ENV.drunkLevel--;
                    ENV.saveChaosSession();
                    ENV.coinCount++;
                    ENV.barBuyQty--;
                    ENV.state.inventory.coinCount = ENV.coinCount;
                    GameState.save(ENV.state);
                    ENV.updateHUD();
                    ENV.playCoin();
                }
            } else {
                if (buyUp && !ENV.barBuyHeldUp && ENV.coinCount > 0 && ENV.hamburgerCount < 10) {
                    ENV.hamburgerCount++;
                    ENV.coinCount--;
                    ENV.barBuyQty++;
                    ENV.state.inventory.hamburgerCount = ENV.hamburgerCount;
                    ENV.state.inventory.coinCount = ENV.coinCount;
                    GameState.save(ENV.state);
                    ENV.updateHUD();
                    ENV.playCoin();
                }
                if (buyDown && !ENV.barBuyHeldDown && ENV.barBuyQty > 0) {
                    ENV.hamburgerCount--;
                    ENV.coinCount++;
                    ENV.barBuyQty--;
                    ENV.state.inventory.hamburgerCount = ENV.hamburgerCount;
                    ENV.state.inventory.coinCount = ENV.coinCount;
                    GameState.save(ENV.state);
                    ENV.updateHUD();
                    ENV.playCoin();
                }
            }
            ENV.barBuyHeldUp = buyUp;
            ENV.barBuyHeldDown = buyDown;

            if (ENV.actionJustPressed) {
                ENV.barRoom = false;
                ENV.barBuyQty = 0;
                ENV.barBuyHeldUp = false;
                ENV.barBuyHeldDown = false;
            }
            ENV.actionJustPressed = false;
            return true;
        }
        return false;
    }

    /* Jukebox-huone (talo 5): monivalinta, kursori vapaa myös soiton aikana, poistuminen soittaa valitut (jukeboxExitAndPlay). */
    function updateJukeboxRoom(dt) {
        // JUKEBOX-huone (talo 5) – monivalinta
        //   ▲ / W = kursori ylös   ▼ / S = kursori alas (0 = Poistu-rivi, 1..N = kappale)
        //   Lista kiertää: ▲ rivillä 0 → viimeinen kappale, ▼ viimeiseltä → rivi 0 (Poistu)
        //   (o) / Space / ⚡ = ota kappale listalle tai poista se
        //   (o) / Space / ⚡ rivillä 0 = soita valitut & poistu
        //   Enter = soita valitut & poistu mistä tahansa
        //   Kun jono soi (valinta vapaana) Space/(o)/⚡ lisää jonoon, Enter = lisää & poistu
        //   Ei valintoja → poistuminen ei veloita eikä soita mitään
        //   Valitut soitetaan poistuttaessa yksi kerrallaan (1 → N), 1 🪙 / kappale
        if (ENV.jukeboxRoom) {
            /* Liikenne ei pysähdy: kadun autot ajavat taustalla
               normaalisti, jotta yksikään ajoneuvo ei jää jyrräämään
               paikalleen huoneeseen mentäessä. Pelaaja on sisällä talossa →
               `playerSafe = true` (ei törmäystestiä, ei tainnutusta eikä
               🍔-menetystä kesken musiikin valinnan). Ei talousmuutoksia
               (sääntö 04); nälkä kuluu kuten ennenkin. */
            StreetTraffic.update(dt, true);

            const selUp = !!(ENV.keys['ArrowUp'] || ENV.keys['w'] || ENV.keys['W']);
            const selDown = !!(ENV.keys['ArrowDown'] || ENV.keys['s'] || ENV.keys['S']);
            const trackCount = ENV.JUKEBOX_TRACKS.length;
            // Space ja ⚡ asettavat saman keyn (' ') → sama reuna molemmille
            const toggleDown = !!(ENV.keys[' '] || ENV.keys['o'] || ENV.keys['O']);
            const enterDown = !!ENV.keys['Enter'];

            // Kursori aina vapaana: valinta onnistuu myös soiton aikana,
            // jolloin uudet valinnat lisätään soivan jonon perään.
            // Lista kiertää päästä päähän (▲ riviltä 0 → viimeinen, ▼ viimeiseltä → rivi 0),
            // joten pohjalta pääsee suoraan takaisin ylös ilman askel kerrallaan näpyttelyä.
            if (selUp && !ENV.jukeHeldUp) ENV.jukeSel = (ENV.jukeSel <= 0) ? trackCount : ENV.jukeSel - 1;
            if (selDown && !ENV.jukeHeldDown) ENV.jukeSel = (ENV.jukeSel >= trackCount) ? 0 : ENV.jukeSel + 1;
            ENV.jukeHeldUp = selUp;
            ENV.jukeHeldDown = selDown;

            // Ota / poista kappale (rivi 0 = Poistu: lisää valinnat jonoon & poistu).
            // Soiton aikana Space/(o)/⚡ kappalerivillä togglaa valintaa (kuten normaalisti).
            if (toggleDown && !ENV.jukeSpaceHeld) {
                if (ENV.jukeSel === 0) jukeboxExitAndPlay();
                else ENV.jukePick[ENV.jukeSel - 1] = !ENV.jukePick[ENV.jukeSel - 1];
            }
            ENV.jukeSpaceHeld = toggleDown;

            // Enter: lisää valinnat jonoon & poistu mistä tahansa riviltä
            if (enterDown && !ENV.jukeEnterHeld) jukeboxExitAndPlay();
            ENV.jukeEnterHeld = enterDown;

            ENV.actionJustPressed = false;
            return true;
        }
        return false;
    }

    /* ═══ JUKEBOX: valinnat ja poistuminen ═════════════
       Rivi 0 = Poistu, rivit 1..N = kappaleet. (o) / Space / ⚡ ottaa kappaleen
       listalle tai poistaa sen; rivillä 0 sama nappi soittaa valitut ja poistuu.
       Enter soittaa valitut ja poistuu mistä tahansa riviltä. Valitut soitetaan
       yksi kerrallaan (1 → N), hinta ennallaan 1 🪙 / kappale. Jos kolikot eivät
       riitä kaikkiin, soitetaan niin monta kuin niillä saa. */

    /* Nollaa huoneen tila: kursori, valinnat ja reunanilmaisut.
       HUOM: jukeQueuea ei nollata – jono saa soida loppuun huoneen ulkopuolella. */
    function resetJukeboxRoom() {
        ENV.jukeboxRoom = false;
        ENV.jukeSel = 0;
        ENV.jukeHeldUp = false;
        ENV.jukeHeldDown = false;
        ENV.jukeSpaceHeld = false;
        ENV.jukeEnterHeld = false;
        for (let i = 0; i < ENV.jukePick.length; i++) ENV.jukePick[i] = false;
    }

    /* Valitut kappaleet nousevassa järjestyksessä (1 → N) */
    function jukePickedTracks() {
        const out = [];
        for (let i = 0; i < ENV.JUKEBOX_TRACKS.length; i++) {
            if (ENV.jukePick[i]) out.push(i + 1);
        }
        return out;
    }

    /* Poistu ja soita valitut: veloitus 1 🪙 / kappale.
       Jos jono soi jo → valinnat lisätään jonon perään.
       Jos ei → uusi soitto alkaa valituista. */
    function jukeboxExitAndPlay() {
        const picks = jukePickedTracks();
        if (picks.length === 0) { resetJukeboxRoom(); return; }

        // Veloitus vain niistä kappaleista, joihin kolikot riittävät
        const play = [];
        for (let i = 0; i < picks.length && ENV.coinCount > 0; i++) {
            ENV.coinCount--;
            play.push(picks[i]);
        }
        if (play.length === 0) {
            ENV.showNotification('💰 No coins!');
            resetJukeboxRoom();
            return;
        }
        ENV.state.inventory.coinCount = ENV.coinCount;
        GameState.save(ENV.state);
        ENV.updateHUD();

        const urls = [];
        for (let i = 0; i < play.length; i++) urls.push(ENV.JUKEBOX_TRACKS[play[i] - 1].url);

        const alreadyPlaying = ENV.StreetAudio.isJukeboxPlaying();

        if (alreadyPlaying) {
            // Liitetään soivan jonon perään
            if (ENV.StreetAudio.appendJukeboxQueue(urls)) {
                // Päivitä street.js:n ENV.jukeQueue: lisää uudet nykyisen perään
                const qPos = ENV.StreetAudio.getJukeboxQueuePos();
                const before = (qPos >= 0) ? ENV.jukeQueue.slice(0, qPos + 1) : [];
                const after = (qPos >= 0) ? ENV.jukeQueue.slice(qPos + 1) : ENV.jukeQueue;
                ENV.jukeQueue = before.concat(play).concat(after);
                ENV.state.jukeQueue = ENV.jukeQueue.slice();
                ENV.state.jukePos = qPos;
                ENV.state.jukeboxPlayedOnce = true;
                GameState.save(ENV.state);
                ENV.playCoin();
                if (play.length < picks.length) {
                    ENV.showNotification('💰 Not enough coins for all – playing ' +
                                     play.length + '/' + picks.length);
                }
            } else {
                // Ääntä ei saatu → kolikot takaisin
                ENV.coinCount += play.length;
                ENV.state.inventory.coinCount = ENV.coinCount;
                GameState.save(ENV.state);
                ENV.updateHUD();
                ENV.showNotification('🔇 No audio – coins refunded.');
            }
        } else {
            // Uusi soitto
            if (ENV.StreetAudio.playJukeboxQueue(urls)) {
                ENV.jukeQueue = play.slice();
                ENV.state.jukeQueue = ENV.jukeQueue.slice();
                ENV.state.jukePos = 0;
                ENV.state.jukeboxPlayedOnce = true;
                GameState.save(ENV.state);
                ENV.jukeSavedPos = 0;
                ENV.playCoin();
                if (play.length < picks.length) {
                    ENV.showNotification('💰 Not enough coins for all – playing ' +
                                     play.length + '/' + picks.length);
                }
            } else {
                ENV.coinCount += play.length;
                ENV.state.inventory.coinCount = ENV.coinCount;
                GameState.save(ENV.state);
                ENV.updateHUD();
                ENV.showNotification('🔇 No audio – coins refunded.');
            }
        }
        resetJukeboxRoom();
    }

    /* Sulkee BARin; peruu tämän vierailun ostot (ENV.barBuyQty = 0). true = oli auki. */
    function closeBarRoom() {
        if (ENV.barRoom) {
            ENV.barRoom = false;
            ENV.barBuyQty = 0;
            ENV.barBuyHeldUp = false;
            ENV.barBuyHeldDown = false;
            return true;
        }
        return false;
    }

    /* Sulkee makuuhuoneen; kesken nukkumisen pimennys katkeaa (ENV.sleepPhase = 0). true = oli auki. */
    function closeSleepRoom() {
        if (ENV.sleepRoom) {
            ENV.sleepRoom = false;
            ENV.sleepSel = 0;
            ENV.sleepHeldUp = false;
            ENV.sleepHeldDown = false;
            if (ENV.sleepPhase > 0) { ENV.sleepPhase = 0; }  // kesken nukkumisen → herätä
            return true;
        }
        return false;
    }

    /* Sulkee jukebox-huoneen: valinnat pois ILMAN veloitusta. true = oli auki. */
    function closeJukeboxRoom() {
        if (ENV.jukeboxRoom) {
            // ✕ = peruuta: valinnat pois ilman veloitusta
            resetJukeboxRoom();
            return true;
        }
        return false;
    }
    /* ── Julkinen rajapinta (street.js:n huonerekisteri käyttää näitä) ── */
    return {
        bind: bind,
        drawSleep: drawSleepRoom,
        drawJukebox: drawJukeboxRoom,
        drawBar: drawBarRoom,
        updateSleepRoom: updateSleepRoom,
        updateBarRoom: updateBarRoom,
        updateJukeboxRoom: updateJukeboxRoom,
        closeSleepRoom: closeSleepRoom,
        closeBarRoom: closeBarRoom,
        closeJukeboxRoom: closeJukeboxRoom,
        resetJukeboxRoom: resetJukeboxRoom
    };
})();
