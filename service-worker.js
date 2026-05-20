const CACHE = 'ossi-ajuda-v2';
const ARQUIVOS = [
  './', './index.html', './css/style.css',
  './js/app.js', './js/sergio.js', './js/search.js', './js/tts.js', './js/ai.js',
  './data/faq.json', './data/categorias.json', './manifest.json',
  './assets/logo-ossi.jpg', './assets/icons/icon-192.svg', './assets/icons/icon-512.svg'
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS))));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/sergio')) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
