/*
 * Hero.js
 * -------
 * The first thing a recruiter sees.
 * One job: make them want to scroll.
 *
 * Structure:
 *   greeting → name → title → tagline → location → CTA buttons
 */

import '../styles/Hero.css';

function Hero() {
  return (
    <section className="hero">

      {/* The blinking cursor line — signals this is a terminal-inspired portfolio */}
      <p className="hero-greeting">&gt; hello, world. I'm</p>

      {/* Name — the biggest thing on the page */}
      <h1 className="hero-name">Rahul Rameshan</h1>

      {/* Role — what he does in plain English */}
      <h2 className="hero-title">
        Lead Software Engineer · Backend Architect · Team Lead
      </h2>

      {/* The number that stops scrolling — 40M users */}
      <p className="hero-tagline">
        9+ years building scalable systems for <span className="hero-highlight">40M+ users</span>
      </p>

      {/* Location and work eligibility — critical for EU recruiters */}
      <p className="hero-location">
        📍 Luxembourg &nbsp;·&nbsp; Available to work &nbsp;·&nbsp; No sponsorship needed
      </p>

      {/* Two CTAs — primary takes them to work, secondary to contact */}
      <div className="hero-buttons">
        <a href="#experience" className="btn btn-primary">View My Work</a>
        <a href="#contact"    className="btn btn-secondary">Get in Touch</a>
      </div>

    </section>
  );
}

export default Hero;