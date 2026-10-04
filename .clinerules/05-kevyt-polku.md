# 🪶 Kevyt polku – milloin työ tehdään kevyesti

## ⚠️⚠️⚠️ ISO SÄÄNTÖ: staattinen lisäys = EI TESTEJÄ ⚠️⚠️⚠️

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  STAATTINEN LISÄYS / MUUTOS → EI TESTEJÄ.                                  ║
║  (kuva, väri, teksti, numero, merkintä, koko, sijainti, kehykset, fontti,   ║
║   ääni – tai minkä tahansa uuden tavaran LISÄÄMINEN näkymään)               ║
║  → KÄYTTÄJÄ TESTAA ITSE silmällä. Ei penkkejä, ei testiskriptejä.          ║
║                                                                             ║
║  TOIMINNALLISUUS MUUTTUU → sitten testataan.                                ║
║  (logiikka, pelimekaniikka, fysiikka, törmäykset, reitit, talous/balanssi,  ║
║   invariantit, portit, tilakoneet, tallennus)                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

> **Käyttäjän linjaus 4.10.2026:** *"Jos lisätään jotain staattista niin testejä ei tarvita.
> Minä testaan. JOS toiminnot muuttuvat, niin sitten."*

---

> **Tarkoitus:** Estää turha työ. Käyttäjä testaa itse, eikä yhden näkymän/staattisen
> asian muutos vaadi koko koodin läpikäyntiä, testejä eikä dokumentointia.
> **Käyttäjän linjaus 20.9.2026:** *"itse hoidan testauksen ja koko koodia EI tarvi käydä
> läpi/testata jos muokataan vain yhtä staattista näkymää => asetetaan kuva."*

---

## 🧪 Testaus

- **Oletus: käyttäjä testaa lopputuloksen silmällä ja omalla maulla** (selain, oma maku).
- **Staattisen lisäyksen/muutoksen jälkeen AI ei aja testejä eikä tee testiskriptejä.**
  Se on turhaa työtä – käyttäjä testaa itse (ks. ISO SÄÄNTÖ yllä).
- **Testit ajetaan vain kun toiminnallisuus muuttuu:** logiikka, pelimekaniikka, fysiikka/törmäykset,
  reitit, talous/balanssi, invariantit, portit, tilakoneet, tallennus. Silloin AI saa ja kannattaa
  varmistaa muutos mekaanisesti (penkit `tools/tests/`, `node --check`, `%TEMP%\*.cjs`) ilman
  erillistä pyyntöä.
- **Käyttäjän silmä on silti lopullinen tuomari ulkoasussa ja pelituntumassa** – niitä AI ei voi
  "testata läpi" yksin; ne jäävät käyttäjälle.

## 🎯 Milloin riittää yhden kohdan muutos (kevyt polku)

Kun pyyntö koskee **yhtä näkymää tai staattista asiaa** (kuva, väri, teksti, koko,
sijainti, kehykset, fontti, ääni), Cline:

1. lukee **vain** sen tiedoston/funktion, jota muutos koskee,
2. tekee muutoksen sinne – ei refaktoroi eikä siirrä koodia muualle,
3. **ei** lue `docs/`- eikä muistipankkitiedostoja läpi,
4. **ei** kartoita koodikantaa (grep/haut) "varmuuden vuoksi",
5. **ei** aja testejä eikä tee testiskriptejä (staattinen muutos → käyttäjä testaa itse; testit vain kun toiminnallisuus muuttuu),
6. raportoi **1–3 riviä**: mitä muuttui ja missä tiedostossa.

## 📁 Muistipankki ja dokumentit

- Muistipankkia (`memory-bank/`) **ei** päivitetä, ellei käyttäjä pyydä.
- Uusia `docs/`-memoja, README- tai LICENSE-muutoksia **ei** tehdä ilman pyyntöä.
- Versiorivi (`#version-tag`, sääntö 03) nostetaan koodimuutoksesta – se on 1 rivi.
- Työ jää aina työpuuhun, ei committia (sääntö 03).

## ⚠️ Poikkeus

Isompi kokonaisuus (uusi peli, pelimekaniikka, talous/balanssi, tasorakenne) tehdään
normaalilla polulla: dokumentaatio, validoinnit ja muistipankki käydään läpi – ja
**vain käyttäjän erillisestä pyynnöstä**.
