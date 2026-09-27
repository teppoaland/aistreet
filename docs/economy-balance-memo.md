# 💰 Talous- ja tasapainomemo (Pimeä Katu)

> **TILA: LUKITTU 20.9.2026.** Sääntö `04-economy-balance.md` on sitova: näitä arvoja ei muuteta
> ilman käyttäjän eksplisiittistä pyyntöä. Tämä memo kertoo **miksi** lukko on olemassa ja mitkä
> arvot ovat lukossa.

---

## 1. Talouslooppi (miten raha kiertää)

```
          ┌──────────────────────── kadun tulot ────────────────────────┐
          │ katu-kolikko 1 kpl / 120 s · kolikko potkusta 1/5 (30 s cd) │
          │ hedelmäpelitalo (ilmainen pyöräytys 1/120 s)                │
          └──────────────────────────────┬──────────────────────────────┘
                                         ▼
   ┌──────────── käytön kohteet (raha pois) ─────────────┐
   │ BAR:        1 kolikko = 1 🍔 (katto 10)            │
   │ Jukebox:    1 kolikko = 1 koko kappale             │
   │ Hedelmäpeli:1 kolikko / pyöräytys, RTP 78,5 %      │
   │ Makuuhuone: aina auki (Nuku/Poistu ilmaisia)       │
   │ Avoin kaivo (v4.52): ≤ 2 🪙 (1 → 0, 0 → 0)             │
   │   · parametri: 1/6 putoamisista +3 🪙 (löytö pohjalta) │
   └────────────────────────┬───────────────────────────┘
                            ▼
   ┌──────────── paine (pakko pitää huolta) ────────────┐
   │ 🍔 5 alussa, +1 / 40 s · osuma (oviukko, ruukku,   │
   │ sähkökaappi) = −1 🍔 · 🍔 0 → kuolema + reload      │
   └────────────────────────────────────────────────────┘
```

Ydinajatus: pelaajan on **pakko jättää 1 kolikko** ja käydä katsomassa, onko 🍔:tä pakko ostaa –
ja samalla hedelmäpeli imee kolikoita, koska voitot eivät kata panoksia.

> **V4.68 (22.9.2026):** Rosvo vie nappauksessa **−1 🍔 + kaikki kolikot** (`coinCount → 0`, **ei
> ilmoitusta** – sääntö 06) – selvästi muuta kadun vaaraa (oviukko/kukkaruukku/sähkökaappi = vain
> −1 🍔) rankkaampi. Käyttäjän pyyntö: *"rosvo vie hampurilaisen lisäksi kaikki rahat."* Muut lukitut
> arvot (2400 framet, katto 10, BAR, jukebox, RTP, syntymäpaketti) ennallaan. Hedelmäpelin
> panos/painot/maksut/RTP eivät muutu → maksutaulukko/RTP-simulaatio ei muutu.
>
> **V4.69 (23.9.2026):** Kaivoon putoaminen ei ole enää pelkkä menetys: **1/3 putoamisista kaivon
> pohjalta löytyy +3 🪙** (`MH_BONUS_CHANCE 1/3`, `MH_BONUS_COINS 3`) – kolikon pling + kultahiukkaset,
> ei uutta tekstiä. Muut 2/3 putoamisista kuten ennen (enintään −2 🪙). Käyttäjän pyyntö:
> *"randomina 1/3 putoamisista kaivosta saakin 3 rahaa."* Muut lukitut arvot (2400 framet, katto 10,
> BAR, jukebox, RTP, syntymäpaketti, rosvo v4.68) ennallaan.
>
> **Parametrin säätö (23.9.2026, ei versionnostoa):** Plussakerroin pienennetty **1/3 → 1/6**
> (`MH_BONUS_CHANCE 1/6`, `MH_BONUS_COINS 3` ennallaan) – kaivoon ei kannata hypellä. Odotusarvo
> putoamista kohden: 0 🪙 **+0,50** · 1 🪙 **−0,33** · 2+ 🪙 **−1,17** → selvästi tappiollista, kun
> rahaa on vähintään 1 🪙. Käyttäjän pyyntö: *"vain joka 1/6 kun kaivoon putoaa voi saada rahaa."*
> **Pelkkä arvon säätö (sääntö 03) → ei versionnostoa.** Muut lukitut arvot ennallaan.
>
> **V4.70 (23.9.2026):** 🍔-määrä vaikuttaa nyt **pelaajan kävelyvauhtiin** (ei lukittu arvo, mutta
> muuttaa pelin rytmiä): **≤3 🍔 → 2/3** · **4–7 🍔 → 1,00** · **8–10 🍔 → 2,00** (`hungerSpeedMult()`,
> nupit `HUNGER_SPEED_SLOW_MAX/FAST_MIN/SLOW_MULT/FAST_MULT`). Nälkäisenä hidastuu (vaarojen väistö
> vaikeampaa – sama raja kuin HUD-varoitus 3) ja täydellä vatsalla kulkee tuplanopeutta (oviukko
> `AVENGER_SPEED 2.0` jää jälkeen → karkuun pääsee, kuten käyttäjä hyväksyi). Koskee myös
> kävelyanimaation ja askeläänen tahtia. **Lukitut arvot ennallaan:** 2400 framet (1/40 s), katto 10,
> BAR 1 🪙 = 1 🍔, jukebox 1 🪙 / kappale, RTP ≈ 78,5 %, syntymäpaketti 2 🪙 + 5 🍔, rosvo (v4.68),
> MH_COIN_COST 2 (1/6). Testityökalu `?burgers=N` pakottaa vain vauhtilaskennan eikä tallenna mitään.

