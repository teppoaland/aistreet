# 🎯 Aktiivinen konteksti

> **Kevyt:** Vain tämä tiedosto luetaan session alussa.
> **Kompaktoitu 23.9.2026 (v4.71):** versiokohtainen yksityiskohtaselostus (v3.9x–v4.49) on git-historiassa
> (viimeisin täysi versio commitissa `ffb1dd9`; HEAD `cc7046b`). v4.50+ tiivistetty alla.

---

## 📌 Kommunikaatiosääntö (KÄYTTÄJÄN PYYNTÖ)

> **"Lue membank"** → lue muistipankki hiljaa itseäsi varten. **ÄLÄ anna yhteenvetoa.**
> **Kun käyttäjä sanoo "commit" (tai "push" tms.)** → `git add -A && git commit && git push` yhdellä komennolla.
> **✂️ Ei pitkiä yhteenvetoja** → raportti 2–5 riviä: mitä muuttui + lopputulos.

---

## 📍 Nyt (AI CHAOS STREET – fork 27.9.2026)

- **Projekti:** **AI CHAOS STREET** – uusi itsenäinen projekti (`D:\AI\AI_street`, repo `aistreet`, Pages
  `teppoaland.github.io/aistreet/`), forkattu Pimeä Katu v5.02:sta. Alkuperäinen `D:\AI\Main`
  (v5.02, `pimeakatu`) jäädytetty. **Versio:** `v10.16` (`index.html` → `#version-tag`).
- 🔓 **Sääntö 04 (talousbalanssi-lukko) EI PÄDE enää AI CHAOS STREET -versiossa** (käyttäjän linjaus
  27.9.2026): sääntö 04 kirjoitettiin **alkuperäistä Pimeä Katu -peliä** varten ja sen lukitut arvot
  ovat NORMAL-tason arvoja. Chaos-forkissa NORMAL on vain yksi kaaostaso → talousarvot
  (aloituskolikot/🍔, 🍔-tahti, RTP, hinnat, syntymäpaketti) ovat **vapaita muutettaviksi/kaaostettaviksi**
  myös NORMALissa. `.clinerules/04-economy-balance.md` ja `docs/economy-balance-memo.md` ovat
  historiallisia viitteitä alkuperäispeliin, **eivät sitovia** chaos-versiossa. K4-taloudelliset akselit
  (❓2) voidaan siten avata ilman sääntö 04:n prosessia.
- **🌀 Alkuhubi + kaaostasot (v10.01):** `index.html` `#chaos-menu` (NORMAL / MILD / GOOD / BAD /
  FULL CHAOS). `street.js` `setChaos()` + `chaosProfile()` + `applyChaosProfile()` +
  `generateFullChaosSeed()`. Hub näytetään aina latauksessa → valinnan jälkeen spawn-arpa ja
  session valitun tason asetuksilla. Kaaos muuttaa VAIN olemassa olevia arvoja/kertoimia:
  tuuli/pilvet (`windSpeedMult`, `windDirFlip`), liikenne (`trafficSpeedMult`, `trafficSpawnMult`),
  vuorokausi (`DAY_CYCLE_FRAMES`, `skyDir` = auringon/kuun suunta), linnut (`BIRD_COUNT_MIN/MAX`),
  kolikko (`COIN_RESPAWN_FRAMES`), rosvo (`ROBBER_APPEAR_CHANCE/SPEED/COOLDOWN/TTL`).
  NORMAL = nykyiset arvot bitti-identtisinä.
- **🔄 F5-soft reset (v10.06):** hubia **ei näytetä** F5/reloadissa – valittu mode + ratkaistu
  `chaosCfg` tallennetaan `sessionStorage`en (`aistreet_chaos_session`; selviää reloadista, tyhjenee
  uudessa välilehdessä). F5 jatkaa samassa modessa ja **samalla** kaaosconfigilla (myös FULL:in
  satunnaiset värit/palettit) – kolikot/🍔 säilyvät `pimeakatu_gamestate`:ssa. Hubi näytetään vain:
  **ensivierailu/uusi välilehti**, **✕-hard reset** ja **kuolema** (kaikki kolme tyhjentävät sessionin).
- **🎵 Valikkomusiikki (v10.07):** alkuvalikko ("Choose your chaos level") soi oman biisin –
  `jukebox/alec_koff-heavy-doom-dark-metal-493397.mp3` (loop). **Vain valikossa** – pelin syntikkaa ja
  jukeboxia ei kosketa. `audio.js`: `MENU_MUSIC_FILE`, oma `menuEl` (loop), `setMenuActive(on)` +
  `startMenuMusic`/`stopMenuMusic`; `onGesture` valikon auki ollessa soittaa vain valikkobiisin (ei
  pelitaustaa) ja yrittää uudelleen autoplay-eston jälkeen. `street.js` `DOMContentLoaded`:
  valikon näyttö → `StreetAudio.setMenuActive(true)`, `start()` → `setMenuActive(false)` + `StreetAudio.start()`.
- **🚪 Aloitusgate (v10.08):** autoplay-lukon takia valikkobiisi ei ehdi kuulua, jos chaos-tason klikkaa heti.
  Ratkaisu: ennen chaos-valikkoa pieni `#start-gate` ("CLICK / PRESS ANY KEY TO BEGIN") – ensimmäinen ele
  avaa äänilukon → chaos-valikko aukeaa **musiikin soidessa**. `index.html` `#start-gate` + `style.css`
  (gate 9100, blink-animaatio) + `street.js` `DOMContentLoaded` (`setMenuActive(true)` jo gatessa, `onGesture`
  hoitaa musiikin, `unlock()` näyttää valikon). Fallback ilman gate-elementtiä.
- **⏱️ Aloitusgaten 2 s viive (v10.10):** korjaa mobiilin ghost-clickin – gaten napautus avasi valikon heti,
  jolloin sama napautus (touchend + synteettinen click) osui valikon alla olevaan kaaostasonappiin ja eteni
  suoraan peliin. Nyt `unlock()` viivyttää `showMenu()`ta **2000 ms** (`GATE_MENU_DELAY_MS`, `setTimeout`) ja
  poistaa kuuntelijat välittömästi + `unlocked`-lippu estää toiston → napautuksen synteettiset jatkotapahtumat
  tapahtuvat valikon ollessa vielä piilossa.
