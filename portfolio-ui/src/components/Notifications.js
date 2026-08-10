/*
 * Notifications.js
 * ----------------
 * The owner's inbox at /notifications.
 *
 * Polls rather than holding a socket open — at this traffic a few seconds of
 * latency is invisible, and it keeps the backend a single stateless worker.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useChatDock } from "../context/ChatDockContext";
import api, { errorMessage } from "../api/client";
import useTheme from "../useTheme";
import "../styles/Auth.css";

const POLL_MS = 8000;

function Notifications() {
  const { user } = useAuth();
  const { openConversation } = useChatDock();
  useTheme(user?.theme_color);

  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api
      .get("/me/notifications")
      .then((res) => setItems(res.data.notifications))
      .catch((err) => setError(errorMessage(err, "Could not load notifications.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  /* Opening a notification marks it read and pops the thread into the dock,
   * so the list stays put behind it. */
  const open = async (item) => {
    try {
      await api.post(`/me/notifications/${item.id}/read`);
    } catch {
      /* Reading is best-effort; never block navigation on it. */
    }
    if (item.conversation_id) openConversation(item.conversation_id);
    load();
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-inner">

        <header className="dashboard-header">
          <div><h1 className="auth-title">&gt; NOTIFICATIONS</h1></div>
          <Link className="nav-link" to="/dashboard">⌂ HOME</Link>
        </header>

        {error && <p className="auth-error">{error}</p>}
        {loading && <p className="dashboard-status">Loading…</p>}

        {!loading && items.length === 0 && (
          <p className="dashboard-status">Nothing yet.</p>
        )}

        <div className="notification-list">
          {items.map((item) => (
            <button
              key={item.id}
              className={`notification ${item.is_read ? "" : "notification--unread"}`}
              onClick={() => open(item)}
            >
              <span className="notification-body">{item.body}</span>
              <span className="notification-meta">
                {new Date(item.created_at).toLocaleString()}
                {item.is_read ? "" : " · new"}
              </span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}

export default Notifications;
