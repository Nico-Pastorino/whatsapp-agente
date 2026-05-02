"use client";

interface Props {
  conversationId: string;
  mode: "AI" | "HUMAN";
  onChange: (mode: "AI" | "HUMAN") => void;
}

export default function ModeToggle({ conversationId, mode, onChange }: Props) {
  async function select(next: "AI" | "HUMAN") {
    if (next === mode) return;
    await fetch(`/api/mode/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
    onChange(next);
  }

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => select("AI")}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          mode === "AI"
            ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-200"
            : "text-gray-400 hover:text-gray-600"
        }`}
      >
        Modo IA
      </button>
      <button
        onClick={() => select("HUMAN")}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          mode === "HUMAN"
            ? "bg-white text-amber-700 shadow-sm ring-1 ring-amber-200"
            : "text-gray-400 hover:text-gray-600"
        }`}
      >
        Humano
      </button>
    </div>
  );
}
