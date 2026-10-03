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

## Tärkein portti

`chaos-normal-check.cjs` – **NORMAL-tason on oltava bitti-identtinen** (78 avainta, 0 eroa).
Jos tämä ei mene läpi, refaktoroinnissa on toimintamuutos. Aja se jokaisen muutoksen jälkeen:

```bat
node tools/tests/chaos-normal-check.cjs
```

## Penkkien kytkennät lähdetekstiin (varo näitä muuttaessasi)

Osa penkeistä ei aja peliä vaan **hakee koodia lähdetekstistä**. Nämä kohdat ovat
kova rajapinta `street.js`:ään:

- `indexOf`-haut: `leaveHiddenStateForDeath();`, `if (sleepRoom) {`, `if (beamWeaponCollected && dayT <= 0) {`, `'♪ JUKEBOX'`, `'hampurilaisajastin, 1/60s'`, `'if (Math.random() < MH_BONUS_CHANCE) {'`, `'jukebox/' + t`
- Export-rivi on injektiopiste: penkit korvaavat tekstin
  `return { init, resize, closeGame, closeRoom, setChaos, saveChaosSession, loadChaosSession, clearChaosSession, clearBeamWeapon };`
  versiolla, jossa on `__t`-koukut. **Tätä riviä ei saa muuttaa.**
- `street-knockdown-traffic-test.cjs` patchaa lisäksi yhden koodirivin kontrolliajoa varten.

> Siksi Vaiheen 1 pilkonta tehdään **pelkkinä siirtoina**: nimet, export-rivi, tekstit
> ja järjestys säilyvät, jolloin nämä kytkennät pysyvät ehjinä.
