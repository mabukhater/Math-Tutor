// Minimal service worker — enables "install as app" (PWA) without aggressive
// caching, so the app is always fresh. We intentionally pass requests through
// to the network to avoid serving stale lessons/questions.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Pass-through: let the browser handle the request normally. The presence of
  // this handler is what makes the app installable.
});
