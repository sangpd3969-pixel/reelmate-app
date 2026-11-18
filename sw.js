// ReelMate 오프라인 캐시: 앱 파일은 먼저 저장본을, 나머지는 네트워크를 사용
const CACHE = "reelmate-v11";
const FILES = ["./", "./index.html", "./app.js", "./app.css", "./privacy.html", "./reel.js", "./config.js", "./edit.js", "./vendor/glfx.js", "./vendor/smartcrop.js", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png",
  "onboarding","login","connect","home","capture","mood","creating","preview","publish","done","library","schedule","mypage"]
  .map(f => f.startsWith(".") ? f : "./screens/" + f + ".html");
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" }))))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin) {
    e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; })
      .catch(() => caches.match(e.request)));
  }
});