---

## 2. Lukitut arvot

### Hedelmäpeli (`fruitgame/js/constants.js`)
| Parametri | Arvo |
|---|---|
| Panos `BET` | **1 kolikko / pyöräytys** |
| Symbolipainot | 🍒 7 · 🍋 5 · 🔔 4 · 🍔 2 · 💎 2 (rullanauha 20 merkkiä) |
| Maksut | 💎 35 · 🍔 20 · 🔔 12 · 🍋 7 · 🍒 4 · `PAY_PAIR 1` = **panos takaisin** |
| RTP | **≈ 78,5 %** (analyyttinen 78,49 %, simuloitu 1 M = 78,5–78,8 %) |
| Osumat | kolmikko 6,85 % · pari 35,3 % · ei voittoa 57,9 % → **42,1 % pyöräytyksistä palauttaa jotain** |
| Ilmainen pyöräytys | 1 kpl / **120 s** (`FREE_SPIN_COOLDOWN_MS`), avain `pimeakatu_fruit_free` → max **+0,785 kolikkoa / 2 min** |
| Aukiolo (v4.34) | **Vain öisin (klo 20–06).** Päivällä (`dayT >= 0.5`) ovesta tulee teksti-popup, ei peliä. Panos/painot/maksut/RTP **ennallaan** |

Talon etu ≈ **21,5 % panoksesta**: pelaaja menettää pitkässä juoksussa noin viidenneksen
jokaisesta pyöräytyksestä – "syö rahat yleensä aina, mutta jos tuuria, voi saada hiukan enemmän,
ihan kuin oikeassa elämässä".

