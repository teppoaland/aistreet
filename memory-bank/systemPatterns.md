# 🧩 Järjestelmän arkkitehtuuri

> **Tarkoitus:** Cline:n referenssi projektin rakenteesta ja siitä, mitä ei saa rikkoa.
> **Kompaktoitu 23.9.2026 (v4.71).**

## ⭐ Yleisarkkitehtuuri

- **Pääportaali (juuri):** `index.html`, `style.css`, `street.js`, `gameState.js`, `audio.js` – ei `js/`-kansiota.
- **Iframet (5 alipeliä):** `digGame1/` ⛏️ Dig Game · `digGame2/` 💎 Dig Däsh · `bm/` ✈️ Blue Mäx ·
  `fruitgame/` 🍒 Hedelmäpeli (talo 7, **auki vain öisin** v4.34) · `sinkship/` 🚢 Laivanupotus (`buildings[2]`, 2 potkua oveen, aina auki, v4.86).
- **Kadun canvas-huoneet (ei iframe):** **makuuhuone** (ex-palkintohuone, `buildings[7]`, **ovi aina auki**
  v4.43 – ei avaimia eikä lamppua, valinnat Nuku/Poistu) · BAR (talo 9, 🍔) · jukebox (talo 5,
  `buildings[4]`, ovi x 410, 1 kolikko = koko kappale, **auki vain öisin** v4.34) · **sanomalehti**
  (`newsRoom`, v4.53 – kadun lehti poimitaan, liikenne ei pysähdy v4.54).
- **Kommunikaatio:** `window.parent.postMessage()` molempiin suuntiin.
- **LocalStorage-avaimet:** `pimeakatu_gamestate` (portaali; sisältää myös **`isDay`** = päivä/yö-tila),
  `digKeyCollected`, `boulderKeyCollected`, `bmKeyCollected`, `pimeakatu_fruit_free` (hedelmäpelin oma).
  Rosvo, kaivo, kuun rata, tankki ym. uudet tilat ovat **vain muistissa**.

**Salaiset cheatit kadulla (testityökalut, eivät tallennu):** vitoslamppu (x 720) 5 potkua putkeen →
kaikki avaimet + koko valorivi; jatkona 20 potkua → **+20 kolikkoa** (hiljainen: ei popuppia/ääntä).
Nupit `COIN_CHEAT_*` = `LAMP 4`, `KICKS 20`, `REWARD 20`, `GAP 120`, `COOLDOWN 3600`; putki katkeaa
toiseen lamppuun / 2 s taukoon / palkkioon, cooldown 60 s.

**Huoneiden piirto (mobiili):** huoneet piirretään maailmakoordinaatteihin 0–800, mutta mobiilissa canvas
on vain `viewW` (260–800) leveä ja kamera keskittää huoneen (`camX = (800 − viewW)/2`) → sisältö
sovitetaan näkyvään ikkunaan keskitettynä x = 400 (jukebox v4.22, BAR v4.25: `winW`, `vs`, `needPx()`,
`fitFs()`, paneeli ≤ `winW − 24`, `ctx.save()/restore()`-pari ettei tila vuoda kadulle).

**Äänet:** taustamusiikki = proseduraalinen syntikka (`MUSIC_SOURCE 'synth'`, ei tiedostoa) tai `'mp3'`-varatie
`knived_unafraid.mp3`; `jukebox/` soi vain jukebox-huoneesta – **6 raitaa**: 3 × Knived + raidat 4–6
(kolmannen osapuolen heavy metal, kansikuvat `jukebox/covers/{4,5,6}.png`). Masterit repon ulkopuolella
`D:\AI\Knived` / `D:\AI\free_music` (`.gitignore` estää `*.mpeg`/`*.mp4`).

**Kuvat:** `assets/justiina.png` (315×261) = BAR-huoneen seinätaulu (`BAR_PIC_SRC`, `barPicReady`,
varapinta jos ei lataudu) · `fruitgame/assets/dude_mv.jpg` (672×400, MV) = hedelmäpelin huoneen seinäkuva
HTML-elementtinä `#wall-pic` (ei canvasin piirrossa; koko/asemointi `renderer.wallPicSize()`, piiloon
mobiilin vaakatasossa) · `jukebox/covers/{4,5,6}.png` = soivan kappaleen kansikuva. Muu grafiikka on
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

