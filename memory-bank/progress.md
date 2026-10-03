# 📊 Projektin edistyminen

> **v11.49 – AI CHAOS STREET** · forkattu Pimeä Katu v5.02:sta 27.9.2026.
> **Kompaktoitu 28.9.2026 (v11.00, 29,5 → 20,7 kt):** tiivistettiin vain v10.x/uusi aines (v10.01–v11.00 -taulukko) + rakenteelliset viat (orvot taulukkorivit, tyhjät rivit, pitkät rivit).
> **Esiforkin v3.8x–v5.02 -historia säilyy alla sellaisenaan** (koko historia: `D:\AI\Main`, 196 committia; ffb1dd9 · cc7046b · 44db9e7) – tämän repon historia alkaa `b854771`.
> **3.10.2026: pankkia kevennettiin** – esiforkin taulukkorivit (v3.8x–v5.02) sekä vanhat
> penkkimuistiinpanot siirrettiin **`docs/pimea-katu-historia.md`**:hen; tässä tiedostossa ovat
> vain nykyajan (v10+/v11+) rivit ja refaktoroinnin kirjaukset.
> **Rajat (päivitetty 3.10.2026 – `progress.md` 45 → 65 kt, pysyvä):** tämä tiedosto **≤ 65 kt** · `activeContext.md` ≤ 65 kt · `systemPatterns.md` ≤ 25 kt · koko pankki **≤ 155 kt** – kokoa ei raportoida joka istunnossa; raja mainitaan vain, jos se ylittyy. Tämä tiedosto on **historia** (versiot, mittaustulokset, testipenkit): uusi rivi per versio, ei nykytilan kuvausta (se on `activeContext.md`:ssä).
>
> **🚧 Jatkopiste (3.10.2026, v11.48):** **koodirefaktorointi on VALMIS (Vaiheet 0–6) ja JULKAISTU**
> (penkit repoon, `update()` 85 rv, `render()` 143 rv, `handleAction()` 14 rv, `chaosFlags`,
> `rooms[]`, `dayNight`-olio, `street/chaos-config.js` + `street/sfx.js` + `street/news.js` +
> `street/traffic.js` + `street/chaos-cards.js` + `street/rooms.js`, kommenttien versiosiivous).
> **Tuotanto = `origin/main` = v11.48** (pushattu 3.10.2026); jäljellä vain ei-refaktorointityöt
> (Blue Mäx -testimode, pääsiäismunat Dig Däshiin, hedelmäpelin RTP-presetit, jukebox-testien siivous).
> **Bugikorjaukset v11.39** (K7 "Valot sammuvat" -kortti), **v11.41** (BAD/FULLin ikkunavalot),
> **v11.43** (FULLin canvas-arvot), **v11.44** (huoneiden logiikka + penkki 41/0), **v11.45**
> (päivä/yö-ryhmittely + kommenttisiivous) sekä **v11.46–v11.48** (HOSTEL-neonkyltti + huoneen
> otsikko + rauta-aita pois BAD/FULLista). **v11.49** = kuunvarjojen kaaoskerroin BAD/FULLissa
> (per talo ×1…3, kerran per yö) – **työpuussa, ei vielä julkaistu**. Jatko-ohjeet:
> **`activeContext.md` § "🚧 JATKOPISTE"**.

## 🏮 Pääportaali – AI CHAOS STREET

| Ominaisuus | Tila |
|-----------|------|
| 🌀 Alkuhubi + kaaosportti K0 | ✅ **v10.01 + v10.02** – `#chaos-menu` (NORMAL/MILD/GOOD/BAD/FULL); `setChaos`/`chaosProfile`/`applyChaosProfile`/`generateFullChaosSeed`; hubi näytetään ensivierailulla/uudessa välilehdessä/✕-resetissä/kuolemassa. Portti `clampChaosCfg`/`validateChaosCfg`/`chaosAbility` + `CHAOS_DEFAULTS2` + `makeRng` (mulberry32) + `?chaos=`/`?seed=`/`?debug`. NORMAL bitti-identtinen |
| 🧩 Kaaos K1 (visuaalinen) | ✅ **v10.03** – MUST-kohteet: kova tuuli (`windSpeedMult`) · paksut pilvet + myrskytaivas · vihreä/violetti/verenpunainen aurinko. Pääosa: tähdet, ikkunavalot, talopaletit, eläimet, lepakot, linnut, kuoriaiset, lamppujen sävy. ❓4 = tähdenlento/satelliitti apufunktioiksi (`updateShootingStar`/`updateSatellite`). NORMAL bitti-identtinen; parametrit `docs/chaos.md` |
| 🛡️⚔️ Kaaos K3+K4 (uhka + keho) | ✅ **v10.04** – C-indeksi tuotantoon (`drawChaosCfg`, FULL rejection sampling ≤ 40). K3 uhka: oviukko, rosvo ≤ 1,4·C, liikenne, kaapit. K4 keho: `playerSpeedMult`, tainnutus ≤ nykyinen, herätysrako, 🍔-tahti (lattia 1200 f), aloitusarvat. Linteri 20 000 arpaa → 0 hylättyä; parametrit `docs/chaos.md` |
| 🎴🔊 Kaaos K2+K6+K7 | ✅ **v10.05** – K2 kello: hämärä, vuorokausiviive, lamppushow, kaappien tahti, hyttyset. K6: SFX-taso `sfxVolumeMult`. K7: **10 visuaalista korttia** – 1 kerrallaan, 3–6/sessio, itsestään palautuvat, ei vahinkoa/taloutta/tekstiä. NORMAL bitti-identtinen |
| 🔄 F5-soft reset | ✅ **v10.06** – mode + ratkaistu `chaosCfg` `sessionStorage`en (`aistreet_chaos_session`) → F5 jatkaa samassa modessa (myös FULL:in arvot); kolikot/🍔 `pimeakatu_gamestate`:ssa. Tyhjenee: uusi välilehti, ✕-reset, kuolema |
| 🎵 Valikko + portti + grace | ✅ **v10.07–v10.10 + v10.14** – valikko soi `jukebox/alec_koff-heavy-doom-dark-metal-493397.mp3` (loop, vain valikossa); gaten ja valikon tekstit haihtuvat ennen siirtymää (v10.14); `#start-gate` ("CLICK / PRESS ANY KEY TO BEGIN") avaa äänilukon; `GATE_MENU_DELAY_MS 2000` estää ghost-clickin. Valikosta aloitettaessa syntikka hiljaa 30 s + häivytys (`SYNTH_FADE_IN`), F5 ei gracea · **v11.16: sama yliviivattu Ø kuin gatessa myös hubin otsikossa** (`AI CHAØS STREET`, U+00D8 – pelkkää tekstiä, ei piirrettyä viivaa) |
| 🎵 Syntikka piiloon + 🔪 rosvo BAD:ssa | ✅ **v10.11 + v10.12** – syntikka ei soi ennen kuin jukeboxista on soitettu 1 kappale (`synthUnlocked` – **poistettu v11.01**). `robberChasesY` (vain BAD): vapaat akselit + kiinniotto ilman kaistaehtoa; rosvon `ttl` kuluu **myös piilossa** |
| 🌠 Meteoriitti | ✅ **v10.15–v10.17** – tähdenlennon tilalla hidas meteoriitti (meteoriitteja **vain BAD 25 % ja FULL 100 %**, kaikki muut tasot 0 % – alkuperäinen "MILD 12 % · GOOD 8 %" oli vanhentunut); kulma 40–60°, tärinä + taivasvälähdys, jäänvalkoinen ulkoasu. Vain katunäkymässä; valikko `flex-wrap` puhelimen vaakakuvaan · **v11.22: talojen tuhoutuminen eskalaationa, ks. oma rivi alla** |
| 🌀 Akselit + 🌠 taustatalot | ✅ **v10.18 + v10.19** – uudet akselit: lukitut ovet (`doorLockChance`, vain jukebox + hedelmäpeli, ei ilmoitusta – sääntö 06) · hoipertelu · kuvan tärinä · punainen lamppu · BAR-kyltin palanut kirjain · kaapin rätinä · auringon koko. Meteoriitin osuma poistaa **3 taustataloa** (wrap-around); `initBackdrop()` palauttaa rivin kuolemassa/resetissä |
| 🔫 Sädease + meteoriitit | ✅ **v10.20–v10.24 + v10.25/26 + v10.32** – FULL: meteoriitteja aina + kadulta poimittava **sädease** (`beamPickup`, kerran/run); PC hiiri-tähtäys, mobiili täppäys; ammunta vain tulosuuntaan (`facing*vx<0`) ja lamppurivistön alapuolelta, talojen läpi ei ammu (`beamHitsBuilding`; v10.25/26: taloesto tarkistaa meteoriitin sijainnin, osuma tarkaksi); laserääni + valojuova; **ammuttu meteoriitti = +1 🪙** (hiljainen); FULL alkaa aina **2 🪙:lla**. BAD 25 % meteoriitteja **ilman** asetta. NORMAL bitti-identtinen |
| 📖 INSTRUCTIONS-ohjeikkuna | ✅ **v10.27–v10.31** – valikon punainen `INSTRUCTIONS` avaa CRT-ikkunan: avaus 1 s → teksti merkki merkiltä (`typeInstructions()`, nupit `INS_*`) → sulku 2 s (täppäys/Esc); ei mene itsestään kiinni; v10.31 vilkunta toimii puhelimilla |
| 🌐 Koko UI englanniksi | ✅ **v11.00** (28.9.2026) – kaikki pelaajalle näkyvä teksti englanniksi (`street.js`, `index.html`, `bm`, `digGame1/2`, `fruitgame`, `sinkship`); kommentit/dokumentit + sanomalehden ASCII-manuaalisivu suomeksi. Rajapinnat (`postMessage`, localStorage-avaimet), talousarvot ja kaaoslogiikka ennallaan; `lang="en"`; alapelien omat versiotagit ennallaan |
| 🎵 Kaaos-intro + syntikkalukko pois | ✅ **v11.01** – tuoreesta valikosta (kaikki moodit) soitetaan kerran `jukebox/8_nickpanek-coffee-first-heavy-grunge-metal-instrumental-391308.mp3` (`StreetAudio.playChaosIntro`, `loop=false`), sitten wave (`INTRO_GAP 2000`). `synthUnlocked`-lukko poistettu → wave soi oletuksena kaikissa sessioissa; `setSynthUnlocked` + 3 kutsua poistettu. F5 ei introa |
| 🎬 Kaaosvalinnan siirtymä | ✅ **v11.02** – valinnasta katu paljastuu 3 s siirtymällä: musta 2 s + valikkobiisin häivytys (`StreetAudio.fadeOutMenuMusic`, 50 ms portaat) → valikko piiloon + `init` + kaaos-intro **mustan alla** → 1 s häivytys pois (`.reveal`) → `hidden`. Nupit `CHAOS_BLACKOUT_MS 2000` / `CHAOS_REVEAL_MS 1000`; `#chaos-blackout` (z 9998) valikon ulkopuolella; F5/`?chaos=` ei siirtymää; NORMAL bitti-identtinen; ei uutta tekstiä (sääntö 06) |
| 🔔 Kaaosvalikon tärinä kaikille laitteille | ✅ **v11.27** – FULL CHAOS -pidon tärinä estyi reduce-motionissa **kahdesta paikasta** (`street.js` motion-lippu + `style.css` `@media`-yliajo) → Androidin "poista animaatiot" -tilassa **tärinä ei näkynyt puhelimissa**, kun PC toimi. Portit poistettu: tärinä ajetaan kaikilla laitteilla kuten pelin canvas-tärinä (BAD/FULL, meteoriitti, kolari). Muoto ennallaan (1 kierros / 10 s, pito + tärinä 2 s, 2–4 px), `insReducedMotion()` jäi ohjeikkunan ajoituksiin. Validoitu `street-autohover-test` 74/0 + `chaos-normal-check` (78 avainta, 0 eroa) + `street-chaos-fade-test` 24/0 |
| 🏚️ BAD/FULL arpoo talojen järjestyksen | ✅ **v11.32** – **Vain BAD ja FULL:** `shuffleBuildingOrder()` sekoittaa pääkadun 9 talon keskinäisen järjestyksen, mutta **talo pysyy kokonaisena** (korkeus, kyltti, rooli/toiminto, ovi, väri, lamppu kulkevat mukana) – pelaaja ei tiedä missä koti on. Asettelu lasketaan uudelleen kiinteällä rako-jonolla `BUILDING_GAPS`, joten se on aina täsmälleen 0…800 eikä päällekkäisyyksiä synny. Lamput oman talon viereiseen rakoon (ei kahta samaan), kaapit talon vas. seinään, puut 50 px rakoihin. `chaosRng` → `?seed=` toistettava. `resetBuildingOrder()` palauttaa oletukset (myös BAD/FULL-runin jälkeen) → **NORMAL/MILD/GOOD bitti-identtiset**. Ei uusia dialogeja (sääntö 06), ei talousmuutoksia. Testi `%TEMP%\street-building-order-test.cjs` (20 OK / 0 FAIL + 300 satunnaisarpaa puhtaat) |

