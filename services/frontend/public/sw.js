const CACHE_NAME = 'novacore-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Critical assets to cache
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add other critical assets as needed
];

// API routes that should work offline
const OFFLINE_FALLBACK_ROUTES = [
  '/dashboard',
  '/chat',
  '/study',
  '/profile'
];

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Cache critical assets
      try {
        await cache.addAll(PRECACHE_ASSETS);
      } catch (error) {
        console.error('Failed to cache some assets during install:', error);
      }
      
      // Skip waiting to activate immediately
      self.skipWaiting();
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('novacore-') && cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
      
      // Take control of all clients immediately
      self.clients.claim();
    })()
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip requests to chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    (async () => {
      try {
        // Try network first for API calls
        if (url.pathname.startsWith('/api/')) {
          return await networkFirstStrategy(request);
        }

        // Try cache first for static assets
        if (isStaticAsset(url.pathname)) {
          return await cacheFirstStrategy(request);
        }

        // Try network first for pages, fallback to offline page
        if (isAppRoute(url.pathname)) {
          return await networkFirstWithOfflineFallback(request);
        }

        // Default: try network first, then cache
        return await networkFirstStrategy(request);
      } catch (error) {
        console.error('Fetch handler error:', error);
        return new Response('Network error', { 
          status: 408,
          headers: { 'Content-Type': 'text/plain' } 
        });
      }
    })()
  );
});

// Network first strategy (for API calls and dynamic content)
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try cache if network fails
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Cache first strategy (for static assets)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    throw error;
  }
}

// Network first with offline fallback (for app routes)
async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback to offline page for app routes
    if (OFFLINE_FALLBACK_ROUTES.some(route => request.url.includes(route))) {
      const offlineResponse = await caches.match(OFFLINE_URL);
      if (offlineResponse) {
        return offlineResponse;
      }
    }

    throw error;
  }
}

// Helper functions
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

function isAppRoute(pathname) {
  const appRoutes = ['/dashboard', '/chat', '/study', '/profile', '/levels', '/billing'];
  return appRoutes.some(route => pathname.startsWith(route)) || pathname === '/';
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'chat-sync') {
    event.waitUntil(syncOfflineMessages());
  }
  
  if (event.tag === 'analytics-sync') {
    event.waitUntil(syncOfflineAnalytics());
  }
});

// Sync offline chat messages when back online
async function syncOfflineMessages() {
  try {
    // Get offline messages from IndexedDB or localStorage
    const offlineMessages = await getOfflineMessages();
    
    for (const message of offlineMessages) {
      try {
        await fetch('/api/chat/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${message.token}`
          },
          body: JSON.stringify(message.data)
        });
        
        // Remove from offline storage after successful sync
        await removeOfflineMessage(message.id);
      } catch (error) {
        console.error('Failed to sync message:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Sync offline analytics when back online
async function syncOfflineAnalytics() {
  try {
    const offlineEvents = await getOfflineAnalytics();
    
    for (const event of offlineEvents) {
      try {
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${event.token}`
          },
          body: JSON.stringify(event.data)
        });
        
        await removeOfflineAnalytics(event.id);
      } catch (error) {
        console.error('Failed to sync analytics event:', error);
      }
    }
  } catch (error) {
    console.error('Analytics sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  const options = {
    body: 'You have new updates in NovaCore AI',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: { url: '/dashboard' },
    actions: [
      {
        action: 'view',
        title: 'View Updates',
        icon: '/icons/view-action.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-action.png'
      }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.body || options.body;
      options.data = { ...options.data, ...data };
    } catch (error) {
      console.error('Failed to parse push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification('NovaCore AI', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if none found
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Placeholder functions for offline storage (implement with IndexedDB)
async function getOfflineMessages() {
  // Implement with IndexedDB or localStorage
  return [];
}

async function removeOfflineMessage(id) {
  // Implement with IndexedDB or localStorage
}

async function getOfflineAnalytics() {
  // Implement with IndexedDB or localStorage
  return [];
}

async function removeOfflineAnalytics(id) {
  // Implement with IndexedDB or localStorage
}