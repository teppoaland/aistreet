# 📊 BASELINE – pöytäpenkkien tila 2.10.2026 (v11.37 → v11.54 · **kaikki 29 puhdasta 4.10.2026**)

> Tämä tiedosto on **vertailukohta refaktoroinnille**. Penkit siirrettiin `%TEMP%`:ista
> repoon 2.10.2026 (Vaihe 0). Aja aina: `node tools/tests/run-all.cjs`.
> **3.10.2026:** kuusi vanhentunutta odotusta (keltainen tila) korjattiin → **0 löydöstä**
> (ks. viimeinen luku "Penkkivelkä nollattu"). Pelikoodia ei muutettu silloin – **v11.45:ssä**
> (Vaihe 4: päivä/yö-ryhmittely) portti ajettiin uudelleen: **26/26 puhdasta / 0 löydöstä**.
> **4.10.2026 (v11.52):** uusi penkki `street-storm-test` (55/0) BAD-myrskylle + `chaos-normal-check`
> sai yhdeksän uutta no-op-avainta → **28 penkkiä, 28 puhdasta, 0 löydöstä**.
> **4.10.2026 (v11.54):** uusi penkki `street-robber-grace-test` (19/0) rosvon rauhalle + turvasäteelle;
> `street-storm-test` kasvoi 62/0:aan → **29 penkkiä, 29 puhdasta, 0 löydöstä**.
> **4.10.2026 (v11.55):** `street-storm-test` kasvoi 64/0:aan (ukkosen 5 kerrosta + purske 60–180 s)
> → **29 penkkiä, 29 puhdasta, 0 löydöstä**.
> **4.10.2026 (v11.56):** `street-storm-test` kasvoi 68/0:aan (ukkosen viive 0,4–3,0 s + salamointi 5–15 s +
> jyrinä 5–10 kerrosta) → **29 penkkiä, 29 puhdasta, 0 löydöstä**.
> **4.10.2026 (v11.68):** myrsky kaikille tasoille (myös NORMAL) + **sään transitio** (`stormLevel`,
> `STORM_RAMP_FRAMES 300`) + **oma RNG** (`stormRng`); `street-storm-test` kasvoi **77/0**
> → **29 penkkiä, 29 puhdasta, 0 löydöstä**.
> **4.10.2026 (v11.69):** salama alkaa pilvistä (`LIGHTNING_TOP_Y 60`); `street-storm-test` **78/0**
> → **29 penkkiä, 29 puhdasta, 0 löydöstä**.
> **4.10.2026 (v11.70):** uusi saderivi taustasiluetin taakse (`drawRainFar`, z < 0.25) + sade alkaa
> pilvistä (`RAIN_TOP_Y = LIGHTNING_TOP_Y`) + sade vain öisin (`dayNight.t < CLOSED_AT_DAYT`);
> `street-storm-test` **87/0** → **29 penkkiä, 29 puhdasta, 0 löydöstä**.
> **4.10.2026 (v11.71):** tarkennus – pilvistä alkaa **vain takarivi** (`z < 0.5`); eturivi näytön
> yläreunasta (per-pisara `topY = (z < 0.5) ? RAIN_TOP_Y : 0`); `street-storm-test` **89/0**
> → **29 penkkiä, 29 puhdasta, 0 löydöstä**.
> **4.10.2026 (v11.72):** uusi penkki `street-spawn-safe-test` (9/0) – pelaaja ei enää spawnaa
> sähkökaapin kohdalle (spawn-väistö `applyChaosProfile()`issa) → **30 penkkiä, 30 puhdasta, 0 löydöstä**.

## Miten baselinea luetaan

- **Vihreä = 0 löydöstä:** kaikki penkit paitsi alla listatut olivat puhtaita jo ennen
  korjauksia: `chaos-normal-check` (NORMAL bitti-identtinen, 78 avainta),
  `street-traffic-rooms`, `street-knockdown-traffic`, `street-drunk`, `street-chaos-fade`,
  `street-building-collapse`, `street-meteor-aftermath`, `street-meteor-tempo`,
  `street-k2k6k7`, `street-bm-key-reward`, `backdrop-destroy`, `street-fruit`,
  `street-beam-cd-hp` (1 ei-kriittinen huomio), `street-beam-pickup-spawn` (1) sekä
  uudet `street-chaos-cards`, `street-window-lights`, `street-canvas-invariants`,
  `street-rooms-logic`.
- **Keltainen (tunnettu, penkkikohtainen) – POISTUI 3.10.2026:** 7 penkkiä olivat rikki
  **jo ennen** refaktorointia (vanhentuneet odotukset v11.10–v11.31:stä). Kaikki on nyt
  korjattu (ks. viimeinen luku).
- **Sääntö:** koska keltainen tila on poistettu, **mikä tahansa punainen rivi on aito löydös**
  (ei enää "tunnettuja odotuksia").

## Ajo 2.10.2026 (22 penkkiä, 16 puhdasta / 6 löydöstä)

