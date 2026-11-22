/* Mis Turnos · Modo RPG · «La jornada»
   La puerta de tu trabajo en pixel art: nave de ladrillo, reloj de fichar, farola,
   la garita de Paco (el vigilante) y Mancha (la gata). El cielo sigue la hora real y
   puede llover. Fichar es una escena: tu personaje camina al reloj, mete la tarjeta,
   suena el «clac», se sube la persiana y entra; al salir, ficha y se va calle abajo.
   Cada cierto tiempo pasa algo (repartidor, apagón, estrella fugaz, Mancha trae algo).

   MTNight.mount(canvas, get) · get() devuelve {mode, rain, ficha, look}
     mode: "in" (te espera fuera) · "work" (estás dentro) · "done" (ya te fuiste) · "off" (no toca)
   La escena detecta el cambio de modo y anima la transición (entrar o salir).
   Va a ~30 fps, se para con la pestaña oculta y respeta «reducir movimiento». */
(()=>{
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const W=100, BASE=140;

/* ---------- sonido (sin archivos) ---------- */
let ac=null, soundOn=true;
function ctx(){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();if(ac.state==="suspended")ac.resume()}catch(e){ac=null}return ac}
function tone(f,d,type,vol,delay){if(!soundOn)return;const a=ctx();if(!a)return;const t0=a.currentTime+(delay||0),o=a.createOscillator(),g=a.createGain();o.type=type||"square";o.frequency.setValueAtTime(f,t0);g.gain.setValueAtTime(vol||.03,t0);g.gain.exponentialRampToValueAtTime(.0001,t0+d);o.connect(g).connect(a.destination);o.start(t0);o.stop(t0+d+.02)}
function noise(d,vol){if(!soundOn)return;const a=ctx();if(!a)return;const b=a.createBuffer(1,Math.max(1,a.sampleRate*d|0),a.sampleRate),dd=b.getChannelData(0);for(let i=0;i<dd.length;i++)dd[i]=(Math.random()*2-1)*Math.pow(1-i/dd.length,3);const s=a.createBufferSource(),g=a.createGain();g.gain.value=vol;s.buffer=b;s.connect(g).connect(a.destination);s.start()}
const SFX={
  clac(){noise(.08,.35);tone(660,.12,"triangle",.05,.12);tone(990,.22,"triangle",.05,.21)},
  shutter(){noise(.35,.06)},
  blip(f){tone(f||200,.04,"square",.02)},
  coin(){tone(1320,.08,"square",.03);tone(1760,.14,"square",.03,.08)},
  level(){[523,659,784,1047].forEach((f,i)=>tone(f,.18,"square",.035,i*.11))},
  star(){tone(1500,.35,"sine",.03)},
  step(){tone(90,.03,"triangle",.03)}
};

/* ---------- paletas por hora ---------- */
const PAL={
 noche:{sky:["#0a0b1a","#0f1127","#151936","#1e2346"],far:"#161936",fw:"#f2c66d",wp:.25,brick:"#3a2532",mortar:"#2c1b27",side:"#23233d",road:"#121326",lamp:1,stars:1,moon:1,booth:"#2a3446",breath:1,tv:1},
 alba:{sky:["#231d47","#45305f","#8a4c6c","#e08d68"],far:"#2b2348",fw:"#f2c66d",wp:.1,brick:"#55313d",mortar:"#462832",side:"#3a3152",road:"#251f3a",lamp:1,stars:0,moon:0,booth:"#3a3f5a",breath:1,tv:1},
 dia:{sky:["#5f86c0","#7b9ccf","#9bb5dd","#bfd0ea"],far:"#5a6d92",fw:"#cfd9ea",wp:0,brick:"#7a4648",mortar:"#663a3d",side:"#666d88",road:"#474d66",lamp:0,stars:0,moon:0,booth:"#6a7896",breath:0,tv:0},
 gris:{sky:["#56657f","#6a7893","#8190a8","#9aa8bd"],far:"#47526d",fw:"#d9c690",wp:.04,brick:"#6a3e46",mortar:"#58333a",side:"#4b5370",road:"#353b54",lamp:0,stars:0,moon:0,booth:"#56627c",breath:0,tv:1}
};
function palFor(h,rain){if(h>=21||h<6)return "noche";if(h<8||h>=19)return "alba";return rain?"gris":"dia"}

/* ---------- sprites ---------- */
const BODY=[".....kkkkkk.....","....kkkkkkkk....","...kkkkkkkkkk...","...KKKKKKKKKK...","...hhhhhhhhhh...","...hssssssssh...","...hssssssssh...","...hssssssssh...","...hssssssssh...","...hssssssssh...","....ssssssss....","....SSSSSSSS....","...yyyyyyyyyy...","..yyyyyyyyyyyy..","..jjyYjjzjjjjj..",".jjjyYjjzjjjjjj.",".jjjyYjjzjjjjjj.","jjjjjjjjzjjjjjjj","jJjjjjjjzjjjjjJj","jJjjjjjjzjjjljJj","jJjjjjjjzjjjjjJj","sJjjjjjjzjjjjjJs","s.JJJJJJJJJJJJ.s","..pppppppppppp..","..pppppPPppppp.."];
const LEG0=["..ppppp..ppppp..","..ppppp..ppppp..","..ppppp..ppppp..","..ppppp..ppppp..","..bbbbb..bbbbb..",".bbbbbb..bbbbbb.",".BBBBBB..BBBBBB."];
const LEGA=["..ppppp..ppppp..",".ppppp...ppppp..",".pppp.....pppp..","pppp......ppppp.","bbbbb.....bbbbb.","bbbbbb....bbbbbb","BBBBBB....BBBBBB"];
const LEGB=LEGA.map(s=>[...s].reverse().join(""));
const CAT_SLEEP=["............","..c..c......","..cccc......",".ccccccccc..",".cwcccccccc.","cccccccccccc","cccccccccccc",".cccccccccc."];
const CAT_SIT=[".c..c.......",".cccc......t",".ycyc......t",".cccc.....t.","..ccccccc.t.","..cccccccct.","..cccccccc..","..c.c..c.c.."];
const CAT_WALK=["..........c.c","t.........ccc","t.........cyc",".t.cccccccccc","..ccccccccc..","..ccccccccc..","..c..c..c..c.","..c...c..c..."];
function heroPal(L){
  L=L||{};
  return {k:L.hat||"#c0504d",K:L.hat2||"#8f3a38",h:"#2b1d1a",s:"#e0a77c",S:"#c48964",y:L.scarf||"#e8c25a",Y:L.scarf2||"#b8922f",
    j:L.coat||"#3d5a80",J:L.coat2||"#2c4263",z:"#8fa3c0",l:"#f2e8c9",p:"#2f3a5c",P:"#232b47",b:"#3a2a20",B:"#15100c"};
}

/* ---------- retratos 16×16 para el cuadro de diálogo ---------- */
function face(c2,who,exp){
  c2.clearRect(0,0,16,16);
  const put=(m,pal)=>m.forEach((row,y)=>[...row].forEach((ch,x)=>{if(pal[ch]){c2.fillStyle=pal[ch];c2.fillRect(x,y,1,1)}}));
  if(who==="paco"){
    const m=["....kkkkkkkk....","...kkkkBkkkkk...","..kkkkkkkkkkkk..","..KKKKKKKKKKKK..","..gssssssssssg..","..gsSSssssSSsg..","..ssssssssssss..","..ssssssssssss..","..sssssSSsssss..","..ssmmmmmmmmss..","..ssmmssssmmss..","...ssssssssss...","....ssssssss....","..ccccsssscccc..",".cccccccccccccc.","cccccccBcccccccc"].map(r=>[...r]);
    if(exp==="sleepy")[4,5,10,11].forEach(c=>{m[6][c]="S";m[7][c]="e"});
    else if(exp==="happy"){m[6][4]="e";m[6][11]="e";m[5][5]="e";m[5][10]="e";m[11][6]="S";m[11][9]="S"}
    else if(exp==="shock"){[4,5,10,11].forEach(c=>{m[6][c]="e";m[7][c]="e"});m[11][7]="e";m[11][8]="e"}
    else [4,5,10,11].forEach(c=>m[6][c]="e");
    put(m.map(r=>r.join("")),{k:"#2c3e66",K:"#1c2847",B:"#e8c25a",s:"#d79a73",S:"#b97a58",e:"#1a1420",m:"#6a5a54",g:"#9a9aa8",c:"#3b5486"});
  }else{
    const m=["................","..cc......cc....","..ccc....ccc....","..cpcc..ccpc....","..cccccccccc....",".cccccccccccc...",".ccyyccccyycc...",".ccyeccccyecc...",".cccccccccccc...",".ccccccpcccccc..","..cccwcccwccc...","...cccccccc.....","..cccccccccc....",".cccccccccccc...",".cccccccccccc...","................"].map(r=>[...r]);
    if(exp==="sleepy")[3,4,9,10].forEach(c=>{m[6][c]="c";m[7][c]="w"});
    put(m.map(r=>r.join("")),{c:"#1f1d2b",p:"#d98a9a",y:"#ffd34d",e:"#0a0a10",w:"#5a5a70"});
  }
}

const DIG={0:"111101101101111",1:"010110010010111",2:"111001111100111",3:"111001111001111",4:"101101111001001",5:"111100111001111",6:"111100111101111",7:"111001010010010",8:"111101111101111",9:"111101111001111"};

function mount(cv, get){
  const x=cv.getContext("2d");
  let H=BASE, oy=0;
  const R=(a,b,w,h,c)=>{x.fillStyle=c;x.fillRect(Math.round(a),Math.round(b),w,h)};
  const spr=(map,pal,ox,oy2,flip)=>{const w=map[0].length;for(let r=0;r<map.length;r++)for(let c=0;c<w;c++){const k=pal[map[r][c]];if(k)R(ox+(flip?w-1-c:c),oy2+r,1,1,k)}};

  // Tamaño: ancho virtual fijo de 100 px; el alto sale del hueco disponible.
  function resize(){
    const w=cv.clientWidth||300, h=cv.clientHeight||420;
    H=Math.max(96,Math.min(200,Math.round(h/w*W)));
    cv.width=W; cv.height=H; oy=H-BASE; build(); x.imageSmoothingEnabled=false;
  }

  /* ---- capa fija ---- */
  const bg=document.createElement("canvas");
  let P=PAL.noche, pname="", rain=false, farWins=[];
  function build(){
    bg.width=W; bg.height=BASE;
    const g=bg.getContext("2d"),r=(a,b,w,h,c)=>{g.fillStyle=c;g.fillRect(a,b,w,h)};
    let s=5;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
    P.sky.forEach((c,i)=>r(0,i*30,W,30,c));
    for(let i=1;i<4;i++)for(let xx=0;xx<W;xx++)for(let k=0;k<2;k++)if((xx+k)%2===0)r(xx,i*30-1-k*2,1,1,P.sky[i-1]);
    if(P.moon){g.fillStyle="#e9e4c8";g.beginPath();g.arc(92,31,4.5,0,7);g.fill();r(90,29,2,2,"#cfc9a8");r(93,33,1,1,"#cfc9a8")}
    if(pname==="dia"){g.fillStyle="#fff4c8";g.beginPath();g.arc(90,26,5,0,7);g.fill();[[78,14],[84,40]].forEach(([cx,cy])=>{r(cx,cy,14,3,"#e8eef8");r(cx+3,cy-2,8,2,"#e8eef8")})}
    farWins=[];
    for(let bx=64;bx<W;){const w=8+(rnd()*9|0),top=26+(rnd()*22|0);r(bx,top,w,112-top,P.far);
      for(let wy=top+3;wy<108;wy+=4)for(let wx=bx+2;wx<bx+w-1;wx+=3)if(wx>71)farWins.push({x:wx,y:wy,on:rnd()<P.wp});bx+=w+1}
    r(64,47,W,2,"#0b0c1d");r(76,49,2,63,"#0b0c1d");
    r(0,10,71,102,P.brick);
    for(let yy=12;yy<112;yy+=4){r(0,yy,71,1,P.mortar);for(let xx=((yy/4)%2?0:4);xx<71;xx+=8)r(xx,yy,1,4,P.mortar)}
    for(let i=0;i<40;i++)r(rnd()*70|0,12+rnd()*98|0,2,1,"rgba(0,0,0,.18)");
    r(0,7,72,3,"#140e18");
    r(5,14,58,8,"#25161f");for(let i=0;i<11;i++)if(rnd()<.8)r(8+i*5,16,3,4,"#4a3442");
    [[6,27],[40,27]].forEach(([wx,wy])=>{r(wx,wy,20,15,"#14121f");r(wx+1,wy+1,18,13,"#1d1b2c");r(wx+10,wy+1,1,13,"#14121f");r(wx+1,wy+7,18,1,"#14121f");r(wx-1,wy+15,22,2,"#2a1d26")});
    r(30,47,7,5,"#22182a");for(let i=0;i<3;i++)r(31,48+i*1.4,5,1,"#3b2c40");
    r(18,58,30,2,"#1c1a28");
    r(50,78,20,16,"#7d8396");r(50,78,20,1,"#a3a9ba");r(52,80,16,7,"#132119");r(55,90,10,1,"#2a2e38");r(69,79,1,15,"#5c6172");
    r(3,104,16,8,"#6b4a2f");r(3,104,16,1,"#8a6440");r(11,105,1,7,"#553a24");r(5,107,4,2,"#553a24");
    r(0,112,W,6,P.side);for(let xx=0;xx<W;xx+=10)r(xx,112,1,6,"rgba(0,0,0,.25)");
    r(0,118,W,1,"#0b0c1d");r(0,119,W,BASE-119,P.road);for(let xx=6;xx<W;xx+=22)r(xx,132,10,1,"rgba(255,255,255,.12)");
    r(86,18,2,94,"#15162a");r(75,17,13,2,"#15162a");r(72,19,9,3,"#25263c");
    r(85,55,15,3,"#161b28");r(88,58,12,54,P.booth);r(88,58,1,54,"rgba(0,0,0,.25)");r(90,65,10,22,"#0d1020");
  }
  function setPal(){
    const h=new Date().getHours(), n=palFor(h,rain);
    if(n!==pname){pname=n;P=PAL[n];build()}
  }

  /* ---- estado ---- */
  let t=0, drops=[], steam=[], puffs=[], sparks=[], floats=[], pending=[];
  for(let i=0;i<55;i++)drops.push({x:Math.random()*W,y:Math.random()*BASE,v:2.2+Math.random()*1.4});
  let mode=null, seq=null, hero={x:68,vis:true,smile:0}, shutter=0, doorLamp=0, inside=false, flash=0, shake=0, card=null, cardDone=0;
  let cat={x:5,mode:"sleep"}, blackout=0, bike=null, star=null, gift=null, look=0, lookT=0, pacoMood="normal", pacoT=0, banner=null;
  let nextEv=900+Math.random()*900, onEvent=null, ficha="0000", heroLook=null;

  // Coloca la escena tal cual, sin animación (al abrir o al deshacer)
  function place(m){
    seq=null; card=null; inside=m==="work"; hero.vis=m==="in"; hero.x=68;
    shutter=m==="work"?6:0; doorLamp=m==="work"?1:0;
    cat.mode=m==="work"?"sit":"sleep"; cat.x=5;
    released();
  }
  function released(){pending.forEach(f=>floats.push(f));pending=[]}
  function busy(){return !!seq}
  function addFloat(text,color,px,py,delay){
    const f={text,color:color||"#ffd27a",x:px,y:py,l:0,d:delay||0};
    const S=get()||{};
    if(seq||(S.mode&&S.mode!==mode)) pending.push(f); else floats.push(f);
  }

  /* ---- guion de entrada y salida ---- */
  function step(){
    if(!seq) return;
    const s=seq;
    if(s.k==="in"){
      if(s.st==="walk"){hero.x-=.55;if(t%10===0)SFX.step();if(hero.x<=52){s.st="card";card={x0:hero.x+15,y0:101,k:0}}}
      else if(s.st==="card"){if(cardDone){cardDone=0;clac();s.st="wait";s.w=40}}
      else if(s.st==="wait"){if(--s.w<=0){s.st="open";SFX.shutter()}}
      else if(s.st==="open"){shutter=Math.min(40,shutter+1);if(shutter>=40)s.st="enter"}
      else if(s.st==="enter"){hero.x-=.5;if(hero.x<=25){inside=true;hero.vis=false;s.st="close";SFX.shutter()}}
      else if(s.st==="close"){shutter=Math.max(6,shutter-1);if(shutter<=6){cat.mode="sit";seq=null;released();if(onEvent)onEvent("dentro")}}
    }else if(s.k==="out"){
      if(s.st==="open"){shutter=Math.min(40,shutter+1);if(shutter>=40){inside=false;hero.vis=true;hero.x=25;s.st="walk"}}
      else if(s.st==="walk"){hero.x+=.5;if(t%10===0)SFX.step();if(hero.x>=52){s.st="card";card={x0:hero.x+15,y0:101,k:0}}}
      else if(s.st==="card"){if(cardDone){cardDone=0;clac();s.st="close";SFX.shutter()}}
      else if(s.st==="close"){shutter=Math.max(0,shutter-1);doorLamp=0;if(shutter<=0){s.st="leave";s.w=0}}
      else if(s.st==="leave"){hero.x+=.6;if(t%10===0)SFX.step();if(hero.x>W+4){hero.vis=false;cat.mode="sleep";seq=null;released();if(onEvent)onEvent("fuera")}}
    }
  }
  function clac(){
    flash=10;shake=8;doorLamp=1;SFX.clac();hero.smile=60;pacoMood="happy";pacoT=110;
    for(let i=0;i<16;i++)sparks.push({x:59,y:88,vx:(Math.random()-.5)*2,vy:-Math.random()*2,l:20+Math.random()*16});
    released();
  }

  /* ---- sucesos ---- */
  const EV={
    reparto(){bike={x:W+6};noise(.5,.04)},
    apagon(){blackout=90;noise(.15,.2);pacoMood="shock";pacoT=90},
    regalo(){if(cat.mode==="walk")return false;cat.mode="walk";cat.dir=1;cat.to=hero.vis?Math.max(20,hero.x-14):40},
    estrella(){if(pname!=="noche")return false;star={x:98,y:4};SFX.star()}
  };
  function event(id){if(seq)return false;const r=EV[id]&&EV[id]();if(r===false)return false;if(onEvent)onEvent(id);return true}
  function randomEvent(){
    const ids=pname==="noche"?["reparto","apagon","regalo","estrella","reparto","regalo"]:["regalo","reparto"];
    event(ids[Math.random()*ids.length|0]);
  }

  /* ---- dibujo ---- */
  function digits(s,ox,oy2,c){let cx=ox;[...s].forEach((ch,i)=>{if(i===2){if(t%40<26){R(cx,oy2+1,1,1,c);R(cx,oy2+3,1,1,c)}cx+=2}const d=DIG[ch]||DIG[0];for(let k=0;k<15;k++)if(d[k]==="1")R(cx+k%3,oy2+(k/3|0),1,1,c);cx+=4})}
  function drawHero(hx,hy,walking){
    const pal=heroPal(heroLook);
    spr(BODY,pal,hx,hy);
    spr(walking?((t/5|0)%2?LEGA:LEGB):LEG0,pal,hx,hy+25);
    if(--lookT<0){look=[0,0,-1,1][Math.random()*4|0];lookT=60+Math.random()*90}
    const lk=walking?(seq&&seq.k==="out"?1:-1):look, blink=t%150<5;
    if(heroLook&&heroLook.visor){R(hx+4,hy+7,8,2,heroLook.visor);R(hx+5,hy+7,2,1,"rgba(255,255,255,.5)")}
    else if(blink){R(hx+5+lk,hy+8,2,1,"#141522");R(hx+9+lk,hy+8,2,1,"#141522")}
    else{R(hx+6+lk,hy+7,1,2,"#141522");R(hx+9+lk,hy+7,1,2,"#141522")}
    R(hx+5,hy+9,1,1,"#e58c7a");R(hx+10,hy+9,1,1,"#e58c7a");
    R(hx+7,hy+10,2,1,"#a0614a");if(hero.smile>0){R(hx+6,hy+9,1,1,"#a0614a");R(hx+9,hy+9,1,1,"#a0614a");hero.smile--}
    if(heroLook&&heroLook.drone){const dy=Math.round(Math.sin(t/8)*2);R(hx-6,hy+2+dy,5,2,"#6b7590");R(hx-5,hy+3+dy,1,1,heroLook.drone);R(hx-7,hy+1+dy,7,1,t%4<2?"#c9d1e0":"rgba(201,209,224,.3)")}
  }
  function drawPaco(px,py,exp){
    R(px,py,9,3,"#2c3e66");R(px-1,py+3,11,1,"#1c2847");R(px+4,py+1,1,1,"#e8c25a");
    R(px,py+4,9,7,"#d79a73");R(px,py+4,1,3,"#9a9aa8");R(px+8,py+4,1,3,"#9a9aa8");
    if(exp==="sleepy"){R(px+2,py+6,2,1,"#6b4a3a");R(px+5,py+6,2,1,"#6b4a3a")}
    else if(exp==="happy"){R(px+2,py+6,1,1,"#1a1420");R(px+3,py+5,1,1,"#1a1420");R(px+5,py+5,1,1,"#1a1420");R(px+6,py+6,1,1,"#1a1420")}
    else if(exp==="shock"){R(px+2,py+5,2,2,"#1a1420");R(px+5,py+5,2,2,"#1a1420");R(px+4,py+9,1,1,"#1a1420")}
    else{R(px+2,py+5,2,2,"#1a1420");R(px+5,py+5,2,2,"#1a1420");R(px+2,py+5,1,1,"#f4ebd9");R(px+5,py+5,1,1,"#f4ebd9")}
    R(px+2,py+8,5,1,"#6a5a54");R(px+1,py+9,2,1,"#6a5a54");R(px+6,py+9,2,1,"#6a5a54");
    R(px-1,py+11,11,4,"#3b5486");R(px+4,py+12,1,1,"#e8c25a");
  }
  function pacoExp(){
    if(pacoT>0){pacoT--;return pacoMood}
    if(mode==="off"||(inside&&pname==="noche")) return t%400<330?"sleepy":"normal";
    return "normal";
  }

  function frame(){
    t++;
    const S=get()||{};
    if(S.rain!==undefined&&!!S.rain!==rain){rain=!!S.rain;pname="";}
    setPal();
    if(S.ficha) ficha=S.ficha.replace(":","");
    heroLook=S.look||null;
    if(S.mode&&S.mode!==mode){
      const prev=mode; mode=S.mode;
      if(prev==="in"&&mode==="work"&&!reduce){seq={k:"in",st:"walk"};hero.vis=true;hero.x=Math.max(hero.x,52)}
      else if(prev==="work"&&mode==="done"&&!reduce){seq={k:"out",st:"open"};SFX.shutter()}
      else place(mode);
      if(prev==="in"&&mode==="work"&&reduce){place(mode);clac()}
      if(prev==="work"&&mode==="done"&&reduce){place(mode);clac()}
    }
    if(!seq&&--nextEv<0){nextEv=1500+Math.random()*1500;randomEvent()}

    const lightsOn=!blackout||(blackout<12&&t%3===0);
    x.setTransform(1,0,0,1,0,0);
    if(oy>0){x.fillStyle=P.sky[0];x.fillRect(0,0,W,oy)}
    const sx=shake?((t%2)?1:-1):0; if(shake)shake--;
    x.setTransform(1,0,0,1,sx,oy);
    x.drawImage(bg,0,0);
    if(P.stars)for(let i=0;i<14;i++){const a=72+(i*17)%28,b=(i*11)%26+2-Math.min(0,0);if((t+i*13)%90<70)R(a,b,1,1,i%3?"#8f95c9":"#e9e4c8")}
    if(P.stars&&oy>0)for(let i=0;i<10;i++){const a=(i*29)%W,b=-((i*13)%oy)-2;if((t+i*7)%100<80)R(a,b,1,1,"#8f95c9")}
    if(star){star.x-=1.6;star.y+=.6;for(let k=0;k<6;k++)R(star.x+k*1.6,star.y-k*.6,1,1,k<2?"#fff7d6":"rgba(255,247,214,.4)");if(star.x<55)star=null}
    farWins.forEach((w,i)=>{if(w.on&&lightsOn)R(w.x,w.y,1,1,P.fw);if(t%240===i%240&&Math.random()<.5)w.on=!w.on});
    if(t%700>560){const tx=W-((t%700)-560)*1.3;for(let k=0;k<3;k++){const a=tx+k*16;R(a,41,15,5,"#1c2140");for(let wx=2;wx<14;wx+=3)R(a+wx,42,2,2,lightsOn&&P.lamp?"#f6d58e":"#3a4060")}}
    // ventanas de la nave: con tu sombra trabajando si estás dentro
    if(inside&&lightsOn){R(7,28,18,13,"#f6c56b");R(16,28,1,13,"#d9a24e");R(7,34,18,1,"#d9a24e");const s2=10+Math.round(Math.sin(t/40)*3);R(s2,30,4,4,"#3a2a2a");R(s2-1,34,6,7,"#3a2a2a")}
    if(P.lamp&&lightsOn&&t%400>20){R(41,28,18,13,"#e8b860");R(50,28,1,13,"#c69244");R(41,34,18,1,"#c69244")}
    // puerta
    R(20,60,26,52,lightsOn?"#f6c56b":"#3a2f22");R(20,60,26,52,"rgba(120,70,20,.35)");
    const sh=52-shutter;R(20,60,26,sh,"#2b3048");for(let yy=60;yy<60+sh;yy+=2)R(20,yy,26,1,"#232840");R(20,59+sh,26,1,"#4a5070");
    if(shutter>0&&lightsOn)for(let yy=112;yy<Math.min(118,112+shutter);yy++)R(20,yy,26,1,"rgba(246,197,107,.25)");
    R(30,55,7,2,doorLamp&&lightsOn?"#ffd27a":"#3a3448");
    digits(ficha,53,81,!lightsOn?"#1c2a22":flash||(hero.smile>0)?"#ffd27a":"#7dffb0");
    // vapor de la rejilla
    if(t%7===0)steam.push({x:31+Math.random()*4,y:46,a:.5});
    steam.forEach(p=>{p.y-=.2;p.x+=.1+Math.sin((t+p.y)/9)*.08;p.a-=.006;if(p.a>0){x.fillStyle=`rgba(190,192,215,${p.a})`;x.fillRect(p.x|0,p.y|0,2,2)}});steam=steam.filter(p=>p.a>0);
    // farola
    if(P.lamp&&lightsOn){for(let yy=22;yy<112;yy++){const h=Math.round(3+(yy-22)*.15),i2=Math.round(h*.55);R(76-h,yy,h*2,1,"rgba(255,190,100,.06)");R(76-i2,yy,i2*2,1,"rgba(255,200,120,.06)")}
      R(72,22,9,1,"#ffd27a");x.fillStyle="rgba(255,190,100,.2)";x.beginPath();x.ellipse(76,114,14,2.5,0,0,7);x.fill()}
    // garita con Paco
    R(91,66,9,20,P.tv&&lightsOn?(Math.random()<.1?"#4b6fb8":"#33509a"):"#20283c");
    const pe=pacoExp(), nod=pe==="sleepy"&&Math.sin(t/50)>.5?1:0; drawPaco(91,68+nod,pe);
    // Mancha
    const catC=heroLook&&heroLook.cat?heroLook.cat:"#1f1d2b";
    const CP={c:catC,w:"#4a4a5c",y:"#ffd34d",t:catC};
    if(cat.mode==="sleep"){spr(CAT_SLEEP,CP,cat.x,96);if(t%80<40)R(cat.x+11,99,1,1,"rgba(255,255,255,.25)")}
    else if(cat.mode==="sit")spr(CAT_SIT,{...CP,t:(t%50<25)?catC:null,y:t%120<5?catC:"#ffd34d"},cat.x,96);
    else{spr(CAT_WALK,CP,Math.round(cat.x),104,cat.dir<0);
      cat.x+=cat.dir*.45;
      if(cat.dir>0&&cat.x>=cat.to){cat.dir=-1;gift={x:Math.round(cat.x)+12,y:110,l:160};SFX.coin()}
      if(cat.dir<0&&cat.x<=5){cat.x=5;cat.mode=inside?"sit":"sleep"}}
    if(gift){R(gift.x,gift.y,3,1,"#9aa3b5");R(gift.x+1,gift.y-1,1,1,"#c9d1e0");if(--gift.l<=0)gift=null}
    // suelo mojado: reflejos y charco
    if(rain||pname==="alba"){for(let yy=121;yy<139;yy++){const o=Math.round(Math.sin(t/12+yy/2));if(P.lamp&&lightsOn)R(71+o,yy,10,1,"rgba(255,190,100,.08)");if(P.tv)R(90+o,yy,9,1,"rgba(90,130,220,.06)")}
      x.fillStyle="rgba(150,160,220,.10)";x.beginPath();x.ellipse(40,128,14,2,0,0,7);x.fill()}
    // repartidor
    if(bike){bike.x-=1.1;const bx=Math.round(bike.x);
      if(P.lamp)for(let k=0;k<10;k++)R(bx-2-k*2,124-(k>>2),2,1+(k>>1),"rgba(255,240,180,.12)");
      R(bx,126,12,2,"#2a2a33");R(bx+1,128,3,3,"#111");R(bx+9,128,3,3,"#111");R(bx+6,119,6,6,"#d9534f");R(bx+7,120,4,1,"#f2e8c9");
      R(bx+3,117,3,7,"#3d5a80");R(bx+3,114,3,3,"#e0a77c");R(bx+2,113,5,2,"#d9534f");R(bx,124,2,1,"#fff3c4");
      if(bike.x<-20)bike=null}
    // personaje
    if(hero.vis){
      const walking=!!seq&&(seq.st==="walk"||seq.st==="enter"||seq.st==="leave");
      const shiver=rain&&!walking&&t%300<14?(t%2):0;
      drawHero(Math.round(hero.x)+shiver,80+(walking?((t/5|0)%2):(t%70<35?0:1)),walking);
      if(P.breath&&!seq&&t%120===0)for(let i=0;i<3;i++)puffs.push({x:hero.x+6,y:91,vx:-.2-i*.05,a:.55-i*.12});
    }
    puffs.forEach(p=>{p.x+=p.vx;p.y-=.1;p.a-=.008;if(p.a>0){x.fillStyle=`rgba(220,225,240,${p.a})`;x.fillRect(p.x|0,p.y|0,2,1)}});puffs=puffs.filter(p=>p.a>0);
    if(card){card.k+=1/22;const k=Math.min(1,card.k);R(card.x0+(59-card.x0)*k,card.y0+(90-card.y0)*k-Math.sin(k*3.14)*5,3,2,"#f2e8c9");if(k>=1){card=null;cardDone=1}}
    sparks.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.vy+=.06;s.l--;if(s.l>0)R(s.x,s.y,1,1,s.l%4<2?"#ffd27a":"#fff3c4")});sparks=sparks.filter(s=>s.l>0);
    if(rain)drops.forEach(d=>{d.y+=d.v;d.x-=.4;if(d.y>119+Math.random()*20){if(Math.random()<.5){R(d.x-1,d.y,1,1,"rgba(180,190,240,.5)");R(d.x+1,d.y,1,1,"rgba(180,190,240,.5)")}d.y=-4-Math.random()*oy;d.x=Math.random()*(W+10)}R(d.x,d.y,1,3,pname==="noche"?"rgba(140,155,220,.45)":"rgba(220,228,245,.35)")});
    // textos flotantes (+XP, monedas…)
    x.font="bold 7px 'Pixelify Sans',monospace";x.textAlign="center";
    floats.forEach(f=>{if(f.d>0){f.d--;return}f.l++;const a=1-f.l/50;if(a<=0)return;x.fillStyle=`rgba(5,6,15,${a})`;x.fillText(f.text,f.x+.6,f.y-f.l*.5+.6);x.globalAlpha=a;x.fillStyle=f.color;x.fillText(f.text,f.x,f.y-f.l*.5);x.globalAlpha=1});
    floats=floats.filter(f=>f.l<50);
    x.setTransform(1,0,0,1,0,0);
    if(blackout){x.fillStyle="rgba(2,3,12,.45)";x.fillRect(0,0,W,H);blackout--;if(blackout===0&&onEvent)onEvent("luz")}
    if(flash){x.fillStyle=`rgba(255,240,200,${flash/14})`;x.fillRect(0,0,W,H);flash--}
    if(banner){banner.l++;const a=banner.l<10?banner.l/10:banner.l>70?(90-banner.l)/20:1;
      x.globalAlpha=Math.max(0,a);x.fillStyle="rgba(5,6,15,.8)";x.fillRect(0,oy+44,W,16);x.fillStyle="#ffd27a";x.font="bold 8px 'Pixelify Sans',monospace";x.fillText(banner.text,W/2,oy+55);x.globalAlpha=1;
      if(banner.l>=90)banner=null}
    step();
  }

  let raf=0,last=0,alive=true;
  function loop(now){
    if(!alive)return; raf=requestAnimationFrame(loop);
    if(document.hidden||!cv.offsetParent)return;
    if(now-last<33)return; last=now; frame();
  }
  resize();
  const S0=get()||{}; rain=!!S0.rain; mode=S0.mode||"in"; place(mode); setPal();
  if(reduce){frame();const iv=setInterval(()=>{if(!alive)return clearInterval(iv);if(!document.hidden&&cv.offsetParent)frame()},1000)}
  else raf=requestAnimationFrame(loop);
  const onR=()=>{resize();pname="";};addEventListener("resize",onR);

  return {
    resize:onR,
    busy,
    event,
    set onEvent(f){onEvent=f},
    // API común con la escena anterior para las celebraciones de rpgFx()
    // en esta escena el golpe es el «clac» del reloj: sin textos de vida
    attack(text,crit){if(crit)addFloat("¡Puntual!","#ffd27a",60,74)},
    gain(text,c,delay){addFloat(text,c||"#7fe3c4",76,70,Math.round((delay||0)/33))},
    coin(text){addFloat(text+" monedas","#ffd34d",40,96,20);SFX.coin()},
    level(){banner={text:"¡Subes de nivel!",l:0};SFX.level();for(let i=0;i<24;i++)sparks.push({x:hero.vis?hero.x+8:59,y:84,vx:(Math.random()-.5)*2.4,vy:-Math.random()*2.4,l:24+Math.random()*20})},
    defeat(){banner={text:"¡Periodo superado!",l:0};SFX.level()},
    destroy(){alive=false;cancelAnimationFrame(raf);removeEventListener("resize",onR)}
  };
}

window.MTNight={mount, face, sfx:SFX, setSound(on){soundOn=!!on}};
})();
