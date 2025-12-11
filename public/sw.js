const CACHE_NAME = 'sooz-assets-v1';
const IMAGE_CACHE_NAME = 'sooz-images-v1';

// Cache static assets
const STATIC_ASSETS = [
  '/',
  '/placeholder-optimized.svg',
  '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle images separately for optimization
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Handle static assets
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(request);
        })
    );
    return;
  }

  // Default: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Handle image requests with optimization
async function handleImageRequest(request) {
  const url = new URL(request.url);
  
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    // Fetch from network
    const response = await fetch(request);
    
    // Clone response for caching
    const responseClone = response.clone();
    
    // Cache the image
    caches.open(IMAGE_CACHE_NAME)
      .then((cache) => cache.put(request, responseClone));
    
    return response;
  } catch (error) {
    // Fallback to placeholder if image fails to load
    if (url.pathname.includes('avatar') || url.pathname.includes('profile')) {
      return caches.match('/placeholder-optimized.svg');
    }
    
    // Return error response
    return new Response('Image not available', { status: 404 });
  }
}

// Optimize images based on device capabilities
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Optimize images from known CDNs
  if (url.hostname.includes('cloudinary.com') || url.hostname.includes('imgix.net')) {
    event.respondWith(optimizeImage(request));
  }
});

async function optimizeImage(request) {
  const url = new URL(request.url);
  
  // Add optimization parameters based on device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const maxWidth = isMobile ? 400 : 800;
  
  // Add quality and format optimization
  if (url.hostname.includes('cloudinary.com')) {
    url.searchParams.set('q', 'auto');
    url.searchParams.set('f', 'auto');
    url.searchParams.set('w', maxWidth.toString());
  } else if (url.hostname.includes('imgix.net')) {
    url.searchParams.set('q', '75');
    url.searchParams.set('w', maxWidth.toString());
    url.searchParams.set('auto', 'format');
  }
  
  return fetch(url.toString());
}