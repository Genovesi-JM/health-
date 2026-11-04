// Retire the service worker from the former Kaya application. Older visitors
// can otherwise keep seeing its cached clinical marketing pages after the
// launch-hold page has replaced them on GitHub Pages.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.includes(self.registration.scope)).map((name) => caches.delete(name)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    await Promise.all(clients.map((client) => client.navigate(`${self.registration.scope}?hold=20261104`)))
  })())
})