### Katu (`street.js`, `gameState.js`)
| Parametri | Arvo |
|---|---|
| Katu-kolikko | 1 kpl kerrallaan, respawn **120 s** (`coinRespawnTimer = 7200`) |
| Kolikko potkusta | **1/5** (`Math.random() < 0.2`) + **30 s** cooldown (`kickCoinCooldown = 1800`) |
| Hampurilaiset | alussa **5**, +1 / **40 s** (`hamburgerTimer = 2400` framet) |
| BAR | **1 kolikko = 1 🍔** (katto 10, ▼ peruu vain vierailun ostot) |
| Jukebox | **1 kolikko = 1 koko kappale**, auki vain öisin (v4.34). **v4.46:** kappaleita voi valita useamman (max 3, järjestys 1 → 3) ja veloitus tehdään poistuttaessa **1 🪙 / valittu kappale** – hinta per kappale ei muutu |
| Makuuhuone (ex-palkintohuone, talo 7) | **Aina auki, ei lukkoa** (v4.43: ei avaimia eikä lamppua). Nuku → **+1 🍔** (katto 10, v4.44), Poistu **ilmainen** |
| Nukkuminen – nälkä jäissä (v4.41) | Nälkäajastin ei tikitä makuuhuoneessa eikä Zzz-pimennyksen aikana (`hungerOnHold()`), joten pelaaja **ei kuole nukkuessaan**. Herätessä ajastin jatkuu siitä mihin jäi, mutta vähintään **10 s** (`HUNGER_WAKE_GRACE = 600`). Tahti 1/40 s (2400 framet) ennallaan |
| Nukkuminen – 🍔-palkkio (v4.44) | Nuku → **+1 🍔** herätessä (katto 10, sama kuin BAR). Ei vaikuta muuhun talouteen |
| Oviukko / kukkaruukku / sähkökaappi | osuma = tainnutus + **−1 🍔** (🍔 0 → kuolema) |
| Avoin viemärinkansi (kaivo, v4.51/v4.52) | kansi voi puuttua: **1/6** pelin alussa, **1/10** joka kerta kun huone/alapeli sulkeutuu (kansi voi myös palata). Astuminen = **enintään −2 🪙** (`MH_COIN_COST`: 3 → 1, 2 → 0, 1 → 0, 0 → ei mitään); ei 🍔:tä, ei kuolemaa, ei tainnutusta |
| Syntymäpaketti | uusi peli / reset: **2 kolikkoa + 5 🍔** |

### Aukioloaika (v4.34) – ei lukittu talousarvo

Jukebox (talo 5) ja Hedelmäpeli (talo 7) ovat auki **vain öisin (klo 20–06)**. Päivällä
(`dayT >= 0.5`, nuppi `CLOSED_AT_DAYT`) ovesta tulee sama teksti-popup kuin lukitusta
ovesta (`CLOSED_SIGN = 'Avoinna\nKlo 20 - 06'`) eikä huone/peli aukea (`street.js`).

- **Mikään lukittu arvo ei muutu:** panos 1, painot, maksut, RTP ≈ 78,5 %, ilmainen
  pyöräytys 1/120 s, jukeboxin 1 kolikko / kappale, 🍔-tahti ja BAR-hinnat ovat ennallaan.
- Muutos koskee vain **sitä, milloin kolikoita voi käyttää**. Yö (= pelin normaali tila)
  toimii täsmälleen kuten ennen; päivä on **lopputila** (3 avainta kerätty), jolloin raha
  jää käyttämättä – se ei lisää tuloja eikä muuta RTP:tä.

### Nukkuminen – nälkä jäissä (v4.41) – ei lukittu talousarvo

Käyttäjän linjaus 20.9.2026: *"Pelaaja kun menee nukkumaan = yöhuoneeseen, hampurilaisten kulutus
pitää mennä onholdiin. Pelaaja ei saa kuolla nukkuessa."* Rajaus: **vain nukkuminen** – muualla
(BAR, jukebox, iframe-pelit) pelaaja huolehtii itse, ettei pelaa tai käy "ostoksilla" nälissään.

- **Nyt:** `hungerOnHold()` pitää nälkäajastimen jäissä makuuhuoneessa ja Zzz-pimennyksen ajan →
  pelaaja ei voi kuolla nukkuessaan.
- **Herätysrauha:** herätessä `hamburgerTimer = Math.max(hamburgerTimer, 600)` → vähintään **10 s**
  aikaa reagoida. Ajastin **ei nollaudu täyteen** (ei ilmaista 40 s:ää eikä sängyssä käynnin
  hyväksikäyttöä).
- **Lukitut arvot ennallaan:** 2400 framet (1 🍔 / 40 s), katto 10, BAR 1 kolikko = 1 🍔,
  RTP ≈ 78,5 %. Muutos koskee vain *sitä, milloin* ajastin käy – ei sen tahtia eikä hintoja.

### Kulutus jatkuu kaikkialla muualla kuin nukkuessa (v4.49/v4.50) – ei lukittu talousarvo

