/* ═══════════════════════════════════════════════════════════
   street-src.cjs – YKSI paikka, josta testipenkit lukevat
   street.js:n lähdetekstin.

   Miksi: penkit ajavat street.js:n Node-vm:ssä ja osa tekee
   lähdetekstiin kohdistuvia tarkistuksia (indexOf / regex).
   Kun street.js joskus jaetaan osiin, riittää että tämä tiedosto
   liittää osat oikeassa järjestyksessä – penkkejä ei tarvitse
   muuttaa.

   Käyttö penkissä:
       const streetSrc = require('./street-src.cjs');
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');   // D:\AI\AI_street

/* street.js on nyt jaettu osiin (Vaihe 5). Listaa osat TÄSSÄ
   latausjärjestyksessä – sama järjestys kuin index.html:n <script>-riveillä.
   Penkit saavat siis saman kokonaisuuden kuin selain. */
const PARTS = ['street/chaos-config.js', 'street/sfx.js', 'street/news.js', 'street/traffic.js', 'street/chaos-cards.js', 'street/rooms.js', 'street.js'];

const src = PARTS
    .map((p) => fs.readFileSync(path.join(ROOT, p), 'utf8'))
    .join('\n');

module.exports = src;
