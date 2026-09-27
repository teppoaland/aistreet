# Dig Game — Memo

Päivämäärä: 16.8.2026
Versio: 1.0

## Mikä tämä on
Dig Game on kaivuripeli (pohjana Dig Däsh -tyyppinen mekaniikka). Puhdas HTML + CSS +
JavaScript, ei ulkoisia riippuvuuksia eikä kirjastoja. Toimii pelkällä
tiedoston avaamisella selaimessa.

**Iso muutos versiossa 2.0:** pelissä ei ole enää erillisiä tasoja, vaan
yksi yhtenäinen maailma, jota kuljetaan vasemmalta oikealle. Maailman
yläosa on maanpinta (puita ja taloja), alaosa maan alainen kaivettava maa.

## Tiedostorakenne

### Kehitysversio (erilliset tiedostot — TÄÄLLÄ kehitetään)
- `game_main.html`  — kehitysversion pääsivu (lataa css/ ja js/ tiedostot)
- `css/style.css`   — tyylit
- `js/constants.js` — ruututyypit (TILE), suunnat, nopeudet, maailman mitat, pisteet
- `js/levels.js`    — yhtenäisen maailman rakentaja (`buildWorld()`)
- `js/physics.js`   — fysiikka: kivet/timantit/puut/talot putoavat, painovoima
- `js/enemies.js`   — vihollisten tekoäly (tulikärpänen, perhonen)
- `js/renderer.js`  — canvas-piirto: kamera, pyöristetyt kaivureunat, hiukkaset
- `js/input.js`     — näppäimistö + kosketusohjaus
- `js/audio.js`     — prosedyraaliset ääniefektit (Web Audio API)
- `js/game.js`      — pelin pääohjain (pääsilmukka, HUD, tilat)

## Kehityskäytäntö
1. Kehitys tehdään AINA erillisissä tiedostoissa (`css/` + `js/`) — selkeämpää.
2. **Buildausta ei enää tarvita** – `game_main.html` toimii suoraan portaalissa.
3. **Versionumero**: Pelin versio on nyt 1.0. Jatkossa versionumero nousee
   +0.1 per muutos (1.0 → 1.1 → 1.2 → ...) ja merkitään MEMO:n yläreunaan
   sekä git-tagiksi.

## Ohjaimet
| Näppäin | Toiminto |
| --- | --- |
| Nuolet / WASD | Liiku |
| Välilyönti + suunta | Kaiva / tartu (multa, timantti; objektista tarttuu ja vetää) |
| Enter | Jatka / vahvista |
| P | Tauko |
| R | Aloita alusta (rakentaa maailman uudelleen) |

## Pelin rakenne ja ominaisuudet

### Yksi maailma, ei tasoja
- Alkuperäiset 4 kenttää on yhdistetty peräkkäin yhdeksi pitkäksi maailmaksi
  (leveys ~77 ruutua), jota kuljetaan vasemmalta oikealle.
- Kamera seuraa pelaajaa vaakasuunnassa; koko maailman korkeus näkyy kerralla.

### Maailman pystyrakenne (ylhäältä alas)
- Rivi 0: **taivas** — sinne ei voi kiivetä.
- Rivi 1: **maanpinta** (nurmi) — käveltävä, mutta siinä **ei voi syödä**
  eikä kaivaa mitään.
- Rivit 2–19: **maan alainen maa** — kaivettavaa; kiviä, timantteja, vihollisia.
- Rivi 20: **kallioperä** (tuhoutumaton pohja).

### Puut ja talot
- Maanpinnalle on sijoitettu **puita** ja **taloja**. Ne **seisovat maan pinnan
  päällä** (runko/katto nousee ylös taivaalle — ei uponneena maahan).
- Ne ovat kiinteitä esteitä, mutta niitä voi **työntää** ja **vetää**.
- Kun puun/talon **alta kaivaa maan pois**, se **putoaa** alaspäin
  (painovoima) ja jättää pinnalle nurmikon, jolloin pinnalla pääsee
  eteenpäin.
- Puu/talo pudotessaan antaa pisteitä (SCORE_DROP) ja voi murskata vihollisia
  sekä pelaajan (kuten kivi).

### Työntö ja veto (objektit)
- Kiveä, puuta ja taloa voi **työntää** kävelemällä niitä päin: ne siirtyvät
  yhden ruudun, jos takana on tyhjää. Jos 2 objektia on kasassa, ei voi työntää.
- **Veto/tarttuminen**: välilyönti + nuoli objektin vieressä → pelaaja tarttuu
  siihen ja vaihtaa paikkaa (vetää objektin itsensä paikalle). Prioriteetti:
  multa → timantti → objektista tarttuminen (alin).
- Jos objektia työntää/vetää kuilun yli, se **putoaa** (painovoima).

