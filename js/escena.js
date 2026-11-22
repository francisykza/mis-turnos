/* Mis Turnos · Modo RPG (escena)
   Escena pixel art en canvas, sin librerías. Dos tamaños:
   · "full": ocupa toda la pantalla de inicio (resolución virtual de 160 px de ancho).
   · "band": franja de 192×112 en la pestaña Héroe.
   Ciudad según la hora real (amanecer, día, atardecer, noche), lluvia, nubes, coches
   voladores, estrellas fugaces, tu personaje con su mascota y el jefe del periodo, que
   respira, salta y te habla. Va a ~25 fps, se para con la pestaña oculta y, con
   «reducir movimiento», deja la escena casi quieta. */
(()=>{
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- utilidades ---------- */
function rng(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296)}
function hex(h){const n=parseInt(h.slice(1),16);return [n>>16,n>>8&255,n&255]}
function mix(a,b,k){const A=hex(a),B=hex(b);return `rgb(${A.map((v,i)=>Math.round(v*(1-k)+B[i]*k)).join(",")})`}
function shade(h,f){const A=hex(h);return `rgb(${A.map(v=>Math.max(0,Math.min(255,Math.round(f<0?v*(1+f):v+(255-v)*f)))).join(",")})`}
const ease=k=>1-Math.pow(1-k,3);

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
function drawAvatar(ctx, x, y, L, frame, s, flash){
  s=s||1; const dy=frame?1:0;
  const col={K:"#0b0a14",S:"#f0c3a0",Y:"#ffd34d",L:"#30364e",W:"#15161f",v:"#ffffff",H:L.H,h:L.h,V:L.V,B:L.B,b:L.b};
  const R=(px,py,w,h,c)=>{ctx.fillStyle=flash?"#ffffff":c;ctx.fillRect(Math.round(x+px*s),Math.round(y+py*s),w*s,h*s)};
  if(L.cape){R(1,10+dy,14,5,L.cape);R(2,15,12,1,L.cape)}
  SPRITE.forEach((row,py)=>{for(let px=0;px<16;px++){const ch=row[px];if(ch==="."||!col[ch])continue;
    R(px,(px>=3&&px<=12&&py<=12)?py+dy:py,1,1,col[ch])}});
  if(L.tier>=1&&!flash){ctx.globalAlpha=.3;R(4,4+dy,8,2,L.V);ctx.globalAlpha=1}
  if(L.crown){[[5,0],[7,0],[9,0],[10,0]].forEach(([a,b])=>R(a,b+dy,1,1,"#ffd34d"));R(5,1+dy,6,1,"#ffd34d")}
}
function drawPet(ctx, id, x, y, t, s){
  const R=(a,b,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x+a*s),Math.round(y+b*s),w*s,h*s)};
  if(id==="p-dron"){
    const by=reduce?0:Math.round(Math.sin(t/300)*2);
    R(0,by,12,1,(Math.floor(t/60)%2)?"#9aa3b8":"#5d6478"); R(5,by+1,2,1,"#5d6478");
    R(2,by+2,8,4,"#0b0a14"); R(3,by+3,6,2,"#22c7e6"); R(5,by+3,2,1,(Math.floor(t/400)%2)?"#ff3b6b":"#ffffff");
  } else if(id==="p-gato"){
    const tail=reduce?0:(Math.floor(t/350)%2), blink=Math.floor(t/2600)%6===0;
    R(1,0,1,1,"#f2a65a");R(5,0,1,1,"#f2a65a");R(1,1,5,3,"#f2a65a");
    if(!blink){R(2,2,1,1,"#0b0a14");R(4,2,1,1,"#0b0a14")}
    R(1,4,7,3,"#e08a3c");R(1,7,1,1,"#0b0a14");R(6,7,1,1,"#0b0a14");R(8,3-tail,1,3,"#e08a3c");
  }
}

