/*
 * Chat.js
 * -------
 * The CV agent, docked bottom-right.
 *
 * Floats over the profile rather than replacing it, so a visitor can read a
 * section and ask about it at the same time. The message dock is hinged on the
 * top-right corner; this one rises from the bottom-right, so the two coexist.
 *
 * `username` selects whose agent answers and is required — there is no
 * single-tenant fallback, because no account is special.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import useResizable from "../useResizable";
import "../styles/AgentDock.css";

const BOOT_MS = 3000;
const RAIN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
const DEFAULT_SIZE = { width: 420, height: 520 };

function Chat({ sessionId, username, ownerName, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { size, resizing, startResize } = useResizable({
    storageKey: "agent_dock_size",
    defaultSize: DEFAULT_SIZE,
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [booted, setBooted] = useState(false);
  const [lastQuestion, setLastQuestion] = useState("");
  const [escalated, setEscalated] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), BOOT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setLastQuestion(input);
    setEscalated(false);
    setInput("");
    setLoading(true);

    try {
      const response = await api.post(`/u/${username}/chat`, {
        session_id: sessionId,
        message: input,
      });
      const content = response.data.response || response.data.error;
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: content || "No response received." },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: `ERROR: ${errorMessage(err, "Connection failed — is the agent backend running?")}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /*
   * Escalate the last question to the page owner.
   *
   * Sign-in is required, which is what stops this becoming an anonymous way to
   * put things in someone's inbox. Signed-out visitors are sent to log in and
   * returned here afterwards.
   */
  const askOwner = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/u/${username}`)}`);
      return;
    }

    try {
      await api.post(`/u/${username}/ask`, {
        question: lastQuestion,
        session_id: sessionId,
      });
      setEscalated(true);
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: `Sent to ${ownerName || username}. They'll see it in their messages and can reply to you directly.`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: `ERROR: ${errorMessage(err, "Could not send that.")}` },
      ]);
    }
  };

  return (
    <div
      className={`agent-dock ${resizing ? "agent-dock--resizing" : ""} ${
        minimised ? "agent-dock--minimised" : ""
      }`}
      /* Collapsed to its title bar, the panel takes whatever height that needs. */
      style={{ width: size.width, height: minimised ? "auto" : size.height }}
    >
      {/* Handles live on the edges away from the bottom-right anchor, so
        * dragging outward grows the panel instead of pushing it off screen.
        * There is nothing to resize while collapsed. */}
      {!minimised && (
        <>
          <span
            className="agent-grip agent-grip--corner"
            onPointerDown={startResize("both")}
            role="separator"
            aria-label="Resize agent window"
          />
          <span
            className="agent-grip agent-grip--top"
            onPointerDown={startResize("y")}
            role="separator"
            aria-label="Resize agent height"
          />
          <span
            className="agent-grip agent-grip--left"
            onPointerDown={startResize("x")}
            role="separator"
            aria-label="Resize agent width"
          />
        </>
      )}

      <header className="agent-head">
        <span className="agent-dot" />
        <span className="agent-dot" />
        <span className="agent-dot" />
        <span className="agent-title">
          AGENT — {(ownerName || username).toUpperCase()}
        </span>
        <button
          className="agent-close"
          onClick={() => setMinimised((prev) => !prev)}
          aria-label={minimised ? "Expand agent" : "Minimise agent"}
          title={minimised ? "Expand" : "Minimise"}
        >
          {minimised ? "▢" : "—"}
        </button>

        {onClose && (
          <button className="agent-close" onClick={onClose} aria-label="Close agent">
            ✕
          </button>
        )}
      </header>

      {/* Collapsed: only the title bar remains. The conversation is kept in
        * state, so expanding again resumes it rather than starting over. */}
      {minimised ? null : !booted ? (
        <BootScreen />
      ) : (
        <>
          <div className="agent-log">
            <p className="agent-system">
              &gt; System initialised. CV loaded. Ready for query.
            </p>

            {messages.map((message, i) =>
              message.role === "user" ? (
                <p className="agent-user" key={i}>&gt; {message.content}</p>
              ) : (
                <p className="agent-reply" key={i}>{message.content}</p>
              )
            )}

            {loading && <p className="agent-thinking">$ processing query…</p>}
            <div ref={bottomRef} />
          </div>

          {/* Offered once there's a question to forward — the agent's own reply
            * invites this when it can't answer from the CV. */}
          {lastQuestion && !loading && !escalated && (
            <button className="agent-escalate" onClick={askOwner}>
              {user
                ? `↗ ASK ${(ownerName || username).toUpperCase()} THIS DIRECTLY`
                : "↗ SIGN IN TO ASK THEM DIRECTLY"}
            </button>
          )}

          <div className="agent-compose">
            <span className="agent-prompt">&gt;</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="enter your query..."
              aria-label="Ask the agent"
              autoFocus
            />
            <button onClick={sendMessage} disabled={loading}>
              RUN
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* Initialisation: character rain behind a status readout and a bar that fills
 * over the boot delay, so the wait shows progress rather than just noise. */
function BootScreen() {
  const [rain, setRain] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setRain(
        Array.from(
          { length: 320 },
          () => RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)]
        ).join("")
      );
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="agent-boot">
      <p className="agent-boot-rain" aria-hidden="true">{rain}</p>
      <p className="agent-boot-title">INITIALISING AGENT</p>
      <p className="agent-boot-sub">LOADING CV DATA…</p>
      <div className="agent-boot-bar"><span /></div>
    </div>
  );
}

export default Chat;