- **🎵 Syntikka piilossa kunnes jukebox soi (v10.11):** pelin oma taustamusiikki (proseduraalinen syntikka /
  "wave") ei soi ennen kuin jukeboxista on soitettu vähintään yksi kappale. `audio.js`: `synthUnlocked`-lippu +
  julkinen `setSynthUnlocked(on)` (nollaa `musicGraceMs`/`fadeInNextSynth`); `playPhase()` palaa heti
  (`phase='silent'`, ei ajastinta) kun lukittu. `gameState.js`: `defaultState.jukeboxPlayedOnce: false`.
  `street.js`: `init()` → `StreetAudio.setSynthUnlocked(state.jukeboxPlayedOnce === true)`;
  `jukeboxExitAndPlay()` asettaa lipun onnistuneen soiton jälkeen (molemmat haarat). Lukituksen auettua
  `onJukeboxEnded()` → `playPhase()` alkaa soida normaalilla syklillä. Lippu on `pimeakatu_gamestate`:ssa →
  nollautuu kuolemassa/✕-resetissä (per run, käyttäjän valinta). Valikkobiisi ja grace koskematta.
- **🔪 Rosvo jahtaa vapaasti BAD CHAOS -tasolla (v10.12):** uusi kaaosakseli `robberChasesY` (boolean, oletus
  `false`; `CHAOS_DEFAULTS2` false, `chaosProfile('bad')` true, muut/full false). `ROBBER_CHASES_Y`-lippu +
  `applyChaosProfile()` kirjoittaa sen. `updateRobber()`: jahtaus haarassa ohjaa molemmilla akseleilla kuten
  avenger (`r.x += sign(pcx−rcx)·speed·dt`, `r.y += sign(player.y−r.y)·speed·dt`, `facing` pelaajaan) ja kiinniotto
  **ilman** `onLane`-ehtoa (pelkkä etäisyys < `ROBBER_HIT_R`); muuten partiointi + kaistakiinniotto bitti-identtinen.
  **Rosvon elinikä kuluu nyt myös piilossa** (kaikki tasot): uusi blokki `trackHiddenStreet()`:n jälkeen tikittää
  `robber.ttl`:ää kun `iframeOpen || sleepRoom || barRoom || jukeboxRoom || newsRoom` → "piiloudu ja odota"
  -pakoreitti toimii. Renderöinti ennallaan (rosvo aina pylvään takana, kuten avenger). Nopeus yhä klampissa ≤ 1,4 × C.
- **🌠 Meteoriitti + valikon vaakakuva (v10.15/v10.16):** tähdenlennon tilalla iso, hitaasti putoava
  meteoriitti (ei-NORMAL: MILD 12 % · GOOD 8 % · BAD 40 % · FULL 55 %; NORMAL 0 %). `shootingStar.kind` +
  `meteoriteChance()`. v10.16 hienosäätö: viisto laskeutumiskulma 40–60° vaakasuorasta (kuten tähdenlento),
  häntä 2x pidempi, tärinä ~2,5 s, ja törmäysvälähdys = koko **taivas** välähtää salaman lailla (~1 s,
  talojen takana) – ei etualan tulipalloa. Kipinät (`spawnParticles`) + `drawMeteorite()` (kalpea hoikka vana +
  heikko hehku). Tärinä/välähdys vain katunäkymässä (huoneet return-varhain; meteoriitti päivittyy vain
  kadun yöpolussa).
- **📱 Choose your -valikko vaakakuva (v10.15):** mobiilin landscape (≤ 500 px korkeus) – napit `flex-wrap: wrap`
  -riveihin (3+2), pienempi otsikko/teksti, jotta koko valikko mahtuu matalaan näyttöön (ei aiemmin ollut
  puhelinoptimoitu).




- **⏱️ Grace-jakso (v10.09):** menun heavy metal → pelin syntikka -pudotus pehmennetty: pelin alkaessa
  **valikosta** syntikka on hiljaa ensimmäiset **30 s** (vain kadun ambientti), sitten häivyttyy sisään
  (`SYNTH_FADE_IN 800 ms`). F5 ei saa gracea. `audio.js`: `start(delayMs)`, `musicGraceMs` + `fadeInNextSynth`
  `playPhase()`:ssä, `startSynth(fadeInMs)` (linearRamp 0→1). `street.js` `start()` → `StreetAudio.start(30000)`.
- **📄 Kaaosparametrien suunnitelma v2 (27.9.2026):** `docs/chaos.md` – kategoriat K0–K7, tasomanifesti, C-kyvykkyysindeksi + 🍔-intervallin lattia (1200 f), kielletyt yhdistelmät, MUST-kohteet (kova tuuli · paksut pilvet + myrskytaivas · vihreä aurinko), toteutusresepti portteineen, testaus/DoD, 4 vaihetta ja avoimet päätökset (`❓`). Koodivaiheet `v10.02`…`v10.05` – **v10.02 (K0), v10.03 (K1), v10.04 (K3+K4), v10.05 (K2+K6+K7) valmiit.**
- **🛡️ Kaaoksen kaksi pääsääntöä:** (1) **NORMAL ei saa koskaan hajota** – kaaosarvot ovat NORMALissa no-op ja peli on bitti-identtinen; (2) **koko peli pysyy pelattavana kaikissa moodeissa** – jokainen arpa kulkee `clampChaosCfg()` + `validateChaosCfg()` -portin läpi (ei epäreilua kuolemaa, uhkanopeus ≤ 1,4 × C).
- **🛡️ Kaaosportti K0 (v10.02):** `street.js` – `makeRng` (mulberry32) + `chaosRng`, testikytkimet
  `?chaos=`/`?seed=`/`?debug`, `CHAOS_DEFAULTS2` (täysi superset NORMAL-arvoilla) + uudet `let`:t
  (`cloudCount`, `starCount`, `sunColor`, `animalSpeedMult`, …). Portti `clampChaosCfg()`/
  `validateChaosCfg()`/`chaosAbility()` valmiina (tuotantokäyttö v10.03+). NORMAL bitti-identtinen.
