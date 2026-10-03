# 🔧 tools/refactor – mekaaninen pilkontatyökalu

## extract.cjs

Siirtää valitut **rivivälit omiksi funktioikseen** saman IIFE:n sisällä. Työkalu tekee
**pelkän siirron**: koodirivejä ei muuteta, ei uudelleenmuotoilla eikä nimetä uudelleen
(paitsi valinnainen `return;` → `return true;` -muunnos, jolla varhaisten `return`ien
semantiikka säilyy, kun lohko siirtyy omaksi funktioksi).

```bat
node tools/refactor/extract.cjs tools/refactor/plan-render.json
```

### Miksi näin

`street.js` on ~11 000 riviä ja yksi IIFE, jossa ~200 closure-muuttujaa. Osien jakaminen
omiin tiedostoihin vaatisi ensin tilan ryhmittelyn (Vaihe 4). Siksi Vaihe 1 tehdään
**tiedoston sisällä**: pitkät funktiot pilkotaan, mutta nimet, järjestys, export-rivi ja
kaikki lähdetekstiin kohdistuvat testikytkennät säilyvät.

### Suunnitelman muoto (JSON)

```json
{
  "file": "d:/AI/AI_street/street.js",
  "anchor": "    function render() {",
  "entries": [
    { "start": 5792, "end": 5799, "name": "drawRoomView", "bool": true,
      "params": "", "expectFirst": "if (sleepRoom) {",
      "call": "if (drawRoomView()) return;", "comment": "…" }
  ]
}
```

- `anchor` – funktiot lisätään ennen tätä riviä (sama IIFE).
- `start`/`end` – **alkuperäisen** tiedoston rivinumerot (1-based, sisältäen).
- `expectFirst` – varmistus: rivin `start` on alettava tällä. Jos ei täsmää, **tiedostoa ei kirjoiteta**.
- `call` – korvaava kutsurivi; jää samalle sisennykselle kuin lohkon ensimmäinen rivi.
- `bool: true` – kaikki lohkon `return;` → `return true;` + loppuun `return false;`
  (käytetään, kun lohko on muotoa `if (tila) { … return; }` ja kutsuja on
  `if (fn()) return;`). **Vain blokeille, joissa ei ole sisäkkäisiä funktioita eikä
  merkkijonoja, jotka sisältävät `return;`.**
- `params` – funktion parametrit (esim. `"dt"`, `"px, py"`).

Blokit käsitellään **alhaalta ylöspäin**, joten rivinumerot pysyvät voimassa yhden ajon ajan.
Ajon jälkeen: `node --check street.js` ja `node tools/tests/run-all.cjs`.

## Tehdyt jaot (v11.38)

| Suunnitelma | Kohde | Tulos |
|---|---|---|
| `plan-render.json` | `render()` 428 rv | 10 piirtofunktiota → `render()` 143 rv |
| `plan-handleaction.json` | `handleAction()` 226 rv | `tryNewspaper`, `tryFruitDoor`, `tryJukeboxDoor`, `trySinkshipDoor`, `tryDoorsAndKicks` → 14 rv |
| `plan-update-rooms.json` | `update()` huoneosuus 263 rv | `updateSleepRoom`, `updateBarRoom`, `updateJukeboxRoom`, `updateNewsRoom`, `updateKnockedDown` → `update()` 861 rv |
| `plan-update-street.json` | `update()` katuosuus 799 rv | 23 funktiota (`updateDayNight`, `updateMovement`, `updateCoinPickup/-Timers`, `updateSky`, `updateBirds`, `updateEnemies`, `updateAnimal`, `updateStreetTimers`, …) → **`update()` 85 rv** |

## Vaiheet 1–3 valmiit (v11.38)

