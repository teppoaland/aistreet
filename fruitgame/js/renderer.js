// renderer.js – Hedelmäpeli: canvas-piirto (kone, rullat, symbolit, efektit)
let wallPicFailed = false;   // seinäkuva ei latautunut → pysyy piilossa

/* Seinäkuvan mitoitus. Kuva on koriste eikä saa huonontaa pelattavuutta:
   pystynäytöissä canvas on leveysrajainen, joten kuvalle varattu kaista
   mahtuu jo olemassa olevaan tyhjään seinätilaan eikä kone pienene lainkaan.
   PC:llä (canvas korkeusrajainen) kaista otetaan koneen yläpuolelta ja koko
   ryhmä (kuva + rako + kone) keskitetään → kone pysyy ryhmän alaosassa. */
const WALL_PIC_H_RATIO = 0.28;   // kuvan enimmäiskorkeus osuutena ikkunan korkeudesta
const WALL_PIC_MIN_H   = 90;     // tätä matalampaa kuvaa ei näytetä (px)
const WALL_PIC_GAP     = 0;      // rako kuvan ja pelikentän yläreunan välissä (0 = kiinni)
const WALL_PIC_SIDE    = 24;     // vapaa marginaali ikkunan reunoihin yhteensä
const WALL_PIC_FRAME   = 3;      // mustan kehyksen paksuus (sama kuin CSS:ssä)
const GROUP_MARGIN     = 12;     // pystymarginaali koko ryhmän ympärillä (px)
const CANVAS_BORDER    = 6;      // canvasin reunus 2 × 3 px (content-box)

class Renderer {
    constructor(canvas, game) {
        this.canvas = canvas;
        this.game = game;
        this.ctx = canvas.getContext('2d');
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        this.ctx.imageSmoothingEnabled = false;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => this.resize());

