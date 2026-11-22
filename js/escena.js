/* Mis Turnos · Modo RPG (escena)
   Escena pixel art en canvas, sin librerías: la ciudad según la hora real, tu personaje,
   su mascota y el jefe del periodo. Se dibuja a baja resolución (192×112) y se amplía con
   image-rendering: pixelated. Va a ~20 fotogramas por segundo y se para si la pestaña
   está oculta. Con «reducir movimiento» no hay saltos ni balanceos. */
(()=>{
const W=192, H=112, GROUND=92;
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- personaje (16×16) ---------- */
const SPRITE=[
  "................",
  ".....KKKKKK.....",
  "....KHHHHHHK....",
  "...KHHHHHHhhK...",
  "...KHVVVVVVhK...",
  "...KHVvVVvVhK...",
  "...KSSSSSSSSK...",
  "....KSSKKSSK....",
  ".....KKKKKK.....",
  "...KKBBBBBBKK...",
  "..KBBBBYYBBBbK..",
  "..KBBBBBBBBBbK..",
  "..KSKBBBBBBKSK..",
  "...K.KbBBbK.K...",
  "....KLLKKLLK....",
  "....KWWK.KWWK..."];
function drawAvatar(ctx, x, y, L, frame, s){
  s=s||1; const dy=frame?1:0;
  const col={K:"#0b0a14",S:"#f0c3a0",Y:"#ffd34d",L:"#30364e",W:"#15161f",v:"#ffffff",H:L.H,h:L.h,V:L.V,B:L.B,b:L.b};
  const R=(px,py,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x+px*s),Math.round(y+py*s),w*s,h*s)};
  if(L.cape){R(1,10+dy,14,5,L.cape);R(2,15,12,1,L.cape)}
  SPRITE.forEach((row,py)=>{for(let px=0;px<16;px++){const ch=row[px];if(ch==="."||!col[ch])continue;
    R(px,(px>=3&&px<=12&&py<=12)?py+dy:py,1,1,col[ch])}});
  if(L.tier>=1){ctx.globalAlpha=.3;R(4,4+dy,8,2,L.V);ctx.globalAlpha=1}
  if(L.crown){[[5,0],[7,0],[9,0],[10,0]].forEach(([a,b])=>R(a,b+dy,1,1,"#ffd34d"));R(5,1+dy,6,1,"#ffd34d")}
}
function drawPet(ctx, id, x, y, t){
  const R=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x+a*2),Math.round(y+b*2),w*2,h*2)}; // a escala 2, como el personaje
  if(id==="p-dron"){
    const by=reduce?0:Math.round(Math.sin(t/300)*2);
    R(0,by,12,1,"#9aa3b8"); R(5,by+1,2,1,"#5d6478");
    R(2,by+2,8,4,"#0b0a14"); R(3,by+3,6,2,"#22c7e6"); R(5,by+3,2,1,(Math.floor(t/400)%2)?"#ff3b6b":"#ffffff");
  } else if(id==="p-gato"){
    const tail=reduce?0:(Math.floor(t/350)%2);
    R(1,0,1,1,"#f2a65a");R(5,0,1,1,"#f2a65a");R(1,1,5,3,"#f2a65a");R(2,2,1,1,"#0b0a14");R(4,2,1,1,"#0b0a14");
    R(1,4,7,3,"#e08a3c");R(1,7,1,1,"#0b0a14");R(6,7,1,1,"#0b0a14");R(8,3-tail,1,3,"#e08a3c");
  }
}

/* ---------- jefes ---------- */
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;
  const m=v=>Math.max(0,Math.min(255,Math.round(f<0?v*(1+f):v+(255-v)*f)));return `rgb(${m(r)},${m(g)},${m(b)})`}
