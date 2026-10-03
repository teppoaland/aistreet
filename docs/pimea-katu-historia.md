# 📜 AI CHAOS STREET – vanhempi historia (siirretty `progress.md`:stä 3.10.2026)

> Tämä tiedosto sisältää **vanhentuneet/vanhat kirjaukset**, jotka siirrettiin pois
> `memory-bank/progress.md`:stä, jotta muistipankki pysyy kokorajoissa (pankki ≤ 155 kt,
> sääntö 3.10.2026). **Nykytila:** `memory-bank/activeContext.md` · **testipenkit:**
> `tools/tests/README.md` + `tools/tests/BASELINE.md` (kanoniset penkit ovat repossa).

## Testipenkkien vanha kirjaus (penkit olivat ennen `%TEMP%`:issa)

## 🧪 Testipenkit (ei repossa)

`%TEMP%\*.cjs` – `street-bar-test`, `street-bar-picture-test`, `street-jukebox-test`,
`street-jukebox-layout-test`, `street-cheat-test`, `street-avenger-test`, `street-threshold-test`,
`street-winframe-test`, `street-fruit-test`, `street-hunger-scope-test`, `street-bm-path-test`,
`street-autohover-test` (74 tarkistusta: pito 2 s, tärinä 2 s, sykli 10 s, reduce-motion **ei** estä tärinää), `street-chaos-fade-test` (24),
`street-building-collapse-test` (66: eskalaatiokynnys, tähtäys kaikkiin 9 taloon, animaation vaiheet,
jälkitilan portit, talous ennallaan, NORMAL-takuu),
`street-traffic-rooms-test` (17: liikenne pyörii BARissa, makuuhuoneessa ja kaivossa,
`playerSafe` = ei törmäystä),
`street-knockdown-traffic-test` (43: tainnutus ei jäädytä liikennettä paitsi kolarissa;
kytkin `STREET_KNOCK_LIFT` – oletus 25 px, kontrolli 10 px näyttää vanhan uudelleen osuman),
`chaos-normal-check` (78 avainta, 0 eroa = NORMAL bitti-identtinen),
`audio-music-test`, `audio-jukebox-test`, `ftest` (hedelmäpeli). Tekniikka: Node `vm` +
canvas/document-stub, rAF käsin ohjattuna.
Apuryhmät (eivät testejä): `newspaper-art` (generoi sanomalehden manuaalisivun ASCII-piirroksen –
laatikot tarkalleen kohdakkain) ja `np-verify` (tarkistaa piirroksen rivipituudet: 64 / 46).

**v11.24 – uusi ja päivitetyt penkit:** `street-meteor-aftermath-test` (68 tarkistusta: kasa ≤ 16 px,
ovet, rauniot, meteoriitin piirto/taloesto, BAD-avaus, ääni, sääntö 06, versio) · päivitetty
`street-building-collapse-test` (66, uudet invariantit) · `street-meteor-coin-test` (23/23 –
korjattu v11.14-hp-oletus + laukaisulukko) · `street-beam-daylight-test` (versio-odotus) ·
`street-manhole-bonus-test` (23/0 – `MH_BONUS_CHANCE 1/6`, rosvo-teksti) ·
`street-hunger-scope-test` (BAR-huoneen teksti englanniksi; **T3/T6 jäävät punaisiksi myös ilman
v11.24:ää** = vanhentunut reititys, A/B varmistettu) · samat vanhat löydökset myös
`street-traffic-rooms-test` (16 OK / 2) ja `street-knockdown-traffic-test` (42 OK / 2) – pelkkiä
vanhentuneita versio-odotuksia.

**v11.25 – uusi penkki:** `street-bad-warning-test` (57 tarkistusta: `#chaos-warning` luetaan
HTML:stä, tekstin tyhjennys heti valinnassa, kirjoitus merkki merkiltä + kursori + 5 klik-ääntä,
reveal vasta holdin jälkeen (mitattu 4038 ms), siivous lopussa, NORMAL/FULL entinen 3 s aikajana
ilman varoitusta (2018/2019 ms), sääntö 06 -vertailu ilmoituselementtiin, CSS/JS/versioleimat).
Regressiot: `chaos-normal-check` (78 avainta, 0 eroa) ja `street-chaos-fade-test` (24/0).
Julkaisu v11.25: committoitu ja pushattu 29.9.2026 (`e1c26b9`).

