// constants.js - Pelin vakiot ja ruututyypit
const TILE = Object.freeze({
    EMPTY:   0,   // Tyhjä tila
    DIRT:    1,   // Maa (kaivettava)
    WALL:    2,   // Seinä (tuhoutumaton)
    BOULDER: 3,   // Kivi (putoava)
    DIAMOND: 4,   // Timantti (kerättävä)
    EXIT:    5,   // Uloskäynti (lukossa, aukeaa timanteilla)
    PLAYER:  6,   // Pelaaja
    FIREFLY: 7,   // Tulikärpänen (vihollinen, liikkuu seinien vierustaa)
    BUTTERFLY:8,  // Perhonen (vihollinen, liikkuu spiraalina)
    EXPLOSION:9,  // Räjähdys-animaatio
    KEY:     10,  // Avain (kerättävä, avaa uloskäynnin)
    COIN:    11,  // Kolikko (kerättävä, hiljaisesti kadulle)
});

const DIR = Object.freeze({
    UP:    { dx: 0,  dy: -1, name: 'up' },
    DOWN:  { dx: 0,  dy: 1,  name: 'down' },
    LEFT:  { dx: -1, dy: 0,  name: 'left' },
    RIGHT: { dx: 1,  dy: 0,  name: 'right' },
});

const CELL_SIZE = 32;
const FRAME_DELAY = 160; // ms per frame (pelin rytmi / painovoima)
const ENEMY_DELAY = 320; // ms vihollisen askeleiden välillä (pelaaja on nopeampi)

const COLORS = {
    [TILE.EMPTY]:     '#1a1a2e',
    [TILE.DIRT]:      '#8B4513',
    [TILE.WALL]:      '#555555',
    [TILE.BOULDER]:   '#888888',
    [TILE.DIAMOND]:   '#00FFFF',
    [TILE.EXIT]:      '#00FF00',
    [TILE.PLAYER]:    '#FFD700',
    [TILE.FIREFLY]:   '#FF4444',
    [TILE.BUTTERFLY]: '#FF8800',
    [TILE.EXPLOSION]: '#FFFF00',
    [TILE.KEY]:       '#FFAA00',
    [TILE.COIN]:      '#FFC107',
};

const GRAVITY_DELAY = 1;  // Kehystä putoamiselle (0 = välitön)
const MAX_LEVELS = 4;
const INITIAL_LIVES = 3;
const SCORE_BOULDER_FALL = 1;
const SCORE_DIAMOND = 10;
const SCORE_ENEMY = 25;
const SCORE_LEVEL_BONUS = 50;
const SCORE_KEY = 50;
