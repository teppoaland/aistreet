// levels.js - Yhtenäisen maailman rakentaja.
// Alkuperäiset 4 tasoa yhdistetään peräkkäin yhdeksi pitkäksi maailmaksi,
// jota kuljetaan vasemmalta oikealle. Maailman yläosa on maanpinta
// (puita ja taloja), alaosa maan alainen kaivettava maa.
//
// Segmenttien legenda: # = seinä, . = maa, ' ' = tyhjä, o = kivi,
//                      * = timantti, P = pelaaja, X = uloskäynti,
//                      F = tulikärpänen, B = perhonen

const SEGMENTS = [];

// === Osa 1: Aloittelijan luola ===
SEGMENTS.push([
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
    '#.##..........###..#',
    '#....**...........X#',
    '#.#######.#######.##',
    '#....o.*.....#o....#',
    '####################',
]);

// === Osa 2: Kivivyöry ===
SEGMENTS.push([
    '####################',
    '#P  o   o   o     #',
    '####.####.####.#### #',
    '#  *   *   *   *  #',
    '# ####.####.####.###',
    '# o   o   o   o   #',
    '#.####.####.####.###',
    '#   *   *   *   * #',
    '###.####.####.#### #',
    '#  o   o   o   o  #',
    '#.####.####.####.###',
    '#*   *  B*   *   *#',
    '# ####.####.####.##',
    '#   o   o   o    X#',
    '####################',
]);

// === Osa 3: Tulikärpästen pesä ===
SEGMENTS.push([
    '####################',
    '#P ..........o.....#',
    '##.#####.######.##.#',
    '#..*...#......#..#.#',
    '#.##.#.#.####.#..#.#',
    '#.#  #.#.#  #.#..#.#',
    '#.# .*..#.#  #.*#..#',
    '#.# ####.#.##.#..#.#',
    '#.#       .*  .*..#',
    '#.# ######.##.##..##',
    '#.#     F#..........',
    '#.# #####.#####.###.',
    '#.*.....o............',
    '#.#####.#####.#####X#',
    '####################',
]);

// === Osa 4: Timanttikaivos ===
SEGMENTS.push([
    '####################',
    '#P  o   *  B o    #',
    '##.##.##.##.##.##.##',
    '#*   o   *   o   *#',
    '#.##.##.##.##.##.##',
    '#  o   *   o   *  #',
    '##.##.##.##.##.##.##',
    '#*   o   F   o   *#',
    '#.##.##.##.##.##.##',
    '#  o   *   o   *  #',
    '##.##.##.##.##.##.##',
    '#*   o   *   o   *#',
    '#.##.##.##.##.##.##',
    '#  *   o   *   o X#',
    '####################',
]);

// Merkki -> ruututyyppi (reunukset on jo poistettu)
function charToTile(ch) {
    switch (ch) {
        case '#': return TILE.WALL;
        case '.': return TILE.DIRT;
        case 'o': return TILE.BOULDER;
        case '*': return TILE.DIAMOND;
        case 'F': return TILE.FIREFLY;
        case 'B': return TILE.BUTTERFLY;
        case 'P': return TILE.EMPTY;   // vanha aloituspiste -> ilmatasku
        case 'X': return TILE.EMPTY;   // vanha uloskäynti -> ei enää avainta (vain yksi kentän lopussa)
        default:  return TILE.EMPTY;   // ' ' -> tyhjä luolatila
    }
}

