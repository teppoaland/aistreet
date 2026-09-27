// renderer.js - Canvas-piirtäjä (kamera, pyöristetyt kaivureunat, hiukkaset)

class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.animations = [];
        this.particles = [];
        this.flashAlpha = 0;
        
        this.lerpX = 0; 
        this.lerpY = 0;
        this.camLerpX = 0;

        // === Yötaivas-järjestelmä ===
        this.skyReady = false;
        this._lastWorldW = 0;
        this.skySeed = Math.random() * 10000;
        this.windDir = Math.random() < 0.5 ? 1 : -1;
        this.windSpeed = 7 + Math.random() * 9; // px/s: hidas tuuli
        this.lastCloudTime = 0;
        this.clouds = [];
        this.stars = [];
        this.moon = null;
    }

    resize() {
        this.canvas.width = VIEW_COLS * CELL_SIZE;
        this.canvas.height = VIEW_ROWS * CELL_SIZE;
    }

    // Kamera seuraa pelaajaa vaakasuunnassa
    getCameraX() {
        const cx = this.game.player.x - Math.floor(VIEW_COLS / 2);
        return Math.max(0, Math.min(cx, this.game.cols - VIEW_COLS));
    }

    addExplosion(x, y) {
        this.animations.push({
            x: x * CELL_SIZE, y: y * CELL_SIZE,
            frame: 0, maxFrames: 6,
        });
    }

    addDeathExplosion(x, y) {
        this.animations.push({
            x: x * CELL_SIZE, y: y * CELL_SIZE,
            frame: 0, maxFrames: 20,
            type: 'death',
        });
        this.flashAlpha = 0.4;
    }

    // Murenemishiukkaset kaivamisen yhteydessä ("syöminen pala palalta")
    addCrumbs(x, y) {
        for (let i = 0; i < 60; i++) {
            const ang = (Math.random() - 0.5) * Math.PI;
            const speed = 1 + Math.random() * 4;
            this.particles.push({
                x: x * CELL_SIZE + CELL_SIZE / 2,
                y: y * CELL_SIZE + CELL_SIZE / 2,
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed - 2,
                life: 40 + Math.floor(Math.random() * 30),
                maxLife: 70,
                size: 1 + Math.random() * 2.5,
                color: Math.random() < 0.4 ? '#8a5520' : (Math.random() < 0.5 ? '#6B3410' : '#4a2008'),
            });
        }
    }

    updateAnimations() {
        this.animations = this.animations.filter(a => {
            a.frame++;
            return a.frame < a.maxFrames;
        });

        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3;

            const gridX = Math.floor(p.x / CELL_SIZE);
            const gridY = Math.floor(p.y / CELL_SIZE);
            
            if (this.isSolidGround(gridX, gridY)) {
                p.y -= p.vy;
                p.vy *= -0.3;
                p.vx *= 0.5;
            }

            p.life--;
            return p.life > 0;
        });

        if (this.flashAlpha > 0) {
            this.flashAlpha = Math.max(0, this.flashAlpha - 0.015);
        }

        // Pilvien liike tuulen mukana
        if (this.skyReady) {
            const now = performance.now();
            if (this.lastCloudTime) {
                const dt = Math.min((now - this.lastCloudTime) / 1000, 0.1); // cap 100ms
                const worldW = this.game.cols * CELL_SIZE;
                for (const c of this.clouds) {
                    c.wx += this.windDir * this.windSpeed * dt;
                    // Wrap-around: pilvi kiertää maailman ympäri
                    if (c.wx > worldW + c.w) c.wx = -c.w;
                    else if (c.wx < -c.w) c.wx = worldW + c.w;
                }
            }
            this.lastCloudTime = now;
        }
    }

    // Onko ruutu "kiinteää maata" (ei kaivettua aukkoa) - käytetään
    // pyöristetyn kaivureunan laskentaan.
    isSolidGround(wx, wy) {
        if (wx < 0 || wx >= this.game.cols || wy < 0 || wy >= this.game.rows) return true;
        const t = this.game.grid[wy][wx];
        return t === TILE.DIRT || t === TILE.WALL || t === TILE.BOULDER ||
               t === TILE.GRASS || t === TILE.TREE || t === TILE.HOUSE || t === TILE.SKY;
    }

    render() {
        const ctx = this.ctx;
        const cs = CELL_SIZE;

        const targetX = this.game.player.x;
        const targetY = this.game.player.y;
        
        if (Math.abs(targetX - this.lerpX) > 3) this.lerpX = targetX;
        else this.lerpX += (targetX - this.lerpX) * 0.3;
        
        if (Math.abs(targetY - this.lerpY) > 3) this.lerpY = targetY;
        else this.lerpY += (targetY - this.lerpY) * 0.3;

        const targetCamX = Math.max(0, Math.min(targetX - Math.floor(VIEW_COLS / 2), this.game.cols - VIEW_COLS));
        if (Math.abs(targetCamX - this.camLerpX) > 10) this.camLerpX = targetCamX;
        else this.camLerpX += (targetCamX - this.camLerpX) * 0.15;

        const offsetX = this.camLerpX * cs;

        // === Yötaivas-gradientti (koko canvas) ===
        const skyGrad = ctx.createLinearGradient(0, 0, 0, cs);
        skyGrad.addColorStop(0, '#0a1628');
        skyGrad.addColorStop(0.5, '#0f1f38');
        skyGrad.addColorStop(1, '#152240');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, this.canvas.width, cs);
        // Maanalainen tumma tausta
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, cs, this.canvas.width, this.canvas.height - cs);

        // === Alusta taivas kerran (maailman leveyden tiedettyä) ===
        const worldW = this.game.cols * cs;
        if (!this.skyReady || this._lastWorldW !== worldW) {
            this._lastWorldW = worldW;
            this.initSky(worldW);
        }

        // === Piirrä tähdet, kuu ja pilvet taivasriville ===
        if (this.skyReady) {
            for (const s of this.stars) this.drawStar(ctx, s, offsetX);
            this.drawMoon(ctx, this.moon, offsetX);
            for (const c of this.clouds) this.drawCloud(ctx, c, offsetX);
        }

        const baseCamX = Math.floor(this.camLerpX);
        for (let y = 0; y < VIEW_ROWS; y++) {
            for (let x = -1; x <= VIEW_COLS + 1; x++) {
                const wx = baseCamX + x;
                const wy = y;
                if (wx < 0 || wx >= this.game.cols || wy < 0 || wy >= this.game.rows) continue;
                
                const drawX = (wx * cs) - offsetX;
                const drawY = wy * cs;
                this.drawTile(ctx, drawX, drawY, this.game.grid[wy][wx], wx, wy);
            }
        }

        if (!this.game.deathEnd) {
            const pDrawX = (this.lerpX * cs) - offsetX;
            const pDrawY = this.lerpY * cs;
            this.drawPlayer(ctx, pDrawX, pDrawY);
        }

        this.renderAnimations(ctx, offsetX);
        this.renderParticles(ctx, offsetX);
        this.drawGrid(ctx, VIEW_COLS, VIEW_ROWS, cs, offsetX);

        if (this.flashAlpha > 0) {
            ctx.fillStyle = `rgba(255, 30, 0, ${this.flashAlpha})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    drawTile(ctx, px, py, tile, wx, wy) {
        const cs = CELL_SIZE;
        switch (tile) {
            case TILE.EMPTY: break;
            case TILE.DIRT: this.drawDirt(ctx, px, py, wx, wy); break;
            case TILE.WALL: this.drawWall(ctx, px, py); break;
            case TILE.BOULDER: this.drawBoulder(ctx, px, py); break;
            case TILE.DIAMOND: this.drawDiamond(ctx, px, py); break;
            case TILE.EXIT: this.drawExit(ctx, px, py); break;
            case TILE.KEY: this.drawKey(ctx, px, py); break;
            case TILE.COIN: this.drawCoin(ctx, px, py); break;
            case TILE.FIREFLY: this.drawEnemy(ctx, px, py, cs, '#F22', '#F80', '#FC0'); break;
            case TILE.BUTTERFLY: this.drawEnemy(ctx, px, py, cs, '#F60', '#FA0', '#FD4'); break;
            case TILE.SKY: /* taivas läpinäkyvä – yötaivas piirretään render()-metodissa */ break;
            case TILE.GRASS: this.drawGrass(ctx, px, py, wx, wy); break;
            case TILE.TREE: this.drawTree(ctx, px, py, wx, wy); break;
            case TILE.HOUSE: this.drawHouse(ctx, px, py, wx, wy); break;
        }
    }

    // Piirrä pyöristetty suorakulmio annetuilla kulmasäteillä [vasYlä, oikYlä, oikAla, vasAla]
    roundedRectPath(ctx, x, y, w, h, radii) {
        const tl = radii[0], tr = radii[1], br = radii[2], bl = radii[3];
        ctx.beginPath();
        ctx.moveTo(x + tl, y);
        ctx.lineTo(x + w - tr, y);
        ctx.arcTo(x + w, y, x + w, y + tr, tr);
        ctx.lineTo(x + w, y + h - br);
        ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
        ctx.lineTo(x + bl, y + h);
        ctx.arcTo(x, y + h, x, y + h - bl, bl);
        ctx.lineTo(x, y + tl);
        ctx.arcTo(x, y, x + tl, y, tl);
        ctx.closePath();
    }

    // Maa, jonka kaivetut reunat pyöristyvät (raja ei ole enää suora []).
    drawDirt(ctx, px, py, wx, wy) {
        const cs = CELL_SIZE;
        const R = CORNER_RADIUS;
        const top = !this.isSolidGround(wx, wy - 1);
        const bottom = !this.isSolidGround(wx, wy + 1);
        const left = !this.isSolidGround(wx - 1, wy);
        const right = !this.isSolidGround(wx + 1, wy);
        const radii = [
            top && left ? R : 0,
            top && right ? R : 0,
            bottom && right ? R : 0,
            bottom && left ? R : 0,
        ];
        const x = px + 1, y = py + 1, w = cs - 2, h = cs - 2;

        this.roundedRectPath(ctx, x, y, w, h, radii);
        ctx.fillStyle = '#6B3410';
        ctx.fill();

        // Rakenne (sorapisteet) leikattuna pyöristettyyn muotoon
        ctx.save();
        this.roundedRectPath(ctx, x, y, w, h, radii);
        ctx.clip();
        ctx.fillStyle = '#7B4420';
        const seed = (wx * 31 + wy * 17) % 100;
        for (let i = 0; i < 5; i++) {
            const di = (seed + i * 7) % (cs - 8);
            const dj = (seed * 3 + i * 13) % (cs - 8);
            ctx.fillRect(px + 4 + di, py + 4 + dj, 2, 2);
        }
        ctx.restore();

        this.roundedRectPath(ctx, x, y, w, h, radii);
        ctx.strokeStyle = '#4a2008';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawWall(ctx, px, py) {
        const cs = CELL_SIZE, p = 1;
        ctx.fillStyle = '#555';
        ctx.fillRect(px + p, py + p, cs - p * 2, cs - p * 2);
        ctx.fillStyle = '#666';
        ctx.fillRect(px + p, py + p, cs - p * 2, (cs - p * 2) / 2);
        ctx.fillStyle = '#444';
        ctx.fillRect(px + p, py + p + (cs - p * 2) / 2, cs - p * 2, (cs - p * 2) / 2);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + p, py + p, cs - p * 2, cs - p * 2);
        ctx.beginPath();
        ctx.moveTo(px + p, py + cs / 2);
        ctx.lineTo(px + cs - p, py + cs / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + cs / 2, py + p);
        ctx.lineTo(px + cs / 2, py + cs / 2);
        ctx.stroke();
    }

    drawBoulder(ctx, px, py) {
        const cs = CELL_SIZE;
        ctx.fillStyle = '#777';
        ctx.beginPath();
        ctx.arc(px + cs / 2, py + cs / 2, cs / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#999';
        ctx.beginPath();
        ctx.arc(px + cs / 2 - 3, py + cs / 2 - 3, cs / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px + cs / 2, py + cs / 2, cs / 2 - 3, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawDiamond(ctx, px, py) {
        const cs = CELL_SIZE, p = 1;
        const s = Math.sin(Date.now() / 300 + px + py) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(0, 200, 255, ${s})`;
        ctx.beginPath();
        ctx.moveTo(px + cs / 2, py + p + 2);
        ctx.lineTo(px + cs - p - 2, py + cs / 2);
        ctx.lineTo(px + cs / 2, py + cs - p - 2);
        ctx.lineTo(px + p + 2, py + cs / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#0AA';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(px + cs / 2 - 3, py + cs / 2 - 2, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    drawExit(ctx, px, py) {
        const cs = CELL_SIZE;
        ctx.fillStyle = '#0F0';
        ctx.fillRect(px + 3, py + 3, cs - 6, cs - 6);
        ctx.strokeStyle = '#0F4';
        ctx.lineWidth = 3;
        ctx.strokeRect(px + 3, py + 3, cs - 6, cs - 6);
        ctx.fillStyle = '#040';
        ctx.font = `${cs * 0.6}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚪', px + cs / 2, py + cs / 2 + 1);
    }

    drawKey(ctx, px, py) {
        const cs = CELL_SIZE;
        const cx = px + cs / 2, cy = py + cs / 2;
        // Hehkuva tausta
        const glow = Math.sin(Date.now() / 400 + px + py) * 0.25 + 0.75;
        ctx.fillStyle = `rgba(255, 215, 0, ${glow * 0.3})`;
        ctx.beginPath();
        ctx.arc(cx, cy, cs / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        // Avaimen varsi
        ctx.fillStyle = '#DAA520';
        ctx.fillRect(cx - 2, cy - 2, 4, cs * 0.5);
        // Hampaat
        ctx.fillRect(cx - 2, cy + cs * 0.32, 7, 3);
        ctx.fillRect(cx - 2, cy + cs * 0.2, 5, 3);
        // Pää (rengas)
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy - cs * 0.2, cs * 0.2, 0, Math.PI * 2);
        ctx.stroke();
        // Rei'itys
        ctx.strokeStyle = '#0a0a1a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy - cs * 0.2, cs * 0.1, 0, Math.PI * 2);
        ctx.stroke();
        // Kimallus
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(cx + cs * 0.12, cy - cs * 0.33, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    drawCoin(ctx, px, py) {
        const cs = CELL_SIZE;
        const cx = px + cs / 2, cy = py + cs / 2;
        const r = cs / 2 - 3;
        // Kultainen kolikko pyörivällä kiillolla
        const shimmer = Math.sin(Date.now() / 350 + px + py) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 193, 7, ${shimmer})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#C79100';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Sisärengas
        ctx.strokeStyle = '#E6A800';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
        ctx.stroke();
        // $-merkki keskellä
        ctx.fillStyle = '#8B6914';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', cx, cy + 1);
        // Kimallus
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(cx - r * 0.35, cy - r * 0.35, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    drawEnemy(ctx, px, py, cs, c1, c2, c3) {
        const pulse = Math.sin(Date.now() / 150) * 2;
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.arc(px + cs / 2, py + cs / 2, cs / 2 - 2 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.arc(px + cs / 2 + 3, py + cs / 2 - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c3;
        ctx.beginPath();
        ctx.arc(px + cs / 2 - 3, py + cs / 2 - 3, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // === Poutayö-taivasjärjestelmä ===

    // Satunnainen siemenluku deterministisellä ulostulolla
    _srnd(seed) {
        const x = Math.sin(seed + this.skySeed) * 10000;
        return x - Math.floor(x);
    }

    // Generoi tähdet, kuun ja pilvet kerran maailman luonnin yhteydessä
    initSky(worldW) {
        const skyH = CELL_SIZE;
        const rnd = (s) => this._srnd(s);

        // Uusi siemen ja tuuli joka kerralla kun taivas alustetaan
        this.skySeed = Math.random() * 10000;
        this.windDir = Math.random() < 0.5 ? 1 : -1;
        this.windSpeed = 7 + Math.random() * 9; // px/s: puolet alkuperäisestä

        // === Tähdet (~55 kpl) ===
        this.stars = [];
        for (let i = 0; i < 55; i++) {
            this.stars.push({
                wx: rnd(i * 3.7) * worldW,
                wy: 1.5 + rnd(i * 3.7 + 1) * (skyH - 5),
                size: 0.4 + rnd(i * 3.7 + 2) * 2.0,
                brightness: 0.2 + rnd(i * 3.7 + 3) * 0.75,
            });
        }

        // === Kuu ===
        this.moon = {
            wx: worldW * 0.55 + rnd(1) * worldW * 0.25,
            wy: 5 + rnd(2) * 8,
            radius: 10 + rnd(3) * 5,
            crescentRight: rnd(4) > 0.5,
        };

        // === Pilvet (~20 kpl) ===
        this.clouds = [];
        for (let i = 0; i < 20; i++) {
            const typeRoll = rnd(i * 5.9);
            let ww, opacity, type;
            if (typeRoll < 0.35) {
                // Ohut cirrus-juova
                type = 'cirrus';
                ww = 100 + rnd(i * 5.9 + 1) * 300;
                opacity = 0.008 + rnd(i * 5.9 + 2) * 0.023;
            } else {
                // Vaakasuuntainen hattarapilvi
                type = 'hazy';
                ww = 140 + rnd(i * 5.9 + 1) * 360;
                opacity = 0.022 + rnd(i * 5.9 + 2) * 0.039;
            }
            this.clouds.push({
                wx: rnd(i * 5.9 + 3) * worldW,
                wy: 2 + rnd(i * 5.9 + 4) * (skyH * 0.5),
                w: ww, opacity: opacity, type: type,
            });
        }

        this.skyReady = true;
    }

    // Yksittäinen tähti: pieni piste + himmeä hehku kirkkaimmille
    drawStar(ctx, star, offsetX) {
        const x = star.wx - offsetX;
        if (x < -5 || x > this.canvas.width + 5) return;
        ctx.fillStyle = `rgba(255,255,255,${star.brightness})`;
        ctx.beginPath();
        ctx.arc(x, star.wy, Math.max(0.3, star.size), 0, Math.PI * 2);
        ctx.fill();
        if (star.brightness > 0.55) {
            ctx.fillStyle = `rgba(255,255,240,${star.brightness * 0.2})`;
            ctx.beginPath();
            ctx.arc(x, star.wy, star.size * 2.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Sirppikuu + hehku
    drawMoon(ctx, moon, offsetX) {
        const x = moon.wx - offsetX;
        const y = moon.wy;
        const r = moon.radius;
        if (x < -r * 3 || x > this.canvas.width + r * 3) return;

        const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 2.8);
        glow.addColorStop(0, 'rgba(255,255,240,0.18)');
        glow.addColorStop(0.4, 'rgba(255,255,240,0.06)');
        glow.addColorStop(1, 'rgba(255,255,240,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, r * 2.8, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#fefae0';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

        const shadowOff = moon.crescentRight ? r * 0.4 : -r * 0.4;
        ctx.fillStyle = '#0f1d30';
        ctx.beginPath(); ctx.arc(x + shadowOff, y - r * 0.08, r * 0.78, 0, Math.PI * 2); ctx.fill();
    }

    // Pilvi: cirrus tai hazy – ohuita, vaakasuuntaisia, hattaraisia
    drawCloud(ctx, cloud, offsetX) {
        const x = cloud.wx - offsetX;
        const y = cloud.wy;
        if (x < -cloud.w || x > this.canvas.width + cloud.w) return;

        const a = cloud.opacity;
        const hw = cloud.w * 0.5;
        ctx.save();

        if (cloud.type === 'cirrus') {
            // Ohuet haituvaiset cirrus-juovat (korkeus ~1-3px)
            const streaks = 3 + Math.floor(cloud.w * 0.008);
            for (let i = 0; i < streaks; i++) {
                const ox = (i - (streaks - 1) / 2) * (cloud.w * 0.11);
                const oy = (i % 3 - 1) * 1.4;
                const sw = hw * (0.6 + 0.4 * (1 - Math.abs(i - (streaks - 1) / 2) / (streaks / 2)));
                const fa = a * (0.35 + 0.65 * (1 - Math.abs(i - (streaks - 1) / 2) / (streaks / 2)));
                ctx.fillStyle = `rgba(190,200,225,${fa})`;
                ctx.beginPath();
                ctx.ellipse(x + ox, y + oy, sw, 1.2, 0.015 * (i - 1), 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Hazy: vaakasuuntaisia päällekkäisiä hattaraellipsejä
            const baseClr = '180,195,215';
            const parts = 5 + Math.floor(cloud.w * 0.006);
            for (let i = 0; i < parts; i++) {
                const ox = (i - (parts - 1) / 2) * (cloud.w * 0.14);
                const oy = Math.sin(i * 2.3) * 3;
                const dist = Math.abs(i - (parts - 1) / 2) / ((parts - 1) / 2);
                const lw = cloud.w * (0.15 + 0.10 * (1 - dist));
                const la = a * (0.5 + 0.5 * (1 - dist));
                ctx.fillStyle = `rgba(${baseClr},${la})`;
                ctx.beginPath();
                ctx.ellipse(x + ox, y + oy, lw, 4 + dist * 3, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    // Vanha drawSky – ei enää käytössä (SKY-tiili läpinäkyvä)
    drawSky(ctx, px, py, wx, wy) {}

    drawGrass(ctx, px, py, wx, wy) {
        const cs = CELL_SIZE;
        ctx.fillStyle = '#6B3410';
        ctx.fillRect(px, py + cs / 2, cs, cs / 2);
        ctx.fillStyle = '#4a8f29';
        ctx.fillRect(px, py + cs / 2 - 4, cs, 8);
        ctx.fillStyle = '#5faf33';
        const seed = (wx * 17 + wy * 11) % 100;
        for (let i = 0; i < 6; i++) {
            const gx = px + ((seed + i * 13) % cs);
            ctx.fillRect(gx, py + cs / 2 - 5, 2, 4 + (i % 3));
        }
    }

    drawTree(ctx, px, py, wx, wy) {
        const cs = CELL_SIZE;
        const onSurface = wy === SURFACE_ROW;
        // Maanpinnalle jää nurmi puun alle
        if (onSurface) this.drawGrass(ctx, px, py, wx, wy);
        const cx = px + cs / 2;
        // Puu on aina pystyssä — sama ulkonäkö myös pudotessaan monttuun.
        const baseY = onSurface ? (py + cs / 2 - 4) : (py + cs - 2);
        // runko (pysty)
        ctx.fillStyle = '#5a3d1f';
        ctx.fillRect(cx - 3, baseY - 14, 6, 14);
        // latvus
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.arc(cx, baseY - 19, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#388e3c';
        ctx.beginPath();
        ctx.arc(cx - 4, baseY - 22, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    drawHouse(ctx, px, py, wx, wy) {
        const cs = CELL_SIZE;
        if (wy === SURFACE_ROW) {
            // Talo seisoo maan pinnalla: nurmi jää alle, runko ja katto nousevat ylös
            this.drawGrass(ctx, px, py, wx, wy);
            const baseY = py + cs / 2 - 4; // nurmen yläreuna
            ctx.fillStyle = '#c96b4a';
            ctx.fillRect(px + 4, baseY - 14, cs - 8, 14);
            ctx.fillStyle = '#7d3b28';
            ctx.beginPath();
            ctx.moveTo(px + 2, baseY - 14);
            ctx.lineTo(px + cs / 2, baseY - 30);
            ctx.lineTo(px + cs - 2, baseY - 14);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#5a2d1f';
            ctx.fillRect(px + cs / 2 - 3, baseY - 10, 6, 10);
            ctx.fillStyle = '#ffe08a';
            ctx.fillRect(px + cs / 2 - 8, baseY - 12, 6, 6);
        } else {
            // Kaatunut talo maan alla: kompakti kasa
            ctx.fillStyle = '#c96b4a';
            ctx.fillRect(px + 4, py + cs / 2 - 4, cs - 8, 8);
            ctx.fillStyle = '#7d3b28';
            ctx.beginPath();
            ctx.moveTo(px + 2, py + cs / 2 - 4);
            ctx.lineTo(px + cs / 2, py + cs / 2 - 12);
            ctx.lineTo(px + cs - 2, py + cs / 2 - 4);
            ctx.closePath();
            ctx.fill();
        }
    }

    drawPlayer(ctx, px, py) {
        const cs = CELL_SIZE;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(px + cs / 2, py + cs / 2, cs / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#CC8800';
        ctx.fillRect(px + cs / 4, py + 2, cs / 2, cs / 4);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(px + cs / 2 - 5, py + cs / 2 - 4, 2.5, 0, Math.PI * 2);
        ctx.arc(px + cs / 2 + 5, py + cs / 2 - 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#960';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px + cs / 2, py + cs / 2, cs / 2 - 3, 0, Math.PI * 2);
        ctx.stroke();
    }

    renderAnimations(ctx, offsetX) {
        for (const a of this.animations) {
            const cx = a.x - offsetX + CELL_SIZE / 2;
            const cy = a.y + CELL_SIZE / 2;

            if (a.type === 'death') {
                const alpha = 1 - a.frame / a.maxFrames;
                ctx.strokeStyle = `rgba(255, ${Math.floor(120 * (1 - a.frame / a.maxFrames))}, 0, ${alpha})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(cx, cy, a.frame * 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = `rgba(255, 255, 150, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, a.frame * 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
                ctx.beginPath();
                ctx.arc(cx, cy, Math.max(2, 12 - a.frame), 0, Math.PI * 2);
                ctx.fill();
                const parts = 10;
                const seed = (a.x * 31 + a.y * 17) % 100;
                for (let i = 0; i < parts; i++) {
                    const angle = (i / parts) * Math.PI * 2 + seed * 0.01;
                    const dist = a.frame * 4;
                    ctx.fillStyle = `rgba(255, ${150 + Math.floor(100 * Math.random())}, 0, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                const alpha = 1 - a.frame / a.maxFrames;
                ctx.strokeStyle = `rgba(255, 255, 0, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, a.frame * 3, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    renderParticles(ctx, offsetX) {
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.fillRect(p.x - offsetX - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }

    drawGrid(ctx, cols, rows, cs, offsetX) {
        const offX = offsetX ? (offsetX % cs) : 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cs - offX, 0);
            ctx.lineTo(x * cs - offX, rows * cs);
            ctx.stroke();
        }
        for (let y = 0; y <= rows; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cs);
            ctx.lineTo(cols * cs, y * cs);
            ctx.stroke();
        }
    }
}


