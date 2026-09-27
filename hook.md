# Hook-sääntö: Kontekstin token-raja + Memory Bank

## Token-raja
Kun keskustelun konteksti ylittää **60 000 tokenia**, aloita aina **uusi keskustelu** (uusi "taxi").

### Jousto
- Älä katkaise kesken meneillään olevaa tehtävää (taskia).
- Vie nykyinen tehtävä loppuun, ja aloita uusi keskustelu vasta kun se on valmis.
- Jos tokenit nousevat yli 60k mutta tehtävä on kesken, anna varoitus ja jatka loppuun.

### Miksi
- Tokenien säästäminen → edullisempi käyttö
- Pienempi konteksti → nopeammat vastaukset
- Selkeämpi fokus per keskustelu

---

## 🧠 Memory Bank – Istuntojen välinen muisti

### Lopetusvaihe (~60k tokenia)
Sano Cline:lle:
```
Update memory bank
```
→ Cline päivittää `memory-bank/activeContext.md` ja tallentaa nykyisen tilan.

### Uusi istunto
Aloita sanomalla:
```
Read memory bank and continue
```
→ Cline lukee `memory-bank/activeContext.md` ja jatkaa siitä mihin jäit.

### Alataskit
Kun annat uuden alataskin:
```
Jatka: [tehtävän kuvaus lyhyesti]
```
→ Cline tietää projektin rakenteen `.clinerules/`-sääntöjen kautta, ei tarvitse selittää uudelleen.

---

## Hakemistorakenne
```
D:\AI\Main\
├── .clinerules/         ← Säännöt (luetaan automaattisesti)
│   ├── 01-general-architecture.md
│   └── 02-game-core.md
├── memory-bank/         ← Istuntojen välinen muisti
│   ├── activeContext.md  ← Mitä juuri nyt tehdään
│   ├── systemPatterns.md ← Arkkitehtuuri, älä riko
│   └── progress.md       ← Mitä valmiina, mitä tekemättä
├── .clineignore         ← Tiedostot joita Cline ei lue
└── hook.md              ← Tämä tiedosto (token-raja + työnkulku)
```

## Käyttöönotto
Tämä tiedosto luetaan jokaisen uuden keskustelun alussa automaattisesti.