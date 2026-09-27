# Dig Däsh — Memo

Päivämäärä: 11.9.2026
Versio: 1.1

## Mikä tämä on
Dig Däsh -tyylinen selainpeli. Toteutettu puhtaalla HTML + CSS + JavaScriptillä,
ei ulkoisia riippuvuuksia eikä kirjastoja. Toimii pelkällä tiedoston avaamisella selaimessa.

## Tiedostorakenne

### Kehitysversio (erilliset tiedostot — TÄÄLLÄ kehitetään)
- `game_main.html`  — kehitysversion pääsivu (lataa css/ ja js/ tiedostot) – **ainoa versio, käytetään suoraan portaalissa**
- `css/style.css`   — tyylit
- `js/constants.js` — ruututyypit (TILE), suunnat (DIR), nopeudet ja pisteet
- `js/levels.js`    — 4 kenttää tekstimuodossa + parseri
- `js/physics.js`   — fysiikka: kivet/timantit putoavat, keikahdusviive, liukuminen
- `js/enemies.js`   — vihollisten tekoäly (tulikärpänen, perhonen)
- `js/renderer.js`  — canvas-piirto
- `js/input.js`     — näppäimistö + kosketusohjaus
- `js/game.js`      — pelin pääohjain (pääsilmukka, HUD, tilat)

## Kehityskäytäntö
1. Kehitys tehdään AINA erillisissä tiedostoissa (`css/` + `js/`) — selkeämpää.
2. Buildausta yhteen tiedostoon ei enää tehdä – `game_main.html` toimii suoraan portaalissa.
3. **Versionumero**: jokaisesta tehdystä muutoksesta versionumero nousee +0.1
   (1.0 → 1.1 → 1.2 → ...). Uusi versio merkitään MEMO.md:n yläreunaan
   (`Versio:`) ja samalla myös git-tagiksi (`v1.1`, `v1.2`, ...).

## Ohjaimet
| Näppäin | Toiminto |
| --- | --- |
| Nuolet / WASD | Liiku |
| Välilyönti + suunta | Etäkaivu (syö yhden mullan/timantin, ei liiku) |
| Enter | Jatka / vahvista |
| P | Tauko |
| R | Tason uudelleenkäynnistys |

## Pelin ominaisuudet
- 4 tasoa: Aloittelijan luola, Kivivyöry, Tulikärpästen pesä, Timanttikaivos
- Kivet ja timantit putoavat (keikahdusviive 1 kehys = pelaaja ehtii alta pois)
- Timantti putoaa päälle → kerätään (ei kuolemaa); kivi putoaa päälle → kuolema
- Viholliset: tulikärpänen (kääntyy vasemmalle) ja perhonen (kääntyy oikealle),
  liikkuvat vain tyhjässä tilassa
- Pelaaja on vihollista nopeampi (`ENEMY_DELAY` 320 ms vs `FRAME_DELAY` 160 ms)
- 3 elämää, pisteytys, uloskäynti aukeaa kun tarpeeksi timantteja **ja avain** kerätty
- Kosketusohjaus mobiililla
- **Debug-tila**: `?debug` URL-parametrilla peli käynnistyy suoraan ilman introa
- **Avain**: jokaisessa kentässä on avain (K), joka pitää kerätä timanttien lisäksi

## Tärkeät vakiot (`js/constants.js`)
- `FRAME_DELAY = 160` — painovoiman tahti (ms)
- `ENEMY_DELAY = 320` — vihollisen askeleen tahti (ms); tästä säädetään vaikeutta
- `INITIAL_LIVES = 3`
- `SCORE_DIAMOND = 10`, `SCORE_ENEMY = 25`, `SCORE_LEVEL_BONUS = 50`

## Jatkokehitysideat
- [x] Ääniefektit (Web Audio API, ei tarvita tiedostoja) — toteutettu
- [ ] Uusia kenttiä (helppoa: lisää `LEVEL_DATA.push(...)` tiedostoon `js/levels.js`)
- [ ] Ennätyspisteet `localStorage`-tallennuksella
- [ ] Vaikeusasteen säätö (`ENEMY_DELAY`, elämien määrä)
- [ ] Lisää vihollistyyppejä
- [ ] Pelin ajanotto / pistelaskenta ajan mukaan

### 🥚 Pääsiäismunat / "kaaos pelin sisällä" (kehitysidea)
Pelin perusidea on vanha ja jopa tylsä — siksi peli täytetään täyteen
pääsiäismunia. **Peli näyttää aluksi normaalilta ja tylsältä, mutta pelaamisen
myötä syntyy kaaosta ja kaikkea ihmeellistä.** Temppuja tehdään äänillä,
efekteillä, pisteillä tai totaalisella tuholla. Mitä enemmän jaksaa kaivaa,
sitä enemmän löytää — ja peli alkaa kiinnostaa uudella tavalla.

Esimerkkejä pääsiäismunista:
- [ ] **Kuiskiva kaiku** — syvemmällä kaivaessa kuuluu satunnaisia kuiskauksia /
      outoja kaikuja (äänikikkailu, jännitys kasvaa syvyyden mukaan).
- [ ] **Kultainen kivi / fossiili** — harvinainen ruutu mullan alla, joka antaa
      megapisteitä tai avaa jotain salaista.
- [ ] **Ketjuräjähdys** — räjähtävä perhonen sytyttää viereiset perhoset,
      massiivinen kaaos koko kentässä.
- [ ] **Salainen huone / bonus-taso** — tietyn seinän läpi kaivamalla paljastuu
      piilotettu tila tai kokonaan uusi kenttä.
- [ ] **Teleportti / madonreikä** — vie pelaajan toiseen kohtaan kenttää.
- [ ] **Konami-koodi / salaiset näppäinyhdistelmät** — aktivoi erikoistiloja.
- [ ] **Satunnainen "myrsky"** — kenttä sekoittuu, kivet alkavat pudota kaikkialta.
- [ ] **Ääni, joka muuttuu salaisuuden lähellä** — pelaaja voi "aistia" piilotetun.
- [ ] **Screeshake / häiriöefektit** — ruutu tärisee ja "rikkoutuu" yllättävissä
      hetkissä (esim. ketjureaktion tai salaisuuden löytymisen yhteydessä).
- [ ] **Kummitustila** — pelaaja näkee kummitusmaisia hahmoja/viestejä tietyissä
      paikoissa.
- [ ] **Toisen tason "rikkominen"** — rajat rikkova efekti (pelaaja voi hetken
      kävellä seinien läpi tms.), täydellinen kaaoshetki.
- [ ] **Piilotettu pistekertoja** — salainen keräys, joka moninkertaistaa pisteet.

Tavoite: pinnalla kaikki näyttää tutulta Dig Däshiltä, mutta syvemmällä
pelaaja törmää jatkuvasti yllätyksiin, joista voi kertoa kavereille.

## Versiohallinta
- Paikallinen git-repo kansiossa. **Ei ole tarkoitus julkaista mihinkään.**
- Ensimmäinen snapshot: "Dig Däsh - initial working version"
- Nykyinen versio: **v1.0** (git-tag `v1.0`)