> **Päivitys (3.10.2026, Vaihe 5 osat 3–6 + v11.41):** penkkien määrä on nyt **24** (uudet
> `street-chaos-cards-test`, `street-window-lights-test`) ja tulos **18 puhdasta / 6** – sama
> baseline. Alla oleva taulukko on alkuperäinen 2.10.2026-snapshot, jota täydennettiin.

| Penkki | Tulos | Löydöksiä | Miksi |
|---|---|---|---|
| chaos-normal-check.cjs | ✅ OK | 0 | **kriittinen portti**: NORMAL 78 avainta, 0 eroa |
| street-render-smoke-test.cjs | ✅ OK | 0 | **uusi v11.38**: ajaa oikean `update()`+`render()`-parin (yö, päivä, efektit, 4 huonetta, tainnutus, kuolema, FULL) – 25/25, ei poikkeusta, piirto tapahtui |
| street-traffic-rooms-test.cjs | ✅ OK | 0 | liikenne ei pysähdy huoneissa |
| street-knockdown-traffic-test.cjs | ✅ OK | 0 | tainnutus/kolari ei jäädytä liikennettä |
| street-drunk-test.cjs | ✅ OK | 0 | FULL: olut, humala, ääni- ja talousrajat |
| street-chaos-fade-test.cjs | ✅ OK | 0 | kaaosvalinnan 3 s siirtymä |
| street-building-collapse-test.cjs | ✅ OK | 0 | talon tuhoutuminen + jälkitila |
| street-meteor-aftermath-test.cjs | ✅ OK | 0 | rauniot, ovet, BAD-avaus |
| street-meteor-tempo-test.cjs | ✅ OK | 0 | meteoriittitahti (raja 3,0 → 3,2, ks. alla) |
| street-k2k6k7-test.cjs | ✅ OK | 0 | K2/K6/K7-klampit + NORMAL-identiteetti |
| street-bm-key-reward-test.cjs | ✅ OK | 0 | BM-avaimen palkinto |
| backdrop-destroy-test.cjs | ✅ OK | 0 | taustarivin rauniot (ks. alla korjaus) |
| street-fruit-test.cjs | ✅ OK | 1 | hedelmäpeli-portti (ks. alla) |
| street-beam-cd-hp-test.cjs | ⚠️ OK | 1 | 38 OK / 3 FAIL-korjattu väripalettiin (ks. alla) |
| street-beam-pickup-spawn-test.cjs | ⚠️ OK | 1 | 27 OK, 1 ei-kriittinen huomio |
| street-autohover-test.cjs | ❌ FAIL | 31 | **harness/aikataulu** (ks. alla) |
| street-avenger-test.cjs | ❌ FAIL | 1 | Testi 1: kiinteät frame-määrät eivät osu ovelle |
| street-bad-warning-test.cjs | ❌ FAIL | 1 | ajoitus 5,5 s vs. odotus ~3,9 s (kuormasta riippuva) |
| street-hunger-scope-test.cjs | ❌ FAIL | 3 | T5/T6: huone ei aukea siemenillä 1–30 (vanhentunut reititys) |
| street-jukebox-test.cjs | ❌ FAIL | 27 | **huone ei avaudu harnessissa** → valintarivi puuttuu (vaatii penkin päivityksen) |
| street-manhole-bonus-test.cjs | ❌ FAIL | 3 | arvontakerroin 1/3 → **1/6** (parametrimuutos) + pudotusten määrä |
| street-meteor-coin-test.cjs | ⚠️ vaihtelee | **0–4** | **epävakaa**: BAD-haaran tuhoutuminen heilahtelee ajokerrasta toiseen (OK tässä ajossa) |
| street-chaos-cards-test.cjs | ✅ OK | 0 | **uusi Vaihe 5 osa 5**: kaikkien 10 K7-kortin `save → apply → restore` palauttaa tilan täsmälleen + lippukortit ja `consumeAnimalParade()` |
| street-window-lights-test.cjs | ✅ OK | 0 | **uusi v11.41:** BAD/FULLin `shuffleBuildingOrder()` kylvää ikkunavalot heti (`Math.random` kiinnitetty → deterministinen) |
| street-canvas-invariants-test.cjs | ✅ OK | 0 | **uusi v11.43:** ajaa FULL/NORMALia 420 frameä ja tarkistaa, ettei canvas-kutsuihin mene NaN/undefined/virheellisiä värejä (nappasi kaksi oikeaa bugia, joita stubi ei kaatanut) |
| street-moon-shadow-test.cjs | ✅ OK | 0 | **uusi v11.49:** kuunvarjojen kaaoskerroin (BAD/FULL ×1–3 per talo, kerran per yö) – ajaa oikean `init()`in ja `drawMoonBuildingShadows()`in, todistaa geometrian kaavasta; NORMAL bitti-identtinen |

## Vaiheessa 0 tehdyt korjaukset (mekaaniset, lähdetekstistä todennetut)

