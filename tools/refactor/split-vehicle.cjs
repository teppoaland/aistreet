/* ═══════════════════════════════════════════════════════════
   split-vehicle.cjs – Vaihe 5 osa 4: ajoneuvon piirto omaksi
   tiedostoksi (street/traffic.js, StreetTraffic.drawVehicle).

   PELKKÄ SIIRTO: koodirivejä ei muuteta eikä uudelleenmuotoilla.
   Ainoat muutokset ovat moduulin rajalla:
     • host-sidotut nimet → H.xxx (H = bind():llä annettu host,
       jossa on live-getterit)
     • kutsukohdat: drawVehicle( → StreetTraffic.drawVehicle(

   drawVehicle on PUHDAS piirtofunktio: koko runko tarvitsee vain
   `ctx`, `dayT` ja `VEHICLE_HEADLIGHT_DIM` (todennettu hakemalla
   kaikki tunnistimet koko funktion alueelta).

   Ajo:
       node tools/refactor/split-vehicle.cjs
   Turvallisuus: jos yksikin varmistus (expectFirst / korvausten
   määrä) epäonnistuu, MITÄÄN ei kirjoiteta.
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');   // D:\AI\AI_street
const SRC = path.join(ROOT, 'street.js');
const OUT = path.join(ROOT, 'street', 'traffic.js');

const raw = fs.readFileSync(SRC, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);   // lines[0] === rivi 1

/* Siirrettävä riviväli (1-based, sisältäen) + varmistus */
const START = 8900, END = 9147;
const first = (lines[START - 1] || '').trim();
if (!first.startsWith('/* ── Ajoneuvo')) {
    console.error('VARMISTUS EPÄONNISTUI: rivin ' + START + ' piti alkaa "/* ── Ajoneuvo" mutta oli "' + first + '"');
    process.exit(1);
}
if (!(lines[END - 1] || '').trim().startsWith('}')) {
    console.error('VARMISTUS EPÄONNISTUI: rivin ' + END + ' piti olla funktion loppu "}" mutta oli "' + (lines[END - 1] || '') + '"');
    process.exit(1);
}

/* ── 1) Kerää siirrettävä teksti + nimeäminen moduulin rajalla ── */
let body = lines.slice(START - 1, END).join('\n');
const RENAMES = [
    [/\bctx\b/g, 'H.ctx'],
    [/\bdayT\b/g, 'H.dayT'],
    [/\bVEHICLE_HEADLIGHT_DIM\b/g, 'H.VEHICLE_HEADLIGHT_DIM']
];
for (const [re, to] of RENAMES) body = body.replace(re, to);

const HEADER = `/* ═══════════════════════════════════════════════════════════
   street/traffic.js – ajoneuvojen piirto (liikenne-domainin piirtopuoli)
   (Vaihe 5 osa 4, v11.38 – siirretty street.js:stä, PELKKÄ SIIRTO.)

   Sisältö: \`drawVehicle(v)\` – auto, mopo+kuski, ambulanssi ja
   panssarivaunu (telaketjut, tykki, torni) sekä ajovalokiila.
   Ajoneuvojen LIIKENNELOGIIKKA (spawn, liike, törmäys) on yhä
   street.js:ssä – tässä on vain piirto, kuten osassa 3 lehti.

   Ulkopuolelta sidotaan (bind) live-getterit:
       H.ctx · H.dayT · H.VEHICLE_HEADLIGHT_DIM

   Ladataan ENNEN street.js:iä (index.html). Testipenkit liittävät samat
   osat samassa järjestyksessä: tools/tests/street-src.cjs.
   ═══════════════════════════════════════════════════════════ */
var StreetTraffic = (function () {
    /* ── Sidottu host (street.js asettaa bind():llä) ── */
    let H = null;
    function bind(host) { H = host; }

`;

const FOOTER = `

    /* ── Julkinen rajapinta (street.js käyttää tätä) ── */
    return { bind: bind, drawVehicle: drawVehicle };
})();
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, (HEADER + body + FOOTER).replace(/\r\n/g, '\n').split('\n').join(eol), 'utf8');

/* ── 2) Poista lohko street.js:stä ── */
lines.splice(START - 1, END - START + 1);
let out = lines.join('\n');

/* ── 3) Kutsukohdat moduulikutsuiksi ── */
const calls = out.split('drawVehicle(').length - 1;
if (calls !== 4) {
    console.error('KUTSUKOHTIA odotettiin 4, löytyi ' + calls + ' – ei kirjoiteta.');
    process.exit(1);
}
out = out.split('drawVehicle(').join('StreetTraffic.drawVehicle(');

/* ── 4) Lisää bind street.js:ään (StreetNews.bindin perään) ── */
const ANCHOR = '    });\n\n\n    // Apufunktio: oven keskipiste';
const BIND = `    });

    /* ── Ajoneuvojen piirto omasta tiedostosta (Vaihe 5 osa 4) ──
       street/traffic.js sisältää drawVehicle(v):n. Liikennologiikka
       (spawn, liike, törmäys) jää tänne. Live-getterit: ctx asettuu
       initissä ja dayT liukuu päivä/yö-syklin mukana. */
    StreetTraffic.bind({
        get ctx() { return ctx; },
        get dayT() { return dayT; },
        VEHICLE_HEADLIGHT_DIM: VEHICLE_HEADLIGHT_DIM
    });


    // Apufunktio: oven keskipiste`;
if (out.split(ANCHOR).length - 1 !== 1) { console.error('Ankkuria ei löytynyt: StreetNews.bindin jälkeinen kohta'); process.exit(1); }
out = out.split(ANCHOR).join(BIND);

fs.writeFileSync(SRC, out.split('\n').join(eol), 'utf8');

console.log('OK: drawVehicle (' + (END - START + 1) + ' riviä) siirretty → street/traffic.js');
console.log('street.js: ' + lines.length + ' riviä, 4 kutsukohtaa päivitetty');
