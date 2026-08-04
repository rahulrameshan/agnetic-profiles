/*
 * Skills.js
 * ---------
 * Bento-grid tech showcase.
 * Scrolling tech stack, tools setup, and engineering philosophy.
 * Inspired by the reference bento layout — each card earns its tile.
 */

import { useEffect, useRef } from "react";
import '../styles/Skills.css';

/* Full tech stack — backend-heavy, honest */
const TECH_STACK = [
  "Python", "Django", "FastAPI", "Flask",
  "PostgreSQL", "Redis", "Kafka", "RabbitMQ",
  "Docker", "Kubernetes", "AWS", "GCP",
  "Terraform", "Ansible", "Go", "Node.js",
  "TypeScript", "React", "GraphQL", "MongoDB",
  "Elasticsearch", "Celery", "nginx", "Linux",
  "CI/CD", "Git", "REST APIs", "Microservices",
];

/* Dev setup — what Rahul actually uses */
const SETUP = [
  { label: "Machine",    value: "MacBook Pro (M2 Pro)" },
  { label: "IDE",        value: "Cursor / VS Code" },
  { label: "Terminal",   value: "Warp" },
  { label: "Container",  value: "Docker Desktop" },
  { label: "Cloud",      value: "AWS + GCP" },
  { label: "Database",   value: "pgAdmin + TablePlus" },
];

function Skills() {
  const marqueeRef = useRef(null);

  /* Duplicate the tech items so the marquee loops seamlessly */
  const items = [...TECH_STACK, ...TECH_STACK];

  return (
    <section className="skills-section" id="skills">

      {/* Label */}
      <span className="section-label">&gt; skills_stack</span>
      <h2 className="section-title">Tools of the Trade</h2>

      {/* ── Bento grid ──────────────────────────── */}
      <div className="skills-bento">

        {/* ── CARD 1: Scrolling tech marquee (full width) */}
        <div className="skills-card skills-card--marquee">
          <p className="skills-card-label">Tech-Stack &amp; Frameworks</p>
          <div className="marquee-track" ref={marqueeRef}>
            <div className="marquee-inner">
              {items.map((tech, i) => (
                <span className="marquee-item" key={i}>{tech}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── CARD 2: Dev setup */}
        <div className="skills-card skills-card--setup">
          <p className="skills-card-label">Dev Setup</p>
          <ul className="setup-list">
            {SETUP.map(({ label, value }) => (
              <li className="setup-row" key={label}>
                <span className="setup-key">{label}</span>
                <span className="setup-val">{value}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── CARD 3: Philosophy */}
        <div className="skills-card skills-card--philosophy">
          <p className="skills-card-label">Engineering Philosophy</p>
          <p className="philosophy-headline">YOU CAN'T HAVE EVERYTHING</p>
          <div className="philosophy-triad">
            <span className="triad-dot triad-dot--green" />
            <span className="triad-label">RELIABLE</span>
            <span className="triad-dot triad-dot--green" />
            <span className="triad-label">SCALABLE</span>
            <span className="triad-dot triad-dot--green" />
            <span className="triad-label">FAST</span>
          </div>
          <p className="philosophy-note">
            Pick the trade-offs consciously.<br />
            Build for the next order of magnitude.
          </p>
        </div>

        {/* ── CARD 4: Core areas */}
        <div className="skills-card skills-card--areas">
          <p className="skills-card-label">Core Areas</p>
          <div className="area-tags">
            {[
              "Backend Architecture", "Event-Driven Systems",
              "API Design", "Distributed Systems",
              "Team Leadership", "Performance Tuning",
              "Cloud Infrastructure", "Database Design",
              "Code Review", "System Design",
            ].map((area) => (
              <span className="area-tag" key={area}>{area}</span>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

export default Skills;
