# 🧪 Testilista v11.56 – manuaalitestit (AI CHAOS STREET)

> ## ⚠️ UUSI SESSIO (Cline): LUE TÄMÄ ENSIN
>
> Käyttäjä testaa tämän listan **itse** ja raportoi vain **ongelmat**.
>
> **Roolit:** **käyttäjä = testaaja** – peli testataan *pelaamalla*, ja silmä + maku ovat **lopullinen
> tuomari** (`.clinerules/05-kevyt-polku.md`) · **Cline = koodari**, jonka oma mekaaninen validointi
> (penkit / fuzz / A-B) on **turvaverkko**: se ei korvaa käyttäjän testiä eikä yksin todista
> pelituntumaa, ulkoasua eikä ääntä.
>
> **Kysy heti session alussa:**
>
> > *"Testasitko v11.45:n (`docs/testilista.md`)? Löytyikö ongelmia?"*
>
> - **Ei ongelmia** → **v11.45 on testattu ja JULKAISTU** (GitHub Pages tarjoilee v11.45:n;
>   `origin/main` = v11.45). **Seuraavaksi ei-refaktorointityöt** – ks. `memory-bank/activeContext.md`
>   § "🔜 Seuraavaksi": Blue Mäx -testimode, pääsiäismunat Dig Däshiin, hedelmäpelin RTP-presetit
>   + panosvalitsin, jukebox-intro/tietojen siivous.
>   Jos v11.45:stä löytyy silti vika → raportti § 6 -pohjalla (A/B + penkki ennen korjausta).
> - **Ongelmia** → pyydä alla oleva **raportointipohja (§ 6)** ja toimi **kurinalaisesti (koodari):**
>   1. **Toista havainto itse** mekaanisesti (vm-harness / fuzz) – älä arvaa.
>   2. **A/B-todista** onko vika uusi vai ennestään ollut: `git show HEAD:street.js`,
>      `git show 064f2d8^:street.js` tai aja sama skenaario vanhalla koodilla.
>   3. Vasta kun vika on **toistettu ja paikannettu**, korjaa se, lisää tarvittaessa **penkki**
>      (joka olisi napanneet sen) ja **nosta versio (+0.01)**.
>   4. Aja koko portti: `chaos-normal-check` + `street-render-smoke` + `street-canvas-invariants`
>      + `run-all` – ja **committaa paikallisesti** (push vain erikseen pyydettäessä).
>
> **Kiellettyä:** "toimii varmasti", "luultavasti korjattu", korjaus ilman toistoa, push ilman pyyntöä.

---

## 0) Miten testataan

- **Polku:** `file:///D:/AI/AI_street/index.html` + parametrit. `start_server.bat` **ei** ole käytössä.
- **Välimuisti:** `?v=11.45` vaihtui → selain hakee tuoreet tiedostot automaattisesti.
- **Konsoli (F12)** kannattaa pitää auki: siellä näkyvät JS-virheet ja `?debug`-taulukko.
- **BAD-myrsky (v11.56):** `?chaos=bad` → salamoita **5–15 s** välein; salaman jälkeen jyrinä tulee **0,4–3,0 s**
  viiveellä ja jyrinän pituus vaihtelee luontevasti (**5–10 limittäistä jyrähdystä**).

| Kytkin | Mihin |
|---|---|
| *(ei parametria)* | NORMAL – peruspeli |
| `?chaos=mild\|good\|bad\|full` | kaaosmodet |
| `?seed=N` | **toistaa saman kaaosarvan** |
| `?debug` | konsoliin koko kaaoskonfiguraatio |
| `?day=1` / `?day=0` | pakota päivä / yö (ei tallenna) |
| `?hole=0/1/2` | viemärinkansi: paikallaan / 1. auki / 2. auki |
| `?cabs=0/1` | sähkökaapit: sammuksissa / päällä |
| `?burgers=N` | 🍔-määrä (≤3 = 2/3 vauhti · 8–10 = 2× vauhti) |
| `?card=<id>` | yksi K7-kortti päälle (`green meteor fog gust blackout windows parade palette sky stars`) |

---

## 1) 🔴 Riskialue 1: refaktoroidut moduulit (v11.38–v11.44)

Suurin osa koodista on siirretty tiedostosta toiseen → **toiminnan pitää olla identtinen**.

**1a. NORMAL perusrinki** — `file:///D:/AI/AI_street/index.html`
- kävely + **potku** (oveen ja kadulle), **kolikko** + potkukolikko
- **lehti**: `Read`-vihje → sivut luettavissa → MANUAL-sivu (ASCII-laatikot kohdakkain) → ✕ sulkee
- **BAR**: osta 🍔 (▲), peru vierailun ostot (▼), katto 10
- **makuuhuone**: Nuku → Zzz-pimennys → **+1 🍔** + päivä⇄yö; Poistu ilmainen
- **jukebox** (yöllä): valitse 2–3 kappaletta → soi peräkkäin; ääni + kansikuvat
- **hedelmäpeli**-talo (iframe), avaimet, oviukko, rosvo, kukkaruukku

