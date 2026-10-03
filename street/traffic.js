/* ═══════════════════════════════════════════════════════════
   street/traffic.js – ajoneuvojen piirto (liikenne-domainin piirtopuoli)
   (Vaihe 5 osa 4, v11.38 – siirretty street.js:stä, PELKKÄ SIIRTO.)

   Sisältö: `drawVehicle(v)` – auto, mopo+kuski, ambulanssi ja
   panssarivaunu (telaketjut, tykki, torni) sekä ajovalokiila.
   Ajoneuvojen LIIKENNELOGIIKKA (spawn, liike, törmäys) on yhä
   street.js:ssä – tässä on vain piirto, kuten osassa 3 lehti.

   Ulkopuolelta sidotaan (bind) live-getterit:
       H.ctx · H.dayT · H.VEHICLE_HEADLIGHT_DIM

   Ladataan ENNEN street.js:iä (index.html). Testipenkit liittävät samat
   osat samassa järjestyksessä: tools/tests/street-src.cjs.
   ═══════════════════════════════════════════════════════════ */
var StreetTraffic = (function () {
    /* ── Sidottu host (street.js asettaa bind():llä) ── */
    let H = null;
    function bind(host) { H = host; }

    /* ── Ajoneuvo ──────────────────────────────────── */
    function drawVehicle(v) {
        if (!v) return;
        const vx = Math.round(v.x), vy = Math.round(v.y), dir = v.direction;
        // Ajovalot himmenevät päivällä (v4.35) – sama liuku kuin katuvaloissa.
        // Takavalot ja ambulanssin kattovilkku eivät muutu (eivät ole ajovaloja).
        const headlightDim = 1 - H.VEHICLE_HEADLIGHT_DIM * H.dayT;
        const headlightOn  = v.hasHeadlight !== false && headlightDim > 0.01;
        H.ctx.save();
        if (dir === -1) { H.ctx.translate(vx + v.w / 2, 0); H.ctx.scale(-1, 1); H.ctx.translate(-(vx + v.w / 2), 0); }

        if (v.type === 'car') {
            const cx = vx, cy = vy;
            H.ctx.fillStyle = 'rgba(0,0,0,0.25)'; H.ctx.fillRect(cx + 3, cy + v.h - 4, v.w - 6, 6);
            H.ctx.fillStyle = '#9a9a9a'; H.ctx.fillRect(cx + 2, cy + 2, v.w - 4, v.h - 10);
            H.ctx.fillStyle = '#7a7a7a'; H.ctx.fillRect(cx + 10, cy, v.w - 20, v.h - 14);
            H.ctx.fillStyle = '#6ab8c8'; H.ctx.fillRect(cx + v.w - 20, cy + 3, 8, v.h - 18);
            H.ctx.fillStyle = '#558899'; H.ctx.fillRect(cx + 8, cy + 3, 7, v.h - 18);
            H.ctx.fillStyle = '#558899'; H.ctx.fillRect(cx + 26, cy + 3, 12, v.h - 18);
            H.ctx.fillStyle = '#cccccc'; H.ctx.fillRect(cx + v.w - 6, cy + v.h - 18, 6, 8);
            H.ctx.fillStyle = '#aaaaaa'; H.ctx.fillRect(cx, cy + v.h - 18, 5, 8);
            if (headlightDim > 0.01) {               // ajovalo + hehku (pois päivällä, v4.35)
                H.ctx.globalAlpha = headlightDim;
                H.ctx.fillStyle = '#ffee88'; H.ctx.fillRect(cx + v.w - 4, cy + 6, 5, 4);
                H.ctx.fillStyle = 'rgba(255,240,150,0.4)'; H.ctx.fillRect(cx + v.w + 1, cy + 5, 3, 6);
                H.ctx.globalAlpha = 1;
            }
            H.ctx.fillStyle = '#cc3333'; H.ctx.fillRect(cx - 1, cy + 6, 4, 3);
            const wr = 5;
            H.ctx.fillStyle = '#111'; H.ctx.beginPath(); H.ctx.arc(cx + 14, cy + v.h - 4, wr, 0, Math.PI * 2); H.ctx.fill();
            H.ctx.beginPath(); H.ctx.arc(cx + v.w - 14, cy + v.h - 4, wr, 0, Math.PI * 2); H.ctx.fill();
            H.ctx.fillStyle = '#555'; H.ctx.beginPath(); H.ctx.arc(cx + 14, cy + v.h - 4, 2.5, 0, Math.PI * 2); H.ctx.fill();
            H.ctx.beginPath(); H.ctx.arc(cx + v.w - 14, cy + v.h - 4, 2.5, 0, Math.PI * 2); H.ctx.fill();
        } else if (v.type === 'ambulance') {
            const cx = vx, cy = vy;
            // Varjo
            H.ctx.fillStyle = 'rgba(0,0,0,0.25)'; H.ctx.fillRect(cx + 3, cy + v.h - 4, v.w - 6, 6);
            // Valkoinen kori
            H.ctx.fillStyle = '#e8e8e8'; H.ctx.fillRect(cx + 2, cy + 4, v.w - 4, v.h - 14);
            // Katto
            H.ctx.fillStyle = '#f4f4f4'; H.ctx.fillRect(cx + 6, cy + 1, v.w - 12, v.h - 15);
            // Tumma alareuna
            H.ctx.fillStyle = '#555'; H.ctx.fillRect(cx + 4, cy + v.h - 12, v.w - 8, 2);
            // Punainen risti kyljessä
            const rcx = cx + v.w / 2, rcy = cy + 14;
            H.ctx.fillStyle = '#cc0000';
            H.ctx.fillRect(rcx - 12, rcy - 2, 24, 4);
            H.ctx.fillRect(rcx - 2, rcy - 12, 4, 24);
            // Etuikkuna
            H.ctx.fillStyle = '#6ab8c8'; H.ctx.fillRect(cx + v.w - 18, cy + 5, 10, v.h - 21);
            // Takaikkuna
            H.ctx.fillStyle = '#558899'; H.ctx.fillRect(cx + 4, cy + 5, 6, v.h - 21);
            // Keltainen vilkkuvalo katolla + hehku (vilkkuva)
            const flashOn = Math.sin(Date.now() * 0.012) > -0.3;
            if (flashOn) {
                H.ctx.fillStyle = '#ffcc00'; H.ctx.fillRect(cx + v.w/2 - 4, cy - 3, 8, 4);
                H.ctx.fillStyle = 'rgba(255,240,100,0.45)'; H.ctx.fillRect(cx + v.w/2 - 2, cy - 5, 4, 3);
                H.ctx.fillRect(cx + v.w/2 - 6, cy - 2, 12, 2);
            }
            // Renkaat
            const wr = 5;
            H.ctx.fillStyle = '#111'; H.ctx.beginPath(); H.ctx.arc(cx + 14, cy + v.h - 4, wr, 0, Math.PI * 2); H.ctx.fill();
            H.ctx.beginPath(); H.ctx.arc(cx + v.w - 14, cy + v.h - 4, wr, 0, Math.PI * 2); H.ctx.fill();
            H.ctx.fillStyle = '#555'; H.ctx.beginPath(); H.ctx.arc(cx + 14, cy + v.h - 4, 2.5, 0, Math.PI * 2); H.ctx.fill();
            H.ctx.beginPath(); H.ctx.arc(cx + v.w - 14, cy + v.h - 4, 2.5, 0, Math.PI * 2); H.ctx.fill();
            // Takavalo
            H.ctx.fillStyle = '#cc3333'; H.ctx.fillRect(cx - 1, cy + v.h - 16, 4, 3);
        } else if (v.type === 'motorcycle') {
            // ── Mopo + kuski (kerrokset: runko → kuski → etukate/tanko) ──
            const cx = vx, cy = vy;

            // 1. Maavarjo
            H.ctx.fillStyle = 'rgba(0,0,0,0.25)'; H.ctx.fillRect(cx + 2, cy + v.h - 2, v.w - 4, 4);

            // 2. Renkaat (takana + edessä)
            const wr = 5;
            H.ctx.fillStyle = '#111';
            H.ctx.beginPath(); H.ctx.arc(cx + 7, cy + v.h - 5, wr, 0, Math.PI * 2); H.ctx.fill();
            H.ctx.beginPath(); H.ctx.arc(cx + v.w - 7, cy + v.h - 5, wr, 0, Math.PI * 2); H.ctx.fill();
            H.ctx.fillStyle = '#555';
            H.ctx.beginPath(); H.ctx.arc(cx + 7, cy + v.h - 5, 2, 0, Math.PI * 2); H.ctx.fill();
            H.ctx.beginPath(); H.ctx.arc(cx + v.w - 7, cy + v.h - 5, 2, 0, Math.PI * 2); H.ctx.fill();

            // 3. Runko + penkki (taainnaisena)
            H.ctx.fillStyle = '#B71C1C';                       // astinlauta
            H.ctx.fillRect(cx + 15, cy + 15, 14, 3);
            H.ctx.fillStyle = '#D32F2F';                       // moottorin kate (punainen runko)
            H.ctx.fillRect(cx + 3, cy + 8, 15, 9);
            H.ctx.fillStyle = '#222222';                       // penkki
            H.ctx.fillRect(cx + 3, cy + 4, 12, 4);

            // 4. Kuski (istuu penkillä, pelaajan värit)
            H.ctx.fillStyle = '#3366cc';                       // vartalo (sininen paita)
            H.ctx.fillRect(cx + 4, cy - 8, 9, 12);
            H.ctx.fillStyle = '#16265c';                       // jalat (housut)
            H.ctx.fillRect(cx + 8, cy + 4, 7, 4);              //   reisi eteen
            H.ctx.fillRect(cx + 13, cy + 8, 3, 8);             //   sääri astinlaudalle
            H.ctx.fillStyle = '#ffcc99';                       // pää (iho)
            H.ctx.fillRect(cx + 4, cy - 16, 8, 9);
            H.ctx.fillStyle = '#553300';                       // hiukset (otsatukka)
            H.ctx.fillRect(cx + 10, cy - 15, 2, 2);
            H.ctx.fillStyle = '#2b2118';                       // silmä (katse eteen)
            H.ctx.fillRect(cx + 10, cy - 12, 2, 2);
            H.ctx.fillStyle = '#3366cc';                       // lippis (kupu)
            H.ctx.fillRect(cx + 3, cy - 19, 11, 4);
            H.ctx.fillStyle = '#224488';                       // lippis (lippa eteen)
            H.ctx.fillRect(cx + 11, cy - 17, 6, 3);
            H.ctx.fillStyle = '#3366cc';                       // käsi ojennettuna tankoon
            H.ctx.beginPath();
            H.ctx.moveTo(cx + 10, cy - 5);                     //   olkapää
            H.ctx.lineTo(cx + 21, cy - 2);                     //   ranne
            H.ctx.lineTo(cx + 20, cy + 1);                     //   ranteen alaosa
            H.ctx.lineTo(cx + 9, cy - 1);                      //   kainalo
            H.ctx.fill();
            H.ctx.fillStyle = '#ffcc99';                       // sormet tangolla
            H.ctx.fillRect(cx + 20, cy - 3, 3, 4);

            // 5. Etukate + ohjaustanko (kuskin päälle → syvyys)
            H.ctx.fillStyle = '#D32F2F';
            H.ctx.beginPath();
            H.ctx.moveTo(cx + 29, cy + 17);
            H.ctx.lineTo(cx + 25, cy + 3);
            H.ctx.lineTo(cx + 33, cy + 3);
            H.ctx.lineTo(cx + 37, cy + 17);
            H.ctx.fill();
            H.ctx.fillStyle = '#555555';                       // tanko + mittaristo
            H.ctx.fillRect(cx + 20, cy, 12, 3);

            // 6. Valot
            H.ctx.fillStyle = '#cc3333';                       // takavalo (jää palamaan)
            H.ctx.fillRect(cx + 1, cy + 8, 2, 4);
            if (headlightDim > 0.01) {                       // etuvalo pois päivällä (v4.35)
                H.ctx.globalAlpha = headlightDim;
                H.ctx.fillStyle = '#ffee88';                   // etuvalo
                H.ctx.fillRect(cx + 34, cy + 3, 3, 4);
                H.ctx.fillStyle = 'rgba(255,240,150,0.4)';     // etuvalon hehku
                H.ctx.fillRect(cx + 37, cy + 3, 2, 4);
                H.ctx.globalAlpha = 1;
            }
        } else if (v.type === 'tank') {
            const cx = vx, cy = vy;
            
            // 1. Varjo (pidetään vähän leveämpänä)
            H.ctx.fillStyle = 'rgba(0,0,0,0.3)'; 
            H.ctx.fillRect(cx - 2, cy + v.h - 4, v.w + 4, 8);

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
            const barrelGrad = H.ctx.createLinearGradient(0, muzzleY, 0, muzzleY + muzzleH);
            barrelGrad.addColorStop(0,   '#0e0e0e');  // yläreuna (tumma)
            barrelGrad.addColorStop(0.5, '#555555');  // keskusta (vaalea)
            barrelGrad.addColorStop(1,   '#0a0a0a');  // alareuna (tummin)
            H.ctx.fillStyle = barrelGrad;
            H.ctx.fillRect(barrelX, barrelY, barrelLen, barrelH);                     // putki
            H.ctx.fillRect(barrelX + barrelLen - muzzleW, muzzleY, muzzleW, muzzleH); // suujarru

            // 3. Maastovärinen panssarirunko
            H.ctx.fillStyle = '#5a6b3c'; 
            H.ctx.fillRect(cx, cy + 8, v.w, v.h - 18);
            // Rungon viisteet/yksityiskohdat
            H.ctx.fillStyle = '#4a5730';
            H.ctx.fillRect(cx, cy + 8, v.w, 3); // Tummempi yläreuna rungossa

            // 4. Torni (Keskitetympi, vähän korkeampi)
            H.ctx.fillStyle = '#4d5c32'; 
            H.ctx.fillRect(cx + 10, cy + 2, v.w - 20, v.h - 22);
            H.ctx.fillStyle = '#3f4d28'; 
            H.ctx.fillRect(cx + 14, cy + 2, v.w - 28, v.h - 22);
            
            // 5. Tornin luukku (Se mitä piirsit punaisella ylös)
            H.ctx.fillStyle = '#2a2a2a';
            H.ctx.fillRect(cx + v.w / 2 - 8, cy, 16, 3); // Luukun pohja
            H.ctx.fillStyle = '#111';
            H.ctx.fillRect(cx + v.w / 2 - 4, cy - 1, 8, 2); // Luukun kansi

            // 6. Telaketjujen tausta (Koko alaosan peittävä muoto)
            H.ctx.fillStyle = '#1a1a1a';
            H.ctx.beginPath();
            H.ctx.moveTo(cx + 2, cy + v.h - 10);      // Ylä-vasen
            H.ctx.lineTo(cx + v.w - 2, cy + v.h - 10);// Ylä-oikea
            H.ctx.lineTo(cx + v.w, cy + v.h - 2);     // Ala-oikea (viistottu)
            H.ctx.lineTo(cx, cy + v.h - 2);           // Ala-vasen (viistottu)
            H.ctx.fill();

            // Telaketjun ylänauhan korostus
            H.ctx.fillStyle = '#333';
            H.ctx.fillRect(cx + 2, cy + v.h - 10, v.w - 4, 2);

            // 7. Telapyörät (Renkaat telaketjun sisällä)
            const numWheels = 5;
            const wheelSpacing = (v.w - 10) / (numWheels - 1); 
            
            for (let i = 0; i < numWheels; i++) {
                const wx = cx + 5 + (i * wheelSpacing);
                const wy = cy + v.h - 5; // Renkaiden Y-korkeus
                
                // Ulkorengas (harmaa)
                H.ctx.fillStyle = '#555555';
                H.ctx.beginPath(); 
                H.ctx.arc(wx, wy, 3.5, 0, Math.PI * 2); 
                H.ctx.fill();
                
                // Renkaan napa/keskiö (tumma)
                H.ctx.fillStyle = '#111111';
                H.ctx.beginPath(); 
                H.ctx.arc(wx, wy, 1.5, 0, Math.PI * 2); 
                H.ctx.fill();
            }

            // 8. Tummia yksityiskohtia (pieniä pakoputkia/tuuletusaukkoja takaosaan, vasemmalle)
            H.ctx.fillStyle = '#222';
            H.ctx.fillRect(cx + 4, cy + 10, 6, 2);
            H.ctx.fillRect(cx + 4, cy + 14, 6, 2);
        }

        // ── Ajovalot eteenpäin (kaikille ajoneuvotyypeille) ──
        //    Himmenevät päivällä (v4.35); kun kartio on kokonaan himmennyt,
        //    sitä ei piirretä lainkaan.
        if (headlightOn) {
            H.ctx.globalAlpha = headlightDim;
            const beamY = v.type === 'motorcycle' ? vy + v.h * 0.3 : vy + v.h - 12;
            const beamLen = v.type === 'ambulance' ? 140 : v.type === 'car' ? 105 : 70;
            const beamSpread = 10;
            const beamGrad = H.ctx.createLinearGradient(vx + v.w, beamY, vx + v.w + beamLen, beamY);
            beamGrad.addColorStop(0, 'rgba(255,250,220,0.32)');
            beamGrad.addColorStop(0.4, 'rgba(255,250,220,0.12)');
            beamGrad.addColorStop(1, 'rgba(255,250,220,0)');
            H.ctx.fillStyle = beamGrad;
            H.ctx.beginPath();
            H.ctx.moveTo(vx + v.w, beamY - 3);
            H.ctx.lineTo(vx + v.w + beamLen, beamY - beamSpread);
            H.ctx.lineTo(vx + v.w + beamLen, beamY + beamSpread);
            H.ctx.lineTo(vx + v.w, beamY + 3);
            H.ctx.closePath();
            H.ctx.fill();
            H.ctx.globalAlpha = 1;
        }

        H.ctx.restore();
    }

    /* ── Liikenne: ajoneuvojen liike, spawnit ja törmäys ──────────
       Kaksi ajorataa (H.LANE_DEFS). Päivällä liikennevirta tuplataan
       (v4.37): spawn-laskuri kuluu H.TRAFFIC_DAY_MULT-kertaista vauhtia ja
       kerroin liukuu H.dayT:n mukana (1 = yö, H.TRAFFIC_DAY_MULT = täysi päivä).
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
       (`manhole.action`) → liike, spawnit ja moottoriäänet eivät enää jäädy
       näiden tilojen ajaksi. Ennen korjausta `v.x` seisoi, jolloin moottorin
       panorointi (lasketaan v.x:stä) jäi jumiin ja ajoneuvo palasi kadulle
       täsmälleen samasta kohdasta.
       HUOM (v11.10): sama periaate myös tainnutuksessa (`update()`in
       knockedDown-haara) – mutta VAIN jos kaataja ei ollut auto. Auton osuma
       on kolari, johon liikenne on osallisena → silloin liikenne seisoo koko
       tainnutuksen ajan (`H.player.knockFallY` asetetaan vain tässä funktiossa,
       joten se toimii merkkinä auton osumasta).
       `H.PLAYER_DEPTH_MAX_Y` (WORLD_H - 50 = 350) on sama raja kuin
       update()in paikallinen PLAYER_Y_MAX (aidan yläreuna). */
    function updateTraffic(dt, playerSafe) {
        let playerHit = false;

        // 1) Liike ja spawnit
        for (let li = 0; li < H.LANE_DEFS.length; li++) {
            const lane = H.LANE_DEFS[li];
            if (!H.vehicles[li]) {
                H.spawnTimers[li] -= dt * (1 + (H.TRAFFIC_DAY_MULT - 1) * H.dayT);
                if (H.spawnTimers[li] <= 0) {
                    const dir = lane.direction;
                    let vehRnd = Math.random();
                    let type, w, h, speed;
                    if (H.chaosAllGone()) vehRnd = 0.74;   // v11.36: BAD/FULL rauniot – vain ambulanssit
                    if (vehRnd < 0.37) {
                        type = 'car'; w = 80; h = 30; speed = (1.0 + Math.random() * 0.5) * H.trafficSpeedMult;
                    } else if (vehRnd < 0.74) {
                        type = 'motorcycle'; w = 40; h = 22; speed = (1.5 + Math.random() * 1.0) * H.trafficSpeedMult;
                    } else if (vehRnd < 0.98) {
                        type = 'ambulance'; w = 80; h = 34; speed = (1.8 + Math.random() * 1.2) * H.trafficSpeedMult;
                    } else {
                        // Panssarivaunu on tarkoituksella todella harvinainen: ~2 %
                        // (1/50) spawnauksista. Muu liikenne: auto 37 %, mopo 37 %,
                        // ambulanssi 24 %. (Aiempi vaunun osuus oli 8 %.)
                        type = 'tank'; w = 86; h = 36; speed = (0.4 + Math.random() * 0.4) * H.trafficSpeedMult;
                    }
                    const vehicle = {
                        type,
                        x: dir > 0 ? -w : H.WORLD_W + w,
                        y: lane.y,
                        w, h,
                        vx: dir * speed,
                        direction: dir,
                        hasHeadlight: (type === 'tank') ? false : (type !== 'motorcycle' || Math.random() < 0.5)
                    };
                    vehicle.engine = H.sfx.startEngine(vehicle);
                    H.vehicles[li] = vehicle;
                    H.spawnTimers[li] = (1200 + Math.random() * 1200) * H.trafficSpawnMult; // 20–40s (kaaos: tiheys)
                }
            } else {
                const v = H.vehicles[li];
                v.x += v.vx * dt;
                H.sfx.updateEngine(v.engine, v);
                if ((v.direction > 0 && v.x > H.WORLD_W + v.w + 10) || (v.direction < 0 && v.x < -v.w - 10)) {
                    H.sfx.stopEngine(v.engine);
                    H.vehicles[li] = null;
                }
            }
        }

        // 2) Törmäys (molemmat kaistat) – ohitetaan, kun pelaaja on sisällä
        if (!playerSafe && !H.player.knockedDown) {
            const playerCY = H.player.y + H.player.h / 2;
            const gapCenter = (H.LANE_DEFS[0].y + H.LANE_DEFS[1].y) / 2;  // 334
            const inGap = Math.abs(playerCY - gapCenter) < 5;          // ±5px turvakaista

            // Kumman kaistan auton kanssa pelaaja on enemmän limittäin?
            const CAR_H = 30; // tyypillinen auton korkeus
            const pTop = H.player.y, pBot = H.player.y + H.player.h;
            const ov0 = Math.max(0, Math.min(pBot, H.LANE_DEFS[0].y + CAR_H) - Math.max(pTop, H.LANE_DEFS[0].y));
            const ov1 = Math.max(0, Math.min(pBot, H.LANE_DEFS[1].y + CAR_H) - Math.max(pTop, H.LANE_DEFS[1].y));

            for (let li = 0; li < H.LANE_DEFS.length; li++) {
                const v = H.vehicles[li];
                if (!v) continue;

                // Pelaaja teräsaidan juuressa → ei kumpikaan kaista osu
                if (H.player.y >= H.PLAYER_DEPTH_MAX_Y - 3) continue;

                // Pelaaja kaistojen välisessä raossa → ei osumaa
                if (inGap) continue;

                // Pelaaja on vain lähimmällä kaistalla – kauemman kaistan autot menevät ohi
                if (li === 0 && ov1 > ov0) continue;
                if (li === 1 && ov0 > ov1) continue;

                const vCollisionTop = v.y + v.h * 0.5;
                if (v.x < H.player.x + H.player.w && v.x + v.w > H.player.x &&
                    H.player.y + H.player.h > vCollisionTop && H.player.y < v.y + v.h) {
                    H.player.knockedDown = true;
                    H.player.knockdownTimer = 600;
                    H.player.kicking = false;
                    H.player.kickFrame = 0;
                    // Kaadutaan 25 px ylös osumakohdasta (v4.78: 10 px, v11.12: 25 px,
                    // jotta pysähtynyt auto ei osu heti uudelleen ylösnoustessa) – muuten
                    // pelaaja jää makaamaan keskelle tietä ja autot kolarijatkuvat
                    // katkeamatta päältä
                    H.player.knockFallY = H.player.y + H.player.h - 25;
                    H.spawnParticles(H.player.x + H.player.w / 2, H.player.y + H.player.h / 2, '#ffaa44', 15);
                    H.sfx.playKnock();   // "Smack"-tömähdys
                    H.vehicleShakeTimer = 90;  // ~1.5s tärinä
                    H.collisionCost();   // v11.31: FULL → −1 🪙, muuten −1 🍔
                    playerHit = true;
                    break;
                }
            }
        }

        return playerHit;
    }
    /* ── Julkinen rajapinta (street.js käyttää tätä) ── */
    return { bind: bind, drawVehicle: drawVehicle, update: updateTraffic };
})();
