// audio.js - Prosedyraaliset ääniefektit (Web Audio API)
const AudioFX = (() => {
    let ctx = null;

    function init() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (ctx.state === 'suspended') ctx.resume();
    }

    // Herätä äänikonteksti ensimmäisestä käyttäjän toiminnosta
    // iOS Safari vaatii usein sekä touchstartin että touchendin varmuuden vuoksi
    document.addEventListener('touchstart', init, { once: true, passive: true });
    document.addEventListener('touchend', init, { once: true, passive: true });
    document.addEventListener('mousedown', init, { once: true });
    document.addEventListener('keydown', init, { once: true });

    // Kevyt rapina liikkuessa
    function playMove() {
        try {
            init();
            const now = ctx.currentTime;
            const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 2000;
            filter.Q.value = 0.5;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.30, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            src.connect(filter).connect(gain).connect(ctx.destination);
            src.start(now);
            src.stop(now + 0.08);
        } catch(e) {}
    }

    // Napsaus timantin keräämisessä
    function playDiamond() {
        try {
            init();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1400, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.40, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.1);
        } catch(e) {}
    }

    // Kevyt räjähdys kuolemassa
    function playExplosion() {
        try {
            init();
            const now = ctx.currentTime;
            const dur = 6.0;
            const peak = 2.5;

            // Kerros 1: Jyrisevä kohina — lähtee hiljaa, nousee ja vaimenee
            const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1);
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const lpFilter = ctx.createBiquadFilter();
            lpFilter.type = 'lowpass';
            lpFilter.frequency.setValueAtTime(300, now);
            lpFilter.frequency.exponentialRampToValueAtTime(40, now + dur);
            const lpGain = ctx.createGain();
            lpGain.gain.setValueAtTime(0.24, now);
            lpGain.gain.linearRampToValueAtTime(0.70, now + peak);
            lpGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            src.connect(lpFilter).connect(lpGain).connect(ctx.destination);
            src.start(now);
            src.stop(now + dur);

            // Kerros 2: Matala bassojyrinä — nousee ja vaimenee
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(60, now);
            osc.frequency.exponentialRampToValueAtTime(20, now + dur);
            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.30, now);
            oscGain.gain.linearRampToValueAtTime(0.70, now + peak);
            oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(oscGain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + dur);

            // Kerros 3: Terävä aloitusräsähdys
            const crackDur = 0.08;
            const crackBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * crackDur), ctx.sampleRate);
            const crackData = crackBuf.getChannelData(0);
            for (let i = 0; i < crackData.length; i++) {
                crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.006));
            }
            const crackSrc = ctx.createBufferSource();
            crackSrc.buffer = crackBuf;
            const hpFilter = ctx.createBiquadFilter();
            hpFilter.type = 'highpass';
            hpFilter.frequency.value = 1500;
            const crackGain = ctx.createGain();
            crackGain.gain.setValueAtTime(0.40, now);
            crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDur);
            crackSrc.connect(hpFilter).connect(crackGain).connect(ctx.destination);
            crackSrc.start(now);
            crackSrc.stop(now + crackDur);
        } catch(e) {}
    }

    // Lyhyt räjähdys vihollisen murskaamisessa
    function playCrush() {
        try {
            init();
            const now = ctx.currentTime;
            const dur = 0.3;
            const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 500;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.50, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            src.connect(filter).connect(gain).connect(ctx.destination);
            src.start(now);
            src.stop(now + dur);
        } catch(e) {}
    }

    return { playMove, playDiamond, playExplosion, playCrush };
})();