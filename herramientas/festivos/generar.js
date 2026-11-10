// Genera js/festivos.js a partir de las tablas oficiales del BOE (j2026.json, j2027.json)
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "boe");
const out = process.argv[2];
const CODES = ["AN","AR","AS","IB","CN","CB","CM","CL","CT","EX","GA","MD","MC","NC","PV","RI","VC","CE","ML"];
const fuentes = {2026: "BOE-A-2025-21667", 2027: "BOE-A-2026-21254"};
const oficial = {};
for (const y of Object.keys(fuentes)) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, "j" + y + ".json"), "utf8"));
  const map = {}; // "mmdd|nombre" -> [codes]
  for (const c of CODES) for (const [d, n] of Object.entries(j[c])) {
    const k = d.slice(5) + "|" + n.replace(/\s*\/\s*/g, " / ");
    (map[k] = map[k] || []).push(c);
  }
  oficial[y] = Object.entries(map).sort().map(([k, cs]) => {
    const [md, n] = k.split("|");
    return [md, n, cs.length === CODES.length ? "*" : cs.join(",")];
  });
}
const src = `/* Festivos laborales de España. Generado a partir del BOE; no editar a mano.
   - Años con calendario oficial publicado: ${Object.entries(fuentes).map(([y, b]) => y + " (" + b + ")").join(", ")}.
   - Otros años: previsión con las fiestas nacionales y las propias de cada comunidad
     que se repiten cada año. Si una fiesta cae en domingo y la comunidad la traslada,
     eso solo se sabe cuando sale el BOE.
   - Sin comunidad elegida: las fiestas nacionales en su fecha (como la versión 1 de la app). */
(function(){
const CCAA = [["AN","Andalucía"],["AR","Aragón"],["AS","Asturias"],["IB","Illes Balears"],["CN","Canarias"],["CB","Cantabria"],
  ["CM","Castilla-La Mancha"],["CL","Castilla y León"],["CT","Cataluña"],["EX","Extremadura"],["GA","Galicia"],["MD","Comunidad de Madrid"],
  ["MC","Región de Murcia"],["NC","Navarra"],["PV","País Vasco"],["RI","La Rioja"],["VC","Comunitat Valenciana"],["CE","Ceuta"],["ML","Melilla"]];
const FUENTES = ${JSON.stringify(fuentes)};
// [mmdd, nombre, comunidades ("*" = todas)]
const OFICIAL = ${JSON.stringify(oficial)};
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
`;
fs.writeFileSync(out, src);
console.log("ok", Object.fromEntries(Object.entries(oficial).map(([y, a]) => [y, a.length])));
