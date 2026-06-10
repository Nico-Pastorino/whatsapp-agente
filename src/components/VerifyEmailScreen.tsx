"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmailScreen({ email }: { email: string }) {
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice(data.alreadyVerified ? "¡Tu email ya está verificado!" : "Correo reenviado. Revisá tu casilla y el spam.");
      } else {
        setError(data.error ?? "No pudimos reenviar el correo. Intentá de nuevo.");
      }
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setResending(false);
    }
  }

  async function checkVerified() {
    setChecking(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/verification-status", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.verified) {
        router.push("/app/connect");
        router.refresh();
        return;
      }
      setError("Todavía no vemos la verificación. Abrí el link del correo y volvé a intentar.");
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div className="atd-card" style={{ maxWidth: 440, width: "100%", padding: 32, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "var(--green-tint)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 28 }}>
          ✉️
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>
          Verificá tu email
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6, margin: "0 0 6px" }}>
          Te enviamos un correo de verificación a
        </p>
        <p style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", margin: "0 0 14px", wordBreak: "break-all" }}>
          {email}
        </p>
        <p style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6, margin: "0 0 24px" }}>
          Confirmá tu email para activar tu prueba gratis y conectar tu WhatsApp.
          Mientras tanto podés explorar el panel.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={checkVerified} disabled={checking} className="atd-btn primary" style={{ width: "100%", opacity: checking ? 0.6 : 1 }}>
            {checking ? "Verificando..." : "Ya verifiqué, continuar"}
          </button>
          <button onClick={resend} disabled={resending} className="atd-btn ghost" style={{ width: "100%", opacity: resending ? 0.6 : 1 }}>
            {resending ? "Enviando..." : "Reenviar email"}
          </button>
          <button onClick={() => router.push("/app/home")} className="atd-btn ghost sm" style={{ width: "100%", color: "var(--muted)" }}>
            Ir al panel
          </button>
        </div>

        {notice && <p style={{ fontSize: 13, color: "var(--green-soft)", marginTop: 14, fontWeight: 500 }}>{notice}</p>}
        {error && <p style={{ fontSize: 13, color: "#b42318", marginTop: 14 }}>{error}</p>}
      </div>
    </div>
  );
}
