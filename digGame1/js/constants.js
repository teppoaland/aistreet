// constants.js - Pelin vakiot ja ruututyypit
const TILE = Object.freeze({
    EMPTY:    0,   // Kaivettu / tyhjä tila
    DIRT:     1,   // Maa (kaivettava)
    WALL:     2,   // Kallioseinä (tuhoutumaton)
    BOULDER:  3,   // Kivi (putoava)
    DIAMOND:  4,   // Timantti (kerättävä)
    EXIT:     5,   // Portti / maali
    PLAYER:   6,   // Pelaaja
    FIREFLY:  7,   // Tulikärpänen (vihollinen)
    BUTTERFLY:8,   // Perhonen (vihollinen)
    EXPLOSION:9,   // Räjähdys-animaatio
    SKY:     10,   // Taivas (ei voi kiivetä)
    GRASS:   11,   // Maanpinta (käveltävä, ei kaivettava)
    TREE:    12,   // Puu (putoaa, kun alta kaivetaan)
    HOUSE:   13,   // Talo (putoaa, kun alta kaivetaan)
    KEY:     14,   // Avain (kerättävä, palauttaa kadulle)
    COIN:    15,   // Kolikko (kerättävä, hiljaisesti kadulle)
});

const DIR = Object.freeze({
    UP:    { dx: 0,  dy: -1, name: 'up' },
    DOWN:  { dx: 0,  dy: 1,  name: 'down' },
    LEFT:  { dx: -1, dy: 0,  name: 'left' },
    RIGHT: { dx: 1,  dy: 0,  name: 'right' },
});

const CELL_SIZE = 32;
const FRAME_DELAY = 160; // ms per frame (pelin rytmi / painovoima)
const ENEMY_DELAY = 320; // ms vihollisen askeleiden välillä

// Maailman rakenne: yksi yhtenäinen maailma, ei erillisiä tasoja.
// Rakenne pystysuunnassa: ylhäällä taivas, sen alla maanpinta (nurmi),
// jota alaspäin maan alainen kaivettava maa ja pohjalla kallioperä.
const WORLD_ROWS  = 21;                 // rivejä yhteensä
const SKY_ROW     = 0;                  // taivas (ei voi kiivetä)
const SURFACE_ROW = 1;                  // maanpinta (käveltävä, ei kaivettava)
const BEDROCK_ROW = WORLD_ROWS - 1;     // kallioperä pohjalla
const SEGMENT_W   = 18;                 // yhden alkuperäisen tason sisäleveys
const START_PAD   = 2;                  // alkupiha (pelaajan aloitus)
const END_PAD     = 3;                  // loppupiha (maalin edusta)

// Näkymä: kamera seuraa pelaajaa vaakasuunnassa, koko korkeus näkyy.
const VIEW_COLS = 23;
const VIEW_ROWS = WORLD_ROWS;

// Pyöristetyn kaivureunan säde (px): tekee kaivamisesta "pyöreää"
// niin että raja ei ole enää suora [] vaan kaareva.
const CORNER_RADIUS = 9;

const COLORS = {
    [TILE.EMPTY]:     '#0a0a1a',
    [TILE.DIRT]:      '#6B3410',
    [TILE.WALL]:      '#555555',
    [TILE.BOULDER]:   '#888888',
    [TILE.DIAMOND]:   '#00FFFF',
    [TILE.EXIT]:      '#00FF00',
    [TILE.PLAYER]:    '#FFD700',
    [TILE.FIREFLY]:   '#FF4444',
    [TILE.BUTTERFLY]: '#FF8800',
    [TILE.EXPLOSION]: '#FFFF00',
    [TILE.SKY]:       '#7ec8e3',
    [TILE.GRASS]:     '#4a8f29',
    [TILE.TREE]:      '#2e7d32',
    [TILE.HOUSE]:     '#c96b4a',
    [TILE.KEY]:       '#FFD700',
    [TILE.COIN]:      '#FFC107',
};

const GRAVITY_DELAY = 1;  // Kehystä putoamiselle (0 = välitön)
const INITIAL_LIVES = 3;
const SCORE_DIAMOND = 10;
const SCORE_ENEMY = 25;
const SCORE_DROP = 5;       // Puun/talon pudotus monttuun
const SCORE_WORLD_BONUS = 500;