| Mittari | Ennen | Jälkeen |
|---|---|---|
| `update()` | 1119 rv | **85 rv** (28 funktiota) |
| `render()` | 428 rv | **143 rv** (10 funktiota) |
| `handleAction()` | 226 rv | **14 rv** (5 funktiota) |
| Suorin `chaosLevel === '…'` -tarkistus | 27 kpl ympäri tiedostoa | **0** (kaikki `chaosFlags`-lippuina, johdetaan `applyChaosProfile`issa) |
| `createOscillator`-kohtia (SFX) | 11 | **4** (3 moottorin kerrosta + `sfxTone`-apuri itse) |
| Huoneen elinkaari | 3 erillistä if-ketjua (`update()`, `drawRoomView()`, `closeRoom()`) | **1 rekisteri** (`rooms[]`) |

**Vaihe 2 toteutus:**
- `chaosFlags` (11 lippua: `beer`, `drunk`, `beamWeapon`, `meteorAlways`, `meteorKill`,
  `meteorHalf`, `badDemo`, `badFinale`, `ruin`, `mosquitoes`, `anyChaos`) + `applyChaosFlags()`,
  jota kutsutaan aina `applyChaosProfile`ista → F5-palautus ja `?chaos=` päivittyvät.
- `sfxTone({ freq, freqTo?, dur, type?, vol?, delay? })` – yksi oskillaattori + gain-envelope
  ja yhteinen `initAudio`-vahti. Muunnetut äänet: `playCoin`, `playBeamEmpty`, `playLaser`,
  `playKnock` (oskillaattoriosa), `playZap` (oskillaattoriosa), `playMeteorHit` (runko),
  `playLampOn` (humahdus). Kohina- ja moottoriäänet pysyvät käsinrakennettuina.

**Vaihe 3 toteutus:**
- **`rooms[]`-rekisteri** (4 huonetta: sleep, bar, jukebox, news) rajapinnalla
  `{ name, isOpen(), update(dt), draw(), close() }`. Kaikki kolme kutsupaikkaa ovat nyt silmukoita:
  `update()` → `for (const room of rooms) if (room.update(dt)) return;` ·
  `drawRoomView()` → sama silmukka (`isOpen()` + kamera + `room.draw()`) ·
  `closeRoom()` → `for (const room of rooms) if (room.isOpen() && room.close()) return true;`
- `closeRoom()`:n neljä haaraa siirrettiin omiksi `closeSleepRoom()/closeBarRoom()/
  closeJukeboxRoom()/closeNewsRoom()`-funktioiksi (24 rv).
- **Suunnittelupäätös:** oven avaaminen (potku, valot, avaimet) **ei** kuulu rekisteriin –
  jokainen ovi on oma `tryXxxDoor()`-funktionsa, koska porttilogiikka on ovikohtaista
  (lamppu/avain/yö). Rekisteri kattaa huoneen elinkaaren, ei sisäänkäyntiä.
- **Testikattavuus:** `street-render-smoke-test` laajennettiin: avaa jokainen huone ja
  varmistaa, että `closeRoom()` sulkee sen (ja palauttaa `false`, kun mikään ei ole auki) → 30/30.

## Vaihe 4 – tilan ryhmittely olioiksi (osittain, v11.38)

Tavoite: hajallaan olevat `let`-muuttujat aiheittain olioiksi → nollaus/tallennus yhteen
paikkaan. **Toteutettu ne domainit, joissa hyöty on aito eikä riski kasva turhaan:**

| Domain | Ennen | Jälkeen | Penkkikytkennät |
|---|---|---|---|
| **kaivo** | `manholeOpen`, `mhInside`, `mhAction` (3 irtamuuttujaa 22 viittauksessa) | `manhole = { open, inside, action, reset() }` – `rollManholeState()` käyttää `manhole.reset()` | 3 penkkiä (hookit päivitetty) |
| **kolikko** | `coinRespawnTimer` irrallaan + `coinCheatStreak/GapTimer/Cooldown` (3 irtamuuttujaa) | `coin.respawnTimer` (coin-olioon) ja `coinCheat = { streak, gapTimer, cooldown, reset() }` | **ei yhtään** |
| **rosvo** | – | ei muutosta: `robber` on jo olio; jäljellä on vain `robberCooldown`, joka **ei** voi asua samassa oliossa (robber on `null` juuri cooldownin aikana) | – |

