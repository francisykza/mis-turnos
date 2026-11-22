/* Mis Turnos · Modo RPG (motor)
   Todo se CALCULA a partir de los fichajes: experiencia, monedas, rachas, jefes y misiones
   salen de los días apuntados, así que nunca se descuadran (corregir un día o recuperar una
   copia lo recalcula todo). Lo único guardado aparte es lo comprado en la tienda (cfg.rpgInv).
   Se premia la constancia, la puntualidad y descansar; las horas extra NO dan experiencia. */
(()=>{
const toMin=t=>{if(!t)return null;const [h,m]=t.split(":").map(Number);return h*60+m};
const wrap=m=>((m%1440)+2160)%1440-720;               // diferencia horaria en −12 h…+12 h
const XP_AT=L=>50*L*(L-1);                             // experiencia total para llegar al nivel L
function levelOf(xp){let L=1;while(XP_AT(L+1)<=xp)L++;return {L,from:XP_AT(L),to:XP_AT(L+1)}}
const RANKS=[{min:1,name:"Recluta"},{min:5,name:"Operador"},{min:10,name:"Veterano"},{min:18,name:"Leyenda"}];
function rankOf(L){let t=0;RANKS.forEach((r,i)=>{if(L>=r.min)t=i});return {tier:t,name:RANKS[t].name,next:RANKS[t+1]||null}}
const XP={dia:10, puntual:5, completo:3, descanso:3, semana:20, jefe:50, logro:25};
const CR={dia:5, puntual:2, descanso:1, semana:10, jefe:30, logro:10};

/* Jefes: uno por periodo de liquidación. kind elige el dibujo de la escena. */
const BOSSES=[
  {name:"Lunes Eterno",kind:0,c:"#7c5cff"},{name:"Titán del Reloj",kind:2,c:"#ffb020"},{name:"Gólem del Papeleo",kind:3,c:"#d9d2c0"},
  {name:"Robo-Supervisor",kind:1,c:"#22c7e6"},{name:"Hidra de las Horas",kind:0,c:"#1fbf8f"},{name:"Reloj de Arena Maldito",kind:2,c:"#ff6b3d"},
  {name:"Torre de Expedientes",kind:3,c:"#b9c3d6"},{name:"Mecha Encargado",kind:1,c:"#ff3bd6"},{name:"Babosa del Atasco",kind:0,c:"#9ad13b"},
  {name:"Cronómetro Implacable",kind:2,c:"#e5484d"},{name:"Archivador Viviente",kind:3,c:"#e8c07a"},{name:"Androide de Recursos Humanos",kind:1,c:"#8b93a8"}];
function bossOf(endDate){return BOSSES[(endDate.getFullYear()*12+endDate.getMonth())%BOSSES.length]}

/* Evento del día: sale de la fecha (siempre el mismo para el mismo día) y cambia algo pequeño. */
const EVENTS=[
  {id:"cafe",  name:"Han arreglado la máquina de café", desc:"Hoy entrar a tu hora da el doble de experiencia.", puntual:2},
  {id:"lluvia",name:"Día de lluvia", desc:"Fichar el día completo da +5 XP extra.", dia:5},
  {id:"merca", name:"Rebajas en el mercadillo", desc:"La tienda hace un 20 % de descuento hoy.", shop:.8},
  {id:"luna",  name:"Luna llena", desc:"Las rachas dan el doble de bonificación.", racha:2},
  {id:"cred",  name:"Día de paga", desc:"Fichar hoy da el doble de monedas.", coins:2},
  {id:"jefe",  name:"El encargado viene de mal humor", desc:"Completar el turno da el triple de experiencia.", completo:3},
  {id:"calma", name:"Día tranquilo", desc:"Nada raro por aquí. Buen día para cuidar la racha."}];
const REST_EVENT={id:"libre",name:"Día libre",desc:"Hoy toca recargar energía. Descansar también da experiencia."};
function eventOf(s){let h=7;for(const ch of s)h=(h*31+ch.charCodeAt(0))>>>0;return EVENTS[h%EVENTS.length]}

/* Tienda: solo estética. slot H casco, V visor, B traje, C capa, P mascota. */
const SHOP=[
  {id:"h-cromo",slot:"H",name:"Casco cromado",price:40,minL:1,c:"#c9d1e0",c2:"#8a93a6"},
  {id:"h-rojo", slot:"H",name:"Casco rojo",price:60,minL:3,c:"#e5484d",c2:"#9c2a2e"},
  {id:"h-jade", slot:"H",name:"Casco jade",price:80,minL:5,c:"#1fbf8f",c2:"#11805e"},
  {id:"h-oro",  slot:"H",name:"Casco dorado",price:220,minL:10,c:"#f2b134",c2:"#b97a12"},
  {id:"v-ambar",slot:"V",name:"Visor ámbar",price:30,minL:1,c:"#ffb020"},
  {id:"v-verde",slot:"V",name:"Visor verde",price:30,minL:2,c:"#3dffb0"},
  {id:"v-rojo", slot:"V",name:"Visor rojo",price:50,minL:4,c:"#ff3b6b"},
  {id:"b-obra", slot:"B",name:"Mono naranja",price:50,minL:2,c:"#e8772e",c2:"#a84f17"},
  {id:"b-negro",slot:"B",name:"Traje negro",price:90,minL:6,c:"#22222e",c2:"#14141c"},
  {id:"b-neon", slot:"B",name:"Chaqueta de neón",price:140,minL:8,c:"#7a2cff",c2:"#4a17a8"},
  {id:"c-roja", slot:"C",name:"Capa carmesí",price:120,minL:5,c:"#c21f4a"},
  {id:"c-noche",slot:"C",name:"Capa nocturna",price:120,minL:5,c:"#1d2a6b"},
  {id:"p-dron", slot:"P",name:"Dron K-9",price:160,minL:4,c:"#22c7e6"},
  {id:"p-gato", slot:"P",name:"Gato callejero",price:100,minL:2,c:"#f2a65a"}];
const SLOTS={H:"Casco",V:"Visor",B:"Traje",C:"Capa",P:"Mascota"};

// A: {months, calc, periodOf, parse, iso, addDays, today, lastBackup, audits, inv}
function compute(A){
  const keys=[];
  for(const ym in A.months) for(const dd in A.months[ym]) keys.push(ym+"-"+dd);
  keys.sort();
  const R={xp:0, coins:0, days:0, punctual:0, onTime:0, streak:0, best:0, rests:0, nights:0, mornings:0,
    bosses:[], boss:null, ach:[], log:[], weeks:0, week:null, first:keys[0]||null, run:0};
  const t=A.today, add=(xp,cr)=>{R.xp+=xp;R.coins+=cr};
  const realDay=c=>c.worked>0 && !c.open && !!c.r.e;   // fichaje de verdad (entrada y salida)
  const workday=c=>!c.r.tipo && !c.p.rest && !c.p.fest;
  if(R.first && R.first<=t){
    let streak=0, run=0;
    for(let d=A.parse(R.first); A.iso(d)<=t; d=A.addDays(d,1)){
      const s=A.iso(d), c=A.calc(s), p=c.p, r=c.r, past=s<t, ev=(p.rest||p.fest)?REST_EVENT:eventOf(s);
      if(c.worked>0||c.open) run++; else if(past||r.tipo) run=0;
      if(realDay(c)){
        R.days++; let g=XP.dia+(ev.dia||0), cr=CR.dia, bits=[];
        if(!p.rest && !p.fest && p.e){
          R.onTime++;
          if(wrap(toMin(r.e)-toMin(p.e))<=5){g+=XP.puntual*(ev.puntual||1);cr+=CR.puntual;R.punctual++;bits.push("a tu hora")}
          if(!c.falta){g+=XP.completo*(ev.completo||1);bits.push("turno completo")}
        }
        streak++; R.best=Math.max(R.best,streak);
        g+=Math.min(5,Math.floor(streak/5))*(ev.racha||1);
        cr*=(ev.coins||1);
        if(p.sh==="N"&&!p.rest) R.nights++;
        if(p.sh==="M"&&!p.rest) R.mornings++;
        add(g,cr);
        R.log.push({s,k:"dia",text:`Fichaje ${r.e}–${r.s}`+(bits.length?` · ${bits.join(", ")}`:""),xp:g,cr,dmg:workday(c)?1:0});
      } else if(r.tipo){
        // vacaciones, baja o permiso: ni suman ni rompen la racha
      } else if(past && !p.rest && !p.fest && !c.open){
        if(streak>=3) R.log.push({s,k:"falta",text:`Día sin fichar: se rompe una racha de ${streak}`});
        streak=0;
      } else if(past && (p.rest||p.fest) && !c.worked){
        R.rests++; add(XP.descanso,CR.descanso);
        R.log.push({s,k:"descanso",text:p.fest?"Festivo sin trabajar: energía recargada":"Descanso respetado: energía recargada",xp:XP.descanso,cr:CR.descanso});
      }
    }
    R.streak=streak; R.run=run;
    // Misión semanal: fichar todos los días de trabajo de la semana (lunes a domingo)
    const mon=x=>{const y=new Date(x);y.setDate(y.getDate()-((y.getDay()+6)%7));return y};
    for(let w=mon(A.parse(R.first)); A.iso(w)<=t; w=A.addDays(w,7)){
      let tot=0, ok=0;
      for(let i=0;i<7;i++){const s=A.iso(A.addDays(w,i)); if(s<R.first) continue; const c=A.calc(s); if(!workday(c)) continue; if(s>t){tot++;continue} tot++; if(c.r.e) ok++}
      const end=A.iso(A.addDays(w,6));
      if(end<t){ if(tot>0&&ok>=tot){R.weeks++;add(XP.semana,CR.semana);R.log.push({s:end,k:"semana",text:`Semana completa (${tot} de ${tot} días)`,xp:XP.semana,cr:CR.semana})} }
      else R.week={done:ok,total:tot,end};
    }
    // Jefes: vida = días de trabajo previstos del periodo; cada día con entrada le quita uno.
    let per=A.periodOf(A.parse(R.first));
    for(let n=0; n<240 && per.start<=t; n++){
      let max=0, hit=0;
      for(let d=A.parse(per.start); A.iso(d)<=per.end; d=A.addDays(d,1)){
        const s=A.iso(d); if(s<R.first) continue;
        const c=A.calc(s); if(!workday(c)) continue;
        max++; if(c.r.e) hit++;
      }
      const e=A.parse(per.end), closed=per.end<t, B=bossOf(e);
      const b={start:per.start, end:per.end, name:B.name, kind:B.kind, color:B.c, max, hp:Math.max(0,max-hit), closed};
      b.defeated = closed && max>0 && hit>=max;
      if(b.defeated){add(XP.jefe,CR.jefe);R.log.push({s:per.end,k:"jefe",text:`¡${B.name} derrotado!`,xp:XP.jefe,cr:CR.jefe})}
      else if(closed && max>0) R.log.push({s:per.end,k:"huida",text:`${B.name} escapó con ${b.hp} de vida`});
      R.bosses.push(b);
      if(!closed) R.boss=b;
      per=A.periodOf(A.addDays(e,1));
    }
  }
  R.won=R.bosses.filter(b=>b.defeated).length;
  const L_=[
    ["primer","Primer fichaje","Ficha tu primer día completo",R.days>=1],
    ["semana","Semana impecable","Completa una misión semanal",R.weeks>=1],
    ["constante","Constante","Racha de 20 días",R.best>=20],
    ["imparable","Imparable","Racha de 60 días",R.best>=60],
    ["d50","50 días","50 días fichados",R.days>=50],
    ["d100","Centenario","100 días fichados",R.days>=100],
    ["d300","Leyenda viva","300 días fichados",R.days>=300],
    ["puntual","Puntual","20 entradas a tu hora",R.punctual>=20],
    ["jefe1","Matajefes","Derrota a un jefe de periodo",R.won>=1],
    ["jefe6","Cazador de jefes","Derrota a 6 jefes",R.won>=6],
    ["descanso","Descanso sagrado","20 descansos sin trabajar",R.rests>=20],
    ["noche","Noctámbulo","10 turnos de noche",R.nights>=10],
    ["alba","Madrugador","20 turnos de mañana",R.mornings>=20],
    ["copia","Guardián","Guarda una copia de seguridad",!!A.lastBackup],
    ["auditor","Auditor","Compara una nómina en «¿Te han pagado bien?»",(A.audits||0)>=1]];
  R.ach=L_.map(([id,name,desc,ok])=>({id,name,desc,ok}));
  R.ach.forEach(a=>{if(a.ok)add(XP.logro,CR.logro)});
  Object.assign(R, levelOf(R.xp)); R.rank=rankOf(R.L);
  // Energía: baja si encadenas muchos días trabajando sin descanso (no castiga, solo avisa)
  R.energy=Math.max(10,100-Math.max(0,R.run-5)*15);
  R.attrs=[
    {k:"Constancia",v:Math.min(100,Math.round(R.best/60*100))},
    {k:"Puntualidad",v:R.onTime?Math.round(R.punctual/R.onTime*100):0},
    {k:"Energía",v:R.energy},
    {k:"Veteranía",v:Math.min(100,Math.round(R.days/3))}];
  // Monedas: ganadas (calculadas) menos lo gastado en la tienda
  const inv=A.inv||{}, spent=(inv.owned||[]).reduce((a,o)=>a+(Number(o.paid)||0),0);
  R.earned=R.coins; R.spent=spent; R.coins=Math.max(0,R.coins-spent);
  // Hoy: evento y misiones
  const tc=A.calc(t), tp=tc.p, tr=tc.r;
  R.event=(tp.rest||tp.fest||tr.tipo)?REST_EVENT:eventOf(t);
  if(tr.tipo) R.quests=[{t:"Recupérate. Hoy no hay misiones",done:true,rw:""}];
  else if(tp.rest||tp.fest) R.quests=[{t:"No trabajes hoy",done:false,rw:`+${XP.descanso} XP al acabar el día`,note:tc.worked?"Has trabajado: cuenta como extra o festivo":""}];
  else {
    const punct=tr.e && wrap(toMin(tr.e)-toMin(tp.e))<=5;
    R.quests=[
      {t:"Ficha la entrada",done:!!tr.e,rw:"−1 de vida al jefe"},
      {t:"Entra a tu hora",done:!!punct,fail:!!tr.e&&!punct,rw:`+${XP.puntual*(R.event.puntual||1)} XP`},
      {t:"Ficha la salida",done:realDay(tc),rw:`+${XP.dia+(R.event.dia||0)} XP`},
      {t:"Completa el turno",done:realDay(tc)&&!tc.falta,fail:realDay(tc)&&!!tc.falta,rw:`+${XP.completo*(R.event.completo||1)} XP`}];
  }
  R.log.reverse();
  return R;
}

/* Aspecto del personaje: el rango pone la base y lo equipado lo cambia */
const TIERS=[
  {H:"#8b93a8",h:"#5d6478",V:"#38e8ff",B:"#3b4160",b:"#262a40"},
  {H:"#22c7e6",h:"#1482a0",V:"#ff3bd6",B:"#2d3a66",b:"#1c2546"},
  {H:"#9b6bff",h:"#6640c8",V:"#3dffb0",B:"#3a2a66",b:"#241946"},
  {H:"#f2b134",h:"#b97a12",V:"#ff3b6b",B:"#4a2a1a",b:"#2e1a10"}];
function lookOf(tier, inv){
  const P=Object.assign({},TIERS[Math.max(0,Math.min(3,tier))]);
  P.cape = tier>=3?"#c21f4a" : tier>=2?"#5a2fb0" : null;
  P.crown = tier>=3; P.pet=null; P.tier=tier;
  const eq=(inv&&inv.equip)||{};
  for(const slot in eq){
    const it=SHOP.find(x=>x.id===eq[slot]); if(!it) continue;
    if(slot==="H"){P.H=it.c;P.h=it.c2}
    if(slot==="V") P.V=it.c;
    if(slot==="B"){P.B=it.c;P.b=it.c2}
    if(slot==="C") P.cape=it.c;
    if(slot==="P") P.pet=it.id;
  }
  return P;
}
function price(it, ev){return Math.round(it.price*((ev&&ev.shop)||1))}

window.MTRPG={compute, levelOf, lookOf, price, XP, CR, RANKS, SHOP, SLOTS, EVENTS};
})();
