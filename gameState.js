/* ═══════════════════════════════════════════════════════════
   gameState.js – AI CHAOS STREET -peliportaalin tilanhallinta
   
   Käyttää localStoragea pelitilan tallentamiseen.
   ═══════════════════════════════════════════════════════════ */

const GameState = (() => {
    const STORAGE_KEY = 'pimeakatu_gamestate';

    // Oletustila
    const defaultState = {
        litLamps: [false, false, false, false, false],
        inventory: {
            coin: false,
            // Syntymäpaketti: uusi peli (tai reset) alkaa 2 kolikolla
            // – sama ajatus kuin 5 hampurilaisessa. Tallennettu tila voittaa
            // aina tämän (esim. 0 kolikkoa pysyy 0:na, ei ilmaista rahaa).
            coinCount: 2,
            hamburgerCount: 5
        },
        // Onko Dig Game -pelin avain kerätty (avaa Dig Däshin)
        digKeyCollected: false,
        boulderKeyCollected: false,
        bmKeyCollected: false,
        // Päivä/yö-tila (v4.33). Kadun makuuhuoneen Nuku-valinta vaihtaa tämän.
        //   null  = ei vielä ratkaistu → 3 avainta nostaa päivän kerran (v4.32-käytös)
        //   true  = päivä
        //   false = yö
        // Testityökalut ?day=0 / ?day=1 eivät tallenna tätä.
        isDay: null,
        // Dig Däsh -tason 5 custom-kartta (tyhjä oletus)
        customLevel5: null
    };

    /** Lataa tila localStoragesta */
    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(defaultState));
            const saved = JSON.parse(raw);
            // Mergaa oletustilan kanssa, jotta uudet kentät tulevat mukaan
            return deepMerge(JSON.parse(JSON.stringify(defaultState)), saved);
        } catch (e) {
            console.warn('GameState load failed:', e);
            return JSON.parse(JSON.stringify(defaultState));
        }
    }

    /** Tallenna tila localStorageen */
    function save(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('GameState save failed:', e);
        }
    }

    /** Nollaa tila oletukseen */
    function reset() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.warn('GameState reset failed:', e);
        }
        return JSON.parse(JSON.stringify(defaultState));
    }

    /** Syväkopio + merge (oletus + tallennettu) */
    function deepMerge(base, overlay) {
        for (const key in overlay) {
            if (Object.prototype.hasOwnProperty.call(overlay, key)) {
                if (overlay[key] && typeof overlay[key] === 'object' && !Array.isArray(overlay[key])) {
                    if (!base[key]) base[key] = {};
                    deepMerge(base[key], overlay[key]);
                } else {
                    base[key] = overlay[key];
                }
            }
        }
        return base;
    }

    /** Tarkista onko kaikki lamput sytytetty */
    function allLampsLit(state) {
        return state.litLamps.every(lit => lit === true);
    }

    /** Tarkista onko vähintään yksi lamppu sytytetty */
    function anyLampLit(state) {
        return state.litLamps.some(lit => lit === true);
    }

    return {
        STORAGE_KEY,
        defaultState,
        load,
        save,
        reset,
        allLampsLit,
        anyLampLit
    };
})();