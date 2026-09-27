# Muutoshistoria

## 2026-09-10 – Pääportaalin rakennus, versio 0.1.0

### Luotu
- `index.html` – Pääportaali (CRT-retro-teema, iframe-overlay, D-pad)
- `style.css` – Tyylit (CRT-scanline, mobiiliohjaimet, reset-nappi)
- `street.js` – "Pimeä Katu" -peli: 9 taloa, 5 lamppua, hahmo + potku-animaatio, kolikko
- `gameState.js` – localStorage-pohjainen tilanhallinta
- `.gitignore` – Versionhallinnan ignooraukset
- `PROJECT.md`, `README.md`, `CHANGELOG.md`, `docs/plan.md`

### Muutettu
- `digGame1/.git` ja `digGame2/.git` **poistettu** → yksi yhteinen git juureen
- `digGame1/MEMO.md` → `docs/dig-game-memo.md`
- `digGame2/MEMO.md` → `docs/bd-memo.md`
- `digGame1/JATKOKEHITYS.md` → `docs/dig-game-roadmap.md`

### Poistettu
- `digGame1/.gitignore`, `digGame1/build_single.js`, `digGame1/git_backup.ps1`
- `digGame2/.gitignore`, `digGame2/build_single.js`, `digGame2/git_backup.ps1`

### Bugikorjaukset (street.js)
1. Lamppujen varret piirretään nyt oikein (puinen tolppa, kupu, valokeila)
2. Potku ei enää laukea oven kohdalla – ovesta kävellään sisään ilman potkua
3. Ovidialogi tulee vain oven edessä, ei kaukana
4. Tyhjään potkaiseminen ei näytä ilmoitusta
5. Potku-animaatio: jalka heilahtaa `sin(π·t)`-kaarella ~170ms
6. Iframe-pelit eivät enää jää jumiin aloitusdialogiin (overlay näytetään ennen iframen latausta)
7. Pelaajalle lisättiin lippis, jonka lippa osoittaa kulkusuuntaan
8. Reset-nappi (✕) oikeassa yläkulmassa: tyhjentää localStorage + reload

### Pelaaja-animaatiot
- Kävelyanimaatio (4 frameä)
- Potku-animaatio (jalka heilahtaa eteen + kenkä irtoaa)
- Lippis kulkusuunnan mukaan