**Aukiolo (v4.34):** jukebox (talo 5) ja hedelmäpeli (talo 7) auki **vain öisin**; päivällä
(`dayT >= 0.5`, `CLOSED_AT_DAYT`) ovesta sama popup kuin lukitusta ovesta
(`CLOSED_SIGN 'Avoinna\nKlo 20 - 06'`, `nightOnlyClosed()`) eikä huonetta/peliä avata. Yölogiikka ja
talousarvot ennallaan.

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

**Liikenne (v4.37 / v4.56–v4.63):** 1 ajoneuvo/kaista; tyypit auto, mopo, ambulanssi ja **panssarivaunu**
(`type 'tank'`, 86×36, nopeus 0,4–0,8, ei ajovaloa, moottorisaundi 28 Hz + särö, 75 px tykkiputki +
telat). Ajoneuvolohko on eristetty `updateTraffic(dt)`iin → se pyörii myös sanomalehteä lukiessa (v4.54)
ja jukebox-huoneessa (v4.61).

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

## 💾 Tiedon tallennus

- **`pimeakatu_gamestate`:** portaalin pelitila (`GameState`); `GameState.load()` mergaa tallennetun tilan
  `defaultState`in päälle (`deepMerge`) → **tallennettu saldo voittaa aina** (0 kolikkoa pysyy 0:na).
- **`defaultState`:** `coinCount 2` + `hamburgerCount 5` + **`isDay: null`** (päivä/yö-tila).
- **Alipelien sisäinen tila:** ei tallenneta (jokainen pelikerta alusta); hedelmäpelin ilmaispyöräytyksen
  jäädytys on pelin omassa avaimessa `pimeakatu_fruit_free`.
- **Avaimet:** `digKeyCollected` → `boulderKeyCollected` → `bmKeyCollected`; ne avaavat **alapelit**
  (Dig Däsh, Blue Mäx). Makuuhuone (talo 7) on **aina auki ilman avaimia** (v4.43).
- **Kadun uudet tilat (rosvo, kaivo, kuu, tankki, sanomalehti):** vain muistissa – ei uusia avaimia.

## 🔒 Talousbalanssi (LUKITTU 20.9.2026)

> **⚠️ ISO VAROITUS:** älä muuta kolikko-/🍔-/RTP-arvoja ilman käyttäjän eksplisiittistä pyyntöä.
> Sitova sääntö **`.clinerules/04-economy-balance.md`**, tausta **`docs/economy-balance-memo.md`**
> sekä säännön 02 kohta "Talous ja palkkiotase".

- **Hedelmäpeli:** panos 1, painot 🍒7 🍋5 🔔4 🍔2 💎2, maksut 💎35 🍔20 🔔12 🍋7 🍒4 + pari = panos takaisin
  → **RTP ≈ 78,5 %**; ilmainen pyöräytys 1 / 120 s.
- **Katu:** kolikko 1 kpl / 120 s · potkukolikko 1/5 + 30 s · 🍔 5 alussa, +1 / 40 s · BAR 1 kolikko = 1 🍔
  (katto 10) · jukebox 1 kolikko / kappale · osuma = −1 🍔 · **rosvo = −1 🍔 + kaikki kolikot (v4.68)** ·
  **kaivo = enintään −2 🪙 / 1/6 +3 🪙 (v4.52/v4.69)** · Nuku = +1 🍔 · syntymäpaketti 2 kolikkoa + 5 🍔.
- **Hyväksytty mittapuu (käyttäjän pelitestit):** 1 kolikko on pakko jättää ja käydä katsomassa, onko pakko
  syödä; hedelmäpeli palauttaa yleensä 1–2 kolikkoa; iso voitto (20 kolikkoa) ~kerran 30 pelikerrasta.
  **Tasapaino on empiirisesti löydetty → siksi lukossa.**
- **Testityökalut eivät ole balanssia:** `COIN_CHEAT_*`, `?coins=N` / `?debug`, `?day=0/1`, `?hole=0/1/2`,
  `?burgers=N`, `bm`-debug, `MUSIC_SOURCE` – vapaasti säädettävissä (ei lupaa, ei versionostoa).

## 🏷️ Nimeämiskäytännöt

- Tiedostot: camelCase (JS), kebab-case (HTML/CSS) · Vakiot: UPPER_SNAKE_CASE · Funktiot: camelCase ·
  Luokat: PascalCase · **kommentit: suomi, koodi: englanti**.
- Näkyvät pelinimet: **Dig Däsh**, **Blue Mäx**. Sisäiset tunnisteet (`boulder*`, `const BlueMax`, `bm/`)
  säilyvät ennallaan – ne ovat rajapintaa (sääntö 02).
