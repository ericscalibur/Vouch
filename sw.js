// Vouch service worker: offline-first, with updates the user approves.
//
// Each version caches its own files under its own name. Vouch only ever serves
// the version the user approved. A newly published version is downloaded and
// kept ready, but nothing changes until the user taps Update in the app.
//
// Honest limit: this protects against surprise updates, not against a
// compromised host. Whoever can publish sw.js can publish one that ignores
// these rules. See "Trust model" in the README. Self-hosting removes that risk.
//
// Bump VERSION on each release and tag the commit to match (v0.2.0, ...).
const VERSION = 'vouch-v0.2.4';
const META = 'vouch-meta';
const APPROVED_KEY = '/__vouch/approved';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/core.js', 'js/vault.js', 'js/wordlist.js',
  'vendor/qrcode.js', 'vendor/jsQR.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];
const label = v => v.replace(/^vouch-v/, '');

async function getApproved() {
  const hit = await (await caches.open(META)).match(APPROVED_KEY);
  return hit ? hit.text() : null;
}
async function setApproved(v) {
  await (await caches.open(META)).put(APPROVED_KEY, new Response(v));
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    // cache: 'reload' skips the browser's HTTP cache, so we never store stale files.
    const c = await caches.open(VERSION);
    await c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })));
    // First install (or upgrading from 0.1.x, which had no approval step): approve this version.
    if (!(await getApproved())) await setApproved(VERSION);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const approved = await getApproved();
    const keep = new Set([VERSION, approved, META]);
    for (const k of await caches.keys()) if (!keep.has(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const approved = (await getApproved()) || VERSION;
    const cache = (await caches.has(approved)) ? approved : VERSION;
    const hit = await (await caches.open(cache)).match(e.request, { ignoreSearch: true });
    return hit || fetch(e.request);
  })());
});

self.addEventListener('message', e => {
  const reply = msg => e.ports[0]?.postMessage(msg);
  e.waitUntil((async () => {
    if (e.data?.type === 'status') {
      const approved = (await getApproved()) || VERSION;
      reply({ running: label(approved), available: approved === VERSION ? null : label(VERSION) });
    } else if (e.data?.type === 'approve') {
      await setApproved(VERSION);
      reply({ running: label(VERSION) });
    }
  })());
});
