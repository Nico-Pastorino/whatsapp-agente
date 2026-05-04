"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import ModeToggle from "./ModeToggle";

interface Message {
  id: string;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

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
}

interface Props {
  conversation: Conversation;
  onModeChange: (mode: "AI" | "HUMAN") => void;
  onConversationUpdate: (conversation: {
    id: string;
    phone: string;
    phone_number: string | null;
    primary_jid: string | null;
    outgoing_jid: string | null;
    safe_outgoing_jid: string | null;
    has_safe_outgoing_jid: boolean;
    needs_phone_mapping: boolean;
  }) => void;
  onDelete: () => void;
}

export default function ConversationPanel({
  conversation,
  onModeChange,
  onConversationUpdate,
  onDelete,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"AI" | "HUMAN">(conversation.mode);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [linkingPhone, setLinkingPhone] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(conversation.mode);
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Polling cada 2s
  useEffect(() => {
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  async function loadMessages() {
    const res = await fetch(`/api/messages/${conversation.id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    }
  }

  async function handleModeChange(next: "AI" | "HUMAN") {
    setMode(next);
    onModeChange(next);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setSendError(null);
    setInput("");

    const res = await fetch(`/api/messages/${conversation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      setSendError(payload?.message ?? payload?.error ?? "No se pudo enviar el mensaje.");
      setInput(text);
      setSending(false);
      return;
    }

    await loadMessages();
    setSending(false);
  }

  async function handleLinkPhone() {
    if (!phoneNumber.trim() || linkingPhone) return;

    setLinkingPhone(true);
    setLinkError(null);
    setLinkSuccess(null);

    const res = await fetch(`/api/contacts/${conversation.contact_id}/link-phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });

    const payload = (await res.json().catch(() => null)) as
      | {
          error?: string;
          safe_outgoing_jid?: string;
          has_safe_outgoing_jid?: boolean;
          contact?: {
            phone_number?: string | null;
            primary_jid?: string | null;
          };
        }
      | null;

    if (!res.ok || !payload?.safe_outgoing_jid) {
      setLinkError(payload?.error ?? "No se pudo asociar el número.");
      setLinkingPhone(false);
      return;
    }

    const updatedConversation = {
      id: conversation.id,
      phone: payload.safe_outgoing_jid,
      phone_number: payload.contact?.phone_number ?? phoneNumber.replace(/[^\d]/g, ""),
      primary_jid: payload.contact?.primary_jid ?? payload.safe_outgoing_jid,
      outgoing_jid: payload.safe_outgoing_jid,
      safe_outgoing_jid: payload.safe_outgoing_jid,
      has_safe_outgoing_jid: Boolean(payload.has_safe_outgoing_jid),
      needs_phone_mapping: false,
    };

    onConversationUpdate(updatedConversation);
    setPhoneNumber("");
    setSendError(null);
    setLinkError(null);
    setLinkSuccess("Número asociado correctamente. Ya podés responder.");
    setLinkingPhone(false);
  }

  async function confirmDelete() {
    await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    setShowDeleteConfirm(false);
    onDelete();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header del panel */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div>
          <p className="font-semibold text-gray-800">
            {conversation.name || conversation.phone.split("@")[0]}
          </p>
          {conversation.name && (
            <p className="text-xs text-gray-400">{conversation.phone.split("@")[0]}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle
            conversationId={conversation.id}
            mode={mode}
            onChange={handleModeChange}
          />
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            Borrar
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-8">
            Sin mensajes aún
          </p>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 bg-white shrink-0">
        {conversation.needs_phone_mapping ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800">
              Este contacto necesita asociar un número para poder responder.
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Este contacto solo está identificado por WhatsApp LID. Para responder,
              asociá su número telefónico.
            </p>
            <div className="mt-3 space-y-2">
              {linkSuccess ? <p className="text-sm text-emerald-600">{linkSuccess}</p> : null}
              {linkError ? <p className="text-sm text-red-500">{linkError}</p> : null}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="5492355472157"
                  disabled={linkingPhone}
                  className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
                />
                <button
                  onClick={handleLinkPhone}
                  disabled={linkingPhone || !phoneNumber.trim()}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
                >
                  {linkingPhone ? "..." : "Asociar número"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {mode === "AI" ? (
          <p className={`text-sm text-center py-1 ${
            conversation.needs_phone_mapping ? "text-amber-600" : "text-gray-400"
          }`}>
            {conversation.needs_phone_mapping
              ? "La IA no puede responder hasta asociar un número de WhatsApp a este contacto."
              : "El bot responde automáticamente en modo IA"}
          </p>
        ) : (
          <div className="space-y-2">
            {sendError ? (
              <p className="text-sm text-red-500">{sendError}</p>
            ) : null}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Escribe un mensaje..."
                disabled={sending || conversation.needs_phone_mapping}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim() || conversation.needs_phone_mapping}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors"
              >
                {sending ? "..." : "Enviar"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmación de borrado */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-800 mb-2">
              Borrar conversación
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Se borrarán todos los mensajes de esta conversación. Esta acción no
              se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