/* ---------- jefes (se dibujan con el centro de los pies en 0,0) ---------- */
function drawBoss(ctx, b, t, hurt, hop){
  const c=hurt?"#ffffff":b.color, d=hurt?"#ffffff":shade(b.color,-.45), K="#0b0a14";
  const bob=(reduce?0:Math.round(Math.sin(t/420)*1.5))-hop;
  const R=(x,y,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect(Math.round(x),Math.round(y),w,h)};
  const blink=Math.floor(t/3100)%5===0 && (t%3100)<140;
  const eyes=(ex,ey,gap)=>{if(blink){R(ex,ey+2,4,1,K);R(ex+gap,ey+2,4,1,K)}else{R(ex,ey,4,4,"#fff");R(ex+gap,ey,4,4,"#fff");R(ex+2,ey+1,2,2,K);R(ex+gap,ey+1,2,2,K)}
    R(ex-1,ey-2,5,1,K);R(ex+gap,ey-2,5,1,K)};
  ctx.fillStyle="rgba(0,0,0,.35)"; ctx.fillRect(-18,-1,36,2);
  if(b.kind===0){
    const top=-34+bob, sq=reduce?0:Math.round(Math.sin(t/420)*1);
    for(let y=0;y<34;y++){const k=y/33, hw=Math.round(Math.sqrt(Math.max(0,1-Math.pow(1-k,2)))*(20+sq)+(k>.7?(k-.7)*14:0));
      R(-hw,top+y,hw*2,1,y>26?d:c)}
    R(-12,top+6,4,2,shade(b.color,.4));
    eyes(-10,top+10,12); R(-6,top+22,12,2,K); R(-4,top+24,2,2,"#fff"); R(2,top+24,2,2,"#fff");
  } else if(b.kind===1){
    const top=-44+bob;
    R(-1,top,2,5,K); R(-2,top-2,4,3,(Math.floor(t/500)%2)?"#ff3b6b":"#ffd34d");
    R(-12,top+5,24,16,K); R(-11,top+6,22,14,c); R(-8,top+10,16,5,K);
    const scan=reduce?3:Math.floor(t/90)%14; R(-7,top+11,14,3,hurt?"#fff":"#7a0f2a"); R(-7+scan,top+11,3,3,hurt?"#fff":"#ff3b6b");
    R(-9,top+16,18,2,d);
    R(-14,top+22,28,18,K); R(-13,top+23,26,16,d); R(-6,top+27,12,6,c); R(-4,top+29,2,2,(Math.floor(t/300)%2)?"#3dffb0":K);
    R(-19,top+24,5,12,K); R(14,top+24,5,12,K); R(-18,top+25,3,10,c); R(15,top+25,3,10,c);
    R(-10,top+40,7,4,K); R(3,top+40,7,4,K);
  } else if(b.kind===2){
    const top=-42+bob, r=17, cy=top+r+1;
    for(let y=-r-2;y<=r+2;y++){const hw=Math.round(Math.sqrt(Math.max(0,(r+2)*(r+2)-y*y)));R(-hw,cy+y,hw*2,1,K)}
    for(let y=-r;y<=r;y++){const hw=Math.round(Math.sqrt(Math.max(0,r*r-y*y)));R(-hw,cy+y,hw*2,1,c)}
    for(let y=-r+3;y<=r-3;y++){const hw=Math.round(Math.sqrt(Math.max(0,(r-3)*(r-3)-y*y)));R(-hw,cy+y,hw*2,1,hurt?"#fff":"#f4ecd8")}
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;R(Math.cos(a)*(r-5),cy+Math.sin(a)*(r-5),1,1,K)}
    const now=new Date(), sa=(reduce?0:(t/1000%60)/60)*Math.PI*2-Math.PI/2, ma=(now.getMinutes()/60)*Math.PI*2-Math.PI/2, ha=((now.getHours()%12)/12+now.getMinutes()/720)*Math.PI*2-Math.PI/2;
    for(let i=0;i<12;i++){const l=i/12*12; R(Math.cos(ma)*l,cy+Math.sin(ma)*l,1,1,K)}
    for(let i=0;i<8;i++){const l=i/8*8; R(Math.cos(ha)*l,cy+Math.sin(ha)*l,2,2,"#e5484d")}
    for(let i=0;i<13;i++){const l=i/13*13; R(Math.cos(sa)*l,cy+Math.sin(sa)*l,1,1,"#e5484d")}
    R(-8,cy-8,4,3,K); R(4,cy-8,4,3,K); R(-9,cy-10,5,1,K); R(4,cy-10,5,1,K);
    const step=reduce?0:Math.floor(t/400)%2;
    R(-6,top+r*2+3-step,3,6+step,K); R(3,top+r*2+3-(1-step),3,6+(1-step),K); R(-r-4,cy-r-3,7,5,d); R(r-3,cy-r-3,7,5,d);
  } else {
    const top=-46+bob;
    for(let i=0;i<6;i++){const off=(i%2?2:-2)+(reduce?0:Math.round(Math.sin(t/500+i)*1));
      R(-15+off,top+i*7,30,7,K); R(-14+off,top+i*7+1,28,5,i%2?c:shade(b.color,.25));
      R(-10+off,top+i*7+3,14,1,shade(b.color,-.3))}
    eyes(-9,top+9,10); R(-7,top+17,14,2,K);
    const arm=reduce?0:Math.round(Math.sin(t/300)*2);
    R(-21,top+16+arm,6,14,K); R(15,top+16-arm,6,14,K); R(-20,top+17+arm,4,12,c); R(16,top+17-arm,4,12,c);
  }
}
const BOSS_H=[36,48,44,48];

