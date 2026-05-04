"use client";

import { useRouter } from "next/navigation";

interface Props {
  phone: string | null;
  activeView: "conversations" | "business" | "plan" | "connect";
  onDisconnect: () => void;
}

export default function DashboardHeader({
  phone,
  activeView,
  onDisconnect,
}: Props) {
  const router = useRouter();

  const navItems: Array<{
    key: Props["activeView"];
    label: string;
    href: string;
  }> = [
    { key: "conversations", label: "Conversaciones", href: "/app/conversations" },
    { key: "business", label: "Mi Negocio", href: "/app/business" },
    { key: "plan", label: "Mi Plan", href: "/app/plan" },
    { key: "connect", label: "Conectar", href: "/app/connect" },
  ];

  async function handleDisconnect() {
    if (
      !confirm(
        "¿Desconectar el número? Se borrará la sesión de WhatsApp y tendrás que escanear el QR de nuevo."
      )
    )
      return;
    const res = await fetch("/api/connection/disconnect", { method: "POST" });
    if (!res.ok) {
      alert("No se pudo solicitar la desconexión de WhatsApp.");
      return;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
      try {
        const statusRes = await fetch("/api/connection/status", { cache: "no-store" });
        if (statusRes.ok) {
          const status = (await statusRes.json()) as { status?: string };
          if (status.status === "disconnected" || status.status === "qr") {
            onDisconnect();
            return;
          }
        }
      } catch {}

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    alert("La desconexión sigue en proceso. Espera unos segundos y vuelve a intentar.");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-gray-800">Agente WhatsApp</span>
          <span className="text-sm text-gray-400">{phone ?? "Sin número conectado"}</span>
        </div>

        <nav className="flex items-center gap-1 ml-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => router.push(item.href)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeView === item.key
                  ? item.key === "business"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-100 text-gray-800"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleDisconnect}
          disabled={!phone}
          className="text-sm text-gray-500 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
        >
          Desconectar WA
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
