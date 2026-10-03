/* ═══════════════════════════════════════════════════════════
   split-cards.cjs – Vaihe 5 osa 5: K7-kaaoskortit omaksi
   tiedostoksi (street/chaos-cards.js, StreetChaosCards).

   PELKKÄ SIIRTO: koodirivejä ei muuteta eikä uudelleenmuotoilla.
   Moduulin rajalla nimetään uudelleen vain ne nimet, jotka asuvat
   street.js:n sulkeumassa. Korttidefien save/restore MUTATOI
   ~12 tilamuuttujaa → hostissa on get+set -parit (sama olio kuin
   ennen, joten applyChaosProfile näkee muutokset).

   Ajo:
       node tools/refactor/split-cards.cjs
   Turvallisuus: jos yksikin varmistus (lohkon rajat / korvausten
   määrä) epäonnistuu, MITÄÄN ei kirjoiteta.
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');   // D:\AI\AI_street
const SRC = path.join(ROOT, 'street.js');
const OUT = path.join(ROOT, 'street', 'chaos-cards.js');

const raw = fs.readFileSync(SRC, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);   // lines[0] === rivi 1

/* Siirrettävä lohko (1-based, sisältäen) */
const START = 2341, END = 2474;
const block = lines.slice(START - 1, END).join('\n');

/* ── 1) Varmistukset ─────────────────────────────────────── */
const guards = [
    ['alku on K7-otsikko', block.startsWith('    /* ═══')],
    ['lohkossa lukee KAAOS K7 – tapahtumakortit (v10.05)', block.includes('KAAOS K7 – tapahtumakortit (v10.05)')],
    ['lohkossa on chaosCardsReset', block.includes('function chaosCardsReset()')],
    ['lohkossa on chaosCardDefs', block.includes('function chaosCardDefs()')],
    ['lohkossa on cardFlashWindows', block.includes('function cardFlashWindows(count)')],
    ['lohkossa on updateCards', block.includes('function updateCards(dt)')],
    ['loppu on sulkeva aaltosulku', block.trimEnd().endsWith('}')]
];
for (const [what, ok] of guards) if (!ok) { console.error('VARMISTUS EPÄONNISTUI: ' + what); process.exit(1); }

/* ── 2) Nimeäminen moduulin rajalla (yksi läpikäynti / sääntö) ── */
const RENAMES = [
    [/chaosFlags\.anyChaos/g, 'H.anyChaos'],
    [/chaosRng\(\)/g, 'H.rng()'],
    [/\bsunColor\b/g, 'H.state.sunColor'],
    [/\bsunGlow\b/g, 'H.state.sunGlow'],
    [/\bDAY_SKY_TOP\b/g, 'H.state.daySkyTop'],
    [/\bDAY_SKY_MID\b/g, 'H.state.daySkyMid'],
    [/\bDAY_SKY_HORIZON\b/g, 'H.state.daySkyHor'],
    [/\bfogAlpha\b/g, 'H.state.fogAlpha'],
    [/\bwindSpeed\b/g, 'H.state.windSpeed'],
    [/\bbuildingPalette\b/g, 'H.state.buildingPalette'],
    [/\banimalSpawnTimer\b/g, 'H.state.animalSpawnTimer'],
    [/stars\.length/g, 'H.state.stars.length'],
    [/stars\.push/g, 'H.state.stars.push'],
    [/\blitWindows\b/g, 'H.state.litWindows'],
    [/\bstarCount\b/g, 'H.state.starCount'],
    [/\bstarSizeMult\b/g, 'H.state.starSizeMult'],
    [/\bWORLD_W\b/g, 'H.consts.WORLD_W'],
    [/\bGROUND_Y\b/g, 'H.consts.GROUND_Y'],
    [/\brandomHuePalette\b/g, 'H.fx.randomHuePalette'],
    [/\brandomizeBuildingColors\b/g, 'H.fx.randomizeBuildingColors'],
    [/\bgetAvailableWindows\b/g, 'H.fx.getAvailableWindows'],
    [/\bpickColorType\b/g, 'H.fx.pickColorType']
];
let body = block;
for (const [re, to] of RENAMES) {
    const n = (body.match(re) || []).length;
    if (n === 0) { console.error('Nimeämistä ei löytynyt: ' + re); process.exit(1); }
    body = body.replace(re, to);
    console.log('  ' + String(n).padStart(2) + ' × ' + re.source + '  →  ' + to);
}

const HEADER = `/* ═══════════════════════════════════════════════════════════
   street/chaos-cards.js – K7-tapahtumakortit (vain visuaalisia)
   (Vaihe 5 osa 5, v11.38 – siirretty street.js:stä, PELKKÄ SIIRTO.)

   Sisältö: korttipakan tila (\`cardState\`) + ajastin (\`updateCards\`),
   reset (\`chaosCardsReset\`) ja 10 korttidefiä (\`chaosCardDefs\`:
   värihetki, tähtisade, sumu, tuulenpuuska, valot sammuvat, ikkunat,
   eläinparaati, paletti, taivas, tähdet) sekä \`cardFlashWindows\`.
   Kortit palautuvat itsestään (save → apply → restore).

   Moduuli OMISTAA: cardState (enabled/timer/left/active/meteorBurst/
   lightsOut/animalParade) · CARD_FIRST_DELAY · CARD_GAP_MIN/MAX.

   Ulkopuolelta sidotaan (bind) get+set -host, koska save/restore
   MUTATOI street.js:n tilaa:
       H.anyChaos · H.rng
       H.consts { WORLD_W, GROUND_Y }
       H.fx     { randomHuePalette, randomizeBuildingColors,
                  getAvailableWindows, pickColorType }
       H.state  { sunColor, sunGlow, daySkyTop/Mid/Hor, fogAlpha,
                  windSpeed, buildingPalette, animalSpawnTimer,
                  starCount, starSizeMult, stars, litWindows }

   Julkinen rajapinta street.js:lle: reset · update · meteorBurst ·
   lightsOut · animalParade · consumeAnimalParade.

   Ladataan ENNEN street.js:iä (index.html). Testipenkit liittävät samat
   osat samassa järjestyksessä: tools/tests/street-src.cjs.
   ═══════════════════════════════════════════════════════════ */
var StreetChaosCards = (function () {
    /* ── Sidottu host (street.js asettaa bind():llä) ── */
    let H = null;
    function bind(host) { H = host; }

`;

