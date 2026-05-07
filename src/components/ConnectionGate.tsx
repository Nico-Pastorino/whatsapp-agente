"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRScreen from "./QRScreen";
import DashboardHeader from "./DashboardHeader";
import ConversationList from "./ConversationList";
import ConversationPanel from "./ConversationPanel";
import BusinessConfig from "./BusinessConfig";
import ItemCatalog from "./ItemCatalog";
import PlanOverview from "./PlanOverview";
import TeamManagement from "./TeamManagement";

interface Conversation {
  id: string;
  contact_id: string;
  phone: string;
  phone_number: string | null;
  primary_jid: string | null;
  name: string | null;
  mode: "AI" | "HUMAN";
  outgoing_jid: string | null;
  safe_outgoing_jid: string | null;
  has_safe_outgoing_jid: boolean;
  needs_phone_mapping: boolean;
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface ConversationUpdate {
  id: string;
  phone: string;
  phone_number: string | null;
  primary_jid: string | null;
  outgoing_jid: string | null;
  safe_outgoing_jid: string | null;
  has_safe_outgoing_jid: boolean;
  needs_phone_mapping: boolean;
}

type DashboardView = "conversations" | "business" | "catalog" | "team" | "plan" | "connect";
type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

function pickPreferredConversation(a: Conversation, b: Conversation): Conversation {
  const aPhone = a.phone.endsWith("@s.whatsapp.net") ? 1 : 0;
  const bPhone = b.phone.endsWith("@s.whatsapp.net") ? 1 : 0;
  if (bPhone !== aPhone) return bPhone > aPhone ? b : a;

  if (a.mode !== b.mode) {
    if (a.mode === "HUMAN") return a;
    if (b.mode === "HUMAN") return b;
  }

  const aTime = a.last_message_at ?? 0;
  const bTime = b.last_message_at ?? 0;
  return bTime > aTime ? b : a;
}

function dedupeConversationsByContact(conversations: Conversation[]): Conversation[] {
  const grouped = new Map<string, Conversation>();
  for (const conversation of conversations) {
    const existing = grouped.get(conversation.contact_id);
    if (!existing) {
      grouped.set(conversation.contact_id, conversation);
      continue;
    }
    grouped.set(conversation.contact_id, pickPreferredConversation(existing, conversation));
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const aTime = a.last_message_at ?? 0;
    const bTime = b.last_message_at ?? 0;
    return bTime - aTime;
  });
}

function OfflineHint() {
  return (
    <div className="flex h-full items-center justify-center bg-gray-50 p-6">
      <div className="max-w-lg rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
          WhatsApp pendiente
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-gray-900">
          Todavía no conectaste el número del negocio
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-500">
          Podés configurar tu negocio y revisar el plan, pero para operar el inbox
          primero necesitás vincular WhatsApp desde la sección de conexión.
        </p>
        <Link
          href="/app/connect"
          className="mt-6 inline-flex rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          Ir a conectar WhatsApp
        </Link>
      </div>
    </div>
  );
}

interface Props {
  currentView: DashboardView;
}

export default function ConnectionGate({ currentView }: Props) {
  const [phone, setPhone] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [initialChecked, setInitialChecked] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(loadConnectionStatus, 2000);
    loadConnectionStatus().finally(() => setInitialChecked(true));
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 2000);
    return () => clearInterval(interval);
  }, []);

  async function loadConnectionStatus() {
    try {
      const res = await fetch("/api/connection/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { status?: ConnectionStatus; phone?: string | null };
      setConnectionStatus(data.status ?? "disconnected");
      setPhone(data.status === "connected" ? data.phone ?? null : null);
    } catch {}
  }

  async function loadConversations() {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data: Conversation[] = await res.json();
      const deduped = dedupeConversationsByContact(data);
      setConversations(deduped);
      setSelectedId((current) =>
        current && deduped.some((conversation) => conversation.id === current)
          ? current
          : deduped[0]?.id ?? null
      );
    } catch {}
  }

  function handleConnected(connectedPhone: string) {
    setPhone(connectedPhone);
    setConnectionStatus("connected");
  }

  function handleDisconnect() {
    setPhone(null);
    setConnectionStatus("disconnected");
  }

  function handleModeChange(mode: "AI" | "HUMAN") {
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, mode } : c))
    );
  }

  function handleConversationUpdate(next: ConversationUpdate) {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === next.id ? { ...conversation, ...next } : conversation
      )
    );
  }

  function handleDeleteConversation() {
    setConversations((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  }

  if (!initialChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  let content: React.ReactNode = null;
  if (currentView === "business") {
    content = <BusinessConfig />;
  } else if (currentView === "catalog") {
    content = <ItemCatalog />;
  } else if (currentView === "team") {
    content = <TeamManagement />;
  } else if (currentView === "plan") {
    content = <PlanOverview />;
  } else if (currentView === "connect") {
    content = phone ? (
      <div className="flex h-full items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
            WhatsApp conectado
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-gray-900">{phone}</h2>
          <p className="mt-3 text-sm leading-6 text-gray-500">
            El worker está operativo y este negocio ya puede responder desde el dashboard.
          </p>
          <div className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Estado actual: {connectionStatus}
          </div>
        </div>
      </div>
    ) : (
      <QRScreen onConnected={handleConnected} />
    );
  } else if (conversations.length === 0 && !phone) {
    content = <OfflineHint />;
  } else {
    content = (
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Conversaciones
            </h2>
          </div>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        <main className="flex-1 overflow-hidden">
          {selectedConv ? (
            <ConversationPanel
              key={selectedConv.id}
              conversation={selectedConv}
              onModeChange={handleModeChange}
              onConversationUpdate={handleConversationUpdate}
              onDelete={handleDeleteConversation}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gray-50">
              Selecciona una conversación
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <DashboardHeader
        phone={phone}
        activeView={currentView}
        onDisconnect={handleDisconnect}
      />
      {content}
    </div>
  );
}
