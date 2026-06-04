/**
 * ChatPanel.jsx — AI chat assistant for VVS questions.
 * Shown below the project info card on the project info screen.
 */
import { useState, useEffect, useRef } from "react";
import { getChatHistory, sendChatMessage, clearChatHistory } from "../api";

export default function ChatPanel({ projectId, projectName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;
    setLoadingHistory(true);
    getChatHistory(projectId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text, id: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const reply = await sendChatMessage(projectId, text);
      setMessages((prev) => [...prev, { ...reply, id: Date.now() + 1 }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Något gick fel. Kontrollera att ANTHROPIC_API_KEY är konfigurerad på servern.",
          id: Date.now() + 1,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    if (!window.confirm("Rensa hela chatthistoriken för detta projekt?"))
      return;
    try {
      await clearChatHistory(projectId);
      setMessages([]);
    } catch {
      /* non-critical */
    }
  }

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>💬</span>
          <div>
            <div style={styles.headerTitle}>AI-assistent</div>
            <div style={styles.headerSub}>
              Ställ frågor om komponenter, installation och dimensionering
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{
              fontSize: 10,
              padding: "3px 10px",
              color: "var(--red)",
              borderColor: "var(--red)",
            }}
            onClick={handleClear}
          >
            Rensa chatt
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {loadingHistory ? (
          <div style={styles.empty}>
            <div
              className="spinner"
              style={{ width: 20, height: 20, borderWidth: 2 }}
            />
          </div>
        ) : messages.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>🔧</div>
            <div style={styles.emptyText}>
              Fråga om komponenter, installation eller dimensionering
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={msg.id || i}
                style={{
                  ...styles.message,
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {msg.role === "assistant" && (
                  <div style={styles.assistantLabel}>KalkylPal AI</div>
                )}
                <div
                  style={{
                    ...styles.bubble,
                    background:
                      msg.role === "user"
                        ? "rgba(245,200,66,0.12)"
                        : "rgba(255,255,255,0.04)",
                    border: `1px solid ${msg.role === "user" ? "rgba(245,200,66,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: msg.error ? "var(--red)" : "var(--text-primary)",
                  }}
                >
                  {msg.content.split("\n").map((line, j) => (
                    <span key={j}>
                      {line}
                      {j < msg.content.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ ...styles.message, alignSelf: "flex-start" }}>
                <div style={styles.assistantLabel}>KalkylPal AI</div>
                <div
                  style={{
                    ...styles.bubble,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div style={styles.inputRow}>
        <input
          className="input"
          style={{ flex: 1, fontSize: 13 }}
          placeholder="Skriv din fråga…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          style={{ padding: "8px 16px", fontSize: 12, flexShrink: 0 }}
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          Fråga
        </button>
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    background: "var(--bg-1)",
    overflow: "hidden",
    maxWidth: 1024,
    width: "100%",
    height: 1024,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-2)",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    color: "var(--ui-white)",
  },
  headerSub: {
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    color: "var(--text-dim)",
    marginTop: 2,
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    color: "var(--text-dim)",
    fontFamily: "var(--font-mono)",
    padding: "20px 0",
  },
  emptyIcon: { fontSize: 32 },
  emptyText: {
    fontSize: 12,
    color: "var(--text-secondary)",
    textAlign: "center",
  },
  suggestions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 8,
    width: "100%",
  },
  suggestionBtn: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    color: "var(--text-secondary)",
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    padding: "8px 12px",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.15s",
  },
  message: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxWidth: "85%",
  },
  assistantLabel: {
    fontSize: 9,
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.1em",
    color: "var(--text-dim)",
    textTransform: "uppercase",
    paddingLeft: 2,
  },
  bubble: {
    padding: "10px 14px",
    borderRadius: "var(--radius)",
    fontSize: 13,
    lineHeight: 1.6,
    fontFamily: "var(--font-sans, system-ui)",
  },
  typingDots: {
    display: "flex",
    gap: 4,
    alignItems: "center",
    height: 16,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    padding: "12px 16px",
    borderTop: "1px solid var(--border)",
    background: "var(--bg-2)",
    flexShrink: 0,
  },
};
