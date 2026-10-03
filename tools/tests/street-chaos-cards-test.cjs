/* ═══════════════════════════════════════════════════════════════
   street-chaos-cards-test.cjs – K7-tapahtumakortit (v10.05/v11.38)

   Miksi: `street-render-smoke-test` ajaa FULL CHAOSin, mutta ensimmäinen
   kortti tulee vasta 60 s (3600 frameä) kuluttua → kortin
   **save → apply → restore** -polku ei koskaan laukea penkeissä.
   Se on kuitenkin ainoa kohta, jossa moduuli MUTATOI street.js:n tilaa
   (get+set-host), joten se on syytä validoida koneellisesti.

   Mitä tarkistetaan:
     1) reset + lippujen alkutila (juuri ladatussa pelissä)
     2) jokainen 10 kortista: save() → apply() → restore() palauttaa
        tilan TÄSMÄLLEEN (sama getter-joukko) ja apply todella muutti
        tilaa, jos kortilla on talletettavaa tilaa
     3) lippukortit (meteor/blackout/parade) vaikuttavat julkisiin
        lippuihin ja consumeAnimalParade() vähentää paraatia

   Ajo: node tools/tests/street-chaos-cards-test.cjs
   ═══════════════════════════════════════════════════════════════ */
const vm = require('vm');
const src = require('./street-src.cjs');

/* Sama ympäristö-stubi kuin muissa street-penkeissä. */
const sandbox = {
    console, Math, Date, JSON, URLSearchParams,
    location: { search: '' },
    document: {
        addEventListener: () => {}, getElementById: () => null,
        querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({ getContext: () => null, style: {}, classList: { add: () => {}, remove: () => {} } })
    },
    window: { addEventListener: () => {} },
    navigator: { maxTouchPoints: 0 },
    performance: { now: () => 0 },
    requestAnimationFrame: () => 0,
    StreetAudio: { init: () => {}, start: () => {}, stop: () => {}, playDeathGong: () => {}, getCtx: () => null, getDestination: () => null, playJukebox: () => {}, playJukeboxQueue: () => {}, appendJukeboxQueue: () => {}, stopJukebox: () => {}, isJukeboxPlaying: () => false, getJukeboxQueuePos: () => 0, setHungerTempo: () => {} },
    GameState: { STORAGE_KEY: 'x', defaultState: { inventory: { coin: false, coinCount: 0, hamburgerCount: 5 }, litLamps: [false, false, false, false, false], isDay: null }, load: () => ({}), save: () => {}, reset: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval
};
sandbox.globalThis = sandbox;

let fail = 0;
const F = (m) => { fail++; console.error('  X ' + m); };

try {
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox, { filename: 'street.js' });
} catch (e) {
    console.error('FATAL: IIFE-lataus epäonnistui:', e && e.stack || e);
    process.exit(1);
}

const C = vm.runInContext('StreetChaosCards', sandbox);
if (!C) { console.error('FATAL: StreetChaosCards ei latautunut (Vaihe 5 osa 5)'); process.exit(1); }

/* 1) reset + liput */
C.reset();
if (C.lightsOut !== false || C.meteorBurst !== false || C.animalParade !== 0) F('reset ei nollaa lippuja');
if (C.defs().length !== 10) F('kortteja ' + C.defs().length + ' (odotettu 10)');
console.log('1) reset + liput OK (' + C.defs().length + ' korttia)');

/* 2) Jokainen kortti: save → apply → restore = täsmälleen sama tila */
let checked = 0;
for (const d of C.defs()) {
    try {
        const before = d.save();
        const b = JSON.stringify(before);
        d.apply();
        const afterApply = JSON.stringify(d.save());
        d.restore(before);
        const restored = JSON.stringify(d.save());
        if (restored !== b) { F(d.id + ': restore ei palauttanut täsmälleen: ' + b + ' → ' + restored); continue; }
        if (Object.keys(before).length && afterApply === b) F(d.id + ': apply ei vaikuttanut tilaan');
        checked++;
    } catch (e) {
        F(d.id + ': kaatui – ' + (e && e.message));
    }
}
console.log('2) save/apply/restore ' + checked + '/' + C.defs().length + ' kortille OK');

