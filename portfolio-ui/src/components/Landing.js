/*
 * Landing.js
 * ----------
 * The page at "/".
 *
 * No account is special here: "/" explains the product and points people at
 * signup or their own page. Every portfolio, including the site owner's, is
 * served from the same generated route at /u/:username.
 */

import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useTheme from "../useTheme";
import { SITE_THEME_COLOR } from "../theme";
import "../styles/Auth.css";

const STEPS = [
  { n: "01", text: "Create an account and pick your username." },
  { n: "02", text: "Upload your CV as a PDF." },
  { n: "03", text: "Share /u/your-name — an agent answers questions about you." },
];

function Landing() {
  const { user, loading } = useAuth();

  /* No owner here, so the page wears the site's own colours. */
  useTheme(SITE_THEME_COLOR);

  return (
    <div className="auth-page">
      <div className="auth-card landing-card">

        <h1 className="auth-title">&gt; PORTFOLIO_AGENT</h1>
        <p className="auth-subtitle">
          Upload a CV. Get a portfolio page and an agent that speaks for you.
        </p>

        <ol className="landing-steps">
          {STEPS.map((step) => (
            <li className="landing-step" key={step.n}>
              <span className="landing-step-n">{step.n}</span>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>

        {/* Signed-in visitors get their own destinations instead of a sales pitch. */}
        {loading ? null : user ? (
          <div className="landing-actions">
            <Link className="auth-btn landing-action" to={`/u/${user.username}`}>
              VIEW MY PAGE
            </Link>
            <Link className="auth-btn landing-action" to="/dashboard">
              DASHBOARD
            </Link>
          </div>
        ) : (
          <div className="landing-actions">
            <Link className="auth-btn landing-action" to="/signup">
              CREATE ACCOUNT
            </Link>
            <Link className="auth-btn landing-action" to="/login">
              SIGN IN
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}

export default Landing;
