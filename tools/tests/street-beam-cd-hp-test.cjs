/* v11.14 validointi: sädeaseen laukaisuväli + meteoriitin 2 osumaa.
   Funktiot poimitaan SUORAAN street.js:stä (ei kopiota logiikasta).
   Aja: node %TEMP%\street-beam-cd-hp-test.cjs                                  */
const fs = require('fs');
const src = require('./street-src.cjs');

function extract(name) {
    const idx = src.indexOf('function ' + name + '(');
    if (idx < 0) throw new Error('funktiota ei löytynyt: ' + name);
    let depth = 0, i = src.indexOf('{', idx);
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(idx, i + 1); }
    }
    throw new Error('sulut eivät täsmää: ' + name);
}
const cache = {};
function num(name) {
    if (cache[name] !== undefined) return cache[name];
    const m = src.match(new RegExp('^\\s*const ' + name + '\\s*=\\s*([^;\\n]+)', 'm'));
    if (!m) throw new Error('vakiota ei löytynyt: ' + name);
    // korvaa lausekkeen muut vakionimet (esim. LAMP_BASE_Y = GROUND_Y + 15)
    const e = m[1].replace(/([A-Z_][A-Z0-9_]*)/g, function (id) {
        if (id === name) return id;
        try { return ' ' + num(id) + ' '; } catch (err) { return id; }
    });
    cache[name] = parseFloat(e);
    if (isNaN(cache[name])) throw new Error('vakion arvo ei ratkennut: ' + name + ' = ' + m[1]);
    return cache[name];
}
function arr(name) {
    const m = src.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
    if (!m) throw new Error('taulukkoa ei löytynyt: ' + name);
    return 'const ' + name + ' = [' + m[1] + '];';
}

const prelude = `
let beamWeaponCollected = true, beamCooldownTimer = 0, beamFireTimer = 0;
let beamStartX = 0, beamStartY = 0, beamEndX = 0, beamEndY = 0;
let aimX = 0, aimY = 0, coinCount = 0, shootingStar = null;
/* Vaihe 4 loppuun (v11.45): päivä/yö-tila on nyt yksi olio. Tämä penkki
   rakentaa oman preludin ja poimii tuotannosta vain funktioita, joten
   tarvittava tila (beamCanFire lukee dayNight.t) pitää määritellä tässä. */
const dayNight = { t: 0, isDay: false, moonDark: 0 };
const GROUND_Y = ${num('GROUND_Y')};
const LAMP_BASE_Y = ${num('LAMP_BASE_Y')};
const BEAM_HIT_TOLERANCE = ${num('BEAM_HIT_TOLERANCE')};
const BEAM_FIRE_FRAMES = ${num('BEAM_FIRE_FRAMES')};
const BEAM_COOLDOWN_FRAMES = ${num('BEAM_COOLDOWN_FRAMES')};
const METEOR_HITS_TO_KILL = ${num('METEOR_HITS_TO_KILL')};
const chaosLevel = 'full';
/* Vaihe 2 (v11.38): tuotanto lukee johdettuja moodilippuja (chaosFlags). Testipreludissa
   ne johdetaan Proxylla chaosLevelistä → pysyvät synkassa myös setChaos()-kutsujen jälkeen. */
const chaosFlags = new Proxy({}, { get: (_, k) => ({ beer: chaosLevel === 'full', drunk: chaosLevel === 'full', beamWeapon: chaosLevel === 'full', meteorAlways: chaosLevel === 'full', meteorKill: chaosLevel === 'full', meteorHalf: chaosLevel === 'bad', badDemo: chaosLevel === 'bad', badFinale: chaosLevel === 'bad', ruin: chaosLevel === 'bad' || chaosLevel === 'full', mosquitoes: chaosLevel === 'bad' || chaosLevel === 'full', anyChaos: chaosLevel !== 'normal' })[k] });
const player = { x: 300, y: 300, w: 12, h: 12, facing: -1 };
const state = { inventory: { coinCount: 0 } };
const GameState = { save() {} };
const log = [];
function playLaser()          { log.push('laser'); }
function buildingGone()       { return false; }   // v11.22: tuhoutuneet talot (ei tässä testissä)
function playCoin()           { log.push('coin'); }
function playMeteorHit()      { log.push('meteorhit'); }
function playBeamEmpty()      { log.push('empty'); }
function spawnParticles()     {}
function updateHUD()          {}
${arr('buildings')}
${extract('distanceToSegment')}
${extract('beamMuzzle')}
${extract('meteoriteBehindBuilding')}
${extract('beamCanFire')}
/* v11.31d: fireBeam kysyy humalan tähtäyshorjuntaa (drunkAimShift) → stubataan
   0-tasolle, jotta testin geometria pysyy deterministisenä. */
${extract('drunkAimShift')}
let drunkLevel = 0;
const DRUNK_MAX = ${num('DRUNK_MAX')};
const DRUNK_AIM_MIN = ${num('DRUNK_AIM_MIN')};
${arr('DRUNK_AIM_PX')}
${extract('fireBeam')}
// sama tikitys kuin update()ssa (r. 2954–2955)
function tick(dt) {
    if (beamFireTimer > 0) beamFireTimer -= dt;
    if (beamCooldownTimer > 0) beamCooldownTimer -= dt;
    if (shootingStar && shootingStar.hitFlash > 0) shootingStar.hitFlash -= dt;
}
function star(over) {
    return Object.assign({
        kind: 'meteorite', x: 400, y: 100, vx: 0.5, vy: 0.5, r: 10,
        active: true, life: 0, hpLeft: METEOR_HITS_TO_KILL, cracked: false, hitFlash: 0, trail: []
    }, over || {});
}
return { fireBeam, beamCanFire, tick, log, star,
         setStar: s => { shootingStar = s; }, getStar: () => shootingStar,
         setAim: (x, y) => { aimX = x; aimY = y; }, setDay: v => { dayNight.t = v; },
         setFacing: v => { player.facing = v; },
         cd: () => beamCooldownTimer, coins: () => coinCount,
         clear: () => { log.length = 0; }, consts: { BEAM_COOLDOWN_FRAMES, METEOR_HITS_TO_KILL } };
`;

