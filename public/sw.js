/*
 * Service Worker de Chivas Barbería Club.
 *
 * Único propósito hoy: recibir notificaciones push (Web Push) en el panel
 * instalado como PWA — sobre todo en Chrome de Android. No cachea nada ni
 * intercepta `fetch`; la app sigue siendo online-only.
 *
 * El payload que manda el server (`lib/push.ts`) es JSON:
 *   { title, body, url, tag }
 */

self.addEventListener('install', (event) => {
  // Activa esta versión sin esperar a que se cierren las pestañas viejas.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Chivas Barbería Club';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/admin' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(
    (event.notification.data && event.notification.data.url) || '/admin',
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana del sitio abierta, la enfoca y navega ahí.
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(targetUrl).catch(() => {});
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
