const CACHE_NAME = 'applenet-v2.1';
const STATIC_CACHE = 'applenet-static-v2.1';
const DYNAMIC_CACHE = 'applenet-dynamic-v2.1';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-192x192-maskable.png',
  '/icons/icon-512x512-maskable.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to cache:', err);
      });
    })
  );
  // Force activate immediately
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first for API, cache first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith('http')) return;

  // Network-first strategy for API calls
  if (url.pathname.startsWith('/api/') || url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || new Response(
              JSON.stringify({ error: 'أنت غير متصل بالإنترنت' }),
              { headers: { 'Content-Type': 'application/json' }, status: 503 }
            );
          });
        })
    );
    return;
  }

  // Cache-first strategy for static assets (CSS, JS, images)
  if (request.url.match(/\.(css|js|png|jpg|jpeg|svg|gif|woff2|woff|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Update cache in background
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(request, response);
              });
            }
          }).catch(() => {});
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first with offline fallback for navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('/').then((fallback) => {
              if (fallback) return fallback;
              return new Response(
                `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Apple.NET - غير متصل</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; direction: rtl; }
    .container { text-align: center; padding: 2rem; }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
    h1 { color: #1B7A3D; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #666; font-size: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📡</div>
    <h1>أنت غير متصل بالإنترنت</h1>
    <p>يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى</p>
  </div>
</body>
</html>`,
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              );
            });
          });
        })
    );
    return;
  }

  // Default: try network, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  let data = { title: 'Apple.NET', body: 'لديك إشعار جديد' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'فتح التطبيق' },
        { action: 'dismiss', title: 'إغلاق' },
      ],
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// Background sync event (placeholder)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
});

// Message handler - for update notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
