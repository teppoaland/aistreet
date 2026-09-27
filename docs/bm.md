# Blue Mäx — Memo

Päivämäärä: 10.9.2026
Versio: 1.1 (debuggauskorjaus)

## Mikä tämä on
Blue Mäx on retroklassikosta inspiroitunut isometrinen lentopeli. Puhdas HTML + CSS +
JavaScript, ei ulkoisia riippuvuuksia eikä kirjastoja. Toimii pelkällä tiedoston
avaamisella selaimessa. Pelaaja ohjaa Sopwith Camel -kaksitasoa I maailmansodan
rintamalla, ampuu viholliskoneita ja pommittaa maakohteita.

Peli on osa **Pimeä Katu** -peliportaalia ja käynnistyy pääkadulta oven 3 kautta
(lamppu: "BLUE MÄX").

## Tiedostorakenne

```
bm/
├── game_main.html     — kehitysversion pääsivu (lataa css/ ja js/ tiedostot)
├── css/
│   └── style.css      — retro CRT-tyyli, responsiivisuus, touch-ohjaimet
└── js/
    ├── audio.js       — prosedyraaliset ääniefektit (Web Audio API)
    └── game.js        — pelimoottori: logiikka, piirto, syötteet, törmäykset
```

## Kehityskäytäntö
1. Kehitys tehdään AINA erillisissä tiedostoissa (`css/` + `js/`).
2. `game_main.html` ladataan pääkadun iframe-overlayhin `street.js`:n kautta.
3. Versionumero nousee +0.1 per muutos ja merkitään tämän MEMO:n yläreunaan.

## Ohjaimet

| Näppäin | Toiminto |
| --- | --- |
| Nuolet / WASD | Lennä (ylös/alas/vasen/oikea) |
| Välilyönti | Pudota pommi |
| Automaattinen | Konekiväärituli (välilyönti pohjassa = jatkuva) |
| L | Laskeudu lentokentälle (kenttä alla ja altitude ≤ 1) |
| Enter | Aloita peli / uudelleenkäynnistä game overin jälkeen |
| R | Game overissa: palaa alkuun (sama kuin Enter) |

Mobiili: D-pad + 💣-pomminappi. Title screeniä koskettamalla aloittaa pelin.

## Pelin ominaisuudet

### Perusmekaniikka
- **Vinottain vierivä maasto** – maasto rullaa vasemmalta oikealle
- **4 altitude-tasoa**: 0=maa, 1=matala, 2=keski, 3=korkea
- Pelaaja liikkuu vapaasti, altitude määräytyy ylös/alas-liikkeestä
- **Konekivääri**: automaattinen tuli (cooldown 8 frameä ≈ 130ms)
- **Pommit**: 30 kpl, painovoimalla putoavia, räjähtävät maassa
- **Polttoaine**: 40s perus, 70s jos pelaajalla kolikko (`inventory.coin`)
- **5 osumaa** = tuho

### Maasto ja maakohteet
- Generoitu maasto (5000px): rakennuksia, teitä, jokia, lentokenttiä
- **Lentokentät** (3 kpl): L-näppäimellä laskeutuminen → tankkaus + korjaus
- **Tankit**: ampuvat kohti, 1 osuma, 100p
- **AA-tykit**: flak-räjähdyksiä ilmaan, 1 osuma, 100p
- **Rakennukset**: 2 osumaa, 200p

### Viholliskoneet
- Hävittäjät (fighter, 100p) ja pommittajat (bomber, 200p)
- Ampuvat pelaajaa, liikkuvat ja väistelevät
- Törmäys viholliskoneeseen = 2 osumaa
### Pelin kulku
1. **Title screen**: "Rule, Britannia!" -melodia, Enter = aloitus
2. **Takeoff**: kone kiihdyttää, automaattinen nousu 1.5s
3. **Lentäminen**: maasto rullaa, polttoaine vähenee, vihollisia ilmestyy
4. **Laskeutuminen**: L-näppäin kentän päällä → laskeutuminen → tankkaus
5. **Game Over**: polttoaine loppuu, 5 osumaa, tai törmäys maahan

### Äänet (Web Audio API, proseduraaliset)

| Ääni | Toteutus |
| --- | --- |
| `startEngine` | Moottorin hurina (sawtooth 55Hz + square 110Hz) |
| `playGun` | Rä tinä (high-pass noise 3000Hz, 40ms) |
| `playBombDrop` | Vihellys (sine sweep 800→200Hz, 600ms) |
| `playExplosion` | Räjähdys (noise + basso 50→15Hz, 1s) |
| `playFlak` | Ilmatorjunta (band-pass noise 2500Hz, 120ms) |
| `playHit` | Osuma (square sweep 300→80Hz, 200ms) |
| `playRuleBritannia` | Alkumelodia (12 nuotin square wave) |
| `playLanding` | Laskeutumiskirskahdus (noise+sine, 300ms) |
| `playRefuel` | Tankkaus (triangle sweep 200→500Hz) |
| `playGameOver` | Surullinen melodia G-F-Eb-C (triangle) |

## Vakiot (`js/game.js`)

