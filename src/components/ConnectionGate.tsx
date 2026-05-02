"use client";

import { useEffect, useState } from "react";
import QRScreen from "./QRScreen";
import DashboardHeader from "./DashboardHeader";
import ConversationList from "./ConversationList";
import ConversationPanel from "./ConversationPanel";
import BusinessConfig from "./BusinessConfig";

interface Conversation {
  id: string;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview: string | null;
}

type ActiveView = "conversations" | "business";

export default function ConnectionGate() {
  const [phone, setPhone] = useState<string | null>(null);
  const [initialChecked, setInitialChecked] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("conversations");

  useEffect(() => {
    async function checkInitial() {
      try {
        const res = await fetch("/api/connection/status");
        const data = await res.json();
        if (data.status === "connected" && data.phone) {
          setPhone(data.phone);
        }
      } catch {}
      setInitialChecked(true);
    }
    checkInitial();
  }, []);

  useEffect(() => {
    if (!phone) return;
    loadConversations();
    const interval = setInterval(loadConversations, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  async function loadConversations() {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data: Conversation[] = await res.json();
        setConversations(data);
      }
    } catch {}
  }

  function handleConnected(connectedPhone: string) {
    setPhone(connectedPhone);
  }

  function handleDisconnect() {
    setPhone(null);
    setSelectedId(null);
    setConversations([]);
    setActiveView("conversations");
  }

  function handleModeChange(mode: "AI" | "HUMAN") {
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, mode } : c))
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

  if (!phone) {
    return <QRScreen onConnected={handleConnected} />;
  }

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <DashboardHeader
        phone={phone}
        activeView={activeView}
        onViewChange={setActiveView}
        onDisconnect={handleDisconnect}
      />

      {activeView === "business" ? (
        <BusinessConfig />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Lista de conversaciones */}
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

          {/* Panel principal */}
          <main className="flex-1 overflow-hidden">
            {selectedConv ? (
              <ConversationPanel
                key={selectedConv.id}
                conversation={selectedConv}
                onModeChange={handleModeChange}
                onDelete={handleDeleteConversation}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Selecciona una conversación
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
