# 🧪 tools/tests – pöytäpenkit (headless-regressio)

Nämä penkit ajavat pelin lähdetiedostot **Node-vm:ssä** canvas-stubilla – ei selainta,
ei riippuvuuksia, ei buildia. Penkit olivat aiemmin `%TEMP%`:issa (versioimattomia);
ne on siirretty tänne, jotta refaktorointi on mitattavissa.

## Ajo

```bat
node tools/tests/run-all.cjs               :: kaikki penkit
node tools/tests/run-all.cjs street        :: vain nimet jotka sisältävät "street"
node tools/tests/run-all.cjs chaos-normal  :: vain yksi penkki
```

- Paluukoodi `0` = kaikki puhtaita, `1` = löydöksiä.
- Raportti: `tools/tests/last-run.txt`
- Perusta (baseline) ja tunnetut vanhentuneet odotukset: `BASELINE.md`

## Tiedostot

| Tiedosto | Tehtävä |
|---|---|
| `street-src.cjs` | **Ainoa** paikka, josta penkit lukevat `street.js`:n. Jos `street.js` joskus jaetaan osiin, muutos tehdään vain tähän. |
| `ver.cjs` | Lukee `#version-tag`in `index.html`:stä → versioleiman tarkistus ei enää mene rikki versionostosta. |
| `run-all.cjs` | Ajaja + yhteenveto. |
| `street-render-smoke-test.cjs` | **v11.38:** ajaa `update()`+`render()`-parin vm:ssä (yö, päivä, efektit, huoneet, tainnutus, kuolema, FULL) – ainoa penkki, joka kutsuu `render()`iä. |
| `street-chaos-cards-test.cjs` | **v11.38 (Vaihe 5 osa 5):** ajaa kaikkien 10 K7-kortin `save → apply → restore` -polun (tila palautuu täsmälleen) + lippukortit. Ainoa penkki, joka kattaa kaaoskorttien tilamutaatiot. |
| `street-window-lights-test.cjs` | **v11.41:** BAD/FULLin `shuffleBuildingOrder()`/`resetBuildingOrder()` kylvävät ikkunavalot heti (`seedLitWindows()`). `Math.random` on kiinnitetty → deterministinen. |
| `street-canvas-invariants-test.cjs` | **v11.43:** ajaa FULL/NORMALia 420 frameä ja vahtii, ettei canvas-kutsuihin mene NaN/undefined/virheellisiä värejä (oikea selain hylkää ne hiljaa, stubi ei kaadu). |
| `street-rooms-logic-test.cjs` | **v11.44 (Vaihe 5 osa 8):** ajaa siirretyn **huonelogiikan** oikeasti läpi (`update()` → `rooms[]` → `street/rooms.js`): Nuku/Poistu (isDay vaihtuu, +1 🍔, herätysrauha, katto), BAR-osto/peruutus + FULL-oluen haara, jukeboxin veloitus/palautus -polut ja `closeRoom()`-rekisteri. **Ainoa penkki, joka todistaa huoneiden get+set-hostin** (41 tarkistusta). |

## Tärkein portti

`chaos-normal-check.cjs` – **NORMAL-tason on oltava bitti-identtinen** (78 avainta, 0 eroa).
Jos tämä ei mene läpi, refaktoroinnissa on toimintamuutos. Aja se jokaisen muutoksen jälkeen:

```bat
node tools/tests/chaos-normal-check.cjs
```

## Penkkien kunto (3.10.2026, v11.44)

**Kaikki 26 penkkiä ovat puhtaita:** `node tools/tests/run-all.cjs` → *26 penkkiä,
26 puhdasta, 0 löydöstä*. Kuusi pitkään "keltaista" penkkiä (vanhentuneita odotuksia
v11.10–v11.31:stä) korjattiin – **pelikoodia ei muutettu**, joten versionumero pysyi
samana. Yksityiskohdat per penkki: `BASELINE.md` § Penkkivelka nollattu.

Hyvä tietää ylläpitäessä:

- **Aikapohjaiset penkit** (`street-autohover`, `street-bad-warning`) mittaavat seinäkelloa.
  Autohoverin aikajana luetaan vakioista (`START 5000` / `STEP 173` / `HOLD 2000` /
  `CYCLE 10000`) → pelkän ajoituksen säätö ei riko penkkiä, mutta `mainSrc` vahtii arvot.
  Bad-warningin vaiheet tarkistetaan erikseen; kokonaisajalle on väljä yläraja (kuorma).
- **`street-meteor-coin`:** `Math.random` on kiinnitetty (siemen 7) – 37/40 siemenestä menee
  läpi, loput asettavat talon meteoriitin eteen. Vaihtokytkin: `MC_SEED=2 node …`.
- **Jukebox/avenger/hunger-scope:** kävelyt mitataan pelaajan sijainnista (`player()`-probe),
  koska 1 🍔 = 2/3-vauhti (v4.70); ovikohteet valitaan nykyisen talojärjestyksen mukaan.
- **Preludi-penkit** (`street-beam-cd-hp`) rakentavat oman `new Function`-kontekstin ja poimivat
  tuotannosta vain funktioita → **niiden on määriteltävä tarvitsemansa tila itse** (esim.
  `dayNight`, koska `beamCanFire` lukee `dayNight.t`). Sama koskee hookkeja injektoivia penkkejä:
  koukun nimen paluuarvo seuraa tuotantoa (`dayT` → `dayNight.t`).

## Penkkien kytkennät lähdetekstiin (varo näitä muuttaessasi)

Osa penkeistä ei aja peliä vaan **hakee koodia lähdetekstistä**. Nämä kohdat ovat
kova rajapinta `street.js`:ään:

- `indexOf`-haut: `leaveHiddenStateForDeath();`, `if (sleepRoom) {`, `if (beamWeaponCollected && dayT <= 0) {`, `'♪ JUKEBOX'`, `'hampurilaisajastin, 1/60s'`, `'if (Math.random() < MH_BONUS_CHANCE) {'`, `'jukebox/' + t`
  - **v11.44 (osa 8):** huonelogiikka siirtyi `street/rooms.js`:ään ja tila sidotaan
    `ENV.`-etuliitteellä → `street-traffic-rooms` ja `street-knockdown-traffic` hyväksyvät
    molemmat muodot (`if \((?:ENV\.)?sleepRoom\) {` / `… barRoom …`), sama periaate kuin
    v11.42:n `(?:H\.)?player\.`. **Tarkoitus ennallaan:** liikennekutsu on huonehaarassa.
- Export-rivi on injektiopiste: penkit korvaavat tekstin
  `return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };`
  versiolla, jossa on `__t`-koukut. **Tätä riviä ei saa muuttaa.**
- `street-knockdown-traffic-test.cjs` patchaa lisäksi yhden koodirivin kontrolliajoa varten.

> Siksi Vaiheen 1 pilkonta tehdään **pelkkinä siirtoina**: nimet, export-rivi, tekstit
> ja järjestys säilyvät, jolloin nämä kytkennät pysyvät ehjinä.
