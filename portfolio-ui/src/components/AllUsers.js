/*
 * AllUsers.js
 * -----------
 * Standalone listing of everyone with a page, at /users.
 *
 * Reachable from the dashboard and from any individual profile. Public, so a
 * visitor who lands on one person's page can browse the rest without an account.
 */

import { Link } from "react-router-dom";
import UserList from "./UserList";
import useTheme from "../useTheme";
import { SITE_THEME_COLOR } from "../theme";
import "../styles/Auth.css";

function AllUsers() {
  /* A shared page belonging to no single user. */
  useTheme(SITE_THEME_COLOR);

  return (
    <div className="dashboard-page">
      <div className="dashboard-inner">

        <header className="dashboard-header">
          <div>
            <h1 className="auth-title">&gt; ALL USERS</h1>
          </div>
          <Link className="nav-link" to="/dashboard">⌂ HOME</Link>
        </header>

        <UserList />

      </div>
    </div>
  );
}

export default AllUsers;