### Miksi loput jätettiin (mitattu, ei arvattu)

| Domain | Viittauksia | Miksi ei nyt |
|---|---|---|
| päivä/yö (`dayT`, `isDay`, `cycleChangeTimer`, `moonClock`, `sunClock`, `nightShowArmed`, `spawnLampTimer`) | **141** + 6 deklaraatiokohtaa | `isDay` lomittuu tallennettuun `state.isDay`:hin (eri asia, ei saa nimetä uudelleen) ja 4 penkkiä injektoi `dayT`-hookit. Vaatii oman vaiheensa + huolellisen `(?<![\w.$])`-rajauksen. |
| huoneet (`sleep*`, `bar*`, `juke*`, `news*`) | **469** | Suurin; kannattaa tehdä vasta kun huoneet siirretään omiin tiedostoihin (Vaihe 5), jolloin ryhmittely maksaa itsensä takaisin. |
| talous (`coinCount`, `hamburgerCount`, `drunkLevel`, `hamburgerTimer`) | **149** | Eniten penkkikytkentöjä (drunk 48, bm-key 19, meteor-coin 16, knockdown 17). Pelkkä uudelleennimeäminen ei tuo toiminnallista hyötyä ja osuu sääntö 04:n ydinalueeseen → **suositus: jätä ennalleen.** |

**Periaate jatkoon:** domain kerrallaan, aina yksi ajo `run-all.cjs` + `chaos-normal-check` +
`street-render-smoke-test` välissä. Ryhmittely ilman tiedostojakoa on kosmeettista – tee se
samassa yhteydessä kuin osia siirretään omiin tiedostoihin.

**Vaiheen 4 tulos:** 2 domainia ryhmitelty (kaivo, kolikko) + 6 irtamuuttujaa poistettu
tuotannosta. Testit: NORMAL 78 avainta / 0 eroa · render-smoke 30/30 · 22 penkkiä
16 puhdasta / 6 = sama kuin baseline. Versio pysyy **v11.38** (sama julkaisematon refaktorointi).


## Vaihe 5 – tiedostojako (osat 1–7 tehty, v11.42)

**Ratkaiseva rajoite:** koko peli on yhdessä IIFE-closuressa (~200 tilamuuttujaa). Sulkeuman
yli ei voi siirtää koodia tiedostosta toiseen ilman joko (a) tilan ryhmittelyä (Vaihe 4) tai
(b) rakennusvaihetta (ei käytössä). Siksi jako aloitettiin siitä, mikä on **aidosti
tilariippumatonta**.

### Tehdyt osat