**1a′. Huonelogiikka (osa 8, v11.44) + päivä/yö (Vaihe 4, v11.45) – tarkista erikseen**
- **päivä/yö (v11.45):** Nuku vaihtaa suunnan (yö⇄päivä), **auringonlasku + yön lamppushow** ajetaan
  (lamput syttyvät yksi kerrallaan), **päivä sammuttaa katuvalot kerran**, kuu nousee/laskee ja
  kuunvarjot liikkuvat; `?day=1` / `?day=0` toimivat. HUOM: tila koottiin `dayNight`-olioksi –
  **toiminnan pitää olla täsmälleen entinen**.
- **Nuku**: 🍔 +1 (ei yli 10), päivä⇄yö vaihtuu **joka kerta**, Zzz-pimennys näkyy, ✕ kesken pimennyksen palauttaa kadulle
- **BAR**: ▲ = 1 🪙 → 1 🍔, ▼ peruu **vain tämän vierailun** ostot, katto 10, 0 kolikolla ei tapahdu mitään, poistuminen (o)/Space/✕
- **jukebox**: valinta 1 🪙/kappale, **vajaat kolikot** → soi niin monta kuin riittää, vahinko ✕ = **ei veloitusta**, äänen puuttuessa kolikot palautuvat
- **talous ei muutu hyppäyksin**: HUD:in 🪙/🍔-luvut päivittyvät heti (sama tila tallentuu, F5 säilyttää)
- **nälkä kuluu huoneissa** kuten ennen (0 🍔 huoneessa = kuolema)

**1b. Liikenne** (v11.42 + v11.43)
- autot / mopo / ambulanssi / **panssarivaunu** kulkevat läpi ja **poistuvat näkyvistä**
- **moottoriääni** + panorointi (vasen↔oikea)
- **auto osuu** → tainnutus −1 🍔 (FULLissa −1 🪙) + tärinä
- **liikenne ei pysähdy**: BAR / makuuhuone / jukebox / lehti / kaivo (`?hole=1`)
- **mutta pysähtyy** koko tainnutuksen ajaksi, jos kaataja oli auto

**1c. Kaaoskortit** — `?card=<id>`

| id | pitää näkyä | palautuu? |
|---|---|---|
| `green` | aurinko/taivas vihreä·violetti·verenpunainen | kyllä |
| `meteor` | tähdenlentoja tiheään | kyllä |
| `fog` | sumuverho | kyllä |
| `gust` | tuuli, puut nojaavat | kyllä |
| `blackout` | **lamput + kuvut + valopilkku + ovivalot + pelaajan reunavalo sammuvat** | kyllä (4–8 s) |
| `windows` | 8–12 ikkunaa syttyy (paras **NORMALissa**) | kyllä |
| `parade` | 3–5 eläintä **1 s välein** | kyllä |
| `palette` | talojen värit sekoittuvat | **ei – pysyvä** |
| `sky` | päivätaivas myrskyiseksi | kyllä |
| `stars` | tähtiä 80 → 140 | kyllä |

**1d. Äänet** (v11.38 osa 2): potku, askel, kolikko, tölkkäys, sähköisku, laser, meteoriitti, romahdus,
jukebox-soitto, valikkomusiikki.

**1e. Lehti + resize** (osa 3): avaa lehti ja **kavenna selainta** → asettelu skaalautuu, ei leikkaudu.

---

## 2) 🔴 Riskialue 2: v11.43:n bugikorjaukset (FULL)

```
file:///D:/AI/AI_street/index.html?chaos=full        ← lataa 3–4 kertaa (arpa vaihtuu joka kerta)
file:///D:/AI/AI_street/index.html?chaos=full&day=1  ← pakota päivä (aamuongelma)
```

- **Talot ja taustasiluetti näkyvät** taivasta vasten (ennen: ne "kato­sivat" / piirtyivät taivaan värillä
  `#NaNNaNxx`-virhevärin takia).
- **Pelaaja ja rauta-aita näkyvät myös yöllä.**
- **Aamun vaihtuessa ei tule "maskia"** eikä kahta tasavärikerrosta.
- **Ajoneuvot liikkuvat ja poistuvat** (ennen: `translate(NaN,0)` → näkymätön, ikuisesti jäävä ajoneuvo).

---

## 3) 🟡 Muut korjaukset

- **v11.41 – BAD/FULL ikkunavalot:** `?chaos=bad` / `?chaos=full` yöllä → ikkunoita syttyy
  **BAD 0–2 · FULL 0–12**. **0 on laillinen arpa** (kaaosakseli `windowTargetMax`) – varmin vertailu on NORMAL (5).
