# 🌀 Kaaosjärjestelmä – suunnitelma (AI CHAOS STREET)

> **Päivitetty 27.9.2026** – versio **v10.01** (`D:\AI\AI_street`, repo `aistreet`).
> **Tila: SUUNNITELMA – ei toteutettu.** Tämä tiedosto on tarkoitettu annettavaksi
> sellaisenaan toteutus-AI:lle. Käyttäjä ratkaisee tekniset yksityiskohdat kohta
> kerrallaan → avoimet päätökset on merkitty **`❓`** ja koottu lukuun 11.
> Rivinumerot ovat v10.01:stä (`street.js` ≈ 7 561 riviä); muokkaukset siirtävät rivejä,
> joten **tarkista sijainti aina myös funktion nimellä**.

---

## 0. Luovutusohje toteutus-AI:lle (lue tämä ensin)

1. Lue luvut **1–2** (pääsäännöt + tasomanifesti). Ne ovat sitovia.
2. Toteuta **vaihe kerrallaan** (luku 10) – ei koko katalogia yhdellä kertaa.
3. Sallitut tiedostot: **`street.js`** (kaikki kategoriat) · **`audio.js`** (vain K6, jos erikseen pyydetään).
   **EI** `index.html` · **EI** `gameState.js` · **EI** alipelikansioita.
4. Älä lisää yhtään uutta dialogia / popupia / ilmoitustekstiä
   (`.clinerules/06-ei-dialogeja.md`). Debug-tulosteet **vain konsoliin**.
5. Älä muuta lukittuja talousarvoja (K5) ilman käyttäjän nimenomaista rasti-ruutuun-pyyntöä
   (`.clinerules/04-economy-balance.md`).
6. Epäselvässä kohdassa: **kysy, älä arvaa.**
7. Versio: koodimuutos → `v10.01 → v10.02` (`index.html` → `#version-tag`).
   Pelkkä tämän dokumentin päivitys ei nosta versiota.
8. Älä committaa/pushaa ilman käyttäjän pyyntöä.

---

## 1. !!!PÄÄSÄÄNNÖT!!! (sitovat – ei poikkeuksia)

```
╔══ !!!PÄÄSÄÄNTÖ 1 – NORMAL EI SAA KOSKAAN HAJOTA!!! ═══════════════════════╗
║ Main game - NORMAL-taso pysyy täsmälleen ennallaan, kun tehdään caos-     ║
║ muutoksia. Jokainen kaaosarvo on NORMALissa NO-OP: CHAOS_DEFAULTS =       ║
║ nykyiset literaalit. NORMAL on jokaisen muutoksen regressioverrokki –     ║
║ jos NORMAL muuttuu, muutos on rikki, vaikka kaaos näyttäisi hienolta.     ║
╚═══════════════════════════════════════════════════════════════════════════╝
╔══ !!!PÄÄSÄÄNTÖ 2 – KOKO PELI PYSYY PELATTAVANA KAIKISSA MOODEISSA!!! ═════╗
║ Pelimoodeilla ei tee mitään, jos ne ovat pelikelvottomia. Epäreilu tai    ║
║ heti tappava arpa = hylätty arpa. Yksikään arpa ei mene peliin suoraan:   ║
║ jokainen kulkee clampChaosCfg() + validateChaosCfg() -portin läpi.        ║
║ Yllättävä = kyllä. Epäreilu = ei.                                         ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

**Miksi juuri nämä:** tarkoitus on tehdä pelistä *aidosti yllättävä jopa tekijälle itselleen*.
Kun combinaatioita on miljoonia, niitä **ei voi testata pelaamalla läpi**. Siksi pelattavuus
ei saa riippua testaamisesta vaan **rakenteesta**: arvot kulkevat portin läpi (luku 5), ja
portti takaa, ettei pelikelvotonta tilaa voi syntyä. Luku 9 kertoo, miten tämä validoidaan
koneellisesti ilman pelaamista.

---

## 2. Tasomanifesti (polaarisuus – tämä on koko designin ydin)

| Taso | Merkitys | Sääntö |
|---|---|---|
| **NORMAL** | nykyinen peli | kaikki arvot = nykyiset literaalit, ei yhtään kaaosakselia |
| **MILD** | hienovarainen vaihtelu | ±20–40 % nykyisestä, ei ääripäitä |
| **GOOD** | **miellyttävä ja kaunis** | vähän pilviä, paljon tähtiä ja eläimiä, lämmin paletti, rauhallinen liikenne, vähän uhkia |
| **BAD** | **synkkä ja vihamielinen** | paksut pilvet, lyijynharmaa taivas, vähän elämää, kova tuuli, tiheä ja nopea liikenne, paljon uhkia |
| **FULL** | arpa kumpaankin ääripäähän | sama peli, mutta kukaan ei tiedä mitä tulee – **aina pelattava** (klampit + C-indeksi) |

> **Tärkeää:** GOOD ei tarkoita "enemmän kaaosta" vaan **miellyttävämpää**. Nykyinen
> v10.01-koodi noudattaa jo tätä logiikkaa (`good`: tuuli 0.6, autoja harvemmin, lintuja
> eniten, rosvo 0.12 · `bad`: tuuli 2.0, `windDirFlip`, autoja tiheämmin, rosvo 0.75).
> **Uudet akselit on pakko noudattaa samaa polariteettia**, muuten tasot menevät sekaisin.

## 3. Nykytila (mitä kaaosjärjestelmä tekee v10.01:ssä)

| Asia | Sijainti |
|---|---|
| Alkuhubi (5 nappia: NORMAL / MILD / GOOD / BAD / FULL) | `index.html:14–24` (`#chaos-menu`) |
| Käynnistys: hubi → `Street.setChaos(level)` → `Street.init(canvas)` | `street.js:8101–8119` (`DOMContentLoaded`) |
| Oletusarvot (NORMAL) | `street.js:1451–1458` `CHAOS_DEFAULTS` |
| Arvot per taso | `street.js:1486–1521` `chaosProfile()` |
| FULL CHAOS -arpa | `street.js:1468–1484` `generateFullChaosSeed()` |
| Arvojen kirjoitus muuttujiin | `street.js:1523–1548` `applyChaosProfile()` (+ spawn-arpa 1543–1547) |
| Julkinen API | `street.js:1550–1553` `setChaos()` · vienti `8098` |
| Init (talovärit arvotaan joka latauksella) | `street.js:1555+`, `randomizeBuildingColors()` 1560 |

**Nykyiset kaaosakselit (12 kpl):** `windSpeedMult`, `windDirFlip`, `trafficSpeedMult`,
`trafficSpawnMult`, `dayCycleFrames`, `skyDir`, `birdMin`, `birdMax`, `coinRespawnFrames`,
`robberChance`, `robberSpeed`, `robberCooldown`, `robberTtl`.

**Tärkeä yksityiskohta:** `applyChaosProfile()` arpoo pelaajan spawn-paikan ja suunnan
**kaikilla tasoilla, myös NORMALilla** (1543–1547). Tämä on tarkoituksellinen forkin
ominaisuus → **ei korjata**. Dokumentin "NORMAL = nykyiset arvot" koskee *peliarvoja*.

**Toteutustapa (säilytä):** kaaos ei koskaan kirjoita pelilogiikkaan suoraan, vaan
olemassa oleviin `let`-muuttujiin (malli: 1527–1541). Tämä on turvallisin tapa myös uusille
akseleille: **arvo kirjoitetaan muuttujaan, ei hajallaan oleviin literaaleihin** – uusi
`let` tarvitaan vain siellä, missä arvo on nykyisin funktion sisäinen literaali.

---

## 4. Kategoriat K0–K7

| Kat. | Nimi | Saa muuttaa | Kova invariantti | Riskitaso | AI:n vapaus |
|---|---|---|---|---|---|
| **K0** | Infra / testi | seed, `?chaos=`, `?seed=`, konsolidumppi | ei näy pelaajalle, ei uusia dialogeja | – | vapaa |
| **K1** | **Visuaalinen (silmä)** | pilvet, tuuli, taivas, aurinko/kuu, tähdet, talojen värit, ikkunavalot, hehku, eläimet, linnut, lepakot, kuoriainen, katukalusteet, taustasiluetti | luettavuus (hahmo, ovet ja avoimet kaivot erottuvat; sumu α ≤ 0,5; ei täyspimennystä) + suorituskykykatot | **0 – ei voi rikkoa peliä** | **VAPAA: AI saa keksiä ja arpoa itse** |
| **K2** | Maailman kello & rytmi | päivän pituus, hämärä, lamppushow, spawn-tahdit, ikkunavalojen kesto | reagoitavuus: mikään ei muutu nopeammin kuin pelaaja ehtii nähdä | matala | puolivapaa (haarukat annetaan) |
| **K3** | **Uhka & reagoitavuus** | oviukon tn/nopeus/varoitus, rosvo (jo), liikenne, sähkökaappi | **kyvykkyysindeksi C** (luku 5): uhka ≤ 1,4 × C · varoitus ≥ 21/C frameä · uhkabudjetti | **korkea – ainoa kategoria joka voi tappaa** | vain listatut akselit + klampit |
| **K4** | **Pelaajan keho & reppu** | kävelynopeus `❓`, aloituskolikot 1–100, aloitus🍔 2–10, 🍔-kulutustahti, tainnutuksen kesto | selviytymisinvariantti (luku 5): 🍔 ≥ 2 ja ≤ 10; ei kuolemaa ilman pelaajan omaa valintaa | korkea | vain listatut akselit, klampit pakollisia |
| **K5** | **Talous & eteneminen 🔒** | syntymäpaketti, BAR/jukebox-hinnat, RTP, kaivon hinta, kolikon respawn (jo), rosvo vie rahat (jo) | `.clinerules/04`: vain nimenomaisella luvalla **per akseli** + kirjaus sääntöjen muutoshistoriaan | lukittu | **ei ilman rastia** |
| **K6** | Ääni & UI | syntikkatempo, volyymit, hiljaisuuden pituus, äänensävyt, olemassa olevat tekstit | `.clinerules/06`: ei uusia dialogeja/popupeja | 0 | vapaa (paitsi uudet tekstit) |
| **K7** | **Tapahtumakortit (yllätys)** | kesken session laukeavat kertaluonteiset tapahtumat | v1 = vain visuaalisia → luettavuus | matala (v1) | vapaa v1:ssä (whitelist) |