1. **Lähdeluku keskitetty** → `street-src.cjs` (26 penkkiä). Tuleva tiedostojako vaatii muutoksen vain tähän.
2. **Versioleimat dynaamisiksi** → `ver.cjs` lukee `#version-tag`in `index.html`:stä.
   Yhdeksän penkin kovakoodatut `v11.26`/`v11.27`/`v11.30`/`v11.31`-vaatimukset poistuivat
   → **versionosto ei enää riko penkkejä**. Samalla korjattiin `index.html`:n epäjohdonmukaisuus
   (`#version-tag v11.37` mutta `?v=11.35` × 4 → kaikki nyt `11.37`).
3. **Export-rivi (koukku-injektio)** päivitetty nykyiseen rajapintaan: `street-k2k6k7`,
   `street-avenger` (vanha `return { init, resize, closeGame };`).
4. **`StreetAudio`-stubit** täydennetty koko julkisella API:lla (`fruit`, `jukebox`, `avenger`)
   → "is not a function" -poikkeukset pois.
5. **`showNotification`-laskurit** 16 → 15 ja 15 → 14 (commit `bf54693` poisti yhden popupin
   tarkoituksella). Laskuri on sääntö 06:n vahti: **määrä ei saa kasvaa**.
6. **Puuttuvat tunnisteet preludissa**: `lamps` (v11.34: lamppu sammuu talon mukana) →
   `street-building-collapse`, `street-meteor-tempo`; `drunkAimShift` + DRUNK-vakiot (v11.31) →
   `street-beam-cd-hp`.
7. **Vanhentuneet odotukset päivitetty lähdettä vasten:**
   - `HUNGER_WAKE_GRACE`: `const` → `let` (v10.04 teki siitä kaaos-säädettävän).
   - `AVENGER_SPEED`: tarkistus "nopeampi kuin pelaaja" → "hitaampi" (v4.68: 2.0 → 1.0).
   - `startCoins`: BAD = 100 (v11.29), muut = 2.
   - Meteoriitin osumaväri: `#ffcf95` → `#ffa030`, vana `255,192,140` → `255,155,50`,
     hehku `255,206,150` → `255,180,60`.
   - `backdrop-destroy`: `destroyBackdropHouses` valitsee v11.26:sta lähtien **vain ehjiä**
     lohkoja → rapistuminen todistetaan suoraan `ruinBackdropBlock`illa.
   - `street-fruit` testi 2: muut ovet voivat avata omat pelinsä (v4.86 Sinkship) →
     tarkistus rajattu siihen, ettei **hedelmäpeli** aukea muista ovista.
   - `street-meteor-tempo`: raunioraja 3,0 → 3,2 (mitattu max 3,05; penkki oli rikki v11.34–v11.37).
8. **`headchk-normal-check.cjs` poistettu** – vanhentunut kopio `chaos-normal-check`:sta
   (osoitti `%TEMP%\headchk`-polkuun ja vanhaan odotustaulukkoon). Kanoninen NORMAL-portti on `chaos-normal-check`.

## Keltaisten penkkien käsittely Vaiheessa 1

Refaktoroinnin aikana näihin **ei kajota**; niiden tila vain kirjataan. Ne vaativat oman
penkinpäivityssession (jokainen: vanhentuneen odotuksen tunnistus + uusi mittatikku).
Erityishuomio: `street-avenger` (Testi 1) ja `street-jukebox` lukevat pelin tilaa
vuorovaikutuksella → kun `update()`/huoneet pilkotaan, näiden **lähdetekstikytkennät**
(`if (barRoom) {` + `/* LIIKENNE EI PYSÄHDY (v11.09)`, `'♪ JUKEBOX'`, `'if (sleepRoom) {'`)
on säilytettävä tavu-tavulta – ks. `README.md` § kytkennät.

## Vaihe 1 (v11.38) – rakennevahtien päivitykset

Kun koodia siirrettiin uusiin funktioihin, **kolme penkkiä** teki lähdetekstiin kohdistuvan
rakennevahtinsa vanhalla osoitteella. Ne päivitettiin vastaamaan uutta rakennetta
(**tarkoitus säilyi, kattavuus ei heikentynyt**):

| Penkki | Vanha vahti | Uusi vahti |
|---|---|---|
| `street-building-collapse` | `B('handleAction')` sisältää `buildingGone(...)` kaikissa ovireiteissä | yhdistetty lähde: `handleAction + tryNewspaper + tryFruitDoor + tryJukeboxDoor + trySinkshipDoor + tryDoorsAndKicks` |
| `street-hunger-scope` (T7) | nälkäblokki ennen `if (sleepRoom) {` | nälkäblokki ennen porttia `if (updateSleepRoom(dt)) return;` |
| `street-knockdown-traffic` | hit-stop ennen `if (player.knockFallY === undefined) ...` | hit-stop ennen porttia `if (updateKnockedDown(dt)) return;` + uusi tarkistus, että itse `knockFallY`-liikennekutsu on tallella |
| `street-knockdown-traffic` + `street-traffic-rooms` | kaivon haara: `... updateManholeAction(dt); return; }` | sama haara omassa funktiossaan: `... return true; }` (portti `if (updateManholeSequence(dt)) return;`) |