- **🧪 Sääntö 05 päivitetty (27.9.2026):** AI **saa** testata ja kirjoittaa/ajaa testiskriptejä oman
  harkinnan mukaan (erityisesti kaaos-/rakennevalidointi); käyttäjän silmä jää lopulliseksi tuomariksi ulkoasussa.
- **🌠 Meteoriitti-idea (vaihe 2, ❓4):** käyttäjän idea – tähdenlennosta voisi tulla iso, hitaasti ja
  pahaenteisesti etenevä meteoriitti (yllätys). Liittyy `tähdenlento/satelliitti`-akseliin (K1) ja ❓4:ään
  (meteor/satelliitti-logiikka on `street.js`:ssä kahtena kopiona: 2632–2676 ja 2302–2303).
- **🌀 Kaaos Vaihe 2 (K1, → v10.03) VALMIS:** ❓4 = refaktoroi tähdenlento/satelliitti apufunktioiksi
  (`updateShootingStar`/`updateSatellite`), **ei** meteoriittia. K1-akselit käyttöön: kova tuuli
  (`windSpeedMult` BAD 2.0–3.5), paksut pilvet + myrskytaivas (`cloudCount/cloudOpacityMult/cloudSizeMult`/
  `cloudBandTop/H`/`cloudCirrusShare`/`CLOUD_DAY_ALPHA`/`DAY_SKY_*`), **vihreä/violetti/verenpunainen aurinko**
  (`sunColor`/`sunGlow`), tähdet (`starCount`/`starSizeMult`), ikkunavalot (`windowTargetMax`/`windowDurMin/Max`/
  `SILHOUETTE_CHANCE`/`WIN_DAY_FILL`), talopaletit (`WARM/NEAR_BLACK/randomHuePalette`), eläimet
  (`animalSpeedMult`/`animalDirBias`/`animalTypeWeights`), lepakot (`batSpawnFrames`/`BAT_COUNT_MAX`),
  linnut (`birdSpeedMult`), kuoriaiset (`beetleCount`), lamput (`lampHueShift`/`LAMP_RADIUS`). NORMAL bitti-identtinen.
- **🌀 Kaaos Vaihe 3 (K3+K4, → v10.04) VALMIS:** C-indeksi tuotantokäyttöön (`drawChaosCfg`: klampit +
  validointi kaikille arvoille; FULL-arpa rejection sampling ≤ 40 yritystä). `chaosAbilityFor(cfg)` =
  `playerSpeedMult × hungerMultFor(startBurgers)` (portti käyttää arvottavan configin arvoja, ei elävää
  🍔-määrää – korjattu C-laskenta). K3: oviukon tn/nopeus/varoitus/jäädytys/tauko (`AVENGER_*`), rosvon
  nopeusarpa ≤ 1.4·C (`randomRobberSpeed`), liikenteen ylityssääntö (`crossMax`), sähkökaappi
  (`cabinetOnChance`). K4: kävelynopeus `playerSpeedMult` (klampi 0.6–1.6, ❓1=c), tainnutus (`avengerStun`/
  `robberStun` ≤ nykyinen), herätysrako `hungerWakeGrace`, 🍔-tahti `burgerInterval` (lattia 1200 f) +
  aloituskolikot/🍔 (`startCoins` 1–100 · `startBurgers` 2–10, vain `init`in `freshGame`-haarassa). NORMAL
  bitti-identtinen (portti no-op); offline-linteri `%TEMP%\chaos-phase3-test.cjs` 20 000 arpaa → 0 hylättyä.
- **🎴🔊 Kaaos Vaihe 4 (K2+K6+K7, → v10.05) VALMIS:** K2 loput: hämärä (`dayFadeFrames`/`nightFadeFrames`),
  vuorokausiviive (`cycleChangeDelayFrames`), lamppushow (`nightLampFirst`/`nightLampInterval`/`spawnLampDelay`),
  kaappien tahti (`cabBlinkMin/Max`/`cabRerollMin/Max`), hyttyset (`mosquitoDayDim`), tähdenlento/satelliitin
  tahti (`meteorTempoMult`). K6 (vain `street.js`, ❓3=a): SFX-taso `sfxVolumeMult` (potku/kolikko/osuma/
  kävely/sähköisku/lamppu). K7 (❓5=a): **10 visuaalista korttia** (`chaosCardDefs`/`updateCards`/
  `cardFlashWindows` + `cardState`): Vihreä hetki · Tähtisade · Sumu nousee · Tuulenpuuska · Valot sammuvat ·
  Kaikki ikkunat syttyvät · Eläinparaati · Värien vaihto · Taivaan vaihto · Tähtitaivas täyteen. 1 kerrallaan,
  3–6/sessio (ensimmäinen ≥ 60 s, väli 90–300 s), itsestään palautuvat, **ei vahinkoa/taloutta/tekstiä**,
  vain ei-NORMAL-tasoilla. Sumuverho (`fogAlpha`) + piirto renderissä. NORMAL bitti-identtinen;
  headless `%TEMP%\street-k2k6k7-test.cjs` (5 tarkistusta, 2000 FULL-arpaa → 0 hylättyä).
- ✅ **NORMAL varmistettu puhtaaksi** (headless, 56 avainta / 0 eroa): kaaosarvoja ei valu NORMALiin.
  Spawn-paikan arpa joka latauksella on **tarkoituksellinen** forkin ominaisuus (v10.01, ei korjata) –
  sama kuin talovärien ja tuulen suunnan arvonta.
