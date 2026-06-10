/* Service worker de Atendé.
 * Rol actual: instalabilidad PWA + handlers de notificaciones push (listos
 * para cuando se activen las claves VAPID — ver docs/MOBILE_ROADMAP.md).
 * SIN cache agresivo: el dashboard es dinámico y un cache viejo es peor
 * que no tener cache. Solo fallback offline para navegaciones.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Navegaciones: red primero; si no hay conexión, aviso simple.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          `<!doctype html><html lang="es"><meta charset="utf-8">
           <meta name="viewport" content="width=device-width,initial-scale=1">
           <title>Sin conexión — Atendé</title>
           <body style="font-family:system-ui;background:#f3f0ea;color:#1a1c1a;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px">
           <div><div style="font-size:40px;margin-bottom:12px">📡</div>
           <h1 style="font-size:20px;margin:0 0 8px">Sin conexión</h1>
           <p style="font-size:14px;color:#555;margin:0 0 20px">Revisá tu internet y volvé a intentar.</p>
           <button onclick="location.reload()" style="padding:12px 24px;border-radius:12px;border:none;background:#0d3b2e;color:#fff;font-size:14px;font-weight:600">Reintentar</button>
           </div></body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        )
    )
  );
});

// ── Push (preparado; se activa con Web Push + VAPID) ──────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Atendé", body: event.data.text() };
  }
  const title = payload.title || "Nuevo mensaje";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag || "atende-message",
      data: { url: payload.url || "/app/conversations" },
    })
  );
});

// Al tocar la notificación: enfocar la app y abrir la conversación correcta.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app/conversations";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/app/") && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
