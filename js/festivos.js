/* Festivos laborales de España. Generado a partir del BOE; no editar a mano.
   - Años con calendario oficial publicado: 2026 (BOE-A-2025-21667), 2027 (BOE-A-2026-21254).
   - Otros años: previsión con las fiestas nacionales y las propias de cada comunidad
     que se repiten cada año. Si una fiesta cae en domingo y la comunidad la traslada,
     eso solo se sabe cuando sale el BOE.
   - Sin comunidad elegida: las fiestas nacionales en su fecha (como la versión 1 de la app). */
(function(){
const CCAA = [["AN","Andalucía"],["AR","Aragón"],["AS","Asturias"],["IB","Illes Balears"],["CN","Canarias"],["CB","Cantabria"],
  ["CM","Castilla-La Mancha"],["CL","Castilla y León"],["CT","Cataluña"],["EX","Extremadura"],["GA","Galicia"],["MD","Comunidad de Madrid"],
  ["MC","Región de Murcia"],["NC","Navarra"],["PV","País Vasco"],["RI","La Rioja"],["VC","Comunitat Valenciana"],["CE","Ceuta"],["ML","Melilla"]];
const FUENTES = {"2026":"BOE-A-2025-21667","2027":"BOE-A-2026-21254"};
// [mmdd, nombre, comunidades ("*" = todas)]
const OFICIAL = {"2026":[["01-01","Año Nuevo","*"],["01-06","Epifanía del Señor","*"],["02-28","Día de Andalucía","AN"],["03-02","Lunes siguiente al Día de les Illes Balears","IB"],["03-19","San José","GA,MC,NC,PV,VC"],["03-20","Fiesta del Eid Fitr","ML"],["04-02","Jueves Santo","AN,AR,AS,IB,CN,CB,CM,CL,EX,GA,MD,MC,NC,PV,RI,CE,ML"],["04-03","Viernes Santo","*"],["04-06","Lunes de Pascua","IB,CM,CT,NC,PV,RI,VC"],["04-23","Fiesta de Castilla y León","CL"],["04-23","San Jorge / Día de Aragón","AR"],["05-01","Fiesta del Trabajo","*"],["05-02","Fiesta de la Comunidad de Madrid","MD"],["05-27","Fiesta Sacrificio-Aid al Adha","ML"],["05-27","Fiesta Sacrificio-Eidul Adha","CE"],["05-30","Día de Canarias","CN"],["06-04","Corpus Christi","CM"],["06-09","Día de la Región de Murcia","MC"],["06-09","Día de la Rioja","RI"],["06-24","San Juan","CT,GA,VC"],["07-25","Santiago Apóstol / Día Nacional de Galicia","GA,PV"],["07-28","Día de las Instituciones de Cantabria","CB"],["08-05","Nuestra Señora de África","CE"],["08-15","Asunción de la Virgen","*"],["09-02","Día de Ceuta","CE"],["09-08","Día de Asturias","AS"],["09-08","Día de Extremadura","EX"],["09-11","Fiesta Nacional de Cataluña","CT"],["09-15","La Bien Aparecida","CB"],["10-09","Día de la Comunitat Valenciana","VC"],["10-12","Fiesta Nacional de España","*"],["11-02","Día siguiente a Todos los Santos","AN,AR,AS,CN,CM,CL,EX,MD,NC"],["12-07","Lunes siguiente al Día de la Constitución Española","AN,AR,AS,CB,CL,EX,MD,MC,RI,ML"],["12-08","Inmaculada Concepción","*"],["12-25","Natividad del Señor","*"],["12-26","San Esteban","IB,CT"]],"2027":[["01-01","Año Nuevo","*"],["01-06","Epifanía del Señor","*"],["03-01","Día de Andalucía","AN"],["03-01","Día de les Illes Balears","IB"],["03-10","Fiesta del Eid Fitr","ML"],["03-19","San José","GA,MD,MC,NC,VC"],["03-25","Jueves Santo","AN,AR,AS,IB,CN,CB,CM,CL,EX,GA,MD,MC,NC,PV,RI,CE,ML"],["03-26","Viernes Santo","*"],["03-29","Lunes de Pascua","IB,CT,NC,PV,RI,VC"],["04-23","Fiesta de Castilla y León","CL"],["04-23","San Jorge / Día de Aragón","AR"],["05-01","Fiesta del Trabajo","*"],["05-17","Día de las Letras Gallegas","GA"],["05-17","Eidul Adha-Fiesta Sacrificio","CE"],["05-17","Fiesta Sacrificio-Aid Al Adha","ML"],["05-27","Corpus Christi","CM"],["05-31","Día de Castilla-La Mancha","CM"],["06-09","Día de La Rioja","RI"],["06-09","Día de la Región de Murcia","MC"],["06-24","Día de San Juan","CT"],["07-28","Día de las Instituciones de Cantabria","CB"],["08-05","Nuestra Señora de África","CE"],["08-16","Lunes siguiente a asunción de la Virgen","AN,AR,AS,CN,CL,MD"],["09-08","Día de Asturias","AS"],["09-08","Día de Extremadura","EX"],["09-11","Fiesta Nacional de Cataluña","CT"],["09-15","La Bien Aparecida","CB"],["10-07","Aniversario 1er Gobierno Euskadi","PV"],["10-09","Día de la Comunitat Valenciana","VC"],["10-11","Sustitución 15 de agosto","EX"],["10-12","Fiesta Nacional de España","*"],["11-01","Todos los Santos","*"],["12-06","Día de la Constitución Española","*"],["12-08","Inmaculada Concepción","*"],["12-25","Natividad del Señor","*"]]};
// Fiestas propias que se repiten cada año. JS = Jueves Santo, LP = Lunes de Pascua, CO = Corpus Christi
const REG = {
  AN:[["02-28","Día de Andalucía"],"JS"], AR:[["04-23","San Jorge / Día de Aragón"],"JS"], AS:[["09-08","Día de Asturias"],"JS"],
  IB:[["03-01","Día de les Illes Balears"],"JS","LP"], CN:[["05-30","Día de Canarias"],"JS"],
  CB:[["07-28","Día de las Instituciones de Cantabria"],["09-15","La Bien Aparecida"],"JS"],
  CM:[["05-31","Día de Castilla-La Mancha"],"JS","CO"], CL:[["04-23","Fiesta de Castilla y León"],"JS"],
  CT:["LP",["06-24","Sant Joan"],["09-11","Diada Nacional de Catalunya"],["12-26","Sant Esteve"]],
  EX:[["09-08","Día de Extremadura"],"JS"], GA:[["03-19","San José"],["05-17","Día de las Letras Gallegas"],["07-25","Día Nacional de Galicia"],"JS"],
  MD:[["05-02","Fiesta de la Comunidad de Madrid"],"JS"], MC:[["03-19","San José"],["06-09","Día de la Región de Murcia"],"JS"],
  NC:[["03-19","San José"],"JS","LP"], PV:["JS","LP"], RI:[["06-09","Día de La Rioja"],"JS","LP"],
  VC:[["03-19","San José"],"LP",["10-09","Día de la Comunitat Valenciana"]], CE:["JS",["08-05","Nuestra Señora de África"],["09-02","Día de Ceuta"]], ML:["JS"]
};
const pad = n => String(n).padStart(2,"0");
function easter(y){ // domingo de Pascua (algoritmo de Meeus)
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
    h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
    mes=Math.floor((h+l-7*m+114)/31),dia=((h+l-7*m+114)%31)+1;
  return new Date(y,mes-1,dia);
}
function rel(y,n){const d=easter(y);d.setDate(d.getDate()+n);return pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function nacionales(y){
  return [["01-01","Año Nuevo"],["01-06","Epifanía del Señor"],[rel(y,-2),"Viernes Santo"],["05-01","Fiesta del Trabajo"],
    ["08-15","Asunción de la Virgen"],["10-12","Fiesta Nacional de España"],["11-01","Todos los Santos"],
    ["12-06","Día de la Constitución Española"],["12-08","Inmaculada Concepción"],["12-25","Natividad del Señor"]];
}
const cache = {};
// Devuelve {"YYYY-MM-DD": nombre} del año y comunidad ("" = solo nacionales)
function festivos(y, cc){
  const key = y+"|"+(cc||"");
  if(cache[key]) return cache[key];
  const out = {}, put = (md,n) => { out[y+"-"+md] = n };
  if(!cc) nacionales(y).forEach(([md,n])=>put(md,n));
  else if(OFICIAL[y]) OFICIAL[y].forEach(([md,n,cs])=>{ if(cs==="*"||cs.split(",").includes(cc)) put(md,n) });
  else {
    nacionales(y).forEach(([md,n])=>put(md,n));
    (REG[cc]||[]).forEach(r=>{
      if(r==="JS") put(rel(y,-3),"Jueves Santo");
      else if(r==="LP") put(rel(y,1),"Lunes de Pascua");
      else if(r==="CO") put(rel(y,60),"Corpus Christi");
      else put(r[0],r[1]);
    });
  }
  return cache[key] = out;
}
const oficial = y => !!OFICIAL[y];
window.MTFest = {CCAA, festivos, oficial, FUENTES};
})();
