# 🧩 Järjestelmän arkkitehtuuri

> **Tarkoitus:** Cline:n referenssi projektin rakenteesta ja siitä, mitä ei saa rikkoa.
> **Kompaktoitu 23.9.2026 (v4.71) · tiivistetty 28.9.2026 (v11.00, 13,4 → 12,5 kt):** kaaos K0–K7 → `docs/chaos.md`.
> Esiforkin (Pimeä Katu) koko historia: `D:\AI\Main` – tämän repon historia alkaa `b854771`.
> **Rajat (päivitetty 3.10.2026 – koko pankki 135 → 155 kt):** tämä tiedosto **≤ 25 kt** · koko pankki **≤ 155 kt** – kokoa ei raportoida joka istunnossa; raja mainitaan vain, jos se ylittyy.

## ⭐ Yleisarkkitehtuuri

- **Pääportaali (juuri):** `index.html`, `style.css`, `street.js`, `gameState.js`, `audio.js` – **ei `js/`-kansiota**;
  raskaat osat ovat **`street/`-kansiossa** omina `var StreetXxx`-IIFE-moduuleina (Vaihe 5 osat 1–8, v11.38–v11.44):
  `chaos-config.js` (kaaosarvot + `hslToHex`), `sfx.js` (äänet + moottori), `news.js` (lehti),
  `traffic.js` (ajoneuvon piirto + liikennologiikka), `chaos-cards.js` (K7-kortit),
  **`rooms.js` (huoneiden piirto + logiikka: Nuku/BAR/jukebox)**. `index.html` lataa ne ennen `street.js`iä;
  penkit liittävät samat osat `tools/tests/street-src.cjs`:n `PARTS`-listalla. Moduulit eivät tunne pelitilaa:
  `bind()` antaa live-getterit ja **get+set -parit** (tila pysyy street.js:n sulkeumassa) – ks.
  `tools/refactor/README.md` § Mekanismi + ansat.
- **Kaaosjärjestelmä (v10.01–v10.18):** keskitetty `chaosProfiles`/`setChaos()` `street.js`:ssä kirjoittaa kertoimet suoraan olemassa oleviin `let`-muuttujiin (ei uutta mekaniikkaa); hub `#chaos-menu` valitaan aina ennen `Street.init()` (NORMAL = nykyiset arvot, FULL = `generateFullChaosSeed()`); valittu mode + `chaosCfg` `sessionStorage`en (v10.06), kolikot/🍔 `pimeakatu_gamestate`:ssa.
- **Portti ja pääsäännöt:** jokainen arpa kulkee `clampChaosCfg()` + `validateChaosCfg()` läpi; pelaajan kyvykkyysindeksi **C** skaalaa uhkat (nopeus ≤ 1,4 × C, varoitus ≥ 21/C f). Sitovat: **NORMAL ei hajoa koskaan** ja **peli pysyy pelattavana kaikissa moodeissa**.
- **Kategoriat K0–K7** vaikutuksen mukaan (K1 visuaalinen = vapaa · K3 uhka & K4 keho = klampit · K5 talous 🔒 lukittu · K6 ääni · K7 tapahtumakortit = v1 vain visuaalisia) + tasomanifesti, C-indeksi ja DoD: **`docs/chaos.md`** (toteutus `v10.02`…`v10.05`, uudet akselit `v10.18`).
- **Iframet (5 alipeliä):** `digGame1/` ⛏️ Dig Game · `digGame2/` 💎 Dig Däsh · `bm/` ✈️ Blue Mäx ·
  `fruitgame/` 🍒 Hedelmäpeli (talo 7, **auki vain öisin** v4.34) · `sinkship/` 🚢 Laivanupotus (`buildings[2]`, 2 potkua oveen, aina auki, v4.86).
- **Kadun canvas-huoneet (ei iframe):** **makuuhuone** (ex-palkintohuone, `buildings[7]`, **ovi aina auki**
  v4.43 – ei avaimia eikä lamppua, valinnat Nuku/Poistu) · BAR (talo 9, 🍔) · jukebox (talo 5,
  `buildings[4]`, ovi x 410, 1 kolikko = koko kappale, **auki vain öisin** v4.34) · **sanomalehti**
  (`newsRoom`, v4.53 – kadun lehti poimitaan, liikenne ei pysähdy v4.54).
