// ============================================================
// ラブソング診断16 Service Worker
//
// 戦略:
//   - HTML(navigate)    : network-first, fallback to cache
//     → 新デプロイを即反映、オフライン時のみキャッシュ表示
//   - 静的 (js/css/png)  : stale-while-revalidate
//     → キャッシュ即返却+裏で更新ダウンロード(初回以降爆速)
//   - Spotify API系     : ネットワーク必須(SWは触らない)
//
// CACHE_VERSION を変えると旧キャッシュ全部破棄。index.html の ?v= に
// 連動させて新デプロイで全更新したい時に使う。
// ============================================================

const CACHE_VERSION = "v118";  // index.html の ?v= と合わせる(更新時にbumpすれば旧キャッシュ全削除)
const STATIC_CACHE  = `lsd16-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `lsd16-runtime-${CACHE_VERSION}`;

// プリキャッシュ(install時に取得)
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// install: 主要ファイルをプリキャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// activate: 古いバージョンのキャッシュを掃除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n.startsWith("lsd16-") && !n.endsWith(CACHE_VERSION))
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// fetch: リソース種別ごとに戦略を分ける
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 同一オリジン以外はキャッシュしない(Spotify/Apple Music/YouTube等の外部API)
  if (url.origin !== self.location.origin) return;

  // Spotifyトークン取得API:常にネットワーク(SWキャッシュしない)
  if (url.pathname.startsWith("/api/")) return;

  // HTMLナビゲーション:network-first
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 静的リソース:stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const clone = res.clone();
      caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // 最後の手段:プリキャッシュ済みの / を返す(オフラインフォールバック)
    const fallback = await caches.match("/index.html");
    return fallback || new Response("offline", { status: 503 });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}
