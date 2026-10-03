/* ═══════════════════════════════════════════════════════════
   split-news.cjs – Vaihe 5 osa 3: sanomalehden asettelu + piirto
   omaksi tiedostoksi (street/news.js).

   PELKKÄ SIIRTO: koodirivejä ei muuteta eikä uudelleenmuotoilla.
   Ainoat muutokset ovat moduulin rajalla:
     • host-sidotut nimet (street.js:n sulkeumassa asuvat) → H.xxx
       (H on bind():llä annettu host, jossa on live-getterit)
     • moduulin oma tila: newsCache → cache, newsScreen → screen

   Ajo:
       node tools/refactor/split-news.cjs
   Turvallisuus: jos yksikin varmistus (expectFirst) epäonnistuu,
   MITÄÄN ei kirjoiteta.
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');   // D:\AI\AI_street
const SRC = path.join(ROOT, 'street.js');
const OUT = path.join(ROOT, 'street', 'news.js');

const raw = fs.readFileSync(SRC, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);   // lines[0] === rivi 1

/* Siirrettävät rivivälit (1-based, sisältäen) + varmistus ensimmäisestä rivistä */
const RANGES = [
    { start: 7053, end: 7185, first: '/* ═══ SANOMALEHTI: sisältö ja poiminta' },
    { start: 7187, end: 7208, first: 'function drawNewspaper() {' },
    { start: 7210, end: 7217, first: '/* Onko pelaaja lehden kohdalla?' },
    { start: 7219, end: 7241, first: '/* Pieni vihje lehden yläpuolella' },
    { start: 7243, end: 7267, first: '/* Käärii yhden kappaleen' },
    { start: 7269, end: 7279, first: '/* Sovittaa fontin niin' },
    { start: 7316, end: 7429, first: '/* ── Sanomalehden asettelu' },
    { start: 7431, end: 7532, first: '/* Sanomalehtinäkymä (v4.53)' }
];

/* ── 1) Varmistukset ─────────────────────────────────────── */
let bad = 0;
for (const r of RANGES) {
    const first = (lines[r.start - 1] || '').trim();
    if (!first.startsWith(r.first.trim())) {
        console.error('VARMISTUS EPÄONNISTUI: rivin ' + r.start + ' piti alkaa "' +
            r.first + '" mutta oli "' + first + '"');
        bad++;
    }
    if (r.end > lines.length || r.end < r.start) {
        console.error('Virheellinen riviväli: ' + r.start + '–' + r.end);
        bad++;
    }
}
if (bad) process.exit(1);

/* ── 2) Kerää siirrettävä teksti ─────────────────────────── */
let body = RANGES.map((r) => lines.slice(r.start - 1, r.end).join('\n')).join('\n\n');

/* ── 3) Moduulin rajalla tehtävät nimeämiset ─────────────── */
const RENAMES = [
    [/\bctx\b/g, 'H.ctx'],
    [/\bcanvas\b/g, 'H.canvas'],
    [/\bviewW\b/g, 'H.viewW'],
    [/\bforeground\b/g, 'H.foreground'],
    [/\bplayer\b/g, 'H.player'],
    [/\bvehicles\b/g, 'H.vehicles'],
    [/\bnewsRoom\b/g, 'H.newsRoom'],
    [/\biframeOpen\b/g, 'H.iframeOpen'],
    [/\bWORLD_W\b/g, 'H.WORLD_W'],
    [/\bWORLD_H\b/g, 'H.WORLD_H'],
    [/\bVIEWW_MIN\b/g, 'H.VIEWW_MIN'],
    [/\bnewsCache\b/g, 'cache'],
    [/\bnewsScreen\b/g, 'screen']
];
for (const [re, to] of RENAMES) body = body.replace(re, to);
console.log('Nimeämiset moduulin rajalla: ' + RENAMES.length + ' sääntöä.');


const HEADER = `/* ═══════════════════════════════════════════════════════════
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

`;

