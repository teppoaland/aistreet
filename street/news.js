/* ═══════════════════════════════════════════════════════════
   street/news.js – sanomalehden asettelu ja piirto
   (Vaihe 5 osa 3, v11.38 – siirretty street.js:stä, PELKKÄ SIIRTO.)

   Sisältö: lehden sisältödata (NEWSPAPER_PAGES + manuaalin ASCII-piirros),
   tekstin kääriminen (wrapNewsText), fontin sovitus (fitNewsFont),
   näyttösovitus (newsLayout) sekä piirto (kadun lehti, poimintavihje ja
   koko ruudun lehtinäkymä).

   Moduuli OMISTAA:
       screen   – näkyvä "näyttö" (pitkä sivu voi olla usealla)
       cache    – asettelun välimuisti (avain = leveys + fonttikoot)

   Ulkopuolelta sidotaan (bind) host-rajapinta, jossa on live-getterit
   street.js:n sulkeuman arvoille – näin arvot pysyvät ajan tasalla
   ilman erillistä synkronointia:
       H.ctx · H.canvas · H.viewW · H.foreground · H.player ·
       H.vehicles · H.newsRoom · H.iframeOpen ·
       H.WORLD_W · H.WORLD_H · H.VIEWW_MIN

   Ladataan ENNEN street.js:iä (index.html). Testipenkit liittävät samat
   osat samassa järjestyksessä: tools/tests/street-src.cjs.
   ═══════════════════════════════════════════════════════════ */