- **📝 Nimeäminen/polut siivottu (27.9.2026):** `PROJECT.md` + `README.md` otsikoitu AI CHAOS STREET:ksi;
  vanhentuneet `D:\AI\Main\` -polut korjattu (`.clinerules/01`, `hook.md`, `PROJECT.md`).
- **🌳 Puiden lisähaara (v5.01):** `street.js` `drawBareTree()` – puiden 1 ja 2 oikean alaoksan (+0.7 rad) puolivälistä lähtee nyt +45° lisähaara (Math.PI/4, pituus 50 %, leveys 55 % emooksasta, syvyys 2).
- **🐦 Päivälinnut (v5.00):** `street.js` – päivällä 10–15 mustaa lintua istuskelee puiden latvuksissa (Y 275–285, korjattu 1.10.2026: nostettu ylemmäs oksille, pois rungolta ja latvan yläpuolelta). Liikkuvat satunnaisesti paikasta toiseen 3–12 s välein. Lepakot ennallaan yöllä.
- **🎵 Jukebox aina vapaa (v5.00):**ebox ei enää lukkiudu soiton ajaksi. Soivan kappaleen aikana voi valita lisää kappaleita, jotka lisätään jonon perään (numerojärjestyksessä 1→N). Tilateksti näyttää `Soittojonossa: X kappaletta` (`(i/n)`-parenteesi pois SOI NYT -riviltä).
- **💿 Jukebox-levynkuvan koko korjattu (v4.98):** `box = recR*2` → `(recR+4)*2`, jotta kansi peittää koko levypesän eikä tumma reunaympyrä pilkistä nurkista.
- **🎵 Jukebox 9 raitaa (v4.97):** raidat 7–9 lisätty (Alex Morgan + 2× NickPanek). Uusi nimeämiskäytäntö: `7_tiedostonimi.mp3` + `covers/7_tiedostonimi.png` – sama etuliite ja nimi pitää parin synkassa. Vanhat raidat 1–6 ennallaan.
- **🏮 Laivanupotus-lamppu poistettu (v4.96):** `lamps[5]` (x=193, bldgIdx:2) poistettu – talo 2 toimii nyt kuten jukebox: 1. potku sytyttää ikkunat 20s, 2. potku avaa oven. Aina auki yöllä ja päivällä (ei `nightOnlyClosed`). Muutettu `handleAction()`, `drawDoor()`, `drawThresholdPaths()`. `gameState.js` `litLamps` 6→5. Migraatio vanhoille tallennuksille initissä.
- **🎵 Syntikkatempo 🍔-vauhtiin (v4.94):** `audio.js` `startSynth()` valitsee BPM:n nyt `hungerTempo`-muuttujan mukaan (asetetaan `street.js`:stä `update()`-funktiossa). ≤3 🍔 → **110** (BPM_MIN) · 4–7 🍔 → **126** (keskiväli) · 8–10 🍔 → **142** (BPM_MAX). Jukebox-musiikkiin ei vaikutusta. API: `StreetAudio.setHungerTempo(mult)`.
- **🦇 Yölepakot (v4.93/v4.95):** `street.js` – yöllä 0–5 mustaa lepakkoa lenskelee korkealla (Y 45–245, nyt kuun korkeudella asti). Spawn 30s välein (vakio, ei enää random 30–90 s). 90 asteen satunnaiskäännöksiä, fade-out 1–5 s ennen poistoa. Piirretään talojen edessä.
- **💡 Lampun potku Y-akseli (v4.88):** `street.js` potkun osumatarkistus laski aiemmin
  pelaajan **keskipisteestä** (`player.y + player.h/2`), joka oli 20 px lampun jalasta → osuma
  ei toteutunut oikealla korkeudella. Korjattu käyttämään **jalan tasoa**
  (`player.y + player.h`), dy vain 5 px → potku osuu luonnollisesti kävelykorkeudella.
- **🚢 Laivanupotus (`sinkship/`) palkinto (v4.87):** voitosta +1 💰 (`postMessage('COIN_COLLECTED')`).
  Voittodialogissa teksti "Ansaitsit yhden 💰!". Tekstikorjaus: "sinkittyjä" → "upotettuja".
  Äänet puolitettu → vielä −20 % (nyt 40 % alkuperäisestä). Vuorodialogi ("◀ AMMU" / "▶ ODOTA"):
  tausta 56×26 → 80×38, läpinäkyvyys 0,62–0,92 → 0,35–0,55.
- **🚢 Laivanupotus UI (v0.11, 25.9.2026):** "VIHOLLINEN" ja "SINÄ" -labelit poistettu
  merikartoista (`drawBoardFrame`) – pelaaja näkee pelilaudalta kummin päin pelaa.
  HUD-korkeus (`hudH`) tuplattu 38–62 → 76–124, jotta HUD-teksteille on tilaa.
  HUD-tekstit keskitetty (`justify-content: center`) myös mobiilissa (oli `flex-start`).
- **⚡ Sähkökaapit arvalla päällä (v4.85):** kaappien tila on **elävä** – alussa
  arvotaan ~50 % päälle, ja sen jälkeen jokainen kaappi **sammuu/käynnistyy
  itsestään** omaan satunnaiseen tahtiinsa (uusi arpa `CAB_REROLL_MIN/MAX`
  900–2100 frameä = 15–35 s; `?cabs=1` / `?cabs=0` pakottaa ja jäädyttää, ei
  tallennu). Vain päällä oleva kaappi antaa sähköiskun, ja sen keltainen
  varoitusvalo vilkkuu kaapin OMAAN tahtiin (`CAB_BLINK_MIN/MAX` 420–700 ms) ja
  vaiheeseensa → valot eivät vilku tasatahtiin; sammuksissa olevan kaapin valo
  on tumma eikä kaappi iske. Osuman hinta (tainnutus + −1 🍔) ennallaan
  (sääntö 04). Committoitu cc7046b.
- **🚗 Auton osuma kaataa 10 px ylös osumakohdasta (v4.78):** `player.knockFallY` = osumahetken
  jalkapiste **− 10 px** (`updateTraffic`) → tainnutushaaran klamppaus käyttää sitä `GROUND_Y + 10`:n
  sijaan ("lentäminen kadun varteen" pois) – mutta ei jätä pelaajaa makaamaan keskelle tietä limboon
  (kolarijatkuva). Muut tainnutuslähteet (oviukko, rosvo, kukkaruukku, sähkökaappi, kuolema) ennallaan –
  `knockFallY` nollautuu ylösnoustessa. **Talous ennallaan** (−1 🍔, 600 f, sääntö 04).
  Committoitu cc7046b.
- **🚗 Ajoneuvojen syvyysjärjestys (v4.84):** ajoneuvot piirretään suhteessa pelaajan
  syvyyteen – kauemmat (keskipiste `v.y + v.h/2` < pelaajan jalkapiste `lampFeetY`)
  ENNEN pelaajaa (pelaaja päälle), lähemmät pelaajan jälkeen (kuten ennen). Ennen
  kaikki autot piirtyivät AINA pelaajan päälle, mikä näkyi rauta-aidan vierellä:
  autot "ylempänä" mutta pelaaja autojen TAKANA. Sama periaate kuin lamppupylväillä
  (v4.73); takapylväs/autot -järjestys ja katueläimen asema säilyvät.
- **Tila:** pääportaali + 5 alipeliä valmiit ja pelattavat (`digGame1` ⛏️, `digGame2` 💎, `bm` ✈️,
  `fruitgame` 🍒); **julkaistu – `https://teppoaland.github.io/aistreet/` (ONLINE)**.