- **Kommunikaatio:** `window.parent.postMessage()` molempiin suuntiin.
- **LocalStorage-avaimet:** `pimeakatu_gamestate` (portaali; sisältää myös **`isDay`** = päivä/yö-tila),
  `digKeyCollected`, `boulderKeyCollected`, `bmKeyCollected`, `pimeakatu_fruit_free` (hedelmäpelin oma).
  Rosvo, kaivo, kuun rata, tankki ym. uudet tilat ovat **vain muistissa** –
  samoin **tuhotut talot (v11.22: `buildingDmg`)** ja avoimen kaivon tila.

**Salaiset cheatit kadulla (testityökalut, eivät tallennu):** vitoslamppu (x 720) 5 potkua putkeen →
kaikki avaimet + koko valorivi; jatkona 20 potkua → **+20 kolikkoa** (hiljainen: ei popuppia/ääntä).
Nupit `COIN_CHEAT_*` = `LAMP 4`, `KICKS 20`, `REWARD 20`, `GAP 120`, `COOLDOWN 3600`.

**Huoneiden piirto (mobiili):** huoneet piirretään maailmakoordinaatteihin 0–800, mutta mobiilissa canvas
on vain `viewW` (260–800) leveä ja kamera keskittää huoneen (`camX = (800 − viewW)/2`) → sisältö
sovitetaan näkyvään ikkunaan keskitettynä x = 400 (jukebox v4.22, BAR v4.25: `winW`, `vs`, `needPx()`,
`fitFs()`, paneeli ≤ `winW − 24`, `ctx.save()/restore()`-pari ettei tila vuoda kadulle).

**Äänet:** taustamusiikki = proseduraalinen syntikka (`MUSIC_SOURCE 'synth'`, ei tiedostoa) tai `'mp3'`-varatie
`knived_unafraid.mp3`; `jukebox/` soi vain jukebox-huoneesta – **9 raitaa** (v4.97): 3 × Knived + kolmannen
osapuolen heavy metal + Alex Morgan / NickPanek (kansikuvat `jukebox/covers/{1..9}.png`). Masterit repon ulkopuolella
`D:\AI\Knived` / `D:\AI\free_music` (`.gitignore` estää `*.mpeg`/`*.mp4`).

**Valikkomusiikki + portti + grace (v10.07–v10.11):** alkuvalikko ("Choose your chaos level") on erillinen
**portti** peliin (vain uusi peli / ✕-hard reset / kuolema) ja soi oman biisin (`jukebox/alec_koff-heavy-doom-dark-metal-493397.mp3`, loop, `audio.js` `setMenuActive`/`menuEl`). Autoplay-lukon kierto = `#start-gate` ("CLICK / PRESS ANY KEY TO BEGIN"), jonka ensimmäinen ele avaa äänen ja näyttää valikon (`GATE_MENU_DELAY_MS 2000` estää mobiilin ghost-clickin). Pelissä syntikka hiljaa 30 s (`StreetAudio.start(30000)`) → `SYNTH_FADE_IN 800 ms`; F5 (soft reset) ohittaa portin + gracen. Syntikka pysyy hiljaisena kunnes jukeboxista on soitettu 1 kappale (v10.11, `synthUnlocked`) – **poistettu v11.01**, tilalle kaaos-intro (ks. activeContext). **v11.02:** valinnan jälkeen koko ruutu
mustenee 2 s (`#chaos-blackout`, `style.css` `.on`/`.reveal`, z 9998) ja valikkobiisi vaimenee
(`fadeOutMenuMusic(ms)`, 50 ms portaat + `MUSIC_VOLUME`-palautus); valikko piilotetaan ja `Street.init()`
käynnistyy **mustan alla**, minkä jälkeen katu paljastuu 1 s häivytyksellä → koko siirtymä 3 s.
**Kaaosvalikon hover-kierto + otsikon Ø (v11.03–v11.05b, v11.16/v11.17):** hubin auettua luokka `.auto-hover`
(`style.css`, = **täsmälleen `:hover`:n ulkoasu**) liukuu 5 napin yli ylhäältä alas **173 ms / nappi**
(v11.17: 450 → 346 → 173) ketjutettuna `setTimeout`ina (`AUTO_HOVER_START_MS 1000` / `REPEAT_MS 10000` /
`STEP_MS 173` / `HOLD_MS 2000`), ja **FULL CHAOS jää päälle 2 s** → samalla `#chaos-menu.shaking`
(`@keyframes chaos-shake`, kesto = `HOLD_MS`) tärisee – tärinä kohdistuu valikon mustaan kerrokseen, ei
`body`iin. **Oikea hiiri/täppäys voittavat aina** (valinta → `stopAutoHover`); `mouseenter`-peruutus
kiinnitetään vain `(hover: hover)` -laitteille ja kosketus käyttää `touchstart`ia (v11.17), koska puhelimen
synteettinen `mouseenter` saattoi tappaa liu'un. **Reduce-motion ei estä mitään osaa** – myöskään näytön tärinä ei enää jää pois
(v11.27: `street.js`:n motion-lippu ja `style.css`:n `@media`-yliajo poistettu; sama linjaus kuin
pelin canvas-tärinä BAD/FULLissa ja INSTRUCTIONS-vilkku v10.31). Alkunäkymien (gate + hubi) otsikko
on **`AI CHAØS STREET`** fontin omalla Ø:llä (U+00D8, v11.16). Testikytkin `?autohover=0`; pelkkä UI-ajoitus
→ NORMAL bitti-identtinen. **Säätönuppi jos välähdys tuntuu töksähtävältä:** napin CSS-transitio
`background/border-color/color 0.12s` (`style.css` 428) ehtii 173 ms:ssä juuri ja juuri täyttyä → lyhennä se
esim. 0.06 s:iin (vain arvo, ei versionostoa).

