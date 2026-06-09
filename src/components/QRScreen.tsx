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

  // Detectar pantallas chicas (celular). Reacciona a rotación / cambios de tamaño.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
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
            <div style={{ padding: "0 16px" }}>
              <p style={{ fontSize: 12, color: "#c0392b", fontWeight: 500, marginBottom: 4 }}>Asistente iniciando</p>
              <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
                El asistente está arrancando, puede tardar 1–2 minutos. Si el código no aparece, contactá a soporte.
              </p>
            </div>
          ) : (
            <p className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Esperando...</p>
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
    <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
      {data.status === "connecting"
        ? "conectando…"
        : data.qrPng
        ? qrIsStale ? "⏳ actualizando código…" : "esperando que escanees el código"
        : "esperando el código…"}
    </div>
  );

  // ── MOBILE: experiencia adaptada ───────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
        <div className="page-header">
          <div>
            <div className="page-sub">conectar whatsapp</div>
            <h1 className="page-title">Conectá tu WhatsApp</h1>
          </div>
        </div>

        <div style={{ padding: "8px 20px 110px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Explicación principal */}
          <div className="atd-card" style={{ padding: 18, display: "flex", gap: 12, alignItems: "flex-start", background: "var(--surface)" }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: "var(--green-tint)", color: "var(--green-ink)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
              📲
            </span>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px" }}>
                Conectá desde otra pantalla
              </h2>
              <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.55 }}>
                Para vincular tu WhatsApp hay que escanear un código QR. Como estás en el
                mismo teléfono, abrí este panel en una <strong>computadora u otro celular</strong> y
                escaneá el código desde WhatsApp.
              </p>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={copyLink} className="atd-btn primary lg" style={{ width: "100%" }}>
              {copied ? "✓ Link copiado" : "Copiar link de conexión"}
            </button>
            <button onClick={shareViaWhatsApp} className="atd-btn green lg" style={{ width: "100%" }}>
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
                  no desde este mismo. Por eso conviene abrirlo en otra pantalla.
                </div>
                {qrCard}
                {statusPill}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── DESKTOP / TABLET: experiencia original con QR ──────────────────────────
  return (
    <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
      <div className="page-header">
        <div>
          <div className="page-sub">conectar whatsapp</div>
          <h1 className="page-title">Conectar</h1>
        </div>
      </div>

      <div style={{ padding: "8px 20px 100px", textAlign: "center" }}>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: "0 auto 20px", maxWidth: 280 }}>
          Escaneá este código desde WhatsApp en tu celular para vincular tu asistente.
        </p>

        {qrCard}

        {data.qrPng && (
          <div className="mono" style={{ fontSize: 11, color: qrIsStale ? "#c0392b" : "var(--muted)", marginBottom: 20 }}>
            {qrIsStale ? "⏳ actualizando código..." : "escanear antes de que expire"}
          </div>
        )}

        {howToCard}
      </div>
    </div>
  );
}
