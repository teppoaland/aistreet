# Arkkitehtuurisuunnitelma: Retro-Sivusto & Meta-Peli

> Alkuperäinen suunnitelma, kirjoitettu ennen toteutusta.
> Toteutettu versio poikkeaa joiltakin osin – katso [PROJECT.md](../PROJECT.md) nykytilanteesta.

---

## 1. Yleisarkkitehtuuri & Tilanhallinta (`gameState.js`)

Koko sivusto käyttää kevyttä, selaimen muistiin pohjautuvaa tilanhallintaa (`localStorage`).

**Globaalit muuttujat:**
- `litLamps`: Valotolppien tilat `[false, false, false, false, false]`
- `inventory`: Pelaajan reppu `{ coin: false }`
- `customLevel5`: Tason 5 karttadata (voidaan muokata editorilla)

## 2. Päävalikko: "Pimeä Katu" (`street.js`)

- **Näkymä**: 2D-sivukuvattu pimeä kaupunkikatu
- **Mekaniikka**:
  - Pelaaja liikuttaa nuolilla / virtuaaliohjaimella pientä pikselihahmoa
  - Kadulla on 5 syttymätöntä katulamppua
  - Lamppua potkaisemalla (välilyönti / "Potku"-nappi) valo syttyy ja sen alla oleva ovi/pelihalli aktivoituu
  - Maasta voi löytää esineitä (esim. kolikko pimeästä kulmasta)

## 3. Pelit & Jekut

### Peli 1: Dig Game (`digGame1/`)
- **Mekaniikka**: Yksi yhtenäinen maailma, kaivamista, puiden/talojen pudottelua
- **Status**: ✅ Valmis

### Peli 2: Dig Däsh (`digGame2/`)
- **Mekaniikka**: Perinteinen ruudukko- ja timanttipeli (4 kenttää)
- **Status**: ✅ Valmis
- **Jekku (Kenttä 5)**: Reitti maaliin on täysin kivilohkareiden saartama (ei vielä koodattu)
  - Ratkaisu: Pelaajan täytyy siirtyä "Level Editor" -kohtaan, raivata reitti, tallentaa ja palata

### Peli 3: Blue Mäx (`bm/`)
- **Mekaniikka**: Isometrinen lentely- ja pommituspeli
- **Status**: ❌ Ei aloitettu
- **Jekku**: Bensaa vain 30 sekunniksi
  - Ratkaisu: Kerää kolikko kadulta → syötä pelikoneeseen → lisätankki

## 4. Tekninen pohja

- Puhdas JavaScript, ei ulkoisia kirjastoja
- Canvas-pohjainen renderöinti
- Pikseligrafiikka (`image-rendering: pixelated`)
- Mobiilituki (D-pad + toimintanappi)
- CRT Scanline CSS-efekti
- `localStorage` tilanhallintaan

## 5. Kehitysmalli: erilliset tiedostot

Alapelien (Dig Game, Dig Däsh) stand-alone-buildaus yhteen HTML-tiedostoon
(`dig_game.html`, `boulder_dash.html`) oli alkuperäinen jaettavan version malli.
**Tästä on luovuttu** – pelejä ei enää ahdeta turhaan yhteen tiedostoon.

- Kehitys ja ylläpito tapahtuu **erillisissä tiedostoissa** (`game_main.html` + `css/` + `js/`)
- Tämä on selkeämpää, nopeampaa kehittää ja helpompi debugata
- Portaali (`index.html`) käyttää iframe-integraatiossa suoraan `game_main.html`-tiedostoja