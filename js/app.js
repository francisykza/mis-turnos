(()=>{
/* ---------- datos base ---------- */
// Valores por defecto de la versión 1 (solo mañana/tarde alternas). Sirven para convertir
// los datos de quien ya usaba la app, aunque nunca hubiera tocado los ajustes.
const LEGACY_DEF = {refMonday:"2026-09-21", refShift:"M", M:{e:"06:30",s:"12:55",rest:0}, T:{e:"14:00",s:"20:25",rest:6}, weekly:37.5, corte:20};
// Hasta 4 turnos. El id fija el color: M ámbar, T violeta, N azul noche, P coral.
const TURNO_IDS = ["M","T","N","P"];
const TURNOS_DEF = {
  M:{nombre:"Mañana", e:"06:00", s:"14:00", on:true},
  T:{nombre:"Tarde",  e:"14:00", s:"22:00", on:true},
  N:{nombre:"Noche",  e:"22:00", s:"06:00", on:false},
  P:{nombre:"Otro",   e:"09:00", s:"17:00", on:false}
};
const DOW = ["dom","lun","mar","mié","jue","vie","sáb"];
const DOWL = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const MON = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const TIPOS = {vac:"Vacaciones", baja:"Baja", libre:"Libre / permiso"};

const ls = {
  get(k){try{return JSON.parse(localStorage.getItem("mt_"+k))}catch(e){return null}},
  set(k,v){try{localStorage.setItem("mt_"+k,JSON.stringify(v))}catch(e){}}
};
let db = null;
let tab = "hoy";
let viewYM = null;

/* ---------- utilidades de fecha ---------- */
const pad = n => String(n).padStart(2,"0");
const iso = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse = s => {const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays = (d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const mondayOf = d => {const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const toMin = t => {if(!t)return null;const [h,m]=t.split(":").map(Number);return h*60+m};
const dur = (e,s) => {let a=toMin(e),b=toMin(s);if(a==null||b==null)return 0;if(b<a)b+=1440;return b-a};
const nowHM = () => {const d=new Date();return pad(d.getHours())+":"+pad(d.getMinutes())};
const fmt = (m,sign) => {m=Math.round(m||0);const neg=m<0;m=Math.abs(m);const h=Math.floor(m/60),mm=m%60;
  let s = h? (mm? h+"h "+pad(mm)+"m" : h+"h") : mm+"m"; if(m===0)s="0h"; return (neg?"−":(sign?"+":""))+s};
const todayISO = () => iso(new Date());

/* ---------- datos guardados y versión del formato ---------- */
/* DATA_V sube cuando cambia la forma de guardar; normCfg/migrate convierten lo antiguo.
   v1 → v2: mañana/tarde alternas por semanas pasan a un ciclo de días repetible
   (cfg.turnos + cfg.ciclo = {inicio, dias:["M","M",…,"D"]}), que admite noche,
   horario fijo, 4×4 o cualquier patrón. */
const DATA_V = 2;
const clone = o => JSON.parse(JSON.stringify(o));
function defaultCiclo(){
  return {inicio: iso(mondayOf(new Date())), dias: ["M","M","M","M","M","M","D","T","T","T","T","T","T","D"]};
}
const DEF = {turnos: clone(TURNOS_DEF), ciclo: defaultCiclo(), weekly: 40, corte: 20};
function legacyToV2(o){
  const L = Object.assign({}, LEGACY_DEF, o);
  const t = clone(TURNOS_DEF);
  t.M = Object.assign(t.M, {e:L.M.e, s:L.M.s, on:true});
  t.T = Object.assign(t.T, {e:L.T.e, s:L.T.s, on:true});
  const first = L.refShift==="T" ? "T" : "M", second = first==="M" ? "T" : "M";
  const st = mondayOf(parse(L.refMonday)), dias = [];
  for(let i=0;i<14;i++){
    const sh = i<7 ? first : second, d = addDays(st,i);
    dias.push(d.getDay()===Number(L[sh].rest) ? "D" : sh);
  }
  const out = Object.assign({}, L, {turnos:t, ciclo:{inicio:iso(st), dias}});
  ["M","T","refMonday","refShift"].forEach(k=>delete out[k]);
  return out;
}
// raw: lo guardado tal cual · legacy: si falta el ciclo, viene de la v1 (aunque raw esté vacío)
function normCfg(raw, legacy){
  let c = raw ? clone(raw) : {};
  if(!c.ciclo && (legacy || raw)) c = legacyToV2(c);
  const out = Object.assign({}, DEF, c);
  out.turnos = Object.assign(clone(TURNOS_DEF), c.turnos||{});
  if(!out.ciclo || !Array.isArray(out.ciclo.dias) || !out.ciclo.dias.length) out.ciclo = defaultCiclo();
  return out;
}
function migrate(c, m, from){ return {cfg: normCfg(c, true), months: m||{}} }

let months = ls.get("months") || {};
const rawCfg = ls.get("cfg");
const isNewUser = !rawCfg && !Object.keys(months).length;
let cfg = normCfg(rawCfg, !isNewUser);
if((Number(ls.get("schema"))||0) < DATA_V){
  if(!isNewUser) ls.set("cfg", cfg);   // quien ya tenía datos queda convertido y guardado
  ls.set("schema", DATA_V);
}

/* ---------- lógica de turnos ---------- */
// Cuando se cambian los turnos «a partir de hoy», lo anterior se guarda en cfg.antes
// (lista ordenada de {hasta, turnos, ciclo}) para que los periodos pasados no se recalculen.
function srcFor(s){const a=cfg.antes;if(a)for(const h of a)if(s<=h.hasta)return h;return cfg}
function cycVal(s,src){
  src=src||srcFor(s);
  const c=src.ciclo, n=c.dias.length;
  const k=Math.round((parse(s)-parse(c.inicio))/864e5);
  return c.dias[((k%n)+n)%n];
}
const isWork = (v,src) => !!(v && v!=="D" && (src||cfg).turnos[v]);
// En un descanso, el turno «de referencia» es el último que se trabajó en el ciclo
function nearShift(s,src){
  const n=src.ciclo.dias.length, d=parse(s);
  for(let i=1;i<=n;i++){const v=cycVal(iso(addDays(d,-i)),src);if(isWork(v,src))return v}
  return TURNO_IDS.find(k=>src.turnos[k]&&src.turnos[k].on)||"M";
}
function rec(s){const m=months[s.slice(0,7)];return m? m[s.slice(8)]||null : null}
// Festivo oficial del día según el año y la comunidad elegida (js/festivos.js)
function festName(s){return window.MTFest.festivos(Number(s.slice(0,4)),cfg.ccaa||"")[s]||null}
function isFest(s){const r=rec(s);if(r&&r.fest!=null)return r.fest;return !!festName(s)}
function plan(s){
  const src=srcFor(s), v=cycVal(s,src), rest=!isWork(v,src), sh=rest?nearShift(s,src):v, c=src.turnos[sh]||TURNOS_DEF.M;
  return {sh, name:c.nombre, rest, fest:isFest(s), e:c.e, s:c.s, min: rest?0:dur(c.e,c.s), night: toMin(c.s)<toMin(c.e)};
}
function weekLabel(mon){
  const ids=[], names=[];
  for(let i=0;i<7;i++){const s=iso(addDays(mon,i)), src=srcFor(s), v=cycVal(s,src);if(isWork(v,src)&&!ids.includes(v)){ids.push(v);names.push(src.turnos[v].nombre.toLowerCase())}}
  if(!ids.length) return "Semana de descanso";
  if(ids.length===1) return "Turno de "+names[0];
  const txt=names.slice(0,-1).join(", ")+" y "+names[names.length-1];
  return txt.charAt(0).toUpperCase()+txt.slice(1);
}
function calc(s){
  const p=plan(s), r=rec(s)||{};
  const out={p, r, worked:0, extra:0, festH:0, falta:0, planned:p.fest?0:p.min, open:false};
  if(r.tipo){out.planned=0;return out}
  if(r.e && !r.s){out.open=true}
  if(r.e && r.s && !out.open){
    out.worked=dur(r.e,r.s);
    if(p.fest) out.festH=out.worked;
    else if(p.rest) out.extra=out.worked;
    else {out.extra=Math.max(0,out.worked-p.min);out.falta=Math.max(0,p.min-out.worked)}
  }
  if(r.x){out.manual=r.x;out.worked+=r.x;if(p.fest)out.festH+=r.x;else out.extra+=r.x}
  return out;
}
function periodOf(d){
  const c=Number(cfg.corte)||20;
  const st = d.getDate()>=c ? new Date(d.getFullYear(),d.getMonth(),c) : new Date(d.getFullYear(),d.getMonth()-1,c);
  const en = new Date(st.getFullYear(),st.getMonth()+1,c-1);
  return {start:iso(st), end:iso(en)};
}
const shortD = s => {const x=parse(s);return x.getDate()+" "+MON[x.getMonth()].slice(0,3)};
function sumRange(from,to){ // inclusive ISO strings
  const t={worked:0,extra:0,festH:0,falta:0,days:0};
  for(let d=parse(from); iso(d)<=to; d=addDays(d,1)){
    const c=calc(iso(d)); t.worked+=c.worked;t.extra+=c.extra;t.festH+=c.festH;t.falta+=c.falta; if(c.worked)t.days++;
  }
  return t;
}

/* ---------- guardado ---------- */
const queues={};
function persistMonth(ym){
  ls.set("months",months); markEdit();
  if(!db) return;
  const body={dias: months[ym]||{}, actualizado: Date.now()};
  queues[ym]=(queues[ym]||Promise.resolve()).then(()=>db.doc("meses/"+ym).set(body)).catch(()=>toast("No se pudo sincronizar; queda guardado en el móvil"));
}
function persistCfg(){
  ls.set("cfg",cfg);
  if(!db) return;
  queues.cfg=(queues.cfg||Promise.resolve()).then(()=>db.doc("ajustes/config").set(cfg)).catch(()=>{});
}
function setRec(s,r){
  const b4=cfg.rpg?rpg():null;
  const ym=s.slice(0,7), dd=s.slice(8);
  months[ym]=Object.assign({},months[ym]);
  const clean = r && Object.fromEntries(Object.entries(r).filter(([k,v])=>v!==null&&v!==undefined&&v!==""));
  if(clean && Object.keys(clean).length) months[ym][dd]=clean; else delete months[ym][dd];
  persistMonth(ym); render(); rpgFx(b4);
}

/* ---------- vistas ---------- */
const $ = id => document.getElementById(id);
function shiftName(sh){return (cfg.turnos[sh]&&cfg.turnos[sh].nombre)||"Turno"}
function pillsFor(c){
  const p=c.p, out=[];
  if(c.r.tipo) out.push(`<span class="pill X">${TIPOS[c.r.tipo]}</span>`);
  if(p.fest) out.push(`<span class="pill F">Festivo${festName(c.iso)&&c.r.fest!==true?" · "+festName(c.iso):""}</span>`);
  if(p.rest) out.push(`<span class="pill R">Descanso</span>`);
  else out.push(`<span class="pill ${p.sh}">${p.name} ${p.e}–${p.s}</span>`);
  return out.join("");
}

// Turno de noche: si ayer se fichó la entrada y aún no la salida, y la hora de entrada
// es «mayor» que la actual (se ha pasado la medianoche), ese turno sigue abierto.
function nightOpen(){
  const r=rec(todayISO()); if(r&&r.e&&!r.s) return null;
  const y=iso(addDays(new Date(),-1)), ry=rec(y), now=nowHM();
  if(!ry||!ry.e||ry.s||ry.tipo) return null;
  return toMin(ry.e)>toMin(now) && dur(ry.e,now)<=16*60 ? y : null;
}
function renderHoy(){
  const t=todayISO(), d=new Date(), c=calc(t); c.iso=t;
  const od=nightOpen();
  const r=c.r;
  let big, sub, actions;
  if(od){
    const ry=rec(od);
    big=fmt(dur(ry.e,nowHM())); sub=`Turno de noche en curso · entraste ayer a las ${ry.e}`;
    actions=`<button class="btn primary" id="b-outn">Fichar salida · ${nowHM()}</button><button class="btn ghost" data-edit="${od}" aria-label="Editar el turno de ayer">Editar</button>`;
  } else if(r.tipo){
    big=TIPOS[r.tipo]; sub="Día sin fichaje";
    actions=`<button class="btn ghost" data-edit="${t}" style="grid-column:1/-1">Editar día</button>`;
  } else if(c.open){
    const live=dur(r.e,nowHM());
    big=fmt(live); sub=`Entraste a las ${r.e} · salida prevista ${c.p.rest||c.p.fest?"—":c.p.s}`;
    actions=`<button class="btn primary" id="b-out">Fichar salida · ${nowHM()}</button><button class="btn ghost" data-edit="${t}" aria-label="Editar">Editar</button>`;
  } else if((r.e && r.s) || r.x){
    big=fmt(c.worked);
    const bits=[r.e?`${r.e} – ${r.s}`:"Solo extra apuntada"];
    if(c.extra) bits.push(`<span style="color:var(--fucsia)">${fmt(c.extra,true)} extra</span>`);
    else if(c.festH && c.manual) bits.push(`${fmt(c.manual,true)} a mano`);
    if(c.festH) bits.push(`<span style="color:var(--fest)">festivo</span>`);
    if(c.falta) bits.push(`faltan ${fmt(c.falta)}`);
    sub=bits.join(" · ");
    actions=`<button class="btn ghost" data-edit="${t}" style="grid-column:1/-1">Editar horario de hoy</button>`;
  } else {
    big = c.p.rest? "Descanso" : (c.p.e+"<span style='opacity:.45'>–</span>"+c.p.s);
    sub = c.p.rest? "Si te llaman, ficha igual: cuenta todo como extra." : (c.p.fest? "Hoy es festivo: lo que trabajes cuenta como horas festivas." : "Turno previsto de hoy · "+fmt(c.p.min));
    actions=`<button class="btn primary" id="b-in">Fichar entrada · ${nowHM()}</button>`+
      (c.p.rest?`<button class="btn ghost" data-edit="${t}">Manual</button>`:`<button class="btn ghost" id="b-full" title="Rellenar con el turno previsto">Turno ok</button>`);
  }

  // semana
  const mon=mondayOf(d); let cells="";
  let wk={worked:0,extra:0,festH:0};
  for(let i=0;i<7;i++){
    const di=addDays(mon,i), s=iso(di), ci=calc(s);
    wk.worked+=ci.worked; wk.extra+=ci.extra; wk.festH+=ci.festH;
    const cls=[ci.p.rest?"R":ci.p.sh, ci.p.fest?"F":"", (ci.worked||ci.r.tipo)?"done":"", s===t?"today":""].join(" ");
    cells+=`<button class="d7 ${cls}" data-edit="${s}" aria-label="${DOWL[di.getDay()]} ${di.getDate()}"><b>${DOW[di.getDay()].slice(0,1)}</b><em class="num">${di.getDate()}</em><span class="dot"></span></button>`;
  }
  const target=cfg.weekly*60, total=wk.worked;
  const base=Math.min(total-wk.extra,target), wPct=Math.max(0,base)/Math.max(target,total)*100, xPct=wk.extra/Math.max(target,total)*100;

  // periodo de extras
  const per=periodOf(d), pt=sumRange(per.start, per.end);
  const left=Math.round((parse(per.end)-parse(t))/864e5);

  $("v-hoy").innerHTML=`${cfg.rpg?rpgMini():""}
  <div class="visor">
    <div class="vtop">
      <div><small>Horas extra del periodo</small><div class="vnum num" data-count="${pt.extra}" data-fmt="min" data-key="hoy-extra">${fmt(pt.extra)}</div><div class="vrange num">${shortD(per.start)} – ${shortD(per.end)}</div></div>
      <button class="addx" id="b-x" aria-label="Añadir horas extra"><span>+</span>Extra</button>
    </div>
    <div class="vfoot num"><span>Festivas <b>${fmt(pt.festH)}</b></span><span>Trabajadas <b>${fmt(pt.worked)}</b></span><span>${left===0?"Cierra hoy":`Cierra en <b>${left}</b> ${left===1?"día":"días"}`}</span></div>
  </div>
  <div class="hero">
    <div class="date">${DOWL[d.getDay()]} ${d.getDate()} de ${MON[d.getMonth()]}</div>
    <div class="pills">${pillsFor(c)}</div>
    <div class="big num">${big}</div>
    <div class="sub">${sub}</div>
    <div class="actions">${actions}</div>
  </div>
  ${backupDue()?`<div class="bkban" role="region" aria-label="Copia de seguridad">
    <div><b>Haz una copia de tus datos</b><small>${backupInfo()} Tus fichajes solo están en este móvil.</small></div>
    <div class="bkban-a"><button class="btn primary small" id="bk-now">Guardar copia</button><button class="btn line small" id="bk-later">Ahora no</button></div>
  </div>`:""}
  <section class="block">
    <div class="h2"><h2>Esta semana</h2><span>${weekLabel(mon)}</span></div>
    <div class="week">
      <div class="days7">${cells}</div>
      <div class="bar" role="img" aria-label="${fmt(total)} de ${fmt(target)}"><i class="w" style="width:${wPct}%"></i><i class="x" style="width:${xPct}%"></i></div>
      <div class="barlbl num"><span><strong>${fmt(total)}</strong> de ${fmt(target)}</span><span>${wk.extra?`<strong style="color:var(--fucsia)">${fmt(wk.extra,true)}</strong> extra`:"sin extras"}${wk.festH?` · <strong style="color:var(--fest-ink)">${fmt(wk.festH)}</strong> fest.`:""}</span></div>
    </div>
  </section>
  <p class="note">Toca cualquier día de la semana para apuntarlo o corregirlo.</p>`;

  $("b-x").onclick=()=>openExtra(t);
  paintAvatars();
  const bkn=$("bk-now"); if(bkn){bkn.onclick=exportBackup; $("bk-later").onclick=()=>{ls.set("backupSnooze",Date.now()+7*864e5);renderHoy();toast("Te lo recuerdo en una semana")}}
  const bin=$("b-in"); if(bin) bin.onclick=()=>punch(t,Object.assign({},r,{e:nowHM(),s:null}),"Entrada fichada a las "+nowHM());
  const bon=$("b-outn"); if(bon) bon.onclick=()=>punch(od,Object.assign({},rec(od),{s:nowHM()}),"Salida fichada a las "+nowHM());
  const bout=$("b-out"); if(bout) bout.onclick=()=>punch(t,Object.assign({},r,{s:nowHM()}),"Salida fichada a las "+nowHM());
  const bfull=$("b-full"); if(bfull) bfull.onclick=()=>punch(t,Object.assign({},r,{e:c.p.e,s:c.p.s}),"Turno completo apuntado");
}

function renderMes(){
  const t=todayISO();
  if(!viewYM) viewYM=periodOf(new Date()).start;
  const per=periodOf(parse(viewYM)), first=parse(per.start), last=parse(per.end);
  const endSum = per.end<t?per.end:t;
  const tot = per.start<=t ? sumRange(per.start, endSum) : {worked:0,extra:0,festH:0,falta:0};
  let html="";
  for(let w=mondayOf(first); w<=last; w=addDays(w,7)){
    const wEnd=addDays(w,6);
    const ws=sumRange(iso(w),iso(wEnd));
    html+=`<div class="wkhead num"><span>${w.getDate()} ${MON[w.getMonth()].slice(0,3)} – ${wEnd.getDate()} ${MON[wEnd.getMonth()].slice(0,3)} · ${weekLabel(w)}</span><span><strong>${fmt(ws.worked)}</strong> / ${fmt(cfg.weekly*60)}${ws.extra?` · <strong style="color:var(--fucsia)">${fmt(ws.extra,true)}</strong>`:""}</span></div>`;
    for(let i=0;i<7;i++){
      const di=addDays(w,i), s=iso(di); if(s<per.start||s>per.end) continue;
      const c=calc(s); c.iso=s;
      const r=c.r;
      let tline = r.tipo? TIPOS[r.tipo] : (r.e? `${r.e} – ${r.s||"…"}` : (r.x? "Extra a mano" : (s<=t && !c.p.rest && !c.p.fest ? "Sin apuntar" : "—")));
      const empty = !r.e && !r.tipo && !r.x;
      let res="";
      if(c.worked) res+=`<div class="num">${fmt(c.worked)}</div>`;
      if(c.extra) res+=`<div class="xx num">${fmt(c.extra,true)} extra</div>`;
      if(c.festH) res+=`<div class="ff num">${fmt(c.festH)} fest.</div>`;
      if(c.falta) res+=`<div class="mm num">${fmt(-c.falta)}</div>`;
      if(c.open) res+=`<div class="xx">en curso</div>`;
      const meta = pillsFor(c);
      html+=`<button class="row ${s===t?"today":""} ${c.p.rest?"isrest":""}" data-edit="${s}">
        <div class="dn"><small>${DOW[di.getDay()]}</small><b class="num">${di.getDate()}</b></div>
        <div class="mid"><div class="t num ${empty?"empty":""}">${tline}</div><div class="meta">${meta}</div></div>
        <div class="res">${res}</div></button>`;
    }
  }
  $("v-mes").innerHTML=`
    <div class="monthnav"><button class="iconbtn" id="m-prev" aria-label="Periodo anterior">‹</button><h2 class="num" style="text-transform:none;font-size:23px">${shortD(per.start)} – ${shortD(per.end)}</h2><button class="iconbtn" id="m-next" aria-label="Periodo siguiente">›</button></div>
    <div class="tiles">
      <div class="tile"><small>Trabajadas</small><strong class="num">${fmt(tot.worked)}</strong></div>
      <div class="tile x"><small>Extras</small><strong class="num">${fmt(tot.extra)}</strong></div>
      <div class="tile f"><small>Festivas</small><strong class="num">${fmt(tot.festH)}</strong></div>
    </div>
    <div class="row2" style="display:flex;gap:8px;margin-top:12px"><button class="btn primary small" id="m-x">+ Extra</button><button class="btn line small" id="m-copy" style="flex:1">Copiar resumen</button></div>
    <div class="list">${html}</div>`;
  $("m-prev").onclick=()=>{viewYM=periodOf(addDays(first,-1)).start;renderMes()};
  $("m-next").onclick=()=>{viewYM=periodOf(addDays(last,1)).start;renderMes()};
  $("m-copy").onclick=()=>copyPeriod(per,tot);
  $("m-x").onclick=()=>openExtra(per.start<=t&&t<=per.end?t:per.end);
}

function copyPeriod(per,tot){
  let lines=[`Horas del ${shortD(per.start)} al ${shortD(per.end)}`,""];
  for(let d=parse(per.start); iso(d)<=per.end; d=addDays(d,1)){
    const s=iso(d), c=calc(s); if(!c.r.e && !c.r.tipo && !c.r.x) continue;
    let l=`${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}: `+(c.r.tipo?TIPOS[c.r.tipo]:(c.r.e?`${c.r.e}-${c.r.s||"?"}`:"extra")+` (${fmt(c.worked)})`);
    if(c.extra) l+=` · extra ${fmt(c.extra)}`; if(c.festH) l+=` · festivo`;
    lines.push(l);
  }
  lines.push("",`Total trabajadas: ${fmt(tot.worked)}`,`Horas extra: ${fmt(tot.extra)}`,`Horas festivas: ${fmt(tot.festH)}`);
  const text=lines.join("\n");
  try{navigator.clipboard.writeText(text).then(()=>toast("Resumen copiado"),()=>showText(text))}catch(e){showText(text)}
}

/* ---------- añadir extra rápido + calculadora ---------- */
function openExtra(day, mode){
  const r0=rec(day)||{}, p0=plan(day);
  let st={day, add:60, fill:true, mode:mode||"sumar", e:r0.e||p0.e, s:r0.s||p0.s};
  const draw=()=>{
    const r=rec(st.day)||{}, p=plan(st.day), c=calc(st.day);
    const seg=`<div class="seg" role="group" aria-label="Modo"><button data-mode="sumar" aria-pressed="${st.mode==="sumar"}">Sumar tiempo</button><button data-mode="calc" aria-pressed="${st.mode==="calc"}">Calcular por horario</button></div>`;
    let body, foot, summary;
    if(st.mode==="sumar"){
      const needsFill = !r.e && !r.tipo && !p.rest && !p.fest;
      const opts=[15,30,45,60,90,120];
      body=`
        <div class="qgrid" role="group" aria-label="Cantidad">${opts.map(m=>`<button class="qbtn num" data-q="${m}" aria-pressed="${st.add===m}">+${fmt(m)}</button>`).join("")}</div>
        <div class="grid2">
          <label class="f">Horas<input type="number" id="x-h" min="0" max="16" inputmode="numeric" value="${Math.floor(st.add/60)}"></label>
          <label class="f">Minutos<input type="number" id="x-m" min="0" max="59" step="5" inputmode="numeric" value="${st.add%60}"></label>
        </div>
        ${needsFill?`<label class="check"><input type="checkbox" id="x-fill" ${st.fill?"checked":""}><span>Ese día hice mi turno normal (${p.e}–${p.s}); apúntalo también</span></label>`:""}`;
      summary=`<div class="calc num"><span>Ese día llevas <strong style="color:var(--fucsia)">${fmt(p.fest?c.festH:c.extra)}</strong> ${p.fest?"festivas":"extra"}</span>${r.x?`<span>a mano: <strong>${fmt(r.x)}</strong></span>`:""}</div>`;
      foot=`${r.x?`<button class="btn line" id="x-undo">Quitar a mano</button>`:`<button class="btn line" data-close>Cancelar</button>`}<button class="btn primary" id="x-ok">Añadir +${fmt(st.add)}</button>`;
    } else {
      const worked=dur(st.e,st.s);
      let before=0, after=0, total, kind="extra", lines=[];
      if(p.fest){total=worked;kind="festivas";lines.push("Es festivo: todas las horas cuentan como festivas")}
      else if(p.rest){total=worked;lines.push("Es tu día de descanso: todo cuenta como extra")}
      else{
        const ps=toMin(p.e); let pe=toMin(p.s), e=toMin(st.e); if(pe<ps) pe+=1440; if(p.night && e<ps-720) e+=1440; let sM=toMin(st.s); while(sM<e) sM+=1440;
        before=Math.max(0,ps-e); after=Math.max(0,sM-pe);
        total=Math.max(0,worked-dur(p.e,p.s));
        if(before) lines.push(`${fmt(before)} antes de tu turno (${p.e})`);
        if(after) lines.push(`${fmt(after)} después de tu turno (${p.s})`);
        if(worked<dur(p.e,p.s)) lines.push(`Te faltarían ${fmt(dur(p.e,p.s)-worked)} para completar el turno`);
        if(!lines.length) lines.push("Dentro de tu horario normal");
      }
      body=`
        <div class="grid2">
          <label class="f">Entrada<input type="time" id="c-e" value="${st.e}"></label>
          <label class="f">Salida<input type="time" id="c-s" value="${st.s}"></label>
        </div>`;
      summary=`<div class="calcbig"><div style="font-size:13px;font-weight:700">Te supondría</div><div class="n num">${fmt(total)} ${kind}</div><div class="l num">${lines.join("<br>")}<br>Jornada total: ${fmt(worked)}</div></div>`;
      foot=`<button class="btn line" data-close>Cerrar</button><button class="btn primary" id="c-save">Apuntar este horario</button>`;
    }
    $("sheet-in").innerHTML=`
      <div class="grab"></div>
      <h3 id="sh-title">Horas extra</h3>
      <div class="stack">
        ${seg}
        <label class="f">Día<input type="date" id="x-day" value="${st.day}"></label>
        ${body}
      </div>
      ${summary}
      <div class="foot">${foot}</div>`;
    document.querySelectorAll("[data-mode]").forEach(bt=>bt.onclick=()=>{st.mode=bt.dataset.mode;draw()});
    $("x-day").onchange=e=>{if(e.target.value){st.day=e.target.value;const rr=rec(st.day)||{},pp=plan(st.day);st.e=rr.e||pp.e;st.s=rr.s||pp.s;draw()}};
    if(st.mode==="sumar"){
      document.querySelectorAll("[data-q]").forEach(bt=>bt.onclick=()=>{st.add=Number(bt.dataset.q);draw()});
      const upd=()=>{st.add=Math.max(0,(Number($("x-h").value)||0)*60+(Number($("x-m").value)||0));$("x-ok").textContent="Añadir +"+fmt(st.add);document.querySelectorAll("[data-q]").forEach(bt=>bt.setAttribute("aria-pressed",Number(bt.dataset.q)===st.add))};
      $("x-h").oninput=upd; $("x-m").oninput=upd;
      const fl=$("x-fill"); if(fl) fl.onchange=()=>{st.fill=fl.checked};
      const un=$("x-undo"); if(un) un.onclick=()=>{setRec(st.day,Object.assign({},r,{x:null}));closeSheet();toast("Extras a mano quitadas")};
      $("x-ok").onclick=()=>{
        if(!st.add){toast("Elige cuánto tiempo");return}
        const p=plan(st.day), needsFill=!r.e && !r.tipo && !p.rest && !p.fest;
        const nr=Object.assign({},r,{x:(r.x||0)+st.add});
        if(needsFill && st.fill){nr.e=p.e;nr.s=p.s}
        setRec(st.day,nr);closeSheet();toast(`+${fmt(st.add)} de extra apuntadas`);
      };
    } else {
      const ce=$("c-e"), cs=$("c-s");
      ce.onchange=()=>{if(ce.value){st.e=ce.value;draw()}}; cs.onchange=()=>{if(cs.value){st.s=cs.value;draw()}};
      $("c-save").onclick=()=>{setRec(st.day,Object.assign({},r,{e:st.e,s:st.s,tipo:null}));closeSheet();toast("Horario apuntado")};
    }
  };
  openSheet(""); draw();
}
function showText(text){
  openSheet(`<div class="grab"></div><h3 id="sh-title">Resumen</h3><p class="hint" style="color:var(--muted);font-size:13px">Mantén pulsado para copiarlo.</p><textarea id="sum-txt" readonly style="width:100%;min-height:260px;border:1.5px solid var(--line);border-radius:12px;padding:10px;background:var(--ground);color:var(--ink)">${text}</textarea><div class="foot" style="grid-template-columns:1fr"><button class="btn soft" data-close>Cerrar</button></div>`);
  const ta=$("sum-txt"); ta.focus(); ta.select();
}

/* ---------- nómina ---------- */
const NDEF={base:0, comp:0, pagas:14, prorr:false, anual:0, hora:0, recX:0, recF:75, irpf:12, ss:6.5, it:"legal"};
let nomYM=null;
const eur=v=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(v||0);
function nomData(){return Object.assign({},NDEF,cfg.nomina||{})}
function bajaOrdinal(s){let n=0,d=parse(s);while(n<400){const r=rec(iso(d));if(!r||r.tipo!=="baja")break;n++;d=addDays(d,-1)}return n}
// add (opcional): minutos imaginados que se suman a lo fichado, sin guardarse. {x: extra, f: festivas}
function estimate(per, add){
  const n=nomData();
  const fijo=(Number(n.base)||0)+(Number(n.comp)||0);
  const prorrata=n.prorr? fijo*((Number(n.pagas)||12)-12)/12 : 0;
  const mensual=fijo+prorrata;
  const anualH=Number(n.anual)||Math.round(cfg.weekly*45.7);
  const horaOrd=Number(n.hora)||(fijo*(Number(n.pagas)||12)/anualH);
  const t=sumRange(per.start,per.end);
  if(add){t.extra+=add.x||0; t.festH+=add.f||0}
  let bajaD=0, prest=0;
  const diario=mensual/30;
  for(let d=parse(per.start); iso(d)<=per.end; d=addDays(d,1)){
    const r=rec(iso(d)); if(!r||r.tipo!=="baja") continue;
    bajaD++; const k=bajaOrdinal(iso(d));
    let pct = k<=3?0 : k<=20?0.6 : 0.75;
    if(n.it==="100") pct=1; else if(n.it==="100d4" && k>3) pct=1;
    prest+=diario*pct;
  }
  const descBaja=bajaD*diario;
  const hx=horaOrd*(1+(Number(n.recX)||0)/100), hf=horaOrd*(1+(Number(n.recF)||0)/100);
  const exE=t.extra/60*hx, feE=t.festH/60*hf;
  const bruto=mensual-descBaja+prest+exE+feE;
  const ss=bruto*(Number(n.ss)||0)/100, irpf=bruto*(Number(n.irpf)||0)/100;
  return {n,fijo,prorrata,mensual,horaOrd,hx,hf,t,bajaD,prest,descBaja,exE,feE,bruto,ss,irpf,neto:bruto-ss-irpf,anualH};
}
/* ---------- simulador: «¿y si echo X horas?» (no guarda nada) ---------- */
let nomMode="est";
// Lo simulado no se guarda: vive solo mientras la app está abierta.
// mode "total": cantidades del periodo · mode "dias": minutos por día (clave = fecha ISO)
const sim={mode:"total", x:0, d:0, f:0, days:{}};
const SIM_MAX={x:200*60, d:15, f:100*60, day:16*60};
function shiftAvg(){const w=cfg.ciclo.dias.filter(v=>isWork(v,cfg));if(!w.length)return 480;return Math.round(w.reduce((a,k)=>a+dur(cfg.turnos[k].e,cfg.turnos[k].s),0)/w.length)}
function simDaysFrom(per){const t=todayISO();return per.start>t?per.start:t}
function simAdd(per){
  if(sim.mode!=="dias") return {x:sim.x+sim.d*shiftAvg(), f:sim.f, n:0};
  const from=simDaysFrom(per); let x=0,f=0,n=0;
  Object.entries(sim.days).forEach(([s,v])=>{
    if(!v||s<from||s>per.end) return;
    const r=rec(s); if(r&&r.tipo) return;
    if(plan(s).fest) f+=v; else x+=v; n++;
  });
  return {x,f,n};
}
function simDayRows(per,E,keep){
  const from=simDaysFrom(per);
  if(from>per.end) return `<div class="list"><p class="note" style="margin:16px">Este periodo ya ha terminado. Usa «Total del periodo» para hacer cuentas sobre él.</p></div>`;
  let html="";
  for(let d=parse(from), first=true; iso(d)<=per.end; d=addDays(d,1), first=false){
    const s=iso(d), p=plan(s), r=rec(s)||{}, v=sim.days[s]||0;
    if(first || d.getDay()===1) html+=`<div class="wkhead"><span>Semana del ${mondayOf(d).getDate()} ${MON[mondayOf(d).getMonth()].slice(0,3)}</span><span>${weekLabel(mondayOf(d))}</span></div>`;
    const name=`${DOW[d.getDay()]} ${d.getDate()}`;
    if(r.tipo){html+=`<div class="simrow off"><div><b>${name}</b><small>${TIPOS[r.tipo]}</small></div></div>`;continue}
    const kind=p.fest?"fest":p.rest?"rest":"work";
    const sub = kind==="work" ? `${p.name} ${p.e}–${p.s} · lo que pongas es extra`
              : kind==="rest" ? "Descanso · todo cuenta como extra"
              : `Festivo${festName(s)?" · "+festName(s):""} · horas festivas`;
    const full=dur(p.e,p.s);
    const money = v? `<em class="simeur num">≈ +${eur(v/60*(kind==="fest"?E.hf:E.hx)*keep)} netos</em>` : "";
    const fullBtn = kind!=="work" && v!==full ? `<button class="chip simfull" data-simfull="${s}" data-min="${full}">Turno entero · ${fmt(full)}</button>` : "";
    html+=`<div class="simrow ${kind} ${s===todayISO()?"today":""}"><div><b>${name}${s===todayISO()?" · hoy":""}</b><small>${sub}</small>${money}${fullBtn}</div>
      <div class="step sm"><button data-simday="${s}" data-step="-30" aria-label="Quitar media hora el ${name}" ${v<=0?"disabled":""}>−</button><output class="num" aria-live="polite">${v?(kind==="work"?"+":"")+fmt(v):"—"}</output><button data-simday="${s}" data-step="30" aria-label="Añadir media hora el ${name}">+</button></div></div>`;
  }
  return `<div class="list simdays">${html}</div>`;
}
function renderSim(per,E){
  const n=E.n, sMin=shiftAvg(), add=simAdd(per);
  const S=estimate(per,{x:add.x, f:add.f});
  const keep=1-((Number(n.ss)||0)+(Number(n.irpf)||0))/100;
  const diff=S.neto-E.neto, any=add.x||add.f;
  const t=todayISO(), fut=per.start>t, past=per.end<t, dias=sim.mode==="dias";
  const step=(k,label,sub,val,st)=>`
    <div class="simrow"><div><b>${label}</b><small>${sub}</small></div>
      <div class="step"><button data-sim="${k}" data-step="${-st}" aria-label="Quitar a ${label.toLowerCase()}" ${sim[k]<=0?"disabled":""}>−</button><output class="num" aria-live="polite">${val}</output><button data-sim="${k}" data-step="${st}" aria-label="Añadir a ${label.toLowerCase()}">+</button></div></div>`;
  const hint = dias
    ? (fut?"Elige cuánto echarías cada día. Cada media hora se suma a ese día.":past?"":"Desde hoy hasta el cierre. Se suma a lo que ya llevas fichado.")
    : (fut?"Periodo futuro: solo cuenta lo que pongas aquí.":past?"Periodo cerrado: se suma a lo que ya fichaste.":"Se suma a lo que ya llevas fichado en este periodo.");
  const anyInput = sim.x||sim.d||sim.f||Object.values(sim.days).some(Boolean);
  return `
    <div class="nres">
      <small>${any?"Cobrarías unos":"Neto estimado ahora"}</small>
      <div class="n num">≈ ${eur(S.neto)}</div>
      <div class="b num">${any?`<span class="simdiff">${diff>=0?"+":"−"}${eur(Math.abs(diff))}</span> netos más que con lo ${fut?"previsto":"fichado"}`:"Añade horas abajo para ver cuánto cambia"}</div>
    </div>
    <div class="card">
      <h3>¿Cuánto piensas echar?</h3>
      <div class="seg" role="group" aria-label="Cómo simular" style="margin:10px 0 12px"><button id="sm-total" aria-pressed="${!dias}">Total del periodo</button><button id="sm-dias" aria-pressed="${dias}">Día a día</button></div>
      ${hint?`<p class="hint">${hint}</p>`:""}
      ${dias&&past?"":dias?`<div class="calc num" style="margin-top:0"><span>Extra <strong style="color:var(--fucsia)">${fmt(add.x)}</strong></span><span>Festivas <strong style="color:var(--fest-ink)">${fmt(add.f)}</strong></span><span>en <strong>${add.n}</strong> ${add.n===1?"día":"días"}</span></div>`:`
      ${step("x","Horas extra","en días de trabajo",fmt(sim.x),30)}
      ${step("d","Descansos trabajados",`≈ ${fmt(sMin)} cada uno, todo extra`,sim.d,1)}
      ${step("f","Horas en festivo",`se pagan a ${eur(S.hf)}/h`,fmt(sim.f),30)}`}
      ${anyInput?`<button class="btn line small" id="sim-reset" style="width:100%;margin-top:12px">Empezar de cero</button>`:""}
    </div>
    ${dias?simDayRows(per,E,keep):""}
    <div class="card">
      <table class="ntable cmp num">
        <tr class="hd"><td></td><td>${fut?"Previsto":"Fichado"}</td><td>Simulado</td></tr>
        <tr><td>Horas extra</td><td>${fmt(E.t.extra)}</td><td>${fmt(S.t.extra)}</td></tr>
        <tr><td>Horas festivas</td><td>${fmt(E.t.festH)}</td><td>${fmt(S.t.festH)}</td></tr>
        <tr><td>Bruto</td><td>${eur(E.bruto)}</td><td>${eur(S.bruto)}</td></tr>
        <tr class="tot"><td>Neto</td><td>${eur(E.neto)}</td><td>${eur(S.neto)}</td></tr>
      </table>
      <div class="calc num" style="margin-top:12px"><span>Cada hora extra te deja <strong style="color:var(--fucsia)">≈ ${eur(S.hx*keep)}</strong></span><span>cada festiva <strong style="color:var(--fest-ink)">≈ ${eur(S.hf*keep)}</strong></span></div>
      <p class="disc">Simulación orientativa: no se apunta nada en tus fichajes. Usa tu IRPF actual (${n.irpf} %); si echas muchas extras durante el año, la empresa puede subirte la retención en nóminas siguientes.</p>
    </div>`;
}
function refocus(sel,alt){const a=document.querySelector(sel);if(a&&!a.disabled){a.focus({preventScroll:true});return}const b=alt&&document.querySelector(alt);if(b)b.focus({preventScroll:true})}
function bindSim(){
  document.querySelectorAll("[data-sim]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.sim, st=Number(b.dataset.step);
    sim[k]=Math.min(SIM_MAX[k],Math.max(0,sim[k]+st));
    renderNomina();
    refocus(`[data-sim="${k}"][data-step="${st}"]`,`[data-sim="${k}"][data-step="${-st}"]`);
  });
  document.querySelectorAll("[data-simday]").forEach(b=>b.onclick=()=>{
    const s=b.dataset.simday, st=Number(b.dataset.step);
    sim.days[s]=Math.min(SIM_MAX.day,Math.max(0,(sim.days[s]||0)+st));
    renderNomina();
    refocus(`[data-simday="${s}"][data-step="${st}"]`,`[data-simday="${s}"][data-step="${-st}"]`);
  });
  document.querySelectorAll("[data-simfull]").forEach(b=>b.onclick=()=>{
    const s=b.dataset.simfull; sim.days[s]=Number(b.dataset.min);
    renderNomina(); refocus(`[data-simday="${s}"][data-step="-30"]`);
  });
  $("sm-total").onclick=()=>{sim.mode="total";renderNomina()};
  $("sm-dias").onclick=()=>{sim.mode="dias";renderNomina()};
  const r=$("sim-reset"); if(r) r.onclick=()=>{sim.x=0;sim.d=0;sim.f=0;sim.days={};renderNomina()};
}

function renderNomina(){
  if(!nomYM) nomYM=periodOf(new Date()).start;
  const per=periodOf(parse(nomYM)), E=estimate(per), n=E.n;
  const ready=(Number(n.base)||0)>0;
  const simOn=ready && nomMode==="sim";
  const f=(id,label,val,extra="")=>`<label class="f">${label}<input type="number" id="${id}" inputmode="decimal" step="0.01" value="${val||""}" ${extra}></label>`;
  $("v-nomina").innerHTML=`
    <div class="monthnav"><button class="iconbtn" id="n-prev" aria-label="Periodo anterior">‹</button><h2 class="num" style="font-size:23px;text-transform:none">${shortD(per.start)} – ${shortD(per.end)}</h2><button class="iconbtn" id="n-next" aria-label="Periodo siguiente">›</button></div>
    ${ready?`<div class="seg" role="group" aria-label="Modo de nómina" style="margin-bottom:12px"><button id="nm-est" aria-pressed="${!simOn}">Mi estimación</button><button id="nm-sim" aria-pressed="${simOn}">Simular horas</button></div>`:""}
    ${simOn?renderSim(per,E):ready?`
    <div class="nres">
      <small>Neto estimado</small>
      <div class="n num" data-count="${E.neto}" data-fmt="eur" data-key="nom-neto">≈ ${eur(E.neto)}</div>
      <div class="b num">Bruto ${eur(E.bruto)}</div>
    </div>
    <div class="card">
      <table class="ntable num">
        <tr><td>Salario fijo<small>base + complementos${E.prorrata?" + prorrata pagas":""}</small></td><td>${eur(E.mensual)}</td></tr>
        <tr><td>Horas extra<small>${fmt(E.t.extra)} × ${eur(E.hx)}/h</small></td><td>${eur(E.exE)}</td></tr>
        <tr><td>Horas festivas<small>${fmt(E.t.festH)} × ${eur(E.hf)}/h</small></td><td>${eur(E.feE)}</td></tr>
        ${E.bajaD?`<tr><td>Días de baja<small>${E.bajaD} días descontados del fijo</small></td><td class="neg">−${eur(E.descBaja)}</td></tr>
        <tr><td>Prestación por baja<small>${n.it==="legal"?"días 1–3: 0 %, 4–20: 60 %, 21+: 75 %":n.it==="100"?"complemento al 100 %":"100 % desde el 4.º día"}</small></td><td>${eur(E.prest)}</td></tr>`:""}
        <tr class="tot"><td>Bruto</td><td>${eur(E.bruto)}</td></tr>
        <tr><td>Seguridad Social<small>${n.ss} %</small></td><td class="neg">−${eur(E.ss)}</td></tr>
        <tr><td>IRPF<small>${n.irpf} %</small></td><td class="neg">−${eur(E.irpf)}</td></tr>
        <tr class="tot"><td>Neto</td><td>${eur(E.neto)}</td></tr>
      </table>
      <p class="disc">Estimación orientativa. Tu convenio puede pagar festivos, extras o bajas de otra forma; compárala con tu nómina real y ajusta los datos.</p>
    </div>
    ${renderCuadra(per,E)}`:`
    <div class="nres"><small>Estimación de nómina</small><div class="n" style="font-size:26px;line-height:1.2">Rellena tus datos de nómina abajo</div><div class="b">Con tu salario base ya puedo calcular. El resto de campos afinan la cifra. Después podrás simular cuánto cobrarías echando más horas.</div></div>`}
    ${simOn?`<p class="note">Los precios de la hora salen de tus datos de nómina (en «Mi estimación»).</p>`:`
    <button class="btn line" id="n-report" style="width:100%;margin-top:12px">Informe para reclamar</button>
    <div class="card">
      <h3>Datos de tu nómina</h3>
      <p class="hint">Cópialos de una nómina reciente. Solo se guardan en tu cuenta.</p>
      <div class="stack" style="margin-top:0">
        <div class="grid2">${f("n-base","Salario base mensual (€)",n.base)}${f("n-comp","Complementos fijos (€)",n.comp)}</div>
        <div class="grid2">${f("n-pagas","Nº de pagas al año",n.pagas,'step="1"')}
          <label class="f">Pagas extra<select id="n-prorr"><option value="0" ${!n.prorr?"selected":""}>Aparte (jun/dic)</option><option value="1" ${n.prorr?"selected":""}>Prorrateadas</option></select></label></div>
        <div class="grid2">${f("n-irpf","IRPF (%)",n.irpf)}${f("n-ss","Seg. Social (%)",n.ss)}</div>
        <h3 style="margin-top:6px">Precio de las horas</h3>
        <p class="hint" style="margin:0">Hora ordinaria calculada: <b class="num">${eur(E.horaOrd)}</b>${Number(n.hora)?" (la que has puesto)":` (salario anual ÷ ${E.anualH} h)`}. Si en tu nómina aparece el precio, ponlo.</p>
        <div class="grid2">${f("n-hora","€ hora ordinaria (opcional)",n.hora)}${f("n-anual","Horas anuales convenio",n.anual,`step="1" placeholder="${Math.round(cfg.weekly*45.7)}"`)}</div>
        <div class="grid2">${f("n-recX","Recargo hora extra (%)",n.recX,'step="1"')}${f("n-recF","Recargo hora festiva (%)",n.recF,'step="1"')}</div>
        <label class="f">Bajas por enfermedad<select id="n-it">
          <option value="legal" ${n.it==="legal"?"selected":""}>Lo mínimo legal (0 % / 60 % / 75 %)</option>
          <option value="100d4" ${n.it==="100d4"?"selected":""}>Convenio: 100 % desde el 4.º día</option>
          <option value="100" ${n.it==="100"?"selected":""}>Convenio: 100 % desde el 1.er día</option></select></label>
      </div>
    </div>
    <p class="note">Marca las bajas en el calendario: toca el día → Baja → "Hasta el día".</p>`}`;
  $("n-prev").onclick=()=>{nomYM=periodOf(addDays(parse(per.start),-1)).start;renderNomina()};
  $("n-next").onclick=()=>{nomYM=periodOf(addDays(parse(per.end),1)).start;renderNomina()};
  if(ready){$("nm-est").onclick=()=>{nomMode="est";renderNomina()};$("nm-sim").onclick=()=>{nomMode="sim";renderNomina()}}
  if(simOn){bindSim();return}
  $("n-report").onclick=()=>openReport(per);
  if(ready) bindCuadra(per);
  const keys={"n-base":"base","n-comp":"comp","n-pagas":"pagas","n-irpf":"irpf","n-ss":"ss","n-hora":"hora","n-anual":"anual","n-recX":"recX","n-recF":"recF"};
  Object.entries(keys).forEach(([id,k])=>$(id).addEventListener("change",e=>{cfg.nomina=Object.assign(nomData(),{[k]:e.target.value===""?0:Number(String(e.target.value).replace(",","."))});persistCfg();renderNomina();toast("Guardado")}));
  $("n-prorr").onchange=e=>{cfg.nomina=Object.assign(nomData(),{prorr:e.target.value==="1"});persistCfg();renderNomina()};
  $("n-it").onchange=e=>{cfg.nomina=Object.assign(nomData(),{it:e.target.value});persistCfg();renderNomina()};
}

/* ---------- ¿te han pagado bien? (nómina real frente a lo fichado) ---------- */
// cfg.reales[inicio del periodo] = {neto, hx, hf}: neto cobrado (€) y horas extra/festivas pagadas (h)
const escH = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const numIn = v => {v=String(v==null?"":v).trim().replace(",",".");if(v==="")return null;const n=Number(v);return isFinite(n)&&n>=0?n:null};
const hNum = h => (Math.round(h*100)/100).toLocaleString("es-ES");
function realOf(per){return (cfg.reales||{})[per.start]||{}}
function cuadra(per,E){
  const R=realOf(per), o={R, has:false, warn:false, faltaE:0};
  if(R.neto!=null){o.has=true; o.dNeto=R.neto-E.neto}
  if(R.hx!=null){o.has=true; o.fx=Math.round(E.t.extra-R.hx*60); o.fxE=o.fx/60*E.hx}
  if(R.hf!=null){o.has=true; o.ff=Math.round(E.t.festH-R.hf*60); o.ffE=o.ff/60*E.hf}
  if(o.fx>=15) o.faltaE+=o.fxE;
  if(o.ff>=15) o.faltaE+=o.ffE;
  o.warn = o.faltaE>0 || (o.dNeto!=null && o.dNeto<-5);
  return o;
}
function hoursLine(label,fich,pag,diff,eurDiff,precio){
  if(pag==null) return "";
  const ok=Math.abs(diff)<15;
  const v = ok ? "Cuadra" : diff>0 ? `Faltan ${fmt(diff)}` : `${fmt(-diff)} de más`;
  return `<tr><td>${label}<small>fichadas ${fmt(fich)} · pagadas ${hNum(pag)} h${!ok&&diff>0?` · ≈ ${eur(eurDiff)} brutos a ${eur(precio)}/h`:""}</small></td><td class="${!ok&&diff>0?"bad":""}">${v}</td></tr>`;
}
function renderCuadra(per,E){
  const C=cuadra(per,E), R=C.R;
  const f=(id,label,val,ph)=>`<label class="f">${label}<input type="text" id="${id}" inputmode="decimal" value="${val!=null?String(val).replace(".",","):""}" placeholder="${ph}"></label>`;
  let verdict="";
  if(C.has){
    if(C.faltaE>0) verdict=`<div class="cq warn"><b>Te podrían faltar ≈ ${eur(C.faltaE)} brutos</b><span>Hay horas fichadas que no aparecen pagadas. El informe del periodo sirve para reclamarlas.</span></div>`;
    else if(C.dNeto!=null && C.dNeto<-5) verdict=`<div class="cq warn"><b>Has cobrado ${eur(-C.dNeto)} menos de lo estimado</b><span>Revisa que tus datos de nómina estén bien (IRPF, complementos). Si lo están, pregunta en tu empresa o ETT.</span></div>`;
    else verdict=`<div class="cq ok"><b>Cuadra</b><span>Lo que te han pagado coincide con lo que has fichado.</span></div>`;
  }
  return `<div class="card" id="cuadra">
      <h3>¿Te han pagado bien?</h3>
      <p class="hint">Cuando te llegue la nómina de este periodo, apunta lo que pone y lo comparo con lo que has fichado.</p>
      <div class="grid3">${f("r-neto","Neto cobrado €",R.neto,"0,00")}${f("r-hx","Extras pagadas h",R.hx,"0")}${f("r-hf","Festivas pagadas h",R.hf,"0")}</div>
      ${C.has?`<table class="ntable num" style="margin-top:12px">
        ${hoursLine("Horas extra",E.t.extra,R.hx,C.fx,C.fxE,E.hx)}
        ${hoursLine("Horas festivas",E.t.festH,R.hf,C.ff,C.ffE,E.hf)}
        ${R.neto!=null?`<tr><td>Neto<small>estimado ${eur(E.neto)} · cobrado ${eur(R.neto)}</small></td><td class="${C.dNeto<-5?"bad":""}">${Math.abs(C.dNeto)<=5?"Cuadra":(C.dNeto>0?"+":"−")+eur(Math.abs(C.dNeto))}</td></tr>`:""}
      </table>${verdict}`:""}
    </div>`;
}
function bindCuadra(per){
  const save=(k,v)=>{
    const all=Object.assign({},cfg.reales||{}), cur=Object.assign({},all[per.start]||{});
    if(v==null) delete cur[k]; else cur[k]=v;
    if(Object.keys(cur).length) all[per.start]=cur; else delete all[per.start];
    cfg.reales=all; persistCfg(); renderNomina(); toast("Guardado");
  };
  [["r-neto","neto"],["r-hx","hx"],["r-hf","hf"]].forEach(([id,k])=>$(id).addEventListener("change",e=>save(k,numIn(e.target.value))));
}

/* ---------- informe del periodo (imprimible / PDF) ---------- */
let reportPer=null;
function reportData(per){
  const t=todayISO(), end=per.end<t?per.end:t, rows=[];
  for(let d=parse(per.start); iso(d)<=end; d=addDays(d,1)){
    const s=iso(d), c=calc(s), p=c.p, r=c.r, fn=festName(s), notas=[];
    let prev;
    if(r.tipo) prev=TIPOS[r.tipo];
    else if(p.fest) prev="Festivo"+(fn?` (${fn})`:"");
    else if(p.rest) prev="Descanso";
    else prev=`${p.name} ${p.e}–${p.s}`;
    if(c.open) notas.push("sin salida fichada");
    if(r.x) notas.push(`${fmt(r.x)} apuntadas a mano`);
    if(c.falta) notas.push(`${fmt(c.falta)} menos que el turno`);
    rows.push({s, d:new Date(d), prev, e:r.e||"", sa:r.s||"", c, notas, off:!!(r.tipo||p.rest||p.fest)&&!c.worked});
  }
  return {rows, end};
}
function reportText(per){
  const {rows}=reportData(per), tot=sumRange(per.start,per.end<todayISO()?per.end:todayISO());
  const L=[`REGISTRO DE JORNADA · del ${shortD(per.start)} al ${shortD(per.end)}`,""];
  rows.forEach(x=>{ if(!x.c.worked && !x.c.open && x.off) return;
    L.push(`${DOW[x.d.getDay()]} ${x.d.getDate()}/${x.d.getMonth()+1}: ${x.e||"--:--"}–${x.sa||"--:--"} · ${fmt(x.c.worked)}`+(x.c.extra?` · extra ${fmt(x.c.extra)}`:"")+(x.c.festH?` · festivas ${fmt(x.c.festH)}`:"")+(x.notas.length?` (${x.notas.join(", ")})`:""));
  });
  L.push("",`Trabajadas ${fmt(tot.worked)} · Extra ${fmt(tot.extra)} · Festivas ${fmt(tot.festH)}`);
  return L.join("\n");
}
function openReport(per){
  reportPer=per;
  const I=Object.assign({nombre:"",empresa:""},cfg.informe||{});
  const {rows,end}=reportData(per), tot=sumRange(per.start,end);
  const E=estimate(per), ready=(Number(E.n.base)||0)>0, C=cuadra(per,E), R=C.R;
  const today=new Date(), fdate=x=>`${x.getDate()} de ${MON[x.getMonth()]} de ${x.getFullYear()}`;
  const blank=v=>v?escH(v):`<span class="rp-blank"></span>`;
  const turnos=TURNO_IDS.filter(k=>cfg.ciclo.dias.includes(k)&&cfg.turnos[k]).map(k=>`${escH(shiftName(k))} ${cfg.turnos[k].e}–${cfg.turnos[k].s}`).join(" · ");
  const ccaa=cfg.ccaa?((MTFest.CCAA.find(x=>x[0]===cfg.ccaa)||[])[1]||""):"";
  const pend=[];
  if(R.hx!=null && C.fx>=15) pend.push(`<tr><td>Horas extra fichadas sin pagar</td><td class="n">${fmt(C.fx)}</td><td class="n">${eur(E.hx)}/h</td><td class="n"><b>${eur(C.fxE)}</b></td></tr>`);
  if(R.hf!=null && C.ff>=15) pend.push(`<tr><td>Horas festivas fichadas sin pagar</td><td class="n">${fmt(C.ff)}</td><td class="n">${eur(E.hf)}/h</td><td class="n"><b>${eur(C.ffE)}</b></td></tr>`);
  $("report").innerHTML=`
    <div class="rp-tools">
      <div class="rp-row"><b>Informe del periodo</b><button class="btn line small" id="rp-close">Cerrar</button></div>
      <div class="rp-row">
        <label>Tu nombre<input id="rp-nombre" value="${escH(I.nombre)}" placeholder="Opcional" autocomplete="name"></label>
        <label>Empresa o ETT<input id="rp-empresa" value="${escH(I.empresa)}" placeholder="Opcional" autocomplete="organization"></label>
      </div>
      <div class="rp-row"><button class="btn primary small" id="rp-print">Imprimir o PDF</button><button class="btn line small" id="rp-share">Compartir texto</button></div>
      <small>Se guarda solo en este móvil. Si los dejas en blanco, el informe sale con una línea para rellenar a mano.</small>
    </div>
    <article class="rp-paper">
      <h1>Registro de jornada y horas extra</h1>
      <p class="rp-sub">Periodo de liquidación del ${fdate(parse(per.start))} al ${fdate(parse(per.end))}${end<per.end?` · fichajes hasta el ${fdate(parse(end))}`:""}</p>
      <table class="rp-meta"><tr><td>Trabajador/a</td><td>${blank(I.nombre)}</td></tr><tr><td>Empresa</td><td>${blank(I.empresa)}</td></tr>
        <tr><td>Turnos</td><td>${turnos||"—"}</td></tr><tr><td>Jornada</td><td>${hNum(cfg.weekly)} h semanales · periodo del día ${Number(cfg.corte)||20} al ${(Number(cfg.corte)||20)>1?(Number(cfg.corte)||20)-1:"último"} del mes siguiente</td></tr>
        ${ccaa?`<tr><td>Festivos</td><td>Nacionales y de ${escH(ccaa)} (BOE)</td></tr>`:""}</table>
      <h2>Detalle por días</h2>
      <div class="rp-scroll"><table class="rp-days">
        <thead><tr><th>Día</th><th>Previsto</th><th>Entrada</th><th>Salida</th><th>Trabajado</th><th>Extra</th><th>Festivo</th><th>Notas</th></tr></thead>
        <tbody>${rows.map(x=>`<tr class="${x.off?"off":""}"><td>${DOW[x.d.getDay()]} ${x.d.getDate()}/${x.d.getMonth()+1}</td><td>${escH(x.prev)}</td><td class="n">${x.e}</td><td class="n">${x.sa}</td><td class="n">${x.c.worked?fmt(x.c.worked):""}</td><td class="n">${x.c.extra?fmt(x.c.extra):""}</td><td class="n">${x.c.festH?fmt(x.c.festH):""}</td><td>${x.notas.join("; ")}</td></tr>`).join("")}</tbody>
        <tfoot><tr><td colspan="4">Total (${tot.days} días con fichaje)</td><td class="n">${fmt(tot.worked)}</td><td class="n">${fmt(tot.extra)}</td><td class="n">${fmt(tot.festH)}</td><td></td></tr></tfoot>
      </table></div>
      <h2>Resumen</h2>
      <table class="rp-sum">
        <tr><td>Horas extra fichadas</td><td class="n">${fmt(tot.extra)}</td><td>${R.hx!=null?`pagadas en nómina: ${hNum(R.hx)} h`:""}</td></tr>
        <tr><td>Horas en festivo fichadas</td><td class="n">${fmt(tot.festH)}</td><td>${R.hf!=null?`pagadas en nómina: ${hNum(R.hf)} h`:""}</td></tr>
        ${ready?`<tr><td>Neto estimado</td><td class="n">${eur(E.neto)}</td><td>${R.neto!=null?`cobrado: ${eur(R.neto)} (${C.dNeto>=0?"+":"−"}${eur(Math.abs(C.dNeto))})`:""}</td></tr>`:""}
      </table>
      ${pend.length?`<h2>Importe pendiente (estimado)</h2><table class="rp-sum"><thead><tr><th>Concepto</th><th>Horas</th><th>Precio</th><th>Importe bruto</th></tr></thead><tbody>${pend.join("")}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="n"><b>${eur(C.faltaE)}</b></td></tr></tfoot></table>`:""}
      <h2>Cómo se ha calculado</h2>
      <ul class="rp-rules">
        <li>Día laborable: es extra el tiempo trabajado por encima del turno previsto.</li>
        <li>Día de descanso: todo lo trabajado cuenta como extra.</li>
        <li>Festivo: todo lo trabajado cuenta como hora festiva.</li>
        ${ready?`<li>Precio de la hora: ordinaria ${eur(E.horaOrd)}, extra ${eur(E.hx)} (recargo ${Number(E.n.recX)||0} %), festiva ${eur(E.hf)} (recargo ${Number(E.n.recF)||0} %).</li>`:""}
      </ul>
      <p class="rp-foot">Registro elaborado por el propio trabajador a partir de sus fichajes diarios en la app Mis Turnos, a ${fdate(today)}. Los importes son una estimación orientativa y no sustituyen a la nómina oficial.</p>
      <div class="rp-sign"><div>Firma del trabajador/a</div><div>Recibido por la empresa</div></div>
    </article>`;
  $("report").hidden=false; document.body.classList.add("rp-open"); $("report").scrollTop=0;
  const keep=(k,el)=>el.addEventListener("change",()=>{cfg.informe=Object.assign({},cfg.informe||{},{[k]:el.value.trim()});persistCfg();openReport(per)});
  keep("nombre",$("rp-nombre")); keep("empresa",$("rp-empresa"));
  $("rp-close").onclick=closeReport;
  $("rp-print").onclick=()=>window.print();
  $("rp-share").onclick=()=>{const text=reportText(per);if(navigator.share)navigator.share({title:"Registro de jornada",text}).catch(()=>{});else{closeReport();showText(text)}};
}
function closeReport(){$("report").hidden=true;$("report").innerHTML="";document.body.classList.remove("rp-open");reportPer=null}

function renderAjustes(){
  const yr=new Date().getFullYear(), cc=cfg.ccaa||"";
  const nat=Object.entries(Object.assign({},MTFest.festivos(yr,cc),MTFest.festivos(yr+1,cc))).filter(([k])=>k>=todayISO()).sort().slice(0,8);
  const prevYr=[yr,yr+1].filter(y=>cc&&!MTFest.oficial(y));
  const own=[];
  Object.keys(months).sort().forEach(ym=>Object.entries(months[ym]||{}).forEach(([dd,r])=>{if(r.fest===true && !festName(ym+"-"+dd))own.push(ym+"-"+dd)}));
  const fdate=s=>{const x=parse(s);return `${DOW[x.getDay()]} ${x.getDate()} ${MON[x.getMonth()]}`};
  const used=TURNO_IDS.filter(k=>cfg.ciclo.dias.includes(k)&&cfg.turnos[k]);
  const n=cfg.ciclo.dias.length;
  $("v-ajustes").innerHTML=`
  <div class="card">
    <h3>Tus turnos</h3>
    <p class="hint">Ciclo de ${n} ${n===1?"día":"días"} que se repite sin fin. Lo que trabajes de más en un día de turno cuenta como extra.</p>
    <ul class="fests">${used.map(k=>{const t=cfg.turnos[k];return `<li><span><span class="pill ${k}">${t.nombre}</span></span><span class="num">${t.e}–${t.s} · ${fmt(dur(t.e,t.s))}${toMin(t.s)<toMin(t.e)?" · cruza medianoche":""}</span></li>`}).join("")||`<li><span>Solo descansos</span><span></span></li>`}</ul>
    <div class="h2" style="margin:14px 2px 8px"><h2 style="font-size:14px">Próximas dos semanas</h2></div>
    ${stripHTML(todayISO(),14,cfg)}
    <div class="grid2" style="margin-top:14px"><button class="btn soft small" id="t-hor">Cambiar horarios</button><button class="btn soft small" id="t-cic">Cambiar ciclo</button></div>
    <button class="btn line small" id="t-tpl" style="width:100%;margin-top:8px">Empezar con una plantilla</button>
  </div>
  <div class="card">
    <h3>Contrato y periodo</h3>
    <div class="grid2" style="margin-top:10px"><label class="f">Horas semanales de contrato<input type="number" id="c-w" step="0.5" min="1" value="${cfg.weekly}"></label>
      <label class="f">El periodo de extras empieza el día<select id="c-c">${Array.from({length:28},(_,i)=>i+1).map(n=>`<option value="${n}" ${Number(cfg.corte)===n?"selected":""}>${n}</option>`).join("")}</select></label></div>
  </div>
  <div class="card">
    <h3>Festivos</h3>
    <label class="f" style="margin:8px 0 10px">Tu comunidad<select id="c-cc">${ccaaOptions(cc)}</select></label>
    <p class="hint">${cc?"Vienen los festivos nacionales y los de tu comunidad según el BOE.":"Solo vienen los nacionales. Elige tu comunidad para añadir los suyos."} Los de tu ciudad (2 al año) márcalos tocando el día → <b>Festivo</b>.${cc==="CN"?" En Canarias, la fiesta de tu isla también se marca a mano.":""}${prevYr.length?` <b>${prevYr.join(" y ")}</b>: calendario aún sin publicar en el BOE, es una previsión.`:""}</p>
    <p class="hint" style="margin-top:-6px">Próximos:</p>
    <ul class="fests">
      ${nat.map(([k,v])=>`<li><span>${fdate(k)}</span><span>${v}</span></li>`).join("")}
      ${own.map(k=>`<li><span>${fdate(k)}</span><span>Marcado por ti</span></li>`).join("")}
    </ul>
  </div>
  <div class="card">
    <h3>Pantalla de inicio</h3>
    <p class="hint">Al abrir la app: la hora, tu turno y un botón grande para fichar (se deshace durante 5 segundos), botones para apuntar extras, festivo, vacaciones o baja, y el cambio entre modo normal y RPG. Para volver a ella desde la app, toca el logo de arriba.</p>
    <div class="seg" role="group" aria-label="Al abrir la app"><button id="qs-on" aria-pressed="${cfg.inicio!=="hoy"}">Pantalla de inicio</button><button id="qs-off" aria-pressed="${cfg.inicio==="hoy"}">Directo a Hoy</button></div>
    <button class="btn line small" id="qs-try" style="width:100%;margin-top:10px">Ver la pantalla de inicio</button>
    <p class="hint" style="margin:12px 0 0">Y sin abrir la app: con la app instalada, mantén pulsado su icono y arrastra <b>"Fichar ahora"</b> a la pantalla de inicio. Al tocarlo ficha la entrada (o la salida si ya habías entrado) con la hora exacta y calcula la extra con tu horario.</p>
  </div>
  <div class="card">
    <h3>Copia de seguridad</h3>
    <p class="hint">Tus datos se guardan solo en este móvil. Si lo pierdes, lo cambias o se borran los datos del navegador, solo los recuperas con una copia. <b>${backupInfo()}</b></p>
    <p class="hint">Al guardarla se abre el menú Compartir: elige <b>Guardar en Archivos</b> (iCloud Drive), Google Drive, o mándatela por correo o WhatsApp. Cada ${BACKUP_DIAS} días con cambios te lo recordaré en Hoy.</p>
    <div class="grid2"><button class="btn primary small" id="bk-exp">Guardar copia</button><button class="btn line small" id="bk-imp">Recuperar copia</button></div>
    <input type="file" id="bk-file" accept="application/json,.json" hidden>
  </div>
  <div class="card">
    <h3>Aspecto</h3>
    <div class="seg"><button id="k-neon" aria-pressed="${skin()==="neon"}">Neón</button><button id="k-clasico" aria-pressed="${skin()==="clasico"}">Clásico</button></div>
  </div>
  <div class="card">
    <h3>Modo RPG</h3>
    <p class="hint">Un personaje que sube de nivel cuando fichas con constancia, un jefe por cada periodo y logros. Se calcula con tus fichajes: no cambia ningún dato y lo puedes quitar cuando quieras. Las horas extra no dan más experiencia.</p>
    <div class="seg" role="group" aria-label="Modo RPG"><button id="rpg-on" aria-pressed="${!!cfg.rpg}">Activado</button><button id="rpg-off" aria-pressed="${!cfg.rpg}">Desactivado</button></div>
  </div>
  <p class="note">Tus datos se guardan solo en este móvil. Haz una copia de seguridad de vez en cuando.</p>
  <p class="note">Mis Turnos · creada por <b>Francisco Muñoz Dorado</b><br><a href="https://github.com/francisykza/mis-turnos" target="_blank" rel="noopener" style="color:var(--fucsia)">Código en GitHub</a> · Licencia MIT · © 2026</p>`;
  $("t-hor").onclick=()=>openWizard(2);
  $("t-cic").onclick=()=>openWizard(3);
  $("t-tpl").onclick=()=>openWizard(1);
  $("bk-exp").onclick=exportBackup;
  $("bk-imp").onclick=()=>$("bk-file").click();
  $("bk-file").onchange=e=>{const f=e.target.files[0];if(f)importBackup(f);e.target.value=""};
  $("rpg-on").onclick=()=>{if(!cfg.rpg){setRPG(true);tab="rpg";render();window.scrollTo(0,0)}};
  $("rpg-off").onclick=()=>setRPG(false);
  $("k-neon").onclick=()=>{cfg.skin="neon";persistCfg();applySkin();renderAjustes()};
  $("k-clasico").onclick=()=>{cfg.skin="clasico";persistCfg();applySkin();renderAjustes()};
  const bind=(id,fn)=>$(id).addEventListener("change",e=>{fn(e.target.value);persistCfg();render();toast("Guardado")});
  $("qs-on").onclick=()=>{cfg.inicio="rapido";persistCfg();renderAjustes();toast("La app se abrirá en la pantalla de inicio")};
  $("qs-off").onclick=()=>{cfg.inicio="hoy";persistCfg();renderAjustes();toast("La app se abrirá en Hoy")};
  $("qs-try").onclick=openQuick;
  bind("c-c",v=>{cfg.corte=Number(v);viewYM=null});
  bind("c-cc",v=>{cfg.ccaa=v});
  bind("c-w",v=>cfg.weekly=Math.max(1,Number(v)||37.5));
}
function ccaaOptions(sel){return `<option value="" ${!sel?"selected":""}>Solo festivos nacionales</option>`+MTFest.CCAA.map(([k,n])=>`<option value="${k}" ${sel===k?"selected":""}>${n}</option>`).join("")}
// Tira de días con el turno de cada uno (src = {turnos, ciclo})
function stripHTML(from,count,src){
  let h="";
  for(let i=0;i<count;i++){
    const d=addDays(parse(from),i), s=iso(d), v=cycVal(s,src), w=isWork(v,src);
    h+=`<div class="sd ${w?v:"R"} ${s===todayISO()?"today":""}"><b>${DOW[d.getDay()].slice(0,1)}</b><em class="num">${d.getDate()}</em><span>${w?src.turnos[v].nombre.slice(0,1):"·"}</span></div>`;
  }
  return `<div class="strip">${h}</div>`;
}

/* ---------- asistente de turnos ---------- */
const TPLS=[
  {id:"mt",   t:"Mañana y tarde",                    d:"Una semana de mañana y otra de tarde"},
  {id:"mtn",  t:"Mañana, tarde y noche",             d:"Cada semana un turno"},
  {id:"fijo", t:"Siempre el mismo horario",          d:"De lunes a viernes"},
  {id:"xy",   t:"Días seguidos de trabajo y descanso", d:"Por ejemplo, 4 días sí y 4 no"},
  {id:"libre",t:"Lo dibujo yo",                      d:"Marcas día a día cómo es tu ciclo"}
];
let wz=null;
const rotate=(a,k)=>{const n=a.length;k=((k%n)+n)%n;return a.slice(k).concat(a.slice(0,k))};
// Mueve el inicio del ciclo a «desde» sin cambiar qué toca cada día
function reanchor(c,desde){
  const n=c.dias.length, k=Math.round((parse(desde)-parse(c.inicio))/864e5);
  return {inicio:desde, dias:rotate(c.dias,k)};
}
function wzStart(c){return c.dias.length%7===0 ? iso(mondayOf(new Date())) : todayISO()}
function openWizard(step,first){
  const c=clone(cfg.ciclo);
  wz={step:step||1, first:!!first, tpl:null, turnos:clone(cfg.turnos), ciclo:reanchor(c,wzStart(c)),
      weekly:cfg.weekly, corte:cfg.corte, xy:{on:4,off:4}, desde:first?"siempre":"hoy", touchedWeekly:false, ccaa:cfg.ccaa||""};
  openSheet(""); drawWz();
}
function applyTpl(id){
  const T=wz.turnos, mon=iso(mondayOf(new Date())), rep=(v,n)=>Array(n).fill(v);
  const only=ids=>TURNO_IDS.forEach(k=>T[k].on=ids.includes(k));
  if(id==="mt"){only(["M","T"]);wz.ciclo={inicio:mon,dias:[...rep("M",6),"D",...rep("T",6),"D"]}}
  if(id==="mtn"){only(["M","T","N"]);wz.ciclo={inicio:mon,dias:[...rep("M",6),"D",...rep("T",6),"D",...rep("N",6),"D"]}}
  if(id==="fijo"){only(["M"]);wz.ciclo={inicio:mon,dias:[...rep("M",5),"D","D"]}}
  if(id==="xy"){only(["M"]);wz.ciclo={inicio:todayISO(),dias:[...rep("M",wz.xy.on),...rep("D",wz.xy.off)]}}
  wz.tpl=id;
}
function wzOn(){return TURNO_IDS.filter(k=>wz.turnos[k].on)}
function wzClean(){const on=wzOn();wz.ciclo.dias=wz.ciclo.dias.map(v=>on.includes(v)?v:"D")}
function wzAvgWeekly(){
  const d=wz.ciclo.dias, m=d.reduce((a,v)=>a+(wz.turnos[v]&&wz.turnos[v].on?dur(wz.turnos[v].e,wz.turnos[v].s):0),0);
  return Math.round(m*7/d.length/30)/2;
}
function drawWz(){
  const st=wz.step, T=wz.turnos;
  let title, body, next="Siguiente";
  if(st===1){
    title="¿Cómo son tus turnos?";
    body=`<p class="hint" style="margin:6px 0 12px;color:var(--muted)">Elige lo que más se parezca. Después podrás ajustar horarios y días.</p>
      <div class="stack" style="margin-top:0">${TPLS.map(t=>`<button class="tplbtn" data-tpl="${t.id}" aria-pressed="${wz.tpl===t.id}"><b>${t.t}</b><small>${t.d}</small></button>`).join("")}</div>
      ${wz.tpl==="xy"?`<div class="grid2" style="margin-top:12px">
        <label class="f">Días de trabajo seguidos<input type="number" id="w-on" min="1" max="14" inputmode="numeric" value="${wz.xy.on}"></label>
        <label class="f">Días de descanso<input type="number" id="w-off" min="1" max="14" inputmode="numeric" value="${wz.xy.off}"></label></div>`:""}`;
  } else if(st===2){
    title="Tus horarios";
    body=`<p class="hint" style="margin:6px 0 4px;color:var(--muted)">Activa los turnos que haces y pon su hora de entrada y salida. Si la salida es antes que la entrada, es de noche y cruza la medianoche.</p>
      ${TURNO_IDS.map(k=>{const t=T[k];return `<div class="trow ${t.on?"":"off"}">
        <div class="trow-h"><button class="chip" data-ton="${k}" aria-pressed="${t.on}">${t.on?"✓ ":""}<span class="pill ${k}" style="padding:2px 8px">${t.nombre}</span></button>
          ${t.on?`<span class="num tdur">${fmt(dur(t.e,t.s))}${toMin(t.s)<toMin(t.e)?" · noche":""}</span>`:""}</div>
        ${t.on?`<div class="grid3"><label class="f">Nombre<input type="text" maxlength="14" data-tn="${k}" value="${t.nombre}"></label>
          <label class="f">Entrada<input type="time" data-te="${k}" value="${t.e}"></label>
          <label class="f">Salida<input type="time" data-ts="${k}" value="${t.s}"></label></div>`:""}
      </div>`}).join("")}`;
  } else if(st===3){
    title="Tu ciclo";
    const on=wzOn(), c=wz.ciclo, n=c.dias.length, d0=parse(c.inicio), lead=(d0.getDay()+6)%7;
    let cells=Array.from({length:lead},()=>`<span></span>`).join("");
    c.dias.forEach((v,i)=>{const d=addDays(d0,i), w=on.includes(v), s=iso(d);
      cells+=`<button class="cyc ${w?v:"R"} ${s===todayISO()?"today":""}" data-cyc="${i}" aria-label="${DOWL[d.getDay()]} ${d.getDate()}: ${w?T[v].nombre:"descanso"}"><em class="num">${d.getDate()}</em><span>${w?T[v].nombre.slice(0,1):"·"}</span></button>`});
    const tv=cycVal(todayISO(),{ciclo:c,turnos:T}), tw=on.includes(tv);
    body=`<p class="hint" style="margin:6px 0 10px;color:var(--muted)">Empieza el ${parse(c.inicio).getDate()} de ${MON[parse(c.inicio).getMonth()]}. Toca un día para cambiarlo (${on.map(k=>T[k].nombre.toLowerCase()).concat("descanso").join(" → ")}). La app repite este ciclo sin fin.</p>
      <div class="cycgrid"><b>L</b><b>M</b><b>X</b><b>J</b><b>V</b><b>S</b><b>D</b>${cells}</div>
      <div class="calc num"><span>Hoy te toca <strong>${tw?T[tv].nombre.toLowerCase()+" "+T[tv].e+"–"+T[tv].s:"descanso"}</strong></span></div>
      <div class="simrow" style="border-top:0"><div><b>Duración del ciclo</b><small>${n%7===0?`${n/7} ${n===7?"semana":"semanas"}`:`${n} días`}</small></div>
        <div class="step sm"><button id="w-len-" aria-label="Un día menos" ${n<=1?"disabled":""}>−</button><output class="num">${n}</output><button id="w-len+" aria-label="Un día más" ${n>=42?"disabled":""}>+</button></div></div>
      <p class="hint" style="margin:4px 0 6px;color:var(--muted)">¿No cuadra con lo que te toca? Corre el ciclo:</p>
      <div class="chips"><button class="chip" data-rot="-7">‹ semana</button><button class="chip" data-rot="-1">‹ día</button><button class="chip" data-rot="1">día ›</button><button class="chip" data-rot="7">semana ›</button></div>`;
  } else {
    title="Contrato y periodo";
    const avg=wzAvgWeekly();
    if(wz.first && !wz.touchedWeekly) wz.weekly=avg||wz.weekly;
    const hasPast=Object.keys(months).length>0;
    body=`<p class="hint" style="margin:6px 0 12px;color:var(--muted)">Con tu ciclo te salen <b class="num">${String(avg).replace(".",",")} h</b> a la semana de media. Pon las de tu contrato: sirven para la barra semanal y el precio de la hora.</p>
      <div class="grid2"><label class="f">Horas semanales de contrato<input type="number" id="w-week" step="0.5" min="1" value="${wz.weekly}"></label>
        <label class="f">El periodo de extras empieza el día<select id="w-corte">${Array.from({length:28},(_,i)=>i+1).map(n=>`<option value="${n}" ${Number(wz.corte)===n?"selected":""}>${n}</option>`).join("")}</select></label></div>
      <label class="f" style="margin-top:12px">Tu comunidad, para los festivos<select id="w-cc">${ccaaOptions(wz.ccaa)}</select></label>
      ${hasPast?`<p class="hint" style="margin:16px 0 6px;color:var(--muted)">¿Desde cuándo valen estos turnos?</p>
      <div class="seg"><button data-desde="hoy" aria-pressed="${wz.desde==="hoy"}">Desde hoy</button><button data-desde="siempre" aria-pressed="${wz.desde==="siempre"}">Desde siempre</button></div>
      <p class="disc">${wz.desde==="hoy"?"Los días anteriores a hoy se siguen calculando con tus turnos de antes.":"Se recalcula todo lo pasado con estos turnos (útil si antes estaban mal puestos)."}</p>`:""}`;
    next="Guardar";
  }
  $("sheet-in").innerHTML=`<div class="grab"></div>
    <div class="wzsteps num">Paso ${st} de 4</div>
    <h3 id="sh-title">${title}</h3>${body}
    <div class="foot">${st>1?`<button class="btn line" id="w-back">Atrás</button>`:`<button class="btn line" data-close>${wz.first?"Ahora no":"Cancelar"}</button>`}<button class="btn primary" id="w-next">${next}</button></div>`;
  // eventos
  document.querySelectorAll("[data-tpl]").forEach(b=>b.onclick=()=>{wz.tpl=b.dataset.tpl;drawWz()});
  const won=$("w-on"), woff=$("w-off");
  if(won){won.onchange=()=>{wz.xy.on=Math.min(14,Math.max(1,Number(won.value)||4))};woff.onchange=()=>{wz.xy.off=Math.min(14,Math.max(1,Number(woff.value)||4))}}
  document.querySelectorAll("[data-ton]").forEach(b=>b.onclick=()=>{const k=b.dataset.ton;if(T[k].on&&wzOn().length===1){toast("Deja al menos un turno");return}T[k].on=!T[k].on;drawWz()});
  document.querySelectorAll("[data-tn]").forEach(i=>i.onchange=()=>{T[i.dataset.tn].nombre=i.value.trim()||TURNOS_DEF[i.dataset.tn].nombre;drawWz()});
  document.querySelectorAll("[data-te]").forEach(i=>i.onchange=()=>{if(i.value){T[i.dataset.te].e=i.value;drawWz()}});
  document.querySelectorAll("[data-ts]").forEach(i=>i.onchange=()=>{if(i.value){T[i.dataset.ts].s=i.value;drawWz()}});
  document.querySelectorAll("[data-cyc]").forEach(b=>b.onclick=()=>{
    const i=Number(b.dataset.cyc), opts=wzOn().concat("D"), cur=opts.indexOf(wz.ciclo.dias[i]);
    wz.ciclo.dias[i]=opts[(cur+1)%opts.length]; drawWz();
    const again=document.querySelector(`[data-cyc="${i}"]`); if(again) again.focus({preventScroll:true});
  });
  const lm=$("w-len-"), lp=$("w-len+");
  if(lm){lm.onclick=()=>{if(wz.ciclo.dias.length>1){wz.ciclo.dias.pop();drawWz()}};lp.onclick=()=>{if(wz.ciclo.dias.length<42){wz.ciclo.dias.push("D");drawWz()}}}
  document.querySelectorAll("[data-rot]").forEach(b=>b.onclick=()=>{wz.ciclo.dias=rotate(wz.ciclo.dias,Number(b.dataset.rot));drawWz()});
  const ww=$("w-week"); if(ww) ww.onchange=()=>{wz.weekly=Math.max(1,Number(String(ww.value).replace(",","."))||wz.weekly);wz.touchedWeekly=true};
  const wc=$("w-corte"); if(wc) wc.onchange=()=>{wz.corte=Number(wc.value)};
  const wcc=$("w-cc"); if(wcc) wcc.onchange=()=>{wz.ccaa=wcc.value};
  document.querySelectorAll("[data-desde]").forEach(b=>b.onclick=()=>{wz.desde=b.dataset.desde;drawWz()});
  const bk=$("w-back"); if(bk) bk.onclick=()=>{wz.step--;drawWz();$("sheet").scrollTop=0};
  $("w-next").onclick=()=>{
    if(st===1){ if(!wz.tpl){toast("Elige una opción");return} if(wz.tpl!=="libre") applyTpl(wz.tpl) }
    if(st===2) wzClean();
    if(st<4){wz.step++;drawWz();$("sheet").scrollTop=0;return}
    saveWizard();
  };
}
function saveWizard(){
  wzClean();
  const ciclo=reanchor(wz.ciclo,wz.ciclo.inicio); // copia limpia
  if(wz.desde==="hoy" && Object.keys(months).length){
    const ayer=iso(addDays(new Date(),-1));
    const antes=(cfg.antes||[]).filter(h=>h.hasta<=ayer);
    if(!antes.some(h=>h.hasta===ayer)) antes.push({hasta:ayer, turnos:clone(cfg.turnos), ciclo:clone(cfg.ciclo)});
    antes.sort((a,b)=>a.hasta<b.hasta?-1:1);
    cfg.antes=antes;
  } else if(wz.desde==="siempre"){ delete cfg.antes }
  cfg.turnos=clone(wz.turnos); cfg.ciclo=ciclo; cfg.weekly=wz.weekly; cfg.corte=wz.corte; cfg.ccaa=wz.ccaa;
  persistCfg(); viewYM=null; nomYM=null; closeSheet(); render(); toast("Turnos guardados");
}
/* ---------- copias de seguridad ---------- */
// Fechas en el navegador (no en cfg): lastBackup = última copia, lastEdit = último cambio,
// backupSnooze = hasta cuándo no avisar tras «Ahora no».
const stamp = k => Number(ls.get(k))||0;
function markEdit(){ls.set("lastEdit",Date.now())}
// Quien ya tenía datos al llegar esta versión cuenta como «sin copia todavía»
if(!stamp("lastEdit") && Object.keys(months).length) markEdit();
const daysSince = t => Math.floor((Date.now()-t)/864e5);
const BACKUP_DIAS = 14;
function backupDue(){
  const lb=stamp("lastBackup"), le=stamp("lastEdit");
  if(!Object.keys(months).length || le<=lb || Date.now()<stamp("backupSnooze")) return false;
  if(!lb) return Object.values(months).reduce((a,m)=>a+Object.keys(m||{}).length,0)>=3; // sin agobiar el primer día
  return daysSince(lb)>=BACKUP_DIAS;
}
function backupInfo(){
  const lb=stamp("lastBackup");
  if(!lb) return "Aún no has guardado ninguna copia.";
  const n=daysSince(lb), d=new Date(lb);
  return `Última copia: ${n===0?"hoy":n===1?"ayer":"hace "+n+" días"} (${d.getDate()} ${MON[d.getMonth()].slice(0,3)}).`;
}
function backupDone(){ls.set("lastBackup",Date.now());ls.set("backupSnooze",0);toast("Copia guardada");render()}
// En el móvil abre el menú Compartir (Guardar en Archivos, Drive, WhatsApp, correo…);
// en el ordenador, o si no se puede compartir, descarga el archivo.
function exportBackup(){
  const data={app:"mis-turnos",version:DATA_V,exportado:new Date().toISOString(),cfg,months};
  const txt=JSON.stringify(data,null,1), name="mis-turnos-copia-"+todayISO()+".json";
  const download=()=>{
    try{
      const a=document.createElement("a");
      a.href=URL.createObjectURL(new Blob([txt],{type:"application/json"}));
      a.download=name;
      document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
      backupDone();
    }catch(e){showText(txt)}
  };
  let file=null;
  try{file=new File([txt],name,{type:"application/json"})}catch(e){}
  const touch=matchMedia("(pointer:coarse)").matches;
  if(touch && file && navigator.canShare && navigator.canShare({files:[file]})){
    navigator.share({files:[file],title:"Copia de Mis Turnos"}).then(backupDone,e=>{if(e&&e.name==="AbortError")return;download()});
  } else download();
}
// Pide al navegador que no borre los datos de la app cuando ande justo de espacio
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persisted().then(p=>{if(!p)navigator.storage.persist()}).catch(()=>{})}catch(e){}
function importBackup(file){
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const d=JSON.parse(rd.result);
      if(!d||d.app!=="mis-turnos"||typeof d.months!=="object") throw 0;
      if((Number(d.version)||0)>DATA_V){toast("Esa copia es de una versión más nueva; actualiza la app");return}
      const de=d.exportado?new Date(d.exportado):null, cuando=de&&!isNaN(de)?` del ${de.getDate()} de ${MON[de.getMonth()]} de ${de.getFullYear()}`:"";
      if(Object.keys(months).length && !confirm(`Se sustituirán todos los datos de este móvil por los de la copia${cuando}. ¿Seguir?`)) return;
      const o=migrate(d.cfg||{}, d.months||{}, Number(d.version)||0);
      cfg=o.cfg; months=o.months;
      ls.set("cfg",cfg); ls.set("months",months); ls.set("schema",DATA_V); viewYM=null; nomYM=null;
      ls.set("lastBackup",Date.now()); ls.set("lastEdit",Date.now()-1);
      render(); toast("Copia importada");
    }catch(e){toast("Ese archivo no es una copia de Mis Turnos")}
  };
  rd.readAsText(file);
}

/* ---------- editor de día ---------- */
let editing=null;
function openEditor(s, preTipo){
  const d=parse(s), r=Object.assign({},rec(s)||{}), p=plan(s);
  editing={s, r, festDefault: !!festName(s)};
  if(preTipo){editing.r.tipo=preTipo;editing.r.e=null;editing.r.s=null;editing.r.x=null}
  const draw=()=>{
    const fest = editing.r.fest!=null? editing.r.fest : editing.festDefault;
    const c=(()=>{const save=rec(s);const ym=s.slice(0,7),dd=s.slice(8);months[ym]=Object.assign({},months[ym],{[dd]:editing.r});const out=calc(s);if(save)months[ym][dd]=save;else delete months[ym][dd];return out})();
    $("sheet-in").innerHTML=`
      <div class="grab"></div>
      <h3 id="sh-title">${DOWL[d.getDay()]} ${d.getDate()} de ${MON[d.getMonth()]}</h3>
      <div class="pills" style="margin-top:8px">${p.rest?`<span class="pill R">Descanso</span>`:`<span class="pill ${p.sh}">${p.name} ${p.e}–${p.s}</span>`}</div>
      <div class="stack">
        <div class="chips" role="group" aria-label="Tipo de día">
          <button class="chip" data-tipo="" aria-pressed="${!editing.r.tipo}">Trabajo</button>
          ${Object.entries(TIPOS).map(([k,v])=>`<button class="chip" data-tipo="${k}" aria-pressed="${editing.r.tipo===k}">${v}</button>`).join("")}
        </div>
        ${editing.r.tipo?`<label class="f">Hasta el día (para marcar varios días seguidos)<input type="date" id="e-hasta" min="${s}" value="${editing.hasta||""}"></label>`:""}
        ${editing.r.tipo?"":`
        <div class="grid2">
          <label class="f">Entrada<input type="time" id="e-e" value="${editing.r.e||""}"></label>
          <label class="f">Salida<input type="time" id="e-s" value="${editing.r.s||""}"></label>
        </div>
        ${p.rest?"":`<button class="btn soft small" id="e-full">Rellenar con mi turno (${p.e}–${p.s})</button>`}
        <label class="f">Extra apuntada a mano (minutos)<input type="number" id="e-x" min="0" step="5" inputmode="numeric" value="${editing.r.x||""}" placeholder="0"></label>`}
        <div class="chips"><button class="chip fest" id="e-fest" aria-pressed="${fest}">${fest?"✓ Festivo":"Marcar como festivo"}</button>${festName(s)?`<span style="font-size:13px;color:var(--muted);align-self:center">${festName(s)}</span>`:""}</div>
      </div>
      <div class="calc num"><span>Trabajadas <strong>${fmt(c.worked)}</strong></span><span>Extra <strong style="color:var(--fucsia)">${fmt(c.extra)}</strong></span><span>Festivas <strong style="color:var(--fest-ink)">${fmt(c.festH)}</strong></span></div>
      <div class="foot"><button class="btn line" id="e-clear">Borrar</button><button class="btn primary" id="e-save">Guardar</button></div>`;
    $("sheet-in").querySelectorAll("[data-tipo]").forEach(b=>b.onclick=()=>{editing.r.tipo=b.dataset.tipo||null;if(editing.r.tipo){editing.r.e=null;editing.r.s=null;editing.r.x=null}draw()});
    const ee=$("e-e"), es=$("e-s");
    if(ee){ee.onchange=()=>{editing.r.e=ee.value||null;draw()};es.onchange=()=>{editing.r.s=es.value||null;draw()}}
    const ex=$("e-x"); if(ex) ex.onchange=()=>{editing.r.x=Math.max(0,Number(ex.value)||0)||null;draw()};
    const ef=$("e-full"); if(ef) ef.onclick=()=>{editing.r.e=p.e;editing.r.s=p.s;draw()};
    $("e-fest").onclick=()=>{const now=editing.r.fest!=null?editing.r.fest:editing.festDefault;const nv=!now;editing.r.fest=(nv===editing.festDefault)?null:nv;draw()};
    $("e-clear").onclick=()=>{const f=editing.r.fest;setRec(s,f!=null?{fest:f}:null);closeSheet();toast("Día borrado")};
    const eh=$("e-hasta"); if(eh) eh.onchange=()=>{editing.hasta=eh.value};
    $("e-save").onclick=()=>{
      if(editing.r.tipo && editing.hasta && editing.hasta>s){
        const touched=new Set(); let n=0;
        for(let x=parse(s); iso(x)<=editing.hasta && n<400; x=addDays(x,1),n++){
          const k=iso(x), ym=k.slice(0,7), prev=rec(k)||{};
          months[ym]=Object.assign({},months[ym],{[k.slice(8)]:Object.assign({},prev.fest!=null?{fest:prev.fest}:{}, {tipo:editing.r.tipo})});
          touched.add(ym);
        }
        touched.forEach(persistMonth); render(); closeSheet(); toast(`${n} días marcados como ${TIPOS[editing.r.tipo].toLowerCase()}`); return;
      }
      setRec(s,editing.r);closeSheet();toast("Guardado")};
  };
  openSheet(""); draw();
}
function openSheet(html){
  if(html) $("sheet-in").innerHTML=html;
  $("scrim").hidden=false;$("sheet").hidden=false;
  requestAnimationFrame(()=>{$("scrim").classList.add("show");$("sheet").classList.add("show")});
}
function closeSheet(){
  $("scrim").classList.remove("show");$("sheet").classList.remove("show");
  setTimeout(()=>{$("scrim").hidden=true;$("sheet").hidden=true},220);
}
$("scrim").onclick=closeSheet;
$("go-home").onclick=openQuick;
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(!$("report").hidden)closeReport();else if(!$("sheet").hidden)closeSheet();else if(!$("quick").hidden)closeQuick()}});
document.addEventListener("click",e=>{
  const ed=e.target.closest("[data-edit]"); if(ed){openEditor(ed.dataset.edit);return}
  if(e.target.closest("[data-close]")) closeSheet();
  const tb=e.target.closest("[data-tab]"); if(tb){tab=tb.dataset.tab;enterView();render();window.scrollTo(0,0)}
});

