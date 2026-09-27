# Jatkokehitysideat

## ✅ Jo tehty (optio A)

- [x] Sileä Lerp-liike pelaajalle ja kameralle (30%/frame)
- [x] Massiivinen partikkelijärjestelmä (60 jyvää/kaivu, törmäystarkistus maahan)
- [x] iOS-kosketustapahtumakorjaukset (confirmAction, touchend-bugi, äänimoottorin herätys)
- [x] Git-versionhallinta (kaksi committia: ennen/jälkeen muutosten)

---

## 🔜 Seuraavat lyhyen tähtäimen ideat

- [ ] DeltaTime-pohjainen lerp (ProMotion-iPhoneille tasaiseksi, ei frame-sidonnainen)
- [ ] Tasojärjestelmä (useampi taso + valikko — `levels.js` ja `buildWorld()` tukevat jo)
- [ ] 2×–4× tarkempi ruudukko (16px/8px solut) + jatkuva liike
- [ ] "Valuva multa" (putImageData + Falling Sand -simulaatio logiikkaruudukon päällä)

---

## 🖥️ HTML-peli → Oikea PC-peli

### Reitti 1: "Pikavoitto" – Tauri / Electron -wrappaus

Kääri nykyinen `dig_game.html` natiiviksi Windows/Mac/Linux `.exe`-sovellukseksi.

**Miten:**
1. `npm create tauri-app` projektikansioon
2. Aseta `dig_game.html` päänäkymäksi
3. Paketoi → itsenäinen ikkunallinen sovellus

**Hyödyt:**
- Valmis minuuteissa, ei koodimuutoksia peliin
- Toimii omassa ikkunassa ilman selainta
- Voi jakaa `.exe`-tiedostona (esim. Steam)

**Rajoitteet:**
- Pysyy silti selainpohjaisena; ei "oikeaa" pelimoottoria
- Suorituskyky = selaimen rajat

---

### Reitti 2: Godot Engine – AI-agentille optimaalinen

Godot tallentaa **kaiken puhtaana tekstinä** (`.tscn`, `.gd`), toisin kuin Unity/Unreal (binääriä). Tämä tekee siitä ylivoimaisen Cline/Claude-työnkulkuun:

| Godot | Unity / Unreal |
|---|---|
| Skenet `.tscn`-tekstitiedostoina | Scene-tiedostot binääriä tai YAML-sotkua |
| Cline voi lukea ja muokata suoraan | Cline on sokea scene-tiedostoille |
| `.gd`-skriptit = puhdas GDScript | C#-skriptit, rajapinta mutkikkaampi |

**Työnkulku:**
1. Sinä: Rakenna kenttä Godotin graafisella editorilla (TileMap, pelaajan sijainti)
2. Cline: Liitetty VS Codeen → kirjoita pelilogiikka `.gd`-tiedostoihin
3. Paina Play Godotissa → testaa heti

**Hyödyt:**
- Oikea pelimoottori, ei selainpohjainen
- Fysiikka, äänet, partikkelit — kaikki sisäänrakennettuna
- Vie suoraan Windows/Mac/Linux/Android/iOS/Web

**Rajoitteet:**
- Aloitus vaatii pelin uudelleenrakennuksen
- Enemmän opettelua kuin Tauri-reitti

---

## 🧠 Muita muistiinpanoja

- **Git-pinnaus**: aina `git commit` ennen isoa muutosta — sama periaate kuin avoimen mallin painojen jäädyttäminen
- **Build-skripti**: `node build_single.js` kokoaa lähdetiedostot yhdeksi `dig_game.html`:ksi
- **Partikkelien frame-riippuvuus**: lerp-kertoimet olettavat ~60 FPS; DeltaTime-pohjaisuus poistaisi tämän

---

_Päivitetty: 17.8.2026_