**v11.26 – uusi penkki:** `street-meteor-tempo-test` (42 tarkistusta: raunio-osuma ei mene hukkaan
(60 × 60 osumaa), portti ka 4,5 osumalla vs vanha kynnys 8,4, `badFinalePhase()` vain BADissa,
`nextSkyGap`-haarat per moodi, kohdevalinta ohittaa kesken romahtavat talot ja **yö-simulaatio oikealla
`updateShootingStar`illa** 24 siemenellä × 4 yötä: 1. katuvarren talo ka 1,2 yössä, kaikki 9 ka 2,5 yössä;
NORMAL/MILD/GOOD 0 meteoriittia, FULL ennallaan). Regressiot päivitetty uusiin lukuihin:
`street-building-collapse-test` (66/0), `street-meteor-aftermath-test` (68/0), `street-beam-daylight-test`
(22/0), `street-bad-warning-test` (57/0), `chaos-normal-check` (78 avainta, 0 eroa).
**v11.27 – päivitetty penkki:** `street-autohover-test` (74 tarkistusta, 0 löydöstä): G (reduce-motion) ja M (puhelin + reduce-motion) odottavat nyt **tärinää**, ja lähdevahti varmistaa, ettei kumpikaan portti palaa (`street.js` motion-lippu / `style.css` `@media`-yliajo), että tärinä-animaatio ja ohjeikkunan oma reduce-motion-lohko ovat ennallaan ja että versioleimat ovat v11.27. Samalla penkin vanhentuneet ajoitusodotukset päivitettiin 346/450 ms → **173 ms** (9 löydöstä poistui). Regressiot: `chaos-normal-check` (78 avainta, 0 eroa), `street-chaos-fade-test` (24/0).

## Vanhat penkkimuistiinpanot (v11.26–v11.27 ajalta)


**v11.27 – päivitetty penkki:** `street-autohover-test` (korjattu): G (reduce-motion) ja M (puhelin + reduce-motion) odottavat nyt **tärinää**, ja lähdevahti varmistaa, ettei kumpikaan portti palaa (`street.js` motion-lippu / `style.css` `@media`-yliajo), että tärinä-animaatio ja ohjeikkunan oma reduce-motion-lohko ovat ennallaan ja että versioleimat ovat v11.27. Samalla penkin vanhentuneet ajoitusodotukset päivitettiin 346/450 ms → **173 ms** (9 löydöstä poistui). Regressiot: `chaos-normal-check` (78 avainta, 0 eroa), `street-chaos-fade-test` (24/0).

Vanhat penkit joissa on ennestään tunnettuja / vanhentuneita löydöksiä (eivät liity v11.26:een):
`street-k2k6k7-test`, `street-avenger-test` (vanha `MARK = 'return { init, resize, closeGame };'`),
`street-fruit-test` / `street-jukebox-test` (vanhentunut `StreetAudio`-stubi),
`street-traffic-rooms-test` (16 OK / 2), `street-knockdown-traffic-test` (42 OK / 2),
`street-hunger-scope-test` (T3/T6 vanhentunut reititys).

## Esiforkin (Pimeä Katu v3.8x–v5.02) ominaisuusindeksi

> Nämä rivit olivat `memory-bank/progress.md`: n taulukoissa. Nykyajan (v10+/v11+) rivit
> jäivät pankkiin – myös ne, jotka mainitsevat vanhan version.

### Katunäkymä, hahmo, 9 lamppua, 9 ovea, ajoneuvot, eläimet, sää

