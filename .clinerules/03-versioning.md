# 📋 Versionhallinnan säännöt

> **Tarkoitus:** Ohjeet versionumeron päivittämiseen. Cline noudattaa näitä automaattisesti.

---

## 🔢 Versionumero

Versionumero näkyy pääsivun (`index.html`) oikeassa alakulmassa elementissä `#version-tag`.

**Nykyinen versio:** `v5.01`

---

## ⬆️ Milloin päivitetään (+0.01)

Versionumeroa nostetaan **aina +0.01** kun:

- Pääportaalin koodia muutetaan (`index.html`, `street.js`, `gameState.js`, `style.css`)
- Alapelin koodia muutetaan (uusi ominaisuus, bugikorjaus, taso lisätty/poistettu)
- Uusi peli lisätään portaaliin
- Muistipankkia tai sääntöjä päivitetään (infrastruktuuri)

## �vä Milloin EI päivitetä

Versionumeroa **ei** nosteta kun:

- Pelkkiä asetusarvoja säädetään (esim. vihollisten aggressiivisuus, määrä, nopeudet, debug-kytkimet)
- Vain tekstit/tekstisisällöt muuttuvat (tekstit ovat parametreja, eivät koodia)
- Vain `README.md`, `PROJECT.md`, `CHANGELOG.md`, `start_server.bat` muuttuu
- Buildattuja tiedostoja (`dig_game.html`) regeneroidaan

**Nyrkkisääntö:** Jos muutos vaikuttaa pelilogiikkaan tai rakenteeseen (uusi ominaisuus, bugikorjaus, uusi taso) → +0.01. Jos pelkkä parametrin/arvon/tekstin säätö → ei. Tekstit ja asetukset ovat parametreja, eivät koodia — niihin saa ja pitää koskea tarvittaessa ilman versionnostoa.

---

## 📝 Työnkulku

1. Tee muutokset normaalisti ja **jätä ne työpuuhun** – käyttäjä näkee muuttuneet tiedostot VS Coden GIT-ikkunassa
2. **Kevyt polku** (`.clinerules/05-kevyt-polku.md`): ulkoasu-/yksittäisnäkymämuutoksissa ei testejä,
   ei muistipankkipäivitystä eikä dokumentteja – käyttäjä testaa itse. Raportti 1–3 riviä.
2. Ennen committia: jos muutos täyttä versionnostokriteerit, päivitä `#version-tag` `index.html`:ssa
3. **Kun käyttäjä sanoo "commit" (tai "push" tms.), tee aina** `git add -A && git commit && git push` **– yhdellä komennolla**. Yhden miehen projekti, ei tarvita erillisiä vaiheita.
4. Julkaisun jälkeen pushausta EI tehdä automaattisesti – vain käyttäjän pyynnöstä.
5. **Raportoi lyhyesti** – ei pitkiä yhteenvetoja (käyttäjä ei ehdi lukea niitä). Vain oleellinen: mitä muuttui ja lopputulos.


**Esimerkki:**
```html
<!-- Ennen: --> <div id="version-tag">v3.98</div>
<!-- Jälkeen: --> <div id="version-tag">v3.99</div>
```