function drawBoss(ctx, b, cx, t, hurt){
  const c=hurt?"#ffffff":b.color, d=hurt?"#ffffff":shade(b.color,-.45), K="#0b0a14";
  const bob=reduce?0:Math.round(Math.sin(t/420)*1.5);
  const R=(x,y,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect(Math.round(x),Math.round(y),w,h)};
  const eyes=(ex,ey,gap)=>{R(ex,ey,4,4,"#fff");R(ex+gap,ey,4,4,"#fff");R(ex+2,ey+1,2,2,K);R(ex+gap,ey+1,2,2,K);
    R(ex-1,ey-2,5,1,K);R(ex+gap,ey-2,5,1,K)};
  if(b.kind===0){ // babosa / hidra
    const top=GROUND-34+bob;
    for(let y=0;y<34;y++){const k=y/33, hw=Math.round(Math.sqrt(Math.max(0,1-Math.pow(1-k,2)))*20+(k>.7?(k-.7)*14:0));
      R(cx-hw,top+y,hw*2,1,y>26?d:c)}
    eyes(cx-10,top+10,12); R(cx-6,top+22,12,2,K); R(cx-4,top+24,2,2,"#fff"); R(cx+2,top+24,2,2,"#fff");
  } else if(b.kind===1){ // robot
    const top=GROUND-44+bob;
    R(cx-1,top,2,5,K); R(cx-2,top-2,4,3,(Math.floor(t/500)%2)?"#ff3b6b":"#ffd34d");
    R(cx-12,top+5,24,16,K); R(cx-11,top+6,22,14,c); R(cx-8,top+10,16,5,K); R(cx-7,top+11,14,3,hurt?"#fff":"#ff3b6b");
    R(cx-9,top+16,18,2,d);
    R(cx-14,top+22,28,18,K); R(cx-13,top+23,26,16,d); R(cx-6,top+27,12,6,c);
    R(cx-19,top+24,5,12,K); R(cx+14,top+24,5,12,K); R(cx-18,top+25,3,10,c); R(cx+15,top+25,3,10,c);
    R(cx-10,top+40,7,4,K); R(cx+3,top+40,7,4,K);
  } else if(b.kind===2){ // reloj
    const top=GROUND-42+bob, r=17, cy=top+r+1;
    for(let y=-r-2;y<=r+2;y++){const hw=Math.round(Math.sqrt(Math.max(0,(r+2)*(r+2)-y*y)));R(cx-hw,cy+y,hw*2,1,K)}
    for(let y=-r;y<=r;y++){const hw=Math.round(Math.sqrt(Math.max(0,r*r-y*y)));R(cx-hw,cy+y,hw*2,1,c)}
    for(let y=-r+3;y<=r-3;y++){const hw=Math.round(Math.sqrt(Math.max(0,(r-3)*(r-3)-y*y)));R(cx-hw,cy+y,hw*2,1,hurt?"#fff":"#f4ecd8")}
    const now=new Date(), ma=(now.getMinutes()/60)*Math.PI*2-Math.PI/2, ha=((now.getHours()%12)/12+now.getMinutes()/720)*Math.PI*2-Math.PI/2;
    for(let i=0;i<12;i++){const l=i/12*12; R(cx+Math.cos(ma)*l,cy+Math.sin(ma)*l,1,1,K)}
    for(let i=0;i<8;i++){const l=i/8*8; R(cx+Math.cos(ha)*l,cy+Math.sin(ha)*l,2,2,"#e5484d")}
    R(cx-8,cy-8,4,3,K); R(cx+4,cy-8,4,3,K); R(cx-9,cy-10,5,1,K); R(cx+4,cy-10,5,1,K);
    R(cx-6,top+r*2+3,3,6,K); R(cx+3,top+r*2+3,3,6,K); R(cx-r-4,cy-r-3,7,5,d); R(cx+r-3,cy-r-3,7,5,d);
  } else { // gólem de papeles
    const top=GROUND-46+bob;
    for(let i=0;i<6;i++){const off=(i%2?2:-2)+(reduce?0:Math.round(Math.sin(t/500+i)*1));
      R(cx-15+off,top+i*7,30,7,K); R(cx-14+off,top+i*7+1,28,5,i%2?c:shade(b.color,.25));
      R(cx-10+off,top+i*7+3,14,1,shade(b.color,-.3))}
    eyes(cx-9,top+9,10); R(cx-7,top+17,14,2,K);
    R(cx-21,top+16,6,14,K); R(cx+15,top+16,6,14,K); R(cx-20,top+17,4,12,c); R(cx+16,top+17,4,12,c);
  }
}

/* ---------- ciudad ---------- */
function rng(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296)}
const SKIES={night:["#0b0420","#2a0d4a"],dawn:["#2b1a55","#ff8a5c"],day:["#1c6fd1","#8fd3ff"],dusk:["#3a1060","#ff4f8b"]};
function skyOf(h){return h<6||h>=21?"night":h<9?"dawn":h<18?"day":"dusk"}
function mix(a,b,k){const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);
  const f=(s)=>Math.round(((A>>s)&255)*(1-k)+((B>>s)&255)*k);return `rgb(${f(16)},${f(8)},${f(0)})`}
const R0=rng(42), FAR=[], NEAR=[], STARS=[];
for(let x=0;x<W;){const w=10+Math.floor(R0()*16), h=18+Math.floor(R0()*34);FAR.push({x,w,h});x+=w+1}
for(let x=-4;x<W;){const w=14+Math.floor(R0()*18), h=14+Math.floor(R0()*30);const win=[];
  for(let yy=4;yy<h-3;yy+=5)for(let xx=3;xx<w-3;xx+=4)win.push({xx,yy,p:R0()});NEAR.push({x,w,h,win,sign:R0()<.25});x+=w+2+Math.floor(R0()*6)}
