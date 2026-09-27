// renderer.js - Canvas-piirtäjä, osa 1

class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game;
        this.animations = [];
        this.flashAlpha = 0;
    }

    resize() {
        const cols = this.game.cols || 20;
        const rows = this.game.rows || 15;
        this.canvas.width = cols * CELL_SIZE;
        this.canvas.height = rows * CELL_SIZE;
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

    updateAnimations() {
        this.animations = this.animations.filter(a => {
            a.frame++;
            return a.frame < a.maxFrames;
        });
        if (this.flashAlpha > 0) {
            this.flashAlpha = Math.max(0, this.flashAlpha - 0.015);
        }
    }

    render() {
        const ctx = this.ctx;
        const cols = this.game.cols;
        const rows = this.game.rows;
        const cs = CELL_SIZE;
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                this.drawTile(ctx, x * cs, y * cs, this.game.grid[y][x]);
            }
        }
        if (!this.game.deathEnd) {
            this.drawPlayer(ctx, this.game.player.x * cs, this.game.player.y * cs);
        }
        this.renderAnimations(ctx);
        this.drawGrid(ctx, cols, rows, cs);

        // Ruudun välähdys kuolemassa
        if (this.flashAlpha > 0) {
            ctx.fillStyle = `rgba(255, 30, 0, ${this.flashAlpha})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    drawTile(ctx, px, py, tile) {
        const cs = CELL_SIZE;
        const p = 1;
        switch (tile) {
            case TILE.EMPTY: break;
            case TILE.DIRT:
                ctx.fillStyle = '#6B3410';
                ctx.fillRect(px + p, py + p, cs - p * 2, cs - p * 2);
                ctx.fillStyle = '#7B4420';
                const seed = (px * 31 + py * 17) % 100;
                for (let i = 0; i < 5; i++) {
                    const di = (seed + i * 7) % (cs - 10);
                    const dj = (seed * 3 + i * 13) % (cs - 10);
                    ctx.fillRect(px + p + 3 + di, py + p + 3 + dj, 2, 2);
                }
                ctx.strokeStyle = '#4a2008';
                ctx.lineWidth = 1;
                ctx.strokeRect(px + p, py + p, cs - p * 2, cs - p * 2);
                break;
            case TILE.WALL:
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
                break;
            case TILE.BOULDER:
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
                break;
            case TILE.DIAMOND:
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
                break;
            case TILE.KEY:
                // Kultainen avain (sykkivä hehku)
                const ks = Math.sin(Date.now() / 250 + px + py) * 0.3 + 0.7;
                ctx.fillStyle = `rgba(255, 170, 0, ${ks})`;
                // Avaimen varsi
                ctx.fillRect(px + cs / 2 - 2, py + 4, 4, cs - 8);
                // Avaimen pää (ympyrä)
                ctx.beginPath();
                ctx.arc(px + cs / 2, py + cs / 2 - 2, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1a1a2e';
                ctx.beginPath();
                ctx.arc(px + cs / 2, py + cs / 2 - 2, 2.5, 0, Math.PI * 2);
                ctx.fill();
                // Hampaat
                ctx.fillStyle = `rgba(255, 170, 0, ${ks})`;
                ctx.fillRect(px + cs / 2 + 2, py + cs - 8, 5, 3);
                ctx.fillRect(px + cs / 2 + 2, py + cs - 13, 5, 3);
                ctx.strokeStyle = '#664400';
                ctx.lineWidth = 1;
                ctx.strokeRect(px + cs / 2 - 2, py + 4, 4, cs - 8);
                break;
            case TILE.COIN:
                const cm = Math.sin(Date.now() / 350 + px + py) * 0.3 + 0.7;
                const cr = cs / 2 - 3;
                const ccx = px + cs / 2, ccy = py + cs / 2;
                ctx.fillStyle = `rgba(255, 193, 7, ${cm})`;
                ctx.beginPath();
                ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#C79100';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.strokeStyle = '#E6A800';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(ccx, ccy, cr - 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = '#8B6914';
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('$', ccx, ccy + 1);
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.beginPath();
                ctx.arc(ccx - cr * 0.35, ccy - cr * 0.35, 2.5, 0, Math.PI * 2);
                ctx.fill();
                break;
case TILE.EXIT:
                const open = this.game.diamondsCollected >= this.game.diamondsNeeded && this.game.keyCollected;
                ctx.fillStyle = open ? '#0F0' : '#030';
                ctx.fillRect(px + 3, py + 3, cs - 6, cs - 6);
                ctx.strokeStyle = open ? '#0F4' : '#060';
                ctx.lineWidth = 3;
                ctx.strokeRect(px + 3, py + 3, cs - 6, cs - 6);
                ctx.fillStyle = open ? '#040' : '#010';
                ctx.font = `${cs * 0.6}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('🚪', px + cs / 2, py + cs / 2 + 1);
                break;
            case TILE.FIREFLY:
                this.drawEnemy(ctx, px, py, cs, '#F22', '#F80', '#FC0');
                break;
            case TILE.BUTTERFLY:
                this.drawEnemy(ctx, px, py, cs, '#F60', '#FA0', '#FD4');
                break;
        }
    }

    drawEnemy(ctx, px, py, cs, c1, c2, c3) {
        const pulse = Math.sin(Date.now() / 150) * 2;
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.arc(px + cs / 2, py + cs / 2, cs / 2 - 2 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.arc(px + cs / 2, py + cs / 2, cs / 2 - 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = c3;
        ctx.beginPath();
        ctx.arc(px + cs / 2 - 3, py + cs / 2 - 3, 3, 0, Math.PI * 2);
        ctx.fill();
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

    renderAnimations(ctx) {
        for (const a of this.animations) {
            const cx = a.x + CELL_SIZE / 2;
            const cy = a.y + CELL_SIZE / 2;

            if (a.type === 'death') {
                const alpha = 1 - a.frame / a.maxFrames;

                // Ulompi rengas (oranssi/punainen)
                ctx.strokeStyle = `rgba(255, ${Math.floor(120 * (1 - a.frame / a.maxFrames))}, 0, ${alpha})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(cx, cy, a.frame * 5, 0, Math.PI * 2);
                ctx.stroke();

                // Sisempi rengas (kirkkaan keltainen)
                ctx.strokeStyle = `rgba(255, 255, 150, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, a.frame * 3, 0, Math.PI * 2);
                ctx.stroke();

                // Keskusta (hehkuva ydin)
                ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
                ctx.beginPath();
                ctx.arc(cx, cy, Math.max(2, 12 - a.frame), 0, Math.PI * 2);
                ctx.fill();

                // Sirpaleet (lentävät kipinät)
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

    drawGrid(ctx, cols, rows, cs) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cs, 0);
            ctx.lineTo(x * cs, rows * cs);
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