let tt, undoFn=null;
// undo (opcional): función que deshace; el aviso dura 5 s y muestra «Deshacer»
function toast(m, undo){
  flash(); const t=$("toast"); undoFn=undo||null;
  t.innerHTML=escH(m)+(undo?'<button type="button" class="tundo">Deshacer</button>':"");
  t.classList.toggle("act",!!undo); t.classList.add("show"); clearTimeout(tt);
  tt=setTimeout(()=>{t.classList.remove("show","act");undoFn=null}, undo?5000:1800);
}
$("toast").addEventListener("click",e=>{
  if(!e.target.closest(".tundo")||!undoFn) return;
  const f=undoFn; undoFn=null; clearTimeout(tt); $("toast").classList.remove("show","act"); f();
});
// Ficha un día y deja 5 s para deshacerlo (vuelve exactamente a como estaba)
function punch(s, nr, msg){
  const prev=rec(s); setRec(s,nr);
  toast(msg, ()=>{setRec(s,prev?clone(prev):null); closeSheet(); toast("Deshecho")});
}

/* ---------- animaciones generales ---------- */
// Al cambiar de pestaña, el contenido entra escalonado (ver .enter en el CSS)
function enterView(){
  if(reduce) return;
  const v=$("v-"+tab); if(!v) return;
  v.classList.remove("enter"); void v.offsetWidth; v.classList.add("enter");
  clearTimeout(v._et); v._et=setTimeout(()=>v.classList.remove("enter"),1100);
}
// Números que cuentan hasta su valor cuando cambian (o al entrar en la pestaña)
var countPrev={};
function animateCounts(){
  document.querySelectorAll("[data-count]").forEach(el=>{
    if(!el.offsetParent) return;
    const key=el.dataset.key, to=Number(el.dataset.count)||0, entering=el.closest(".enter");
    const from = countPrev[key]==null||entering ? 0 : countPrev[key];
    countPrev[key]=to;
    if(reduce || from===to) return;
    const f=el.dataset.fmt==="eur"?v=>"≈ "+eur(v):v=>fmt(v), t0=performance.now(), d=750;
    const step=now=>{const k=Math.min(1,(now-t0)/d), e=1-Math.pow(1-k,3);el.textContent=f(from+(to-from)*e);if(k<1)requestAnimationFrame(step)};
    requestAnimationFrame(step);
  });
}
function render(){
  applySkin();
  rpgNow=null;
  $("tab-rpg").hidden=!cfg.rpg;
  if(tab==="rpg" && !cfg.rpg) tab="hoy";
  ["hoy","mes","nomina","ajustes","rpg"].forEach(k=>{$("v-"+k).hidden=k!==tab});
  document.querySelectorAll("nav.tabs button").forEach(b=>{if(b.dataset.tab===tab)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
  if(tab==="hoy")renderHoy(); else if(tab==="mes")renderMes(); else if(tab==="nomina")renderNomina(); else if(tab==="rpg")renderRPG(); else renderAjustes();
  rpgCheck(); animateCounts();
  if(!$("quick").hidden) renderQuick();
}
setInterval(()=>{if(tab==="hoy" && !$("sheet").classList.contains("show"))renderHoy()},30000);
let hiddenAt=0;
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){hiddenAt=Date.now();return}
  // con «Abrir en fichaje», al volver tras 5 min fuera se enseña otra vez la pantalla de fichaje
  if(cfg.inicio!=="hoy" && hiddenAt && Date.now()-hiddenAt>5*6e4 && $("sheet").hidden && $("report").hidden) openQuick();
  render();
});