| 🍺 FULL CHAOS – BAR myy olutta & humala | ✅ **v11.31** – **Vain FULL:** BAR (talo 8) myy olutta 🍺 (1 🪙 / tuoppi, katto 10; ▲ osta / ▼ peru) hampurilaisten sijaan. **Elämä kaksikerroksinen:** 🍺 (ylin) kuluu ensin, ja vasta kun oluet loppu, klassinen 🍔-nälkä palaa (0 → kuolema). **Törmäys vie saman ylimmän kerroksen** (−1 🍺 jos olutta, muuten −1 🍔) – `collisionCost()` keskitetty (oviukko, rosvo, auto, sähkökaappi, kukkaruukku). Olut → **humala 0–10** horjuttaa ohjausta (`drunkWobble()`, `DRUNK_WOBBLE_MAX` säädettävä; 1 ≈ pieni, 10 ≈ lähes mahdoton), haihtuu 1 / `burgerInterval` (**FULLissa kiinteä 2400 = 40 s**); olut **korvaa** FULLin satunnaisen hoipertelun; **≥7 🍺: ottaa paikallaan hallitsemattomia askeleita** (satunnainen 1–5 s välein, pehmeä liuku). **Sädease (v11.31d/f):** ≥3 🍺 tähtäys horjuu (`DRUNK_AIM_PX`-taulukko, loivennettu: 3–5 ≈ 100 %, 6=80 %, 7=42 %, 8–10 = tuurilla ~8–23 %; **F5-soft reset säilyttää humalan, hard reset nollaa**). Nukkuminen antaa yhä +1 🍔. HUD `🍔×n` + `🍺×m`. BAR-piirto `drawBarBeer()` + olut-tekstit. **MUUT MOODIT bitti-identtiset** (`chaos-normal-check` 0 eroa). Testi `%TEMP%\street-drunk-test.cjs` (50/50) |
| 🗝️ Blue Mäxin avaimen loppupalkinto | ✅ **v11.30** – Blue Mäxin loppuavaimen nappaus (`BM_KEY_COLLECTED`) antaa kadulla **+20 🪙 ja 🍔 = 10** (toistuva – jokainen nappaus palkitsee). Ei uutta dialogia (sääntö 06) – palkinto näkyy HUD:sta kadulle palatessa. Testi `%TEMP%\street-bm-key-reward-test.cjs` (16/16) |

