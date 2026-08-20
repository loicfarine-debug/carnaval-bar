const C='cg-bar-v3-4';
const ASSETS=['./','index.html','styles.css','app.js','logo.png','icon-192.png','icon-512.png','manifest.webmanifest'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;

  // Navigation: réseau d'abord pour récupérer les mises à jour, cache si hors ligne.
  if(e.request.mode==='navigate'){
    e.respondWith(
      fetch(e.request)
        .then(r=>{
          const copy=r.clone();
          caches.open(C).then(c=>c.put('./',copy));
          return r;
        })
        .catch(()=>caches.match('./').then(r=>r||caches.match('index.html')))
    );
    return;
  }

  // Fichiers statiques: cache immédiat + rafraîchissement réseau en arrière-plan.
  e.respondWith(
    caches.match(e.request).then(cached=>{
      const network=fetch(e.request).then(r=>{
        if(r&&r.ok){
          const copy=r.clone();
          caches.open(C).then(c=>c.put(e.request,copy));
        }
        return r;
      }).catch(()=>null);
      return cached || network || caches.match('./');
    })
  );
});
