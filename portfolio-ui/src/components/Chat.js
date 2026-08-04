/*
 * Chat.js
 * -------
 * Terminal-styled chat with a candidate's agent.
 *
 * `username` selects whose agent answers and is required — there is no
 * single-tenant fallback, because no account is special.
 */

import { useState, useEffect, useRef } from "react";
import api, { errorMessage } from "../api/client";

function Chat({ sessionId, username }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [matrixDone, setMatrixDone] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setMatrixDone(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await api.post(`/u/${username}/chat`, {
        session_id: sessionId,
        message: input,
      });

      // Surface backend application-level errors (e.g. session not found)
      const content = response.data.response || response.data.error;
      const agentMessage = {
        role: "agent",
        content: content || "No response received.",
      };
      setMessages((prev) => [...prev, agentMessage]);
    } catch (err) {
      const detail = errorMessage(
        err,
        "Connection failed — is the agent backend running?"
      );
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: `ERROR: ${detail}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  if (!matrixDone) {
    return <MatrixScreen />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.dot} />
        <span style={styles.dot} />
        <span style={styles.dot} />
        <span style={styles.headerText}>AGENT_TERMINAL — SESSION: {sessionId}</span>
      </div>

      <div style={styles.chatBox}>
        <p style={styles.systemMsg}>{">"} System initialised. CV loaded. Ready for query.</p>
        {messages.map((msg, index) => (
          <div key={index} style={styles.messageBlock}>
            {msg.role === "user" ? (
              <p style={styles.userMsg}>{"> " + msg.content}</p>
            ) : (
              <p style={styles.agentMsg}>{"$ " + msg.content}</p>
            )}
          </div>
        ))}
        {loading && <p style={styles.loading}>$ processing query...</p>}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputRow}>
        <span style={styles.prompt}>{">"}</span>
        <input
          style={styles.input}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="enter your query..."
          autoFocus
        />
        <button style={styles.button} onClick={sendMessage} disabled={loading}>
          RUN
        </button>
      </div>
    </div>
  );
}

function MatrixScreen() {
  const [chars, setChars] = useState("");
  const matrixChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";

  useEffect(() => {
    const interval = setInterval(() => {
      const random = Array.from({ length: 200 }, () =>
        matrixChars[Math.floor(Math.random() * matrixChars.length)]
      ).join("");
      setChars(random);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.matrixContainer}>
      <p style={styles.matrixChars}>{chars}</p>
      <p style={styles.matrixText}>INITIALISING AGENT...</p>
      <p style={styles.matrixSubText}>LOADING CV DATA...</p>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "var(--theme-bg)",
    color: "var(--theme-accent)",
    fontFamily: "monospace",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    padding: "20px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "16px",
    borderBottom: "1px solid var(--theme-accent)",
    paddingBottom: "10px",
  },
  dot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: "var(--theme-accent)",
    display: "inline-block",
  },
  headerText: {
    fontSize: "14px",
    letterSpacing: "2px",
    marginLeft: "10px",
  },
  chatBox: {
    flex: 1,
    overflowY: "scroll",
    marginBottom: "16px",
    paddingRight: "10px",
  },
  systemMsg: {
    color: "var(--theme-accent)",
    opacity: 0.6,
    marginBottom: "12px",
  },
  messageBlock: {
    marginBottom: "12px",
  },
  userMsg: {
    color: "var(--theme-accent)",
    margin: 0,
  },
  agentMsg: {
    color: "var(--theme-accent)",
    margin: 0,
    opacity: 0.9,
    paddingLeft: "12px",
    borderLeft: "2px solid var(--theme-accent)",
  },
  loading: {
    color: "var(--theme-accent)",
    opacity: 0.5,
    animation: "blink 1s infinite",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    borderTop: "1px solid var(--theme-accent)",
    paddingTop: "12px",
  },
  prompt: {
    color: "var(--theme-accent)",
    fontSize: "18px",
  },
  input: {
    flex: 1,
    backgroundColor: "var(--theme-bg)",
    color: "var(--theme-body)",
    border: "1px solid var(--theme-control)",
    outline: "none",
    fontFamily: "monospace",
    fontSize: "16px",
    padding: "6px",
  },
  button: {
    backgroundColor: "var(--theme-bg)",
    color: "var(--theme-control)",
    border: "1px solid var(--theme-control)",
    fontFamily: "monospace",
    fontSize: "14px",
    padding: "6px 16px",
    cursor: "pointer",
    letterSpacing: "2px",
  },
  matrixContainer: {
    backgroundColor: "var(--theme-bg)",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "monospace",
    overflow: "hidden",
  },
  matrixChars: {
    color: "var(--theme-accent)",
    opacity: 0.3,
    fontSize: "12px",
    wordBreak: "break-all",
    padding: "20px",
    letterSpacing: "4px",
  },
  matrixText: {
    color: "var(--theme-accent)",
    fontSize: "24px",
    letterSpacing: "6px",
    position: "absolute",
  },
  matrixSubText: {
    color: "var(--theme-accent)",
    fontSize: "14px",
    letterSpacing: "4px",
    opacity: 0.7,
    position: "absolute",
    marginTop: "60px",
  },
};

export default Chat;