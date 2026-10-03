/* ═══════════════════════════════════════════════════════════
   split-traffic-logic.cjs – Vaihe 5 osa 7: liikennologiikka
   SAMaan moduuliin (street/traffic.js) piirron kanssa.

   PELKKÄ SIIRTO + nimeäminen moduulin rajalla (host = H).
   Host-nimi H on turvallinen: lohko ei määrittele paikallista H:ta
   (paikalliset: playerHit, li, lane, dir, vehRnd, type, w, h, speed,
   vehicle, v, playerCY, gapCenter, inGap, CAR_H, pTop, pBot, ov0, ov1).
   HUOM: PLAYER_DEPTH_MAX_Y on määritelty vasta rivillä ~8041 → se on
   pakko sitoa GETTERINÄ (muuten TDZ bind-hetkellä).

   Ajo:  node tools/refactor/split-traffic-logic.cjs
   ═══════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'street.js');
const OUT = path.join(ROOT, 'street', 'traffic.js');

const raw = fs.readFileSync(SRC, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);

const START = 2679, END = 2802;
const block = lines.slice(START - 1, END).join('\n');

const guards = [
    ['alku on Liikenne-kommentti', block.startsWith('    /* ── Liikenne: ajoneuvojen liike')],
    ['updateTraffic', block.includes('function updateTraffic(dt, playerSafe) {')],
    ['LANE_DEFS', block.includes('LANE_DEFS')],
    ['chaosAllGone', block.includes('chaosAllGone()')],
    ['collisionCost', block.includes('collisionCost()')],
    ['PLAYER_DEPTH_MAX_Y', block.includes('PLAYER_DEPTH_MAX_Y')],
    ['ei sisällä updateCameraa', !block.includes('function updateCamera(')],
    ['loppu on sulkeva aaltosulku', block.trimEnd().endsWith('}')]
];
for (const [what, ok] of guards) if (!ok) { console.error('VARMISTUS EPÄONNISTUI: ' + what); process.exit(1); }

const RENAMES = [
    [/\bPLAYER_DEPTH_MAX_Y\b/g, 'H.PLAYER_DEPTH_MAX_Y'],
    [/\bTRAFFIC_DAY_MULT\b/g, 'H.TRAFFIC_DAY_MULT'],
    [/\btrafficSpawnMult\b/g, 'H.trafficSpawnMult'],
    [/\btrafficSpeedMult\b/g, 'H.trafficSpeedMult'],
    [/\bvehicleShakeTimer\b/g, 'H.vehicleShakeTimer'],
    [/\bstartVehicleEngine\(/g, 'H.sfx.startEngine('],
    [/\bupdateVehicleEngine\(/g, 'H.sfx.updateEngine('],
    [/\bstopVehicleEngine\(/g, 'H.sfx.stopEngine('],
    [/\bplayKnock\(\)/g, 'H.sfx.playKnock()'],
    [/\bspawnParticles\(/g, 'H.spawnParticles('],
    [/\bcollisionCost\(\)/g, 'H.collisionCost()'],
    [/\bchaosAllGone\(\)/g, 'H.chaosAllGone()'],
    [/\bLANE_DEFS\b/g, 'H.LANE_DEFS'],
    [/\bspawnTimers\b/g, 'H.spawnTimers'],
    [/\bvehicles\b/g, 'H.vehicles'],
    [/\bWORLD_W\b/g, 'H.WORLD_W'],
    [/\bdayT\b/g, 'H.dayT'],
    [/\bplayer\b/g, 'H.player']
];
let body = block;
for (const [re, to] of RENAMES) {
    const n = (body.match(re) || []).length;
    if (n === 0) { console.error('Nimeämistä ei löytynyt: ' + re); process.exit(1); }
    body = body.replace(re, to);
    console.log('  ' + String(n).padStart(3) + ' × ' + re.source + '  →  ' + to);
}

/* ── 1) Lisää funktio street/traffic.js-moduuliin ── */
let mod = fs.readFileSync(OUT, 'utf8');
const MARK = '    /* ── Julkinen rajapinta (street.js käyttää tätä) ── */';
if (mod.split(MARK).length - 1 !== 1) { console.error('Julkisen rajapinnan merkkiä ei löytynyt traffic.js:stä.'); process.exit(1); }
mod = mod.split(MARK).join(body + '\n' + MARK);

const RET_OLD = '    return { bind: bind, drawVehicle: drawVehicle };';
const RET_NEW = '    return { bind: bind, drawVehicle: drawVehicle, update: updateTraffic };';
if (mod.split(RET_OLD).length - 1 !== 1) { console.error('return-riviä ei löytynyt.'); process.exit(1); }
mod = mod.split(RET_OLD).join(RET_NEW);

