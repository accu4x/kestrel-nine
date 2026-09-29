/* Kestrel Nine service worker, site edition only. build.mjs --site fills in the cache name
 * (a content hash of the build) and the file list. Cache-first for the precached build, so
 * the game starts offline; old caches are deleted on activate. */
'use strict';
const CACHE = '/*CACHE*/';
const FILES = /*FILES*/[];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('k9-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // ignoreSearch: a challenge link (?c=...) is the same page as the start URL.
  e.respondWith(caches.open(CACHE)
    .then((c) => c.match(req, { ignoreSearch: true }))
    .then((hit) => hit || fetch(req)));
});
