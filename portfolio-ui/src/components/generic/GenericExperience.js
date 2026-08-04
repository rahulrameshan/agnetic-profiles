/*
 * GenericExperience.js
 * --------------------
 * Prop-driven twin of Experience.js.
 * Optional fields (location, stack, highlights) are guarded because the
 * extractor leaves them empty when the CV doesn't state them.
 */

import '../../styles/Experience.css';

function GenericExperience({ experience }) {
  if (!experience || experience.length === 0) return null;

  return (
    <section className="experience-section" id="experience">

      <span className="section-label">&gt; work_history</span>
      <h2 className="section-title">Experience</h2>

      <div className="experience-timeline">
        {experience.map((job, idx) => (
          <div className="exp-card" key={idx}>

            {/* Left: company + meta */}
            <div className="exp-meta">
              <p className="exp-company">{job.company}</p>
              <p className="exp-period">{job.period}</p>
              {job.location && <p className="exp-location">{job.location}</p>}

              <div className="exp-stack">
                {(job.stack || []).map((t) => (
                  <span className="exp-tag" key={t}>{t}</span>
                ))}
              </div>
            </div>

            {/* Right: role + highlights */}
            <div className="exp-body">
              <h3 className="exp-role">{job.role}</h3>
              <ul className="exp-highlights">
                {(job.highlights || []).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>

          </div>
        ))}
      </div>

    </section>
  );
}

export default GenericExperience;
