// levels.js - Kenttämäärittelyt
// Legenda: # = seinä, . = maa, o = kivi, * = timantti, 
//          P = pelaaja, X = uloskäynti, F = tulikärpänen, B = perhonen, K = avain

const LEVEL_DATA = [];

// === Taso 1: Aloittelijan luola ===
LEVEL_DATA.push({
    name: 'Aloittelijan luola',
    diamondsNeeded: 7,    // kaikki kentän timantit (7 kpl)
    width: 20,
    height: 15,
    map: [
        '####################',
        '#....o.............#',
        '#.###....###..###..#',
        '#.#  #..*#  ## o#..#',
        '#.# o.....#...# P..#',
        '#.#######...##.##..#',
        '#......o..*...o...#',
        '#.######.####.###..#',
        '#.#    .*.. .*   .##',
        '#.# o..####.##...o.#',
        '#.##.......C...###..#',
        '#....**...........X#',
        '#.#######.#######.##',
        '#....o.*.....#o....#',
        '####################',
    ],
});

// === Taso 2: Kivivyöry ===
LEVEL_DATA.push({
    name: 'Kivivyöry',
    diamondsNeeded: 8,
    width: 20,
    height: 15,
    map: [
        '####################',
        '#P  o   o   o     #',
        '####.####.####.#### #',
        '#  *   *   *   *  #',
        '# ####.####.####.###',
        '# o   o   o   o   #',
        '#.####.####.####.###',
        '#   *   * C *   * #',
        '###.####.####.#### #',
        '#  o   o   o   o  #',
        '#.####.####.####.###',
        '#*   *  B*   *   *#',
        '# ####.####.####.##',
        '#   o   o   o    X#',
        '####################',
    ],
});

// === Taso 3: Tulikärpästen pesä ===
LEVEL_DATA.push({
    name: 'Tulikärpästen pesä',
    diamondsNeeded: 6,
    width: 20,
    height: 15,
    map: [
        '####################',
        '#P ..........o.....#',
        '##.#####.######.##.#',
        '#..*...#..C...#..#.#',
        '#.##.#.#.####.#..#.#',
        '#.#  #.#.#  #.#..#.#',
        '#.# .*..#.#  #.*#..#',
        '#.# ####.#.##.#..#.#',
        '#.#       .*  .*..#',
        '#.# ######.##.##..##',
        '#.#     F#..........',
        '#.# #####.#####.###.',
        '#.*.....o.......K....',
        '#.#####.#####.#####X#',
        '####################',
    ],
});

// === Taso 4: Timanttikaivos ===
LEVEL_DATA.push({
    name: 'Timanttikaivos',
    diamondsNeeded: 9,
    width: 20,
    height: 15,
    map: [
        '####################',
        '#P  o   *  B o    #',
        '##.##.##.##.##.##.##',
        '#*   o   *   o   *#',
        '#.##.##.##.##.##.##',
        '#  o   * C o   *  #',
        '##.##.##.##.##.##.##',
        '#*   o   F   o   *#',
        '#.##.##.##.##.##.##',
        '#  o   K   o   *  #',
        '##.##.##.##.##.##.##',
        '#*   o   *   o   *#',
        '#.##.##.##.##.##.##',
        '#  *   o   *   o X#',
        '####################',
    ],
});

// Parsitaan kentät sisäisiksi taulukoiksi
function parseLevel(levelData) {
    const grid = [];
    let playerX = 0, playerY = 0;
    
    for (let y = 0; y < levelData.height; y++) {
        grid[y] = [];
        const row = levelData.map[y] || '';
        for (let x = 0; x < levelData.width; x++) {
            const ch = x < row.length ? row[x] : ' ';
            switch (ch) {
                case '#': grid[y][x] = TILE.WALL; break;
                case '.': grid[y][x] = TILE.DIRT; break;
                case 'o': grid[y][x] = TILE.BOULDER; break;
                case '*': grid[y][x] = TILE.DIAMOND; break;
                case 'P': 
                    grid[y][x] = TILE.EMPTY;
                    playerX = x;
                    playerY = y;
                    break;
                case 'X': grid[y][x] = TILE.EXIT; break;
                case 'F': grid[y][x] = TILE.FIREFLY; break;
                case 'B': grid[y][x] = TILE.BUTTERFLY; break;
                case 'K': grid[y][x] = TILE.KEY; break;
                case 'C': grid[y][x] = TILE.COIN; break;
                default:  grid[y][x] = TILE.EMPTY; break;
            }
        }
    }
    
    return {
        grid: grid,
        playerStartX: playerX,
        playerStartY: playerY,
        width: levelData.width,
        height: levelData.height,
        name: levelData.name,
        diamondsNeeded: levelData.diamondsNeeded,
    };
}
