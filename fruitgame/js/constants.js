/* ═══════════════════════════════════════════════════════════
   constants.js – Hedelmäpeli: vakiot, symbolit ja maksutaulukko

   RTP (oletus-preset B, ks. SYMBOLS.pay):
     3× 💎 0.001    × 35 = 0.035
     3× 🍔 0.001    × 20 = 0.020
     3× 🔔 0.008    × 12 = 0.096
     3× 🍋 0.015625 ×  7 = 0.109
     3× 🍒 0.042875 ×  4 = 0.172
     pari  0.353    ×  1 = 0.353
     ────────────────────────────
     RTP ≈ 0.785  →  78,5 %   (3 samaa 6,85 %, pari 35,3 %, ei voittoa 57,9 %)

   Talon ilmainen pyöräytys (1 kpl / 120 s, FREE_SPIN_COOLDOWN_MS) nostaa
   pelaajan efektiivistä palautusta enintään +0,785 kolikkoa / 2 min
   (≈ +0,39 kolikkoa/min) – tuntuva turvaverkko, ei romahduta taloutta.
   ═══════════════════════════════════════════════════════════ */

/* ── Canvas (looginen koko, skaalataan CSS:llä) ──────── */
const CANVAS_W = 640;
const CANVAS_H = 400;

/* ── Panos ja talous ─────────────────────────────────── */
const BET = 1;              // panos / pyöräytys (kolikkoa)
const START_COINS = 20;     // standalone-testilompakko (kun ei olla iframessa)
const DEBUG_COINS = 100;    // ?debug → nopea testaus isolla kassalla

/* ── Ilmainen pyöräytys (talon tarjoama) ─────────────── */
// Sisään tullessa voi pyöräyttää kerran ilmaiseksi – voiton saa pitää.
// Jäädytys estää sisään/ulos-farmauksen: jos palaa alle 120 s kuluttua,
// jokainen pyöräytys maksaa taas 1 kolikon.
const FREE_SPIN_COOLDOWN_MS = 120000;
const FREE_SPIN_KEY = 'pimeakatu_fruit_free';   // pelin oma avain (kadun inventaario pysyy koskemattomana)

/* ── Symbolit: weight = yleisyys rullassa, pay = kolmikon kerroin ── */
const SYMBOLS = [
    { id: 'cherry',  name: 'Kirsikka',      weight: 7, pay: 4  },
    { id: 'lemon',   name: 'Sitruuna',      weight: 5, pay: 7  },
    { id: 'bell',    name: 'Kello',         weight: 4, pay: 12 },
    { id: 'burger',  name: 'Hampurilainen', weight: 2, pay: 20 },
    { id: 'diamond', name: 'Timantti',      weight: 2, pay: 35 }
];
const PAY_PAIR = 1;         // kaksi samaa vierekkäin → panos takaisin
const REEL_COUNT = 3;

/* ── Rullanauha (painotettu; järjestys sekoitetaan kerran) ── */
const REEL_STRIP = (() => {
    const strip = [];
    for (const s of SYMBOLS) {
        for (let i = 0; i < s.weight; i++) strip.push(s.id);
    }
    for (let i = strip.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [strip[i], strip[j]] = [strip[j], strip[i]];
    }
    return strip;
})();
const STRIP_LEN = REEL_STRIP.length;

// Mihin nauhan positioihin kukin symboli voi pysähtyä
const SYMBOL_SLOTS = (() => {
    const map = {};
    for (const s of SYMBOLS) map[s.id] = [];
    REEL_STRIP.forEach((id, i) => map[id].push(i));
    return map;
})();

/* ── Apufunktiot ─────────────────────────────────────── */

function symbolById(id) {
    for (const s of SYMBOLS) if (s.id === id) return s;
    return SYMBOLS[0];
}

/** Arpoo symbolin painotetusti (perus-RNG). */
function pickSymbolId() {
    let total = 0;
    for (const s of SYMBOLS) total += s.weight;
    let r = Math.random() * total;
    for (const s of SYMBOLS) { r -= s.weight; if (r < 0) return s.id; }
    return SYMBOLS[SYMBOLS.length - 1].id;
}

/** Arpoo satunnaisen pysäytysposition nauhalta annetulle symbolille. */
function pickSlot(id) {
    const slots = SYMBOL_SLOTS[id];
    return slots[Math.floor(Math.random() * slots.length)];
}

/** Voitto kolmelle pysäytysymbolille (kolmikko tai pari). */
function payoutFor(ids) {
    if (ids[0] === ids[1] && ids[1] === ids[2]) return symbolById(ids[0]).pay;
    if (ids[0] === ids[1] || ids[1] === ids[2]) return PAY_PAIR;
    return 0;
}

/** Matka (symboleina) positiosta seuraavaan positioon, joka on idx (mod nauha). */
function distToTarget(pos, idx) {
    const L = STRIP_LEN;
    let z = Math.ceil(pos);
    const m = ((idx - (z % L)) % L + L) % L;
    z += m;
    if (z <= pos + 1) z += L;
    return z - pos;
}

/* ── Animaatio ──────────────────────────────────────── */
const SPIN_SPEED  = 15;                   // symbolia / sekunti (vapaa pyörintä)
const STOP_DELAYS = [0.35, 0.75, 1.15];   // milloin rulla alkaa hakeutua pysähdykseen (s)
const DECEL_DIST  = 4;                    // hidastuksen pituus (symbolia)
const MIN_DECEL   = 0.22;                 // hidastuksen minimikesto (s)

/* ── Rullaikkuna (canvas) ───────────────────────────── */
const WIN_W = 112;
const WIN_H = 150;
const CELL_H = 50;
const WIN_GAP = 22;
const WIN_TOP = 74;
const PAYLINE_Y = WIN_TOP + WIN_H / 2;   // 149
const WIN_X0 = (CANVAS_W - (REEL_COUNT * WIN_W + (REEL_COUNT - 1) * WIN_GAP)) / 2;   // 130

function reelX(i) { return WIN_X0 + i * (WIN_W + WIN_GAP); }

/* ── Koneen runko ja vipu ───────────────────────────── */
const CAB   = { x: 30, y: 26, w: 566, h: 348 };        // 30..596 × 26..374
const LEVER = { x: 618, baseY: 226, topY: 106, r: 11 };

/* ── Värit ─────────────────────────────────────────── */
const COL = {
    bg: '#0a0812',
    floor: '#140f22',
    cab: '#241d33',
    cabDark: '#1a1526',
    cabHi: '#3a3050',
    cabEdge: '#6a58a8',
    plate: '#0f0c18',
    reelBg: '#f2ecd8',
    reelShade: '#c9bf9f',
    reelEdge: '#8d8768',
    gold: '#ffd700',
    goldDim: '#8a7326',
    text: '#e8e0ff',
    dim: '#8a80a8',
    good: '#7dff9b',
    bad: '#ff6b6b',
    bulbA: '#ffd76a',
    bulbB: '#ff7ad0',
    bulbOff: '#3a3050',
    lever: '#c62828',
    leverDark: '#7f1d1d'
};
