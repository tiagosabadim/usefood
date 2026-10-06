// Service worker do app: guarda os arquivos do app (com nome versionado) para abrir rápido.
// Páginas: sempre da internet primeiro (sem a internet, a última versão guardada).
// Banco, imagens do cardápio e qualquer outro endereço: sempre da internet (nada de cardápio velho).
const CACHE = 'usefood-app-v1';
const ARQUIVOS = /^\/(assets|marca|fotos)\//;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const pedido = e.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  if (ARQUIVOS.test(url.pathname)) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const guardado = await cache.match(pedido);
        if (guardado) return guardado;
        const resposta = await fetch(pedido);
        if (resposta.ok) cache.put(pedido, resposta.clone());
        return resposta;
      }),
    );
    return;
  }

  if (pedido.mode === 'navigate') {
    e.respondWith(
      fetch(pedido)
        .then((resposta) => {
          const copia = resposta.clone();
          void caches.open(CACHE).then((cache) => cache.put(pedido, copia));
          return resposta;
        })
        .catch(
          async () =>
            (await caches.match(pedido)) ?? (await caches.match('/delivery')) ?? Response.error(),
        ),
    );
  }
});