const FOOTER = `
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
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, (HEADER + body + FOOTER).replace(/\r\n/g, '\n').split('\n').join(eol), 'utf8');

/* ── 4) Poista siirretyt rivit street.js:stä (alhaalta ylös) ── */
for (const r of [...RANGES].sort((a, b) => b.start - a.start)) {
    lines.splice(r.start - 1, r.end - r.start + 1);
}
let out = lines.join('\n');

/* ── 5) Korvaa street.js:n kohdat moduulikutsulla ─────────── */
const REPLACE = [
    ['    let newsScreen = 0;            // näkyvä "näyttö" (pitkä sivu voi olla usealla)\n',
     ''],
    ['        const L = newsLayout();',
     '        const L = StreetNews.layout();'],
    ['        if (selUp && !newsHeldUp) newsScreen = Math.max(0, newsScreen - 1);',
     '        if (selUp && !newsHeldUp) StreetNews.prev();'],
    ['        if (selDown && !newsHeldDown) newsScreen = Math.min(lastIdx, newsScreen + 1);',
     '        if (selDown && !newsHeldDown) StreetNews.next();'],
    ['            if (newsScreen < lastIdx) newsScreen++;',
     '            if (StreetNews.index() < lastIdx) StreetNews.next();'],
    ['        if (!player.knockedDown && nearNewspaper()) { openNewspaper(); return true; }',
     '        if (!player.knockedDown && StreetNews.near()) { openNewspaper(); return true; }'],
    ["{ name: 'news',    isOpen: () => newsRoom,    update: updateNewsRoom,    draw: drawNewspaperView, close: closeNewsRoom }",
     "{ name: 'news',    isOpen: () => newsRoom,    update: updateNewsRoom,    draw: StreetNews.drawView, close: closeNewsRoom }"],
    ['        newsRoom = true;\n        newsScreen = 0;',
     '        newsRoom = true;\n        StreetNews.reset();'],
    ['        newsRoom = false;\n        newsScreen = 0;',
     '        newsRoom = false;\n        StreetNews.reset();'],
    ['        drawNewspaperHint();',
     '        StreetNews.drawHint();'],
    ['        if (foreground && foreground.newspaper) { drawNewspaper(); }',
     '        if (foreground && foreground.newspaper) { StreetNews.drawOnStreet(); }']
];
for (const [from, to] of REPLACE) {
    const n = out.split(from).length - 1;
    if (n !== 1) {
        console.error('KORVAUS EPÄONNISTUI (' + n + ' osumaa, piti olla 1): ' + from.trim().slice(0, 70));
        process.exit(1);
    }
    out = out.split(from).join(to);
}

/* ── 6) Lisää bind street.js:ään (StreetSfx.bindin perään) ── */
const ANCHOR = '    StreetSfx.bind({ WORLD_W: WORLD_W });   // moottoriäänen panorointi tarvitsee maailman leveyden';
const BIND = ANCHOR + `

    /* ── Sanomalehden asettelu + piirto omasta tiedostosta (Vaihe 5 osa 3) ──
       street/news.js omistaa lehden sivutilan (screen) ja asetteluvälimuistin.
       Tähän sidotaan street.js:n sulkeumassa asuvat arvot live-gettereinä,
       joten esim. viewW seuraa resizeä ja ctx asettuu initissä. */
    StreetNews.bind({
        get ctx() { return ctx; },
        get canvas() { return canvas; },
        get viewW() { return viewW; },
        get foreground() { return foreground; },
        get player() { return player; },
        get vehicles() { return vehicles; },
        get newsRoom() { return newsRoom; },
        get iframeOpen() { return iframeOpen; },
        WORLD_W: WORLD_W, WORLD_H: WORLD_H, VIEWW_MIN: VIEWW_MIN
    });`;
if (out.split(ANCHOR).length - 1 !== 1) { console.error('Ankkuria ei löytynyt: StreetSfx.bind'); process.exit(1); }
out = out.split(ANCHOR).join(BIND);

fs.writeFileSync(SRC, out.split('\n').join(eol), 'utf8');

const moved = RANGES.reduce((a, r) => a + (r.end - r.start + 1), 0);
console.log('OK: ' + RANGES.length + ' lohkoa, ' + moved + ' riviä siirretty → street/news.js');
console.log('street.js: ' + lines.length + ' riviä');
