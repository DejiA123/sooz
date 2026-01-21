const CACHE_NAME = 'sooz-cache-v2'; // Bumped version for new caching strategy
const MAX_VIDEO_CACHE_SIZE = 200 * 1024 * 1024; // 200MB for videos
const MAX_IMAGE_CACHE_SIZE = 50 * 1024 * 1024; // 50MB for images

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
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker activated with cache:', CACHE_NAME);
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    // Identify media types
    const isSupabaseStorage = url.hostname.includes('supabase.co') && url.pathname.includes('/storage/v1/object/');
    const isVideo = url.pathname.match(/\.(mp4|webm|ogg|mov)$/i) || (isSupabaseStorage && url.pathname.includes('/videos/'));
    const isImage = url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i);
    const isAsset = /\.(js|css|woff2)$/i.test(url.pathname);

    // Handle video requests (including range requests)
    if (isVideo) {
        event.respondWith(handleVideoRequest(event.request));
        return;
    }

    // Cache First for Images and Assets
    if (isImage || isAsset || isSupabaseStorage) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    // Return cached response immediately if found
                    if (cachedResponse) {
                        // Optionally revalidate in background (stale-while-revalidate)
                        fetch(event.request).then(networkResponse => {
                            if (networkResponse && networkResponse.status === 200) {
                                cache.put(event.request, networkResponse.clone());
                            }
                        }).catch(() => { });

                        return cachedResponse;
                    }

                    // Otherwise fetch and cache
                    return fetch(event.request).then((networkResponse) => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }

                        // Clone the response
                        const responseToCache = networkResponse.clone();
                        cache.put(event.request, responseToCache);
                        return networkResponse;
                    }).catch(() => {
                        // Return cached fallback if available
                        return cache.match(event.request);
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

// Handle video requests with range support
async function handleVideoRequest(request) {
    const cache = await caches.open(CACHE_NAME);

    // Try to get from cache first
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        // Check if this is a range request
        const rangeHeader = request.headers.get('range');

        if (rangeHeader && cachedResponse.status === 200) {
            // We have the full video cached, serve the requested range
            return serveRangeResponse(cachedResponse, rangeHeader);
        }

        // Return full cached response
        return cachedResponse;
    }

    // Not in cache, fetch from network
    try {
        const networkResponse = await fetch(request);

        // Cache the full response if successful (not a range response)
        if (networkResponse.status === 200 && !request.headers.get('range')) {
            // Clone for cache
            const responseToCache = networkResponse.clone();

            // Check size before caching (don't cache huge videos)
            const contentLength = networkResponse.headers.get('content-length');
            if (contentLength && parseInt(contentLength) < 100 * 1024 * 1024) { // Max 100MB per video
                cache.put(request, responseToCache);
            }
        }

        return networkResponse;
    } catch (error) {
        console.error('Failed to fetch video:', error);
        // Return cached version if available
        return cache.match(request) || new Response('Network error', { status: 408 });
    }
}

// Serve a range from a cached full response
async function serveRangeResponse(response, rangeHeader) {
    const blob = await response.blob();
    const fileSize = blob.size;

    // Parse range header (e.g., "bytes=0-1023")
    const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!rangeMatch) return response;

    const start = parseInt(rangeMatch[1]);
    const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : fileSize - 1;

    // Slice the blob
    const slicedBlob = blob.slice(start, end + 1);

    // Create range response
    return new Response(slicedBlob, {
        status: 206,
        statusText: 'Partial Content',
        headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': slicedBlob.size.toString(),
            'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
        }
    });
}

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