**Miksi kategoriat eivät ole "aiheet" vaan "vaikutukset":** aihepohjainen lista (tuuli, pilvet,
liikenne…) ei kerro, voiko muutos tappaa pelaajan. Vaikutuspohjainen jako kertoo heti,
**kuinka vapaat kädet AI:lla on** ja **mikä invariantti pitää tarkistaa**. Siksi K1 on vapaa,
K3/K4 rajoitettu ja K5 lukittu.

**Vanhan aihekatalogin uudelleenleikkaus (jos joku viittaa vanhaan A–L-listaukseen):**

| Vanha | Uusi kategoria |
|---|---|
| A tuuli & pilvet | K1 (+ K2 liikkeen nopeus) |
| B taivas, vuorokausi, tähdet | K1 (+ K2 päivän pituus) |
| C liikenne | K2 / K3 |
| D eläimet, linnut, lepakot, kuoriainen | **K1** (eivät vahingoita – puhdasta tunnelmaa) |
| E talot, ikkunat, valot | K1 |
| F lamput | K1 (hehku) / K2 (tahti) |
| G katukalusteet | K1 · avoin kaivo → K3 (esiintyminen) / K5 (hinta) |
| **H pelaaja, fysiikka, kamera** | **POISTETTU** – ks. alla |
| I vaarat (oviukko, rosvo, kaappi, ruukku) | K3 (+ K5 vahinkoarvot) |
| J talous | K5 🔒 |
| K ääni | K6 |
| L UI / tekstit | K6 (sääntö 06) |

**H-lohko poistettu kokonaan (27.9.2026):** painovoima, hyppy, potkun kesto, hit pause,
kamera (lerp/zoom), syvyysskaalaus, nälkävarotusraja, herätysrako. Nämä sotkevat pelin
hioitua tuntumaa (v4.70 vauhti–🍔-sidos, kamera, fysiikka) → **ei toteuteta**.
Ainoa jäljellä oleva rajatapaus on **kävelynopeus**, joka odottaa käyttäjän päätöstä (`❓`, luku 11).

## 5. Pelattavuuden matematiikka (pääsääntö 2 todistetaan tässä)

### 5.1 Kyvykkyysindeksi C

```
C = kaaosNopeuskerroin × 🍔-vauhtikerroin
    🍔-vauhtikerroin: ≤3 🍔 = 2/3 · 4–7 🍔 = 1 · ≥8 🍔 = 2      (street.js:300–318)
totalSpeed = PLAYER_SPEED × C = 1.225 × C  [px/frame]            (street.js:23)
NORMAL → C = 1.00
```

**Kaikki K3-uhkanopeudet ja varoitusajat suhteutetaan C:hen:** uhkan nopeus ≤ 1,4 × C ja
varoitusaika ≥ 21 / C frameä (NORMALin `AVENGER_TELEGRAPH = 21`, `street.js:356`).
Näin hidas pelaaja saa hitaammat uhkat ja pidemmän varoitusajan → kaaos on aina
**itse-konsistentti pelaajan todellisen kyvyn kanssa**. Tämä on pelattavuustakuun ydin.

### 5.2 Selviytymisinvariantti (K4: nälkä ei saa tappaa ilman omaa valintaa)

Lähtötiedot: maailma 800 px leveä (`WORLD_W`, `street.js:10`), **ilmainen ruoka = makuuhuoneen
sänky** (talo 7, ovi x ≈ 585; `Nuku` → +1 🍔, aina auki). Kauimpana sängystä (x = 0) matka on
**585 px**. Pahin tainnutus vie liikkumisajan mutta nälkä tikittää koko ajan
(oviukko 600 f `street.js:358`, rosvo 900 f) → **pahin tapaus 900 f**. Marginaali 300 f (5 s).

```
SÄÄNTÖ:  1.225 × C × (🍔-intervalli − tainnutusMaks)  ≥  585 + 300 = 885
   →      🍔-intervalli_min  =  tainnutusMaks + 885 / (1.225 × C)
```

| tainnutusMaks ↓ / C → | 0.50 | 0.67 (nälkäinen) | 1.00 (NORMAL) | 1.50 | 2.00 (täysi vatsa) |
|---|---|---|---|---|---|
| **900 f** (rosvo) | 2345 f ≈ 39 s | 1983 f ≈ 33 s | 1622 f ≈ 27 s | 1382 f ≈ 23 s | 1261 f ≈ 21 s |
| **600 f** (oviukko) | 2045 f ≈ 34 s | 1683 f ≈ 28 s | 1322 f ≈ 22 s | 1082 f ≈ 18 s | 961 f ≈ 16 s |
| **150 f** (lyhennetty) | 1595 f ≈ 27 s | 1233 f ≈ 21 s | **872 f ≈ 15 s** ✅ | 632 f ≈ 11 s | 511 f ≈ 9 s |
| **0 f** (ei tainnutusta) | 1445 f ≈ 24 s | 1083 f ≈ 18 s | 722 f ≈ 12 s | 482 f ≈ 8 s | 361 f ≈ 6 s |

**Lopputulokset, jotka menevät sääntöihin:**
1. **Kova lattia: 🍔-intervalli ≥ 1200 f (20 s)** – turvallinen kaikilla C ≥ 1.0 (taulukko).
2. **"15 s kiire" (900 f) on sallittu VAIN jos sama kaaos lyhentää tainnutuksen ≤ 150 f**
   (tai poistaa sen). Muuten 900 f = varma kuolema = hylätty arpa.
   → tainnutuksen lyhentäminen on sallittua ("ei koskaan pidempi kuin nyt"), joten
   *kiire + lyhyet tainnutukset* on sallittu kova yhdistelmä – ja se on hauska.
3. **"🍔 ei kulu juuri ollenkaan"** (intervalli 6000–12000 f) on aina sallittu helpotus.
4. **Aloitus🍔 kova raja: min 2, max 10.** 2 🍔 yhdessä lyhyen intervallin kanssa on
   sallittu vain kohdan 2 ehdoilla.
5. Kovakoodatut talousrajat säilyvät: katto 10, BAR 1 🪙 = 1 🍔, hinnat, RTP.

### 5.3 Kielletyt yhdistelmät (rejection sampling hylkää arvan)

| # | Kielto | Perustelu |
|---|---|---|
| 1 | 🍔-intervalli rikkoo kohdan 5.2 kaavan | kuolema ilman omaa valintaa = epäreilu |
| 2 | tainnutus pidempi kuin nyt (oviukko 600 f · rosvo 900 f) | "ei koskaan pidempi kuin nyt" |
| 3 | aloitus🍔 < 2 tai > 10 | käyttäjän kova raja |
| 4 | uhkan nopeus > 1,4 × C | kiinni jääminen ilman tekoja |
| 5 | varoitusaika < 21/C frameä | reagoimaton uhka |
| 6 | **uhkabudjetti ylittyy** = yli 3 uhka-akselia ääripäässä yhtä aikaa | uhkasuman hallinta |
| 7 | sumu α > 0,5 · täyspimennys · hahmon/ovien peitto | luettavuus |
| 8 | pilvet > 34 · tähdet > 140 · lepakot > 12 · linnut > 30 · valaistut ikkunat > 12 | suorituskyky (mobiili) |
| 9 | NORMALissa yksikin arvo ≠ nykyinen literaali | **pääsääntö 1** |
| 10 | spawn ajokaistalle y 328/340 läheisyyteen | nykyinen spawn-arpa (1543–1547) säilyy turvakäytävällä |

### 5.4 Uhka-akselit ja niiden "ääripää" (uhkabudjettia varten)

`avengerChance` · `avengerSpeed` · `avengerTelegraph` (käänteinen) · `robberChance` ·
`robberSpeed` · `trafficSpeedMult` · `trafficSpawnMult` (käänteinen) · `cabinetOnChance` ·
`manholeOpenChance` (🔒 K5). **Ääripää** = akselin arvo haarukan ylimmässä/alimmaisessa
10 %:ssa. Budjetti 3 estää sen, että pelaaja joutuisi samaan aikaan nopean oviukon,
nopean liikenteen ja tiheän rosvon keskelle.
## 6. Parametrikatalogi