| 🌠 Meteoriittitahti + BAD-finaali | ✅ **v11.26** – eskalaatioportti `BACKDROP_GONE_SHARE 0.25 → 0.60`, **hukkaosumat pois** (`destroyBackdropHouses` = lähin ehjä + seuraavat ehjät → aina 3 uutta rauniota; `pickBuildingTarget` ohittaa myös kesken olevan romahduksen), BADin arpa `0.25 → 0.50` ja BAD-profiilin `meteorTempoMult 0.3 → 0.15`; uusi **BAD-finaali** (`badFinalePhase()` + `nextSkyGap()`): eskalaation jälkeen BADissa ei tähtiä ja väli `BAD_FINALE_GAP_MIN/MAX` 260–420 f → talo ~11–19 s välein. FULL ennallaan (chance 1, 600 f, ammuttavissa alas). Mitattu 24 siemenellä × 4 yötä: osumia porttiin **8,4 → 4,5** · meteoriitteja **1,7 → 5,6 / yö** · 1. katuvarren talo **ka 1,2 yössä** · kaikki 9 **ka 2,5 yössä (max 3,0)** ≈ ~8 min reaaliajassa (ennen ~30–40 min). NORMAL/MILD/GOOD bitti-identtiset; ei uusia dialogeja (sääntö 06) eikä talousmuutoksia. Validoitu `%TEMP%\street-meteor-tempo-test.cjs` (42 OK / 0) + `street-building-collapse-test` 66/0 + `street-meteor-aftermath-test` 68/0 + `street-beam-daylight-test` 22/0 + `street-bad-warning-test` 57/0 + `chaos-normal-check` (78 avainta, 0 eroa) |
| 🩸 BAD CHAOS -varoitus | ✅ **v11.25** – BAD-valinnan siirtymä pitenee n. 2 s: mustan ruudun (2 s) jälkeen mustaan kirjoitetaan keltainen **"You will suffer!"** merkki merkiltä (`typeChaosWarning()`; sama klik-ääni `StreetAudio.playTypeClick` + vilkkuva `.ins-caret` kuin INSTRUCTIONS-ikkunassa) → 800 ms tauko → musta häivytetään kuten ennenkin (yht. n. 4,9 s; muut tasot 3,0 s ennallaan). Teksti luetaan `#chaos-warning`istä (mustan sisällä) ja tyhjennetään heti valinnassa (ei näy häivytyksen aikana); ulkoasu = ohjeiden keltainen `#ffe066` + hehku, `clamp()` + `nowrap`; kaaos-intro soi kuten ennenkin; **ei uusia ilmoituksia (sääntö 06)**, ei talousmuutoksia; validoitu `%TEMP%\street-bad-warning-test.cjs` (57 OK / 0) + `chaos-normal-check` (0 eroa) + `street-chaos-fade-test` (24/0) · julkaistu 29.9.2026 (`e1c26b9`, pushattu) |
| 🖱️ Automaattinen hover-kierros + FULL CHAOS -tärinä | ✅ **v11.03 + v11.04 + v11.05/v11.05b + v11.17** – kaaosvalikon auettua hover liukuu kerran 5 napin yli (1 s avautumisesta, sitten 10 s välein kierroksen alusta: ketjutettu `setTimeout`, **173 ms/nappi** – v11.17: 450 → 346 → 173). **FULL CHAOS jää päälle 2 s** ja koko näyttö tärisee (`#chaos-menu.shaking` + `@keyframes chaos-shake`, 2 s `linear`; v11.05b: 2,5 % askel = 50 ms ≈ 20 värähdystä/s, 2–4 px). Luokka `.auto-hover` = sama ulkoasu kuin `:hover`; oikea hiiri/täppäys keskeyttävät heti (`mouseenter` → `clearAutoHover`, valinta → `stopAutoHover`; v11.17: `mouseenter` vain `(hover: hover)` -laitteille ja kosketuksen vastine `touchstart`). Nupit `AUTO_HOVER_*` (`START_MS 1000`, `REPEAT_MS 10000`, `STEP_MS 173`, `HOLD_MS 2000`); testikytkin `?autohover=0`; **v11.17: toimii myös puhelimilla** – reduce-motion pudottaa vain näytön tärinän, välähdys jää (`style.css` 504: `#chaos-menu.shaking { animation: none }`; sama linjaus kuin INSTRUCTIONS-vilkku v10.31); ei uutta tekstiä (sääntö 06); NORMAL bitti-identtinen (vain UI-ajoitus); harness `%TEMP%\street-autohover-test.cjs` 71/71, 0 löydöstä |
| 🎵 Jukebox pysäyttää intron | ✅ **v11.08** – `audio.js` `playJukeboxQueue()` + `appendJukeboxQueue()` kutsuvat nyt `stopIntro()` → kaaos-intro ei soi päällekkäin jukebox-biisin kanssa, kun pelaaja valitsee kappaleen intron aikana. Ei UI-/dialogimuutoksia (sääntö 06) |
| 🚗 Liikenne ei pysähdy sisätiloissa | ✅ **v11.09** – `update()`in varhaiset `return`it ohittivat `updateTraffic`in BARissa, makuuhuoneessa (myös `sleepPhase`-pimennys) ja kaivosekvenssissä (`mhAction`) → `v.x` seisoi ja moottorin panorointi jämähti. Korjaus: `updateTraffic(dt, true)` haaran alkuun (sama periaate kuin jukebox v4.61); huoneissa `playerSafe = true` (ei törmäystä/tainnutusta), kadulla ja sanomalehdessä törmäys ennallaan. Ei uusia dialogeja eikä talousmuutoksia; validoitu `%TEMP%\street-traffic-rooms-test.cjs` (17 OK / 0 löydöstä; esikorjausversiolla 8 löydöstä) |
| 🚗 Liikenne ei pysähdy tainnutuksessa (paitsi kolari) | ✅ **v11.10** – sama juurisyy kuin v11.09: `update()`in tainnutushaara (`if (player.knockedDown)`) palasi ennen `updateTraffic`ia → jokainen tainnutus (oviukko, rosvo, kukkaruukku, sähkökaappi, lamppu) jäädytti liikenteen ja moottorin panoroinnin 10–15 s ajaksi. Korjaus: haaran ensimmäinen lause `if (player.knockFallY === undefined) updateTraffic(dt, true);` – `knockFallY` asetetaan **vain** auton osumassa (`updateTraffic`, v4.78), joten se toimii merkkinä kolarista: **auton osuma jäädyttää liikenteen kuten ennenkin**, muut kaatajat eivät. `playerSafe = true` = makaavaan pelaajaan ei tule uutta osumaa (ei toistuvaa 🍔-menetystä). Oviukon 3 s hit-stop (`AVENGER_FREEZE 180`, ennen tainnutushaaraa) ja kuolinsekvenssi ennallaan; ei uusia dialogeja (sääntö 06) eikä talousmuutoksia; validoitu `%TEMP%\street-knockdown-traffic-test.cjs` (38 OK / 0 löydöstä; esikorjauskontrolli: kaappi ja rosvo jäätyivät 29/29 framea ilman korjausta) |
| 🚗 Auton osuma kaataa 25 px ylös osumakohdasta | ✅ **v11.12** – kolarin putoamistaso 10 → 25 px (`player.knockFallY = player.y + player.h - 25`, `street.js`): tainnutuksen aikana paikalleen jäänyt auto ei enää osu pelaajaan uudelleen, kun pelaaja nousee ylös. Mittaus (skenaario 10, 13 kolarisyvyyttä kaistoilla 0 ja 1): **0 uudelleenosumaa** · v4.78 10 px: 5 kpl · v11.11 15 px: 1 kpl · v11.12 välivaihe 20 px: 1 kpl · **25 px: 0 kpl**. Tainnutus (600 f), oviukon hit-stop, talous ja liikennesäännöt (v11.09/v11.10) ennallaan; ei uusia dialogeja (sääntö 06) |
| 🔫 Sädeaseen vaikeustaso + osumapalaute | ✅ **v11.13 + v11.14** – v11.13: piipun yllä vilkkuva keltainen piste (ulkoasu). **v11.14:** laukaisuväli **1,0 s** (`BEAM_COOLDOWN_FRAMES 60`; `beamCooldownTimer` asetetaan ennen osumatarkistusta → **huti maksaa saman kuin osuma**, lukon aikana ristikko pois ja `playBeamEmpty()`-klikki) ja meteoriitti kestää **2 osumaa** (`METEOR_HITS_TO_KILL 2`; 1. osuma = **tasainen sävymuutos oranssiin** (ydin `#ffcf95` + vana + hehku, muoto/syke ennallaan) + `playMeteorHit()` + 10 f lämmin välähdys, **+1 🪙 vasta tappavasta osumasta**). Ei uutta tekstiä (sääntö 06), ei talousmuutoksia; validoitu `%TEMP%\street-beam-cd-hp-test.cjs` (30 OK / 0 löydöstä) |
| 🔫 Sädease aina samalla viivalla (teräsaidan vieressä) | ✅ **v11.15** (bugikorjaus) – `BEAM_PICKUP_Y = COIN_Y_MAX` (380): esine ilmestyy aina pelaajan alimmalle jalkapisteelle aidan viereen, vain x arvotaan (`BEAM_PICKUP_X_MIN/MAX` = keskiöalue 10…790). Syy: satunnainen `randomCoinY` vei aseen toisinaan lampputolpan kohdalle, josta sitä ei saanut poimittua (pylväs peitti esineen alle 325, tolpan estoblokki hylki ±15 px, syvemmät y:t ajoradalla). Poimintaehto (jalkapiste < 10 px), ehdot (FULL + keräämätön) ja talous ennallaan; validoitu `%TEMP%\street-beam-pickup-spawn-test.cjs` (27 OK / 0 löydöstä) |
| 🔫 Sädease pois hard-resetissä | ✅ **v11.20** (bugikorjaus) – uusi `Street.clearBeamWeapon()` nollaa `state.beamWeaponCollected`in localStoragesta ja kutsutaan `DOMContentLoaded`issa ennen `gate.classList.remove('hidden')` → sädease ei jää käteen uudella kierroksella (uusi välilehti / kuolema / ✕-resetti). F5-soft reset ei näytä näyttöä → sädease säilyy samassa runissa. Validoitu `%TEMP%\beam-clear-test.cjs` (6 OK) |
| 🔫 Sädease ei näy pelaajalla päivällä | ✅ **v11.21** – `drawPlayer()`in ase-ehto `if (beamWeaponCollected)` → `if (beamWeaponCollected && dayT <= 0)`: ase katoaa päivällä ja **ilmestyy itsestään takaisin yöllä**, kun meteoriitit palaavat – tallennettu `beamWeaponCollected` ei muutu, joten asetta ei tarvitse napata uudelleen. Kadun pickup-esine ja HUD-🔫 jäivät ennalleen (käyttäjän valinta); `spawnBeamPickup()` (FULL-only) ja `beamCanFire()` (`dayT > 0` → ei laukausta) ennallaan; ei uusia dialogeja (sääntö 06). Validoitu `%TEMP%\street-beam-daylight-test.cjs` (22 OK / 0 löydöstä; kontrolliajo vanhalla koodilla 4 löydöstä) |
| 🌠 Meteoriitti tuhoaa katuvarren talon (eskalaatio) | ✅ **v11.22** – kun taustarivistä on jäljellä ≤ 25 % (`BACKDROP_GONE_SHARE`, `backdrop.total`), meteoriitti **tähdätään katuvarren taloon** (`pickBuildingTarget` + `makeAimedMeteor`): lähtö lähimmältä laidalta ruudun ulkopuolelta, kulma ratkaistaan `atan2(pudotus, vaakamatka)` → osuma osuu talon kohdalle (kulma ~35–82°, lento sama fysiikka kuin ennen). Kohde on satunnainen **ehjä** talo, **BAR (idx 8) vasta kun muut 8 on tuhottu** – kaikki 9 taloa + makuuhuone voivat tuhoutua. Animaatio 360 f (~6 s): `flash` (ikkunat keltaisiksi) → `shake` → `black` (seinät/ikkunat mustiksi) → `burn` (musta → keltainen hehku) → `outline` (vain mustat ääriviivat) → `fade` → `'gone'`. Jälkitila: talo pois, **ovi mustana ja inaktiivina**, kynnysvalo pois, sähkökaappi pois, ei kuunvarjoa/K1-ikkunavaloja, **säde läpäisee**, oviukko katoaa talon mukana. **FULL = puolustettavissa sädeaseella** (tähdätty meteoriitti talojen EDELLÄ ja aina ammuttavissa), **BAD = vääjämätön** (ei asetta – moodin ironia). Tila vain muistissa → `init()` palauttaa; ei talousmuutoksia eikä uusia dialogeja (sääntö 06); testikytkimet `?bldg=1` / `?bldgtarget=N`. Validoitu `%TEMP%\street-building-collapse-test.cjs` (66 OK / 0 löydöstä) + `chaos-normal-check` (78 avainta, 0 eroa) + regressiot (`street-beam-cd-hp-test` 41 OK, `street-traffic-rooms-test` 16 OK, `street-knockdown-traffic-test` 42 OK – näiden ainoat löydökset ovat vanhentuneita versio-odotuksia) |
| 💥 Meteoriittituhon jälkitila + BAD-avaus | ✅ **v11.24** – **Ovet:** musta ovi pois tuhoutuneilta taloilta (9 mustaa ovea näytti epäloogiselta), vain **yksi randomi** talo pitää ovensa pystyssä pelkkinä **ulkokarmina** (`standingDoorIdx`, arpa kerran tuhoutumishetkellä). **Romukasa:** tilalle randomi musta kasa (`buildingRubble` + `makeBuildingRubble`/`drawRubble`), korkeus **6–16 px** (`RUBBLE_H_MAX = DOOR_H/2`), 2–4 möykkyä. **Meteoriitit talojen taakse:** tähdätty meteoriitti piirretään nyt taivas-/siluettikerroksessa (v11.22:n talojen EDELLÄ -piirto + `meteoriteBehindBuilding`in tähdätty-poikkeus poistettu) → pelaaja näkee vasta välkkeen ja tuhon alun; FULLissa ammuttavissa katon yläpuolella. **Alakaupungin rauniot:** `destroyBackdropHouses` ei poista lohkoja vaan `ruinBackdropBlock` merkitsee ne – horisonttiin jää **runko 55–80 %** (2–4 pystypalkkia + 2–4 laattaviivaa, seinät puuttuvat) + **1–3 seinäpalaa** (`drawBackdropRuin`); toinen osuma murentaa yhden seinäpalan, runko ei laske; eskalaatio laskee **ehjistä** lohkoista. **Ääni:** `playBuildingCollapse`in soiva jyrinä (triangle 90 → 34 Hz) pois – kuulosti kongin/patarummun kumahdukselta osumahetkellä; kohina jäi (1,5 s, lowpass 620 → 110). **BAD-avaus:** `updateBadDemo` (vain BAD, kerran/kierros, yön haarassa ennen `updateShootingStar`ia) tuhoaa ~2 s kadulle tulosta satunnaisen talon 0–8 – **BAR mukaan lukien** (`makeBadDemoMeteor`, lento 2,1–4,1 s); `?baddemo=0/N`. Ei talousmuutoksia eikä uusia dialogeja (sääntö 06). Validoitu `%TEMP%\street-meteor-aftermath-test.cjs` (68 OK / 0 löydöstä) + päivitetty `street-building-collapse-test.cjs` (66 OK / 0) + regressiot (`street-meteor-coin-test` 23/23, `street-beam-daylight-test` 22/0, `street-beam-cd-hp-test` 41/0, `street-beam-pickup-spawn-test` 27/0, `street-chaos-fade-test` 24/0, `backdrop-destroy-test` 0 löydöstä, `chaos-normal-check` 78 avainta 0 eroa) |




| Katunäkymä, hahmo, 9 lamppua, 9 ovea, ajoneuvot, eläimet, sää | ✅ |
| *Esiforkin ajan rivit (v3.8x–v5.02)* | ks. `docs/pimea-katu-historia.md` |

## 🍒 Hedelmäpeli (fruitgame/) – talo 7, auki vain öisin (v4.34)

| Ominaisuus | Tila |
|-----------|------|
| 3 rullaa / 1 voittolinja, 5 käsipiirrettyä symbolia (canvas 640×400) | ✅ Vaihe 1 |
| Painot 🍒7 🍋5 🔔4 🍔2 💎2, maksut 💎35 🍔20 🔔12 🍋7 🍒4 + pari = panos takaisin, panos 1 → RTP 78,49 % | ✅ 125/125 yhdistelmää + 1 M simulaatio (🔒 sääntö 04) |
| Debug-korjaukset 19.9.2026: `new FruitGame()` käynnistys + `box-sizing: content-box` | ✅ |
| Dokumentaatio | ✅ `docs/fruit-game-memo.md` |
| *Esiforkin ajan rivit (v3.8x–v5.02)* | ks. `docs/pimea-katu-historia.md` |