Käyttäjän havainto 21.9.2026: *"hampurilaisia kuluu myös Jukebox-tilassa ja hedelmäpeliä pelatessa.
Nyt tuntuu että kulutus pysähtyy ko tiloissa. … Nukkuessa=levossa hampurilaiskulutus onkin
tarkoituksella tauolla, muissa ei tarvisi olla vaan jatkuu, kunten katuelämä."*

- **Syy:** nälkäblokki oli `update()`issa **huoneiden `return`ien jälkeen** → jukebox ja BAR
  pysäyttivät kulutuksen; lisäksi `closeGame()` teki `hamburgerTimer = 2400`, joten **jokainen
  alapelistä poistuminen täytti 40 s ajastimen** (hedelmäpelin lyhyet sessiot eivät kuluttaneet
  mitään). DG1/DG2/BM:ssä kulutus näkyi, koska sessiot ovat pitkiä eivätkä ne pysäytä silmukkaa.
- **Nyt:** blokki on heti kuolemasekvenssin jälkeen → kulutus jatkuu kadulla, BAR:ssa, jukeboxissa
  ja iframe-peleissä; jäissä vain `hungerOnHold()` (makuuhuone + Zzz). `closeGame()` ei enää
  nollaa ajastinta (se jatkaa siitä mihin jäi) eikä lue tallennusta jos `localStorage` puuttuu.
- **Kuolema myös huoneessa/pelissä (v4.50):** v4.49:n "siirretty kuolema + 10 s armoaika" oli
  **väärä ratkaisu** – 0 🍔:lla saattoi jäädä huoneeseen/peliin loputtomiin, eli 1 🍔 riitti
  "ilmaiseksi lipuksi" sisätiloihin. Käyttäjän linjaus 21.9.2026: *"Pelaajan PITI kuolla jos hän
  menee syömättä eri tiloihin ja hampurilaissaldo loppuu. … pelaajan tulee aina huolehtia, että
  hampurilaisaldoa riittää paitsi nukkuessa."* → `starvingOnExit`/`checkStarvingOnExit` **poistettu**;
  kun 🍔 = 0, kuolema laukeaa **heti paikasta riippumatta**. Jotta kuolema ei jää näkymättömiin,
  `leaveHiddenStateForDeath()` sulkee ensin alapelin (`closeGame()`) tai canvas-huoneen
  (`closeRoom()`) → pelaaja romahtaa **kadulla** (3 s kuolinanimaatio) → tuttu resetti.
  `closeGame()` ei enää muuta tallennettua 0 🍔:ää 5:ksi (`|| 5` → eksplisiittinen tarkistus).
- **Lukitut arvot ennallaan:** 2400 framet (1 🍔 / 40 s), katto 10, BAR 1 kolikko = 1 🍔,
  jukebox 1 kolikko / kappale, RTP ≈ 78,5 %, syntymäpaketti 2 🪙 + 5 🍔.
- **Validointi:** `%TEMP%\street-hunger-scope-test.cjs` (25 tarkistusta, 0 löydöstä) –
  kulutus kadulla/BAR:ssa/jukeboxissa/iframessa, jäissä makuuhuoneessa, kuolema huoneessa
  (huone sulkeutuu + resetti) ja jukeboxissa burgerien loputtua.

### Makuuhuoneen ovi auki ilman avaimia (v4.43) – ei lukittu talousarvo

Käyttäjän pyyntö 20.9.2026: *"Vapauta ovi, että ei tarvi 3 avainta että pääsee nukkumaan.
Pitähän sen pelaajan itse voida päättää milloin haluaa nukkua."*