- **Kadun canvas-huoneet (ei iframe):** makuuhuone (talo 7) · BAR (talo 9) · jukebox (`buildings[4]`,
  ovi x 410) · sanomalehti (`newsRoom`) · hedelmäpelitalo (`buildings[6]`, iframe).
- **Aukiolo (v4.34):** jukebox + hedelmäpeli auki **vain öisin** (päivällä `dayT >= 0.5` → popup
  `Avoinna` / `Klo 20 - 06`, `CLOSED_SIGN`, `nightOnlyClosed()`) – ei potkua, ei valoja, ei sisään.
- **Päivä/yö (v4.33, tallennettu `state.isDay`):** `null` = ratkaisematon · kaikki 3 avainta nostaa päivän
  kerran (v4.32) · sen jälkeen **makuuhuoneen Nuku** vaihtaa päivä ⇄ yö (Poistu ei muuta mitään).
  Makuuhuoneen ovi on **aina auki** (v4.43) → Nuku voi ratkaista tilan jo ennen avaimia.
- **Lukossa:** talous (sääntö 04), inventaario, pelien välinen rajapinta · **vapaasti säädettävissä:**
  testityökalut (`COIN_CHEAT_*`, `?coins`, `?debug`, `?day=0/1`, `?hole=0/1/2`, `?burgers=N`,
  `MUSIC_SOURCE`, `bm`-debug).

### 🆕 v4.50–v4.74 (tiivistetty – tarkat yksityiskohdat git-commiteissa)

- **🌙 Kuun paikka muistiin (v4.74):** `state.moonClock` (yön kulku frameinä) tallennetaan portin omaan
  `pimeakatu_gamestate`-tallennukseen (~2 s välein, `MOON_SAVE_FRAMES 120`; **ei** sulkeutumistallennusta,
  jotta kuoleman/✕-resetin nollaus ei herää henkiin)
  → **F5/reload jatkaa siitä mihin kuu jäi**. `applyMoonClock()` on ainoa paikan laskija (init /
  `resetMoon` / update). Kuu alkaa alusta vain: **kuolema ja ✕-resetti** (tallennus tyhjenee →
  `GameState.reset` / `removeItem`), **Nuku** (uusi yö) ja **päivä→yö** (sama Nuku-polku).
  `?day=0/1` → kuu lähtöasemasta eikä tallenna. `freshGame`-vertailu jättää `moonClock`in pois,
  ettei aloitusohje katoa. Ei uutta localStorage-avainta, `gameState.js` ei muutu.
- **🏮 Pylväs & pelaaja (v4.73):** katuvalopylväs piirretään joko pelaajan eteen tai taakse
  (`LAMP_BASE_Y = GROUND_Y + 15 = 325` vs. pelaajan jalkapiste `lampFeetY`): yläreitillä (`y ≤ 286`)
  pelaaja katoaa pylvään taakse, kadun puolella pelaaja peittää pylvään. Valo (`drawLampGlow`) on aina
  pelaajan alla, geometria `lampGeom()`; ajoneuvot/aita/ovet ennallaan.
- **🌙 Kuun ulkoasu (v4.72):** kuu piirretään tähtien jälkeen (peittää tähdet), kraatterit/maret +
  maavalo (`MOON_EARTHSHINE_*`), pehmeä terminaattori, `MOON_R 28 → 30`; pelkkiä ulkoasunuppeja –
  rata (`MOON_NIGHT_FRAMES`) ja talous ennallaan.

