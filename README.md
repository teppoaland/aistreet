# 🏮 Pimeä Katu – Pikaohje

## Avaaminen
Avaa `index.html` selaimessa. Ei palvelinta – toimii `file:///` -protokollalla.

## Ohjaimet

| Näppäin | Toiminto |
|---|---|
| ⬆⬇⬅➡ / WASD | Liiku kadulla |
| Välilyönti | **Oven edessä** = astu sisään / **Muualla** = potku (lamppuun osuessa sytyttää) |
| R | - |
| ✕ (oikea yläkulma) | Nollaa koko peli (localStorage tyhjäksi) |

## Kehitys

```
index.html          → avaa selaimessa testataksesi
street.js           → päävalikon logiikka (muokkaus täällä)
style.css           → ulkoasu (CRT-efekti, värit, fontit)
gameState.js        → tallennus (localStorage-rakenne)
digGame1/           → ⛏️ Dig Game (kaivuripeli)
digGame2/           → 💎 Dig Däsh (timanttipeli)
docs/               → dokumentaatio ja suunnitelmat
```

## Git

Projekti käyttää **lokaalia git-versionhallintaa**. Ei etärepositoriota.

```bash
git init                  # alusta (jos ei vielä tehty)
git add .
git commit -m "viesti"
```

## Alapelien buildaus

Alapelit (`digGame1/`, `digGame2/`, `bm/`) käyttävät
`game_main.html`-kehitysversiota suoraan iframe-integraatiossa. Erillistä buildausta
yhteen tiedostoon ei enää tarvita – kehitys on suoraviivaisempaa ja kaikki tiedostot
ovat aina ajan tasalla.

## Tiedostot joita ei versionhallita

- `node_modules/` – ei käytössä
- IDE-asetukset (`.vscode/`, `.idea/`)
- Käyttöjärjestelmän roskat (`.DS_Store`, `Thumbs.db`)
- Väliaikaiset tiedostot (`tmp/`, `*.log`)

## Tekijänoikeudet / Copyright

**Copyright (c) 2024–2026 Teppo Ålander. Kaikki oikeudet pidätetään.**

Peli kokonaisuudessaan (lähdekoodi, grafiikka, äänet ja musiikki) on tekijänsä
omaisuutta. Sitä **ei saa** kopioida, muokata, julkaista uudelleen, levittää eikä
käyttää omissa projekteissa tai kaupallisesti ilman tekijän kirjallista lupaa.
Tarkemmat ehdot: [`LICENSE`](LICENSE).

`jukebox/`-kansion kappaleet 1–3 ovat tekijän omia teoksia (Knived, 2013).
Kaikki oikeudet pidätetään.
`jukebox/`-kansion kappaleet 4–6 ovat kolmannen osapuolen ilmaisia
(royalty-free) raitoja (Alec Koff, MrClaps) – ks. [`LICENSE`](LICENSE).
`assets/justiina.png` on BAR-huoneen seinätaulun kuva-aineisto.