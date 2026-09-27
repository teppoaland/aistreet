# 🍒 Hedelmäpeli – memo (fruitgame/)

> Päivitetty 20.9.2026 – versio v4.11 (kytketty katuun + talon ilmainen pyöräytys) /
> **v4.34: peli auki vain öisin (klo 20–06)**

## Tiedostot

| Tiedosto | Vastuut |
|----------|---------|
| `game_main.html` | Kehitysversio (lataa erilliset CSS/JS), HUD: 💰 saldo / PANOS 1 / VOITTO / 🎰 pyöräytykset+voitot |
| `css/style.css` | Retro-teema, canvas 1:1-skaalaus (`box-sizing: content-box`), napin `free`-tila |
| `js/constants.js` | Symbolit/painot/maksut, RTP-dokumentaatio, `FREE_SPIN_COOLDOWN_MS`, `FREE_SPIN_KEY` |
| `js/audio.js` | `AudioFX` (tikitys, pysähdys, kolikko, **ilmainen pyöräytys**, voitot, häviö) |
| `js/renderer.js` | Canvas-kone, 5 symbolia, rullat, maksutaulukko, **ilmaisen pyöräytyksen merkki + laskuri** |
| `js/input.js` | Space/Enter = pyöräytä, Esc/Backspace = poistu, kanvas-tap = pyöräytä |
| `js/game.js` | Tila, RNG, rullafysiikka, **ilmainen pyöräytys + jäädytys**, postMessage-silta |

## Pelisäännöt

- 3 rullaa / 1 voittolinja, panos **1 kolikko = 1 pyöräytys**.
- Maksut: 💎×35 · 🍔×20 · 🔔×12 · 🍋×7 · 🍒×4 · kaksi samaa = panos takaisin.
- **RTP 78,49 % / panos** (analyyttinen = simuloitu 1 M arvonnalla; kolmikko 6,85 %, pari 35,3 %).
- **Talon ilmainen pyöräytys:** sisään tullessa 1 ilmainen pyöräytys ja **voiton saa pitää**.
  Jäädytys **120 s** (`FREE_SPIN_COOLDOWN_MS`): paluu alle 120 s sisällä → jokainen pyöräytys maksaa 1 kolikon.
  Aikaleima tallennetaan pelin omaan avaimeen `pimeakatu_fruit_free` → **kadun `inventory`/`pimeakatu_gamestate` ei muutu**.
  Efekti: max **+0,785 kolikkoa / 2 min** (≈ +0,39/min) → turvaverkko, ei rahalähde.
- Tulos arvotaan heti (`pickSymbolId()` + `pickSlot()`); animaatio vain esittää sen.

## postMessage-protokolla

| Suunta | Viesti | Merkitys |
|--------|--------|----------|
| katu → peli | `{type:'fruitSync', coins}` | Kadun kolikkosaldo (myös echona jokaisen panoksen/voiton jälkeen) |
| peli → katu | `{type:'fruitBet'}` | −1 kolikko (vain maksullinen pyöräytys; ilmainen ei lähetä) |
| peli → katu | `{type:'fruitWin', coins:n}` | +n kolikkoa (voitto, myös ilmaisesta) |
| peli → katu | `'RETURN_TO_STREET'` | Poistuminen (estetty kesken pyörinnän) |

## Kytkentä kadulle

- **Talo 7** (`buildings[6]`, x 560–610, ovi x 585) – ei lamppua eikä avainta.
  `handleAction()`: oma oviblokki **ennen** lamppusilmukkaa → ohittaa talon potku- ja 1/5-kolikkohaaran.
- **Aukiolo (v4.34):** peli on auki **vain öisin (klo 20–06)**. Päivällä
  (`dayT >= 0.5`, nuppi `CLOSED_AT_DAYT`) ovesta tulee `Avoinna` / `Klo 20 - 06`
  -teksti-popup (`CLOSED_SIGN`) eikä `enterGame()`ia kutsuta.
- `enterGame()`: `iframe.onload` → `sendFruitBalance()` (lähettää `fruitSync`in) + fokus iframeen.
- `_streetReturn()`: `fruitBet` (−1, clamp ≥ 0) ja `fruitWin` (+n, floor + clamp) → `GameState` + HUD + echo.
- `coinCount` on autoritatiivinen kadulla (`GameState` = totuus); peli luottaa saamaansa echo-saldoon.

## Kehitys ja testaus

- Testiparametrit: `?coins=N`, `?debug` (100 kolikkoa). Standalone (ei parentia) → ei lähetä viestejä.
- `%TEMP%\ftest.cjs` – pelin validointi (T1–T14, standalone + iframe): talous/HUD, rullat, maksut 125/125,
  RTP, dt-riippumattomuus, skaalaus, ohjaus, protokolla, **ilmainen pyöräytys**.
- `%TEMP%\street-fruit-test.cjs` – katu-integraatio: kävely talo 7:n ovelle 4 siemenellä, `fruitSync`/`fruitBet`/
  `fruitWin`/`RETURN_TO_STREET`, saldon pysyminen ei-negatiivisena, muut ovet ennallaan.
- Ei repossa (Temp-kansio), sama käytäntö kuin aiemmissa validoinneissa.

## Avoimet / ei toteutettu

- Nälkäajastin **ei** pysähdy iframen ajaksi (`street.js`) → näkymätön kuolema / reload kesken pyöräytyksen. Vaatii erillisen luvan.
- "1 kolikko = 2 pyöräytystä" hylätty: nykymaksuilla RTP/kolikko olisi **157 %** → koneesta tulisi rahalähde.
- Panosvalitsin (1/2/5) ja RTP-presetit (74 / 78,5 / 85 %) – avoimena, ks. `memory-bank/activeContext.md`.