var StreetNews = (function () {
    /* ── Sidottu host (street.js asettaa bind():llä) ── */
    let H = null;
    function bind(host) { H = host; }

    /* ── Moduulin oma tila ── */
    let screen = 0;            // näkyvä "näyttö" (pitkä sivu voi olla usealla)

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
        const n = H.foreground.newspaper;
        const t = Date.now() * 0.0008;
        const flipAngle = n.angle + Math.sin(t + n.x * 0.01) * 0.04;
        H.ctx.save();
        H.ctx.translate(n.x, n.y);
        H.ctx.rotate(flipAngle);
        H.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        H.ctx.fillRect(1, 2, 22, 12);
        H.ctx.fillStyle = '#999';
        H.ctx.fillRect(0, 0, 22, 12);
        H.ctx.fillStyle = '#aaa';
        H.ctx.fillRect(0, 0, 22, 1);
        H.ctx.fillStyle = '#666';
        H.ctx.fillRect(2, 3, 12, 1);
        H.ctx.fillRect(2, 5, 16, 1);
        H.ctx.fillRect(2, 7, 10, 1);
        H.ctx.fillRect(12, 7, 4, 1);
        H.ctx.fillStyle = '#777';
        H.ctx.fillRect(2, 9, 14, 1);
        H.ctx.restore();
    }

    /* Onko pelaaja lehden kohdalla? (sama ajatus kuin kolikon keräys) */
    function nearNewspaper() {
        const n = (H.foreground && H.foreground.newspaper) ? H.foreground.newspaper : null;
        if (!n) return false;
        const dx = (H.player.x + H.player.w / 2) - (n.x + 11);
        const dy = (H.player.y + H.player.h / 2) - (n.y + 6);
        return (dx * dx + dy * dy) <= NEWS_READ_R * NEWS_READ_R;
    }

    /* Pieni vihje lehden yläpuolella, kun sen voi poimia (v4.53) */
    function drawNewspaperHint() {
        if (H.newsRoom || H.iframeOpen) return;
        const n = (H.foreground && H.foreground.newspaper) ? H.foreground.newspaper : null;
        if (!n || !nearNewspaper()) return;
        const label = 'Read';
        const cx = n.x + 11;
        const cy = n.y - 16;
        H.ctx.save();
        H.ctx.font = 'bold 8px "Courier New", monospace';
        H.ctx.textAlign = 'center';
        H.ctx.textBaseline = 'middle';
        const w = Math.round(H.ctx.measureText(label).width) + 10;
        const bx = Math.round(cx - w / 2);
        H.ctx.fillStyle = 'rgba(8,8,14,0.82)';
        H.ctx.fillRect(bx, cy - 7, w, 14);
        H.ctx.strokeStyle = '#8a836f';
        H.ctx.lineWidth = 1;
        H.ctx.strokeRect(bx + 0.5, cy - 6.5, w - 1, 13);
        H.ctx.fillStyle = '#ffe9a8';
        H.ctx.fillText(label, cx, cy);
        H.ctx.restore();
    }

    /* Käärii yhden kappaleen näkyvään sarakeleveyteen sana kerrallaan */
    function wrapNewsText(text, maxW) {
        const out = [];
        let line = '';
        const words = String(text).split(' ');
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const test = line ? line + ' ' + word : word;
            if (H.ctx.measureText(test).width <= maxW) { line = test; continue; }
            if (line) { out.push(line); line = ''; }
            if (H.ctx.measureText(word).width > maxW) {
                // Yksittäinen sana on saraketta leveämpi → pilkotaan merkki kerrallaan
                let part = '';
                for (const ch of word) {
                    if (part && H.ctx.measureText(part + ch).width > maxW) { out.push(part); part = ch; }
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
        H.ctx.font = pre + fs + 'px ' + family;
        while (fs > minFs && H.ctx.measureText(text).width > maxW) {
            fs--;
            H.ctx.font = pre + fs + 'px ' + family;
        }
        return fs;
    }

    /* ── Sanomalehden asettelu (v4.53) ────────────────────────────
       Sama näyttösovitus kuin huoneissa (winW, vs, needPx): kapea kännykkä
       zoomataan 1:1:tä suuremmaksi, joten fontin maailmakoko voi olla
       pienempi ja näkyä silti isona. Kaikki kappaleet kääritään sarakkeen
       leveyteen ja jaetaan näkyvän korkeuden mittaisiin "näyttöihin" →
       mitään ei koskaan leikata millään näytöllä. Tulos välimuistiin. */
    let cache = { key: '', layout: null };

    function newsLayout() {
        const winW = Math.round(Math.min(H.WORLD_W, Math.max(H.VIEWW_MIN, H.viewW)));
        const vs = (H.canvas && H.canvas.height && H.canvas.clientHeight)
            ? H.canvas.clientHeight / H.canvas.height : 1;
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
        if (cache.key === key && cache.layout) return cache.layout;

        H.ctx.save();
        H.ctx.font = bodyFs + 'px "Courier New", monospace';
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
                H.ctx.font = chosen.fs + 'px "Courier New", monospace';
                const cellW = Math.max(2, H.ctx.measureText('M').width);
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
                const indentPx = indent ? H.ctx.measureText(indent).width : 0;
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
        H.ctx.restore();   // mittauksen fontti ei vuoda kadun piirtoon

        const layout = {
            winW: winW, panelX: panelX, panelW: panelW, padX: padX, rowX: rowX, rowW: rowW,
            mastFs: mastFs, titleFs: titleFs, bodyFs: bodyFs, smallFs: smallFs, lineH: lineH,
            paperTop: paperTop, paperBottom: paperBottom, subY: subY, mastY: mastY, ruleY: ruleY,
            titleY: titleY, textTop: textTop, textBottom: textBottom, footerY: footerY,
            maxLines: maxLines, screens: screens
        };
        cache = { key: key, layout: layout };
        return layout;
    }

    /* Sanomalehtinäkymä (v4.53): vaalea paperiarkki, tumma selkeä teksti.
       Piirto on save()/restore()-parin sisällä, ettei tila vuoda kadulle. */
    function drawNewspaperView() {
        const L = newsLayout();
        const idx = Math.max(0, Math.min(L.screens.length - 1, screen));
        const scr = L.screens[idx];
        const pageCount = NEWSPAPER_PAGES.length;
        const page = NEWSPAPER_PAGES[scr.page];
        const pageScreens = L.screens.filter(s => s.page === scr.page).length;
        const onPage = L.screens.slice(0, idx + 1).filter(s => s.page === scr.page).length;
        const pageTxt = 'PAGE ' + (scr.page + 1) + '/' + pageCount +
                        (pageScreens > 1 ? '  (' + onPage + '/' + pageScreens + ')' : '');
        const hint = '▲/▼ = page   Space = next   (o)/Enter = exit';

        H.ctx.save();
        H.ctx.shadowBlur = 0;
        H.ctx.shadowColor = 'rgba(0,0,0,0)';
        H.ctx.textBaseline = 'alphabetic';

        // 1) Tausta: katu jää tummaksi arkin taakse
        H.ctx.fillStyle = '#07070c';
        H.ctx.fillRect(0, 0, H.WORLD_W, H.WORLD_H);

        // 2) Paperiarkki, varjo ja ohut reuna
        H.ctx.fillStyle = 'rgba(0,0,0,0.55)';
        H.ctx.fillRect(L.panelX + 3, L.paperTop + 5, L.panelW, L.paperBottom - L.paperTop);
        H.ctx.fillStyle = '#f4eede';
        H.ctx.fillRect(L.panelX, L.paperTop, L.panelW, L.paperBottom - L.paperTop);
        H.ctx.strokeStyle = '#c6bca2';
        H.ctx.lineWidth = 1;
        H.ctx.strokeRect(L.panelX + 0.5, L.paperTop + 0.5, L.panelW - 1, L.paperBottom - L.paperTop - 1);

        // 3) Ylätunniste: lehden nimi (vasen) ja sivunumero (oikea).
        //    Jos kadulla on ajoneuvo liikkeellä, vasen teksti vaihtuu
        //    vilkkuvaksi varoitukseksi (v4.54) – lukija ehtii sulkea lehden.
        const trafficComing = !!(H.vehicles[0] || H.vehicles[1]);
        const topTxt = trafficComing ? '⚠ WATCH OUT – TRAFFIC NEVER STOPS!'
                                     : 'NEWS · GAME GUIDE';
        H.ctx.fillStyle = '#6a6250';
        H.ctx.textAlign = 'left';
        H.ctx.font = 'bold ' + L.smallFs + 'px "Courier New", monospace';
        const pageW = H.ctx.measureText(pageTxt).width;
        fitNewsFont(topTxt, L.rowW - pageW - 10, L.smallFs, 7, '"Courier New", monospace', 'bold');
        if (trafficComing) {
            H.ctx.fillStyle = (Math.sin(Date.now() * 0.012) > 0) ? '#a51212' : '#c07a12';
        }
        H.ctx.fillText(topTxt, L.rowX, L.subY);
        // Sivunumero omalla fontillaan, vaikka varoitusteksti olisi kutistettu
        H.ctx.font = 'bold ' + L.smallFs + 'px "Courier New", monospace';
        H.ctx.textAlign = 'right';
        H.ctx.fillText(pageTxt, L.rowX + L.rowW, L.subY);

        // 4) Mastoke + kaksinkertainen viiva
        H.ctx.textAlign = 'center';
        fitNewsFont('AI CHAOS STREET', L.rowW, L.mastFs, 9, '"Press Start 2P", monospace', 'normal');
        H.ctx.fillStyle = '#141414';
        H.ctx.fillText('AI CHAOS STREET', 400, L.mastY);
        H.ctx.fillRect(L.panelX + 8, L.ruleY, L.panelW - 16, 2);
        H.ctx.fillRect(L.panelX + 8, L.ruleY + 3, L.panelW - 16, 1);

        // 5) Sivun otsikko
        fitNewsFont(page.title, L.rowW - 8, L.titleFs, 8, '"Press Start 2P", monospace', 'normal');
        H.ctx.fillStyle = '#8c1d1d';
        H.ctx.fillText(page.title, 400, L.titleY);

        // 6) Leipäteksti (valmiiksi käärityt rivit) TAI manuaalin ASCII-piirros
        H.ctx.fillStyle = '#16150f';
        if (scr.art) {
            const A = scr.art;
            const x0 = L.rowX + Math.max(0, Math.round((L.rowW - A.cols * A.cellW) / 2));
            H.ctx.font = A.fs + 'px "Courier New", monospace';
            H.ctx.textAlign = 'center';
            for (let i = 0; i < A.lines.length; i++) {
                const chars = Array.from(A.lines[i]);      // emoji = yksi merkki
                const baseline = A.top + A.fs + i * A.lineH;
                for (let c = 0; c < chars.length; c++) {
                    if (chars[c] === ' ') continue;
                    H.ctx.fillText(chars[c], x0 + (c + 0.5) * A.cellW, baseline);
                }
            }
            H.ctx.textAlign = 'left';
        } else {
            H.ctx.textAlign = 'left';
            H.ctx.font = L.bodyFs + 'px "Courier New", monospace';
            for (let i = 0; i < scr.lines.length; i++) {
                if (!scr.lines[i]) continue;
                H.ctx.fillText(scr.lines[i], L.rowX, L.textTop + L.bodyFs + i * L.lineH);
            }
        }

        // 7) Alatunniste: ohjeet (vasen) ja sivunumero (oikea)
        fitNewsFont(hint, L.rowW - pageW - 12, L.smallFs, 7, '"Courier New", monospace', 'bold');
        H.ctx.fillStyle = '#6a6250';
        H.ctx.textAlign = 'left';
        H.ctx.fillText(hint, L.rowX, L.footerY);
        H.ctx.font = 'bold ' + L.smallFs + 'px "Courier New", monospace';
        H.ctx.textAlign = 'right';
        H.ctx.fillText(pageTxt, L.rowX + L.rowW, L.footerY);
        H.ctx.textAlign = 'left';

        H.ctx.restore();
    }
    /* ── Julkinen rajapinta (street.js käyttää näitä) ── */
    return {
        bind: bind,
        reset: function () { screen = 0; },
        layout: function () { return newsLayout(); },
        index: function () { return screen; },
        count: function () { return newsLayout().screens.length; },
        next: function () {
            const n = newsLayout().screens.length;
            screen = Math.min(Math.max(0, n - 1), screen + 1);
        },
        prev: function () { screen = Math.max(0, screen - 1); },
        near: function () { return nearNewspaper(); },
        drawOnStreet: function () { drawNewspaper(); },
        drawHint: function () { return drawNewspaperHint(); },
        drawView: function () { return drawNewspaperView(); }
    };
})();
