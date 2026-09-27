# 🔒 TALOUS- JA TASAPAINOLUKKO – ÄLÄ MUUTA ILMAN ERILLISTÄ PYYNTÖÄ

> **TILA: LUKITTU 20.9.2026 (käyttäjän eksplisiittinen päätös).** Tämä sääntö on tavallisia sääntöjä
> tiukempi: tässä listatut arvot on **pelitestattu hyväksi**, eikä niitä saa säätää "parantelun",
> refaktoroinnin, "loogisuuden" tai oman maun vuoksi. Ks. myös `docs/economy-balance-memo.md`.

---

## ⚠️⚠️⚠️ ISO VAROITUS ⚠️⚠️⚠️

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ÄLÄ MUUTA KOLIKKO- TAI HAMPURILAISTALOUTTA.                                 ║
║  Nämä arvot pitävät pelin juuri oikeassa tasapainossa:                       ║
║    • pelaajan on PAKKO jättää 1 kolikko ja käydä katsomassa, onko pakko      ║
║      syödä (🍔), ettei henki lähde                                           ║
║    • hedelmäpeli antaa yleensä takaisin 1–2 kolikkoa → "peli pyörii          ║
║      omillaan hetken", mutta syö rahat pidemmällä juoksulla                  ║
║    • iso voitto (esim. 20 kolikkoa) on HARVINAINEN: noin kerran ~30 peli-    ║
║      kerrasta – jackpot tuntuu jackpotilta                                   ║
║  Tätä tasapainoa EI voi laskea etukäteen – se on löytynyt pelaamalla ja      ║
║  se on nyt sopiva. Jos jokin pyyntö koskee alla listattuja arvoja,           ║
║  PYSÄHDY, näytä tämä varoitus käyttäjälle ja kysy vahvistus.                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 🔒 Lukitut arvot