**Toteutustapa:** `[V]` = pelkkä arvonvaihto (`const` → `let` tarvittaessa – **ei uutta logiikkaa**) · `[K]` = pieni koodimuutos (uusi `let`/lista/haara/piirtoarvo) · `[W]` = isompi työ (uusi piirtokoodi, ei kuulu ensimmäisiin vaiheisiin).
**Tasot:** M = MILD · G = GOOD · B = BAD · F = FULL (arpa).

### 6.1 K1 – Visuaalinen (vapaa – peli ei voi hajota)

| Tapa | Parametri | Nykyarvo | Rivi | M | G | B | F |
|---|---|---|---|---|---|---|---|
| V | `cloudCount` pilvien määrä | **18** | 3472 | 18–26 | 8–12 | **28–34** | 4–34 |
| V | pilven koko | cirrus 60–240 · hazy 80–300 | 3477, 3481 | ×1.2 | ×0.8 | **×1.4** | ×0.6–2.5 |
| V | pilven peittävyys | cirrus 0.005–0.020 · hazy 0.015–0.050 | 3478, 3482 | ×1.2 | ×0.7 | **×2.0** | ×0.5–2.5 |
| V | pilvikaista (top/korkeus) | 40 / 40 | 3471 | 40/40 | 20/40 | **10/70** | 10–100 |
| V | pilvityypin jakauma | cirrus 35 % | 3475 | 0.35 | 0.5 | 0.15 | 0–1 |
| V | `CLOUD_DAY_ALPHA` (päivän peittävyys) | 5 | 542 | 5 | 3 | 9 | 1–10 |
| V | päivätaivaan paletti | `DAY_SKY_TOP/MID/HORIZON` | 435–437 (käyttö 3959–3961) | nykyinen | aurinkoinen | **lyijynharmaa** | arvottu paletti |
| V | tuulen nopeus (näkyvä) | `2 + rnd*3` × `windSpeedMult` | 1149, 3468 | 0.8–1.3 | 0.5–0.7 | **2.0–3.5** ⭐ | 0.5–3.5 |
| V | tuulen suunnan vaihto | `windDirFlip false` | 1462 | false | false | true | arpa |
| K | puiden huojunta seuraa tuulta | `osc = 1.0 + windSpeed*0.10` · `amp = 0.65 + windSpeed*0.25` | 4895–4905 | – | – | – | (skaalautuu itse) |
| K | **auringon väri** | kovakoodi piirrossa | aurinko-piirto | – | kultainen | himmeä | **vihreä / verenpunainen / violetti** ⭐ |
| V | auringon koko/korkeus | `SUN_X 140` · `SUN_Y 62` · `SUN_R 26` | 450–451 | ×1 | ×1.1 | ×0.9 | 0.6–1.6× |
| V | kuun koko/korkeus | `MOON_Y 60` · `MOON_R 30` | 452 | ×1 | ×1.1 | ×0.9 | 0.6–1.8× |
| V | kuun pimeneminen | `MOON_SET_START 0.60` · `MOON_SET_DARK_ALPHA 0.15` | 457–458 | 0.15 | 0.08 | 0.3 | 0–0.4 |
| V | kuun hehku/kraatterit | `MOON_GLOW_A` ym. | 475–509 | – | runsas | himmeä | arvottu |
| V | **tähtien määrä** | **80** | 1627 | 60–100 | **120–140** | 15–30 | 0–140 |
| V | tähtien koko/kirkkaus | `r = rnd*1.5 + 0.5` · blink-faasi | 1631–1632 | ×1 | ×1.2 | ×0.8 | ×0.5–2 |
| V | tähdenlento/satelliitti tahti | tauot 600–2700 / 400–1300 | 2632–2676 | ×0.8 | ×1.5 | ×0.3 | ×0.1–5 |
| V | talojen väripaletti | `BUILDING_PALETTE` 18 sävyä + shuffle | 48–53, 55–69 | nykyinen | lämmin paletti | **lähes musta** | arvottu sävykierros |
| V | `corniceType` räystäs | 0–6 | 64 | 0–6 | 0–2 | 0–6 | 0–6 |
| V | `doorType` | `[0,1,3,5,6]` | 66–67 | nykyinen | nykyinen | nykyinen | nykyinen |
| V | taustan parallaksi | `BACKDROP_PARALLAX 0.4` | 410 | 0.4 | 0.3 | 0.6 | 0.2–0.7 |
| V | taustatalojen koko | w 14–35 · h 50–115 | 3562–3564 | nykyinen | pieni | suuri | arvottu |
| V | taustan valoikkuna | joka 3. talo | 3576 | 3 | 2 | 6 | 1–8 |
| V | ikkunavalojen määrä | **0–5** | 4364 | 3–6 | 5–8 | 0–2 | 0–12 |
| V | ikkunavalojen kesto | 10–30 s (`10000–30000 ms`) | 4348 | 10–30 | 20–60 | 3–10 | 3 s–5 min |
| V | ikkunan värijakauma | keltainen 60 · sininen 20 · punainen 20 | 4327–4330 | nykyinen | lämmin | kylmä | arvottu |
| V | `SILHOUETTE_CHANCE` | **0.50** (debug-arvo) | 4399 | 0.3 | 0.05 | 0.9 | 0.05–0.95 |
| V | päiväikkunan lasi | `WIN_DAY_FILL '#151716'` | 4395–4396 | nykyinen | vaalea | tumma | arvottu |
| V | lampun hehkusäde | `LAMP_RADIUS 30` | 1752 | 30 | 34 | 26 | 20–60 |
| K | lampun tolppasävy | `g = 35 + rnd*30` · `hsl(0,0%,g%)` (harmaa) | 1575–1577 | nykyinen | vaalea | tumma | arvottu sävy (vaatii sävykanavan) |
| K | lampun hehkun väri | piirto `drawLampGlow` | 6958–6998 | nykyinen | lämmin kulta | kylmä sinivihreä | arvottu sävy |
| V | **eläinten spawn-tiheys** | `900` f | 394, 2608 | 900–1500 | **400–700** | 2400–3600 | 200–3600 |
| V | eläintyypit & painot | `['mouse','mouse','rat','rat','rabbit']` | 2599 | nykyinen | enemmän pupuja | vain rottia | arvottu |
| V | eläinten nopeus | hiiri 1.8–3.0 · rotta 1.2–2.0 · pupu 1.5–2.3 | 2604–2606 | ×1 | ×1.2 | ×0.8 | ×0.4–2.5 |
| V | **eläimen suunta** | **50/50** (`rnd < 0.5`) | 2600 | 0.35–0.65 | 0.5 | **0 tai 1** | 0–1 |
| V | eläimen korkeus | `GROUND_Y−3 … +25` | 2602 | nykyinen | koko kaista | alaosa | arvottu |
| V | jäniksen hypyt/tauot | hyppy 8 % · tauko 120–600 | 2614–2618 | – | vilkas | rauhallinen | arvottu |
| K | lepakoiden määrä | 0–5 (`BAT_COUNT_MAX const`) · spawn 1800 f | 553, 2681–2703 | nykyinen | 0–3 | 8–12 | 0–12 · 600–3600 |
| V | lepakoiden nopeus/koko | 0.25–0.7 · siipi 2–9 · elinikä 900–3600 | 554–562 | ×1 | ×1 | ×1.3 | ×0.5–2 |
| V | lintujen koko/nopeus | siipi 2–5 · 0.2–0.6 | 567–573 | ×1 | ×1.2 | ×0.8 | ×0.6–1.8 |
| V | lintujen spawn-tahdit | alku 60–180 · per lintu 30–120 · oksa 180–720 | 2770, 2786, 2793 | ×1 | ×0.7 | ×1.5 | ×0.4–2 |
| K | kuoriaisten määrä/nopeus | 1 kpl · 0.3–0.6 | 3684–3690 | 1 | 2–3 | 0 | 0–3 · ×0.5–2 |
| V | reunakivien väli | 22–31 px | 3606 | ±20 % | tiheä | harva | 12–60 |
| V | kiveysrivit ja kiven koko | 4 riviä · 16–27 × 16–20 | 3627–3639 | nykyinen | nykyinen | nykyinen | 2–8 riviä |
| V | ruohotupsut / juuritupsut | 4 kpl · 3 / puu | 3644–3663 | nykyinen | runsas | niukka | 0–20 / 0–8 |
| V | viemärikansien höyry | 180–480 · α 0.15–0.25 · r 2–6 | 3670–3681, 3887–3893 | nykyinen | sakea | olematon | arvottu |
| V | sanomalehden paikka/kaltevuus | x 338–352 · ±0.05 | 3695–3699 | nykyinen | nykyinen | nykyinen | arvottu |
| W | sade / lumi / sumuverho | ei ole | uusi | – | – | – | (vaihe 4, K7) |

⭐ = **MUST-toteutus** (ks. luku 7).

### 6.2 K2 – Maailman kello & rytmi (puolivapaa: haarukat annetaan)

