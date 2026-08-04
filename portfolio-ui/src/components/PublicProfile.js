/*
 * PublicProfile.js
 * ----------------
 * The page a visitor lands on at /u/:username.
 *
 * Mirrors the owner's two-panel layout, but every section is rendered from the
 * CV-generated profile rather than hardcoded content.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { errorMessage } from "../api/client";
import useTheme from "../useTheme";
import Chat from "./Chat";
import GenericAbout from "./generic/GenericAbout";
import GenericImpact from "./generic/GenericImpact";
import GenericSkills from "./generic/GenericSkills";
import GenericExperience from "./generic/GenericExperience";
import GenericProjects from "./generic/GenericProjects";
import "../styles/Layout.css";

const NAV_ITEMS = ["About", "Impact", "Skills", "Experience", "Projects"];

/* A visitor token is stable per browser, so a refresh continues the same
 * conversation instead of silently starting a new one. */
function getVisitorToken(username) {
  const key = `visitor_${username}`;
  let token = localStorage.getItem(key);
  if (!token) {
    token = `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, token);
  }
  return token;
}

function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("About");
  const [chatOpen, setChatOpen] = useState(false);

  const sessionId = useRef(getVisitorToken(username));

  /* Visitors see the page in its owner's chosen colour. */
  useTheme(profile?.theme_color);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/u/${username}`)
      .then((res) => {
        setProfile(res.data);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err, "Could not load this profile.")))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    load();
  }, [load]);

  /* While extraction is running, poll so the page fills in without a refresh. */
  useEffect(() => {
    if (profile?.status !== "pending") return undefined;
    const timer = setTimeout(load, 3000);
    return () => clearTimeout(timer);
  }, [profile, load]);

  const data = useMemo(() => profile?.data || {}, [profile]);

  const renderSection = () => {
    if (chatOpen) {
      return <Chat sessionId={sessionId.current} username={username} />;
    }

    if (profile.status === "pending") {
      return (
        <section className="section">
          <span className="section-label">&gt; generating</span>
          <h2 className="section-title">Building this profile…</h2>
          <p>The CV is being read. This page will fill in shortly.</p>
        </section>
      );
    }

    if (profile.status === "empty" || profile.status === "failed") {
      return (
        <section className="section">
          <span className="section-label">&gt; no_profile</span>
          <h2 className="section-title">Nothing here yet</h2>
          <p>
            {profile.display_name} hasn't published a CV yet. The agent will have
            nothing to answer from.
          </p>
        </section>
      );
    }

    switch (activeSection) {
      case "Impact":     return <GenericImpact stats={data.stats} />;
      case "Skills":     return <GenericSkills skills={data.skills} />;
      case "Experience": return <GenericExperience experience={data.experience} />;
      case "Projects":   return <GenericProjects projects={data.projects} />;
      default:           return <GenericAbout about={data.about} />;
    }
  };

  if (loading) {
    return <div className="layout"><main className="content"><p>Loading…</p></main></div>;
  }

  if (error) {
    return (
      <div className="layout">
        <main className="content">
          <section className="section">
            <span className="section-label">&gt; error</span>
            <h2 className="section-title">Profile unavailable</h2>
            <p>{error}</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="layout">

      {/* ── LEFT SIDEBAR ─────────────────────────────── */}
      <aside className="sidebar">

        {/* Navigation first, at the top: home, and the full listing. */}
        <div className="sidebar-topnav">
          <Link className="sidebar-home" to="/dashboard" title="Dashboard">
            ⌂ HOME
          </Link>
          <Link className="sidebar-home" to="/users" title="All users">
            ALL USERS
          </Link>
        </div>

        <div className="sidebar-identity">
          <p className="sidebar-greeting">&gt; hello, I'm</p>
          <h1 className="sidebar-name">{profile.display_name}</h1>
          {(profile.headline || data.headline) && (
            <p className="sidebar-role">{profile.headline || data.headline}</p>
          )}
          {(profile.location || data.location) && (
            <span className="sidebar-status">
              ● {profile.location || data.location}
            </span>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              className={`nav-item ${activeSection === item ? "nav-item--active" : ""}`}
              onClick={() => { setActiveSection(item); setChatOpen(false); }}
            >
              <span className="nav-arrow">&gt;</span> {item}
            </button>
          ))}
        </nav>

        <button
          className={`sidebar-chat-btn ${chatOpen ? "sidebar-chat-btn--active" : ""}`}
          onClick={() => setChatOpen((prev) => !prev)}
        >
          💬 {chatOpen ? "Close Agent" : `Chat with ${profile.display_name}'s Agent`}
        </button>

      </aside>

      {/* ── RIGHT CONTENT PANEL ──────────────────────── */}
      <main className="content">
        {renderSection()}
      </main>

    </div>
  );
}

export default PublicProfile;
