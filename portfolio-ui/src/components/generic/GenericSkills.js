/*
 * GenericSkills.js
 * ----------------
 * Prop-driven twin of Skills.js.
 *
 * Only the marquee and core-areas cards are used: both span the full grid width,
 * so the bento stays balanced. The hand-written page's "Dev Setup" and
 * "Philosophy" cards are deliberately absent — a CV never says which laptop
 * someone owns, and inventing it is exactly what this page must not do.
 */

import '../../styles/Skills.css';

function GenericSkills({ skills }) {
  if (!skills || skills.length === 0) return null;

  /* Duplicate the tech items so the marquee loops seamlessly */
  const items = [...skills, ...skills];

  return (
    <section className="skills-section" id="skills">

      <span className="section-label">&gt; skills_stack</span>
      <h2 className="section-title">Tools of the Trade</h2>

      <div className="skills-bento">

        {/* Scrolling tech marquee (full width) */}
        <div className="skills-card skills-card--marquee">
          <p className="skills-card-label">Tech-Stack &amp; Frameworks</p>
          <div className="marquee-track">
            <div className="marquee-inner">
              {items.map((tech, i) => (
                <span className="marquee-item" key={i}>{tech}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Full skill list as tags (full width) */}
        <div className="skills-card skills-card--areas">
          <p className="skills-card-label">Core Areas</p>
          <div className="area-tags">
            {skills.map((skill) => (
              <span className="area-tag" key={skill}>{skill}</span>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}

export default GenericSkills;