### Pulma ("entinen taso 3")
- Kolmannen osan kohdalla maan alle on rakennettu kallioseinä, joten **maan
  alta ei pääse ohi**. Pinnalla on puu ja talo, joiden alta täytyy kaivaa
  maa pois (suositeltavaa etäkaivulla sivusta), jolloin ne putoavat alla
  olevaan monttuun. Vasta sitten pinnalla pääsee jatkamaan vasemmalta oikealle.

### Pyöristetty kaivaminen ("syöminen kuin kaivamista")
- Kaivetun maan reuna **ei ole enää suora** `[]`, vaan **pyöristetty**.
- **Toteutus**: logiikka pysyy 1 ruutu = 1 solu -tasolla (fysiikka ja
  tekoäly pysyvät selkeinä ja vakaina), mutta piirto tehdään ruutua
  hienommalla visuaalisella tarkkuudella: maa piirretään pyöristetyillä
  kulmilla (`CORNER_RADIUS = 9 px`) sen mukaan, mikä sivu on kaivettu auki.
- Kaivamisen yhteydessä ruudusta lentää **murenemishiukkasia**, jolloin
  "syöminen" näyttää kaivamiselta pala palalta.

### Viholliset
- Tulikärpänen ja perhonen liikkuvat vain tyhjässä tilassa (maan alla);
  ne eivät nouse maanpinnalle eivätkä taivaalle.

## Tärkeät vakiot (`js/constants.js`)
- `FRAME_DELAY = 160` — painovoiman tahti (ms)
- `ENEMY_DELAY = 320` — vihollisen askeleen tahti (ms)
- `CELL_SIZE = 32` — yhden ruudun pikselikoko
- `CORNER_RADIUS = 9` — pyöristetyn kaivureunan säde (px)
- `WORLD_ROWS = 21` — maailman korkeus riveinä
- `SKY_ROW = 0`, `SURFACE_ROW = 1`, `BEDROCK_ROW = 20`
- `VIEW_COLS = 23` — näkyvien ruutujen määrä vaakasuunnassa
- `INITIAL_LIVES = 3`
- `SCORE_DIAMOND = 10`, `SCORE_ENEMY = 25`, `SCORE_DROP = 5`,
  `SCORE_WORLD_BONUS = 500`

## Jatkokehitysideat

### Tasot / kenttäsuunnittelu
- [ ] **Lisää segmenttejä** — uusia 20×15-kenttärivejä `SEGMENTS`-taulukkoon
      (`levels.js`). Helppo tapa kasvattaa peliaikaa. Teemasegmentit: helppo
      alku, vesiputous, tiheä metsä, syvä kaivos, loppuhuipennus.
- [ ] **Kuilun täyttö -pulma** — pinnalla kuilu (ei nurmea); pelaaja joutuu
      työntämään/vetämään puun tai talon kuiluun päästäkseen yli.
- [ ] **Kivivyöryansat** — huone, jossa kiviä kasassa; yhden poistaminen
      laukaisee vyöryn.
- [ ] **Timanttihuone** — timantteja kivimuurin takana; kivi pitää siirtää
      pois tieltä.
- [ ] **Monikerroksisuus** — syvempiä pystyosuuksia (kaivoja, rotkoja).

### Pelimoottori
- [ ] **Uudet viholliset** — liero/mato (liikkuu mullassa, syö tunneleita),
      lepakko (nopea avoimissa luolissa), myyrä (kaivaa itse tunneleita).
- [ ] **Vesi/lava** — uusi `WATER`-ruututyyppi: leviää kaivettuihin tiloihin,
      hidastaa pelaajaa, kivet uppoavat, puu kelluu.
- [ ] **Räjähteet (TNT)** — räjähtää 3×3 alueelta, kun vierestä kaivetaan tai
      kivi työnnetään päälle; ketjureaktiot mahdollisia.
- [ ] **Paikallinen tallennus** — `localStorage`: pelaajan paikka, maailman
      tila ja pisteet talteen.
- [ ] **Pistemekaniikka** — ajanotto maailman läpäisystä + bonus nopeudesta;
      moninkertaiset pisteet peräkkäisistä timanteista.
- [ ] **Eri biomit** — kallio, hiekka, lumi eri osiin maailmaa.
- [ ] **Salahuoneita / bonus-aarteita** syvällä maan alla.
- [ ] **Ennätyspisteet** `localStorage`-tallennuksella.

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

Tavoite: pinnalla kaikki näyttää tutulta, mutta syvemmällä pelaaja törmää
jatkuvasti yllätyksiin, joista voi kertoa kavereille.

## Versiohallinta
- Paikallinen git-repo kansiossa. **Ei ole tarkoitus julkaista mihinkään.**
- Alkuperäinen pohja: Dig Däsh -peli (d427c08, tag `v1.0` poistettu).
- **v1.0: Dig Game** — yksi yhtenäinen maailma, maanpinta + puut/talot,
  pyöristetty kaivaminen, objektien työntö ja veto, pudotuspulma,
  tiedostonimi dig_game.html hakemiston digGame mukaan.

