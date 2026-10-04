# 📜 CHANGELOG – AI CHAOS STREET

> **Tämä tiedosto on historian arkisto.** Vaiheessa 6 (3.10.2026) koodista siivottiin
> **565 riviä `vNN.NN`-merkintöjä**: kommenteissa kerrotaan enää **miksi**, ei milloin.
> Versiotiedot elävät täällä ja alla luetelluissa lähteissä. Alla on myös tiedoston
> alkuperäinen sisältö (portaalin rakennus 10.9.2026).

**Missä koko totuus on:**
- **git-historia** – jokainen versio on oma committinsa: `git log --oneline`
- **nykytila ja jatkopiste:** `memory-bank/activeContext.md`
- **versiokohtaiset muistiinpanot (v10.01 → v11.45):** `memory-bank/progress.md`
- **esiforkin (Pimeä Katu v3.8x–v5.02) historia + vanhat penkkimuistiinpanot:** `docs/pimea-katu-historia.md`
- **kaaosjärjestelmä K0–K7 (toteutus, klampit, DoD):** `docs/chaos.md`
- **pelikohtaiset memot:** `docs/*-memo.md` (jukebox, bar, fruit-game, dig-game, bm, economy-balance)

## Forkin versiot (27.9.2026 →)

| Versio | Mitä | Lisätieto |
|---|---|---|
| **v11.69** | **Salama alkaa pilvistä:** uusi vakio `LIGHTNING_TOP_Y 60` – siksak-polku alkaa kuun/auringon korkeudelta (pilvien kohdalta), **ei enää ruudun yläreunasta** (y = 4). Pituus `endY − LIGHTNING_TOP_Y` talojen taakse asti. Penkki `street-storm-test` 78/0 | `progress.md` |
| **v11.68** | **Myrsky kaikkiin moodeihin + sään transitio:** paksut pilvet + sade + ukkonen nyt **kaikilla tasoilla** (myös NORMAL/MILD/GOOD/FULL), samat arvot kuin BADissa (`CHAOS_DEFAULTS2`). **Sää muuttuu pehmeästi:** `stormLevel` (0…1) liukuu `STORM_RAMP_FRAMES 300` (~5 s) → pilvet paksunevat, sade voimistuu ja ukkonen alkaa vasta `STORM_THUNDER_LEVEL 0.85`; kaikki palautuu tyveksi (ei rysäystä). **Oma RNG** `stormRng` (ei kuluta jaettua Math.random-jonoa → NORMALin maailma bitti-identtinen); `chaosFlags.storm` poistettu. Penkki `street-storm-test` 77/0 | `progress.md` |
| **v11.67** | **Kadun talonumerot:** Dig Game -talo (`buildings[1]`) saa seinäänsä **roomalaisen I:n** ja Dig Däsh -talo (`buildings[3]`) **roomalaisen II:n** – musta serif-numero heti räystäslippaan alle lippa–ikkuna-bändiin (`drawHouseNumeral`; uudet vakiot `DIG1_BLDG_IDX`/`DIG2_BLDG_IDX`). Seuraavat taloa BAD/FULLin järjestysekotuksessa ja katoavat talon tuhoutuessa. Mallikuva: koko ~2/3, väri musta. Ei uusia dialogeja (sääntö 06), ei talousmuutoksia | `progress.md` |
| **🟢 v11.66 – TUOTANNOSSA** | **Kadun talotunnukset:** laivanupotustalon (`buildings[2]`) seinään **musta ankkuri** räystäslippaan alle (`drawAnchor`, ääriviivat `rgba(0,0,0,0.5)`) + Blue Mäx -talolle (`buildings[5]`) **kiinteä siipitunnusovi** (`drawDoor` case 7, `BM_DOOR_TYPE`: maroon-runko + musta kotkansiipi-ääriviiva, matriisi 14×6; ovi ei koskaan arvo, karmit `recessIn` 1). Molemmat seuraavat taloa BAD/FULLissa ja katoavat talon tuhoutuessa. Ei uusia dialogeja (sääntö 06), ei talousmuutoksia | `progress.md` |
| **v11.62–v11.65** | **Blue Mäx -talon kiinteän siipitunnusoven viilaukset:** siipitunnus pelkiksi ääriviivoiksi → mustaksi → −33 % (14×6) → puoliksi läpinäkyväksi (`rgba 0,0,0,0.5`); karmit vasen/oikea/ylä puolitettu | `progress.md` |
| **v11.60–v11.61** | **Laivanupotustalon ankkuri:** musta ankkuri (`drawAnchor`, rengas/varsi/poikkipuu/kourat) talon seinään räystäslippaan alle; v11.61 = puhtaaksi mustaksi | `progress.md` |
| **v11.59** | **Jukebox: kaikilla 9 raidalla kansikuva:** raidoille 1–3 (Knived) lisätty kansi (`jukebox/covers/1–3.png`, 148×148) – aiemmin kansi oli vain raidoilla 4–9; `street.js`:n `cover`-kentät + kommentti päivitetty | `progress.md` |
| **v11.58** | **Jukebox: kansikuva näkyy myös selatessa:** kun mikään ei soi, kaapissa näytetään **kursorin raidan** kansi (esikatselu); soitossa soivan raidan kansi kuten ennen (`showCover = !!cover && cover.ready`) | `progress.md` |
| **v11.57** | **Jukebox: valintalista kiertää päästä päähän:** ▲ riviltä 0 (Poistu) → viimeinen raita, ▼ viimeiseltä → rivi 0 – pohjalta pääsee suoraan takaisin ylös; penkki `street-jukebox-test.cjs` päivitetty kiertokäytökseen | `progress.md` |
| **v11.56** | **Ukkosen parametrit:** salaman → jyrinän viive **0,4–3,0 s** (`THUNDER_DELAY_MIN/MAX`), salamointi **5–15 s välein** (`thunderGapMin/Max` 300–900 f) ja jyrinän pituus satunnaiseksi – **5–10 limittäistä jyrinää** (`THUNDER_LAYERS_MIN/MAX`; limitys 0,2 s askel ennallaan) | `progress.md` |
| **v11.55** | **Jyrinä 5 kerrokseen + sade myöhemmäksi/pidemmäksi:** `playThunder` = **5 limittäistä jyrinää** (~3,1 s); BAD-sade alkaa vasta **~60 s jälkeen** ja kestää **60–180 s** (`stormCalm/BurstMin/Max 3600–10800`) | `progress.md` |
| **v11.54** | **Rosvon rauha + turvasäde + jyrinä tiiviimmäksi:** rosvo ei ilmesty **ensimmäiseen 60 s** (`ROBBER_GRACE_FRAMES 3600`) eikä koskaan synny **ulostulokohdan päälle** (`ROBBER_MIN_DIST 200`, reunaklampin ohitse, kaikki ovet – BAR-ovi-häkä poistettu); `playThunder` tiivistetty (~2,7 s). Uusi penkki `street-robber-grace-test` (19/0) | `progress.md` |
| **v11.53** | **BAD-myrsky viilattu:** ukkonen = **3 limittäistä jyrinää** (bruum-bruum-bruum, kesto ~3,5–4 s); sade **puolet hitaampi**, vinokulma **tuulen voimakkuuden mukaan**, **2 syvyyskerrosta** (kauko talojen taakse + lähi eteen) | `progress.md` |
| **v11.52** | **BAD CHAOS – myrsky:** paksut pilvet (`cloudThickMult`) + **sade + ukkonen satunnaisina purskeina** (`updateStorm`: tyyni 15–45 s → purske 8–20 s). Salama iskee ylhäältä alas **talojen taakse** ja väläyttää koko ruudun; `playThunder` soi hetki välähdyksen jälkeen. Uusi penkki `street-storm-test` | `progress.md` |
| **v11.51** | **CASINO-kyltti hedelmäpelitaloon:** neonvihreä kyltti talon katon yläpuolella (`drawCasinoSign`, `buildings[6]`), ohut musta kehys + pienet jalat + pieni ilmarako katon ja tekstin välissä; seuraa taloa BAD/FULLin sekotuksessa ja katoaa talon tuhoutuessa | `progress.md` |
| **v11.50** | **CASINO-kyltin runko:** neonvihreä `drawCasinoSign` hedelmäpelitalon (`buildings[6]`) katon yläpuolelle; teksti `\| CASINO \|` → myöhemmin `CASINO` (parametrisäätö) | `progress.md` |
| **v11.49** | **Kuunvarjojen kaaoskerroin (BAD/FULL):** jokainen talo heittää kadulle oman mittaisen kuunvarjonsa (kerroin ×1,00–3,00; skaalaa pituuden ja kallistuksen). Arpa per talo, **kerran per yö** (uusi peli / Nuku / päivä→yö) → yön sisällä vakaa. Uusi K1-akseli `moonShadowMax` (NORMAL/MILD/GOOD = 1 → bitti-identtiset). Uusi penkki `street-moon-shadow-test` (33/0) | `progress.md` |
| **v11.48** | **Makuuhuoneen tunnistus + BAD/FULLin aita:** sininen **HOSTEL-neonkyltti** makuuhuoneen talon julkisivussa (`drawHostelSign`, kapea laatta tiiviistä `[HOSTEL]`-tekstistä; seuraa taloa BAD/FULLin järjestyssekotuksessa ja katoaa talon tuhoutuessa) + huoneen otsikko **HOSTEL - BEDROOM**; **rauta-aita jää piirtämättä BAD/FULLissa** (`chaosFlags.ruin`; NORMAL/MILD/GOOD bitti-identtiset) | `progress.md` |