**Kuvat:** `assets/justiina.png` (315×261) = BAR-huoneen seinätaulu (`BAR_PIC_SRC`, `barPicReady`,
varapinta jos ei lataudu) · `fruitgame/assets/dude_mv.jpg` (672×400, MV) = hedelmäpelin huoneen seinäkuva
HTML-elementtinä `#wall-pic` (ei canvasin piirrossa; koko/asemointi `renderer.wallPicSize()`, piiloon
mobiilin vaakatasossa) · `jukebox/covers/{1..9}.png` = soivan kappaleen kansikuva. Muu grafiikka on
proseduraalista.

**Syvyysskaalaus (syvyysvaikutelma):** talot `buildingScale()` 100 / 95 / 90 % ankkuroituna `GROUND_Y`:hin ·
pelaaja `playerDepthScale()` ±10 % (0,90 kauas … 1,10 lähelle, 1,00 keskikohdalla `player.y = 315`)
ankkuroituna jalkojen kosketuspisteeseen (`px + pw/2, py + ph − 1`). **Skaalaus on visuaalinen** –
hitboxit (`player.w/h`, törmäykset, keräyssäteet) eivät skaalaudu, joten pelimekaniikat pysyvät ennallaan.

**Päivä/yö (v4.33):** tila on **tallennettu** (`state.isDay`: `null` = ratkaisematon, `true` = päivä,
`false` = yö). Kaikki 3 avainta nostaa päivän **kerran** (v4.32) ja tallentaa `true`; sen jälkeen
**makuuhuoneen Nuku** vaihtaa tilaa (Poistu ei muuta mitään). Koska ovi on aina auki (v4.43), **Nuku voi
ratkaista tilan jo ennen avaimia** → auringonnousu ei enää laukea. `dayT` liukuu molempiin suuntiin
(`DAY_FADE_FRAMES` / `NIGHT_FADE_FRAMES`) ja on pysähdyksissä alapeleissä ja canvas-huoneissa → muutos
näkyy kadulle palatessa (`?day=1` / `?day=0` pakottavat tilan, eivät tallenna). **Visuaalinen vain** –
kaikki päivähaarat ovat ehtoja `dayT > 0`, joten `dayT = 0` piirtää bitilleen entisen yökuvan.

**Aukiolo (v4.34):** jukebox (talo 5) ja hedelmäpeli (talo 7) auki **vain öisin**; päivällä (`dayT >= 0.5`,
`CLOSED_AT_DAYT`) ovesta sama popup kuin lukitusta ovesta (`CLOSED_SIGN 'Open\n8pm-6am'`, `nightOnlyClosed()`)
eikä huonetta/peliä avata. Yölogiikka ja talousarvot ennallaan.