| Tapa | Parametri | Nykyarvo | Rivi | M | G | B | F |
|---|---|---|---|---|---|---|---|
| V | `DAY_CYCLE_FRAMES` (yön/päivän kesto) | 10800 | 453 | 7000–16000 | 14400 | 5400 | 4000–22000 *(jo kaaoksessa)* |
| V | `SUN_DAY_FRAMES` · `MOON_NIGHT_FRAMES` | = 10800 | 456, 464 | sidottu sykliin | sidottu | sidottu | sidottu *(jo)* |
| K | `DAY_FADE_FRAMES` · `NIGHT_FADE_FRAMES` (`const`) | 1200 · 1200 | 433–434 | 1200 | **1800–2600** (hidas kaunis auringonlasku) | 400–700 (äkillinen) | 300–3000 |
| K | `CYCLE_CHANGE_DELAY_FRAMES` (`const`) | 900 | 466 | 900 | 1500–2400 | 200–450 | 120–1800 |
| K | `NIGHT_LAMP_FIRST` · `NIGHT_LAMP_INTERVAL` (`const`) | 30 · 18 | 590–591 | ±30 % | 45 · 28 (hidas aalto) | 8 · 4 (rynnäkkö) | 4–90 · 2–60 |
| K | `SPAWN_LAMP_DELAY` (`const`) | 240 | 596 | 240 | 300 | 60 | 0–900 |
| V | `spawnTimers[300,300]` × `trafficSpawnMult` | 300 · 300 | 717 | *(jo kaaoksessa)* | | | |
| K | `CAB_BLINK_MIN/MAX` (`const`) | 420–700 | 140 | 420–700 | 300–800 | 200–400 | 120–1200 |
| K | `CAB_REROLL_MIN/MAX` (`const`) | 900–2100 | 141 | 900–2100 | 1800–3600 | 500–900 | 300–3600 |
| V | tähdenlennon/satelliitin tahti | 600–2700 · 400–1300 | 2632–2676 | ×0.8 | ×1.5 | ×0.3 | ×0.1–5 |
| V | ikkunavalojen tahti (kesto · tavoite) | 10–30 s · 0–5 | 4348, 4364 | *(ks. K1)* | | | |
| K | `MOSQUITO_DAY_DIM` (`const`) | 1 | 533 | 1 | 1 | 0 (hyttyset myös päivällä) | 0/1 |

> **Ei kosketa:** `MOON_SAVE_FRAMES` / `SUN_SAVE_FRAMES` (459, 465) ja `CLOSED_*` (aukiolo)
> – tallennus ja aukiolo eivät ole kaaosakseleita. Rosvon cooldown/TTL ovat jo kaaoksessa (6.3).

### 6.3 K3 – Uhka & reagoitavuus (**rajoitettu: vain nämä akselit + klampit**)

**Yleissääntö jokaiselle liikkuvalle uhkalle:** `nopeus ≤ 1.4 × C` **ja**
`varoitusaika ≥ max(12, ceil(21 / C))` frameä (12 f = 200 ms on luettavuuden lattia).

| Tapa | Akseli | Nykyarvo | Rivi | Klampi (pakollinen) | M | G | B | F |
|---|---|---|---|---|---|---|---|---|
| K | oviukon esiintymistn `AVENGER_CHANCE` (`const`) | 0.12 | 353 | `[0, 0.6]` + uhkabudjetti | 0.08–0.16 | 0.02–0.06 | 0.30–0.50 | 0–0.60 |
| K | oviukon nopeus `AVENGER_SPEED` (`const`) | 1.0 | 355 | `[0.5, 1.4 × C]` | 0.9–1.1 | 0.6–0.8 | 1.2–1.4·C | 0.5–1.4·C |
| K | varoitus `AVENGER_TELEGRAPH` (`const`) | 21 | 356 | `[max(12, 21/C), 45]` | 19–23 | 26–40 | 12–21 | `[max(12,21/C), 45]` |
| K | jäädytys `AVENGER_FREEZE` (`const`) | 180 | 359 | `[0, 300]`, BAD ≤ 180 | 150–210 | 240–300 | 60–180 | 0–300 |
| K | oviukon tauko `AVENGER_COOLDOWN` (`const`) | 1800 | 354 | `[600, 6000]` | 1400–2200 | 3000–5000 | 600–1200 | 600–6000 |
| V | rosvon esiintymistn `ROBBER_APPEAR_CHANCE` | 0.4 | 379 | `[0, 0.95]` | 0.25–0.55 | 0.12 | 0.75 | 0.05–0.90 |
| V | rosvon nopeus `ROBBER_SPEED` (+ spawn-arpa `×0.80…1.50`) | 1.05 → 0.84–1.575 | 369–371 | **arpa ≤ 1.4 × C** | 0.95–1.15 | 0.80–0.90 | 1.20–1.40·C | 0.7–min(2.0, 1.4·C) |
| V | rosvon tauko / elinikä | 1500 · 900 | 380, 382 | `[300,6000]` · `[300,2400]` | *(jo kaaoksessa)* | | | |
| V | liikenteen nopeus `trafficSpeedMult` | 1 | 1462 | `[0.6, 1.6]` + ylityssääntö | 0.85–1.2 | 0.85 | 1.45 | 0.6–1.6 |
| V | liikenteen tiheys `trafficSpawnMult` | 1 | 1462 | `[0.5, 2.5]`; sama kaista ≥ 90 f väli | 0.85–1.2 | 1.5 | 0.55 | 0.5–2.5 |
| K | kaappi päällä `ELECTRIC_CABINET_ON` (`const`) | 0.5 | 139 | `[0, 0.9]` | 0.4–0.6 | 0.10–0.25 | 0.70–0.90 | 0–0.90 |
| — | viemärinkansi (`MANHOLE_START_CHANCE` 1/6 · `RETURN` 1/10) | 737–738 | 737–738 | 🔒 **K5 – ei akselia** | – | – | – | – |
| — | kukkaruukku · auton törmäys · tainnutuksen pituus | kiinteät | – | **ei akselia** (tainnutus → K4) | – | – | – | – |

**Liikenteen ylityssääntö** (koneellisesti tarkistettava, koska autoja ei voi "juosta karkuun"):

```
ylitysFrames    = 67 / (1.225 × C)                  // kaista 343 → 310 = 67 px pystysuunnassa
saapumisFrames  = (WORLD_W + autonLeveys) / autonNopeus   // lue nopeudet updateTraffic():ista
vaaditaan:        saapumisFrames ≥ ylitysFrames / 0.6     // 40 % turvamarginaali
```

**Miksi K3:n nopeudet on pakko kytkeä C:hen:** nykyinen FULL-arpa antaa rosvon nopeudeksi
jopa **2.0** (`street.js:1480`) samalla kun nälkäinen pelaaja liikkuu **0.817 px/f** → rosvo
(1,5× kovempi) ja oviukko (1,0) tavoittavat väistämättä. Klampi korjaa tämän: kaaos on
armoton mutta **aina voitettavissa**. Tämä on ainoa kohta, jossa vanhaa FULL-arpaa kavennetaan.

### 6.4 K4 – Pelaajan keho & reppu (**rajoitettu; 🔒 = vaatii käyttäjän rastin**)

| Tapa | Akseli | Nykyarvo | Rivi / tiedosto | Klampi | M | G | B | F |
|---|---|---|---|---|---|---|---|---|
| K | **kävelynopeus** `PLAYER_SPEED` / `hungerSpeedMult()` | 1.225 · 2/3·1·2 | 23, 300–318 | `❓` ks. luku 11 (vaihtoehdot a–d) | – | – | – | – |
| 🔒 | aloituskolikot (syntymäpaketti) | 2 | `gameState.js` | `[1, 100]` (käyttäjän kova raja) | – | – | – | 1–100 |
| 🔒 | aloitus🍔 | 5 | `gameState.js` | **`[2, 10]` – ehdoton** | 4–6 | 6–10 | 2–3 | 2–10 |
| 🔒 | 🍔-kulutustahti `hamburgerTimer` | 2400 (1/40 s) | 283 | `≥ max(1200, luku 5.2 kaava)` | 1800–3600 | 3000–4800 | 1200–2400 | 1200–12000 |
| K | herätysrako `HUNGER_WAKE_GRACE` | 600 | 288 | **`[600, 1800]` – ei koskaan lyhyempi** | 600–900 | 900–1800 | 600 | 600–1800 |
| K | tainnutus `AVENGER_STUN` · `ROBBER_STUN` | 600 · 900 | 358, 385 | **≤ nykyinen** (600 / 900) | ±10 % | sama | sama | 150–900 · *jos 🍔-intervalli < 1200 → ≤ 150* |
| 🔒 | 🍔-katto | 10 | `gameState.js` · BAR | **kiinteä 10** | 10 | 10 | 10 | 10 |
| 🔒 | 🍔-vauhtikynnykset (2/3 · 1 · 2) | 300–318 | 300–318 | **kiinteä** – C-indeksin perusta | | | | |

> **Huom.** Rastilliset (`🔒`) akselit ovat sääntö 04:n lukittuja arvoja. Jos ne otetaan
> kaaokseen, toteutuksen yhteydessä on pakko (a) saada käyttäjältä nimenomainen hyväksyntä
> **per akseli**, (b) kirjata ennen/jälkeen sääntöön `04-economy-balance.md` ja
> `docs/economy-balance-memo.md`, (c) todeta että "🍔-intervalli + aloitus🍔" -yhdistelmä
> läpäisee luvun 5.2 invariantin. **Kevyt vaihtoehto:** jätä rastilliset akselit NORMAL-arvoihin
> ja toteuta vain ei-rastilliset (tainnutus, herätysrako, kävelynopeus `❓`).

### 6.5 K5 – Talous & eteneminen 🔒 (EI MUUTETA ILMAN ERILLISTÄ PYYNTÖÄ)