**Tulos Vaihe 1 (koko) jälkeen:** 22 penkkiä, **16 puhdasta / 6 löydöstä – täsmälleen sama kuin baseline**
(per-penkki-löydösmäärät identtiset), `chaos-normal-check` 78 avainta / 0 eroa,
`street-render-smoke-test` 25/25.

### Vaihe 1:ssä siirretyt suuret funktiot

| Funktio | Ennen → jälkeen |
|---|---|
| `update()` | 1119 → **85 rv** (23 katuosuuden funktiota + 5 huonefunktiota) |
| `render()` | 428 → **143 rv** (10 piirtofunktiota) |
| `handleAction()` | 226 → **14 rv** (5 funktiota) |

### Miten rakennevahti tunnistaa siirron

Jos penkki hakee koodia lähdetekstistä (`indexOf`, `extract('nimi')`), **siirto ei riko sitä**
niin kauan kuin merkkijono säilyy. Rikkoja tulee vain kun:
1. funktio, josta haetaan, **jaetaan useaan** (→ yhdistä lähde, kuten yllä), tai
2. tarkistus olettaa **kahden lohkon keskinäisen järjestyksen tiedostossa** (→ muuta
   vertailu `update()`:n porttiin, kuten yllä).

Rakennetyökalu ja jaot: `tools/refactor/README.md`.

## Vaihe 2 (v11.38) – kaaosliput + `sfxTone`: penkkien päivitykset

- **5 penkkiä** (`street-beam-cd-hp`, `street-building-collapse`, `street-meteor-aftermath`,
  `street-meteor-tempo`, `street-beam-pickup-spawn`) evaluoivat tuotantofunktioita omassa
  preludissaan → preludiin lisättiin **`chaosFlags`-Proxy**, joka johtaa liput suoraan
  `chaosLevel`istä (pysyy synkassa myös `setChaos`-kutsujen jälkeen).
- `street-meteor-aftermath`: `playMeteorHit`-tarkistus päivitettiin muotoon "matala kolahtava
  runko (220 → 70, triangle) + kohinakerros tallella" (oskillaattori siirtyi `sfxTone`-apuriin).

**Tulos:** 22 penkkiä, **16 puhdasta / 6 = sama kuin baseline** · `chaos-normal-check`
78 avainta / 0 eroa · `street-render-smoke-test` 25/25.

> ⚠️ **Epävakaat penkit (havainto v11.38):** `street-meteor-coin` (**0–4** löydöstä: 4/4 ajossa
> v11.38 osien 3–4 aikana vaihteli 0 → 2 → 0 → 4) ja kerran myös
> `street-drunk` ("F5-soft reset: humala 2 → 1"; 4/5 ajosta OK ja A/B-kontrolli vanhalla koodilla OK).
> Nämä eivät liity refaktorointiin – molemmat ovat satunnais-/ajoitusherkkiä.
> **A/B-todiste (Vaihe 4):** `street-meteor-coin` ajettiin 4× vanhalla koodilla (1/4 epäonnistui:
> "BAD: meteoriitti tuhoutuu … → true") ja 4× Vaiheen 4 jälkeen (1/4 epäonnistui samalla tavalla)
> → vika on penkissä, ei tuotantokoodissa. **Siksi koko ajoraportin luku on joko
> 15 puhdasta / 7 tai 16 puhdasta / 6 – kumpikin on baseline.**

## Vaihe 3 (v11.38) – huonerekisteri: penkkien päivitykset

- `street-hunger-scope` (T7): rakennevahti siirrettiin portista **rekisterisilmukkaan**
  (`for (const room of rooms) if (room.update(dt)) return;`) – sama tarkoitus (nälkäblokki
  ennen huoneporttia).
- `street-render-smoke-test`: uusi osio **4b** avaa jokaisen huoneen ja varmistaa, että
  `closeRoom()` sulkee sen ja palauttaa `false`, kun mikään ei ole auki → **30/30 OK**
  (ennen 25/25). Tämä on ainoa penkki, joka kattaa huoneen `close()`-polun.
- `street-knockdown-traffic` / `street-traffic-rooms`: LIIKENNE-tarkistukset (`if (sleepRoom) {`
  ja `if (barRoom) {` + kommentti) säilyivät ennallaan, koska huoneiden sisältö ei muuttunut –
  vain niiden kutsuminen keskitettiin.

**Tulos:** 22 penkkiä, **16 puhdasta / 6 = sama kuin baseline** · `chaos-normal-check`
78 avainta / 0 eroa · `street-render-smoke-test` 30/30.

### Vaihe 5 osa 3 – `street/news.js` (ei uusia penkkimuutoksia)