## ⛏️ Dig Game · 💎 Dig Däsh · ✈️ Blue Mäx

| Peli | Tila |
|------|------|
| ⛏️ Dig Game (`digGame1/`) | ✅ valmis – yksi yhtenäinen kenttä (~77 ruutua), kolikot 1 kpl, avain → Dig Däsh |
| 💎 Dig Däsh (`digGame2/`) | ✅ valmis – 4 tasoa, kolikot 1/taso (4 kpl), avain → Blue Mäx; näkyvä nimi "Dig Däsh" (tunnisteet `boulder*` ennallaan) |
| ✈️ Blue Mäx (`bm/`) | ✅ pelattava – lento, taistelu, mittari-HUD, wrap-around, mobiili-HUD; **TESTIMODE päällä** (viholliset minimissä) → palautettava 60 % aggressiolle |
| 📱 Kosketusohjaimet tableteilla (DG1 + DG2) | ✅ **v11.18** – pelkkä leveysmedia (`@media (min-width: 769px)`) piilotti `#touch-controls`:in, joten 10" tabletti (viewport ≥ 769 px, esim. 800×1280) näytti työpöytä-UI:n **ilman navigointia**. Korjaus: `input.js` `setupTouchVisibility()` → `pointer: coarse` (fallback `ontouchstart` / `maxTouchPoints`) lisää `#touch-controls.force-show`-luokan ja CSS `#touch-controls.force-show { display: flex !important }` voittaa piilotuksen; **työpöytä (`pointer: fine`) ja kosketusnäyttöläppärit bitti-identtiset**, pelilogiikkaan/talouteen ei koskettu. Validoitu `%TEMP%\dg-touch-test.cjs` (22 tarkistusta, 0 virhettä) |
| 📱 Tabletin kosketusohjaimet 2× (DG1, DG2, katu, bm, sinkship) | ✅ **v11.19** – 10" tabletti (kosketus + pysty + ≥769 px) saa nyt 2× napit uudella haaralla `@media (pointer: coarse) and (min-width: 769px) and (orientation: portrait)`: DG1/DG2 `.touch-btn` 60 → 120 px (fontti 1,7 → 3,2 rem), katu `.touch-btn` 55 → 110 px + `#action-btn` 52 → 104 px (hehku 14 → 28 px), bm `.touch-btn` 48 → 96 px (pommi 52 → 104 px, gun/land 96 px), sinkship `.touch-btn` + D-pad-grid 52 → 104 px. **PC (`pointer: fine`), puhelin (<769 px) ja vaakamoodi bitti-identtiset** – vanhat näkyvyyssäännöt (`force-show`, `min-width: 769px` -piilotus, mobiili-overlay) koskemattomina. Kadulla `street.js`:n `resize()` mittaa nyt ohjainrivin korkeuden kovakoodatun 185 px:n sijaan (`CONTROL_RESERVE = isLandscape ? 0 : Math.max(185, rowH + 12)`) → puhelimella 3 × 55 + 2 × 4 + 12 = **tasan entinen 185**, tabletilla **358**; canvas väistyy itsestään. Varasuoja `canvas { max-height: calc(100dvh − 380px) }` (DG) / `− 420px` (bm) ei kutista canvasia 1280 px näytöllä (DG1 sisältö ~1022 px / 1280). Validoitu `%TEMP%\tablet-controls-test.cjs` (97 tarkistusta, 0 löydöstä); sääntö 06: ei uusia dialogeja (näppäinvihjeet vain piilotetaan) |

## 🛠️ Infrastruktuuri

| Ominaisuus | Tila |
|-----------|------|
| `.clinerules/` (01–06) + `memory-bank/` + Git | ✅ |
| Muistipankin kompaktio | ✅ 20.9.2026 (activeContext 83 → ~16 kt) · ✅ 23.9.2026 (v4.71: ac 53,7 → 15,8 kt / 631 → 199 rv, progress 18,5 → 10,3 kt, sys 11,8 → 10,5 kt) · ✅ **28.9.2026 (v11.00: ac 42,0 → 27,2 / 444 → 249 rv, progress 29,5 → 20,7 / 127 → 110 rv, sys 13,4 → 12,1 kt; pankki 84,9 → 60,0 kt)** – tiivistettiin vain v10.x/uusi aines, esiforkin v4.x-historia säilyy; täysi historia git-historiassa · **28.9.2026 (v11.06/v11.07): v11.03–v11.05 kirjattu pankkiin (auto-hover + FULL CHAOS -tärinä) ja kokorajat mitoitettu pelikoon mukaan** – activeContext ≤ 45 · progress ≤ 35 · systemPatterns ≤ 20 · pankki ≤ 100 kt; **kompaktointia ei tehdä eikä kokoa raportoida joka istunnossa** |
| Tekijänoikeudet | ✅ 20.9.2026 – juuren `LICENSE` (Copyright (c) 2024–2026 Teppo Ålander, All rights reserved) + README-osio; 22.9.2026 LICENSE/README mainitsevat myös jukeboxin kolmannen osapuolen raidat (raidat 4–6) |
| Pelinimien yhdenmukaistus | ✅ 20.9.2026 – näkyvät nimet "Dig Däsh" ja "Blue Mäx" kaikkialla; sisäiset tunnisteet ennallaan |
| 📄 Kaaosparametrien suunnitelma | ✅ 27.9.2026 – `docs/chaos.md`: kategoriat K0–K7, tasomanifesti, C-indeksi (+ 🍔-lattia 1200 f), kielletyt yhdistelmät, uhkabudjetti, MUST-kohteet, toteutusresepti portteineen, testaus/DoD; toteutus v10.02–v10.05 |
| 🌐 Lokalisaatio toteutettu (v11.00) | ✅ **28.9.2026** – koko pelaajalle näkyvä UI englanniksi kaikissa peleissä; ks. pääportaalin rivi "🌐 Koko UI englanniksi". Versioleima + `?v=` = **v11.00** (vain pääpeli) |
| *Esiforkin ajan rivit (v3.8x–v5.02)* | ks. `docs/pimea-katu-historia.md` |

| Julkaisu | ✅ **ONLINE** – GitHub Pages `https://teppoaland.github.io/aistreet/` (27.9.2026) |

## 🧪 Testipenkit

**Penkit ovat nykyään repossa** `tools/tests/` (25 kpl + ajaja `run-all.cjs`, lähdeloader
`street-src.cjs`, versiotarkistus `ver.cjs`); tila ja tunnetut löydökset: `BASELINE.md`.
Vanha kirjaus (penkit `%TEMP%`:issa) ja v11.24–v11.27 muistiinpanot: `docs/pimea-katu-historia.md`.

**v11.36 – BAD/FULL rauniot – liikenne ja eläimet pysähtyvät:** `buildingsAllGone()`/`chaosAllGone()`-apufunktiot lisätty. Kun kaikki 9 taloa tuhoutuneet BAD/FULLissa, katueläinten spawnaus ohitetaan ja liikenteen spawnauksessa vain ambulansseja sallitaan (`vehRnd = 0.74` pakottaa ambulance-haaran). Olemassa olevat autot/eläimet ajavat/juoksevat loppuun normaalisti. Ei uusia dialogeja (sääntö 06), ei talousmuutoksia. `index.html` v11.36.

**v11.37 – BAD/FULL savukoodin korjaus (bugikorjaus):** v11.33 savukoodi (savukiekurat tuhoutuneista taloista BAD/FULL) oli vahingossa `updateBuildingDamage`-funktion ulkopuolella IIFE:n top levelillä → suoritettiin vain moduulin latautuessa (`chaosLevel === 'normal'` → skip, `dt` undefined) → ei koskaan ajon aikana. Siirretty `update(dt)`:n sisään `updateBuildingDamage(dt)`-kutsun jälkeen. Nyt vaaleat savupallot nousevat tuhoutuneista taloista BAD/FULLissa (spawn 1–3/3–7 s, nousevat max 1/3 talon korkeudesta, hiipuvat pehmeästi). `index.html` v11.37.

**v11.38 – koodirakenne / Vaihe 1 osa 1 (ei toimintamuutoksia):** `street.js` pilkottiin
tiedoston SISÄLLÄ mekaanisella työkalulla `tools/refactor/extract.cjs` (pelkkä siirto,
`expectFirst`-varmistukset; kaikki `return;`-portit muunnettiin `return true`-porteiksi
kutsujan `if (fn(dt)) return;`):
- `render()` **428 → 143 rv**: `drawRoomView`, `pushWorldTransform`, `drawSkyGradient`,
  `drawSun`, `drawStars`, `drawMoon`, `drawShootingStars`, `drawSatellite`,
  `drawMeteorFlash`, `drawScreenEffects` (syvyysjärjestysosuus jäi ennalleen).
- `handleAction()` **226 → 14 rv**: `tryNewspaper`, `tryFruitDoor(px,py)`,
  `tryJukeboxDoor(px,py)`, `trySinkshipDoor(px,py)`, `tryDoorsAndKicks(px,py)`.
- `update()` **1119 → 861 rv** (huoneosuus): `updateSleepRoom`, `updateBarRoom`,
  `updateJukeboxRoom`, `updateNewsRoom`, `updateKnockedDown` – kutsutaan porteilla
  `if (updateX(dt)) return;` (alkuperäinen varhaisten `return`ien järjestys säilyi).
- `update()` **861 → 85 rv** (katuosuus, 23 funktiota): `updateBuildingSmoke`, `updateDayNight`,
  `updateSpawnLampShow`, `updateJukeboxPersistence`, `updateDayCycle`, `updateDeathSequence`,
  `updateHunger`, `updateHiddenTracking`, `updateManholeSequence`, `updateMovement`,
  `updateCoinPickup`, `updateBeamPickup`, `updateCoinTimers`, `updateManholeStep`,
  `updateElectricCabinets`, `updateParticles`, `updateStreetTimers`, `updatePot`,
  `updateKickCoin`, `updateEnemies`, `updateAnimal`, `updateSky`, `updateBirds` – loput
  `return`-portit (kuolema/nälkä/kaivo) samalla `if (fn(dt)) return;` -periaatteella.
  Yhteensä **1 576 riviä / 38 funktiota**; mikään funktio ei ole enää >150 rv.
