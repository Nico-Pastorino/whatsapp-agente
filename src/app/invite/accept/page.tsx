"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

interface InvitationPayload {
  id: string;
  business_id: string;
  business_name: string;
  email: string;
  role: "admin" | "agent";
  status: InvitationStatus;
  expires_at: number | null;
}

interface SessionPayload {
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
}

function formatDate(value: number | null): string {
  if (!value) return "Sin fecha";
  return new Date(value * 1000).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function InviteAcceptPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token")?.trim() ?? "";
  const [invitation, setInvitation] = useState<InvitationPayload | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const inviteEmail = invitation?.email ?? "";

  async function loadInvitation() {
    if (!token) {
      throw new Error("Invitación inválida.");
    }
    const res = await fetch(`/api/invite/resolve?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      invitation?: InvitationPayload;
    };
    if (!res.ok || !payload.invitation) {
      throw new Error(payload.error ?? "No se pudo validar la invitación.");
    }
    setInvitation(payload.invitation);
    setLoginEmail(payload.invitation.email);
  }

  async function loadSession() {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) {
      setSession(null);
      return null;
    }
    const payload = (await res.json()) as SessionPayload;
    setSession(payload);
    return payload;
  }

  async function acceptInvitation() {
    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      businessId?: string;
    };
    if (!res.ok) {
      throw new Error(payload.error ?? "No se pudo aceptar la invitación.");
    }
    setSuccess("Invitación aceptada. Redirigiendo al dashboard…");
    router.push("/app");
    router.refresh();
  }

  useEffect(() => {
    Promise.all([loadInvitation(), loadSession()])
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "No se pudo cargar la invitación.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const sessionMatchesInvite = useMemo(() => {
    if (!session?.user.email || !inviteEmail) return false;
    return session.user.email.trim().toLowerCase() === inviteEmail.trim().toLowerCase();
  }, [session?.user.email, inviteEmail]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo iniciar sesión.");
      }
      const currentSession = await loadSession();
      if (
        currentSession?.user.email?.trim().toLowerCase() !==
        inviteEmail.trim().toLowerCase()
      ) {
        throw new Error("Esta invitación fue enviada a otro email.");
      }
      await acceptInvitation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          fullName: signupName,
          password: signupPassword,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "No se pudo crear la cuenta.");
      }
      await loadSession();
      await acceptInvitation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptClick() {
    setBusy(true);
    setError(null);
    try {
      await acceptInvitation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aceptar la invitación.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-500" />
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error ?? "No se pudo cargar la invitación."}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
            Invitación
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900">
            Sumate al equipo de {invitation.business_name}
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            Email invitado: <strong>{invitation.email}</strong>
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
              Rol: {invitation.role === "admin" ? "Admin" : "Agent"}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
              Estado: {invitation.status}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700">
              Vence: {formatDate(invitation.expires_at)}
            </span>
          </div>
        </div>

        {(error || success) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error ?? success}
          </div>
        )}

        {session ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              Sesión actual: <strong>{session.user.email}</strong>
            </p>
            {sessionMatchesInvite ? (
              <button
                type="button"
                onClick={handleAcceptClick}
                disabled={busy || invitation.status !== "pending"}
                className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                {busy ? "Aceptando..." : "Aceptar invitación"}
              </button>
            ) : (
              <p className="mt-4 text-sm text-red-600">
                Esta invitación fue enviada a otro email.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex gap-2 rounded-2xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
                  mode === "login" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${
                  mode === "signup" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                Crear cuenta
              </button>
            </div>

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="mt-5 space-y-4">
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="submit"
                  disabled={busy || !loginEmail || !loginPassword}
                  className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {busy ? "Ingresando..." : "Iniciar sesión y aceptar"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="mt-5 space-y-4">
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Nombre completo"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <input
                  type="email"
                  value={inviteEmail}
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-500"
                />
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="submit"
                  disabled={busy || !signupName || !signupPassword}
                  className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {busy ? "Creando cuenta..." : "Crear cuenta y aceptar"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
