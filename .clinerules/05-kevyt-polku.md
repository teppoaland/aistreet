# 🪶 Kevyt polku – milloin työ tehdään kevyesti

> **Tarkoitus:** Estää turha työ. Käyttäjä testaa itse, eikä yhden näkymän/staattisen
> asian muutos vaadi koko koodin läpikäyntiä, testejä eikä dokumentointia.
> **Käyttäjän linjaus 20.9.2026:** *"itse hoidan testauksen ja koko koodia EI tarvi käydä
> läpi/testata jos muokataan vain yhtä staattista näkymää => asetetaan kuva."*

---

## 🧪 Testaus kuuluu käyttäjälle

- **Oletus: käyttäjä testaa itse** (selain, silmä, oma maku).
- Cline **ei** aja testejä, simulaatioita eikä regressioita **eikä kirjoita testiskriptejä**
  ilman erillistä, nimenomaista pyyntöä (esim. "aja testit", "validoi tämä", "tee testi").
- Olemassa olevia testiskriptejä (`%TEMP%\*.cjs`) ei ajeta varmuuden vuoksi.

## 🎯 Milloin riittää yhden kohdan muutos (kevyt polku)

Kun pyyntö koskee **yhtä näkymää tai staattista asiaa** (kuva, väri, teksti, koko,
sijainti, kehykset, fontti, ääni), Cline:

1. lukee **vain** sen tiedoston/funktion, jota muutos koskee,
2. tekee muutoksen sinne – ei refaktoroi eikä siirrä koodia muualle,
3. **ei** lue `docs/`- eikä muistipankkitiedostoja läpi,
4. **ei** kartoita koodikantaa (grep/haut) "varmuuden vuoksi",
5. **ei** aja testejä eikä tee testiskriptejä,
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