**Testipenkit versioitiin repoon** (`tools/tests/`, 21 penkkiä): lähdeloader `street-src.cjs`,
dynaaminen versiotarkistus `ver.cjs` (versio ei enää riko penkkejä), ajaja `run-all.cjs`,
tila ja tunnetut vanhentuneet odotukset `BASELINE.md`. Mekaaniset korjaukset: export-rivi
(k2k6k7/avenger), `StreetAudio`-stubit (fruit/jukebox/avenger), `showNotification`-laskurit
(16→15, 15→14; bf54693 poisti yhden popupin), puuttuvat preludi-tunnisteet
(`lamps`, `drunkAimShift`), vanhentuneet odotukset (mm. `AVENGER_SPEED`, BAD startCoins 100,
meteoriitin osumäväri, `HUNGER_WAKE_GRACE` `let`, backdrop-rapistuminen v11.26-logiikalla),
`headchk-normal-check` poistettu (vanhentunut kopio). Kolme rakennevahtia päivitettiin
siirtoa vastaaviksi (building-collapse, hunger-scope T7, knockdown-traffic).
**Tulos:** `chaos-normal-check` 78 avainta / 0 eroa; 21 penkkiä **15 puhdasta / 6 löydöstä
= sama kuin baseline** (per-penkki-löydösmäärät identtiset). `index.html` v11.38.

**v11.38 – Vaihe 2: kaaosliput + `sfxTone` (ei toimintamuutoksia):** 27 hajallaan ollutta
`chaosLevel === '…'` -tarkistusta korvattiin `chaosFlags`-objektilla (11 lippua: `beer`, `drunk`,
`beamWeapon`, `meteorAlways`, `meteorKill`, `meteorHalf`, `badDemo`, `badFinale`, `ruin`,
`mosquitoes`, `anyChaos`); liput johdetaan `chaosLevel`istä yhdessä paikassa `applyChaosFlags()`
(`applyChaosProfile`in alussa → F5-palautus ja `?chaos=` pysyvät synkassa). Uusi `sfxTone({freq,
freqTo?, dur, type?, vol?, delay?})`-apuri (yksi oskillaattori + gain-envelope + yhteinen
`initAudio`-vahti) lyhensi äänikoodia: `createOscillator`-kohtia 11 → 4 (muunnetut: `playCoin`,
`playBeamEmpty`, `playLaser`, `playKnock`/`playZap`/`playMeteorHit` oskillaattoriosat, `playLampOn`
humahdus; kohina- ja moottoriäänet ennallaan). Penkit: 5 preludiin `chaosFlags`-Proxy,
`street-meteor-aftermath`:n `playMeteorHit`-tarkistus uuteen muotoon. **Tulos:** 22 penkkiä
**16 puhdasta / 6 = sama kuin baseline**; NORMAL 78 avainta / 0 eroa; render-smoke 25/25.

**v11.38 – Vaihe 3: huonerekisteri (ei toimintamuutoksia):** neljä canvas-huonetta (makuuhuone,
BAR, jukebox, sanomalehti) koottiin **`rooms[]`**-rekisteriin rajapinnalla
`{ name, isOpen(), update(dt), draw(), close() }`. Kutsu­paikat ovat nyt silmukoita:
`update()` (`for (const room of rooms) if (room.update(dt)) return;`), `drawRoomView()`
(`isOpen()` + kamera + `room.draw()`) ja `closeRoom()` (`if (room.isOpen() && room.close())`).
`closeRoom()`:n neljä haaraa siirrettiin omiksi `closeSleepRoom/closeBarRoom/closeJukeboxRoom/
closeNewsRoom()`-funktioiksi (24 rv). Uuden huoneen lisäys ei enää koske `update()`ia, `render()`iä
eikä `handleAction()`ia; oven avaaminen pysyy ovikohtaisissa `tryXxxDoor()`-funktioissa.
Penkit: `street-hunger-scope` T7 → rekisterisilmukka; `street-render-smoke-test` sai osion 4b
(`closeRoom()` kaikille huoneille + false kun mikään ei auki) → **30/30**. **Tulos:** 22 penkkiä
**16 puhdasta / 6 = sama kuin baseline**; NORMAL 78 avainta / 0 eroa.

**v11.38 – Vaihe 4: tilan ryhmittely olioiksi (osittain, ei toimintamuutoksia):** kaksi domainia
ryhmiteltiin: **kaivo** (`manholeOpen`/`mhInside`/`mhAction` → `manhole = { open, inside, action,
reset() }`, 22 viittausta; `rollManholeState()` käyttää `manhole.reset()`) ja **kolikko**
(`coinRespawnTimer` → `coin.respawnTimer`; `coinCheatStreak/GapTimer/Cooldown` →
`coinCheat = { streak, gapTimer, cooldown, reset() }`). Penkkien hookit päivitettiin kolmeen
penkkiin (kaivo), kolikkodomainissa ei ollut yhtään kytkentää. **Loput domainit mitattiin ja
perusteltiin jätettäväksi:** päivä/yö 141 viittausta + 6 deklaraatiokohtaa (lomittuu
`state.isDay`:hin; 4 penkkiä injektoi `dayT`-hookit), huoneet 469 viittausta (kannattaa tehdä
samassa yhteydessä kuin Vaihe 5 siirtää huoneet omiin tiedostoihin), talous 149 (eniten
penkkikytkentöjä, ei toiminnallista hyötyä, osuu sääntö 04:n ytimeen), rosvo (jo olio –
jäljellä `robberCooldown`, ei voi asua samassa oliossa koska `robber` on `null` cooldownin
aikana). **Tulos:** 22 penkkiä **16 puhdasta / 6 = sama kuin baseline**; NORMAL 78 avainta /
0 eroa; render-smoke 30/30.

**v11.38 – Vaihe 5 osa 1: tiedostojako (street/, ei toimintamuutoksia):** kaaoskonfiguraatio ja
-matematiikka (399 rv) siirrettiin **`street/chaos-config.js`**-tiedostoon
(`var StreetChaos = (function () { … })();`): `CHAOS_DEFAULTS`/`CHAOS_DEFAULTS2`, `makeRng` +
`?seed=`-arvonta, `rnd`/`rndInt`, K1-paletit ja -arvonnat (`randomHuePalette`/`randomDarkSky`/
`randomAnimalTypes`/`randomSunColor`), `generateFullChaosSeed`, `chaosProfile`, kaavat
(`clamp`/`chaosAbilityFor`/`stunMaxOf`/`burgerIntervalMin`/`threatSpeedMax`/
`threatTelegraphMin`/`threatBudget`) sekä portti (`clampChaosCfg`/`validateChaosCfg`) ja
`drawChaosCfg`. `street.js` ottaa nimet `const { … } = StreetChaos;`-destrukturoinnilla ja sitoo
kaksi street.js:ssä asuvaa asiaa (`WORLD_W`, `hungerMultFor`) `StreetChaos.bind()`illa → **muu
koodi ei muuttunut**. `index.html` lataa osan omalla
`<script src="street/chaos-config.js?v=11.38">`-rivillä ja `tools/tests/street-src.cjs`:n
`PARTS`-lista liittää penkeille saman kokonaisuuden.

**v11.38 – Vaihe 5 osa 2: äänet omaan tiedostoon (street/sfx.js):** kadun kaikki SFX-äänet
(`initAudio`, `sfxTone`, potku, askel, kolikko, tömähdys, sähköisku, laser, meteoriitti,
rakennuksen romahdus, tyhjä laukaus, katuvalo) ja ajoneuvon moottoriääni (start/update/stop)
siirrettiin **`street/sfx.js`**-tiedostoon (344 rv, `var StreetSfx = …`). Moduuli omistaa
`audioCtx`:n ja **SFX-tason (K6)**; street.js sitoo `WORLD_W`:n (`StreetSfx.bind`) ja asettaa tason
kaaosprofiilin sovelluksessa (`StreetSfx.setVolume(chaosCfg.sfxVolumeMult)` entisen
`sfxVolumeMult = …` -sijoituksen tilalla). `PARTS`-lista ja `index.html` päivitettiin; **penkkejä
ei tarvinnut muuttaa**. **Tulos:** `street.js` 10 786 → **10 453 rv**; NORMAL 78 avainta / 0 eroa;
render-smoke 30/30; 22 penkkiä 16 puhdasta / 6 = sama kuin baseline.
Penkit: 4 `?v=`-laskuria löysennettiin (`=== 4` → `>= 4`), koska uusi skriptitagi tuo viidennen
leiman. **Tulos:** `street.js` 11 169 → 10 786 rv; NORMAL 78 avainta / 0 eroa; render-smoke
30/30; 22 penkkiä 16 puhdasta / 6 = sama kuin baseline.

**v11.38 – Vaihe 5 osa 3: sanomalehti omaan tiedostoon (street/news.js):** lehden
**asettelu + piirto** (438 rv) siirrettiin **`street/news.js`**-tiedostoon
(`var StreetNews = …`): sisältödata (`NEWSPAPER_PAGES`, `NEWS_MANUAL_WIDE/-NARROW`),
`wrapNewsText`, `fitNewsFont`, `newsLayout` (+ välimuisti), kadun lehti (`drawNewspaper`),
poimintavihje (`drawNewspaperHint`) ja koko ruudun näkymä (`drawNewspaperView`).
Moduulin oma tila = `screen` (entinen `newsScreen`) + `cache` (entinen `newsCache`);
julkinen API `layout/index/next/prev/reset/near/drawOnStreet/drawHint/drawView`.
**Uusi mekanismi:** host sidotaan **live-gettereillä** (`StreetNews.bind({ get ctx() { return ctx; } … })`)
→ canvas-arvo (`ctx`, `canvas`, `viewW`, `foreground`, `player`, `vehicles`, `newsRoom`,
`iframeOpen`) pysyy ajan tasalla ilman synkronointia. Syöttölogiikka (`updateNewsRoom`,
`openNewspaper`, `closeNewspaper`) ja `newsRoom`/`newsHeld*` jäivät street.js:ään kuten
huoneiden ovilogiikka. `PARTS`-lista ja `index.html` (uusi `<script>` ennen street.js:iä)
päivitettiin; **penkkejä ei tarvinnut muuttaa**. **Tulos:** `street.js` 10 453 → **10 030 rv**
(11 169 → 10 030 osissa 1–3); NORMAL 78 avainta / 0 eroa; render-smoke 30/30; 22 penkkiä
**16 puhdasta / 6 = sama kuin baseline** (penkkikohtaiset löydökset identtiset).
Siirtotyökalu **`tools/refactor/split-news.cjs`** (repoon, `expectFirst`-varmistukset).

