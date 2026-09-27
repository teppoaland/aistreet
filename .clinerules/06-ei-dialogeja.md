# 🚫 EI YLIMÄÄRÄISIÄ DIALOGEJA – KYSY ENSIN

> **TILA: VOIMASSA 23.9.2026 (käyttäjän eksplisiittinen linjaus).** Tämä on tavallisia sääntöjä
> tiukempi: tässä kielletään **uuden käyttäjälle näkyvän viestin/dialogin lisääminen** ilman lupaa.

---

## ⚠️⚠️⚠️ ISO VAROITUS ⚠️⚠️⚠️

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ÄLÄ LISÄÄ YHTÄÄN UUTTA DIALOGIA / POPUPIA / ILMOITUSTEKSTIÄ ILMAN,         ║
║  ETTÄ KYSYT KÄYTTÄJÄLTÄ ENSIN.                                              ║
║                                                                             ║
║  Pelaajan pitää ITSE käsittää pelistä, mitä tapahtuu – ei sitä tarvitse      ║
║  selittää tekstillä. Esim. kun rosvo nappaa pelaajan, se vie hampurilaisen   ║
║  ja rahat: siitä EI laiteta mitään "Rosvo vei N kolikkoa!" -ilmoitusta.      ║
║  Pelaaja näkee itse, että rahat ja 🍔 vähenivät.                            ║
║                                                                             ║
║  Kielletty ilman lupaa: uudet `showNotification(...)`-kutsut, uudet popup-   ║
║  tekstit, uudet varoitus-/selitysviestit, uudet dialogi-ikkunat.            ║
║  Poikkeus: olemassa olevien viestien korjaus/käännös on ok, mutta uuden     ║
║  viestin lisääminen EI – kysy ensin.                                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 📋 Säännöt

1. **Älä lisää uusia dialogeja.** Uusi `showNotification()`, popup, varoitusrivi tai
   dialogi-ikkuna vaatii **aina käyttäjän erillisen, nimenomaisen pyynnön**.
2. **Anna pelin kertoa itse.** Muutokset näkyvät pelaajalle **visuaalisesti ja toiminnallisesti**
   (animaatiot, partikkelit, äänet, HUD-luvut, esineiden katoaminen) – ei selittävää tekstiä.
3. **Poikkeukset (sallittuja ilman erillistä lupaa):**
   - olemassa olevan viestin tekstin/värin/keston korjaus (ei uusi viesti),
   - pelin sisäiset **pakolliset** tilaviestit, jotka olivat jo olemassa (esim. `CLOSED_SIGN`,
     avainportin popup, oviukon "Pimeää / Ovi on lukossa") – **näitä ei poisteta eikä niihin
     lisätä uusia**,
   - testi-/debug-tekstit (`?debug`, cheat-nupit).
4. **Kun lisäät mitään käyttäjälle näkyvää tekstiä, kysy ensin.** Epäselvässä tilanteessa:
   älä lisää – kysy.

---

## 🔗 Liittyvät säännöt

- Sääntö **02** (pelilogiikan säännöt) – pelimekaniikat ja niiden "älä riko" -lista.
- Sääntö **04** (talousbalanssi) – esim. rosvo (v4.68) vie rahat **ilman** ilmoitusta.
