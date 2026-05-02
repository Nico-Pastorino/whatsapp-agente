"use client";

import { useEffect, useState } from "react";

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center">
        <h1 className="text-xl font-semibold text-gray-800 mb-1">
          Conectar WhatsApp
        </h1>
        <p className="text-sm text-gray-400 mb-6">
          Escanea el código QR con tu teléfono
        </p>

        {data.qrPng ? (
          <>
            <img
              src={data.qrPng}
              alt="QR de WhatsApp"
              className="mx-auto rounded-xl border border-gray-100"
              width={280}
              height={280}
            />
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-amber-600">
                {data.status === "connecting"
                  ? "Conectando..."
                  : "Esperando escaneo..."}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              WhatsApp → Dispositivos vinculados → Vincular dispositivo
            </p>
          </>
        ) : data.status === "connecting" ? (
          <div className="py-8">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-blue-600">Conectando...</p>
          </div>
        ) : (
          <div className="py-8">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-400 rounded-full animate-spin mx-auto mb-3" />
            {showBotOfflineHint ? (
              <div className="text-sm text-gray-500">
                <p className="font-medium text-red-500 mb-1">
                  El proceso bot no responde
                </p>
                <p>
                  Ejecuta{" "}
                  <code className="bg-gray-100 px-1 rounded">
                    npm run start:worker
                  </code>{" "}
                  en una terminal separada y recarga la página.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Esperando al proceso bot...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
