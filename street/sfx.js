/* ═══════════════════════════════════════════════════════════
   street/sfx.js – kadun äänet (Web Audio, ei tiedostoja)
   (Vaihe 5, siirretty street.js:stä, PELKKÄ SIIRTO.)

   Sisältö: initAudio + ääniapuri sfxTone + kaikki kadun SFX:it
   (potku, askel, kolikko, tömähdys, sähköisku, laser, meteoriitti,
   rakennuksen romahdus, tyhjä laukaus, katuvalo) sekä ajoneuvon
   moottoriääni (start/update/stop).

   Moduuli OMISTAA:
       audioCtx               – jaettu Web Audio -konteksti (StreetAudio)
       sfxVolumeMult          – SFX-taso (kaaos K6) → StreetSfx.setVolume()

   Ulkopuolelta sidotaan (bind):
       WORLD_W                – moottoriäänen stereopanorointi

   Ladataan ENNEN street.js:iä (index.html). Testipenkit liittävät samat
   osat samassa järjestyksessä: tools/tests/street-src.cjs.
   ═══════════════════════════════════════════════════════════ */
var StreetSfx = (function () {
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
/* ── SFX-apuri (Vaihe 2) ─────────────────────────────
   Yksi oskillaattori + gain-envelope ja yhteinen initAudio-vahti.
   opts: { freq, freqTo?, dur, type?, vol?, delay? }
     freqTo = liuku (exponentialRamp), jos annettu
     vol    = huippuvoimakkuus (kerrotaan sfxVolumeMult)
     delay  = aloitusviive sekunteina (esim. toinen kerros)
   Palauttaa true, jos oskillaattori luotiin. Kohina-, moottori- ja
   suodatinäänet rakennetaan edelleen käsin (useita kerroksia /
   reaaliaikamodulaatio), mutta niiden oskillaattoriosat käyttävät tätä. */
function sfxTone(opts) {
    try {
        initAudio();
        if (!audioCtx || audioCtx.state !== 'running') return false;
        const t0 = audioCtx.currentTime + (opts.delay || 0);
        const dur = opts.dur || 0.1;
        const osc = audioCtx.createOscillator();
        osc.type = opts.type || 'sine';
        osc.frequency.setValueAtTime(opts.freq, t0);
        if (opts.freqTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqTo), t0 + dur);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime((opts.vol === undefined ? 0.18 : opts.vol) * sfxVolumeMult, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0); osc.stop(t0 + dur);
        return true;
    } catch (e) { return false; }
}

/* ── Kolikkoääni ──────────────────────────────── */
function playCoin() {
    // Vieno pling – kaksi sine-säveltä (1200 + 1800 Hz)
    [1200, 1800].forEach(freq => sfxTone({ freq: freq, dur: 0.08, vol: 0.18 }));
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

        sfxTone({ freq: 150, freqTo: 45, dur: 0.12, type: 'sine', vol: 0.30 });
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

        sfxTone({ freq: 120, freqTo: 30, dur: 0.15, type: 'square', vol: 0.12 });
    } catch(e) {}
}

/* ── Sädeaseen laserääni – "pew" kuin Star Wars ── */
function playLaser() {
    // Vingahdus: korkea → matala sweep (sahatonni) + kirkas neliökerros → "pew"
    sfxTone({ freq: 1900, freqTo: 160, dur: 1.0, type: 'sawtooth', vol: 0.16 });
    sfxTone({ freq: 2800, freqTo: 320, dur: 0.8, type: 'square', vol: 0.09 });
}

/* ── Meteoriitin osumaääni: kivi halkeaa – matala kolahtava
   "klonk" + lyhyt murskautuvan kuoren kohina. Erottuu selvästi laserin
   pew-äänestä, jotta pelaaja tietää osuneensa (1. osuma ei vielä tuhoa). */
function playMeteorHit() {
    try {
        initAudio();
        if (!audioCtx || audioCtx.state !== 'running') return;
        const now = audioCtx.currentTime;
        // Kolahtava runko: kivi resonoi matalalla
        sfxTone({ freq: 220, freqTo: 70, dur: 0.18, type: 'triangle', vol: 0.13 });
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

/* ── Talon romahdusääni (ilman soivaa jyrinää): pelkkä
   murskautuva massa. Kuuluu meteoriitin osuessa katuvarren taloon
   (tuhoutumisen alkaessa). Ei uutta tekstiä (sääntö 06) – tuho kerrotaan
   äänellä ja kuvalla. */
function playBuildingCollapse() {
    try {
        initAudio();
        if (!audioCtx || audioCtx.state !== 'running') return;
        const now = audioCtx.currentTime;
        /* soiva matala jyrinä (triangle 90 → 34 Hz) POISTETTU – se kuulosti
           kongin/patarummun kumahdukselta juuri osumahetkellä. Jäljellä on vain
           murskautuva massa: matala suodatettu kohina, hiukan pidempi ja vahvempi,
           jotta isku ei tunnu tyhjältä. */
        const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 1.5), audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.55));
        }
        const src = audioCtx.createBufferSource(); src.buffer = buf;
        const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(620, now);
        lp.frequency.exponentialRampToValueAtTime(110, now + 1.5);
        const ng = audioCtx.createGain();
        ng.gain.setValueAtTime(0.21 * sfxVolumeMult, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        src.connect(lp).connect(ng).connect(audioCtx.destination);
        src.start(now); src.stop(now + 1.5);
    } catch(e) {}
}

