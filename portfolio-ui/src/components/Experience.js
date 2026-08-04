/*
 * Experience.js
 * -------------
 * Chronological career timeline — cards, not a wall of text.
 * Recruiter-optimised: company → title → duration → 2-3 bullet wins.
 */

import '../styles/Experience.css';

const JOBS = [
  {
    company:    "Byborg Enterprises",
    role:       "Lead Software Engineer / Team Lead",
    period:     "2022 — Present",
    location:   "Luxembourg",
    stack:      ["Python", "Django", "PostgreSQL", "Redis", "Kafka", "AWS", "Docker"],
    highlights: [
      "Led a 12-engineer backend team across two product squads.",
      "Reduced deployment pipeline time by 40% via CI/CD refactor.",
      "Designed event-driven microservices handling 7 K req/s at peak.",
    ],
  },
  {
    company:    "MIW (Make It Work)",
    role:       "Senior Backend Engineer",
    period:     "2020 — 2022",
    location:   "Remote",
    stack:      ["Python", "FastAPI", "PostgreSQL", "Elasticsearch", "GCP"],
    highlights: [
      "Cut average DB query time by 35% through index optimisation.",
      "Built async data-ingestion pipeline processing 2 M records/day.",
      "Introduced ADR culture — architectural decisions became documented assets.",
    ],
  },
  {
    company:    "Freelance / Consulting",
    role:       "Backend Engineer",
    period:     "2018 — 2020",
    location:   "Remote",
    stack:      ["Python", "Django", "Node.js", "MongoDB", "Docker"],
    highlights: [
      "Delivered REST APIs for fintech, logistics, and media startups.",
      "Maintained 99.9% uptime SLAs across six concurrent client projects.",
      "Mentored two junior engineers from internship to mid-level.",
    ],
  },
  {
    company:    "Early Career",
    role:       "Software Engineer",
    period:     "2015 — 2018",
    location:   "India",
    stack:      ["Python", "Django", "MySQL", "Linux"],
    highlights: [
      "Built internal tooling and CRMs for 3 product companies.",
      "First exposure to production deployments and on-call rotations.",
      "Led migration from monolith to service-oriented architecture.",
    ],
  },
];

function Experience() {
  return (
    <section className="experience-section" id="experience">

      <span className="section-label">&gt; work_history</span>
      <h2 className="section-title">Experience</h2>

      <div className="experience-timeline">
        {JOBS.map((job, idx) => (
          <div className="exp-card" key={idx}>

            {/* Left: company + meta */}
            <div className="exp-meta">
              <p className="exp-company">{job.company}</p>
              <p className="exp-period">{job.period}</p>
              <p className="exp-location">{job.location}</p>

              {/* Tech tags */}
              <div className="exp-stack">
                {job.stack.map((t) => (
                  <span className="exp-tag" key={t}>{t}</span>
                ))}
              </div>
            </div>

            {/* Right: role + highlights */}
            <div className="exp-body">
              <h3 className="exp-role">{job.role}</h3>
              <ul className="exp-highlights">
                {job.highlights.map((h, i) => (
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

export default Experience;