const api = new Function(prelude)();
let pass = 0, fail = 0;
function ok(label, cond, extra) {
    if (cond) { pass++; console.log('  OK   ' + label); }
    else { fail++; console.log('  FAIL ' + label + (extra ? '  -> ' + extra : '')); }
}
const S = api;
console.log('vakiot: cooldown=' + S.consts.BEAM_COOLDOWN_FRAMES + ' f, hits=' + S.consts.METEOR_HITS_TO_KILL);


/* A: ensimmäinen osuma murskaa kuoren – ei kolikkoa, lukko päälle */
console.log('A) 1. osuma = lamposavy');
S.setStar(S.star()); S.setAim(400, 100); S.clear();
S.fireBeam();
ok('hpLeft 2 -> 1', S.getStar().hpLeft === 1, 'hpLeft=' + S.getStar().hpLeft);
ok('cracked = true', S.getStar().cracked === true);
ok('hitFlash = 10', S.getStar().hitFlash === 10);
ok('meteoriitti ei tuhoutunut', S.getStar().active === true);
ok('laser + kolahtava aani', S.log.join(',') === 'laser,meteorhit', S.log.join(','));
ok('ei kolikkoa', S.coins() === 0);
ok('lukko 60 f', S.cd() === 60, 'cd=' + S.cd());

/* B: lukon aikana ei laukaisua – vain kuiva klikki */
console.log('B) lukko estaa seuraavan laukauksen');
S.clear(); S.setAim(400, 100);
S.fireBeam();
ok('kuiva klikki', S.log.join(',') === 'empty', S.log.join(','));
ok('hpLeft ennallaan 1', S.getStar().hpLeft === 1);
ok('ei uutta laseria', S.log.indexOf('laser') === -1);

/* C: 59 f ei riitä, 60. f vapauttaa */
console.log('C) lukon kesto');
for (let i = 0; i < 59; i++) S.tick(1);
ok('59 f -> yha lukossa', S.cd() > 0 && S.beamCanFire() === false, 'cd=' + S.cd());
S.tick(1);
ok('60 f -> valmis', S.cd() <= 0 && S.beamCanFire() === true, 'cd=' + S.cd());

/* D: tappava osuma = tuhoutuminen + kolikko + pling */
console.log('D) 2. osuma tuhoaa ja palkitsee');
S.clear(); S.setAim(400, 100);
S.fireBeam();
ok('hpLeft 0', S.getStar().hpLeft === 0);
ok('meteoriitti tuhoutui', S.getStar().active === false);
ok('kolikko +1', S.coins() === 1);
ok('laser + pling (ei meteorhit)', S.log.join(',') === 'laser,coin', S.log.join(','));
ok('lukko paalle myos tappavasta', S.cd() === 60);

/* E: huti maksaa saman kuin osuma */
console.log('E) huti = yhta kallis');
S.setStar(S.star()); S.tick(200); S.setAim(60, 40); S.clear();
S.fireBeam();
ok('lukko paalle hudista', S.cd() === 60, 'cd=' + S.cd());
ok('hpLeft ennallaan 2', S.getStar().hpLeft === 2);
ok('vain laser-aani', S.log.join(',') === 'laser', S.log.join(','));
S.clear(); S.fireBeam();
ok('hudin jalkeen lukossa', S.log.join(',') === 'empty', S.log.join(','));

/* F: talon takana oleva meteoriitti nielee laukauksen (ei vahinkoa) */
console.log('F) talon takana = laukaus menee hukkaan');
S.setStar(S.star({ x: 40, y: 250 })); S.tick(200); S.setAim(40, 250); S.clear();
ok('meteoriitti on talon sisalla', S.beamCanFire() === true);
S.fireBeam();
ok('lukko paalle', S.cd() === 60);
ok('ei vahinkoa (hpLeft 2)', S.getStar().hpLeft === 2);
ok('ei kolahtavaa aanta', S.log.join(',') === 'laser', S.log.join(','));

