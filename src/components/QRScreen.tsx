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
  "Tocá Configuración → Dispositivos",
  'Tocá "Vincular dispositivo"',
  "Apuntá la cámara a este código",
];

export default function QRScreen({ onConnected }: Props) {
  const [data, setData] = useState<StatusData>({ status: "disconnected" });
  const [firstCheckAt] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(poll, 2000);
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

  return (
    <div style={{ flex: 1, overflow: "auto", background: "var(--bg)" }}>
      <div className="page-header">
        <div>
          <div className="page-sub">06 · WhatsApp + atendé</div>
          <h1 className="page-title">Conectar</h1>
        </div>
      </div>

      <div style={{ padding: "8px 20px 100px", textAlign: "center" }}>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", margin: "0 auto 20px", maxWidth: 280 }}>
          Escaneá este código desde WhatsApp en tu celular para vincular tu asistente.
        </p>

        {/* QR card */}
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
              <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
              <p className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Conectando...</p>
            </div>
          ) : (
            <div style={{ width: 220, height: 220, borderRadius: 14, background: "var(--surface-2)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
              {showBotOfflineHint ? (
                <div style={{ padding: "0 16px" }}>
                  <p style={{ fontSize: 12, color: "#c0392b", fontWeight: 500, marginBottom: 4 }}>Worker offline</p>
                  <p style={{ fontSize: 11, color: "var(--muted)" }}>
                    Ejecutá{" "}
                    <code style={{ fontFamily: "var(--font-mono)", background: "var(--surface)", padding: "1px 5px", borderRadius: 4 }}>
                      npm run start:worker
                    </code>
                  </p>
                </div>
              ) : (
                <p className="mono" style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>Esperando...</p>
              )}
            </div>
          )}
        </div>

        {data.qrPng && (
          <div className="mono" style={{ fontSize: 11, color: "var(--muted)", marginBottom: 20 }}>
            escanear antes de que expire
          </div>
        )}

        {/* How-to steps */}
        <div className="atd-card" style={{ padding: 16, textAlign: "left" }}>
          <div className="page-sub" style={{ marginBottom: 10 }}>cómo escanear</div>
          {HOW_TO.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 13, color: "var(--ink-2)", borderTop: i ? "1px dashed var(--hairline-2)" : "none" }}>
              <span className="mono" style={{ color: "var(--accent)", flexShrink: 0 }}>0{i + 1}</span>
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