`street/news.js` lisättiin `PARTS`-listaan → penkit saavat sanomalehtiosan samassa
järjestyksessä kuin selain. **Yhtään penkkiä ei tarvinnut muuttaa**: yksikään penkki ei
viittaa lehden sisäisiin nimiin (`newsLayout`, `NEWSPAPER_PAGES`, `newsScreen`, `newsCache`,
`drawNewspaperView` …) – ne kaikki olivat `street.js`:n yksityisiä. Kytkentä tapahtuu vain
neljän julkisen nimen kautta (`newsRoom` pysyi `street.js`:ssä; lehden sivutila siirtyi
moduuliin API:n taakse).

- `index.html`: uusi `<script src="street/news.js?v=11.38">` **ennen** `street.js`iä.
- `street.js`: `newsRoom` + `newsHeld*` (syöttö) jäivät paikalleen; `updateNewsRoom`,
  `openNewspaper` ja `closeNewspaper` kutsuvat `StreetNews.layout/index/next/prev/reset`.
- **`?v=`-leimojen laskurit** olivat jo löysennetyt (`>= 4`, Vaihe 5 osa 1) → kuudes leima ei riko mitään.

**Tulos:** NORMAL 78 avainta / 0 eroa · render-smoke 30/30 · 22 penkkiä
**15–16 puhdasta / 6–7 = sama kuin baseline** (löydösmäärät penkkikohtaisesti identtiset:
autohover 31 · avenger 1 · bad-warning 1 · hunger-scope 3 · jukebox 27 · manhole-bonus 3 ·
meteor-coin = tunnettu epävakaa 0–4).

### Vaihe 5 osa 4 – `street/traffic.js` (ei uusia penkkimuutoksia)

`street/traffic.js` (`drawVehicle`, 248 rv) lisättiin `PARTS`-listaan → penkit saavat
ajoneuvon piirron samassa järjestyksessä kuin selain. **Penkkejä ei tarvinnut muuttaa**:
mikään penkki ei kutsu `drawVehicle`ia suoraan, ja 4 kutsukohtaa ovat `render()`issa
(`vehicles[0..1]` syvyysjärjestyksessä).

- **Valintaperuste:** `drawVehicle` on puhdas piirtofunktio – tunnistinhaulla todennettu, että
  koko runko käyttää vain `ctx`, `dayT` ja `VEHICLE_HEADLIGHT_DIM`ia (kaikki muu on lokaalia
  tai `v`-parametrista). Siksi liikenne-domainia **ei** tarvinnut ryhmitellä (Vaihe 4) ensin.
- `street.js`: bind live-gettereillä (`get ctx`, `get dayT`) + `VEHICLE_HEADLIGHT_DIM` arvona.
- `index.html`: uusi `<script src="street/traffic.js?v=11.38">` **ennen** `street.js`iä.

**Tulos:** NORMAL 78 avainta / 0 eroa · render-smoke 30/30 · 22 penkkiä
**15–16 puhdasta / 6–7 = sama kuin baseline** (samat penkit ja samat löydösmäärät kuin osan 3 jälkeen;
meteor-coin on tunnettu epävakaa 0–4).

### Vaihe 5 osa 5 – `street/chaos-cards.js` (+ **uusi penkki**, 23 penkkiä)

- **`street/chaos-cards.js`** (K7-korttipakka, 134 rv) lisättiin `PARTS`-listaan.
- **Uusi penkki `street-chaos-cards-test.cjs`:** korttien `save → apply → restore` -polku ei
  laukea missään muussa penkissä (ensimmäinen kortti tulee vasta 3600 frameä = 60 s kuluttua,
  eikä render-smoke aja niin pitkään). Penkki ajaa **kaikki 10 korttia** läpi ja varmistaa, että
  tila palautuu **täsmälleen** (sama getter-joukko) ja että `apply` todella muutti tilaa –
  tämä on ainoa koneellinen todiste **get+set-hostista**. Lisäksi lippukortit
  (meteor/blackout/parade) + `consumeAnimalParade()` + **osio 4: testikytkin `?card=<id>`**
  (kortti jää päälle, myös tuntematon id on vaaraton) + **osio 5: rakennevahti** (v11.39).
- **v11.39 (bugikorjaus):** osio 5 varmistaa lähdetekstistä, että **blackout pimentää myös
  lamppujen kuvut, kuvun valopilkun, ovivalon ja pelaajan reunavalon** – ennen korjausta vain
  hehku + ikkunat pimenivät (käyttäjän havainto `?card=blackout`-testillä). Vika oli ennestään
  ollut, ei refaktoroinnin aiheuttama. NORMAL pysyy bitti-identtisenä.
- **Uusi testikytkin `?card=<id>`** (ei tallenna, kuten `?day`/`?hole`/`?cabs`): pitää yhden
  K7-kortin päällä loputtomiin → käyttäjä näkee jokaisen kortin yksi kerrallaan ilman 60 s
  odotusta. Id:t: `green · meteor · fog · gust · blackout · windows · parade · palette · sky · stars`.