/* ---------- aspecto neón: lluvia en canvas ---------- */
function skin(){return cfg.skin||"neon"}
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
let rainOn=false, drops=[], cv=$("rain"), cx=cv.getContext("2d"), W=0,H=0,DPR=1, skyline=null;
function applySkin(){
  const k=skin();
  if(document.documentElement.dataset.skin!==k){document.documentElement.dataset.skin=k;
    const m=document.querySelector('meta[name="theme-color"]'); if(m) m.content = k==="neon"?"#05010f":"#E4007C";}
  if(k==="neon" && !rainOn){rainOn=true;resize();if(!reduce)requestAnimationFrame(tick);else drawStatic()}
  if(k!=="neon") rainOn=false;
}
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1); W=innerWidth; H=innerHeight;
  cv.width=W*DPR; cv.height=H*DPR; cx.setTransform(DPR,0,0,DPR,0,0);
  const n=Math.round(W*H/5200);
  drops=Array.from({length:n},()=>newDrop(true));
  skyline=buildSkyline();
}
function newDrop(any){const z=Math.random();return{x:Math.random()*(W+100)-50,y:any?Math.random()*H:-20-Math.random()*H*.3,z,l:8+z*22,v:5+z*11}}
function buildSkyline(){
  const layers=[];
  [[.55,"rgba(40,14,80,.55)",38],[.7,"rgba(24,8,52,.8)",26],[.82,"rgba(12,3,30,.95)",18]].forEach(([top,col,wmin],li)=>{
    const b=[]; let x=-10; while(x<W+10){const w=wmin+Math.random()*wmin*1.6, h=H*(1-top)*(0.35+Math.random()*.9); b.push({x,w,h,win:Math.random()<.7,neon:Math.random()<.18?(Math.random()<.5?"#FF2BD6":"#22F3FF"):null}); x+=w+2+Math.random()*6}
    layers.push({col,b,li});
  });
  return layers;
}
function drawCity(t){
  skyline.forEach(L=>{
    L.b.forEach(b=>{
      const y=H-b.h; cx.fillStyle=L.col; cx.fillRect(b.x,y,b.w,b.h);
      if(b.win && L.li>0){cx.fillStyle="rgba(255,190,120,.10)";for(let wy=y+8;wy<H-6;wy+=11)for(let wx=b.x+5;wx<b.x+b.w-5;wx+=9){if(((wx*7+wy*3)|0)%5===0)cx.fillRect(wx,wy,3,4)}}
      if(b.neon){const on = reduce || Math.sin(t/900+b.x)>-0.92; if(on){cx.fillStyle=b.neon;cx.shadowColor=b.neon;cx.shadowBlur=12;cx.fillRect(b.x+4,y+10,Math.max(6,b.w-8),2.5);cx.shadowBlur=0}}
    });
  });
}
function drawRain(){
  cx.lineCap="round";
  for(const d of drops){
    cx.strokeStyle=`rgba(${150+d.z*80|0},${190+d.z*50|0},255,${.08+d.z*.32})`;
    cx.lineWidth=.6+d.z*1.1;
    cx.beginPath();cx.moveTo(d.x,d.y);cx.lineTo(d.x-d.l*.18,d.y+d.l);cx.stroke();
  }
}
function drawStatic(){cx.clearRect(0,0,W,H);drawCity(0);drawRain()}
let last=0;
function tick(t){
  if(!rainOn) {cx.clearRect(0,0,W,H);return}
  if(document.hidden){requestAnimationFrame(tick);return}
  const dt=Math.min(3,(t-last)/16.7||1); last=t;
  cx.clearRect(0,0,W,H); drawCity(t);
  for(const d of drops){d.y+=d.v*dt;d.x-=d.v*.18*dt;if(d.y>H){Object.assign(d,newDrop(false))}}
  drawRain();
  requestAnimationFrame(tick);
}
addEventListener("resize",()=>{if(rainOn){resize();if(reduce)drawStatic()}});
function flash(){
  if(skin()!=="neon"||reduce) return;
  const f=$("flash"); f.animate([{opacity:0},{opacity:.9,offset:.08},{opacity:.1,offset:.2},{opacity:.6,offset:.3},{opacity:0}],{duration:650,easing:"ease-out"});
}
render();

