// ÓRBITA · service worker: guarda la "cáscara" de la app para que abra al instante y sin internet.
// Los datos NO se guardan aquí (los guarda la app); el cerebro siempre se consulta en vivo.
const VERSION = 'orbita-v2';
const CASCARA = ['./', 'index.html', 'css/orbita.css', 'js/config.js', 'js/demo.js', 'js/api.js', 'js/ui.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-192.png', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CASCARA)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // cerebro, Google, fuentes: directo a la red
  // red primero (para ver siempre la última versión); si no hay internet, lo guardado
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
});
