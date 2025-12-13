// Minimal Service Worker to enable PWA installability
self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
});

self.addEventListener('fetch', (event) => {
    // Placeholder: Just passthrough for now.
    // In future: Cache static assets for offline support depending on requirements.
});
