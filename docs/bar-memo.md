# 🍔 BAR-huone (talo 8) – memo

> **Versio:** v4.25 (20.9.2026) | **Tiedosto:** `street.js` → `drawBarRoom()`
> **Testit (repon ulkopuolella):** `%TEMP%\street-bar-picture-test.cjs` (layout + taulu),
> `%TEMP%\street-bar-test.cjs` (ostologiikka ▲/▼/(o))
> ⚠️ Talousarvot (1 kolikko = 1 🍔, katto 10, 🍔-tahti) ovat **lukittuja** → `.clinerules/04-economy-balance.md`.

---

## Sijainti ja kulku

- Talo 8 (`buildings[8]`, ovi x 765) – **aina auki**, ei lamppua eikä avainta.
- Tilat: `barRoom` (päällä huoneessa), `barBuyQty` (tämän vierailun ostot),
  `barBuyHeldUp/Down` (reunanilmaisu). ▲/W = osta 1, ▼/S = peru 1 (vain vierailun ostot),
  (o)/Space/Enter = poistu. Uusi vierailu alkaa aina nollasta.

## Huoneen piirto (`drawBarRoom`)

Piirto tapahtuu maailmakoordinaatteihin 0–800 × 0–400; kamera keskittää huoneen
(`camX = (800 − viewW) / 2`) ja `render()` käärii kutsun `save()`/`restore()`-pariin.

| Elementti | Sijainti |
|-----------|----------|
| Seinä | `fillRect(60, 60, 680, 280)` → y 60…340 |
| Pöytä | `ty = GROUND_Y − 50 = 260` (pinta), `th = 14`, jalat 50 px |
| Hampurilainen | **2/3 koossa**, skaalaus pöydän pinnan keskipisteestä `(bx, ty)` → alaosa pysyy tarkalleen y = 260:ssa (leveys 80 → 53,3, korkeus 68 → 45,3) |

### Tekstien ja taulun järjestys (ylhäältä alas, v4.25)

1. **Seinätaulu** – mustat kehykset (`#0a0a0a`, kehys 2 px, v4.26) + varjo seinälle.
2. **Äidin lappu** – 3 riviä, keltaiset raamit (`#ffcc44`), `boxPad 36`.
3. **Ostorivi** – `Ostit Nx🍔 hampurilaista!` / kiintiö täynnä / ei kolikoita.
4. **Hampurilainen** pöydällä (ostorivi ei koskaan osu siihen).
5. Alimpana poistumisohje (`POISTU: (o) / Space`) y = 370.

### Sovitus näkyvään ikkunaan (mobiili)

Sama periaate kuin jukebox-huoneessa (v4.22): mobiilissa canvas on vain `viewW` leveä.
Asettelu lasketaan **alhaalta ylös** (ostorivi → äidin lappu → taulu), jolloin mikään
ei mene pöydän päälle:

- `winW = clamp(viewW, VIEWW_MIN 260, 800)`, sisältö keskitetty x = 400.
- `vs = canvas.clientHeight / canvas.height` (CSS-px / puskurin px) ja
  `needPx(target, base, max)` valitsee fontin maailmakoon → tekstit pysyvät
  luettavina myös **puhelimen vaakanäytössä** (vaakacase 844×390 → `vs ≈ 0.84`).
- `fitFs(rows, weight, base, min, family, maxW)` rajaa fontin pisimmän rivin mukaan,
  joten mikään teksti ei valu ikkunan ulkopuolelle (min 8 px info-rivillä).
- Taulun koko (v4.26): `PIC_TOP = 60`, `PIC_PAD = 2` (ohut musta kehys),
  `PIC_MAX_IMG_H = 48` → **kuva 57,9 × 48 / kehys 61,9 × 52 kaikilla laitteilla**;
  vapaa kaista `picBand = noteY − 6 − PIC_TOP` ja taulu **keskitetään** siihen;
  leveys kuvasuhteen mukaan (315/261) ja tarvittaessa `picMaxW = winW − 24` -rajaus.

**Koko (v4.26):** sama kaikilla laitteilla – kuva 57,9 × 48, kehys 61,9 × 52 (2 px musta kehys).
Aiempi "täytä koko seinä" -logiikka (kehys 83–99 × 71–84, v4.25) poistui käyttäjän pyynnöstä:
*"Kuva ei tarvitse olla iso ja kehyksetkin 1-2px"*.

## Kuva-aineisto

- `assets/justiina.png` – 315 × 261 px, 127 kt (repossa; GitHub Pages palvelee samasta kansiosta).
- Lataus: `BAR_PIC_SRC` + `new Image()` moduulin alussa (`barPicReady`), ei uusia localStorage-avaimia.
- Jos kuva ei ole vielä ladattu (tai lataus epäonnistuu), kehyksen sisään piirretään tumma
  varapinta → asettelu pysyy samana eikä piirto kaadu.
- Kuva piirretään **pehmennettynä** (`imageSmoothingEnabled = true` hetkellisesti; kadun
  pikseligrafiikka käyttää `false`). `typeof Image` -tarkistus pitää headless-testit toiminnassa.

## Validointi (20.9.2026)

`%TEMP%\street-bar-picture-test.cjs` – 5 laitekokoa × tarkistukset:
varapinta ennen latausta (ei `drawImage`), kuva kehyksen sisällä + kuvasuhde 315/261,
taulu näkyvässä ikkunassa ja seinässä, taulu lapun yläpuolella, lappu → ostorivi järjestys,
kaikki tekstit ikkunan sisällä, hampurilainen 53,33 × 45,33 ja alaosa tarkalleen y = 260.
Tulos: **0 löydöstä** (22 OK-tarkistusta: 5 laitekokoa × 4 + osto + kuva-aineisto)
+ `street-bar-test.cjs` regressio 0 löydöstä (`v4.12` ostologiikka ▲/▼/(o)) ja muut street-regressiot.
