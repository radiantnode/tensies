/* Tensies service worker — Web Push only (no offline caching).
 *
 * Served from the site root (/sw.js) so its scope is "/". It does two things:
 *   push              → render the notification the server sent
 *   notificationclick → focus an existing tab or open the target URL
 *
 * The payload shape is set by server/push.py: {title, body, url}.
 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Tensies', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Tensies';
  const options = {
    body: data.body || '',
    icon: '/static/images/icon-192.png',
    badge: '/static/images/icon-192.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && url !== '/') client.navigate(url);
          return undefined;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
