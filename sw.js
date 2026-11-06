/* ForgeFit service worker: offline-capable app shell that prefers the newest version when online */
const V = 'forgefit-v9';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'];
// each file is cached on its own, so one missing optional file can never block the install
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const put = (r, res) => { if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; };
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  const u = new URL(r.url);
  // sw.js is the version marker the app reads, so it is never served from a cache
  if (u.pathname.endsWith('/sw.js')) return;
  const isPage = r.mode === 'navigate' || /(^|\/)(index\.html)?$/.test(u.pathname);
  if (isPage) {
    // Network first: with a signal you always get the newest app. No signal or a slow one (3 s) falls back to the saved copy.
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => caches.match('./index.html').then(hit => hit || caches.match(r, { ignoreSearch: true }));
      const t = setTimeout(() => fallback().then(hit => { if (hit && !done) { done = true; resolve(hit); } }), 3000);
      fetch(r, { cache: 'no-cache' }).then(res => { clearTimeout(t); if (done) { put('./index.html', res.clone()); return; } done = true; if (res.ok) { put('./index.html', res.clone()); resolve(res); } else fallback().then(hit => resolve(hit || res)); })
        .catch(() => { clearTimeout(t); if (!done) { done = true; fallback().then(hit => resolve(hit || Response.error())); } });
    }));
    return;
  }
  // everything else (icons, manifest): saved copy first, refreshed in the background
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => {
    const net = fetch(r).then(res => put(r, res)).catch(() => hit);
    return hit || net;
  }).catch(() => caches.match('./index.html')));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs[0] ? cs[0].focus() : self.clients.openWindow('./'))); });
