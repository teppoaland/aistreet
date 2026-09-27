/* ═══════════════════════════════════════════════════════════
   audio.js – Laivanupotus – proseduraaliset äänet
   Web Audio API: laukaus, räiskähdys, osuma, upotus, äänet
   ═══════════════════════════════════════════════════════════ */
const SoundFX = (() => {
    let ctx = null;

    function init() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (ctx.state === 'suspended') ctx.resume();
    }

    document.addEventListener('touchstart', init, { once: true, passive: true });
    document.addEventListener('touchend', init, { once: true, passive: true });
    document.addEventListener('mousedown', init, { once: true });
    document.addEventListener('keydown', init, { once: true });

    /* ── Yksittäinen sävel oskillaattorilla ───────────── */
    function tone(freq, dur, vol, type, slideTo) {
        try {
            init();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            osc.type = type || 'square';
            osc.frequency.setValueAtTime(freq, now);
            if (slideTo !== undefined) osc.frequency.linearRampToValueAtTime(slideTo, now + dur);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(vol, now + 0.01);
            g.gain.setValueAtTime(vol, now + dur - 0.03);
            g.gain.linearRampToValueAtTime(0, now + dur);
            osc.connect(g).connect(ctx.destination);
            osc.start(now); osc.stop(now + dur + 0.05);
        } catch (e) {}
    }

    /* ── Kohinapurske (laukaisu/osumapaukahdus) ──────── */
    function noise(dur, vol, filterType, filterFreq) {
        try {
            init();
            const now = ctx.currentTime;
            const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * dur * 0.35));
            }
            const src = ctx.createBufferSource(); src.buffer = buf;
            let node = src;
            if (filterType) {
                const f = ctx.createBiquadFilter();
                f.type = filterType; f.frequency.value = filterFreq;
                src.connect(f); node = f;
            }
            const g = ctx.createGain();
            g.gain.setValueAtTime(vol, now);
            node.connect(g).connect(ctx.destination);
            src.start(now); src.stop(now + dur);
        } catch (e) {}
    }

    /* ── Yksittäinen nuotti-melodia (voitto/häviö) ────── */
    function arpeggio(notes, step, vol) {
        try {
            init();
            const now = ctx.currentTime;
            let t = now;
            for (const f of notes) {
                tone(f, step * 0.9, vol, 'square', undefined);
                t += step;
            }
        } catch (e) {}
    }

    return {
        init,
        /* Laukaisu: terävä napaus */
        playShot()  { noise(0.07, 0.20, 'highpass', 1200); },
        /* Räiskähdys veteen: laskeva liuku + roiske */
        playSplash(){ tone(520, 0.28, 0.14, 'triangle', 110); noise(0.14, 0.11, 'bandpass', 900); },
        /* Osuma: matala tömähdys + paukahdus */
        playHit()   { noise(0.18, 0.22, 'lowpass', 900); tone(130, 0.22, 0.16, 'square', 60); },
        /* Upotus: pitkä matala mörinä */
        playSink()  { noise(0.6, 0.20, 'lowpass', 500); tone(110, 0.7, 0.20, 'sawtooth', 40); tone(55, 0.8, 0.16, 'sine', 30); },
        /* Asetus: naksu */
        playPlace() { tone(660, 0.06, 0.12, 'square'); },
        /* Käännä: piippaus */
        playRotate(){ tone(880, 0.06, 0.10, 'square', 1180); },
        /* Win: nouseva fanfaari */
        playWin()   { arpeggio([523, 659, 784, 1047], 0.18, 0.14); },
        /* Lose: laskeva surusävel */
        playLose()  { arpeggio([392, 311, 262, 196], 0.22, 0.14); },
    };
})();