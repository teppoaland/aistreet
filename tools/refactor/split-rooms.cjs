/* ═══════════════════════════════════════════════════════════
   split-rooms.cjs – Vaihe 5 osa 6: huoneiden PIIRTO omaksi
   tiedostoksi (street/rooms.js, StreetRooms).

   PELKKÄ SIIRTO: koodirivejä ei muuteta eikä uudelleenmuotoilla.
   Mukana: makuuhuone + jukebox + BAR (myös BAR-taulun kuva-tila
   BAR_PIC_SRC/barPic/barPicReady, jota ei käytetä muualla).

   Ajo:  node tools/refactor/split-rooms.cjs
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'street.js');
const OUT = path.join(ROOT, 'street', 'rooms.js');

const raw = fs.readFileSync(SRC, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);

/* Koko huoneblokki on yhtenäinen: makuuhuone (talo 7) → jukebox → BAR. */
const START = 7164, END = 8176;
const block = lines.slice(START - 1, END).join('\n');

const guards = [
    ['alku on Makuuhuone-kommentti', block.startsWith('    /* ── Makuuhuone')],
    ['drawSleepRoom', block.includes('function drawSleepRoom() {')],
    ['drawJukeboxRoom', block.includes('function drawJukeboxRoom() {')],
    ['drawJukeboxCabinet', block.includes('function drawJukeboxCabinet(x, baseY, now, playing, armed, cover) {')],
    ['BAR-taulun kuva-tila', block.includes("const BAR_PIC_SRC = 'assets/justiina.png';")],
    ['barPic/barPicReady', block.includes('const barPic = ') && block.includes('let barPicReady = ')],
    ['drawBarBeer', block.includes('function drawBarBeer(cx, tableTop) {')],
    ['drawBarRoom', block.includes('function drawBarRoom() {')],
    ['ei sisällä lampGeomia', !block.includes('function lampGeom(')],
    ['loppu on sulkeva aaltosulku', block.trimEnd().endsWith('}')]
];
for (const [what, ok] of guards) if (!ok) { console.error('VARMISTUS EPÄONNISTUI: ' + what); process.exit(1); }

/* Nimeäminen moduulin rajalla: host-sidotut nimet → ENV.xxx.
   (BAR_PIC_SRC/barPic/barPicReady jäävät moduuliin – niitä ei käytetä muualla.) */