| **v11.45** | **Vaihe 4 loppuun:** päivä/yö-tila (15 irtamuuttujaa / ~178 viittausta) → `dayNight`-olio, toiminta bitti-identtinen · **Vaihe 6:** kommenttien versiosiivous (565 riviä, `tools/refactor/clean-version-comments.cjs`) | `progress.md`, `tools/refactor/README.md` |
| **v11.44** | **Vaihe 5 osa 8:** huoneiden logiikka (`updateSleepRoom`/`BarRoom`/`JukeboxRoom`, jukeboxin valinnat, `closeXxxRoom`) → `street/rooms.js` get+set-hostilla; uusi penkki `street-rooms-logic-test` (41/0) | `progress.md` |
| **v11.43** | **Bugikorjaus:** kaksi FULLin canvas-bugia – `#NaNNaN`-väri (`hslToHex`) ja `translate(NaN)` (puuttuva `WORLD_W`-sidonta); uusi penkki `street-canvas-invariants-test` | `progress.md` |
| **v11.42** | **Vaihe 5 osa 7:** liikennologiikka (`updateTraffic`) `street/traffic.js`:ään | `progress.md` |
| **v11.41** | **Bugikorjaus:** BAD/FULLin ikkunavalot eivät syttyneet (`seedLitWindows()`); uusi penkki `street-window-lights-test` | `progress.md` |
| **v11.40** | **Vaihe 5 osa 6:** huoneiden piirto (`drawSleepRoom`/`drawBarRoom`/`drawJukeboxRoom`) → `street/rooms.js` | `progress.md` |
| **v11.39** | **Bugikorjaus:** K7-kortti "Valot sammuvat" sammuttaa nyt kaiken (lamppujen kuvut, kuvun valopilkku, ovivalo, pelaajan reunavalo) | `progress.md` |
| **v11.38** | **Vaiheet 0–5 osat 1–5:** refaktoroinnin runko – penkit repoon, `update()` 1119 → 85 rv, `render()` → 143 rv, `handleAction()` → 14 rv, `chaosFlags`, `rooms[]`, `street/chaos-config.js` + `sfx.js` + `news.js` + `traffic.js` + `chaos-cards.js` | `tools/refactor/README.md` |
| v11.06–v11.37 | kaaosjärjestelmän viimeistely, jukebox-intro, tablet-ohjaimet, sädease, meteoriitti + eskalaatio + BAD-avaus, rauniot, liikenne huoneissa, kolarin putoamistaso | `progress.md` |
| v10.01–v10.20 | kaaosportti K0 + kategoriat K1–K7, hub-valikko, F5-soft reset, `?chaos=` / `?seed=` | `docs/chaos.md` |
| ~~🔴 v11.37 – edellinen julkaisu~~ | GitHub Pages: `https://teppoaland.github.io/aistreet/` (Pages tarjoilee nyt **v11.45**) | — |
| v5.02 | viimeinen esifork-versio (Pimeä Katu, `D:\AI\Main` jäädytetty) | `docs/pimea-katu-historia.md` |

