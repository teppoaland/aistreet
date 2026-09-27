# 🌀 AI CHAOS STREET

**Retrohenkinen HTML5 Canvas -peliportaali**, jossa meta-peli "AI CHAOS STREET" toimii
pelivalikkona. Alussa valitaan kaaostaso (NORMAL / MILD / GOOD / BAD / FULL CHAOS), jonka
jälkeen peli arpoo session valitun tason asetuksilla. Sisältää useita alapelejä iframe-pohjaisesti.

## 🎮 Päävalikko: AI CHAOS STREET (`street.js`)

2D-sivukuvattu pimeä kaupunkikatu. Pelaaja liikkuu nuolilla, potkii katulamppuja
syttyäkseen ja astuu talojen oviin päästäkseen alapeleihin.

| Ominaisuus | Kuvaus |
|---|---|
| 🌀 Kaaoshubi | Alkunäkymä: NORMAL / MILD / GOOD / BAD / FULL CHAOS – valitse, niin peli arpoo session asetukset |
| Hahmon ohjaus | Nuolinäppäimet / WASD + mobiilin D-pad |
| Toiminto | Välilyönti = potku (missä vain) / ovesta sisään |
| Lamput | 5 kpl talojen väleissä – potkaise sytyttääksesi |
| Ovet | 9 taloa: alapelit + huoneet (BAR, jukebox, makuuhuone, sanomalehti) |
| Jukebox | **Talo 5**: 1 kolikko = koko kappale. [Memo →](docs/jukebox-memo.md) |
| Kolikko | Kadulta kerättävä → `inventory.coin` |
| 🍔 Hampurilaiset | Elämät – BAR:ssa 1 🪙 = 1 🍔, nukkumalla +1 🍔 |
| Päivä/yö + sää | Auringon/kuun kierto, tuuli, pilvet, tähdet, eläimet, liikenne |
| Reset | ✕-nappi oikealla ylhäällä → tyhjentää localStorage |
| Tilanhallinta | `localStorage`: lamput + inventory + saldo säilyy F5:n yli |

## 🧩 Alapelit

### ⛏️ Dig Game (`digGame1/`)
Yksi yhtenäinen maailma, ei tasoja. Pelaaja kaivaa maan alta, pudottaa puita ja taloja,
kerää timantteja. Leveys ~77 ruutua. [Lisätiedot →](docs/dig-game-memo.md)

### 💎 Dig Däsh (`digGame2/`)
Klassinen 4 tason Dig Däsh -tyylinen timanttienkeruupeli aikarajalla.
[Lisätiedot →](docs/bd-memo.md)

### ✈️ Blue Mäx (`bm/`) – pelattava (TESTIMODE)
Isometrinen lentely- ja pommituspeli.
[Lisätiedot →](docs/bm.md)

## 📁 Projektin rakenne

```
D:\AI\AI_street\
├── index.html            Pääportaali (AI CHAOS STREET + kaaoshubi)
├── style.css             CRT-retro-teema + responsiivisuus
├── street.js             "AI CHAOS STREET" -päävalikkopeli
├── gameState.js          localStorage-tilanhallinta
├── audio.js              Taustamusiikki (proseduraalinen syntikka)
├── .clinerules/          Cline-säännöt (01–06)
├── memory-bank/          Istuntojen välinen muisti
├── .gitignore            Versionhallinnan ignooraukset
├── PROJECT.md            Tämä tiedosto
├── CHANGELOG.md          Muutoshistoria
├── README.md             Pikaohje kehittäjälle
│
├── digGame1/             ⛏️ Dig Game
├── digGame2/             💎 Dig Däsh
├── bm/                   ✈️ Blue Mäx
├── fruitgame/            🍒 Hedelmäpeli
├── sinkship/             🚢 Laivanupotus
├── jukebox/              🎵 9 raitaa + kansikuvat
├── assets/               Kuvat (justiina.png)
├── entrance/             Varakansio
├── wormgame/             (kesken)
│
└── docs/
    ├── chaos.md            Kaaosjärjestelmän suunnitelma
    ├── plan.md             Alkuperäinen arkkitehtuurisuunnitelma
    ├── dig-game-memo.md    Dig Game -muistio
    ├── dig-game-roadmap.md Dig Game -kehityssuunnitelma
    ├── bd-memo.md          Dig Däsh -muistio
    ├── bm.md               Blue Mäx -muistio
    └── economy-balance-memo.md Talousbalanssimemo
```

## 🔧 Tekninen toteutus

- **Puhdas JavaScript** – ei ulkoisia kirjastoja, ei build-työkaluja
- **Canvas-pohjainen** renderöinti (`street.js` käyttää `<canvas>`-elementtiä)
- **iframe-integraatio** – alapelit ladataan iframe-overlayhin
- **localStorage** – pelitila säilyy selainistuntojen yli (`pimeakatu_gamestate`)
- **CRT Scanline** CSS-efekti retro-tunnelmaa varten
- **Jukebox** – `jukebox/`-kansio: 9 koko kappaletta, soitetaan talosta 5 (1 kolikko / kappale)
- **Mobiilituki** – D-pad + toimintanappi, `touch-action: none`
- **Responsiivinen** – canvas skaalautuu näytön kokoon

## 🚀 Käynnistys

Avaa `index.html` selaimessa. Ei vaadi palvelinta – toimii suoraan tiedostosta.

## 🧪 Tilan nollaus

Klikkaa oikean yläkulman **✕**-nappia → vahvista → localStorage tyhjennetään ja sivu latautuu uudelleen.