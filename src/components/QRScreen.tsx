"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface Props {
  onConnected: (phone: string) => void;
}

type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

interface StatusData {
  status: ConnectionStatus;
  qrPng?: string;
  phone?: string;
  updatedAt?: number;
  workerOnline?: boolean;
  pairingCode?: string | null;
  pairingPhone?: string | null;
}

const HOW_TO = [
  "Abrí WhatsApp en tu celular",
  "Tocá Configuración → Dispositivos vinculados",
  'Tocá "Vincular un dispositivo"',
  "Apuntá la cámara a este código",
];

export default function QRScreen({ onConnected }: Props) {
  const [data, setData] = useState<StatusData>({ status: "disconnected" });
  const [firstCheckAt] = useState(() => Date.now());
  const [isMobile, setIsMobile] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showQrAnyway, setShowQrAnyway] = useState(false);
  const [copied, setCopied] = useState(false);
  // Vinculación por código (alternativa al QR — ideal desde el mismo celular)
  const [method, setMethod] = useState<"qr" | "code">("qr");
  const [phoneInput, setPhoneInput] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Detectar pantallas chicas (celular). Reacciona a rotación / cambios de tamaño.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setMethod("code");
    };
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const tick = () => { if (!document.hidden) poll(); };
    const interval = setInterval(tick, 3000);
    poll();
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function poll() {
    try {
      const res = await fetch("/api/connection/status");
      if (!res.ok) return;
      const json: StatusData = await res.json();
      setData(json);
      if (json.status === "connected" && json.phone) {
        onConnected(json.phone);
      }
    } catch {}
  }

  const elapsedSinceStart = (Date.now() - firstCheckAt) / 1000;
  const showBotOfflineHint =
    data.workerOnline === false ||
    (data.status === "disconnected" && !data.qrPng && elapsedSinceStart > 10);

  // El QR de WhatsApp expira cada ~60s. Si updatedAt tiene más de 55s, avisamos.
  const qrIsStale =
    !!data.qrPng &&
    !!data.updatedAt &&
    (Date.now() / 1000 - data.updatedAt) > 55;

  const connectionUrl =
    typeof window !== "undefined" ? window.location.href : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(connectionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  function shareViaWhatsApp() {
    const msg = `Abrí este link en una computadora para conectar WhatsApp a tu asistente de Atendé:\n${connectionUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }

  async function requestCode() {
    setRequestingCode(true);
    setCodeError(null);
    try {
      const res = await fetch("/api/connection/pairing-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setCodeRequested(true);
      } else {
        setCodeError(json.error ?? "No pudimos generar el código. Intentá de nuevo.");
      }
    } catch {
      setCodeError("Error de conexión. Intentá de nuevo.");
    } finally {
      setRequestingCode(false);
    }
  }

  // Código formateado XXXX-XXXX para leer fácil.
  const formattedPairingCode = data.pairingCode
    ? `${data.pairingCode.slice(0, 4)}-${data.pairingCode.slice(4)}`
    : null;

  // ── Selector de método: QR vs código ────────────────────────────────────────
  const methodToggle = (
    <div className="atd-seg" style={{ width: "100%", maxWidth: 360, margin: "0 auto 14px" }}>
      <button className={method === "qr" ? "on" : ""} onClick={() => setMethod("qr")} style={{ flex: 1, justifyContent: "center" }}>
        Escanear QR
      </button>
      <button className={method === "code" ? "on" : ""} onClick={() => setMethod("code")} style={{ flex: 1, justifyContent: "center" }}>
        Con código
      </button>
    </div>
  );

  // ── Bloque de vinculación por código ────────────────────────────────────────
  const codeCard = (
    <div className="atd-card" style={{ padding: 20, maxWidth: 380, margin: "0 auto", textAlign: "left" }}>
      {formattedPairingCode ? (
        <>
          <p className="page-sub" style={{ marginBottom: 8 }}>tu código de vinculación</p>
          <p className="mono" style={{ fontSize: 32, fontWeight: 700, letterSpacing: "0.12em", color: "var(--ink)", textAlign: "center", margin: "8px 0 14px", userSelect: "all" }}>
            {formattedPairingCode}
          </p>
          <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
            En el WhatsApp de tu negocio:
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Configuración → Dispositivos vinculados",
                "Tocá “Vincular un dispositivo”",
                "Elegí “Vincular con el número de teléfono”",
                "Escribí este código",
              ].map((step, i) => (
                <span key={i} style={{ display: "flex", gap: 8 }}>
                  <span className="mono" style={{ color: "var(--accent)", flexShrink: 0 }}>0{i + 1}</span> {step}
                </span>
              ))}
            </div>
          </div>
          <p className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 14, textAlign: "center" }}>
            esperando que ingreses el código…
          </p>
        </>
      ) : codeRequested ? (
        <div style={{ textAlign: "center", padding: "10px 0" }}>
          <div className="atd-spinner" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>Generando tu código…</p>
          <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0 }}>
            Puede tardar hasta un minuto. Quedate en esta pantalla.
          </p>
        </div>
      ) : (
        <>
          <p className="page-sub" style={{ marginBottom: 6 }}>vincular con tu número</p>
          <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 12px", lineHeight: 1.55 }}>
            Ideal si estás desde el mismo celular: te damos un código y lo escribís en WhatsApp. Sin escanear nada.
          </p>
          <input
            type="tel"
            inputMode="numeric"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="Ej: 5491155551234"
            className="atd-input"
            style={{ marginBottom: 6 }}
          />
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 12px" }}>
            Con código de país, sin 0 ni 15. Argentina: 54 9 + área + número.
          </p>
          <button
            onClick={requestCode}
            disabled={requestingCode || phoneInput.replace(/[^\d]/g, "").length < 10}
            className="atd-btn primary"
            style={{ width: "100%", opacity: requestingCode || phoneInput.replace(/[^\d]/g, "").length < 10 ? 0.5 : 1 }}
          >
            {requestingCode ? "Pidiendo código…" : "Generar código"}
          </button>
          {codeError && <p style={{ fontSize: 12.5, color: "var(--danger-ink)", marginTop: 10 }}>{codeError}</p>}
        </>
      )}
    </div>
  );

  // ── Bloque QR reutilizable (idéntico al original) ──────────────────────────
  const qrCard = (
    <div className="atd-card" style={{ padding: 20, display: "inline-block", marginBottom: 16 }}>
      {data.qrPng ? (
        <Image
          src={data.qrPng}
          alt="QR de WhatsApp"
          width={220}
          height={220}
          unoptimized
          style={{ borderRadius: 14, display: "block" }}
        />
      ) : data.status === "connecting" ? (
        <div style={{ width: 220, height: 220, borderRadius: 14, background: "var(--surface-2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div className="atd-spinner lg" />
          <p className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Conectando...</p>
        </div>
      ) : (
        <div style={{ width: 220, height: 220, borderRadius: 14, background: "var(--surface-2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div className="atd-spinner lg" />
          {showBotOfflineHint ? (
            <div style={{ padding: "0 16px", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "var(--danger)", fontWeight: 500, marginBottom: 4 }}>Sin conexión con el asistente</p>
              <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
                El asistente está arrancando, puede tardar 1–2 minutos. Reintentamos solos. Si el código no aparece, tocá “Actualizar estado” o contactá a soporte.
              </p>
            </div>
          ) : (
            <div style={{ padding: "0 16px", textAlign: "center" }}>
              <p className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>Generando QR…</p>
              <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
                Estamos creando tu código. Suele tardar unos segundos.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const howToCard = (
    <div className="atd-card" style={{ padding: 16, textAlign: "left" }}>
      <div className="page-sub" style={{ marginBottom: 10 }}>cómo escanear</div>
      {HOW_TO.map((step, i) => (
        <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 13, color: "var(--ink-2)", borderTop: i ? "1px dashed var(--hairline-2)" : "none" }}>
          <span className="mono" style={{ color: "var(--accent)", flexShrink: 0 }}>0{i + 1}</span>
          {step}
        </div>
      ))}
    </div>
  );

  const statusPill = (
    <div className="mono" style={{ fontSize: 11, color: showBotOfflineHint && !data.qrPng ? "var(--danger)" : "var(--muted)", marginTop: 4 }}>
      {data.status === "connecting"
        ? "conectando…"
        : data.qrPng
        ? qrIsStale ? "⏳ actualizando código…" : "esperando que escanees el código"
        : showBotOfflineHint
        ? "sin conexión — reintentando…"
        : "generando QR…"}
    </div>
  );

  // ── MOBILE: experiencia adaptada ───────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
        <div className="page-header" style={{ padding: "14px 22px 18px" }}>
          <div>
            <div className="page-sub">conectar whatsapp</div>
            <h1 className="page-title">Conectar</h1>
          </div>
        </div>

        <div style={{ padding: "4px 20px 110px", display: "flex", flexDirection: "column", gap: 12 }}>
          {methodToggle}

          {method === "code" && (
            <>
              {codeCard}
              {/* Estado de conexión compartido */}
              <div className="atd-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, background: "var(--surface)" }}>
                <span className={`atd-dot ${data.status === "connecting" ? "" : "live"}`} style={{ background: data.pairingCode || data.status === "connecting" ? "var(--green)" : "var(--muted)" }} />
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                  {data.status === "connecting"
                    ? "Conectando con WhatsApp…"
                    : data.pairingCode
                    ? "Código listo — ingresalo en WhatsApp"
                    : showBotOfflineHint
                    ? "Preparando el asistente (1–2 min)…"
                    : "Listo para generar tu código"}
                </span>
              </div>
            </>
          )}

          {method === "qr" && (
          <>
          {/* Acciones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="atd-card" style={{ padding: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>
                Usá QR si tenés otro dispositivo
              </h2>
              <p style={{ fontSize: 12.5, color: "var(--ink-3)", margin: 0, lineHeight: 1.45 }}>
                Desde este mismo celular es más simple vincular con código.
              </p>
            </div>
            <button onClick={copyLink} className="atd-btn primary lg" style={{ width: "100%" }}>
              {copied ? "✓ Link copiado" : "Copiar link de conexión"}
            </button>
            <button onClick={shareViaWhatsApp} className="atd-btn ghost lg" style={{ width: "100%" }}>
              Enviar link por WhatsApp
            </button>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => poll()} className="atd-btn ghost" style={{ flex: 1 }}>
                Actualizar estado
              </button>
              <button onClick={() => setShowHowTo((v) => !v)} className="atd-btn ghost" style={{ flex: 1 }}>
                {showHowTo ? "Ocultar pasos" : "Ver instrucciones"}
              </button>
            </div>
          </div>

          {/* Estado de conexión */}
          <div className="atd-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, background: "var(--surface)" }}>
            <span className={`atd-dot ${data.status === "connecting" ? "" : "live"}`} style={{ background: data.qrPng || data.status === "connecting" ? "var(--green)" : "var(--muted)" }} />
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
              {data.status === "connecting"
                ? "Conectando con WhatsApp…"
                : data.qrPng
                ? "Código listo para escanear desde otra pantalla"
                : showBotOfflineHint
                ? "Preparando el asistente (1–2 min)…"
                : "Esperando el código de conexión…"}
            </span>
          </div>

          {showHowTo && howToCard}

          {/* Ver QR igualmente */}
          <div>
            <button
              onClick={() => setShowQrAnyway((v) => !v)}
              className="atd-btn ghost sm"
              style={{ width: "100%" }}
            >
              {showQrAnyway ? "Ocultar el código QR" : "Ver el código QR igualmente"}
            </button>

            {showQrAnyway && (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <div style={{ padding: "10px 14px", borderRadius: 12, background: "var(--human-tint)", color: "var(--human)", fontSize: 12.5, lineHeight: 1.5, marginBottom: 12, textAlign: "left" }}>
                  ⚠️ Necesitás escanear este código desde el teléfono donde tenés WhatsApp —
                  no desde este mismo. ¿Estás en ese teléfono? Usá la pestaña “Con código”.
                </div>
                {qrCard}
                {statusPill}
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    );
  }

  // ── DESKTOP / TABLET: experiencia original con QR ──────────────────────────
  return (
    <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
      <div className="page-header" style={{ padding: "14px 22px 18px" }}>
        <div>
          <div className="page-sub">conectar whatsapp</div>
          <h1 className="page-title">Conectar</h1>
        </div>
      </div>

      <div style={{ padding: "4px 20px 100px" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          {methodToggle}

          {method === "qr" ? (
            <>
              {qrCard}

              <div className="mono" style={{ fontSize: 11, color: data.qrPng ? (qrIsStale ? "var(--danger)" : "var(--muted)") : showBotOfflineHint ? "var(--danger)" : "var(--muted)", marginBottom: 16 }}>
                {data.qrPng
                  ? qrIsStale ? "⏳ actualizando código..." : "escanear antes de que expire"
                  : data.status === "connecting"
                  ? "conectando…"
                  : showBotOfflineHint
                  ? "sin conexión — reintentando…"
                  : "generando QR…"}
              </div>

              <div style={{ width: "100%", marginBottom: 16 }}>{howToCard}</div>

              <button onClick={() => poll()} className="atd-btn ghost sm" style={{ minWidth: 180 }}>
                Actualizar estado
              </button>
            </>
          ) : (
            <div style={{ width: "100%" }}>{codeCard}</div>
          )}
        </div>
      </div>
    </div>
  );
}