/* ---------- fichaje rápido desde fuera de la app (acceso directo ?fichar) ---------- */
/* ---------- modo RPG (motor en js/rpg.js, escena en js/escena.js; todo sale de los fichajes) ---------- */
var rpgNow=null, scenes=[], heroTab="estado", shopSlot="H"; // var: render() se llama antes de llegar aquí
function rpgInv(){const v=Object.assign({owned:[],equip:{}},cfg.rpgInv||{});v.owned=v.owned||[];v.equip=v.equip||{};return v}
function rpg(){
  if(rpgNow) return rpgNow;
  MTScene.setSound(cfg.rpgSound!==false);
  const audits=Object.values(cfg.reales||{}).filter(r=>r.neto!=null||r.hx!=null||r.hf!=null).length;
  rpgNow=MTRPG.compute({months, calc, periodOf, parse, iso, addDays, today:todayISO(), lastBackup:stamp("lastBackup"), audits, inv:rpgInv()});
  return rpgNow;
}
function rpgLook(R){return MTRPG.lookOf(R.rank.tier, rpgInv())}
function setRPG(on){
  if(!!cfg.rpg===on) return;
  cfg.rpg=on; persistCfg(); rpgNow=null;
  if(on){const R=rpg();ls.set("rpgSeen",{L:R.L,ach:R.ach.filter(a=>a.ok).map(a=>a.id),won:R.won});MTScene.sfx.level()}
  if(!$("quick").hidden) openQuick();
  render(); toast(on?"Modo RPG activado":"Modo normal");
}
function xpBar(R){const pct=Math.max(0,Math.min(100,(R.xp-R.from)/(R.to-R.from)*100));return `<div class="xpbar" role="img" aria-label="${R.xp-R.from} de ${R.to-R.from} puntos de experiencia"><i style="width:${pct}%"></i></div>`}
function bossBar(b){const pct=b.max?b.hp/b.max*100:0;return `<div class="hpbar" role="img" aria-label="Vida del jefe: ${b.hp} de ${b.max}"><i style="width:${pct}%"></i></div>`}
// barra por segmentos, estilo videojuego
function segBar(v,max,cls,n){n=n||12;const on=max?Math.round(v/max*n):0;let h="";for(let i=0;i<n;i++)h+=`<i class="${i<on?"on":""}" style="--i:${i}"></i>`;return `<div class="gbar ${cls}" role="img" aria-label="${v} de ${max}">${h}</div>`}
var coinIco=`<i class="coin" aria-hidden="true"></i>`;
function rpgMini(){
  const R=rpg(), b=R.boss;
  return `<button class="rpgmini" data-tab="rpg" aria-label="Ver tu personaje">
    <canvas class="ava" width="48" height="48" aria-hidden="true"></canvas>
    <div class="rm-in">
      <div class="rm-top"><b>NV ${R.L}</b><span>${R.rank.name}</span><em class="num">${coinIco}${R.coins}</em></div>
      ${xpBar(R)}
      ${b&&b.max?`<div class="rm-boss"><span>${b.name}</span>${bossBar(b)}</div>`:""}
    </div></button>`;
}
var avaTimer=null, avaFrame=0;
function paintAvatars(){
  if(!cfg.rpg) return;
  const R=rpg(), look=rpgLook(R), inv=rpgInv();
  const lookFor=c=>{const id=c.dataset.prev;if(!id)return look;const it=MTRPG.SHOP.find(x=>x.id===id);const v=clone(inv);v.equip[it.slot]=it.id;return MTRPG.lookOf(R.rank.tier,v)};
  const list=[...document.querySelectorAll("canvas.ava")].filter(c=>c.offsetParent);
  list.forEach(c=>MTScene.paint(c,lookFor(c),avaFrame));
  clearInterval(avaTimer);
  if(list.length && !reduce) avaTimer=setInterval(()=>{
    if(document.hidden) return; avaFrame^=1;
    document.querySelectorAll("canvas.ava").forEach(c=>{if(c.offsetParent)MTScene.paint(c,lookFor(c),avaFrame)});
  },650);
}
// Lo que dice el jefe según cómo va tu día
function taunts(){
  const q=quickState(), R=rpg(), b=R.boss;
  if(b&&b.max&&!b.hp) return ["Sin fuerzas…","Esto no ha acabado","Uf…"];
  if(q.mode==="tipo") return ["Recupérate pronto","Te espero a la vuelta"];
  if(q.p.rest||q.p.fest) return q.c.worked?["¿Trabajando hoy?","Ni en tu día libre…"]:["Zzz…","Hoy descanso yo también","Disfruta tu día"];
  if(q.mode==="in"){const diff=toMin(q.p.e)-toMin(nowHM());return diff>0?["Te espero en la puerta","El reloj corre…","¿Vienes hoy?"]:["¡Llegas tarde!","Tic, tac…","Ese fichaje no se hace solo"]}
  if(q.mode==="out"||q.mode==="outn") return ["¿Aún aguantas?","¡No llegarás al final!","Quedan horas…"];
  return ["Mañana me vengo…","Hoy ganas tú","Volveré más fuerte"];
}
function mountScenes(){
  scenes=scenes.filter(s=>s.cv.isConnected);
  document.querySelectorAll("canvas.scene").forEach(cv=>{
    if(cv.dataset.m) return; cv.dataset.m="1";
    scenes.push({cv, sc:MTScene.mount(cv,()=>{if(!cfg.rpg)return null;const R=rpg(), h=new Date().getHours(), d=new Date().getDate();
      return {look:rpgLook(R),boss:R.boss,rain:R.event.id==="lluvia"||((h>=21||h<6)&&d%3===0),taunts:taunts()}},cv.dataset.mode)});
  });
}
function activeScene(){const s=scenes.find(x=>x.cv.isConnected&&x.cv.offsetParent);return s?s.sc:null}
// Tras cambiar un día: animación en la escena visible (golpe, crítico, experiencia, monedas, nivel)
function rpgFx(b4){
  if(!cfg.rpg||!b4) return;
  const A=rpg(), sc=activeScene(); if(!sc) return;
  const hit=A.boss&&b4.boss&&A.boss.start===b4.boss.start&&A.boss.hp<b4.boss.hp;
  const qa=A.quests[1], qb=b4.quests[1], crit=!!(qa&&qb&&qa.t===qb.t&&qa.done&&!qb.done);
  if(hit) sc.attack(`-${b4.boss.hp-A.boss.hp} HP`,crit);
  const dx=A.xp-b4.xp, dc=A.earned-b4.earned;
  if(dx>0) sc.gain(`+${dx} XP`,null,hit?650:100);
  if(dc>0) sc.coin(`+${dc}`);
  if(A.L>b4.L) setTimeout(()=>sc.level(),1100);
  else if(!hit && dx<=0 && dc<=0) MTScene.sfx.tap();
}
function questList(R){
  return `<ul class="quests">${R.quests.map((q,i)=>`<li class="${q.done?"ok":q.fail?"ko":""}" style="--i:${i}"><i aria-hidden="true">${q.done?"✓":q.fail?"✗":""}</i><span>${q.t}${q.note?`<small>${q.note}</small>`:""}</span><em>${q.rw}</em></li>`).join("")}
    ${R.week&&R.week.total?`<li class="${R.week.done>=R.week.total?"ok":""} wk" style="--i:5"><i aria-hidden="true">${R.week.done>=R.week.total?"✓":""}</i><span>Misión semanal: ficha todos tus días<small>${R.week.done} de ${R.week.total} días esta semana</small></span><em>+${MTRPG.XP.semana} XP</em></li>`:""}</ul>`;
}