/* 3) Lippukortit + paraatin kulutus */
for (const [id, get] of [['meteor', () => C.meteorBurst], ['blackout', () => C.lightsOut]]) {
    const d = C.defs().find((x) => x.id === id);
    const s = d.save(); d.apply();
    if (get() !== true) F(id + ': lippu ei asettunut');
    d.restore(s);
    if (get() !== false) F(id + ': lippu ei palautunut');
}
const parade = C.defs().find((x) => x.id === 'parade');
const ps = parade.save(); parade.apply();
if (!(C.animalParade > 0)) F('parade: animalParade ei asettunut');
const n1 = C.animalParade;
C.consumeAnimalParade();
if (C.animalParade !== n1 - 1) F('consumeAnimalParade ei vähentänyt');
parade.restore(ps);
if (C.animalParade !== 0) F('parade: animalParade ei palautunut');
console.log('3) lippukortit (meteor/blackout/parade) OK');

/* 4) Testikytkin ?card=<id>: valittu kortti jää päälle eikä palaudu kesken */
let forcedOk = 0;
for (const id of C.defs().map((d) => d.id)) {
    C.setForcedCard(id);
    C.update(16);
    const s1 = JSON.stringify(C.defs().find((d) => d.id === id).save());
    C.update(16); C.update(16);
    const s2 = JSON.stringify(C.defs().find((d) => d.id === id).save());
    if (s1 !== s2) F('card=' + id + ': kortti ei pysynyt päällä (' + s1 + ' → ' + s2 + ')');
    else forcedOk++;
}
for (const [id, get] of [['meteor', () => C.meteorBurst], ['blackout', () => C.lightsOut]]) {
    C.setForcedCard(id); C.update(16); C.update(16);
    if (get() !== true) F('card=' + id + ': lippu ei pysynyt päällä');
}
C.setForcedCard('parade'); C.update(16); C.update(16);
if (!(C.animalParade > 0)) F('card=parade: animalParade ei pysynyt päällä');
C.setForcedCard('nonsense'); C.update(16);   // tuntematon id ei saa kaatua
C.setForcedCard(null);
C.reset();
console.log('4) ?card=<id> pitää kortin päällä ' + forcedOk + '/' + C.defs().length + ' kortille OK');

/* 5) Rakennevahti (v11.39 bugikorjaus): blackout-kortti pimentää myös lamppujen
      KUVUT, kuvun valopilkun, ovivalon ja pelaajan reunavalon – ei vain hehkua ja
      ikkunoita. Penkit eivät näe piirtoa, joten tämä tarkistetaan lähdetekstistä. */
const guardSrc = require('./street-src.cjs');
const ORAKENTEET = [
    ['drawLampPost: litNow-vahti', /const litNow = lamp\.lit && !StreetChaosCards\.lightsOut;/],
    ['kupu: else if (litNow)', /else if \(litNow\) \{/],
    ['valopilkku: if (litNow && dayDim', /if \(litNow && dayDim > 0\.01\) \{/],
    ['ovivalo: doorLit-vahti', /const doorLit = ownerLamp\.lit && !StreetChaosCards\.lightsOut;/],
    ['reunavalo: rimLightsOut-vahti', /const rimLightsOut = StreetChaosCards\.lightsOut;/]
];
for (const [what, re] of ORAKENTEET) if (!re.test(guardSrc)) F('rakennevahti: ' + what + ' puuttuu');
console.log('5) rakennevahti (blackout pimentää lamput/ovivalon/reunavalon) OK');

console.log(fail ? '\n=== TULOS: ' + fail + ' löydöstä ===' : '\n=== TULOS: 0 löydöstä ===');
process.exit(fail ? 1 : 0);