const FOOTER = `

    /* ── Julkinen rajapinta (street.js käyttää näitä) ── */
    return {
        bind: bind,
        reset: chaosCardsReset,
        update: updateCards,
        get meteorBurst() { return cardState.meteorBurst; },
        get lightsOut() { return cardState.lightsOut; },
        get animalParade() { return cardState.animalParade; },
        consumeAnimalParade: function () { if (cardState.animalParade > 0) cardState.animalParade--; },
        defs: chaosCardDefs,
        setForcedCard: setForcedCard
    };
})();
`;

/* ── 3) Kirjoita moduuli ── */
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, (HEADER + body + FOOTER).replace(/\r\n/g, '\n').split('\n').join(eol), 'utf8');

/* ── 4) Korvaa lohko street.js:ssä bind-kutsulla ── */
let out = lines.join('\n');
if (out.split(block).length - 1 !== 1) { console.error('Lohkoa ei löytynyt täsmälleen kerran street.js:stä.'); process.exit(1); }

const BIND = `    /* ── K7-kaaoskortit omasta tiedostosta (Vaihe 5 osa 5) ──
       street/chaos-cards.js omistaa korttipakan tilan (cardState) ja korttidefit.
       Tähän sidotaan ne street.js:n sulkeuman arvot, joita korttien
       save/apply/restore muuttaa – get+set -pareina, jotta muutokset näkyvät
       samoihin olioihin kuin ennen (esim. applyChaosProfile, render). */
    StreetChaosCards.bind({
        get anyChaos() { return chaosFlags.anyChaos; },
        rng: chaosRng,
        consts: { WORLD_W: WORLD_W, GROUND_Y: GROUND_Y },
        fx: {
            randomHuePalette: randomHuePalette,
            randomizeBuildingColors: randomizeBuildingColors,
            getAvailableWindows: getAvailableWindows,
            pickColorType: pickColorType
        },
        state: {
            get sunColor() { return sunColor; },               set sunColor(v) { sunColor = v; },
            get sunGlow() { return sunGlow; },                 set sunGlow(v) { sunGlow = v; },
            get daySkyTop() { return DAY_SKY_TOP; },           set daySkyTop(v) { DAY_SKY_TOP = v; },
            get daySkyMid() { return DAY_SKY_MID; },           set daySkyMid(v) { DAY_SKY_MID = v; },
            get daySkyHor() { return DAY_SKY_HORIZON; },       set daySkyHor(v) { DAY_SKY_HORIZON = v; },
            get fogAlpha() { return fogAlpha; },               set fogAlpha(v) { fogAlpha = v; },
            get windSpeed() { return windSpeed; },             set windSpeed(v) { windSpeed = v; },
            get buildingPalette() { return buildingPalette; }, set buildingPalette(v) { buildingPalette = v; },
            get animalSpawnTimer() { return animalSpawnTimer; }, set animalSpawnTimer(v) { animalSpawnTimer = v; },
            get starCount() { return starCount; },
            get starSizeMult() { return starSizeMult; },
            get stars() { return stars; },
            get litWindows() { return litWindows; }
        }
    });`;
out = out.split(block).join(BIND);

/* ── 5) Kutsukohdat street.js:ssä moduulikutsuiiksi ── */
const REPLACE = [
    ['        chaosCardsReset();', '        StreetChaosCards.reset();', 1],
    ['        updateCards(dt);', '        StreetChaosCards.update(dt);', 1],
    ['cardState.meteorBurst', 'StreetChaosCards.meteorBurst', 1],
    ['if (cardState.animalParade > 0) { cardState.animalParade--; animalSpawnTimer = 60; }',
     'if (StreetChaosCards.animalParade > 0) { StreetChaosCards.consumeAnimalParade(); animalSpawnTimer = 60; }', 1],
    ['cardState.lightsOut', 'StreetChaosCards.lightsOut', 3]
];
for (const [from, to, want] of REPLACE) {
    const n = out.split(from).length - 1;
    if (n !== want) {
        console.error('KORVAUS EPÄONNISTUI (' + n + ' osumaa, piti olla ' + want + '): ' + from.slice(0, 60));
        process.exit(1);
    }
    out = out.split(from).join(to);
}
if (out.split(BIND).join('').includes('cardState')) { console.error('street.js:ään jäi cardState-viittaus – ei kirjoiteta.'); process.exit(1); }

fs.writeFileSync(SRC, out.split('\n').join(eol), 'utf8');

console.log('OK: K7-kortit (' + (END - START + 1) + ' riviä) siirretty → street/chaos-cards.js');
console.log('street.js: ' + lines.length + ' riviä, 7 kohtaa päivitetty (2 kutsua + 5 tilalukua)');
