import React, { useEffect, useRef, useState } from "react";
import { Send, Wrench, Loader2 } from "lucide-react";
import { api } from "../api.js";
import PixelPaymentArt from "../components/PixelPaymentArt.jsx";

const SUGGESTIONS = [
  "Summarize the current pipeline status",
  "Show me the highest-value unresolved cases",
  "Which failure reason has the worst recovery rate?",
  "How many cases were escalated to a human?",
];

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [llmAvailable, setLlmAvailable] = useState(true);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.metrics().then((m) => setLlmAvailable(!!m.llm_enabled)).catch(() => {});
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setError(null);
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content }]);
    setSending(true);
    try {
      const res = await api.assistant(content, history);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          tool_call: res.tool_call,
          tool_args: res.tool_args,
          referenced_transaction_ids: res.referenced_transaction_ids || [],
        },
      ]);
    } catch (e) {
      setError(e.data?.message || e.message || "The assistant call failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container" style={{ padding: "48px 32px 96px", maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-strong)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
          Real tool-calling assistant
        </div>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Ask about your recovery data</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14.5, maxWidth: 640 }}>
          Every answer here is grounded in a real tool call against the live case data and metrics from this run.
          The model never sees the full dataset in its prompt, and never answers from memory. The tool it chose is
          shown under each answer so you can verify the claim.
        </p>
      </div>

      {!llmAvailable && (
        <div style={{ padding: "12px 16px", borderRadius: 10, background: "var(--amber-soft)", color: "var(--amber)", fontSize: 13, marginBottom: 20 }}>
          No LLM provider is configured on the server (GEMINI_API_KEY / NVIDIA_API_KEY). The assistant needs one to
          run. It will return an error until a key is set.
        </div>
      )}

      <div className="surface" style={{ display: "flex", flexDirection: "column", height: 520, overflow: "hidden" }}>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.length === 0 && (
            <div style={{ margin: "auto", textAlign: "center", maxWidth: 480 }}>
              <div style={{ marginBottom: 16 }}>
                <PixelPaymentArt size={88} />
              </div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 18 }}>
                Not sure what to ask? Try one of these:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="btn btn-ghost"
                    style={{ fontSize: 13, justifyContent: "flex-start", textAlign: "left" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <ChatBubble key={i} message={m} />
          ))}

          {sending && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)", fontSize: 13 }}>
              <Loader2 size={14} className="spin" /> Thinking…
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: "8px 20px", background: "var(--red-soft)", color: "var(--red)", fontSize: 12.5 }}>{error}</div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          style={{ display: "flex", gap: 10, padding: 16, borderTop: "1px solid var(--border)" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about cases, metrics, or the pipeline…"
            style={{
              flex: 1,
              padding: "11px 14px",
              borderRadius: 10,
              border: "1px solid var(--border-strong)",
              background: "var(--bg)",
              color: "var(--text-primary)",
              fontSize: 13.5,
            }}
          />
          <button type="submit" disabled={sending || !input.trim()} className="btn btn-primary">
            <Send size={14} />
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .chat-bubble-in { animation: bubbleIn 0.25s cubic-bezier(0.16,1,0.3,1); }
        @keyframes bubbleIn {
          from { opacity: 0; transform: translateY(6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .chat-bubble-in { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className="chat-bubble-in" style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{ maxWidth: "82%" }}>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            background: isUser ? "var(--accent)" : "var(--bg-inset)",
            color: isUser ? "#fff" : "var(--text-primary)",
            fontSize: 13.5,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
          }}
        >
          {message.content}
        </div>
        {!isUser && message.tool_call && (
          <div
            style={{
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <Wrench size={11} />
            <span>
              {message.tool_call}
              {message.tool_args && Object.keys(message.tool_args).length > 0
                ? `(${JSON.stringify(message.tool_args)})`
                : "()"}
            </span>
          </div>
        )}
        {!isUser && message.referenced_transaction_ids?.length > 0 && (
          <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {message.referenced_transaction_ids.map((id) => (
              <span
                key={id}
                style={{
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: "var(--accent-soft)",
                  color: "var(--accent-strong)",
                }}
              >
                {id}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