/* ---------- mundo ---------- */
const SKIES={night:["#07031a","#2a0d4a"],dawn:["#2b1a55","#ff9a66"],day:["#1c6fd1","#9fdcff"],dusk:["#3a1060","#ff5a8a"]};
function skyOf(h){return h<6||h>=21?"night":h<9?"dawn":h<18?"day":"dusk"}
function buildWorld(G){
  const R=rng(42), f=G.GR/92, W={far:[],near:[],stars:[],clouds:[],cars:[],drops:[]};
  for(let x=-2;x<G.W;){const w=8+Math.floor(R()*14), h=Math.round((18+R()*34)*f);W.far.push({x,w,h});x+=w+1}
  for(let x=-4;x<G.W;){const w=12+Math.floor(R()*18), h=Math.round((14+R()*30)*f), win=[];
    for(let yy=4;yy<h-3;yy+=5)for(let xx=3;xx<w-3;xx+=4)win.push({xx,yy,p:R()});
    W.near.push({x,w,h,win,sign:R()<.3,ant:R()<.3});x+=w+2+Math.floor(R()*5)}
  const skyH=G.GR-20;
  for(let i=0;i<Math.round(G.W*skyH/180);i++)W.stars.push({x:Math.floor(R()*G.W),y:Math.floor(R()*skyH*.8),p:R()});
  for(let i=0;i<4;i++)W.clouds.push({x:R()*G.W,y:6+R()*skyH*.45,w:16+Math.floor(R()*20),v:.004+R()*.006});
  for(let i=0;i<3;i++)W.cars.push({x:R()*G.W,y:skyH*.35+R()*skyH*.4,v:(.02+R()*.03)*(i%2?-1:1),c:["#ff3bd6","#38e8ff","#ffd34d"][i]});
  for(let i=0;i<Math.round(G.W*.6);i++)W.drops.push({x:R()*G.W,y:R()*G.H,v:.12+R()*.08,l:3+Math.floor(R()*3)});
  return W;
}
function drawWorld(ctx, G, Wd, t, dt, hour, rain){
  const k=skyOf(hour), [a,b]=SKIES[k], night=k==="night"||k==="dusk", GR=G.GR;
  const bands=14; for(let i=0;i<bands;i++){ctx.fillStyle=mix(a,b,i/(bands-1));ctx.fillRect(0,Math.floor(i*GR/bands),G.W,Math.ceil(GR/bands)+1)}
  if(k==="night"){
    Wd.stars.forEach(s=>{if(reduce||((Math.floor(t/700)+Math.floor(s.p*9))%9)){ctx.fillStyle=s.p>.7?"#fff":"#b9a8ff";ctx.fillRect(s.x,s.y,1,1)}});
    if(!reduce){const cyc=t%9000; if(cyc<600){const k2=cyc/600, sx=G.W*.2+k2*G.W*.5, sy=8+k2*18;
      for(let i=0;i<8;i++){ctx.globalAlpha=(1-i/8)*(1-k2);ctx.fillStyle="#fff";ctx.fillRect(Math.round(sx-i*2),Math.round(sy-i),1,1)}ctx.globalAlpha=1}}
  }
  // sol o luna
  const ox=G.W-28, oy=k==="day"?14:18, r=6;
  if(!night){ctx.fillStyle="rgba(255,224,138,.25)";for(let y=-r-3;y<=r+3;y++){const hw=Math.round(Math.sqrt(Math.max(0,(r+3)*(r+3)-y*y)));ctx.fillRect(ox-hw,oy+y,hw*2,1)}}
  ctx.fillStyle=night?"#f4ecd8":"#ffe08a"; for(let y=-r;y<=r;y++){const hw=Math.round(Math.sqrt(r*r-y*y));ctx.fillRect(ox-hw,oy+y,hw*2,1)}
  if(night){ctx.fillStyle=mix(a,b,.15);for(let y=-r;y<=r;y++){const hw=Math.round(Math.sqrt(r*r-y*y));ctx.fillRect(ox-hw+4,oy+y-1,hw*2,1)}}
  // nubes
  if(!night||k==="dusk") Wd.clouds.forEach(c=>{ if(!reduce) c.x=(c.x+c.v*dt)%(G.W+c.w); const x=Math.round(c.x-c.w);
    ctx.fillStyle=k==="day"?"rgba(255,255,255,.85)":"rgba(255,190,220,.5)"; ctx.fillRect(x,Math.round(c.y),c.w,3); ctx.fillRect(x+3,Math.round(c.y)-2,c.w-8,2); ctx.fillRect(x+7,Math.round(c.y)-4,Math.max(4,c.w-16),2)});
  // edificios lejanos
  ctx.fillStyle=night?"#170c30":mix(b,"#2a3550",.55);
  Wd.far.forEach(f=>ctx.fillRect(f.x,GR-f.h-8,f.w,f.h+8));
  // coches voladores
  if(night && !reduce) Wd.cars.forEach(c=>{c.x+=c.v*dt; if(c.x>G.W+10)c.x=-10; if(c.x<-10)c.x=G.W+10;
    const x=Math.round(c.x), y=Math.round(c.y), dir=c.v>0?-1:1;
    for(let i=1;i<9;i++){ctx.globalAlpha=(1-i/9)*.7;ctx.fillStyle=c.c;ctx.fillRect(x+dir*i*2,y+1,2,1)}ctx.globalAlpha=1;
    ctx.fillStyle="#0b0a14";ctx.fillRect(x-3,y,6,3);ctx.fillStyle=c.c;ctx.fillRect(x-2,y+1,4,1)});
  // edificios cercanos
  Wd.near.forEach(n=>{
    ctx.fillStyle=night?"#0d0720":mix("#1b2238",b,.15); ctx.fillRect(n.x,GR-n.h,n.w,n.h);
    if(n.ant){ctx.fillRect(n.x+Math.floor(n.w/2),GR-n.h-6,1,6);ctx.fillStyle=(Math.floor(t/700)%2)?"#ff3b6b":"#5a1020";ctx.fillRect(n.x+Math.floor(n.w/2),GR-n.h-7,1,1)}
    n.win.forEach(w=>{const on=night?(w.p>.42):(w.p>.86); if(!on)return;
      if(!reduce&&w.p>.96&&Math.floor(t/900+w.p*10)%3===0)return;
      ctx.fillStyle=w.p>.8?"#ffd34d":w.p>.6?"#38e8ff":"#ff7ad9"; ctx.fillRect(n.x+w.xx,GR-n.h+w.yy,2,2)});
    if(n.sign&&night){const on=reduce||Math.floor(t/600+n.x)%5!==0;ctx.fillStyle=on?"#ff3bd6":"#4a1240";ctx.fillRect(n.x+2,GR-n.h-4,Math.min(10,n.w-4),3);
      if(on){ctx.fillStyle="rgba(255,59,214,.18)";ctx.fillRect(n.x,GR-n.h-6,Math.min(14,n.w),7)}}
  });
  // calle
  ctx.fillStyle="#140d22"; ctx.fillRect(0,GR,G.W,G.H-GR);
  ctx.fillStyle=night?"#ff3bd6":"#c23a9e"; ctx.fillRect(0,GR,G.W,1);
  ctx.fillStyle="rgba(255,59,214,.12)"; ctx.fillRect(0,GR+1,G.W,3);
  ctx.fillStyle="#3a2d55"; const off=reduce?0:Math.floor(t/120)%12;
  for(let x=-off;x<G.W;x+=12) ctx.fillRect(x,GR+10,6,1);
  if(G.H-GR>30){ctx.fillStyle="#0c0717";ctx.fillRect(0,GR+18,G.W,G.H-GR-18)}
  // lluvia
  if(rain){ctx.fillStyle="rgba(170,200,255,.55)";
    Wd.drops.forEach(d=>{if(!reduce){d.y+=d.v*dt;d.x-=d.v*dt*.25;if(d.y>GR+2){if(Math.random()<.3){ctx.fillRect(Math.round(d.x)-1,GR,1,1);ctx.fillRect(Math.round(d.x)+1,GR,1,1)}d.y=-6;d.x=Math.random()*(G.W+20)}}
      for(let i=0;i<d.l;i++)ctx.fillRect(Math.round(d.x+i*.25),Math.round(d.y-i),1,1)})}
}

