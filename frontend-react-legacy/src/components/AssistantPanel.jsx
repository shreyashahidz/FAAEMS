import { useState } from "react";
import { api } from "../api/client.js";
import Icon from "./Icon.jsx";

const SUGGESTIONS = [
  "Which departments are below 90% for Criterion 6?",
  "What's missing for my profile?",
  "How many unverified records does AIML have?",
];

export default function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setQuestion("");
    setBusy(true);
    try {
      const { data } = await api.post("/assistant/query/", { question: text });
      setMessages((m) => [...m, { role: "assistant", ...data }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", answer: "Something went wrong reaching the assistant." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-30">
      {open && (
        <div className="mb-3 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-card-lg overflow-hidden flex flex-col max-h-[32rem]">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 grid place-items-center text-blue-600">
              <Icon name="smart_toy" size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Accreditation Assistant</p>
              <p className="text-[11px] text-slate-500">Grounded in your live data — cites Evidence IDs</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Try asking:</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="block w-full text-left text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:border-blue-300 hover:bg-blue-50/50 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                    m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {m.role === "user" ? (
                    m.text
                  ) : (
                    <>
                      <p className="whitespace-pre-line">{m.answer}</p>
                      {m.evidence_ids?.length > 0 && (
                        <p className="mt-2 text-[11px] text-slate-500 font-mono">
                          Sources: {m.evidence_ids.slice(0, 5).join(", ")}
                          {m.evidence_ids.length > 5 ? ` +${m.evidence_ids.length - 5} more` : ""}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-slate-400">Thinking…</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="p-3 border-t border-slate-100 flex gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about gaps, profiles, verification…"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 outline-none transition"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 grid place-items-center disabled:opacity-60"
            >
              <Icon name="send" size={16} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 grid place-items-center transition"
        aria-label="Open accreditation assistant"
      >
        <Icon name={open ? "close" : "smart_toy"} size={24} />
      </button>
    </div>
  );
}
