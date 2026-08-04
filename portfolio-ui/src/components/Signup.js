/*
 * Signup.js
 * ---------
 * Account creation. The username becomes the public URL (/u/<username>), so it
 * is shown back to the user as they type.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../api/client";
import "../styles/Auth.css";

function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    display_name: "",
    headline: "",
    location: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      /* Optional fields go as null rather than "" so the API stores nothing. */
      await signup({
        ...form,
        username: form.username.trim().toLowerCase(),
        headline: form.headline || null,
        location: form.location || null,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(errorMessage(err, "Could not create the account."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">&gt; CREATE_ACCOUNT</h1>
        <p className="auth-subtitle">Upload a CV, get an agent that speaks for you.</p>

        <div className="auth-field">
          <label className="auth-label" htmlFor="display_name">Full name</label>
          <input
            id="display_name"
            className="auth-input"
            value={form.display_name}
            onChange={update("display_name")}
            required
            autoFocus
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="username">Username</label>
          <input
            id="username"
            className="auth-input"
            value={form.username}
            onChange={update("username")}
            required
          />
          <span className="auth-hint">
            Your page: /u/{form.username.trim().toLowerCase() || "your-name"}
          </span>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="auth-input"
            type="email"
            value={form.email}
            onChange={update("email")}
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="auth-input"
            type="password"
            value={form.password}
            onChange={update("password")}
            minLength={8}
            required
          />
          <span className="auth-hint">At least 8 characters.</span>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="headline">Headline (optional)</label>
          <input
            id="headline"
            className="auth-input"
            value={form.headline}
            onChange={update("headline")}
            placeholder="Lead Software Engineer"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="location">Location (optional)</label>
          <input
            id="location"
            className="auth-input"
            value={form.location}
            onChange={update("location")}
            placeholder="Luxembourg"
          />
        </div>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? "CREATING..." : "CREATE ACCOUNT"}
        </button>

        <p className="auth-note">
          Already registered? <Link className="auth-link" to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}

export default Signup;