| Lukittu | Arvo | Lähde |
|---|---|---|
| Syntymäpaketti | 2 🪙 + 5 🍔 | `gameState.js` `defaultState.inventory` |
| BAR | 1 🪙 = 1 🍔, katto 10, peruutus vain vierailun ostot | `street.js`, sääntö 04 |
| Jukebox | 1 🪙 / kappale | `street.js`, `docs/jukebox-memo.md` |
| Hedelmäpeli | panos 1 · painot · maksut · RTP ≈ 78,5 % · ilmainen 1/120 s | `fruitgame/js/constants.js` |
| Kadun kolikko | 1 kerrallaan, respawn 7200 f *(jo kaaosakseli)* | `street.js` |
| Kolikko potkusta | 1/5 + cooldown 1800 f | `street.js` |
| Kaivo | `MH_COIN_COST 2` · `MH_BONUS_CHANCE 1/6` · `MH_BONUS_COINS 3` · `MANHOLE_START_CHANCE 1/6` · `MANHOLE_RETURN_CHANCE 1/10` | `street.js:737–741` |
| Rosvo | vie **kaikki** rahat + −1 🍔 (v4.68) | `street.js` |
| Oviukko / kukkaruukku / sähkökaappi | −1 🍔 | `street.js` |
| Aukiolo (BAR, jukebox, hedelmäpeli) | vain klo 20–06 | `street.js` `CLOSED_SIGN` |
| Makuuhuone (talo 7) | aina auki, ilmainen, Nuku → +1 🍔 | `street.js` |

> **Tärkeä huomio toteuttajalle:** nykyinen kaaosjärjestelmä (v5.03/v10.01) **koskettaa jo
> kahta tässä lukittua akselia** – `coinRespawnFrames` ja rosvo (`robberChance/Speed/Cooldown/Ttl`).
> Tämä on forkin alkuperäinen ominaisuus → **älä "korjaa" sitä äläkä poista akselia**.
> Sääntö "ei uusia lukittuja akseleita ilman rastia" koskee **uusia akseleita**.

### 6.6 K6 – Ääni & UI (vapaa paitsi uudet tekstit)

> **Huom:** `audio.js`-rivit → tiedoston muokkaus on sallittu vain, jos käyttäjä pyytää
> K6-osuuden erikseen (luku 0, kohta 3). Ilman `audio.js`-lupaa K6 toteutetaan vain
> `street.js`:stä käsin (SFX-tasot, `setHungerTempo`-haarukka).

| Tapa | Akseli | Nykyarvo | Rivi | M | G | B | F |
|---|---|---|---|---|---|---|---|
| K | syntikkatempo `BPM_MIN` · `BPM_MAX` | 110 · 142 | `audio.js` 50–51 | ±8 | 96–128 (rento) | 120–160 (kiire) | 80–180 |
| K | oletus-`BPM` | 138 | `audio.js` 52 | 138 | 110–126 | 142 | arvottu |
| K | `MUSIC_VOLUME` | 0.05 | `audio.js` 36 | ±10 % | 0.05 | 0.04 | 0.03–0.08 |
| K | `JUKEBOX_VOLUME` · `JUKEBOX_GAP` | = MUSIC_VOLUME · 2500 | `audio.js` 40–41 | ±10 % | 4000 | 1200 | 500–6000 |
| K | `melodyReverse` | arvotaan joka loopilla | `audio.js` 692 | ei pakotusta | ei | aina | arpa |
| K | synkän tilan pituus (syntikan hiljaisuus) | nykyinen | `audio.js` ~614 | ±20 % | lyhyt | **pitkä** | 0–pitkä |
| V | SFX-tasot (kolikko, potku, osuma, kuolema) | nykyiset | `street.js` 1154–1332 | ±10 % | pehmeä | terävä | arvottu |
| — | **uudet tekstit / popupit** | – | – | 🚫 **sääntö 06: ei koskaan ilman lupaa** | | | |

### 6.7 K7 – Tapahtumakortit (v1 = vain visuaalisia)

**Mekaniikka:** arvottu "korttipakka", jonka kortit laukeavat itsestään kesken session ja
**palautuvat itsestään**. Kortti ei koskaan vahingoita pelaajaa eikä koske talouteen.

| Sääntö | Arvo |
|---|---|
| Ensimmäinen kortti aikaisintaan | 60 s pelin alusta |
| Korttien väli | 90–300 s (arvottu) |
| Yhtä aikaa aktiivisia | **1** |
| Kortteja / sessio | 3–6 |
| Kesto / kortti | 8–60 s (korttikohtainen) |
| Sallitut vaikutukset | **vain K1-akselit** (luku 6.1) |
| Kielletyt | talous, nälkä, uhkat, tekstit, uudet äänet ilman lupaa |

| # | Kortti | Vaikutus | Kesto |
|---|---|---|---|
| 1 | **Vihreä hetki** ⭐ | auringon/kuun väri vaihtuu (vihreä, violetti, verenpunainen) + taivaan sävy | 20–40 s |
| 2 | **Tähtisade** | 30–60 tähdenlentoa lyhyessä ajassa | 6–10 s |
| 3 | **Sumu nousee** | sumuverho α 0.25–0.45 (≤ 0.5, luettavuus) | 30–60 s |
| 4 | **Tuulenpuuska** | `windSpeed ×2–3` + puut nojaavat rajusti | 15–30 s |
| 5 | **Valot sammuvat** | kaikki lamput + ikkunat sammuvat, sitten takaisin | 4–8 s |
| 6 | **Kaikki ikkunat syttyvät** | 8–12 ikkunaa kerralla (raja 12) | 20–30 s |
| 7 | **Eläinparaati** | 3–5 eläintä kerralla | 10–20 s |
| 8 | **Värien vaihto** | talojen paletti sekoittuu uudelleen (pehmeä siirtymä 2 s) | pysyvä |
| 9 | **Taivaan vaihto** | päivätaivaan paletti vaihtuu hetkeksi (esim. myrsky) | 30–60 s |
| 10 | **Tähtitaivas täyteen** | tähdet 80 → 140 (raja) yötaivaalla | 20–40 s |

> **v2 (ei nyt):** pelaajaan vaikuttavat kortit (sade → liukkaus, sähkökatko → valot pois +
> uhkat nopeammin). Ne koskevat K3/K4:ää → vaativat invariantin uudelleen tarkistuksen.
> **v3:** kortit voivat ketjuuntua (2 aktiivista). **v1 pidetään puhtaana.**

---

## 7. MUST-kohteet (käyttäjän kolme pakollista)

| # | Kohde | Miten | Miksi halpa & näkyvä |
|---|---|---|---|
| 1 | **Kova tuuli** | `windSpeedMult` BAD 2.0–3.5 · FULL 0.5–3.5 · MILD 0.8–1.3. Vaikuttaa **itse**: pilvet kiitävät (`initClouds` 3468), puut nojaavat ja huojuvat (`drawTrees` 4902–4904: `amp = (0.65 + windSpeed*0.25)`) | yksi kerroin, koko kadun elämä muuttuu |
| 2 | **Paksut pilvet + synkkä myrskytaivas** | `cloudCount` 28–34 (nyt 18) · peittävyys ×2 · `CLOUD_DAY_ALPHA` 5 → 9 · `DAY_SKY_TOP/MID/HORIZON` → **lyijynharmaa** (vain BAD; NORMAL säilyttää nykyiset `#3f7fc0` / `#78b4e0` / `#ffd9a0`) | arvonvaihto, mutta silmiinpistävin mahdollinen |
| 3 | **Vihreä aurinko** | auringon väri muuttujaksi (nyt kovakoodi piirrossa): NORMAL = nykyinen piirto bitti-identtisenä, GOOD = kultainen, BAD = himmeä verenpunainen, FULL/K7 = **vihreä / violetti / verenpunainen** | yksi väriarvo → koko tunnelma vaihtuu |

**Toteutusjärjestys:** 1 → 2 → 3 (kaikki `street.js`, ei uusia tekstistöjä eikä talousvaikutusta).

---

## 8. Toteutusresepti

### 8.1 Portti (kirjoita tämä ensin – kaikki muu nojaa siihen)

