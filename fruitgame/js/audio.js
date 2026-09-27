// audio.js – Hedelmäpeli: prosedyraaliset ääniefektit (Web Audio API)
const AudioFX = (() => {
    let ctx = null;

    function init() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (ctx.state === 'suspended') ctx.resume();
    }

    // Herätä äänikonteksti ensimmäisestä käyttäjän toiminnosta
    // (iOS Safari vaatii sekä touchstartin että touchendin varmuuden vuoksi)
    document.addEventListener('touchstart', init, { once: true, passive: true });
    document.addEventListener('touchend', init, { once: true, passive: true });
    document.addEventListener('mousedown', init, { once: true });
    document.addEventListener('keydown', init, { once: true });

    /** Yksittäinen sävel */
    function tone(freq, start, dur, type, vol) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(vol === undefined ? 0.16 : vol, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
    }

    /** Liukuva sävel (freq → freq2) */
    function sweep(f1, f2, start, dur, type, vol) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(f1, start);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), start + dur);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(vol === undefined ? 0.2 : vol, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
    }

    /** Rullan tikitys (symboli ohittaa voittolinjan) */
    function playTick() {
        try {
            init();
            const now = ctx.currentTime;
            tone(1750 + Math.random() * 220, now, 0.022, 'square', 0.05);
        } catch (e) {}
    }

    /** Rullan pysähdys (mekaaninen kolahtelu) */
    function playStop() {
        try {
            init();
            const now = ctx.currentTime;
            sweep(240, 90, now, 0.13, 'sine', 0.22);
            // Pieni kohinapurske "kolahteen"
            const dur = 0.05;
            const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 900;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            src.connect(filter).connect(gain).connect(ctx.destination);
            src.start(now);
            src.stop(now + dur);
        } catch (e) {}
    }

    /** Kolikon syöttö koneeseen */
    function playCoinIn() {
        try {
            init();
            const now = ctx.currentTime;
            tone(1046, now, 0.07, 'square', 0.12);
            tone(1568, now + 0.06, 0.09, 'square', 0.10);
        } catch (e) {}
    }

    /** Talon ilmainen pyöräytys (kirkas nousu, erottuu kolikon syötöstä) */
    function playFreeSpin() {
        try {
            init();
            const now = ctx.currentTime;
            const notes = [784, 988, 1175, 1568];
            for (let i = 0; i < notes.length; i++) {
                tone(notes[i], now + i * 0.05, 0.13, 'triangle', 0.10);
            }
            sweep(600, 1700, now, 0.3, 'sine', 0.05);
        } catch (e) {}
    }

    /** Voittoääni: 1 = pari, 2 = kolmikko, 3 = jättipotti (timantti) */
    function playWin(level) {
        try {
            init();
            const now = ctx.currentTime;
            if (level >= 3) {
                const notes = [523, 659, 784, 1046, 1318, 1568, 2093];
                for (let i = 0; i < notes.length; i++) {
                    tone(notes[i], now + i * 0.09, 0.22, 'square', 0.14);
                    tone(notes[i] * 2, now + i * 0.09, 0.14, 'triangle', 0.07);
                }
                sweep(300, 2400, now + 0.6, 0.5, 'sawtooth', 0.08);
            } else if (level === 2) {
                const notes = [659, 784, 1046, 1318];
                for (let i = 0; i < notes.length; i++) {
                    tone(notes[i], now + i * 0.085, 0.18, 'square', 0.13);
                }
            } else {
                tone(880, now, 0.10, 'square', 0.10);
                tone(1174, now + 0.08, 0.14, 'square', 0.09);
            }
        } catch (e) {}
    }

    /** Ei kolikoita – kone nyrpistää */
    function playNoCoin() {
        try {
            init();
            const now = ctx.currentTime;
            sweep(190, 120, now, 0.16, 'sawtooth', 0.13);
            sweep(150, 95, now + 0.14, 0.20, 'sawtooth', 0.12);
        } catch (e) {}
    }

    /** Häviö – lyhyt alaspäin valuva sävel */
    function playLose() {
        try {
            init();
            const now = ctx.currentTime;
            sweep(420, 200, now, 0.22, 'triangle', 0.09);
        } catch (e) {}
    }

    return { init, playTick, playStop, playCoinIn, playFreeSpin, playWin, playNoCoin, playLose };
})();