**v11.38 – Vaihe 5 osa 4: ajoneuvon piirto omaan tiedostoon (street/traffic.js):** `drawVehicle(v)`
(248 rv: auto, mopo+kuski, ambulanssi, panssarivaunu telaketjuineen + ajovalokiila) siirrettiin
**`street/traffic.js`**-tiedostoon (`var StreetTraffic = …`). **Valintaperuste:** tunnistinhaulla
todennettiin, että koko funktio käyttää vain kolmea ulkoista nimeä (`ctx`, `dayT`,
`VEHICLE_HEADLIGHT_DIM`) → **liikenne-domainia ei tarvinnut ryhmitellä** (Vaihe 4) ensin.
Sidonta live-gettereillä (`get ctx`, `get dayT`); liikennologiikka (spawn, liike, törmäys,
`vehicles`-tila) jäi street.js:ään. 4 kutsukohtaa `render()`issa → `StreetTraffic.drawVehicle(...)`.
`PARTS`-lista ja `index.html` (uusi `<script>` ennen street.js:iä) päivitettiin; **penkkejä ei
tarvinnut muuttaa**. **Tulos:** `street.js` 10 030 → **9 792 rv** (11 169 → 9 792 osissa 1–4);
NORMAL 78 avainta / 0 eroa; render-smoke 30/30; 22 penkkiä 16 puhdasta / 6 = sama kuin baseline.
Siirtotyökalu **`tools/refactor/split-vehicle.cjs`**.

**v11.38 – Vaihe 5 osa 5: K7-kaaoskortit omaan tiedostoon (street/chaos-cards.js):** koko
K7-korttipakka (134 rv) siirrettiin **`street/chaos-cards.js`**-tiedostoon (`var StreetChaosCards = …`):
`cardState` + `CARD_FIRST_DELAY`/`CARD_GAP_MIN/MAX`, `chaosCardsReset`, `chaosCardDefs` (10 korttia),
`cardFlashWindows` ja `updateCards`. **Korttidefien `save/apply/restore` MUTATOI 12 street.js:n
tilamuuttujaa** (`sunColor`, `sunGlow`, `DAY_SKY_TOP/MID/HORIZON`, `fogAlpha`, `windSpeed`, `stars`, `litWindows`, `starCount`,
`starSizeMult`, `buildingPalette`, `animalSpawnTimer`) → sidonta tehtiin **get+set -hostilla** (`get sunColor() { return sunColor; },
set sunColor(v) { sunColor = v; }` …), joten muutokset näkyvät samoihin olioihin kuin ennen
(`applyChaosProfile`, `render`, `updateAnimal`). Moduulin API: `reset/update/meteorBurst/lightsOut/
animalParade/consumeAnimalParade/defs`. `street.js`: 7 kohtaa päivitetty (`StreetChaosCards.reset()`,
`.update(dt)`, `.meteorBurst`, `.lightsOut` ×3, `.animalParade` + `.consumeAnimalParade()`).
**Uusi penkki** `tools/tests/street-chaos-cards-test.cjs` (katso `BASELINE.md`).
**Uusi testikytkin `?card=<id>`** (ei tallenna, kuten `?day`/`?hole`/`?cabs`): pitää yhden
K7-kortin päällä loputtomiin → jokaisen kortin voi katsoa yksi kerrallaan ilman 60 s odotusta
(id:t `green · meteor · fog · gust · blackout · windows · parade · palette · sky · stars`).
**Tulos:** `street.js` 9 792 → **9 689 rv** (11 169 → 9 689 osissa 1–5); NORMAL 78 avainta /
0 eroa; render-smoke 30/30; **23 penkkiä 17 puhdasta / 6 = sama baseline**. Työkalu
**`tools/refactor/split-cards.cjs`**.

**v11.39 – K7 "Valot sammuvat" -kortin bugikorjaus (bugikorjaus, sääntö 03):** uuden
`?card=blackout`-testikytkimen avulla käyttäjä havaitsi (3.10.2026): *"Yksikään valo taloissa EI
pala. Katulamput kyllä."* Vika oli **ennestään ollut** (todennettu `git show HEAD:street.js`:stä –
`lightsOut`-tarkistus oli tasan samoissa kolmessa paikassa ennen ja jälkeen refaktoroinnin), ei
refaktoroinnin aiheuttama. Blackout pimensi vain **hehkun** (`drawLampGlow`) + **ikkunat**
(`houseLit`/`litWin`), mutta **lampun kupu** (`drawLampPost`: `cupFill = '#ffffaa'`), kuvun
**valopilkku + hyttyset**, **ovivalo** (`drawDoor`: `ownerLamp.lit ? '#ffd700'`) ja pelaajan
**reunavalo** lähimmästä palavasta lampusta (`drawPlayer`) jäivät päälle. Korjattu **vain
piirrossa** (`litNow = lamp.lit && !StreetChaosCards.lightsOut`, `doorLit`, `rimLightsOut`) →
`lamp.lit` pysyy ennallaan, joten ovilogiikka (`lampFreeOpen`, omistajalamppu) ei muutu ja
**NORMAL on bitti-identtinen** (`lightsOut` on siellä aina `false`). Huom: `lamp.overheat`-haara
jätettiin ennalleen (ylikuumentuminen on eri ilmiö). `#version-tag` + 10 leimaa → **v11.39**.
Penkki `street-chaos-cards-test`: uusi **osio 5 = rakennevahti** (5 lähdetarkistusta).
**Tulos:** NORMAL 78 avainta / 0 eroa · render-smoke 30/30 · 23 penkkiä 17 puhdasta / 6 = baseline.

