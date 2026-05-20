const CACHE = 'ossi-ajuda-v1';
const ARQUIVOS = [
  './', './index.html', './css/style.css',
  './js/app.js', './js/sergio.js', './js/search.js', './js/tts.js',
  './data/faq.json', './data/categorias.json', './manifest.json',
  './assets/logo-ossi.jpg', './assets/icons/icon-192.svg', './assets/icons/icon-512.svg'
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS))));
self.addEventListener('fetch', (e) => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
