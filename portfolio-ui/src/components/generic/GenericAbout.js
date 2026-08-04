/*
 * GenericAbout.js
 * ---------------
 * Prop-driven twin of About.js, rendered from CV-generated data.
 * Same markup and stylesheet — only the content is dynamic.
 */

import '../../styles/About.css';

function GenericAbout({ about }) {
  const paragraphs = about?.paragraphs || [];
  const facts = about?.facts || [];

  if (paragraphs.length === 0 && facts.length === 0) return null;

  return (
    <section className="about section" id="about">

      <span className="section-label">&gt; about_me</span>
      <h2 className="section-title">Who I Am</h2>

      <div className="about-grid">

        {/* Left — the story */}
        <div className="about-story">
          {paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>

        {/* Right — quick facts, scannable at a glance */}
        <div className="about-facts">
          {facts.map((fact, i) => (
            <div className="about-fact" key={i}>
              <span className="about-fact-label">{fact.label}</span>
              <span className="about-fact-value">{fact.value}</span>
            </div>
          ))}
        </div>

      </div>

    </section>
  );
}

export default GenericAbout;
