/*
 * OwnerPortfolio.js
 * -----------------
 * The owner's portfolio, served at "/".
 *
 * Hybrid by design:
 *   About, Impact              — hand-written components, kept as-is
 *   Skills, Experience, Projects — rendered from the owner's generated profile,
 *                                so they refresh whenever a new CV is uploaded
 *
 * Those three had no components wired here before; they fell through to <About />.
 * They now come from the same background extraction that drives /u/:username, which
 * means a CV upload updates this page too, with no code change.
 *
 * Which account backs this page is REACT_APP_OWNER_USERNAME (default "rahul").
 *
 * Fixed two-panel layout. Left sidebar stays put, right panel swaps content.
 * No page scroll — everything lives within 100vh.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import About      from "./About";
import Impact     from "./Impact";
import Chat       from "./Chat";
import GenericSkills     from "./generic/GenericSkills";
import GenericExperience from "./generic/GenericExperience";
import GenericProjects   from "./generic/GenericProjects";
import api from "../api/client";
import "../styles/Layout.css";

/* Navigation items — each maps to a section component */
const NAV_ITEMS = ["About", "Impact", "Skills", "Experience", "Projects"];

const OWNER_USERNAME = process.env.REACT_APP_OWNER_USERNAME || "rahul";

function OwnerPortfolio() {
  const [activeSection, setActiveSection] = useState("About");
  const [chatOpen, setChatOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const sessionId = useRef(`session_${Date.now()}`);

  const load = useCallback(() => {
    api
      .get(`/u/${OWNER_USERNAME}`)
      .then((res) => setProfile(res.data))
      /* The hand-written sections must still render if the backend is down or
       * the owner account hasn't been seeded yet. */
      .catch(() => setProfile({ status: "unavailable", data: {} }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Extraction runs in the background after an upload, so pick up the result. */
  useEffect(() => {
    if (profile?.status !== "pending") return undefined;
    const timer = setTimeout(load, 3000);
    return () => clearTimeout(timer);
  }, [profile, load]);

  const data = profile?.data || {};

  /* Shown when a generated section has nothing behind it yet. */
  const placeholder = (label) => (
    <section className="section">
      <span className="section-label">&gt; {label}</span>
      <h2 className="section-title">Not available yet</h2>
      <p>
        {profile?.status === "pending"
          ? "Rebuilding this section from the latest CV…"
          : "This section is generated from the CV. Upload one from the dashboard."}
      </p>
    </section>
  );

  /* Render the correct right panel based on nav selection */
  const renderSection = () => {
    if (chatOpen) {
      return <Chat sessionId={sessionId.current} username={OWNER_USERNAME} />;
    }

    switch (activeSection) {
      case "About":  return <About />;
      case "Impact": return <Impact />;
      case "Skills":
        return data.skills?.length
          ? <GenericSkills skills={data.skills} />
          : placeholder("skills_stack");
      case "Experience":
        return data.experience?.length
          ? <GenericExperience experience={data.experience} />
          : placeholder("work_history");
      case "Projects":
        return data.projects?.length
          ? <GenericProjects projects={data.projects} />
          : placeholder("shipped_work");
      default:       return <About />;
    }
  };

  const handleChatToggle = () => {
    setChatOpen((prev) => !prev);
  };

  return (
    <div className="layout">

      {/* ── LEFT SIDEBAR ─────────────────────────────── */}
      <aside className="sidebar">

        {/* Identity */}
        <div className="sidebar-identity">
          <p className="sidebar-greeting">&gt; hello, I'm</p>
          <h1 className="sidebar-name">Rahul<br />Rameshan</h1>
          <p className="sidebar-role">Lead Software Engineer</p>
          <p className="sidebar-role">Backend Architect · Team Lead</p>
          <span className="sidebar-status">● Available · Luxembourg</span>
        </div>

        {/* Navigation */}
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

        {/* Chat trigger */}
        <button
          className={`sidebar-chat-btn ${chatOpen ? "sidebar-chat-btn--active" : ""}`}
          onClick={handleChatToggle}
        >
          💬 {chatOpen ? "Close Agent" : "Chat with my Agent"}
        </button>

      </aside>

      {/* ── RIGHT CONTENT PANEL ──────────────────────── */}
      <main className="content">
        {renderSection()}
      </main>

    </div>
  );
}

export default OwnerPortfolio;