for(let i=0;i<40;i++)STARS.push({x:Math.floor(R0()*W),y:Math.floor(R0()*50),p:R0()});
function drawCity(ctx, t, hour){
  const k=skyOf(hour), [a,b]=SKIES[k], night=k==="night"||k==="dusk";
  for(let i=0;i<10;i++){ctx.fillStyle=mix(a,b,i/9);ctx.fillRect(0,Math.floor(i*GROUND/10),W,Math.ceil(GROUND/10)+1)}
  if(k==="night") STARS.forEach(s=>{if(reduce||((Math.floor(t/700)+Math.floor(s.p*9))%9)){ctx.fillStyle=s.p>.7?"#fff":"#b9a8ff";ctx.fillRect(s.x,s.y,1,1)}});
  ctx.fillStyle=night?"#f4ecd8":"#ffe08a"; const ox=W-30, oy=k==="day"?12:16;
  for(let y=-5;y<=5;y++){const hw=Math.round(Math.sqrt(25-y*y));ctx.fillRect(ox-hw,oy+y,hw*2,1)}
  if(night){ctx.fillStyle=mix(a,b,.15);for(let y=-5;y<=5;y++){const hw=Math.round(Math.sqrt(25-y*y));ctx.fillRect(ox-hw+3,oy+y-1,hw*2,1)}}
  ctx.fillStyle=night?"#1a0f33":mix(b,"#2a3550",.55);
  FAR.forEach(f=>ctx.fillRect(f.x,GROUND-f.h-8,f.w,f.h+8));
  NEAR.forEach(n=>{
    ctx.fillStyle=night?"#0e0820":mix("#1b2238",b,.15); ctx.fillRect(n.x,GROUND-n.h,n.w,n.h);
    n.win.forEach(w=>{const on=night?(w.p>.45):(w.p>.85); if(!on)return;
      const blink=!reduce&&w.p>.97&&Math.floor(t/900+w.p*10)%3===0; if(blink)return;
      ctx.fillStyle=w.p>.8?"#ffd34d":w.p>.6?"#38e8ff":"#ff7ad9"; ctx.fillRect(n.x+w.xx,GROUND-n.h+w.yy,2,2)});
    if(n.sign&&night){const on=reduce||Math.floor(t/600)%5!==0;ctx.fillStyle=on?"#ff3bd6":"#4a1240";ctx.fillRect(n.x+2,GROUND-n.h-4,Math.min(10,n.w-4),3)}
  });
  ctx.fillStyle="#140d22"; ctx.fillRect(0,GROUND,W,H-GROUND);
  ctx.fillStyle=night?"#ff3bd6":"#c23a9e"; ctx.fillRect(0,GROUND,W,1);
  ctx.fillStyle="#3a2d55"; const off=reduce?0:Math.floor(t/120)%12;
  for(let x=-off;x<W;x+=12) ctx.fillRect(x,GROUND+10,6,1);
}

/* ---------- sonido (WebAudio, sin archivos) ---------- */
let AC=null, soundOn=true;
function ac(){if(!soundOn)return null;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume()}catch(e){AC=null}return AC}
function tone(f,d,type,vol,delay){const a=ac();if(!a)return;const o=a.createOscillator(),g=a.createGain(),t=a.currentTime+(delay||0);
  o.type=type||"square";o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(vol||.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+d+.02)}
const SFX={
  tap(){tone(660,.06,"square",.03)},
  hit(){tone(180,.12,"sawtooth",.06);tone(90,.18,"square",.05,.05)},
  coin(){tone(988,.07,"square",.04);tone(1319,.12,"square",.04,.07)},
  level(){[523,659,784,1047].forEach((f,i)=>tone(f,.16,"square",.05,i*.1))},
  win(){[392,523,659,784,1047,1319].forEach((f,i)=>tone(f,.14,"triangle",.06,i*.08))}};