## Miksi kommenteista siivottiin versiot (Vaihe 6)

- **Kommentti kertoo miksi, git kertoo milloin.** `// Bugikorjaus: kylvä ikkunavalot HETI`
  kestää aikaa; `// v11.41 (bugikorjaus): …` vanhenee ja hukuttaa syyn versionumeron alle.
- **Yksi lähde:** versiohistoria on gitissä ja `progress.md`:ssä – sitä ei kopioida koodiin.
- **Mitä EI siivottu:** `?v=`-leimat ja `#version-tag` (versionhallinnan mekanismi),
  `index.html` (suojattu pääsivutiedosto, sääntö 01) sekä `docs/`- ja `tools/tests/`-tiedostojen
  historiaviittaukset, jotka **selittävät miksi jokin odotus muuttui**.

## 2026-09-10 – Pääportaalin rakennus, versio 0.1.0

### Luotu
- `index.html` – Pääportaali (CRT-retro-teema, iframe-overlay, D-pad)
- `style.css` – Tyylit (CRT-scanline, mobiiliohjaimet, reset-nappi)
- `street.js` – "Pimeä Katu" -peli: 9 taloa, 5 lamppua, hahmo + potku-animaatio, kolikko
- `gameState.js` – localStorage-pohjainen tilanhallinta
- `.gitignore` – Versionhallinnan ignooraukset
- `PROJECT.md`, `README.md`, `CHANGELOG.md`, `docs/plan.md`