- **`street-k2k6k7-test` päivitettiin:** `chaosCardDefs` muutti moduuliin → injektio ottaa sen
  nyt `StreetChaosCards.defs`-rajapinnasta (penkin oma logiikka `T.chaosCardDefs()` ennallaan).
- **`street-meteor-tempo-test` päivitettiin:** `updateShootingStar` lukee `cardState.meteorBurst`in
  → preludin kevyt stub `cardState` vaihdettiin `StreetChaosCards`-stubiin.

**Tulos:** 23 penkkiä, **17 puhdasta / 6 = sama kuin baseline** (samat penkit ja samat
löydösmäärät) · NORMAL 78 avainta / 0 eroa · render-smoke 30/30 ·
`street-chaos-cards-test` 0 löydöstä.

### Vaihe 5 osa 6 – `street/rooms.js` (v11.40)

- **`street/rooms.js`** (huoneiden piirto, 1013 rv) lisättiin `PARTS`-listaan. Mukana myös
  **BAR-taulun kuva-tila** (`BAR_PIC_SRC`/`barPic`/`barPicReady`), jota ei käytetä muualla.
- **Bench-päivitys (1 penkki):** `street-drunk-test` vie `drawBarRoom`in `__test`-rajapintaan →
  `drawBarRoom: StreetRooms.drawBar`, ja lähdetarkistus sallii nyt `ENV.barBuyQty`-muodon
  (`/'You drank ' \+ (?:ENV\.)?barBuyQty \+ 'x🍺 beers!'/`). Muut penkit eivät tarvinneet muutoksia
  (`street-jukebox`/`street-hunger-scope` lukevat `♪ JUKEBOX`-merkin ja funktioiden nimet
  **yhdistetystä** lähdetekstistä, joten siirto ei riko niitä).
- **⚠️ Ennakoimaton ansa:** huonepiirto käyttää joka funktiossa paikallista `H`-muuttujaa
  (`const W = WORLD_W, H = WORLD_H;`) → moduulin host-nimi **`H` varjostui** (TDZ-virhe
  `Cannot access 'H' before initialization`, render-smoke 24/30). Ratkaisu: host-nimeksi
  **`ENV`**. Tämä on nyt kirjattu `README.md`:n ansa-laatikkoon.

**Tulos:** NORMAL 78 avainta / 0 eroa · render-smoke 30/30 · 23 penkkiä
**17 puhdasta / 6 = sama kuin baseline** · `street-drunk` 51/51.

### Vaihe 5 osa 7 – liikennologiikka `street/traffic.js`:ään (v11.42)

- `updateTraffic(dt, playerSafe)` (124 rv kommentteineen) siirrettiin piirron seuraksi samaan
  moduuliin. Moduulin host laajeni 3:sta ~18 nimeen (mm. `vehicles`, `spawnTimers`, `player`,
  `vehicleShakeTimer` get+set, `trafficSpeedMult`, `trafficSpawnMult`, `LANE_DEFS`,
  `TRAFFIC_DAY_MULT`, `chaosAllGone`, `spawnParticles`, `collisionCost`, `H.sfx.*`).
- **TDZ-ansa:** `PLAYER_DEPTH_MAX_Y` on määritelty vasta rivillä ~8023 → **pakko sitoa getterinä**.
- **Penkkipäivitykset (3 kpl)** – kaikki lähdetekstihakuja, jotka osuivat siirrettyyn koodiin:
  1. `street-traffic-rooms-test`: `updateTraffic(dt, true)` → `StreetTraffic.update(dt, true)`
     (laskuri + kaivon haaran merkkijono). **Tulos 17 OK / 0** (oli 16 OK / 2).
  2. `street-knockdown-traffic-test`: sama + `knockFallY`-rivin muoto sallitaan `H.player`-etuliitteellä.
     **Tulos 43 OK / 0** (oli 42 OK / 2 / aiemmin 42 OK / 1).
  3. `street-beam-pickup-spawn-test`: kaistarajan purku sallii `H.`-etuliitteen (`kaistaraja`).
     **Tulos 27 OK / 0.**
- **street.js 8 722 → 8 622 rv** · `street/traffic.js` 271 → 668 rv.

**Tulos:** NORMAL 78 avainta / 0 eroa · render-smoke 30/30 · 24 penkkiä **18 puhdasta / 6 = baseline**.

### v11.43 – kaksi canvas-bugia (FULL) + uusi invarianssipenkki

Käyttäjä havaitsi FULLissa: rauta-aita ja pelaaja katosivat, ja aamun tullen kaikki piirtyi
"kahden tasavärin alle". Syyt olivat **kaksi erillistä** kelvottoman canvas-arvon bugia – kumpikaan
ei kaatanut Node-stubiä (oikea selain vain **hylkää kelvottoman arvon hiljaa**):