| Tiedosto | Rivit | Sisältö | Sidottavat |
|---|---|---|---|
| `street/chaos-config.js` | 455 rv (399 siirretty) | `CHAOS_DEFAULTS/-DEFAULTS2`, `?seed=`-arvonta (`makeRng`/`chaosRng`/`rnd`/`rndInt`), K1-paletit ja -arvonnat, `generateFullChaosSeed`, `chaosProfile`, kaavat (`clamp`, `chaosAbilityFor`, `stunMaxOf`, `burgerIntervalMin`, `threatSpeedMax/TelegraphMin`, `threatBudget`), portti (`clampChaosCfg`, `validateChaosCfg`) ja `drawChaosCfg` | `bind({ WORLD_W, hungerMultFor })` |
| `street/sfx.js` | 383 rv (344 siirretty) | `initAudio`, `sfxTone` + kaikki kadun SFX:it (potku, askel, kolikko, tömähdys, sähköisku, laser, meteoriitti, romahdus, tyhjä laukaus, katuvalo) ja ajoneuvon moottoriääni (start/update/stop) | `bind({ WORLD_W })` + `setVolume()` (SFX-taso K6) |
| `street/news.js` | 494 rv (438 siirretty) | lehden sisältödata (`NEWSPAPER_PAGES` + `NEWS_MANUAL_WIDE/-NARROW`), `wrapNewsText`, `fitNewsFont`, `newsLayout` (+ välimuisti), kadun lehti (`drawNewspaper`), poimintavihje (`drawNewspaperHint`) ja koko ruudun näkymä (`drawNewspaperView`) | `bind(host)`: live-getterit `ctx/canvas/viewW/foreground/player/vehicles/newsRoom/iframeOpen` + `WORLD_W/WORLD_H/VIEWW_MIN`; oma tila `screen`/`cache` API:n takana (`layout/index/next/prev/reset/near/drawOnStreet/drawHint/drawView`) |
| `street/traffic.js` | 668 rv (248 + 124 siirrettyä) | **piirto + logiikka:** `drawVehicle(v)` (auto, mopo+kuski, ambulanssi, panssarivaunu + ajovalokiila) **ja `updateTraffic(dt, playerSafe)`** (spawnit, liike, törmäys → tainnutus). Osa 4 = pelkkä piirto; **osa 7 lisäsi logiikan samaan moduuliin.** Kadun tila (`playerSafe`, huoneet) lasketaan yhä street.js:ssä | `bind(host)` (**nimi `H`**, tarkistettu ettei lohko määrittele paikallista `H`:ta): `ctx` · `dayT` · `VEHICLE_HEADLIGHT_DIM` · `vehicles` · `spawnTimers` · `player` · `vehicleShakeTimer` (get+set) · `trafficSpeedMult` · `trafficSpawnMult` · **`PLAYER_DEPTH_MAX_Y` (getteri! – määritelty vasta rivillä ~8023 → TDZ jos arvona)** · `LANE_DEFS` · `TRAFFIC_DAY_MULT` · `chaosAllGone` · `spawnParticles` · `collisionCost` · `H.sfx.*` (playKnock + moottorin start/update/stop). API: `drawVehicle` · `update` |
| `street/chaos-cards.js` | 213 rv (134 siirretty) | **K7-korttipakka:** `cardState` (enabled/timer/left/active/meteorBurst/lightsOut/animalParade), `CARD_*`-vakiot, `chaosCardsReset`, `chaosCardDefs` (10 korttia), `cardFlashWindows`, `updateCards`. **Testikytkin `?card=<id>`** pitää yhden kortin päällä (0 → ei muuta mitään) | `bind(host)`: **get+set -parit** 12 tilamuuttujalle (`sunColor`, `sunGlow`, `daySkyTop/Mid/Hor`, `fogAlpha`, `windSpeed`, `buildingPalette`, `animalSpawnTimer`, `starCount`, `starSizeMult`) + taulukko-getterit (`stars`, `litWindows`) + `H.anyChaos`, `H.rng`, `H.consts`, `H.fx`. API: `reset/update/meteorBurst/lightsOut/animalParade/consumeAnimalParade/defs/setForcedCard` |
| `street/rooms.js` | 1053 rv (1013 siirretty) | **huoneiden piirto:** `drawSleepRoom` (sänky + Nuku/Poistu + Zzz-pimennys), `drawJukeboxRoom` + `drawJukeboxCabinet`, `drawBarRoom` + `drawBarBeer` **sekä BAR-taulun kuva-tila** (`BAR_PIC_SRC`/`barPic`/`barPicReady` – ei käytetä muualla, joten ne siirtyivät mukana). Huoneiden tila ja syöttölogiikka (`updateXxxRoom`, `closeXxxRoom`, oven avaus) ovat yhä street.js:ssä | `bind(host)` (**host-nimi `ENV`**, ks. ansa alla): live-getterit `ctx/canvas/viewW/camX/isDay/coinCount/hamburgerCount/drunkLevel/barBuyQty/jukeQueue/jukePick/jukeSel/jukeCovers/sleepPhase/sleepSel` + `chaosFlags`-olio + vakiot `WORLD_W/WORLD_H/VIEWW_MIN/GROUND_Y/JUKEBOX_TRACKS/SLEEP_*/DRUNK_MAX/BAR_BEER_H`. API: `drawSleep/drawJukebox/drawBar` |

