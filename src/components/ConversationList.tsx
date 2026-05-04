"use client";

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

interface Props {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function displayPhone(phone: string): string {
  return phone.split("@")[0].split(":")[0];
}

function relativeTime(ts: number | null): string {
  if (!ts) return "";
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: Props) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <p className="text-gray-400 text-sm">
          Aún no hay conversaciones.
          <br />
          Cuando alguien escriba al WhatsApp conectado, aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto">
      {conversations.map((conv) => (
        <li key={conv.id}>
          <button
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              selectedId === conv.id ? "bg-gray-100" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-gray-800 truncate text-sm">
                {conv.name || displayPhone(conv.phone)}
              </span>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                  conv.mode === "AI"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {conv.mode === "AI" ? "IA" : "Humano"}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1 gap-2">
              <p className="text-xs text-gray-400 truncate flex-1">
                {conv.last_message_preview ?? "Sin mensajes"}
              </p>
              <span className="text-xs text-gray-300 shrink-0">
                {relativeTime(conv.last_message_at)}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