```js
/* ═══ KAAOS v2 – portti (v10.02) ═════════════════════════════════════════
   Kaikki kaaosarvot kulkevat clampChaosCfg() → validateChaosCfg() -portin
   läpi. NORMAL = nykyiset literaalit → peliin ei tule mitään muutosta.     */

// 1) Kyvykkyys (luku 5.1)
function chaosSpeedMult() { return chaosCfg.playerSpeedMult || 1; }
function chaosAbility()   { return chaosSpeedMult() * hungerSpeedMult(); }
function stunMaxOf(cfg)   { return Math.max(cfg.avengerStun, cfg.robberStun); }

// 2) Selviytymisinvariantti (luku 5.2)
const BURGER_INTERVAL_FLOOR = 1200;                 // kova lattia
function burgerIntervalMin(cfg, C) {
    return Math.max(BURGER_INTERVAL_FLOOR, Math.ceil(stunMaxOf(cfg) + 885 / (1.225 * C)));
}

// 3) Uhka (luku 5.3)
function threatSpeedMax(C)     { return 1.4 * C; }
function threatTelegraphMin(C) { return Math.max(12, Math.ceil(21 / C)); }
function threatBudget(cfg) {                        // montako uhkaa ääripäässä (max 3)
    const ext = (v, lo, hi) => (v <= lo + (hi - lo) * 0.1 || v >= hi - (hi - lo) * 0.1) ? 1 : 0;
    return ext(cfg.avengerChance, 0, 0.6) + ext(cfg.avengerSpeed, 0.5, 1.4)
         + ext(cfg.robberChance, 0, 0.9) + ext(cfg.robberSpeed, 0.7, 2.0)
         + ext(cfg.trafficSpeedMult, 0.6, 1.6) + ext(cfg.trafficSpawnMult, 0.5, 2.5);
}

// 4) Portti: klampit
function clampChaosCfg(cfg) {
    const C = chaosAbility();
    const c = Object.assign({}, cfg);
    c.cloudCount       = clamp(c.cloudCount, 4, 34);
    c.cloudOpacityMult = clamp(c.cloudOpacityMult, 0.4, 2.5);
    c.windSpeedMult    = clamp(c.windSpeedMult, 0.4, 3.5);
    c.starCount        = clamp(c.starCount, 0, 140);
    c.avengerChance    = clamp(c.avengerChance, 0, 0.6);
    c.avengerSpeed     = clamp(c.avengerSpeed, 0.5, threatSpeedMax(C));
    c.avengerTelegraph = clamp(c.avengerTelegraph, threatTelegraphMin(C), 45);
    c.avengerStun      = clamp(c.avengerStun, 150, 600);      // ei koskaan pidempi kuin nyt
    c.robberStun       = clamp(c.robberStun, 150, 900);
    c.robberSpeed      = clamp(c.robberSpeed, 0.7, threatSpeedMax(C));
    c.trafficSpeedMult = clamp(c.trafficSpeedMult, 0.6, 1.6);
    c.trafficSpawnMult = clamp(c.trafficSpawnMult, 0.5, 2.5);
    c.startBurgers     = clamp(c.startBurgers, 2, 10);        // ehdoton
    c.startCoins       = clamp(c.startCoins, 1, 100);
    c.hungerWakeGrace  = clamp(c.hungerWakeGrace, 600, 1800);
    c.burgerInterval   = Math.max(c.burgerInterval, burgerIntervalMin(c, C));  // 🍔-tahti
    c.fogAlpha         = clamp(c.fogAlpha, 0, 0.5);
    return c;
}

// 5) Portti: hyväksyntä – hylkää epäreilu arpa (pääsääntö 2)
function validateChaosCfg(cfg) {
    const C = chaosAbility(), errs = [];
    if (cfg.burgerInterval < burgerIntervalMin(cfg, C))     errs.push('burgerInterval < kaava');
    if (cfg.avengerSpeed > threatSpeedMax(C))               errs.push('avenger liian nopea');
    if (cfg.robberSpeed  > threatSpeedMax(C))               errs.push('robber liian nopea');
    if (cfg.avengerTelegraph < threatTelegraphMin(C))       errs.push('varoitus liian lyhyt');
    if (stunMaxOf(cfg) > 900)                               errs.push('tainnutus raja');
    if (cfg.startBurgers < 2 || cfg.startBurgers > 10)      errs.push('aloitus🍔 raja');
    if (threatBudget(cfg) > 3)                              errs.push('uhkabudjetti');
    if (cfg.fogAlpha > 0.5)                                 errs.push('sumu liian sakea');
    return errs;
}

// 6) FULL-arpa: enintään 40 yritystä, muuten turvallinen arpa
function drawChaosCfg(level) {
    if (level !== 'full') return clampChaosCfg(chaosProfile2(level));
    for (let i = 0; i < 40; i++) {
        const cfg = clampChaosCfg(generateFullChaosSeed2());
        if (validateChaosCfg(cfg).length === 0) return cfg;
    }
    console.warn('[chaos] arpa hylättiin 40× – käytetään klampattua arpaa');
    return clampChaosCfg(generateFullChaosSeed2());
}
```

### 8.2 Deterministinen siemen (`?seed=`) + testikytkimet

```js
function makeRng(seed) {                     // mulberry32 – sama siemen = sama peli
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
let chaosRng = Math.random;                  // oletus: nykyinen satunnaisuus (NORMAL ennallaan)
function rnd(a, b) { return a + chaosRng() * (b - a); }   // korvaa vanha rnd (1465)
```

| Kytkin | Merkitys |
|---|---|
| `?chaos=normal\|mild\|good\|bad\|full` | valitsee tason valmiiksi ja **ohittaa alkuhubin** (testikäyttö) |
| `?seed=12345` | kiinnittää arvan → sama kaaos joka latauksella (reproduktio) |
| `?debug` | konsoliin `console.table(chaosCfg)` + `validateChaosCfg()`-tulokset + `C`, `burgerIntervalMin` |

**Säännöt:** kytkimet eivät tallenna mitään (`gameState.js` ei muutu), eivätkä ne näy pelaajalle.
Kaaosarvot lisätään `chaosProfile()`-lohkojen **loppuun**, jotta vanhojen tasojen arvontajärjestys
pysyy luettavana. Alkuhubi (`#chaos-menu`) säilyy oletuspolkuna: hubi → `setChaos()` → `init()`.

### 8.3 `const` → `let` -muunnokset ja uudet muuttujat

**Muutettavat vakiomuuttujat (`const` → `let`, arvo asetetaan `applyChaosProfile()`issa):**

`DAY_FADE_FRAMES` · `NIGHT_FADE_FRAMES` · `CYCLE_CHANGE_DELAY_FRAMES` · `CLOUD_DAY_ALPHA` ·
`DAY_SKY_TOP/MID/HORIZON` · `MOON_SET_DARK_ALPHA` · `NIGHT_LAMP_FIRST` · `NIGHT_LAMP_INTERVAL` ·
`SPAWN_LAMP_DELAY` · `CAB_BLINK_MIN/MAX` · `CAB_REROLL_MIN/MAX` · `ELECTRIC_CABINET_ON` ·
`AVENGER_CHANCE/SPEED/TELEGRAPH/FREEZE/COOLDOWN` · `BAT_COUNT_MAX` · `MOSQUITO_DAY_DIM` ·
`LAMP_RADIUS` · `DAY_LIGHT_ALPHA` · `SILHOUETTE_CHANCE` · `WIN_DAY_FILL`.

**Uudet `let`-muuttujat (kaikki alustetaan NORMAL-arvoihin):**
`cloudCount` 18 · `cloudOpacityMult` 1 · `cloudBandTop` 40 · `cloudBandH` 40 ·
`cloudCirrusShare` 0.35 · `starCount` 80 · `starSizeMult` 1 · `sunColor`/`sunGlow` (nykyinen piirto) ·
`animalSpeedMult` 1 · `animalDirBias` 0.5 · `animalTypeWeights` (nykyinen lista) ·
`batSpawnFrames` 1800 · `birdSpeedMult` 1 · `beetleCount` 1 · `windowTargetMax` 5 ·
`windowDurMin/Max` 10000/30000 · `lampHueShift` 0 · `threatWarnMult` 1.

**Nyrkkisääntö:** NORMALissa jokainen yllä oleva saa **täsmälleen nykyisen arvon** → peli on
bitti-identtinen, vaikka koodi muuttuu. Tarkista tämä vertaamalla NORMAL-kuvaruutukaappaus
ennen/jälkeen (`?chaos=normal`).

### 8.4 Ansa: meteorit/satelliitti ovat koodissa kahdesti

Sama logiikka on **kahtena kappaleena**: täysi versio `street.js:2632–2676` ja **yhden rivin
kopio `street.js:2302–2303`**. Jos tähdenlentotahtia kaaostetaan, **kumpikin kohta on
päivitettävä** (tai yhteinen `meteorInterval()`-apufunktio otettava käyttöön – suositeltava,
mutta se on pieni refaktorointi → kysy käyttäjältä). Muuten kaaosarvo vaikuttaa vain toiseen
puoliskoon ja efektit "vuotavat".

### 8.5 Mitä EI saa koskea (edes kaaoksen nimissä)

| Kohde | Sijainti | Miksi |
|---|---|---|
| Fysiikka, hyppy, törmäyslaatikot, hit pause, kamera | `street.js` (`updateCamera` 1757+, `hitPauseTimer` 397) | H-lohko poistettu – pelin tuntuma on hiottu |
| Pelaajan spawn-arpa | `applyChaosProfile` 1543–1547 | tarkoituksellinen forkin ominaisuus, säilyy kaikilla tasoilla |
| `gameState.js` (tallennus, inventaario, migraatiot) | `gameState.js` | sääntö 01 – pääsivun suojatut tiedostot |
| `index.html` (paitsi `#version-tag` koodimuutoksen yhteydessä) · `style.css` | – | sääntö 01 |
| Alipelit `digGame1/` `digGame2/` `bm/` `fruitgame/` | – | sääntö 01/02 |
| Testikytkimet `?day=`, `?hole=`, `?cabs=`, `?coins=`, `?burgers=`, `?bldg=`, `?bldgtarget=`, cheat-nupit | `street.js` | työkaluja, ei pelisisältöä |

---

### 8.6 Meteoriitin talotuhot (v11.22, jälkitila v11.24, tahti v11.26) – mekaniikka, ei kaaosakselia

Meteoriitteja syntyy **vain BADissa (25 %) ja FULLissa (aina)** → MILD/GOOD/NORMAL eivät voi
tuhota taloja. Talotuhot eivät siis ole uusi kaaosakseli vaan **meteoriitin eskalaatio**:

