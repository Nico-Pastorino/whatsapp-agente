"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRScreen from "./QRScreen";
import DashboardSidebar from "./DashboardSidebar";
import ConversationList from "./ConversationList";
import ConversationPanel from "./ConversationPanel";
import BusinessConfig from "./BusinessConfig";
import ItemCatalog from "./ItemCatalog";
import PlanOverview from "./PlanOverview";
import StatsScreen from "./StatsScreen";
import TeamManagement from "./TeamManagement";
import HomeScreen from "./HomeScreen";
import MoreScreen from "./MoreScreen";
import MobileTabBar from "./MobileTabBar";
import { Spark } from "./atende/Icons";

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
  needs_attention: boolean;
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
  needs_attention: boolean;
}

type DashboardView =
  | "conversations"
  | "business"
  | "catalog"
  | "home"
  | "more"
  | "plan"
  | "team"
  | "connect"
  | "stats";

type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

interface TrialPlanState {
  status: "trial" | "active" | "past_due" | "canceled" | "pending_payment";
  can_use_app: boolean;
  days_left_trial: number | null;
  plan_name: string;
}

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

// Empty state for conversations
function EmptyChats() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center", background: "var(--bg)" }}>
      <div style={{ width: 88, height: 88, borderRadius: 28, background: "var(--green-tint)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, position: "relative" }}>
        <Spark size={36} style={{ color: "var(--green-ink)" }} />
        <span style={{ position: "absolute", top: -8, right: -8, width: 28, height: 28, borderRadius: 999, background: "var(--accent)", color: "var(--on-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600 }}>+</span>
      </div>
      <h3 className="serif" style={{ fontSize: 26, margin: "0 0 8px", lineHeight: 1 }}>
        Todavía no <span className="italic">hay chats.</span>
      </h3>
      <p style={{ fontSize: 14, color: "var(--ink-3)", maxWidth: 260, margin: "0 auto 20px" }}>
        Conectá WhatsApp para que tu asistente empiece a recibir conversaciones.
      </p>
      <Link href="/app/connect" className="atd-btn primary">
        Conectar WhatsApp
      </Link>
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
  const [trialPlan, setTrialPlan] = useState<TrialPlanState | null>(null);

  useEffect(() => {
    const interval = setInterval(loadConnectionStatus, currentView === "connect" ? 3000 : 15000);
    loadConnectionStatus().finally(() => setInitialChecked(true));
    return () => clearInterval(interval);
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "conversations") return;
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [currentView]);

  useEffect(() => {
    if (currentView === "plan") return;
    loadPlan();
    const interval = setInterval(loadPlan, 60_000);
    return () => clearInterval(interval);
  }, [currentView]);

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
        current && deduped.some((c) => c.id === current)
          ? current
          : deduped[0]?.id ?? null
      );
    } catch {}
  }

  async function loadPlan() {
    try {
      const res = await fetch("/api/plan", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as TrialPlanState;
      setTrialPlan(data);
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
      prev.map((c) => (c.id === next.id ? { ...c, ...next } : c))
    );
  }

  function handleDeleteConversation() {
    setConversations((prev) => prev.filter((c) => c.id !== selectedId));
    setSelectedId(null);
  }

  if (!initialChecked) {
    return (
      <div style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  // Determine content for the current view
  let content: React.ReactNode = null;
  let mobileContent: React.ReactNode = null;

  if (currentView === "home") {
    content = <HomeScreen />;
    mobileContent = content;
  } else if (currentView === "more") {
    content = <MoreScreen />;
    mobileContent = content;
  } else if (currentView === "business") {
    content = <BusinessConfig />;
    mobileContent = content;
  } else if (currentView === "catalog") {
    content = <ItemCatalog />;
    mobileContent = content;
  } else if (currentView === "team") {
    content = <TeamManagement />;
    mobileContent = content;
  } else if (currentView === "plan") {
    content = <PlanOverview />;
    mobileContent = content;
  } else if (currentView === "stats") {
    content = <StatsScreen />;
    mobileContent = content;
  } else if (currentView === "connect") {
    content = phone ? (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
        <div className="atd-card" style={{ padding: 28, maxWidth: 360, width: "100%", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <span className="atd-dot live" style={{ width: 12, height: 12 }} />
          </div>
          <p className="page-sub" style={{ textAlign: "center" }}>WhatsApp conectado</p>
          <p className="mono" style={{ fontSize: 18, fontWeight: 500, margin: "6px 0 8px" }}>{phone}</p>
          <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "0 0 16px" }}>
            El worker está operativo y este negocio ya puede responder desde el dashboard.
          </p>
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--green-tint)", color: "var(--green-ink)", fontSize: 12 }}>
            Estado: {connectionStatus}
          </div>
        </div>
      </div>
    ) : (
      <QRScreen onConnected={handleConnected} />
    );
    mobileContent = content;
  } else {
    // conversations view
    if (conversations.length === 0 && !phone) {
      content = <EmptyChats />;
      mobileContent = content;
    } else {
      // Desktop: 2-column layout
      content = (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <aside style={{ width: 288, background: "var(--surface)", borderRight: "1px solid var(--hairline)", display: "flex", flexDirection: "column" }}>
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </aside>
          <main style={{ flex: 1, overflow: "hidden" }}>
            {selectedConv ? (
              <ConversationPanel
                key={selectedConv.id}
                conversation={selectedConv}
                onModeChange={handleModeChange}
                onConversationUpdate={handleConversationUpdate}
                onDelete={handleDeleteConversation}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)", fontSize: 14, background: "var(--bg)" }}>
                Seleccioná una conversación
              </div>
            )}
          </main>
        </div>
      );
      // Mobile: show list OR detail
      mobileContent = selectedConv ? (
        <ConversationPanel
          key={selectedConv.id}
          conversation={selectedConv}
          onModeChange={handleModeChange}
          onConversationUpdate={handleConversationUpdate}
          onDelete={() => { setSelectedId(null); handleDeleteConversation(); }}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      );
    }
  }

  const showTrialBanner =
    currentView !== "plan" &&
    trialPlan?.status === "trial" &&
    trialPlan.can_use_app;

  const trialBanner = showTrialBanner ? (
    <div style={{ padding: "10px 16px", background: "rgba(31,107,74,0.09)", borderBottom: "1px solid rgba(31,107,74,0.16)", color: "var(--green-ink)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13 }}>
        Estás usando tu prueba gratuita de 14 días. Te quedan {trialPlan.days_left_trial ?? 0} días.
      </span>
      <Link href="/app/plan" className="atd-btn green sm">
        Ver planes
      </Link>
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", height: "100svh", background: "var(--bg)" }}>
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:flex" style={{ height: "100%", flexShrink: 0 }}>
        <DashboardSidebar
          activeView={currentView}
          phone={phone}
          onDisconnect={handleDisconnect}
        />
      </div>

      {/* Right side: content + mobile tab bar */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0 }}>
        {trialBanner}
        {/* Desktop content */}
        <div className="hidden md:flex" style={{ flex: 1, overflow: "hidden" }}>
          {content}
        </div>
        {/* Mobile content */}
        <div className="flex md:hidden" style={{ flex: 1, overflow: "hidden", flexDirection: "column" }}>
          {mobileContent}
        </div>

        {/* Mobile tab bar */}
        <MobileTabBar activeView={currentView} />
      </div>
    </div>
  );
}
