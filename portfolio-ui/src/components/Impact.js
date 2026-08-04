/*
 * Impact.js
 * ---------
 * Numbers that stop a recruiter from scrolling.
 * No fluff — just the metrics that prove scale.
 *
 * Structure:
 *   label → heading → grid of stat cards
 */

import '../styles/Impact.css';

/* The numbers that define Rahul's career at a glance */
const STATS = [
  { value: "40M+",  label: "Users on systems architected"         },
  { value: "7K/s",  label: "Requests per second at peak load"     },
  { value: "9+",    label: "Years of engineering experience"      },
  { value: "12",    label: "Engineers led simultaneously"         },
  { value: "40%",   label: "Deployment time reduced at Byborg"    },
  { value: "35%",   label: "DB query time reduced at MIW"         },
];

function Impact() {
  return (
    <section className="impact section" id="impact">

      {/* Section label */}
      <span className="section-label">&gt; impact_metrics</span>

      {/* Heading */}
      <h2 className="section-title">By the Numbers</h2>

      {/* Stat cards grid */}
      <div className="impact-grid">
        {STATS.map((stat, index) => (
          <div className="impact-card" key={index}>
            <span className="impact-value">{stat.value}</span>
            <span className="impact-label">{stat.label}</span>
          </div>
        ))}
      </div>

    </section>
  );
}

export default Impact;