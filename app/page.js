"use client";

import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  { label: "Track", text: "Where is shipment A123 right now?" },
  { label: "Delays", text: "Which shipments are delayed and why?" },
  { label: "SOP", text: "How do I file a damaged shipment report?" },
  { label: "HR", text: "When are timesheets due and what happens if I'm late?" },
];

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Request failed");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          error: true,
          content: err.message || "Something went wrong. Try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="masthead">
        <h1>
          Dispatch<span className="accent">Desk</span>
        </h1>
        <span className="route-tag">RAG · DEMO · DAL-TX</span>
      </header>

      <section className="thread" aria-live="polite">
        {messages.length === 0 && (
          <div className="empty">
            <p className="kicker">Internal operations assistant</p>
            <h2>Ask about shipments, SOPs, or HR policy</h2>
            <p>
              Answers are retrieved from live shipment records and the company
              handbook, then grounded by an LLM — so every reply cites where it
              came from.
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s.label} onClick={() => send(s.text)}>
                  <span className="q-label">{s.label}</span>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="msg user">
              {m.content}
            </div>
          ) : (
            <div key={i} className={`msg assistant${m.error ? " error" : ""}`}>
              <div className="waybill-strip">
                <span>
                  <span className="dot">●</span> DispatchDesk
                </span>
                <span>MSG {String(i + 1).padStart(3, "0")}</span>
              </div>
              <div className="body">{m.content}</div>
              {m.sources?.length > 0 && (
                <div className="sources">
                  {m.sources.map((s, j) => (
                    <span key={j} className="tag" title={`similarity ${s.score}`}>
                      {s.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {loading && (
          <div className="msg assistant">
            <div className="waybill-strip">
              <span>
                <span className="dot">●</span> DispatchDesk
              </span>
              <span>RETRIEVING…</span>
            </div>
            <div className="typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </section>

      <div className="composer">
        <div className="composer-inner">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="e.g. What's the status of shipment A127?"
            aria-label="Ask a question"
            disabled={loading}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
        <p className="footnote">
          Demo data only — answers are grounded in retrieved records, sources
          shown per reply.
        </p>
      </div>
    </main>
  );
}