/* ---------- sonido (WebAudio, sin archivos) ---------- */
let AC=null, soundOn=true;
function ac(){if(!soundOn)return null;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume()}catch(e){AC=null}return AC}
function tone(f,d,type,vol,delay,slide){const a=ac();if(!a)return;const o=a.createOscillator(),g=a.createGain(),t=a.currentTime+(delay||0);
  o.type=type||"square";o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);
  g.gain.setValueAtTime(vol||.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+d+.02)}
const SFX={
  tap(){tone(660,.05,"square",.025)},
  open(){tone(330,.08,"triangle",.04,0,660)},
  hit(){tone(220,.14,"sawtooth",.06,0,60);tone(90,.2,"square",.05,.05)},
  crit(){tone(880,.08,"square",.05);tone(220,.2,"sawtooth",.06,.06,50)},
  coin(){tone(988,.07,"square",.035);tone(1319,.12,"square",.035,.07)},
  level(){[523,659,784,1047,1319].forEach((f,i)=>tone(f,.16,"square",.045,i*.09))},
  win(){[392,523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.16,"triangle",.06,i*.08))},
  blip(){tone(1200,.02,"square",.012)}};

/* ---------- escena ---------- */
function mount(cv, getState, mode){
  const full=mode==="full", ctx=cv.getContext("2d");
  let G, Wd;
  function size(){
    if(full){const cw=cv.clientWidth||360, ch=cv.clientHeight||640, W=160, H=Math.max(200,Math.round(W*ch/cw));
      G={W,H,GR:Math.round(H*.5),AS:3,BS:1.7,AX:14,BX:W-38,FONT:9};}
    else G={W:192,H:112,GR:92,AS:2,BS:1,AX:30,BX:150,FONT:8};
    cv.width=G.W; cv.height=G.H; ctx.imageSmoothingEnabled=false; Wd=buildWorld(G);
  }
  size();
  const onResize=()=>{if(full)size()}; addEventListener("resize",onResize);
  const fx={floats:[], parts:[], slashes:[], dash:null, hurt:0, shake:0, flash:0, glow:0, dead:0, banner:null, hop:0, bubble:null, nextTaunt:0, aFlash:0};
  let raf=0, last=0, alive=true;
  function frame(t){
    if(!alive) return;
    if(!cv.isConnected){alive=false;removeEventListener("resize",onResize);return}
    raf=requestAnimationFrame(frame);
    if(document.hidden || !cv.offsetParent || t-last<40) return; const dt=Math.min(120,t-(last||t)); last=t;
    const S=getState(); if(!S) return;
    const AVH=16*G.AS, AVY=G.GR-AVH;
    const sx=fx.shake>t&&!reduce?Math.round(Math.sin(t/18)*2):0;
    ctx.save(); ctx.translate(sx,0);
    drawWorld(ctx,G,Wd,t,dt,new Date().getHours(),S.rain);
    // el jefe salta y suelta una frase de vez en cuando
    if(S.boss&&S.boss.max&&!reduce&&t>fx.nextTaunt){fx.nextTaunt=t+7000+Math.random()*5000;fx.hop=t;
      if(S.taunts&&S.taunts.length)fx.bubble={text:S.taunts[Math.floor(Math.random()*S.taunts.length)],t0:t}}
    const hop=fx.hop&&t-fx.hop<420?Math.round(Math.sin((t-fx.hop)/420*Math.PI)*6):0;
    if(S.boss && S.boss.max && !(fx.dead>t && Math.floor(t/90)%2)){
      ctx.save(); ctx.translate(G.BX,G.GR); ctx.scale(G.BS,G.BS); drawBoss(ctx,S.boss,t,fx.hurt>t,hop); ctx.restore();
    }
    if(S.boss && !S.boss.max){ctx.fillStyle="#fff";ctx.font=`bold ${G.FONT-1}px monospace`;ctx.textAlign="center";ctx.fillText("Sin jefe",G.BX,G.GR-20)}
    // personaje
    let ax=G.AX;
    const reach=G.BX-G.AX-AVH-12*G.BS;
    if(fx.dash){const k=(t-fx.dash)/650; if(k>=1)fx.dash=null; else ax=G.AX+Math.round((k<.38?ease(k/.38):k<.55?1:1-ease((k-.55)/.45))*reach)}
    if(fx.glow>t){const rr=AVH*.7+((fx.glow-t)/30)%8;for(let i=0;i<12;i++){const a=i/12*Math.PI*2+t/260;ctx.fillStyle=i%2?"rgba(255,211,77,.6)":"rgba(56,232,255,.5)";ctx.fillRect(Math.round(ax+AVH/2+Math.cos(a)*rr)-1,Math.round(AVY+AVH/2+Math.sin(a)*rr)-1,3,3)}}
    if(S.look.pet){const ps=Math.max(1,G.AS-1);drawPet(ctx,S.look.pet,S.look.pet==="p-dron"?ax-6*ps:ax-9*ps,S.look.pet==="p-dron"?AVY-4*ps:G.GR-8*ps,t,ps)}
    ctx.fillStyle="rgba(0,0,0,.35)"; ctx.fillRect(ax+3*G.AS,G.GR-1,10*G.AS,2);
    drawAvatar(ctx,ax,AVY,S.look,reduce?0:Math.floor(t/520)%2,G.AS,fx.aFlash>t);
    // tajos
    fx.slashes=fx.slashes.filter(s=>s.t0+260>t); fx.slashes.forEach(s=>{const k=(t-s.t0)/260;ctx.globalAlpha=1-k;ctx.fillStyle=s.c;
      for(let i=0;i<s.len;i++)ctx.fillRect(Math.round(s.x+i*s.dx),Math.round(s.y+i*s.dy),2,2);ctx.globalAlpha=1});
    // partículas
    fx.parts=fx.parts.filter(p=>p.life>t); fx.parts.forEach(p=>{const k=1-(p.life-t)/p.d;ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x+p.vx*k*34),Math.round(p.y+p.vy*k*34+k*k*24),2,2)});
    // textos flotantes
    ctx.textAlign="center";
    fx.floats=fx.floats.filter(f=>f.t0+1600>t); fx.floats.forEach(f=>{const k=(t-f.t0)/1600, pop=k<.12?1+(1-k/.12)*.6:1;
      ctx.font=`bold ${Math.round((f.big?G.FONT+3:G.FONT)*pop)}px monospace`;ctx.globalAlpha=Math.max(0,1-k*k);
      const y=f.y-(reduce?0:ease(k)*20);ctx.fillStyle="#0b0a14";ctx.fillText(f.text,f.x+1,y+1);ctx.fillStyle=f.c;ctx.fillText(f.text,f.x,y);ctx.globalAlpha=1});
    // bocadillo del jefe
    if(fx.bubble&&t-fx.bubble.t0<3200&&S.boss&&S.boss.max){
      ctx.font=`bold ${G.FONT-1}px monospace`; const tw=Math.ceil(ctx.measureText(fx.bubble.text).width)+8, bh=G.FONT+5;
      const bx=Math.max(2,Math.min(G.W-tw-2,G.BX-tw/2)), by=G.GR-BOSS_H[S.boss.kind]*G.BS-bh-8;
      const n=Math.min(fx.bubble.text.length,Math.floor((t-fx.bubble.t0)/40));
      ctx.fillStyle="#0b0a14";ctx.fillRect(bx-1,by-1,tw+2,bh+2);ctx.fillStyle="#fff";ctx.fillRect(bx,by,tw,bh);ctx.fillRect(Math.round(G.BX)-2,by+bh,4,3);
      ctx.fillStyle="#0b0a14";ctx.textAlign="left";ctx.fillText(fx.bubble.text.slice(0,n),bx+4,by+bh-4);ctx.textAlign="center";
    }
    ctx.restore();
    // destello de pantalla y cartel
    if(fx.flash>t){ctx.fillStyle=`rgba(255,255,255,${((fx.flash-t)/160)*.55})`;ctx.fillRect(0,0,G.W,G.H)}
    if(fx.banner&&t-fx.banner.t0<2200){const k=(t-fx.banner.t0)/2200, h=G.FONT*3+6, y=Math.round(G.GR*.32);
      const w=Math.round(G.W*Math.min(1,k*6)); ctx.fillStyle="rgba(11,10,20,.82)";ctx.fillRect((G.W-w)/2,y-h/2,w,h);
      ctx.fillStyle=fx.banner.c;ctx.fillRect((G.W-w)/2,y-h/2,w,1);ctx.fillRect((G.W-w)/2,y+h/2-1,w,1);
      if(k>.12){ctx.font=`bold ${G.FONT+5}px monospace`;ctx.textAlign="center";ctx.globalAlpha=k>.85?(1-k)/.15:1;
        ctx.fillStyle="#0b0a14";ctx.fillText(fx.banner.text,G.W/2+1,y+5);ctx.fillStyle=fx.banner.c;ctx.fillText(fx.banner.text,G.W/2,y+4);ctx.globalAlpha=1}}
  }
  raf=requestAnimationFrame(frame);
  const now=()=>performance.now();
  const burst=(x,y,cols,n)=>{for(let i=0;i<n;i++)fx.parts.push({x,y,vx:(Math.random()-.5)*2,vy:-Math.random()*1.5,c:cols[i%cols.length],life:now()+700+Math.random()*400,d:1000})};
  const bossTop=()=>{const S=getState();return S&&S.boss?G.GR-BOSS_H[S.boss.kind]*G.BS:G.GR-40};
  const AVc=()=>({x:G.AX+8*G.AS,y:G.GR-16*G.AS});
  return {
    attack(text,crit){const t=now();fx.dash=t;SFX[crit?"crit":"hit"]();
      setTimeout(()=>{const t2=now(), mid=(G.GR+bossTop())/2;fx.hurt=t2+200;fx.shake=t2+260;fx.flash=t2+160;
        for(let i=0;i<3;i++)fx.slashes.push({x:G.BX-16*G.BS+i*4,y:mid-16+i*3,dx:1.2,dy:1,len:Math.round(22*G.BS),c:i===1?"#ffd34d":"#fff",t0:t2+i*40});
        burst(G.BX,mid,["#ffd34d","#ff3b6b","#fff"],24);
        fx.floats.push({text:text||"-1",x:G.BX,y:bossTop()-4,c:"#ff3b6b",t0:t2,big:true});
        if(crit)fx.floats.push({text:"¡CRÍTICO!",x:G.BX,y:bossTop()-4-G.FONT*2,c:"#ffd34d",t0:t2+80,big:true});
        if(navigator.vibrate)try{navigator.vibrate([12,30,20])}catch(e){}
      },reduce?0:250)},
    gain(text,c,delay){setTimeout(()=>{const a=AVc();fx.aFlash=now()+120;fx.floats.push({text,x:a.x,y:a.y-4,c:c||"#38e8ff",t0:now()})},delay||0)},
    coin(text){setTimeout(()=>{SFX.coin();const a=AVc();burst(a.x,a.y,["#ffd34d","#fff3b0"],10);fx.floats.push({text:"+"+text.replace("+","")+" ◆",x:a.x+G.AS*6,y:a.y+G.FONT+2,c:"#ffd34d",t0:now()})},450)},
    level(){fx.glow=now()+2000;SFX.level();const a=AVc();burst(a.x,a.y+10,["#ffd34d","#38e8ff","#ff3bd6"],34);fx.banner={text:"¡SUBES DE NIVEL!",c:"#ffd34d",t0:now()}},
    defeat(){fx.dead=now()+1500;SFX.win();burst(G.BX,G.GR-30,["#ffd34d","#ff3bd6","#38e8ff","#3dffb0"],50);fx.banner={text:"¡VICTORIA!",c:"#3dffb0",t0:now()+300}},
    say(text){fx.bubble={text,t0:now()};fx.hop=now()},
    destroy(){alive=false;cancelAnimationFrame(raf);removeEventListener("resize",onResize)}
  };
}

/* Avatar suelto (retratos, ventanas de nivel, tienda) */
function paint(cv, look, frame){
  const ctx=cv.getContext("2d"); ctx.imageSmoothingEnabled=false; ctx.clearRect(0,0,cv.width,cv.height);
  const s=Math.floor(cv.width/16); drawAvatar(ctx,Math.floor((cv.width-16*s)/2),Math.floor((cv.height-16*s)/2),look,frame,s);
}

window.MTScene={mount, paint, sfx:SFX, setSound(on){soundOn=!!on}};
})();
