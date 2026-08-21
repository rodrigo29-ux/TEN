const CACHE_NAME = "ten-app-v3"; // Cambiamos a v3 para forzar la actualización
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
  self.skipWaiting(); // Obliga al nuevo Service Worker a activarse inmediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Limpiar cachés antiguos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName); // Borra las versiones v1 y v2 rotas
          }
        })
      );
    })
  );
});

// Interceptar peticiones de red (Estrategia: Network First, fallback to Cache)
self.addEventListener("fetch", (event) => {
  // Ignoramos Firebase, Supabase y peticiones que no sean GET
  if (event.request.url.includes("firestore.googleapis.com") || 
      event.request.url.includes("supabase.co") || 
      event.request.method !== "GET") {
      return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // 1. Si hay internet y la red responde bien, guardamos una copia fresca y la mostramos
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // 2. Si falla la red (estamos offline), buscamos en el caché como plan de emergencia
        return caches.match(event.request);
      })
  );
});