/* G: kuiva klikki EI soi, kun syy on jokin muu kuin lukko */
console.log('G) paivalla / vaarinpain ei kuivaa klikkia');
S.setStar(S.star()); S.tick(80); S.clear();
S.setDay(1); S.fireBeam();
ok('paivalla hiljaista', S.log.length === 0, S.log.join(','));
S.setDay(0); S.setFacing(1); S.clear();   // vx = +0.5 -> kasvot vaaraan suuntaan
S.fireBeam();
ok('vaarinpain hiljaista', S.log.length === 0, S.log.join(','));
ok('kumpikaan ei asettanut lukkoa', S.cd() <= 0, 'cd=' + S.cd());

/* H: saantomien tarkistus */
console.log('H) saannot ennallaan');
S.setFacing(-1);
ok('beamCanFire() true oikein pain', S.beamCanFire() === true);
S.setStar(null);
ok('ilman meteoriittia ei voi ampua', S.beamCanFire() === false);
/* I: osumaväritys (v11.14b) – pelkkä sävy, ei halkeamia eikä muodonmuutosta */
console.log('I) osuman varit');
{
    const rec = [];
    const grad = { addColorStop: function (p, c) { rec.push('stop:' + c); } };
    const ctxStub = new Proxy({}, {
        get: function (t, k) {
            if (k === 'createRadialGradient') return function () { return grad; };
            if (k === 'arc') return function (x, y, r) { rec.push('arc:' + r); };
            if (k === 'stroke') return function () { rec.push('stroke()'); };
            if (k === 'moveTo' || k === 'lineTo' || k === 'beginPath' || k === 'fill' ||
                k === 'save' || k === 'restore' || k === 'closePath') return function () {};
            if (k in t) return t[k];
            return function () {};
        },
        set: function (t, k, v) { t[k] = v; rec.push(k + '=' + v); return true; }
    });
    const draw = new Function('ctx', 'shootingStar', extract('drawMeteorite') +
        '\nreturn function (star) { shootingStar = star; return drawMeteorite(); };');
    const renderMeteor = draw(ctxStub, null);
    const trail = [{ x: 395, y: 95 }, { x: 398, y: 97 }];

    rec.length = 0;
    renderMeteor(S.star({ trail: trail, cracked: false, hitFlash: 0, life: 20 }));
    const healthy = rec.slice();
    ok('terve: ydin jaanvalkoinen #f4f8ff', healthy.indexOf('fillStyle=#f4f8ff') >= 0, healthy.join('|'));
    ok('terve: vana kylma 205,220,245', healthy.some(function (c) { return c.indexOf('fillStyle=rgba(205,220,245,') === 0; }));
    ok('terve: ei halkeamia (0 stroke()ia)', healthy.indexOf('stroke()') < 0, healthy.join('|'));

    rec.length = 0;
    renderMeteor(S.star({ trail: trail, cracked: true, hitFlash: 0, life: 20 }));
    const hurt = rec.slice();
    ok('osuma: ydin oranssi #ffa030', hurt.indexOf('fillStyle=#ffa030') >= 0, hurt.join('|'));
    ok('osuma: vana lammas 255,155,50', hurt.some(function (c) { return c.indexOf('fillStyle=rgba(255,155,50,') === 0; }));
    ok('osuma: hehku lammas 255,180,60', hurt.some(function (c) { return c.indexOf('stop:rgba(255,180,60,') === 0; }));
    ok('osuma: ei halkeamia (0 stroke()ia)', hurt.indexOf('stroke()') < 0, hurt.join('|'));
    ok('osuma: ei tummaa strokeStylea', !hurt.some(function (c) { return c.indexOf('strokeStyle=') === 0; }), hurt.join('|'));
    ok('osuma: vana ja hehku ei kylmia sawoja',
        !hurt.some(function (c) { return c.indexOf('205,220,245') >= 0 || c.indexOf('240,246,255') >= 0; }), hurt.join('|'));
    const geo = function (a) { return a.filter(function (c) { return c.indexOf('arc:') === 0; }).join(','); };
    ok('muoto/syke identtinen (vain vari vaihtui)', geo(healthy) === geo(hurt), geo(healthy) + ' vs ' + geo(hurt));

    rec.length = 0;
    renderMeteor(S.star({ trail: trail, cracked: true, hitFlash: 10, life: 20 }));
    ok('valahdys lämmin eika valkoinen',
        rec.some(function (c) { return c.indexOf('fillStyle=rgba(255,214,160,') === 0; }) &&
        !rec.some(function (c) { return c.indexOf('fillStyle=rgba(255,255,255,') === 0; }), rec.join('|'));
}
console.log('');
console.log('TULOS: ' + pass + ' OK / ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
