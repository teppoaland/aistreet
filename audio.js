/* ═══════════════════════════════════════════════════════════
   audio.js – AI CHAOS STREET -taustamusiikki
   Taustamusiikki = proseduraalinen syntikkalooppi (Web Audio):
   rummut + basso + särökitara + melodia, soi 30 s jaksoissa.
   MUSIC_SOURCE = 'mp3' ottaa tilalle aidon äänitteen (varatie).
   Aidot koko kappaleet soi vain kadun jukebox-huoneesta.
   ═══════════════════════════════════════════════════════════ */

const StreetAudio = (() => {
    let ctx = null;
    let masterGain = null;
    let synthGain = null;    // syntikan oma väylä (mykistetään jukeboxin/MP3:n ajaksi)
    let drumGain = null;
    let bassGain = null;
    let guitarGain = null;
    let leadGain = null;
    let loopId = null;
    let started = false;
    let melodyReverse = false;

    // ── Taustamusiikin lähde ─────────────────────────────────
    // 'synth' = proseduraalinen syntikkalooppi (oletus – soi aina)
    // 'mp3'   = aito äänite MUSIC_FILE (alku + häivytys, varatie)
    const MUSIC_SOURCE = 'synth';
    const MUSIC_FILE = 'knived_unafraid.mp3';

    // ── MP3-kappale (aito äänite, soitetaan vain alku) ────────
    // Käytössä vain kun MUSIC_SOURCE === 'mp3'
    let musicEl = null;       // <audio>-elementti, soi suoraan (ei Web Audio -reititystä)
    let musicReady = false;   // tiedosto ladattu ja soitettavissa (canplay)
    let musicPlayed = 0;      // montako kertaa soitettu tässä syklissä (1 = kertasoitto)
    let musicBlocked = false; // autoplay estetty (NotAllowedError) – yritetään uudelleen eleessä
    let fadeTimer = null;     // MP3-häivytyksen interval-tunniste (soiton lopetus)
    let synthFadeTimer = null; // syntikan häivytyksen interval-tunniste

    const MUSIC_VOLUME = 0.05; // kappaleen perusvoimakkuus (vastaa masterGain 0.05025)

    /* ── Valikkomusiikki (v10.07): soi VAIN alkuvalikossa (Choose your chaos
       level). Itsenäinen soitin – ei koske pelin syntikkaa eikä jukeboxia.
       Autoplay-lukon takia ensimmäinen ele käynnistää, jos soitto oli estetty. */
    const MENU_MUSIC_FILE = 'jukebox/alec_koff-heavy-doom-dark-metal-493397.mp3';
    let menuEl = null;            // <audio>-elementti (loop)
    let menuActive = false;       // onko alkuvalikko auki
    let menuMusicBlocked = false; // autoplay estetty – yritetään uudelleen eleessä

    function startMenuMusic() {
        init();
        try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {}
        if (!menuActive) return;
        try {
            if (!menuEl) {
                menuEl = new Audio(MENU_MUSIC_FILE);
                menuEl.loop = true;
                menuEl.preload = 'auto';
                menuEl.volume = MUSIC_VOLUME;
            }
            // Hiljennä pelin tausta, ettei soi valikkobiisin päällä
            if (loopId) { clearInterval(loopId); loopId = null; }
            if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
            if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
            if (synthFadeTimer) { clearInterval(synthFadeTimer); synthFadeTimer = null; }
            if (synthGain) synthGain.gain.value = 0;
            started = false;
            stopMusicLoop();
            stopJukebox();
            menuMusicBlocked = false;
            const p = menuEl.play();
            if (p && typeof p.catch === 'function') {
                p.catch(() => { menuMusicBlocked = true; });
            }
        } catch (e) {}
    }

    function stopMenuMusic() {
        if (menuEl) {
            try { menuEl.pause(); } catch (e) {}
            try { menuEl.currentTime = 0; } catch (e) {}
        }
    }

    function setMenuActive(on) {
        menuActive = !!on;
        if (on) startMenuMusic();
        else stopMenuMusic();
    }

    // ── Jukebox (kadun jukebox-huone): koko kappale alusta loppuun ──
    // Taustamusiikin sykli peruutetaan soiton ajaksi ja palaa itsestään.
    const JUKEBOX_VOLUME = MUSIC_VOLUME; // soittotaso (säädettävä nuppi – sama kuin taustamusiikki)
    const JUKEBOX_GAP = 2500;            // ms taukoa ennen kuin taustamusiikki palaa
    let jukeEl = null;                   // <audio> jukebox-kappaleelle (koko kappale)
    let jukePlaying = false;              // soiko jukebox-kappale parhaillaan
    let pendingJukeQueue = null;          // autoplay-esto: soitetaan seuraavassa eleessä
    /* Jono (v4.46): jukeboxista voi valita useamman kappaleen, jotka soitetaan
       yksi kerrallaan (1 → 3). Jono on url-lista, jukePos = monesko soi. */
    let jukeQueue = [];
    let jukePos = -1;

    const BPM_MIN = 110;
    const BPM_MAX = 142;
    let BPM = 138;
    let BEAT = 60 / BPM;
    let hungerTempo = 1.0;         // 🍔-vauhtikerroin (2/3 / 1.0 / 2.0), asetetaan street.js:stä
    let S16 = BEAT / 4;
    let S8 = BEAT / 2;
    let BAR = BEAT * 4;

    // 6 tahdin kiertävä sointukulku: E - E - G - A - B - A (→G lopussa)
    const CHORD_ROOTS = [
        { freq: 82.41,  name: 'E2' },
        { freq: 82.41,  name: 'E2' },
        { freq: 98.00,  name: 'G2' },
        { freq: 110.00, name: 'A2' },
        { freq: 123.47, name: 'B2' },
        { freq: 110.00, name: 'A2' },
    ];
    const LOOP_BARS = CHORD_ROOTS.length;
    let LOOP = BAR * LOOP_BARS;

    // Laulumelodia (E-molli, E3–B4)
    // Tahdit 1-2, 3, 4, 5, 6 – jokaisessa 8 nuottia
    const MELODY_NOTES = [
        164.81,185.00,196.00,220.00, 196.00,185.00,164.81,146.83,
        164.81,185.00,196.00,220.00, 246.94,220.00,196.00,185.00,
        164.81,185.00,196.00,220.00, 196.00,185.00,164.81,146.83,
        164.81,185.00,196.00,220.00, 246.94,220.00,196.00,185.00,
        164.81,164.81,196.00,220.00, 246.94,246.94,220.00,185.00,
    ];
    // Rytmioffsetit 16-osissa per tahti
    const MEL_OFF = [
        0,2,4,6, 8,10,12,14,
        0,2,4,6, 8,10,12,14,
        0,2,4,6, 8,10,12,14,
        0,2,4,6, 8,10,12,14,
        0,2,4,6, 8,10,12,14,
    ];

    /* ── AudioContext + alikanavat ──────────────────── */
    function init() {
        if (ctx) return;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.value = 0.05025;
            masterGain.connect(ctx.destination);

            synthGain = ctx.createGain();
            synthGain.gain.value = 1;
            synthGain.connect(masterGain);

            drumGain = ctx.createGain();
            drumGain.gain.value = 0.715;
            drumGain.connect(synthGain);

            bassGain = ctx.createGain();
            bassGain.gain.value = 0.65;
            bassGain.connect(synthGain);

            guitarGain = ctx.createGain();
            guitarGain.gain.value = 0.494;
            guitarGain.connect(synthGain);

            leadGain = ctx.createGain();
            leadGain.gain.value = 0.429;
            leadGain.connect(synthGain);

            loadMusic();
        } catch (e) {}
    }

    function ok() { init(); return ctx && masterGain; }

    /* ═══════════════════════════════════════════════════
       MP3-LOOPPI: aito äänite <audio>-elementillä
       Soi suoraan (ei Web Audio -reititystä), joten toimii
       sekä http:// että file://-protokollalla.
       ═══════════════════════════════════════════════════ */
    function loadMusic() {
        // Syntikkatausta (oletus): aitoa äänitettä ei ladata lainkaan, jolloin
        // playPhase() valitsee syntikan. Koko kappaleet ovat jukebox-huoneessa.
        if (MUSIC_SOURCE !== 'mp3') { musicReady = false; return; }
        if (musicEl || !ctx) return;
        try {
            musicEl = new Audio(MUSIC_FILE);
            musicEl.loop = false;
            musicEl.preload = 'auto';
            musicEl.volume = MUSIC_VOLUME; // vastaa aiempaa masterGain-tasoa (0.05025)
            // Merkitse valmiiksi vasta kun selain oikeasti pystyy soittamaan tiedostoa
            musicEl.addEventListener('canplay', () => {
                musicReady = true;
                // Jos syntikka soi tällä hetkellä ja MP3 juuri valmistui, vaihda siihen
                if (phase === 'playing' && started && loopId) {
                    if (loopId) { clearInterval(loopId); loopId = null; }
                    startMusicLoop();
                    armPlayTimer(true); // syntikan 30s ajastin → kappaleen alun mittaiseksi
                }
            });
            musicEl.addEventListener('canplaythrough', () => { musicReady = true; });
            musicEl.addEventListener('error', () => { musicReady = false; });
            // Kappale päättyy → turvaverkko: vain jos tiedosto on lyhyempi kuin SONG_PLAY_LIMIT
            musicEl.addEventListener('ended', () => {
                musicPlayed++;
                if (phase === 'playing' && musicPlayed === 1) silencePhase();
            });
            musicEl.load();
        } catch (e) {
            musicReady = false; // ei musiikkia – pysy proseduraalisessa
        }
    }

    function startMusicLoop() {
        if (!musicEl || !musicReady) return;
        if (!musicEl.paused) return;
        musicPlayed = 0;
        started = true;
        // Pysäytä syntikka heti, ettei se soi MP3:n päällä
        if (loopId) { clearInterval(loopId); loopId = null; }
        if (synthFadeTimer) { clearInterval(synthFadeTimer); synthFadeTimer = null; }
        if (synthGain) synthGain.gain.value = 0;
        try { musicEl.currentTime = 0; } catch (e) {}
        try { musicEl.volume = MUSIC_VOLUME; } catch (e) {} // varmistus keskeytyneen häivytyksen varalle
        const p = musicEl.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {
                // Autoplay estetty → älä poista MP3:a pysyvästi.
                // Merkitse estetyksi, siirry syntikkaan ja yritä uudelleen seuraavassa eleessä.
                musicBlocked = true;
                if (phase === 'playing' && !loopId) {
                    startSynth();
                    armPlayTimer(false); // syntikka soi 30s, ei koko kappaleen mittaa
                }
            });
        }
    }

    function stopMusicLoop() {
        if (musicEl) {
            try { musicEl.pause(); } catch (e) {}
            try { musicEl.currentTime = 0; } catch (e) {}
            try { musicEl.volume = MUSIC_VOLUME; } catch (e) {} // palauta perustaso seuraavaa soittoa varten
        }
    }

    /* ═══════════════════════════════════════════════════
       JUKEBOX: koko kappale alusta loppuun (ostetaan kadulla)
       – peruuttaa taustamusiikin syklin soiton ajaksi
       – palaa automaattisesti taustamusiikkiin (JUKEBOX_GAP)
       – peliäänet (SFX) eivät liity tähän mitenkään
       ═══════════════════════════════════════════════════ */

    /* Peruuttaa käynnissä olevan syklin: ajastimet, MP3 ja syntikka hiljaa.
       HUOM: phase asetetaan kutsujan toimesta (jukebox ei ole 'playing'). */
    function cancelCycle() {
        if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
        if (loopId) { clearInterval(loopId); loopId = null; }
        if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
        if (synthFadeTimer) { clearInterval(synthFadeTimer); synthFadeTimer = null; }
        started = false;
        stopMusicLoop();                            // MP3 tauolle + currentTime = 0 + volume takaisin
        if (synthGain) synthGain.gain.value = 0;    // syntikka ei soi päällekkäin
    }

    /* Kappale päättyi → jonossa seuraava heti perään (ei taukoa), tai
       taustamusiikki palaa hetken kuluttua kun viimeinen on soinut loppuun. */
    function onJukeboxEnded() {
        if (jukePos + 1 < jukeQueue.length) {
            jukePos++;
            startJukeTrack();
            return;
        }
        jukePlaying = false;
        jukeQueue = [];
        jukePos = -1;
        if (phase !== 'jukebox') return;
        phase = 'silent';
        if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
        cycleTimer = setTimeout(playPhase, JUKEBOX_GAP);
    }

    /* Palauttaa taustamusiikkiin myös virhetilanteessa (tiedosto ei aukea / autoplay esto). */
    function resumeAfterJukebox() {
        if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
        if (phase === 'jukebox') phase = 'silent';
        if (!cycleTimer) cycleTimer = setTimeout(playPhase, JUKEBOX_GAP);
    }

    /* Soittaa jonon nykyisen kappaleen (jukePos). Palauttaa false jos ääntä
       ei saada lainkaan (esim. <audio>-elementtiä ei voi luoda). */
    function startJukeTrack() {
        const url = jukeQueue[jukePos];
        if (!url || !jukeEl) return false;
        try { jukeEl.src = url; } catch (e) { return false; }
        jukePlaying = true;
        const p = jukeEl.play();
        if (p && typeof p.catch === 'function') {
            p.catch(() => {
                // Autoplay estetty → soitetaan seuraavassa eleessä (osto on jo tehty)
                jukePlaying = false;
                pendingJukeQueue = jukeQueue.slice();
                resumeAfterJukebox();
            });
        }
        return true;
    }

    /* Liittää uudet kappaleet nykyisen jonon perään (v4.99): soivan kappaleen
       jälkeen. Palauttaa false jos ääntä ei saada lainkaan. */
    function appendJukeboxQueue(urls) {
        if (!urls || !urls.length) return false;
        init();
        if (!ctx) return false;
        try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
        if (!jukeEl) {
            // Ei ole jukebox-oliota → käynnistä uusi soitto
            return playJukeboxQueue(urls, 0);
        }
        cancelCycle();
        phase = 'jukebox';
        /* Lisätään nykyisen position jälkeen: kaikki ennen sitä on jo soitettu.
           Jos jukePos on -1 (ei soimassa), lisätään jonon loppuun. */
        const before = (jukePos >= 0) ? jukeQueue.slice(0, jukePos + 1) : [];
        const after = (jukePos >= 0) ? jukeQueue.slice(jukePos + 1) : jukeQueue;
        jukeQueue = before.concat(urls).concat(after);
        pendingJukeQueue = null;
        // Jos ei soimassa, käynnistä soitto
        if (!jukePlaying || jukePos < 0) {
            jukePos = jukeQueue.length - urls.length - 1;
            if (jukePos < 0) jukePos = 0;
            jukePlaying = true;
            if (!startJukeTrack()) {
                jukePlaying = false;
                jukeQueue = [];
                jukePos = -1;
                return false;
            }
        }
        return true;
    }

    /* Soittaa koko jonon alusta loppuun (v4.46): valitut kappaleet yksi
       kerrallaan (1 → 3). Palauttaa false jos ääntä ei saada lainkaan
       (kadun puoli voi silloin palauttaa kolikot). */
    function playJukeboxQueue(urls, startPos = 0) {
        if (!urls || !urls.length) return false;
        init();
        if (!ctx) return false;
        try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
        cancelCycle();
        phase = 'jukebox';   // ei 'playing' → canplay/onGesture eivät käynnistä taustamusiikkia
        if (!jukeEl) {
            try {
                jukeEl = new Audio();
            } catch (e) {
                return false;
            }
            jukeEl.loop = false;
            jukeEl.preload = 'auto';
            jukeEl.addEventListener('ended', onJukeboxEnded);
            jukeEl.addEventListener('error', () => {
                // Kappale ei aukea → älä jää jumiin, taustamusiikki takaisin
                jukePlaying = false;
                pendingJukeQueue = null;
                jukeQueue = [];
                jukePos = -1;
                jukeEl = null;
                resumeAfterJukebox();
            });
        }
        try { jukeEl.volume = JUKEBOX_VOLUME; } catch (e) {}
        jukeQueue = urls.slice();
        jukePos = Math.max(0, Math.min(startPos, urls.length - 1));
        pendingJukeQueue = null;
        jukePlaying = true;
        if (!startJukeTrack()) {
            jukePlaying = false;
            jukeQueue = [];
            jukePos = -1;
            return false;
        }
        return true;
    }

    /* Yhden kappaleen soitto – ohut kääre jonolle (sama rajapinta kuin ennen). */
    function playJukebox(url) { return playJukeboxQueue([url]); }

    /* Pysäyttää jukeboxin ja tyhjentää jonon (kuolema, sivun sulku). */
    function stopJukebox() {
        jukePlaying = false;
        pendingJukeQueue = null;
        jukeQueue = [];
        jukePos = -1;
        if (jukeEl) {
            try { jukeEl.pause(); } catch (e) {}
            try { jukeEl.currentTime = 0; } catch (e) {}
        }
    }

    function isJukeboxPlaying() { return jukePlaying; }
    /* Monesko jonon kappale soi (0 = ensimmäinen, -1 = ei jonoa). Kadun
       jukebox-huone näyttää tämän avulla, mikä kappale soi parhaillaan. */
    function getJukeboxQueuePos() { return jukePos; }

    /* ═══════════════════════════════════════════════════
       RUMMUT: Kick, Snare, Hi-hat
       ═══════════════════════════════════════════════════ */

    function kick(time) {
        if (!ok()) return;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(130, time);
        o.frequency.exponentialRampToValueAtTime(28, time + 0.09);
        const g = ctx.createGain();
        g.gain.setValueAtTime(1.0, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
        // Click
        const c = ctx.createOscillator();
        c.type = 'triangle';
        c.frequency.setValueAtTime(900, time);
        c.frequency.exponentialRampToValueAtTime(60, time + 0.007);
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.35, time);
        cg.gain.exponentialRampToValueAtTime(0.001, time + 0.01);
        o.connect(g).connect(drumGain);
        c.connect(cg).connect(drumGain);
        o.start(time); o.stop(time + 0.16);
        c.start(time); c.stop(time + 0.015);
    }

    function snare(time) {
        if (!ok()) return;
        const len = ctx.sampleRate * 0.14;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.exp(-i/(ctx.sampleRate*0.055));
        const n = ctx.createBufferSource(); n.buffer = buf;
        const t = ctx.createOscillator();
        t.type = 'triangle';
        t.frequency.setValueAtTime(185, time);
        t.frequency.exponentialRampToValueAtTime(75, time + 0.07);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.7, time);
        ng.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
        const tg = ctx.createGain();
        tg.gain.setValueAtTime(0.45, time);
        tg.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 900;
        n.connect(hp).connect(ng).connect(drumGain);
        t.connect(tg).connect(drumGain);
        n.start(time); n.stop(time + 0.16);
        t.start(time); t.stop(time + 0.11);
    }

    function hihat(time, loud) {
        if (!ok()) return;
        const len = ctx.sampleRate * 0.04;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.exp(-i/(ctx.sampleRate*0.012));
        const n = ctx.createBufferSource(); n.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 6000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(loud ? 0.32 : 0.20, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
        n.connect(hp).connect(g).connect(drumGain);
        n.start(time); n.stop(time + 0.05);
    }

    function scheduleDrums(startTime, nBars) {
        if (!ok()) return;
        for (let bar = 0; bar < nBars; bar++) {
            const bs = startTime + bar * BAR;
            for (let p = 0; p < 16; p++) {
                const t = bs + p * S16;
                if (p === 0 || p === 8) kick(t);
                if (p === 4 || p === 12) snare(t);
                if (p % 2 === 0) hihat(t, p === 0 || p === 8);
            }
            if (bar === nBars - 1) {
                const fs = bs + 14 * S16;
                snare(fs); snare(fs + S16*0.5);
                kick(fs + S16); snare(fs + S16*1.5);
            }
        }
    }

    /* ═══════════════════════════════════════════════════
       BASSO: Säröytynyt saha + subi
       ═══════════════════════════════════════════════════ */

    function bassNote(freq, time, dur) {
        if (!ok()) return;
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = freq;
        const sub = ctx.createOscillator();
        sub.type = 'sine'; sub.frequency.value = freq * 0.5;
        const grit = ctx.createOscillator();
        grit.type = 'sawtooth'; grit.frequency.value = freq * 1.006;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 290; lp.Q.value = 1.1;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(1.0, time + 0.005);
        g.gain.setValueAtTime(1.0, time + dur * 0.55);
        g.gain.exponentialRampToValueAtTime(0.001, time + dur);
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0, time);
        sg.gain.linearRampToValueAtTime(0.5, time + 0.005);
        sg.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.65);
        const grg = ctx.createGain();
        grg.gain.setValueAtTime(0, time);
        grg.gain.linearRampToValueAtTime(0.28, time + 0.004);
        grg.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.45);
        o.connect(lp).connect(g).connect(bassGain);
        sub.connect(sg).connect(bassGain);
        grit.connect(lp).connect(grg).connect(bassGain);
        o.start(time); o.stop(time + dur + 0.03);
        sub.start(time); sub.stop(time + dur + 0.03);
        grit.start(time); grit.stop(time + dur + 0.03);
    }

    function scheduleBass(startTime, nBars) {
        if (!ok()) return;
        for (let bar = 0; bar < nBars; bar++) {
            const f = CHORD_ROOTS[bar].freq;
            const bs = startTime + bar * BAR;
            for (let beat = 0; beat < 4; beat++) {
                const t = bs + beat * BEAT;
                bassNote(f, t, S16 * 0.75);
                bassNote(f, t + S16, S16 * 0.75);
            }
        }
        const lb = startTime + (nBars - 1) * BAR;
        bassNote(123.47, lb + 3.5 * BEAT, BEAT * 0.52);
    }

    /* ═══════════════════════════════════════════════════
       KITARA: Triple-track säröpowerchordit
       ═══════════════════════════════════════════════════ */

    function gtrChord(rootFreq, time, dur) {
        if (!ok()) return;
        const gf = rootFreq * 2;
        const fifth = gf * 1.5;
        [1.0, 1.003, 0.997].forEach(dt => {
            const r = ctx.createOscillator();
            r.type = 'sawtooth'; r.frequency.value = gf * dt;
            const f = ctx.createOscillator();
            f.type = 'sawtooth'; f.frequency.value = fifth * dt;
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.6;
            const pk = ctx.createBiquadFilter();
            pk.type = 'peaking'; pk.frequency.value = 950;
            pk.Q.value = 1.3; pk.gain.value = 4.5;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, time);
            g.gain.linearRampToValueAtTime(1.0, time + 0.004);
            g.gain.setValueAtTime(1.0, time + dur * 0.5);
            g.gain.exponentialRampToValueAtTime(0.001, time + dur);
            r.connect(lp); f.connect(lp);
            lp.connect(pk).connect(g).connect(guitarGain);
            r.start(time); r.stop(time + dur + 0.02);
            f.start(time); f.stop(time + dur + 0.02);
        });
    }

    function scheduleGuitar(startTime, nBars) {
        if (!ok()) return;
        for (let bar = 0; bar < nBars; bar++) {
            const f = CHORD_ROOTS[bar].freq;
            const bs = startTime + bar * BAR;
            for (let beat = 0; beat < 4; beat++) {
                const t = bs + beat * BEAT;
                gtrChord(f, t, S16 * 0.70);
                gtrChord(f, t + S16, S16 * 0.70);
            }
        }
    }
