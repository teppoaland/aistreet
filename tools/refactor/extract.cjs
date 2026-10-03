/* ═══════════════════════════════════════════════════════════
   extract.cjs – MEKAANINEN siirtotyökalu: siirtää valitut
   rivivälit omiksi funktioikseen saman IIFE:n sisällä.

   Miksi: käsin leikkaaminen 300 rivin blokista on virhealtista.
   Tämä työkalu tekee PELKÄN siirron – koodirivejä ei muuteta,
   ei uudelleenmuotoilla eikä nimetä uudelleen (paitsi valinnainen
   `return;` → `return true;` -muunnos).

   Ajo:
       node tools/refactor/extract.cjs tools/refactor/plan-render.json

   Suunnitelma (JSON):
   {
     "file":   "d:/AI/AI_street/street.js",
     "anchor": "    function render() {",       // funktiot lisätään ennen tätä riviä
     "entries": [
       { "start": 5792, "end": 5799, "name": "drawRoomView",
         "expectFirst": "if (sleepRoom) {",      // varmistus: rivin alku täsmää
         "call": "if (drawRoomView()) return;",  // korvaava kutsurivi (sama sisennys)
         "bool": true,                           // return; → return true; + loppuun return false;
         "comment": "Huoneet: koko näkymä on huone" }
     ]
   }

   Turvallisuus: työkalu EI kirjoita tiedostoa, jos yksikin varmistus
   (`expectFirst`) epäonnistuu. Rivinumerot ovat ALKUPERÄISEN tiedoston
   mukaisia; blokit käsitellään alhaalta ylöspäin, joten numerot pysyvät voimassa.
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const planPath = process.argv[2];
if (!planPath) { console.error('Anna suunnitelma: node tools/refactor/extract.cjs <plan.json>'); process.exit(1); }
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

const file = plan.file;
const src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
let lines = src.split(/\r?\n/);

const INDENT = 4;                     // IIFE:n sisällä funktiot ovat 4 välilyönnillä
const BODY_INDENT = ' '.repeat(INDENT + 4);

/* 1) Varmistukset */
if (!lines.includes(plan.anchor)) { console.error('Ankkuria ei löytynyt: ' + plan.anchor); process.exit(1); }
for (const e of plan.entries) {
    const first = (lines[e.start - 1] || '').trim();
    if (e.expectFirst && !first.startsWith(e.expectFirst.trim())) {
        console.error('VARMISTUS EPÄONNISTUI (' + e.name + '): rivin ' + e.start +
            ' piti alkaa "' + e.expectFirst + '" mutta oli "' + first + '"');
        process.exit(1);
    }
    if (e.start < 1 || e.end < e.start || e.end > lines.length) {
        console.error('Virheellinen riviväli: ' + e.name); process.exit(1);
    }
    if (lines.slice(e.start - 1, e.end).some((l) => l.includes('function ' + e.name + '('))) {
        console.error('Funktio ' + e.name + ' on jo olemassa – ei siirretä.'); process.exit(1);
    }
}

/* 2) Rakenna funktiot (nouseva järjestys = luettava lopputulos) */
const made = [];
for (const e of [...plan.entries].sort((a, b) => a.start - b.start)) {
    const body = lines.slice(e.start - 1, e.end).map((l) => {
        /* bool: kaikki `return;` → `return true;` (myös rivin sisällä, esim.
           `if (x) { ...; return; }`). Vain blokeille, joissa ei ole sisäkkäisiä
           funktioita eikä merkkijonoja, jotka sisältävät `return;`. */
        if (e.bool) return l.replace(/(^|[^\w.$])return;/g, '$1return true;');
        return l;
    });
    const head = [];
    if (e.comment) head.push('    /* ' + e.comment + ' */');
    head.push('    function ' + e.name + '(' + (e.params || '') + ') {');
    const tail = [];
    if (e.bool) tail.push(BODY_INDENT + 'return false;');
    tail.push('    }');
    made.push({ entry: e, text: head.concat(body, tail) });
}

/* 3) Korvaa blokit kutsuilla – alhaalta ylöspäin, jotta rivinumerot pysyvät */
for (const e of [...plan.entries].sort((a, b) => b.start - a.start)) {
    const indent = (lines[e.start - 1].match(/^\s*/) || [''])[0];
    const callLine = indent + (e.call || (e.name + '();'));
    lines.splice(e.start - 1, e.end - e.start + 1, callLine);
}

/* 4) Lisää funktiot ankkurin eteen */
const anchorIdx = lines.indexOf(plan.anchor);
const insert = [];
for (const m of made) { insert.push(...m.text, ''); }
lines.splice(anchorIdx, 0, ...insert);

fs.writeFileSync(file, lines.join(eol), 'utf8');

const moved = plan.entries.reduce((a, e) => a + (e.end - e.start + 1), 0);
console.log('OK: ' + plan.entries.length + ' funktiota, ' + moved + ' riviä siirretty (' + path.basename(file) + ')');
for (const m of made) console.log('   ' + m.entry.name + '  ← rivit ' + m.entry.start + '–' + m.entry.end);