| Ominaisuus | Tila |
|---|---|
| Hahmon viilaus | ✅ v4.03–v4.05 – silmä + `lookY`, lipan/kasvojen/leuan varjot, maakosketusvarjo, hengitys, potkun ennakointi + nojaus, hit pause, dynaaminen lampunvalo |
| Pelaajan syvyysskaalaus | ✅ v4.31 – `playerDepthScale()` ±10 % (0,90 kauas / 1,00 y=315 / 1,10 lähelle), ankkuri jalkojen kosketuspisteessä; visuaalinen vain – hitboxit, törmäykset ja kamera ennallaan |
| Kolikot | ✅ v3.86 / v4.22 – katu 1 kpl (näkyvissä 10 s + 30 s tauko, 120 s respawn); DG1 1 kpl, DG2 1/taso; syntymäpaketti 2 🪙 (tallennettu saldo voittaa) |
| Hampurilaiset + BAR | ✅ v3.73 / v4.12 – 5 alussa, +1 / 40 s; BAR: `▲/W` osta 1 (katto 10), `▼/S` peru vierailun ostot, `(o)/Space` poistu |
| 🍔-määrä → kävelyvauhti | ✅ **v4.70** – `hungerSpeedMult()`: ≤3 🍔 **2/3** · 4–7 🍔 **1,00** · 8–10 🍔 **2,00** (`moveSpeed = PLAYER_SPEED × kerroin`; myös `walkTimer`/askeleet skaalautuvat → jalat eivät liu'u). Vihollisten nopeudet ennallaan (oviukko 1.0, rosvo 1.05) → 8–10 🍔:llä oviukon voi karistaa karkuun. Testityökalu `?burgers=N` (ei tallenna). Talouslukko ennallaan |
| 🛏️ Nuku → +1 🍔 | ✅ v4.44 – katto 10, sama kuin BAR; nukkuminen muuten ilmaista |
| 🖼️ BAR-huoneen seinätaulu | ✅ v4.25–v4.26 – `assets/justiina.png` mustilla kehyksillä (kuva 57,9×48, kehys 61,9×52), hampurilainen 2/3, `winW`/`needPx`/`fitFs`-sovitus; memo `docs/bar-memo.md` |
| Talot + taustasiluetti | ✅ v4.06–v4.10 – `buildingScale` 100/95/90 %, ikkunakehykset pois 3 rivin taloista, pimeiden ikkunoiden syvennys, parallaksi 0.4 / skaala 0.5 |
| Puut + ruohotupsut / sähkökaapit / mopo | ✅ v3.81–v4.08 – huojunta tuulessa, 3 tupsua/puu; kaapit 8×14, osuma −1 🍔; mopo punainen + kuski pelaajan väreillä, panoroiva surina |
| 🛞 Panssarivaunu | ✅ v4.56–v4.63 – liikenteessä `type 'tank'` (86×36, nopeus 0,4–0,8, ei ajovaloa), moottorisaundi (28 Hz + särö), 75 px tykkiputki + telaketjut/telapyörät |
| 🚗 Auton osuma kaataa 10 px ylös osumakohdasta | ✅ **v4.78** – `player.knockFallY` = osumahetken jalkapiste **−10 px** (`updateTraffic`) → tainnutushaaran klamppi käyttää sitä `GROUND_Y+10`:n sijaan → ei enää "lentoa kadun varteen", mutta ei myöskään limboa keskellä tietä (kolarijatkuva). Muut tainnutuslähteet ennallaan (`knockFallY` nollautuu ylösnoustessa). **Talous ennallaan** (−1 🍔, 600 f, sääntö 04) |
| 🚗 Ajoneuvojen syvyysjärjestys | ✅ **v4.84** – autot, joiden keskipiste on pelaajan jalkapisteen yläpuolella (kauempana), piirretään ENNEN pelaajaa (pelaaja päälle); lähemmät pelaajan jälkeen. Korjaa virheen, jossa pelaaja rauta-aidan vierellä piirtyi autojen taakse, vaikka autot ajoivat Y-akselilla hänen yläpuolellaan |
| 🚢 Laivanupotus (`sinkship/`) | ✅ **v4.87** – liitetty katupeliin: potkaise ovea 2x = sisään (ei omaa lamppua, kuten jukebox). Aina auki yöllä ja päivällä. Overlay: Pelaa/Poistu. Enter/title = aloita, Esc/over = poistu. drawMsg-laatikon dynaaminen korkeus, automaatti-viesti 4 s. **v4.87:** voitosta +1 💰 + dialogi. Äänet −60 %. Vuorodialogi isompi + läpinäkyvä. Tekstikorjaus: sinkittyjä → upotettuja. |
| ⚡ Sähkökaapit arvalla päällä | ✅ **v4.85** – kaappien tila on **elävä**: alussa arvotaan ~50 % päälle (`ELECTRIC_CABINET_ON 0.5`) ja sen jälkeen jokainen kaappi **sammuu/käynnistyy itsestään** omaan satunnaiseen tahtiinsa (uusi arpa `CAB_REROLL_MIN/MAX` 900–2100 frameä = 15–35 s). Vain päällä oleva iskee (tainnutus + −1 🍔, sääntö 04) ja sen keltainen varoitusvalo vilkkuu omaan tahtiin (`CAB_BLINK_MIN/MAX`, oma `phase`) → valot eivät vilku tasatahtiin; sammuksissa olevan kaapin valo tumma. Testityökalu `?cabs=1` / `?cabs=0` (pakottaa ja jäädyttää, ei tallenna) |
| 💡 Lampun potku Y-korjaus | ✅ **v4.88** – osumatarkistus vaihdettu keskipisteestä (`player.y+player.h/2`) jalan tasoon (`player.y+player.h`): ennen dy=−20 px / osumasäde 20 → ei osunut; nyt dy=−5 px → osuu kävelykorkeudella |
| Kolikko potkusta / oviukko | ✅ v3.93 / v4.14–v4.15 / 23.9.2026 – 1/5 kolikko (30 s cooldown); oviukko 1/8 + 30 s, **½-nopeus (`AVENGER_SPEED 1.0`)**: avoimella kadulla se ei saa kiinni, mutta laidalla nappaa (nälkäisenä ≤3 🍔 heti), 3 s jäädytys + −1 🍔; huoneet/lehti jäädyttävät sen |
| 🔪 Rosvo jalkakäytävällä | ✅ v4.66–v4.68 – yllätysesiintyminen vain paluussa kadulle (trackHiddenStreet → maybeSpawnRobber; appearence 0.4, cooldown 1500, min. etäisyys 130 px, ttl 900 ~15 s); mustat vaatteet + puukko, nopeus 1.05 < pelaaja. Kiinniotto = tainnutus + **−1 🍔 + kaikki kolikot** (v4.68, ei ilmoitusta – sääntö 06), rosvo katoaa nappauksen jälkeen → väistö onnistuu. Ei localStorage-avainta |
| 🕳️ Avoin kaivo (viemärinkansi) | ✅ v4.51 / v4.52 / v4.69 – kansi voi puuttua (1/6 alussa, 1/10 joka paluulla; voi palata) → musta reikä; putoaa alas ja köpii ylös (~0,6 s + ~3,5 s). Menetys **enintään −2 🪙** (3 → 1, 2 → 0, 1 → 0, 0 → ei mitään) · **1/6 putoamisista +3 🪙** (pling + kultahiukkaset). Ei 🍔-menetystä, ei kuolemaa, ei tainnutusta; reiän voi kiertää. `?hole=0/1/2` |
| 📰 Sanomalehti | ✅ v4.53–v4.55 – kadulla rauta-aidan aukossa (x 338–352), poiminta toimintonapilla (säde 26 px) → 4 ohjesivua + **MANUAALI** (rahavirran ASCII-piirros 64/40 mrk; `newsLayout()`, `newspaper-art.cjs`, `np-verify.cjs`). Liikenne **ei pysähdy** lukiessa (`updateTraffic`) → auto voi ajaa yli (lehti putoaa, −1 🍔); ylätunnisteen varoitus `⚠ WATCH OUT – TRAFFIC NEVER STOPS!` |
| Ovikynnykset / mobiilikamera | ✅ v4.13 – kynnyslaatta + 1 kivirivi (kiveys y 317–324) / ✅ v3.91 – zoom + `camX` seuraa, D-pad + ⚡ overlay |
| Taustamusiikki + SFX | ✅ v3.28 / v4.16–v4.21 – syntikkalooppi (`MUSIC_SOURCE 'synth'`, 30 s + 0,6 s häivytys + 30–90 s tauko); `'mp3'`-varatie (`knived_unafraid.mp3`, 30 s) |
| 🎵 Jukebox-huone (talo 5) | ✅ v4.20–v4.23 + v4.46 + v4.60/v4.61 + v4.97 + v4.99 – ikkunat valaistuiksi → ovi auki; **9 kappaletta** (3 × Knived + 3 × kolmannen osapuolen heavy metal + raidat 7–9: Alex Morgan + 2 × NickPanek; nimeäminen `7_tiedosto.mp3` = `covers/7_tiedosto.png`), **1 🪙 / kappale**, monivalinta (▲/▼ kursori, Space/(o) ota–poista, Enter soita & poistu, jono 1 → N), **v4.99: ei lukkiudu soiton ajaksi** – soivan aikana valitut lisätään jonon perään; kansikuvat soivan raidan levykuvan paikalla; mobiilasettelu v4.22; auki vain öisin |
| ☀️ Päivä/yö (lopputila) | ✅ v4.32 / v4.33 – 3 avainta → `dayT` 0→1 (~20 s): päivätaivas, kuu → aurinko, tähdet/tähdenlento/satelliitti pois, lamppujen hehku himmenee, additive-päivänvalo-wash; tila tallennetaan (`state.isDay`), liuku molempiin suuntiin (`NIGHT_FADE_FRAMES`), Nuku vaihtaa; `?day=1` / `?day=0` |
| Päivän yksityiskohdat | ✅ v4.35–v4.42 – ajovalot pois päivällä, liikenne ×2 (`TRAFFIC_DAY_MULT`), ovet auki ilman lamppua (`lampFreeOpen`), moskiitot pois, valot sammuvat kerran (`dayLampsOff`), HUD 🍔-varoitus ≤3 (`HUNGER_WARN`), päiväpilvet tummenevat, kuu ⇄ aurinko -ristihäivytys ilman liukua, yö sytyttää katuvalot yksi kerrallaan (`NIGHT_LAMP_*` + `playLampOn()`) |
| 🌙 Kuun rata | ✅ v4.65 – kuu liukuu vasemmalta oikealle (~16 min, `MOON_NIGHT_FRAMES 57600`) myös huoneissa/alapeleissä ja laskeutuu ulos (`MOON_SET_X ≈ 890`); laskeutuessa `moonDark` → 0.15 |
| 🌙 Kuun paikka muistiin | ✅ **v4.74** – `state.moonClock` (yön kulku) tallennetaan portin omaan `pimeakatu_gamestate`-tallennukseen → **F5/reload jatkaa siitä mihin kuu jäi**. `applyMoonClock()` = ainoa paikan laskija (init / `resetMoon` / update); tallennus ~2 s välein (`MOON_SAVE_FRAMES 120`, ei sulkeutumistallennusta – kuoleman/✕-resetin nollaus ei saa herätä henkiin). Kuu alkaa alusta vain: **kuolema, ✕-resetti** (tallennus tyhjenee), **Nuku** (uusi yö) ja **päivä→yö** (sama Nuku-polku); `?day=0/1` ei tallenna. `freshGame`-vertailusta `moonClock` pois. Ei uutta localStorage-avainta, `gameState.js` ennallaan |
| 🌙☀️ Automaattinen yö/päivä -kierto | ✅ **v4.89** – kuu ja aurinko vaeltavat taivaan yli ~3 min (DAY_CYCLE_FRAMES 10800). Kuu laskee → 15 s → päivä, aurinko laskee → 15 s → yö. Molemmat alkavat ulos vasemmalta (SUN_X -78, MOON_X_MIN -90). Auringolla oma kello + tallennus (state.sunClock). Nukkuminen ja lampun potku toimivat erillisinä. |
| | 💡 Spawn-lamppushow | ✅ **v4.90/91** – 4 s viive → lamput syttyvät yksi kerrallaan samalla efektillä kuin yön tullessa. Vain reshGame + !isDay, ei F5:llä. |
| | 🎵 Jukebox-soitto F5:n yli | ✅ **v4.92** – jukeQueue (biisi-indeksit) ja jukePos tallennetaan state-objektiin. F5:n jälkeen soitto jatkuu samasta kohdasta. |
| | 🦇 Yölepakot | ✅ **v4.93** – yöllä 0–5 mustaa lepakkoa lampun kupujen yläpuolella (Y 90–245). 90 asteen satunnaiskäännöksiä (`vx, vy`), fade-out 1–5 s (kutistuu horisonttiin). Puolitettu koko (`BAT_WING_MAX 9`). Piirretään talojen edessä. **v4.95:** lentokorkeus Y 45–245 (kuun korkeudelle asti), spawn 30s välein (vakio, ei random). |
| | 🎵 Syntikkatempo 🍔-määrään | ✅ **v4.94** – `audio.js` `setHungerTempo(mult)` + `startSynth()` valitsee BPM:n `hungerTempo`-mukaan. ≤3 🍔 → 110 · 4–7 🍔 → 126 · 8–10 🍔 → 142. Jukebox-musiikkiin ei vaikutusta. |
| 🌙 Kuun ulkoasu | ✅ v4.72 – kuu piirretään tähtien jälkeen (peittää tähdet), kraatterit/maret + maavalo (`MOON_EARTHSHINE_*`), pehmeä terminaattori, `MOON_R 28 → 30`; ulkoasunuppeja – rata ja talous ennallaan |
| 🏮 Lamppupylväs & pelaaja | ✅ **v4.73** – syvyysjärjestys: valo (`drawLampGlow`) aina pelaajan alla, pylväs (`drawLampPost`) joko pelaajan eteen tai taakse jalkapisteen mukaan (`LAMP_BASE_Y = GROUND_Y + 15 = 325`, `lampFeetY`); yläreitillä (`y ≤ 286`) pelaaja katoaa pylvään taakse. Geometria `lampGeom()`; ajoneuvot/aita/ovet/valaistus ennallaan |
| Popupit | ✅ v3.99 / v4.00 – ohjeet pois HUD:sta; `showNotification(2500 ms)`, aloitusohje 4500 ms |
| 🌙 Jukebox & Hedelmäpeli vain öisin | ✅ v4.34 – päivällä (`dayT >= 0.5`) ovesta popup `Open` / `8pm-6am` (`CLOSED_SIGN`); ei potkua, ei valoja, ei sisään. Talousarvot ennallaan |
| 💰 Salainen kolikkopalkkio (testityökalu) | ✅ v4.23 – vitoslamppu 20 potkua → +20 kolikkoa, hiljainen; avain-cheat 5 potkusta ennallaan |
| 🛏️ Makuuhuone (ex-palkintohuone, talo 7) | ✅ v4.33 / v4.43 / v4.44 – ovi **aina auki** (ei avaimia eikä lamppua, kuten BAR); paksu sänky + ikkuna (kuu/aurinko), rivit **Nuku / Poistu** (▲/▼ + `(o)`/Space/⚡). Nuku = pimennys ~3,75 s (Zzz 3 s) → päivä ⇄ yö + **+1 🍔**; Poistu = ei muutosta. Ilmainen; käyttäjä testannut 20.9.2026 ("toimii juuri kuten pitää") |
| ✕-nappi (sulku + reset) | ✅ v4.48 – ✕ sulkee minkä tahansa tilan (iframe / BAR / makuuhuone / jukebox / lehti) ja resetoi vain kadulla; 600 ms dedupe estää mobiilin tupla-/ghost-klikkauksen |
| 🍔 Nälkä kulkee kaikkialla | ✅ v4.49 / v4.50 – 🍔 kuluu myös BAR:ssa, jukeboxissa ja iframe-peleissä; jäissä vain nukkuessa. 🍔 = 0 → kuolema myös huoneessa/pelissä (`leaveHiddenStateForDeath()` sulkee ensin) → resetti. Validoitu `%TEMP%\street-hunger-scope-test.cjs` 25/25 |

### Hedelmäpeli (fruitgame/) – vanhat rivit

| Ominaisuus | Tila |
|---|---|
| Ilmainen pyöräytys 1 / 120 s (pelin oma avain `pimeakatu_fruit_free`) | ✅ v4.11 |
| Kytkentä katuun: `fruitSync` / `fruitBet` / `fruitWin` / `RETURN_TO_STREET` + saldo-echo | ✅ v4.11 |
| 🖼️ Pelihuoneen seinäkuva | ✅ v4.28–v4.30 – `#wall-pic` HTML-elementtinä (ei canvasissa), koko vapaasta seinätilasta (`WALL_PIC_H_RATIO 0.28`, min 90 px, rako 0), keskitetty ja kiinni pelikentän yläreunassa, vaakatasossa piiloon; kuva `fruitgame/assets/dude_mv.jpg` (MV) |
| 🌙 Aukiolo | ✅ v4.34 – auki vain öisin (klo 20–06); päivällä ovi → popup `Open` / `8pm-6am` (`CLOSED_SIGN`), ei `enterGame`ia |

### Infrastruktuuri – vanhat rivit

| Ominaisuus | Tila |
|---|---|
| 🔒 Talousbalanssi lukittu | ✅ v4.24 – sääntö 04 + `docs/economy-balance-memo.md`; rosvo/kaivo/🍔-vauhti kirjattu sääntöön (v4.68/v4.69/v4.70) · **🔓 SUPERSEDED 27.9.2026:** sääntö 04 EI enää päde AI CHAOS STREET -forkissa (kirjoitettu alkuperäistä Pimeä Katu -peliä varten) – talousarvot vapaita kaikilla tasoilla |
| 🚫 Ei ylimääräisiä dialogeja | ✅ v4.68 – sääntö 06 (`.clinerules/06-ei-dialogeja.md`); rosvon rahaviesti poistettu |
