/*
 * Projects.js
 * -----------
 * Bento-grid project showcase.
 * Each card = one shipped thing. No fluff, no disclaimers.
 *
 * Structure:
 *   label → heading → bento grid of project cards
 */

import '../styles/Projects.css';

const PROJECTS = [
  {
    name:     "High-Scale Event Bus",
    tagline:  "Kafka-backed event streaming for 40M user platform",
    stack:    ["Python", "Kafka", "PostgreSQL", "Docker", "AWS"],
    metrics:  ["7 K req/s", "99.98% uptime", "< 5 ms p99 latency"],
    size:     "large",   /* spans 2 columns */
  },
  {
    name:     "Real-Time Data Pipeline",
    tagline:  "Async ingestion processing 2 M records per day",
    stack:    ["FastAPI", "Celery", "Redis", "GCP", "Elasticsearch"],
    metrics:  ["2 M records/day", "35% faster queries"],
    size:     "normal",
  },
  {
    name:     "CI/CD Overhaul",
    tagline:  "Reduced deploy time by 40% across 3 repos",
    stack:    ["GitHub Actions", "Docker", "Terraform", "AWS ECS"],
    metrics:  ["40% faster deploys", "0 rollback incidents"],
    size:     "normal",
  },
  {
    name:     "Internal Developer Platform",
    tagline:  "Self-serve tooling for a 12-engineer team",
    stack:    ["Python", "Django", "React", "PostgreSQL"],
    metrics:  ["12 engineers onboarded", "50% fewer Slack blockers"],
    size:     "normal",
  },
  {
    name:     "Portfolio Agent",
    tagline:  "LLM-backed agent that answers recruiter questions about my CV",
    stack:    ["Python", "FastAPI", "Claude API", "React"],
    metrics:  ["You're using it right now →"],
    size:     "normal",
  },
];

function Projects() {
  return (
    <section className="projects-section" id="projects">

      <span className="section-label">&gt; shipped_work</span>
      <h2 className="section-title">Projects</h2>

      <div className="projects-bento">
        {PROJECTS.map((proj, idx) => (
          <div
            className={`project-card ${proj.size === "large" ? "project-card--large" : ""}`}
            key={idx}
          >

            {/* Card header */}
            <div className="project-header">
              <span className="project-index">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3 className="project-name">{proj.name}</h3>
            </div>

            {/* Tagline */}
            <p className="project-tagline">{proj.tagline}</p>

            {/* Metrics */}
            <div className="project-metrics">
              {proj.metrics.map((m, i) => (
                <span className="project-metric" key={i}>{m}</span>
              ))}
            </div>

            {/* Tech stack */}
            <div className="project-stack">
              {proj.stack.map((t) => (
                <span className="project-tag" key={t}>{t}</span>
              ))}
            </div>

          </div>
        ))}
      </div>

    </section>
  );
}

export default Projects;