**v11.40 – Vaihe 5 osa 6: huoneiden piirto omaan tiedostoon (street/rooms.js):** makuuhuone +
jukebox + BAR (1013 rv) siirrettiin **`street/rooms.js`**-tiedostoon (`var StreetRooms = …`):
`drawSleepRoom`, `drawJukeboxRoom` + `drawJukeboxCabinet`, `drawBarRoom` + `drawBarBeer` sekä
**BAR-taulun kuva-tila** (`BAR_PIC_SRC`/`barPic`/`barPicReady` – ei käytetä muualla → siirtyivät
mukana). Huoneiden **tila ja syöttölogiikka** (`updateSleepRoom`/`updateBarRoom`/
`updateJukeboxRoom`, `closeXxxRoom`, `openNewspaper`-tyylinen oven avaus) jäivät street.js:ään,
kuten osissa 3–5. Sidonta: 15 live-getteriä (`ctx`, `canvas`, `viewW`, `camX`, `isDay`,
`coinCount`, `hamburgerCount`, `drunkLevel`, `barBuyQty`, `jukeQueue`, `jukePick`, `jukeSel`,
`jukeCovers`, `sleepPhase`, `sleepSel`) + `chaosFlags`-olio + 10 vakiota. Huonerekisterin
`draw:`-osoittimet → `StreetRooms.drawSleep/drawBar/drawJukebox`.
**⚠️ Ansa:** siirretty koodi käyttää joka funktiossa paikallista `H`-muuttujaa
(`const W = WORLD_W, H = WORLD_H`) → host-nimi `H` varjostui (TDZ: "Cannot access 'H' before
initialization", render-smoke 24/30) → **host-nimeksi `ENV`**. Tämä on kirjattu
`tools/refactor/README.md`:n ansa-laatikkoon ja `BASELINE.md`:hen.
**Bench-päivitys:** `street-drunk` (`drawBarRoom: StreetRooms.drawBar` + `ENV.barBuyQty`-salliva
lähdetarkistus). **Tulos:** `street.js` 9 698 → **8 722 rv** (11 169 → 8 722 osissa 1–6);
NORMAL 78 avainta / 0 eroa; render-smoke 30/30; 23 penkkiä 17 puhdasta / 6 = baseline;
`street-drunk` 51/51. Työkalu **`tools/refactor/split-rooms.cjs`**. `#version-tag` + 10
`?v=`-leimaa → **v11.40**.

**v11.41 – BAD/FULL: ikkunavalot eivät syttyneet ollenkaan (bugikorjaus, sääntö 03):** käyttäjän
havainto (3.10.2026): *"Bad ja full chaos ikkunoissa ei koskaan pala yöllä valot."* Syy oli
**ennestään ollut** (todennettu `git show HEAD:street.js`:stä): BAD/FULLin
`shuffleBuildingOrder()` nollaa `litWindows`-listan (`litWindows.length = 0`), mutta
`updateLitWindows()` arpoo uuden tavoitteen (0..`windowTargetMax`) **vain kun jokin ikkuna
sammuu** → tyhjä lista ei koskaan täyty → koko runi ilman satunnaisia ikkunavaloja. Ainoa kylvö
oli IIFE:n **lataushetken** lause, joka ajetaan ennen kaaosprofiilin soveltamista (ja jonka
shuffle myöhemmin nollaa). Korjaus: kylvö eriytettiin funktioksi **`seedLitWindows()`**, jota
kutsutaan (1) latauksessa kuten ennen, (2) `shuffleBuildingOrder()`in lopussa ja
(3) `resetBuildingOrder()`issa (BAD/FULL → NORMAL samassa sessiossa). `windowTargetMax`-akseli
(BAD 0–2 · FULL 0–12) säilyy ennallaan – nyt se *näkyy*. **Uusi penkki**
`tools/tests/street-window-lights-test.cjs` (deterministinen: `Math.random` kiinnitetty 0.9 →
oletus 5 · tavoite 3 → 3 · BAD 2 → 2). `#version-tag` + 11 leimaa → **v11.41**. **Tulos:**
NORMAL 78 avainta / 0 eroa; render-smoke 30/30; **24 penkkiä 18 puhdasta / 6 = baseline**.

**v11.42 – Vaihe 5 osa 7: liikennologiikka samaan moduuliin (street/traffic.js):**
`updateTraffic(dt, playerSafe)` (124 rv kommentteineen: spawnit, liike, törmäys → tainnutus)
siirrettiin piirron (`drawVehicle`) seuraksi. Kadun tila (`playerSafe`, huoneet, `knockFallY`-logiikka)
lasketaan yhä street.js:ssä, joka kutsuu `StreetTraffic.update(dt[, true])` (7 kutsukohtaa).
Host laajeni 3 → ~18 nimeen: getterit `vehicles`, `spawnTimers`, `player`, `vehicleShakeTimer`
(**get+set**), `trafficSpeedMult`, `trafficSpawnMult`; vakiot `LANE_DEFS`, `TRAFFIC_DAY_MULT`;
apurit `chaosAllGone`, `spawnParticles`, `collisionCost`, `H.sfx.*` (playKnock + moottorin
start/update/stop).
**⚠️ Ansa 2:** `PLAYER_DEPTH_MAX_Y` on määritelty vasta rivillä ~8023 → **pakko sitoa getterinä**
(muuten bind kaatuisi TDZ:hen). Kirjattu `tools/refactor/README.md`:n ansa-laatikkoon.
**Penkkipäivitykset (3 kpl)** – lähdetekstihaut, jotka osuivat siirrettyyn koodiin:
`street-traffic-rooms` (17 OK / 0, oli 16/2), `street-knockdown-traffic` (43 OK / 0, oli 42/2 tai 42/1),
`street-beam-pickup-spawn` (27 OK / 0; kaistarajan purku sallii `H.`-etuliitteen).
**Tulos:** `street.js` 8 722 → **8 622 rv** (11 169 → 8 622 osissa 1–7); `street/traffic.js`
271 → **668 rv**; NORMAL 78 avainta / 0 eroa; render-smoke 30/30; **24 penkkiä 18 puhdasta /
6 = baseline**. `#version-tag` + 11 leimaa → **v11.42**. Työkalu **`tools/refactor/split-traffic-logic.cjs`**.

**v11.43 – kaksi canvas-bugia FULLissa + uusi invarianssipenkki (bugikorjaus, sääntö 03):**
käyttäjän havainto (3.10.2026): *"joku parametrien arvonta kadottaa rauta-aidan ja itse pelihahmonkin,
että pelaamisesta tulee mahdotonta. Aamu kun vaihtui, niin kaikki elementitkin katosivat tai piirtyivät
ainakin kahden tasavärin alle."* Syyt olivat **kaksi erillistä** kelvottoman canvas-arvon bugia –
kumpikaan ei kaatanut Node-stubiä, koska **oikea selain hylkää kelvottoman arvon hiljaa**:
(1) **ennestään ollut:** `randomHuePalette()` (FULL) palautti `hsl(...)`, mutta `lightenHex()`/`mixHex()`
olettavat `#rrggbb` → `parseInt('sl',16)` = NaN → `#NaNNaNxx` → talot/tausta piirtyivät edellisellä
värillä (BAD käyttää hex-palettia → siksi BAD oli kunnossa). Korjaus: `hslToHex()` + vahtilauseet
apureihin (`lightenHex`/`mixHex` palauttavat alkuperäisen, jos tulo ei ole hex tai `t` ei ole äärellinen).
(2) **osa 7:n regressio:** `updateTraffic` nimesi `WORLD_W` → `H.WORLD_W`, mutta `WORLD_W` **jäi pois**
`StreetTraffic.bind()`ista → `undefined + w` = NaN → ajoneuvon spawn-x NaN → ajoneuvo katosi eikä
poistunut koskaan (NaN-vertailut aina epätosia) → liikenne jäityi. Ilmeni vasta 300 framen jälkeen
(ensimmäinen spawn) → siksi penkit eivät napanneet; **löytyi uudella fuzz-menetelmällä** (skannasin
canvas-kutsujen argumentit NaN/±Infinity-varalta). Korjaus: `WORLD_W` lisätty bindiin.
**Uusi penkki** `tools/tests/street-canvas-invariants-test.cjs` (3 FULL-arpaa + NORMAL × 420 frameä;
vahtii NaN/undefined-argumentit, kelvottomat värit ja että pelaaja piirretään) – olisi napanneet
molemmat. `#version-tag` + 11 leimaa → **v11.43**. **Tulos:** NORMAL 78 avainta / 0 eroa;
render-smoke 30/30; FULL-fuzz **0 poikkeamaa / 40 arpaa**; **25 penkkiä 18 puhdasta / 7**
(7. = tunnettu epävakaa `street-meteor-coin`).


**v11.44 – Vaihe 5 osa 8: huoneiden LOGIIKKA samaan moduuliin (street/rooms.js):**
`updateSleepRoom` (76) · `updateBarRoom` (77) · `updateJukeboxRoom` (49) · `jukeboxExitAndPlay` (73)
+ `jukePickedTracks` · `resetJukeboxRoom` (9) · `closeSleepRoom` / `closeBarRoom` / `closeJukeboxRoom`
(29) = **345 rv / 3 lohkoa** siirrettiin piirron seuraksi **get+set-hostilla** (host-nimi `ENV`).
**Paikalleen jäivät** `rooms[]`-rekisteri, oven avaus (`tryXxxDoor`:t) ja `closeRoom()`
(rekisterisilmukka kokoaa kaikki neljä huonetta – myös lehden) → `street.js` kutsuu nyt
`StreetRooms`-destrukturointia (`const { updateSleepRoom, … } = StreetRooms;`), joten rekisteri
ja `closeGame()`:n `resetJukeboxRoom()`-kutsu eivät muuttuneet. **Host (~45 nimeä):** get+set
`sleepRoom/sleepPhase/sleepSel/sleepHeldUp/-HeldDown`, `barRoom/barBuyQty/barBuyHeldUp/-HeldDown`,
`jukeboxRoom/jukeSel/jukeHeldUp/-HeldDown/jukeSpaceHeld/jukeEnterHeld/jukeSavedPos`, `jukeQueue`,
`coinCount`, `hamburgerCount`, `hamburgerTimer`, `drunkLevel`, `drunkTimer`, **`isDay`** (Nuku
vaihtaa päivä/yön), `cycleChangeTimer`, `actionJustPressed`; getterit `jukePick`, `keys`, `state`
(määritelty `let state` → getteri, koska `state` vaihtuu `GameState.load()`issa), `dayT`,
`burgerInterval`, `HUNGER_WAKE_GRACE`, `CYCLE_CHANGE_DELAY_FRAMES`; apurit `updateHUD`, `playCoin`,
`saveChaosSession`, `resetMoon`, `resetSun`, `showNotification`, `StreetAudio` (globaalit
`GameState`/`StreetAudio`/`StreetTraffic` – liikennekutsut jäivät muotoon `StreetTraffic.update`,
jotta penkkien laskuri 5 pysyy). **Uudelleennimeäminen lookbehindilla** `(?<![\w.$])`, jotta
`state.isDay` ei muutu muotoon `ENV.state.ENV.isDay`, ja työkaluun vahti "jokainen nimi 0 kertaa
ilman ENV.-etuliitettä" (ansa 3). **Ansat:** (1) kohdistuskommentissa `sleep*/bar*/juke*`-tyylinen
`*/` katkaisi lohkokommentin → `node --check` kaatui; (2) CRLF-normalisointi ennen
`split`-vertailuja; (3) pilkku puuttui lisätyn bind-lohkon lopusta → `Unexpected identifier`.
**Uusi penkki `street-rooms-logic-test.cjs` (41 OK / 0)** – ajaa siirretyn logiikan oikeasti läpi
(Nuku/Poistu + isDay + 🍔 + herätysrauha + katto, BAR-osto/peruutus + FULL-ilut, jukeboxin
veloitus/vajaat kolikot/0 kolikkoa/äänen puuttuminen → palautus, `closeRoom()`) ja todistaa
get+set-hostin. **Penkkipäivitykset (2 penkkiä):** LIIKENNE-regexit sallivat `(?:ENV\.)?`-etuliitteen,
`showNotification`-laskuri 15 → 18 (kutsuja 13 ennallaan; laskuri laskee myös maininnat).
**Tulos:** `street.js` 8 622 → **8 338 rv** (11 169 → 8 338 osissa 1–8); `street/rooms.js`
1 053 → **1 417 rv**; NORMAL 78 avainta / 0 eroa; render-smoke 30/30; **26 penkkiä 19 puhdasta /
7 = sama baseline**. `#version-tag` + 10 leimaa → **v11.44**. Työkalu
**`tools/refactor/split-rooms-logic.cjs`**.

**Penkkivelka nollattu (3.10.2026, v11.44 – ei koodimuutosta, ei versionnostoa):** kuusi pitkään
"keltaista" penkkiä (vanhentuneita odotuksia v11.10–v11.31:stä) ja epävakaa `street-meteor-coin`
korjattiin → löydökset 31+1+1+3+27+3 (+0–4) → **0**; `run-all` = **26 penkkiä, 26 puhdasta,
0 löydöstä** (5 peräkkäistä ajoa). **Pelikoodia ei muutettu lainkaan** (versio pysyy v11.44:ssä –
käyttäjän testaama koodi on täsmälleen sama). Korjaukset lyhyesti:

- **`ROOT` osoitti forkissa `D:\AI\Main`iin** (forkin esikuva) kolmessa penkissä (hunger-scope,
  jukebox, manhole-bonus) → ne lukivat väärän projektin `gameState.js`/`audio.js`/fruitgame-vakiot.
- **`street-jukebox`:** koko penkki oli yhden valinnan mallia (v4.21) → uudistettu
  monivalintaan (v4.46/v4.99): rivi 0 = Exit, `✓ 1 🪙`, `▶ N track(s)`, `♪ PLAYING`,
  Enter lisää jonon perään; `tapDoor` vapauttaa Space-näppäimen (reunanilmaisu); audio-stubi
  tallentaa `playJukeboxQueue`/`appendJukeboxQueue`; T5-regex sallii forkin `|| introPlaying`.
- **`street-autohover`:** v11.28 nosti alun 1 s → 5 s (+ 500 ms uusintayritys) ja v11.29 poisti
  PC:n mouseenter-peruutuksen → aikajana lasketaan nyt vakioista (`START/STEP/HOLD/CYCLE`);
  osio C = "mouseenter ei enää keskeytä"; uudet lähdevahdit; D-osiossa pollaus.
- **`street-avenger`:** potki `buildings[2]`:ta, joka on nykyään Laivanupotus → kohde **talo 0**
  (3 potkua sytyttävät ikkunat, 4. pudottaa); jahti- ja paluubudjetit 1200 / 1100 f (v4.68).
- **`street-hunger-scope`:** merkki `'MAKUUHUONE'` → `'BEDROOM'` (UI englanniksi v11.00);
  T6 kävelee `x ≥ 745` asti (1 🍔 = 2/3-vauhti v4.70) `player()`-proben avulla.
- **`street-manhole-bonus`:** keräilybudjetti 400 → 1500 kierrosta (18 putoamista): "75 %" oli
  4 putoamisen sattumaa → 18 putoamisella 22 % / 17 % = 1/6 ✔; arvotut luvut tulostetaan.
- **`street-meteor-coin`:** kiinteä `Math.random`-siemen (37/40 siemenestä läpäisee, oletus 7,
  `MC_SEED=`-kytkin) + kolikkotestissä pelaaja turvaradalle (liikenne ei enää kaada kesken).

**v11.45 – Vaihe 4 loppuun: päivä/yö-tila yhdeksi olioksi (`dayNight`):** 15 irtamuuttujaa
(~178 viittausta) koottiin: `isDay` · `dayT` → `t` · `moonX` · `moonNightClock` · `moonDark` ·
`moonSaveTimer` · `sunX` · `sunDayClock` · `sunSaveTimer` · `cycleChangeTimer` · `dayLampsOff` ·
`nightShowArmed` · `nightShowQueue` · `nightShowTimer` · `spawnLampTimer`. **Ei toiminnallisia
muutoksia:** järjestysherkät alkuarvot (`CYCLE_CHANGE_DELAY_FRAMES + 1`, `MOON_X_MIN`, `SUN_X`,
`DAY_FORCE === 'night'`) asetetaan edelleen alkuperäisillä riveillään, `state.isDay` (tallennettu
pelitila) ei nimetä ja NORMAL on bitti-identtinen (78 avainta / 0 eroa). **Ansat:** (a) bind-
rajapinnan **avaimet** eivät saa nimetä (`get dayT()` pysyy, vain paluuarvo vaihtuu) – muuten
syntyy `get dayNight.t()`; (b) `state.isDay` suojattiin lookbehindilla; (c) deklaraatiot piti
korvata merkeillä *ennen* nimeämistä, etteivät olion kenttänimet nimeä. **Penkkipäivitykset
(6 penkkiä):** `street-drunk`, `street-meteor-coin`, `street-render-smoke`, `street-rooms-logic`
(hookit → `dayNight.*`) ja `street-beam-cd-hp` (preludi-penkki poimii funktioita tuotannosta →
määrittelee oman `dayNight`-olion, koska `beamCanFire` lukee `dayNight.t`). **Talous jätettiin
tarkoituksella ennalleen** (149 viittausta, sääntö 04) ja huoneiden tila hoidetaan osan 8
get+set-pareina → **Vaihe 4 on valmis.** Työkalu `tools/refactor/group-day-night.cjs`.
**Tulos:** NORMAL 78 avainta / 0 eroa · render-smoke 30/30 · `street-rooms-logic` 41/0 ·
**26 penkkiä 26 puhdasta / 0 löydöstä**. `#version-tag` + 10 leimaa → **v11.45**.

**Vaihe 6 – kommenttien versiosiivous (3.10.2026, v11.45 – ei versionnostoa):**
`tools/refactor/clean-version-comments.cjs` poisti koodista **565 riviä `vNN.NN`-merkintöjä**
(koko skoopin 637 merkinnästä; `street.js` 433 riviä, `street/rooms.js` 37, `chaos-config` 25,
`style.css` 18, loput pienempiä). **Kommenteissa on nyt vain "miksi"** – historia on
**`CHANGELOG.md`**:ssä (uusi historian arkisto), git-logissa ja tässä tiedostossa.
Säännöt: `// v11.14: laukaisuväli …` → `// laukaisuväli …`; `// v11.41 (bugikorjaus): X` →
`// Bugikorjaus: X`; `(X, vNN.NN)` → `(X)`; pelkkä historia → kommentti pois.
**Ei versionnostoa** (kommentit eivät ole ajettavaa koodia → käyttäjän testaama koodi on sama).
**Turvarajat:** muokataan vain kommenttiosuutta (koodi/merkkijonot koskemattomia; skoopissa ei ole
yhtään versiomerkintää merkkijonossa) ja `index.html` jätettiin rajojen ulkopuolelle (sääntö 01).
**Penkkikytkennät, jotka piti päivittää (4 penkkiä):** `street-traffic-rooms` +
`street-knockdown-traffic` (LIIKENNE-regexistä poistui `(v11.09)`) sekä `street-building-collapse`
+ `street-meteor-aftermath` (`resetBuildingDamage();` ilman kommenttia). **Sääntö jatkossa:**
penkkiä ei kytketä kommentin versiomerkintään, vaan koodiin. **Tulos:** NORMAL 78 avainta / 0 eroa ·
render-smoke 30/30 · **26 penkkiä 26 puhdasta / 0 löydöstä**.

> ### 🎉 Refaktorointi valmis (Vaiheet 0–6, v11.38–v11.45) – **JULKAISTU 3.10.2026**
> Vaiheet 1–3 (pilkonta + `chaosFlags` + `rooms[]`) · 4 (kaivo, kolikko, `dayNight`) ·
> 5 osat 1–8 (`chaos-config`, `sfx`, `news`, `traffic`, `chaos-cards`, `rooms`) · 6 (kommentit).
> `street.js` 11 169 → **8 357 rv**. Portti: **26 penkkiä / 26 puhdasta / 0 löydöstä**.
> **Tuotanto:** `origin/main` = HEAD = **v11.45** (julkaistu 3.10.2026); GitHub Pages tarjoilee
> v11.45:n ja käyttäjä testasi sen ennen julkaisua. Edellinen julkaisu oli v11.37.

Vanhat penkkimuistiinpanot (v11.24–v11.27) ja vanhentunut penkkilista: `docs/pimea-katu-historia.md`.

**v11.46–v11.48 – makuuhuoneen tunnistus (HOSTEL-neonkyltti) + rauta-aita pois BAD/FULLista (3.10.2026):**
Käyttäjän pyynnöt: *"Lisätään makuuhuonetaloon sininen neonvalokyltti [ HOSTEL ] ja kun tilaan menee
lisätään teksti Hostel - bedroom"* (BAD/FULLissa helpompi löytää makuuhuone; normipelissä helpottaa
sisään pääsemistä) sekä *"rauta-aitaa ei piirretä BAD ja FULL CHAOS -modeissa"*.