1. **`#NaNNaNxx`-väri (ennestään ollut, FULL/ei-BAD):** `randomHuePalette()` palautti
   `hsl(...)`-merkkijonoja, mutta `lightenHex()`/`mixHex()` olettavat `#rrggbb`-muotoa →
   `parseInt('sl',16)` = NaN → talojen katto/runko ja taustasiluetti piirtyivät **edellisellä**
   värillä (talo katoaa taivasta vasten). BAD käyttää `NEAR_BLACK_PALETTE`ia (hex) → siksi BAD oli kunnossa.
   **Korjaus:** uusi `hslToHex()` (chaos-config) → paletti tuottaa samat värit hexinä + vahtilauseet
   `lightenHex`/`mixHex`iin (ei-hex tai ei-äärellinen `t` → palauttaa alkuperäisen).
2. **`translate(NaN,0)` – OSA 7:N REGRESSIO:** `updateTraffic` nimesi `WORLD_W` → `H.WORLD_W`, mutta
   `WORLD_W` **jäi lisäämättä** `StreetTraffic.bind()`iin → `undefined + w` = NaN → spawnattu ajoneuvo
   sai `x = NaN` → se ei koskaan poistunut (NaN-vertailut ovat aina epätosia) eikä piirtynyt →
   liikenne jäityi ja katu näytti rikkinäiseltä. **Korjaus:** `WORLD_W` lisätty bindiin.
   Ilmeni vasta 300 framen jälkeen (ensimmäinen spawn) → siksi penkit eivät napanneet.

**Uusi penkki `street-canvas-invariants-test.cjs`:** ajaa 3 satunnaista FULL-arpaa + NORMALin
420 frameä ja tarkistaa **jokaisen** canvas-kutsun argumentin (NaN/undefined/±Infinity) sekä
tyylimerkkijonot (`#NaN…`) ja että pelaaja piirretään. **Tämä penkki olisi napanneet molemmat bugit.**

**Tulos:** NORMAL 78 avainta / 0 eroa · render-smoke 30/30 · FULL-fuzz **0 poikkeamaa / 40 arpaa** ·
25 penkkiä **18 puhdasta / 7** (7. = tunnettu epävakaa `street-meteor-coin`; baseline 6).

## Vaihe 5 (v11.38) – tiedostojako: penkkien päivitykset

- `street/chaos-config.js` lisättiin `PARTS`-listaan (`tools/tests/street-src.cjs`) →
  penkit liittävät osat samassa järjestyksessä kuin selain. **Muualla ei tarvittu muutoksia.**
- **`?v=`-leimojen laskurit löysennettiin** neljässä penkissä (`street-bad-warning`,
  `street-meteor-aftermath`, `street-knockdown-traffic`, `street-traffic-rooms`):
  `=== 4` → `>= 4`, koska uusi `<script>` tuo viidennen leiman. Tarkistuksen ydin on ennallaan
  (`ver.stampsConsistent` = kaikki leimat samassa numerossa kuin `#version-tag`).
  **Näin jako ei enää riko penkkejä tiedostomäärän kasvaessa.**

**Tulos:** 22 penkkiä, **16 puhdasta / 6 = sama kuin baseline** · NORMAL 78 avainta / 0 eroa ·
render-smoke 30/30.

### Vaihe 5 osa 2 – `street/sfx.js` (ei uusia penkkimuutoksia)

`street/sfx.js` lisättiin `PARTS`-listaan → penkit saavat ääniosan samassa järjestyksessä kuin
selain. **Penkkejä ei tarvinnut muuttaa lainkaan** (osa 1:n `?v=`-löysennys `>= 4` kattaa uuden
skriptitagin). Tarkistettu: NORMAL 78 avainta / 0 eroa · render-smoke 30/30 · 22 penkkiä
16 puhdasta / 6 = sama kuin baseline.

### Vaihe 5 osa 8 – huoneiden logiikka `street/rooms.js`:ään (v11.44)

Huonelogiikka (345 rv / 3 lohkoa: `updateSleepRoom`, `updateBarRoom`, `updateJukeboxRoom` ·
`resetJukeboxRoom`, `jukePickedTracks`, `jukeboxExitAndPlay` · `closeSleepRoom`, `closeBarRoom`,
`closeJukeboxRoom`) siirrettiin moduuliin piirron seuraksi **get+set-hostilla**. Paikalleen jäivät
`rooms[]`-rekisteri, oven avaus (`tryXxxDoor`) ja `closeRoom()`-silmukka (kokoaa myös lehden).

- **Uusi penkki `street-rooms-logic-test.cjs` (41 OK / 0):** ajaa siirretyn logiikan oikeasti läpi
  (`update()` → rekisteri → moduuli) ja todistaa get+set-hostin: Nuku (isDay vaihtuu, +1 🍔,
  herätysrauha, katto 10), Poistu, BAR-osto/peruutus + FULL-oluen haara, jukeboxin veloitus
  (1 valinta / vajaat kolikot / ei valintoja / 0 kolikkoa / äänen puuttuminen → palautus) ja
  `closeRoom()`. Lisäksi rakennevahti: tila on `ENV.`-etuliitteellä (ansa 3) ja `street.js`:ssä
  ei ole enää omia huonefunktioita.