// Rakentaa yhtenäisen maailman: palauttaa gridin ja metatiedot.
function buildWorld() {
    const segCount = SEGMENTS.length;
    const width  = START_PAD + segCount * SEGMENT_W + END_PAD;
    const height = WORLD_ROWS;

    // Täytetään ensin kaikki maalla
    const grid = [];
    for (let y = 0; y < height; y++) {
        grid[y] = [];
        for (let x = 0; x < width; x++) grid[y][x] = TILE.DIRT;
    }

    // Taivas, maanpinta ja kallioperä
    for (let x = 0; x < width; x++) {
        grid[SKY_ROW][x] = TILE.SKY;
        grid[SURFACE_ROW][x] = TILE.GRASS;
        grid[BEDROCK_ROW][x] = TILE.WALL;
    }

    // Kopioi alkuperäiset segmentit maan alle (peräkkäin)
    const segTop  = SURFACE_ROW + 1; // rivi 2
    const segRows = 13;              // sisältö ilman ylä- ja alariviä
    for (let s = 0; s < segCount; s++) {
        const map = SEGMENTS[s];
        const offX = START_PAD + s * SEGMENT_W;
        for (let y = 0; y < segRows; y++) {
            const srcRow = map[y + 1] || '';
            for (let x = 0; x < SEGMENT_W; x++) {
                grid[segTop + y][offX + x] = charToTile(srcRow[x + 1]);
            }
        }
    }

    // Syvempi kerros (segmenttien alle): ripottele kiviä ja timantteja
    for (let x = 2; x < width - 2; x++) {
        for (let y = segTop + segRows; y < BEDROCK_ROW; y++) {
            const r = (x * 7 + y * 13) % 17;
            if (r === 0) grid[y][x] = TILE.BOULDER;
            else if (r === 1) grid[y][x] = TILE.DIAMOND;
        }
    }

    // === Pulma (entinen "taso 3"): tiputa puu ja talo monttuun ===
    // Pinnalla on puu ja talo, joiden ohi ei pääse. Niiden alta pitää
    // kaivaa maa pois, jolloin ne putoavat monttuun ja pinta aukeaa.
    // Maan alta pulman ohi ei pääse (kallioseinä), joten on noustava pinnalle.
    const pzX    = START_PAD + 2 * SEGMENT_W;   // pulma-alueen alku (osa 3)
    const treeX  = pzX + 4;
    const houseX = pzX + 6;

    // Tyhjennä pulma-alueen maanalainen osa puhtaaksi maaksi
    for (let y = segTop; y < BEDROCK_ROW; y++) {
        for (let x = pzX; x <= pzX + 7; x++) {
            grid[y][x] = TILE.DIRT;
        }
    }

    // Puu ja talo pinnalle
    grid[SURFACE_ROW][treeX]  = TILE.TREE;
    grid[SURFACE_ROW][houseX] = TILE.HOUSE;

    // Tuki puun ja talon alla (rivi 2). Väliin jää aukko,
    // josta tukea voi kaivaa sivusta käsin (turvallisesti).
    grid[segTop][treeX]  = TILE.DIRT;
    grid[segTop][houseX] = TILE.DIRT;
    grid[segTop][treeX + 1] = TILE.EMPTY;

    // Monttu (kuoppa) puun ja talon alle
    for (let y = segTop + 1; y < BEDROCK_ROW; y++) {
        for (let x = treeX; x <= houseX; x++) {
            grid[y][x] = TILE.EMPTY;
        }
    }

    // Kallioseinä maan alla pulman oikealla puolella:
    // maan alta ei pääse ohi, vaan on noustava pinnalle ja pudotettava
    // puu + talo, jotta pinnalla pääsee jatkamaan vasemmalta oikealle.
    const wallX = pzX + 7;
    for (let y = segTop; y < BEDROCK_ROW; y++) {
        grid[y][wallX] = TILE.WALL;
    }

    // === Koristepuita ja -taloja pinnalle ===
    // Nämäkin putoavat, jos niiden alta kaivaa maan pois.
    const deco = [
        START_PAD + 4,                        // osa 1: puu
        START_PAD + 12,                       // osa 1: talo
        START_PAD + SEGMENT_W + 6,            // osa 2: puu
        START_PAD + SEGMENT_W + 13,           // osa 2: talo
        START_PAD + 3 * SEGMENT_W + 4,        // osa 4: puu
        START_PAD + 3 * SEGMENT_W + 11,       // osa 4: talo
    ];
    deco.forEach((x, i) => {
        if (grid[SURFACE_ROW][x] === TILE.GRASS) {
            grid[SURFACE_ROW][x] = (i % 2 === 0) ? TILE.TREE : TILE.HOUSE;
            // Varmista, että alla on multaa (tuki), jottei puu/talo putoa heti
            grid[segTop][x] = TILE.DIRT;
        }
    });

    // Reunat: pystykallioseinät maailman vasemmalle ja oikealle laidalle
    for (let y = 0; y < height; y++) {
        grid[y][0] = TILE.WALL;
        grid[y][width - 1] = TILE.WALL;
    }

    // Pelaajan aloituspaikka ja maali (portti itäpäässä)
    const playerStartX = 1;
    const playerStartY = SURFACE_ROW;
    grid[playerStartY][playerStartX] = TILE.GRASS;

    const exitX = width - 2;
    // Avain oikeassa alakulmassa, juuri kallioperän yläpuolella
    const keyY = BEDROCK_ROW - 1;
    grid[keyY][exitX] = TILE.KEY;

    // Kolikko maailman puolivälissä (segmenttien 2 ja 3 rajalla)
    const coinX = START_PAD + 2 * SEGMENT_W - 1;  // ~37
    grid[keyY][coinX] = TILE.COIN;

    return {
        grid: grid,
        width: width,
        height: height,
        playerStartX: playerStartX,
        playerStartY: playerStartY,
        name: 'Dig Game',
    };
}
