/*
 * UserList.js
 * -----------
 * The list of everyone with a page. Rendered inside the dashboard — this is the
 * only place profiles are browsable from.
 *
 * Each card is drawn in that person's own chosen colours, so the list doubles
 * as a preview of what you'll land on.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import { buildPalette } from "../theme";

function UserList() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/users")
      .then((res) => setUsers(res.data))
      .catch((err) => setError(errorMessage(err, "Could not load profiles.")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="dashboard-status">Loading…</p>;
  if (error) return <p className="auth-error">{error}</p>;
  if (users.length === 0) {
    return <p className="dashboard-status">No one has published a page yet.</p>;
  }

  return (
    <div className="directory-list">
      {users.map((user) => {
        const palette = buildPalette(user.theme_color);
        return (
          <Link
            key={user.username}
            className="directory-card"
            to={`/u/${user.username}`}
            style={{
              background: palette.background,
              borderColor: palette.control,
            }}
          >
            <span className="directory-name" style={{ color: palette.accent }}>
              {user.display_name}
            </span>
            {user.headline && (
              <span className="directory-headline" style={{ color: palette.body }}>
                {user.headline}
              </span>
            )}
            <span className="directory-meta" style={{ color: palette.muted }}>
              /u/{user.username}
              {user.location ? ` · ${user.location}` : ""}
              {user.has_profile ? "" : " · no CV yet"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default UserList;