**Nälkä (v4.41 / v4.49 / v4.50):** `hungerOnHold()` (`sleepRoom || sleepPhase > 0`) pitää
`hamburgerTimer`in jäissä nukkuessa; herätessä `HUNGER_WAKE_GRACE 600` (väh. 10 s). **Kaikkialla muualla**
(katu, BAR, jukebox, iframe-pelit, sanomalehti) kulutus jatkuu. **🍔 = 0 → kuolema myös huoneessa/pelissä:**
`leaveHiddenStateForDeath()` sulkee ensin alapelin (`closeGame()`) tai canvas-huoneen (`closeRoom()`),
jotta kuolinsekvenssi näkyy kadulla. Ks. sääntö 04.

**Päivän visuaaliset muutokset (v4.35–v4.42, kaikki `dayT`-sidonnaisia):** ajovalot ja valokeila pois
(`VEHICLE_HEADLIGHT_DIM 1`) · liikenne ×2 (`TRAFFIC_DAY_MULT 2`) · lamppuovet aukeavat ilman potkaistua
katuvaloa (`lampFreeOpen()`, `DOOR_NO_LAMP_AT_DAY`) · moskiitot pois (`MOSQUITO_DAY_DIM 1`) · täysi päivä
sammuttaa katuvalot kerran (`dayLampsOff`, nollautuu `dayT === 0`) · pilvet tummenevat (`CLOUD_NIGHT_*`
→ `CLOUD_DAY_*`, `CLOUD_DAY_ALPHA 5`; muoto/määrä/tuuli ennallaan) · HUD:n 🍔-varoitus vilkkuu kun
`hamburgerCount <= HUNGER_WARN 3`. `dayT = 0` antaa bitilleen entisen yökuvan; nupit `activeContext.md`:ssä.

**Kuu ja aurinko (v4.41 / v4.65):** päivällä aurinko `SUN_X 140`, yöllä kuu – vaihdossa **ei liukua**,
vain alpha-ristihäivytys (`1 − dayT` / `dayT`). Kuu **liukuu** vasemmalta (`MOON_X_MIN = SUN_X`) oikealle
myös huoneissa/alapeleissä ja laskeutuu ulos (`MOON_SET_X ≈ 884`, `MOON_NIGHT_FRAMES 57600` ≈ 16 min);
laskeutuessaan maisema pimenee hiukan (`moonDark` → 0.15). `resetMoon()` nollaa kuun spawnissa ja
uudessa yössä. Makuuhuoneen ikkunan oma aurinko/kuu säilyy ennallaan.

**Liikenne (v4.37 / v4.56–v4.63 / v11.09 / v11.10 / v11.12):** 1 ajoneuvo/kaista; tyypit auto, mopo, ambulanssi ja **panssarivaunu**
(`type 'tank'`, 86×36, nopeus 0,4–0,8, ei ajovaloa, moottorisaundi 28 Hz + särö, 75 px tykkiputki +
telat). Ajoneuvolohko on eristetty `updateTraffic(dt)`iin → se pyörii myös sanomalehteä lukiessa (v4.54)
ja **kaikissa sisätiloissa**: jukebox-huone (v4.61), BAR ja makuuhuone (myös nukkumisen pimennys) sekä
kaivoon putoaminen/kiipeäminen (`mhAction`) (v11.09). Sisätiloissa kutsutaan `updateTraffic(dt, true)` →
`playerSafe = true`: liike, spawnit ja moottoriäänet (panorointi lasketaan `v.x`:stä) toimivat, mutta
pelaajan törmäystä ei tarkisteta (ei tainnutusta eikä 🍔-menetystä). **Tainnutus (v11.10):**
`knockedDown`-haara päivittää liikennettä samoin (`updateTraffic(dt, true)`) – **mutta vain jos kaataja
ei ollut auto**: `player.knockFallY` asetetaan ainoastaan `updateTraffic`in törmäyksessä (v4.78), joten
sen puuttuminen = ei-kolari. Auton osuma on kolari, johon liikenne on osallisena → silloin ajoneuvot
seisovat koko tainnutuksen ajan. Oviukon 3 s hit-stop (`hitPauseTimer = AVENGER_FREEZE`) on ennen
tainnutushaaraa → lyhyt koko maailman jäädytys säilyy. **Sääntö: jokainen `update()`in varhainen
`return` ennen liikennettä on bugi** – se jäädyttää ajoneuvon paikalleen (`v.x` seisoo) ja moottorin
panorointi jämähtää. Sama juurisyy on korjattu kolmesti: jukebox (v4.61), huoneet + kaivo (v11.09) ja
tainnutus (v11.10). **Putoamistaso (v11.12):** auton osuma asettaa `player.knockFallY`in 25 px ylös osumakohdasta (`player.y + player.h - 25`; v4.78: 10 px, v11.11: 15 px) → pysähtynyt auto ei osu pelaajaan uudelleen ylösnoustessa (mitattu 0 uudelleenosumaa 13 kolarisyvyydellä; 10 px:llä 5, 15 ja 20 px:llä 1). Muut tainnutuslähteet käyttävät edelleen oletusta `GROUND_Y + 10`.

