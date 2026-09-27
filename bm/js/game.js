/* ═══════════════════════════════════════════════════════════
   game.js – Blue Mäx -lentopelin ydin
   ═══════════════════════════════════════════════════════════ */
const BlueMax = (() => {
let cnv, ctx, afid, lt=0;
const W=800,H=480,GB=380,SS=1.2,FM=60,FMC=70,DM=5,BM=30,WL=12000;
const ST={T:0,TO:1,P:2,L:3,R:4,GO:5,W:6,FO:7};
let st=ST.T,stt=0,sc=0,hc=false;
let pl={x:150,y:240,wx:0,alt:2,fl:0,bm:BM,dmg:0,sp:0,al:true,ld:false,ldt:0,toClimb:0,stallT:0};
let gf=[],gt=[],ep=[],bl=[],eb=[],bmbs=[],ex=[],fb=[],pt=[];
const ks={};
let gtm=0,lst=0,nt='',ntt=0,hasKey=false,bal={wx:4700,al:false,ph:0},ky={wx:4700,gr:false},bldgDestroyed=0,flightTime=0,tB=0,allB=0;

/* ═══ ILMOITUKSET ═══════════════════════════════ */
function sn(m){nt=m;ntt=90;}

/* ═══ PELIN ALOITUS / RESET ═════════════════════ */
function iG(){
AudioFX.stopEngine();
gf=[];gt=[];ep=[];bl=[];eb=[];bmbs=[];ex=[];fb=[];pt=[];
pl={x:150,y:240,wx:0,alt:2,fl:hc?FMC:FM,bm:BM,dmg:0,sp:0,al:true,ld:false,ldt:0,toClimb:0,stallT:0};
sc=0;stt=0;gtm=0;lst=0;pl.fl=hc?FMC:FM;
hasKey=false;bal={wx:4700,al:false,ph:0};ky={wx:4700,gr:false};bldgDestroyed=0;flightTime=0;tB=0;allB=0;
cT();
}
function cT(){
gf=[];gt=[];
let afps=[1000,2300,3600,5000,7000,9000,11000];
for(let i=0;i<7;i++)gf.push({wx:afps[i],t:'af',w:160,h:40});
function oA(wx,w){for(let a of afps)if(!(wx+w<a||wx>a+160))return true;return false;}
function oW(wx,w){for(let g of gf)if((g.t==='r'||g.t==='rv')&&!(wx+w<g.wx||wx>g.wx+g.w))return true;return false;}
for(let wx=-200;wx<WL;wx+=40+Math.random()*120){
let r=Math.random();
if(r<0.30&&!oA(wx,40)&&!oW(wx,40)){gf.push({wx,t:'b',w:30+Math.random()*70,h:25+Math.random()*55,al:true,hp:2});tB++;if(Math.random()<0.5)gt.push({wx,t:'b',al:true,hp:2,pts:200});}
else if(r<0.42&&!oA(wx,200)){let ww=180+Math.random()*300;if(!oW(wx,ww))gf.push({wx,t:'r',w:ww,h:20});}
else if(r<0.52&&!oA(wx,160)){let ww=130+Math.random()*250;if(!oW(wx,ww))gf.push({wx,t:'rv',w:ww,h:40});}
}
for(let i=0;i<30;i++){let wx=500+i*350+Math.random()*150;if(afps.some(af=>Math.abs(wx-af)<160))wx+=200;if(oW(wx,10))wx+=200;gt.push({wx,t:Math.random()<0.5?'tk':'aa',al:true,hp:1,pts:100});}
}

/* ═══ PÄIVITYS ═════════════════════════════════ */
function up(dt){
if(st===ST.T||st===ST.GO||st===ST.W)return;
if(st===ST.P){pl.fl-=dt/60;if(pl.fl<=0){pl.fl=0;st=ST.FO;AudioFX.stopEngine();sn('OUT OF FUEL!');}flightTime+=dt/60;}
if(st===ST.P||st===ST.TO)hi(dt);
if(st===ST.FO){pl.y+=4*dt;pl.x-=0.6*dt;if(pl.y>GB-40)pl.alt=0;else if(pl.y>GB-200)pl.alt=1;if(pl.y>=GB){kP('OUT OF FUEL!');}}
if(st===ST.P){pl.wx+=SS*dt;if(pl.wx>=WL){pl.wx-=WL;bldgDestroyed=0;allB=0;bal.al=false;cT();}}
if(st===ST.P&&(ks['Space']||ks['KeyG'])&&gtm<=0)fG();
gtm-=dt;
uB(dt);uEB(dt);uBM(dt);uE(dt);uF(dt);uP(dt);
if(st===ST.P&&Math.random()<0.00924*dt)sEP(); // normaali spawn
uEP(dt);uGT(dt);if(!bal.al&&bldgDestroyed>=8&&flightTime>=60){bal.al=true;bal.wx=pl.wx+500+Math.random()*400;bal.ph=0;ky.wx=bal.wx;}
bal.ph+=dt*0.018;if(bal.al&&st===ST.P){let sx=bal.wx-pl.wx+200;bal.x=sx;bal.y=80+Math.sin(bal.ph)*50;ky.x=sx;ky.y=bal.y+50;}
cC();uH();
if(st===ST.L){pl.ldt+=dt/60;pl.y+=(pl.lty-pl.y)*0.12*dt;pl.x+=(pl.ltx-pl.x)*0.08*dt;if(pl.ldt>1.5){st=ST.R;stt=0;pl.fl=Math.min(pl.fl+20,hc?FMC:FM);pl.bm=BM;pl.dmg=0;pl.alt=2;AudioFX.playRefuel();sn('TANKATTU!');}}
if(st===ST.R){stt+=dt/60;if(stt>1.5){st=ST.TO;stt=0;pl.sp=0;pl.alt=2;}}
if(st===ST.TO){stt+=dt/60;pl.sp=Math.min(pl.sp+0.3*dt,8);if(stt>1.5&&pl.sp>5){st=ST.P;AudioFX.startEngine();}}
}
function hi(dt){
let mx=0,my=0,ms=2.5*dt;
if(ks['ArrowUp']||ks['KeyW'])my=-ms;
if(ks['ArrowDown']||ks['KeyS'])my=ms;
if(ks['ArrowLeft']||ks['KeyA'])mx=-ms;
if(ks['ArrowRight']||ks['KeyD'])mx=ms;
pl.x+=mx;pl.y+=my;pl.x=Math.max(30,Math.min(W-30,pl.x));pl.y=Math.max(40,Math.min(H-80,pl.y));
    if(my<-0.5&&pl.alt<3)pl.alt=3;else if(my<-0.2&&pl.alt<2)pl.alt=2;else if(my>0.2&&pl.alt>1)pl.alt=1;else if(my>0.5&&pl.alt>0&&pl.y>GB-40)pl.alt=0;
if(st!==ST.L&&pl.alt===0&&pl.y>GB){pl.y=GB;if(st===ST.P)kP('CRASH!');}
}

/* ═══ KK-TULI ══════════════════════════════════ */
function fG(){
bl.push({x:pl.x+20,y:pl.y-2,vx:6,lf:35});
AudioFX.playGun();
gtm=8;
}

/* ═══ POMMI ════════════════════════════════════ */
function dB(){
if(pl.bm<=0)return;
bmbs.push({x:pl.x,y:pl.y+10,vy:1.5,gy:GB+5,lf:200});
pl.bm--;
AudioFX.playBombDrop();
}

/* ═══ PÄIVITYS-APUFUNKTIOT ════════════════════ */
function uB(dt){for(let i=bl.length-1;i>=0;i--){let b=bl[i];b.x+=b.vx*dt;b.lf-=dt;if(b.lf<=0||b.x>W+50)bl.splice(i,1);}}
function uEB(dt){for(let i=eb.length-1;i>=0;i--){let b=eb[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.lf-=dt;if(b.lf<=0||b.x<-50||b.y<-50||b.y>H+50)eb.splice(i,1);}}
function uBM(dt){for(let i=bmbs.length-1;i>=0;i--){let b=bmbs[i];b.x+=SS*dt;b.y+=b.vy*dt;b.lf-=dt;if(b.y>=b.gy||b.lf<=0){ex.push({x:b.x,y:b.gy-10,r:0,lf:25});AudioFX.playExplosion();
  for(let t of gt){if(!t.al)continue;let sx=t.wx-pl.wx+200;if(Math.abs(sx-b.x)<60){t.hp--;if(t.hp<=0){t.al=false;sc+=t.pts;ex.push({x:sx,y:GB,r:0,lf:18});}}}
  for(let f of gf){if(f.t!=='b'||!f.al)continue;let sx=f.wx-pl.wx+200;if(Math.abs(sx-b.x)<f.w/2+30){f.hp-=2;if(f.hp<=0){f.al=false;sc+=300;bldgDestroyed++;if(bldgDestroyed>=tB&&tB>0&&!allB){allB=1;sc+=5000;sn('ALL BUILDINGS DESTROYED! +5000');}ex.push({x:sx,y:GB-6,r:0,lf:20});}}}
  bmbs.splice(i,1);}}}
function uE(dt){for(let i=ex.length-1;i>=0;i--){let e=ex[i];e.lf-=dt;e.r+=1.5*dt;if(e.lf<=0)ex.splice(i,1);}}
function uF(dt){for(let i=fb.length-1;i>=0;i--){let f=fb[i];f.lf-=dt;f.y+=f.vy*dt;f.vy+=0.05*dt;if(f.lf<=0)fb.splice(i,1);}}
function uP(dt){for(let i=pt.length-1;i>=0;i--){let p=pt[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.lf-=dt;if(p.lf<=0)pt.splice(i,1);}}
function sEP(){ep.push({x:W+50,y:60+Math.random()*300,alt:Math.floor(Math.random()*3)+1,vx:-1.8-Math.random()*2.4,vy:(Math.random()-0.5)*1.5,hp:1,sht:Math.floor(Math.random()*148)+74,tp:Math.random()<0.7?'f':'b'});} // ensilaukaus 92-276
function uEP(dt){for(let i=ep.length-1;i>=0;i--){let e=ep[i];e.x+=e.vx*dt;e.y+=e.vy*dt;if(e.y<40){e.y=40;e.vy*=-1;}if(e.y>H-60){e.y=H-60;e.vy*=-1;}e.sht-=dt;if(e.sht<=0&&e.x>50&&e.x<W){e.sht=Math.floor(Math.random()*141)+55; // uudelleen 69-244
        eb.push({x:e.x-10,y:e.y,vx:-4,vy:0,lf:60});}if(e.x<-80)ep.splice(i,1);}}
function uGT(dt){for(let t of gt){if(!t.al)continue;let sx=t.wx-pl.wx+200;if(sx<0||sx>W+100)continue;if(t.t==='tk'&&Math.random()<0.0036*dt)fb.push({x:sx,y:GB,vy:-(2+Math.random()*3),lf:40});if(t.t==='aa'&&Math.random()<0.0036*dt){let vy=-(1+Math.random()*6);eb.push({x:sx,y:GB-5,vx:1,vy,lf:55});}}}
function cC(){
if(!pl.al)return;
for(let bi=bl.length-1;bi>=0;bi--){let b=bl[bi];for(let ei=ep.length-1;ei>=0;ei--){if(Math.hypot(b.x-ep[ei].x,b.y-ep[ei].y)<18){ep[ei].hp--;bl.splice(bi,1);if(ep[ei].hp<=0){ex.push({x:ep[ei].x,y:ep[ei].y,r:0,lf:18});sc+=ep[ei].tp==='b'?200:100;sPt(ep[ei].x,ep[ei].y,8);ep.splice(ei,1);}else sPt(ep[ei].x,ep[ei].y,3);break;}}}
for(let bi=bl.length-1;bi>=0;bi--){let b=bl[bi];for(let t of gt){if(!t.al)continue;let sx=t.wx-pl.wx+200;if(Math.abs(b.x-sx)<20&&Math.abs(b.y-GB)<30){t.hp--;bl.splice(bi,1);if(t.hp<=0){t.al=false;sc+=t.pts;ex.push({x:sx,y:GB,r:0,lf:18});}break;}}}
 for(let bi=bl.length-1;bi>=0;bi--){let b=bl[bi];for(let f of gf){if(f.t!=='b'||!f.al)continue;let sx=f.wx-pl.wx+200;if(Math.abs(b.x-sx)<f.w/2+5&&b.y>GB-f.h&&b.y<GB){f.hp--;bl.splice(bi,1);if(f.hp<=0){f.al=false;sc+=300;bldgDestroyed++;if(bldgDestroyed>=tB&&tB>0&&!allB){allB=1;sc+=5000;sn('ALL BUILDINGS DESTROYED! +5000');}ex.push({x:sx,y:GB-6,r:0,lf:20});break;}}}}
for(let fi=fb.length-1;fi>=0;fi--){if(Math.hypot(fb[fi].x-pl.x,fb[fi].y-pl.y)<35){hP();fb.splice(fi,1);}}
for(let bi=eb.length-1;bi>=0;bi--){if(Math.hypot(eb[bi].x-pl.x,eb[bi].y-pl.y)<20){hP();eb.splice(bi,1);}}
for(let ei=ep.length-1;ei>=0;ei--){if(Math.hypot(ep[ei].x-pl.x,ep[ei].y-pl.y)<25){kP('COLLISION!');}}
if(bal.al){for(let bi=bl.length-1;bi>=0;bi--){if(Math.hypot(bl[bi].x-bal.x,bl[bi].y-bal.y)<35){bal.al=false;ex.push({x:bal.x,y:bal.y,r:0,lf:30});bl.splice(bi,1);sn('BALLOON HIT! -1000');sc=Math.max(0,sc-1000);}}
if(Math.hypot(pl.x-bal.x,pl.y-bal.y)<40){hP();hP();sn('DONT HIT BALLOON!');}}
if(!ky.gr&&bal.al&&Math.hypot(pl.x-ky.x,pl.y-ky.y)<18){ky.gr=true;hasKey=true;sn('KEY GRABBED!');st=ST.W;AudioFX.stopEngine();tcVis(false);AudioFX.playRuleBritannia();try{window.parent.postMessage('BM_KEY_COLLECTED','*');}catch(e){}}}
function hP(){pl.dmg++;AudioFX.playHit();sPt(pl.x,pl.y,6);if(pl.dmg>=DM)kP('DESTROYED!');}
function kP(m){pl.al=false;ex.push({x:pl.x,y:pl.y,r:0,lf:30});AudioFX.playExplosion();AudioFX.stopEngine();st=ST.GO;stt=0;sn(m);tcVis(false);setTimeout(()=>AudioFX.playGameOver(),500);}
function sPt(x,y,c){for(let i=0;i<c;i++)pt.push({x,y,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6-2,lf:10+Math.random()*15,cl:['#f40','#fa0','#ff0','#f60'][Math.floor(Math.random()*4)]});}
function uH(){
let p=Math.max(0,pl.fl/(hc?FMC:FM)*100);
document.getElementById('fuel-display').textContent=Math.ceil(pl.fl)+'s';
document.getElementById('fuel-fill-inner').style.width=p+'%';

document.getElementById('bomb-display').textContent=pl.bm;
document.getElementById('damage-display').textContent=(DM-pl.dmg);
document.getElementById('altitude-display').textContent=['MAA','MATALA','KESKI','KORKEA'][pl.alt];
}
function uN(dt){let el=document.getElementById('notification-area');if(!el)return;if(ntt>0){ntt-=dt;el.textContent=nt;el.style.opacity=Math.min(1,ntt/30);}else el.textContent='';}
/* ═══ PIIRTO ═══════════════════════════════════ */
function dr(){
ctx=cnv.getContext('2d');ctx.clearRect(0,0,W,H);
let horizonY=GB-15,sk=ctx.createLinearGradient(0,0,0,horizonY);sk.addColorStop(0,'#1a3a6e');sk.addColorStop(0.5,'#4a7ab5');sk.addColorStop(1,'#6a8aaa');ctx.fillStyle=sk;ctx.fillRect(0,0,W,horizonY);ctx.fillStyle='#4a7a3a';ctx.fillRect(0,horizonY,W,GB-horizonY);
dC();
if(st===ST.T){dTS();return;}
if(st===ST.W){dWN();return;}
if(st!==ST.T&&st!==ST.W&&st!==ST.GO)dHU();
dT();dGT();dF();dE();dEP();
if(bal.al){dBA();dKY();}
if(st!==ST.GO){dBL();dEB2();dBM2();}
dPT();if(pl.al)dPL();if(st===ST.GO)dGO();
}
function dTS(){
ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
ctx.fillStyle='#48f';ctx.font='bold 42px \"Press Start 2P\",monospace';ctx.textAlign='center';ctx.shadowColor='#48f';ctx.shadowBlur=20;ctx.fillText('BLUE MÄX',W/2,150);ctx.shadowBlur=0;
ctx.fillStyle='#fd0';ctx.font='11px \"Press Start 2P\",monospace';ctx.fillText('SOPWITH CAMEL - I MS',W/2,190);
ctx.fillStyle='#aaa';ctx.font='10px \"Press Start 2P\",monospace';
ctx.fillText('NUOLET/WASD = LENNA',W/2,250);ctx.fillText('B = POMMI   G = KK-TULI',W/2,278);
ctx.fillText('L = LASKEUDU',W/2,306);
if(Math.sin(Date.now()/500)>0){ctx.fillStyle='#fd0';ctx.font='12px \"Press Start 2P\",monospace';ctx.fillText('PAINA ENTER / TAP',W/2,360);}
ctx.fillStyle='#68a';ctx.font='8px monospace';ctx.fillText('\"Rule, Britannia!\"',W/2,430);ctx.textAlign='start';
}
function dC(){ctx.fillStyle='rgba(255,255,255,0.18)';for(let i=0;i<5;i++){let cx=((i*310+pl.wx*0.3)%(W+200))-100;let cy=50+i*40;ctx.beginPath();ctx.ellipse(cx,cy,40,15,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(cx+20,cy-8,30,12,0,0,Math.PI*2);ctx.fill();}}
function dGO(){
ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f22';ctx.font='bold 30px \"Press Start 2P\",monospace';ctx.textAlign='center';
ctx.fillText('GAME OVER',W/2,H/2-20);
ctx.fillText('PAINA ENTER / TAP',W/2,H/2+65);ctx.textAlign='start';
}
function dT(){
ctx.fillStyle='#3d6b2e';ctx.fillRect(0,GB,W,H-GB);ctx.fillStyle='#2d5b1e';ctx.fillRect(0,GB+20,W,H-GB-20);
ctx.fillStyle='#4a7a3a';for(let i=0;i<35;i++){let gx=((i*47+pl.wx*0.5)%(W+100))-50;ctx.fillRect(gx,GB-1,2,2);}
for(let f of gf){let sx=f.wx-pl.wx+200;if(sx<-100||sx>W+100)continue;
if(f.t==='b'){if(!f.al){ctx.fillStyle='#3a2a1a';ctx.fillRect(sx,GB-6,f.w,6);ctx.fillStyle='#4a3020';for(let rx=sx+2;rx<sx+f.w-4;rx+=8)ctx.fillRect(rx,GB-4,3,3);continue;}ctx.fillStyle='#6b4c3b';ctx.fillRect(sx,GB-f.h,f.w,f.h);ctx.fillStyle='#4a3020';ctx.fillRect(sx-2,GB-f.h-4,f.w+4,6);ctx.fillStyle='#fd8';for(let wy=GB-f.h+6;wy<GB-6;wy+=10)for(let wx2=sx+5;wx2<sx+f.w-5;wx2+=9)ctx.fillRect(wx2,wy,4,4);ctx.fillStyle='#3a2010';ctx.fillRect(sx+f.w/2-4,GB-12,8,12);}
if(f.t==='r'){ctx.fillStyle='#5a5a4a';ctx.fillRect(sx,GB-1,f.w,6);ctx.fillStyle='#aa8';for(let rx=sx;rx<sx+f.w;rx+=25)ctx.fillRect(rx+8,GB+1,12,2);}
if(f.t==='rv'){ctx.fillStyle='#25a';ctx.fillRect(sx,GB-3,f.w,18);ctx.fillStyle='#37c';ctx.fillRect(sx+3,GB-1,f.w-6,10);}
if(f.t==='af'){ctx.fillStyle='#8a8a7a';ctx.fillRect(sx,GB-1,f.w,25);ctx.fillStyle='#cca';for(let rx=sx+8;rx<sx+f.w-8;rx+=35)ctx.fillRect(rx,GB+5,18,2);ctx.fillStyle='#f60';ctx.beginPath();ctx.moveTo(sx+f.w/2,GB-15);ctx.lineTo(sx+f.w/2+10,GB-11);ctx.lineTo(sx+f.w/2,GB-7);ctx.fill();}
}}
function dGT(){for(let t of gt){if(!t.al)continue;let sx=t.wx-pl.wx+200;if(sx<-30||sx>W+30)continue;if(t.t==='tk'){ctx.fillStyle='#4a5a3a';ctx.fillRect(sx-10,GB-10,22,10);ctx.fillRect(sx-8,GB-13,18,5);ctx.fillStyle='#3a4a2a';ctx.fillRect(sx-4,GB-15,8,4);ctx.fillStyle='#222';ctx.fillRect(sx+3,GB-16,12,2);}if(t.t==='aa'){ctx.fillStyle='#555';ctx.fillRect(sx-6,GB-3,12,3);ctx.fillStyle='#333';ctx.fillRect(sx-1,GB-14,2,13);ctx.fillRect(sx-4,GB-14,8,2);}}}
function dPL(){
let px=Math.round(pl.x),py=Math.round(pl.y);ctx.save();ctx.translate(px,py);if(st===ST.FO)ctx.rotate(0.35);
ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.ellipse(0,GB-py+5,14,4,0,0,Math.PI*2);ctx.fill();
ctx.fillStyle='#8B7355';ctx.fillRect(-18,-2,36,5);ctx.fillStyle='#a08060';ctx.fillRect(-20,-11,40,3);ctx.fillRect(-16,5,32,3);
ctx.strokeStyle='#6b5335';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-14,-8);ctx.lineTo(-11,5);ctx.moveTo(14,-8);ctx.lineTo(11,5);ctx.stroke();
ctx.fillStyle='#444';ctx.fillRect(16,-3,5,6);
ctx.save();ctx.translate(19,0);ctx.rotate(Date.now()*0.05);ctx.fillStyle='#333';ctx.fillRect(-1,-9,2,18);ctx.restore();
ctx.fillStyle='#a08060';ctx.fillRect(-20,-1,3,3);ctx.fillStyle='#8B7355';ctx.beginPath();ctx.moveTo(-22,-1);ctx.lineTo(-27,-9);ctx.lineTo(-21,4);ctx.fill();
ctx.fillStyle='#8cf';ctx.fillRect(-4,-3,7,3);ctx.fillStyle='#c00';ctx.fillRect(-20,-14,5,3);ctx.fillStyle='#008';ctx.fillRect(-20,-13,2,1);ctx.restore();
}
function dEP(){for(let e of ep){ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y));ctx.fillStyle='#8B2500';ctx.fillRect(-14,-2,28,4);ctx.fillStyle='#a03020';ctx.fillRect(-16,-9,32,3);ctx.fillRect(-12,4,24,3);ctx.strokeStyle='#6b1500';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-11,-6);ctx.lineTo(-8,4);ctx.moveTo(11,-6);ctx.lineTo(8,4);ctx.stroke();ctx.fillStyle='#333';ctx.fillRect(-16,-3,4,5);ctx.fillStyle='#a03020';ctx.fillRect(14,-1,3,3);ctx.fillStyle='#111';ctx.fillRect(-2,-5,3,2);ctx.fillRect(-1,-6,2,4);ctx.restore();}}
function dBL(){ctx.fillStyle='#ff4';for(let b of bl)ctx.fillRect(Math.round(b.x),Math.round(b.y),4,1);}
function dEB2(){ctx.fillStyle='#f44';for(let b of eb)ctx.fillRect(Math.round(b.x),Math.round(b.y),2,2);}
function dBM2(){for(let b of bmbs){ctx.fillStyle='#222';ctx.fillRect(Math.round(b.x)-2,Math.round(b.y)-2,4,5);ctx.fillStyle='#333';ctx.fillRect(Math.round(b.x)-1,Math.round(b.y)-4,2,3);}}
function dE(){for(let e of ex){let a=e.lf/25,r=e.r;ctx.fillStyle='rgba(255,100,0,'+a*0.5+')';ctx.beginPath();ctx.arc(Math.round(e.x),Math.round(e.y),Math.max(1,r),0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,200,0,'+a*0.7+')';ctx.beginPath();ctx.arc(Math.round(e.x),Math.round(e.y),Math.max(1,r*0.6),0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,200,'+a+')';ctx.beginPath();ctx.arc(Math.round(e.x),Math.round(e.y),Math.max(1,r*0.3),0,Math.PI*2);ctx.fill();}}
function dF(){for(let f of fb){let a=Math.min(1,f.lf/10);ctx.fillStyle='rgba(50,50,50,'+a+')';ctx.beginPath();ctx.arc(Math.round(f.x),Math.round(f.y),7,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(180,150,100,'+a+')';for(let j=0;j<4;j++){let ang=(j/4)*Math.PI*2+f.lf*0.1;ctx.fillRect(Math.round(f.x+Math.cos(ang)*8),Math.round(f.y+Math.sin(ang)*5),2,2);}}}
function dPT(){for(let p of pt){ctx.globalAlpha=p.lf/25;ctx.fillStyle=p.cl;ctx.fillRect(Math.round(p.x),Math.round(p.y),2,2);}ctx.globalAlpha=1;}
function dBA(){if(!bal.al)return;let bx=Math.round(bal.x),by=Math.round(bal.y);ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(bx,by,20,25,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,0.3)';ctx.beginPath();ctx.ellipse(bx-5,by-4,8,10,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#888';ctx.fillRect(bx-8,by+30,6,5);ctx.fillStyle='#a64';ctx.fillRect(bx-12,by+32,14,10);ctx.fillStyle='#630';ctx.fillRect(bx-4,by+30,2,20);}
function dKY(){if(ky.gr||!bal.al)return;let kx=Math.round(ky.x),kyv=Math.round(ky.y);ctx.fillStyle='#fd0';ctx.fillRect(kx-6,kyv,12,3);ctx.fillRect(kx-2,kyv-8,4,10);ctx.fillRect(kx+3,kyv-3,8,3);ctx.fillRect(kx+3,kyv+1,8,3);}
function dHU(){
    let p=Math.max(0,pl.fl/(hc?FMC:FM)),fb=pl.fl<=10&&Math.sin(Date.now()/250)>0;
    let pw=Math.floor(W/3); // 1/3 levea paneeli
    // Musta paneelitausta
    ctx.fillStyle='rgba(0,0,0,0.8)';ctx.fillRect(0,0,pw,52);
    ctx.fillStyle='rgba(60,60,60,0.5)';ctx.fillRect(0,50,pw,2);
    // Polttoainepalkki
    let bx=6,by=6,bw=pw-12,bh=12,fc=p>0.5?'#4a4':p>0.2?'#ca3':'#e33';
    if(fb)fc='#f55';
    ctx.fillStyle='#222';ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle=fc;ctx.fillRect(bx,by,Math.floor(bw*p),bh);
    ctx.font='bold 9px \"Press Start 2P\",monospace';ctx.textAlign='right';
    ctx.fillStyle=fb?'#f55':'#ccc';ctx.fillText(Math.ceil(pl.fl)+'s',pw-6,by+11);
    // Alarivi: pommit ja elamat
    ctx.textAlign='left';ctx.font='bold 8px \"Press Start 2P\",monospace';let ry=36;
    ctx.fillStyle='#ccc';ctx.fillText('\u{1f4a3}'+pl.bm,8,ry);
    ctx.fillStyle='#f66';ctx.fillText('\u{2764}\u{fe0f}'+(DM-pl.dmg),88,ry);
    let altT=['MAA','MATALA','KESKI','KORKEA'],altC=['#666','#8c6','#48f','#88f'];
    ctx.textAlign='right';ctx.fillStyle=altC[pl.alt];ctx.fillText('\u{25b2}'+altT[pl.alt],pw-8,ry);
    ctx.textAlign='start';
}
function dWN(){
ctx.fillStyle='rgba(0,0,20,0.85)';ctx.fillRect(0,0,W,H);
ctx.fillStyle='#fd0';ctx.font='bold 18px "Press Start 2P",monospace';ctx.textAlign='center';
ctx.fillText('MISSION COMPLETE!',W/2,50);
ctx.fillStyle='#fff';ctx.font='10px "Press Start 2P",monospace';
ctx.fillText('KEY SECURED!',W/2,75);
let hx=W/2-35,hh=70,hw=70,gy=250;
ctx.fillStyle='#4a3020';ctx.fillRect(hx,gy-hh,hw,hh);
ctx.fillStyle='#6b4c3b';ctx.fillRect(hx+5,gy-hh+5,hw-10,hh-5);
ctx.fillStyle='#2a1a10';ctx.beginPath();ctx.moveTo(hx-8,gy-hh);ctx.lineTo(hx+hw/2,gy-hh-35);ctx.lineTo(hx+hw+8,gy-hh);ctx.fill();
ctx.fillStyle='#fd8';ctx.fillRect(hx+12,gy-35,12,18);ctx.fillRect(hx+hw-24,gy-35,12,18);
ctx.fillStyle='#6b3a2a';ctx.fillRect(hx+hw/2-8,gy-20,16,18);
ctx.fillStyle='#ff8';ctx.fillRect(hx+hw/2-9,gy-8,10,3);
ctx.fillStyle='#fd0';ctx.font='28px sans-serif';
ctx.fillText('🔑',W/2-7,gy-22);

ctx.fillStyle='#fd0';ctx.font='10px "Press Start 2P",monospace';
ctx.fillText('SCORE: '+sc,W/2,338);
if(allB){ctx.fillStyle='#ff0';ctx.font='9px "Press Start 2P",monospace';ctx.fillText('ALL BUILDINGS BONUS!',W/2,360);}
if(Math.sin(Date.now()/500)>0){ctx.fillStyle='#fd0';ctx.font='10px "Press Start 2P",monospace';ctx.fillText('PAINA ENTER / TAP',W/2,400);}
ctx.textAlign='start';
}

/* ═══ INPUT ═══════════════════════════════════ */
function kD(e){ks[e.code]=true;if(e.code==='Space'){let nw=Date.now();if(nw-lst<300&&st===ST.P&&pl.bm>0)dB();lst=nw;e.preventDefault();}if(e.code==='KeyB'&&st===ST.P&&pl.bm>0){dB();e.preventDefault();}if(e.code==='Enter'){if(st===ST.T)sG();else if(st===ST.W){try{window.parent.postMessage('RETURN_TO_STREET','*');}catch(e){}}else if(st===ST.GO)rT();e.preventDefault();}if(e.code==='KeyR'&&st===ST.W){try{window.parent.postMessage('RETURN_TO_STREET','*');}catch(e){}}if(e.code==='KeyL'&&st===ST.P)tL();}
function kU(e){ks[e.code]=false;}
function tcVis(v){let tc=document.getElementById('touch-controls');if(tc){if(v)tc.classList.remove('hidden-tc');else tc.classList.add('hidden-tc');}}
function sG(){AudioFX.init();iG();st=ST.TO;stt=0;pl.sp=0;pl.alt=2;tcVis(true);AudioFX.playRuleBritannia();setTimeout(()=>{if(st===ST.TO)AudioFX.startEngine();},2000);sn('TAKE OFF!');}
function rT(){st=ST.T;AudioFX.stopEngine();iG();tcVis(false);}
function tL(){if(pl.alt<=1&&st===ST.P){let nr=false,afx=0;for(let f of gf){if(f.t!=='af')continue;let sx=f.wx-pl.wx+200;if(Math.abs(sx-pl.x)<f.w/2+40){nr=true;afx=sx+f.w/2;break;}}if(nr){st=ST.L;pl.ldt=0;pl.alt=0;pl.ltx=afx;pl.lty=GB-2;AudioFX.playLanding();sn('LANDING...');}else sn('EI KENTTAA ALLA!');}}

/* ═══ LUUPPI ═════════════════════════════════ */
function gl(ts){if(!lt)lt=ts;let dt=(ts-lt)/16.667;lt=ts;if(dt>5)dt=5;up(dt);uN(dt);dr();afid=requestAnimationFrame(gl);}
function init(cEl){cnv=cEl;cnv.width=W;cnv.height=H;try{let r=localStorage.getItem('pimeakatu_gamestate');if(r){let gs=JSON.parse(r);hc=gs.inventory&&gs.inventory.coin===true;}}catch(e){}document.addEventListener('keydown',kD);document.addEventListener('keyup',kU);if('ontouchstart' in window||navigator.maxTouchPoints>0){let tc=document.getElementById('touch-controls');if(tc)tc.classList.add('force-show');}sTC();iG();st=ST.T;tcVis(false);rs();window.addEventListener('resize',rs);lt=performance.now();afid=requestAnimationFrame(gl);}
function sTC(){let ta=false;
  // Pommi-nappi (B)
  let bb=document.getElementById('bomb-btn');
  if(bb){let bDn=e=>{e.preventDefault();if(st===ST.P&&pl.bm>0)dB();};
   bb.addEventListener('touchstart',e=>{ta=true;bDn(e);},{passive:false});
   bb.addEventListener('mousedown',e=>{if(ta)return;bDn(e);});
   bb.addEventListener('touchend',()=>{setTimeout(()=>{ta=false;},400);});
  }
  // Konekivääri-nappi (G) – pidä pohjassa ampuaksesi
  let gb=document.getElementById('gun-btn');
  if(gb){let gDn=e=>{e.preventDefault();ks['KeyG']=true;};let gUp=e=>{e.preventDefault();ks['KeyG']=false;};let gCn=()=>{ks['KeyG']=false;};
   gb.addEventListener('touchstart',e=>{ta=true;gDn(e);},{passive:false});
   gb.addEventListener('touchend',e=>{gUp(e);setTimeout(()=>{ta=false;},400);},{passive:false});
   gb.addEventListener('touchcancel',e=>{gCn();setTimeout(()=>{ta=false;},400);},{passive:false});
   gb.addEventListener('mousedown',e=>{if(ta)return;gDn(e);});
   gb.addEventListener('mouseup',e=>{if(ta)return;gUp(e);});
   gb.addEventListener('mouseleave',()=>{if(ta)return;gCn();});
  }
  // Laskeudu-nappi (L)
  let lb=document.getElementById('land-btn');
  if(lb){let lDn=e=>{e.preventDefault();if(st===ST.P)tL();};
   lb.addEventListener('touchstart',e=>{ta=true;lDn(e);},{passive:false});
   lb.addEventListener('mousedown',e=>{if(ta)return;lDn(e);});
   lb.addEventListener('touchend',()=>{setTimeout(()=>{ta=false;},400);});
  }
  // Suuntanäppäimet
  document.querySelectorAll('.touch-btn[data-dir]').forEach(b=>{let km={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};let d=e=>{e.preventDefault();ks[km[b.dataset.dir]]=true;};let u=e=>{e.preventDefault();ks[km[b.dataset.dir]]=false;};let c=()=>{ks[km[b.dataset.dir]]=false;};
   b.addEventListener('touchstart',e=>{ta=true;d(e);},{passive:false});
   b.addEventListener('touchend',e=>{u(e);setTimeout(()=>{ta=false;},400);},{passive:false});
   b.addEventListener('touchcancel',e=>{c();setTimeout(()=>{ta=false;},400);},{passive:false});
   b.addEventListener('mousedown',e=>{if(ta)return;d(e);});
   b.addEventListener('mouseup',e=>{if(ta)return;u(e);});
   b.addEventListener('mouseleave',()=>{if(ta)return;c();});
  });
  // Canvas-tap
  let cd=e=>{if(st===ST.T)sG();else if(st===ST.W){try{window.parent.postMessage('RETURN_TO_STREET','*');}catch(e){}}else if(st===ST.GO)rT();};
  cnv.addEventListener('touchstart',e=>{ta=true;cd(e);},{passive:false});
  cnv.addEventListener('mousedown',e=>{if(ta)return;cd(e);});
 }
function rs(){
if(!cnv)return;
cnv.width=W;cnv.height=H;
}
function destroy(){if(afid)cancelAnimationFrame(afid);document.removeEventListener('keydown',kD);document.removeEventListener('keyup',kU);AudioFX.stopEngine();}
return{init,rs,destroy};
})();
