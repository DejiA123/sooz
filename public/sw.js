const CACHE_NAME = 'sooz-cache-v1';

// Install event - cache assets if needed, or just install
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force activation
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Skip handling for external URLs (CDN, APIs, etc.)
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) {
        return; // Let the browser handle external requests normally
    }

    // Network first strategy for same-origin requests only
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});

// Push notification listener
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'SOOZ';
    const options = {
        body: data.body || 'New notification',
        icon: '/sooz-favicon.png',
        badge: '/sooz-favicon.png',
        data: data.url || '/'
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click listener
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data)
    );
});
