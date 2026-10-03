/* ═══════════════════════════════════════════════════════════
   ver.cjs – versioleimojen tarkistus yhdestä paikasta.

   Miksi: penkit vaativat aiemmin kovakoodatun numeron
   (esim. v11.26), joten jokainen versionosto hajoitti ne.
   Tämä moduuli lukee totuuden index.html:n #version-tagista,
   joten versioleiman tarkistus ei enää mätäne.

   Käyttö penkissä:
       const ver = require('./ver.cjs');
       ok('versio ' + ver.VERSION + ' (leimat samat)',
          ver.tagOk(html) && ver.stampsConsistent(html));
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');   // D:\AI\AI_street
const INDEX = path.join(ROOT, 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');

const m = html.match(/<div id="version-tag">v(\d+\.\d+)<\/div>/);
const NUM = m ? m[1] : null;            // esim. '11.37'
const VERSION = m ? 'v' + NUM : null;   // esim. 'v11.37'

/** Onko annetussa HTML:ssä sama #version-tag kuin index.html:ssä. */
function tagOk(src) {
    return !!VERSION && src.indexOf('<div id="version-tag">' + VERSION + '</div>') >= 0;
}

/** Kaikki ?v=-leimat annetusta HTML:stä (numerot ilman 'v'-etuliitettä). */
function stamps(src) {
    return (src.match(/\?v=(\d+\.\d+)/g) || []).map((s) => s.slice(3));
}

/** Ovatko kaikki ?v=-leimat samassa numerossa kuin #version-tag. */
function stampsConsistent(src) {
    const s = stamps(src);
    return s.length > 0 && s.every((v) => v === NUM);
}

module.exports = { ROOT, INDEX, html, NUM, VERSION, tagOk, stamps, stampsConsistent };