- **Penkkipäivitykset (2 penkkiä, 3 tarkistusta):** `street-traffic-rooms` ja
  `street-knockdown-traffic` – LIIKENNE-regexit hyväksyvät nyt `(?:ENV\.)?`-etuliitteen
  (tarkoitus ennallaan: liikennekutsu huonehaarassa) ja `showNotification`-laskuri 15 → **18**
  (kutsuja edelleen 13; laskuri on karkea ja laskee nyt myös siirretyt maininnat + bind-rivin +
  moduulin otsikkolistan). **Yksi uusi kutsu veisi luvun 19:ään** → sääntö 06 pysyy vahdittuna.
- **Tulokset:** `street.js` 8 622 → **8 338 rv** · `street/rooms.js` 1 053 → **1 417 rv** ·
## Penkkivelka nollattu – 26 penkkiä / 0 löydöstä (3.10.2026, v11.44)

Kuusi "keltaista" penkkiä olivat **vanhentuneita odotuksia** (v11.10–v11.31), eivät
regressioita. Ne korjattiin vastaamaan nykyistä, tarkoituksellista toimintaa – **pelikoodia ei
muutettu lainkaan**, joten versionumero pysyy **v11.44**:ssä (käyttäjän testaama koodi on
täsmälleen sama).

| Penkki | Löydökset | Mikä oli vanhentunut | Korjaus |
|---|---|---|---|
| `street-manhole-bonus` | 3 → **0** | `ROOT` osoitti **D:\AI\Main**iin (forkin esikuva) + keräilybudjetti mitoitettu 1/3-arvonnalle | `ROOT` = repo; budjetti 400 → 1500 kierrosta (→ 18 putoamista): "75 %" oli 4 putoamisen sattumaa, 18:lla 22 % / 17 % = 1/6 ✔; arvotut luvut tulostetaan todisteeksi |
| `street-hunger-scope` | 3 → **0** | `ROOT` = Main; makuuhuoneen merkki `'MAKUUHUONE'` (UI käännettiin englanniksi v11.00 → `'BEDROOM'`); T6:n kävely kiinteä 150 f (1 🍔 = 2/3-vauhti v4.70) | `ROOT` = repo; merkki `'BEDROOM'`; T6 kävelee `x ≥ 745` asti (uusi `player()`-probe) |
| `street-jukebox` | 27 → **0** | koko penkki oli **yhden valinnan mallia** (v4.21): `'Valinta: N'`, `'SOI NYT'`, suomenkieliset tekstit | uudistettu **monivalintaan (v4.46/v4.99)**: rivi 0 = Exit, `✓ 1 🪙`, `▶ N track(s)`, `♪ PLAYING`, Enter lisää jonoon; `tapDoor` vapauttaa Space-näppäimen (reunanilmaisu); audio-stubi tallentaa `playJukeboxQueue`/`appendJukeboxQueue`; T5-regex sallii forkin `\|\| introPlaying` |
| `street-avenger` | 1 → **0** | potki `buildings[2]`:ta, joka on nykyään **Laivanupotus** (2. napautus avaa pelin) | kohde = **talo 0** (nykyään ainoa "potki kahdesti → pudotus"): 3 potkua sytyttävät ikkunat, 4. pudottaa; jahti- ja paluubudjetit (1200 / 1100 f) vastaavat v4.68:n hitaampaa oviukkoa |
| `street-autohover` | 31 → **0** | **v11.28 nosti alun 1 s → 5 s** (+ 500 ms uusintayritys) ja **v11.29 poisti PC:n mouseenter-peruutuksen** | aikajana lasketaan nyt vakioista (`START`/`STEP`/`HOLD`/`CYCLE`); osio C = "mouseenter ei enää keskeytä"; uudet lähdevahdit (START 5000, RETRY 500); D-osiossa pollaus (`waitForCond`) |
| `street-meteor-coin` | 0–4 (epävakaa) → **0** | FULL arpoi talojen järjestyksen → meteoriitti saattoi jäädä talon taakse (osuma estyy); kolikkotestissä liikenne kaatoi pelaajan | kiinteä `Math.random`-siemen (37/40 siemenistä kelpaa, oletus **7**, kytkin `MC_SEED=`, ks. kommentti); kolikkotestissä pelaaja turvaradalle (`y 350`) + tainnutus nollataan |

**Tulos:** `node tools/tests/run-all.cjs` → **26 penkkiä, 26 puhdasta, 0 löydöstä** (5 peräkkäistä ajoa).
Yllä oleva per-penkki-taulukko on tästä eteenpäin **historiaa**: uusien penkkien odotukset ovat
suoria portteja, joten mikä tahansa punainen rivi on nyt aito löydös.