**⚠️ Ansa, joka löytyi osassa 6 (opi tästä):** moduulin host-muuttujan nimi **ei saa törmätä siirrettävän koodin paikallisiin nimiin**. Huonepiirto käyttää joka funktiossa `const W = WORLD_W, H = WORLD_H;` → host-nimi `H` varjostui ja koodi kaatui (`Cannot access 'H' before initialization`, TDZ). Ratkaisu: host-nimeksi **`ENV`**. Jatkossa: tarkista siirrettävästä koodista sen omat `const/let`-nimet ennen host-nimen valintaa.

**⚠️ Ansa 2, joka löytyi osassa 7:** **tiedoston lopussa määritelty `const` on sidottava getterinä.** `updateTraffic` lukee `PLAYER_DEPTH_MAX_Y`ia, joka on määritelty vasta rivillä ~8023 (funktion jälkeen) → arvona sidottuna bind kaatuisi TDZ:hen. Sääntö: **mikä tahansa nimeä, joka on määritelty bind-kohdan jälkeen tai jota mutatoidaan, on sidottava getterinä.**

**Mekanismi (ei buildia, klassiset scriptit kuten `digGame1`):**
1. Osat ovat `var StreetXxx = (function () { … })();` – paljastavat nimensä.
2. `index.html` lataa osat **ennen** `street.js`iä, kukin omalla `<script>`-rivillä + `?v=`-leimalla.
3. `street.js` tuhoaa siirretyt kohdat ja ottaa nimet käyttöön
   `const { … } = StreetXxx;`-destrukturoinnilla → **kutsuva koodi ei muutu**.
4. Moduulit eivät tunne pelitilaa: tarvittavat asiat sidotaan (`bind`) tai asetetaan
   (`StreetSfx.setVolume(chaosCfg.sfxVolumeMult)` kaaosprofiilin sovelluksessa).
   **Osat 3–7 (`news.js`, `traffic.js`, `chaos-cards.js`, `rooms.js`) käyttävät `bind(host)`-rajapintaa.**
   Piirto-osa tarvitsee vain **live-getterit** (`get ctx() { return ctx; }` …) → arvot (esim.
   `viewW` resizessä, `ctx` initissä, `dayT` päivä/yö-syklin mukana) pysyvät ajan tasalla ilman
   erillistä synkronointia. Kun siirrettävä koodi **mutatoi** pelitilaa (korttien `save/restore`,
   liikennologiikka) sidotaan **get+set -parit** – sama olio kuin ennen, joten kutsuva koodi ja
   `applyChaosProfile` näkevät muutokset ilman synkronointia. **Valitse aina ensin se osa, joka on
   puhdasta piirtoa/lukua; ota get+set käyttöön vasta kun mutaatio on pakko siirtää.**
5. `tools/tests/street-src.cjs`:n `PARTS`-lista liittää osat samassa järjestyksessä →
   **penkit saavat saman kokonaisuuden kuin selain**.

**Siirtotyökalut (repossa, ajetaan kerran – tarkistavat `expectFirst`-rivin ja
keskeyttävät ennen kirjoitusta, jos yksikin varmistus pettää):**
`extract.cjs` + `plan-*.json` (Vaihe 1, tiedoston sisäinen pilkonta) ·
`split-news.cjs` (Vaihe 5 osa 3, sanomalehti) · `split-vehicle.cjs` (Vaihe 5 osa 4, ajoneuvon piirto) ·
`split-cards.cjs` (Vaihe 5 osa 5, K7-kaaoskortit) · `split-rooms.cjs` (Vaihe 5 osa 6, huoneiden piirto) ·
`split-traffic-logic.cjs` (Vaihe 5 osa 7, liikennologiikka samaan moduuliin).