/* ═══════════════════════════════════════════════════
       MELODIA: laulumelodia
       ═══════════════════════════════════════════════════ */

    function leadNote(freq, time, dur) {
        if (!ok()) return;
        const o1 = ctx.createOscillator();
        o1.type = 'sine'; o1.frequency.value = freq;
        const o2 = ctx.createOscillator();
        o2.type = 'triangle'; o2.frequency.value = freq * 2;
        const o3 = ctx.createOscillator();
        o3.type = 'sawtooth'; o3.frequency.value = freq;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 2000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(1.0, time + 0.018);
        g.gain.setValueAtTime(0.82, time + dur * 0.35);
        g.gain.exponentialRampToValueAtTime(0.001, time + dur);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0, time);
        g2.gain.linearRampToValueAtTime(0.22, time + 0.012);
        g2.gain.exponentialRampToValueAtTime(0.001, time + dur);
        const g3 = ctx.createGain();
        g3.gain.setValueAtTime(0, time);
        g3.gain.linearRampToValueAtTime(0.16, time + 0.004);
        g3.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.55);
        o1.connect(lp).connect(g).connect(leadGain);
        o2.connect(lp).connect(g2).connect(leadGain);
        o3.connect(lp).connect(g3).connect(leadGain);
        o1.start(time); o1.stop(time + dur + 0.02);
        o2.start(time); o2.stop(time + dur + 0.02);
        o3.start(time); o3.stop(time + dur + 0.02);
    }

    function scheduleMelody(startTime, nBars, reverse) {
        if (!ok()) return;
        const perBar = Math.floor(MELODY_NOTES.length / nBars);
        for (let bar = 0; bar < nBars; bar++) {
            const bs = startTime + bar * BAR;
            for (let i = 0; i < perBar; i++) {
                const revI = reverse ? (perBar - 1 - i) : i;
                const idx = bar * perBar + revI;
                if (idx >= MELODY_NOTES.length) continue;
                const offIdx = bar * perBar + i;
                const t = bs + (MEL_OFF[offIdx] || i * 2) * S16;
                leadNote(MELODY_NOTES[idx], t, S16 * 1.7);
            }
        }
    }

    /* ═══════════════════════════════════════════════════
       PÄÄLOOPPI
       ═══════════════════════════════════════════════════ */

    function scheduleAll(startTime) {
        if (!ok()) return;
        scheduleDrums(startTime, LOOP_BARS);
        scheduleBass(startTime, LOOP_BARS);
        scheduleGuitar(startTime, LOOP_BARS);
        scheduleMelody(startTime, LOOP_BARS, melodyReverse);
    }

    function tryStart() {
        init();
        if (!ctx || started) return;
        if (ctx.state === 'suspended') return;
        started = true;
        scheduleAll(ctx.currentTime + 0.05);
        loopId = setInterval(() => {
            scheduleAll(ctx.currentTime + 0.05);
        }, LOOP * 1000);
    }

    // ── Syklin ajastimet: kappaleen alku, sitten 30–90s tauko ──
    let cycleTimer = null;       // setTimeout-tunniste
    let phase = 'silent';        // 'playing' | 'silent'
    const SONG_PLAY_LIMIT = 30000;     // kappaleesta soitetaan vain alku (ms)
    const SONG_FADE_OUT = 600;         // häivytyksen kesto lopussa (ms, 0 = kova katkaisu)
    const SYNTH_PLAY_DURATION = 30000; // syntikka-fallbackin soittoaika (ms)
    const SYNTH_FADE_IN = 800;         // syntikan sisäänhäivytys gracen jälkeen (ms, v10.09)
    let musicGraceMs = 0;              // kertaluontoinen hiljaisuus ennen ensimmäistä syntikkaa (ms; 0 = ei)
    let fadeInNextSynth = false;       // gracen jälkeinen syntikka häivyttyy sisään

    function getSilenceDuration() {
        return 30000 + Math.random() * 60000; // 30–90s taukoa
    }

    /* Kappaleen soittoaika: vain alku (SONG_PLAY_LIMIT), mutta ei koskaan
       tiedoston kestoa pidemmälle – jos biisi joskus vaihtuu lyhyemmäksi. */
    function songPlayLength() {
        if (musicEl && musicEl.duration && isFinite(musicEl.duration))
            return Math.min(SONG_PLAY_LIMIT, Math.round(musicEl.duration * 1000) + 1000);
        return SONG_PLAY_LIMIT;
    }

    /* Häivytys lopussa: volume MUSIC_VOLUME → 0 (SONG_FADE_OUT ms), sitten tauko.
       Soitto katkeaa aina alusta lasketun ajan jälkeen – ei koko kappaleen mittaa. */
    function fadeOutSong() {
        if (!musicEl || SONG_FADE_OUT <= 0) { silencePhase(); return; }
        if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
        const STEPS = 12;
        const stepMs = Math.max(20, Math.round(SONG_FADE_OUT / STEPS));
        const stepVol = MUSIC_VOLUME / STEPS;
        let i = 0;
        fadeTimer = setInterval(() => {
            i++;
            try { musicEl.volume = Math.max(0, MUSIC_VOLUME - stepVol * i); } catch (e) {}
            if (i >= STEPS) {
                clearInterval(fadeTimer);
                fadeTimer = null;
                silencePhase();
            }
        }, stepMs);
    }

    /* Syntikan häivytys: synthGain 1 → 0 (SONG_FADE_OUT ms), sitten tauko.
       Sama rytmi kuin MP3:lla – soitto ei katkea kovalla leikkauksella. */
    function fadeOutSynth() {
        if (synthFadeTimer) { clearInterval(synthFadeTimer); synthFadeTimer = null; }
        if (!synthGain || SONG_FADE_OUT <= 0) { silencePhase(); return; }
        const STEPS = 12;
        const stepMs = Math.max(20, Math.round(SONG_FADE_OUT / STEPS));
        let i = 0;
        synthFadeTimer = setInterval(() => {
            i++;
            try { synthGain.gain.value = Math.max(0, 1 - (1 / STEPS) * i); } catch (e) {}
            if (i >= STEPS) {
                clearInterval(synthFadeTimer);
                synthFadeTimer = null;
                silencePhase();
            }
        }, stepMs);
    }

    /* Soittovaiheen ajastin: kappale (alku + häivytys) tai syntikka (30 s + häivytys). */
    function armPlayTimer(useSong) {
        if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
        if (!useSong) {
            cycleTimer = setTimeout(fadeOutSynth, Math.max(0, SYNTH_PLAY_DURATION - SONG_FADE_OUT));
            return;
        }
        cycleTimer = setTimeout(fadeOutSong, Math.max(0, songPlayLength() - SONG_FADE_OUT));
    }

    function silencePhase() {
        if (!ctx) return;
        if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
        phase = 'silent';
        if (loopId) { clearInterval(loopId); loopId = null; }
        if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
        if (synthFadeTimer) { clearInterval(synthFadeTimer); synthFadeTimer = null; }
        started = false;
        stopMusicLoop();
        const delay = getSilenceDuration();
        cycleTimer = setTimeout(playPhase, delay);
    }

    function startSynth(fadeInMs) {
        if (!ctx) return;
        started = true;
        if (synthFadeTimer) { clearInterval(synthFadeTimer); synthFadeTimer = null; }
        if (synthGain) {
            const now = ctx.currentTime;
            synthGain.gain.cancelScheduledValues(now);
            if (fadeInMs > 0) {
                synthGain.gain.setValueAtTime(0, now);
                synthGain.gain.linearRampToValueAtTime(1, now + fadeInMs / 1000);
            } else {
                synthGain.gain.setValueAtTime(1, now);
            }
        }
        melodyReverse = Math.random() < 0.5;
        // Tempo 🍔-vauhtiin (v4.93): hidas → minimi, normaali → keskiväli, nopea → maksimi
        if (hungerTempo <= 0.7) {
            BPM = BPM_MIN;
        } else if (hungerTempo >= 1.5) {
            BPM = BPM_MAX;
        } else {
            BPM = Math.round((BPM_MIN + BPM_MAX) / 2);   // 126 = keskiväli
        }
        BEAT = 60 / BPM; S16 = BEAT / 4; S8 = BEAT / 2; BAR = BEAT * 4;
        LOOP = BAR * LOOP_BARS;
        scheduleAll(ctx.currentTime + 0.05);
        if (loopId) { clearInterval(loopId); }
        loopId = setInterval(() => {
            scheduleAll(ctx.currentTime + 0.05);
        }, LOOP * 1000);
    }

    function playPhase() {
        if (!ctx) return;
        if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
        phase = 'playing';
        // Grace-jakso (v10.09): menun jälkeen syntikka hiljaa, sitten häivyttyy sisään.
        if (musicGraceMs > 0) {
            const grace = musicGraceMs;
            musicGraceMs = 0;
            fadeInNextSynth = true;
            phase = 'silent';
            started = false;
            cycleTimer = setTimeout(playPhase, grace);
            return;
        }
        if (musicReady && !musicBlocked) {
            // Aito äänite: soitetaan kerran loppuun
            startMusicLoop();
            armPlayTimer(true);
        } else {
            // Syntikkatausta (oletus): proseduraalinen synteesi
            startSynth(fadeInNextSynth ? SYNTH_FADE_IN : 0);
            fadeInNextSynth = false;
            armPlayTimer(false);
        }
    }

    function onGesture() {
        init();
        if (ctx && ctx.state === 'suspended') ctx.resume();
        // Valikko auki → soi vain valikkobiisi, ei pelitaustaa
        if (menuActive) {
            if (menuMusicBlocked) startMenuMusic();
            return;
        }
        // Jukebox soi → ei taustamusiikkia päälle
        if (jukePlaying || phase === 'jukebox') return;
        // Autoplay-eston jälkeen soitetaan odottava jukebox-jono (osto on jo tehty)
        if (pendingJukeQueue && pendingJukeQueue.length) {
            const q = pendingJukeQueue;
            pendingJukeQueue = null;
            playJukeboxQueue(q);
            return;
        }
        // Käyttäjän ele avaa autoplay-lukon → kokeile MP3:a uudelleen jos se oli estetty
        if (musicReady && musicBlocked) {
            musicBlocked = false;
            if (phase === 'playing') {
                if (loopId) { clearInterval(loopId); loopId = null; }
                startMusicLoop();
                armPlayTimer(true);
            }
        }
        // Käynnistä vain jos mikään sykli ei ole käynnissä (ensimmäinen ele)
        if (!cycleTimer && phase === 'silent' && !started) playPhase();
    }

    document.addEventListener('touchstart', onGesture, { passive: true });
    document.addEventListener('mousedown', onGesture);
    document.addEventListener('keydown', onGesture);

    /* ── Kuolinääni: Gongi / syvä jyrähdys ──────────── */
    function playDeathGong() {
        if (!ok()) return;
        try {
            const now = ctx.currentTime;
            const dur = 4.0;
            const peak = 1.5;

            // Kerros 1: Syvä bassojyrinä (gongi)
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(55, now);
            osc.frequency.exponentialRampToValueAtTime(18, now + dur);
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.05, now);
            oscGain.gain.linearRampToValueAtTime(0.55, now + peak);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(oscGain).connect(masterGain);
            osc.start(now);
            osc.stop(now + dur);

            // Kerros 2: Kohinajyrinä (lowpass)
            const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1);
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const lpFilter = ctx.createBiquadFilter();
            lpFilter.type = 'lowpass';
            lpFilter.frequency.setValueAtTime(200, now);
            lpFilter.frequency.exponentialRampToValueAtTime(30, now + dur);
            const lpGain = ctx.createGain();
            lpGain.gain.setValueAtTime(0.03, now);
            lpGain.gain.linearRampToValueAtTime(0.22, now + peak);
            lpGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            src.connect(lpFilter).connect(lpGain).connect(masterGain);
            src.start(now);
            src.stop(now + dur);

            // Kerros 3: Metallinen rengas (kaksi epävireistä sineä)
            [0.98, 1.02].forEach(detune => {
                const ring = ctx.createOscillator();
                ring.type = 'triangle';
                ring.frequency.setValueAtTime(140 * detune, now);
                ring.frequency.exponentialRampToValueAtTime(60 * detune, now + dur);
                const ringGain = ctx.createGain();
                ringGain.gain.setValueAtTime(0.06, now);
                ringGain.gain.linearRampToValueAtTime(0.18, now + 0.8);
                ringGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
                ring.connect(ringGain).connect(masterGain);
                ring.start(now);
                ring.stop(now + dur);
            });
        } catch(e) {}
    }

    /* ── Julkinen API ────────────────────────────────── */
    function start(delayMs) {
        init();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        // Jukebox soi → ei käynnistetä taustamusiikkia sen päälle
        if (jukePlaying || phase === 'jukebox') return;
        // Grace-jakso (v10.09): valikosta aloitettaessa syntikka hiljaa ensin
        if (delayMs) musicGraceMs = delayMs;
        // Käynnistä vain jos mikään sykli ei ole käynnissä
        if (!cycleTimer && !started) playPhase();
    }

    function stop() {
        if (loopId) { clearInterval(loopId); loopId = null; }
        if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
        if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
        if (synthFadeTimer) { clearInterval(synthFadeTimer); synthFadeTimer = null; }
        started = false;
        phase = 'silent';
        stopJukebox();             // myös jukebox-kappale hiljenee (kuolema keskeyttää kaiken)
        stopMusicLoop();
        stopMenuMusic();                            // valikkobiisi hiljenee (kuolema)
        if (synthGain) synthGain.gain.value = 0;   // syntikkatausta hiljenee heti (kuolema)
    }

    function getCtx() { init(); return ctx; }
    function getDestination() { init(); return ctx ? ctx.destination : null; }
    function setHungerTempo(mult) { hungerTempo = mult; }

    return { init, start, stop, playDeathGong, getCtx, getDestination,
             playJukebox, playJukeboxQueue, appendJukeboxQueue, stopJukebox,
             isJukeboxPlaying, getJukeboxQueuePos, setHungerTempo, setMenuActive };
})();