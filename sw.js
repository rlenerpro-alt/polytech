// Service worker : l'appli s'ouvre même hors ligne.
const VERSION = "phot3a-v10";
const CORE = ["./", "index.html", "supabase.js", "manifest.webmanifest", "icon-192.png", "icon-512.png",
  "optique-ondulatoire.html", "optique-geometrique.html", "optique-matricielle.html",
  "systemes-numeriques.html", "series-de-fourier.html", "economie.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Supabase, polices : réseau direct
  if (u.pathname.startsWith("/api/")) return; // ADE : toujours le réseau
  // réseau d'abord pour la page (mises à jour), cache en secours ; cache d'abord pour le reste
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(VERSION).then((ca) => ca.put("index.html", c)); return r; }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then((ca) => ca.put(e.request, c)); } return r; })));
});
