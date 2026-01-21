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
    const url = new URL(event.request.url);

    // Skip cross-origin (except CDN/Supabase)
    // We want to cache Supabase storage images/videos if possible
    const isSupabaseStorage = url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/object/');
    const isExternalImage = url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i);

    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    // Skip range requests (videos often use these) to avoid partial content caching issues in simple SW
    if (event.request.headers.has('range')) return;

    // Cache First for Assets (JS/CSS/Fonts/Images)
    // Stale-While-Revalidate for others
    const isAsset = /\.(js|css|png|jpg|jpeg|svg|woff2|ico|webp)$/i.test(url.pathname) || isSupabaseStorage || isExternalImage;

    if (isAsset) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    // Return cached response immediately if found
                    if (cachedResponse) return cachedResponse;

                    // Otherwise fetch and cache
                    return fetch(event.request).then((networkResponse) => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                            return networkResponse;
                        }

                        // Clone the response
                        const responseToCache = networkResponse.clone();

                        cache.put(event.request, responseToCache);
                        return networkResponse;
                    }).catch(() => {
                        // Fallback?
                    });
                });
            })
        );
    } else {
        // Network First for HTML and others (Navigation)
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        cache.put(event.request, response.clone());
                        return response;
                    });
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
    }
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