## 🎮 Pelien yhteinen arkkitehtuurimalli

```
peli/
├── game_main.html       ← ainoa versio (lataa css/ + js/), ei buildattua html:ää (buildaus poistettu v3.19)
├── css/style.css
└── js/  constants.js · levels.js · physics.js · enemies.js · renderer.js · input.js · audio.js · game.js
```

**bm/** on kevyempi: `game_main.html` + `css/style.css` + `js/game.js` + `js/audio.js`.
**fruitgame/:** `game_main.html` + `css/style.css` + `js/{constants,renderer,input,audio,game}.js`.

## 🔧 Komponenttien vastuut

- **ÄLÄ riko:** `constants.js` (TILE/DIR/nopeudet/pisteet/maailman mitat) · `physics.js` (painovoima,
  keikahdus, liukuminen, ketjureaktiot) · `enemies.js` (vihollisten liike ja käännökset) ·
  `levels.js` (kenttäparseri).
- **Vapaammin:** `game.js` (rAF-pääsilmukka, tilat intro → peli → kuolema → game over → onnistuminen,
  HUD, iframe-`postMessage`) · `renderer.js` (canvas-piirto, kamera, animaatiot, hiukkaset) ·
  `input.js` (näppäimistö + kosketus) · `audio.js` (Web Audio -efektit).

## 🚫 Mitä EI saa rikkoa

| Alue | Suojaustaso | Selitys |
|------|------------|---------|
| Pääportaalin rakenne | 🔴 KRIITTINEN | `index.html`, `gameState.js`, `street.js` – vain erikseen pyydettäessä |
| Pelien välinen API | 🔴 KRIITTINEN | `postMessage`-kommunikaatio, localStorage-avaimet |
| Fysiikka / vihollis-AI / kenttäformaatit | 🟠 KORKEA | `physics.js`, `enemies.js`, `levels.js` |
| Pisteytys/vakiot + renderöinti | 🟡 NORMAALI | `constants.js` (arvoja voi säätää, avaimia ei poistaa), `renderer.js` (visuaaliset muutokset ok) |
| Äänet / ohjaus | 🟢 MATALA | `audio.js`, `input.js` (voi lisätä näppäimiä, ei poistaa) |
| Kadun liikenneputki (`updateTraffic`) | 🟠 KORKEA | Jokainen `update()`in varhainen `return` **ennen** liikennettä on bugi (ajoneuvo ja moottorin panorointi jäätyvät) – korjattu kolmesti: jukebox (v4.61), huoneet + kaivo (v11.09), tainnutus (v11.10). Kolarin putoamistaso `player.knockFallY` = osumakohta − 25 px (v11.12); muilla kaatajilla `GROUND_Y + 10` |
| Talojen tuhoutuminen (v11.22, jälkitila v11.24) | 🟠 KORKEA | `buildingDmg[idx]` (`'gone'` = tuhoutunut) on tarkistettava **jokaisessa** taloon kytkeytyvässä reitissä: `handleAction` (hedelmäpeli 6, jukebox, laivanupotus, lamppuovet, talo 0, potkuvalot), `drawDoor`, `drawThresholdPaving` (kynnysvalo), `drawElectricCabinet` + isku, `drawMoonBuildingShadows`, `getAvailableWindows` (K1), `meteoriteBehindBuilding`, `drawBuildings` (tilalla romukasa `drawRubble(b, idx)`). **v11.24:** tähdätty meteoriitti (`targetBldgIdx`) piirretään **talojen TAKANA** kuten muutkin → `meteoriteBehindBuilding` estää osuman talon rungon kohdalla (ammuttavissa katon yläpuolella); jälkitila = `buildingRubble[idx]` (kasa ≤ `RUBBLE_H_MAX` = `DOOR_H/2` 16 px) ja mustia ovia ei piirretä – vain `standingDoorIdx` jää karmikehyksenä; taustalohkot eivät katoa (`b.ruin` → `ruinBackdropBlock`/`drawBackdropRuin`) ja `backdropMostlyGone` laskee **ehjistä** lohkoista; BAD-avaus `updateBadDemo` (vain BAD, kerran, talo 0–8 = myös BAR). LAMPUT ja niiden potku säilyvät aina, samoin kynnyskiveys ja BAR-kyltti. **v11.26 (tahti):** eskalaatioportti `BACKDROP_GONE_SHARE 0.60` (~40 % raunioina), hukkaosumat pois (`destroyBackdropHouses` = lähin ehjä kohde + vain ehjät seuraavat; `pickBuildingTarget` ohittaa myös kesken romahtavat) ja `badFinalePhase()`/`nextSkyGap()`: BAD-finaalissa ei tähtiä ja väli 260–420 f; FULL ennallaan (chance 1, 600 f). Yksityiskohdat: `docs/chaos.md` §8.7 |

## 💾 Tiedon tallennus

- **`pimeakatu_gamestate`:** portaalin pelitila (`GameState`); `GameState.load()` mergaa tallennetun tilan
  `defaultState`in päälle (`deepMerge`) → **tallennettu saldo voittaa aina** (0 kolikkoa pysyy 0:na).
- **`defaultState`:** `coinCount 2` + `hamburgerCount 5` + **`isDay: null`** (päivä/yö-tila).
- **Alipelien sisäinen tila:** ei tallenneta (jokainen pelikerta alusta); hedelmäpelin ilmaispyöräytyksen
  jäädytys on pelin omassa avaimessa `pimeakatu_fruit_free`.
- **Avaimet:** `digKeyCollected` → `boulderKeyCollected` → `bmKeyCollected`; ne avaavat **alapelit**
  (Dig Däsh, Blue Mäx). Makuuhuone (talo 7) on **aina auki ilman avaimia** (v4.43).
- **Kadun uudet tilat (rosvo, kaivo, kuu, tankki, sanomalehti):** vain muistissa – ei uusia avaimia.

## 🔒 Talousbalanssi (SUPERSEDED forkissa 27.9.2026)

> **⚠️ SUPERSEDED 27.9.2026:** sääntö 04 oli kirjoitettu **alkuperäistä Pimeä Katu -peliä** varten.
> **AI CHAOS STREET -forkissa se EI enää päde** – NORMAL on vain yksi kaaostaso, ja talousarvot
> (aloituskolikot/🍔, 🍔-tahti, RTP, hinnat) ovat vapaita muutettaviksi/kaaostettaviksi myös NORMALissa.
> Alkuperäispelin lukitut arvot, hyväksytty mittapuu ja testityökalut (eivät balanssia): **`.clinerules/04-economy-balance.md`**
> + **`docs/economy-balance-memo.md`** – historiallista dokumentaatiota, **eivät sitovia rajoituksia** chaos-versiossa.


## 🏷️ Nimeämiskäytännöt

- Tiedostot: camelCase (JS), kebab-case (HTML/CSS) · Vakiot: UPPER_SNAKE_CASE · Funktiot: camelCase ·
  Luokat: PascalCase · **kommentit: suomi, koodi: englanti**.
- **Pelaajalle näkyvät tekstit: englanti** (v11.00 alkaen, kaikissa peleissä) – kommentit ja dokumentit
  pysyvät suomeksi. Sisäiset tunnisteet, `postMessage`-viestit (`RETURN_TO_STREET`, `KEY_COLLECTED`, …) ja
  localStorage-avaimet (`pimeakatu_gamestate`, `pimeakatu_fruit_free`) **eivät ole käännettävää tekstiä**.
- Näkyvät pelinimet: **Dig Däsh**, **Blue Mäx**. Sisäiset tunnisteet (`boulder*`, `const BlueMax`, `bm/`)
  säilyvät ennallaan – ne ovat rajapintaa (sääntö 02).
