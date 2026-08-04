/*
 * About.js
 * --------
 * The human story behind the CV.
 * Where numbers become a person.
 *
 * Structure:
 *   label → heading → story paragraph → key facts
 */

import '../styles/About.css';

function About() {
  return (
    <section className="about section" id="about">

      {/* Green label — signals the section to the reader */}
      <span className="section-label">&gt; about_me</span>

      {/* Section heading */}
      <h2 className="section-title">Who I Am</h2>

      <div className="about-grid">

        {/* Left — the story in plain English */}
        <div className="about-story">
          <p>
            I build backend systems that scale. Over 9 years I've gone from
            writing Django APIs to leading 12-person engineering teams shipping
            microservices that handle <span className="about-highlight">40M+ users</span> and{' '}
            <span className="about-highlight">7,000 requests per second</span>.
          </p>

          <p>
            I'm most at home designing event-driven architectures, mentoring
            engineers, and making sure production never breaks. I've worked
            across fintech, logistics, media, real estate, and AI — always
            on the backend, always at scale.
          </p>

          <p>
            Currently based in <span className="about-highlight">Luxembourg</span>,
            eligible to work across the EU without sponsorship.
          </p>
        </div>

        {/* Right — quick facts, scannable at a glance */}
        <div className="about-facts">

          <div className="about-fact">
            <span className="about-fact-label">Location</span>
            <span className="about-fact-value">Luxembourg, EU</span>
          </div>

          <div className="about-fact">
            <span className="about-fact-label">Experience</span>
            <span className="about-fact-value">9+ Years</span>
          </div>

          <div className="about-fact">
            <span className="about-fact-label">Specialisation</span>
            <span className="about-fact-value">Backend · Python · Cloud</span>
          </div>

          <div className="about-fact">
            <span className="about-fact-label">Languages</span>
            <span className="about-fact-value">English C2</span>
          </div>

          <div className="about-fact">
            <span className="about-fact-label">Work Status</span>
            <span className="about-fact-value about-available">
              ● Available · No Sponsorship Needed
            </span>
          </div>

        </div>
      </div>

    </section>
  );
}

export default About;