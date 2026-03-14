/* 
  Workbox-based Service Worker for NeoStrike SDK
  Configures caching strategies as per SDK-07 PRD
*/

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log('[NeoStrike SW] Workbox loaded');

  // Cache-first for game tile images (7 days)
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image' && request.url.includes('/games/'),
    new workbox.strategies.CacheFirst({
      cacheName: 'ns-game-tiles',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
        }),
      ],
    })
  );

  // Network-first for Game Catalog API (5 minutes)
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.includes('/api/v1/games/catalog'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'ns-game-catalog',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxAgeSeconds: 5 * 60, // 5 Minutes
        }),
      ],
    })
  );

  // Stale-while-revalidate for static assets
  workbox.routing.registerRoute(
    ({ request }) => ['style', 'script', 'font'].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'ns-static-assets',
    })
  );

  // EXPLICIT EXCLUSION: Security Constraints
  // Payment, Auth, and Balance endpoints MUST NEVER be cached
  const excludedPaths = [
    '/api/payments/',
    '/api/auth/',
    '/api/balance/',
    '/api/bonuses/credit',
    '/api/rg/'
  ];

  workbox.routing.registerRoute(
    ({ url }) => excludedPaths.some(path => url.pathname.includes(path)),
    new workbox.strategies.NetworkOnly()
  );

} else {
  console.error('[NeoStrike SW] Workbox failed to load');
}
