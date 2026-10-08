// Push notification listener
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'SOOZ';
    const options = {
        body: data.body || 'New notification',
        icon: '/sooz-favicon.png',
        badge: '/sooz-favicon.png',
        data: data.url || '/',
        vibrate: [200, 100, 200],
        tag: data.tag || undefined,
        renotify: !!data.tag
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click listener — focus an open tab if there is one
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = new URL(event.notification.data || '/', self.location.origin).href;
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const c of list) {
                if ('focus' in c) { c.navigate(target).catch(() => {}); return c.focus(); }
            }
            return clients.openWindow(target);
        })
    );
});