/* ---------- pestaña Héroe: menú de juego ---------- */
var HERO_TABS=[["estado","Estado"],["misiones","Misiones"],["tienda","Tienda"],["diario","Diario"],["logros","Logros"]];
function heroPanel(R){
  const b=R.boss, X=MTRPG.XP, inv=rpgInv();
  const fdate=x=>{const d=parse(x);return `${d.getDate()} ${MON[d.getMonth()].slice(0,3)}`};
  if(heroTab==="misiones") return `
    <div class="gpanel evt"><small>Evento de hoy</small><b>${R.event.name}</b><span>${R.event.desc}</span></div>
    <div class="gpanel"><h3>Misiones de hoy</h3>${questList(R)}</div>
    ${b?`<div class="gpanel"><h3>Jefe del periodo</h3><div class="bs-name">${b.name}</div>${segBar(b.hp,b.max,"hp",16)}
      <p class="hint num">${b.max?(b.hp?`Vida ${b.hp} de ${b.max}. Cada día de trabajo que fichas le quita uno. Si los fichas todos, cae el ${fdate(b.end)}: +${X.jefe} XP.`:`¡Sin vida! Cae al cerrar el periodo el ${fdate(b.end)}.`):"Este periodo no tienes días de trabajo previstos."}</p></div>`:""}`;
  if(heroTab==="tienda"){
    const items=MTRPG.SHOP.filter(i=>i.slot===shopSlot);
    return `<div class="gpanel">
      <div class="shop-head"><span>Tienes</span><b class="num">${coinIco}${R.coins}</b>${R.event.shop?`<em>Hoy −20 %</em>`:""}</div>
      <div class="chips shop-slots" role="tablist">${Object.entries(MTRPG.SLOTS).map(([k,v])=>`<button class="chip" data-slot="${k}" aria-pressed="${k===shopSlot}">${v}</button>`).join("")}</div>
      <div class="shgrid">${items.map((it,i)=>{
        const own=inv.owned.some(o=>o.id===it.id), eq=inv.equip[it.slot]===it.id, pr=MTRPG.price(it,R.event), lock=R.L<it.minL;
        const act = eq?`<button class="chip" data-unequip="${it.slot}" aria-pressed="true">Puesto</button>`
          : own?`<button class="chip" data-equip="${it.id}">Ponerse</button>`
          : lock?`<span class="shlock">Nivel ${it.minL}</span>`
          : `<button class="chip buy" data-buy="${it.id}" ${R.coins<pr?"disabled":""}>${coinIco}${pr}${pr<it.price?` <s>${it.price}</s>`:""}</button>`;
        return `<div class="shitem${eq?" on":""}${lock?" lock":""}" style="--i:${i}"><canvas class="ava prev" width="64" height="64" data-prev="${it.id}" aria-hidden="true"></canvas><b>${it.name}</b>${act}</div>`}).join("")}</div>
      <p class="hint">Las monedas se ganan fichando, descansando, con misiones y derrotando jefes. Todo es estético.</p></div>`;
  }
  if(heroTab==="diario") return `
    <div class="gpanel"><h3>Diario de batalla</h3>
    ${R.log.length?`<ul class="blog">${R.log.slice(0,20).map((l,i)=>`<li class="${l.k}" style="--i:${Math.min(i,8)}"><span class="num">${fdate(l.s)}</span><p>${escH(l.text)}</p>${l.xp?`<em class="num">+${l.xp}</em>`:""}</li>`).join("")}</ul>`:`<p class="hint">Aún no hay nada. Ficha tu primer día y empieza la historia.</p>`}</div>
    ${R.bosses.filter(x=>x.closed&&x.max).length?`<div class="gpanel"><h3>Jefes</h3><ul class="bosslist">${R.bosses.filter(x=>x.closed&&x.max).reverse().map(x=>`<li class="${x.defeated?"won":""}"><b>${x.name}</b><span>${fdate(x.start)} – ${fdate(x.end)}</span><em>${x.defeated?"Derrotado":`Escapó (${x.hp})`}</em></li>`).join("")}</ul></div>`:""}`;
  if(heroTab==="logros") return `<div class="gpanel"><h3>Logros <span class="hint">${R.ach.filter(a=>a.ok).length}/${R.ach.length}</span></h3>
    <div class="achs">${R.ach.map((a,i)=>`<div class="ach${a.ok?" ok":""}" style="--i:${i}"><i aria-hidden="true">${a.ok?"★":"☆"}</i><b>${a.name}</b><small>${a.desc}</small></div>`).join("")}</div></div>`;
  // estado
  return `
    <div class="gpanel ficha">
      <canvas class="ava big" width="96" height="96" aria-hidden="true"></canvas>
      <div><div class="f-lv">Nivel <b class="num">${R.L}</b></div><div class="f-rank">${R.rank.name}${R.rank.next?` · ${R.rank.next.name} en el nivel ${R.rank.next.min}`:""}</div>
        ${segBar(R.xp-R.from,R.to-R.from,"xp",14)}<div class="f-xp num">${R.xp-R.from} / ${R.to-R.from} XP</div></div>
    </div>
    <div class="gpanel"><h3>Atributos</h3>
      <div class="attrs">${R.attrs.map((a,i)=>`<div class="attr" style="--i:${i}"><span>${a.k}</span>${segBar(a.v,100,a.k==="Energía"?"en":"at",10)}<b class="num">${a.v}</b></div>`).join("")}</div>
      <p class="hint">${R.run>=7?`<b>Llevas ${R.run} días seguidos trabajando.</b> Tu personaje está agotado: descansar le recarga la energía.`:R.run>=5?`Llevas ${R.run} días seguidos trabajando. Se acerca un descanso.`:"Energía en forma."}</p></div>
    <div class="gpanel"><div class="stats num">
      <div style="--i:0"><b>${R.days}</b><small>días fichados</small></div><div style="--i:1"><b>${R.streak}</b><small>racha actual</small></div><div style="--i:2"><b>${R.best}</b><small>mejor racha</small></div>
      <div style="--i:3"><b>${R.won}</b><small>jefes derrotados</small></div><div style="--i:4"><b>${R.rests}</b><small>descansos</small></div><div style="--i:5"><b>${R.ach.filter(a=>a.ok).length}</b><small>logros</small></div></div></div>
    <details class="gpanel"><summary>Cómo se gana experiencia</summary>
      <table class="ntable num">
        <tr><td>Fichar un día</td><td>+${X.dia}</td></tr><tr><td>Entrar a tu hora (crítico)</td><td>+${X.puntual}</td></tr>
        <tr><td>Completar el turno</td><td>+${X.completo}</td></tr><tr><td>Racha (cada 5 días)</td><td>+1…5</td></tr>
        <tr><td>Descanso sin trabajar</td><td>+${X.descanso}</td></tr><tr><td>Misión semanal</td><td>+${X.semana}</td></tr>
        <tr><td>Jefe del periodo</td><td>+${X.jefe}</td></tr><tr><td>Logro</td><td>+${X.logro}</td></tr></table>
      <p class="disc">Las horas extra no dan experiencia: aquí se premia la constancia, no echar más horas. Vacaciones y bajas no rompen la racha.</p></details>`;
}
function renderRPG(){
  const R=rpg(), sound=cfg.rpgSound!==false, v=$("v-rpg");
  if(!v.querySelector("canvas.scene")){
    v.innerHTML=`<div class="hg">
      <div class="hg-stage"><canvas class="scene" data-mode="band" role="img" aria-label="Tu personaje frente al jefe del periodo"></canvas><div class="hg-hud" id="hg-hud"></div></div>
      <div class="hg-tabs" role="tablist" id="hg-tabs"></div>
      <div class="hg-panel" id="hg-panel"></div></div>`;
    mountScenes();
  }
  const b=R.boss;
  $("hg-hud").innerHTML=`<div class="hh-l"><b>NV ${R.L}</b><span>${R.rank.name}</span></div>
    <div class="hh-r"><em class="num">${coinIco}${R.coins}</em><button class="gbtn" id="r-snd" aria-pressed="${sound}" aria-label="Sonido">${sound?"♪":"✕"}</button></div>
    ${segBar(R.xp-R.from,R.to-R.from,"xp",16)}
    ${b&&b.max?`<div class="hh-boss"><span>${b.name}</span>${segBar(b.hp,b.max,"hp",12)}</div>`:""}`;
  $("hg-tabs").innerHTML=HERO_TABS.map(([k,l])=>`<button role="tab" data-ht="${k}" aria-selected="${k===heroTab}">${l}</button>`).join("");
  const pnl=$("hg-panel"), changed=pnl.dataset.t!==heroTab;
  pnl.innerHTML=heroPanel(R); pnl.dataset.t=heroTab;
  if(changed){pnl.classList.remove("in");void pnl.offsetWidth;pnl.classList.add("in")}
  paintAvatars();
  $("r-snd").onclick=()=>{cfg.rpgSound=!(cfg.rpgSound!==false);persistCfg();MTScene.setSound(cfg.rpgSound);if(cfg.rpgSound)MTScene.sfx.coin();renderRPG()};
  $("hg-tabs").querySelectorAll("[data-ht]").forEach(t=>t.onclick=()=>{heroTab=t.dataset.ht;MTScene.sfx.open();renderRPG()});
  v.querySelectorAll("[data-slot]").forEach(t=>t.onclick=()=>{shopSlot=t.dataset.slot;MTScene.sfx.tap();renderRPG()});
  const sv=fn=>{cfg.rpgInv=fn(rpgInv());persistCfg();rpgNow=null;renderRPG()};
  v.querySelectorAll("[data-buy]").forEach(btn=>btn.onclick=()=>{
    const it=MTRPG.SHOP.find(x=>x.id===btn.dataset.buy), R2=rpg(), pr=MTRPG.price(it,R2.event);
    if(R2.L<it.minL||R2.coins<pr) return;
    sv(o=>{o.owned.push({id:it.id,paid:pr});o.equip[it.slot]=it.id;return o});
    MTScene.sfx.coin(); toast(`${it.name}: comprado y puesto`);
  });
  v.querySelectorAll("[data-equip]").forEach(btn=>btn.onclick=()=>{const it=MTRPG.SHOP.find(x=>x.id===btn.dataset.equip);sv(o=>{o.equip[it.slot]=it.id;return o});MTScene.sfx.tap()});
  v.querySelectorAll("[data-unequip]").forEach(btn=>btn.onclick=()=>{sv(o=>{delete o.equip[btn.dataset.unequip];return o});MTScene.sfx.tap()});
}
// Celebra subidas de nivel, logros y jefes caídos (solo hacia arriba: deshacer no quita lo celebrado)
function rpgCheck(){
  if(!cfg.rpg) return;
  const R=rpg(), seen=ls.get("rpgSeen");
  const ok=R.ach.filter(a=>a.ok).map(a=>a.id);
  if(!seen){ls.set("rpgSeen",{L:R.L,ach:ok,won:R.won});return}
  const nuevos=R.ach.filter(a=>a.ok && !(seen.ach||[]).includes(a.id)), cayo=R.won>(seen.won==null?R.won:seen.won);
  if(R.L<=seen.L && !nuevos.length && !cayo) return;
  ls.set("rpgSeen",{L:Math.max(R.L,seen.L),ach:[...new Set([...(seen.ach||[]),...ok])],won:Math.max(R.won,seen.won||0)});
  const up=R.L>seen.L;
  if(cayo){const sc=activeScene(); if(sc) setTimeout(()=>sc.defeat(),600)}
  if(!$("quick").hidden || !$("sheet").hidden || !$("report").hidden){
    setTimeout(()=>toast(up?`¡Subes a nivel ${R.L}!`:cayo?"¡Jefe derrotado!":`Logro: ${nuevos[0].name}`),2000); return;
  }
  setTimeout(()=>{
    openSheet(`<div class="grab"></div><div class="lvup">
      <div class="lv-rays" aria-hidden="true"></div>
      <canvas class="ava big" width="128" height="128" aria-hidden="true"></canvas>
      <h3 id="sh-title">${up?`¡Nivel ${R.L}!`:cayo?"¡Jefe derrotado!":"¡Logro nuevo!"}</h3>
      ${up?`<p>Ahora eres <b>${R.rank.name}</b>.${R.rank.next?` En el nivel ${R.rank.next.min} pasarás a ${R.rank.next.name}.`:""}</p>`:""}
      ${nuevos.map(a=>`<p class="lv-ach">★ <b>${a.name}</b> · ${a.desc} · +${MTRPG.XP.logro} XP</p>`).join("")}
    </div><div class="foot" style="grid-template-columns:1fr"><button class="btn primary" data-close>¡Vamos!</button></div>`);
    paintAvatars(); if(up) MTScene.sfx.level();
  },700);
}