- **v11.49 – BAD/FULLin kuunvarjot:** yöllä (`?day=0`) jokaisen talon varjo on **oma mittansa
  (×1,00–3,00)** → talot varjostavat eri pituisesti. Vertaa `?chaos=normal` (kaikki ×1,00).
  **Kerroin vaihtuu vain uudessa yössä** (Nuku / uusi peli) – ei väpätä kesken yön.
- **v11.39 – blackout:** vertaa `?card=blackout` ↔ ilman parametria (lamppujen **kuput**, ei vain hehku).
- **v11.52–v11.53 – BAD-myrsky (`?chaos=bad`, `?day=0` tai `?day=1`):** pilvet ovat **paksut** ja **sade +
  ukkonen** tulevat **satunnaisina purskeina** (v11.55: tyyni 60–180 s → purske 60–180 s; sade ei ala heti). Purskeen aikana
  sade valuu koko ruudun yli, **salama iskee ylhäältä alas talojen taakse** (ei koskaan talojen eteen)
  ja **väläyttää koko ruudun**, ja **matala jyrinä** soi hetki välähdyksen jälkeen (ei korkeaa
  pimputusta). **v11.53:** jyrinä on **kolme limittäistä jyrinää** (bruum-bruum-bruum, kesto ~3,5–4 s,
  ei yksittäinen tömähdys); sade on **puolet hitaampi**, sen **vinokulma seuraa tuulen voimakkuutta**
  ja se on **kahdessa syvyyskerroksessa** (kauko-sade talojen takana + lähi-sade edessä → ei enää
  "lasikalvolla"). Vertaa `?chaos=normal` (ei sadetta eikä ukkosta, pilvet entiset). **Vain BAD** –
  FULL/NORMAL/MILD/GOOD eivät saa myrskyä. Impakti: ei pelimekaanista vaikutusta (sade ei vahingoita).
- **v11.54 – Rosvon rauha + turvasäde (kaikki tasot):** rosvo ei ilmesty **ensimmäiseen 60 sekuntiin**
  pelin alusta (peli ei ala ryöstöllä). Sen jälkeenkin rosvo **ei koskaan synny lähelle sitä kohtaa,
  josta pelaaja juuri tuli ulos** (turvasäde 200 px, **kaikki ovet** – myös reunatalot BAR x765 ja
  talo 0 x40; ennen vain BAR oli suojattu). **Ukkosen jyrinä tiivistetty** (~2,7 s, 3 limittäistä
  jyrinää lähempänä toisiaan).
- **v11.55 – Jyrinä 5 kerrokseen + sade myöhemmäksi:** `?chaos=bad` – ukkosen jyrinä on nyt **5
  limittäistä jyrinää** (~3,1 s; bruum×5). Sade **ei ala heti**: ensimmäinen myrskypurske tulee vasta
  **~60 s jälkeen** (satunnaisesti) ja **kestää aina 60–180 s**.

---

## 4) ✅ Nämä EIVÄT ole bugeja (älä korjaa, älä raportoi)

| Havainto | Selitys |
|---|---|
| BAD/FULLissa yöllä lähes ei ikkunavaloja | kaaosakseli `windowTargetMax` (BAD 0–2 / FULL 0–12) |
| `?card=palette` ei palaudu | kortti on tarkoituksella pysyvä; reload palauttaa |
| `?card=` pysyy päällä, F5 ei nollaa | parametri on osoitteessa → poista se |
| BAD/FULLin tähdet "kiinteät" | luodaan kerran latauksessa (`init`) |
| Jukebox/hedelmäpeli kiinni päivällä | auki vain klo 20–06 (popup `Open`) |
| `street-meteor-coin`-penkki heilui (0–4) | **korjattu 3.10.2026:** penkki arpoi talojärjestyksen → kiinteä siemen; ei ollut peliongelma |
| BAD/FULLissa kadun värit ovat synkät | `randomHuePalette`/`NEAR_BLACK_PALETTE` = tarkoituksellinen akseli |
| BAD/FULLissa talojen varjot ovat eri mittaisia | kaaosakseli `moonShadowMax` – arpa per talo, **kerran per yö** (v11.49) |
| BAD/FULLissa katu on yöllä tavallista tummempi | ×3-varjo ylittää 90 px:n maakaistan → gradientti katkeaa (v11.49) |

---

## 5) 🤖 Koneellinen portti (aja ennen/jälkeen minkä tahansa korjauksen)

