# 🧪 Testilista v11.43 – manuaalitestit (AI CHAOS STREET)

> ## ⚠️ UUSI SESSIO (Cline): LUE TÄMÄ ENSIN
>
> Käyttäjä testaa tämän listan **itse** ja raportoi vain **ongelmat**.
> **Kysy heti session alussa:**
>
> > *"Testasitko v11.43:n (`docs/testilista.md`)? Löytyikö ongelmia?"*
>
> - **Ei ongelmia** → jatka `memory-bank/activeContext.md` § JATKOPISTE → **osa 8 (v11.44)**:
>   huoneiden logiikka → `street/rooms.js`.
> - **Ongelmia** → pyydä alla oleva **raportointipohja (§ 6)** ja toimi **testaajan kurilla:**
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
- **Välimuisti:** `?v=11.43` vaihtui → selain hakee tuoreet tiedostot automaattisesti.
- **Konsoli (F12)** kannattaa pitää auki: siellä näkyvät JS-virheet ja `?debug`-taulukko.

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

## 1) 🔴 Riskialue 1: refaktoroidut moduulit (v11.38–v11.43)

Suurin osa koodista on siirretty tiedostosta toiseen → **toiminnan pitää olla identtinen**.

**1a. NORMAL perusrinki** — `file:///D:/AI/AI_street/index.html`
- kävely + **potku** (oveen ja kadulle), **kolikko** + potkukolikko
- **lehti**: `Read`-vihje → sivut luettavissa → MANUAL-sivu (ASCII-laatikot kohdakkain) → ✕ sulkee
- **BAR**: osta 🍔 (▲), peru vierailun ostot (▼), katto 10
- **makuuhuone**: Nuku → Zzz-pimennys → **+1 🍔** + päivä⇄yö; Poistu ilmainen
- **jukebox** (yöllä): valitse 2–3 kappaletta → soi peräkkäin; ääni + kansikuvat
- **hedelmäpeli**-talo (iframe), avaimet, oviukko, rosvo, kukkaruukku

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
- **v11.39 – blackout:** vertaa `?card=blackout` ↔ ilman parametria (lamppujen **kuput**, ei vain hehku).

---

## 4) ✅ Nämä EIVÄT ole bugeja (älä korjaa, älä raportoi)

| Havainto | Selitys |
|---|---|
| BAD/FULLissa yöllä lähes ei ikkunavaloja | kaaosakseli `windowTargetMax` (BAD 0–2 / FULL 0–12) |
| `?card=palette` ei palaudu | kortti on tarkoituksella pysyvä; reload palauttaa |
| `?card=` pysyy päällä, F5 ei nollaa | parametri on osoitteessa → poista se |
| BAD/FULLin tähdet "kiinteät" | luodaan kerran latauksessa (`init`) |
| Jukebox/hedelmäpeli kiinni päivällä | auki vain klo 20–06 (popup `Open`) |
| `street-meteor-coin`-penkki heiluu (0–4) | tunnettu epävakaa **penkki**, ei peliongelma |
| BAD/FULLissa kadun värit ovat synkät | `randomHuePalette`/`NEAR_BLACK_PALETTE` = tarkoituksellinen akseli |

---

## 5) 🤖 Koneellinen portti (aja ennen/jälkeen minkä tahansa korjauksen)

```bat
node tools/tests/chaos-normal-check.cjs            :: NORMAL CLEAN: 78 keys, 0 diffs
node tools/tests/street-render-smoke-test.cjs      :: Tulos: 30 / 30 OK
node tools/tests/street-canvas-invariants-test.cjs :: Tulos: 0 löydöstä
node tools/tests/run-all.cjs                       :: 25 penkkiä, 18 puhdasta / 7
```
**Baseline (3.10.2026):** `run-all` = **18 puhdasta / 6–7 löydöstä**; 7. on **tunnettu epävakaa**
`street-meteor-coin` (0–4). Tunnettu 6: autohover 31 · avenger 1 · bad-warning 1 · hunger-scope 3 ·
jukebox 27 · manhole-bonus 3. **Nämä eivät ole regressioita** – per-penkki-taulu: `tools/tests/BASELINE.md`.

**Fuzz (oikea työkalu visuaalisiin/silentteihin vikoihin):** skannaa **jokaisen canvas-kutsun argumentin**
NaN/±Infinity/undefined-varalta ja tyylimerkkijonot (`#NaN…`). Sillä löytyivät v11.43:n molemmat bugit.
Uusi vastaava penkki on `street-canvas-invariants-test.cjs`; laajempi 40 arvan ajo onnistuu kopioimalla
sen rakenne (3 FULL-arpaa × 420 frameä riittää yleensä).

---

## 6) 📝 Raportointipohja (mitä kysy käyttäjältä, jos ongelma löytyi)

```
1. Versio: v11.43
2. Tarkka URL + parametrit (esim. ?chaos=full&card=windows)
3. seed (?debug → konsolin taulukko) tai "en tiedä"
4. Mitä odotin vs. mitä näin (screenshot auttaa valtavasti)
5. Toistuuko samalla URL:lla (F5) vai oliko kertaluonteinen
6. Mode: NORMAL / MILD / GOOD / BAD / FULL
```
**Testaajan muistilista ennen korjausta:**
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
| blackout (lamppujen kuput, ovivalot, reunavalo) | `street.js`: `drawLampPost`/`drawDoor`/`drawPlayer` | v11.39 |
| BAD/FULL ikkunavalot | `street.js`: `seedLitWindows` | v11.41 |
| FULL-värit (`lightenHex`/`mixHex`-vahdit) | `street.js` + `chaos-config.js` | v11.43 |
| NaN-ajoneuvot (`WORLD_W`-sidonta) | `street.js`: `StreetTraffic.bind` | v11.43 |
| nälkä/vauhti/BAR-talous | `street.js` + `gameState.js` | (ennallaan) |

**Siirtotyökalut** (jos tarvitsee siirtää lisää koodia): `tools/refactor/split-*.cjs` + `README.md`
(§ Mekanismi + **ansat 1–3**). **Muista:** jokainen uudelleennimetty nimi on lisättävä `bind()`iin
(tämä unohtui osassa 7 → `translate(NaN)`).
