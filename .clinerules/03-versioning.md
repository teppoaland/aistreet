# 📋 Versionhallinnan säännöt

> **Tarkoitus:** Ohjeet versionumeron päivittämiseen. Cline noudattaa näitä automaattisesti.

---

## 🔢 Versionumero

Versionumero näkyy pääsivun (`index.html`) oikeassa alakulmassa elementissä `#version-tag`.

**Nykyinen versio:** `v11.44` (forkki **AI CHAOS STREET**; pidä tämä rivi ajan tasalla aina kun
`#version-tag` muuttuu)

---

## ⬆️ Milloin päivitetään (+0.01)

Versionumeroa nostetaan **aina +0.01 kun ajettava koodi muuttuu**:

- Pääportaalin koodia muutetaan (`index.html`, `street.js`, `gameState.js`, `style.css`)
- Alapelin koodia muutetaan (uusi ominaisuus, bugikorjaus, taso lisätty/poistettu)
- Uusi peli lisätään portaaliin
- **Rakenteellinen refaktorointi** (tiedostojako, funktion pilkkominen, moduulin siirto) –
  **myös silloin kun pelin toiminta ei muutu**
- Muistipankkia tai sääntöjä päivitetään **yhdessä koodimuutoksen kanssa** (infrastruktuuri)

> **Miksi (käyttäjän linjaus 3.10.2026):** *"Kyllä sitä versionumeroa saa nostella, kun tulee isoja
> koodimuutoksia, niin näen myös varmasti, että testaan uusinta versiota."* Versionumero on siis
> **testauksen tunniste**: kun numero vaihtuu, käyttäjä tietää testaavansa uutta koodia ja `?v=`-leima
> pakottaa selaimen hakemaan tuoreet tiedostot. Siksi **isoa koodimuutosta ei koskaan jätetä
> nostamatta** ("ei nosteta tässä välissä" -perustelua ei käytetä).
>
> Kun `#version-tag` muuttuu, **kaikki `?v=`-leimat on nostettava samaan numeroon** – sekä
> `style.css`-linkki että **jokainen** `<script>`-rivi (myös `street/`-osat).

## ⚠️ Milloin EI päivitetä

Versionumeroa **ei** nosteta kun **koodi ei muutu**:

- Pelkkiä asetusarvoja säädetään (esim. vihollisten aggressiivisuus, määrä, nopeudet, debug-kytkimet)
- Vain tekstit/tekstisisällöt muuttuvat (tekstit ovat parametreja, eivät koodia)
- **Vain dokumentit tai muistipankki päivitetään** ilman koodimuutosta – ne menevät seuraavan
  koodimuutoksen kyydissä. Muuten versionumero lakkaa kertomasta, mitä pitää testata.
- Vain `README.md`, `PROJECT.md`, `CHANGELOG.md`, `start_server.bat` muuttuu
- Buildattuja tiedostoja (`dig_game.html`) regeneroidaan

**Nyrkkisääntö:** Muuttuiko **ajettava koodi** (myös rakenne, vaikka toiminta pysyisi samana)?
→ **+0.01.** Muuttuiko vain parametri, teksti, dokumentti vai muistipankki? → ei. Tekstit ja
asetukset ovat parametreja, eivät koodia — niihin saa ja pitää koskea tarvittaessa ilman versionnostoa.

---

## 📝 Työnkulku

1. Tee muutokset normaalisti ja **jätä ne työpuuhun** – käyttäjä näkee muuttuneet tiedostot VS Coden GIT-ikkunassa
2. **Kevyt polku** (`.clinerules/05-kevyt-polku.md`): ulkoasu-/yksittäisnäkymämuutoksissa ei testejä,
   ei muistipankkipäivitystä eikä dokumentteja – käyttäjä testaa itse. Raportti 1–3 riviä.
3. **Jos koodi muuttui:** nosta `#version-tag` `index.html`:ssa **+0.01** ja **kaikki `?v=`-leimat**
   samaan numeroon (`style.css` + jokainen `<script>`, myös `street/`-osat), sekä päivitä tämän
   tiedoston `Nykyinen versio` -rivi.
4. **COMMIT = paikallinen tallennus (aina sallittu, ei julkaise mitään):**
   `git add -A && git commit -m "vNN.NN: …"`. Committaa **jokaisen validoidun vaiheen jälkeen** →
   jokaisesta versiosta jää **revert-piste**. Commit-viesti repon tyylillä (suomi, ASCII, alkaen `vNN.NN:`).
5. **PUSH = julkaisu TUOTANTOON (vain erikseen pyydettäessä):** `git push` vie koodin GitHubiin **ja
   GitHub Pagesiin** – ja **pelaajat pelaavat suoraan `https://teppoaland.github.io/aistreet/`ista**,
   joten push on **julkaisu tuotantoon**. Tehdään **vain** kun käyttäjä sanoo "push" / "julkaise".
   **Ei koskaan osana committia.** Paikallinen `main` saa olla `origin/main`ia edellä – se on merkki
   julkaisemattomasta (testatusta?) työstä.
6. **Raportoi lyhyesti** – ei pitkiä yhteenvetoja (käyttäjä ei ehdi lukea niitä). Vain oleellinen: mitä muuttui ja lopputulos.
   Kerro aina **versionumero**, jotta käyttäjä tietää testaavansa uusinta.


**Esimerkki:**
```html
<!-- Ennen: --> <div id="version-tag">v11.38</div>
<!-- Jälkeen: --> <div id="version-tag">v11.43</div>
```