```bat
node tools/tests/chaos-normal-check.cjs            :: NORMAL CLEAN: 78 keys, 0 diffs
node tools/tests/street-render-smoke-test.cjs      :: Tulos: 30 / 30 OK
node tools/tests/street-canvas-invariants-test.cjs :: Tulos: 0 löydöstä
node tools/tests/street-rooms-logic-test.cjs       :: Tulos: 41 OK (huonelogiikan get+set-host, osa 8)
node tools/tests/run-all.cjs                       :: 26 penkkiä, 26 puhdasta, 0 löydöstä
```
**Baseline (3.10.2026, päivitetty v11.44):** `run-all` = **26 puhdasta / 0 löydöstä** (5 peräkkäistä
ajoa). Penkkivelka on nollattu: kuusi vanhentunutta odotusta ja epävakaa `street-meteor-coin`
korjattiin **pelikoodia muuttamatta** (versio pysyy v11.44:ssä) – yksityiskohdat per penkki:
`tools/tests/BASELINE.md` § Penkkivelka nollattu.

**Fuzz (oikea työkalu visuaalisiin/silentteihin vikoihin):** skannaa **jokaisen canvas-kutsun argumentin**
NaN/±Infinity/undefined-varalta ja tyylimerkkijonot (`#NaN…`). Sillä löytyivät v11.43:n molemmat bugit.
Uusi vastaava penkki on `street-canvas-invariants-test.cjs`; laajempi 40 arvan ajo onnistuu kopioimalla
sen rakenne (3 FULL-arpaa × 420 frameä riittää yleensä).

---

## 6) 📝 Raportointipohja (mitä kysy käyttäjältä, jos ongelma löytyi)

```
1. Versio: v11.45
2. Tarkka URL + parametrit (esim. ?chaos=full&card=windows)
3. seed (?debug → konsolin taulukko) tai "en tiedä"
4. Mitä odotin vs. mitä näin (screenshot auttaa valtavasti)
5. Toistuuko samalla URL:lla (F5) vai oliko kertaluonteinen
6. Mode: NORMAL / MILD / GOOD / BAD / FULL
```
**Clinen muistilista ennen korjausta** (käyttäjä testaa silmällä – tämä on koodarin turvaverkko):
- [ ] Toistin havainnon itse (vm-harness / fuzz / sama URL)
- [ ] A/B: oliko vika uusi vai `git show HEAD` -versiossa jo?
- [ ] Paikansin tiedoston + funktion (ks. § 7)
- [ ] Kirjoitin penkin, joka kaatuu ennen korjausta ja menee läpi sen jälkeen
- [ ] Ajoin koko portin (§ 5) ja vertasin baselineen
- [ ] Versio +0.01, `?v=`-leimat samaan numeroon, **paikallinen commit** (ei pushia)

---

## 7) 🗺️ Koodikartta: mistä mikäkin testi menee

| Testialue | Tiedosto(t) | Versio |
|---|---|---|
| kaaosarvot, paletit, `hslToHex` | `street/chaos-config.js` | osa 1 · v11.43 |
| kaikki äänet + moottoriääni | `street/sfx.js` | osa 2 |
| sanomalehti (asettelu, sivut, piirto) | `street/news.js` | osa 3 |
| ajoneuvojen piirto + liikennologiikka | `street/traffic.js` | osa 4 + 7 · v11.43 |
| K7-kortit + `?card=` | `street/chaos-cards.js` | osa 5 |
| huoneiden piirto (uni/jukebox/BAR) | `street/rooms.js` | osa 6 |
| **huoneiden logiikka** (Nuku/BAR-ostot/jukebox-veloitus, `closeXxxRoom`) | **`street/rooms.js`** | **osa 8 · v11.44** |
| **päivä/yö-tila** (auringonnousu/-lasku, kuu, yön lamppushow, `?day=`) | **`street.js`: `dayNight`-olio** | **Vaihe 4 · v11.45** |
| huonerekisteri `rooms[]` + `closeRoom()` + oven avaus | `street.js` | osa 8 (jäi tänne) |
| blackout (lamppujen kuput, ovivalot, reunavalo) | `street.js`: `drawLampPost`/`drawDoor`/`drawPlayer` | v11.39 |
| BAD/FULL ikkunavalot | `street.js`: `seedLitWindows` | v11.41 |
| FULL-värit (`lightenHex`/`mixHex`-vahdit) | `street.js` + `chaos-config.js` | v11.43 |
| NaN-ajoneuvot (`WORLD_W`-sidonta) | `street.js`: `StreetTraffic.bind` | v11.43 |
| nälkä/vauhti/BAR-talous | `street.js` + `gameState.js` | (ennallaan) |

**Siirtotyökalut** (jos tarvitsee siirtää lisää koodia): `tools/refactor/split-*.cjs` + `README.md`
(§ Mekanismi + **ansat 1–4**). **Muista:** jokainen uudelleennimetty nimi on lisättävä `bind()`iin
(tämä unohtui osassa 7 → `translate(NaN)`), ja nimeäminen tehdään lookbehindilla `(?<![\w.$])`
(osa 8: muuten `state.isDay` → `ENV.state.ENV.isDay`).
