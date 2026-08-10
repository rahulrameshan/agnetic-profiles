/*
 * Dashboard.js
 * ------------
 * Where an owner manages their own page: upload a CV, watch the profile
 * generate, roll back to an earlier upload, and grab their public link.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { errorMessage } from "../api/client";
import useTheme from "../useTheme";
import "../styles/Auth.css";

const STATUS_TEXT = {
  empty:   "No CV uploaded yet.",
  pending: "Reading your CV and building the page…",
  ready:   "Your page is live.",
  failed:  "Generation failed.",
};

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [cvs, setCvs] = useState([]);
  const [profile, setProfile] = useState(null);
  const [file, setFile] = useState(null);
  const [pickingFile, setPickingFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  /* The owner sees their own colour while managing their page. */
  useTheme(user?.theme_color);

  const [unread, setUnread] = useState(0);

  /* Poll the inbox so a new question shows up without a reload. */
  useEffect(() => {
    const check = () =>
      api
        .get("/me/notifications")
        .then((res) => setUnread(res.data.unread))
        .catch(() => {});
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [cvRes, profileRes] = await Promise.all([
        api.get("/me/cvs"),
        api.get("/me/profile"),
      ]);
      setCvs(cvRes.data);
      setProfile(profileRes.data);
    } catch (err) {
      setError(errorMessage(err, "Could not load your data."));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* Extraction runs in the background, so poll while it is in flight. */
  useEffect(() => {
    if (profile?.status !== "pending") return undefined;
    const timer = setTimeout(refresh, 3000);
    return () => clearTimeout(timer);
  }, [profile, refresh]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setError(null);

    try {
      await api.post("/me/cv", formData);
      setFile(null);
      e.target.reset();
      setPickingFile(false);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (cvId) => {
    setError(null);
    try {
      await api.post(`/me/cv/${cvId}/activate`);
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not switch CV."));
    }
  };

  const handleCancelPick = () => {
    setPickingFile(false);
    setFile(null);
    setError(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const status = profile?.status || "empty";

  return (
    <div className="dashboard-page">
      <div className="dashboard-inner">

        <header className="dashboard-header">
          <div>
            <h1 className="auth-title">&gt; {user?.display_name}</h1>
            <p className="auth-subtitle">
              Public page:{" "}
              <Link className="auth-link" to={`/u/${user?.username}`}>
                /u/{user?.username}
              </Link>
            </p>
          </div>
          <div className="dashboard-actions">
            <Link className="nav-link" to="/notifications">
              NOTIFICATIONS{unread > 0 ? ` (${unread})` : ""}
            </Link>
            <Link className="nav-link" to="/users">
              ALL USERS
            </Link>
            <Link className="nav-link" to="/settings">
              SETTINGS
            </Link>
            <button className="nav-link" onClick={handleLogout}>
              LOG OUT
            </button>
          </div>
        </header>

        {error && <p className="auth-error">{error}</p>}

        {/* ── Profile status ─────────────────────────── */}
        <section className="dashboard-panel">
          <p className="dashboard-panel-title">PROFILE STATUS</p>
          <p className={`dashboard-status dashboard-status--${status}`}>
            {STATUS_TEXT[status] || status}
          </p>
          {status === "failed" && profile?.error && (
            <p className="auth-error">{profile.error}</p>
          )}
        </section>

        {/* ── Upload ─────────────────────────────────── */}
        <section className="dashboard-panel">
          <p className="dashboard-panel-title">UPLOAD CV</p>

          {/* The file input is revealed on request rather than sitting open. */}
          {!pickingFile ? (
            <button
              className="auth-btn color-save"
              onClick={() => setPickingFile(true)}
            >
              UPDATE CV
            </button>
          ) : (
            <form onSubmit={handleUpload}>
              <input
                className="auth-input"
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files[0])}
                autoFocus
              />
              <div className="dashboard-actions">
                <button
                  className="auth-btn color-save"
                  type="submit"
                  disabled={!file || uploading}
                >
                  {uploading ? "UPLOADING..." : "UPLOAD & REBUILD"}
                </button>
                <button
                  className="cv-activate-btn"
                  type="button"
                  onClick={handleCancelPick}
                >
                  CANCEL
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ── History ────────────────────────────────── */}
        <section className="dashboard-panel">
          <p className="dashboard-panel-title">YOUR CVS</p>
          {cvs.length === 0 && <p className="dashboard-status">Nothing uploaded yet.</p>}
          {cvs.map((cv) => (
            <div className="cv-row" key={cv.id}>
              <span>{cv.original_filename}</span>
              <span>{new Date(cv.created_at).toLocaleDateString()}</span>
              {cv.is_active ? (
                <span className="cv-active-tag">ACTIVE</span>
              ) : (
                <button
                  className="cv-activate-btn"
                  onClick={() => handleActivate(cv.id)}
                >
                  USE THIS
                </button>
              )}
            </div>
          ))}
        </section>

      </div>
    </div>
  );
}

export default Dashboard;
