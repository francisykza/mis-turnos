const CACHE="mis-turnos-v4";
const SHELL=["./","index.html","css/app.css","js/app.js","manifest.json","icon-192.png","icon-512.png","apple-touch-icon.png"];
// GitHub Pages deja guardar cada archivo 10 minutos en la caché del navegador.
// Para que una versión nueva llegue al momento, la página, el código y los estilos
// se piden con "no-cache" (el navegador pregunta siempre si han cambiado).
const fresh=u=>fetch(u,{cache:"no-cache",credentials:"same-origin"});
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:"reload"})))).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const req=e.request; if(req.method!=="GET") return;
  const url=new URL(req.url);
  // La página: red primero (para recibir actualizaciones), caché si no hay conexión
  if(req.mode==="navigate"){
    e.respondWith(fresh(req.url).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put("index.html",cp))}return r}).catch(()=>caches.match("index.html",{ignoreSearch:true})));
    return;
  }
  // Código y estilos de la app: red primero, para que cada actualización llegue entera
  if(url.origin===location.origin && /\.(js|css)$/.test(url.pathname)){
    e.respondWith(fresh(req.url).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r}).catch(()=>caches.match(req,{ignoreSearch:true})));
    return;
  }
  // Resto (iconos, fuentes): caché primero
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{
    if(r.ok&&(url.origin===location.origin||url.host.endsWith("gstatic.com")||url.host.endsWith("googleapis.com"))){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}
    return r;
  })));
});