/* Moduulin otsikko ajan tasalle */
mod = mod.replace(
    '   Ajoneuvojen LIIKENNELOGIIKKA (spawn, liike, törmäys) on yhä\n   street.js:ssä – tässä on vain piirto, kuten osassa 3 lehti.',
    '   Sekä LIIKENNOLOGIIKKA `updateTraffic(dt, playerSafe)`: spawnit, liike ja\n   törmäys (Vaihe 5 osa 7, v11.42). Huoneet/kadun tila (mm. `playerSafe`)\n   lasketaan yhä street.js:ssä, joka kutsuu tätä.');
mod = mod.replace(
    '   Ulkopuolelta sidotaan (bind) live-getterit:\n       H.ctx · H.dayT · H.VEHICLE_HEADLIGHT_DIM',
    '   Ulkopuolelta sidotaan (bind): live-getterit (`ctx`, `dayT`, `vehicles`,\n   `spawnTimers`, `player`, `vehicleShakeTimer` (get+set), `trafficSpeedMult`,\n   `trafficSpawnMult`, `PLAYER_DEPTH_MAX_Y` – viimeinen on määritelty vasta\n   tiedoston lopussa, joten se on PAKKO sitoa getterinä) + vakiot\n   (`WORLD_W`, `VEHICLE_HEADLIGHT_DIM`, `LANE_DEFS`, `TRAFFIC_DAY_MULT`) +\n   apurit (`chaosAllGone`, `spawnParticles`, `collisionCost`, `H.sfx.*`).');
fs.writeFileSync(OUT, mod.split('\n').join(eol), 'utf8');

/* ── 2) Poista lohko street.js:stä ja korvaa kutsut ── */
let out = lines.join('\n');
if (out.split(block).length - 1 !== 1) { console.error('Lohkoa ei löytynyt täsmälleen kerran.'); process.exit(1); }
out = out.split(block).join('    /* v11.42 (Vaihe 5 osa 7): liikennologiikka siirrettiin street/traffic.js-moduuliin\n       (updateTraffic). Tila (vehicles, spawnTimers, player, kertoimet) sidotaan\n       gettereillä tuonnempana; kutsut ovat muotoa StreetTraffic.update(dt[, playerSafe]). */');

const BIND_OLD = `    StreetTraffic.bind({
        get ctx() { return ctx; },
        get dayT() { return dayT; },
        VEHICLE_HEADLIGHT_DIM: VEHICLE_HEADLIGHT_DIM
    });`;
const BIND_NEW = `    StreetTraffic.bind({
        get ctx() { return ctx; },
        get dayT() { return dayT; },
        VEHICLE_HEADLIGHT_DIM: VEHICLE_HEADLIGHT_DIM,
        /* Vaihe 5 osa 7 – liikennologiikka lukee/mutatoi näitä. */
        WORLD_W: WORLD_W,   // ← v11.43: PUUTTUI (spawn x = WORLD_W + w → undefined+w = NaN!)
        get vehicles() { return vehicles; },
        get spawnTimers() { return spawnTimers; },
        get player() { return player; },
        get vehicleShakeTimer() { return vehicleShakeTimer; }, set vehicleShakeTimer(v) { vehicleShakeTimer = v; },
        get trafficSpeedMult() { return trafficSpeedMult; },
        get trafficSpawnMult() { return trafficSpawnMult; },
        get PLAYER_DEPTH_MAX_Y() { return PLAYER_DEPTH_MAX_Y; },   // määritelty rivillä ~8041 → getteri (TDZ)
        LANE_DEFS: LANE_DEFS, TRAFFIC_DAY_MULT: TRAFFIC_DAY_MULT,
        chaosAllGone: chaosAllGone, spawnParticles: spawnParticles, collisionCost: collisionCost,
        sfx: { playKnock: playKnock, startEngine: startVehicleEngine, updateEngine: updateVehicleEngine, stopEngine: stopVehicleEngine }
    });`;
if (out.split(BIND_OLD).length - 1 !== 1) { console.error('StreetTraffic.bind-lohkoa ei löytynyt sellaisenaan.'); process.exit(1); }
out = out.split(BIND_OLD).join(BIND_NEW);

const CALLS = out.split('updateTraffic(').length - 1;
if (CALLS !== 7) { console.error('Kutsukohtia odotettiin 7, löytyi ' + CALLS); process.exit(1); }
out = out.split('updateTraffic(').join('StreetTraffic.update(');

fs.writeFileSync(SRC, out.split('\n').join(eol), 'utf8');

console.log('OK: updateTraffic (' + (END - START + 1) + ' riviä) → street/traffic.js');
console.log('street.js: ' + lines.length + ' riviä, 7 kutsukohtaa + bind päivitetty');