/* ---------- pantalla de inicio ---------- */
function quickState(){
  const od=nightOpen(), t=todayISO(), s=od||t, r=rec(s)||{}, c=calc(s);
  c.iso=s;
  const mode = od?"outn" : r.tipo?"tipo" : c.open?"out" : (r.e&&r.s)?"done" : "in";
  return {od,t,s,r,c,p:c.p,mode};
}
// Texto de estado común a los dos modos
function quickInfo(q){
  const {r,c,p}=q, now=nowHM();
  if(q.mode==="outn") return {btn:"Salida",state:`Turno de noche · entraste ayer a las ${r.e}`,live:dur(r.e,now),pct:Math.min(1,dur(r.e,now)/Math.max(1,p.min||480))};
  if(q.mode==="out") return {btn:"Salida",state:`Entraste a las ${r.e}`+(p.rest||p.fest?"":` · sales a las ${p.s}`),live:dur(r.e,now),pct:p.rest||p.fest?0:Math.min(1,dur(r.e,now)/Math.max(1,p.min))};
  if(q.mode==="in"){
    let state;
    if(p.rest) state="Hoy descansas";
    else if(p.fest) state="Festivo · lo que trabajes cuenta como festivo";
    else{const diff=toMin(p.e)-toMin(now);state=diff>0?`Tu turno empieza en ${fmt(diff)}`:-diff<p.min?`Tu turno empezó hace ${fmt(-diff)}`:"Tu turno de hoy ya ha terminado"}
    return {btn:"Entrada",state,pct:0};
  }
  if(q.mode==="done") return {btn:null,state:`${r.e} – ${r.s} · ${fmt(c.worked)}`+(c.extra?` · +${fmt(c.extra)} extra`:""),pct:1};
  return {btn:null,state:TIPOS[r.tipo],pct:0};
}
function doPunch(q){
  const n=nowHM(), r=q.r;
  if(q.mode==="out"||q.mode==="outn"){ if(dur(r.e,n)<2){toast("Acabas de fichar la entrada");return} punch(q.s,Object.assign({},r,{s:n}),"Salida fichada a las "+n) }
  else punch(q.t,Object.assign({},r,{e:n,s:null}),"Entrada fichada a las "+n);
  if(navigator.vibrate) try{navigator.vibrate(18)}catch(e){}
}
// Menú «Apuntar» / «Objetos»: todo lo que no es fichar
function openActions(){
  const q=quickState(), fest=isFest(q.t), game=!!cfg.rpg;
  const tile=(id,ico,label,dis)=>`<button class="atile" data-a="${id}" ${dis?"disabled":""}><i aria-hidden="true">${ico}</i><span>${label}</span></button>`;
  openSheet(`<div class="grab"></div><h3 id="sh-title">${game?"Objetos":"Apuntar"}</h3>
    <div class="atiles">
      ${tile("x30","＋","30 min extra",q.mode==="tipo")}${tile("x60","＋","1 h extra",q.mode==="tipo")}${tile("xo","⏱","Otra extra",q.mode==="tipo")}
      ${tile("full","✓","Turno completo",!(q.mode==="in"&&!q.p.rest&&!q.p.fest))}${tile("fest","★",fest?"Quitar festivo":"Es festivo")}${tile("edit","✎","Editar el día")}
      ${tile("vac","☀","Vacaciones")}${tile("baja","✚","Baja")}${tile("app","→","Entrar en la app")}
    </div>`);
  if(game) MTScene.sfx.open();
  $("sheet-in").querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{
    const a=b.dataset.a, cur=rec(q.s)||{};
    if(a==="x30"||a==="x60"){closeSheet();const m=a==="x30"?30:60;punch(q.s,Object.assign({},cur,{x:(Number(cur.x)||0)+m}),`+${fmt(m)} de extra apuntadas`)}
    else if(a==="xo") openExtra(q.s);
    else if(a==="full"){closeSheet();punch(q.t,Object.assign({},q.r,{e:q.p.e,s:q.p.s}),"Turno completo apuntado")}
    else if(a==="fest"){closeSheet();const c2=rec(q.t)||{}, nv=!isFest(q.t), def=!!festName(q.t);punch(q.t,Object.assign({},c2,{fest:nv===def?null:nv}),nv?"Hoy marcado como festivo":"Hoy ya no cuenta como festivo")}
    else if(a==="edit") openEditor(q.s);
    else if(a==="vac"||a==="baja") openEditor(q.t,a);
    else if(a==="app"){closeSheet();closeQuick()}
  });
}
var typer=null, lastLine="";
function typeLine(el, text){
  if(!el) return;
  if(text===lastLine||reduce){el.textContent=text;lastLine=text;return}
  lastLine=text; clearInterval(typer); let i=0; el.textContent="";
  typer=setInterval(()=>{i++;el.textContent=text.slice(0,i);if(i%3===0)MTScene.sfx.blip();if(i>=text.length)clearInterval(typer)},22);
}
function renderQuick(){
  const q=quickState(), I=quickInfo(q), d=new Date(), now=nowHM(), on=!!cfg.rpg;
  const dateTxt=`${DOWL[d.getDay()]} ${d.getDate()} de ${MON[d.getMonth()]}`;
  if(on){
    const R=rpg(), b=R.boss, sound=cfg.rpgSound!==false;
    let line;
    const bn=b&&b.max?b.name:"La ciudad";
    if(q.mode==="tipo") line=`Estás de ${TIPOS[q.r.tipo].toLowerCase()}. ${bn} espera tu vuelta. Recupérate.`;
    else if(q.mode==="in") line=q.p.rest?`Día libre. ${bn} duerme. Descansar también da experiencia.`:q.p.fest?`Festivo en la ciudad. Si trabajas, cuenta como horas festivas.`:`${bn} vigila la entrada. ${I.state}.`;
    else if(q.mode==="out"||q.mode==="outn") line=`¡En combate! Llevas ${fmt(I.live)}. ${q.mode==="out"&&!q.p.rest&&!q.p.fest?`Aguanta hasta las ${q.p.s}.`:"Ficha la salida al terminar."}`;
    else line=`Turno superado: ${fmt(q.c.worked)}${q.c.extra?` (+${fmt(q.c.extra)} extra)`:""}. ${b&&b.max?`${bn} se lame las heridas: le quedan ${b.hp}.`:""}`;
    line+=` Evento: ${R.event.name}.`;
    const main = I.btn?`<button class="gcmd main" id="q-punch"><span>▶ ${I.btn==="Entrada"?"Atacar · fichar entrada":"Rematar · fichar salida"}</span><b class="num">${now}</b></button>`
      : `<button class="gcmd main done" id="q-edit"><span>${q.mode==="done"?"✓ Turno superado":"✎ "+TIPOS[q.r.tipo]}</span><b>Editar</b></button>`;
    $("g-ui").innerHTML=`
      <div class="g-top">
        <div class="g-port"><canvas class="ava" width="48" height="48" aria-hidden="true"></canvas></div>
        <div class="g-stats"><div class="g-name"><b>NV ${R.L}</b> ${R.rank.name}</div>${segBar(R.xp-R.from,R.to-R.from,"xp",14)}<div class="g-coins num">${coinIco}${R.coins}</div></div>
        <div class="g-btns"><button class="gbtn" id="g-snd" aria-pressed="${sound}" aria-label="Sonido">${sound?"♪":"✕"}</button><button class="gbtn" id="g-mode" aria-label="Pasar a modo normal">◐</button></div>
      </div>
      ${b&&b.max?`<div class="g-boss"><span>${b.name}</span>${segBar(b.hp,b.max,"hp",12)}<em class="num">${b.hp}/${b.max}</em></div>`:""}
      <div class="g-clock num">${now}<small>${dateTxt}</small></div>
      <div class="g-dialog">
        <p class="g-text" id="g-text" aria-live="polite"></p>
        ${main}
        <div class="g-row"><button class="gcmd" id="q-plus">Objetos</button><button class="gcmd" id="q-hero">Héroe</button><button class="gcmd" id="q-app">Salir ›</button></div>
      </div>`;
    typeLine($("g-text"),line);
    $("g-snd").onclick=()=>{cfg.rpgSound=!(cfg.rpgSound!==false);persistCfg();MTScene.setSound(cfg.rpgSound);if(cfg.rpgSound)MTScene.sfx.coin();renderQuick()};
    $("g-mode").onclick=()=>setRPG(false);
    $("q-hero").onclick=()=>{tab="rpg";closeQuick();window.scrollTo(0,0)};
    paintAvatars();
  } else {
    const R2=46, C=2*Math.PI*R2;
    $("quick").querySelector(".q-in").innerHTML=`
      <div class="q-top"><span class="q-date">${dateTxt}</span><button class="q-skip" id="q-app">Entrar ›</button></div>
      <div class="qn">
        <div class="qn-clock num">${now.replace(":",'<i class="colon">:</i>')}</div>
        <div class="qn-shift">${q.mode==="tipo"?TIPOS[q.r.tipo]:q.p.rest?"Descanso":q.p.fest?"Festivo":`${q.p.name} · ${q.p.e}–${q.p.s}`}</div>
        <button class="qn-btn ${I.btn?(I.btn==="Salida"?"out":"in"):"done"}" id="${I.btn?"q-punch":"q-edit"}" aria-label="${I.btn?`Fichar ${I.btn.toLowerCase()} a las ${now}`:"Editar el día"}">
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="trk" cx="50" cy="50" r="${R2}"/><circle class="prg" cx="50" cy="50" r="${R2}" style="stroke-dasharray:${C};stroke-dashoffset:${C*(1-I.pct)}"/></svg>
          <span>${I.btn||(q.mode==="done"?"Hecho":"Editar")}</span><b class="num">${I.btn?now:q.mode==="done"?"✓":"✎"}</b>
        </button>
        <p class="qn-state num">${I.state}${q.mode==="out"||q.mode==="outn"?` · llevas ${fmt(I.live)}`:""}</p>
      </div>
      <div class="qn-foot"><button class="qn-plus" id="q-plus"><i aria-hidden="true">＋</i> Apuntar</button><button class="qn-rpg" id="q-rpg" aria-label="Activar modo RPG">⚔ RPG</button></div>`;
    $("q-rpg").onclick=()=>setRPG(true);
  }
  $("q-app").onclick=closeQuick;
  $("q-plus").onclick=openActions;
  const pb=$("q-punch"); if(pb) pb.onclick=()=>{pb.classList.add("hit");doPunch(q)};
  const qe=$("q-edit"); if(qe) qe.onclick=()=>openEditor(q.s);
}
var quickTimer=null;
function openQuick(){
  closeSheet(); document.body.classList.add("q-open"); lastLine="";
  const on=!!cfg.rpg;
  $("quick").className=on?"game":"";
  $("quick").innerHTML=on?`<canvas class="scene" data-mode="full" id="q-scene" role="img" aria-label="Tu personaje frente al jefe del periodo"></canvas><div class="g-ui" id="g-ui"></div>`:`<div class="q-in"></div>`;
  $("quick").hidden=false; renderQuick(); if(on) mountScenes();
  clearInterval(quickTimer); quickTimer=setInterval(()=>{if(!$("quick").hidden && $("sheet").hidden)renderQuick()},15000);
}
function closeQuick(){$("quick").hidden=true;$("quick").innerHTML="";document.body.classList.remove("q-open");clearInterval(quickTimer);clearInterval(typer);render()}