| Alue | Arvo | Tiedosto |
|------|------|----------|
| Hedelmäpeli: panos | **1 kolikko / pyöräytys** (`BET`) | `fruitgame/js/constants.js` |
| Hedelmäpeli: symbolipainot | 🍒 7 · 🍋 5 · 🔔 4 · 🍔 2 · 💎 2 | `fruitgame/js/constants.js` |
| Hedelmäpeli: maksut | 💎 35 · 🍔 20 · 🔔 12 · 🍋 7 · 🍒 4 · pari = **panos takaisin** (`PAY_PAIR 1`) | `fruitgame/js/constants.js` |
| Hedelmäpeli: RTP | **≈ 78,5 %** (kolmikko 6,85 %, pari 35,3 %) – "talo voittaa aina pitkässä juoksussa" | `fruitgame/js/constants.js` |
| Hedelmäpeli: ilmainen pyöräytys | 1 kpl / **120 s** (`FREE_SPIN_COOLDOWN_MS`, avain `pimeakatu_fruit_free`) → max +0,785 kolikkoa / 2 min | `fruitgame/js/constants.js` |
| Kadun kolikko | 1 kpl kerrallaan, respawn **120 s** (`coinRespawnTimer = 7200`) | `street.js` |
| Kolikko potkusta | **1/5** (`Math.random() < 0.2`) + **30 s cooldown** (`kickCoinCooldown = 1800`) | `street.js` |
| Hampurilaiset (elämät) | alussa **5**, +1 / **40 s** (`hamburgerTimer = 2400`), katto BAR:sta **10** | `street.js`, `gameState.js` |
| BAR | **1 kolikko = 1 🍔**, katto 10, peruutus (▼) vain vierailun ostot | `street.js`, `docs/` |
| Jukebox | **1 kolikko = 1 koko kappale** · v4.46: kappaleita voi valita **useamman** (järjestys 1 → N); veloitus tehdään poistuttaessa **1 🪙 / valittu kappale**, valitut soitetaan peräkkäin · **v4.99:** jukebox **ei lukkiudu** soiton ajaksi – soivan kappaleen aikana voi valita lisää kappaleita, jotka lisätään jonon perään | `street.js`, `docs/jukebox-memo.md` |
| Jukebox / Hedelmäpeli: aukiolo | **Vain öisin** (klo 20–06); päivällä (`dayT >= 0.5`) ovesta teksti-popup `Avoinna` / `Klo 20 - 06` – ei potkua, ei valoja, ei sisään (v4.34) | `street.js` (`CLOSED_SIGN`, `CLOSED_AT_DAYT`) |
| Makuuhuone (ex-palkintohuone, talo 7) | **Aina auki, ei lukkoa** (v4.43: ei avaimia eikä lamppua – pelaaja päättää itse, milloin nukkuu; kolikkoreitti **poistettu** 20.9.2026/v4.33) · Nuku → **+1 🍔** (katto 10, v4.44) · Poistu = **ilmainen** | `street.js` |
| Nukkuminen: nälkä jäissä (v4.41) | Nälkäajastin **ei tikitä** makuuhuoneessa eikä Zzz-pimennyksen aikana → pelaaja ei voi kuolla nukkuessaan; herätessä ajastimelle jää vähintään **10 s** (`HUNGER_WAKE_GRACE = 600`). Tahti (1/40 s, 2400 framet) ja katto 10 **ennallaan** | `street.js` (`hungerOnHold()`) |
| Nälkä kulkee kaikkialla – myös huoneissa ja peleissä (v4.49/v4.50) | Kulutus jatkuu kuten kadulla myös **BAR:ssa, jukeboxissa ja iframe-peleissä** (ennen: jäissä vahingossa huoneissa ja `closeGame` nollasi 40 s ajastimen); jäissä **vain nukkuessa**. **🍔-saldo on aina hoidettava:** kun 🍔 loppuu, pelaaja kuolee myös huoneessa/pelissä – huone/alapeli suljetaan ensin (`leaveHiddenStateForDeath`), jotta kuolinsekvenssi näkyy kadulla, ja sitten tuttu resetti. Tahti (2400 framet = 1/40 s), katto 10, hinnat ja RTP **ennallaan** | `street.js` (`insideHiddenState()`, `leaveHiddenStateForDeath()`) |
| Oviukko / kukkaruukku / sähkökaappi | osuma = tainnutus + **−1 🍔** (0 → kuolema) | `street.js` |
| Avoin viemärinkansi (kaivo, v4.51/v4.52/v4.69) | kansi voi puuttua (1/6 alussa, 1/10 huoneesta/alapelistä palatessa) → **putoaa alas + kiipeää ylös**. Tavallisesti **enintään −2 🪙** (`MH_COIN_COST`: 3 → 1, 2 → 0, 1 → 0, 0 → ei mitään), mutta **1/6 putoamisista kaivon pohjalta löytyy +3 🪙** (`MH_BONUS_CHANCE` 1/6, `MH_BONUS_COINS` 3; v4.69, kerroin säädetty parametrina 1/3 → 1/6); ei 🍔-menetystä, ei kuolemaa, ei tainnutusta; vältettävissä kiertämällä | `street.js` (`MH_*`, `mhAction`) |
| Syntymäpaketti (uusi peli / reset) | **2 kolikkoa + 5 🍔** (`defaultState.inventory`) | `gameState.js` |

---

## ✅ Mikä ei ole lukossa

- **Testityökalut** (eivät ole tulonlähde eivätkä vaikuta balanssiin): `COIN_CHEAT_*`-nupit (`street.js`),
  `?coins=N` ja `?debug` (`fruitgame`), `?day=0` / `?day=1` (`street.js`: pakotettu yö/päivä, ei tallenna),
  `?hole=0` / `?hole=1` / `?hole=2` (`street.js`: viemärinkansi pakotettu paikalleen / 1. / 2. auki, ei tallenna),
  `bm`:n debug-moodi, `MUSIC_SOURCE`-kytkin, testikopioiden `_dbg`.
- **Ulkoasu, tekstit, äänet, animaatiot** ja muut kuin yllä listatut parametrit – niitä saa muuttaa normaalisti.