- **v11.46 – HOSTEL-neonkyltti + huoneen otsikko:** uusi `drawHostelSign(b)` (`street.js`) piirtää
  sinisen neonkyltin makuuhuoneen talon julkisivuun heti katon lipan alle (ydin `#7fdcff`, hehku
  `#0a84ff`, `shadowBlur 9`; seinä- ja katuhehku himmenee päivänvalossa kuten BAR-kyltillä).
  Kutsutaan `drawBuildings()`in sisällä (`idx === SLEEP_BLDG_IDX`), joten kyltti **seuraa taloa
  BAD/FULLin järjestyssekotuksessa ja katoaa talon tuhoutuessa** (romukasa). Huoneen otsikko
  `BEDROOM` → **`HOSTEL - BEDROOM`** (`street/rooms.js`, neon-sininen, fontti sovitetaan paneeliin);
  vanha `BEDROOM`-merkkijono säilyy osana otsikkoa → `street-hunger-scope`-penkin tunnistin ei muutu.
- **v11.47 – kyltin tiukennus (käyttäjän havainto "tiukenna asettelua"):** teksti `[ HOSTEL ]` →
  **`[HOSTEL]`** ja laatan leveys johdetaan tekstistä (`length × 8 px + 10 px` = **74 px**, ennen
  86 px); korkeus (16 px) ja sijainti ennallaan.
- **v11.48 – rauta-aita pois BAD/FULLista:** `render()`in aitalause sai ehdon `!chaosFlags.ruin`
  (sama lippu kuin muussa raunialogiikassa) → NORMAL/MILD/GOOD piirtävät aidan ennallaan
  (bitti-identtiset), BAD/FULL eivät lainkaan. Muu etuala (ruohotupsut, sanomalehden aukko) ja
  törmäykset ennallaan – aidalla ei ole ollut törmäyslogiikkaa (pelaaja voi kävellä sen taakse).
- **Validoinnit:** `chaos-normal-check` 78 avainta / 0 eroa · `street-render-smoke-test` 30/30 ·
  `street-canvas-invariants-test` 0 löydöstä · `street-hunger-scope-test` 25/0 ·
  `street-rooms-logic-test` 41/0 · `backdrop-destroy-test` 11/0 · `street-chaos-cards-test`
  0 löydöstä. Lisäksi tilapäiset ajotarkistukset (%TEMP%, ei repoon): kyltti osui talon keskikohtaan
  8/8 siemenellä BADissa ja `drawIronFence`-kutsut renderoinnissa olivat NORMAL/MILD/GOOD = 1,
  BAD/FULL = 0 (6/6 OK).
- **Julkaistu 3.10.2026** (push = tuotanto, v11.48).

**v11.49 – kuunvarjojen kaaoskerroin BAD/FULLissa (3.10.2026, uusi ominaisuus – sääntö 03):**
Käyttäjän pyyntö: *"Pelissä kuu luo yöllä varjoja. BAD ja FULL chaos modessa nämä varjot voisivat
olla randomina min mitä nyt tai x3. Siis nykytilanteeseen vrt 100-300%."* Valinta: **per talo, kerran
per yö**.

- **Uusi K1-visuaaliakseli `moonShadowMax`** (`street/chaos-config.js`): `CHAOS_DEFAULTS2` 1 ·
  `clampChaosCfg` klampaa **1–3** · BAD-profiili 3 · `generateFullChaosSeed` 3 · MILD/GOOD jäävät
  oletukseen 1. NORMAL/MILD/GOOD → kaikki kertoimet 1 → **piirto bitti-identtinen**
  (`chaos-normal-check`: 79 avainta / 0 eroa).
- **`street.js`:** `moonShadowMult` (9 alkiota) + **oma RNG** `moonShadowRng` (`makeRng` siemenestä
  `CHAOS_SEED ^ 0x5f3a1b`; ilman `?seed=` → `Math.random`) → arvonta **ei siirrä** FULLin/luottien
  arvontajonoa eikä riko `?seed=`-toistuvuutta. `rollMoonShadowMults()` arpoo jokaiselle talolle
  `1 + rnd·(max−1)` ja sitä kutsutaan **`init()`istä (uusi peli / hard reset)** ja **`resetMoon()`ista**
  (uusi peli + Nuku + päivä→yö = uusi yö) → kerroin on **vakio koko yön** (ei väpätä frameittain).
- **`drawMoonBuildingShadows()`:** talon oma kerroin skaalaa **sekä pituuden että kallistuksen**
  (`L = b.h · MOON_BLD_SHADOW_LEN · ms`, `k = MOON_BLD_SHADOW_SKEW · (b.h/100) · ms`); alpha
  (`MOON_BLD_SHADOW_ALPHA 0.50`) ennallaan, tuhoutuneen talon ehto ennallaan, ei uusia dialogeja
  (sääntö 06), ei talous-/mekaniikkamuutoksia.
- **Huomio näkyvyydestä:** ×3-varjo (151–227 px) ylittää 90 px:n maakaistan → katu tummenee
  tasaisemmin kuin ennen (gradientti katkeaa kesken). Pelaaja piirretään varjon päälle, joten
  pelattavuus ei muutu; alpha on tarvittaessa säädettävä nuppi.
- **Uusi penkki `tools/tests/street-moon-shadow-test.cjs` (33 OK / 0):** ajaa oikean `init()`in ja
  `drawMoonBuildingShadows()`in muistiinpanevalla ctx-stubilla → todistaa geometrian kaavasta
  (NORMAL = baseline, ×2 = pituus ja kallistus kaksinkertaistuvat, BAD/FULL = kunkin talon oma kerroin),
  kertoimen pysyvyyden yön sisällä, uuden yön uudelleenarvonnan (`resetMoon`) sekä portin klampit.
- **Dokumentit:** `docs/chaos.md` §6.1 (uusi K1-rivi), `CHANGELOG.md`, `tools/tests/BASELINE.md`,
  `memory-bank/activeContext.md`. **`#version-tag` + 10 `?v=`-leimaa + `.clinerules/03` → v11.49.**
- **Tulos:** `chaos-normal-check` 79/0 · `street-render-smoke` 30/30 · `street-canvas-invariants` 0
  löydöstä · **`run-all` 27 penkkiä / 27 puhdasta / 0 löydöstä**.

