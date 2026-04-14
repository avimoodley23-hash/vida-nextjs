// Vida Service Worker — handles push notifications and background reminder checks

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Handle push notifications from server
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Vida', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'vida-notification',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

// Open app when notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(event.notification.data?.url || '/');
    })
  );
});

// Background reminder check via message from app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'REMINDER_CHECK') {
    const reminders = event.data.reminders || [];
    const now = new Date();
    const nowDate = now.toISOString().split('T')[0];
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    reminders
      .filter((r) => !r.done && r.date === nowDate && r.time === nowTime)
      .forEach((r) => {
        self.registration.showNotification(`⏰ ${r.title}`, {
          body: 'Tap to open Vida',
          icon: '/icon-192.png',
          tag: `reminder-${r.id}`,
          data: { url: '/' },
        });
      });
  }
});