const RENAMES = [
    [/\bctx\b/g, 'ENV.ctx'],
    [/\bcanvas\b/g, 'ENV.canvas'],
    [/\bWORLD_W\b/g, 'ENV.WORLD_W'],
    [/\bWORLD_H\b/g, 'ENV.WORLD_H'],
    [/\bVIEWW_MIN\b/g, 'ENV.VIEWW_MIN'],
    [/\bviewW\b/g, 'ENV.viewW'],
    [/\bcamX\b/g, 'ENV.camX'],
    [/\bGROUND_Y\b/g, 'ENV.GROUND_Y'],
    [/\bisDay\b/g, 'ENV.isDay'],
    [/\bcoinCount\b/g, 'ENV.coinCount'],
    [/\bhamburgerCount\b/g, 'ENV.hamburgerCount'],
    [/\bdrunkLevel\b/g, 'ENV.drunkLevel'],
    [/\bDRUNK_MAX\b/g, 'ENV.DRUNK_MAX'],
    [/\bbarBuyQty\b/g, 'ENV.barBuyQty'],
    [/\bjukeQueue\b/g, 'ENV.jukeQueue'],
    [/\bjukePick\b/g, 'ENV.jukePick'],
    [/\bjukeSel\b/g, 'ENV.jukeSel'],
    [/\bjukeCovers\b/g, 'ENV.jukeCovers'],
    [/\bJUKEBOX_TRACKS\b/g, 'ENV.JUKEBOX_TRACKS'],
    [/\bsleepPhase\b/g, 'ENV.sleepPhase'],
    [/\bsleepSel\b/g, 'ENV.sleepSel'],
    [/\bSLEEP_DARK_FRAMES\b/g, 'ENV.SLEEP_DARK_FRAMES'],
    [/\bSLEEP_ZZZ_FRAMES\b/g, 'ENV.SLEEP_ZZZ_FRAMES'],
    [/\bSLEEP_FADE_FRAMES\b/g, 'ENV.SLEEP_FADE_FRAMES'],
    [/\bBAR_BEER_H\b/g, 'ENV.BAR_BEER_H'],
    [/\bchaosFlags\b/g, 'ENV.chaosFlags']
];
let body = block;
for (const [re, to] of RENAMES) {
    const n = (body.match(re) || []).length;
    if (n === 0) { console.error('Nimeämistä ei löytynyt: ' + re); process.exit(1); }
    body = body.replace(re, to);
    console.log('  ' + String(n).padStart(3) + ' × ' + re.source.replace(/\\b|\\|\//g, '') + ' → ' + to);
const HEADER = `/* ═══════════════════════════════════════════════════════════
   street/rooms.js – canvas-huoneiden PIIRTO (makuuhuone, jukebox, BAR)
   (Vaihe 5 osa 6, v11.40 – siirretty street.js:stä, PELKKÄ SIIRTO.)

   Sisältö: \`drawSleepRoom\` (sänky + Nuku/Poistu + Zzz-pimennys),
   \`drawJukeboxRoom\` + \`drawJukeboxCabinet\` (levy + neonkaari) ja
   \`drawBarRoom\` + \`drawBarBeer\` (olut, VAIN FULL) sekä BAR-taulun
   kuva-tila (BAR_PIC_SRC / barPic / barPicReady – ei käytetä muualla).

   Huoneiden TILA ja syöttölogiikka (updateSleepRoom/updateBarRoom/
   updateJukeboxRoom, closeXxxRoom, oven avaus) ovat yhä street.js:ssä –
   tässä on vain piirto, kuten osissa 3–5.

   Ulkopuolelta sidotaan (bind): live-getterit street.js:n sulkeuman
   arvoille + vakiot:
       ENV.ctx · ENV.canvas · ENV.viewW · ENV.camX · ENV.isDay · ENV.coinCount ·
       ENV.hamburgerCount · ENV.drunkLevel · ENV.barBuyQty · ENV.jukeQueue ·
       ENV.jukePick · ENV.jukeSel · ENV.jukeCovers · ENV.sleepPhase · ENV.sleepSel ·
       ENV.chaosFlags (olio) ·
       ENV.WORLD_W · ENV.WORLD_H · ENV.VIEWW_MIN · ENV.GROUND_Y · ENV.JUKEBOX_TRACKS ·
       ENV.SLEEP_DARK_FRAMES · ENV.SLEEP_ZZZ_FRAMES · ENV.SLEEP_FADE_FRAMES ·
       ENV.DRUNK_MAX · ENV.BAR_BEER_H

   Ladataan ENNEN street.js:iä (index.html). Testipenkit liittävät samat
   osat samassa järjestyksessä: tools/tests/street-src.cjs.
   ═══════════════════════════════════════════════════════════ */
var StreetRooms = (function () {
    /* ── Sidottu host (street.js asettaa bind():llä) ── */
    let ENV = null;
    function bind(host) { ENV = host; }

`;

const FOOTER = `

    /* ── Julkinen rajapinta (street.js:n huonerekisteri käyttää näitä) ── */
    return {
        bind: bind,
        drawSleep: drawSleepRoom,
        drawJukebox: drawJukeboxRoom,
        drawBar: drawBarRoom
    };
})();
`;

/* ── 3) Kirjoita moduuli ── */
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, (HEADER + body + FOOTER).replace(/\r\n/g, '\n').split('\n').join(eol), 'utf8');

}

/* ── 4) Korvaa blokki street.js:ssä bind-kutsulla ── */
let out = lines.join('\n');
if (out.split(block).length - 1 !== 1) { console.error('Blokkia ei löytynyt täsmälleen kerran.'); process.exit(1); }

const BIND = `    /* ── Huoneiden piirto omasta tiedostosta (Vaihe 5 osa 6) ──
       street/rooms.js piirtää makuuhuoneen, jukeboxin ja BARin. Huoneiden
       TILA ja syöttölogiikka (update- ja close-funktiot) sekä oven avaus jäävät tänne.
       Tähän sidotaan ne street.js:n sulkeuman arvot, joita piirto lukee –
       live-gettereinä, jotta esim. viewW/camX seuraavat resizeä ja
       coinCount/hamburgerCount ostoksia. Vakiot annetaan arvoina. */
    StreetRooms.bind({
        get ctx() { return ctx; },
        get canvas() { return canvas; },
        get viewW() { return viewW; },
        get camX() { return camX; },
        get isDay() { return isDay; },
        get coinCount() { return coinCount; },
        get hamburgerCount() { return hamburgerCount; },
        get drunkLevel() { return drunkLevel; },
        get barBuyQty() { return barBuyQty; },
        get jukeQueue() { return jukeQueue; },
        get jukePick() { return jukePick; },
        get jukeSel() { return jukeSel; },
        get jukeCovers() { return jukeCovers; },
        get sleepPhase() { return sleepPhase; },
        get sleepSel() { return sleepSel; },
        chaosFlags: chaosFlags,
        WORLD_W: WORLD_W, WORLD_H: WORLD_H, VIEWW_MIN: VIEWW_MIN, GROUND_Y: GROUND_Y,
        JUKEBOX_TRACKS: JUKEBOX_TRACKS,
        SLEEP_DARK_FRAMES: SLEEP_DARK_FRAMES, SLEEP_ZZZ_FRAMES: SLEEP_ZZZ_FRAMES,
        SLEEP_FADE_FRAMES: SLEEP_FADE_FRAMES,
        DRUNK_MAX: DRUNK_MAX, BAR_BEER_H: BAR_BEER_H
    });`;
out = out.split(block).join(BIND);

/* ── 5) Huonerekisterin draw-osoittimet moduuliin ── */
const REPLACE = [
    ['draw: drawSleepRoom,', 'draw: StreetRooms.drawSleep,', 1],
    ['draw: drawBarRoom,', 'draw: StreetRooms.drawBar,', 1],
    ['draw: drawJukeboxRoom,', 'draw: StreetRooms.drawJukebox,', 1]
];
for (const [from, to, want] of REPLACE) {
    const n = out.split(from).length - 1;
    if (n !== want) { console.error('KORVAUS EPÄONNISTUI (' + n + '/' + want + '): ' + from); process.exit(1); }
    out = out.split(from).join(to);
}
for (const gone of ['drawSleepRoom', 'drawBarRoom', 'drawJukeboxRoom', 'drawJukeboxCabinet', 'drawBarBeer', 'barPic']) {
    if (new RegExp('(?<![\\w.$])' + gone + '(?![\\w$])').test(out)) { console.error('street.js:ään jäi viittaus: ' + gone); process.exit(1); }
}

fs.writeFileSync(SRC, out.split('\n').join(eol), 'utf8');

/* ── 6) Varoitus: jäikö moduuliin nimeä, jota ei ole sidottu/määritelty? ── */
const LOCALS = new Set();
for (const m of body.matchAll(/\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)/g)) LOCALS.add(m[1]);
for (const m of body.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) LOCALS.add(m[1]);
for (const m of body.matchAll(/\(([^)]*)\)\s*=>/g)) for (const p of m[1].split(',')) { const t = p.trim().split(/[=\s]/)[0]; if (/^[A-Za-z_$][\w$]*$/.test(t)) LOCALS.add(t); }
const HOST = new Set(['ENV', 'ctx', 'canvas', 'viewW', 'camX', 'isDay', 'coinCount', 'hamburgerCount', 'drunkLevel', 'barBuyQty',
    'jukeQueue', 'jukePick', 'jukeSel', 'jukeCovers', 'sleepPhase', 'sleepSel', 'chaosFlags',
    'WORLD_W', 'WORLD_H', 'VIEWW_MIN', 'GROUND_Y', 'JUKEBOX_TRACKS', 'SLEEP_DARK_FRAMES', 'SLEEP_ZZZ_FRAMES',
    'SLEEP_FADE_FRAMES', 'DRUNK_MAX', 'BAR_BEER_H']);
const SYS = new Set(('Math Date JSON Image StreetAudio Array String Number Object Boolean Set Map Float32Array parseInt parseFloat isNaN console document window setTimeout Infinity NaN undefined this true false null const let var function return if else for while do break continue of in new typeof delete void try catch switch case default instanceof').split(' '));
const suspect = new Map();
for (const m of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)(?![\w$])/g)) {
    const id = m[1];
    if (LOCALS.has(id) || HOST.has(id) || SYS.has(id)) continue;
    suspect.set(id, (suspect.get(id) || 0) + 1);
}
console.log('OK: ' + (END - START + 1) + ' riviä siirretty → street/rooms.js');
console.log('Sidomattomat nimet (' + suspect.size + ') – osuvat pääosin kommentteihin:');
console.log('  ' + [...suspect.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => k + '(' + v + ')').join(' · '));