        // Seinäkuva: kun lataus valmistuu (tai epäonnistuu), mitat ovat
        // tiedossa → asettelu lasketaan uudelleen.
        const pic = (typeof document !== 'undefined' && document.getElementById)
            ? document.getElementById('wall-pic') : null;
        if (pic && pic.addEventListener) {
            pic.addEventListener('load', () => this.resize());
            pic.addEventListener('error', () => { wallPicFailed = true; this.resize(); });
        }
    }

    /** Skaalaa canvasin käytettävissä olevaan tilaan ja sijoittaa seinäkuvan
        (toimii pysty- ja vaaka-asennossa). Kuvalle varattu kaista ei muuta
        koneen kokoa, jos canvas on leveysrajainen (pystynäyttö). */
    resize() {
        const wrap = this.canvas.parentElement;
        if (!wrap) return;
        const W = wrap.clientWidth, H = wrap.clientHeight;

        // 1) Seinäkuvan koko vapaasta seinätilasta (null = ei näytetä)
        const pic = this.wallPicSize(W, H);
        const bandH = pic ? (pic.ih + WALL_PIC_FRAME * 2) + WALL_PIC_GAP : 0;

        // 2) Canvas loppuun tilaan
        const availW = Math.max(220, W - CANVAS_BORDER);
        const availH = Math.max(140, H - CANVAS_BORDER - bandH - (pic ? GROUP_MARGIN : 0));
        const scale = Math.min(availW / CANVAS_W, availH / CANVAS_H);
        const canvasH = Math.floor(CANVAS_H * scale);
        this.canvas.style.width = Math.floor(CANVAS_W * scale) + 'px';
        this.canvas.style.height = canvasH + 'px';
        // Ryhmän keskitys: ylämarginaali = kuva + rako → kone ryhmän alaosaan
        this.canvas.style.marginTop = bandH > 0 ? bandH + 'px' : '0px';

        // 3) Kuva kiinni pelikentän yläreunassa, vaakasuunnassa keskitetty
        const el = this.wallPic();
        if (!el) return;
        if (!pic) { el.classList.remove('visible'); return; }
        const picW = pic.iw + WALL_PIC_FRAME * 2;
        const picH = pic.ih + WALL_PIC_FRAME * 2;
        const groupH = bandH + canvasH + CANVAS_BORDER;    // koko ryhmän ulkomitta
        el.style.width = picW + 'px';
        el.style.height = picH + 'px';
        el.style.left = Math.round((W - picW) / 2) + 'px';
        el.style.top = Math.max(0, Math.round((H - groupH - WALL_PIC_GAP) / 2)) + 'px';
        el.classList.add('visible');
    }

    /* ── Pelihuoneen seinäkuva ──────────────────────────── */

    /** Seinäkuva-elementti (tai null, jos ei ole käytettävissä) */
    wallPic() {
        return (typeof document !== 'undefined' && document.getElementById)
            ? document.getElementById('wall-pic') : null;
    }

    /** Kuvan sisältökoko (px) vapaasta seinätilasta; null = ei näytetä.
        Vaatii kuvan oikean koon (naturalWidth), joten ennen latausta ja
        headless-ympäristössä kuva pysyy piilossa eikä muuta asettelua. */
    wallPicSize(W, H) {
        const el = this.wallPic();
        if (!el || !el.classList || wallPicFailed) return null;
        if (typeof window.matchMedia === 'function'
            && window.matchMedia('(orientation: landscape) and (max-height: 500px) and (pointer: coarse)').matches) {
            return null;                     // mobiilin vaakataso: ei mahdu
        }
        const nw = Number(el.naturalWidth) || 0;
        const nh = Number(el.naturalHeight) || 0;
        if (!nw || !nh) return null;         // ei vielä ladattu
        const aspect = nw / nh;
        const ih = Math.min(H * WALL_PIC_H_RATIO, (W - WALL_PIC_SIDE) / aspect);
        if (ih < WALL_PIC_MIN_H) return null;   // liian matala → ei nysää
        return { ih: Math.round(ih), iw: Math.round(ih * aspect) };
    }

    /* ═══ PÄÄPIIRTO ═══════════════════════════════════ */
    render() {
        const ctx = this.ctx;
        const g = this.game;

        this.drawBackdrop(ctx, g);
        this.drawCabinet(ctx, g);
        this.drawMarquee(ctx, g);
        this.drawCoinSlot(ctx, g);
        this.drawReels(ctx, g);
        this.drawPayTable(ctx, g);
        this.drawMessage(ctx, g);
        this.drawCoinTray(ctx, g);
        this.drawFreeSpin(ctx, g);
        this.drawLever(ctx, g);
        this.drawSparkles(ctx, g);
        this.drawWinFlash(ctx, g);
    }

    /* ═══ APURIT ══════════════════════════════════════ */
    roundRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + w - rr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
        ctx.lineTo(x + w, y + h - rr);
        ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
        ctx.lineTo(x + rr, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.closePath();
    }

    /* ── Tausta ─────────────────────────────────────── */
    drawBackdrop(ctx, g) {
        const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        bg.addColorStop(0, COL.bg);
        bg.addColorStop(1, COL.floor);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Lämmin hehku koneen takana
        const glow = ctx.createRadialGradient(CANVAS_W / 2, 200, 40, CANVAS_W / 2, 200, 420);
        glow.addColorStop(0, 'rgba(120,80,200,0.16)');
        glow.addColorStop(1, 'rgba(120,80,200,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    /* ── Koneen runko ───────────────────────────────── */
    drawCabinet(ctx, g) {
        // Ulkoreuna
        ctx.fillStyle = '#0d0a16';
        this.roundRect(ctx, CAB.x - 9, CAB.y - 9, CAB.w + 18, CAB.h + 18, 16);
        ctx.fill();
        ctx.strokeStyle = COL.cabEdge;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Runko
        const body = ctx.createLinearGradient(CAB.x, 0, CAB.x + CAB.w, 0);
        body.addColorStop(0, COL.cabHi);
        body.addColorStop(0.45, COL.cab);
        body.addColorStop(1, COL.cabDark);
        ctx.fillStyle = body;
        this.roundRect(ctx, CAB.x, CAB.y, CAB.w, CAB.h, 12);
        ctx.fill();
        ctx.strokeStyle = '#0e0b16';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Rullien takalevy
        const px0 = WIN_X0 - 24;
        const pw = (REEL_COUNT * WIN_W + (REEL_COUNT - 1) * WIN_GAP) + 48;
        ctx.fillStyle = COL.plate;
        this.roundRect(ctx, px0, WIN_TOP - 14, pw, WIN_H + 28, 10);
        ctx.fill();
        ctx.strokeStyle = '#0a0812';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Ylä- ja alalevyn koristeviivat
        ctx.strokeStyle = 'rgba(255,215,0,0.16)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(CAB.x + 18, WIN_TOP - 20);
        ctx.lineTo(CAB.x + CAB.w - 18, WIN_TOP - 20);
        ctx.moveTo(CAB.x + 18, WIN_TOP + WIN_H + 20);
        ctx.lineTo(CAB.x + CAB.w - 18, WIN_TOP + WIN_H + 20);
        ctx.stroke();
    }

    /* ── Valot rivi (marquee) ───────────────────────── */
    drawMarquee(ctx, g) {
        const n = 18;
        const left = CAB.x + 26;
        const right = CAB.x + CAB.w - 26;
        const step = (right - left) / (n - 1);
        const speed = g.spinning ? 9 : 3;      // pyörinnän aikana valot vilkkuvat nopeammin
        const phase = Math.floor(g.time * speed);
        const y = CAB.y + 22;

        for (let i = 0; i < n; i++) {
            const on = ((i + phase) % 2 === 0);
            const x = left + i * step;
            if (on) {
                const halo = ctx.createRadialGradient(x, y, 1, x, y, 12);
                halo.addColorStop(0, i % 2 === 0 ? 'rgba(255,215,106,0.55)' : 'rgba(255,122,208,0.55)');
                halo.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = i % 2 === 0 ? COL.bulbA : COL.bulbB;
            } else {
                ctx.fillStyle = COL.bulbOff;
            }
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* ── Kolikkoaukko ───────────────────────────────── */
    drawCoinSlot(ctx, g) {
        const x = CAB.x + 16;
        const y = WIN_TOP - 6;
        const w = 60;
        const h = 34;
        ctx.fillStyle = '#150f24';
        this.roundRect(ctx, x, y, w, h, 6);
        ctx.fill();
        // Kolikon sisäänheiton hehku heti pyöräytyksen alettua
        if (g.insertT > 0) {
            ctx.strokeStyle = 'rgba(255,215,0,' + (0.85 * (g.insertT / 0.42)).toFixed(2) + ')';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = COL.goldDim;
            ctx.lineWidth = 2;
        }
        ctx.stroke();
        // Itse rako
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 22, y + 12, 16, 5);
        ctx.fillStyle = '#3a3050';
        ctx.fillRect(x + 22, y + 17, 16, 2);
    }

    /* ── Rullat ─────────────────────────────────────── */
    drawReels(ctx, g) {
        for (let i = 0; i < REEL_COUNT; i++) this.drawReelWindow(ctx, g, i);
        this.drawPayline(ctx, g);
    }

    drawReelWindow(ctx, g, i) {
        const x = reelX(i);
        const r = g.reels[i];

        // Ikkunan tausta (nahkamainen nauha)
        const grd = ctx.createLinearGradient(0, WIN_TOP, 0, WIN_TOP + WIN_H);
        grd.addColorStop(0, COL.reelShade);
        grd.addColorStop(0.1, COL.reelBg);
        grd.addColorStop(0.9, COL.reelBg);
        grd.addColorStop(1, COL.reelShade);
        ctx.fillStyle = grd;
        ctx.fillRect(x, WIN_TOP, WIN_W, WIN_H);

        // Symbolit leikattuna ikkunaan
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, WIN_TOP, WIN_W, WIN_H);
        ctx.clip();

        const base = Math.floor(r.pos);
        for (let k = -2; k <= 2; k++) {
            const idx = base + k;
            const cy = PAYLINE_Y + (idx - r.pos) * CELL_H;
            if (cy < WIN_TOP - CELL_H || cy > WIN_TOP + WIN_H + CELL_H) continue;
            const id = REEL_STRIP[((idx % STRIP_LEN) + STRIP_LEN) % STRIP_LEN];
            this.drawSymbol(ctx, id, x + WIN_W / 2, cy, 1);
        }

        // Voitto-osuma: kultainen pulssikehys
        if (g.winRows[i] && !g.spinning) {
            const pulse = 0.55 + 0.45 * Math.sin(g.time * 7);
            ctx.strokeStyle = 'rgba(255,215,0,' + pulse.toFixed(3) + ')';
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 3, WIN_TOP + 3, WIN_W - 6, WIN_H - 6);
        }
        ctx.restore();

        // Lasikiilto
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.moveTo(x + 6, WIN_TOP + 4);
        ctx.lineTo(x + WIN_W * 0.4, WIN_TOP + 4);
        ctx.lineTo(x + 6, WIN_TOP + WIN_H * 0.5);
        ctx.closePath();
        ctx.fill();

        // Kehykset
        ctx.strokeStyle = COL.reelEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, WIN_TOP - 1, WIN_W + 2, WIN_H + 2);
        ctx.strokeStyle = '#0a0812';
        ctx.strokeRect(x - 3, WIN_TOP - 3, WIN_W + 6, WIN_H + 6);
    }

    drawPayline(ctx, g) {
        const x0 = reelX(0);
        const x1 = reelX(REEL_COUNT - 1) + WIN_W;
        ctx.fillStyle = 'rgba(255,215,0,0.09)';
        ctx.fillRect(x0, PAYLINE_Y - 12, x1 - x0, 24);
        ctx.strokeStyle = 'rgba(255,215,0,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, PAYLINE_Y - 0.5);
        ctx.lineTo(x1, PAYLINE_Y - 0.5);
        ctx.stroke();
        // Nuolet päissä
        ctx.fillStyle = 'rgba(255,215,0,0.8)';
        ctx.beginPath();
        ctx.moveTo(x0 - 13, PAYLINE_Y);
        ctx.lineTo(x0 - 4, PAYLINE_Y - 6);
        ctx.lineTo(x0 - 4, PAYLINE_Y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x1 + 13, PAYLINE_Y);
        ctx.lineTo(x1 + 4, PAYLINE_Y - 6);
        ctx.lineTo(x1 + 4, PAYLINE_Y + 6);
        ctx.closePath();
        ctx.fill();
    }

    /* ── Symbolit (pikseligrafiikka canvas-primitiiveinä) ──
       s = skaalakerroin (1 = 50 px solu, 0.42 = maksutaulukon miniatyyri) */
    drawSymbol(ctx, id, cx, cy, s) {
        switch (id) {
            case 'cherry': {
                // Varret
                ctx.strokeStyle = '#3f7a2a';
                ctx.lineWidth = Math.max(1, 2 * s);
                ctx.beginPath();
                ctx.moveTo(cx - 7 * s, cy + 2 * s);
                ctx.quadraticCurveTo(cx - 2 * s, cy - 10 * s, cx + 4 * s, cy - 13 * s);
                ctx.moveTo(cx + 7 * s, cy + 1 * s);
                ctx.quadraticCurveTo(cx + 4 * s, cy - 8 * s, cx + 4 * s, cy - 13 * s);
                ctx.stroke();
                // Lehti
                ctx.fillStyle = '#4f9c34';
                ctx.beginPath();
                ctx.ellipse(cx + 9 * s, cy - 14 * s, 6 * s, 2.6 * s, -0.5, 0, Math.PI * 2);
                ctx.fill();
                // Marjat
                ctx.fillStyle = '#d32f2f';
                ctx.beginPath();
                ctx.arc(cx - 8 * s, cy + 8 * s, 8 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx + 7 * s, cy + 6 * s, 7.5 * s, 0, Math.PI * 2);
                ctx.fill();
                // Kiillot
                ctx.fillStyle = '#ff7b6b';
                ctx.beginPath();
                ctx.arc(cx - 10 * s, cy + 5 * s, 2.4 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(cx + 4 * s, cy + 3 * s, 2.2 * s, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'lemon': {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(-0.28);
                ctx.fillStyle = '#e8bd00';
                ctx.beginPath();
                ctx.ellipse(0, 0, 15 * s, 11 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffdd55';
                ctx.beginPath();
                ctx.ellipse(-1 * s, -1.5 * s, 11 * s, 7.5 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                // Nokat
                ctx.fillStyle = '#c9a200';
                ctx.beginPath();
                ctx.arc(-15 * s, 0, 2.6 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(15 * s, 0, 2.6 * s, 0, Math.PI * 2);
                ctx.fill();
                // Kiilto
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.beginPath();
                ctx.ellipse(-6 * s, -5 * s, 4 * s, 2.2 * s, -0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                break;
            }
            case 'bell': {
                // Kello-runko
                ctx.fillStyle = '#ffcb2e';
                ctx.beginPath();
                ctx.moveTo(cx - 12 * s, cy + 7 * s);
                ctx.quadraticCurveTo(cx - 10 * s, cy - 9 * s, cx, cy - 11 * s);
                ctx.quadraticCurveTo(cx + 10 * s, cy - 9 * s, cx + 12 * s, cy + 7 * s);
                ctx.closePath();
                ctx.fill();
                // Oikea varjo
                ctx.fillStyle = '#e0a800';
                ctx.beginPath();
                ctx.moveTo(cx + 5 * s, cy + 7 * s);
                ctx.quadraticCurveTo(cx + 10 * s, cy - 9 * s, cx, cy - 11 * s);
                ctx.quadraticCurveTo(cx + 9 * s, cy - 3 * s, cx + 5 * s, cy + 7 * s);
                ctx.closePath();
                ctx.fill();
                // Nuppi
                ctx.fillStyle = '#c99700';
                ctx.fillRect(cx - 2 * s, cy - 15 * s, 4 * s, 4 * s);
                // Reuna ja kieli
                ctx.fillStyle = '#d9a800';
                ctx.fillRect(cx - 14 * s, cy + 6 * s, 28 * s, 4 * s);
                ctx.fillStyle = '#8a6a10';
                ctx.beginPath();
                ctx.arc(cx, cy + 12 * s, 3.4 * s, 0, Math.PI * 2);
                ctx.fill();
                // Kiilto
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.beginPath();
                ctx.ellipse(cx - 5 * s, cy - 3 * s, 2.6 * s, 5 * s, 0.25, 0, Math.PI * 2);
                ctx.fill();
                break;
            }

            case 'burger': {
                // Alapulla
                ctx.fillStyle = '#c98a3f';
                this.roundRect(ctx, cx - 13 * s, cy + 8 * s, 26 * s, 8 * s, 3 * s);
                ctx.fill();
                // Pihvi
                ctx.fillStyle = '#5a3a1e';
                ctx.fillRect(cx - 14 * s, cy + 1 * s, 28 * s, 7 * s);
                // Juusto
                ctx.fillStyle = '#ffd23f';
                ctx.fillRect(cx - 13 * s, cy - 2 * s, 26 * s, 3 * s);
                // Salaatti
                ctx.fillStyle = '#57b34c';
                ctx.beginPath();
                ctx.moveTo(cx - 14 * s, cy - 3 * s);
                for (let i = 0; i <= 6; i++) {
                    ctx.lineTo(cx - 14 * s + i * 4.7 * s, cy - 3 * s + (i % 2 ? 2.4 * s : 0));
                }
                ctx.lineTo(cx + 14 * s, cy - 5 * s);
                ctx.lineTo(cx - 14 * s, cy - 5 * s);
                ctx.closePath();
                ctx.fill();
                // Yläpulla
                ctx.fillStyle = '#e0a352';
                ctx.beginPath();
                ctx.ellipse(cx, cy - 5 * s, 14 * s, 9 * s, 0, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#efb96a';
                ctx.beginPath();
                ctx.ellipse(cx - 2 * s, cy - 7 * s, 11 * s, 6 * s, 0, Math.PI, 0);
                ctx.fill();
                // Seesaminsiemenet
                ctx.fillStyle = '#fff2c2';
                const seeds = [[-7, -7], [1, -9], [8, -6], [-3, -3], [6, -2]];
                for (let i = 0; i < seeds.length; i++) {
                    ctx.fillRect(cx + seeds[i][0] * s, cy + seeds[i][1] * s, 2 * s, 2 * s);
                }
                break;
            }
            case 'diamond':
            default: {
                // Hehku
                const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 20 * s);
                glow.addColorStop(0, 'rgba(120,235,255,0.55)');
                glow.addColorStop(1, 'rgba(120,235,255,0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(cx, cy, 20 * s, 0, Math.PI * 2);
                ctx.fill();
                // Särmiö
                ctx.fillStyle = '#54d4ff';
                ctx.beginPath();
                ctx.moveTo(cx - 13 * s, cy - 4 * s);
                ctx.lineTo(cx - 7 * s, cy - 13 * s);
                ctx.lineTo(cx + 7 * s, cy - 13 * s);
                ctx.lineTo(cx + 13 * s, cy - 4 * s);
                ctx.lineTo(cx, cy + 14 * s);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#d9fbff';
                ctx.lineWidth = Math.max(1, 1.4 * s);
                ctx.stroke();
                // Hiontaviivat
                ctx.beginPath();
                ctx.moveTo(cx - 13 * s, cy - 4 * s);
                ctx.lineTo(cx + 13 * s, cy - 4 * s);
                ctx.moveTo(cx - 7 * s, cy - 13 * s);
                ctx.lineTo(cx - 3 * s, cy - 4 * s);
                ctx.moveTo(cx + 7 * s, cy - 13 * s);
                ctx.lineTo(cx + 3 * s, cy - 4 * s);
                ctx.moveTo(cx - 3 * s, cy - 4 * s);
                ctx.lineTo(cx, cy + 14 * s);
                ctx.moveTo(cx + 3 * s, cy - 4 * s);
                ctx.lineTo(cx, cy + 14 * s);
                ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                ctx.lineWidth = Math.max(1, 1 * s);
                ctx.stroke();
                // Kiilto
                ctx.fillStyle = 'rgba(255,255,255,0.85)';
                ctx.fillRect(cx - 5 * s, cy - 11 * s, 3 * s, 3 * s);
                break;
            }
        }
    }

    /* ── Maksutaulukko ──────────────────────────────── */
    drawPayTable(ctx, g) {
        const y = 262;
        const colW = (CAB.w - 80) / SYMBOLS.length;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '9px "Press Start 2P", monospace';

        for (let i = 0; i < SYMBOLS.length; i++) {
            const cx = CAB.x + 40 + colW * i + colW / 2;
            this.drawSymbol(ctx, SYMBOLS[i].id, cx - 16, y, 0.42);
            const triple = !g.spinning && g.winRows[0] && g.winRows[1] && g.winRows[2]
                && g.resultIds[0] === SYMBOLS[i].id;
            ctx.fillStyle = triple ? COL.good : COL.gold;
            ctx.fillText('x' + SYMBOLS[i].pay, cx + 14, y + 1);
        }

        // Parin sääntö
        ctx.fillStyle = COL.dim;
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillText('KAKSI SAMAA = PANOS TAKAISIN', CANVAS_W / 2, 292);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    /* ── Viestirivi ─────────────────────────────────── */
    drawMessage(ctx, g) {
        if (!g.message) return;
        const y = 318;
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(g.message).width;
        ctx.fillStyle = 'rgba(10,8,18,0.9)';
        this.roundRect(ctx, CANVAS_W / 2 - w / 2 - 14, y - 15, w + 28, 30, 8);
        ctx.fill();
        ctx.strokeStyle = g.messageKind === 'good' ? COL.good
            : (g.messageKind === 'bad' ? COL.bad : COL.cabEdge);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = g.messageKind === 'good' ? COL.good
            : (g.messageKind === 'bad' ? COL.bad : COL.text);
        ctx.fillText(g.message, CANVAS_W / 2, y + 1);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    /* ── Kolikkoalusta (pieni visuaalinen saldo) ────── */
    drawCoinTray(ctx, g) {
        const w = 264;
        const h = 26;
        const x = CANVAS_W / 2 - w / 2;
        const y = 340;
        ctx.fillStyle = '#0b0916';
        this.roundRect(ctx, x, y, w, h, 6);
        ctx.fill();
        ctx.strokeStyle = COL.goldDim;
        ctx.lineWidth = 2;
        ctx.stroke();

        const n = Math.min(8, g.coins);
        for (let i = 0; i < n; i++) {
            const cx = x + 20 + i * 26;
            const cy = y + h / 2;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.ellipse(cx, cy, 8, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#b58a00';
            ctx.beginPath();
            ctx.ellipse(cx, cy, 5.5, 6.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffe98a';
            ctx.fillRect(cx - 1, cy - 4, 2, 8);
        }
        if (g.coins > 8) {
            ctx.fillStyle = COL.gold;
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('+' + (g.coins - 8), x + 20 + 8 * 26, y + h / 2 + 1);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';
        }
    }

    /* ── Ilmaisen pyöräytyksen merkki (talon tarjoama) ──
       Käytettävissä → kultainen pulssi; muuten jäljellä oleva jäädytysaika */
    drawFreeSpin(ctx, g) {
        const x = 38, y = 108, w = 64, h = 34;
        const ready = g.freeSpinAvailable;
        ctx.save();
        ctx.fillStyle = ready ? 'rgba(24,40,26,0.95)' : 'rgba(16,13,26,0.9)';
        this.roundRect(ctx, x, y, w, h, 6);
        ctx.fill();
        if (ready) {
            const pulse = 0.55 + 0.45 * Math.sin(g.time * 6);
            ctx.strokeStyle = 'rgba(125,255,155,' + pulse.toFixed(2) + ')';
            ctx.lineWidth = 2.5;
        } else {
            ctx.strokeStyle = 'rgba(106,88,168,0.55)';
            ctx.lineWidth = 1.5;
        }
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '7px "Press Start 2P", monospace';
        if (ready) {
            ctx.fillStyle = COL.good;
            ctx.fillText('ILMAINEN', x + w / 2, y + h / 2 + 1);
        } else {
            ctx.fillStyle = COL.dim;
            ctx.fillText('ILMAINEN', x + w / 2, y + 11);
            ctx.fillStyle = '#6a5f8a';
            ctx.fillText(g.formatFreeSpinIn(), x + w / 2, y + 24);
        }
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    /* ── Vipu (pyöräytyksen aikana vedetty) ─────────── */
    drawLever(ctx, g) {
        // Jalusta
        ctx.fillStyle = '#2b2740';
        this.roundRect(ctx, LEVER.x - 16, LEVER.baseY - 12, 32, 26, 6);
        ctx.fill();
        ctx.strokeStyle = COL.cabEdge;
        ctx.lineWidth = 2;
        ctx.stroke();

        const len = LEVER.baseY - LEVER.topY;
        const ang = g.spinning ? 0.55 : 0;
        ctx.save();
        ctx.translate(LEVER.x, LEVER.baseY - 10);
        ctx.rotate(ang);
        // Varsi
        ctx.strokeStyle = '#9aa0b5';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -len);
        ctx.stroke();
        // Nuppi
        ctx.fillStyle = COL.lever;
        ctx.beginPath();
        ctx.arc(0, -len - 4, LEVER.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COL.leverDark;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ff8a80';
        ctx.beginPath();
        ctx.arc(-3, -len - 7, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /* ── Kipinät ────────────────────────────────────── */
    drawSparkles(ctx, g) {
        for (let i = 0; i < g.sparkles.length; i++) {
            const s = g.sparkles[i];
            const a = Math.max(0, Math.min(1, s.life / s.maxLife));
            ctx.fillStyle = 'rgba(' + s.rgb + ',' + a.toFixed(2) + ')';
            ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
        }
    }

    /* ── Voiton välähdys ja ison voiton banneri ─────── */
    drawWinFlash(ctx, g) {
        if (g.flash > 0) {
            ctx.fillStyle = 'rgba(255,215,0,' + (g.flash * 0.2).toFixed(3) + ')';
            ctx.fillRect(CAB.x, CAB.y, CAB.w, CAB.h);
        }
        if (!g.bigWin) return;
        const w = (REEL_COUNT * WIN_W + (REEL_COUNT - 1) * WIN_GAP) + 52;
        const x = WIN_X0 - 26;
        const y = PAYLINE_Y - 48;
        const h = 42;
        const pulse = 0.6 + 0.4 * Math.sin(g.time * 9);
        ctx.fillStyle = 'rgba(20,12,4,0.88)';
        this.roundRect(ctx, x, y, w, h, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,0,' + pulse.toFixed(2) + ')';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#ffe98a';
        ctx.font = '13px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(g.bigWin, CANVAS_W / 2, y + h / 2 + 1);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }






}