1. Osuma **raunioittaa** 3 taustataloa (**v11.26:** kohteeksi kelpaa vain ehjä lohko ja eteenpäin
   kerätään vain ehjiä → osuma ei enää hukkaannu jo raunioituneeseen lohkoon): lohko ei
   enää katoa, vaan horisonttiin jää **runko** 55–80 % korkeudesta (2–4 pystypalkkia + 2–4
   laattaviivaa = seinät puuttuvat) sekä 1–3 **seinäpalaa**. Toinen osuma samaan lohkoon murentaa
   yhden seinäpalan, muttei enää laske runkoa (`drawBackdropRuin`).
2. Kun **ehjiä** lohkoja on jäljellä ≤ 60 % (v11.26; ennen 25 %) (`BACKDROP_GONE_SHARE`, `backdrop.total`;
   `backdropMostlyGone()` laskee `!b.ruin`), meteoriitti
   **tähdätään katuvarren taloon**: `pickBuildingTarget()` valitsee satunnaisen **ehjän** talon,
   mutta **BAR (idx 8) vasta kun muut 8 on tuhottu** (🍔-kauppa säilyy pisimpään).
3. `makeAimedMeteor(idx)` ratkaisee kulman `atan2(GROUND_Y − y0, |laidan x − kohteen x|)`
   (käytännössä ~35–82°) ja lähtee lähimmältä laidalta hieman ruudun ulkopuolelta → osuma osuu
   tarkalleen talon kohdalle; lento on sama fysiikka kuin ennen (näkyvissä ~5–22 s).
4. Animaatio (`BLDG_DMG_PHASES`, 360 f ≈ 6 s): flash → shake → black → burn → outline → fade →
   `'gone'`. **Jälkitila (v11.24):** talon paikalle jää randomi **musta romukasa**
   (`buildingRubble`, korkeus **aina ≤ `DOOR_H/2` = 16 px**), ja **mustia ovia ei piirretä
   lainkaan** – vain **yksi satunnainen talo** pitää ovensa pystyssä pelkkinä **ulkokarmina**
   (`standingDoorIdx`, arpa kerran tuhoutumishetkellä). Kynnysvalo sammuu,
   sähkökaappi katoaa, kuunvarjo ja K1-ikkunavalon jäävät pois ja **säde läpäisee** talon.
   Osumaääni on pelkkä murskautuva kohina: soiva matala jyrinä (huippu 1,8 s) poistettiin
   v11.24, koska se kuulosti kongin/patarummun kumahdukselta juuri osumahetkellä.
5. **Meteoriitit putoavat talojen TAKANA (v11.24):** myös tähdätty meteoriitti piirretään samassa
   taivas-/siluettikerroksessa kuin muut → pelaaja **ei näe itse iskua**, vain välähdyksen ja
   tuhon alun. `meteoriteBehindBuilding()` estää osuman, kun meteoriitti on talon rungon kohdalla
   → **FULLissa meteoriitti on ammuttavissa niin kauan kuin se on katon yläpuolella** (2 osumaa +
   1 s lukko). **BAD = vääjämätön** (ei sädeasetta – moodin ironia).
6. **BAD-avaus (v11.24):** BAD = BAD – noin 2 s kadulle tulosta (`BAD_DEMO_DELAY 120`,
   `updateBadDemo`, vain kadulla ja vain yön haarassa) yksi **satunnainen talo 0–8 tuhoutuu
   malliksi**. **BAR (8) on mukana arvassa**, joten BADissa voi menettää 🍔-kaupan heti. Kerran
   per kierros; testikytkimet `?baddemo=0` (pois) / `?baddemo=N` (pakota talo N).

Tila on **vain muistissa** (`buildingDmg`, `buildingRubble`, taustarivien `b.ruin`,
`badDemoDone`) → `init()` palauttaa kaiken (kuolema/F5/✕).
Ei talousmuutoksia (ei kolikoita eikä 🍔:tä tuhosta) eikä uusia dialogeja (sääntö 06).
Testikytkimet: `?bldg=1` (eskalaatio heti), `?bldgtarget=N` (pakota kohdetalo N),
`?baddemo=0/N` (BAD-avaus pois/pakotettu talo).
Validointi (v11.26): `%TEMP%\street-meteor-tempo-test.cjs` (42 tarkistusta: tahti, portti, 0 hukkaosumaa,
finaali, FULL/NORMAL-takuu), `%TEMP%\street-meteor-aftermath-test.cjs` (68 tarkistusta),
`%TEMP%\street-building-collapse-test.cjs` (66 tarkistusta),
`%TEMP%\street-meteor-coin-test.cjs` (23/23), `%TEMP%\street-beam-daylight-test.cjs` (22) +
`chaos-normal-check` (78 avainta, 0 eroa).

### 8.7 BAD CHAOS -tahti ja finaali (v11.26) - mekaniikka, ei kaaosakselia

Käyttäjän havainto 29.9.2026: *"Olen 15 min plannut ja vain yksi pääkadun talo on nurin ... alakaupungin
talot edelleen 1/3 osa pystyssä ja pääkadun talot odottavat tuhoaan, mikä on tylsää. Tuho pitäisi tulla
nopeammin."* Ennen v11.26:ää portti vaati 75 % taustarivistä raunioina ja osumat saattoivat mennä hukkaan,
joten portti aukesi vasta ~9-12 osumalla; lisäksi BADissa tuli vain ~1 meteoriitti / 50 s yötä (25 % arpa,
arpaväli 3-13,5 s + lento 6-17 s) → koko tuho kesti ~30-40 min.

| Nuppi | Ennen | Nyt (v11.26) |
|---|---|---|
| `BACKDROP_GONE_SHARE` | 0.25 (75 % raunioina) | **0.60** (~40 % raunioina) |
| `destroyBackdropHouses` | lähin + 2 seuraavaa lohkoa (raunio saattoi niellä osuman) | **lähin EHJÄ + seuraavat ehjät** → aina 3 uutta rauniota |
| `pickBuildingTarget` | ohitti vain `'gone'` | **ohittaa myös kesken olevan romahduksen** (muuten `startBuildingCollapse` hylkäsi osuman) |
| `meteoriteChance()` BAD | 0.25 | **0.50** |
| BAD-profiilin `meteorTempoMult` | 0.3 | **0.15** (arpaväli 1,5-6,75 s) |
| BAD-finaali (`badFinalePhase()`) | - | **ei tähtiä lainkaan + väli `BAD_FINALE_GAP_MIN/MAX` 260-420 f** (4,3-7 s) |

Uusi `nextSkyGap()` valitsee seuraavan taivaankappaleen välin: **FULL = 600 f** (ennallaan) ·
**BAD-finaali = 260-420 f** · muuten entinen arpa `(600 + rand·2100) × meteorTempoMult`
(arvontajärjestys ennallaan → NORMAL bitti-identtinen). FULL pysyy muutenkin entisellään (chance 1, 600 f,
ammuttavissa alas); portin lasku koskee myös FULLia, koska kynnys on yhteinen.

Mitattu (`%TEMP%\street-meteor-tempo-test.cjs`, 24 siementä × 4 yötä): osumia porttiin **8,4 → ka 4,5**,
meteoriitteja **~1,7 → ka 5,6 / yö**, ensimmäinen katuvarren talo **ka 1,2 yössä (max 1,7)** ja kaikki
9 taloa **ka 2,5 yössä (max 3,0)** ≈ **~8 min reaaliajassa** (yö = 90 s joka toinen jakso; ennen ~30-40 min).

---

## 9. Testaus & validoinnin määritelmä (DoD)

> **Muistutus:** sääntö 05 on päivitetty 27.9.2026 – AI **saa** testata ja kirjoittaa testiskriptejä
> oman harkintansa mukaan (erityisesti kaaos-/rakennevalidointi). Kohdat 9.1–9.3 ovat mekaanisia
> tarkistuksia, jotka AI saa ajaa tarpeen mukaan. Käyttäjän silmä on lopullinen tuomari ulkoasussa
> ja pelituntumassa.

### 9.1 NORMAL-snapshot (pääsääntö 1)

1. Aja `?chaos=normal` ja ota kuvaruutukaappaus (yö + päivä: `?day=0`, `?day=1`).
2. Vertaa v10.01:n vastaaviin kaappauksiin → **eroja ei saa olla**.
3. `?debug` → konsolissa `validateChaosCfg()` = tyhjä ja `chaosCfg` = `CHAOS_DEFAULTS`-arvot.

### 9.2 Offline-linteri (vapaaehtoinen, pyydettäessä)

Node-skripti, joka lukee `street.js`:stä `CHAOS_DEFAULTS2` + tason haarukat ja ajaa 10 000
arpaa läpi `clampChaosCfg()` + `validateChaosCfg()`:llä. Läpäisyehto: **0 hylättyä** ja
jokaisella arvalla `stunMaxOf ≤ 900`, `burgerInterval ≥ burgerIntervalMin`. Tuloste:
min/max/keskiarvo per akseli + kvantiilit (näkee, ettei arpa ole "aina sama").

### 9.3 Käsin tarkistettavat (lyhyt lista)

