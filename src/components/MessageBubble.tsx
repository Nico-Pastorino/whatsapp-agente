interface Message {
  id: string;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface Props {
  message: Message;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const isHuman = message.role === "human";

  return (
    <div className={`flex ${isUser ? "justify-start" : "justify-end"} mb-2`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
          isUser
            ? "bg-white border border-gray-200 text-gray-800"
            : isAssistant
            ? "bg-emerald-500 text-white"
            : "bg-amber-400 text-amber-900"
        }`}
      >
        {isHuman && (
          <p className="text-xs font-semibold mb-1 opacity-70">Humano</p>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p
          className={`text-xs mt-1 text-right ${
            isUser ? "text-gray-400" : "opacity-60"
          }`}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