### Muutettu
- `digGame1/.git` ja `digGame2/.git` **poistettu** → yksi yhteinen git juureen
- `digGame1/MEMO.md` → `docs/dig-game-memo.md`
- `digGame2/MEMO.md` → `docs/bd-memo.md`
- `digGame1/JATKOKEHITYS.md` → `docs/dig-game-roadmap.md`

### Poistettu
- `digGame1/.gitignore`, `digGame1/build_single.js`, `digGame1/git_backup.ps1`
- `digGame2/.gitignore`, `digGame2/build_single.js`, `digGame2/git_backup.ps1`

### Bugikorjaukset (street.js)
1. Lamppujen varret piirretään nyt oikein (puinen tolppa, kupu, valokeila)
2. Potku ei enää laukea oven kohdalla – ovesta kävellään sisään ilman potkua
3. Ovidialogi tulee vain oven edessä, ei kaukana
4. Tyhjään potkaiseminen ei näytä ilmoitusta
5. Potku-animaatio: jalka heilahtaa `sin(π·t)`-kaarella ~170ms
6. Iframe-pelit eivät enää jää jumiin aloitusdialogiin (overlay näytetään ennen iframen latausta)
7. Pelaajalle lisättiin lippis, jonka lippa osoittaa kulkusuuntaan
8. Reset-nappi (✕) oikeassa yläkulmassa: tyhjentää localStorage + reload

### Pelaaja-animaatiot
- Kävelyanimaatio (4 frameä)
- Potku-animaatio (jalka heilahtaa eteen + kenkä irtoaa)
- Lippis kulkusuunnan mukaan