/* ── Ukkonen (BAD-myrsky): matala, pitkä jyrinä – EI korkeaa pimputusta.
   VIISI päällekkäistä jyrinää samalla aikajanalla (kuten oikea ukkonen:
   bruum-bruum-bruum-bruum-bruum) → tiivis, kerroksellinen kasauma (yht. ~3,1 s).
   Jokainen kerros saa oman kohinansa (ei vaiheluontia) ja PEHMEÄN alun,
   jotta se jyrisee eikä tömsähdä. Kaikki bassoa (lowpass 700 → 80 Hz +
   sävelet 62→26 · 44→22 Hz). Voimakkuudet laskevat kerroksittain, ettei summa paisu. */
function playThunder() {
    try {
        initAudio();
        if (!audioCtx || audioCtx.state !== 'running') return;
        const now = audioCtx.currentTime;
        const layers = [
            { delay: 0.00, vol: 1.00, dur: 1.9 },
            { delay: 0.20, vol: 0.85, dur: 2.0 },
            { delay: 0.40, vol: 0.72, dur: 2.1 },
            { delay: 0.60, vol: 0.61, dur: 2.2 },
            { delay: 0.80, vol: 0.52, dur: 2.3 }
        ];
        for (const L of layers) {
            const t0 = now + L.delay;
            // Jyrinämassa: kohina, joka vaipuu hitaasti (L.durin mittainen häntä)
            const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * L.dur), audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * L.dur * 0.42));
            }
            const src = audioCtx.createBufferSource(); src.buffer = buf;
            const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass';
            lp.frequency.setValueAtTime(700, t0);
            lp.frequency.exponentialRampToValueAtTime(80, t0 + L.dur);
            const ng = audioCtx.createGain();
            ng.gain.setValueAtTime(0.0001, t0);
            ng.gain.linearRampToValueAtTime(0.18 * L.vol * sfxVolumeMult, t0 + 0.20);   // pehmeä alku → jyrinä (5 kerrosta → pienempi perusvoimakkuus)
            ng.gain.exponentialRampToValueAtTime(0.001, t0 + L.dur);
            src.connect(lp).connect(ng).connect(audioCtx.destination);
            src.start(t0); src.stop(t0 + L.dur);
            // Bassot per kerros (matala jyrinä, joka laskee)
            sfxTone({ freq: 62, freqTo: 26, dur: 1.6, type: 'sine',     vol: 0.24 * L.vol, delay: L.delay });
            sfxTone({ freq: 44, freqTo: 22, dur: 2.0, type: 'triangle', vol: 0.18 * L.vol, delay: L.delay + 0.12 });
        }
    } catch(e) {}
}

/* ── Tyhjä laukaus: kuiva klikki, kun ase on vielä lukossa.
   Kertoo, että klikkaus meni perille mutta laukaus ei lähde – ei uutta
   tekstiä (sääntö 06), vain ääni. */
function playBeamEmpty() {
    // Kuiva klikki: lyhyt neliö-sweep alas – lukko päällä, ei laukausta
    sfxTone({ freq: 340, freqTo: 150, dur: 0.06, type: 'square', vol: 0.045 });
}

/* ── Katuvalon syttyminen (yön lamppushow) ──
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
        sfxTone({ freq: 420, freqTo: 200, dur: 0.16, type: 'sine', vol: 0.10 });
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
}    /* ── Sidottavat ulkopuoliset (street.js asettaa nämä) ── */
    let WORLD_W = 800;
    function bind(globals) {
        if (globals && typeof globals.WORLD_W === 'number') WORLD_W = globals.WORLD_W;
    }
    /* SFX-taso (K6): asetetaan aina kun kaaosprofiili vaihtuu. */
    function setVolume(mult) { sfxVolumeMult = (typeof mult === 'number') ? mult : 1; }
    function getVolume() { return sfxVolumeMult; }

    return {
        bind: bind, setVolume: setVolume, getVolume: getVolume,
        initAudio: initAudio, sfxTone: sfxTone,
        playKick: playKick, playWalk: playWalk, playCoin: playCoin, playKnock: playKnock,
        playZap: playZap, playLaser: playLaser, playMeteorHit: playMeteorHit,
        playBuildingCollapse: playBuildingCollapse, playBeamEmpty: playBeamEmpty,
        playLampOn: playLampOn, playThunder: playThunder,
        startVehicleEngine: startVehicleEngine, updateVehicleEngine: updateVehicleEngine,
        stopVehicleEngine: stopVehicleEngine
    };
})();
