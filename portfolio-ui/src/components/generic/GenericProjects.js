/*
 * GenericProjects.js
 * ------------------
 * Prop-driven twin of Projects.js.
 *
 * Card size is layout, not CV data, so it is decided here rather than asked of
 * the extractor: the first project gets the wide tile, the rest are normal.
 */

import '../../styles/Projects.css';

function GenericProjects({ projects }) {
  if (!projects || projects.length === 0) return null;

  return (
    <section className="projects-section" id="projects">

      <span className="section-label">&gt; shipped_work</span>
      <h2 className="section-title">Projects</h2>

      <div className="projects-bento">
        {projects.map((proj, idx) => (
          <div
            className={`project-card ${idx === 0 ? "project-card--large" : ""}`}
            key={idx}
          >

            <div className="project-header">
              <span className="project-index">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <h3 className="project-name">{proj.name}</h3>
            </div>

            <p className="project-tagline">{proj.tagline}</p>

            <div className="project-metrics">
              {(proj.metrics || []).map((m, i) => (
                <span className="project-metric" key={i}>{m}</span>
              ))}
            </div>

            <div className="project-stack">
              {(proj.stack || []).map((t) => (
                <span className="project-tag" key={t}>{t}</span>
              ))}
            </div>

          </div>
        ))}
      </div>

    </section>
  );
}

export default GenericProjects;