| Vakio | Arvo | Kuvaus |
| --- | --- | --- |
| `W, H` | 800, 480 | Canvas-koko |
| `GROUND_BASE` | 380 | Maanpinnan Y-koordinaatti |
| `SCROLL_SPEED` | 1.2 | Maaston vierintänopeus |
| `FUEL_MAX` | 40 | Peruspolttoaine (s) |
| `FUEL_MAX_COIN` | 70 | Polttoaine kolikolla (s) |
| `DAMAGE_MAX` | 5 | Osumia ennen tuhoa |
| `BOMB_MAX` | 30 | Pommien maksimimäärä |
| `GUN_COOLDOWN` | 8 | Kk:n jäähdytys (frameä @ ~60fps) |

## Pelitilat (`STATE`)

| Tila | Nro | Kuvaus |
| --- | --- | --- |
| `TITLE` | 0 | Alkunäyttö, Enter aloittaa |
| `TAKEOFF` | 1 | Nousukiito (1.5s → PLAYING) |
| `PLAYING` | 2 | Normaali lento |
| `LANDING` | 3 | Laskeutumisanimaatio (1.5s → REFUEL) |
| `REFUEL` | 4 | Tankkaus kentällä (1.5s → TAKEOFF) |
| `GAMEOVER` | 5 | Peli päättynyt, Enter palauttaa |
## 🥚 Jekku: polttoainepula

Pelin suunniteltu jekku (plan.md:n mukainen):

- **Ongelma**: Polttoainetta on vain 40 sekuntia – ei riitä pitkään lentoon.
- **Ratkaisu**: Pelaajan täytyy ensin **kerätä kolikko pääkadulta** (kadun
  oikeasta reunasta). Kolikon kanssa polttoainetta on 70 sekuntia.
- **Kolikon tunnistus**: Peli lukee `localStorage`sta avaimen
  `pimeakatu_gamestate` → `inventory.coin`. Jos `true`, kapasiteetti nousee.
- **Lisäksi**: Kentälle laskeutumalla (L-näppäin) saa **20s lisäpolttoainetta**,
  täydet pommit ja korjauksen.

## Jatkokehitysideat

- [ ] Vaihtuva vuorokaudenaika / sääefektit (sade, yölennot)
- [ ] Useampia tehtäviä / maalikohteita (sillat, laivat, junat)
- [ ] Pistepohjainen levelöinti (tietty pisteraja → seuraava sektori)
- [ ] Erikoisaseet: raketti, torpedo
- [ ] Useampi elämä / vaikeustasot
- [ ] High score -taulu (`localStorage`)
- [ ] Build-skripti standalone `.html`-tiedostolle

### 🥚 Pääsiäismunat / "kaaos pelin sisällä" (kehitysidea)

- [ ] **Salainen tunneli** — tietyn joen sillan alta lentämällä paljastuu bonus
- [ ] **Ilmalaiva / zeppeliini** — harvinainen, hidas, paljon pisteitä
- [ ] **Punainen Paroni** — boss-vihollinen, 3× kestävämpi
- [ ] **Rule Britannian triggeröinti ilmassa** — näppäinyhdistelmällä
      melodia soi uudelleen lennon aikana
- [ ] **Lintuparvi** — satunnainen, este, ei voi ampua
- [ ] **Moottorivika** — vaurion seurauksena moottori yskii (ääniefekti),
      nopeus puolittuu
- [ ] **Salainen kenttä** — piilotettu laskeutumispaikka jossain päin maastoa
- [ ] **Kaksoispisteet-tila** — esim. lentämällä tuulipussin läpi

## Versiohallinta
- Paikallinen git-repo kansiossa. **Ei ole tarkoitus julkaista mihinkään.**
- **v1.1: Debuggauskorjaus (10.9.2026)** — kriittiset bugit jotka estivät pelin käynnistymisen:
  - `hi(dt)`-funktiosta puuttui sulkumerkki → kaikki päivitysfunktiot (`uBM`, `uE`, `uF`, `uP`, `sEP`, `uEP`, `uGT`) olivat sisäkkäin
  - `dGO()`-funktiosta puuttui sulkumerkki → piirtofunktiot (`dT`, `dGT`, `dPL`, `dEP`) olivat sisäkkäin
  - Puuttuvat funktiot lisätty: `fG()` (kk-tuli), `dB()` (pommi), `uB()` (luodit), `uEB()` (vihollisen luodit), `iG()` (reset), `sn()` (ilmoitukset), `dC()` (pilvet)
  - Puuttuvat muuttujat `nt` ja `ntt` lisätty ilmoitusjärjestelmää varten
  - KK-tuli ei toiminut: `ks[' ']` → `ks['Space']` (keyCode-korjaus)
  - Canvas-koko korjattu: CSS `width: 100% !important` → peliruutu on nyt footerin levyinen (max 800px)
  - Rakennevirhe `}})();` → `})();` (ylimääräinen sulkumerkki poistettu)
- **v1.0: Blue Mäx** — peruspeli: lentäminen, ammunta, pommitus,
  laskeutuminen, äänet, Rule Britannia -intro, kolikon tunnistus.