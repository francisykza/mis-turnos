/* Mis Turnos · Modo RPG
   Todo se CALCULA a partir de los fichajes: no se guarda experiencia ni monedas aparte,
   así que nunca se descuadra (importar una copia o corregir un día recalcula el nivel).
   Se premia la constancia (fichar, puntualidad, rachas, respetar descansos), no echar más horas:
   las horas extra no dan experiencia adicional. */
(()=>{
const toMin=t=>{if(!t)return null;const [h,m]=t.split(":").map(Number);return h*60+m};
const wrap=m=>((m%1440)+2160)%1440-720;            // diferencia de horas en -12h..+12h
const XP_AT=L=>50*L*(L-1);                          // experiencia total para llegar al nivel L
function levelOf(xp){let L=1;while(XP_AT(L+1)<=xp)L++;return {L,from:XP_AT(L),to:XP_AT(L+1)}}
const RANKS=[{min:1,name:"Recluta"},{min:5,name:"Operador"},{min:10,name:"Veterano"},{min:18,name:"Leyenda"}];
function rankOf(L){let t=0;RANKS.forEach((r,i)=>{if(L>=r.min)t=i});return {tier:t,name:RANKS[t].name,next:RANKS[t+1]||null}}
const BOSSES=["Lunes Eterno","Coloso del Turno","Hidra de las Horas","Gólem del Papeleo","Kraken de la Nómina","Dragón del Cuadrante","Espectro del Fichaje","Titán del Reloj","Gárgola del Insomnio","Quimera del Calendario","Basilisco del Atasco","Minotauro del Turno"];
const XP={dia:10, puntual:5, completo:3, descanso:3, jefe:50, logro:25};

// A: {months, calc, periodOf, parse, iso, addDays, today, lastBackup, audits}
function compute(A){
  const keys=[];
  for(const ym in A.months) for(const dd in A.months[ym]) keys.push(ym+"-"+dd);
  keys.sort();
  const R={xp:0, days:0, punctual:0, onTime:0, streak:0, best:0, rests:0, nights:0, mornings:0, bosses:[], boss:null, ach:[], first:keys[0]||null};
  const t=A.today;
  const realDay=c=>c.worked>0 && !c.open && !!c.r.e;   // fichaje de verdad (entrada y salida)
  if(R.first && R.first<=t){
    let streak=0;
    for(let d=A.parse(R.first); A.iso(d)<=t; d=A.addDays(d,1)){
      const s=A.iso(d), c=A.calc(s), p=c.p, r=c.r, past=s<t;
      if(realDay(c)){
        R.days++; let g=XP.dia;
        if(!p.rest && !p.fest && p.e){
          R.onTime++;
          if(wrap(toMin(r.e)-toMin(p.e))<=5){g+=XP.puntual;R.punctual++}
          if(!c.falta) g+=XP.completo;
        }
        streak++; R.best=Math.max(R.best,streak);
        g+=Math.min(5,Math.floor(streak/5));
        if(p.sh==="N"&&!p.rest) R.nights++;
        if(p.sh==="M"&&!p.rest) R.mornings++;
        R.xp+=g;
      } else if(r.tipo){
        // vacaciones, baja o permiso: ni suman ni rompen la racha
      } else if(past && !p.rest && !p.fest && !c.open){
        streak=0;                                         // día de trabajo sin fichar
      } else if(past && (p.rest||p.fest) && !c.worked){
        R.rests++; R.xp+=XP.descanso;                     // descanso respetado
      }
    }
    R.streak=streak;
    // Jefes: cada periodo de liquidación. Vida = días de trabajo previstos; cada día fichado le quita uno.
    let per=A.periodOf(A.parse(R.first));
    for(let n=0; n<240 && per.start<=t; n++){
      let max=0, hit=0;
      for(let d=A.parse(per.start); A.iso(d)<=per.end; d=A.addDays(d,1)){
        const s=A.iso(d); if(s<R.first) continue;
        const c=A.calc(s), p=c.p;
        if(c.r.tipo || p.rest || p.fest) continue;
        max++; if(c.r.e) hit++;
      }
      const e=A.parse(per.end), closed=per.end<t;
      const b={start:per.start, end:per.end, name:BOSSES[(e.getFullYear()*12+e.getMonth())%BOSSES.length], max, hp:Math.max(0,max-hit), closed};
      b.defeated = closed && max>0 && hit>=max;
      if(b.defeated) R.xp+=XP.jefe;
      R.bosses.push(b);
      if(!closed) R.boss=b;
      per=A.periodOf(A.addDays(e,1));
    }
  }
  const won=R.bosses.filter(b=>b.defeated).length; R.won=won;
  const A_=[
    ["primer","Primer fichaje","Ficha tu primer día completo",R.days>=1],
    ["semana","Semana impecable","Racha de 5 días de trabajo fichados",R.best>=5],
    ["constante","Constante","Racha de 20 días",R.best>=20],
    ["imparable","Imparable","Racha de 60 días",R.best>=60],
    ["d50","50 días","50 días fichados",R.days>=50],
    ["d100","Centenario","100 días fichados",R.days>=100],
    ["d300","Leyenda viva","300 días fichados",R.days>=300],
    ["puntual","Puntual","20 entradas a tu hora",R.punctual>=20],
    ["jefe1","Matajefes","Derrota un jefe: ficha todos los días de un periodo",won>=1],
    ["jefe6","Cazador de jefes","Derrota 6 jefes",won>=6],
    ["descanso","Descanso sagrado","20 descansos sin trabajar",R.rests>=20],
    ["noche","Noctámbulo","10 turnos de noche",R.nights>=10],
    ["alba","Madrugador","20 turnos de mañana",R.mornings>=20],
    ["copia","Guardián","Guarda una copia de seguridad",!!A.lastBackup],
    ["auditor","Auditor","Compara una nómina en «¿Te han pagado bien?»",(A.audits||0)>=1]
  ];
  R.ach=A_.map(([id,name,desc,ok])=>({id,name,desc,ok}));
  R.xp+=R.ach.filter(a=>a.ok).length*XP.logro;
  Object.assign(R, levelOf(R.xp)); R.rank=rankOf(R.L);
  return R;
}

/* ---------- avatar pixel art (16×16, se dibuja en canvas sin librerías) ---------- */
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
const TIERS=[
  {H:"#8b93a8",h:"#5d6478",V:"#38e8ff",B:"#3b4160",b:"#262a40"},
  {H:"#22c7e6",h:"#1482a0",V:"#ff3bd6",B:"#2d3a66",b:"#1c2546"},
  {H:"#9b6bff",h:"#6640c8",V:"#3dffb0",B:"#3a2a66",b:"#241946"},
  {H:"#f2b134",h:"#b97a12",V:"#ff3b6b",B:"#4a2a1a",b:"#2e1a10"}];
function drawAvatar(cv, tier, frame){
  const ctx=cv.getContext("2d"), P=TIERS[Math.max(0,Math.min(3,tier))]||TIERS[0];
  const col={K:"#0b0a14",S:"#f0c3a0",Y:"#ffd34d",L:"#30364e",W:"#15161f",v:"#ffffff",H:P.H,h:P.h,V:P.V,B:P.B,b:P.b};
  const px=Math.floor(cv.width/16), dy=frame?1:0;
  ctx.imageSmoothingEnabled=false; ctx.clearRect(0,0,cv.width,cv.height);
  if(tier>=2){ // capa por detrás
    ctx.fillStyle=tier>=3?"#c21f4a":"#5a2fb0";
    ctx.fillRect(1*px,(10+dy)*px,14*px,5*px);
  }
  SPRITE.forEach((row,y)=>[...row].forEach((ch,x)=>{
    if(ch==="."||!col[ch]) return;
    const yy=(x>=4&&x<=11&&y<=12)?y+dy:y;           // la cabeza y el cuerpo respiran, los pies no
    ctx.fillStyle=col[ch]; ctx.fillRect(x*px,yy*px,px,px);
  }));
  if(tier>=3){ // corona
    ctx.fillStyle="#ffd34d";
    [[5,0],[7,0],[9,0],[10,0],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1]].forEach(([x,y])=>ctx.fillRect(x*px,(y+dy-1)*px+px,px,px));
  }
  if(tier>=1){ // brillo del visor
    ctx.fillStyle=P.V; ctx.globalAlpha=.25; ctx.fillRect(4*px,(4+dy)*px,8*px,2*px); ctx.globalAlpha=1;
  }
}

window.MTRPG={compute, drawAvatar, levelOf, XP, RANKS};
})();
