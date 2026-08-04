/*
 * GenericImpact.js
 * ----------------
 * Prop-driven twin of Impact.js.
 * Renders nothing when the CV stated no metrics — an empty stat grid is worse
 * than no stat grid.
 */

import '../../styles/Impact.css';

function GenericImpact({ stats }) {
  if (!stats || stats.length === 0) return null;

  return (
    <section className="impact section" id="impact">

      <span className="section-label">&gt; impact_metrics</span>
      <h2 className="section-title">By the Numbers</h2>

      <div className="impact-grid">
        {stats.map((stat, index) => (
          <div className="impact-card" key={index}>
            <span className="impact-value">{stat.value}</span>
            <span className="impact-label">{stat.label}</span>
          </div>
        ))}
      </div>

    </section>
  );
}

export default GenericImpact;