---

## 📋 Jos balanssia joskus muutetaan (pakollinen prosessi)

1. **Vain käyttäjän eksplisiittisestä pyynnöstä** – ei koskaan oma-aloitteisesti.
2. Kirjaa muutos **ennen/jälkeen** -arvoina tähän tiedostoon ja `docs/economy-balance-memo.md`:hen.
3. Aja validoinnit: hedelmäpelin maksutaulukko (125/125) + RTP-simulaatio + katu-integraatio
   (`%TEMP%\ftest.cjs`, `%TEMP%\street-fruit-test.cjs`) sekä street-regressiot 0 löydöstä.
4. **Versionosto vain jos muutos on koodimuutos** – uusi ominaisuus / bugikorjaus / uusi taso →
   **+0.01** (sääntö 03). **Pelkkä parametrin/arvon säätö → EI versionnostoa** (esim. kaivon
   `MH_BONUS_CHANCE` 1/3 → 1/6). Tee tarvittava muistipankin päivitys.

---

## 📜 Muutoshistoria (ennen → jälkeen)

| Pvm | Versio | Muutos | Ennen | Jälkeen |
|-----|--------|--------|-------|---------|
| 20.9.2026 | v4.33 | Talo 7: palkintohuone → **makuuhuone** (Nuku/Poistu). Pääsy vain 3 avaimella, kolikkoreitti poistettu (käyttäjän pyyntö: *"3 avainta on se lukko tässä, kolikko-lukituksen saa poistaa"*) | Pääsy: kaikki avaimet **tai 3 kolikkoa**; huoneessa pokaali + "To be continued…" | Pääsy: **vain 3 avainta** (ovi aina auki avaimilla, lamppua ei tarvita); huoneessa sänky + Nuku/Poistu. **Nukkuminen ja poistuminen ovat ilmaisia** → ei vaikutusta kolikko-/🍔-talouteen |
| 20.9.2026 | v4.34 | Jukebox + Hedelmäpeli auki aina | Auki **vain öisin (klo 20–06)**; päivällä ovesta teksti-popup `Avoinna` / `Klo 20 - 06`. **Ei muutoksia panokseen, painoihin, maksuihin, RTP:hen, 🍔-tahtiin eikä hintoihin** – vain aukioloaika |
| 20.9.2026 | v4.41 | Hampurilaisajastin tikitti myös nukkuessa – herätessä se jatkui täsmälleen siitä mihin jäi, joten 1 🍔:lla nukkuja saattoi kuolla heti herätessään | Nälkä on **jäissä** makuuhuoneessa ja Zzz-pimennyksen aikana (`hungerOnHold()`), eikä pelaaja voi kuolla nukkuessaan. Herätessä ajastimelle jää vähintään **10 s** (`HUNGER_WAKE_GRACE 600`). **Lukitut arvot ennallaan:** 2400 framet (1/40 s), katto 10, hinnat, RTP. Rajaus: **vain nukkuminen** – BAR/jukebox/iframe-pelit tikittävät ennallaan |
| 20.9.2026 | v4.43 | Makuuhuoneen (talo 7) ovi vapautettu avaimilta (käyttäjän pyyntö: *"Vapauta ovi, että ei tarvi 3 avainta että pääsee nukkumaan. Pitähän sen pelaajan itse voida päättää milloin haluaa nukkua."*) | Pääsy **vain 3 avaimella** (`allKeysCollected()`); avaimet ohittivat lampun, ilman avaimia popup "Ei tänne pääse ilman avainta". Kynnysvalo ja oven "auki"-asu riippuivat avaimista | Ovi **aina auki kuten BAR:lla** – ei avaimia eikä lamppua, päivällä ja yöllä (`street.js`: `handleAction`, `drawThresholdPaving`, `drawDoor`; avainpopup poistettu). **Kolikko-/🍔-talous ei muutu:** Nuku/Poistu ilmaisia, 2400 framet, katto 10, hinnat ja RTP ennallaan. **Seuraus:** nukkua voi heti ensimmäisenä yönä → `state.isDay` asettuu ennen avaimia, joten v4.32:n "3 avainta → päivä kerran" -auringonnousu ei enää laukea sen jälkeen (sama kuin aiemmin nukkumalla); vapaa huone = paikka pitää nälkä jäissä |
| 21.9.2026 | v4.44 | Nukkuminen antoi 0 🍔:tä (käyttäjän pyyntö 21.9.2026) | Nuku → **+1 🍔** (katto 10). Ei muutoksia muihin talousarvoihin |
| 21.9.2026 | v4.46 | Jukebox: **monivalinta** (käyttäjän pyyntö 21.9.2026: *"listalle voi valita ja laittaa soimaan useampiakin kappaleita … yksinkertainen ratkaisu"*) – vain käyttöliittymä/soittologiikka, **hinnat eivät muutu** | Rivi 0 = "ei valintaa", Space/Enter/⚡ = poistu → **−1 🪙 ja yksi kappale** soi | Rivi 0 = **Poistu**, (o)/Space/⚡ = ota/poista kappale, Enter = soita & poistu; veloitus **1 🪙 / valittu kappale** (niin moneen kuin kolikoita riittää) ja valitut soitetaan peräkkäin 1 → 3; äänen puuttuessa kaikki veloitetut palautetaan. **Lukitut arvot ennallaan:** 1 🪙/kappale, RTP, painot, 🍔-tahti, BAR, syntymäpaketti |
| 21.9.2026 | v4.49 | Nälkä (🍔-kulutus) oli **jäissä vahingossa BAR:ssa ja jukeboxissa**, ja `closeGame()` täytti 40 s ajastimen joka poistumisella (hedelmäpelin lyhyet sessiot eivät kuluttaneet mitään). Käyttäjän havainto 21.9.2026 (*"muissa ei tarvisi olla vaan jatkuu, kunten katuelämä"*) | Nälkäblokki oli huoneiden `return`ien jälkeen → katu + iframe-pelit kuluttivat, BAR/jukebox/makuuhuone eivät; alapelistä poistuminen `hamburgerTimer = 2400` | Nälkäblokki siirrettiin `update()`in alkuun (kuolemasekvenssin jälkeen) → kulutus jatkuu **kaikkialla paitsi nukkuessa**; `closeGame()` ei enää nollaa ajastinta. **Lukitut arvot ennallaan:** 2400 framet (1/40 s), katto 10, BAR 1 🪙 = 1 🍔, jukebox 1 🪙/kappale, RTP ≈ 78,5 %, syntymäpaketti. Validoitu `%TEMP%\street-hunger-scope-test.cjs` |
| 21.9.2026 | v4.52 | Putoamisen hinta vaihdettiin hampurilaisesta **kolikoihin** (käyttäjän pyyntö 21.9.2026: *"vaihdetaankin niin, että kun tippuu kaivoon menee 2 kolikkoa"* + tarkennus: *"Näin 3 = 1, 2 = 0, 1 = 0, 0 = 0 jos tipahtaa kaivoon. Aina menee 2 kolikkoa jos on mitä mennä. Jos vain 1 kolikko, se ainutkin menee."*) | Putoaminen = **−1 🍔**, ei tainnutusta; 🍔 0 → kuolema | Putoaminen = **enintään −2 🪙** (`MH_COIN_COST`): **3 → 1, 2 → 0, 1 → 0, 0 → ei mitään**. Ei 🍔-menetystä eikä kuolemaa (ei tainnutusta). **Muut lukitut arvot ennallaan:** 2400 framet (1/40 s), katto 10, BAR 1 🪙 = 1 🍔, jukebox 1 🪙 / kappale, RTP ≈ 78,5 %, syntymäpaketti 2 🪙 + 5 🍔 |
| 21.9.2026 | v4.51 | Kadun 2 viemärinkantta olivat aina ehjiä – vaaralistalla vain oviukko / kukkaruukku / sähkökaappi. Käyttäjän pyyntö 21.9.2026 (*"Toisinaan niistä toinen voisi puuttua ja pelaaja voisi pudota kaivoon. Kun kansi puuttuu kohta on musta. … 1/6 tapauksesta ja tilanne voi myös muuttua 1/10 kun pelaaja käy jossain huoneessa ja palaa takaisin kadulle."*) ja valinta: **−1 🍔 ilman tainnutusta** | Kansia ei voinut puuttua eikä niihin voinut pudota | **Avoin kaivo:** kansi voi puuttua (1/6 pelin alussa, 1/10 huoneesta/alapelistä palatessa – voi myös palata). Kohta on musta reikä; siihen astuva **putoaa alas, katoaa ja köpii ylös** = **−1 🍔**, **ei tainnutusta** (🍔 0 → kuolema; menetys sama kuin muilla kadun vaaroilla). Putoaminen on **reunaehtoinen** ja vältettävissä kiertämällä. **Lukitut arvot ennallaan:** 2400 framet (1/40 s), katto 10, BAR 1 🪙 = 1 🍔, jukebox 1 🪙 / kappale, RTP ≈ 78,5 %, syntymäpaketti 2 🪙 + 5 🍔. Testityökalut `?hole=0/1/2` |
| 21.9.2026 | v4.50 | v4.49:n **"siirretty kuolema" osoittautui vääräksi**: 0 🍔:lla saattoi jäädä huoneeseen/alapeliin loputtomiin (1 🍔 riitti "ilmaiseksi lipuksi" sisätiloihin). Käyttäjän linjaus 21.9.2026: *"Pelaajan PITI kuolla jos hän menee syömättä eri tiloihin ja hampurilaissaldo loppuu. … Piti olla niinpäin, että pelaajalla tulee aina huolehtia, että hampurilaisaldoa riittää paitsi nukkuessa."* | 0 🍔 huoneessa/pelissä → kuolema siirrettiin kadulle + 10 s armoaika (`starvingOnExit` + `checkStarvingOnExit`), joten sisällä ei voinut kuolla | Kuolema laukeaa **heti myös huoneessa/pelissä**: `killPlayer()` + `leaveHiddenStateForDeath()` (alapeli `closeGame()`illa tai canvas-huone `closeRoom()`illa kiinni) → pelaaja romahtaa **näkyvästi kadulle** → tuttu resetti. `starvingOnExit`/`checkStarvingOnExit` **poistettu**; `closeGame()` ei enää muuta tallennettua 0 🍔:ää 5:ksi. **Lukitut arvot ennallaan:** 2400 framet, katto 10, hinnat, RTP. Validoitu `%TEMP%\street-hunger-scope-test.cjs` (25 tarkistusta, 0 löydöstä) |
| 22.9.2026 | v4.68 | Rosvo vie myös kaikki rahat (käyttäjän pyyntö 22.9.2026: *"Muuta siten myös, että rosvo vie hampurilaisen lisäksi kaikki rahat. Näinhän siinä oikeassakin elämässä käy."*) | Rosvo: **−1 🍔** (tainnutus, sama kuin avenger) | Rosvo: **−1 🍔 + kaikki kolikot** (`coinCount → 0`, **ei ilmoitusta** – sääntö 06); tainnutus ennallaan. **Muut lukitut arvot ennallaan:** 2400 framet (1/40 s), katto 10, BAR 1 🪙 = 1 🍔, jukebox 1 🪙 / kappale, RTP ≈ 78,5 %, syntymäpaketti 2 🪙 + 5 🍔 |
| 23.9.2026 | v4.69 | Kaivoon putoaminen voi tuottaa rahaa (käyttäjän pyyntö 23.9.2026: *"randomina 1/3 putoamisista kaivosta saakin 3 rahaa"*) | Putoaminen = **aina menetys**: enintään −2 🪙 (3 → 1, 2 → 0, 1 → 0, 0 → ei mitään) | **1/3 putoamisista kaivon pohjalta löytyy +3 🪙** (`MH_BONUS_CHANCE` 1/3, `MH_BONUS_COINS` 3) – kolikon pling + kultahiukkaset reiästä, ei uutta tekstiä/ilmoitusta; loput 2/3 putoamisista menetys kuten ennen. Odotusarvo putoamista kohden: 0 🪙:lla **+1,00 🪙** · 1 🪙:llä **+0,33 🪙** · 2 🪙:llä **−0,33 🪙** · 3+ 🪙:llä **−0,33 🪙** (menetys = `min(rahat, 2)`) → kaivo on edelleen keskimäärin menetys, kun rahaa on vähintään 2. **Muut lukitut arvot ennallaan:** 2400 framet (1/40 s), katto 10, BAR 1 🪙 = 1 🍔, jukebox 1 🪙 / kappale, RTP ≈ 78,5 %, syntymäpaketti 2 🪙 + 5 🍔, rosvo (v4.68) |
| 23.9.2026 | — (parametri) | Kaivoon putoamisen plussakerroin pienennetty (käyttäjän pyyntö 23.9.2026: *"Muutetaan niin että vain joka 1/6 kun kaivoon putoaa voi saada rahaa"* – kaivoon ei kannata hypellä). **Ei versionnostoa** – pelkkä parametrin säätö (sääntö 03) | **1/3 putoamisista +3 🪙** (`MH_BONUS_CHANCE` 1/3) | **1/6 putoamisista +3 🪙** (`MH_BONUS_CHANCE` 1/6, `MH_BONUS_COINS` 3 ennallaan). Odotusarvo putoamista kohden (menetys = `min(rahat, 2)`): 0 🪙:lla **+0,50 🪙** · 1 🪙:llä **−0,33 🪙** · 2 🪙:llä **−1,17 🪙** · 3+ 🪙:llä **−1,17 🪙** → kaivo on nyt selvä menetys kaikilla saldoilla ≥ 1 🪙 (vain 0 🪙:lla +0,50, mutta silloin ei ole mitään menetettävää). **Muut lukitut arvot ennallaan:** 2400 framet (1/40 s), katto 10, BAR 1 🪙 = 1 🍔, jukebox 1 🪙 / kappale, RTP ≈ 78,5 %, syntymäpaketti 2 🪙 + 5 🍔, rosvo (v4.68), MH_COIN_COST 2 |
| 23.9.2026 | v4.70 | **🍔-määrä vaikuttaa pelaajan kävelyvauhtiin** (käyttäjän pyyntö 23.9.2026: *"hampurilaisten määrä vaikuttaisi pelaajan nopeuteen: 3 =< nykyisestä 2/3 nopeus · 3 > nykyinen nopeus · 8–10 tuplanopeus"*). **Ei lukittu arvo** – vain pelaajan liike, ei hintoja eikä tahteja | Vauhti aina **1,00 × `PLAYER_SPEED` (1,225)** riippumatta 🍔-määrästä | **`hungerSpeedMult()`** (`street.js`): **≤3 🍔 → 2/3** (`HUNGER_SPEED_SLOW_MULT`) · **4–7 🍔 → 1,00** (nykyinen) · **8–10 🍔 → 2,00** (`HUNGER_SPEED_FAST_MULT`); koskee sekä vaaka- että pystyliikettä (`moveSpeed`) ja kävelyanimaation/askeläänen tahtia (`walkTimer`). **Lukitut arvot ennallaan** (2400 framet = 1/40 s, katto 10, BAR 1 🪙 = 1 🍔, jukebox 1 🪙 / kappale, RTP ≈ 78,5 %, syntymäpaketti 2 🪙 + 5 🍔, rosvo v4.68, MH_COIN_COST 2 / MH_BONUS_CHANCE 1/6) ja **vihollisten nopeudet ennallaan** (oviukko 2.0, rosvo 1.05) → 8–10 🍔:llä oviukon voi karistaa karkuun = tarkoituksellinen palkinto täydestä vatsasta. Ei uutta localStorage-avainta; testityökalu `?burgers=N` pakottaa vain vauhtilaskennan eikä tallenna mitään |