/* ---------- escena ---------- */
function mount(cv, getState){
  cv.width=W; cv.height=H;
  const ctx=cv.getContext("2d"); ctx.imageSmoothingEnabled=false;
  const fx={floats:[], parts:[], dash:null, hurt:0, shake:0, glow:0, dead:0};
  let raf=0, last=0, alive=true;
  const AVX=34, AVY=GROUND-32, BX=150;
  function frame(t){
    if(!alive) return;
    if(!cv.isConnected){alive=false;return}
    raf=requestAnimationFrame(frame);
    if(document.hidden || t-last<48) return; last=t;
    const S=getState(); if(!S) return;
    const sx=fx.shake>t&&!reduce?Math.round(Math.sin(t/20)*2):0;
    ctx.save(); ctx.translate(sx,0);
    drawCity(ctx,t,new Date().getHours());
    // jefe
    if(S.boss && S.boss.max && !(fx.dead>t && Math.floor(t/90)%2)) drawBoss(ctx,S.boss,BX,t,fx.hurt>t);
    if(S.boss && !S.boss.max){ctx.fillStyle="#ffffff";ctx.font="bold 7px monospace";ctx.textAlign="center";ctx.fillText("Sin jefe este periodo",BX,GROUND-20)}
    // personaje (con carrerilla al atacar)
    let ax=AVX;
    if(fx.dash){const k=(t-fx.dash)/650; if(k>=1)fx.dash=null; else ax=AVX+Math.round((k<.4?k/.4:k<.55?1:1-(k-.55)/.45)*62)}
    if(fx.glow>t){const r=8+((fx.glow-t)/40)%10;ctx.fillStyle="rgba(255,211,77,.35)";for(let i=0;i<8;i++){const a=i/8*Math.PI*2+t/300;ctx.fillRect(ax+16+Math.cos(a)*r*2-1,AVY+16+Math.sin(a)*r*2-1,3,3)}}
    if(S.look.pet) drawPet(ctx,S.look.pet,S.look.pet==="p-dron"?ax-22:ax-20,S.look.pet==="p-dron"?AVY-10:GROUND-16,t);
    drawAvatar(ctx,ax,AVY,S.look,reduce?0:Math.floor(t/520)%2,2);
    // efectos
    fx.parts=fx.parts.filter(p=>p.life>t); fx.parts.forEach(p=>{const k=1-(p.life-t)/p.d;ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x+p.vx*k*30),Math.round(p.y+p.vy*k*30+k*k*20),2,2)});
    ctx.textAlign="center"; ctx.font="bold 8px monospace";
    fx.floats=fx.floats.filter(f=>f.t0+1500>t); fx.floats.forEach(f=>{const k=(t-f.t0)/1500;ctx.globalAlpha=Math.max(0,1-k*k);
      const y=f.y-(reduce?0:k*18);ctx.fillStyle="#0b0a14";ctx.fillText(f.text,f.x+1,y+1);ctx.fillStyle=f.c;ctx.fillText(f.text,f.x,y);ctx.globalAlpha=1});
    ctx.restore();
  }
  raf=requestAnimationFrame(frame);
  const now=()=>performance.now();
  const burst=(x,y,cols,n)=>{for(let i=0;i<n;i++)fx.parts.push({x,y,vx:(Math.random()-.5)*2,vy:-Math.random()*1.4,c:cols[i%cols.length],life:now()+700+Math.random()*300,d:900})};
  return {
    attack(text){const t=now();fx.dash=t;SFX.hit();
      setTimeout(()=>{const t2=now();fx.hurt=t2+180;fx.shake=t2+220;burst(BX,GROUND-24,["#ffd34d","#ff3b6b","#fff"],18);fx.floats.push({text:text||"-1",x:BX,y:GROUND-50,c:"#ff3b6b",t0:t2})},reduce?0:260)},
    gain(text,c,delay){setTimeout(()=>{fx.floats.push({text,x:AVX+16,y:AVY-4,c:c||"#38e8ff",t0:now()});},delay||0)},
    coin(text){setTimeout(()=>{SFX.coin();fx.floats.push({text,x:AVX+30,y:AVY+8,c:"#ffd34d",t0:now()})},420)},
    level(){fx.glow=now()+1800;SFX.level();burst(AVX+16,AVY+10,["#ffd34d","#38e8ff","#ff3bd6"],26);fx.floats.push({text:"¡NIVEL!",x:AVX+16,y:AVY-12,c:"#ffd34d",t0:now()})},
    defeat(){fx.dead=now()+1400;SFX.win();burst(BX,GROUND-24,["#ffd34d","#ff3bd6","#38e8ff","#3dffb0"],40)},
    destroy(){alive=false;cancelAnimationFrame(raf)}
  };
}

/* Avatar suelto (tarjetas pequeñas, ventanas de nivel) */
function paint(cv, look, frame){
  const ctx=cv.getContext("2d"); ctx.imageSmoothingEnabled=false; ctx.clearRect(0,0,cv.width,cv.height);
  drawAvatar(ctx,0,0,look,frame,Math.floor(cv.width/16));
}

window.MTScene={mount, paint, sfx:SFX, setSound(on){soundOn=!!on}};
})();
