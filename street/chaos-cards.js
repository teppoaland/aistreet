/* ═══════════════════════════════════════════════════════════
   street/chaos-cards.js – K7-tapahtumakortit (vain visuaalisia)
   (Vaihe 5 osa 5, v11.38 – siirretty street.js:stä, PELKKÄ SIIRTO.)

   Sisältö: korttipakan tila (`cardState`) + ajastin (`updateCards`),
   reset (`chaosCardsReset`) ja 10 korttidefiä (`chaosCardDefs`:
   värihetki, tähtisade, sumu, tuulenpuuska, valot sammuvat, ikkunat,
   eläinparaati, paletti, taivas, tähdet) sekä `cardFlashWindows`.
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
   lightsOut · animalParade · consumeAnimalParade · defs · setForcedCard.

   Testikytkin (ei tallenna): `?card=<id>` pitää yhden kortin päällä
   loputtomiin → jokainen kortti on helppo katsoa yksi kerrallaan.
   Id:t: green · meteor · fog · gust · blackout · windows · parade ·
   palette · sky · stars.

   Ladataan ENNEN street.js:iä (index.html). Testipenkit liittävät samat
   osat samassa järjestyksessä: tools/tests/street-src.cjs.
   ═══════════════════════════════════════════════════════════ */
var StreetChaosCards = (function () {
    /* ── Sidottu host (street.js asettaa bind():llä) ── */
    let H = null;
    function bind(host) { H = host; }

    /* ── Testikytkin (ei tallenna mihinkään, kuten ?day / ?hole / ?cabs) ──
       `?card=<id>` pitää yhden kortin päällä loputtomiin → jokaisen kortin
       voi katsoa yksi kerrallaan ilman 60 s odotusta eikä tarvitse arvata,
       mikä ruudulla on korteista. Id:t: green · meteor · fog · gust ·
       blackout · windows · parade · palette · sky · stars.
       Ilman parametria tämä ei muuta mitään (forceCard = null). */
    let forceCard = null;
    function setForcedCard(id) {
        const next = (typeof id === 'string' && id) ? id : null;
        if (next === forceCard) return;
        forceCard = next;
        if (cardState.active) { cardState.active.restore(cardState.active.saved); cardState.active = null; }
    }

    /* ═══════════════════════════════════════════════════════════
       KAAOS K7 – tapahtumakortit (v10.05)
       v1 = vain visuaalisia. Kortit laukeavat itsestään kesken
       session ja palautuvat itsestään. Ei vahinkoa, ei taloutta,
       ei uutta tekstiä. NORMALissa pois päältä (bitti-identtinen).
       ═══════════════════════════════════════════════════════════ */
    const CARD_FIRST_DELAY = 3600;                       // 60 s ennen ensimmäistä korttia
    const CARD_GAP_MIN = 5400, CARD_GAP_MAX = 18000;     // 90–300 s korttien välillä
    let cardState = {
        enabled: false,
        timer: CARD_FIRST_DELAY,        // frameä seuraavaan korttiin
        left: 0,                        // kortteja jäljellä tässä sessiossa
        active: null,                   // { id, t, dur, saved, restore }
        meteorBurst: false,             // Tähtisade
        lightsOut: false,               // Valot sammuvat
        animalParade: 0                 // Eläinparaati: montako eläintä vielä
    };

    function chaosCardsReset() {
        cardState.enabled = H.anyChaos;
        cardState.timer = CARD_FIRST_DELAY;
        cardState.left = H.anyChaos ? (3 + Math.floor(H.rng() * 4)) : 0; // 3–6
        cardState.active = null;
        cardState.meteorBurst = false;
        cardState.lightsOut = false;
        cardState.animalParade = 0;
    }

    // Korttidekit: save() kaappaa tilan, apply() aloittaa, restore(saved) palauttaa.
    function chaosCardDefs() {
        const skyPresets = [
            { sun: '#7dff7d', glow: ['rgba(120,255,120,0.55)','rgba(90,220,90,0.20)','rgba(70,180,70,0)'], top: '#2f5a2f', mid: '#4f7a4f', hor: '#7a9a6a' },
            { sun: '#d37dff', glow: ['rgba(200,140,255,0.55)','rgba(170,110,230,0.20)','rgba(140,90,190,0)'], top: '#4a2f5a', mid: '#6a4f7a', hor: '#8a6a9a' },
            { sun: '#ff4d4d', glow: ['rgba(255,100,100,0.55)','rgba(220,80,80,0.20)','rgba(180,60,60,0)'], top: '#5a2f2f', mid: '#7a4f4f', hor: '#9a6a6a' }
        ];
        return [
            {   // 1. Vihreä hetki ⭐ – auringon väri + taivaan sävy
                id: 'green', dur: [1200, 2400],
                save: () => ({ sun: H.state.sunColor, glow: H.state.sunGlow, top: H.state.daySkyTop, mid: H.state.daySkyMid, hor: H.state.daySkyHor }),
                apply: () => { const p = skyPresets[Math.floor(Math.random() * skyPresets.length)]; H.state.sunColor = p.sun; H.state.sunGlow = p.glow; H.state.daySkyTop = p.top; H.state.daySkyMid = p.mid; H.state.daySkyHor = p.hor; },
                restore: (s) => { H.state.sunColor = s.sun; H.state.sunGlow = s.glow; H.state.daySkyTop = s.top; H.state.daySkyMid = s.mid; H.state.daySkyHor = s.hor; }
            },
            {   // 2. Tähtisade – 30–60 tähdenlentoa lyhyessä ajassa
                id: 'meteor', dur: [360, 600],
                save: () => ({}),
                apply: () => { cardState.meteorBurst = true; },
                restore: () => { cardState.meteorBurst = false; }
            },
            {   // 3. Sumu nousee – sumuverho α 0.25–0.45
                id: 'fog', dur: [1800, 3600],
                save: () => ({ fog: H.state.fogAlpha }),
                apply: () => { H.state.fogAlpha = 0.25 + Math.random() * 0.20; },
                restore: (s) => { H.state.fogAlpha = s.fog; }
            },
            {   // 4. Tuulenpuuska – tuuli ×2–3, puut nojaavat
                id: 'gust', dur: [900, 1800],
                save: () => ({ wind: H.state.windSpeed }),
                apply: () => { H.state.windSpeed *= 2 + Math.random(); },
                restore: (s) => { H.state.windSpeed = s.wind; }
            },
            {   // 5. Valot sammuvat – lamput + ikkunat pimeiksi hetkeksi
                id: 'blackout', dur: [240, 480],
                save: () => ({}),
                apply: () => { cardState.lightsOut = true; },
                restore: () => { cardState.lightsOut = false; }
            },
            {   // 6. Kaikki ikkunat syttyvät – 8–12 ikkunaa kerralla (raja 12)
                id: 'windows', dur: [1200, 1800],
                save: () => ({}),
                apply: () => { cardFlashWindows(8 + Math.floor(Math.random() * 5)); },
                restore: () => {}
            },
            {   // 7. Eläinparaati – 3–5 eläintä peräkkäin
                id: 'parade', dur: [600, 1200],
                save: () => ({}),
                apply: () => { cardState.animalParade = 3 + Math.floor(Math.random() * 3); H.state.animalSpawnTimer = 0; },
                restore: () => { cardState.animalParade = 0; }
            },
            {   // 8. Värien vaihto – talojen paletti sekoittuu (pysyvä)
                id: 'palette', dur: [0, 0],
                save: () => ({}),
                apply: () => { H.state.buildingPalette = H.fx.randomHuePalette(); H.fx.randomizeBuildingColors(); },
                restore: () => {}
            },
            {   // 9. Taivaan vaihto – päivätaivas hetkeksi myrskyiseksi
                id: 'sky', dur: [1800, 3600],
                save: () => ({ top: H.state.daySkyTop, mid: H.state.daySkyMid, hor: H.state.daySkyHor }),
                apply: () => { H.state.daySkyTop = '#3a4044'; H.state.daySkyMid = '#565e62'; H.state.daySkyHor = '#6e6a5e'; },
                restore: (s) => { H.state.daySkyTop = s.top; H.state.daySkyMid = s.mid; H.state.daySkyHor = s.hor; }
            },
            {   // 10. Tähtitaivas täyteen – tähdet 80 → 140
                id: 'stars', dur: [1200, 2400],
                save: () => ({}),
                apply: () => { const add = Math.max(0, 140 - H.state.stars.length); for (let i = 0; i < add; i++) H.state.stars.push({ x: Math.random() * H.consts.WORLD_W, y: Math.random() * (H.consts.GROUND_Y - 30), r: (Math.random() * 1.5 + 0.5) * H.state.starSizeMult, blink: Math.random() * Math.PI * 2 }); },
                restore: () => { if (H.state.stars.length > H.state.starCount) H.state.stars.length = H.state.starCount; }
            }
        ];
    }

    function cardFlashWindows(count) {
        const avail = H.fx.getAvailableWindows().filter(w =>
            !H.state.litWindows.some(l => l.wx === w.wx && l.wy === w.wy && l.bldgIdx === w.bldgIdx));
        const n = Math.max(0, Math.min(count, avail.length, 12 - H.state.litWindows.length));
        for (let i = 0; i < n; i++) {
            const w = avail[Math.floor(Math.random() * avail.length)];
            H.state.litWindows.push({ wx: w.wx, wy: w.wy, bldgIdx: w.bldgIdx, offTime: Date.now() + 15000, colorType: H.fx.pickColorType() });
        }
    }

    function updateCards(dt) {
        /* Testikytkin ?card=<id>: pidä valittu kortti päällä loputtomiin.
           Ilman parametria forceCard = null → tämä haara ei tee mitään. */
        if (forceCard) {
            if (cardState.active && cardState.active.id === forceCard) return;
            if (cardState.active) { cardState.active.restore(cardState.active.saved); cardState.active = null; }
            const forced = chaosCardDefs().find((x) => x.id === forceCard);
            if (!forced) return;
            const savedF = forced.save();
            forced.apply();
            cardState.active = { id: forced.id, t: 0, dur: Infinity, saved: savedF, restore: forced.restore };
            return;
        }
        if (!cardState.enabled) return;
        // Aktiivinen kortti käynnissä → tikitä ja palauta, kun aika täynnä
        if (cardState.active) {
            cardState.active.t += dt;
            if (cardState.active.t >= cardState.active.dur) {
                cardState.active.restore(cardState.active.saved);
                cardState.active = null;
                cardState.timer = CARD_GAP_MIN + Math.random() * (CARD_GAP_MAX - CARD_GAP_MIN);
            }
            return;
        }
        // Odotetaan seuraavaa korttia
        if (cardState.left <= 0) return;
        cardState.timer -= dt;
        if (cardState.timer <= 0) {
            const defs = chaosCardDefs();
            const d = defs[Math.floor(Math.random() * defs.length)];
            const dur = d.dur[0] + Math.random() * (d.dur[1] - d.dur[0]);
            const saved = d.save();
            d.apply();
            cardState.active = { id: d.id, t: 0, dur: dur, saved: saved, restore: d.restore };
            cardState.left--;
        }
    }

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
