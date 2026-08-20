const CACHE_NAME = "ten-app-v2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./modulo_retencion.html",
  "./modulo_programacion.html",
  "./styles.css",
  "./app.js",
  "./logo.png",
  "./logo-192.png",
  "./logo-512.png",
  "./fondo.png",
  "./tecnico.png",
  "./manifest.json"
];

// Instalar y guardar en caché inicial
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Interceptar peticiones de red
self.addEventListener("fetch", (event) => {
  // Ignoramos las peticiones a Firebase y Supabase para no interferir con su propio sistema offline
  if (event.request.url.includes("firestore.googleapis.com") || event.request.url.includes("supabase.co")) {
      return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Estrategia Stale-While-Revalidate: Devuelve del caché si existe, pero actualiza en segundo plano
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      }).catch(() => {
          // Si falla la red, no hacemos nada extra, ya retornamos el caché
      });

      return cachedResponse || fetchPromise;
    })
  );
});