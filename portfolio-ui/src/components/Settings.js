/*
 * Settings.js
 * -----------
 * Account settings for a signed-in owner: see the account details, replace the
 * live CV, and log out.
 *
 * "Replace" is the same operation as the dashboard's upload — the API keeps the
 * old CV on record and just switches which one is active — so the wording here
 * names the current file to make clear what is being swapped out.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api, { errorMessage } from "../api/client";
import useTheme from "../useTheme";
import { buildPalette, DEFAULT_THEME_COLOR, isValidHex } from "../theme";
import "../styles/Auth.css";

/* A spread of hues that all derive readable backgrounds — including black and
 * white, the two cases that most obviously must not produce a matching bg. */
const PRESETS = [
  "#00ff00", "#00e5ff", "#ff8800", "#ff3d7f",
  "#b388ff", "#ffd600", "#000000", "#ffffff",
];

function Settings() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [activeCv, setActiveCv] = useState(null);
  const [profileStatus, setProfileStatus] = useState(null);
  const [file, setFile] = useState(null);
  const [pickingFile, setPickingFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  /* Draft colour — previewed live, only persisted when saved. */
  const [color, setColor] = useState(user?.theme_color || DEFAULT_THEME_COLOR);
  const [savingColor, setSavingColor] = useState(false);

  useEffect(() => {
    if (user?.theme_color) setColor(user.theme_color);
  }, [user?.theme_color]);

  /* Preview the draft, not the saved value, so the whole page responds as you pick. */
  useTheme(isValidHex(color) ? color : DEFAULT_THEME_COLOR);

  const refresh = useCallback(async () => {
    try {
      const [cvRes, profileRes] = await Promise.all([
        api.get("/me/cvs"),
        api.get("/me/profile"),
      ]);
      setActiveCv(cvRes.data.find((cv) => cv.is_active) || null);
      setProfileStatus(profileRes.data.status);
    } catch (err) {
      setError(errorMessage(err, "Could not load your account."));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* Rebuilding runs in the background, so poll until it settles. */
  useEffect(() => {
    if (profileStatus !== "pending") return undefined;
    const timer = setTimeout(refresh, 3000);
    return () => clearTimeout(timer);
  }, [profileStatus, refresh]);

  const handleReplace = async (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setError(null);
    setNotice(null);

    try {
      await api.post("/me/cv", formData);
      setFile(null);
      e.target.reset();
      /* Collapse back to the button — the upload is done. */
      setPickingFile(false);
      setNotice("CV replaced. Your page is being rebuilt from it.");
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Could not replace the CV."));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveColor = async () => {
    if (!isValidHex(color)) {
      setError("Enter a hex colour like #00ff00.");
      return;
    }

    setSavingColor(true);
    setError(null);

    try {
      const res = await api.patch("/me", { theme_color: color });
      updateUser(res.data);
    } catch (err) {
      setError(errorMessage(err, "Could not save the colour."));
    } finally {
      setSavingColor(false);
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

  return (
    <div className="dashboard-page">
      <div className="dashboard-inner">

        <header className="dashboard-header">
          <div>
            <h1 className="auth-title">&gt; SETTINGS</h1>
            <p className="auth-subtitle">
              <Link className="nav-link" to="/dashboard">← BACK TO DASHBOARD</Link>
            </p>
          </div>
        </header>

        {error && <p className="auth-error">{error}</p>}

        {/* ── Account ────────────────────────────────── */}
        <section className="dashboard-panel">
          <p className="dashboard-panel-title">ACCOUNT</p>
          <div className="cv-row">
            <span>Name</span>
            <span>{user?.display_name}</span>
          </div>
          <div className="cv-row">
            <span>Email</span>
            <span>{user?.email}</span>
          </div>
          <div className="cv-row">
            <span>Public page</span>
            <Link className="auth-link" to={`/u/${user?.username}`}>
              /u/{user?.username}
            </Link>
          </div>
        </section>

        {/* ── Appearance ─────────────────────────────── */}
        <section className="dashboard-panel">
          <p className="dashboard-panel-title">PAGE COLOUR</p>

          <div className="color-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Use ${preset}`}
                title={preset}
                className={`color-swatch ${
                  color.toLowerCase() === preset ? "color-swatch--active" : ""
                }`}
                style={{
                  background: buildPalette(preset).background,
                  color: preset,
                  borderColor: preset,
                }}
                onClick={() => setColor(preset)}
              >
                Aa
              </button>
            ))}
          </div>

          <div className="color-row">
            <input
              type="color"
              className="color-input"
              aria-label="Choose a colour"
              value={isValidHex(color) ? color : DEFAULT_THEME_COLOR}
              onChange={(e) => setColor(e.target.value)}
            />
            <button
              className="auth-btn color-save"
              onClick={handleSaveColor}
              disabled={savingColor || !isValidHex(color)}
            >
              {savingColor ? "SAVING..." : "SAVE"}
            </button>
          </div>
        </section>

        {/* ── Replace CV ─────────────────────────────── */}
        <section className="dashboard-panel">
          <p className="dashboard-panel-title">REPLACE CV</p>

          <p className="dashboard-status">
            {activeCv
              ? `Currently live: ${activeCv.original_filename}`
              : "No CV is live yet."}
          </p>

          {profileStatus === "pending" && (
            <p className="dashboard-status dashboard-status--pending">
              Rebuilding your page from the new CV…
            </p>
          )}
          {notice && <p className="dashboard-status dashboard-status--ready">{notice}</p>}

          {/* The file input stays hidden until asked for — replacing a CV is
            * deliberate, not something to invite with a permanent open field. */}
          {!pickingFile ? (
            <button
              className="auth-btn color-save"
              onClick={() => setPickingFile(true)}
            >
              UPDATE CV
            </button>
          ) : (
            <form onSubmit={handleReplace}>
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
                  {uploading ? "REPLACING..." : "REPLACE CV"}
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

        {/* ── Session ────────────────────────────────── */}
        <section className="dashboard-panel">
          <p className="dashboard-panel-title">SESSION</p>
          <p className="dashboard-status">
            Signed in as {user?.username}.
          </p>
          <button className="auth-btn" onClick={handleLogout}>
            LOG OUT
          </button>
        </section>

      </div>
    </div>
  );
}

export default Settings;
