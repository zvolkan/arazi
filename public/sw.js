// Arazi Takip — internetsiz kullanım için service worker
// Sayfalar: önce internet, yoksa son kaydedilen hali. Statik dosyalar ve fotoğraflar: önce önbellek.
const V = "v2";
const PAGES = `sayfalar-${V}`;
const STATIC = `statik-${V}`;
const PHOTOS = `foto-${V}`;
const OFFLINE_URL = "/cevrimdisi";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PAGES).then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" }))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, STATIC, PHOTOS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/brand/") ||
  /^\/(icon|apple-icon|manifest\.webmanifest)/.test(url.pathname) ||
  /\.(woff2?|png|svg|ico)$/.test(url.pathname);

/**
 * iPhone Safari, service worker'ın verdiği yanıt yönlendirme sonucu ise (redirected) sayfayı açmaz
 * ve "güvenli bağlantı kurulamadı" benzeri hata gösterir. Böyle yanıtları temiz bir kopyayla değiştirir.
 */
async function clean(res) {
  if (!res || !res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return clean(hit);
  const res = await clean(await fetch(request));
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/** Statik dosyaları sayfa HTML'inden bulup önbelleğe alır (internetsiz açılınca sayfa çalışsın) */
async function cacheAssetsOf(html) {
  const cache = await caches.open(STATIC);
  const urls = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
  for (const u of urls) {
    if (!(await cache.match(u))) {
      try {
        const r = await fetch(u);
        if (r.ok) await cache.put(u, r);
      } catch {}
    }
  }
}

async function savePage(path, res) {
  res = await clean(res);
  const cache = await caches.open(PAGES);
  await cache.put(path, res.clone());
  try {
    await cacheAssetsOf(await res.clone().text());
  } catch {}
}

async function networkFirstPage(request) {
  const url = new URL(request.url);
  try {
    const res = await clean(await fetch(request));
    if (res.ok && res.headers.get("content-type")?.includes("text/html")) {
      savePage(url.pathname, res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(PAGES);
    return (
      (await clean(await cache.match(url.pathname, { ignoreVary: true }))) ||
      (await clean(await cache.match(OFFLINE_URL, { ignoreVary: true }))) ||
      new Response("İnternet yok", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    event.respondWith(cacheFirst(STATIC, request));
  } else if (url.pathname.startsWith("/api/foto/")) {
    event.respondWith(cacheFirst(PHOTOS, request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
  // Diğerleri (API, PDF, sayfa geçiş verisi) doğrudan internetten
});

/** Ana sayfa, tarla ve reçete ekranlarını arka planda önbelleğe alır */
self.addEventListener("message", (event) => {
  if (event.data?.type !== "hazirla") return;
  const urls = event.data.urls || [];
  event.waitUntil(
    (async () => {
      let i = 0;
      const worker = async () => {
        while (i < urls.length) {
          const u = urls[i++];
          try {
            const res = await fetch(u, { credentials: "same-origin" });
            if (res.ok) await savePage(new URL(u, self.location.origin).pathname, res);
          } catch {}
        }
      };
      await Promise.all([worker(), worker()]);
    })()
  );
});
