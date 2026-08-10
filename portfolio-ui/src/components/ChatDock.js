/*
 * ChatDock.js
 * -----------
 * The floating conversation panel, pinned to the top-right corner.
 *
 * Replaces the full-page thread view: messages are a side channel, not a
 * destination, so they shouldn't take you away from whatever you were reading.
 *
 * Whenever a new message arrives the panel drops in and swings on its hinge —
 * `transform-origin: top right` plus a damped rotation, so it settles like
 * something hanging rather than snapping into place.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChatDock } from "../context/ChatDockContext";
import api, { errorMessage } from "../api/client";
import "../styles/ChatDock.css";

const POLL_MS = 6000;

function ChatDock() {
  const { user } = useAuth();
  const { openId, listOpen, openConversation, openList, close } = useChatDock();

  const [threads, setThreads] = useState([]);
  const [unread, setUnread] = useState(0);
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [swinging, setSwinging] = useState(false);

  const bottomRef = useRef(null);
  const lastSeen = useRef(0);

  /* ── inbox polling ─────────────────────────────── */

  const pollInbox = useCallback(() => {
    api
      .get("/me/notifications")
      .then((res) => {
        setUnread(res.data.unread);

        // A rise in unread means something new arrived — swing the panel.
        if (res.data.unread > lastSeen.current) setSwinging(true);
        lastSeen.current = res.data.unread;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    pollInbox();
    const timer = setInterval(pollInbox, POLL_MS);
    return () => clearInterval(timer);
  }, [user, pollInbox]);

  /* The animation is one-shot; clear the class once it has played. */
  useEffect(() => {
    if (!swinging) return undefined;
    const timer = setTimeout(() => setSwinging(false), 1100);
    return () => clearTimeout(timer);
  }, [swinging]);

  /* ── thread list ───────────────────────────────── */

  const loadThreads = useCallback(() => {
    api
      .get("/me/conversations")
      .then((res) => setThreads(res.data))
      .catch((err) => setError(errorMessage(err, "Could not load conversations.")));
  }, []);

  useEffect(() => {
    if (listOpen && !openId) loadThreads();
  }, [listOpen, openId, loadThreads]);

  /* ── open thread ───────────────────────────────── */

  const loadThread = useCallback(() => {
    if (!openId) return;
    api
      .get(`/me/conversations/${openId}`)
      .then((res) => setThread(res.data))
      .catch((err) => setError(errorMessage(err, "Could not load this conversation.")));
  }, [openId]);

  useEffect(() => {
    if (!openId) {
      setThread(null);
      return undefined;
    }
    loadThread();
    const timer = setInterval(loadThread, POLL_MS);
    return () => clearInterval(timer);
  }, [openId, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages?.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;

    setSending(true);
    setError(null);

    try {
      const res = await api.post(`/me/conversations/${openId}/messages`, { body });
      setThread(res.data);
      setBody("");
    } catch (err) {
      setError(errorMessage(err, "Could not send that message."));
    } finally {
      setSending(false);
    }
  };

  // Signed-out visitors have no inbox, so the dock stays out of their way.
  if (!user) return null;

  return (
    <div className="dock">

      {/* Launcher — always visible, carries the unread count. */}
      <button
        className={`dock-launcher ${unread > 0 ? "dock-launcher--unread" : ""}`}
        onClick={listOpen ? close : openList}
        aria-label={`Messages${unread ? `, ${unread} unread` : ""}`}
      >
        ✉ {unread > 0 ? unread : ""}
      </button>

      {listOpen && (
        <div className={`dock-panel ${swinging ? "dock-panel--swing" : ""}`}>

          <header className="dock-head">
            <span className="dock-title">
              {thread ? thread.with_display_name : "MESSAGES"}
            </span>
            <div className="dock-head-actions">
              {thread && (
                <button className="dock-icon" onClick={openList} aria-label="Back">
                  ←
                </button>
              )}
              <button className="dock-icon" onClick={close} aria-label="Close">
                ✕
              </button>
            </div>
          </header>

          {error && <p className="dock-error">{error}</p>}

          {/* ── list of threads ── */}
          {!openId && (
            <div className="dock-list">
              {threads.length === 0 && (
                <p className="dock-empty">No conversations yet.</p>
              )}
              {threads.map((t) => (
                <button
                  key={t.id}
                  className="dock-thread"
                  onClick={() => openConversation(t.id)}
                >
                  <span className="dock-thread-name">{t.with_display_name}</span>
                  <span className="dock-thread-time">
                    {new Date(t.last_message_at).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── one thread ── */}
          {thread && (
            <>
              {thread.agent_transcript.length > 0 && (
                <details className="dock-context">
                  <summary>What they asked the agent</summary>
                  {thread.agent_transcript.map((turn, i) => (
                    <p key={i} className={`dock-turn dock-turn--${turn.role}`}>
                      {turn.role === "user" ? "> " : "$ "}
                      {turn.content}
                    </p>
                  ))}
                </details>
              )}

              <div className="dock-messages">
                {thread.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`dock-bubble ${
                      message.sender_user_id === user.id ? "dock-bubble--mine" : ""
                    }`}
                  >
                    {message.body}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <form className="dock-compose" onSubmit={send}>
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a reply…"
                  aria-label="Reply"
                />
                <button type="submit" disabled={sending || !body.trim()}>
                  {sending ? "…" : "SEND"}
                </button>
              </form>

              <Link className="dock-profile-link" to={`/u/${thread.with_username}`}>
                view /u/{thread.with_username}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ChatDock;