- **Nyt:** makuuhuoneen (`buildings[7]`) ovi on **aina auki** – ei avaimia eikä lamppua, päivällä ja
  yöllä, täsmälleen kuten BAR. `handleAction()` avaa huoneen heti oven edestä, ja sama tila ohjaa oven
  ulkoasua (`drawDoor()`) ja kynnysvaloa (`drawThresholdPaving()`). Avainpopup ("Ei tänne pääse ilman
  avainta") poistui tästä ovesta.
- **Ei talousvaikutusta:** Nuku ja Poistu ovat ilmaisia eivätkä ne käytä kolikoita eivätkä 🍔:tä.
  Nälkätahti 2400 framet (1 🍔 / 40 s), katto 10, BAR 1 kolikko = 1 🍔, jukebox 1 kolikko / kappale,
  hedelmäpelin panos/painot/maksut/RTP ≈ 78,5 % ja syntymäpaketti 2 kolikkoa + 5 🍔 ovat **ennallaan**.
- **Seuraus (hyväksytty):** huoneeseen pääsee nyt heti ensimmäisenä yönä, joten `state.isDay` voi
  ratketa Nuku-valinnalla ennen avaimia → v4.32:n "3 avainta → päivä kerran" -auringonnousu ei enää
  laukea sen jälkeen (sama tila syntyi aiemminkin nukkumalla avaimet koossa). Vapaa huone on samalla
  paikka pitää nälkä jäissä (`hungerOnHold()`, v4.41) – se ei tuota rahaa eikä 🍔:tä.

### Avoin viemärinkansi (kaivo) – kolikkomenetys tai -löytö (v4.51, hinta v4.52, löytö v4.69)

Käyttäjän pyyntö 21.9.2026: *"Kadulla on 2 kaivonkantta. Toisinaan niistä toinen voisi puuttua ja
pelaaja voisi pudota kaivoon. Kun kansi puuttuu kohta on musta. … Kansi voi puuttua kun peli alkaa
random kansi 1/6 tapauksesta ja tilanne voi myös muuttua 1/10 kun pelaaja käy jossain huoneessa ja
palaa takaisin kadulle."* Aluksi hinnaksi valittiin −1 🍔 ilman tainnutusta; **v4.52** hinta vaihdettiin
kolikoihin ja tarkennettiin: *"Aina menee 2 kolikkoa jos on mitä mennä. Jos vain 1 kolikko, se ainutkin
menee."* → sääntö **3 → 1, 2 → 0, 1 → 0, 0 → ei mitään**.

- **Mekaniikka:** kansi voi puuttua toisesta kahdesta viemäristä (`foreground.manholes`, x ≈ 215 ja
  ≈ 585). Silloin kohta on **musta reikä** (`drawManholeHole()`). Siihen astuva pelaaja **vajoaa alas
  (katoaa)** ja **köpii takaisin ylös** reiän keskeltä (`MH_FALL_FRAMES 36` ≈ 0,6 s nopea pudotus +
  `MH_CLIMB_FRAMES 210` ≈ 3,5 s köpiminen, `drawPlayerManhole()`).
- **Menetys (v4.52):** **enintään −2 🪙** (`MH_COIN_COST`) – kolikot hulahtavat viemäriin:
  **3 → 1, 2 → 0, 1 → 0, 0 → ei mitään** (ainutkin kolikko menee, jos se on ainoa). Ei 🍔-menetystä,
  ei kuolemaa eikä tainnutusta. (Ennen v4.52: −1 🍔, ja 🍔 0 → kuolema.) Putoaminen ei siis kosketa
  elämiä – se on puhdas **kolikkomenetys**.
- **Löytö (v4.69):** käyttäjän pyyntö 23.9.2026: *"randomina 1/3 putoamisista kaivosta saakin 3
  rahaa."* → pohjaan päästyä arvotaan ensin `MH_BONUS_CHANCE 1/6`: osuessa **+3 🪙**
  (`MH_BONUS_COINS`) ja kolikon pling + kultahiukkaset; muussa tapauksessa menetys yllä olevan
  säännön mukaan. **Parametrin säätö (23.9.2026, ei versionnostoa):** plussakerroin pienennettiin **1/3 → 1/6**
  (käyttäjän pyyntö: *"vain joka 1/6 kun kaivoon putoaa voi saada rahaa"*) → kaivoon ei kannata hypellä.
  Yksi arpa per putoaminen, ei uutta tekstiä/ilmoitusta. **Odotusarvo putoamista
  kohden:** 0 🪙:lla **+0,50 🪙** · 1 🪙:llä **−0,33 🪙** · 2 🪙:llä **−1,17 🪙** ·
  3+ 🪙:llä **−1,17 🪙** (menetys on aina `min(rahat, 2)`) – kaivo on siis **selvä
  menetys** kun rahaa on vähintään 1; vain 0 🪙:lla köyhä pelaaja voi saada sieltä alkupääoman.
- **Arvonta:** `MANHOLE_START_CHANCE 1/6` (uusi peli / sivun lataus) ja `MANHOLE_RETURN_CHANCE 1/10`
  joka kerta kun huone tai alapeli sulkeutuu (`trackHiddenStreet()`; kansi katoaa TAI palaa
  paikalleen). Tila on vain muistissa → **ei uutta localStorage-avainta**, `gameState.js` ei muutu.
- **Reunaehto:** putoaminen laukeaa vain kun jalkapiste **siirtyy** reiän ellipsin sisään
  (`MH_HIT_RX 11` / `MH_HIT_RY 5`) – jos kansi katoaa jalkojen alta, putoamista ei tapahdu ennen kuin
  astuu pois ja takaisin. Reiän voi myös kiertää (ovien käyttösäde on 19 px ja törmäysellipsi on
  piirtoa pienempi), joten vaara on **vältettävissä**.
- **Lukitut arvot ennallaan:** 🍔-tahti 2400 framet (1/40 s), katto 10, BAR 1 🪙 = 1 🍔, jukebox
  1 🪙 / kappale, hedelmäpelin panos/painot/maksut/RTP ≈ 78,5 %, syntymäpaketti 2 🪙 + 5 🍔, kadun
  kolikko 120 s ja potkukolikko 1/5. Kaivo on uusi **kolikkojen käyttökohde** (kuten BAR/jukebox),
  ei uusi 🍔-paine.
- **Testityökalut:** `?hole=1` (1. kansi auki), `?hole=2` (2. kansi auki), `?hole=0` (molemmat
  paikallaan) – eivät tallenna.

---

## 3. Hyväksytty pelitestitulos (käyttäjän havainnot 20.9.2026) – TÄMÄ ON MITTAPUU

- **"AINA pitää jättää 1 kolikko ja käydä katsomassa, onko pakko syödä, ettei mene henki."**
- **"Kerran olen saanut pelaamalla 20 kolikkoa ehkä 30x jälkeen."** → iso voitto on harvinainen.
- **"Yleensä juuri 1–2 että peliä voi pyörittää 'omillaan hetken'."**
- **"Toimii hampurilaisten kanssa ja mitä normipeliin tulee kolikkoja tasapainossa."**
- **"Tätä ei voi etukäteen laskea, niin se on nyt sopiva."** → tasapaino on empiirisesti löydetty,
  siksi se lukitaan eikä sitä "korjata" laskennallisesti.

---

## 4. Testityökalut eivät ole osa balanssia

`COIN_CHEAT_*` (v4.23, kadun vitoslamppu), `fruitgame?coins=N` / `?debug`, `bm`:n debug-moodi,
`?day=0/1` ja `?hole=0/1/2` (`street.js`) sekä **`?burgers=N` (v4.70 – pakottaa vain vauhtilaskennan
käyttämään N 🍔:ää → kolme vauhtitasoa testattavissa heti, ei tallenna mitään)** ja
`MUSIC_SOURCE`-kytkin ovat **testausta** varten eivätkä ne kuvaa pelaajan taloutta. Niitä saa säätää
vapaasti (esim. `COIN_CHEAT_COOLDOWN = 0` nopeampaan testaukseen) ilman versionostoa tai lupaa.

---

## 5. Jos balanssia muutetaan (pakollinen prosessi)

1. Vain käyttäjän eksplisiittisestä pyynnöstä (sääntö `04-economy-balance.md`).
2. Kirjaa ennen/jälkeen tähän memoon ja sääntöön.
3. Aja: `%TEMP%\ftest.cjs` (maksutaulukko 125/125 + RTP-simulaatio), `%TEMP%\street-fruit-test.cjs`,
   `%TEMP%\street-bar-test.cjs`, `%TEMP%\street-cheat-test.cjs` + street-regressiot → 0 löydöstä.
4. Versionosto +0.01 ja muistipankki.

---

## 6. Muutoshistoria (ennen → jälkeen)

| Pvm | Versio | Ennen | Jälkeen |
|-----|--------|-------|---------|
| 20.9.2026 | v4.33 | Palkintohuone (talo 7): pääsy **kaikki avaimet tai 3 kolikkoa**; huoneessa pokaali | Makuuhuone (talo 7): pääsy **vain 3 avainta** (kolikkoreitti poistettu); Nuku/Poistu ilmaisia. **Kolikko-/🍔-talous ei muutu** – poistui vain yksi kolikoiden käyttökohde |
| 20.9.2026 | v4.34 | Jukebox ja Hedelmäpeli olivat auki aina (yöllä ja päivällä) | Auki **vain öisin (klo 20–06)**; päivällä ovesta teksti-popup `Avoinna` / `Klo 20 - 06` (`street.js`: `CLOSED_SIGN`, `CLOSED_AT_DAYT 0.5`). **Panos, painot, maksut, RTP, 🍔-tahti ja hinnat ennallaan** – muuttui vain aukioloaika |
| 20.9.2026 | v4.41 | Nälkäajastin tikitti myös nukkuessa – herätessä se jatkui täsmälleen siitä mihin jäi, joten 1 🍔:lla nukkuja saattoi kuolla heti herätessään | Nälkä **jäissä** nukkuessa (`hungerOnHold()`: makuuhuone + Zzz-pimennys) + herätysrauha 10 s (`HUNGER_WAKE_GRACE 600`). **2400 framet (1/40 s), katto 10, hinnat ja RTP ennallaan**; rajaus vain nukkumiseen |
| 20.9.2026 | v4.43 | Makuuhuoneen (talo 7) ovi oli lukossa ilman **3 avainta** (avaimilla ovi auki ilman lamppua) | Ovi **aina auki kuten BAR** – ei avaimia eikä lamppua, päivällä ja yöllä; avainpopup poistettu (`handleAction`). **Talousarvot ennallaan** (Nuku/Poistu ilmaisia, 2400 / katto 10 / hinnat / RTP). Nukkua voi nyt heti ensimmäisenä yönä → `state.isDay` voi ratketa ennen avaimia |
| 21.9.2026 | v4.44 | Nukkuminen antoi 0 🍔:tä | Nuku → **+1 🍔** (katto 10). Ei muutoksia muihin talousarvoihin (2400, katto 10, hinnat, RTP, aukiolo). Käyttäjän pyyntö 21.9.2026 |
| 21.9.2026 | v4.46 | Jukebox: yksi valinta (rivi 0 = "ei valintaa"), Space/Enter/⚡ = poistu → **−1 🪙 ja yksi kappale** | Jukebox: **monivalinta** – rivi 0 = Poistu, (o)/Space/⚡ = ota/poista, Enter = soita & poistu; veloitus **1 🪙 / valittu kappale** (niin moneen kuin kolikoita riittää) ja valitut soivat peräkkäin 1 → 3. **Hinta per kappale, RTP, painot, 🍔-tahti, BAR-hinnat ja syntymäpaketti ennallaan** – vain käyttöliittymä ja soittologiikka (jono) muuttuivat |
| 21.9.2026 | v4.52 | Putoaminen vei **−1 🍔** (ja 🍔 0 → kuolema) | Putoaminen vie **enintään −2 🪙**: 3 → 1, 2 → 0, 1 → 0, 0 → ei mitään (ei 🍔-menetystä, ei kuolemaa). Kolikot ovat uusi käyttökohde – muut arvot ennallaan |
| 21.9.2026 | v4.51 | Kadun 2 viemärinkantta olivat aina ehjiä – vaaralistalla vain oviukko / kukkaruukku / sähkökaappi | **Avoin kaivo:** kansi voi puuttua (1/6 alussa, 1/10 huoneesta/alapelistä palatessa; voi myös palata). Astuminen = **putoaa alas + kiipeää ylös** = **−1 🍔**, **ei tainnutusta** (🍔 0 → kuolema). Uusi menolähde, jonka voi välttää kiertämällä. Muut arvot ennallaan (2400, katto 10, hinnat, RTP, syntymäpaketti). Käyttäjän pyyntö + valinta 21.9.2026 |