| # | Tarkistus | Läpäisyehto |
|---|---|---|
| 1 | NORMAL | ei eroa v10.01:een |
| 2 | FULL ×5 | jokainen erilainen, jokainen pelattava, ei konsolivirheitä |
| 3 | Kova tuuli (BAD) | pilvet kiitävät, puut nojaavat selvästi |
| 4 | Paksut pilvet + myrskytaivas (BAD) | taivas harmaa, pilvet paksut, kadun luettavuus säilyy |
| 5 | Vihreä aurinko (FULL/K7) | väri vaihtuu, NORMALissa ei koskaan |
| 6 | 🍔 = 2, 🍔-intervalli lyhyt (FULL) | kiire tuntuu, mutta kuolema **aina** vältettävissä sängyllä |
| 7 | Rosvo/oviukko C-klampilla (nälkäinen pelaaja) | kiinni jää vain omasta virheestä |
| 8 | Liikenteen ylityssääntö | kadun yli ehtii aina, kun katsoo |
| 9 | K7-kortti | laukeaa ja palautuu itsestään, ei vahinkoa, ei uutta tekstiä |
| 10 | Mobiili/näyttö | ei nykimistä, ei yli 12 valaistua ikkunaa |

### 9.4 Definition of Done (vaihe 1–3)

- [ ] NORMAL bitti-identtinen (9.1)
- [ ] Portti (`clampChaosCfg` + `validateChaosCfg`) olemassa ja kutsutaan **aina** ennen arvojen kirjoitusta
- [ ] FULL-arpa ei koskaan kaadu konsoliin eikä tuota tainnutus-/🍔-/nopeusarvoa klampin ulkopuolelta
- [ ] Ei yhtään uutta dialogia/popupia/tekstiä (sääntö 06)
- [ ] Ei muutoksia lukittuihin talousarvoihin ilman rastia (sääntö 04)
- [ ] `#version-tag` → `v10.02` (`index.html`, 1 rivi)
- [ ] Raportti `memory-bank/activeContext.md`:hen (sääntö 02, normaalipolku)

---

## 10. Vaiheet (toteuta yksi kerrallaan, käyttäjä testaa välissä)

| Vaihe | Sisältö | Tuotos | Versio |
|---|---|---|---|
| **1 – K0-infra** | Portti (`clampChaosCfg`/`validateChaosCfg`/`chaosAbility`), seed (`makeRng`), `?chaos=`/`?seed=`/`?debug`, `CHAOS_DEFAULTS2` + kaikki uudet `let`:t **NORMAL-arvoilla**. Ei näkyvää muutosta. | `street.js` n. 120 riviä, NORMAL bitti-identtinen | `v10.02` |
| **2 – K1 (MUST + pääosa)** | Kova tuuli, paksut pilvet + myrskytaivas, **vihreä aurinko**, pilvien lkm/koko/peittävyys, taivaan paletti, tähdet, ikkunavalot, talojen paletti, eläimet/linnut/lepakot, kuoriaiset. MILD/GOOD/BAD/FULL-haarukat luvusta 6.1. | koko pelin ulkoasu muuttuu | `v10.03` |
| **3 – K3 + K4** | C-indeksi käyttöön: uhkien nopeus/varoitus/tn, rosvon nopeusarpa ≤ 1.4·C, liikenteen ylityssääntö, kaappi, tainnutus, herätysrako (+ kävelynopeus jos `❓` on ratkaistu). Rastilliset K4-akselit **vasta käyttäjän luvalla**. | peli pysyy aina voitettavana | `v10.04` |
| **4 – K7 + K2 loput + K6** | Korttipakka (10 visuaalista korttia), kellon rytmit (hämärä, lamppushow, kaappien tahti), ääni (vain jos `audio.js`-lupa). | yllätys + tunnelma | `v10.05` |

**Vaiheen 2 järjestys (näkyvyys/kustannus):** ① kova tuuli → ② pilvet + myrskytaivas →
③ vihreä aurinko → ④ tähdet/ikkunat → ⑤ eläimet. Jokainen näkyy heti ja on arvonvaihto.

---

## 11. Rajat, versio ja avoimet päätökset (`❓` = käyttäjä ratkaisee)

### 11.1 Tiedostot ja koko

| Tiedosto | Sallittu | Arvio |
|---|---|---|
| `street.js` | kyllä (kaikki kategoriat) | ~470 riviä uutta/muutettua koko suunnitelmalla |
| `audio.js` | **vain erillisellä luvalla** (K6) | ~15 riviä |
| `index.html` | **vain** `#version-tag` (1 rivi / vaihe) | 1 rivi |
| `gameState.js`, `style.css`, alipelit | **ei kosketa** | 0 |

### 11.2 Versionhallinta

- Dokumenttimuutos (tämä tiedosto) → **ei versionnostoa**, versio pysyy `v10.01`.
- Koodivaihe 1–4 → **+0.01 / vaihe** (`v10.02` … `v10.05`), koska jokainen on uusi ominaisuus
  (sääntö 03). Pelkkä arvon/parametrin säätö kaaoshaarukassa **ei** nosta versiota.
- Committia/pushia **ei** tehdä ilman käyttäjän pyyntöä (sääntö 03).

### 11.3 Avoimet päätökset (rasti ruutuun – toteuttaja kysyy nämä ennen vaihetta)

| # | Kysymys | Vaihtoehdot | Vaikutus |
|---|---|---|---|
| ❓1 | **Kävelynopeus kaaosakseliksi?** | (a) ei koskaan · (b) ±25 % · (c) **suositus:** klampi 0,6–1,6 × ja sidotaan C-indeksiin (C käyttää toteutunutta arvoa) · (d) 0,5–2,0 × | Jos (c/d): kaaos voi hidastaa/nopeuttaa pelaajaa; 🍔-vauhti (2/3·1·2) pysyy silti lukittuna |
| ❓2 | **Otetaanko rastilliset K4-akselit (aloituskolikot 1–100, aloitus🍔 2–10, 🍔-tahti) käyttöön?** | (a) ei – pidetään NORMAL-arvoissa · (b) kyllä – kirjataan sääntöön 04 + economymemoon | (b) muuttaa taloutta → vaatii sääntö 04:n muutosprosessin |
| ❓3 | **Saako `audio.js`:ää muokata (K6)?** | (a) ei · (b) kyllä (BPM, volyymit, hiljaisuus) | (b) tuo kuuluvan eron tasojen välille |
| ❓4 | **Saako meteor/satelliitti-logiikka yhdistää apufunktioksi (8.4)?** | (a) ei – päivitä molemmat kohdat · (b) kyllä – pieni refaktorointi | (b) siistimpi, (a) turvallisempi |
| ❓5 | **K7-korttilista** | (a) hyväksy 10 korttia · (b) karsi (esim. vain ⭐-kortti) · (c) toteuta myöhemmin | v1 on vain visuaalinen → riski 0 |
| ❓6 | **Offline-linteri (9.2)?** | (a) ei · (b) kyllä – kysyttäessä | (b) antaa koneellisen todisteen pääsäännölle 2 |
| ❓7 | **Toteutustapa** | (a) vaihe kerrallaan, käyttäjä testaa välissä (**suositus**) · (b) kaikki putkeen | (a) riski pieni, palaute nopeaa |

### 11.4 Riskit ja niiden hallinta

| Riski | Hallinta |
|---|---|
| NORMAL rikkoutuu | Vaihe 1 = kaikki uudet `let`:t NORMAL-arvoilla + `?chaos=normal` -snapshot (9.1) |
| Kaaos tappaa epäreilusti | Portti (klampit + validointi) + C-indeksi + uhkabudjetti (luku 5) |
| Lukittu talous muuttuu vahingossa | K5-lista (6.5) + rastit (❓2) + sääntö 04:n prosessi |
| Uusi dialogi livahtaa mukaan | Sääntö 06 + `console.log` vain debugissa |
| Suorituskyky (mobiili) | Kovakatot: pilvet 34 · tähdet 140 · lepakot 12 · ikkunat 12 (5.3) |
| Efekti vaikuttaa vain puoleen koodista | Duplikaattiansa (8.4) |
| "Kaaos ei tunnu miltään" | MUST-kohteet (luku 7) + kovat haarukat BAD/FULL |
| Vanhojen tasojen (mild/good/bad) luonne muuttuu | Uudet arvonnat `chaosProfile`-lohkojen **loppuun** (8.2) |

---

## 12. Muutoshistoria

| Pvm | Versio | Muutos |
|---|---|---|
| 27.9.2026 | v10.01 (doc) | Suunnitelma v1 laadittu keskustelussa: kategoriat A–L, tasot NORMAL–FULL CHAOS, H-lohko (pelaaja/fysiikka/kamera) **poistettu käyttäjän pyynnöstä** |
| 27.9.2026 | v10.01 (doc) | **v2 kirjattu tähän tiedostoon:** kaksi `!!!PÄÄSÄÄNTÖ!!!`-sääntöä, tasomanifesti, kategoriat **K0–K7** (vaikutuspohjainen jako), C-kyvykkyysindeksi + selviytymisinvariantti (🍔-intervallin lattia 1200 f), kielletyt yhdistelmät (10 kohtaa), parametrikatalogi K1–K7 varmennetuin arvoin ja rivinumeroin, MUST-kohteet (kova tuuli · paksut pilvet + myrskytaivas · vihreä aurinko), toteutusresepti portteineen ja siemenineen, testaus/DoD, 4 vaihetta, tiedostorajat ja avoimet päätökset (`❓`). Ei koodimuutoksia. |

