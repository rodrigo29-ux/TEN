const CACHE_NAME = "ten-app-v5"; // 🔥 Cambiamos a v5 para obligar a todos los celulares a actualizarse
const ASSETS_TO_CACHE = [
  // --- Archivos Locales ---
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
  "./manifest.json",
  
  // --- 🔥 Librerías Pesadas Externas (ESTO ACELERA LA APP) ---
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/sweetalert2@11",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js",
  "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"
];

// Instalar y guardar en caché inicial
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Obliga al nuevo Service Worker a activarse inmediatamente
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Descargando archivos y librerías al caché del celular...");
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
            console.log("Borrando caché antiguo:", cacheName);
            return caches.delete(cacheName); // Borra las versiones anteriores
          }
        })
      );
    })
  );
});

// Interceptar peticiones de red (Estrategia: Network First, fallback to Cache)
self.addEventListener("fetch", (event) => {
  // Ignoramos Firebase, Supabase, extensiones de Chrome y peticiones que no sean GET
  if (event.request.url.includes("firestore.googleapis.com") || 
      event.request.url.includes("supabase.co") || 
      event.request.url.includes("chrome-extension") ||
      event.request.method !== "GET") {
      return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // 1. Si hay internet y la red responde bien, guardamos una copia fresca y la mostramos
        const clonedResponse = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clonedResponse);
        });
        return networkResponse;
      })
      .catch(async () => {
        // 2. Si falla la red (estamos offline o con lag), buscamos en el caché la interfaz guardada
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
            return cachedResponse;
        }
      })
  );
});