- **🍔 → kävelyvauhti (v4.70):** `hungerSpeedMult()` – **≤3 🍔 2/3** · **4–7 🍔 1,00** · **8–10 🍔 2,00**
  (`moveSpeed = PLAYER_SPEED × kerroin`; sama kerroin myös `walkTimer`iin → jalat eivät liu'u).
  Vihollisten nopeudet ennallaan → 8–10 🍔:llä oviukon voi karistaa karkuun. Testityökalu `?burgers=N`.
- **🔪 Oviukko ½-nopeuteen (parametri, ei versionnostoa):** `AVENGER_SPEED 2.0 → 1.0`; katu on rajattu
  800 px:iin → laidalla se nappaa; nälkäisenä (≤3 🍔 = 0,82) tavoittaa heti. Muut nupit ennallaan
  (1/8, 30 s cooldown, 3 s jäädytys, −1 🍔).
- **🔪 Rosvo (v4.66–v4.68):** yllätysesiintyminen vain kun pelaaja **palaa kadulle** pelistä/jukeboxista/
  BARista (`trackHiddenStreet()` → `maybeSpawnRobber()`); partioi kohti pelaajaa jalkakäytäväkaistalla
  (ei tielle); kiinniotto = tainnutus + **−1 🍔 + kaikki kolikot** (`coinCount → 0`, **ei ilmoitusta** –
  sääntö 06); katoaa nappauksen jälkeen → väistö (↓ toiselle puolelle) tai karkuun juoksu onnistuu.
- **🕳️ Avoin kaivo (v4.51/v4.52/v4.69):** toisesta viemäristä voi puuttua kansi (1/6 alussa, 1/10 joka
  paluulla) → musta reikä; siihen astuva putoaa alas ja köpii ylös. Menetys **enintään −2 🪙**
  (3 → 1, 2 → 0, 1 → 0, 0 → ei mitään) · **1/6 putoamisista +3 🪙** (`MH_BONUS_CHANCE` 1/6; alun perin
  1/3, parametrin säätö). Ei 🍔-menetystä, ei kuolemaa, ei tainnutusta; reiän voi kiertää. `?hole=0/1/2`.
- **🍔 nälkä kulkee kaikkialla (v4.49/v4.50):** kulutus jatkuu myös BAR:ssa, jukeboxissa ja iframe-peleissä;
  jäissä **vain nukkuessa** (`hungerOnHold()`) ja kuolleena. `closeGame()` ei nollaa ajastinta.
  🍔 = 0 → kuolema **heti paikasta riippumatta**; `leaveHiddenStateForDeath()` sulkee huoneen/alapelin,
  jotta kuolinsekvenssi näkyy kadulla. Validoitu `%TEMP%\street-hunger-scope-test.cjs` (25/25).
- **✕-nappi (v4.48):** sama `handleCloseButton()` molemmille ✕:ille – iframe → `closeGame()`,
  canvas-huone → `closeRoom()`, resetti vain kadulla; 600 ms dedupe (`CLOSE_DEDUPE_MS`) + `touchend`.
- **🛞 Panssarivaunu liikenteessä (v4.56–v4.63):** `type 'tank'` (86×36, nopeus 0,4–0,8, ei ajovaloa);
  moottorisaundi (28 Hz + särö + toinen oskillaattori), 75 px tykkiputki + telaketjut/telapyörät.
- **🎵 Jukebox 6 raitaa (v4.60/v4.61):** raidat 4–6 = 3 ilmaista heavy metal -raitaa + kansikuvat
  `jukebox/covers/{4,5,6}.png` (näytetään vain soivan kappaleen levykuvan paikalla; **mäppäys =
  jukebox-rivi, ei tiedostonumero** – ks. `street.js` kommentti r. ~197). Lista = 7 riviä (0 = Poistu).
  Liikenne **ei enää pysähdy** jukebox-huoneessa (`updateTraffic`, v4.61). LICENSE/README mainitsevat
  kolmannen osapuolen raidat.
- **📰 Sanomalehti kadulla (v4.53–v4.55):** rauta-aidan aukossa (x 338–352), poimitaan toimintonapilla
  (`nearNewspaper()`, säde 26 px) → `newsRoom` 5 sivua: 4 ohjesivua + **MANUAALI** (rahavirran
  ASCII-piirros 64/40 merkkiä; `newsLayout()`, generaattori `%TEMP%\newspaper-art.cjs`, validointi
  `np-verify.cjs`). Liikenne **ei pysähdy** lukiessa (`updateTraffic(dt)`) → auto voi ajaa yli
  (lehti putoaa, tainnutus −1 🍔); ylätunniste varoittaa `⚠ VARO AUTOA – liikenne ei pysähdy!`.
- **🌙 Kuu liukuu (v4.65):** alkaa vasemmalta (`MOON_X_MIN = SUN_X` 140) ja etenee oikealle **myös
  huoneissa/alapeleissä**, kunnes laskeutuu ulos (`MOON_SET_X ≈ 884`, `MOON_NIGHT_FRAMES 57600` ≈ 16 min);
  laskeutuessaan `moonDark` 0 → 0.15 (`MOON_SET_START 0.60`). `resetMoon()` uudessa yössä/spawnissa;
  `state.moonX` poistui käytöstä.
- **Aiemmat samassa työpuussa:** Nuku → **+1 🍔** (v4.44, katto 10) · jukeboxin monivalinta (v4.46:
  Space/(o) ota–poista, Enter soita & poistu, jono 1 → 3, 1 🪙/kappale) · katuvalot syttyvät yöllä
  itsestään yksi kerrallaan (v4.42, `NIGHT_LAMP_*`, `playLampOn()`) · nälkä jäissä nukkuessa (v4.41,
  `HUNGER_WAKE_GRACE 600`) · kuu ⇄ aurinko -ristihäivytys ilman liukua (v4.41) · päivä: pilvet tummenevat
  (v4.40), ovet auki ilman lamppua + moskiitot pois + valot sammuvat kerran (v4.38), liikenne ×2 (v4.37),
  ajovalot pois (v4.35), Zzz 3 s (v4.36), HUD 🍔-varoitus ≤3 (v4.39).

### 📜 Vanhemmat versiot (committattu – ks. git)

v4.43 makuuhuoneen ovi auki ilman avaimia · v4.34 aukiolo vain öisin · v4.33 palkintohuone → makuuhuone
+ tallennettu `isDay` · v4.32 päivä (`dayT`-liuku ~20 s) · v4.31 pelaajan syvyysskaalaus ±10 % ·
v4.30 hedelmäpelin seinäkuva MV · v4.28–v4.29 `#wall-pic` · v4.27 jukebox-tiedostonimet · v4.26 BAR-taulu ·
v4.25 `assets/justiina.png` · v4.20–v4.23 jukebox-huone · v4.17 siivous + nimet (Dig Däsh, Blue Mäx) ·
v4.16 taustamusiikki mp3 · v4.14–v4.15 oviukko · v4.13 ovikynnykset · v4.12 BAR-ostot · v4.11 hedelmäpeli
katuun · v4.07–v4.10 talot/ikkunat/siluetti · v4.03–v4.05 hahmon viilaus · v3.28–v4.02 (SFX, 🍔+BAR,
mopo, puut, kolikko, mobiilikamera, potkukolikko).

---

## 🔑 Säännöt (ladataan automaattisesti joka istunnossa)

- `01-general-architecture.md` – suojatut päätiedostot (`index.html`, `gameState.js`, `street.js`, `style.css`),
  alipelien itsenäisyys, ei npm-riippuvuuksia (vanilla JS/CSS/HTML).
- `02-game-core.md` – suojatut pelitiedostot (`physics/constants/game/levels/enemies/input`) + suojatut
  mekaniikat; **talous ja palkkiotase 🔒 LUKITTU**.
- `03-versioning.md` – +0.01 koodimuutoksesta; ei automaattista committia eikä pushia; raportti lyhyesti.
- `04-economy-balance.md` – 🔒 talous- ja tasapainolukko + ISO varoitus (ei säätöjä ilman erillistä pyyntöä).
- `05-kevyt-polku.md` – yhden näkymän/staattinen muutos: ei testejä, ei muistipankkia, raportti 1–3 riviä.
- `06-ei-dialogeja.md` – 🚫 ei uusia dialogeja/popupeja/ilmoitustekstejä ilman käyttäjän lupaa.
- `docs/`-memot: `bar-memo.md`, `jukebox-memo.md`, `fruit-game-memo.md`, `economy-balance-memo.md`,
  `dig-game-memo.md`, `dig-game-roadmap.md`, `bd-memo.md`, `bd-cleanup.md`, `bm.md`, `plan.md`.

## ⚙️ Nupit (säädettävät parametrit)

- **Oviukko:** `AVENGER_CHANCE 0.12` (1/8) · `AVENGER_COOLDOWN 1800` (30 s) · **`AVENGER_SPEED 1.0`**
  (½: pelaaja luulee pääsevänsä karkuun, mutta katu on rajattu 800 px → laidalla se nappaa; nälkäisenä
  ≤3 🍔 = 0,82 → tavoittaa heti) · `AVENGER_STUN 600` · `AVENGER_FREEZE 180` · `AVENGER_TELEGRAPH 21` ·
  `AVENGER_HIT_R 18` · `AVENGER_KIND 'twin'`.
- **Rosvo (v4.66):** `ROBBER_SPEED 1.05` (< pelaaja 1.225) · `ROBBER_HIT_R 16` · `ROBBER_TURN 40` ·
  kaista `ROBBER_LANE_TOP/BOTTOM = GROUND_Y..+16` · `ROBBER_APPEAR_CHANCE 0.4` · `ROBBER_COOLDOWN 1500`
  (~25 s) · `ROBBER_MIN_DIST 130` · `ROBBER_TTL 900` (~15 s).
- **🍔-vauhti (v4.70):** `HUNGER_SPEED_SLOW_MAX 3` · `HUNGER_SPEED_FAST_MIN 8` ·
  `HUNGER_SPEED_SLOW_MULT 2/3` · `HUNGER_SPEED_FAST_MULT 2` · `HUNGER_WARN 3` (HUD-vilkku).
- **Kaivo:** `MANHOLE_START_CHANCE 1/6` · `MANHOLE_RETURN_CHANCE 1/10` · `MH_COIN_COST 2` ·
  **`MH_BONUS_CHANCE 1/6` · `MH_BONUS_COINS 3`** · `MH_FALL_FRAMES 36` / `MH_CLIMB_FRAMES 210` /
  `MH_RISE_PART 0.65` / `MH_STEP_PX 9` / `MH_CLIMB_WOBBLE 1.6` · ellipsi `MH_HIT_RX 11` / `MH_HIT_RY 5` ·
  `?hole=0/1/2`.
- **Musiikki / jukebox:** `MUSIC_SOURCE 'synth' | 'mp3'` · `MUSIC_FILE 'knived_unafraid.mp3'` ·
  `SYNTH_PLAY_DURATION 30000` · `SONG_PLAY_LIMIT 30000` · `SONG_FADE_OUT 600` · `MUSIC_VOLUME 0.05` ·
  tauko `getSilenceDuration()` 30–90 s · `JUKEBOX_GAP 2500` · `JUKEBOX_VOLUME = MUSIC_VOLUME` ·
  `JUKEBOX_TRACKS` 6 kpl (raidat 4–6 = kolmannen osapuolen heavy metal + `covers/{4,5,6}.png`).
- **Panssarivaunu (v4.56):** `type 'tank'`, `w 86 / h 36`, nopeus 0,4–0,8, ei ajovaloa; ääni 28 Hz + särö
  + toinen oskillaattori.
- **Testicheatit:** `COIN_CHEAT_LAMP/KICKS/REWARD/GAP/COOLDOWN` = 4/20/20/120/3600 · avain-cheat 5 potkua
  (`lamps[4]`) · `?burgers=N`.
- **Ovikynnykset:** `THRESH_RINGS`, `THRESH_TOP_Y`, `THRESH_DIP`, `THRESH_DETAILS`, `THRESH_LIGHT`,
  `KERB_GAP_EXTRA`, laatan korko (`slab.h`).
- **Pelaajan syvyys:** `PLAYER_DEPTH_AMOUNT 0.10` · `PLAYER_DEPTH_MID 315` ·
  `PLAYER_DEPTH_MAX_Y = WORLD_H − 50` (350).
- **Päivä/yö:** `DAY_FADE_FRAMES 1200` / `NIGHT_FADE_FRAMES 1200` · `DAY_SKY_TOP/MID/HORIZON` ·
  `SUN_X 140 / SUN_Y 62 / SUN_R 26` (päivä, vasen) · `MOON_X 680 / MOON_Y 60 / MOON_R 28` (peruspaikka;
  v4.65 liuku `MOON_X_MIN = SUN_X` → `MOON_SET_X ≈ 884`, `MOON_NIGHT_FRAMES 57600`, `MOON_SET_START 0.60`,
  `MOON_SET_DARK_ALPHA 0.15`) · `DAY_LIGHT_RGB [70,58,40]` · `DAY_LIGHT_ALPHA 0.30` · `LAMP_DAY_DIM 0.15` ·
  `?day=1` / `?day=0`.
- **Liikenne (v4.37):** `TRAFFIC_DAY_MULT 2` · `LANE_DEFS` y 340/328 · nopeudet auto 1,0–1,5 ·
  mopo 1,5–2,5 · ambulanssi 1,8–3,0 · 1 ajoneuvo/kaista.
- **Päivän muut nupit:** `VEHICLE_HEADLIGHT_DIM 1` (v4.35) · `DOOR_NO_LAMP_AT_DAY` + `lampFreeOpen()`
  (v4.38) · `MOSQUITO_DAY_DIM 1` (v4.38) · `CLOUD_NIGHT_*` / `CLOUD_DAY_*` / `CLOUD_DAY_ALPHA 5` (v4.40) ·
  `NIGHT_LAMP_FIRST 30` / `NIGHT_LAMP_INTERVAL 18` / `NIGHT_LAMP_ORDER 'wave'` (v4.42).
- **Makuuhuone (talo 7):** `SLEEP_BLDG_IDX 7` · ovi aina auki (v4.43, `sleepOpen`) ·
  `SLEEP_DARK_FRAMES 45` + `SLEEP_ZZZ_FRAMES 180` (`SLEEP_FADE_FRAMES`) · `hungerOnHold()` ·
  `HUNGER_WAKE_GRACE 600` · `sleepSel` (0 = Nuku, 1 = Poistu) · sänky `bedW = min(340, panelW − 16)`.
- **Notifikaatiot:** `showNotification(text, durationMs = 2500)` + 0,5 s fade; `showSpawnHint` 4500 ms.
- **Aukiolo (v4.34):** `CLOSED_SIGN 'Avoinna\nKlo 20 - 06'` · `CLOSED_AT_DAYT 0.5` · `nightOnlyClosed()`.

## 🔒 Lukitut osa-alueet

- **Tekstit:** dialogit, overlayt, HUD-bar, notifikaatiot, lamppujen labelit, ovet – ei muutoksia ilman
  erillistä pyyntöä (sääntö 06: ei uusia dialogeja/popupeja).
- **Pelien välinen logiikka:** DG1 → DG2 → Blue Mäx, avaimet, `postMessage`-viestit, paluu kadulle – LUKITTU.
- **`inventory`-objekti** (`coin`, `coinCount`, `hamburgerCount`) – ei muokata ilman pyyntöä.
- **Talousarvot** (kolikot, 🍔, RTP, hinnat) – sääntö 04.
- **Sisäiset tunnisteet ja avaimet:** `digKeyCollected`, `boulderKeyCollected`, `bmKeyCollected`,
  `TILE.BOULDER`, `pimeakatu_gamestate`, `pimeakatu_fruit_free` – rajapintaa, ei uudelleennimeämistä.

## 🔜 Seuraavaksi (odottaa käyttäjän päätöstä)

- **Blue Mäx:** TESTIMODE pois → vihollisten ammunta takaisin 60 % aggressiolle.
- **Pääsiäismunat Dig Däshiin.**
- **Hedelmäpeli:** RTP-presetit (A 74 % / **B 78,5 % oletus** / C 85 %), panosvalitsin 1/2/5,
  symboligrafiikan hienosäätö. Testaus `fruitgame/game_main.html?coins=100` / `?debug`.
- **Jukebox:** `jukebox/Knived_Unafraid_instrumental.mp3` on sama äänite kuin juuren
  `knived_unafraid.mp3` → raita 3 voisi osoittaa juuritiedostoon (~2 MB säästö).
- **Jukebox-testit:** `%TEMP%\street-jukebox-*.cjs` odottavat vanhaa yhden valinnan mallia → päivitettävä
  (myös 6 raidan lista).
- **Päivä / makuuhuone – vapaat säädöt jos silmä vaatii:** ikkunavalot eivät sammu päivällä ·
  maagradientti · `DAY_LIGHT_ALPHA` / `DAY_SKY_*` · `bedW` / peiton väri / yöpöytä · `SLEEP_FADE_FRAMES` ·
  `NIGHT_FADE_FRAMES` · heräämisteksti.
- **Jatkoideat (ei tehty):** potkun 1 px screen shake · pää ja nyrkit recteinä `arc()`:n sijaan ·
  hengityksen syvyys 2 px / hitaampi sykli.

## ⚠️ Huomiot

- **Kadun talous – mekaniikat, eivät paperilukuja:** katukolikko näkyvissä 10 s (`despawnTimer 600`) →
  30 s tauko (`despawnCooldown 1800`) → uusi satunnaispaikka (x 0–780, y 310–380); kadun ylitys ~10,6 s →
  kolikko ehtii kadota nenän edestä. Keräysalue osuu autokaistoille (kaistat y 328 ja 340; turvassa
  `player.y ≥ 347`). **Tasapainoa ei todisteta laskemalla – se testataan pelaamalla** (sääntö 04).
- **Huoneet mobiilissa:** canvas on vain `viewW` (260–800) leveä ja kamera keskittää huoneen
  (`camX = (800 − viewW)/2`) → sisältö sovitetaan näkyvään ikkunaan (ks. `systemPatterns.md`).
- Pään ympyrä (arc r = 7, `py+6`) peittää paidan ylimmät rivit → pään/kaulan varjostus vasta `py+13`.
- **Pelaajan syvyysskaalaus (v4.31):** `s ≠ 1` tekee pikselikoordinaateista murto-osaisia → 1 px reunat
  voivat pehmentyä. Jos silmä havaitsee: kvantisoi skaala portaisiin (esim. 0,025 välein) tai
  offscreen-blitti lähimmällä naapurilla.
- **Päivä/yö (v4.33):** `state.isDay` (`null` / `true` / `false`); 3 avainta nostaa päivän kerran ja
  tallentaa `true`; v4.43:n avoin makuuhuone → **Nuku voi ratkaista tilan jo ennen avaimia**, jolloin
  v4.32:n auringonnousu ei enää laukea. Avain-cheat sytyttää päivän samalla logiikalla. Päivänvalo on
  additive-kerros (`'lighter'`) → palettia ei muuteta; valoisampaa saa nostamalla `DAY_LIGHT_ALPHA`.
- **Makuuhuone (v4.33/v4.43/v4.44):** päivä/yö-liuku on pysähdyksissä huoneessa (`!sleepRoom`) ja
  iframe-peleissä → muutos näkyy kadulle palatessa. Huone piirretään ennen päivänvalo-washiä.
  Nukkuminen antaa **+1 🍔** (katto 10) eikä koske lamppuihin, oviin eikä avaimiin.
- `handleAction()` palaa heti osumasta → hit pause asetetaan haaroissa, `actionJustPressed` nollataan
  framen lopussa (ei tuplapotkua). `KICK_DURATION` ja törmäyslogiikka ennallaan.
- `street.js` `lamps[].label` on **kuollutta dataa** – kadun kyltit eivät näytä pelien nimiä.
- **Headless-validointi** onnistuu Node `vm` + Proxy-canvas-stub -tekniikalla (rAF ohjattavana);
  testiskriptit `%TEMP%\*.cjs` – ei repossa (luettelo `progress.md`:ssä).
- Pääportaalin mobiiliohjain: `position: absolute`, `opacity: 0.65`, landscape overlay, D-pad + ⚡.
- Julkaisu: GitHub Pages `https://teppoaland.github.io/aistreet/` (ONLINE 27.9.2026).
