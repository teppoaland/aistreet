=========================================================================
    DIG DÄSH: BUILDAUS POIS - Toimenpidelista (seuraava sessio)
=========================================================================

Tausta: digGame2/-kansiossa on viela buildattu boulder_dash.html ja
portaali kayttaa sita (street.js rivi 48).

VAIHEET:

1. VERTAILE boulder_dash.html vs js/game.js - onko eroja?
   - BOULDER_KEY_COLLECTED postMessage (molemmissa on, varmista synkassa)
   - collectKey() ja completeLevel() -metodit

2. MUUTA street.js rivi 48:
   gameUrl: 'digGame2/boulder_dash.html' -> 'digGame2/game_main.html'

3. MUUTA street.js rivi 523:
   lamp.gameUrl.includes('boulder_dash') -> lamp.gameUrl.includes('digGame2')

4. POISTA digGame2/boulder_dash.html

5. PAIVITA dokumentaatio:
   - .clinerules/02-game-core.md rivi 41 -> poista boulder_dash.html
   - .clinerules/03-versioning.md rivi 32 -> poista viittaus
   - PROJECT.md rivi 58 -> digGame2/ vain game_main.html
   - docs/bd-memo.md -> poista buildaus-osio
   - memory-bank/activeContext.md + progress.md -> paivita

6. VERSIONOSTO: index.html #version-tag -> +0.1 (v3.18 -> v3.19)
=========================================================================