**Tulos:** `street.js` 11 169 → **8 622 rv** (osat 1–7) · NORMAL 78 avainta / 0 eroa ·
render-smoke 30/30 · **24 penkkiä 18 puhdasta / 6 = sama kuin baseline**.

### Jäljellä (miksi ei vielä)

Seuraavat osat ovat kiinni pelitilassa, joten ne vaativat **ensin** kyseisen domainin
ryhmittelyn (Vaihe 4). Suositeltu järjestys ja miksi:

| Osio | Rivit | Estävä tila |
|---|---|---|
| Huoneiden **logiikka** (`updateXxxRoom`, `closeXxxRoom`, ovet) | ~600 | `barRoom`/`jukeboxRoom`/`sleepRoom` + ~15 apumuuttujaa (469 viittausta) – pelitilaa, ei piirtoa |
| Tilan ryhmittely (Vaihe 4 loppuun) | – | päivä/yö 141 + talous 149 viittausta (ks. Vaihe 4 -taulukko) |

> ✅ **Liikenteen logiikka poistui listalta** (Vaihe 5 osa 7): `updateTraffic` (spawnit, liike,
> törmäys → tainnutus) siirrettiin `street/traffic.js`:ään piirron seuraksi; kadun tila
> (`playerSafe`, huoneet) lasketaan yhä street.js:ssä.
> ✅ **Huoneiden piirto poistui listalta** (Vaihe 5 osa 6): makuuhuone + jukebox + BAR
> (1013 rv) siirrettiin `street/rooms.js`:ään. Huoneiden *tila* ja syöttölogiikka jäivät
> street.js:ään – sama malli kuin osissa 3–5.

> ✅ **Kaaoskortit + K1-piirto poistui listalta** (Vaihe 5 osa 5): K7-korttipakka (`cardState`,
> `chaosCardDefs`, `updateCards`) siirrettiin `chaos-cards.js`:ään **get+set -hostilla**.
> K1-piirto (taivas/sumu/tähdet) jäi street.js:ään – se on kytketty päivä/yö-tilaan
> (`dayT`), joka on Vaiheen 4 ryhmittelyä vaativa domain.

> ✅ **Sanomalehden asettelu + piirto poistui listalta** (Vaihe 5 osa 3): pelkkä luku- ja
> piirtopuoli riitti, koska lehden *tila* (`screen`, välimuisti) saatiin moduuliin ja loput
> sidottiin live-gettereillä – syöttölogiikka (`updateNewsRoom`, `openNewspaper`) jäi
> street.js:ään, kuten huoneiden ovilogiikka.
> ✅ **Ajoneuvon piirto poistui listalta** (Vaihe 5 osa 4): `drawVehicle` oli **puhdas funktio**
> (vain `ctx` + `dayT` + `VEHICLE_HEADLIGHT_DIM`), joten koko liikenne-domainia ei tarvinnut
> ryhmitellä – liikennologiikka ja `vehicles`-tila jäivät street.js:ään.

**Nyrkkisääntö:** jokainen uusi tiedosto vaatii (1) `PARTS`-listan päivityksen,
(2) `<script>`-rivin `index.html`:hin samalla `?v=`-leimalla ja (3) täyden penkkiajon.

## Seuraavat vaiheet


3. ✅ **Valmis** – huonerekisteri (`rooms[]`).
4. ◐ **Osittain valmis** – tilan ryhmittely (kaivo + kolikko tehty; katso perustelut yllä).
5. **Tiedostojako** (klassiset `<script>`it + jaettu nimiavaruus, kuten `digGame1`) –
   **vaatii `street-src.cjs`:n päivityksen** (osat järjestyksessä) ja penkkien
   `expectFirst`-tarkistusten läpikäynnin.
6. **Kommenttien versiosiivous** (479 `vNN.NN`-merkintää) → historia `CHANGELOG.md`:hen,
   kommentteihin vain "miksi".

