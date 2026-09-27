# 🎮 Pelilogiikan säännöt

> **Tarkoitus:** Nämä ovat kriittiset "älä riko" -säännöt pelilogiikalle. Cline noudattaa näitä automaattisesti.

---

## ⚠️ Kriittiset pelitiedostot – ÄLÄ MUUTA ILMAN ERILLISTÄ PYYNTÖÄ

Jokaisessa alipelissä on seuraavat **ydintiedostot**, joihin ei kosketa ilman suoraa pyyntöä:

### Suojatut tiedostotyypit
- `physics.js` – Fysiikka: painovoima, putoaminen, törmäykset, objektien liike
- `constants.js` – Pelin vakiot: ruututyypit (TILE), nopeudet, pisteet, maailman mitat
- `game.js` – Pelin pääohjain: pääsilmukka, tilat, HUD
- `levels.js` – Kenttien rakentaja: maailman generointi, kenttädata
- `enemies.js` – Vihollisten tekoäly: liikkumislogiikka, törmäykset
- `input.js` – Ohjaus: näppäimistö ja kosketus

> **Sääntö:** Näitä tiedostoja saa muuttaa **vain** jos käyttäjän pyyntö kohdistuu suoraan niihin. Muussa tapauksessa – älä koske.

### Suojatut pelimekaniikat
- **Painovoima ja putoaminen** – kivien/timanttien/puiden/talojen putoamislogiikka
- **Törmäystarkistukset** – pelaajan ja objektien vuorovaikutus
- **Vihollisten tekoäly** – liikkumisreitit, nopeudet, käännökset
- **Pisteytys ja elämät** – pistearvot, elämien menetys
- **Talous ja palkkiotase** – 🔒 **LUKITTU**: kolikkotulot, hedelmäpelin painot/maksut/RTP, 🍔-tahti,
  BAR- ja jukebox-hinnat, syntymäpaketti → ks. **`04-economy-balance.md` (ISO VAROITUS)**.
  Ei muuteta ilman erillistä, nimenomaista pyyntöä – arvot on pelitestattu hyväksi.
- **Tasojen rakenne** – kenttädatan formaatti, parserit, maailman rakentaja

---

## Alataskien suorittaminen

Kun saat uuden alataskin (subtask) joka koskee jotain alipeliä:

### Ennen työn aloittamista:
1. **Lue kyseisen pelin dokumentaatio** `docs/`-kansiosta (esim. `docs/dig-game-memo.md`)
2. **Lue `memory-bank/systemPatterns.md`** – varmistaaksesi ettet riko arkkitehtuuria
3. **Lue `memory-bank/activeContext.md`** – varmistaaksesi tiedät missä mennään

### Työn aikana:
- Tee muutokset **kehitysversioon** (`game_main.html` + `js/` + `css/`)
- Testaa kehitysversion kautta

### Työn jälkeen:
- **Kevyt polku** (`.clinerules/05-kevyt-polku.md`): kun muutos koskee vain yhtä näkymää tai
  staattista asiaa (kuva, väri, teksti, koko, sijainti), **ei testejä eikä muistipankkipäivitystä**
  – käyttäjä testaa itse. Raportti 1–3 riviä.
- Muuten: päivitä `memory-bank/activeContext.md` – mitä tehtiin
- Muuten: päivitä `memory-bank/progress.md` – mitä valmistui
- **Älä buildaa** ellet saa erillistä pyyntöä

---

## Pelien väliset riippuvuudet

| Yhteys | Selitys |
|--------|---------|
| `gameState.js` ↔ pelit | Alapelit kommunikoivat portaalille `gameState.js` kautta |
| `digGame1` → `digGame2` | Dig Gamen avain avaa Dig Däshin portaalissa |
| `digGame2` → tuleva | Dig Däshin avain avaa seuraavan pelin |

> **Sääntö:** Älä muuta pelien välistä kommunikaatiorajapintaa ilman erillistä pyyntöä.

---

## Virhetilanteet

Jos olet epävarma jostain pelilogiikan yksityiskohdasta:
1. Tarkista dokumentaatio `docs/`-kansiosta
2. Lue kyseinen lähdekooditiedosto huolellisesti
3. Kysy käyttäjältä – älä arvaa pelimekaniikkoja