function quickClock(){
  let q; try{q=new URLSearchParams(location.search)}catch(e){return}
  if(!q.has("fichar")) return;
  try{history.replaceState(null,"",location.pathname)}catch(e){}
  const od=nightOpen(), t=od||todayISO(), r=Object.assign({},rec(t)||{}), p=plan(t), now=nowHM();
  let title, lines=[];
  if(r.tipo){
    title="Hoy está marcado como "+TIPOS[r.tipo].toLowerCase(); lines.push("No he fichado nada. Si vas a trabajar, cámbialo desde Hoy.");
  } else if(!r.e){
    r.e=now; r.s=null; punch(t,r,"Entrada fichada a las "+now);
    title="Entrada fichada · "+now;
    if(p.fest) lines.push("Hoy es festivo: todo lo que trabajes cuenta como horas festivas.");
    else if(p.rest) lines.push("Es tu día de descanso: todo lo que trabajes cuenta como extra.");
    else{
      const diff=toMin(p.e)-toMin(now);
      if(diff>0) lines.push(`Entras <b style="color:var(--fucsia)">${fmt(diff)} antes</b> de tu turno (${p.e}).`,`Si sales a tu hora (${p.s}) serán <b style="color:var(--fucsia)">+${fmt(diff)} de extra</b>.`);
      else if(diff<0) lines.push(`Entras ${fmt(-diff)} más tarde de tu turno (${p.e}).`);
      else lines.push("Justo a tu hora.");
    }
    lines.push("Al salir, vuelve a tocar el mismo botón.");
  } else if(!r.s){
    if(dur(r.e,now)<2){ title="Entrada ya fichada a las "+r.e; lines.push("Para la salida, toca el botón cuando termines."); }
    else{
      r.s=now; punch(t,r,"Salida fichada a las "+now); const c=calc(t);
      title="Salida fichada · "+now;
      lines.push(`${od?"Turno de anoche":"Hoy"}: <b>${r.e} – ${r.s}</b> · ${fmt(c.worked)} trabajadas`);
      if(c.extra) lines.push(`<b style="color:var(--fucsia)">+${fmt(c.extra)} de extra</b> sumadas al periodo`);
      if(c.festH) lines.push(`<b style="color:var(--fest-ink)">${fmt(c.festH)} festivas</b>`);
      if(c.falta) lines.push(`Te faltan ${fmt(c.falta)} para completar el turno`);
      if(!c.extra && !c.festH && !c.falta) lines.push("Turno exacto, sin extras.");
    }
  } else {
    title="Hoy ya está fichado"; lines.push(`${r.e} – ${r.s}. Si has vuelto a entrar, corrígelo desde Hoy.`);
  }
  openSheet(`<div class="grab"></div><h3 id="sh-title">${title}</h3><p class="num" style="color:var(--muted);margin:12px 0 0;line-height:1.6">${lines.join("<br>")}</p><div class="foot" style="grid-template-columns:1fr"><button class="btn primary" data-close>Vale</button></div>`);
  setTimeout(flash,150);
}
quickClock();
if(cfg.inicio!=="hoy" && !isNewUser && $("sheet").hidden) openQuick();
// Primera vez (sin datos ni ajustes): asistente de turnos
if(isNewUser && $("sheet").hidden) setTimeout(()=>openWizard(1,true),300);

/* ---------- conexión con la cuenta ---------- */
(async()=>{
  if(!window.claude || !window.claude.use) return;
  let d=null; try{d=await window.claude.use("db")}catch(e){}
  if(!d) return;
  db=d;
  const s=$("sync"); s.classList.add("on"); s.querySelector("span").textContent="Sincronizado";
  let first=true;
  db.doc("ajustes/config").onSnapshot(snap=>{
    if(snap.exists){cfg=normCfg(snap.data(),true);ls.set("cfg",cfg);render()}
    else if(first && ls.get("cfg")) persistCfg();
  },()=>{});
  db.collection("meses").onSnapshot(snap=>{
    if(first && snap.empty && Object.keys(months).length){Object.keys(months).forEach(persistMonth);first=false;return}
    first=false;
    const next={};
    snap.docs.forEach(doc=>{const b=doc.data();next[doc.id]=JSON.parse(JSON.stringify((b&&b.dias)||{}))});
    months=next; ls.set("months",months);
    if(!$("sheet").classList.contains("show")) render();
  },()=>{s.classList.remove("on");s.querySelector("span").textContent="En este móvil"});
})();
})();
